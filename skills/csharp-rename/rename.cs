#:package Microsoft.CodeAnalysis.Workspaces.MSBuild@5.0.0
#:package Microsoft.CodeAnalysis.CSharp.Workspaces@5.0.0
#:property Nullable=enable
#:property ImplicitUsings=enable
#:property PublishAot=false

// Semantic C# rename with Roslyn: one call renames a symbol and every reference to it across a solution.
// Run it through run.sh, which builds it once into a per-user cache.
// Usage:
//   run.sh --new-name <Name> (--symbol <Name|dotted suffix of the qualified name|exact display string> | --at <file>:<line>:<col>)
//          [--solution <path>] [--overloads] [--in-comments] [--in-strings] [--no-file-rename] [--allow-load-failures] [--allow-errors] [--dry-run] [--verbose]
// Prints one summary line plus any warning lines, or why nothing was written; --verbose (or --dry-run) also lists each changed file.
// Exit codes: 0 renamed (or dry run), 1 error (also: nothing written because the rename would break the build), 2 symbol not found, 3 ambiguous symbol.

using System.Diagnostics;
using System.Text.RegularExpressions;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.FindSymbols;
using Microsoft.CodeAnalysis.MSBuild;
using Microsoft.CodeAnalysis.Rename;
using Microsoft.CodeAnalysis.Text;

var options = RenameArguments.Parse(args);
if (options is null)
{
    return 1;
}

// An unexpected failure (a solution that doesn't open, an MSBuild error) is reported on stdout with exit 1, and
// nothing has been written unless the message says so.
try
{
    return await RenameCommand.Run(options);
}
catch (Exception exception)
{
    Console.WriteLine($"Failed: {exception.GetType().Name}: {exception.Message}");
    return 1;
}

internal sealed record RenameArguments(
    string NewName,
    string? Symbol,
    string? At,
    string? Solution,
    bool Overloads,
    bool InComments,
    bool InStrings,
    bool RenameFile,
    bool AllowLoadFailures,
    bool AllowErrors,
    bool DryRun,
    bool Verbose)
{
    public static RenameArguments? Parse(string[] args)
    {
        string? newName = null, symbol = null, at = null, solution = null;
        bool overloads = false, inComments = false, inStrings = false, renameFile = true, allowLoadFailures = false, allowErrors = false, dryRun = false, verbose = false;

        for (var i = 0; i < args.Length; i++)
        {
            if (args[i] is "--new-name" or "--symbol" or "--at" or "--solution" && i + 1 >= args.Length)
            {
                Console.Error.WriteLine($"{args[i]} needs a value.");
                return null;
            }

            switch (args[i])
            {
                case "--new-name": newName = args[++i]; break;
                case "--symbol": symbol = args[++i]; break;
                case "--at": at = args[++i]; break;
                case "--solution": solution = args[++i]; break;
                case "--overloads": overloads = true; break;
                case "--in-comments": inComments = true; break;
                case "--in-strings": inStrings = true; break;
                case "--no-file-rename": renameFile = false; break;
                case "--allow-load-failures": allowLoadFailures = true; break;
                case "--allow-errors": allowErrors = true; break;
                case "--dry-run": dryRun = true; break;
                case "--verbose": verbose = true; break;
                default:
                    Console.Error.WriteLine($"Unknown argument: {args[i]}");
                    return null;
            }
        }

        if (newName is null || (symbol is null) == (at is null))
        {
            Console.Error.WriteLine("Required: --new-name <Name> and exactly one of --symbol <Name> or --at <file>:<line>:<col>.");
            return null;
        }

        return new RenameArguments(newName, symbol, at, solution, overloads, inComments, inStrings, renameFile, allowLoadFailures, allowErrors, dryRun, verbose || dryRun);
    }
}

