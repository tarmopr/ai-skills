# Ship an issue: plan phase

Sections I4 and I5 of [ship-issue](SKILL.md). Everything in SKILL.md applies here.

## I4. Plan: the Plan stage

Starts once the spec holds no `[pending Q<n>` marker.

0. **The base moved since the spec?** (No `origin` remote: skip this step.) `git fetch origin <base>`, then `git diff --name-only <the spec's base commit> origin/<base>`. When a file the spec names changed (a queue item ahead of this one merged, a dependency landed), dispatch the Spec stage in mode `revise` first, with "The base branch moved: <the commits>" in place of answers; a `small` row's revise rewrites its plan too. Otherwise go on.

1. **A plan the Spec stage wrote** (a `small` row: the ledger's last `Stage:` line is `Stage: plan done <path> — combined with spec (small)`): dispatch nothing; go to step 3 with that plan. Otherwise, **dispatch the Plan stage** ([stage-prompts.md](stage-prompts.md)) with the `Plan stage` row of `## Models` (default `opus`, `high`). It gets the spec path, not this conversation: a gap it finds is a gap in the spec. It writes `docs/superpowers/plans/<yyyy-mm-dd>-<KEY-n>-<slug>.md` with the **Scenarios** table for verify-and-fix and the **Close-out notes for ship-plan**, and leaves the `From ship-issue` block empty.
2. **Take the report in** as in I2 step 6. Its `Parked:` lines are ship-plan's to ask at close-out; they stay `[needs a decision]` in the plan.
3. **Fill the `From ship-issue` block** with every `Ruling:`, `Parked:`, `Asked:`, `Lesson:` and `Used:` line from this skill's ledger, verbatim. Commit the plan on the branch unless `git check-ignore -q <plan path>` says it is ignored.

## I5. Tracker

Skipped with no issue (`Tracker: none`): ship-plan puts the plan in the PR body.

1. Append the plan to the description as templates-issue.md's "Plan appended" says, with the tracker's *Append the plan*: it holds what is appended, the size limit and its fallback. Never overwrite what the user wrote.
2. The tracker's *Comment*: the rulings made so far, and the batch answers. Links between issues are made as the tracker's *Link two issues* says (I3).
3. **The local plan file is authoritative.** ship-plan always gets the file, never the issue text.
