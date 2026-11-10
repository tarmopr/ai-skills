# S18: model routing, review size, a lean session, queue children

Four separate runs: how `ship-issue` sizes an issue and picks the Spec
stage's model, how `verify-and-fix` sizes and scopes its review rounds (and
what `ship-plan` no longer dispatches before it), what the session reads
itself, and how `ship-queue` runs each sub-issue in a child session. Each
`## Prompt S18<x>` is its own runner, graded by its own **Pass if** lines at
the end.

Every prompt uses this repo. Paste the block below into each prompt where it
says **[The repo]**.

**The repo:** `acme/billing-api` on github.com, main checkout at
`/work/billing-api`, on `main`, clean. `git remote get-url origin` prints
`git@github.com:acme/billing-api.git`. You are signed in to GitHub as `dana`
and to Linear as Dana. Its `.claude/ship-plan.md` (no `## Models`, no
`## Queue`):

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

The permission mode does not prompt.

## Prompt S18a

[The repo]

1. `/ship-issue BILL-610` has reached the end of I1. BILL-610, "Save button
   says 'Sumbit' on the plan page", is in Backlog, unassigned. Its
   description: "Open /plans, click Edit: the button reads 'Sumbit'.
   Expected: 'Save'. The label is in `src/pages/Plans.tsx`." What line does
   the ledger get about the issue's size? Then give the exact Agent call that
   dispatches the Spec stage (`subagent_type`, `model`, `effort`), whether
   the Spec stage runs a builder-check subagent (and at which `model` and
   `effort`), and whether I4 dispatches a Plan stage.
2. The same for `/ship-issue BILL-611`, "Add a tenant-scoped CSV export of
   invoices", whose description asks for a new `GET /tenants/<id>/invoices.csv`
   endpoint for tenant admins.
3. Back to BILL-610. The Spec stage's report says:
   `Status: done`, `File: none`, and
   `Resize: standard — the label key is shared by billing, admin and onboarding`.
   What does this session write in the ledger, and what does it dispatch next
   (mode, `model`, `effort`)?

## Prompt S18b

[The repo]

Add this section to the config:

```markdown
## Risk paths
- src/auth/**
```

1. `/verify-and-fix` on branch `feature/BILL-620-credit-meter`, no PR. The
   gates are green; this is review round 1.
   `git diff --shortstat origin/main...HEAD` prints
   `4 files changed, 90 insertions(+), 30 deletions(-)`. The files are under
   `src/billing/` and `tests/billing/`. No comment, doc or type was added. List
   every review agent and review skill the round launches, each with
   `subagent_type`, `model`, `effort`, and the diff it reviews.
2. Round 1 found one Important finding in `src/billing/meter.ts`. The
   ledger's last `Reviewed:` line names `abc1234`. The fix is commit `c0ffee1`,
   30 lines in `src/billing/meter.ts` and its test. The gates are green again.
   List round 2's agents and skills the same way, say what each reviewer is
   told to read and what it is given, and the ledger line written after the
   round.
3. Another branch: `git diff --shortstat origin/main...HEAD` prints
   `3 files changed, 40 insertions(+), 5 deletions(-)`; one of the files is
   `src/auth/session.ts`; no tests changed. List round 1's agents and skills
   the same way.
4. A `/ship-plan` run: the plan's last task has passed its task review. List
   every Agent call ship-plan makes after that and before it invokes
   `verify-and-fix`, with `subagent_type`, `model` and `effort`, or say none.

## Prompt S18c

[The repo]

A `/ship-plan` run for BILL-630 is in section 4, inside `verify-and-fix`, on
branch `feature/BILL-630-meter-cache`. The `Tests` gate failed. Its full output
is in `.superpowers/verify-and-fix/feature-BILL-630-meter-cache/tests.log`,
4,000 lines.

1. How does this session read the failing gate's output? The exact command or
   tool call.
2. The fix needs every caller of `MeterService.refresh` in the repo. Give the
   exact command or tool call this session uses to find them
   (`subagent_type`, `model`, `effort`, and what the prompt asks the report to
   be, if it is an agent).
3. The session has just been compacted. It needs the known blocker for
   `make test` from `.claude/ship-plan/blockers.md`, a 900-line file it read
   in full before the compaction. The exact command or tool call.
4. Earlier, in section 2, how did each implementer prompt end about its
   report? Quote the line.

## Prompt S18d

[The repo]

