---
name: retro
description: Use when the user asks what the current session taught or what should change after it — "any learnings?", "what should we improve", "retro", "lessons for the tools" — in skills, CLAUDE.md or AGENTS.md, hooks, settings, run logs or memory.
---

# Retro

A learning counts only when it lands where the next session reads it, at the moment it would have helped. Find each one in this session's evidence, route it to that place, check the place does not already say it, and propose the exact change. Change nothing until the user picks.

## 1. Gather evidence from this session

- **The conversation:** user corrections, a question the user had to ask twice, refused or failed tool calls, work done twice, reruns, anything you reported as your own mistake.
- **Ledgers this session wrote:** the `Lesson:`, `Ruling:` and `Asked:` lines in `.superpowers/**/ledger.md`.
- **Commits:** the `git log` of each branch this session made, in every repo it touched.

Each candidate carries one quoted piece of evidence: a message, an error line, a ledger line or a command's output. A candidate without evidence is dropped.

## 2. Route each candidate to one destination

| The learning is | Destination | Changed through |
|---|---|---|
| a rule for every session and repo | `~/.claude/CLAUDE.md` or a file it imports | a direct edit |
| a convention of this repo | the repo's `AGENTS.md` or `CLAUDE.md` | the repo's rule for docs changes |
| a blocker or a standing answer for a run skill | that skill's log in the repo (e.g. `.claude/ship-plan/blockers.md`) | that skill's lessons PR |
| a missing or wrong step in a skill | the skill's source (`readlink -f ~/.claude/skills/<name>`) | that repo's workflow: its README or a memory |
| a check that can run the same way every time | a hook or a permission in settings | the `update-config` skill |
| a fact about the user, the project or an outside system | memory | the memory rules: update a file before adding one |
| a defect in product code | a ticket | none: list it under "Not a tool change" |

Choose the place the agent read at the moment it went wrong. When a written rule existed and was skipped, strengthen it in place: move it into the step where it is needed, or make it a required field in a template. Do not copy it somewhere else.

## 3. Check the destination

Grep the destination for each candidate.

- Already there and followed this session: drop it.
- Already there but not followed: the change is to where or how it is stated. Mark it `strengthen`.
- Already fixed earlier in this session: move it to "Done this session".

Also check the stale entries the session exposed: a memory naming a version, a path or a link that has since changed.

## 4. Report in this shape

1. **Open from this session:** unpushed commits, open PRs and unanswered questions. One line each, with the command that closes it.
2. **Done this session:** learnings already applied, each with its commit or PR.
3. **Proposed changes:** a numbered table with the columns `#`, `What happened (evidence)`, `Destination (path)`, `Change (exact text)` and `new / strengthen`.
4. **Not a tool change:** tickets and one-offs, each with the reason.

Then ask one `AskUserQuestion`, `multiSelect`, with the proposals as options and the most valuable first. Group them by destination when there are more than four. A learning with two alternative fixes gets its own single-select question.

## 5. Apply what the user picks

Apply each destination through its "Changed through" column, one commit per destination. Push only what that workflow lets you push. Otherwise give the user the push command. Finish with the list of commits and PRs.

## Common mistakes

| Mistake | Instead |
|---|---|
| Listing what went well | List changes only |
| A change described, not written | Put the exact sentence or diff in the table, so a yes can be applied as is |
| A skill rule copied into CLAUDE.md | Change the skill step that was being followed at that moment |
| Proposing what the destination already says | Grep first; mark it `strengthen` and change how it is stated |
| Editing before the user picks | Report, ask, then apply |
