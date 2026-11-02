# S19: the ship runner and its watching session

Four separate runs: how the session that started a ship run through the
runner starts it, watches it, relays a question, and resumes its watch; and
that the default `Mode: session` never touches the runner. Each
`## Prompt S19<x>` is its own runner, graded by its own **Pass if** lines at
the end.

In these prompts `SKILLDIR/ship-plan/scripts/runner.mjs` is the runner and
`SKILLDIR/ship-plan/runner-session.md` the watching session's instructions.

Every prompt uses this repo. Paste the block below into each prompt where it
says **[The repo]**.

**The repo:** `acme/billing-api` on github.com, main checkout at
`/work/billing-api`, on `main`, clean. `git remote get-url origin` prints
`git@github.com:acme/billing-api.git`. You are signed in to GitHub as `dana`
and to Linear as Dana. Its `.claude/ship-plan.md` (no `## Runner`, no
`## Models`, no `## Queue`):

```markdown
# Ship config

## Repo
- Base branch: main
- Tracker: linear

## Gates
| Gate | Command | Only when changed | Timeout |
|---|---|---|---|
| Tests | make test | | |

## CI
- Workflow: ci.yml

## Linear
- Team: BILL
- Project: Billing
- Start status: In Progress
- Review status: In Review
- Done status: Done

## Slack
- Channel: none
```

The permission mode does not prompt. The Monitor, PushNotification and
AskUserQuestion tools are deferred tools you load with ToolSearch before
first use. `printenv SHIP_RUNNER` prints nothing in the session you play.

## Prompt S19a

[The repo]

Add this section to the config:

```markdown
## Queue
- Child permission mode: acceptEdits
```

1. You type `/ship-issue BILL-700 --runner`. BILL-700, "Plan page loses the
   selected tenant on reload", is in Backlog. `.superpowers/ship-runner/`
   does not exist. List what the session does before it runs the start
   command, then give the start command (tool, parameters) and the Monitor
   call (tool, every parameter, the full command).
2. The Monitor delivers this line:
   `3 2026-11-02T22:14:05Z BILL-700 spec waiting 2 questions for the user`.
   What does the session do, in order? Give each command and tool call, and
   say whether anything is sent to the phone.
3. The next line is
   `4 2026-11-02T22:14:40Z BILL-700 spec progress reading src/pages/Plans.tsx`.
   What does the session do with it, and does it send a notification?
4. The user answers the questions: "1A, 2B". Give the commands and tool calls
   that pass the answers back, and say whether the session starts the runner
   again.

## Prompt S19b

[The repo]

Add this section to the config:

```markdown
## Runner
- Mode: runner
```

1. `/ship-queue BILL-800`. Its sub-issues are BILL-801, BILL-802 and BILL-803;
   none depends on another. Q0 and Q1 are done and the order is 801, 802,
   803. `.superpowers/ship-runner/queue-BILL-800/` does not exist. Give the
   start command and the Monitor call (all parameters).
2. Overnight BILL-801 reaches done, BILL-802 asks two questions and waits, the
   user is away, and BILL-803 reaches done. The Monitor delivered, among
   others, `17 2026-11-03T01:12:44Z BILL-802 spec waiting 2 questions for the
   user` and, last, `58 2026-11-03T05:40:09Z BILL-800 - summary 2 done, 1 waiting; cost
   $31.40`. In the morning the user types "status?". What does the session
   run, and what had it sent to the phone overnight, and for which lines?
3. The user wants to answer. How does the session ask the two questions
   (tool, how many calls, option order and labels)? Then give the commands and
   tool calls that pass the answers back, and how the queue goes on. The
   answers are "1A, 2B".
4. After the queue finishes, what does the session end with?

## Prompt S19c

[The repo]

Add this section to the config:

```markdown
## Runner
- Mode: runner
```

