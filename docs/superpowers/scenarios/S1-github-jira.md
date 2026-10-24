# S1: GitHub with Jira, no `Host:` or `Tracker:` (regression)

A repo that uses `ship-plan` today, with a config written before `Host:` and
`Tracker:` existed. One full `ship-plan` run, pre-flight to close-out. Its
answers are compared with the answers the skills gave before the change
(`baseline/S1-github-jira.md`), command for command.

## Prompt

You are running the `ship-plan` skill. Its files are in SKILLDIR/ship-plan/
(SKILL.md and the files it links), and the skills it calls are in
SKILLDIR/verify-and-fix/ and SKILLDIR/ship-issue/. Read SKILLDIR/ship-plan/SKILL.md
and every file it links that matters for this run.

**The repo:** `acme/billing-api` on github.com. `git remote get-url origin`
prints `git@github.com:acme/billing-api.git`. `.github/workflows/ci.yml` runs
on `pull_request` to `main` and on `push` to `main`, with no path filters.
The checkout is the main checkout, on `main`, clean. `.superpowers/ship-plan/`
holds no ledger. `.claude/ship-plan/interruptions.md` and
`.claude/ship-plan/blockers.md` exist and hold only their seed text, no
entries. There is no `.claude/ship-plan.local.md`.

**Its `.claude/ship-plan.md`:**

```markdown
# Ship config

## Repo
- Base branch: main
- Merge: squash

## Gates
| Gate | Command | Only when changed | Timeout |
|---|---|---|---|
| Lint | make lint | | |
| Tests | make test | | 15 |

## CI
- Workflow: ci.yml

## Jira
- Site: https://acme.atlassian.net
- Project: BILL
- Issue type: Task
- Start transition: Start progress
- Review transition: Start review
- Done transition: Done
- Notes: GitHub for Jira links PRs by key; no automation closes issues.

## Slack
- Channel: #billing-reviews (C0BILL123)
```

**The invocation:**
`/ship-plan docs/superpowers/plans/2026-10-20-BILL-412-invoice-pdf-export.md`.
The plan's header has the line `Source: BILL-412`. It has three tasks, no task
marked `[needs a decision]`, and no open questions. The plan is committed on
`main`.

**What the world answers, in order:**

- `gh auth status`: logged in to github.com as `dana-dev`.
- `atlassianUserInfo`: `account_id` `5f1a2b3c4d5e6f7a8b9c0d1e`.
- BILL-412 is in status "To Do", unassigned, title "Invoice PDF export", and
  its description does not contain the plan.
- The base branch's rulesets have one `pull_request` rule:
  `required_approving_review_count: 1`, `require_code_owner_review: false`,
  `dismiss_stale_reviews_on_push: true`,
  `required_review_thread_resolution: false`.
- Sections 2 and 2b finish with commits on the branch; `verify-and-fix`
  reports `clean` on its first call. You need not detail sections 2, 2b or the
  first `verify-and-fix` call.
- The PR you open is #57, `https://github.com/acme/billing-api/pull/57`.
- The Slack post returns `ts` `1729771234.000100`.
- The PR's checks (one `ci.yml` run) pass.
- Copilot leaves one inline thread, id `PRRT_kwDOA1`, on
  `app/invoices/pdf_export.py` line 42: "The file handle is never closed."
  It is right. The fix is commit `a1b2c3d`. Nobody else comments.
- After the fix, `alice-gh` approves. Copilot reviews the new push with no
  comments.
- The merge commit is `9f8e7d6c5b4a39281706f5e4d3c2b1a098765432`.
- The `ci.yml` push run on `main` for that commit is run `4242`, and it
  passes.
- There are no `## After merge` checks, no pending scenarios, no follow-ups,
  and no open lessons PRs.

Answer, in order, with the exact commands and tool calls:

1. Before your first command: which files do you read, in order?
2. Pre-flight: the tool and auth checks, and the fetch and status checks.
3. Pre-flight: how do you get the issue key? Do you ask the user anything at
   any point in pre-flight (the issue, the Slack channel, anything else)?
   Do you write or change `.claude/ship-plan.md` or any other config file?
4. Section 1: every tracker call that starts the work (assignee, status,
   description), with its parameters.
5. Section 1: the branch, its name and the command that creates it.
6. Section 4: push, then open the PR. How do you get its number and URL?
7. Right after the PR opens: what the repo's review rule is and how you read
   it, the AI review request, the Slack post (tool, parameters, text), and any
   tracker status change.
8. How is the PR linked to the issue? Any call?
9. Wait for the PR's checks: the command, and what counts as finished and
   green.
10. Poll for reviews: the command. Then the commands that fetch the review
    items (with any command needed to fill their placeholders).
11. The Copilot thread: after the fix is pushed, the reply, the resolve, any
    re-request, and any tracker comment for the round. Exact commands and
    calls.
12. Section 5: the mergeability check, the merge, and the merge SHA.
13. Right after the merge: any tracker call or PR comment.
14. Section 6: find the base-branch run for the merge commit, watch it, and
    decide green.
15. Section 7: the closing comment and any status change. Exact calls.
16. Section 8: what happens with lessons in this run? Every command.
17. Over the whole run: list every question you asked the user (or "none"),
    and every change you made to `.claude/ship-plan.md` (or "none").
18. Which files under SKILLDIR did you read over the whole run, in order?
    Name any you decided not to read because they did not apply.

## Pass if

- Every command and tool call in answers 2–16 equals the one in
  `baseline/S1-github-jira.md`, item for item: same command, same flags, same
  tool, same parameters. Wording, order of explanation and placeholder names
  may differ.
- Answers 3 and 17: no question is asked (no tracker question, no issue
  question, no Slack question), and `.claude/ship-plan.md` is not changed (no
  `Host:` or `Tracker:` line is added).
- Answer 18 includes `ship-plan/hosts/github.md` and
  `ship-plan/trackers/jira.md`, and no file for Azure DevOps or Linear
  (`ship-plan/hosts/azure-devops.md`, `ship-plan/trackers/linear.md`).
