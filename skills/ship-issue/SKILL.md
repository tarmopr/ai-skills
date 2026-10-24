---
name: ship-issue
description: Use when the user wants an issue, or a problem described in words, taken all the way from idea to a merged PR on a green base branch without supervision, including the design, spec and plan — "ship PROJ-123 end to end", "from issue to merge", "brainstorm, plan and ship this". Also use to resume such a run after a context compaction.
argument-hint: '[issue key | a description of the problem] [answers to a parked batch]'
allowed-tools:
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
  - mcp__plugin_engineering_linear__get_user
  - mcp__plugin_engineering_linear__get_issue
  - mcp__plugin_engineering_linear__list_issues
  - mcp__plugin_engineering_linear__list_comments
  - mcp__plugin_engineering_linear__list_issue_statuses
  - mcp__plugin_engineering_linear__list_teams
  - mcp__plugin_engineering_linear__list_projects
  - mcp__plugin_engineering_linear__save_issue
  - mcp__plugin_engineering_linear__save_comment
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

- **A repo set up for `ship`:** if `.claude/ship.md` exists and `.claude/ship-plan.md` does not, stop with one line: "This repo is set up for the removed `ship` skill: move `.claude/ship.md` to `.claude/ship-plan.md` and `.claude/ship/` to `.claude/ship-plan/`."
- **Host and tracker:** resolve `Host:` and `Tracker:` as [config-format.md](../ship-plan/config-format.md) says (`Host:` from the `origin` remote when absent; `Tracker:` from `## Jira` or `## Linear` when absent, else undecided until I1). Then read `../ship-plan/hosts/<host>.md` and, unless the tracker is `none` or undecided, `../ship-plan/trackers/<tracker>.md`. A reference below to an operation of the host or the tracker names the section of that name in those files.
- **No `origin` remote** (and no `Host:`): there is no host and no PR to open. Read no host file, skip the host's *Auth check*, *Find open PRs* and *Find the base-branch run* and every `git fetch origin`, and branch from `<base>` where this skill says `origin/<base>`. ship-plan then stops before its section 4 and says so in its report.

From the config, this skill reads: `## Repo` (`<base>`, branch pattern, `Host:`, `Tracker:`),
the tracker's section (`## Jira` or `## Linear`), `## CI`, `## Prerequisites`, `## UI testing`, `## Slack` (or
`.claude/ship-plan.local.md`), `## Evidence`, `## Worktree` and `## Models`. **When `.claude/ship-plan.md` is missing or a section must be drafted, read [config-drafting.md](../ship-plan/config-drafting.md).** Draft it as that file says, and put the draft at the top of the I3 batch.
Research, spec and plan proceed meanwhile; no gate runs until it is confirmed.
Once confirmed, commit it on the feature branch with a `Ruling:`.

