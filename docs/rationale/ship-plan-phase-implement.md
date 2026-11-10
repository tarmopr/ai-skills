# ship-plan phase-implement.md: rationale

Incidents and reasons moved out of skills/ship-plan/phase-implement.md to keep it short. Read when changing a rule, not when running the skill.

## 0. Pre-flight

Why pre-flight asks everything at once: the user has just invoked the skill and is probably still there. This is the cheapest moment to ask anything, and the last one until the end.

Why ledgers are listed in every checkout: a `/loop` or a new session can start in another checkout than the run's.

Why an open run in another checkout is never worked on by switching this checkout: git refuses a branch checked out in another worktree.

Why a plan is never picked without an argument: a `/loop` left running after a run finished would start shipping something nobody asked for.

## 1. Tracker and branch

Why the key is written as the tracker's *Issue keys* says: the integration links the branch, its commits and its PR to the issue by that key.

Why `Branch:` goes in the ledger: the ledger's folder name writes `/` as `-`, so a resume cannot recover the branch name from it.

Why no worktree of its own: a fresh worktree lacks untracked files the repo needs (dependencies, env files).

Why a branch outside the five types needs allow lines: the pre-approved push and switch patterns match only `feature/`, `fix/`, `docs/`, `chore/` and `refactor/`.

## 2. Implement

Why every implementer dispatch carries the repo's rules: an implementer sees only its own prompt.

Why the tracker's commit-text rule: a closing keyword in a commit that reaches the base branch closes the issue before `Done means:` is met.

Why `## Global Constraints` goes in verbatim: the task brief holds only the task's own text, so a step that takes a value "from Global Constraints" sent an implementer to read the whole plan.

Why reports are capped at 20 lines: the session keeps every report until it compacts.

Why its final whole-branch review is skipped: `verify-and-fix`'s review round 1 is that review. Running both reviewed the same diff twice.

Why `finishing-a-development-branch` is skipped: its menu is the question this skill already answered.

Why "copy them exactly; do not substitute your own model name": implementers given the trailer lines without that sentence have written their own trailer, and a haiku implementer did so even with it.

Why the `git rebase -x … --trailer` fix: it replaces a wrong trailer, leaves a right one as it is, and changes only this task's commits. A pushed wrong trailer stays because fixing it needs a force-push, which this skill never does.

Why `model` and `effort` are never left out: an omitted model inherits this session's.

## 2b. Simplify

Why a separate pass: the per-task reviewers each see one task, so code duplicated across tasks only shows here.

Why before verification, not in the review round: it edits code, and the review agents read the code in parallel.

Why only the steps dispatch it: an agent description that says "triggered automatically" is a hint to the model; under this skill nothing runs it on its own.
