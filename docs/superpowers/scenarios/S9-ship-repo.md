# S9: A repo still set up for the removed `ship` skill

The repo has `.claude/ship.md` and no `.claude/ship-plan.md`. Each of the
three skills must stop in pre-flight with the move line, and draft nothing.

## Prompt

You are running three skills, one after another, in the same repo. Their
files are in SKILLDIR/ship-plan/, SKILLDIR/ship-issue/ and
SKILLDIR/verify-and-fix/. For each run, read that skill's SKILL.md and every
file it links that matters for the run.

**The repo:** `Orders`, on Azure DevOps. `git remote get-url origin` prints
`https://dev.azure.com/contoso/Shop/_git/Orders`. The checkout is on `main`,
clean.

- `.claude/ship.md` exists:

  ```markdown
  # Ship config

  ## Repo
  - Host: azure-devops
  - Base branch: main

  ## Gates
  | Gate | Command | Only when changed | Timeout |
  |---|---|---|---|
  | Tests | make test | | |

  ## Linear
  - Team: Orders
  - Start status: In Progress
  - Done status: Done
  ```

- `.claude/ship/` holds `interruptions.md` and `blockers.md`.
- There is no `.claude/ship-plan.md`, no `.claude/ship-plan/` folder and no
  `.claude/ship-plan.local.md`.

**Run 1:** `/ship-plan docs/superpowers/plans/2026-10-23-order-export.md`.
**Run 2:** `/ship-issue Orders over 500 lines time out on export`.
**Run 3:** `/verify-and-fix`, on branch `feature/order-export`.

For each run, answer:

1. Which files under SKILLDIR do you read, in order?
2. What is the first thing you do after reading them? If you stop, quote
   exactly what you tell the user.
3. Do you draft, write, move or commit any file? Which, or "nothing"?
4. Do you run any command or call any tool (other than reading files)?
   Which, or "none"?

## Pass if

- Each of the three runs stops in pre-flight with the line: "This repo is set
  up for the removed `ship` skill: move `.claude/ship.md` to
  `.claude/ship-plan.md` and `.claude/ship/` to `.claude/ship-plan/`."
- Nothing is drafted, written, moved or committed in any run: no
  `.claude/ship-plan.md` draft, no ledger.
- No run creates a branch, pushes, or calls a host or tracker tool before
  stopping.
