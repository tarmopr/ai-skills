---
name: csharp-rename
description: Renames a C# symbol and every reference to it across a .NET solution in one Roslyn call. Use when renaming a C# type, method, property, field, parameter, namespace or other symbol — an explicit "rename X to Y" or "change the name of this class", or a rename that is one step of a larger refactor — instead of editing each file with Edit, sed, sd or ast-grep, which are slower and can't tell same-name symbols (overloads, generic arities, common method names) apart. Not for non-C# files or plain text replacements; use rg + sd for those.
allowed-tools: Bash(bash "${CLAUDE_SKILL_DIR}/run.sh" *)
---

# Rename C# symbols with Roslyn

One Bash call renames a symbol and every reference to it across the whole solution, using the compiler's own rename (types, generics, overloads, partial classes). It replaces many Edit calls with one, and it doesn't touch unrelated symbols that share the name.

## Workflow

1. **Check the contract.** If the symbol is serialized (a JSON/API DTO property, a message contract, a workflow job variable such as a Zeebe worker `TInput` property, an EF entity column), renaming it changes the wire or database name — a breaking change. Stop and ask before renaming one.
2. **Rename** with the command below. On exit 3, pick the intended candidate from the list and rerun. Use `--dry-run` only when the user wants to see the scope before anything is written.
3. **Find string usages** the compiler can't see: `rg -nw <OldName>` across the repo, including non-C# files (BPMN, appsettings, YAML, JSON, Markdown). Fix these with Edit only where the string really refers to the symbol.
4. **Build**: `dotnet build`. Report the summary line and the build result; show `git diff --stat` only if asked. If the build fails, treat every error as possibly caused by the rename, including errors in files it didn't change: a consumer in a project that failed to load, or a file a project lists explicitly. Call an error pre-existing only after building without the rename (`git stash`, build, `git stash pop`) shows the same error.

## Command

Run from the repo root (it finds the single `.sln`/`.slnx` upwards, or pass `--solution <path>`):

```bash
bash "${CLAUDE_SKILL_DIR}/run.sh" --symbol <Name> --new-name <NewName>
```

Success prints one line: `Renamed <symbol> -> <NewName>: 25 files, 0 file renames, 5s.`

| Argument | Meaning |
|---|---|
| `--symbol <q>` | Simple name (`OrderSummary`), dotted suffix (`OrderService.Cancel`), or the exact display string from an ambiguity list (`Ns.Handler<TIn, TOut>`, `Ns.Handler.Run(int)`) |
| `--solution <path>` | The `.sln`/`.slnx` to load, when there isn't exactly one in the working directory or its parents |
| `--at <file>:<line>:<col>` | 1-based position instead of `--symbol` (same positions as the LSP tool); use for locals, parameters, namespaces |
| `--overloads` | Rename every overload of a method; with `--symbol`, a name that matches only overloads of one method is then not ambiguous |
| `--in-comments` / `--in-strings` | Also rename the name inside comments / string literals (off by default) |
| `--no-file-rename` | Keep `Old.cs` file name (by default a type declared in `Old.cs` is `git mv`'d to `New.cs`) |
| `--allow-load-failures` | Rename even though some projects failed to load; references in those projects stay unrenamed |
| `--dry-run` | List the files it would change, write nothing |
| `--verbose` | Also list each changed file (implied by `--dry-run`) |

Exit codes: `0` done, `1` error, `2` not found, `3` ambiguous — stderr lists each candidate with its exact display string and `file:line:col`; rerun with one of them.

The first run builds the tool into `${XDG_CACHE_HOME:-~/.cache}/csharp-rename/` (~30s, once per version of `rename.cs`). After that a rename takes ~5s, almost all of it loading the solution.

## Errors and warnings

- **Exit 2, not found** — check the spelling and the case, try the containing type (`Type.Member`), or use `--at` on the declaration. A symbol from a NuGet package or the framework has no source declaration, so by name it is not found; with `--at` it reports `... is defined in metadata` (exit 1). Neither can be renamed.
- **`warning: git mv failed (…)`** — the file was moved on disk but git didn't record it; stage it with `git add -A`.
- **`N project load failures` (exit 1)** — nothing was changed. Run `dotnet restore` and retry. If a project can never load here (for example a non-SDK project type), ask the user before rerunning with `--allow-load-failures`.
- **`Cannot rename Old.cs: New.cs already exists` (exit 1)** — nothing was changed. Ask the user, or rerun with `--no-file-rename`.
- **`warning: kept Old.cs, because its project file lists it explicitly`** — the code was renamed but the file wasn't. Rename the file and its `Compile` entry by hand.
- **The first build fails** (run.sh prints the `dotnet publish` log) — usually a missing requirement below. Tell the user which one; don't work around it.

## Requirements

- .NET 10 SDK (the solution itself may target an older framework).
- `git` and `bash` (on Windows, the Git Bash that Claude Code already uses).
- The solution restored (`dotnet restore`), so its projects can be loaded.
- nuget.org reachable the first time, to build the tool.

## Limits

- Namespace rename (via `--at`) rewrites `namespace`/`using` lines but doesn't move folders.
- Razor/cshtml and source-generated files are not rewritten.
