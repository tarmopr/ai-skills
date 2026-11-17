# ts-rename SKILL.md: rationale

Reasons behind skills/ts-rename. Read when changing a rule or the script's output, not when running the skill.

## Why a script, and why this output

Measured with headless `claude -p` runs on a TypeScript monorepo with six tsconfig projects. Cost is all tokens (input, cache read, cache write, output). A fresh session costs about 50k before it does anything, and every extra model call costs about another 50k, so cost follows the number of model calls.

| Approach | Small rename (2–3 files) | Large rename (143 files, 423 edits) |
|---|---|---|
| Edit tool only, one edit at a time | 330–420k tokens, 10–14 model calls | 23.6M tokens, 26 min, 324 model calls |
| No guidance (agent's own grep + Edit, or a script it writes) | 300–390k | about 730k, 65s |
| This skill | 150–210k, 3–5 model calls | about 250k, 36s |

Every approach was correct by typecheck and tests. But one leftover only the leftover list catches was missed by every approach until the script listed it. It was a regex literal in a test that scans source, `/\bformatError\(/`. Its test asserts a non-match, so it passes either way.

- **Leftovers listed in full, up to 60.** A list cut at 12 made agents rerun the script, or grep, to see the rest. That was one more model call, about 50k tokens, against about 2k for printing everything.
- **One `--text` command printed after the list.** Fixing leftovers with Read and Edit took 2–4 calls; the printed command takes one.
- **Member mentions must be qualified.** For a member named with a common word (`current`, `reset`), hundreds of bare mentions in files the rename didn't touch were listed, and agents grepped to dismiss them. Outside the changed files, a mention is listed only when it reads `receiver.name` with a receiver the rename saw, or names the container.
- **A regex escape before the name counts as a word boundary.** `\b` puts a word character in front of the name, so a plain whole-word match skipped `/\bname\(/`.
- **Tool's own files skipped** when scanning for leftovers.

## Why a skill and not a line in CLAUDE.md

With no hint in the task prompt, both were found every time (12/12). The skill averaged 223k tokens and 3.2 tool calls; a one-line pointer in CLAUDE.md averaged 290k and 4.7. Without the workflow rules ("act on the output only, don't grep to double-check"), agents ran `--help`, `git diff` and grep to verify. That cost about one more model call per rename, more than the `Skill` call itself.

When the prompt names the tool, the two tie (median 207k for the skill, 204k for the pointer). That's because the `Skill` call is one model call of its own.

## Rejected

- **`getEditsForFileRename`** from the language service, for import paths after a file rename: it took over 5 minutes on a large program. The script resolves each module specifier whose last segment is the old name with `ts.resolveModuleName` instead.
- **The LSP tool (findReferences + Edit):** 448k tokens and about 16 model calls per rename.
- **ast-grep or sed alone:** cheap on unique names, but they can't tell same-name symbols apart.