internal static class RenameCommand
{
    public static async Task<int> Run(RenameArguments arguments)
    {
        var solutionPath = arguments.Solution ?? FindSolution(Directory.GetCurrentDirectory());
        if (solutionPath is null)
        {
            return 1;
        }

        var stopwatch = Stopwatch.StartNew();
        using var workspace = MSBuildWorkspace.Create();
        var loadFailures = new List<string>();
        workspace.RegisterWorkspaceFailedHandler(e =>
        {
            if (e.Diagnostic.Kind == WorkspaceDiagnosticKind.Failure)
            {
                loadFailures.Add(e.Diagnostic.Message);
            }
        });

        var solution = await workspace.OpenSolutionAsync(solutionPath);
        if (loadFailures.Count > 0 && !arguments.AllowLoadFailures)
        {
            loadFailures.ForEach(message => Console.WriteLine($"warning: {message}"));
            Console.WriteLine($"{loadFailures.Count} project load failures (see the warnings above); nothing was changed, because references in those projects would not be renamed. Run `dotnet restore` and retry, or pass --allow-load-failures to rename only the projects that loaded.");
            return 1;
        }

        if (arguments.Verbose)
        {
            Console.WriteLine($"Loaded {solution.Projects.Count()} projects from {Path.GetFileName(solutionPath)} in {stopwatch.Elapsed.TotalSeconds:F0}s.");
        }

        var resolution = arguments.At is not null
            ? await SymbolResolver.ResolveAtPosition(solution, arguments.At)
            : await SymbolResolver.ResolveByName(solution, arguments.Symbol!, arguments.Overloads);
        if (resolution.ExitCode != 0)
        {
            return resolution.ExitCode;
        }

        var symbol = resolution.Symbol!;
        if (!symbol.Locations.Any(location => location.IsInSource))
        {
            Console.WriteLine($"{symbol.ToDisplayString()} is defined in metadata, not in this solution; it cannot be renamed.");
            return 1;
        }

        var renameOptions = new SymbolRenameOptions(
            RenameOverloads: arguments.Overloads,
            RenameInStrings: arguments.InStrings,
            RenameInComments: arguments.InComments,
            RenameFile: false);
        var renamedSolution = await Renamer.RenameSymbolAsync(solution, symbol, renameOptions, arguments.NewName);

        // One new text per file. A multi-targeted project holds each file once per target framework, and each copy
        // carries only the edits its own #if branches see, so the edits of every copy are merged.
        var newTexts = new Dictionary<string, SourceText>();
        var editCounts = new Dictionary<string, int>();
        var changedGroups = renamedSolution.GetChanges(solution)
            .GetProjectChanges()
            .SelectMany(project => project.GetChangedDocuments())
            .Distinct()
            .GroupBy(documentId => solution.GetDocument(documentId)!.FilePath!);
        foreach (var group in changedGroups)
        {
            var oldText = await solution.GetDocument(group.First())!.GetTextAsync();
            var changes = new List<TextChange>();
            foreach (var documentId in group)
            {
                changes.AddRange(await renamedSolution.GetDocument(documentId)!.GetTextChangesAsync(solution.GetDocument(documentId)!));
            }

            var merged = changes.DistinctBy(change => (change.Span, change.NewText)).OrderBy(change => change.Span.Start).ToList();
            for (var i = 1; i < merged.Count; i++)
            {
                if (merged[i].Span.Start < merged[i - 1].Span.End || merged[i].Span.Start == merged[i - 1].Span.Start)
                {
                    var line = oldText.Lines.GetLineFromPosition(merged[i].Span.Start).LineNumber + 1;
                    Console.WriteLine($"Nothing changed: the target frameworks disagree on the edit at {Relative(group.Key)}:{line}; rename that file by hand.");
                    return 1;
                }
            }

            newTexts[group.Key] = oldText.WithChanges(merged);
            editCounts[group.Key] = merged.Count;
        }

        var keptFiles = new List<string>();
        var fileMoves = arguments.RenameFile ? PlanFileMoves(solution, symbol, arguments.NewName, keptFiles) : [];
        var blockedMove = fileMoves.FirstOrDefault(move => IsOccupied(move.From, move.To));
        if (blockedMove != default)
        {
            Console.WriteLine($"Cannot rename {Path.GetFileName(blockedMove.From)}: {Path.GetFileName(blockedMove.To)} already exists in that folder. Nothing was changed. Rerun with --no-file-rename, or move the existing file first.");
            return 1;
        }

        // Renamer.RenameSymbolAsync drops the conflicts it can't resolve (a new name that clashes, a reference it can't
        // rebind) without a word, and the agent is told to trust this output. So the result is compiled in memory
        // first: a line with more errors of some id than before the rename (each target framework's copy of a file is its
        // own document).
        // Any one writes nothing, unless --allow-errors. Not covered: a rename that compiles but binds differently (a
        // member that now hides or overrides another, which is only a warning) or merges two partial types.
        var problems = await FindNewErrors(solution, newTexts, symbol, arguments.NewName);
        var problemList = problems.Take(20).Select(problem => $"  {problem}").ToList();
        if (problems.Count > 20)
        {
            problemList.Add($"  … {problems.Count - 20} more");
        }

        if (problems.Count > 0)
        {
            if (!arguments.AllowErrors)
            {
                Console.WriteLine($"Nothing changed: renaming {symbol.Name} -> {arguments.NewName} would break the build:");
                problemList.ForEach(Console.WriteLine);
                Console.WriteLine("Pick another name, or fix the conflict first; --allow-errors writes it anyway.");
                return 1;
            }
        }

        // A failure partway (a read-only file, a full disk) stops with the list of what was already written.
        var written = new List<string>();
        var moveWarnings = new List<string>();
        try
        {
            foreach (var (path, newText) in newTexts)
            {
                if (arguments.Verbose)
                {
                    Console.WriteLine($"  {Relative(path)} ({editCounts[path]} edits)");
                }

                if (!arguments.DryRun)
                {
                    await WriteText(path, newText);
                    written.Add(Relative(path));
                }
            }

            foreach (var (from, to) in fileMoves)
            {
                if (arguments.Verbose)
                {
                    Console.WriteLine($"  file: {Relative(from)} -> {Path.GetFileName(to)}");
                }

                if (!arguments.DryRun)
                {
                    if (MoveFile(from, to) is { } warning)
                    {
                        moveWarnings.Add(warning);
                    }

                    written.Add($"{Path.GetFileName(from)} -> {Path.GetFileName(to)}");
                }
            }
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            Console.WriteLine($"Stopped partway: {exception.Message}");
            Console.WriteLine(written.Count == 0
                ? "Nothing was changed."
                : $"Already written ({written.Count}): {string.Join(", ", written)}. Undo the edits with git checkout and move the moved files back, or finish by hand.");
            return 1;
        }

        Console.WriteLine($"{(arguments.DryRun ? "Would rename" : "Renamed")} {symbol.ToDisplayString()} -> {arguments.NewName}: {newTexts.Count} files, {fileMoves.Count} file renames, {stopwatch.Elapsed.TotalSeconds:F0}s.");
        if (problems.Count > 0)
        {
            Console.WriteLine($"{(arguments.DryRun ? "With" : "Written with")} --allow-errors; the rename adds these errors:");
            problemList.ForEach(Console.WriteLine);
        }
        foreach (var warning in moveWarnings)
        {
            Console.WriteLine(warning);
        }

        foreach (var keptFile in keptFiles)
        {
            Console.WriteLine($"warning: kept {Path.GetRelativePath(Directory.GetCurrentDirectory(), keptFile)}, because a <Compile Include> in its project file names it; rename the file and that entry by hand.");
        }

        if (loadFailures.Count > 0)
        {
            Console.WriteLine($"warning: {loadFailures.Count} project load failures; references in those projects were NOT renamed. Run `dotnet restore` and retry:");
            loadFailures.ForEach(message => Console.WriteLine($"  {message}"));
        }

        return 0;
    }

