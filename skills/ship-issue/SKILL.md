---
name: ship-issue
description: Use when the user wants a Jira issue, or a problem described in words, taken all the way from idea to a merged PR on a green base branch without supervision, including the design, spec and plan — "ship PROJ-123 end to end", "from issue to merge", "brainstorm, plan and ship this". Also use to resume such a run after a context compaction.
argument-hint: '[Jira issue key | a description of the problem] [answers to a parked batch]'
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
---

# Ship an issue

One run takes an issue from nothing to a merged PR on a green base branch:
research, design, spec, plan, Jira, then **ship-plan** for the rest. **The user
starts this skill so they can walk away.** Every question is asked once, in one
batch (I3). After that the run decides for itself or parks the question for
ship-plan's close-out.

**Before anything else, read in full:** the repo's `.claude/ship-plan.md`
(ship-plan's [config-format.md](../ship-plan/config-format.md)),
`.claude/ship-issue/interruptions.md`, `.claude/ship-plan/interruptions.md`
and `.claude/ship-plan/blockers.md`. A missing file is not an error; a missing
log is created from [log-formats.md](log-formats.md) at close-out. A question
with a standing answer in any of them is not asked again.

From the config, this skill reads: `## Repo` (`<base>`, branch pattern),
`## Jira`, `## CI`, `## Prerequisites`, `## UI testing`, `## Slack` (or
`.claude/ship-plan.local.md`), `## Evidence` and `## Worktree`. **No config:** draft it, as ship-plan's config-format.md says
("Drafting a missing config"), and put the draft at the top of the I3 batch.
Research, spec and plan proceed meanwhile; no gate runs until it is confirmed.
Once confirmed, commit it on the feature branch with a `Ruling:`.

**All work is tracked in a Jira issue.** There is no "no Jira" path: with no
issue key, I1 asks ship-plan's templates.md "Jira: issue question" (without its
"No Jira issue" option) before anything else. With no `## Jira` in the config,
that question's "Site" rule finds the site and drafts the section.

## What invoking this skill authorizes

Everything ship-plan's "What invoking this skill authorizes" lists, plus:

- creating the Jira issue when none was given, and writing to it;
- creating the feature branch and committing the spec, the plan and a confirmed draft config on it;
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

First line, rewritten as each value becomes known:
`Phase: I<n> | Issue: <KEY-n or none> | Branch: <b> | Spec: <path> | Plan: <path> | ship-plan ledger: <path>`.
Below it, one line per event, in ship-plan's formats (its section 3):
`Ruling: <decision> — <evidence quoted> — <cost if wrong>`, `Parked: <question>
— <options, recommendation> — <what it blocks>`, `Asked: <question> — <answer, or
"pending">` for every question put to the user, and `Lesson: <what> — <the
step that would have caught it>`. When the batch is sent, the last line is
`Waiting: batch of <n>, sent <date>`.

ship-plan keeps its own ledger in `.superpowers/ship-plan/<branch>/`. **Never
create or write that file.** ship-plan treats an existing ledger as a resumed
run and reads its argument as answers.

**After a compaction, resume from the first line, not from memory.** Phase I6
or later: route through I0, which hands back to ship-plan.

## I0. Route: what already exists

**Read the argument first:**

- **Its first word names an existing `.superpowers/ship-issue/<dir>/`** (an issue key) in this checkout or one `git worktree list` shows: this is a resume, and the rest of the argument is answers. Record each as `Asked: … — <answer>` and a `Ruling: user <date>`, then continue from the ledger's first line.
- **An issue key:** that is the issue.
- **Anything else** is a description, with no key yet: go to I1.
- **No argument:** take the key from the current branch name, but only if this skill's ledger for that key exists in this checkout; otherwise ask the I1 question. Never take a key from a branch you did not start: it is someone else's work.

With a key, take the first matching row:

| Found | Go to |
|---|---|
| Issue in status category Done (done, canceled, duplicate) | Stop and report. Ship nothing. |
| **A live run:** a ship-plan or ship-issue ledger for it, in any checkout (`git worktree list` shows them), changed in the last 30 minutes (`stat -f %Sm <ledger>` on macOS, `stat -c %y <ledger>` on Linux), or in the last 2 hours with a last line saying it is waiting (a sleep, a CI watch; ship-plan's longest planned wait is 20 minutes). **Not live:** a ship-issue ledger whose last line is `Waiting: batch …` and this run brings the answers | Stop and report: another session holds it. Two sessions resuming the same run cause double reruns, merges and comments. Older than that: the session died. Resume, and write a `Lesson:`. |
| The issue's branch is checked out where this session cannot work: a worktree-isolated session, with the branch in the main checkout | Stop and report: "resume with `/ship-issue <KEY-n>` from a session in `<that checkout>`". Git does not allow the same branch in two worktrees. |
| A ship-plan ledger for the issue's branch, or an open PR for the issue (`gh pr list --state open --search "<KEY-n>"`) | Invoke ship-plan **with no argument**, or with the user's answers if this run was started with some. It resumes from its own ledger. |
| A committed plan for the issue, and the issue description already holds its `## Plan` | I6 |
| A committed plan, Jira not yet updated | I5 → I6 |
| A spec with no plan | I4, step 3 |
| Anything less | I1 |

A spec or plan "for the issue" is a file under `docs/superpowers/specs/` or
`docs/superpowers/plans/` whose name contains the key. Do not redo approved work. An existing spec or plan counts as approved.

## I1. The issue

Every Jira call passes the config's `Site:` as `cloudId`.

- **Issue key given:** `getJiraIssue` with `view: "evidence"` (it includes linked issues), and its comments (`executeRead` with `listJiraIssueComments`; `discover` "list comments on a Jira issue" if that name is refused). Read the linked issues too.
- **Description given (no key):** ask ship-plan's templates.md "Jira: issue question" **before continuing**, without the "No Jira issue" option, and wait for the answer. Nothing else starts until the run has a key.
  - **An existing issue chosen:** continue as for a key given.
  - **A new issue:** create it as that question says (the chosen project, epic and related issue), with two deliberate differences from "Jira: new issue": the description is only the template's problem paragraph, as the user described it (I5 adds the plan), and you set **no assignee and no transition**. ship-plan's section 1 sets them when work starts.
- **Neither key nor description given:** ask first, with `AskUserQuestion`: "An existing Jira issue (give the key)" or "Describe the problem". A description then goes through the issue question above.

These are the only questions asked before research.

Then choose the checkout (section W) before writing anything.

## I2. Research

Before designing, confirm the problem is real and find its edges. Every claim
in the spec quotes its evidence: code with `file:line`, a log count, a
measured response. When the issue asserts something, verify it. Don't copy it.
Research writes nothing outside the checkout chosen in W, and nothing to any
shared environment.

1. **Code:** read the flow end to end. Find every caller of what will change, not only the one the issue names.
2. **History:** `git log -S'<string>' --format='%h %ad %s' --date=short -- <file>` shows when and why the code arrived.
3. **The running system,** read-only, following [evidence.md](evidence.md) and the config's `## Evidence`. **Record a baseline that will change when the fix lands.** If the behaviour can be seen on a deployed environment, the baseline is a measured response, and it becomes an acceptance check that needs no sign-in. If it can't, or `## Evidence` is absent, the baseline is a reproduction (input, observed output, expected output). The failing test that captures it is the plan's first task, not research.
4. **Environment for the later ship-plan run:** the Prerequisites (can they run in the chosen checkout?), auth (`gh auth status`; `atlassianUserInfo` when Jira is configured; any auth check a Prerequisites row or `## Evidence` names), and **the base branch's last CI runs**: `gh run list --branch <base> --workflow <config Workflow> --limit 3`. A red base branch from someone else's work will fail this PR's checks too; record it in the spec now (ship-plan section 5, step 2 says how the run handles it).

A command that would write to a shared environment goes in the batch instead.

## I3. The one question batch

Collect every question the rest of the run could need, then ask them together.

1. **Design decisions.** Draft the 2–3 approaches the way brainstorming does, with a recommendation. Then apply ship-plan's confidence test (section 3) to each open choice. A choice that passes becomes a `Ruling:`. A choice that fails goes into the batch. Fails are: it widens access, it changes money, nothing quotable points one way, it cannot be undone by a follow-up commit, or it is on the "does not authorize" list.
2. **What ship-plan's pre-flight would ask** (ship-plan section 0, steps 1, 6 and 7, and its authorization section): a draft config; the exact allow lines (`Bash(<command>)`) for every gate and Prerequisites command, in a permission mode that prompts; hosted sign-ins for `## UI testing`; a drafted `## Jira` section; **the Slack channel when neither the config nor `.claude/ship-plan.local.md` has `## Slack`** (ship-plan section 0, step 6: same options; write the local file when the answer comes, and commit `## Slack` to the config on the branch with the next commit I4 makes); and anything on the "does not authorize" list. Ask them now, so ship-plan's pre-flight has nothing left.
3. **Environment decisions** (section W) that could not be settled.
4. **Standing answers** remove questions. Apply them first.

Ask with `AskUserQuestion`: at most 4 questions, the recommended option first,
marked "(Recommended)". If there are more than 4, or they need free text, send
one numbered message. End it with: **"Answer with `/ship-issue <KEY-n>
<your answers>`. I'm carrying on with everything that doesn't depend on it."**
That form restarts the skill, renews its pre-approval (a plain reply clears
it), and resumes from the ledger. Carry on meanwhile with everything the
answers don't block. **Empty batch: ask nothing.** Each answer becomes a
`Ruling: user <date>` line and is written into the spec.

**A question found after the batch** is itself a lesson. Rule on it if the
confidence test passes. Otherwise, if it blocks the spec or plan, ask it
alone, with the same answer line. If it doesn't block, carry it into ship-plan
as `[needs a decision]` in the plan. Either way, write a `Lesson:` naming the
research step that would have caught it.

## I4. Spec and plan

1. **Branch,** once the issue key is known: `git switch -c <branch> origin/<base>` in the checkout chosen in section W (in a new worktree, from its detached `origin/<base>`), named by the config's `Branch:` pattern: `<type>/<KEY-n>-<slug>`, the key upper case so GitHub for Jira links it. Never a username prefix, and never the local base branch.
2. **REQUIRED SUB-SKILL:** superpowers:brainstorming, for its design sections, spec format and self-review. Always write a spec, even when brainstorming classifies the change as bounded, because ship-plan needs a plan and the plan argues from the spec. The classification sets the length: a bounded change gets a page, not a design document. Its "no spec file" and its approval gates are overridden by this skill, and each is recorded as a `Ruling:`. The spec includes the **evidence**, the **decisions and who made them**, what is **out of scope**, and **acceptance**, with the baseline from I2.3. Save it to `docs/superpowers/specs/<yyyy-mm-dd>-<KEY-n>-<slug>-design.md` and commit it on the branch.
3. **REQUIRED SUB-SKILL:** superpowers:writing-plans. Save to `docs/superpowers/plans/<yyyy-mm-dd>-<KEY-n>-<slug>.md`. Commit it on the branch unless `git check-ignore -q <plan path>` says it is ignored: ship-plan's pre-flight parks a dirty tree it did not make. Next to the skill's required header, the plan also needs:
   - a **Scenarios** table for verify-and-fix: unit, local, and (with `## Evidence`) deployed-environment rows, with the check from I2.3;
   - **Close-out notes for ship-plan**: `Pre-flight questions: none` (or the few that remain), the follow-ups (the deploy), a PR title with ` (<KEY-n>)`, and a **`From ship-issue`** block holding every `Ruling:`, `Parked:`, `Asked:` and `Lesson:` line from this skill's ledger, verbatim;
   - never a PR number in text written before the PR exists. Cite the issue key.

## I5. Jira

1. Append to the description as ship-plan's templates.md "Jira: plan appended" says (read as HTML, append, write back as HTML; never as markdown, never overwriting what the user wrote). Add the `## Plan` section from "Jira: new issue", then `## Done when`, then `## Full plan` with the plan text.
2. `addOrEditJiraIssueComment`: the rulings made so far, and the batch answers.
3. **The local plan file is authoritative.** Jira's conversion of markdown can reflow lists, code and links. ship-plan always gets the file, never the issue text.

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

ship-plan must run where the repo's untracked setup exists: installed
dependencies and the files the config's `## Worktree` `Copy:` lists.

| Where this session is | Action |
|---|---|
| Main checkout, on `<base>`, clean | Branch there. |
| Main checkout, on this issue's branch | Stay. |
| Main checkout, on another branch or dirty (another agent or the user is working) | New worktree (recipe). Never switch, stash or commit someone else's tree, and never run its tests. |
| A worktree on this issue's branch | Stay. |
| A worktree holding other work | New worktree (recipe). Don't rename or reuse this one. |

From a worktree-isolated session, git cannot read the main checkout: `git -C`
is refused. `cat <main>/.git/HEAD` shows its branch but not whether it is dirty.
**Treat it as busy** and use a new worktree.

**Worktree recipe.** Run each command as its own plain command, never inside
`$( … )`.

0. **Git must run unmodified.** Run plain `git status` once. If a hook refuses it, that goes in the batch with the hook's message. Until it is fixed, the run falls back to the full git path (`/usr/bin/git`), and step 5 applies.
1. **Create it from `origin/<base>`.** `git fetch origin <base> --quiet`. `git rev-parse --path-format=absolute --git-common-dir` prints `<main>/.git`; `<main>` is its parent. Then, with that path written out literally (a relative path would nest it inside the current worktree):
   `git worktree add --detach <main>/.claude/worktrees/<KEY-n> origin/<base>`
   Then call `EnterWorktree` with that `path`. The worktree starts detached on `origin/<base>`; I4 step 1 creates the branch once the key is known, so nothing needs renaming.
2. **Dependencies:** the config's Prerequisites rows with `Background: no`, in order. In a permission mode that prompts, their allow lines are in the I3 batch, so run them once the answers arrive; research needs only the code. Otherwise run them now.
3. **Untracked files:** `cp <main>/<file> <file>` for each file in `## Worktree` `Copy:`. They are git-ignored, so they never travel with the branch. Copy them, never print them.
4. **Shared resources:** before a gate or a Background Prerequisite, check each item in `## Worktree` `Shared:` (fixed container names, ports). If another checkout holds one, wait until it is free. Two checkouts running the same containerised suite can kill each other's run.
5. **ship-plan's pre-approved git commands** (`Bash(git push origin …)`, …) match only while step 0 holds. On the `/usr/bin/git` fallback they don't match: every push, merge and revert would prompt, and unattended the run stalls at the first one. The step 0 batch item says so.
6. **Commit hooks:** `git hook run pre-commit` once, before the first commit. A hook that lints from the main checkout can fail on files under `.claude/worktrees/`. If it fails because of the worktree path, that goes in the batch, with the ignore line the linter needs.
7. **Anything that cannot be done** goes in the I3 batch. Say what it blocks, and don't discover it later.

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
| "No issue key, I'll create one in the config's project" | Ask the issue question first. Project, epic and related issue are the user's choice. |
| "This is small, it doesn't need a Jira issue" | All work is tracked in Jira. The issue question has no "none" option here. |
| "I'll pass the issue key to ship-plan" | Pass the plan file path. The Jira copy is converted and may be mangled. |
| "I'll start ship-plan's ledger for it" | Never. An existing ship-plan ledger means "resume", and the plan path would be read as answers. |
| "I'll assign the issue and move it to In Progress now" | ship-plan's section 1 does that when work starts. |
| "The main checkout is on another branch, I'll switch it" | Someone is working there. Use the worktree recipe. |
| "Worktree ready, run the tests" | Did you run the Prerequisites, copy the `Copy:` files, and check `Shared:`? |
| "The spec exists, but I'd design it differently" | Existing work counts as approved. Route per I0. |
| "No `## Evidence`, so I'll query production to be sure" | Only read-only sources the config names. Without them, the baseline is a reproduction. |
