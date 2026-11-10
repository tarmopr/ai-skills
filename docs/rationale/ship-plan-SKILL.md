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
