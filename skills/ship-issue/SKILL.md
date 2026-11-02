---
name: ship-issue
description: Use when the user wants an issue, or a problem described in words, taken all the way from idea to a merged PR on a green base branch without supervision, including the design, spec and plan — "ship PROJ-123 end to end", "from issue to merge", "brainstorm, plan and ship this". Also use to resume such a run after a context compaction.
argument-hint: '[issue key | a description of the problem] [answers to a parked batch]'
allowed-tools:
  - Bash(printenv SHIP_QUEUE_PARENT)
  - Bash(printenv SHIP_RUNNER)
  - Bash(git switch -c feature/*)
  - Bash(git switch -c fix/*)
  - Bash(git switch -c docs/*)
  - Bash(git switch -c chore/*)
  - Bash(git switch -c refactor/*)
  - Bash(git worktree add *)
  - Bash(git fetch origin *)
  - Bash(git add *)
  - Bash(git commit *)
  - Bash(git hook run pre-commit)
  - Bash(git status)
  - Bash(git worktree list)
  - Bash(git remote get-url origin)
  - Bash(git rev-parse *)
  - Bash(git check-ignore *)
  - Bash(gh auth status)
  - Bash(gh run list *)
  - Bash(gh pr list *)
  - mcp__plugin_atlassian_atlassian__getAccessibleAtlassianResources
  - mcp__plugin_atlassian_atlassian__atlassianUserInfo
  - mcp__plugin_atlassian_atlassian__getJiraIssue
  - mcp__plugin_atlassian_atlassian__searchJiraIssuesUsingJql
  - mcp__plugin_atlassian_atlassian__executeRead
  - mcp__plugin_atlassian_atlassian__discover
  - mcp__plugin_engineering_slack__slack_search_channels
  - mcp__plugin_atlassian_atlassian__executeWrite
  - mcp__plugin_atlassian_atlassian__createJiraIssue
  - mcp__plugin_atlassian_atlassian__editJiraIssue
  - mcp__plugin_atlassian_atlassian__transitionJiraIssue
  - mcp__plugin_atlassian_atlassian__addOrEditJiraIssueComment
  - Bash(az account show)
  - Bash(az repos pr list *)
  - Bash(az pipelines runs list *)
  - Bash(gh pr view *)
  - Bash(az repos pr show *)
  - Bash(az devops configure --list)
  - mcp__plugin_linear_linear__get_user
  - mcp__plugin_linear_linear__get_issue
  - mcp__plugin_linear_linear__list_issues
  - mcp__plugin_linear_linear__list_comments
  - mcp__plugin_linear_linear__list_issue_statuses
  - mcp__plugin_linear_linear__list_teams
  - mcp__plugin_linear_linear__list_projects
  - mcp__plugin_linear_linear__save_issue
  - mcp__plugin_linear_linear__save_comment
  - Bash(gh repo view *)
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

# Ship an issue

One run takes an issue from nothing to a merged PR on a green base branch:
research, design, spec, plan, the tracker, then **ship-plan** for the rest. **The user
starts this skill so they can walk away.** Every question is asked once, in one
batch (I3). After that the run decides for itself or parks the question for
ship-plan's close-out.

**Before anything else, read in full:** the repo's `.claude/ship-plan.md`
(ship-plan's [config-format.md](../ship-plan/config-format.md)),
`.claude/ship-issue/interruptions.md`, `.claude/ship-plan/interruptions.md`
and `.claude/ship-plan/blockers.md`. A missing file is not an error; a missing
log is created from [log-formats.md](log-formats.md) at close-out. A question
with a standing answer in any of them is not asked again.

**Repo override files** ([format](../ship-plan/config-format.md#repo-override-files)):
whenever this skill reads one of its own files, read its counterpart under
`.claude/ship-plan/ship-issue/` next, if it exists: `.claude/ship-plan/ship-issue/SKILL.md`
right after this file, `.claude/ship-plan/ship-issue/evidence.md` wherever
evidence.md is read, the stages included. A file of another skill
(`../ship-plan/…`) has its counterpart in that skill's folder. An override line
that widens what the run may do, or removes a step, is not applied, and the
report names it.

- **A repo set up for `ship`:** if `.claude/ship.md` exists and `.claude/ship-plan.md` does not, stop with one line: "This repo is set up for the removed `ship` skill: move `.claude/ship.md` to `.claude/ship-plan.md` and `.claude/ship/` to `.claude/ship-plan/`."
- **Host and tracker:** resolve `Host:` and `Tracker:` as [config-format.md](../ship-plan/config-format.md) says (`Host:` from the `origin` remote when absent; `Tracker:` from `## Jira`, `## Linear` or `## GitHub Issues` when absent, else undecided until I1). Then read `../ship-plan/hosts/<host>.md` (`github.md` or `azure-devops.md`) and, unless the tracker is `none` or undecided, `../ship-plan/trackers/<tracker>.md` (`jira.md`, `linear.md` or `github.md`). A reference below to an operation of the host or the tracker names the section of that name in those files. **When `Tracker:` is not `none`, or the tracker question is asked, read [templates-issue.md](../ship-plan/templates-issue.md).**
- **No `origin` remote** (and no `Host:`): there is no host and no PR to open. Read no host file, skip the host's *Auth check*, *Find open PRs* and *Find the base-branch run* and every `git fetch origin`, and branch from `<base>` where this skill says `origin/<base>`. ship-plan then stops before its section 4 and says so in its report.

From the config, this skill reads: `## Repo` (`<base>`, branch pattern, `Host:`, `Tracker:`),
the tracker's section (`## Jira`, `## Linear` or `## GitHub Issues`), `## CI`, `## Prerequisites`, `## UI testing`, `## Slack` (or
`.claude/ship-plan.local.md`), `## Evidence`, `## Worktree` and `## Models`. **When `.claude/ship-plan.md` is missing or a section must be drafted, read [config-drafting.md](../ship-plan/config-drafting.md).** Draft it as that file says, and put the draft at the top of the I3 batch.
Research, spec and plan proceed meanwhile; no gate runs until it is confirmed.
Once confirmed, commit it on the feature branch with a `Ruling:`.

**Two stages run as subagents:** the Spec stage (research, design, spec) and
the Plan stage, each from a fresh context at the model and effort of its
`## Models` row, by [stage-prompts.md](stage-prompts.md). This session never
changes its own model or effort, which would invalidate its prompt cache: start
it on Opus at high effort. It does the routing, the tracker, the checkout, the batch,
the commits and ship-plan, and it reads little itself, by ship-plan's rule
"This session reads little itself" (its section "The run"): code and long
logs go to an `Explore` agent at the `Research` row.

**All work is tracked in an issue in the repo's tracker.** With `Tracker: none`,
the PR is the record: there is no issue and no issue question. With a tracker
there is no "no issue" path: with no issue key, I1 asks the "Issue question"
from ship-plan's templates-issue.md (its "No issue" option is ship-plan's only)
before anything else. With `Tracker:` undecided, I1 first asks that file's
"Which tracker does this repo use?". With no tracker section in the config, the tracker's *Where a new issue goes* drafts it.

## What invoking this skill authorizes

Everything ship-plan's "What invoking this skill authorizes" lists, plus:

- creating the issue in the repo's tracker when none was given, and writing to it (no tracker step with `Tracker: none`);
- creating the feature branch and committing the spec (unless it is held for a docs PR, I2 step 3), the plan and a confirmed draft config on it;
- creating and preparing a worktree (section W) when the current checkout is busy. ship-plan's "do not create a worktree on your own" is about ship-plan's own run; this skill creates one only with W's setup steps, which are what that rule protects;
- **skipping the approval stops** in superpowers:brainstorming (design sections, written spec) and superpowers:writing-plans (plan review, execution-method choice). Invoking this skill is the user's explicit instruction to skip them. Each skipped stop becomes a `Ruling:` line. The execution method is always ship-plan, which uses subagent-driven-development.

It does **not** authorize what ship-plan's "does not authorize" list names, nor
anything under the config's `## Never do`. A deploy in particular is never part
of the run, except a merge that `## Allowed` covers, under `ship-plan`
([`## Allowed`](../ship-plan/config-format.md#-allowed)). Otherwise it is a follow-up in the Done comment and **never a question**.

## The ledger

`.superpowers/ship-issue/<KEY-n>/ledger.md`, in the checkout chosen in
section W, not the one the session started in: a worktree left with
`EnterWorktree` becomes read-only. Keep earlier rulings in the conversation and
write them once the checkout is chosen. Add `.superpowers/` to
`<git-common-dir>/info/exclude` (`git rev-parse --git-common-dir`; in a
worktree `.git` is a file), never to `.gitignore`.

**With no issue** (`Tracker: none`), `<slug>` (3–6 words of the problem in
kebab case) stands in for `<KEY-n>` wherever this skill, worktree.md and
stage-prompts.md write it: the ledger is `.superpowers/ship-issue/<slug>/`, the
branch `<type>/<slug>`, and the resume argument is the slug. File names drop
`<KEY-n>-` (`<yyyy-mm-dd>-<slug>-design.md`), and titles and commit subjects
drop ` (<KEY-n>)`.

First line, rewritten as each value becomes known:
`Phase: I<n> | Issue: <KEY-n or none> | Branch: <b> | Spec: <path> | Plan: <path> | ship-plan ledger: <path>`.
Below it, one line per event, in ship-plan's formats (its section 3):
`Ruling: <decision> — <evidence quoted> — <cost if wrong>`, `Parked: <question>
— <options, recommendation> — <what it blocks>`, `Asked: <question> — <answer, or
"pending">` for every question put to the user, and `Lesson: <what> — <the
step that would have caught it>`. When the batch is sent, the last line is
`Waiting: batch of <n>, sent <date>; heads: #<pr> <sha>, …`, with the head of every open PR the issue depends on, so a resumed run can see whether one moved while the batch waited. I1 writes `Size: <small|standard> — <reason>`, and a raised size a second one. Each stage writes
`Stage: <spec|plan> <new|revise> dispatched <date>` before its dispatch and
`Stage: <spec|plan> done <path> — skills: <its Skills: line>` once its report is copied in.

ship-plan keeps its own ledger in `.superpowers/ship-plan/<branch>/` (every `/` in the branch name written as `-`). **Never
create or write that file.** ship-plan treats an existing ledger as a resumed
run and reads its argument as answers.

**After a compaction, resume from the first line, not from memory.** Phase I6
or later: route through I0, which hands back to ship-plan.

**When the session ends before the run does** (a usage limit, the context
running out, a batch the user will answer later): bring the ledger up to date,
then write a handoff: the `handoff` skill when it is available, otherwise a
`HANDOFF.md` next to the ledger. It names the checkout, and its resume line is
`/ship-issue`, with no argument. Once ship-plan runs, its own rule applies.

## I0. Route: what already exists — see [phase-spec.md](phase-spec.md); read it when this phase starts

## I1. The issue — see [phase-spec.md](phase-spec.md); read it when this phase starts

## I2. Research and spec: the Spec stage — see [phase-spec.md](phase-spec.md); read it when this phase starts

## I3. The one question batch — see [phase-spec.md](phase-spec.md); read it when this phase starts

## I4. Plan: the Plan stage — see [phase-plan.md](phase-plan.md); read it when this phase starts

## I5. Tracker — see [phase-plan.md](phase-plan.md); read it when this phase starts

## I6. Hand off

Check that the plan's `From ship-issue` block matches this ledger, and update
it (and its commit) if lines were added since I4. Then invoke **ship-plan**
through the Skill tool, **with the absolute plan file path**, not the issue key:

```
ship-plan <checkout>/docs/superpowers/plans/<yyyy-mm-dd>-<KEY-n>-<slug>.md
```

Write ship-plan's ledger path into this ledger's first line once it exists.
An ignored plan exists only in the checkout where it was written and does not
travel with the branch. If ship-plan runs in a different checkout, copy the
file there first.

If a command ship-plan pre-approves still prompts when it is invoked from here,
write a `Lesson:`.

From here ship-plan runs to close-out. It copies the `From ship-issue` block
into its ledger at pre-flight, so the rulings reach the PR body, and its
section 8 writes this run's questions to `.claude/ship-issue/interruptions.md`
on the same lessons branch.

## W. Which checkout

Main checkout, on `<base>`, clean: branch there. On this issue's branch (the
main checkout or a worktree): stay. **When the current checkout is dirty or on another branch, read [worktree.md](worktree.md).**

## Queued mode (ship-queue)

**A run is queued** when it was started by ship-queue as its child session
(`printenv SHIP_QUEUE_PARENT` prints a parent key: ship-queue's *Child
sessions* sets it) and that parent's ship-queue ledger in this checkout
(`.superpowers/ship-queue/<parent>/ledger.md`) has a `Current: <KEY> started …`
line naming this run's issue, with no `Result: <KEY>` line after it. A leftover queue ledger alone does not make a
run the user started queued: such a run asks as unqueued. The queue
started this run and waits for it to end; nobody is watching it. Everything
above applies, with these changes:

- **Ask nothing: never `AskUserQuestion`, and never wait for a reply,** at every point this skill would ask: I1's questions, the I3 batch, a question found after the batch. Write the ledger lines exactly as unqueued (`Asked: … — pending`, `Parked:`, and for I3 the `Waiting: batch …` line). Then post the batch as one comment on the issue (the tracker's *Comment*): the questions numbered, each with its options and the recommendation first, ending with the answer line **"Answer with `/ship-queue <parent> <KEY>: <your answers>`."** (`<parent>` is the queue ledger's `Parent:`), so the user's answers resume the queue, not this run alone; the queue's resume form is `/ship-queue <parent> <KEY>: <answers>`. Carry on with everything the answers do not block (the Spec stage and its commit), then end the run.
- **A question before the issue is read** (a tracker call failing at I1) has no issue to comment on: write it to the ledger with its exact error, and end the run.
- **I0's live-run row** does not apply to this run's own issue's ledgers in the queue ledger's `Checkout:`: the queue that names it in `Current:` is this run's parent session, which started this child after its own Q0 step 4 checked that no other session holds the queue, and whose earlier child of this sub-issue (a cut-off run being resumed) has ended. A ledger for the issue in any other checkout still counts.
- **No session-end handoff** of this run's own: the queue writes one for the whole queue.
- **ship-plan** runs in its own queued mode (its "Queued mode (ship-queue)" section), found the same way.

## Runner mode (ship-runner)

**A run is in Runner mode** when the ship runner started it as a child
(`printenv SHIP_RUNNER` prints the runner's folder) and that folder's
`state.json` has a `current` field naming this run's issue: the key the
runner passed as the argument (with no issue, the slug). A `SHIP_RUNNER`
whose `state.json` names another item, or none, does not make a run a runner
child. The runner's prompt names the phase. Nobody is watching. Everything in
Queued mode above applies, with these changes:

- **The answer line** of the batch comment is **"Answer in the session that started the run."**, in place of the `/ship-queue` one. The answers come back in a later runner prompt, after "The user's answers, copied exactly:". Rewrite each answered `Asked: … — pending` line in place with its answer, never as a second line: the runner counts every line that still ends in `— pending`. Then go on as I0 says for a resume with answers.
- **Only the named phase, reading only its phase file:** `spec` is I0–I3 ([phase-spec.md](phase-spec.md)); `plan` is I4 and I5 ([phase-plan.md](phase-plan.md)). A phase ends where the next one begins: rewrite the `Phase:` field of the ledger's first line, keeping its other fields, to `Phase: I4` once the spec holds no `[pending Q<n>` marker, and to `Phase: I6` after I5, then end.
- **`implement`, `verify`, `merge` and `close` are ship-plan's:** skip this skill's reads before I0 and go straight to the hand-over: with no `ship-plan ledger:` on this ledger's first line, I6; with one, invoke ship-plan with no argument, as I0's row for a ship-plan ledger does. ship-plan runs in its own Runner mode (its "Runner mode (ship-runner)" section) for the phase and task range the runner named, and its `RUNNER:` line ends this run's reply.
- **I0's live-run row** does not apply to this issue's own ledgers in this checkout: the runner's lock lets only one child run at a time, and the last write may be the previous child's. A ledger for the issue in any other checkout still counts.
- **Progress lines:** at each milestone write `Progress: <text>` to this ledger: `spec done <path>`, `batch of <n> sent`, `plan done <path>`.
- **The batch:** write `Progress: batch of <n> sent` before the `Waiting: batch …` line. That line stays the ledger's last line until the answers come; write nothing after it.
- **Blocked:** when nothing in the phase can go on and no question waits for the user (a stage that reports `blocked` with nothing to ask), write `Blocked: <reason>` to this ledger.
- **The final reply ends with exactly one line** `RUNNER: <phase-done|waiting|blocked|done> <text>`, and nothing after it: `phase-done` when the ledger's first line has moved to the next phase; `waiting` when an `Asked: … — pending` line or the `Waiting: batch …` line waits for the user; `blocked` with the reason of the `Blocked:` line; `done` when the issue is in status category Done and nothing ships (I0's first row).

## Red flags

| Thought | Reality |
|---|---|
| "I'll ask this one now, and the rest later" | One batch, at I3. After that: rule, park, or carry into the plan. |
| "A ledger changed a minute ago, another session holds it" | Not when its last line is `Waiting: batch …` and this run brings the answers. |
| "Brainstorming says to wait for approval of the design" | Invoking this skill is that approval. Write the `Ruling:` and continue. |
| "Should we deploy?" | Never a question. A follow-up in the Done comment. |
| "The issue says X, so X" | Verify it and quote the evidence. |
| "The branch name has a key, so that's the issue" | Only a key from the argument, or from a branch this skill's ledger shows it started. |
| "Two issues look close, I'll take the better one" | The user picks, in the issue question. |
| "No issue key, I'll create one in the config's project" | Ask the issue question first. Where it goes (where the tracker asks) and the related issue are the user's choice. |
| "This is small, it doesn't need an issue" | With a tracker, all work is tracked in an issue. The issue question has no "No issue" option here; only `Tracker: none` runs without one. |
| "I'll pass the issue key to ship-plan" | Pass the plan file path. The tracker's copy is converted and may be mangled. |
| "I'll start ship-plan's ledger for it" | Never. An existing ship-plan ledger means "resume", and the plan path would be read as answers. |
| "I'll assign the issue and move it to In Progress now" | ship-plan's section 1 does that when work starts. |
| "The main checkout is on another branch, I'll switch it" | Someone is working there. Use the worktree recipe. |
| "I'll open a docs worktree for the spec beside the code" | A stage cannot write there, and an early docs PR loses its approval. Hold the spec in the ledger directory (I2 step 3); ship-plan opens the docs PR after the merge, in this checkout. |
| "Worktree ready, run the tests" | Did you run the Prerequisites, copy the `Copy:` files, and check `Shared:`? |
| "The spec exists, but I'd design it differently" | Existing work counts as approved. Route per I0. |
| "It's quicker to write the spec or plan here" | The stages run as subagents so this session stays small and keeps one effort level. Dispatch them. |
| "Raise this session's effort for the spec" | That invalidates its prompt cache. The Spec stage sets its own effort. |
| "Small issue, but I'll give the spec Opus to be safe" | The `Size:` line picks the row. When in doubt the size is `standard`; a small-row stage that finds more returns `Resize:`. |
| "Let me double-check the stage's research" | That loads into this session what the stage kept out. Take its report; a gap goes back as a `revise` dispatch. |
| "No `## Evidence`, so I'll query production to be sure" | Only read-only sources the config names. Without them, the baseline is a reproduction. |
| "Queued, but this one question is quick" | Nobody is watching. Post it as an issue comment with the queue's answer line, and end the run. |