    private static string Relative(string path) => Path.GetRelativePath(Directory.GetCurrentDirectory(), path);

    // The documents to compile: every copy (one per target framework) of each changed file, and every other document
    // that names the new name (a declaration it now clashes with, reported only at the later one) or still names the
    // old name (a reference the rename missed); for a member, only where the containing type is named too. Documents
    // with errors after the rename are compiled again without it, and a line counts when it has more errors of
    // some id than before.
    private static async Task<List<string>> FindNewErrors(Solution solution, Dictionary<string, SourceText> newTexts, ISymbol symbol, string newName)
    {
        var oldWord = new Regex($@"(?<![\w@]){Regex.Escape(symbol.Name)}(?!\w)");
        var newWord = new Regex($@"(?<![\w@]){Regex.Escape(newName)}(?!\w)");
        var isMember = symbol.ContainingType is not null && symbol is not INamedTypeSymbol;
        var renamed = solution;
        var toCheck = new List<DocumentId>();
        foreach (var document in solution.Projects.SelectMany(project => project.Documents))
        {
            if (document.FilePath is { } path && newTexts.TryGetValue(path, out var newText))
            {
                renamed = renamed.WithDocumentText(document.Id, newText);
                toCheck.Add(document.Id);
                continue;
            }

            var text = (await document.GetTextAsync()).ToString();
            if ((oldWord.IsMatch(text) || newWord.IsMatch(text)) && (!isMember || text.Contains(symbol.ContainingType!.Name, StringComparison.Ordinal)))
            {
                toCheck.Add(document.Id);
            }
        }

        var problems = new List<string>();
        foreach (var documentId in toCheck)
        {
            var after = await ErrorsOf(renamed.GetDocument(documentId)!);
            if (after.Count == 0)
            {
                continue;
            }

            // A line with more errors of some id than before is a problem. A rename never adds or removes a line,
            // so an error that was there before never blocks a valid rename, even when the rename rewrites its line.
            var before = (await ErrorsOf(solution.GetDocument(documentId)!)).GroupBy(ErrorKey).ToDictionary(group => group.Key, group => group.Count());
            foreach (var diagnostic in after)
            {
                var key = ErrorKey(diagnostic);
                if (before.GetValueOrDefault(key) > 0)
                {
                    before[key]--;
                    continue;
                }

                var span = diagnostic.Location.GetLineSpan();
                problems.Add($"{Relative(span.Path)}:{span.StartLinePosition.Line + 1}: {diagnostic.Id} {diagnostic.GetMessage()}");
            }
        }

        // Each copy of a multi-targeted file reports the same error.
        return problems.Distinct().ToList();
    }

