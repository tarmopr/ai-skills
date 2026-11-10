---
name: ship-plan
description: Use when a written implementation plan exists and the user wants it carried, unsupervised, all the way to a merged PR on a green base branch in a GitHub, GitHub Enterprise or Azure DevOps repo that tracks work in Jira, in Linear, in GitHub Issues or in no tracker (config .claude/ship-plan.md) — "ship the plan", "ship this", "implement and merge", "take this plan to the base branch". Also use to resume such a run after a context compaction.
argument-hint: '[plan file path, or issue key] [--runner | --session]'
allowed-tools:
  - Bash(printenv SHIP_QUEUE_PARENT)
  - Bash(printenv SHIP_RUNNER)
  - Bash(printenv SHIP_RUNNER_KEY)
  - Bash(git switch -c feature/*)
  - Bash(git switch -c fix/*)
  - Bash(git switch -c docs/*)
  - Bash(git switch -c chore/*)
  - Bash(git switch -c refactor/*)
  - Bash(git push -u origin feature/*)
  - Bash(git push -u origin fix/*)
  - Bash(git push -u origin docs/*)
  - Bash(git push -u origin chore/*)
  - Bash(git push -u origin refactor/*)
  - Bash(git push origin feature/*)
  - Bash(git push origin fix/*)
  - Bash(git push origin docs/*)
  - Bash(git push origin chore/*)
  - Bash(git push origin refactor/*)
  - Bash(git fetch origin *)
  - Bash(git add *)
  - Bash(git commit *)
  - Bash(git merge origin/*)
  - Bash(git revert --no-edit *)
  - Bash(gh pr create *)
  - Bash(gh pr view *)
  - Bash(gh pr checks *)
  - Bash(gh pr comment *)
  - Bash(gh pr edit * --add-reviewer *)
  - Bash(gh repo view *)
  - Bash(gh api user --jq .login)
  - Bash(gh api user --jq .login --hostname *)
  - Bash(gh api repos/*/rules/branches/*)
  - Bash(gh api repos/*/branches/*/protection/required_pull_request_reviews)
  - Bash(gh api repos/*/branches/*/protection/required_pull_request_reviews --hostname *)
  - Bash(gh api graphql -f query='query ReviewThreads*)
  - Bash(gh api graphql -f query='mutation ReplyToThread*)
  - Bash(gh api graphql -f query='mutation ResolveThread*)
  - Bash(gh auth status)
  - Bash(git status *)
  - Bash(git diff *)
  - Bash(git reset --keep origin/*)
  - Bash(tail *)
  - Bash(sleep *)
  - Bash(git rev-parse *)
  - Bash(git log *)
  - Bash(git switch feature/*)
  - Bash(git switch fix/*)
  - Bash(git switch docs/*)
  - Bash(git switch chore/*)
  - Bash(git switch refactor/*)
  - Bash(git remote set-head origin --auto)
  - Bash(git remote get-url origin)
  - Bash(mkdir -p .superpowers/*)
  - mcp__plugin_atlassian_atlassian__discover
  - mcp__plugin_engineering_slack__slack_search_channels
  - mcp__plugin_engineering_slack__slack_send_message
  - Bash(gh pr merge * --squash --delete-branch)
  - Bash(gh pr merge * --merge --delete-branch)
  - Bash(gh run list *)
  - Bash(gh run view *)
  - Bash(gh run watch *)
  - Bash(gh run rerun * --failed)
  - mcp__plugin_atlassian_atlassian__getAccessibleAtlassianResources
  - mcp__plugin_atlassian_atlassian__atlassianUserInfo
  - mcp__plugin_atlassian_atlassian__searchJiraIssuesUsingJql
  - mcp__plugin_atlassian_atlassian__getJiraIssue
  - mcp__plugin_atlassian_atlassian__executeRead
  - mcp__plugin_atlassian_atlassian__executeWrite
  - mcp__plugin_atlassian_atlassian__createJiraIssue
  - mcp__plugin_atlassian_atlassian__editJiraIssue
  - mcp__plugin_atlassian_atlassian__transitionJiraIssue
  - mcp__plugin_atlassian_atlassian__addOrEditJiraIssueComment
  - Bash(gh pr list *)
  - Bash(gh pr diff *)
  - Bash(az account show)
  - Bash(az devops configure --list)
  - Bash(az repos show *)
  - Bash(az repos policy list *)
  - Bash(az pipelines list *)
  - Bash(az pipelines show *)
  - Bash(az devops invoke --area git --resource pullRequests --http-method POST *)
  - Bash(az repos pr show *)
  - Bash(az repos pr list *)
  - Bash(az repos pr policy list *)
  - Bash(az repos pr policy queue *)
  - Bash(az repos pr update --id * --status completed --squash true --delete-source-branch true)
  - Bash(az repos pr update --id * --status completed --squash false --delete-source-branch true)
  - Bash(az pipelines runs list *)
  - Bash(az pipelines runs show *)
  - Bash(az devops invoke --area build --resource timeline *)
  - Bash(az devops invoke --area build --resource logs *)
  - Bash(az devops invoke --area git --resource pullRequestThreads *)
  - Bash(az devops invoke --area git --resource pullRequestThreadComments *)
  - Bash(git merge-base *)
  - mcp__plugin_linear_linear__get_user
  - mcp__plugin_linear_linear__get_issue
  - mcp__plugin_linear_linear__list_issues
  - mcp__plugin_linear_linear__list_comments
  - mcp__plugin_linear_linear__list_issue_statuses
  - mcp__plugin_linear_linear__list_teams
  - mcp__plugin_linear_linear__list_projects
  - mcp__plugin_linear_linear__save_issue
  - mcp__plugin_linear_linear__save_comment
  - mcp__plugin_engineering_slack__slack_add_reaction
  - mcp__plugin_engineering_slack__slack_search_users
  - Bash(gh issue view *)
  - Bash(gh issue list *)
  - Bash(gh issue create *)
  - Bash(gh issue edit *)
  - Bash(gh issue comment *)
  - Bash(gh issue close *)
  - Bash(gh issue reopen *)
  - Bash(gh label list *)
  - Bash(gh label create *)
  - Bash(gh api repos/*/milestones*)
