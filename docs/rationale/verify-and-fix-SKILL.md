# verify-and-fix SKILL.md: rationale

Incidents and reasons moved out of skills/verify-and-fix/SKILL.md to keep it short. Read when changing a rule, not when running the skill.

## Verify and fix (intro)

- The user started this skill so they would not have to push each round.
- The blockers file is the list of things that stopped earlier runs, and the fix for each. Reading the matching entries costs a minute; rediscovering an entry costs an hour.

## The loop

- The loop was drawn as a `dot` digraph; it is now a numbered list with the same order and branches.
- Fixes cause regressions: a later round often finds bugs an earlier round's fixes introduced.

## 1. Setup

- `origin/HEAD` missing is common in a fresh clone.
- A draft lives in the repo, not in a scratch note: it is what the next run reads.
- Asking in the middle of the loop costs the user a second interruption.

## 2. Gates

- Long output left in context crowds out the rest of the loop.
- A sleep that outlasts the work idles the run.

## 4. Review round

- Agents whose definition says `model: inherit` would otherwise take whatever model the session runs on. That is why every agent gets its `## Models` row passed explicitly.
- Round 1's `code-reviewer` takes the `Final review` row because it is the run's whole-branch review.
- When the session's working directory is another repository, the `security-review` skill reviews that repository's diff instead.
- Copied code: finding a duplicated block after the push costs a CI round and a question.
- Other copies of the same source: two PRs each added a log capture sink to the same module's tests under different names, and neither saw the other.
- Reviewers never run gates in the working tree: gates hold fixed resources, and a second run collides with the first.

## 4b. PR review comments

- Without a PR there are no review comments.

## 5. Triage and fix

- The same code a third time: its design is producing the findings.
- `git add -A` sweeps in logs and drafts.

## 6. When to stop and ask

- Round 5 still has Critical or Important findings: the design is likely wrong, and more patching will not help.

## 7. Report

- The plugin's dispatch hook reads the last ledger line (`Done: …`) as "this run has ended". Under ship-plan it also reads the ship-plan ledger of the same folder name: `Phase: done` there ends this run too. A `Review:` line appended after `Done:` once the PR was merged had kept a finished run live for six hours (2026-11-10).
- A third-party flow without test credentials is the usual case for the Not tested section.
- A check the reader cannot see was skipped is worse than a failing one.

## 8. Self-improvement

- Never edit this skill's files: every repo uses them, and they are published from their own git repository.
- A blocker you got past but did not write down will stop the next run too.

## Runner mode (ship-runner)

- Nobody is watching a runner child.
