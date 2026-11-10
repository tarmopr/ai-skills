# ship-plan red-base.md: rationale

Reasons moved out of skills/ship-plan/red-base.md to keep it short. Read when changing a rule, not when running the skill.

Why a billing refusal is never rerun: a wait does not clear it, and a rerun spends an attempt.

Why a listed transient on a deploying base branch is never rerun: a rerun redeploys, and `## Allowed` never covers that.

Why each rerun is a separate command: so it matches the pre-approval.

Why the revert takes no `-m`: a squash merge is an ordinary commit.
