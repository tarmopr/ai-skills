# ship-plan SKILL.md: rationale

Incidents and reasons moved out of skills/ship-plan/SKILL.md to keep it short. Read when changing a rule, not when running the skill.

## The run

"This session reads little itself": Every turn re-reads its whole context,
so what it reads stays expensive until the next compaction: one session ran
about 360 `grep`, `sed` and `cat` calls of its own at a median context of
300k tokens.

### Reading the logs

`blockers.md` and the `interruptions.md` files are kept under a size budget
(section 8), and every turn re-reads whatever they put in context.

When unsure whether a heading matches, read the entry: a heading costs one line,
a missed entry costs a rediscovery.

## Red flags

"One background loop over the whole review window is simpler": Through a two-hour loop the user sees nothing and cannot ask.

## Removed rules

- **The `ship` migration shim** (2026-11-10, lean wave 2): ship-plan, ship-issue and verify-and-fix stopped when `.claude/ship.md` existed without `.claude/ship-plan.md`, telling the user to move the config. Every repo had migrated, so the line cost every run tokens for nothing. A repo still on `.claude/ship.md` now gets a drafted config like any unconfigured repo. Scenario S9 retired with it.
- **The held-spec docs PR** (2026-11-10, lean wave 2): when a repo's agent instructions kept docs and code in separate PRs, ship-issue held the spec in the ledger directory and ship-plan's close-out opened a docs PR after the merge (`docs-pr.md`, a `Docs PR:` ledger line, a `Docs branch:` line for the queue). Only one repo used it. The spec is now always committed on the feature branch; a repo that needs the split adds it in its own override.