    private static string ErrorKey(Diagnostic diagnostic) => $"{diagnostic.Id}:{diagnostic.Location.GetLineSpan().StartLinePosition.Line}";

    private static async Task<List<Diagnostic>> ErrorsOf(Document document)
    {
        var model = await document.GetSemanticModelAsync();
        // No model means nothing was checked: fail rather than read it as no errors.
        return model is null ? throw new InvalidOperationException($"no semantic model for {document.FilePath}") : model.GetDiagnostics().Where(diagnostic => diagnostic.Severity == DiagnosticSeverity.Error).ToList();
    }

    private static string? FindSolution(string directory)
    {
        for (var current = new DirectoryInfo(directory); current is not null; current = current.Parent)
        {
            var solutions = current.GetFiles("*.slnx").Concat(current.GetFiles("*.sln")).ToList();
            if (solutions.Count == 1)
            {
                return solutions[0].FullName;
            }

            if (solutions.Count > 1)
            {
                Console.Error.WriteLine($"Several solutions in {current.FullName}; pass --solution.");
                return null;
            }
        }

        Console.Error.WriteLine("No .sln/.slnx found in the current directory or its parents; pass --solution.");
        return null;
    }

    // A type declared in OldName.cs moves to NewName.cs so the file keeps matching its type (StyleCop SA1649).
    // A file a <Compile Include> in its project file names is kept, since moving it would drop it from the build.
    private static List<(string From, string To)> PlanFileMoves(Solution solution, ISymbol symbol, string newName, List<string> keptFiles)
    {
        if (symbol is not INamedTypeSymbol)
        {
            return [];
        }

        var candidates = symbol.Locations
            .Where(location => location.IsInSource && location.SourceTree?.FilePath is not null)
            .Select(location => location.SourceTree!.FilePath)
            .Distinct()
            .Where(path => Path.GetFileNameWithoutExtension(path) == symbol.Name);

        var moves = new List<(string From, string To)>();
        foreach (var path in candidates)
        {
            if (IsListedInProjectFile(solution, path))
            {
                keptFiles.Add(path);
                continue;
            }

            moves.Add((path, Path.Combine(Path.GetDirectoryName(path)!, newName + Path.GetExtension(path))));
        }

        return moves;
    }

    private static bool IsListedInProjectFile(Solution solution, string path)
    {
        var fileName = Path.GetFileName(path);
        return solution.GetDocumentIdsWithFilePath(path)
            .Select(documentId => solution.GetProject(documentId.ProjectId)?.FilePath)
            .OfType<string>()
            .Distinct()
            .Any(projectFile => CompileIncludes(projectFile)
                .Any(item => string.Equals(Path.GetFileName(item.Replace('\\', '/')), fileName, StringComparison.OrdinalIgnoreCase)));
    }