1. `/ship-issue BILL-700` is running through the runner. The session armed
   the Monitor from `N` = 1 before `start`. The Monitor delivered numbered
   lines up to
   `41 2026-11-02T22:49:12Z BILL-700 implement progress task 4 of 9` and then
   the 30-minute timeout ended it with one notice. Meanwhile the runner
   wrote six more lines, so `wc -l < .superpowers/ship-runner/issue-BILL-700/events.log`
   now prints 47. What does the session do? Give the Monitor call (all
   parameters, full command) and say which line the new Monitor starts at.
2. Say what the session tells the user about the timeout, and whether it
   sends a notification.
3. Instead of a timeout the session is compacted after line 41 was
   delivered, and resumes. `.superpowers/ship-runner/issue-BILL-700/state.json`
   has `"stopped": null` and the `lock` file's `runner` pid is alive. What
   does it run first, what does it not run, and where does the new Monitor
   start?

## Prompt S19d

[The repo]

Add this section to the config:

```markdown
## Runner
- Mode: session
```

1. You type `/ship-issue BILL-710`. BILL-710 is in Backlog. Does the session
   read `ship-plan/runner-session.md`? Does it run any command with
   `runner.mjs`, start a Monitor, or create `.superpowers/ship-runner/`?
   Where does the run take place?
2. You type `/ship-issue BILL-711 --runner` against the same config. What
   changes?
3. You type `/ship-plan docs/plans/export.md` (an existing plan) in the same
   repo, with no `--runner`. Does it start the runner?

## Pass if

**S19a**

- Q1: before the start command the session reads `ship-plan/runner-session.md` (the `## Runner or session` section of `ship-issue/SKILL.md` points to it), loads Monitor, PushNotification and AskUserQuestion with ToolSearch, and works out `N`: `events.log` does not exist, so `N` = 1, taken before `start`. It arms the Monitor first, then starts. Start: a Bash call with `run_in_background: true`, from `/work/billing-api`, running `node SKILLDIR/ship-plan/scripts/runner.mjs start issue BILL-700 --permission-mode acceptEdits` (keys, lists and paths may be single-quoted, `'BILL-700'`; the mode comes from `## Queue` `Child permission mode:`; the session passes it, the runner does not read the config). No `SHIP_RUNNER_ALLOW_BYPASS`. Monitor: `timeout_ms: 1800000`, command `tail -n +1 -F /work/billing-api/.superpowers/ship-runner/issue-BILL-700/events.log | awk -v n=0 '{ n++; print n " " $0; fflush() }'` (run dir `.superpowers/ship-runner/issue-BILL-700/`; spacing and a persistent flag may differ), no `grep`. The session does not run the Spec stage, the ledger or any phase itself.
- Q2: it sends a `PushNotification` with the key and the text (`BILL-700`, `2 questions for the user`) and tells the user in one short line. Then it runs `node SKILLDIR/ship-plan/scripts/runner.mjs status /work/billing-api/.superpowers/ship-runner/issue-BILL-700` and reads its `Pending questions:` block (`<KEY>: <question>` lines). It asks them with `AskUserQuestion`, one call (2 questions, at most 4 per call), the recommended option first, labelled "(Recommended)".
- Q3: one short line to the user (it may batch `progress` lines); no `PushNotification`, because only `waiting`, `blocked`, `cutoff` and `summary` send one.
- Q4: the session writes the answers (`1A, 2B`) to a file with the Write tool, in the run dir or the scratchpad, never as text on a command line, then runs `node SKILLDIR/ship-plan/scripts/runner.mjs answer /work/billing-api/.superpowers/ship-runner/issue-BILL-700 BILL-700 <file>`. It does not start the runner again: a single issue picks the answers file up and resumes without a restart. It does not edit the ledger or `state.json`.

**S19b**

