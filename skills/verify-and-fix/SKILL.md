---
name: verify-and-fix
description: Use when a branch or PR on GitHub, GitHub Enterprise or Azure DevOps must be brought to merge-ready without supervision, or when asked to "verify", "review and fix", "get CI green", "triage the PR comments" or "address the reviewer comments", in a repo configured for ship-plan (.claude/ship-plan.md). Also use to resume such a loop after a context compaction.
argument-hint: '[base branch name, default the config''s Base branch] [--comments]'
allowed-tools:
  - Bash(git fetch origin *)
  - Bash(git status *)
  - Bash(git diff *)
  - Bash(git add *)
  - Bash(git commit *)
  - Bash(git push origin HEAD)
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
  - mcp__plugin_engineering_linear__get_issue
  - mcp__plugin_engineering_linear__save_comment
---

# Verify and fix

Run the loop yourself until it is clean: **every gate green, every UI scenario
passing, every PR review comment answered, AND a review round (security
included) that finds no Critical or Important issue.** The user started this skill so they
would not have to push each round. Rounds are not progress reports; do not stop
between them to ask whether to go on.

**Before round 1, read the repo's `.claude/ship-plan.md`
([format](../ship-plan/config-format.md)) and `.claude/ship-plan/blockers.md` in full.**
If `.claude/ship.md` exists and `.claude/ship-plan.md` does not, stop with one
line: "This repo is set up for the removed `ship` skill: move `.claude/ship.md` to `.claude/ship-plan.md` and `.claude/ship/` to `.claude/ship-plan/`."
The config is the only source of commands. The blockers file is the list of
things that stopped earlier runs, and the fix for each. Reading it costs a
minute; rediscovering an entry costs an hour.

## The loop

```dot
digraph loop {
  "Setup: ledger, config, blockers.md, prerequisites" [shape=box];
  "Gates: run all, read every tail" [shape=box];
  "All gates green?" [shape=diamond];
  "Fix gate failure, test first" [shape=box];
  "Review round: agents on the whole diff" [shape=box, label="Review round: agents and security on the whole diff"];
  "Critical or Important found?" [shape=diamond, label="Critical or Important found,\nor a comment unanswered?"];
  "Triage, fix each with a failing test, commit the round" [shape=box];
  "Report" [shape=doublecircle];

  "Setup: ledger, config, blockers.md, prerequisites" -> "Gates: run all, read every tail";
  "Gates: run all, read every tail" -> "All gates green?";
  "All gates green?" -> "Fix gate failure, test first" [label="no"];
  "Fix gate failure, test first" -> "Gates: run all, read every tail";
  "UI scenarios: drive them in Chrome" [shape=box];
  "All scenarios pass?" [shape=diamond];
  "All gates green?" -> "UI scenarios: drive them in Chrome" [label="yes"];
  "UI scenarios: drive them in Chrome" -> "All scenarios pass?";
  "All scenarios pass?" -> "Triage, fix each with a failing test, commit the round" [label="no"];
  "All scenarios pass?" -> "Review round: agents on the whole diff" [label="yes"];
  "PR review comments: fetch new ones (review-comments.md)" [shape=box];
  "Review round: agents on the whole diff" -> "PR review comments: fetch new ones (review-comments.md)";
  "PR review comments: fetch new ones (review-comments.md)" -> "Critical or Important found?";
  "Critical or Important found?" -> "Triage, fix each with a failing test, commit the round" [label="yes"];
  "Triage, fix each with a failing test, commit the round" -> "Gates: run all, read every tail";
  "Critical or Important found?" -> "Report" [label="no"];
}
```

A fix goes back through the gates **and** a fresh review round. Fixes cause
regressions: a later round often finds bugs an earlier round's fixes introduced.

## 1. Setup

