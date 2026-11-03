# Ship an issue: plan phase

Sections I4 and I5 of [ship-issue](SKILL.md). Everything in SKILL.md applies here.

## I4. Plan: the Plan stage

Starts once the spec holds no `[pending Q<n>` marker.

1. **Dispatch the Plan stage** ([stage-prompts.md](stage-prompts.md)) with the `Plan stage` row of `## Models` (default `opus`, `high`). It gets the spec path, not this conversation: a gap it finds is a gap in the spec. It writes `docs/superpowers/plans/<yyyy-mm-dd>-<KEY-n>-<slug>.md` with the **Scenarios** table for verify-and-fix and the **Close-out notes for ship-plan**, and leaves the `From ship-issue` block empty.
2. **Take the report in** as in I2 step 6. Its `Parked:` lines are ship-plan's to ask at close-out; they stay `[needs a decision]` in the plan.
3. **Fill the `From ship-issue` block** with every `Ruling:`, `Parked:`, `Asked:`, `Lesson:` and `Used:` line from this skill's ledger, verbatim. **When the spec is held for a docs PR** (I2 step 3), add one line for ship-plan's close-out (its section 7, step 2): `Docs PR: <held spec path> → docs/superpowers/specs/<file name>; also <each other docs change the spec's delivery section lists, or "nothing else">`. Commit the plan on the branch unless `git check-ignore -q <plan path>` says it is ignored: ship-plan's pre-flight parks a dirty tree it did not make.

## I5. Tracker

Skipped with no issue (`Tracker: none`): ship-plan puts the plan in the PR body.

1. Append the plan to the description as templates-issue.md's "Plan appended" says, with the tracker's *Append the plan*: it holds what is appended, the size limit and its fallback. Never overwrite what the user wrote.
2. The tracker's *Comment*: the rulings made so far, and the batch answers. Links between issues are made as the tracker's *Link two issues* says (I3).
3. **The local plan file is authoritative.** The tracker's conversion of markdown can reflow lists, code and links. ship-plan always gets the file, never the issue text.
