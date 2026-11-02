# Runner: the watching session

Shared by ship-issue, ship-queue, ship-plan and verify-and-fix. Read it when a
run is to go through the ship runner. The runner (`scripts/runner.mjs`, in
this folder) runs each phase as a headless `claude -p` child. This session,
the one the user started and may watch on a phone (Remote Control), only
relays: it starts the runner, reports its events, puts questions to the user
and passes the answers back.

## When

Runner mode is opt-in: `## Runner` `Mode: runner` in `.claude/ship-plan.md`,
or the argument `--runner`. Otherwise the skill runs exactly as it always has.
Not for a run that is itself a runner child (`printenv SHIP_RUNNER` prints a
folder): children never start a runner.

## Start

`<runner>` is `node <ship-plan base directory>/scripts/runner.mjs`: this
file's folder, found from the skill's base directory like any relative link.
Run from the checkout, with the Bash tool and `run_in_background`:

| Run | Command |
|---|---|
| one issue | `<runner> start issue <KEY> --permission-mode <m>` |
| a queue | `<runner> start queue <PARENT> <KEY>,<KEY>… --deps <KEY>:<DEP>,… --permission-mode <m>` |
| a plan | `<runner> start plan <path> --permission-mode <m>` |
| verify | `<runner> start verify <branch> --permission-mode <m>` (the checkout must be on `<branch>`) |

- `<m>` is `## Queue` `Child permission mode:` (default `auto`). The runner never reads it; this session passes it. `bypassPermissions` takes effect only if the user started Claude Code with `SHIP_RUNNER_ALLOW_BYPASS=1`; never set that variable in the command. Otherwise the runner says so in an event and uses `auto`.
- ship-queue does its Q0 and Q1 first (pre-flight, then the order and dependencies). It passes the order as the key list and each `Depends:` as `<KEY>:<DEP>` (`<KEY>` waits for `<DEP>`); `--deps` is left out when there are none. Every key and dep must be in the list.
- Exit code 3 and the output `held by <pid>`: another runner or its child holds this run. Tell the user; start nothing.
- The run dir is `<checkout>/.superpowers/ship-runner/<kind>-<id>/`, `/` in `<id>` written as `-` (`issue-<KEY>`, `queue-<PARENT>`, `plan-<path>`, `verify-<branch>`). `events.log` is in it.

## Watch

Start the Monitor tool (its schema is deferred: load it first if it is not
loaded), with `timeout_ms: 1800000`:

```bash
tail -n +<N> -F <run dir>/events.log | grep --line-buffered -E ' (start|done|waiting|blocked|cutoff|summary|progress) '
```

`N` is 1 for a new run. Each stdout line is one event, in the form
`<time> <KEY> <phase> <kind> <text>`.

- **Each event:** one short line to the user. `progress` lines may be batched.
- **`waiting`, `blocked`, `cutoff` and `summary`:** also send a `PushNotification`, with the key and the text. No other kind sends one.
- **The filter lists every kind a run ends on** (`cutoff`, `summary`, `blocked`, `waiting`), not only progress: a filter that drops them hides the end of the run.
- **When the monitor times out** you get one notice and nothing more. Re-arm at once from the next unread line: `wc -l < <run dir>/events.log`, plus 1, is the new `N`. Do this until `summary`.
- **`cutoff`** (a usage limit or a crash) stops the whole run. Tell the user; rerunning the same `start` command resumes from the files, once the limit resets.
- **`blocked`:** tell the user the quoted reason. The runner goes on with the other items.

## Questions

On `waiting` for an item:

1. Run `<runner> status <run dir>`. Its `Pending questions:` block lists `<KEY>: <question>` lines.
2. Ask them with `AskUserQuestion`, at most 4 per call (more: several calls), each with the recommended option first, labelled "(Recommended)".
3. **No answer** (the user is away): do nothing. The runner goes on with other work. A single issue keeps waiting by itself.
4. Write the answers, in the words of the questions' numbering (`1A, 2B`, or the text), to a file with the Write tool, in the run dir or the scratchpad. Never put answer text on a command line.
5. Run `<runner> answer <run dir> <KEY> <file>`, once per item. It writes only the answers file; the runner applies it.
6. A single issue (and a plan or a verify run) picks the file up and resumes without a restart.

## End

On `summary` (the runner has exited):

1. Print `<runner> status <run dir>`.
2. A queue exits when only waiting items remain. Ask every still-pending question in one batch (Questions, steps 2 to 5). If any were answered, run the same `start queue …` command again, with the same arguments: it uses the stored items and resumes the answered ones first. Watch again from the start (Watch, with `N` = `wc -l` + 1).
3. Finish with the skill's own summary of what the user must do, built from the ledgers.

## Red flags

| Thought | Reality |
|---|---|
| "I'll just run this phase myself" | The runner runs phases. This session only relays. |
| "I'll fix the ledger / state.json so it goes on" | Never edit a ledger or `state.json`. `answer` is the only write. |
| "I'll start the child myself" | Never. Only the runner starts children. |
| "I'll set `SHIP_RUNNER_ALLOW_BYPASS=1` for them" | Only the user does, when starting Claude Code. |
| "The monitor ended, so the run did" | A timeout is not `summary`. Re-arm. |
| "The user is away, I'll answer for them" | Do nothing; the runner goes on. |
