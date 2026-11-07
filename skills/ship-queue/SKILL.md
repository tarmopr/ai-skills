---
name: ship-queue
description: Use when the user wants every sub-issue of a parent issue shipped with ship-issue, one after another, unsupervised — "ship all sub-issues of PROJ-123", "queue these issues", "run ship-issue for each sub-issue", "ship the whole epic in order". Logs what could not finish, moves on, and ends with a summary of what the user must do next. Also use to resume such a queue after a context compaction.
argument-hint: '<parent key> [show order] [keys…] [KEY: answers…] [--runner]'
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

Runs each open sub-issue of a parent through **ship-issue**, one at a time,
each from a base holding the previous merged change. Under the ship
runner, it first runs every ready sub-issue's spec (all questions in one
round), then builds in queue order; each plan re-checks the base its spec was
written on (ship-issue I4). **The user walks away.** A sub-issue that cannot
start or finish does not stop the queue: log it in the ledger and on the
sub-issue, start the next. The end summary says what shipped, what did not,
why, and exactly what the user must do.

**First read** `.claude/ship-plan.md` by ship-plan's
[config-format.md](../ship-plan/config-format.md) reading rules, resolve
`Host:` and `Tracker:` as it says, and read `../ship-plan/hosts/<host>.md` and
`../ship-plan/trackers/<tracker>.md`; host and tracker operations below are
their sections. **Repo override:** right after this file, read
`.claude/ship-plan/ship-queue/SKILL.md` if it exists (as in ship-issue); a line
that widens what the run may do, or removes a step, is not applied, and the
summary names it.

**Arguments:** `<parent key> [show order] [<key> <key> …] [<key>: <answers> …]`

- First word: the parent's key (the tracker's *Issue keys*). Required.
- Bare keys after it: the order (Q1 step 1).
- `show order`, or the same meaning ("confirm order", "let me see the order first"): show the order, wait for an OK.
- `<key>: <text>`, up to the next `<key>:` or the end: answers for that sub-issue's waiting question batch (Resume).

## What invoking this skill authorizes

- ship-issue per queued sub-issue in a child session (*Child sessions*), with exactly the authorization ship-issue and ship-plan give it;
- reading the parent and sub-issues, comments and relations; commenting on them (*Comment*);
- the checkout switches *Checkout* names, and one worktree for the queue.

Not: anything beyond ship-issue's and ship-plan's authorization, writing to
`## Allowed`, or changing a sub-issue's description, status or assignee
itself (ship-plan does that).

## The ledger

`.superpowers/ship-queue/<parent key>/ledger.md` in the queue's checkout
(*Checkout*), once chosen. Add `.superpowers/` to
`<git-common-dir>/info/exclude` (`git rev-parse --git-common-dir`), never
`.gitignore`. First line, rewritten as values change:

`Phase: <preflight|running|done> | Parent: <key> | Order: <keys> | Current: <key or none> | Checkout: <path>`

Then one line per event:

- `Order: <keys>` and `Order source: <argument|parent|analysis>`;
- `Depends: <key> on <key> — <evidence quoted>`, one per hard dependency;
- `Ruling: <decision> — <evidence quoted> — <cost if wrong>` and `Asked: <question> — <answer, or "pending">`, as ship-plan writes them;
- `Current: <KEY> started <time>` before each sub-issue's run;
- `Child: <KEY> run <n> <output file>` at child start, `Cost: <KEY> run <n> — $<total_cost_usd>, <num_turns> turns, <minutes> min` when it ends;
- `Ledger: <KEY> <ship-issue ledger path> <ship-plan ledger path or "none">` once known;
- `Result: <KEY> <outcome> — <reason quoted> — next: <action>` when it ends;
- `Lesson: <what> — <the step that would have caught it>`.

