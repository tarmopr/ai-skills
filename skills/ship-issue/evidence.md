# Read-only evidence from deployed environments

How to learn what the running system actually does before designing a change.
Everything here only reads. For writes, see ship-plan's "does not authorize"
list.

## Where the sources come from

Only from the repo config's `## Evidence` section (format in ship-plan's
[config-format.md](../ship-plan/config-format.md)). Each row names a source, the
environment, and the exact read-only command or tool. **A source that is not
in the config is not used**, even if a tool for it is connected: you do not
know which environment it points at, or whether it is read-only.

`## Evidence` absent: the research is code and history only, and the baseline
is a failing test or a local reproduction.

## Kinds of source

| Kind | Read-only means | Record |
|---|---|---|
| Logs (Grafana Loki, a log CLI) | A query with a time range, never a tail left running. Count before you read: a count over 7 days says how often it happens. | The query, the range, the count, 1–3 sample lines with identifiers redacted. |
| Metrics (Prometheus, a dashboard) | A query over a range. | The query, the range, the value. |
| SQL | Only a connection or role the config marks read-only. `SELECT` only, always with a `LIMIT`, never on a primary the config does not name. | The query and row counts, never row contents with personal data. |
| HTTP (`curl` a deployed URL) | `GET` and `HEAD` only, with no sign-in unless the config names a test user. | The exact command and the response status and the part of the body that will change. |

## The baseline

The point of the research is a measurement that will change when the fix
lands. Write it into the spec's acceptance section as a command anyone can
rerun, with its current output. That command becomes a row in the plan's
Scenarios table.

## Personal and sensitive data

Never copy personal data, credentials or tokens into the spec, the plan, the
ledger, Jira or a PR. Quote counts and redacted samples. If the evidence cannot
be shown without such data, describe it and say where it can be found.

## When a source is refused

A refused query (permission mode, auth, a read-only guard) is not retried
through another route. Record it as a `Lesson:`, skip the source, and fall back
to a test baseline. If the refusal is a missing auth the user can fix, it goes
in the I3 batch.
