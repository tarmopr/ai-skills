# ship-plan phase-merge.md: rationale

Incidents and reasons moved out of skills/ship-plan/phase-merge.md to keep it short. Read when changing a rule, not when running the skill.

## 4R. Review

What the section is for: most repos require an approval from someone other than the author, and reviewers, people or an AI reviewer, leave comments. Section 4R waits for them and has `verify-and-fix` handle every comment. Steps 1 and 2 run as soon as the PR opens so the review request and the AI review go out right away.

Why one `sleep 300` at a time, never one background loop over the whole window: the user sees nothing until the loop ends, and cannot ask for status meanwhile.

Why the hand-off makes no lessons branch: the checkout stays on the feature branch, so the ledger is found again on resume.

Why a resumed run with nothing new ends with one line and no comment, lessons or window: so a `/loop` does not pile up.

## 5. Merge

Why the PR branch is fetched first: the user may already have updated it on the host.

Why a merge, never a rebase: a rebase needs a force-push.

Why never grep a file for `>>>>>>>`: a log or a doc can quote the markers in its prose. `git diff --name-only --diff-filter=U` and `git diff --cached --check` are the checks.

Why the "other copies of the same source" check runs again after merging the base: a PR that merged first may have brought its own copy.

Why reviewers are re-requested after the push: resolving a conflict can change the diff, and the push can dismiss an approval.

Why `Phase: 5 awaiting merge` ends with one line and no comment or lessons: so a `/loop` does not pile up.

Why `Commits:` is counted right before the merge: a squash merge folds the commits into one.
