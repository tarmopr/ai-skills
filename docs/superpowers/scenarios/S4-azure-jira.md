# S4: Azure DevOps with Jira

An Azure Repos repo tracked in Jira. No integration links its PRs to Jira
issues, so the PR reaches the issue only through the Merged comment.

## Prompt

You are running the `ship-plan` skill. Its files are in SKILLDIR/ship-plan/
(SKILL.md and the files it links), and the skills it calls are in
SKILLDIR/verify-and-fix/ and SKILLDIR/ship-issue/. Read SKILLDIR/ship-plan/SKILL.md
and every file it links that matters for this run.

**The repo:** `payroll-sync`. `git remote get-url origin` prints
`https://contoso.visualstudio.com/Finance/_git/payroll-sync`. It has no
`.github/` folder. Its CI is Azure Pipelines definition 7, which is the
`main` branch's build-validation policy and runs on pushes to `main`. The logs
in `.claude/ship-plan/` hold only their seed text.

**Its `.claude/ship-plan.md`:**

```markdown
# Ship config

## Repo
- Tracker: jira
- Base branch: main
- Merge: squash

## Gates
| Gate | Command | Only when changed | Timeout |
|---|---|---|---|
| Tests | make test | | |

## CI
- Workflow: 7

## Jira
- Site: https://contoso-fin.atlassian.net
- Project: PAY
- Start transition: Start progress
- Done transition: Done
- Notes: no automation moves issues.

## Slack
- Channel: none
```

**The invocation:** `/ship-plan docs/superpowers/plans/2026-10-23-PAY-301-holiday-pay.md`.
The issue is `PAY-301`, in progress and assigned to you. The run has reached
section 4, step 2: `verify-and-fix` just reported `clean` on branch
`feature/PAY-301-holiday-pay`. Nothing has been pushed yet.

**What the world answers:**

- The PR you open is pull request 96, with web URL
  `https://contoso.visualstudio.com/Finance/_git/payroll-sync/pullrequest/96`.
- Its validation build passes; `sam.r` votes 10 with no comments.
- The merge commit is `b7c6d5e4f3a2910887766554433221100ffeeddc`; the
  pipeline 7 run on `main` that contains it is run 5120, and it passes.
- At close-out the user approves one follow-up issue, "Backfill holiday pay
  for 2025", to be related to PAY-301. No existing issue covers it.

Answer, in order, with the exact commands and tool calls:

1. Which files under SKILLDIR do you read for this run, in order? How do you
   decide the host?
2. Push and open the PR. How do you get its web URL?
3. How is the PR linked to the Jira issue? Every call, or "none" with the
   reason.
4. Merge, and record the merge SHA.
5. Right after the merge: the Jira comment. Give the tool call and the full
   comment text. Where does the PR's URL appear?
6. Base-branch run: find it, watch it, decide green.
7. Close out: the Done comment and the transition.
8. The approved follow-up: search for an existing one, create it, and relate
   it to PAY-301. Exact tool calls and parameters.
9. List every `executeWrite` call of this run, with its operation, and every
   call that creates a link of any kind between Jira and the PR.

## Pass if

- The host is `azure-devops`, decided from the remote (no `Host:` in the
  config); `ship-plan/hosts/azure-devops.md` is read and `ship-plan/hosts/github.md`
  is not.
- The PR's web URL is in the Merged comment.
- No remote link is created from the issue to the PR: no `executeWrite`
  operation other than `createJiraIssueLink`, and no other tool that links
  Jira to the PR.
- The only `executeWrite` call is `createJiraIssueLink` (for the follow-up),
  with `linkType`, `inwardIssue` and `outwardIssue`.
- No `gh` command appears.