    // The items of every <Compile Include="a;b"> in a project file (a glob like **/*.cs names no file).
    private static IEnumerable<string> CompileIncludes(string projectFile) =>
        Regex.Matches(File.ReadAllText(projectFile), """<Compile\s[^>]*?\bInclude\s*=\s*(["'])(.*?)\1""")
            .SelectMany(match => match.Groups[2].Value.Split(';', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries));

    // A case-only rename (Foo.cs -> foo.cs) finds the source file itself on case-insensitive file systems.
    private static bool IsOccupied(string from, string to) =>
        File.Exists(to) && !string.Equals(Path.GetFullPath(from), Path.GetFullPath(to), StringComparison.OrdinalIgnoreCase);

    private static async Task WriteText(string path, SourceText text)
    {
        var encoding = text.Encoding ?? new System.Text.UTF8Encoding(encoderShouldEmitUTF8Identifier: false);
        await File.WriteAllTextAsync(path, text.ToString(), encoding);
    }

    // git mv keeps history when the file is tracked; otherwise a plain move. A tracked file that git can't move
    // (index.lock, a conflict), or a repo where git doesn't start, still moves on disk and returns a warning.
    private static string? MoveFile(string from, string to)
    {
        var (exitCode, error) = Git(from, "mv", "--", from, to);
        if (exitCode == 0)
        {
            return null;
        }

        // Asked before the move, while the old path is still on disk. Only a tracked file (exit 0), or git not starting
        // (-1), is worth a warning; an untracked file or no repo at all is a plain move.
        var tracked = Git(from, "ls-files", "--error-unmatch", "--", from).ExitCode is 0 or -1;
        File.Move(from, to);
        return !tracked
            ? null
            : $"warning: git mv failed ({error.Trim().Split('\n')[0]}); moved {Path.GetFileName(from)} -> {Path.GetFileName(to)} on disk only, stage it with git add -A.";
    }

    // Exit code and the first stderr text; -1 when git can't be started.
    private static (int ExitCode, string Error) Git(string fileInRepo, params string[] arguments)
    {
        try
        {
            using var git = Process.Start(new ProcessStartInfo("git", arguments)
            {
                WorkingDirectory = Path.GetDirectoryName(fileInRepo)!,
                RedirectStandardError = true,
                RedirectStandardOutput = true,
            })!;
            var error = git.StandardError.ReadToEnd();
            git.StandardOutput.ReadToEnd();
            git.WaitForExit();
            return (git.ExitCode, error);
        }
        catch (System.ComponentModel.Win32Exception exception)
        {
            return (-1, $"git did not start: {exception.Message}");
        }
    }
}

internal sealed record SymbolResolution(ISymbol? Symbol, int ExitCode);

internal static class SymbolResolver
{
    public static async Task<SymbolResolution> ResolveByName(Solution solution, string query, bool overloads)
    {
        var simpleName = SimpleName(query);
        var declarations = await SymbolFinder.FindSourceDeclarationsAsync(
            solution,
            name => name == simpleName,
            SymbolFilter.TypeAndMember);

        // A multi-targeted project is one compilation per target framework, so each declaration comes back once
        // per framework, as symbols that don't compare equal: one candidate per declaration location.
        var candidates = declarations
            .Where(symbol => Matches(symbol, query))
            .GroupBy(FormatLocation)
            .Select(group => group.First())
            .ToList();

        if (candidates.Count == 0)
        {
            Console.Error.WriteLine($"No source declaration matches '{query}'.");
            return new SymbolResolution(null, 2);
        }

        // With --overloads, candidates that are all overloads of one method are one rename: Roslyn renames the rest.
        if (overloads && candidates.Count > 1 && candidates.All(c => c is IMethodSymbol)
            && candidates.Select(c => (c.ContainingType.ToDisplayString(), c.Name)).Distinct().Count() == 1)
        {
            return new SymbolResolution(candidates[0], 0);
        }

        if (candidates.Count > 1)
        {
            Console.Error.WriteLine($"'{query}' is ambiguous. Pass one of these to --symbol, or use --at <file>:<line>:<col> (add --overloads to rename all overloads of a method):");
            foreach (var candidate in candidates)
            {
                Console.Error.WriteLine($"  {candidate.Kind,-10} {candidate.ToDisplayString()}  @ {FormatLocation(candidate)}");
            }

            return new SymbolResolution(null, 3);
        }

        return new SymbolResolution(candidates[0], 0);
    }