`/ship-queue BILL-700` is past pre-flight. The parent BILL-700 has three
sub-issues, BILL-701, BILL-702 and BILL-703, unassigned, in Backlog, with no
relations; no PR is open for any of them. The queue's ledger is
`/work/billing-api/.superpowers/ship-queue/BILL-700/ledger.md`, its first line
`Phase: running | Parent: BILL-700 | Order: BILL-701, BILL-702, BILL-703 | Current: none | Checkout: /work/billing-api`.
No run of BILL-701 has started before.

1. The loop reaches BILL-701, with no answers for it. Give every ledger line
   the queue writes before the run starts, and the exact tool call that starts
   the run (tool name and every parameter).
2. How does the queue wait until that run ends?
3. The run ended. Its JSON output file has `"is_error": false`,
   `"num_turns": 412`, `"total_cost_usd": 38.2`, `"duration_ms": 9000000`.
   BILL-701's ship-plan ledger's first line is `Phase: done | …`. Give every
   ledger line the queue writes now.
4. BILL-702's run ends with a JSON file holding `"is_error": true` and
   `"result": "Claude usage limit reached. Your limit resets at 3pm."`. Its
   ship-plan ledger's first line is `Phase: 2 | …`. What is BILL-702's outcome,
   what happens to BILL-703, and what does the queue do next?
5. Inside the session that runs BILL-701: how does ship-issue tell that its
   run is queued? Give the exact command or check.

## Prompt S18e

[The repo]

1. `/ship-queue BILL-700` is running BILL-702 in a child session. The child's
   JSON output file has `"is_error": true` and
   `"result": "Claude usage limit reached. Your limit resets at 3pm."`.
   BILL-702's ship-plan ledger's first line is `Phase: 2 | …`, and it holds the
   line `Asked: Q1 which export format — pending` (the run parked a question
   and kept working). BILL-703 has not run. What is BILL-702's outcome, what
   happens to BILL-703, and what next action does the summary give?
2. The queue reaches BILL-704 with the answers ``BILL-704: 1A, use `$(date)` in the name``.
   Give every tool call that starts its child session, in order, with every
   parameter.
3. Add `## Risk paths` with `- src/auth/**` to the config. `/verify-and-fix`
   on a branch whose diff touches `src/auth/session.ts` and is 60 lines.
   Round 1 found one Important finding in `src/billing/meter.ts`; its fix
   (commit `c0ffee1`, 12 lines) touches only that file and its test. List
   round 2's review agents and skills with `subagent_type`, `model`,
   `effort`, and the diff each reviews.
4. `/ship-plan` is in 4R and calls `verify-and-fix --comments`. One PR
   comment led to a fix that changes behaviour (commit `abc1234`, 40 lines);
   the whole branch is 900 lines. List the review agents and skills that run,
   with `subagent_type`, `model`, `effort`, and the diff each reviews.
5. `/ship-issue BILL-612`, sized `small`, is in the Spec stage at the
   `Spec stage (small)` row. It finds one open choice: whether the new
   "Retry" button goes left or right of "Cancel". Nothing in the repo or the
   issue points either way, and it widens no access, changes no money and
   can be undone. Does the stage write the spec or return `Resize:`?
6. After a Resize, BILL-610's ledger holds `Size: small — …` and below it
   `Size: standard — …`. The session is compacted and resumes at I2 step 4.
   Which `## Models` row does the Spec stage get?
7. `/verify-and-fix` finishes clean on its own (not under ship-plan) at
   `HEAD` `d00d1e5`. What is the last line it writes in its ledger?

## Pass if

**S18a**

- Q1: the ledger gets `Size: small — <reason>`. The Spec stage is an Agent call with `subagent_type: general-purpose`, `model: sonnet`, `effort: high`, at `Row: small`: it calls no brainstorming skill and runs no builder-check subagent, and with no question pending its report names a `Plan:` file, so I4 dispatches no Plan stage.
- Q2: `Size: standard — <reason>`. The Spec stage has `model: opus`, `effort: high`. The builder check gets `sonnet` and `high`.
- Q3: the ledger gets `Size: standard — the label key is shared by billing, admin and onboarding` (or that reason, quoted). The next dispatch is the Spec stage again, mode `new`, `model: opus`, `effort: high`.

**S18b**

