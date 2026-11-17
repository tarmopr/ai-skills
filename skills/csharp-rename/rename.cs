#:package Microsoft.CodeAnalysis.Workspaces.MSBuild@5.0.0
#:package Microsoft.CodeAnalysis.CSharp.Workspaces@5.0.0
#:property Nullable=enable
#:property ImplicitUsings=enable
#:property PublishAot=false

// Semantic C# rename with Roslyn: one call renames a symbol and every reference to it across a solution.
// Run it through run.sh, which builds it once into a per-user cache.
// Usage:
//   run.sh --new-name <Name> (--symbol <Name|Namespace.Type[.Member]> | --at <file>:<line>:<col>)
//          [--solution <path>] [--overloads] [--in-comments] [--in-strings] [--no-file-rename] [--allow-load-failures] [--dry-run] [--verbose]
// Prints one summary line by default; --verbose (or --dry-run) also lists each changed file.
// Exit codes: 0 renamed (or dry run), 1 error, 2 symbol not found, 3 ambiguous symbol.

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

return await RenameCommand.Run(options);

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
    bool DryRun,
    bool Verbose)
{
    public static RenameArguments? Parse(string[] args)
    {
        string? newName = null, symbol = null, at = null, solution = null;
        bool overloads = false, inComments = false, inStrings = false, renameFile = true, allowLoadFailures = false, dryRun = false, verbose = false;

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

        return new RenameArguments(newName, symbol, at, solution, overloads, inComments, inStrings, renameFile, allowLoadFailures, dryRun, verbose || dryRun);
    }
}

internal static class RenameCommand
{
    public static async Task<int> Run(RenameArguments arguments)
    {
        var solutionPath = arguments.Solution ?? FindSolution(Directory.GetCurrentDirectory());
        if (solutionPath is null)
        {
            Console.Error.WriteLine("No .sln/.slnx found in the current directory or its parents; pass --solution.");
            return 1;
        }

        var stopwatch = Stopwatch.StartNew();
        using var workspace = MSBuildWorkspace.Create();
        var loadFailures = 0;
        workspace.RegisterWorkspaceFailedHandler(e =>
        {
            if (e.Diagnostic.Kind == WorkspaceDiagnosticKind.Failure)
            {
                loadFailures++;
                Console.Error.WriteLine($"warning: {e.Diagnostic.Message}");
            }
        });

        var solution = await workspace.OpenSolutionAsync(solutionPath);
        if (loadFailures > 0 && !arguments.AllowLoadFailures)
        {
            Console.Error.WriteLine($"{loadFailures} project load failures (see the warnings above); nothing was changed, because references in those projects would not be renamed. Run `dotnet restore` and retry, or pass --allow-load-failures to rename only the projects that loaded.");
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
            Console.Error.WriteLine($"{symbol.ToDisplayString()} is defined in metadata, not in this solution; it cannot be renamed.");
            return 1;
        }

        var renameOptions = new SymbolRenameOptions(
            RenameOverloads: arguments.Overloads,
            RenameInStrings: arguments.InStrings,
            RenameInComments: arguments.InComments,
            RenameFile: false);
        var renamedSolution = await Renamer.RenameSymbolAsync(solution, symbol, renameOptions, arguments.NewName);

        var changedDocuments = renamedSolution.GetChanges(solution)
            .GetProjectChanges()
            .SelectMany(project => project.GetChangedDocuments())
            .Distinct()
            .ToList();

        var keptFiles = new List<string>();
        var fileMoves = arguments.RenameFile ? PlanFileMoves(solution, symbol, arguments.NewName, keptFiles) : [];
        var blockedMove = fileMoves.FirstOrDefault(move => IsOccupied(move.From, move.To));
        if (blockedMove != default)
        {
            Console.Error.WriteLine($"Cannot rename {Path.GetFileName(blockedMove.From)}: {Path.GetFileName(blockedMove.To)} already exists in that folder. Nothing was changed. Rerun with --no-file-rename, or move the existing file first.");
            return 1;
        }

        foreach (var documentId in changedDocuments)
        {
            var oldDocument = solution.GetDocument(documentId)!;
            var newDocument = renamedSolution.GetDocument(documentId)!;
            if (arguments.Verbose)
            {
                var edits = (await newDocument.GetTextChangesAsync(oldDocument)).Count();
                Console.WriteLine($"  {Path.GetRelativePath(Directory.GetCurrentDirectory(), oldDocument.FilePath!)} ({edits} edits)");
            }

            if (!arguments.DryRun)
            {
                var newText = await newDocument.GetTextAsync();
                await WriteText(oldDocument.FilePath!, newText);
            }
        }

        foreach (var (from, to) in fileMoves)
        {
            if (arguments.Verbose)
            {
                Console.WriteLine($"  file: {Path.GetRelativePath(Directory.GetCurrentDirectory(), from)} -> {Path.GetFileName(to)}");
            }

            if (!arguments.DryRun)
            {
                MoveFile(from, to);
            }
        }

        Console.WriteLine($"{(arguments.DryRun ? "Would rename" : "Renamed")} {symbol.ToDisplayString()} -> {arguments.NewName}: {changedDocuments.Count} files, {fileMoves.Count} file renames, {stopwatch.Elapsed.TotalSeconds:F0}s.");
        foreach (var keptFile in keptFiles)
        {
            Console.WriteLine($"warning: kept {Path.GetRelativePath(Directory.GetCurrentDirectory(), keptFile)}, because its project file lists it explicitly; rename the file and that entry by hand.");
        }

        if (loadFailures > 0)
        {
            Console.WriteLine($"warning: {loadFailures} project load failures; references in those projects were NOT renamed. Run `dotnet restore` and retry.");
        }

        return 0;
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

        return null;
    }

