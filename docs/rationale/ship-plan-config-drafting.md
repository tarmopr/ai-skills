# ship-plan config-drafting.md: rationale

Reasons moved out of skills/ship-plan/config-drafting.md to keep it short. Read when changing a rule, not when running the skill.

Why CI comes first: CI already knows the repo's tech.

Why deploy, publish, upload, PR-comment and `secrets.*` steps are never gates: they are outward actions.

Why a drafted config never contains `## Allowed` or `## Logs`: only a person switches a permission on or moves the logs.
