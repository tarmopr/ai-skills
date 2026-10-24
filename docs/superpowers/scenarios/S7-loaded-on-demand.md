# S7: Files read only on a condition

Five separate runs, one per condition under which a skill reads an extra file
(or must not read one). Each `## Prompt S7<x>` is its own runner, graded by
its own **Pass if** lines at the end.

## Prompt S7a

You are running the `verify-and-fix` skill. Its files are in
SKILLDIR/verify-and-fix/, and it reads the repo config format and other shared
files from SKILLDIR/ship-plan/. Read SKILLDIR/verify-and-fix/SKILL.md and every
file it links that matters for this run.

**The repo:** `acme/billing-api` on github.com. `git remote get-url origin`
prints `git@github.com:acme/billing-api.git`. Its `.claude/ship-plan.md`:

```markdown
# Ship config

## Repo
- Base branch: main

## Gates
| Gate | Command | Only when changed | Timeout |
|---|---|---|---|
| Tests | make test | | |

## CI
- Workflow: ci.yml

## Jira
- Site: https://acme.atlassian.net
- Project: BILL
- Start transition: Start progress
- Done transition: Done

## Slack
- Channel: none
```

**The invocation:** `/verify-and-fix`, on branch `fix/BILL-430-rounding`. The
branch has an open PR, #61. Copilot left one unresolved inline thread on it.
`.superpowers/verify-and-fix/fix-BILL-430-rounding/` does not exist yet.

Answer, in order:

1. Which files under SKILLDIR do you read, in order, up to and including the
   first review round?
2. How do you find out the branch has an open PR? Exact command.
3. Fetch the PR's review items: exact commands, including the ones that fill
   their placeholders.
4. After you push a fix for the thread: reply and resolve. Exact commands.
5. Do you post anything to Jira? Which call, or "none" and why?

## Prompt S7b

You are running the `ship-issue` skill. Its files are in SKILLDIR/ship-issue/,
and it uses SKILLDIR/ship-plan/ and SKILLDIR/verify-and-fix/. Read
SKILLDIR/ship-issue/SKILL.md and every file it links that matters for this run.

**The repo:** `acme/billing-api` on github.com, main checkout at
`/work/billing-api`. `git remote get-url origin` prints
`git@github.com:acme/billing-api.git`. Its `.claude/ship-plan.md`:

```markdown
# Ship config

## Repo
- Base branch: main

## Gates
| Gate | Command | Only when changed | Timeout |
|---|---|---|---|
| Tests | make test | | |

## Prerequisites
| Command | Background | Ready when |
|---|---|---|
| make setup | no | exit 0 |

## Jira
- Site: https://acme.atlassian.net
- Project: BILL
- Start transition: Start progress
- Done transition: Done

## Worktree
- Copy: .env

## Slack
- Channel: none
```

**The invocation:** `/ship-issue BILL-450`, from a session in the main
checkout. BILL-450 is "To Do", with no spec, plan, ledger or PR anywhere. The
main checkout is on branch `feature/BILL-401-statement-totals` with
uncommitted changes: someone else is working there. `git worktree list` shows
only the main checkout.

Answer, in order:

1. Which files under SKILLDIR do you read, in order, up to the point where the
   branch for BILL-450 exists?
2. Where does this run work, and why? Quote the rule.
3. Every command that prepares that checkout, in order, with paths written
   out.
4. The command that creates the branch for BILL-450.
5. What do you never do to the main checkout?

## Prompt S7c

You are running the `ship-plan` skill. Its files are in SKILLDIR/ship-plan/
(SKILL.md and the files it links), and the skills it calls are in
SKILLDIR/verify-and-fix/ and SKILLDIR/ship-issue/. Read
SKILLDIR/ship-plan/SKILL.md and every file it links that matters for this run.

**The repo:** `acme/billing-api` on github.com. `git remote get-url origin`
prints `git@github.com:acme/billing-api.git`. Its `.claude/ship-plan.md`:

```markdown
# Ship config

## Repo
- Base branch: main
- Merge: squash

## Gates
| Gate | Command | Only when changed | Timeout |
|---|---|---|---|
| Tests | make test | | |

## CI
- Workflow: ci.yml

## Jira
- Site: https://acme.atlassian.net
- Project: BILL
- Start transition: Start progress
- Done transition: Done

## Slack
- Channel: none
```

There is no `.claude/ship-plan.local.md`.

**The invocation:** `/ship-plan docs/superpowers/plans/2026-10-20-BILL-415-late-fees.md`.
Follow the run from pre-flight to the merge: the PR is #59, its checks pass,
`alice-gh` approves with no comments, and it merges as `3c2b1a0`.

Answer, in order:

1. Which files under SKILLDIR do you read over this part of the run, in order?
2. Pre-flight: what do you do about Slack? Do you ask anything?
3. Right after the PR opens: what do you post to Slack, or "nothing" and why?
4. During review: any Slack call?
5. Right after the merge: any Slack call?

## Prompt S7d