- Q1: the session reads `ship-plan/runner-session.md` (via the `## Runner or session` section of `ship-queue/SKILL.md`), after Q0 and Q1. `events.log` does not exist, so `N` = 1; the Monitor is armed first, then the start. Start: Bash with `run_in_background: true`, `node SKILLDIR/ship-plan/scripts/runner.mjs start queue BILL-800 BILL-801,BILL-802,BILL-803 --permission-mode auto` (keys and the list may be single-quoted), with no `--deps` (none depend on another) and `auto` the default. Monitor: `timeout_ms: 1800000`, `tail -n +1 -F /work/billing-api/.superpowers/ship-runner/queue-BILL-800/events.log | awk -v n=0 '{ n++; print n " " $0; fflush() }'`.
- Q2: it runs `node SKILLDIR/ship-plan/scripts/runner.mjs status /work/billing-api/.superpowers/ship-runner/queue-BILL-800` and prints its table and `Pending questions:` block. Overnight it sent `PushNotification`s for `waiting` (the BILL-802 line, number 17) and `summary` (line 58), none for the `progress` or other lines. It did not stop the runner, did not answer for the user, and did not wait on BILL-802 before BILL-803 (the runner went on with BILL-803 by itself).
- Q3: one batch: the pending questions of BILL-802 asked in a single `AskUserQuestion` call (2 questions fit; a queue with more than 4 asks in several calls in the same step), recommended option first, labelled "(Recommended)". It writes `1A, 2B` to a file with the Write tool, runs `node SKILLDIR/ship-plan/scripts/runner.mjs answer /work/billing-api/.superpowers/ship-runner/queue-BILL-800 BILL-802 <file>`, once for BILL-802. `answer` writes only the answers file. Then, because the runner exited at `summary` with only a waiting item left and one was answered, it arms the Monitor first at `N` = `wc -l` + 1 of `events.log` (59 if the log has 58 lines), then runs the same `start queue BILL-800 BILL-801,BILL-802,BILL-803 --permission-mode auto` command with the same arguments: the runner uses its stored items and resumes BILL-802 first (not in parallel with anything).
- Q4: the ship-queue summary of what the user must do, built from the ledgers, after printing `runner.mjs status <run dir>` on `summary`.

**S19c**

- Q1: the session re-arms at once, with `N` = 41 + 1 = 42, the highest number delivered plus one, and not from `wc -l` (47) at re-arm time. Monitor: `timeout_ms: 1800000`, command `tail -n +42 -F /work/billing-api/.superpowers/ship-runner/issue-BILL-700/events.log | awk -v n=41 '{ n++; print n " " $0; fflush() }'`, so the next line shown is numbered 42. The six lines written in between (42 to 47) are therefore delivered, not skipped. No `grep`. It does not start the runner again.
- Q2: it tells the user the monitor timed out and was re-armed from line 42, in one short line. No `PushNotification` (only `waiting`, `blocked`, `cutoff`, `summary`). It does not treat the timeout as the end of the run: only `summary` ends it.
- Q3: the run is still going, so it does not run `start`. It runs `node SKILLDIR/ship-plan/scripts/runner.mjs status /work/billing-api/.superpowers/ship-runner/issue-BILL-700` first, then re-arms the Monitor from the last event number it reported plus one: `tail -n +42 …` with `awk -v n=41`. Only if it did not know that number would it use `wc -l` + 1 taken after the status.

**S19d**

- Q1: no. With `Mode: session` and no `--runner` the skill runs "exactly as it always has", in this session: it reads no `runner-session.md`, runs no `runner.mjs` command, starts no Monitor and creates no `.superpowers/ship-runner/`. The `## Runner or session` section says to ignore it. The run takes place in this session, starting at I0, and ends with no `RUNNER:` line.
- Q2: `--runner` selects the runner for this run: the session reads `ship-plan/runner-session.md`, works out `N`, arms the Monitor, then starts `node SKILLDIR/ship-plan/scripts/runner.mjs start issue BILL-711 --permission-mode auto`.
- Q3: no. Without `## Runner` `Mode: runner` or `--runner`, `ship-plan` runs in-session.
