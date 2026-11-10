# ship-plan phase-close.md: rationale

Incidents and reasons moved out of skills/ship-plan/phase-close.md to keep it short. Read when changing a rule, not when running the skill.

## 7. Close out

Why a follow-up issue is checked against the review items first: an approver once filed an issue that covered both follow-ups the I3 batch had approved; creating them as well would have split the work in two.

Why the logs are grepped for the follow-up's subject too: a run once filed a duplicate of an issue that `interruptions.md` named, because that issue's summary said "fail once", not "flaky", and the tracker text search missed it.

## 8. Lessons

Why `git fetch origin <base>` right before `git switch -c`: an earlier fetch is stale, and a lessons PR branched from it conflicts with every lessons PR that merged meanwhile.

Why open lessons PRs are merged into the new branch: so the logs build on them instead of conflicting.

Why learnings have one home each: the logs exist so the next run solves a recurring problem faster; they are not a history.

Why the shared skill files are never edited: every repo uses them, and they are published from their own git repository.

Why the lessons branch is pushed with `Answer: pending` before asking: so the lessons survive if the session ends.

Why lessons stay in the ledger during the run: editing the log files on the feature branch mixes them into the product PR.
