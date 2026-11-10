# verify-and-fix: lessons when run on its own

Under `ship-plan` this file does not apply: SKILL.md section 8's `Lesson:` lines do.

Update `<logs>/ship-plan/blockers.md` (create it from
[log-formats.md](../ship-plan/log-formats.md) if missing). Under `## Logs` `Location: local`
([format](../ship-plan/config-format.md#-logs)) that is the local store, edited in place, never
committed (before the first write to a store holding no log, copy the tracked logs in and add
`.superpowers/` to `info/exclude`, as `## Logs` says); items below that would write a tracked file (an override file, the config)
are proposed in the report instead, with exact text and target file; the report names the store's path.

- **`blockers.md`, run on its own,** follows ship-plan's section 8 rules for logs
  ([phase-close.md](../ship-plan/phase-close.md)): list the headings first and
  update a matching entry (correct, extend, bump `Seen`), never a second; a new
  entry only for a problem that would recur, in [log-formats.md](../ship-plan/log-formats.md)'s
  compact format; upkeep for the entries it touches (bump `Seen` on each `Used:`
  line, merge, delete one fixed at the root); the 16 KB budget, compacting once
  before adding when over. Upkeep and compaction run in one writer subagent at
  the `Research` row, as there. A one-off stays in the ledger.
- **A lesson only this repo needs** (a step, a fact, a failure path, a test
  value): write it into the matching override file
  `.claude/ship-plan/verify-and-fix/<file>.md`, created if missing. It may only
  add or tighten a rule ([Repo override files](../ship-plan/config-format.md#repo-override-files)).
- **A config fact** (a missing gate, a `## UI testing` `Notes:`): write it into
  `.claude/ship-plan.md` under the narrowing rule. A reviewer by path or a
  loosening change is proposed in the report with its exact line, unless the
  user approved it in this run ([Loosening changes](../ship-plan/config-format.md#loosening-changes)).
- **A lesson for every repo** (a missing step, a step in the wrong order):
  propose it in the report as a "proposed shared-skill change", exact text, no
  repo, team or org names. Never edit this skill's files.
- **A missing permission** (a refusal, a question the user had to answer to
  allow something, an action the user did by hand): propose the exact
  `## Allowed` line in the report, with the reason; never write it
  ([`## Allowed`](../ship-plan/config-format.md#-allowed)). No entry on the
  closed list fits: propose a shared-skill change. A command the permission
  system refused is proposed as an `allowed-tools` line, never edited into settings.
- A rule for the whole repo, not this loop: propose a change to the repo's agent
  instructions file in the report; never edit it yourself.

Run on its own, leave these edits uncommitted and say so.