    // A type declared in OldName.cs moves to NewName.cs so the file keeps matching its type (StyleCop SA1649).
    // Files a project file names explicitly (default compile items off) are kept, since moving them would drop them from the build.
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
            .Any(projectFile => File.ReadAllText(projectFile).Contains(fileName, StringComparison.OrdinalIgnoreCase));
    }

    // A case-only rename (Foo.cs -> foo.cs) finds the source file itself on case-insensitive file systems.
    private static bool IsOccupied(string from, string to) =>
        File.Exists(to) && !string.Equals(Path.GetFullPath(from), Path.GetFullPath(to), StringComparison.OrdinalIgnoreCase);

    private static async Task WriteText(string path, SourceText text)
    {
        var encoding = text.Encoding ?? new System.Text.UTF8Encoding(encoderShouldEmitUTF8Identifier: false);
        await File.WriteAllTextAsync(path, text.ToString(), encoding);
    }

    // git mv keeps history when the file is tracked; otherwise a plain move. A tracked file that git can't move
    // (index.lock, a conflict) is still moved on disk, and the reason is printed so it can be staged by hand.
    private static void MoveFile(string from, string to)
    {
        var git = Process.Start(new ProcessStartInfo("git", ["mv", from, to])
        {
            WorkingDirectory = Path.GetDirectoryName(from)!,
            RedirectStandardError = true,
            RedirectStandardOutput = true,
        })!;
        var error = git.StandardError.ReadToEnd();
        git.WaitForExit();
        if (git.ExitCode != 0)
        {
            File.Move(from, to);
            if (!error.Contains("not under version control"))
            {
                Console.WriteLine($"warning: git mv failed ({error.Trim().Split('\n')[0]}); moved {Path.GetFileName(from)} -> {Path.GetFileName(to)} on disk only, stage it with git add -A.");
            }
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

        var candidates = declarations
            .Where(symbol => Matches(symbol, query))
            .Distinct<ISymbol>(SymbolEqualityComparer.Default)
            .ToList();

        if (candidates.Count == 0)
        {
            Console.Error.WriteLine($"No source declaration matches '{query}'.");
            return new SymbolResolution(null, 2);
        }

        // With --overloads, candidates that are all overloads of one method are one rename: Roslyn renames the rest.
        if (overloads && candidates.Count > 1 && candidates.All(c => c is IMethodSymbol)
            && candidates.Select(c => (c.ContainingType, c.Name)).Distinct().Count() == 1)
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