    public static async Task<SymbolResolution> ResolveAtPosition(Solution solution, string at)
    {
        var parts = at.Split(':');
        if (parts.Length < 3 || !int.TryParse(parts[^2], out var line) || !int.TryParse(parts[^1], out var column))
        {
            Console.Error.WriteLine("--at must be <file>:<line>:<col>, 1-based.");
            return new SymbolResolution(null, 1);
        }

        var filePath = Path.GetFullPath(string.Join(':', parts[..^2]));
        var documentId = solution.GetDocumentIdsWithFilePath(filePath).FirstOrDefault();
        if (documentId is null)
        {
            Console.Error.WriteLine($"{filePath} is not part of any project in the solution.");
            return new SymbolResolution(null, 2);
        }

        var document = solution.GetDocument(documentId)!;
        var text = await document.GetTextAsync();
        if (line < 1 || line > text.Lines.Count)
        {
            Console.Error.WriteLine($"Line {line} is outside {filePath} ({text.Lines.Count} lines).");
            return new SymbolResolution(null, 1);
        }

        var selectedLine = text.Lines[line - 1];
        var lineLength = selectedLine.End - selectedLine.Start;
        if (column < 1 || column > lineLength + 1)
        {
            Console.Error.WriteLine($"Column {column} is outside line {line} of {filePath} ({lineLength} characters).");
            return new SymbolResolution(null, 1);
        }

        var position = selectedLine.Start + column - 1;
        var semanticModel = await document.GetSemanticModelAsync();
        var symbol = await SymbolFinder.FindSymbolAtPositionAsync(semanticModel!, position, solution.Workspace);
        if (symbol is null)
        {
            Console.Error.WriteLine($"No symbol at {at}.");
            return new SymbolResolution(null, 2);
        }

        return new SymbolResolution(symbol, 0);
    }

    private static string SimpleName(string query)
    {
        var withoutTypeArguments = WithoutTypeArguments(WithoutParameters(query));
        return withoutTypeArguments[(withoutTypeArguments.LastIndexOf('.') + 1)..];
    }

    private static string WithoutParameters(string name) => name.Split('(')[0];

    // Strips every <...> group, including nested ones: Ns.Box<List<T>>.Open -> Ns.Box.Open.
    private static string WithoutTypeArguments(string name)
    {
        string previous;
        do
        {
            previous = name;
            name = Regex.Replace(name, "<[^<>]*>", string.Empty);
        }
        while (name != previous);

        return name;
    }

    // Accepts the simple name, a dotted suffix of the qualified name (Type.Member, Namespace.Type),
    // or the exact display string including type parameters or a parameter list.
    private static bool Matches(ISymbol symbol, string query)
    {
        var display = symbol.ToDisplayString();
        if (display == query)
        {
            return true;
        }

        if (query.Contains('('))
        {
            return display.EndsWith("." + query, StringComparison.Ordinal);
        }

        // A method's display string ends in its parameter list, which a query like Ns.Box<T>.Open leaves out.
        if (query.Contains('<'))
        {
            var displayWithoutParameters = WithoutParameters(display);
            return displayWithoutParameters == query || displayWithoutParameters.EndsWith("." + query, StringComparison.Ordinal);
        }

        var qualifiedName = QualifiedName(symbol);
        return qualifiedName == query || qualifiedName.EndsWith("." + query, StringComparison.Ordinal);
    }

    private static string QualifiedName(ISymbol symbol)
    {
        var parts = new Stack<string>();
        for (var current = symbol; current is not null && current is not INamespaceSymbol { IsGlobalNamespace: true }; current = current.ContainingSymbol)
        {
            parts.Push(current.Name);
        }

        return string.Join('.', parts);
    }

    private static string FormatLocation(ISymbol symbol)
    {
        var location = symbol.Locations.FirstOrDefault(l => l.IsInSource);
        if (location is null)
        {
            return "metadata";
        }

        var span = location.GetLineSpan();
        var path = Path.GetRelativePath(Directory.GetCurrentDirectory(), span.Path);
        return $"{path}:{span.StartLinePosition.Line + 1}:{span.StartLinePosition.Character + 1}";
    }
}
