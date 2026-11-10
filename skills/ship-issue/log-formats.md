# Seed content for the repo's ship-issue log

`ship-issue` creates `.claude/ship-issue/interruptions.md` the first time a run
has something to write. ship-plan's section 8 commits it through the lessons PR
when the plan carries a `From ship-issue` block. `Location: local`: the local
store's `ship-issue/`, as [ship-plan's log-formats.md](../ship-plan/log-formats.md) says.

Tooling blockers do not go here: they go in `ship-plan/blockers.md`.
Research techniques for the repo go in the config's `## Evidence`.

## interruptions.md seed

````markdown
# Interruptions and standing answers (ship-issue)

Standing answers to questions ship-issue runs ask that recur. List the headings before I0 and
before every question you ask (`grep -n '^##'`; read the entries that match). A question answered
here, or in ship-plan's `interruptions.md`, is not asked again: apply the answer, record
`Ruling: standing answer <heading>` and `Used: ship-issue/interruptions.md <heading>` (or
`ship-plan/interruptions.md`). One-offs and "ask each time" answers go in no log. Budget: 8 KB.
One entry per question: update it, never add a second.
Entry: `### <the question, as a run would phrase it>`, then at most 3 lines:
`- Answer: <the rule the next run applies without asking>` (never a permission: point to the
proposed `## Allowed` line), `- Seen: <n>×, last <yyyy-mm-dd>`.
````
