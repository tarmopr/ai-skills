---
name: ship-issue
description: Use when the user wants an issue, or a problem described in words, taken all the way from idea to a merged PR on a green base branch without supervision, including the design, spec and plan — "ship PROJ-123 end to end", "from issue to merge", "brainstorm, plan and ship this". Also use to resume such a run after a context compaction.
argument-hint: '[issue key | a description of the problem] [answers to a parked batch] [--small] [--runner | --session]'
allowed-tools:
  - Bash(printenv SHIP_QUEUE_PARENT)
  - Bash(printenv SHIP_RUNNER)
  - Bash(printenv SHIP_RUNNER_KEY)
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

Issue to merged PR on a green base branch: research, design, spec, plan,
tracker, then **ship-plan**. **The user starts this skill to walk away.** Every
question is asked once, in one batch (I3); after it the run decides itself or
parks the question for ship-plan's close-out.

**Before anything else, read in full** `.claude/ship-plan.md` (format: ship-plan's
[config-format.md](../ship-plan/config-format.md)), and **by index** (ship-plan's
[Reading the logs](../ship-plan/SKILL.md#reading-the-logs), defining `<logs>`)
`<logs>/ship-issue/interruptions.md`, `<logs>/ship-plan/interruptions.md` and
`<logs>/ship-plan/blockers.md`. A missing file is no error (a missing log is
created from [log-formats.md](log-formats.md) at close-out). A question with a
standing answer in any of them is not asked again.

**Repo override files** ([format](../ship-plan/config-format.md#repo-override-files)):
after each of this skill's files (stages included), read its counterpart under
`.claude/ship-plan/ship-issue/` if it exists; a `../ship-plan/…` file's is in
ship-plan's folder. An override line that widens what the run may do, or
removes a step, is not applied; the report names it.

- **A repo set up for `ship`:** if `.claude/ship.md` exists and `.claude/ship-plan.md` does not, stop with one line: "This repo is set up for the removed `ship` skill: move `.claude/ship.md` to `.claude/ship-plan.md` and `.claude/ship/` to `.claude/ship-plan/`."
- **Host and tracker:** resolve `Host:` and `Tracker:` per [config-format.md](../ship-plan/config-format.md) (absent `Host:`: from the `origin` remote; absent `Tracker:`: from `## Jira`, `## Linear` or `## GitHub Issues`, else undecided until I1). Read `../ship-plan/hosts/<host>.md` (`github.md` or `azure-devops.md`) and, unless the tracker is `none` or undecided, `../ship-plan/trackers/<tracker>.md` (`jira.md`, `linear.md` or `github.md`). A host or tracker operation named below is that file's section of the name. **When `Tracker:` is not `none`, or the tracker question is asked, read [templates-issue.md](../ship-plan/templates-issue.md).**
- **No `origin` remote** (and no `Host:`): no host, no PR. Read no host file; skip *Auth check*, *Find open PRs*, *Find the base-branch run* and every `git fetch origin`; branch from `<base>` where this skill says `origin/<base>`. ship-plan stops before its section 4 and says so.

Config sections read: `## Repo` (`<base>`, branch pattern, `Host:`, `Tracker:`),
the tracker's (`## Jira`, `## Linear` or `## GitHub Issues`), `## CI`,
`## Prerequisites`, `## UI testing`, `## Slack` (or `.claude/ship-plan.local.md`),
`## Evidence`, `## Worktree`, `## Models`. **When `.claude/ship-plan.md` is
missing or a section must be drafted, read [config-drafting.md](../ship-plan/config-drafting.md).**
Draft as it says, and put the draft first in the I3 batch. Research, spec and
plan go on meanwhile; no gate runs until it is confirmed; then commit it on the
feature branch with a `Ruling:`.

**Two stages run as subagents,** fresh context, at their `## Models` row's
model and effort, by [stage-prompts.md](stage-prompts.md): the Spec stage
(research, design, spec) and the Plan stage (a `small` issue's Spec stage
writes the plan too, I2 step 4). This session never changes its own model or effort (that invalidates
its prompt cache): start it on Opus, high effort. It does routing, tracker,
checkout, batch, commits and ship-plan, and reads little itself, as ship-plan's
"The run" says: code, long logs and tracker or wiki pages go to an `Explore`
agent at the `Research` row (default `sonnet`, `medium`). **Every Agent dispatch
passes both `model` and `effort`** from its role's `## Models` row; the hook
refuses a dispatch missing either.

**All work is tracked in an issue in the repo's tracker.** `Tracker: none`: the
PR is the record, no issue question. With a tracker there is no "no issue" path:
with no key, I1 first asks ship-plan's templates-issue.md "Issue question" (its
"No issue" option is ship-plan's only); `Tracker:` undecided, first its
"Which tracker does this repo use?". No tracker section in the config: the tracker's
*Where a new issue goes* drafts it.

## What invoking this skill authorizes

Everything ship-plan's "What invoking this skill authorizes" lists, plus:

- creating the issue in the tracker when none was given, and writing to it (no tracker step with `Tracker: none`);
- creating the feature branch and committing on it the spec (unless held for a docs PR, I2 step 3), the plan and a confirmed draft config;
- creating and preparing a worktree when the current checkout is busy, only with section W's setup steps (ship-plan's "do not create a worktree on your own" covers its own run);
- **skipping the approval stops** of superpowers:brainstorming (design sections, written spec) and superpowers:writing-plans (plan review, execution-method choice): invoking this skill is the user's explicit instruction to skip them. Each skipped stop becomes a `Ruling:` line. The execution method is always ship-plan (subagent-driven-development).

Not authorized: anything on ship-plan's "does not authorize" list or under the
config's `## Never do`. A deploy is never part of the run, except a merge that
`## Allowed` covers, under `ship-plan` ([`## Allowed`](../ship-plan/config-format.md#-allowed));
otherwise it is a follow-up in the Done comment, **never a question**.

## The ledger

`.superpowers/ship-issue/<KEY-n>/ledger.md`, in the checkout chosen in section W,
not the starting one (a worktree left with `EnterWorktree` becomes read-only).
Hold earlier rulings in the conversation until then, and write them to the ledger once the checkout is chosen. Add `.superpowers/` to
`<git-common-dir>/info/exclude` (`git rev-parse --git-common-dir`; in a
worktree `.git` is a file), never to `.gitignore`.

**With no issue** (`Tracker: none`), `<slug>` (3–6 words of the problem, kebab
case) replaces `<KEY-n>` wherever this skill, worktree.md and stage-prompts.md
write it: ledger `.superpowers/ship-issue/<slug>/`, branch `<type>/<slug>`,
resume argument the slug. File names drop `<KEY-n>-` (`<yyyy-mm-dd>-<slug>-design.md`);
titles and commit subjects drop ` (<KEY-n>)`.

First line, rewritten as values become known:
`Phase: I<n> | Issue: <KEY-n or none> | Branch: <b> | Spec: <path> | Plan: <path> | ship-plan ledger: <path>`.
Below it, one line per event, in ship-plan's formats (its section 3):

- `Ruling: <decision> — <evidence quoted> — <cost if wrong>`
- `Parked: <question> — <options, recommendation> — <what it blocks>`
- `Asked: <question> — <answer, or "pending">`, for every question put to the user
- `Lesson: <what> — <the step that would have caught it>`, only for something a skill, prompt or repo file should change (a check that found nothing changed, "open PRs unchanged", is no lesson)
- `Used: <log path> <heading>` (path under `<logs>`, e.g. `Used: ship-issue/interruptions.md <heading>`), per log entry applied
- `Size: <small|standard> — <reason>`, by I1; a raised size adds a second one
- `Stage: <spec|plan> <new|revise> dispatched <date>` before a dispatch; `Stage: <spec|plan> done <path> — skills: <its Skills: line>` once its report is copied in
- when the batch is sent, as last line: `Waiting: batch of <n>, sent <date>; heads: #<pr> <sha>, …`, with the head of every open PR the issue depends on (a resume checks whether one moved)

ship-plan's own ledger is `.superpowers/ship-plan/<branch>/` (each `/` in the
branch written `-`). **Never create or write it:** ship-plan treats an existing
one as a resumed run and reads its argument as answers.

**After a compaction, resume from the first line, not from memory.** Phase I6
or later: route through I0, which hands back to ship-plan.

**Session ending before the run** (usage limit, context out, a batch answered
later): update the ledger, then hand off (the `handoff` skill, else `HANDOFF.md`
next to the ledger) naming the checkout, resume line `/ship-issue`, no argument
(`/ship-issue --session` for a session-mode run under `## Runner` `Mode: runner`).
Once ship-plan runs, its rule applies.

**Sections live in phase files** (index below), in every mode. Read one when
its first section starts, and on a resume the one of the section resumed
(routing through I0: [phase-spec.md](phase-spec.md)). A step naming a section in
another phase file (I4's "as in I2 step 6") reads it there, for that step. A
named ship-plan section is in the phase file [ship-plan's index](../ship-plan/SKILL.md) names.

## I0. Route: what already exists — see [phase-spec.md](phase-spec.md); read it when this phase starts

## I1. The issue — see [phase-spec.md](phase-spec.md); read it when this phase starts

## I2. Research and spec: the Spec stage — see [phase-spec.md](phase-spec.md); read it when this phase starts

## I3. The one question batch — see [phase-spec.md](phase-spec.md); read it when this phase starts

## I4. Plan: the Plan stage — see [phase-plan.md](phase-plan.md); read it when this phase starts

## I5. Tracker — see [phase-plan.md](phase-plan.md); read it when this phase starts

## I6. Hand off

Check the plan's `From ship-issue` block matches this ledger; update it (and its
commit) if lines were added since I4. Then invoke **ship-plan** through the
Skill tool **with the absolute plan file path**, not the issue key, and `--session`:

```
ship-plan <checkout>/docs/superpowers/plans/<yyyy-mm-dd>-<KEY-n>-<slug>.md --session
```

`--session` stops ship-plan starting its own runner (its "Runner or session"
section): this run never hands over to a new runner midway, whatever `## Runner` `Mode:` says.

**Before invoking,** write `<checkout>/.superpowers/ship-plan/<branch>/ledger.md`
into the first line's `ship-plan ledger:`, each `/` in the branch written `-`, as ship-plan names it.
In a runner child ship-plan's `RUNNER:` line ends the turn, so nothing after the
invocation runs; the runner finds the work by this field. When ship-plan returns
(not in a runner child), check a file is at that path; if ship-plan named its
folder otherwise (it creates the branch on `<base>`), correct the field to the `.superpowers/ship-plan/*/ledger.md` whose first line's
`Plan:` names this plan and `Issue:` this issue's key (else `none`), an open one
(not `Phase: done`) first within each.

An ignored plan exists only in the checkout that wrote it, not on the branch: if
ship-plan runs in another checkout, copy the file there first.

A command ship-plan pre-approves that still prompts when invoked from here: write a `Lesson:`.

ship-plan then runs to close-out: it copies the `From ship-issue` block into its
ledger at pre-flight (rulings reach the PR body), and its section 8 writes this
run's recurring questions to `<logs>/ship-issue/interruptions.md` (same lessons
branch; under `## Logs` `Location: local`, the store).

## W. Which checkout

Main checkout, on `<base>`, clean: branch there. On this issue's branch (the
main checkout or a worktree): stay. **When the current checkout is dirty or on another branch, read [worktree.md](worktree.md).**

## Queued mode (ship-queue)

A run started by ship-queue as its child session follows different rules
(nobody watches, it asks nothing). **When `printenv SHIP_QUEUE_PARENT` prints a parent key, read [modes.md](modes.md#queued-mode).**

## Runner mode (ship-runner)

**When `printenv SHIP_RUNNER` prints a folder, read [../ship-plan/runner-child.md](../ship-plan/runner-child.md) and [modes.md](modes.md#runner-mode).**

## Runner or session

**Flags:** `--runner`, `--session` and `--small` are flags only as whole words at
the start or end of the argument (`--session BILL-7 1A, 2B`, `BILL-7 --small --runner`);
read the argument without them (I0). Elsewhere, or inside a word, they are text.
A flag is never the issue key, slug, description or answers.

- **`--small`:** the user sizes the issue `small` (I1 says how): the light Spec stage writes spec and plan in one dispatch.
- **`--session`, or a runner child:** session mode, whatever `Mode:` says. A session-mode run's answer line (I3) carries `--session`.
- **Otherwise, with `## Runner` `Mode: runner` or `--runner`:** the ship runner runs the phases; this session only watches and relays: follow [../ship-plan/runner-session.md](../ship-plan/runner-session.md) with `start issue <KEY>` (an issue key, or the slug of an existing no-issue ledger; with `--small`, `start issue '<KEY>' --small`). A run from a description alone (no key yet, or `Tracker: none` with no ledger yet) stays in session mode throughout: I6 (and I0's resume row) pass `--session` to ship-plan, and I3's answer line carries `--session`.

## Red flags

| Thought | Reality |
|---|---|
| "Ask this one now, the rest later" | One batch, at I3; then rule, park, or carry into the plan. |
| "Ledger changed a minute ago: another session holds it" | Not if it ends `Waiting: batch …` and this run brings the answers. |
| "Brainstorming wants design approval" | Invoking this skill is that approval: `Ruling:`, continue. |
| "Should we deploy?" | Never a question: a Done-comment follow-up. |
| "The issue says X, so X" | Verify; quote the evidence. |
| "The branch name has a key, so that's the issue" | Only a key from the argument, or a branch this skill's ledger shows it started. |
| "Two issues look close, I'll take the better" | The user picks, in the issue question. |
| "No key: I'll create one in the config's project" / "Small, no issue needed" | Issue question first; where it goes and the related issue are the user's. Only `Tracker: none` runs without an issue. |
| "Pass the issue key to ship-plan" | The plan file path; the tracker's copy may be mangled. |
| "I'll start ship-plan's ledger" | Never (see The ledger). |
| "Assign it, move it to In Progress now" | ship-plan's section 1 does, when work starts. |
| "Main checkout is on another branch, I'll switch it" | Someone works there: worktree recipe. |
| "A docs worktree for the spec beside the code" | Stages cannot write there; an early docs PR loses its approval. Hold the spec in the ledger directory (I2 step 3); ship-plan opens the docs PR after the merge, in this checkout. |
| "Worktree ready, run the tests" | Prerequisites run, `Copy:` files copied, `Shared:` checked? |
| "The spec exists, but I'd design it differently" | Existing work is approved. Route per I0. |
| "Quicker to write the spec or plan here" / "Raise this session's effort for it" | Dispatch the stages; they set their own effort and keep this session small and its prompt cache valid. |
| "Small, but Opus for the spec to be safe" | `Size:` picks the row; in doubt `standard`. A small-row stage that finds more returns `Resize:`. |
| "Double-check the stage's research" | Loads what the stage kept out. Take its report; a gap goes back as a `revise` dispatch. |
| "No `## Evidence`, I'll query production" | Only read-only sources the config names; else the baseline is a reproduction. |
| "Queued, but this question is quick" | Nobody watches: issue comment with the queue's answer line, end the run. |