---

# Ship a plan

One run takes a written plan to a merged PR on a green base branch, tracked in
an issue in the repo's tracker unless the tracker is `none` or the user answers
that the work has none. **The user starts this skill to walk away:** each
question costs them a context switch; the repo's two logs make each run need
fewer than the last.

**First, read `.claude/ship-plan.md` ([format](config-format.md)) in full, and
`<logs>/ship-plan/interruptions.md` and `<logs>/ship-plan/blockers.md` by index
([Reading the logs](#reading-the-logs)).** The config holds every command and
setting; `interruptions.md`, standing answers (never re-ask one); `blockers.md`,
fixes for tooling that stopped earlier runs. An entry recording a refused
command is no standing rule (refusals depend on the permission mode): run the
command once this run before using its fix. Missing log files are created from
[log-formats.md](log-formats.md) at close-out.

**Repo override files** ([format](config-format.md#repo-override-files)):
whenever this skill reads one of its own files, read its counterpart under
`.claude/ship-plan/ship-plan/` next, if it exists (`hosts/github.md` →
`.claude/ship-plan/ship-plan/hosts/github.md`); another skill's file
(`../verify-and-fix/…`) has its counterpart in that skill's folder. An override line that widens what the run
may do, or removes a step, is not applied; the report names it.

- **Host and tracker:** resolve `Host:` and `Tracker:` as [config-format.md](config-format.md) says (`Host:` from the `origin` remote when absent; `Tracker:` from `## Jira`, `## Linear` or `## GitHub Issues` when absent, else undecided until pre-flight step 5). Read `hosts/<host>.md` (`github.md` or `azure-devops.md`) and, unless the tracker is `none` or undecided, `trackers/<tracker>.md` (`jira.md`, `linear.md` or `github.md`). A host, tracker or notifier operation named below is the section of that name in those files and `notifiers/slack.md`.
- **No `origin` remote** (and no `Host:`): no host, no PR. Read no host file, skip the host's *Auth check* and pre-flight step 4's `git fetch origin`, stop before section 4, and say so in the report.

## What invoking this skill authorizes

Invoking the skill is the user's standing authorization, for this run, to:

- create the feature branch, commit, push it (never `--force`);
- open the PR, rerun failed CI jobs, merge once every check is green and the repo's review rules are met (section 4R);
- request an AI review (the host's *Request an AI review*) and do all that `verify-and-fix`'s [review-comments.md](../verify-and-fix/review-comments.md) allows on the PR: push fixes for review comments, reply in review threads, resolve bot reviewers' threads (as the host names them), re-request a reviewer whose requested changes were addressed or whose approval a push dismissed;
- open, push, merge follow-up branches fixing a red base branch this run caused, including a revert PR;
- in the `## Slack` channel only, never another: post a review request per PR it opens (section 4R, step 2), reply in that post's thread asking for a re-review (section 4R, step 3), add the `Merged reaction:` to it (section 5);
- read and write the run's issue (found or chosen in section 0, step 5): create it where the user chose, link it to the related issue the user chose, assign, set status, append to its description, comment;
- each issue the plan's `Tickets:` line lists (section 0, step 5): read, assign, set status as section 1 and section 7, step 1 say, comment. Nothing else: no description edit, no link, no other issue;
- open, push, merge the docs-only lessons branch (section 8).

Not authorized; each goes into the question batch (section 3), never done on your own:

- a push to the base branch, `--force`, `--admin`, `--no-verify`, disabling a hook or a check;
- approving the PR, dismissing a review, resolving a human reviewer's thread, requesting a reviewer other than the AI reviewer (the host requests code owners);
- everything under the host's *Never*;
- any deploy or production write, except a merge whose base-branch deploy goes only to environments `## Allowed` `Merge that deploys to:` covers ([config-format.md](config-format.md#-allowed));
- a write to a shared environment's data;
- deleting a branch, file or row you did not create;
- spending money (paid APIs, a paid service);
- editing Claude Code settings files or any skill's `allowed-tools`;
- everything under the config's `## Never do`.

Apart from `## Allowed`, the config can add to this list, never remove from it.
Where `superpowers:subagent-driven-development` or `verify-and-fix` say a push,
PR or merge needs the user, these lists replace that rule.

**The frontmatter's `allowed-tools` pre-approves commands** for the invoking
turn, only when written exactly as this skill and the host file write them:

- **every push names its branch:** `git push origin <branch>`. A bare `git push` is not pre-approved, and on the base branch pushes to it;
- merges: the host's *Merge the PR*, in the form the config's `Merge:` picks;
- reruns: the host's *Rerun a failed PR check*, and its *Rerun a base-branch run* where the host pre-approves it;
- reverts: `git revert --no-edit <sha>`;
- local: `git fetch origin <ref>`, `git add <files>`, `git commit`. A fetch and a merge are two commands, never joined with `&&`.

The config's gate and prerequisite commands are not pre-approved. In a
permission mode that prompts, list them in the pre-flight batch with exact allow
lines (`Bash(<command>)`) for the user to add, plus the allow line the host's
*Rerun a base-branch run* gives, if any.

The pre-approval clears when the user sends a message, so every question ends
with **"Answer with `/ship-plan <your answers>`,"**: it restarts the skill,
renews the pre-approval, and resumes from the ledger. With `## Runner`
`Mode: runner` and this run in session mode (`--session` given, or not given
because the run has no plan file: "Runner or session"), the line is **"Answer
with `/ship-plan <your answers> --session`,"** so the answers resume this run,
not a new runner. A command still refused then goes into the batch (section 5, step 5).

## The run

```dot
digraph ship {
  pre [label="0 Pre-flight" shape=box];
  branch [label="1 Tracker and branch" shape=box];
  impl [label="2 Implement, 2b Simplify" shape=box];
  verify [label="4 Verify until clean" shape=box];
  pr [label="4 Push, PR" shape=box];
  checks [label="PR checks green?" shape=diamond];
  review [label="4R Review: request, triage, fix, reply" shape=box];
  rules [label="Review rules met?" shape=diamond];
  merge [label="5 Merge" shape=box];
  base [label="6 Base CI green, 6b deploy valid?" shape=diamond];
  red [label="red-base.md: rerun a transient, or fix-forward" shape=box];
  close [label="7 Close out, 8 Lessons" shape=doublecircle];

  pre -> branch -> impl -> verify;
  verify -> pr [label="clean"];
  verify -> close [label="not clean: no PR"];
  pr -> checks;
  checks -> verify [label="no: a gate failure"];
  checks -> review [label="yes, or CI None"];
  review -> checks [label="fixes pushed"];
  review -> rules;
  rules -> merge [label="yes"];
  rules -> close [label="not within Review wait: hand off"];
  merge -> base;
  merge -> close [label="deploy not covered: not merged"];
  base -> close [label="yes"];
  base -> red [label="no"];
  red -> base [label="rerun"];
  red -> verify [label="fix-forward"];
  red -> close [label="escalate or park"];
}
```

The run ends at section 7 and nowhere else. Waiting on CI is not an end, nor
is a pending question while other work remains.

**This session reads little itself** (every turn re-reads its context): the
ledgers, the config, `questions.md`, the plan text of the task it dispatches,
`git status`, `git log`, `git diff --stat`, the last 60 lines of a gate or CI
log. Anything wider (a source file, `grep` or `git grep` over the code, a full
CI log, any file over 300 lines) goes to an `Explore` agent at the `## Models`
`Research` row (default `sonnet`, `medium`), prompted for at most 30 lines with
file:line quotes.
**Every Agent dispatch passes both `model` and `effort`** from its role's
`## Models` row; the hook refuses a dispatch missing either.

### Reading the logs

**Where they are:** `<logs>` is `.claude/` under the config's `## Logs` `Location: repo`
(the default), or the local store under `Location: local`
([`## Logs`](config-format.md#-logs)). While the store holds no log, read the tracked copies
under `.claude/`: only section 0 (or ship-issue's I0, when it runs first; or `verify-and-fix` run on
its own) copies them in. Every log path below and in the other skills is under `<logs>`.

`blockers.md` and the `interruptions.md` files have a size budget (section 8);
read them by index:

1. **List the headings:** `grep -n '^##' <log>`. Each `###` heading is one entry's
   symptom (blockers) or question (interruptions). Read a log under 8 KB in full.
2. **Read the entries that match,** each from its heading to the next `###`
   (`sed -n '<from>,<to>p'`): every entry whose heading names the tool, gate, host,
   tracker, error or question at hand, and every entry the config or an override file
   names (`## Gates` notes, [repo override files](config-format.md#repo-override-files)).
   Unsure whether a heading matches: read the entry.
3. **Read again when the work changes:** before each question you are about to ask
   (a matching standing answer settles it), before each gate or tool not yet
   used this run, and after a compaction. Keep the headings as the index, not the entries.
4. **A heading list that matches nothing** is an answer, not a reason to read the
   whole log. A new blocker or question that will recur goes into the log at close-out.
5. **Record each entry you apply** as a ledger line `Used: <log path> <heading>`, the path under `<logs>`,
   e.g. `Used: ship-plan/blockers.md <heading>` (`verify-and-fix` under `ship-plan`: in
   ship-plan's ledger). Section 8 bumps its `Seen` from these; an entry never used ages out.

### The ledger

`.superpowers/ship-plan/<branch>/ledger.md`, every `/` in the branch name written
as `-` (`feature/x` → `feature-x`), so section 0, step 2's `*/ledger.md` listing
finds it (`.superpowers/` goes in `.git/info/exclude`, never `.gitignore`). First
line, always:
`Phase: <n> | Plan: <path> | Issue: <id or none> | PR: #<n> | merge: <sha> | base run: <id>`,
rewritten as each value becomes known; a finished run ends with `Phase: done`.
Below it, one line per event, one fact in at most about 300 characters (detail
goes in the plan, a commit or the PR): phase changes, `Ruling:` lines, `Asked:`
lines (every question put to the user, with its answer), questions parked, CI
results, `Lesson:` lines (each names something a skill, prompt or repo file
should change; a re-check that found nothing changed is not one), `Used:` and
`Removed:` lines, and a `Branch: <name>` line once the branch exists (section 1),
which a resume switches to.
**After a context compaction, resume from the ledger and `git log`, not from
memory.** `questions.md` sits next to it (section 3). `verify-and-fix` keeps its
own ledger in `.superpowers/verify-and-fix/<branch>/`; link to it, don't copy from it.

**When the session ends before the run does** (usage limit, context running
out, a batch the user will answer later): update the ledger, then write a
handoff (the `handoff` skill if available, else `HANDOFF.md` next to the
ledger). Its resume line is `/ship-plan`, no argument (the ledger says where
the run stands); with `## Runner` `Mode: runner` and this run in session mode,
`/ship-plan --session`.

**The sections live in phase files** (index below). Read a file when its first
section starts, and on a resume the file of the ledger's `Phase:`. A step that
sends the run to, or names, a section in another phase file reads that section
there, for that step, in every mode.

## 0. Pre-flight — see [phase-implement.md](phase-implement.md); read it when this phase starts

## 1. Tracker and branch — see [phase-implement.md](phase-implement.md); read it when this phase starts

## 2. Implement — see [phase-implement.md](phase-implement.md); read it when this phase starts

## 2b. Simplify — see [phase-implement.md](phase-implement.md); read it when this phase starts

## 3. Questions — see [phase-verify.md](phase-verify.md); read it when this phase starts, and whenever a question comes up before it

## 4. Verify, push, PR — see [phase-verify.md](phase-verify.md); read it when this phase starts

## 4R. Review — see [phase-merge.md](phase-merge.md); read it when this phase starts

## 5. Merge — see [phase-merge.md](phase-merge.md); read it when this phase starts

## 6. Base-branch CI — see [phase-merge.md](phase-merge.md); read it when this phase starts

## 6b. Validate the deploy — see [phase-merge.md](phase-merge.md); read it when this phase starts

## 7. Close out — see [phase-close.md](phase-close.md); read it when this phase starts

## 8. Lessons — see [phase-close.md](phase-close.md); read it when this phase starts

## Queued mode (ship-queue)

A run started by ship-queue as its child session follows different rules
(nobody watches, it asks nothing). **When `printenv SHIP_QUEUE_PARENT` prints a parent key, read [modes.md](modes.md#queued-mode).**

## Runner mode (ship-runner)

**When `printenv SHIP_RUNNER` prints a folder, read [runner-child.md](runner-child.md) and [modes.md](modes.md#runner-mode).**

## Runner or session

**Flags:** `--runner` and `--session` are flags only as whole words at the start
or end of the argument (`docs/plan.md --runner`, `--session 1A, 2B`); read the
argument without them. Elsewhere, or inside a word, they are text. A flag is
never the plan path, the issue key or answers.

- **`--session`, or a runner child:** session mode, whatever `Mode:` says. Another ship skill passes `--session` when it invokes this one from its run (ship-issue's I6 and its I0 resume row); a session-mode answer line carries it.
- **Otherwise, with `## Runner` `Mode: runner` or `--runner`:** the ship runner runs the phases and this session only watches and relays: follow [runner-session.md](runner-session.md) with `start plan <path>`, `<path>` the plan file (the argument; with an issue key or no argument, the `Plan:` of the open ledger the run resumes, section 0, step 2). With no plan file (an issue key with no open ledger, its description the plan; a resumed ledger whose `Plan:` names none), stay in session mode and say so in one line.
- **Every nested ship skill** this run invokes (verify-and-fix in sections 4 and 4R and in red-base.md's fix-forward) gets `--session`: it runs inside this run, never as its own runner.

## Red flags

| Thought | Reality |
|---|---|
| "Ask about the merge / rerun / follow-up PR" | Authorized: do them, except a merge deploying where `## Allowed` does not cover (section 5, step 3) and a rerun of a deploying base-branch run (red-base.md). |
| "Quick question, then carry on" | Park it; ask the batch when nothing unblocked is left. |
| "Fairly sure, but I'll check with the user" | Run the confidence test. Passes: rule and record. |
| "Post the PR to the obvious team channel" | Only the `## Slack` channel (config or local file). Neither: ask in pre-flight; `none` means no post. |
| "Move it to In Review" | Only statuses the config names. |
| "Checks are green, merge" | Section 4R first: review rules, AI review, every comment handled. |
| "No approval yet, keep waiting" | Wait `Review wait:`, then hand off. The run must end. |
| "One background loop over the review window" | One `sleep 300` at a time, a status line after each poll (section 4R, step 3); in one long loop the user sees nothing and cannot ask. |
| "Approve it / resolve their thread so it can merge" | Never. Approval and a person's thread belong to the reviewer. |
| "Run issue done, close its sibling sub-tasks too" | Only `Tickets:` issues, each once its own tasks are committed and a commit carries its key. |
| "The tracker already says done" | Done means the config's `Done means:`. Check the base-branch run first. |
| "The PR is merged, so I'm done" | Done when the base branch is green, the closing comment written, and lessons recorded. |
| "Base branch failed, probably flaky, rerun until green" | Only a failure listed as transient gets a rerun, at most 3. With `Merge deploys to:`, none (a rerun redeploys), unless `Rerun a transient deploy failure on:` covers a runner or network failure: one, after a 10-minute wait; a second failure escalates. A billing refusal escalates at once. Anything else gets a root cause. |
| "Push the one-line fix straight to the base branch" | Never. A fix branch goes through the same loop. |
| "The ruling is obvious, no need to write it down" | An unrecorded ruling is a secret decision. Write the ledger line. |
| "Update interruptions.md next time" | At close-out: next time is when it would have saved the question. |
| "Use a worktree for isolation" | A fresh worktree lacks the repo's untracked files. Use the current checkout; a busy checkout goes in the batch. |
| "No issue key, create one in the config's project" | Ask the "Issue question" first: where a new issue goes and the related issue are the user's choice. |
| "No tracker, just note it in chat" | The PR is the record: plan, rulings and verification go in its body. |
| "No checks reported, keep waiting" | Host's *Has CI* finds none: CI None. Otherwise 10 minutes, then park. |
| "No checks is not checks passing, can't merge" | With CI None, `verify-and-fix` clean is the gate: merge, report "base branch has no CI". |
| "The tracker failed, work around it" | Park it as the tracker's *Auth* says, continue without it, say so in the report. |
