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
after any of this skill's files, read its counterpart under
`.claude/ship-plan/ship-issue/` if it exists (`.claude/ship-plan/ship-issue/SKILL.md`
right after this file; `.claude/ship-plan/ship-issue/evidence.md` wherever
evidence.md is read, stages included). A `../ship-plan/…` file's counterpart is
in that skill's folder. An override line that widens what the run may do, or
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
checkout, batch, commits and ship-plan; by ship-plan's
"This session reads little itself" (its section "The run"), code, long logs and tracker or wiki pages go to an `Explore`
agent at the `Research` row. **Every Agent dispatch passes both `model` and
`effort`** from its role's `## Models` row (a research agent: `Research`,
default `sonnet`, `medium`); the hook refuses a dispatch missing either.

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

**A run is queued** when it was started by ship-queue as its child session
(`printenv SHIP_QUEUE_PARENT` prints a parent key; ship-queue's *Child sessions*
sets it) and that parent's ledger in this checkout
(`.superpowers/ship-queue/<parent>/ledger.md`) has a `Current: <KEY> started …`
line naming this run's issue, with no `Result: <KEY>` line after it. A leftover
queue ledger alone does not make a user-started run queued: it asks as unqueued.
Nobody watches. Everything above applies, except:

- **Ask nothing: never `AskUserQuestion`, never wait for a reply,** wherever this skill would ask (I1, the I3 batch, a later question). Ledger lines as unqueued (`Asked: … — pending`, `Parked:`, for I3 the `Waiting: batch …` line). Post the batch as one issue comment (the tracker's *Comment*): questions numbered, each with options, recommendation first, ending **"Answer with `/ship-queue <parent> <KEY>: <your answers>`."** (`<parent>`: the queue ledger's `Parent:`); the queue's resume form is `/ship-queue <parent> <KEY>: <answers>`. Do everything the answers do not block (the Spec stage and its commit), then end the run.
- **A question before the issue is read** (a tracker call failing at I1): write it to the ledger with the exact error; end the run.
- **I0's live-run row** skips this issue's ledgers in the queue ledger's `Checkout:` (the parent queue's). One in any other checkout still counts.
- **No session-end handoff** of its own: the queue writes one for the whole queue.
- **ship-plan** runs in its own queued mode (its "Queued mode (ship-queue)" section), found the same way.

## Runner mode (ship-runner)

**A run is in Runner mode** when the ship runner started it as a child:
`printenv SHIP_RUNNER` prints the runner's folder, `printenv SHIP_RUNNER_KEY`
the item key given to this child (the issue key, or with no issue the slug), and
that folder's `state.json` has `current` equal to that key. Take the key from
`SHIP_RUNNER_KEY`; never derive it. A `SHIP_RUNNER` without `SHIP_RUNNER_KEY`,
or whose `state.json` names another item or none, is no runner child. The
runner's prompt names the phase. Queued mode applies, except:

- **Answer line:** **"Answer in the session that started the run."** Answers arrive in a later runner prompt, after "The user's answers, copied exactly:". Rewrite each answered `Asked: … — pending` line in place, never as a second line (the runner counts lines ending `— pending`); then go on as I0 says for a resume with answers.
- **`Asked:` lines:** `Asked: <the question, its options, the recommendation first> — pending`, as in verify-and-fix's Runner mode; the watching session asks from them.
- **Never a worktree or another checkout** (section W, [worktree.md](worktree.md)): on `<base>`, clean, branch there, or `git switch <branch>` if this issue's branch exists (a resume); on this issue's branch, stay. Where W would create a worktree (checkout dirty or on another branch), write `Blocked: needs a new worktree — <reason>` (no ledger yet: in the `RUNNER:` line), end `RUNNER: blocked`.
- **Only the named phase, reading only its file:** `spec` is I0–I3 ([phase-spec.md](phase-spec.md)); `plan` is I4 and I5 ([phase-plan.md](phase-plan.md)). Set the first line's `Phase:` field (other fields kept) to `Phase: I4` once the spec holds no `[pending Q<n>` marker, to `Phase: I6` after I5, then end. **A `small` issue whose Spec stage wrote the plan** (last `Stage:` line `Stage: plan done <path> — combined with spec (small)`), with no `[pending Q<n>` marker and no batch waiting (no `Waiting: batch …`, no `Asked: … — pending`): `spec` goes on through I4 and I5 in the same child, reading [phase-plan.md](phase-plan.md), ending at `Phase: I6`; no plan child starts.
- **`implement`, `verify`, `merge` and `close` are ship-plan's:** skip this skill's reads before I0. No ship-plan ledger for this issue (none at the `ship-plan ledger:` path, none by I6's `Plan:`/`Issue:` match): I6. Else correct the field if it differs and invoke ship-plan with `--session` and no other argument, as I0's ship-plan-ledger row does; it runs in its Runner mode (its "Runner mode (ship-runner)" section) for the named phase and task range, and its `RUNNER:` line ends this run's reply.
- **I0's live-run row** skips this issue's ledgers in this checkout (the runner's lock runs one child at a time; the last write may be the previous child's), not those in other checkouts.
- **Progress lines:** at each milestone write `Progress: <text>`: `spec done <path>`, `batch of <n> sent` (before the `Waiting: batch …` line, which then stays last until the answers come), `plan done <path>`.
- **Blocked:** nothing in the phase can go on and no question waits (e.g. a stage `blocked` with nothing to ask): write `Blocked: <reason>`.
- **Never touch what the runner guards:** never write an `answers-*` file (answers come only from the user); never change `.claude/settings.json`, `.claude/settings.local.json`, `.mcp.json`, anything under `.claude/hooks/`, `.claude/agents/`, `.claude/commands/` or `.claude/skills/`, a `CLAUDE.md` or `CLAUDE.local.md`, or a script a settings hook names. If the work needs one changed, write `Blocked: <the change needed>` for the user to make and review.
- **The final reply ends with exactly one line,** nothing after it: `RUNNER: <phase-done|waiting|blocked|done> <text>`; `phase-done` when the first line moved to the next phase; `waiting` when an `Asked: … — pending` or `Waiting: batch …` line waits for the user; `blocked` with the `Blocked:` reason; `done` when the issue is in status category Done and nothing ships (I0's first row).

## Runner or session

With `## Runner` `Mode: runner` or `--runner`, unless `printenv SHIP_RUNNER` prints a folder (a runner child) or `--session` was given, the ship runner runs the phases; this session only watches and relays: read [../ship-plan/runner-session.md](../ship-plan/runner-session.md) and follow it with `start issue <KEY>` (an issue key, or the slug of an existing no-issue ledger). A run from a description alone (no key yet, or `Tracker: none` with no ledger yet) is session mode throughout: I6 (and I0's resume row) pass `--session` to ship-plan, and I3's answer line carries `--session`. Otherwise ignore this section.

- **`--session`:** the user answered with a session-mode run's answer line (I3): session mode, whatever `Mode:` says.
- **`--small`:** the user sizes the issue `small` (I1 says how): the light Spec stage writes spec and plan in one dispatch. Runner mode: `start issue '<KEY>' --small`.
- **`--runner`, `--session` and `--small` are flags only as whole words at the start or end of the argument** (`--session BILL-7 1A, 2B`, `BILL-7 1A, 2B --session`, `BILL-7 --small --runner`): read the argument without them (I0). Elsewhere, or inside a word, they are text and select nothing. With no flag, read the argument as if this section did not exist. A flag is never the issue key, slug, description or answers.

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
