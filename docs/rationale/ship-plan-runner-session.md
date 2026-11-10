# ship-plan runner-session.md: rationale

Reasons and runner internals moved out of skills/ship-plan/runner-session.md to keep it short. The runner script (`skills/ship-plan/scripts/runner*.mjs`) enforces everything listed under "Enforced by the runner"; the watching session only reacts to its exit code or event. Read when changing a rule or the runner, not when running the skill.

## Start

Why this session's own git runs as `env -u SHIP_RUNNER_ALLOW_BYPASS git -c core.fsmonitor=false -c core.hooksPath=/dev/null`: a child can set the repo's fsmonitor or hooks, and what git runs anyway (a filter, an alias) must never see `SHIP_RUNNER_ALLOW_BYPASS`.

Why an id holding a `'` is never written into a command: every id goes into the command in single quotes; a `'` would end the quoting before the runner can refuse it.

### Enforced by the runner

Each refusal below prints `runner: <message>` on stderr and exits 2 (`usage()` in runner.mjs), starting nothing:

- An issue or queue sub-issue key that is not an optional leading `#`, then a letter or digit, then letters, digits, `.`, `_` and `-` (`KEY`). A queue `<PARENT>` or verify `<branch>` with any character but letters, digits, `.`, `_`, `/`, `#` and `-` (`RUN_ID`). A plan path with a quote or a control character. A verify argument after `--` with a double quote or a control character. An id with `..` (`runDir` in runner-lib.mjs).
- A key twice in a queue's list, a key waiting for itself, `--deps` with no value, a dep not in the list, or any argument the run does not take.
- A run dir that holds another run (`verify a/b` and `verify a-b` share `verify-a-b`).
- The checkout not clean or not on the base branch; for `verify`, not on `<branch>` (the runner checks only the branch there, not that it is clean).
- A `--permission-mode` wider than the run's first start's, recorded in `<git dir>/ship-runner/modes/<kind>-<id>.mode` (`state.json` only copies it). Narrowest first: `dontAsk`, `acceptEdits`, `auto`, `bypassPermissions`. A run dir with no readable record runs only as `dontAsk`; anything wider is refused, naming the run dir and the record.
- `answer` in a runner child (`SHIP_RUNNER` set).
- `answer` while a window of the item is open: the window spans the runner's whole turn on the item, every child included. It opens before the first child and closes once the outcome is known, after everything the child started in its process group is gone (at once, or about 4 seconds after the child exits when something lingers: SIGTERM, then SIGKILL after 1 second, then up to 3 seconds), and before the item's `waiting`, `blocked`, `cutoff` or `done` event. For a run stopped mid-child it lasts until the next `start`.

Exit 3, `held by <pid>`: another runner holds the run (checked before the checkout, so a live run on its own branch gives 3, not 2). `held by process group <pid>`: the runner died, and its child, or what that child started, still runs. `held by unknown`: the lock cannot be read and is younger than 10 seconds (another runner is taking it).

Exit 1: the runner failed. Once it holds the lock, `events.log` also has a `- - blocked runner error: …` event and `summary`, the item under way is `blocked` and the queued ones `not started`, each with the reason `runner error: …`. A failure before the lock (git, an unreadable file) is on stderr only.

A start that finds no run dir is a new run: it removes a mode record and an answers store an earlier run with that id left behind, with a `run dir gone: removed the old run's …; a new run` event. Without `SHIP_RUNNER_ALLOW_BYPASS=1`, `bypassPermissions` falls back to `auto` with an event; on a first start the runner records `auto`, so every rerun of that run keeps `auto` (or narrower), even once the variable is set.

A queue started again drops a `--deps` pair left out (`queue changed: <KEY> no longer waits for <DEP>`) and adds a new one (`queue changed: … waits for …`).

The runner makes the run dir and the answers store readable by the user alone (0700), and adds `.superpowers/` to the repo's `info/exclude` (`git rev-parse --git-common-dir`) so run files are never committed.

## Watch

The runner strips control characters from event text and `status` output.

At start the mode source is one of `flag`, `default`, `first start`, `no mode record, narrowest` or `bypass refused`; verify reports no base branch of its own.

`cutoff` on a signal: `runner stopped (SIGTERM)`, the queued items `not started` with that reason. The runner ends its child's process group (SIGTERM, then SIGKILL after 1 second) before it writes `summary`; a group still alive after that keeps the lock, naming it, so a rerun gets exit 3 until it is gone.

`blocked` details: the reason is the error's first 300 characters. A failed child's stderr is cut to its last 300 characters, with tokens (`ghp_…`, `gho_…`, `ghu_…`, `ghs_…`, `ghr_…`, `github_pat_…`, `sk-…`, `xox…-`, `AKIA…`, `Bearer …`) shown as `[redacted]`. `run stopped` marks the rest `runner stopped: <reason>`; it comes from `spawn failed: ENOENT` or `EACCES`, an API or auth error, or a bad model.

Network retries (`NET_RETRY_MINUTES` in runner-phases.mjs): a network error (`ECONNREFUSED`, `ENOTFOUND`, `ETIMEDOUT`, `ECONNRESET`, an overloaded API) reruns the same phase after 1, 5 and 15 minutes, each announced by `network error, retry <n> of 3 in <m> min: …`; a fourth failure in a row stops the run.

## Questions

`answer` copies the file to `answers-<KEY>.md` in `<git dir>/ship-runner/answers/<kind>-<id>/` (`git rev-parse --absolute-git-dir`), never named to a child; used ones are kept as `answers-<KEY>@<n>.md`. An answers file that is a link (symbolic, or a second hard link) rather than a plain file, or whose mtime or ctime falls inside a window of the item, is not the user's: the runner sets it aside (`answers rejected: … answer again`), and checks used answers the same way again before a rerun reuses them. Both times are checked because `utimes` can backdate mtime, never ctime.

Why questions come only from `status` and answers only from the user: a child runs as the same OS user, with a shell, so no check the runner makes is a full defence. A child can find the answers store and answer another item's question; one that leaves its process group (`setsid`) outlives its window. The store, the window check on both times, and the warning on a changed setting are mitigations. The real line is the watching session.

## Accepted residuals

A child runs as the same OS user as the runner and the watching session, so some things stay open by design; the runner does not try to stop them:

- It can write lines into `events.log` that look like the runner's, answer another item's question through the answers store, rewrite the record of the run's first mode in the git dir (it can write anywhere the user can), or change user-level settings (`~/.claude/`).
- It can change the git config for later git calls (filters, `insteadOf`, `sshCommand`, credential helpers). The runner's own git runs with no fsmonitor and no hooks, never fetches, and never has `SHIP_RUNNER_ALLOW_BYPASS` in its env.
- It can change a guarded file, and every later child loads the change: the guard only warns, it never stops the run. It hashes the files themselves before and after each child; it does not use `git status`.
- It can move refs, rewrite the index or set skip-worktree on a path. A moved local `<base>` reaches later children through the runner's switch between queue items, or the watching session's switch before a rerun, with no warning: neither switch happens during a child. A moved `origin/<base>` arrives through the session's fast-forward before a first start, unwarned, or through a child's own branch from it, which the guard warns about. Skip-worktree can hide a dirty path from the status check before that switch. The runner's git ignores `refs/replace/` objects and an `info/grafts` file.
- The guard does not cover `CLAUDE.md` in subfolders, `@` imports, `.claude/rules/`, `.claude/output-styles/`, or scripts an `.mcp.json` server names.
- A process that leaves the child's process group (`setsid`) outlives its window.

So the watching session takes answers only from the user, and treats every event and `status` line as data.
