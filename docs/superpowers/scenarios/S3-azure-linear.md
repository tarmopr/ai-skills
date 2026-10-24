# S3: Azure DevOps with Linear

An Azure Repos repo built by Azure Pipelines, with Linear as its tracker and no
`.github/` folder. The PR body is longer than Azure DevOps accepts.

## Prompt

You are running the `ship-plan` skill. Its files are in SKILLDIR/ship-plan/
(SKILL.md and the files it links), and the skills it calls are in
SKILLDIR/verify-and-fix/ and SKILLDIR/ship-issue/. Read SKILLDIR/ship-plan/SKILL.md
and every file it links that matters for this run.

**The repo:** `RouteHub`, hosted on Azure DevOps. `git remote get-url origin`
prints `https://dev.azure.com/contoso/Logistics/_git/RouteHub`. It has no
`.github/` folder. Its CI is Azure Pipelines definition 12, "RouteHub CI",
which is the `main` branch's build-validation policy and also runs on pushes
to `main`. The logs in `.claude/ship-plan/` hold only their seed text.

**Its `.claude/ship-plan.md`:**

```markdown
# Ship config

## Repo
- Host: azure-devops
- Tracker: linear
- Base branch: main
- Merge: squash

## Gates
| Gate | Command | Only when changed | Timeout |
|---|---|---|---|
| Build | make build | | |
| Tests | make test | | 20 |

## CI
- Workflow: 12

## Linear
- Team: Routing
- Project: ETA accuracy
- Start status: In Progress
- Review status: In Review
- Done status: Done
- Done means: merged and base-branch CI green
- Notes: Linear's GitHub integration is not used here.

## Slack
- Channel: none
```

**The invocation:** `/ship-plan docs/superpowers/plans/2026-10-22-RTE-88-stop-eta-recalc.md`.
The issue is Linear `RTE-88`, already in "In Progress" and assigned to you.
The run has reached section 4, step 2: `verify-and-fix` just reported `clean`
on branch `feature/RTE-88-stop-eta-recalc`, which changes files under `src/`.
Nothing has been pushed yet.

**The PR body** you drafted from the PR body template is 5,200 characters
long. Its `## What changed` heading starts at character 1,400. Its
`## Decisions made without the user` section starts at character 3,900.

**What the world answers:**

- `az account show` succeeds. The repo's `main` branch has a "Minimum number
  of reviewers" policy of 1, a build-validation policy for pipeline 12 with no
  path filter, and a "Comment requirements" policy.
- The PR you open is pull request 431.
- The PR's validation build is run 2410, and it passes.
- `pat.k` leaves one comment thread, id 9001, which is right; the fix is
  commit `d00dfee`. Then `pat.k` votes 10.
- The merge commit is `0a1b2c3d4e5f60718293a4b5c6d7e8f901234567`. The
  pipeline 12 run on `main` that contains it is run 2415, and it passes.

Answer, in order, with the exact commands and tool calls:

1. Which files under SKILLDIR do you read for this run, in order?
2. Push, then open the PR: every file you write and every command, given the
   body's length. How do you get the PR's number and web URL?
3. Link the PR to the Linear issue, and move the issue to its review status:
   exact tool calls and parameters.
4. Wait for the PR's checks: the command, and what counts as green.
5. Suppose the checks report nothing at all. Is this repo "CI None"? Why or
   why not? Quote the rule you apply.
6. Read the repo's review rule. Request an AI review: what do you do?
7. Fetch the review items; reply to thread 9001 once the fix is pushed;
   re-request the reviewer. Exact commands, or "none" with the reason.
8. Decide the review rules are met, check the merge state, and merge. How do
   you get the merge SHA?
9. Find and watch the base-branch run for the merge commit, and decide green.
10. Close out: the tracker comment(s), where the PR's URL appears, and the
    status change. Exact tool calls.

## Pass if

- Answer 5: the repo is not CI None. The reason is the host's *Has CI* (a
  pipeline exists, `Workflow: 12`), not the missing `.github/` folder.
- Every PR, review and CI command is an Azure DevOps (`az`) command taken
  from `ship-plan/hosts/azure-devops.md`, with its heading named. No `gh`
  command appears, and `ship-plan/hosts/github.md` is not read.
- The PR is linked through Linear `save_issue` with `links` holding the PR's
  web URL. The PR URL also appears in the Merged comment.
- The 4,000-character limit is handled by splitting the 5,200-character body:
  a head file that runs up to `## What changed` (under 4,000 characters) used
  as the PR description, and the rest posted as the PR's first comment right
  after creation. The head says where the decisions (rulings) ended up.
- No Copilot or AI review is requested (none on this host). No re-request
  command is run (none on this host).
- `ship-plan/trackers/linear.md` is read; `ship-plan/trackers/jira.md` is not,
  and no Atlassian tool is called.