**Two stages run as subagents:** the Spec stage (research, design, spec) and
the Plan stage, each from a fresh context at the model and effort of its
`## Models` row, by [stage-prompts.md](stage-prompts.md). This session never
changes its own model or effort, which would invalidate its prompt cache: start
it on Opus at high effort. It does the routing, the tracker, the checkout, the batch,
the commits and ship-plan.

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
of the run. It is a follow-up in the Done comment and **never a question**.

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
`Waiting: batch of <n>, sent <date>; heads: #<pr> <sha>, …`, with the head of every open PR the issue depends on, so a resumed run can see whether one moved while the batch waited (ORIG-8125: #158 moved from `5183f29` to `d530d43`). Each stage writes
`Stage: <spec|plan> <new|revise> dispatched <date>` before its dispatch and
`Stage: <spec|plan> done <path> — skills: <its Skills: line>` once its report is copied in.

ship-plan keeps its own ledger in `.superpowers/ship-plan/<branch>/`. **Never
create or write that file.** ship-plan treats an existing ledger as a resumed
run and reads its argument as answers.

**After a compaction, resume from the first line, not from memory.** Phase I6
or later: route through I0, which hands back to ship-plan.

## I0. Route: what already exists

**Read the argument first:**

- **Its first word names an existing `.superpowers/ship-issue/<dir>/`** (an issue key, or with no issue the slug) in this checkout or one `git worktree list` shows: this is a resume, and the rest of the argument is answers. Record each as `Asked: … — <answer>` and a `Ruling: user <date>`, then continue from the ledger's first line.
- **An issue key** (the tracker's *Issue keys*): that is the issue.
- **Anything else** is a description, with no key yet: go to I1.
- **No argument:** take the key (with no issue, the slug) from the current branch name, but only if this skill's ledger for that key exists in this checkout; otherwise ask the I1 question. Never take a key from a branch you did not start: it is someone else's work.

With a key, take the first matching row. The issue's status comes from the tracker's *Read an issue*; with no issue, the first row does not apply:

| Found | Go to |
|---|---|
| Issue in status category Done (done, canceled, duplicate) | Stop and report. Ship nothing. |
| **A live run:** a ship-plan or ship-issue ledger for it, in any checkout (`git worktree list` shows them), changed in the last 30 minutes (`stat -f %Sm <ledger>` on macOS, `stat -c %y <ledger>` on Linux), or in the last 2 hours with a last line saying it is waiting (a sleep, a CI watch; ship-plan's longest planned wait is 20 minutes). **Not live:** a ship-issue ledger whose last line is `Waiting: batch …` and this run brings the answers | Stop and report: another session holds it. Two sessions resuming the same run cause double reruns, merges and comments. Older than that: the session died. Resume, and write a `Lesson:`. |
| The issue's branch is checked out where this session cannot work: a worktree-isolated session, with the branch in the main checkout | Stop and report: "resume with `/ship-issue <KEY-n>` from a session in `<that checkout>`". Git does not allow the same branch in two worktrees. |
| A ship-plan ledger for the issue's branch, or an open PR for the issue (the host's *Find open PRs*: by search for `<KEY-n>`; with no issue, the branch's own PR) | Invoke ship-plan **with no argument**, or with the user's answers if this run was started with some. It resumes from its own ledger. |
| A committed plan for the issue, and the issue description already holds its `## Plan` | I6 |
| A committed plan, the issue not yet updated | I5 → I6 |
| This skill's ledger: its last `Stage:` line is `dispatched`, with no `done` after it (the session died during a stage) | Dispatch that stage again, same mode; it overwrites the file |
| A spec holding a `[pending Q<n>` marker | I3: the batch, or the answers this run brings |
| A spec with no plan | I4 |
| Anything less | I1 |

A spec or plan "for the issue" is a file under `docs/superpowers/specs/` or
`docs/superpowers/plans/` whose name contains the key (with no issue, the slug), or a spec held for a
docs PR: the `Spec:` path on the ledger's first line (I2 step 3). Do not redo approved work. An existing spec or plan counts as approved.

## I1. The issue

Every tracker call is made as the tracker's file says. A tracker call that fails is handled as the tracker's *Auth* says; the run then goes on with no issue, as with `Tracker: none`.

**When `Tracker:` is not `none`, or the tracker question is asked, read [templates-issue.md](../ship-plan/templates-issue.md).**

- **`Tracker:` undecided** (no `Tracker:`, no `## Jira`, no `## Linear`): ask "Which tracker does this repo use?" (templates-issue.md) **before anything else in I1, and wait for the answer.** Write it as `Tracker: <jira, linear or none>` in the config's `## Repo`, with the tracker's section drafted from the issue question (the tracker's *Where a new issue goes*), committed on the feature branch with the first commit this run makes (with `## Slack` when I3 asked too). A drafted config gets it inside the draft instead. Then read `../ship-plan/trackers/<tracker>.md`, unless the answer is `none`.
- **`Tracker: none`:** there is no issue and no issue question; the PR is the record. With no description given, ask "Describe the problem". Then go on with the slug (The ledger), and skip I5.
- **Issue key given:** the tracker's *Read an issue*: the issue with its comments and linked issues. Read the linked issues too.
- **Description given (no key):** ask the "Issue question" (templates-issue.md) **before continuing**, without the "No issue" option, and wait for the answer. Its candidates come from the tracker's *Find an issue*, and the places a new issue can go from the tracker's *Where a new issue goes*. Nothing else starts until the run has a key.
  - **An existing issue chosen:** continue as for a key given.
  - **A new issue:** create it as that question says (the chosen place and related issue), with two deliberate differences from "New issue": the description is only the template's problem paragraph, as the user described it (I5 adds the plan), and you set **no assignee and no status**. ship-plan's section 1 sets them when work starts.
- **Neither key nor description given:** ask first, with `AskUserQuestion`: "An existing issue (give the key)" or "Describe the problem". A description then goes through the issue question above.

These are the only questions asked before research.

Then choose the checkout (section W) before writing anything.

## I2. Research and spec: the Spec stage

1. **Branch,** once the issue key is known: `git switch -c <branch> origin/<base>` in the checkout chosen in section W (in a new worktree, from its detached `origin/<base>`), named by the config's `Branch:` pattern: `<type>/<KEY-n>-<slug>`, the key written as the tracker's *Issue keys* says (with no issue, `<type>/<slug>`). `<type>` is one of ship-plan's five (`feature`, `fix`, `docs`, `chore`, `refactor`), even when the config's pattern lists others such as `test`: ship-plan's pre-approved push patterns match only those five, and any other type makes every push prompt. Never a username prefix, and never the local base branch.
2. **Hand the issue over on disk.** Write `<ledger dir>/issue.md`: the issue as I1 read it (description, comments, linked issues), or the user's description. The stage reads it there and needs no tracker access. **For every open PR the issue names or links,** fetch its state now (the host's *Find open PRs*, a named PR's state, then `git fetch origin <its head branch>` and `git log --oneline origin/<base>..origin/<its head branch>`) and add it to `issue.md`: its head commit and the commits not yet on `<base>`. An issue written minutes earlier can already be stale: ORIG-8305's described #99 without the retry #99 had added eight minutes before. The same applies when this run creates the issue (I1): fetch the related PR's head right before writing its Context, and describe what the head holds, not what the PR's title says. **When the issue has a parent,** also list in `issue.md` the parent's sub-tasks that the tracker's *Read an issue* finds, where the tracker has them.
3. **Where the spec lives,** decided before the dispatch and written into the ledger's first line as `Spec: <path>`:
   - **The repo keeps docs and code in separate PRs** (its agent instructions say so, for example "Documentation and code changes go in separate PRs", or a standing answer does): the spec is **held** at `<ledger dir>/<yyyy-mm-dd>-<KEY-n>-<slug>-design.md`, git-ignored, and is never committed on the feature branch. ship-plan's close-out moves it to `docs/superpowers/specs/` in a docs PR once the code PR has merged (ship-plan section 7, step 3). Write `Ruling: spec held for a docs PR — <the quoted rule> — cost if wrong: one file move`.
   - **Otherwise:** `<checkout>/docs/superpowers/specs/<yyyy-mm-dd>-<KEY-n>-<slug>-design.md`, committed on the feature branch.
   - **Never a second worktree for the spec or the docs.** A worktree-isolated session's stage cannot write to one or enter it (ORIG-8202), and a docs PR opened before the code PR merges falls behind the base branch and loses its approval (ORIG-8119). The docs branch is made later, in this same checkout.
4. **Dispatch the Spec stage** ([stage-prompts.md](stage-prompts.md), mode `new`, with `<spec path>` from step 3) with the `Spec stage` row of `## Models` (default `opus`, `xhigh`). It researches (code, history, the running system, read-only by [evidence.md](evidence.md)), records the baseline, drafts the approaches, rules where the confidence test passes, and writes the spec with each open choice marked `[pending Q<n>: …]`.
5. **Meanwhile, check the environment** for the later ship-plan run yourself: the Prerequisites (can they run in the chosen checkout?), auth (the host's *Auth check*; the tracker's *Auth*, unless the tracker is `none`; any auth check a Prerequisites row or `## Evidence` names), and **the base branch's last CI runs**: the host's *Find the base-branch run* (the base branch's last runs). A red base branch from someone else's work will fail this PR's checks too; it goes in the spec (step 6) and ship-plan section 5, step 2 says how the run handles it. A command that would write to a shared environment goes in the batch instead.
6. **Take the report in.** `Status:` other than `done`: a wrong checkout is a bug in this run (fix the path and dispatch again); `blocked` goes in the batch. Otherwise check its `Skills:` line names the stage's required sub-skill (`superpowers:brainstorming` for the Spec stage in mode `new`, `superpowers:writing-plans` for the Plan stage); if it does not, write `Lesson: <stage> stage did not call <skill> — the stage prompt's REQUIRED SUB-SKILL line`. Then copy its `Ruling:`, `Parked:` and `Lesson:` lines into the ledger, its `Q<n>` lines into the I3 batch, and the step 5 findings into the spec. Check the file it names exists, then commit the spec on the branch, unless step 3 held it for a docs PR. Never re-check its research yourself: that would load into this session the context the stage exists to keep out of it.

## I3. The one question batch

Collect every question the rest of the run could need, then ask them together.

1. **Design decisions:** the Spec stage's `Q<n>` lines, as it wrote them. It already applied ship-plan's confidence test (section 3); don't re-rule them here.
2. **What ship-plan's pre-flight would ask** (ship-plan section 0, steps 1, 6 and 7, and its authorization section): a draft config; the exact allow lines (`Bash(<command>)`) for every gate and Prerequisites command, in a permission mode that prompts; hosted sign-ins for `## UI testing`; a drafted tracker section (`## Jira` or `## Linear`); **the Slack channel when neither the config nor `.claude/ship-plan.local.md` has `## Slack`** (ship-plan section 0, step 6: same options; the answer is written to the committed config only: commit `## Slack` to the config on the branch with the next commit this run makes); and anything on the "does not authorize" list. Ask them now, so ship-plan's pre-flight has nothing left.
3. **Environment decisions** (section W) that could not be settled.
4. **Standing answers** remove questions. Apply them first.

Ask with `AskUserQuestion`: at most 4 questions, the recommended option first,
marked "(Recommended)". If there are more than 4, or they need free text, send
one numbered message. End it with: **"Answer with `/ship-issue <KEY-n>
<your answers>`. I'm carrying on with everything that doesn't depend on it."**
That form restarts the skill, renews its pre-approval (a plain reply clears
it), and resumes from the ledger. Carry on meanwhile with everything the
answers don't block. **Empty batch: ask nothing.** Each answer becomes a
`Ruling: user <date>` line. Answers to `Q<n>` lines go into the spec through
the Spec stage in mode `revise` (same `## Models` row), never by editing the
spec here; commit its result, unless the spec is held for a docs PR (I2 step 3).

**As soon as the answers arrive, before the revise stage,** update the issue
(skipped with no issue); I5 adds only the plan:

- the tracker's *Comment*: the questions and the answers, one line each.
- **An answer that makes this issue wait for another issue or PR** ("wait for #99", "after ORIG-8101 merges"): link the two at once, as the tracker's *Link two issues* says for an issue that waits. A PR without its own issue: link the issue its branch or title names. Say in the comment what this issue waits for.

The user reads the issue to see where the run stands; a dependency that is
only in the ledger is invisible to them.

**A question found after the batch** is itself a lesson. Rule on it if the
confidence test passes. Otherwise, if it blocks the spec or plan, ask it
alone, with the same answer line. If it doesn't block, carry it into ship-plan
as `[needs a decision]` in the plan. Either way, write a `Lesson:` naming the
research step that would have caught it.

## I4. Plan: the Plan stage

Starts once the spec holds no `[pending Q<n>` marker.

1. **Dispatch the Plan stage** ([stage-prompts.md](stage-prompts.md)) with the `Plan stage` row of `## Models` (default `opus`, `high`). It gets the spec path, not this conversation: a gap it finds is a gap in the spec. It writes `docs/superpowers/plans/<yyyy-mm-dd>-<KEY-n>-<slug>.md` with the **Scenarios** table for verify-and-fix and the **Close-out notes for ship-plan**, and leaves the `From ship-issue` block empty.
2. **Take the report in** as in I2 step 6. Its `Parked:` lines are ship-plan's to ask at close-out; they stay `[needs a decision]` in the plan.
3. **Fill the `From ship-issue` block** with every `Ruling:`, `Parked:`, `Asked:` and `Lesson:` line from this skill's ledger, verbatim. **When the spec is held for a docs PR** (I2 step 3), add one line for ship-plan's close-out (its section 7, step 3): `Docs PR: <held spec path> → docs/superpowers/specs/<file name>; also <each other docs change the spec's delivery section lists, or "nothing else">`. Commit the plan on the branch unless `git check-ignore -q <plan path>` says it is ignored: ship-plan's pre-flight parks a dirty tree it did not make.

## I5. Tracker

Skipped with no issue (`Tracker: none`): ship-plan puts the plan in the PR body.

1. Append the plan to the description as templates-issue.md's "Plan appended" says, with the tracker's *Append the plan*: it holds what is appended, the size limit and its fallback. Never overwrite what the user wrote.
2. The tracker's *Comment*: the rulings made so far, and the batch answers. Links between issues are made as the tracker's *Link two issues* says (I3).
3. **The local plan file is authoritative.** The tracker's conversion of markdown can reflow lists, code and links. ship-plan always gets the file, never the issue text.

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
| "Let me double-check the stage's research" | That loads into this session what the stage kept out. Take its report; a gap goes back as a `revise` dispatch. |
| "No `## Evidence`, so I'll query production to be sure" | Only read-only sources the config names. Without them, the baseline is a reproduction. |
