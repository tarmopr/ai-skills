# S15: Loop behaviors across one run

One `ship-plan` run, followed from the branch to a session that ends early. It
checks what each implementer is given, when the prerequisites run, what each
reviewer is told, which gates a merge of the base branch reruns, how the issue
key is written in a fix-forward branch name, and what is left behind when the
session ends.

## Prompt

You are running the `ship-plan` skill. Its files are in SKILLDIR/ship-plan/
(SKILL.md and the files it links), and the skills it calls are in
SKILLDIR/verify-and-fix/ and SKILLDIR/ship-issue/. Read
SKILLDIR/ship-plan/SKILL.md and every file it links that matters for this run.

**The repo:** `acme/ledger-service` on github.com. `git remote get-url origin`
prints `git@github.com:acme/ledger-service.git`. `.github/workflows/ci.yml`
runs on `pull_request` to `main` and on `push` to `main`, with no path
filters. The checkout is the main checkout, on `main`, clean. The logs in
`.claude/ship-plan/` hold only their seed text. Its `.claude/ship-plan.md`:

```markdown
# Ship config

## Repo
- Tracker: linear
- Base branch: main
- Merge: squash
- Branch: <type>/eng-<n>-<slug>

## Prerequisites
| Command | Background | Ready when |
|---|---|---|
| make db-up | yes | make db-ready |

## Gates
| Gate | Command | Only when changed | Timeout |
|---|---|---|---|
| Lint | make lint | | |
| Unit | make test | | |
| API contract | make contract-test | api/**, openapi.yaml | |
| Migrations | make migrate-check | db/migrations/** | |

## Security extras
- Every query on `ledger_entries` filters by the caller's `account_id`.

## Fix rules
- Never edit files under `generated/`; run `make codegen` instead.

## Never do
- Never run `make db-reset`.

## CI
- Workflow: ci.yml

## Linear
- Team: Engineering (ENG)
- Start status: In Progress
- Review status: In Review
- Done status: Done

## Slack
- Channel: none
```

The repo also has one override file, `.claude/ship-plan/ship-plan/SKILL.md`:

```markdown
# Repo additions to ship-plan/SKILL.md

- CSV exports stream their rows. Never build the whole file in memory.
```

**The invocation:** `/ship-plan docs/superpowers/plans/2026-10-24-eng-123-ledger-csv-export.md`.
The plan's header has `Source: ENG-123`. It has three tasks, each tagged
`Tier: standard`, all under `src/ledger/` and `tests/ledger/`. Linear `ENG-123`
is in "Todo", unassigned.

**What the world answers, in order:**

- Every auth check passes. Pre-flight has nothing to ask.
- The three tasks finish with commits; the simplify pass makes no edits.
- `verify-and-fix` runs every gate that applies, and its first review round
  finds nothing Critical or Important.
- The PR is #81, `https://github.com/acme/ledger-service/pull/81`. Its checks
  pass, and `sam-gh` approves.
- The host's *Merge state* for #81: behind `main`. `git merge origin/main`
  merges cleanly. It brings in changes to `openapi.yaml` and `docs/api.md`,
  which this branch does not touch.
- After the push, the checks pass again, the approval stands, and #81 merges as
  `c0ffee1`.
- The `ci.yml` push run on `main` for `c0ffee1` is run 6001. It fails in
  `tests/ledger/test_export.py::test_export_header`, a test this PR added: the
  header no longer matches the field names `openapi.yaml` gained. It is a real
  failure.
- You open the fix-forward PR #82. While its checks run, you are warned that
  the session's usage limit will be reached in a few minutes, and the session
  will end before the run does.

Answer, in order:

1. Which files under SKILLDIR do you read over the whole run, in order?
2. From the moment the feature branch exists to the first implementer
   dispatch: every command and dispatch, in order.
3. The implementer dispatches: for each of the three, everything its prompt
   carries beyond the task text and the commit trailers. Quote it.
4. `verify-and-fix`'s first review round: each agent you dispatch, with its
   model and effort, and every instruction its prompt carries beyond the diff
   scope and the rulings. Quote them.
5. The merge of `origin/main` into the branch: which gates do you run after
   it, and which not? Give each gate's name and why.
6. Run 6001 is red: the commands up to the fix-forward branch, with the
   branch's exact name.
7. The session is about to end. What do you write, and where? Quote the line
   that tells the next session how to resume.

## Pass if

- `make db-up` is started with `run_in_background`, and `make db-ready` is
  polled until it exits 0, before the first implementer dispatch.
- Every implementer dispatch carries the config's `## Fix rules`,
  `## Never do` and `## Security extras` bullets, and the path
  `.claude/ship-plan/ship-plan/SKILL.md`.
- Every reviewer dispatch in `verify-and-fix`'s review round tells the agent
  not to run gates or tests and not to edit the working tree.
- After the merge of `origin/main`: Lint, Unit and API contract run again;
  Migrations does not.
- The fix-forward branch is `fix/eng-123-base-after-81`, with the key in lower
  case as the config's `Branch:` pattern writes it.
- A handoff is written before the session ends, and its resume line is
  `/ship-plan`, with no argument.
