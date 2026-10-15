---
name: continue-handoff
description: Use when the user types /continue-handoff, or says "continue from the handoff", "pick up where we left off", "resume the handoff" in a fresh session. Reads the newest pending handoff for this repo (written by the handoff skill), checks it against reality, marks it consumed, and carries on with its next step.
argument-hint: '[handoff name or part of it; default: the newest pending one]'
allowed-tools:
  - Bash(node ${CLAUDE_SKILL_DIR}/../handoff/scripts/gather.mjs*)
  - Bash(node ${CLAUDE_SKILL_DIR}/../handoff/scripts/list.mjs*)
  - Bash(node ${CLAUDE_SKILL_DIR}/../handoff/scripts/mark.mjs*)
---

# Continue from a handoff

The `handoff` skill wrote the state to `~/.claude/handoffs/<repo-slug>/`. Pick it
up, trust reality over the file where they disagree, and get back to work.

## 1. Find it

```bash
node ${CLAUDE_SKILL_DIR}/../handoff/scripts/list.mjs
```

- An argument: the pending handoff whose name contains it.
- No argument: the newest pending one. If there are others, name them in one line.
- None pending: say so, show `list.mjs --all`, and stop. Do not guess from
  memory or old files.

## 2. Read it, then its pointers

Read the whole handoff file, then every file under **Pointers** marked "read
first", in order. Skill ledgers it names are the authority for that skill's
progress.

## 3. Check it against reality

```bash
git fetch --quiet
node ${CLAUDE_SKILL_DIR}/../handoff/scripts/gather.mjs
```

Compare with the frontmatter and **State**: branch, HEAD, PR state, the base
branch. If anything moved (new commits, a merge, someone else's push, a
different branch checked out), say so in one line and work from what git shows.
If the checkout is on another branch with uncommitted work that is not in the
handoff, someone else is working there: do not switch or touch it. Ask.

## 4. Mark it consumed

```bash
node ${CLAUDE_SKILL_DIR}/../handoff/scripts/mark.mjs <file> consumed
```

Do this before starting, so the SessionStart hook stops offering it. If the
user wants it back later: `mark.mjs <file> pending`.

## 5. Carry on

- **Waiting on the user** items: ask them now, in one batch. This is the
  cheapest moment, while the user is still at the keyboard. Continue with
  whatever does not depend on the answers.
- **`resume:`** is a skill's slash command: invoke that skill with the Skill
  tool and its argument. If the skill can only be invoked by the user, give
  them the exact command to type and stop.
- Otherwise, do **Next step**.

Open with at most three lines: which handoff, what moved since it was written,
and what you are doing now. Then do it.

## Red flags

| Thought | Reality |
|---|---|
| "The handoff says HEAD is X, so it is" | Run gather.mjs. The file is a snapshot. |
| "I'll re-plan from scratch to be safe" | The handoff exists so you don't. Start from Next step. |
| "I'll mark it consumed when I'm done" | Mark it now, or every `/clear` offers it again. |
| "No pending handoff, but I remember the work" | Say none is pending. Don't reconstruct from memory. |
