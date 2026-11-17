# ts-rename SKILL.md: rationale

Reasons behind skills/ts-rename. Read when changing a rule or the script's output, not when running the skill.

## Why a script, and why this output

Measured with headless `claude -p` runs on a TypeScript monorepo with six tsconfig projects. Cost is all tokens (input, cache read, cache write, output). A fresh session costs about 50k before it does anything, and every extra model call costs roughly 30–70k more (the whole context is read again, and it grows), so cost follows the number of model calls.

| Approach | Small rename (2–3 files) | Large rename (143 files, 423 edits) |
|---|---|---|
| Edit tool only, one edit at a time | 330–420k tokens, 10–14 model calls | 23.6M tokens, 26 min, 324 model calls |
| No guidance (agent's own grep + Edit, or a script it writes) | 300–390k | about 730k, 65s |
| This skill | 150–210k, 3–5 model calls | about 250k, 36s (before the type check below, which adds ~17s) |

Every approach was correct by typecheck and tests. But one leftover was missed by every approach that did not use the script's leftover list, and by the script too until it learned to list it: a regex literal in a test that scans source, of the form `/\bparseIsoDate\(/`. Its test asserts a non-match, so it passes either way.

- **Leftovers listed in full, up to 60.** A list cut at 12 made agents rerun the script, or grep, to see the rest. That was one more model call, about 50k tokens, against about 2k for printing everything. Beyond 60 the rest go to a file, because once the rename is applied a rerun can't find the old name.
- **One `--text` command printed after the list.** Fixing leftovers with Read and Edit took 2–4 calls; the printed command takes one.
- **Member mentions must be qualified.** For a member named with a common word (`current`, `reset`), hundreds of bare mentions in files the rename didn't touch were listed, and agents grepped to dismiss them. Outside the changed files, a mention is listed only when it reads `receiver.name` with a receiver the rename saw or the container as receiver, or when the line names the container itself (a capitalised name, or one longer than 6 characters).
- **A regex escape before the name counts as a word boundary.** `\b` puts a word character in front of the name, so a plain whole-word match skipped `/\bname\(/`.
- **Tool's own files skipped** when scanning for leftovers.
- **Re-exports renamed through.** With prefix/suffix text on, TypeScript stops at `export { old }` and writes `export { new as old }`, so importers of a barrel keep the old name. With it off, shorthand properties and destructuring lose their key, and a destructured local leaks the rename into the interface. So the script keeps it on, writes the plain new name at an import or export specifier, and continues the rename from that specifier.
- **The changed files are type-checked before anything is written.** TypeScript's rename doesn't check that the result compiles, and the agent is told to trust the output, so review found renames that exited 0 with broken code: a member renamed onto an existing one, a key of an untyped object literal left behind, an import renamed without its export. The script type-checks the changed files in memory (the language service reads the new texts from an overlay) and writes nothing if a line has an error of a code it didn't have before. Errors are matched by code and line number, not by message or line text: a rename never adds or removes a line, while it does rewrite the text and the message of an error that was already there (a shorthand `{ limit }` becomes `{ maxRows: limit }`). A "did you mean" error counts as its plain code (2551 as 2339, 2552 as 2304, …), since the rename can make or drop the suggestion. Counting per code alone, tried first, let a rename that fixed one error hide a new one of the same code in the same file.
- **A complete check was tried and dropped.** Two review rounds widened it to the files where a break shows without a change (an untyped object passed to the renamed type, a subclass, a clashing `export *`, a merged declaration) and added a check that every identifier spelled with the new name still meant the same thing, plus a base/subclass check. Each round found new cases it missed (merged declarations, shape-only matches, aliases through `export *`) and new valid renames it refused (`toString`, static against instance members, errors whose message changed). The checks that refuse a valid rename only by mistake in the matching were kept; the rest is left to the repo's typecheck and tests. The rejected alternative, telling the agent to run a full typecheck after each rename, costs a model call and a build every time.
- **What the check costs.** On the benchmark repo it adds 0–3s of script time to a rename of a few files, and 17s to the 143-file rename (script time 5s to 22s; the table above is session time).
- **What wasn't covered is printed on stdout**, never only on stderr: a tsconfig that failed to load or matched no files, one loaded with errors, skipped overlapping edits, references outside the repo, a failed `git mv`, a failed leftover scan, a write that stopped partway, and every `Nothing changed` refusal. Skipped overlapping edits, references outside the repo and a failed leftover scan exit 1 after writing; a failed `git mv` exits 0. The agent acts on stdout and is told not to double-check, so a silent gap becomes a wrong rename.

## Why a skill and not a line in CLAUDE.md

A separate set of 12 runs (a method rename, the large rename and a common-word member rename, 2 runs each per variant) gave no hint in the task prompt. Both variants found the tool every time. The skill averaged 223k tokens and 3.2 tool calls; a one-line pointer in CLAUDE.md averaged 290k and 4.7. Without the workflow rules ("act on the output only, don't grep to double-check"), agents ran `--help`, `git diff` and grep to verify. That cost about one more model call per rename, more than the `Skill` call itself.

When the prompt names the tool, the two tie (10 runs each: an average of 204k for the skill and 211k for the pointer; medians 207k and 178k). That's because the `Skill` call is one model call of its own.

## Rejected

- **`getEditsForFileRename`** from the language service, for import paths after a file rename: it took over 5 minutes on a large program. The script resolves each module specifier whose last segment is the old name with `ts.resolveModuleName` instead.
- **The LSP tool (findReferences + Edit):** 448k tokens and about 16 model calls per rename, on the first benchmark's small renames.
- **ast-grep or sed alone:** cheap on unique names, but they can't tell same-name symbols apart.
