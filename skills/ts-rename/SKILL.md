---
name: ts-rename
description: Renames a TypeScript/JavaScript symbol and every reference to it across all tsconfig projects of a repo in one TypeScript language-service call, and renames its file and import paths when the file is named after it. Use when renaming a TS type, interface, function, hook, component, class, method, property, constant or enum — an explicit "rename X to Y", or a rename that is one step of a larger refactor — instead of editing each file with Edit, sed, sd or ast-grep, which are slower and can't tell same-name symbols apart. Not for plain text replacements or Deno files outside every tsconfig; use rg + Edit for those.
allowed-tools: Bash(node "${CLAUDE_SKILL_DIR}/scripts/rename.mjs" *)
---

# Rename TypeScript symbols with the language service

One Bash call renames a symbol and every reference in every `tsconfig*.json` project of the repo (results are merged, so a symbol used by several projects is renamed everywhere), using the repo's own `typescript` (resolved from the `package.json` at the git root). It then lists the mentions the compiler can't resolve, so you don't need a separate grep.

## Workflow

1. **Check the contract.** If the name is on the wire or in the database (a JSON/API field, a column, a translation key, a URL or storage path), renaming it is a breaking change. Stop and ask.
2. **Rename right away. Don't grep or read first.** Name the symbol as `Container.Name` when you know where it lives (a class, an interface, or the file's base name, e.g. `dates.parseIsoDate`, `SessionCache.reset`, `apiClient.RequestOptions.timeoutMs`). On exit 3, rerun with one `--at` candidate from the list. If it prints `Nothing changed: renaming Old -> New would add type errors:` (exit 1), nothing was written: the lines below it are the errors. `Nothing changed: the check of the result failed` also wrote nothing. Pick another name or ask; pass `--allow-errors` only when the user wants it anyway. For a rename across many files, pass `--all-leftovers` on this first call: once the rename is applied, a rerun can't find the old name.
3. **Act on the output only.** Under `Not renamed: mentions of Old the compiler can't resolve` it lists keys in `vi.mock` factories, regex literals in tests that scan source, module paths that resolve to no file, uses of the name imported from a module the compiler can't resolve, for a member the same-name identifiers left in changed files (object literals without a type), strings, JSX text, comments, and files outside every tsconfig such as Deno functions and docs. Then comes one `--text` command that renames all listed ones (when the old name is a plain identifier). Delete the `--lines` entries that mean something else and run it; Edit by hand only when a line needs more than the word swapped. When the list doesn't fit, the `Not listed:` line names a file with all of them. A `Skipped tsconfig`, `loaded with errors`, `Only … used: git ls-files failed`, `Not renamed (overlapping edits…)`, `Not renamed: N references outside <root>`, `git mv failed`, `Listing what is left failed` or (with `--allow-errors`) `The check of the result failed` line names what the rename did not cover: fix that by hand or ask. `Not renamed (overlapping edits…)`, `Not renamed: N references outside` and `Listing what is left failed` exit 1 although the rename was written; don't rerun it. The `Ignore:` line counts what was checked and is not this symbol (same-name identifiers, and for a member, unqualified uses of the word in other files): leave those. Don't grep or read files to double-check.
4. **Verify** only if the user asked: typecheck the affected projects and run the tests of the changed files.

## Command

```bash
node "${CLAUDE_SKILL_DIR}/scripts/rename.mjs" --symbol <Container.Name> --new-name <NewName>
```

Before writing, it type-checks each changed file in memory (in the first tsconfig project that holds it) and writes nothing if the rename adds an error there: a line with more errors than before, such as a clash with an existing member or a key it left behind in a changed file. It doesn't check files it didn't change, nor a rename that compiles but means something else; the repo's typecheck and tests cover those. The check adds 0–3s of script time, and about 17s for a rename across ~150 files. Then it prints `Renamed Old -> New: 6 files, 22 edits, 0 file renames, 5/6 projects, 5.7s.`, what is left to check, and the command that fixes it:

```bash
node "${CLAUDE_SKILL_DIR}/scripts/rename.mjs" --text <Old> --new-name <New> --lines <file>:<line>,<line> [--lines …]
```

| Argument | Meaning |
|---|---|
| `--new-name <New>` | Required: the new identifier |
| `--symbol <q>` | `Name` or `Container.Name` (a class, interface or function, or the file's base name; may be chained: `file.Interface.member`) |
| `--at <file>:<line>:<col>` | 1-based position, from the working directory or the repo root; for locals, parameters and the exit-3 candidates. On a name imported without `as`, or a use of it, it renames the exported symbol; on an `as` alias or a default import's local name, only that local |
| `--project <tsconfig>` | Limit to these projects (repeatable); default is every `tsconfig*.json` git knows or would add (not ignored) |
| `--in-comments` / `--in-strings` | Also rename inside comments / string literals |
| `--no-file-rename` | Keep `Old.ts(x)`; by default a top-level declaration in a file named after it is `git mv`'d and every import path, `import()` and `vi.mock('…')` path is updated |
| `--dry-run` | Check and list the files that would change, write nothing, no leftover list (with `--text`: the counts and the lines without the word) |
| `--allow-errors` | Write even when the check finds type errors the rename adds, or fails to run (either is listed) |
| `--verbose` | List each changed file |
| `--all-leftovers` | List every remaining mention (default: up to 60, the rest go to a file) |
| `--text <Old> --lines <file>:<l>,<l>` | Replace the whole word on those lines only (no type checking); paths from the repo root, or absolute (the printed command uses absolute paths when the renamed repo is not the working directory's) |

Exit codes: `0` done, `1` error (also: nothing written because the rename would add type errors in the changed files, or the check failed; `Stopped partway`: some files were written, listed with how to undo them; a `--text` file outside the repo; an unrenamable symbol; and, after writing, skipped overlapping edits, references outside the repo, a failed leftover scan), `2` not found (also a missing `--at` file or position), `3` ambiguous (stderr lists up to 10 candidates as `--at file:line:col`; with more, narrow with `--symbol Container.Name`). What the check refuses or fails to run, a refused file rename, an unreadable source file or `--text` file, and `Stopped partway: …` print on stdout; usage and setup errors, not found, ambiguous (exit 3) and an unrenamable symbol on stderr. `--text` exits `1` when no listed line had the word; either way it names the lines without it on stdout.
