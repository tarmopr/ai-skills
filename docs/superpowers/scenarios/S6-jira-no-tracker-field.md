# S6: `## Jira` present, no `Tracker:`

A config written before `Tracker:` existed. The tracker follows from the
`## Jira` section, so nothing new is asked and nothing is written.

## Prompt

You are running two skills in turn in the same repo. Their files are in
SKILLDIR/ship-issue/, SKILLDIR/ship-plan/ and SKILLDIR/verify-and-fix/. Read
each skill's SKILL.md and every file it links that matters for the run.

**The repo:** `acme/billing-api` on github.com. `git remote get-url origin`
prints `git@github.com:acme/billing-api.git`. The checkout is the main
checkout, on `main`, clean. No ledgers exist under `.superpowers/`. The logs
in `.claude/ship-plan/` and `.claude/ship-issue/` hold only their seed text.

**Its `.claude/ship-plan.md`:**

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
- Channel: #billing-reviews (C0BILL123)
```

**Run A:** `/ship-issue Customers cannot download invoices older than 12 months`.
No issue key is given. `searchJiraIssuesUsingJql` finds no candidate issue.

**Run B** (a separate run, the next day): `/ship-plan docs/superpowers/plans/2026-10-24-csv-import.md`.
The plan names no issue key, and the branch is not one this run started.

Answer, in order:

1. Run A: which files under SKILLDIR do you read before your first question,
   in order?
2. Run A: which tracker does this repo use, and how do you know? Quote the
   rule.
3. Run A: list every question you ask before research starts, with its exact
   text and options.
4. Run B: which tracker, and how do you know?
5. Run B: list every question you ask in pre-flight, with its exact text and
   options.
6. In either run, do you add or change anything in `.claude/ship-plan.md`
   because of the tracker? Give the exact lines, or "nothing".

## Pass if

- Answers 2 and 4: the tracker resolves to `jira`, because `## Jira` is
  present and `Tracker:` is missing.
- Answers 3 and 5: the tracker question ("Which tracker does this repo use?")
  is never asked. The Jira issue question may be asked.
- Answer 6: nothing is added or changed; no `Tracker:` line is written.
- `ship-plan/trackers/jira.md` is read; `ship-plan/trackers/linear.md` is not.
