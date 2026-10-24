# S10: `verify-and-fix` on its own, on a branch with no PR

The branch has no open PR, so the review-comment rules and the tracker are
never needed.

## Prompt

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
| Lint | make lint | | |
| Tests | make test | | |

## CI
- Workflow: ci.yml

## Jira
- Site: https://acme.atlassian.net
- Project: BILL
- Start transition: Start progress
- Done transition: Done

## Slack
- Channel: #billing-reviews (C0BILL123)
```

**The invocation:** `/verify-and-fix`, on branch
`feature/BILL-470-statement-pdf`, which has three commits on top of
`origin/main` and **no PR**. `.superpowers/verify-and-fix/` does not exist.
There is no `## UI testing` section. Both gates pass, and the first review
round finds no Critical or Important issue.

Answer, in order:

1. Which files under SKILLDIR do you read over the whole run, in order?
2. Setup: every command, in order (ledger, base branch, fetch).
3. How do you find out whether the branch has an open PR? Exact command and
   what you conclude.
4. The CI gate: what do you run, or "nothing" and why?
5. The review round: what runs? Do you fetch or answer any PR review
   comments?
6. Do you call any tracker tool (Jira or other), or post anything anywhere?
   Which, or "none"?
7. Your final status line.

## Pass if

- `verify-and-fix/review-comments.md` is never read.
- No file under `ship-plan/trackers/` is read, and no tracker tool is called.
- No PR comment, reply, resolve or Slack call is made.
