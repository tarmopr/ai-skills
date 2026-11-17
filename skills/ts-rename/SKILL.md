---
name: ts-rename
description: Renames a TypeScript/JavaScript symbol and every reference to it across all tsconfig projects of a repo in one TypeScript language-service call, and renames its file and import paths when the file is named after it. Use when renaming a TS type, interface, function, hook, component, class, method, property, constant or enum — an explicit "rename X to Y", or a rename that is one step of a larger refactor — instead of editing each file with Edit, sed, sd or ast-grep, which are slower and can't tell same-name symbols apart. Not for plain text replacements or Deno files outside every tsconfig; use rg + Edit for those.
allowed-tools: Bash(node "${CLAUDE_SKILL_DIR}/scripts/rename.mjs" *)
---

# Rename TypeScript symbols with the language service

One Bash call renames a symbol and every reference in every `tsconfig*.json` project of the repo (results are merged, so a symbol used by several projects is renamed everywhere), using the repo's own `typescript` (resolved from the `package.json` at the git root). It then lists the mentions the compiler can't resolve, so you don't need a separate grep.

## Workflow

1. **Check the contract.** If the name is on the wire or in the database (a JSON/API field, a column, a translation key, a URL or storage path), renaming it is a breaking change. Stop and ask.
2. **Rename right away. Don't grep or read first.** Name the symbol as `Container.Name` when you know where it lives (a class, an interface, or the file's base name, e.g. `dates.parseIsoDate`, `SessionCache.reset`, `apiClient.RequestOptions.timeoutMs`). On exit 3, rerun with one `--at` candidate from the list. For a rename across many files, pass `--all-leftovers` on this first call: once the rename is applied, a rerun can't find the old name.
3. **Act on the output only.** It lists the mentions the compiler can't resolve (keys in `vi.mock` factories, regex literals in tests that scan source, strings, comments, files outside every tsconfig such as Deno functions and docs), then one `--text` command that renames all listed ones. Delete the `--lines` entries that mean something else and run it; Edit by hand only when a line needs more than the word swapped. When the list doesn't fit, the `Not listed:` line names a file with all of them. A `Skipped tsconfig`, `loaded with errors`, `Not renamed (overlapping edits…)` or `git mv failed` line names what the rename did not cover: fix that by hand or ask. "Ignore" covers identifiers the language service found no reference in, and for a member, unqualified uses of the word in other files. Don't grep or read files to double-check.
4. **Verify** only if the user asked: typecheck the affected projects and run the tests of the changed files.

## Command

```bash
node "${CLAUDE_SKILL_DIR}/scripts/rename.mjs" --symbol <Container.Name> --new-name <NewName>
```

Prints `Renamed Old -> New: 6 files, 22 edits, 0 file renames, 5/6 projects, 5.7s.`, then what is left to check and the command that fixes it:

```bash
node "${CLAUDE_SKILL_DIR}/scripts/rename.mjs" --text <Old> --new-name <New> --lines <file>:<line>,<line> [--lines …]
```

| Argument | Meaning |
|---|---|
| `--new-name <New>` | Required: the new identifier |
| `--symbol <q>` | `Name` or `Container.Name` (a class, interface or function, or the file's base name; may be chained: `file.Interface.member`) |
| `--at <file>:<line>:<col>` | 1-based position, from the working directory or the repo root; for locals, parameters and the exit-3 candidates |
| `--project <tsconfig>` | Limit to these projects (repeatable); default is every `tsconfig*.json` git knows or would add (not ignored) |
| `--in-comments` / `--in-strings` | Also rename inside comments / string literals |
| `--no-file-rename` | Keep `Old.ts(x)`; by default a top-level declaration in a file named after it is `git mv`'d and every import path, `import()` and `vi.mock('…')` path is updated |
| `--dry-run` | List the files, write nothing (with `--text`: say what would change) |
| `--verbose` | List each changed file |
| `--all-leftovers` | List every remaining mention (default: up to 60, the rest go to a file) |
| `--text <Old> --lines <file>:<l>,<l>` | Replace the whole word on those lines only (no type checking); paths from the repo root |

Exit codes: `0` done, `1` error (also an unrenamable symbol, and overlapping edits that were skipped), `2` not found (also a missing `--at` file or position), `3` ambiguous (stderr lists each candidate as `--at file:line:col`). `--text` exits `1` when no listed line had the word, and names those lines on stdout otherwise.
