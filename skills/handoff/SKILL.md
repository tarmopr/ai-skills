---
name: handoff
description: Use when the session should end so work can continue in a fresh context — the context is large, a logical step or phase is complete, a usage limit is near, or the user says "hand off", "write a handoff", "save state before I clear", "wrap up the session". Writes the state to a handoff file and tells the user to /clear and type /continue-handoff.
argument-hint: '[short name for the handoff, e.g. for-286-pr3]'
allowed-tools:
  - Bash(node ${CLAUDE_SKILL_DIR}/scripts/gather.mjs*)
  - Bash(node ${CLAUDE_SKILL_DIR}/scripts/check.mjs*)
  - Bash(node ${CLAUDE_SKILL_DIR}/scripts/list.mjs*)
  - Bash(node ${CLAUDE_SKILL_DIR}/scripts/mark.mjs*)
---

# Handoff

Write down everything the next session needs, so the user can `/clear` and
continue with `/continue-handoff` without re-explaining anything. A good handoff
lets a fresh session take its first real action within two tool calls.

Handoffs live outside the repo, in `~/.claude/handoffs/<repo-slug>/`, one file
each, so they are never committed and every worktree of a repo shares them. A
SessionStart hook (`scripts/session-start.mjs`) mentions a pending one after a
fresh start or `/clear`.

## When

- The user asks for one.
- The context is large and the work has reached a natural boundary: a phase or
  task is complete, a PR merged, a plan written. Offer it in one line, or write
  it unprompted when a skill tells you to (for example a run that must stop
  early, or a close-out that names the next part).
- A usage limit, a blocking question batch, or anything else ends the session
  before the work does.

Not a replacement for a skill's own ledger. If a run keeps a ledger
(ship-plan, verify-and-fix, subagent-driven-development), update the ledger
first, then point to it from the handoff instead of copying it.

## 1. Gather the facts

```bash
node ${CLAUDE_SKILL_DIR}/scripts/gather.mjs [name]
```

It prints the repo root, branch, HEAD, upstream ahead/behind, uncommitted
paths, worktrees, the branch's PR and recent runs, recently changed
ledgers and logs, pending handoffs, and the file path to write. Use these
facts; do not re-derive them by hand.

## 2. Settle what is in flight

- **Background tasks and subagents:** wait for the ones about to finish; for
  the rest, record what each was doing and whether it was stopped. Stop dev
  servers you started, unless the next step needs them; say which.
- **Uncommitted work:** record the paths and what state they are in. Commit only
  when the current task already authorizes commits; never stash, discard or
  push just to make the handoff tidy.
- **Ledgers:** bring the run's own ledgers up to date first.

## 3. Write the file

Use the template below at the suggested path. Rules:

- **Only what the next session cannot get from git, the tracker or a ledger** —
  but every fact it needs to start, even if that means a one-line pointer.
- **Verifiable:** SHAs, run ids, PR and issue numbers, file paths in backticks.
  The check script confirms every backticked path and commit exists.
- **Absolute dates**, never "today" or "yesterday".
- **User decisions quoted verbatim**, with the date. Your own rulings with why
  and what they cost if wrong.
- **No secrets**, no long logs (point to the log file), no pasted diffs.
- `resume:` in the frontmatter is the exact first action: a slash command with
  its argument (`/ship-plan docs/…/plan.md`), or `Do "Next step"`.

## 4. Supersede, check, point

1. If an older pending handoff covers the same work, mark it consumed:
   `node ${CLAUDE_SKILL_DIR}/scripts/mark.mjs <old file> consumed`. Leave
   unrelated ones alone.
2. `node ${CLAUDE_SKILL_DIR}/scripts/check.mjs <file>`. Fix every problem
   it lists and run it again until it prints `ok`. A path that does not exist
   yet on purpose (a file the next step creates) goes outside backticks.
3. If your memory has an entry for this work, update its pointer to the new
   handoff file.

## 5. Tell the user

End with this block, filled in, and stop working:

````
Handoff saved: <path>

To continue in a fresh context:
1. /clear
2. /continue-handoff
````

Add `Waiting on you:` with the items from that section, if any. Nothing else:
the summary is in the file.

## Template

````markdown
---
title: <what this work is, one line>
created: <ISO timestamp from gather.mjs "now">
repo: <repo root>
branch: <branch>
head: <full HEAD sha>
status: pending
consumed_at:
resume: <exact first action>
---

# <title>

## Resume
The exact command(s) the next session runs first, and which skill and ledger
carry the work from there.

## Goal
What done means for the whole piece of work, in 2–4 lines, and where the
authority lives (spec, issue, plan).

## State
As of <date, time>: branch, HEAD, pushed or not; PR and CI; what is deployed
where; the local environment (servers, database); tracker status.

## Done
What this session finished: commits, merged PRs, issues closed.

## Next step
The single next action, concrete enough to start without the old conversation.
Then the remaining steps, in order.

## Decisions
User answers (quoted, dated) and rulings (why, cost if wrong) that are not
recorded anywhere else.

## Watch out
Traps hit in this session and their fixes. Known failures that are not
regressions. Things that look wrong but are intended.

## Waiting on the user
Questions or actions only the user can do, or "Nothing".

## Pointers
Read first, in order: ledgers, spec, plan, memory entries, issue ids.
````

## Red flags

| Thought | Reality |
|---|---|
| "The compaction summary covers it" | A summary is lossy and is gone after `/clear`. The file is not. |
| "I'll paste the ledger into the handoff" | Point to it. Two copies drift. |
| "The next session can look that up" | Then say where. A pointer costs a line; a search costs ten calls. |
| "I'll stash the dirty files so it's clean" | Never. Record them. |
| "Check failed on a path I meant to create" | Take it out of backticks, or create it. Don't skip the check. |
| "I'll keep going after writing it" | The point is a fresh context. Stop, unless the user says otherwise. |
