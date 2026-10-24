# S2: GitHub Enterprise, no tracker

A repo on a GitHub Enterprise host whose config says it has no tracker. The PR
is the record.

## Prompt

You are running the `ship-plan` skill. Its files are in SKILLDIR/ship-plan/
(SKILL.md and the files it links), and the skills it calls are in
SKILLDIR/verify-and-fix/ and SKILLDIR/ship-issue/. Read SKILLDIR/ship-plan/SKILL.md
and every file it links that matters for this run.

**The repo:** `payments/ledger-service` on the GitHub Enterprise host
`github.acme.com`. `git remote get-url origin` prints
`https://github.acme.com/payments/ledger-service.git`. `.github/workflows/ci.yml`
runs on `pull_request` and on `push` to `main`, with no path filters. The
logs in `.claude/ship-plan/` hold only their seed text.

**Its `.claude/ship-plan.md`:**

```markdown
# Ship config

## Repo
- Base branch: main
- Merge: squash
- Tracker: none

## Gates
| Gate | Command | Only when changed | Timeout |
|---|---|---|---|
| Tests | make test | | |

## CI
- Workflow: ci.yml

## Slack
- Channel: none
```

**The invocation:** `/ship-plan docs/superpowers/plans/2026-10-21-ledger-retention.md`.
The plan has no issue key anywhere. The run has reached section 4, step 2:
`verify-and-fix` just reported `clean` on branch `feature/ledger-retention`,
and nothing has been pushed yet.

**What the world answers:**

- `gh repo view --json url --jq .url` prints
  `https://github.acme.com/payments/ledger-service`.
- Your login on that host is `dana-dev`.
- The PR you open is #18, `https://github.acme.com/payments/ledger-service/pull/18`.
- The base branch has no rulesets (404) and classic branch protection that
  requires 1 approval and resolved threads.
- The PR's checks pass. Copilot leaves one inline thread, id `PRRT_kwDOZ9`,
  which is right; the fix is commit `c0ffee1`. `lee-q` then approves.
- The merge commit is `5e4d3c2b1a0987654321fedcba9876543210abcd`; the
  `ci.yml` push run on it is run `880`, and it passes.

Answer, in order, with the exact commands and tool calls:

1. Which files under SKILLDIR do you read for this run, in order?
2. How do you decide whether this repo has an issue tracker? Do you ask the
   user anything about a tracker or an issue?
3. Push and open the PR. What does the PR body contain that it would not
   contain with a tracked issue?
4. Read the repo's review rule: every command.
5. Request the AI review. Any Slack post?
6. Fetch the review items: every command, including the ones that give you
   the owner, the repo name, your login and the host.
7. Reply to the Copilot thread and resolve it: exact commands.
8. Merge and record the merge SHA.
9. Find and watch the base-branch run.
10. Close out: which closing comment do you write, from which file and
    section, and with which command do you post it? Any tracker call?

## Pass if

- Every `gh api` call in the answers carries `--hostname github.acme.com`,
  after its other arguments.
- No file under `ship-plan/trackers/` is read, and no Atlassian or Linear tool
  is called anywhere.
- No question about a tracker or an issue is asked.
- The closing comment is "PR comment: done" from `ship-plan/templates-pr.md`,
  posted to PR #18 with the host's PR comment command.
- The PR body carries the plan (its `## Plan` section), since there is no
  issue.
- `ship-plan/notifiers/slack.md` is not read, and no Slack tool is called
  (`Channel: none`).
