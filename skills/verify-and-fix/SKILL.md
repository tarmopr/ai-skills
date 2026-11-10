---
name: verify-and-fix
description: Use when a branch or PR on GitHub, GitHub Enterprise or Azure DevOps must be brought to merge-ready without supervision, or when asked to "verify", "review and fix", "get CI green", "triage the PR comments" or "address the reviewer comments", in a repo configured for ship-plan (.claude/ship-plan.md). Also use to resume such a loop after a context compaction.
argument-hint: '[base branch name, default the config''s Base branch] [--comments] [--runner | --session]'
allowed-tools:
  - Bash(printenv SHIP_RUNNER)
  - Bash(printenv SHIP_RUNNER_KEY)
  - Bash(git fetch origin *)
  - Bash(git status *)
  - Bash(git diff *)
  - Bash(git add *)
  - Bash(git commit *)
  - Bash(git push origin feature/*)
  - Bash(git push origin fix/*)
  - Bash(git push origin docs/*)
  - Bash(git push origin chore/*)
  - Bash(git push origin refactor/*)
  - Bash(git merge origin/*)
  - Bash(git rev-parse *)
  - Bash(git log *)
  - Bash(git remote set-head origin --auto)
  - Bash(git remote get-url origin)
  - Bash(mkdir -p .superpowers/*)
  - Bash(gh repo view *)
  - Bash(gh api user --jq .login)
  - Bash(gh api user --jq .login --hostname *)
  - Bash(gh pr view *)
  - Bash(gh pr checks *)
  - Bash(gh pr comment *)
  - Bash(gh pr edit * --add-reviewer *)
  - Bash(gh run view *)
  - Bash(tail *)
  - Bash(gh api graphql -f query='query ReviewThreads*)
  - Bash(gh api graphql -f query='mutation ReplyToThread*)
  - Bash(gh api graphql -f query='mutation ResolveThread*)
  - mcp__plugin_atlassian_atlassian__getJiraIssue
  - mcp__plugin_atlassian_atlassian__addOrEditJiraIssueComment
  - Bash(az repos pr show *)
  - Bash(az repos pr list *)
  - Bash(az repos pr policy list *)
  - Bash(az repos show *)
  - Bash(az pipelines runs show *)
  - Bash(az devops invoke --area build --resource timeline *)
  - Bash(az devops invoke --area build --resource logs *)
  - Bash(az devops invoke --area git --resource pullRequestThreads *)
  - Bash(az devops invoke --area git --resource pullRequestThreadComments *)
  - Bash(az account show)
  - Bash(az devops configure --list)
  - Bash(az repos policy list *)
  - Bash(gh pr list *)
  - Bash(gh pr diff *)
  - mcp__plugin_linear_linear__get_issue
  - mcp__plugin_linear_linear__save_comment
  - Bash(gh issue view *)
  - Bash(gh issue comment *)
---

# Verify and fix

Run the loop yourself until it is clean: **every gate green, every UI scenario
passing, every PR review comment answered, AND a review round (security
included) that finds no Critical or Important issue.** Rounds are not progress
reports; never stop between them to ask whether to go on.

**Before round 1, read the repo's `.claude/ship-plan.md`
([format](../ship-plan/config-format.md)) in full and `<logs>/ship-plan/blockers.md` by index
([Reading the logs](../ship-plan/SKILL.md#reading-the-logs), which defines `<logs>`).**
The config is the only source of commands.

## The loop

1. Setup: ledger, config, blockers.md, prerequisites.
2. Gates: run all, read every tail. Any red: fix it, test first, rerun the gates.
3. All green: UI scenarios, driven in Chrome. Any failing: go to 6.
4. All pass: a review round, agents and security (round 1 the whole diff, later rounds the fixes).
5. Fetch new PR review comments (review-comments.md).
6. A Critical or Important finding, a failing scenario, or a comment unanswered: triage, fix each with a failing test, commit the round, back to 2. Otherwise: report.

A fix goes back through the gates **and** a fresh review round: fixes cause regressions.

## 1. Setup

- **Host and tracker:** resolve `Host:` and `Tracker:` per [config-format.md](../ship-plan/config-format.md) (absent: `Host:` from the `origin` remote; `Tracker:` from `## Jira`, `## Linear` or `## GitHub Issues`). Read `../ship-plan/hosts/<host>.md` (`github.md` or `azure-devops.md`). A host operation below is the section of that name in that file; a tracker operation, the section of that name in `../ship-plan/trackers/<tracker>.md` (`jira.md`, `linear.md` or `github.md`), read where referenced.
- **Ledger:** `mkdir -p .superpowers/verify-and-fix/<branch>` (here and below, each `/` in the branch name written as `-`), then `ledger.md` there. Append `.superpowers/` to `.git/info/exclude` if missing; never edit the repo's `.gitignore`. One line per round: gate results, graded findings, fixes with commits, every `Ruling:`. After a compaction, trust the ledger and `git log` over memory.
- **Base:** `<base>` is a branch name: the first word of `$ARGUMENTS` not starting with `--` (never `--comments`, `--session` or `--runner`), else the config's `Base branch:`, else the host's *Default branch*. Run `git fetch origin <base> --quiet` first; every diff below compares `origin/<base>...HEAD`. If `git rev-parse --verify --quiet origin/HEAD` prints nothing, run `git remote set-head origin --auto` (local metadata only): `security-review` diffs against `origin/HEAD`.
- **Config:**
  - Read `.claude/ship-plan.md` by its reading rules: headings match case-insensitively; one matching no known section is **unknown**: its rows never run, and the report names it.
  - Then this skill's repo override files, `.claude/ship-plan/verify-and-fix/<file>.md`, as each shared file is read ([Repo override files](../ship-plan/config-format.md#repo-override-files)).
  - **No config:** draft one ([config-drafting.md](../ship-plan/config-drafting.md)) into `.claude/ship-plan.md` (the repo, not a scratch note), top of the question batch, with each gate's source. **Run no gate until the user confirms it;** review meanwhile. Run on its own, leave the draft uncommitted and say so; under `ship-plan`, ship-plan commits it once confirmed.
  - The config is the single gate list. A check that agent instructions or a Makefile name but the config lacks does not run: add it to the config (section 8).
- **Ask now, in one message, for everything only the user can provide** (hosted sign-ins, secrets the config names, the draft config), then carry on with what does not wait on them.
- **Prerequisites:** run `## Prerequisites` rows in order, awaiting each "Ready when"; background rows with `run_in_background`, stopped with TaskStop when the loop ends.

## 2. Gates

- Run each `## Gates` row whose `Only when changed` globs match `git diff --name-only origin/<base>...HEAD` (no globs: always), with `CI=true` in its environment and output to `.superpowers/verify-and-fix/<branch>/<gate>.log`; read the last 60 lines. Cause not there: an `Explore` agent at the `## Models` `Research` row reads the log and reports at most 30 lines, as for any code search a fix needs (ship-plan's "This session reads little itself").
- **After a round's fixes,** rerun rows without globs and rows whose globs match `git diff --name-only <the last gated sha>..HEAD`, by the row's `Fix rounds` command (`{changed}` = those files) when it has one and the round will not push (no open PR; with one, every round pushes, so the full `Command` runs). Other rows keep their last result, shown with that sha in the gate table. A `Fix rounds` result is not the gate's result: before a push and before ending clean, run the full `Command` of each row run only by `Fix rounds` since its last full run, and write `Gated:` for it. After each gate run write `Gated: <HEAD sha> — <the rows run>` in the ledger; the newest is the last gated sha. A merge of the base branch reruns every row.
- Run commands **exactly as configured**; a variant (extra flag, one-shot form) is a proposed config change, not the gate.
- The row's `Notes` (a precondition, a second run under another setup, a known local-only failure) are part of the gate. The gate table names a note that changes the result; a note never silently turns a fail or skip into a pass.
- Each gate has one result: **pass, fail, skipped, or could not run.** Read the tail for skip counts and each skip's file. `Allowed skips` is a number (any skipped test or suite beyond it: "skipped", never pass; within it: pass, noted in the gate table) or `files: <globs>` (find each skip's file in the log: in a matching file, allowed and noted; in another file or none named, "skipped").
- **Waiting for a background gate, agent or CI watch:** the session is told when it ends; read the result then, never by polling its output file. When nothing else can go on and the turn must not end (a runner child: ending the turn ends the run), wait with one loop checking every 15 seconds up to the timeout (`until <done>; do sleep 15; done`), never a fixed `sleep` over 30 seconds before the first check. A pause a skill or host file names on purpose keeps its length (the review wait, a host's poll interval, red-base.md's waits before a rerun).
- **Timeout:** the row's `Timeout`, else 20 minutes. Run in the background; at the limit stop it: "could not run: <reason>" (e.g. "watch mode, never exits"). Propose a one-shot command as a config change; go on.
- **Could not run** (no prerequisite, timeout, missing tool): continue the other gates and review rounds, but the loop cannot end clean. The report names the gate, why, and what the user must do.
- **No gates configured:** the loop cannot end clean; say so in the question batch.

**CI, read-only.** With an open PR, its checks are a gate too: the host's
*Wait for the PR's checks* (read once, without waiting), then *Read a failed run* for
any red job. A red job is a gate failure: fix it locally, test first; propose
its check as a config gate if missing. Pushing the fix to the PR's branch is
authorized (review-comments.md).

**UI scenarios are a gate too** whenever the diff touches the config's
`User-visible paths:` (section 3).

## 3. UI scenarios

`## UI testing` configured and the diff touches its user-visible paths:
**REQUIRED: read [ui-testing.md](ui-testing.md)** and drive the scenarios yourself. Not configured, or the app unreachable, and a
user can see or trigger the change: the scenarios go in the report's
**Not tested** section. Never ask the user to click through.

## 4. Review round

Launch the reviews in parallel. Pass each agent the `model` and
`effort` of its `## Models` row ([format](../ship-plan/config-format.md))
explicitly:

- round 1's `code-reviewer`: `Final review` (default `opus`, `xhigh`); not in `--comments` mode ([review-comments.md](review-comments.md)), and a **small diff** (round 1 below) takes `Review round`;
- `comment-analyzer` and `type-design-analyzer`, every round: `Wording review` (default `sonnet`, `high`);
- every other agent, every round: `Review round` (default `opus`, `high`).

**The full panel:**

- `pr-review-toolkit:code-reviewer` and `pr-review-toolkit:silent-failure-hunter`;
- when tests changed: `pr-review-toolkit:pr-test-analyzer`. When comments or docs changed: `pr-review-toolkit:comment-analyzer`. When types were added: `pr-review-toolkit:type-design-analyzer`;
- the agents from the config's `## Reviewers by path` whose globs the diff touches;
- the security review (below).

**Round 1:** scope `git diff origin/<base>...HEAD`. A **small diff**
(`git diff --shortstat origin/<base>...HEAD` at most 200 lines inserted plus
deleted, no file matching `## Risk paths`) gets `code-reviewer`, the
`## Reviewers by path` agents and the security review; any other, the full panel.

**Round 2 and later:** scope `git diff <the last Reviewed: sha>..HEAD` (the
fixes since): `code-reviewer`, the security review, and the agent whose finding
each fix addressed. Tell each to read the whole files the delta touches, not only hunks, and give it the previous round's findings and fixes. The full panel
on `git diff origin/<base>...HEAD` instead, every round, when the delta has
over 200 lines inserted plus deleted outside test files and docs (a
comment-only hunk counts zero) or the branch's diff (`origin/<base>...HEAD`)
touches `## Risk paths`.

After each round, write `Reviewed: <HEAD sha> — round <n>, <full|delta>, <the agents>` in the ledger.

**Security, every round:** run the `security-review` skill from the checkout under review. If the session's working directory is another repository, do that review yourself against this checklist, marked "self-review". Also check yourself:
  - **Authorization:** every new endpoint, route, handler or RPC checks its caller as its siblings do. Quote the sibling.
  - **Tenancy and ownership:** every new query reading or writing user data is scoped to the caller as existing queries are.
  - **Input:** no query built by string concatenation; no untrusted input in raw HTML, a URL, a file path, a shell command or an object key without validation.
  - **Secrets:** none in code, a committed file, a client bundle, a log line or an error message.
  - **Webhooks:** signature verified before the body is used.
  - **Dependencies:** each new one reviewed (maintainer, adoption, install scripts). The config may add an audit gate.
  - The config's `## Security extras`.
  A finding that exposes data or lets a role do more than it should is Critical, never re-graded down.

**Copied code, every round.** Diff each added file that copies another repo
file (a second service's setup, a test fixture, a helper) against its source: a
CI duplication gate (often a small percentage of new lines)
catches shared blocks no local gate does. A shared block over about 30 lines is Important: extract it as the repo's agent instructions
say, or, when the plan copies on purpose, put it in the question batch with
extraction recommended.

**Then look for other copies of the source** another branch put in the same
place under another name, by two or three names only the source declares (types,
members, configuration keys):

- `git grep -n -e <name> … origin/<base> -- <the folder the copy goes in>`: a hit outside this diff is a copy already on the base branch. Reuse it instead of adding a second, or merge the two in this PR.
- the host's *Find open PRs*, by changed files under that folder: a hit is a copy in flight. Name it in the report with both paths, so whichever PR merges second reuses the other's copy. Commenting on the other PR is outward-facing: question batch only.

Repeat after each merge of the base branch into this one: a copy from a PR that
merged first arrives there. A second copy is a Suggestion (Important when it
crosses the duplication threshold): fixed here when it keeps behaviour, else a
follow-up named in the report.

Give each reviewer the ledger's `Ruling:` lines, telling it not to raise those settled questions again.

**Every reviewer's prompt asks for findings only:** one line each (file:line, grade, what, why), at most 25 lines, and no summary of the diff.

**Tell every reviewer, in its prompt: never run a gate or test command in this
working tree, and never edit it** (a second gate run collides with the first). To
prove a test fails, it uses its own scratch worktree, then removes it.

**A reviewer agent or the `security-review` skill unavailable:** do its review
yourself against the same checklist, marked "self-review" in ledger and report.

**A round is one review round.** Fixing a gate failure does not start one; the
round-5 limit in section 6 counts these.

## 4b. PR review comments

**When the branch has an open PR (the host's *Find open PRs*, the branch's own PR) or the run is in `--comments` mode, read [review-comments.md](review-comments.md).**
Otherwise this section does nothing.

## 5. Triage and fix

Grade each finding by what a user would get if it shipped, not by the reviewer's label.

| Grade | Action |
|---|---|
| Critical, Important | Fix this round: a reproducing test, watch it fail, then fix. Important includes anything a user sees wrongly: raw error text, a refused write that reads as saved, missing or untranslated text, silently dropped data. |
| Suggestion | Fix if it keeps behaviour and stays in scope; else list it in the report. **A PR comment from a non-approver while the PR has approvals:** reply that it is a follow-up ("Follow-up while approved" reply), don't push: a push can dismiss approvals. **An approver's own request** is their condition: fix, push, re-request them. One they mark non-blocking ("non-blocking", "nit", "optional") is not: reply "Follow-up while approved", don't push. |
| Question (PR comment) | A request for information: answer, quoting the code. One proposing a change ("why not use the existing helper?") is a Suggestion: make it if it fits, else say why. |
| Not a real issue | A `Ruling:` quoting the code that proves it; without a quote, it is a finding. A PR comment also gets a reply with that quote. |
| Needs the user (PR comment) | A product decision, widened access, money, or beyond the spec (section 6). Reply that it needs the author's decision; stop on it as section 6 says. |
| Outside the diff | List it in the report; do not widen the branch. A PR comment also gets a reply naming it a follow-up. |

A round whose only fixes are behaviour-keeping suggestions (a rename, a comment, dead code) reruns the gates, not a review round. Every other fix gets both.

**The same code a third time.** When a round from round 3 on has a Critical or
Important finding in a file two earlier rounds' fix commits already changed
(`git log --format=%s -- <file>` since the run's first `Reviewed:` sha), stop
patching it. Make one fix that removes the class of finding (an existing
library instead of hand-written parsing, a narrower input, a whitelist instead
of a blacklist), and write `Ruling: redesign <file> — <the repeated class of
finding> — <cost if wrong>`. When the code only tests or supports something the
spec could do more simply (a test helper that parses a deployment file), also
write `Parked: drop or replace <file> — <the simpler way, recommended> — <what
it blocks>` in the ledger, and put it at the top of the report: deleting a test the spec asked for is the
user's call.

Fix rules: the config's `## Fix rules`, plus: never weaken or delete a test to
make it pass; never change an expected value without a separately justified
reason; with `Tracker: github`, never a closing keyword (`Fixes`, `Closes`, `Resolves`…) before an issue reference in a commit message (`../ship-plan/trackers/github.md` *Integration*). Commit once per round for the agents' findings, and **once per PR
comment** for review fixes (`fix(review): <what>`), so each reply names its
commit. Stage only the files you fixed, by name (never `git add -A`); let hooks
run (never `--no-verify`). With an open PR, push once the round's gates pass,
then reply (review-comments.md).

## 6. When to stop and ask

Only these stop the loop:

- **Signing in on a hosted URL:** ask once for every role you need. Local URLs you sign in to yourself, and `Hosted URL:` too when `## Allowed` has `Sign in on Hosted URL: test users`; those scenarios run after the merge (ui-testing.md).
- **An outward-facing or destructive action:** a push without an open PR,
  opening a PR, merge, any write to a shared environment or production, deleting
  anything you did not create (an open PR's push and replies: review-comments.md).
  Hand the user the exact command in one copyable block; continue once done. (Under `ship-plan`, its authorization list covers push, PR and merge.)
- **Anything under the config's `## Never do`.** Same handling.
- **A finding that needs a product decision**: two reasonable behaviours
  conflict and the spec does not settle it.
- **A fix whose test still fails** after one root-cause attempt
  (superpowers:systematic-debugging). Report what you tried.
- **Round 5 still has Critical or Important findings.**

A failing gate is not a reason to stop; it is the loop's input.

Waiting on the user is not stopping: do everything that does not depend on the
answer, then end with the report, what is pending at its top.

## 7. Report

**What "clean" means.** Clean: every gate passed, every scenario passed, every PR
review comment has a reply, and the last review round found no Critical or
Important issue. Scenarios that could not run locally (config or environment
could not provide them) and were deferred:
**"clean before merge; N scenarios pending"**, naming them; never call that
clean. Anything else: **"not clean: <reason>"**. The status line uses exactly one of these three forms.

**Last ledger line:** `Done: <HEAD sha> — <status>`, every time this skill
ends (also in `--comments` mode).

**Everything not tested gets its own section at the end of the report**: the
scenarios, what was missing, and whether the user declined to provide it.

Keep it short: the gate table (pass / fail / skipped / not run, with the
reason), the scenario table from `scenarios.md` with the GIF paths, rounds run,
fixes with commits, the PR review items (author, grade, result, reply) when
there is a PR, every `Ruling:`, suggestions listed rather than fixed, blockers
entries added, updated or removed this run (under `ship-plan`, their `Lesson:`
lines), every unknown config section, every override line not applied, each
`## Allowed` entry used (such as `Sign in on Hosted URL: test users`), and every
proposed config change.

## 8. Self-improvement

Whenever you get past a blocker (a command that will not run, a hook refusal, a
misbehaving tool, a gate that lies), or learn something a repo file or skill
should say, **record it in the same session, before the report.** **Under
`ship-plan`, edit no file:** record each as a `Lesson:` line in ship-plan's
ledger naming its target file (`ship-plan/blockers.md` for a blocker);
ship-plan's section 8 writes them on its lessons branch at its end, never in the
product PR. **When run on its own, read [lessons.md](lessons.md).**

## Runner mode (ship-runner)

**When `printenv SHIP_RUNNER` prints a folder, read [../ship-plan/runner-child.md](../ship-plan/runner-child.md) and [modes.md](modes.md).**

## Runner or session

`--runner` and `--session` may stand anywhere among the arguments (only a branch
and flags); neither is ever the base branch.

- **`--session`, or a runner child:** session mode, whatever `Mode:` says (ship-plan passes `--session`: this loop then runs inside ship-plan's run).
- **Otherwise, with `## Runner` `Mode: runner` or `--runner`:** the ship runner runs the phases and this session only watches and relays. **When the runner runs the phases, read [../ship-plan/runner-session.md](../ship-plan/runner-session.md).** Follow it with `start verify <the checked-out branch>`; when this skill got arguments (its base branch, `--comments`; not `--runner` or `--session`), add `-- <those arguments>`, each single-quoted: the runner passes them to its verify-and-fix child.

## Red flags

| Thought | Reality |
|---|---|
| "The suite passed" (some skipped) | A skip is a check that did not run. Say so. |
| "The reviewer called it minor" | Re-grade by what the user gets. |
| "Copilot is a bot" | Grade every comment on its merits. |
| "The reviewer is wrong, I'll ignore it" | Reply with quoted evidence. Every comment gets an answer. |
| "I'll resolve their thread so the PR can merge" | Only a bot reviewer's threads, as the host names them. A person resolves their own. |
| "It's approved, one more suggestion won't hurt" | A push can dismiss the approval: reply "follow-up" to a suggestion, unless it is an approver's own request not marked non-blocking: fix that one. |
| "That was fixed last round" | A fix gets a fresh review. |
| "I'll note the blocker later" | Write it now. |
| "The unit tests pass, so the flow works" | Drive it in Chrome. |
| "The user can click through it faster" | Drive it yourself. |
| "The toast said saved" | Check the network response and reload. A toast over a 403 is a failure. |
| "It's not security-sensitive" | Run the security review anyway. Tenancy leaks look like ordinary queries. |
| "I'll keep looping until it's perfect" | Stop at clean gates plus a clean review round, or at round 5. |
| "One more patch to the same parser" | Third round of findings in one file: redesign it once (section 5). |
| "The repo obviously uses this tool" | Only configured gates run. Propose it as a config change. |
| "I'll keep the gate list in a scratch note" | Draft `.claude/ship-plan.md`, ask once, run no gate until confirmed. |
| "I'll rerun the gate with a better flag" | Run it as configured; propose the better command. |
| "It's still running, give it longer" | At the timeout, stop it, record "could not run", move on. |
| "The heading is misspelled but I know what it means" | Case-insensitive match only; else an unknown section, not run, named in the report. |
| "The agent instructions list more checks" | The config is the single gate list. Propose the missing check. |
