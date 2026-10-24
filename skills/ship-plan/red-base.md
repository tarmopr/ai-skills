# A red base branch

Read only when the base-branch run is red (section 6, step 3 of [SKILL.md](SKILL.md)), or validation fails (section 6b, step 3).

A failed validation in section 6b that this run's diff explains enters here like a red base-branch run. It has no failed run to read: go straight to **Real** in step 1, so fix forward or revert.

1. **Red:** the host's *Read a failed run*, then classify:
   - **Transient, listed in `blockers.md`:** when `## CI` has `Merge deploys to:`, never rerun it: a rerun redeploys, and `## Allowed` never covers that ([config-format.md](config-format.md#-allowed)). Park the rerun in `questions.md` for the user, with the run's id, and go on to close-out. Otherwise the host's *Rerun a base-branch run*, then watch again (the host's *Watch a run*). Up to 3 reruns. Before the 2nd and 3rd, wait 10 and then 20 minutes: run `sleep 600` (then `sleep 1200`) with `run_in_background`, and rerun when it finishes. Keep the rerun a separate command, so it matches the pre-approval. After the 3rd, park it in `questions.md` and go on to close-out; the work is not done.
   - **A new transient** (an external service down, a registry, the network, and the same step passed on the PR): treat it as above, then add it to `blockers.md` at close-out.
   - **Real:** fix forward. `git fetch origin <base> --quiet`, then `git switch -c fix/<id-or-slug>-base-after-<pr> origin/<base>`, with `<id>` written as the config's `Branch:` pattern writes it. Find the root cause (superpowers:systematic-debugging), write a failing test, fix, run `verify-and-fix` on this branch, then do sections 4–6 again with the title "Fix <base> after #<n>: <what>".
   - **The root cause isn't found in one attempt,** or the fix is not small: revert instead. A squash merge is an ordinary commit, so run `git revert --no-edit <merge sha>` on a new branch from `origin/<base>` (`git fetch origin <base> --quiet`, then `git switch -c fix/revert-<pr> origin/<base>`; no `-m`), PR it, and merge it through the same loop. With an issue: if the issue has left the start status, set the start status again (the tracker's *Set status*), with the failure in a comment (the tracker's *Comment*). Park the question of how to reland it.
2. **At most 3 fix-forward cycles** in one run. After that, stop fixing: the base branch is red, and that is the first line of the report and of the question batch.

While a deploy step on the base branch is red, what it deploys may be
half-updated. Say so in the closing comment until it is green.
