---
name: csharp-rename
description: Renames a C# symbol and every reference to it across a .NET solution in one Roslyn call. Use when renaming a C# type, method, property, field, parameter, namespace or other symbol — an explicit "rename X to Y" or "change the name of this class", or a rename that is one step of a larger refactor — instead of editing each file with Edit, sed, sd or ast-grep, which are slower and can't tell same-name symbols (overloads, generic arities, common method names) apart. Not for non-C# files or plain text replacements; use rg + sd for those.
allowed-tools: Bash(bash "${CLAUDE_SKILL_DIR}/run.sh" *)
---

# Rename C# symbols with Roslyn

One Bash call renames a symbol and every reference to it across the whole solution, using the compiler's own rename (types, generics, overloads, partial classes). It replaces many Edit calls with one, and it doesn't touch unrelated symbols that share the name.

## Workflow

1. **Check the contract.** If the symbol is serialized (a JSON/API DTO property, a message contract, a workflow or job input variable, an EF entity column), renaming it changes the wire or database name — a breaking change. Stop and ask before renaming one.
2. **Rename** with the command below. On exit 3, pick the intended candidate from the list and rerun. Use `--dry-run` only when the user wants to see the scope before anything is written.
3. **Find string usages** the compiler can't see: `rg -nw <OldName>` across the repo, including non-C# files (workflow definitions, appsettings, YAML, JSON, Markdown). Fix these with Edit only where the string really refers to the symbol.
4. **Report** the summary line; show `git diff --stat` only if asked. **Build** (`dotnet build`) only if the user asked: the tool already compiled the files the rename touched. If the build fails, treat every error as possibly caused by the rename, including errors in files it didn't change: a consumer in a project that failed to load, or a file a project names in a `<Compile Include>`. Call an error pre-existing only after building without the rename (`git stash`, build, `git stash pop`) shows the same error.

## Command

Run from the repo root (it finds the single `.sln`/`.slnx` upwards, or pass `--solution <path>`):

```bash
bash "${CLAUDE_SKILL_DIR}/run.sh" --symbol <Name> --new-name <NewName>
```

Before writing, the tool compiles in memory the renamed files and every file naming the old or the new name (for a member, only files that also name its type). If a line has more errors of some id than before the rename (a new name that clashes with a member or a type, a reference it couldn't rebind), it writes nothing and lists them (exit 1). A rename that compiles but binds differently (a member that now hides or overrides another, which is only a warning) or merges two partial types is not caught. Success prints one summary line, `Renamed <display name> -> <NewName>: 25 files, 0 file renames, 5s.`, where the display name is the compiler's (`Ns.OrderService.Cancel()`), followed by any `warning:` lines (below).

| Argument | Meaning |
|---|---|
| `--symbol <q>` | Simple name (`OrderSummary`), dotted suffix (`OrderService.Cancel`), or the exact display string from an ambiguity list (`Ns.Handler<TIn, TOut>`, `Ns.Handler.Run(int)`) |
| `--solution <path>` | The `.sln`/`.slnx` to load; by default the one in the nearest directory upwards that has any (pass this when that directory has several) |
| `--at <file>:<line>:<col>` | 1-based position instead of `--symbol` (same positions as the LSP tool); use for locals, parameters, namespaces |
| `--overloads` | Rename every overload of a method; with `--symbol`, a name that matches only overloads of one method is then not ambiguous |
| `--in-comments` / `--in-strings` | Also rename the name inside comments / string literals (off by default) |
| `--no-file-rename` | Keep `Old.cs` file name (by default a type declared in `Old.cs` is `git mv`'d to `New.cs`) |
| `--allow-load-failures` | Rename even though some projects failed to load; references in those projects stay unrenamed |
| `--allow-errors` | Write even when the check finds compile errors the rename adds (they are listed) |
| `--dry-run` | Run the check and list the files it would change, write nothing (exit 1 with the errors if the check fails) |
| `--verbose` | Also list each changed file (implied by `--dry-run`) |

Exit codes: `0` done, `1` error (also every refusal under Errors below: nothing written because the rename would add compile errors; project load failures; `Failed:`; a malformed `--at` or a line or column out of range), `2` not found (also an `--at` file outside the solution, or no symbol at that position), `3` ambiguous — stderr lists each candidate with its exact display string and `file:line:col`; rerun with one of them.

The first run builds the tool into `${XDG_CACHE_HOME:-~/.cache}/csharp-rename/` (~30s, once per version of `rename.cs`). After that a rename takes ~5s on a mid-sized solution, most of it loading the solution; the in-memory compile check adds about 1s on small ones.

## Errors and warnings

- **Exit 2, not found** — check the spelling and the case, try the containing type (`Type.Member`), or use `--at` on the declaration. A symbol from a NuGet package or the framework has no source declaration, so by name it is not found; with `--at` it reports `... is defined in metadata` (exit 1). Neither can be renamed.
- **`Nothing changed: renaming Old -> New would break the build:`** (exit 1), then `file:line: CSxxxx message` lines — pick another name, or fix the conflict first. Use `--allow-errors` only when the user wants the rename anyway.
- **`Nothing changed: the target frameworks disagree on the edit at file:line`** (exit 1) — a multi-targeted project where the frameworks' `#if` branches rename the same spot differently; rename that file by hand.
- **`warning: git mv failed (…)`** — the file was moved on disk but git didn't record it; stage it with `git add -A`. (Outside a git repo, or for an untracked file, the file is moved quietly.)
- **`N project load failures` (exit 1)** — nothing was changed. Run `dotnet restore` and retry. If a project can never load here (for example a non-SDK project type), ask the user before rerunning with `--allow-load-failures`.
- **`Cannot rename Old.cs: New.cs already exists` (exit 1)** — nothing was changed. Ask the user, or rerun with `--no-file-rename`.
- **`warning: kept Old.cs, because a <Compile Include> in its project file names it`** — the code was renamed but the file wasn't. Rename the file and its `Compile` entry by hand.
- **`warning: N project load failures; references in those projects were NOT renamed`** (only with `--allow-load-failures`), followed by each load message — tell the user which projects; their references to the old name stay.
- **`Stopped partway: …` (exit 1)** — a write failed. `Nothing was changed.`, or `Already written (N): …` with the edited files and `Old.cs -> New.cs` moves: undo the edits with `git checkout`, move the moved files back, or finish by hand.
- **`Failed: <TypeName>: <message>`** (exit 1) — an unexpected failure, usually the solution not opening or MSBuild failing before anything is written. Tell the user, and check `git status` for a partial write.
- **The first build fails** (run.sh prints the `dotnet publish` log) — usually a missing requirement below. Tell the user which one; don't work around it.

## Requirements

- .NET 10 SDK (the solution itself may target an older framework).
- `git` and `bash` (on Windows, the Git Bash that Claude Code already uses).
- The solution restored (`dotnet restore`), so its projects can be loaded.
- nuget.org reachable the first time, to build the tool.

## Limits

- Namespace rename (via `--at`) rewrites `namespace`/`using` lines but doesn't move folders.
- Razor/cshtml and source-generated files are not rewritten.