**The queue never writes a ship-issue or ship-plan ledger,** only reads them (ship-plan
would take the line as its own run's).

**After a compaction, resume from the first line and last `Current:` /
`Result:` lines, not memory.**

## Q0. Pre-flight

Find now, while the user is probably there, whatever would stop every sub-issue. Every stop after step 5 (the ledger exists) writes `Stopped: <reason>` as the ledger's last line.

1. **Config.** No `.claude/ship-plan.md`, or no section for its `Tracker:`: stop with "Run `/ship-issue <one sub-issue key>` first: it drafts the config this queue needs." Draft no config.
2. **Tracker.** `Tracker: github` or `none`: stop with "ship-queue needs a tracker with sub-issues: Linear or Jira."
3. **Auth,** in parallel: host *Auth check* (and your login, as it says), tracker *Auth*. A failure stops the queue; report the exact error.
4. **A live queue.** Look for this parent's ledger in every checkout `git worktree list` shows.
   - **In another checkout:** stop with "Resume with `/ship-queue <parent>` from a session in `<that checkout>`." Make no ledger, no worktree.
   - **Ended** (last line `Summary: posted <time>` or `Stopped: <reason>`): resume; after a `Stopped:` at `Phase: preflight`, from step 1.
   - **A child this session started still runs:** wait for it (Q2 step 4). Never start a second child for one sub-issue.
   - **Live, held by another session:** the queue ledger, or the ship-issue or ship-plan ledger of the open `Current:` (no `Result:` after it; paths from its `Ledger:` line, else the usual ones), changed in the last 30 minutes, or 2 hours if its last line says it waits (`stat -f %Sm <file>` macOS, `stat -c %y <file>` Linux). (The queue ledger's age alone misses a running sub-issue.) Stop and report, saying answers are taken by `/ship-queue <parent> <KEY>: <answers>` once that session's summary is posted. **Not** a queue this session resumes after its own compaction, or its own children's ledgers.
   - **Otherwise:** resume; an open `Current:` (session died mid-run) gets a `Lesson:`.
5. **The checkout** (*Checkout*), then write the ledger. A resume keeps the ledger's `Checkout:`.
6. **Read the parent** (*Read an issue*, comments and relations) **and sub-issues** (*List sub-issues*, *Read an issue* each). None: stop with "<parent> has no sub-issues."
7. **Whose sub-issue it is.** Assigned to someone else, or an open PR (host *Find open PRs*, by its key) by someone else: `blocked: assigned to <name>` (or `PR <url> by <name>`), not run; write its `Result:` at once, next action "reassign it to you, then `/ship-queue <parent>`". No comment on it. Unassigned or yours: it runs.
8. **Config every sub-issue needs** (each branches from `origin/<base>` and would ask again). On `<base>`, check what ship-issue's I3 step 2 lists: `## Slack` (config, else `.claude/ship-plan.local.md`), the tracker section, an unknown config section. Any missing: stop with the list; say to put it on `<base>` first.
9. **Permissions,** in a prompting permission mode: list the exact allow lines (`Bash(<command>)`) for every gate and Prerequisites command, as I3 does, for the user's settings.
10. **Merges that deploy:** `## CI` `Merge deploys to:` names an environment `## Allowed` `Merge that deploys to:` does not cover: say so, with the exact line ship-plan section 5, step 3 ([phase-merge.md](../ship-plan/phase-merge.md)) would propose (none for a production-like name). Widen nothing; such sub-issues end `awaiting merge`, and their dependents wait.
11. **Order** (Q1).
12. **Ask what is left in one batch** with `AskUserQuestion` (at most 4 questions, recommended option first, marked "(Recommended)"); only this and `show order` ever ask. Each answer: an `Asked:` line and a `Ruling: user <date>`. Nothing left: ask nothing.

Then set the first line's `Phase: running` and start the loop (after the OK, with `show order`).

## Q1. Order

First match wins:

1. **Keys in the argument:** that order, exactly. **Only those run;** other open sub-issues are `not in this queue`. A key not a sub-issue of the parent: report, ignore. `Order source: argument`.
2. **An order stated in the parent** (description, or a person's comment) by key ("Order: PROJ-124, PROJ-127, …", a numbered key list); quote it. Prose on what matters most is only evidence for step 3. `Order source: parent`.
3. **Analysis.** `Order source: analysis`.
   - **Hard dependencies only:** a "blocked by" relation (*List sub-issues*), or text in a sub-issue or the parent saying one needs the other first ("after PROJ-127", "needs PROJ-124's migration"). One `Depends:` each, evidence quoted. Same files or feature is **not** one.
   - **Topological order.** Ties: priority, then what the parent says matters most (quoted), then *List sub-issues* order. One `Ruling:` per tie-break that is not plain tracker order.
   - **A cycle:** break its weakest edge (text-only before a tracker relation), with a `Ruling:`.

Sub-issues in a done status category are `already done`, not run.
**`Order:` holds only what runs:** not `already done`, not `blocked` at Q0
step 7. A resume re-checks those (one reassigned to you joins at the end).
None left: `Order: none`, go to Q4.

**A worked-out order** (parent or analysis) **starts at once.** With `show
order`, show it with each `Depends:` and `Ruling:`, and `AskUserQuestion`:
"Start in this order" (Recommended) or "Change it" (the user's order; source argument).

## Q2. The loop

For each sub-issue in order:

1. **Dependencies.** A hard dependency whose last `Result:` is not `done` or `already done`: write `Result:` `waits for <KEY>`, and comment once on the sub-issue what it waits for and that `/ship-queue <parent>` runs it after. Next sub-issue.
2. **The checkout back to `<base>`** (*Checkout*).
3. **Write `Current: <KEY> started <time>`** and rewrite the first line's `Current:`.
4. **Run `ship-issue <KEY>` in a child session** (*Child sessions*), with its answers from the argument if any (`ship-issue <KEY> <answers>`), in queued mode (ship-issue's and ship-plan's "Queued mode (ship-queue)"): it never waits for the user and ends when it can do nothing more. On its completion notification, write `Cost:`.
5. **Read the outcome from the ledgers, not memory:** ship-issue's `.superpowers/ship-issue/<KEY-n>/ledger.md` (first and last line) here, and the ship-plan ledger its first line names, once it exists. Write `Ledger:`. First matching row below wins.
6. **Write `Result: <KEY> <outcome> — <reason quoted from the ledger> — next: <action>`,** and set the first line's `Current:` to `none`.
7. **Not `done`:** comment outcome, reason and exact next action on the sub-issue, unless that outcome's comment exists (ship-issue's queued batch comment, or ship-plan's close-out comment: "Issue comment: not merged", "awaiting review", "base branch red").
8. **Next sub-issue.**

| Outcome | How it is read | Next action in the summary |
|---|---|---|
| `cut off` | output file has `"is_error": true`, is missing or not JSON, and no end reached: ship-plan ledger lacks `Phase: done`, `Outcome:`, `Phase: 4R awaiting review`, `Phase: 5 awaiting merge`; ship-issue ledger does not end `Waiting: batch …`. A pending `Asked:` or stage `blocked` in a run still working does not count | rerun `/ship-queue <parent>` once the limit resets; **the queue stops** |
| `done, questions pending` | ship-plan `Phase: done` plus `Asked: … — pending` (close-out: sign-in, follow-up, lessons) | the questions, answered by `/ship-queue <parent> <KEY>: <answers>`. `done` for dependencies; the queue's `Phase: done` waits for answers |
| `done` | ship-plan `Phase: done` | none |
| `base branch red` | ship-plan `Outcome: Base branch red` (queued close-out line) | its report's reason; **the queue stops** |
| `awaiting review` | ship-plan `Phase: 4R awaiting review` | who must approve, the PR, every pending `Asked:` question with the answer line |
| `waiting for answers` | ship-issue ledger ends `Waiting: batch …`, or ship-plan has `Asked: … — pending` | the numbered questions, answered by `/ship-queue <parent> <KEY>: <answers>` |
| `awaiting merge` | ship-plan `Phase: 5 awaiting merge` | the hand merge, or the `## Allowed` line ship-plan proposed |
| `not merged` | ship-plan `Outcome: Not merged` | its parked reason |
| `blocked` | a stage `blocked`; a tracker call failed; ship-issue I0 stopped (another session, branch checked out elsewhere); not code (vendor dashboard setting); Q0 step 7 | what the user must do, quoted |
| `waits for <KEY>` | step 1 | finish `<KEY>` first |
| `already done` | tracker status | none |
| `not started` | queue stopped first: red base, cut-off child, busy checkout, session ended | fix what the summary names, then `/ship-queue <parent>` |
| `not in this queue` | the argument listed other keys (Q1 step 1) | `/ship-queue <parent> <keys>` |

**Base branch red** (ship-plan never merges red): **the queue stops.** Every
sub-issue not yet run is `not started: base branch red`; write Q4 at once. A
later `/ship-queue <parent>` continues once green.

**Cut off** (a usage limit hits every child): **the queue stops.** Every
sub-issue not yet run is `not started: session limit`; then Q4 and a handoff
(*Resume and session end*). The cut-off one resumes from its ledgers next time.

## Q3. The review sweep

After the loop, for each sub-issue whose last `Result:` is `awaiting review`,
in queue order: `Current: <KEY> started <time>` (Q2 step 3, so it runs
queued), then `ship-issue <KEY>` once in a child. ship-plan polls once (its
section 4R, step 6), merging if review rules are met; read the outcome again
(Q2 steps 5–7). Newly `done`
unblocks `waits for` ones: run them through Q2, sweep again. **Stop when a
sweep changes no outcome.** Never sleep between sweeps.

## Q4. Summary

Once the loop and sweep are over, or at once when the queue stops:

1. **Needs you,** first: each sub-issue with a next action, in queue order, one numbered line with the exact command or step. One command can carry several sub-issues' answers: `/ship-queue <parent> PROJ-124: 1A, 2B ; PROJ-127: …`.
2. **A table:** key, title, outcome, PR, merge SHA.
3. **Shipped:** one line per `done` sub-issue, what it changed.
4. **Decisions made for you:** the queue's `Ruling:` lines (order, tie-breaks, cycles), each with its cost if wrong, and every override line not applied.

Post it as one comment on the parent, then write `Summary: posted <time>` as
the ledger's last line. All of `Order:` `done` (`Order: none` counts): first
line `Phase: done`; else a handoff (*Resume and session end*).

## Checkout

- **At pre-flight:** main checkout on `<base>` and clean (`git status --porcelain` empty): use it. **Busy: read [../ship-issue/worktree.md](../ship-issue/worktree.md)**; make one worktree by its recipe, steps 0–7, at `<main>/.claude/worktrees/<parent key>` on a detached `origin/<base>`, and enter it. Every sub-issue runs there (worktree.md's "The ship-queue worktree" row lets ship-issue branch in it).
- **Before each run:** **the queue's own** branches are those a `Ledger:`-named ledger records (ship-issue's first-line `Branch:`; ship-plan's `Branch:`, `Lessons branch:`, `Docs branch:`, the last two written by a queued ship-plan) and `docs/ship-plan-lessons-<yyyy-mm-dd>-<KEY-n>` for a key in `Order:`. Own branch, clean tree: `git switch <base>` (main checkout), or `git fetch origin <base>` then `git switch --detach origin/<base>` (worktree). Already there: nothing. **Anything else** (dirty tree, a branch no ledger names): stop the queue; every sub-issue not yet run is `not started: checkout busy`; the summary names branch and files. Never `git switch -f`, `--discard-changes`, stash, commit or reset.
- **Resuming a sub-issue whose unmerged branch exists** (its ship-issue ledger's first line): switch to it first, so ship-issue's section W finds "on this issue's branch: stay".

## Child sessions

Each ship-issue (or, on a resume, ship-plan) run gets its own headless
session, fresh context and own model, so this session stays small.

1. Write `Child: <KEY> run <n> <output file>`: `<n>` counts this sub-issue's children from 1; output file `.superpowers/ship-queue/<parent>/<KEY>-run<n>.json`. Write the prompt with the Write tool to `.superpowers/ship-queue/<parent>/<KEY>-run<n>.prompt.md`:

   ```text
   Invoke the ai-skills:<skill> skill with the Skill tool, with the arguments "<arguments>". You are a ship-queue child run: nobody is watching; follow the skill's Queued mode.
   ```

   `<skill>`: `ship-issue` (or `ship-plan`); `<arguments>`: what this skill would pass, answers copied exactly. Never put arguments on the command line (a backtick or `$(` would run).
2. Start it from the queue's checkout with `run_in_background`:

   ```bash
   SHIP_QUEUE_PARENT=<parent> claude -p --output-format json --model <model> --effort <effort> --permission-mode <mode> [--add-dir <store>] < .superpowers/ship-queue/<parent>/<KEY>-run<n>.prompt.md > .superpowers/ship-queue/<parent>/<KEY>-run<n>.json
   ```

   Keep every flag, above all `--output-format json` (without it there is no JSON and no `Cost:`). `<model>`, `<effort>`: `## Models` `Queue run` row (default `opus`, `high`); `<mode>`: `## Queue` `Child permission mode:` (default `auto`). `--add-dir <store>` only under [`## Logs`](../ship-plan/config-format.md#-logs) `Location: local` when the checkout is a linked worktree of a clone with a store (else a child cannot write it under `acceptEdits` or `dontAsk`). `<store>`: the parent of `git rev-parse --path-format=absolute --git-common-dir` plus `/.superpowers/ship-logs`, found once at queue start. Before each child, per folder in order (`.superpowers`, then `ship-logs`): `test -L` / `test -d`, `mkdir -m 700` if missing; a symlink or non-folder: pass no `--add-dir` and say so in the report.
3. **Wait for its completion notification.** No `sleep`, no polling.
4. `jq '{is_error, subtype, num_turns, total_cost_usd, duration_ms, result: ((.result // "") | .[0:400])}' <output file>`. Write `Cost: <KEY> run <n> — $<total_cost_usd>, <num_turns> turns, <duration_ms / 60000, rounded> min`. The JSON decides only `cut off`; the ledgers decide the rest (Q2 step 5).

A child detects queued mode by `printenv SHIP_QUEUE_PARENT` plus this
ledger's `Current:` (ship-issue's "Queued mode (ship-queue)"). Only the queue
writes a handoff.

## Resume and session end

- **Session ends before the queue** (usage limit, context out): update the ledger, then write one handoff (`handoff` skill, else `HANDOFF.md` next to the ledger): checkout, current sub-issue, resume line `/ship-queue <parent>`.
- **`/ship-queue <parent>` with this parent's ledger present** is a resume. Read the first line.
  - **`Current: <KEY>` with no `Result:` after it:** cut off. Rerun `ship-issue <KEY>` in a child, no argument; it resumes from its ledger (the queued exemption in ship-issue's "Queued mode (ship-queue)" covers its I0 live-run check). Continue the loop.
  - **Re-read the sub-issues.** Worked-out order: kept; new ones join at the end in analysis order. Argument order: nothing added.
  - **Work out the dependencies again** (Q1's *Hard dependencies only*) from the parent and sub-issues as they read now: a new `Depends:` line each, and a `Ruling:` naming each earlier `Depends:` that no longer holds. An earlier `Ruling:`, `Stopped:` line or start command is never evidence for one. Runner mode: `start queue` takes this full set (*Runner or session*), never the earlier command's.
  - **Rerun the loop** over every sub-issue whose last `Result:` is not `done` or `already done`:
    - `waiting for answers`: with answers here, `ship-issue <KEY> <answers>`; none: not invoked.
    - `done, questions pending` with answers: write `Current: <KEY> started <time>`, run **ship-plan** in a child (`ship-plan <answers>`; ship-issue would stop at I0 for a Done issue); its queued mode takes this done ledger, its section 0, step 2 applies the answers. Read the outcome again (Q2 steps 5–7). None: stays.
    - `awaiting review`: not in the loop; Q3 polls it once, with its answers if any (`ship-issue <KEY> <answers>`).
    - `awaiting merge`, `not merged`, `blocked`, `cut off`: `ship-issue <KEY>` (or `ship-issue <KEY> <answers>`) in a child; it routes to ship-plan, which resumes.
    - `waits for <KEY>`, `not started`: as new.
  - **Answers for a key with no pending question** (no `Waiting: batch` or `Asked: … — pending` in its ledgers): report as not used in the summary; never pass them to ship-issue.
  - Then Q3 and Q4.

## Runner or session

With `## Runner` `Mode: runner`, or a `--runner` flag, the ship runner runs the phases; this session only watches and relays: after Q0 and Q1, follow [../ship-plan/runner-session.md](../ship-plan/runner-session.md) with `start queue …`. Otherwise ignore this section.

- **`--runner` is a flag only as a whole word at the start or end of the argument** (`BILL-800 --runner`); read the argument without it. Elsewhere, or inside a word (e.g. in a `<KEY>: <answers>` part), it is text. It is never the parent key, a sub-issue key, `show order` or answers.

## Red flags

| Thought | Reality |
|---|---|
| "I'll run ship-issue here with the Skill tool" | Child session; wait for its notification. |
| "Usage limit hit; mark it blocked, start the next" | It hits every child. `cut off`: queue stops. |
| "I'll ask the user now" | Only Q0 and `show order` ask. Then: log, comment, move on. |
| "It looks independent of its failed blocker" | Only if no hard dependency names it; else `waits for <KEY>`. |
| "Same files, so a dependency" | Not a dependency; serial order handles it. |
| "Base red, I'll fix it first" | ship-plan already handled it. Stop, report. |
| "Note it in ship-issue's ledger" | Only the queue's own ledger. |
| "I remember where the queue was" | Resume from the ledger. |
| "Unknown branch, I'll switch" | Only the queue's own branches, clean tree. Else stop. |
| "Kai's sub-issue is open, I'll take it" | `blocked`; the user reassigns it. |
| "No `## Slack`; the first sub-issue will ask" | Every one would. Stop at pre-flight; put it on `<base>`. |
| "Three keys listed; I'll add the rest" | Only listed keys run; the rest are `not in this queue`. |
| "PR awaits approval; sleep and poll" | Move on; the sweep checks once, no sleeping. |
