---
name: ship-queue
description: Use when the user wants every sub-issue of a parent issue shipped with ship-issue, one after another, unsupervised — "ship all sub-issues of PROJ-123", "queue these issues", "run ship-issue for each sub-issue", "ship the whole epic in order". Logs what could not finish, moves on, and ends with a summary of what the user must do next. Also use to resume such a queue after a context compaction.
argument-hint: '<parent key> [show order] [keys…] [KEY: answers…]'
allowed-tools:
  - Bash(git status)
  - Bash(git status --porcelain)
  - Bash(git worktree list)
  - Bash(git worktree add *)
  - Bash(git fetch origin *)
  - Bash(git rev-parse *)
  - Bash(git remote get-url origin)
  - Bash(git switch --detach origin/*)
  - Bash(git switch main)
  - Bash(git switch master)
  - Bash(git switch develop)
  - Bash(git switch feature/*)
  - Bash(git switch fix/*)
  - Bash(git switch docs/*)
  - Bash(git switch chore/*)
  - Bash(git switch refactor/*)
  - Bash(gh auth status)
  - Bash(gh api user --jq .login)
  - Bash(gh api user --jq .login --hostname *)
  - Bash(gh pr list *)
  - Bash(az account show)
  - Bash(az devops configure --list)
  - Bash(az repos pr list *)
  - Bash(SHIP_QUEUE_PARENT=* claude -p *)
  - Bash(jq * .superpowers/ship-queue/*)
  - mcp__plugin_linear_linear__get_user
  - mcp__plugin_linear_linear__get_issue
  - mcp__plugin_linear_linear__list_issues
  - mcp__plugin_linear_linear__list_comments
  - mcp__plugin_linear_linear__save_comment
  - mcp__plugin_atlassian_atlassian__getAccessibleAtlassianResources
  - mcp__plugin_atlassian_atlassian__atlassianUserInfo
  - mcp__plugin_atlassian_atlassian__getJiraIssue
  - mcp__plugin_atlassian_atlassian__searchJiraIssuesUsingJql
  - mcp__plugin_atlassian_atlassian__executeRead
  - mcp__plugin_atlassian_atlassian__discover
  - mcp__plugin_atlassian_atlassian__addOrEditJiraIssueComment
---

# Ship a queue of sub-issues

One run takes every open sub-issue of a parent issue through **ship-issue**,
one after another: the next starts only when the previous run has ended, so
each starts from a base branch that already holds the previous merged change.
**The user starts this skill so they can walk away.** A sub-issue that cannot
be started or finished does not stop the queue: its state goes into the
queue's ledger and onto the sub-issue, and the next one starts. At the end,
one summary says what was shipped, what was not, why, and exactly what the
user must do to continue.

**Before anything else, read:** the repo's `.claude/ship-plan.md` by the
reading rules of ship-plan's [config-format.md](../ship-plan/config-format.md),
then resolve `Host:` and `Tracker:` as that file says and read
`../ship-plan/hosts/<host>.md` and `../ship-plan/trackers/<tracker>.md`. A
reference below to an operation of the host or the tracker names the section
of that name in those files. **Repo override files** apply as in ship-issue:
right after this file, read `.claude/ship-plan/ship-queue/SKILL.md` if it
exists; a line that widens what the run may do, or removes a step, is not
applied, and the summary names it.

**Arguments:** `<parent key> [show order] [<key> <key> …] [<key>: <answers> …]`

- The first word is the parent issue's key (the tracker's *Issue keys*). Required.
- Bare keys after it are the order (Q1 step 1).
- `show order`, or wording that means the same ("confirm order", "let me see the order first"): show the order and wait for an OK before starting.
- `<key>: <text>`, up to the next `<key>:` or the end: answers for that sub-issue's waiting question batch (Resume).

## What invoking this skill authorizes

- running ship-issue for each queued sub-issue in a child session (*Child sessions*). Each of those runs has exactly the authorization ship-issue and ship-plan give it, nothing more;
- reading the parent and its sub-issues, with comments and relations;
- comments on the parent and on the sub-issues (the tracker's *Comment*);
- the checkout switches *Checkout* names, and one worktree for the whole queue.

It does **not** authorize anything ship-issue or ship-plan does not, writing to
`## Allowed`, or changing a sub-issue's description, status or assignee itself
(ship-plan does that inside each run).

## The ledger

`.superpowers/ship-queue/<parent key>/ledger.md`, in the queue's checkout
(*Checkout*), written once that checkout is chosen. Add `.superpowers/` to
`<git-common-dir>/info/exclude` (`git rev-parse --git-common-dir`), never to
`.gitignore`. First line, rewritten as values change:

`Phase: <preflight|running|done> | Parent: <key> | Order: <keys> | Current: <key or none> | Checkout: <path>`

Below it, one line per event:

- `Order: <keys>` and `Order source: <argument|parent|analysis>`;
- `Depends: <key> on <key> — <evidence quoted>`, one per hard dependency;
- `Ruling: <decision> — <evidence quoted> — <cost if wrong>` and `Asked: <question> — <answer, or "pending">`, as ship-plan writes them;
- `Current: <KEY> started <time>` before each sub-issue's run;
- `Child: <KEY> run <n> <output file>` when its child session starts, and `Cost: <KEY> run <n> — $<total_cost_usd>, <num_turns> turns, <minutes> min` when it ends;
- `Ledger: <KEY> <ship-issue ledger path> <ship-plan ledger path or "none">` once known;
- `Result: <KEY> <outcome> — <reason quoted> — next: <action>` when it ends;
- `Lesson: <what> — <the step that would have caught it>`.

**The queue never writes a ship-issue or ship-plan ledger.** It only reads
them. A ship-plan ledger that exists means "resume" to ship-plan, and a line
written there by another skill would be read as that run's own.

**After a compaction, resume from the first line and the last `Current:` /
`Result:` lines, not from memory.** A queue of a dozen sub-issues runs a dozen
full ship-issue runs; several compactions are expected.

## Q0. Pre-flight

Every stop after step 5 (the ledger exists) writes `Stopped: <reason>` as the ledger's last line, so a later run sees the queue ended.

The user has just invoked the skill and is probably still there. Everything
that would stop every sub-issue is found now.

1. **Config.** No `.claude/ship-plan.md`, or no tracker section for its `Tracker:`: stop with one line, "Run `/ship-issue <one sub-issue key>` first: it drafts the config this queue needs." The queue drafts no config.
2. **Tracker.** `Tracker: github` or `none`: stop with one line, "ship-queue needs a tracker with sub-issues: Linear or Jira." The tracker's *List sub-issues* says so for GitHub Issues.
3. **Auth,** in parallel: the host's *Auth check* (and your login, as it says), the tracker's *Auth*. A failure stops the queue: no sub-issue could run. Report the exact error.
4. **A live queue.** Look for this parent's ledger in this checkout and in every checkout `git worktree list` shows.
   - **Found in another checkout:** stop with one line, "Resume with `/ship-queue <parent>` from a session in `<that checkout>`." Make nothing: no ledger, no worktree.
   - **Ended:** its last line is `Summary: posted <time>` (Q4) or `Stopped: <reason>` (a stop): not live. Resume; after a `Stopped:` at `Phase: preflight`, run pre-flight again from step 1.
   - **A child this session started is still running** (its background task has not ended): wait for it, as Q2 step 4 says. Never start a second child for the same sub-issue.
   - **Live, held by another session:** any of these changed in the last 30 minutes, or in the last 2 hours with its last line saying it waits (`stat -f %Sm <file>` on macOS, `stat -c %y <file>` on Linux): the queue ledger, or the ship-issue or ship-plan ledger of its open `Current:` sub-issue (a `Current:` with no `Result:` after it; the paths from its `Ledger:` line, else ship-issue's and ship-plan's usual paths). A sub-issue's run takes hours and writes only its own ledgers, so the queue ledger's age alone does not show it. Stop and report, and say that answers given now are taken by `/ship-queue <parent> <KEY>: <answers>` once that session's summary is posted. **Not when this session wrote it:** a queue this session resumes after its own compaction is its own, and so are the ledgers its own children wrote.
   - **Otherwise:** resume. When the open `Current:` has no `Result:` after it, the session died during that run: write a `Lesson:`.
5. **The checkout** (*Checkout*). Then write the ledger. A resume keeps the ledger's `Checkout:`; it does not choose again.
6. **Read the parent** (the tracker's *Read an issue*, with comments and relations) **and its sub-issues** (the tracker's *List sub-issues*, then *Read an issue* for each). A parent with no sub-issues: stop with one line, "<parent> has no sub-issues."
7. **Whose sub-issue it is.** A sub-issue assigned to someone other than you, or with an open PR (the host's *Find open PRs*, by search for its key) whose author is not you: `blocked: assigned to <name>` (or `PR <url> by <name>`), and it is not run: write its `Result:` line at once, with the next action "reassign it to you, then `/ship-queue <parent>`". No comment on it: it is someone else's issue, and the summary names it. Unassigned or assigned to you: it runs.
8. **What every sub-issue would need from the config.** Every sub-issue branches from `origin/<base>`, so anything ship-issue's I3 would ask for and commit on its branch would be asked again by every sub-issue. Check the config on `<base>` for what ship-issue's I3 step 2 lists as config: `## Slack` (config, else `.claude/ship-plan.local.md`), the tracker section, an unknown config section. Any of them missing: stop with the list, and say to put it on `<base>` first.
9. **Permissions,** in a permission mode that prompts: list the exact allow lines (`Bash(<command>)`) for every gate and Prerequisites command, as ship-issue's I3 does. They go in the user's settings, so they are asked once, here.
10. **Merges that deploy:** when `## CI` `Merge deploys to:` names an environment that `## Allowed` `Merge that deploys to:` does not cover, say so now, with the exact line ship-plan section 5, step 3 would propose (none for a production-like name). The queue widens nothing. Without that line, each such sub-issue ends `awaiting merge`, and its dependents wait.
11. **Order** (Q1).
12. **Ask what is left in one batch,** with `AskUserQuestion` (at most 4 questions, the recommended option first, marked "(Recommended)"). This and `show order` are the only moments the queue asks. Each answer is an `Asked:` line and a `Ruling: user <date>`. Nothing left to ask: ask nothing.

Then rewrite the first line with `Phase: running` and start the loop, unless
`show order` waits for the OK.

## Q1. Order

First match wins:

1. **Keys in the argument:** that order, exactly. **Only those run;** every other open sub-issue is `not in this queue` in the summary. A key that is not a sub-issue of the parent is reported and ignored. `Order source: argument`.
2. **An order stated in the parent:** a line or list in its description, or in a comment by a person, that orders sub-issues by key ("Order: PROJ-124, PROJ-127, …", a numbered list of keys). Prose that only says what matters most is not an order; it is evidence for step 3. Quote the line. `Order source: parent`.
3. **Analysis.** `Order source: analysis`.
   - **Hard dependencies only:** a "blocked by" relation from the tracker's *List sub-issues*, or text in a sub-issue or the parent that says one needs the other first ("after PROJ-127", "needs PROJ-124's migration"). One `Depends:` line each, with the evidence quoted. Touching the same files or the same feature is **not** a dependency: serial order already handles conflicts.
   - **Topological order.** Between sub-issues with no dependency on each other: priority first, then what the parent says matters most (quote it), then the tracker order *List sub-issues* gives. One `Ruling:` per tie-break that is not plain tracker order.
   - **A cycle:** break it at its weakest edge (a text-only one before a tracker relation), with a `Ruling:`.

Sub-issues already in a done status category are `already done` and not run.
**`Order:` holds only the sub-issues the queue runs:** not the `already done`
ones, and not those `blocked` at Q0 step 7, which get their `Result:` line at
once. A resume checks those again (an issue reassigned to you joins at the end).
Every sub-issue already done, or `blocked` at Q0 step 7: write `Order: none` and go to Q4 at once.

**A worked-out order** (source parent or analysis) **starts at once.** With
`show order`, show the order, each `Depends:` line and each `Ruling:`, and ask
with `AskUserQuestion`: "Start in this order" (Recommended), or "Change it"
(the user's own order, which then counts as source argument).

## Q2. The loop

For each sub-issue in order:

1. **Dependencies.** A hard dependency whose last `Result:` is not `done` (or `already done`): the outcome is `waits for <KEY>`: write its `Result:` line. Comment once on the sub-issue (the tracker's *Comment*): what it waits for, and that `/ship-queue <parent>` runs it once that one is done. Next sub-issue.
2. **The checkout back to `<base>`** (*Checkout*).
3. **Write `Current: <KEY> started <time>`** and rewrite the first line's `Current:`.
4. **Run `ship-issue <KEY>` in a child session** (*Child sessions*), with this sub-issue's answers from the argument, if any (`ship-issue <KEY> <answers>`). It runs as it always does, in its queued mode (ship-issue's and ship-plan's "Queued mode (ship-queue)" sections): it never waits for the user, and ends when it can do nothing more. Wait for the child's completion notification, then write the `Cost:` line.
5. **Read the outcome from the ledgers, not from memory:** ship-issue's `.superpowers/ship-issue/<KEY-n>/ledger.md` (first and last line) in this checkout, and the ship-plan ledger its first line names, once it exists. Write the `Ledger:` line. Take the first row of the table below that matches.
6. **Write `Result: <KEY> <outcome> — <reason quoted from the ledger> — next: <action>`,** and rewrite the first line's `Current:` to `none`.
7. **When the outcome is not `done`,** comment on the sub-issue: the outcome, the reason, and the exact next action. Skip it when the comment for that outcome is already there: ship-issue's queued batch comment, or ship-plan's close-out comment ("Issue comment: not merged", "awaiting review", "base branch red").
8. **Next sub-issue.**

| Outcome | How it is read | Next action in the summary |
|---|---|---|
| `cut off` | the child's output file has `"is_error": true`, or is missing or not JSON (a usage limit, a crash), and the run reached no end: its ship-plan ledger has no `Phase: done`, no `Outcome:` line, no `Phase: 4R awaiting review` and no `Phase: 5 awaiting merge`, and its ship-issue ledger does not end `Waiting: batch …`. An `Asked: … — pending` line or a stage `blocked` in a run that was still working does not count: the run is `cut off` | rerun `/ship-queue <parent>` once the limit resets; **the queue stops** (below) |
| `done, questions pending` | ship-plan ledger `Phase: done`, with an `Asked: … — pending` line (its close-out batch: a sign-in, a follow-up, a lessons answer) | the questions; answer with `/ship-queue <parent> <KEY>: <answers>`. Counts as `done` for dependencies; the queue's `Phase: done` waits for the answers |
| `done` | ship-plan ledger `Phase: done` | none |
| `base branch red` | ship-plan ledger `Outcome: Base branch red` (its queued close-out line) | its report's reason; **the queue stops** (below) |
| `awaiting review` | ship-plan `Phase: 4R awaiting review` | who must approve, the PR, and every pending `Asked:` question with the answer line |
| `waiting for answers` | ship-issue's ledger ends `Waiting: batch …`, or the ship-plan ledger has an `Asked: … — pending` line | the numbered questions; answer with `/ship-queue <parent> <KEY>: <answers>` |
| `awaiting merge` | ship-plan `Phase: 5 awaiting merge` | the hand merge, or the `## Allowed` line ship-plan proposed |
| `not merged` | ship-plan ledger `Outcome: Not merged` | its parked reason |
| `blocked` | a stage reported `blocked`; a tracker call failed; ship-issue I0 stopped (another session holds it, a branch checked out elsewhere); the work is not code (a setting in a vendor dashboard); Q0 step 7 | what the user must do, quoted |
| `waits for <KEY>` | step 1 | finish `<KEY>` first |
| `already done` | the tracker's status | none |
| `not started` | the queue stopped before it: base branch red, a cut-off child, a busy checkout, the session ended | fix what the summary names, then `/ship-queue <parent>` |
| `not in this queue` | the argument listed other keys (Q1 step 1) | `/ship-queue <parent> <keys>` |

**Base branch red** after a sub-issue: every later PR would fail on the same
red base, and ship-plan never merges red. **The queue stops:** every sub-issue
not yet run is `not started: base branch red`, and Q4 is written at once. A
later `/ship-queue <parent>` continues once the base branch is green.

**Cut off:** a usage limit applies to every child, so the next one would be
cut off too. **The queue stops:** every sub-issue not yet run is
`not started: session limit`, then Q4 and a handoff (*Resume and session end*).
The cut-off sub-issue resumes from its own ledgers on the next `/ship-queue <parent>`.

## Q3. The review sweep

After the loop's last sub-issue, before the summary. For each sub-issue whose
last `Result:` is `awaiting review`, in queue order: write `Current: <KEY> started <time>` (Q2 step 3, so the run is queued), then run `ship-issue <KEY>`
once in a child session (*Child sessions*). ship-plan polls once (its section 4R, step 6) and merges when the review
rules are now met; read the outcome again (Q2 steps 5–7). A sub-issue that
becomes `done` here may unblock `waits for` sub-issues: run them now through
Q2, then sweep again. **Stop when a sweep changes no outcome.** No sleeping
between sweeps: a PR still waiting is in the summary.

## Q4. Summary

Written once the loop and the sweep are over, or at once when the queue stops:

1. **Needs you,** first: every sub-issue with a next action, in queue order, one numbered line each with the exact command or step. Answers for several sub-issues fit one command: `/ship-queue <parent> PROJ-124: 1A, 2B ; PROJ-127: …`.
2. **A table:** key, title, outcome, PR, merge SHA.
3. **Shipped:** one line per `done` sub-issue, what it changed.
4. **Decisions made for you:** the queue's `Ruling:` lines (order, tie-breaks, cycles), each with what it costs if wrong, and every override line not applied.

The same text goes to the parent as one comment (the tracker's *Comment*).
Then write `Summary: posted <time>` as the ledger's last line: a later run reads it as "this queue has ended" (Q0 step 4).
When every sub-issue in `Order:` is `done` (an `Order: none` counts), rewrite the first line with
`Phase: done`. Otherwise write a handoff (*Resume and session end*), so the
next session finds the queue.

## Checkout

The whole queue runs in one checkout, one sub-issue at a time.

- **At pre-flight:** the main checkout on `<base>` and clean (`git status --porcelain` prints nothing): the queue uses it. **When the main checkout is busy, read [../ship-issue/worktree.md](../ship-issue/worktree.md).** Make one worktree for the whole queue with its recipe, steps 0–7, at `<main>/.claude/worktrees/<parent key>` on a detached `origin/<base>`, and enter it. Every sub-issue runs there; worktree.md's "The ship-queue worktree" row lets ship-issue branch in it.
- **Between sub-issues,** before each run: a branch is **the queue's own** when a ledger the queue's `Ledger:` lines name records it: ship-issue's first-line `Branch:`, ship-plan's `Branch:`, `Lessons branch:` or `Docs branch:` line (a queued ship-plan writes the last two when it creates those branches). A branch named `docs/ship-plan-lessons-<yyyy-mm-dd>-<KEY-n>` for a key in `Order:` is the queue's own too, as ship-plan's queued lessons branch. On the queue's own branch with a clean tree: `git switch <base>` in the main checkout, or `git fetch origin <base>` then `git switch --detach origin/<base>` in the queue's worktree. Already there: nothing. **Anything else** (a dirty tree, a branch no ledger names): stop the queue, every sub-issue not yet run is `not started: checkout busy`, and the summary names the branch and the files. Never `git switch -f`, `--discard-changes`, stash, commit or reset.
- **Resuming a sub-issue whose branch exists** (its ship-issue ledger's first line names one, and the branch is not merged): switch to that branch before invoking ship-issue, so ship-issue's section W finds "on this issue's branch: stay".

## Child sessions

Each run of ship-issue (and, on a resume, of ship-plan) starts in its own
headless session, so this session stays small: one queue session carried five
full runs through seven compactions, and every turn re-read all of it. A child
starts with a fresh context and its own model.

1. Write `Child: <KEY> run <n> <output file>`, where `<n>` counts this sub-issue's children (1 for the first) and the output file is `.superpowers/ship-queue/<parent>/<KEY>-run<n>.json`. Then write the child's prompt, with the Write tool, to `.superpowers/ship-queue/<parent>/<KEY>-run<n>.prompt.md`:

   ```text
   Invoke the ai-skills:<skill> skill with the Skill tool, with the arguments "<arguments>". You are a ship-queue child run: nobody is watching; follow the skill's Queued mode.
   ```

   `<skill>` is `ship-issue` (or `ship-plan`), `<arguments>` what this skill would have passed it, the user's answers copied exactly. Never put the arguments on the command line: a backtick or `$(` in an answer would run in the shell.
2. Start it from the queue's checkout, with `run_in_background`:

   ```bash
   SHIP_QUEUE_PARENT=<parent> claude -p --output-format json --model <model> --effort <effort> --permission-mode <mode> < .superpowers/ship-queue/<parent>/<KEY>-run<n>.prompt.md > .superpowers/ship-queue/<parent>/<KEY>-run<n>.json
   ```

   Keep every flag, `--output-format json` above all: without it the file holds plain text and the `Cost:` line cannot be written. The prompt comes from the file on stdin (`<`). `<model>` and `<effort>` come from the config's `## Models` `Queue run` row (default `opus`, `high`), `<mode>` from `## Queue` `Child permission mode:` (default `auto`).
3. **Wait for its completion notification.** No `sleep` and no polling: the harness wakes this session when the child exits. A child runs for hours.
4. Read the result: `jq '{is_error, subtype, num_turns, total_cost_usd, duration_ms, result: ((.result // "") | .[0:400])}' <output file>`. Write `Cost: <KEY> run <n> — $<total_cost_usd>, <num_turns> turns, <duration_ms / 60000, rounded> min`. Then read the outcome from the ledgers (Q2 step 5); the JSON decides only `cut off`.

The child's queued test is `printenv SHIP_QUEUE_PARENT` plus this ledger's
`Current:` line (ship-issue's "Queued mode (ship-queue)"). It writes no
handoff of its own; the queue writes one for the whole queue.

## Resume and session end

- **When the session ends before the queue does** (a usage limit, the context running out): bring the ledger up to date, then write one handoff: the `handoff` skill when it is available, otherwise a `HANDOFF.md` next to the ledger. It names the checkout, the current sub-issue, and the resume line `/ship-queue <parent>`. The queued ship-issue and ship-plan runs write none of their own.
- **`/ship-queue <parent>` with this parent's ledger present** is a resume. Read the first line.
  - **A `Current: <KEY>` with no `Result:` after it:** that sub-issue's run was cut off. Run `ship-issue <KEY>` again in a child session (*Child sessions*), with no argument; it resumes from its own ledger. Its I0 live-run check sees a ledger this queue's previous child wrote: the queued run's exemption covers it (ship-issue's "Queued mode (ship-queue)"). Then go on with the loop.
  - **Re-read the sub-issues.** With a worked-out order, new sub-issues join at the end in analysis order, and the recorded order is kept. With an argument-given order, nothing is added.
  - **Run the loop again** over every sub-issue whose last `Result:` is not `done` or `already done`:
    - `waiting for answers` with answers in this argument: `ship-issue <KEY> <answers>`, its resume form. With none: it stays as it is, and is not invoked.
    - `done, questions pending` with answers: write `Current: <KEY> started <time>`, then run **ship-plan** in a child session with the answers (`ship-plan <answers>`); ship-issue would stop at its I0 row for a Done issue. ship-plan's queued mode takes this run's done ledger, and its section 0, step 2 applies the answers. Read the outcome again (Q2 steps 5–7). With none: it stays as it is.
    - `awaiting review`: not in the loop; the review sweep (Q3) polls it once, passing this argument's answers for it if any (`ship-issue <KEY> <answers>`).
    - `awaiting merge`, `not merged`, `blocked`, `cut off`: run `ship-issue <KEY>` in a child session; it routes to ship-plan, which resumes from its ledger. With answers for it in this argument: `ship-issue <KEY> <answers>`.
    - `waits for <KEY>`, `not started`: as new.
  - **Answers for a key with no pending question** (no `Waiting: batch` and no `Asked: … — pending` in its ledgers: already done before the queue, not in the queue, not a sub-issue): report them in the summary as not used, and never pass them to ship-issue: a run that is done is never resumed with answers it did not ask for.
  - Then Q3 and Q4 as usual.

## Runner or session

With `## Runner` `Mode: runner`, or the argument `--runner`, the ship runner runs the phases and this session only watches and relays: read [../ship-plan/runner-session.md](../ship-plan/runner-session.md) and follow it with `start queue …`, after Q0 and Q1 have computed the order and dependencies. Otherwise ignore this section; the skill runs as above.

## Red flags

| Thought | Reality |
|---|---|
| "I'll invoke ship-issue here with the Skill tool, it's quicker" | Each sub-issue runs in a child session (*Child sessions*), so this session stays small. Start the child and wait for its notification. |
| "The child hit the usage limit; I'll mark it blocked and start the next" | The limit applies to every child. `cut off`: the queue stops. |
| "I'll ask the user this now, the queue can wait" | Only Q0 and `show order` ask. After that: log it, comment, move on. |
| "This sub-issue looks independent, I'll run it although its blocker failed" | Only when no hard dependency names the blocker. A dependency means `waits for <KEY>`. |
| "They touch the same files, so one depends on the other" | Not a dependency. Serial order handles it. |
| "The base branch is red, I'll fix it before the next one" | ship-plan's red-base handling already ran. Stop the queue and report. |
| "I'll note the outcome in ship-issue's ledger" | The queue never writes a ship-issue or ship-plan ledger. Its own ledger only. |
| "I remember where the queue was" | Resume from the ledger's first line and the last `Current:`/`Result:` lines. |
| "The checkout is on a branch I don't know, I'll switch" | Only the queue's own branches, with a clean tree. Anything else stops the queue. |
| "Kai's sub-issue is open, I'll take it" | Someone else's sub-issue is `blocked`. The user reassigns it if they want it run. |
| "The config lacks `## Slack`, the first sub-issue will ask" | Every sub-issue would ask. Stop at pre-flight and have it put on `<base>`. |
| "The user listed three keys, I'll add the rest after them" | Only the listed keys run. The rest are `not in this queue`. |
| "A PR waits for approval, I'll sleep and poll" | Move on. The review sweep checks once more, without sleeping. |