- Q1: exactly two reviews: `pr-review-toolkit:code-reviewer` with `model: opus`, `effort: high` (the `Review round` row: a small diff, 120 lines and no `## Risk paths` file), and the `security-review` skill. No `silent-failure-hunter` and no `pr-test-analyzer`. Scope `git diff origin/main...HEAD`.
- Q2: scope `git diff abc1234..HEAD`. `code-reviewer` and the security review, each review agent at `model: opus`, `effort: high`. Each reviewer is told to read the whole files the delta touches, not only the hunks, and is given round 1's findings and fixes. After the round: a `Reviewed: <HEAD sha> — round 2, delta, …` line.
- Q3: the full panel: `code-reviewer` at `opus`/`xhigh`, `silent-failure-hunter` at `opus`/`high`, and the security review, on `git diff origin/main...HEAD`. No `pr-test-analyzer` (no test changed).
- Q4: no whole-branch or final code reviewer is dispatched. The only Agent call is the simplify pass, `pr-review-toolkit:code-simplifier` at `model: sonnet`, `effort: high`.

**S18c**

- Q1: this session reads only the last 60 lines itself (`tail -n 60 <log>` or the same with Read's offset). Reading more goes to an agent.
- Q2: an Agent call with `subagent_type: Explore`, `model: sonnet`, `effort: medium`, whose prompt asks for at most 30 lines with file:line quotes. This session runs no `grep` or `git grep` over the source itself.
- Q3: the heading list of `.claude/ship-plan/blockers.md` (`grep -n '^##'`), then only the matching entry (`sed -n '<from>,<to>p'`); not a full read.
- Q4: the prompt ends with "Report in at most 20 lines: status, commits, tests run with their result, concerns." (verbatim or nearly).

**S18d**

- Q1: before the run: `Current: BILL-701 started <time>`, the first line's `Current:` rewritten, and `Child: BILL-701 run 1 <path>`. The run starts with a Bash call with `run_in_background: true` whose command is `SHIP_QUEUE_PARENT=BILL-700 claude -p` with `--output-format json`, `--model opus`, `--effort high` and `--permission-mode auto` (in any order), its prompt read with `<` from a file under `.superpowers/ship-queue/BILL-700/` (written first with the Write tool) that invokes `ai-skills:ship-issue` with the arguments `BILL-701`, and its output redirected to a path under `.superpowers/ship-queue/BILL-700/`. Not the Skill tool in the queue's own session.
- Q2: it waits for the background task's completion notification. No `sleep` and no polling.
- Q3: `Cost: BILL-701 run 1 — $38.2, 412 turns, 150 min` (any rounding of the same numbers), the `Ledger:` line, and `Result: BILL-701 done — …`, with `Current:` rewritten to `none`.
- Q4: BILL-702's outcome is `cut off`. The queue stops: BILL-703 is `not started: session limit`, and BILL-702 is not recorded as `blocked`. Then the summary (Q4 of the skill) and a handoff whose resume line is `/ship-queue BILL-700`.
- Q5: `printenv SHIP_QUEUE_PARENT` prints `BILL-700`, and the queue ledger has `Current: BILL-701 started …` with no `Result: BILL-701` line after it.

**S18e**

- Q1: BILL-702 is `cut off` (the pending question does not make it `waiting for answers`). The queue stops: BILL-703 is `not started: session limit`. Next action: rerun `/ship-queue BILL-700` once the limit resets. Nothing says to wait for a green base branch.
- Q2: the answers are written to a prompt file under `.superpowers/ship-queue/BILL-700/` (Write tool), then a Bash call with `run_in_background: true` runs `SHIP_QUEUE_PARENT=BILL-700 claude -p` with `--output-format json`, `--model opus`, `--effort high`, `--permission-mode auto`, reading the prompt with `<` from that file and writing JSON to `.superpowers/ship-queue/BILL-700/BILL-704-run1.json`. The answers never appear inside a double-quoted shell argument.
- Q3: the full panel on `git diff origin/main...HEAD` (the branch touches `## Risk paths`, so every round is full): `code-reviewer`, `silent-failure-hunter`, the security review; agents at `opus`/`high` (not `xhigh`: not round 1).
- Q4: a delta round on `git diff <commit before the fixes>..HEAD`: `code-reviewer` at `opus`/`high` (the `Review round` row, not `Final review`/`xhigh`), the security review, and the agent whose finding was fixed if any; not the full panel despite the 900-line branch.
- Q5: it writes the spec: the choice fails the confidence test only on "nothing quotable points one way", which is a question, not a reason to resize. No `Resize:`.
- Q6: `Spec stage` (the last `Size:` line, `standard`): `opus`/`high`.
- Q7: `Done: d00d1e5 — clean` (or the same with its wording).