- **Host and tracker:** resolve `Host:` and `Tracker:` as [config-format.md](../ship-plan/config-format.md) says (`Host:` from the `origin` remote when absent; `Tracker:` from `## Jira` or `## Linear` when absent). Then read `../ship-plan/hosts/<host>.md` (`github.md` or `azure-devops.md`). A reference below to an operation of the host names the section of that name in that file; one of the tracker names the section of that name in `../ship-plan/trackers/<tracker>.md` (`jira.md` or `linear.md`), read where the reference says.
- **Ledger:** `mkdir -p .superpowers/verify-and-fix/<branch>`, then `ledger.md` there. If `.superpowers/` is not listed in `.git/info/exclude`, append it there; never edit the repo's `.gitignore`. One line per round: the gate results, the findings with their grades, the fixes with their commits, and every `Ruling:` you made. After a context compaction, trust the ledger and `git log` over memory.
- **Base:** `<base>` is a branch name: `$ARGUMENTS`, else the config's `Base branch:`, else the repo's default branch from the host's *Default branch*. Run `git fetch origin <base> --quiet` first; every diff below compares `origin/<base>...HEAD`. If `git rev-parse --verify --quiet origin/HEAD` prints nothing (common in a fresh clone), run `git remote set-head origin --auto`: the `security-review` skill diffs against `origin/HEAD` and fails without it. It changes local git metadata only.
- **Config:**
  - Read `.claude/ship-plan.md` by its reading rules: headings match case-insensitively; a heading that matches no known section is **unknown**. Its rows never run, and the report names it.
  - Then read the repo override files for this skill, `.claude/ship-plan/verify-and-fix/<file>.md`, as each shared file is read ([Repo override files](../ship-plan/config-format.md#repo-override-files)).
  - **No config:** draft one ([config-drafting.md](../ship-plan/config-drafting.md)) and write it to `.claude/ship-plan.md`. Put it at the top of the question batch with each gate's source. **Run no gate until the user confirms it.** Do the review round meanwhile. A draft lives in the repo, not in a scratch note: it is what the next run reads. Run on its own, leave the draft uncommitted and say so; under `ship-plan`, ship-plan commits it once confirmed.
  - The config is the single list of gates. If the repo's agent instructions or a Makefile name a check the config lacks, do not run it: add it to the config, as section 8 says.
- **Ask for everything only the user can provide, in one message, now:** hosted sign-ins, secrets the config names, the draft config. Then carry on with everything that does not wait on them. Asking in the middle of the loop costs the user a second interruption.
- **Prerequisites:** run the config's `## Prerequisites` rows in order, wait for each one's "Ready when", and start background rows with `run_in_background`. Stop them with TaskStop when the loop ends.

## 2. Gates

- Run every `## Gates` row whose `Only when changed` globs match `git diff --name-only origin/<base>...HEAD` (no globs: always). Run each with `CI=true` in its environment and its output sent to `.superpowers/verify-and-fix/<branch>/<gate>.log`, then read the tail. Long output left in context crowds out the rest of the loop.
- Run the command **exactly as configured.** A variant you think is better (an extra flag, a one-shot form) is a proposed config change, not something you run as the gate.
- Follow the row's `Notes` as part of the gate: a precondition, a second run under another setup, a known local-only failure. A note may change how the gate is judged; when it changes the result, the gate table names the note. A note never silently turns a fail or a skip into a pass. Empty: nothing extra.
- Each gate has one result: **pass, fail, skipped, or could not run.** Read the tail for skip counts and the file each skip is in. The row's `Allowed skips` is a number or `files: <globs>`:
  - A number: any skipped test or suite beyond it makes the gate "skipped", never pass; skips within it are a pass, noted in the gate table.
  - `files: <globs>`: search the gate's log for each skip's file. A skip inside a matching file is allowed, noted in the gate table; a skip in any other file, or one whose file the log does not name, makes the gate "skipped".
- **Timeout:** the row's `Timeout`, else 20 minutes. Run the gate in the background and check it; at the limit, stop it. The result is "could not run: <reason>", for example "watch mode, never exits". Propose a one-shot command as a config change, and go on with the other gates.
- **Could not run** (no prerequisite, timeout, missing tool): keep running the other gates and the review rounds, but the loop cannot end as clean. The report names the gate, why it could not run, and what the user has to do.
- **No gates configured:** the loop cannot end as clean. Say so in the question batch.

**CI, read-only.** When the branch has an open PR, its checks are a gate too:
the host's *Wait for the PR's checks* (read once, without waiting), then the
host's *Read a failed run* for any red job. A red job is a gate failure: fix it locally with a test first, and
propose the job's check as a config gate if the config lacks it. Pushing the
fix to the PR's branch is authorized (review-comments.md).

**UI scenarios are a gate too** whenever the diff touches the config's
`User-visible paths:`. **REQUIRED: read [ui-testing.md](ui-testing.md)** and
drive the scenarios yourself.

## 3. UI scenarios

When `## UI testing` is configured and the diff touches its user-visible paths,
follow [ui-testing.md](ui-testing.md). When it is not configured, or the app
cannot be reached, and the change is something a user can see or trigger, the
scenarios go in the report's **Not tested** section. Never ask the user to
click through.

## 4. Review round

Scope: `git diff origin/<base>...HEAD`. Launch these in parallel, each on the
whole diff, each with the `model` and `effort` of the config's `## Models`
`Review round` row ([format](../ship-plan/config-format.md); default `opus`,
`high`) passed explicitly. Agents whose definition says `model: inherit` would
otherwise take whatever model the session runs on.

- Always: `pr-review-toolkit:code-reviewer` and `pr-review-toolkit:silent-failure-hunter`.
- When tests changed: `pr-review-toolkit:pr-test-analyzer`. When comments or docs changed: `pr-review-toolkit:comment-analyzer`. When types were added: `pr-review-toolkit:type-design-analyzer`.
- The agents from the config's `## Reviewers by path` whose globs the diff touches.
- **Security, every round:** run the `security-review` skill on the branch. Check these yourself too, because no gate does:
  - **Authorization:** every new endpoint, route, handler or RPC checks who calls it, the same way its siblings do. Quote the sibling.
  - **Tenancy and ownership:** every new query that reads or writes user data is scoped to the caller the way existing queries are.
  - **Input:** no query built by string concatenation; no untrusted input in raw HTML, a URL, a file path, a shell command or an object key without validation.
  - **Secrets:** nothing added to code, a committed file, a client bundle, a log line or an error message.
  - **Webhooks:** the signature is verified before the body is used.
  - **Dependencies:** each new dependency is reviewed (maintainer, adoption, install scripts). The config may add an audit gate.
  - The config's `## Security extras`.
  A security finding that exposes data or lets a role do more than it should is Critical, and it is not re-graded down.

**Copied code, every round.** For each file the diff adds that copies another
file in the repo (a second service's setup, a test fixture, a helper), diff it
against its source. A CI duplication gate (Sonar's "Duplicated Lines on New
Code", 3% by default) fails the PR on a shared block that no local gate
catches, and finding it after the push costs a CI round and a question. A shared
block of more than about 30 lines is an Important finding: extract it the way
the repo's agent instructions say, or, when the plan copies on purpose, put it
in the question batch with the extraction as the recommended option.

**Then look for other copies of the same source.** Another branch may have
copied it into the same place under another name: two PRs
each added a log capture sink to the same module's tests under different names,
and neither saw the other. For each copied source, take
two or three names only it declares (types, members, configuration keys), then:

- `git grep -n -e <name> … origin/<base> -- <the folder the copy goes in>`: a hit outside this diff is a copy already on the base branch. Reuse it instead of adding a second one, or merge the two in this PR.
- the host's *Find open PRs*, by changed files under that folder: a hit is a copy in flight. Name it in the report, with both paths, so whichever PR merges second reuses the other's copy. Commenting on the other PR is outward-facing: it goes in the question batch, never done on your own.

Run this again each time the base branch is merged into this branch: the
merge is where a copy from a PR that merged first arrives. A second copy is a
Suggestion (Important when it crosses the duplication gate's threshold), fixed
in this PR when it keeps behaviour, and otherwise a follow-up named in the
report.

Give each reviewer the ledger's `Ruling:` lines, so settled questions are not
raised again as new findings.

**Tell every reviewer, in its prompt: never run a gate or test command in this
working tree, and never edit it.** Gates hold fixed resources, and a second run
collides with the first. A reviewer that needs to prove a test fails does it in
its own scratch worktree, and removes that worktree afterwards.

**If a reviewer agent or the `security-review` skill is unavailable,** do its
review yourself against the same checklist, and mark it "self-review" in the
ledger and the report.

**A round is one review round.** Fixing a gate failure does not start a new
round. The round count is what the round-5 limit in section 6 counts.

## 4b. PR review comments

**When the branch has an open PR (the host's *Find open PRs*, the branch's own PR) or the run is in `--comments` mode, read [review-comments.md](review-comments.md).**
Without a PR there are no review comments, and this section does nothing.

## 5. Triage and fix

Grade each finding by what a user would get if it shipped, not by the label the
reviewer put on it.

| Grade | Action |
|---|---|
| Critical, Important | Fix this round. Write a test that reproduces the finding, watch it fail, then fix. Important includes anything a user sees wrongly: raw error text, a refused write that reads as saved, missing or untranslated text, silently dropped data. |
| Suggestion | Fix if it keeps behaviour and stays in scope. Otherwise list it in the report. **A PR comment from someone who has not approved, while the PR has approvals:** reply that it is a follow-up and don't push it, because a push can dismiss the approvals ("Follow-up while approved" reply). **An approver's own request** is their condition, not a follow-up: fix it, push, and re-request them. |
| Question (PR comment) | A request for information: answer it, quoting the code. A question that proposes a change ("why not use the existing helper?") is a Suggestion: if the proposal fits, make it; if not, say why. |
| Not a real issue | Write a `Ruling:` quoting the code that proves it. Without a quote, it is a finding. A PR comment also gets a reply with that quote. |
| Needs the user (PR comment) | A product decision, widened access, money, or beyond the spec (section 6). Reply that it needs the author's decision, and stop on it as section 6 says. |
| Outside the diff | List it in the report. Do not widen the branch. A PR comment also gets a reply naming it as a follow-up. |

When a round's only fixes are behaviour-keeping suggestions (a rename, a comment,
dead code), rerun the gates, but not a review round. Every other fix gets both.

Fix rules: the config's `## Fix rules`, plus: never weaken or delete a test to
make it pass; never change an expected value without a separately justified
reason. Commit once per round for the agents' findings, and **once per PR
comment** for review fixes (`fix(review): <what>`), so each reply can name its
commit. Stage only the files you fixed, by name (never `git add -A`, which
sweeps in logs and drafts), and let the repo's hooks run (never
`--no-verify`). With an open PR, push once the round's gates pass, then reply
(review-comments.md).

## 6. When to stop and ask

Only these stop the loop:

- **Signing in on a hosted URL:** ask once for every role you need. Local URLs you sign in to yourself, and `Hosted URL:` too when `## Allowed` has `Sign in on Hosted URL: test users` and the branch's diff does not touch `## Allowed` (ui-testing.md).
- **An action that is outward-facing or destructive:** a push without an open
  PR, opening a PR, merge, any write to a shared environment or production,
  deleting anything you did not create. (Pushing and replying on an open PR are
  covered by review-comments.md.) Hand the user the exact command in one copyable block, then continue
  once it is done. (Under `ship-plan`, its authorization list covers push, PR and merge.)
- **Anything under the config's `## Never do`.** Same handling as above.
- **A finding that needs a product decision**, where two reasonable behaviours
  conflict and the spec does not settle it.
- **A fix whose test still fails** after one root-cause attempt
  (superpowers:systematic-debugging). Report what you tried.
- **Round 5 still has Critical or Important findings.** The design is likely
  wrong, and more patching will not help.

A failing gate is not a reason to stop. It is the loop's input.

Waiting on the user is not the same as stopping. Keep doing everything that
does not depend on the answer. When nothing is left, end with the report, and
put what is pending at the top of it.

## 7. Report

**What "clean" means.** Clean: every gate passed, every scenario passed, every PR
review comment has a reply, and the last review round found no Critical or
Important issue. When some scenarios
could not run locally (the config or the environment could not provide them)
and were deferred, the status is **"clean before merge; N scenarios pending"**.
Name those scenarios, and never call that result clean. Anything else is
**"not clean: <reason>"**. The status line uses exactly one of these three forms.

**Everything that was not tested gets its own section at the end of the
report**, with the scenarios, what was missing, and whether the user declined
to provide it. A third-party flow without test credentials is the usual case.
A check the reader cannot see was skipped is worse than a failing one.

Keep it short: the gate table (pass / fail / skipped / not run, with the
reason), the scenario table from `scenarios.md` with the paths to the GIFs, how
many rounds ran, the fixes with their commits, the PR review items (author,
grade, result, reply) when there is a PR, every `Ruling:`, the suggestions
listed rather than fixed, the blockers entries added this run, every unknown
config section, every override line not applied, each `## Allowed` entry the run
used (such as `Sign in on Hosted URL: test users`), and every proposed config change.

## 8. Self-improvement

Whenever something blocks you (a command that will not run, a hook refusal, a
tool that misbehaves, a gate that lies) and you get past it, **update
`.claude/ship-plan/blockers.md` in the same session, before the report.** Create it
from [log-formats.md](../ship-plan/log-formats.md) if it is missing. **Under `ship-plan`, edit no file,** for this entry or any item below:
record each one, whether it would be written or proposed, as a `Lesson:` line in ship-plan's ledger that names its
target file. ship-plan's section 8 writes them on its lessons branch at the end of its run, so they never land in the product PR.

- Add an entry: the symptom (exact error text), the cause, the fix (the exact
  command), and the date.
- If an existing entry was wrong or out of date, correct it rather than adding a
  second one.
- **A lesson only this repo needs** (a step, a fact, a failure path, a test
  value): write it into the matching override file,
  `.claude/ship-plan/verify-and-fix/<file>.md`, created if missing. It may only
  add or make a rule stricter ([Repo override files](../ship-plan/config-format.md#repo-override-files)).
- **A config fact** (a missing gate, a `## UI testing` `Notes:`): write it
  into `.claude/ship-plan.md` under the narrowing rule. A reviewer by path or
  a loosening change is proposed in the report with its exact line, not
  written, unless the user approved it in this run ([Loosening changes](../ship-plan/config-format.md#loosening-changes)).
- **A lesson for every repo** (a missing step, a step in the wrong order):
  propose it in the report as a "proposed shared-skill change", with the exact
  text and no repo, team or org names. Never edit this skill's files: every
  repo uses them, and they are published from their own git repository.
- **A missing permission** (a refusal, a question the user had to answer to
  allow something, an action the user did by hand): propose the exact
  `## Allowed` line in the report, with the reason. Never write it
  ([`## Allowed`](../ship-plan/config-format.md#-allowed)). When no entry on
  the closed list fits, propose it as a shared-skill change instead; a command
  the permission system refused is proposed as an `allowed-tools` line, never
  edited into settings.
- If the lesson is a rule for the whole repo rather than for this loop, propose
  a change to the repo's agent instructions file in the report. Do not edit it
  on your own.

Run on its own, leave these edits uncommitted and say so.

A blocker you got past but did not write down will stop the next run too.

## Red flags

| Thought | Reality |
|---|---|
| "The suite passed" (some of it skipped) | A skipped test is a check that did not run. Say so. |
| "The reviewer called it minor" | Re-grade it by what the user gets. |
| "Copilot is a bot, its comments don't matter" | Grade every comment on its merits. A bot can be right. |
| "The reviewer is wrong, I'll ignore it" | Reply with the quoted evidence. Every comment gets an answer. |
| "I'll resolve their thread so the PR can merge" | Only a bot reviewer's threads, as the host names them. A person resolves their own. |
| "It's approved, one more suggestion won't hurt" | A push can dismiss the approval. Reply "follow-up" instead, unless the suggestion is an approver's own request: that one you fix. |
| "That was fixed last round" | A fix gets a fresh review. Fixes cause regressions. |
| "I'll note the blocker later" | Write the blockers entry now, or it is lost. |
| "The unit tests pass, so the flow works" | Drive it in Chrome. Suites pass and flows still break in the UI. |
| "The user can click through it faster" | The user started this skill so they would not have to. Drive it yourself. |
| "The toast said saved" | Check the network response and reload. A toast over a 403 is a failed scenario. |
| "It's not security-sensitive" | Run the security review anyway. Tenancy leaks look like ordinary queries. |
| "I'll keep looping until it's perfect" | Stop at clean gates plus a clean review round, or at round 5. |
| "The repo obviously uses this tool, I'll just run it" | Only configured gates run. Propose the gate as a config change. |
| "Nobody asked me to add repo config, I'll keep the gate list in a scratch note" | No config means draft `.claude/ship-plan.md`, ask once, and run no gate until it is confirmed. |
| "I'll rerun the gate with a better flag" | Run it as configured. A better command is a proposed config change. |
| "It's still running, I'll give it a bit longer" | The timeout is the timeout. Stop it, record "could not run", move on. |
| "The config heading is misspelled but I know what it means" | Match case-insensitively. Anything else is an unknown section: its rows do not run, and the report names it. |
| "The agent instructions list more checks, I'll run them too" | The config is the single gate list. Propose the missing check. |
