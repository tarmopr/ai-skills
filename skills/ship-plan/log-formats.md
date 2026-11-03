# Seed content for the repo's log files

`ship-plan` and `verify-and-fix` create these in the repo, under `.claude/ship-plan/`, the first
time a run has something to write and the file is missing. They are committed
through `ship-plan`'s lessons PR, under its section 8's rules
([phase-close.md](phase-close.md)). Under `## Logs` `Location: local` they live in
the local store's `ship-plan/` instead, never committed ([config-format.md](config-format.md#-logs)).

## interruptions.md seed

````markdown
# Interruptions and standing answers

Standing answers to questions ship runs ask that recur. List the headings before pre-flight
and before every question you ask (`grep -n '^##'`; read the entries that match). A question
answered here is not asked again: apply the answer, record `Ruling: standing answer <heading>`
and `Used: ship-plan/interruptions.md <heading>`. Blockers go in [blockers.md](blockers.md); one-offs and
"ask each time" answers in no log. Budget: 8 KB. One entry per question: update it, never add a second.
Entry: `### <the question, as a run would phrase it>`, then at most 3 lines:
`- Answer: <the rule the next run applies without asking>` (never a permission: point to the
proposed `## Allowed` line), `- Seen: <n>×, last <yyyy-mm-dd>`.

## Entries
````

## blockers.md seed

```markdown
# Known blockers

Symptom → fix for tooling and environment problems that recur. Procedures go in an override
file or the config; one-offs stay in the run's ledger. Budget: 16 KB.
Read the headings before the first round (`grep -n '^##'`), then the entries that match the
tool or gate at hand; record `Used: ship-plan/blockers.md <heading>` for each one applied.
One entry per symptom: correct or extend it, never add a second.
Entry: `### <the symptom, with the exact error text>`, then at most 3 lines:
`- Fix: <the exact command or action>`, `- Cause: <only when not obvious>`, `- Seen: <n>×, last <yyyy-mm-dd>`.

## Gates and local environment

## CI

## UI
```
