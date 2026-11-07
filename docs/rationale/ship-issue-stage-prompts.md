# ship-issue stage-prompts.md: rationale

Incidents and reasons moved out of skills/ship-issue/stage-prompts.md to keep the stage prompts short. Read when changing a rule, not when running the skill.

## Spec stage

Why every PR the run depends on is re-checked: A PR can merge or move while the run waits on the batch.

## Research (mode new)

Why the ~80 tool-call budget: A spec stage once ran 240 turns and filled its context.

Why generated code is checked against architecture rules: Generated code breaks rules too (a generated `public` class in a project that allows one public type), and finding it here costs a spec line instead of a plan rewrite.

## Acceptance checks

A first spec once required "merge-tree reports none" against a PR that already conflicted on the base, and a `\.StartAsync\(` grep that matched the very helper calls the spec meant to allow.

## Design and spec

Why tests are sized to the change: A first spec once put two configuration values in Helm charts and tested them with a hand-written YAML reader; the reader took eight review rounds, and the user's review moved the values to `appsettings.<Environment>.json` and dropped those tests.

Why nothing is left as "the builder's call": each task's implementer sees only its own task, so a choice the spec leaves open is ruled on in the Plan stage without your research. A spec once left four, and the Plan stage had to rule on every one.

Why commit order is checked: A spec once put a new constant after the commit whose test reads it.

## Plan stage

Why the `Tier:` line: It picks the model that implements the task.

Why no closing keyword before the key: on GitHub Issues it closes the issue at merge (a spec once gave four of five without it).

Why existing-code claims are grepped: A plan once said every payment-failure log line already carried the error fields; several did not, and they surfaced across three review rounds.