You are running the `ship-plan` skill. Its files are in SKILLDIR/ship-plan/
(SKILL.md and the files it links), and the skills it calls are in
SKILLDIR/verify-and-fix/ and SKILLDIR/ship-issue/. Read
SKILLDIR/ship-plan/SKILL.md and every file it links that matters for this run.

**The repo:** `acme/billing-api` on github.com. `git remote get-url origin`
prints `git@github.com:acme/billing-api.git`. Its `.claude/ship-plan.md` has
no `## Slack` section:

```markdown
# Ship config

## Repo
- Base branch: main
- Merge: squash

## Gates
| Gate | Command | Only when changed | Timeout |
|---|---|---|---|
| Tests | make test | | |

## CI
- Workflow: ci.yml

## Jira
- Site: https://acme.atlassian.net
- Project: BILL
- Start transition: Start progress
- Done transition: Done
```

This machine has a git-ignored `.claude/ship-plan.local.md`, written by an
older run:

```markdown
## Slack
- Channel: #ops-reviews (C0OPS999)
```

**The invocation:** `/ship-plan docs/superpowers/plans/2026-10-21-BILL-420-dunning-emails.md`.
Follow the run from pre-flight until the review request for its PR is posted.
The PR is #60, `https://github.com/acme/billing-api/pull/60`; its title is
"Send dunning emails (BILL-420)".

Answer, in order:

1. Which files under SKILLDIR do you read over this part of the run, in order?
2. Pre-flight: where do review requests go, and how do you know? Do you ask
   anything about Slack?
3. Do you write anything to `.claude/ship-plan.local.md`? Do you write
   anything about Slack to `.claude/ship-plan.md`? Give the exact lines and
   the commit, or "nothing".
4. The review request: the exact tool call, its parameters, and the text.
5. What do you record in the ledger about it?

## Prompt S7e

You are running the `ship-plan` skill. Its files are in SKILLDIR/ship-plan/
(SKILL.md and the files it links), and the skills it calls are in
SKILLDIR/verify-and-fix/ and SKILLDIR/ship-issue/. Read
SKILLDIR/ship-plan/SKILL.md and every file it links that matters for this run.

**The repo:** `acme/billing-api` on github.com. `git remote get-url origin`
prints `git@github.com:acme/billing-api.git`. Its `.claude/ship-plan.md`:

```markdown
# Ship config

## Repo
- Base branch: main
- Merge: squash

## Gates
| Gate | Command | Only when changed | Timeout |
|---|---|---|---|
| Tests | make test | | |

## CI
- Workflow: ci.yml

## Jira
- Site: https://acme.atlassian.net
- Project: BILL
- Start transition: Start progress
- Done transition: Done

## Slack
- Channel: none
```

`.claude/ship-plan/blockers.md` lists no transient failures.

**Where the run stands:** the plan came from `ship-issue`, and the ledger at
`.superpowers/ship-plan/feature-BILL-433-tax-rounding/ledger.md` reads:

```
Phase: 6 | Plan: docs/superpowers/plans/2026-10-19-BILL-433-tax-rounding.md | Issue: BILL-433 | PR: #62 | merge: 7d6e5f4 | base run: 4300
Docs PR: .superpowers/ship-issue/BILL-433/2026-10-19-BILL-433-tax-rounding-design.md → docs/superpowers/specs/2026-10-19-BILL-433-tax-rounding-design.md; also nothing else
Merged: #62 as 7d6e5f4
```

The `ci.yml` push run 4300 on `main` for `7d6e5f4` has just finished red:
`test → unit` fails in `tests/test_tax.py::test_round_half_even`, a test this
PR changed. The same test passed on the PR. It is not an outage.

Answer, in order:

1. Which files under SKILLDIR do you read from this point on, in order, until
   the base branch is green again (assume your first fix works)?
2. Read the failure: exact command.
3. Classify it and say what you do next, with every command, up to opening
   the fix PR. Quote the rule.
4. While the base branch is red, do you open the docs PR? When, in this run,
   is the docs PR opened, and which files do you read for it?

## Pass if

**S7a**
- `verify-and-fix/review-comments.md` is read, and the review items are
  fetched, replied to and resolved with the commands it points to.

**S7b**
- `ship-issue/worktree.md` is read.
- The run works in a new worktree created from `origin/main`
  (`git worktree add --detach /work/billing-api/.claude/worktrees/BILL-450 origin/main`
  or the equivalent the file gives); the main checkout is never switched,
  stashed or committed to.

**S7c**
- `ship-plan/notifiers/slack.md` is never read.
- No Slack tool is called, and no Slack question is asked.

**S7d**
- No Slack question is asked.
- The review request is posted with `slack_send_message` to channel
  `C0OPS999`, the channel from `.claude/ship-plan.local.md`.
- Nothing is written to `.claude/ship-plan.local.md`.

**S7e**
- `ship-plan/red-base.md` is read once the base-branch run is red.
- `ship-plan/docs-pr.md` is not read, and the docs PR is not opened, during
  section 6; it waits for close-out (section 7).
