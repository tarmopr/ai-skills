# verify-and-fix ui-testing.md: rationale

Reasons moved out of skills/verify-and-fix/ui-testing.md to keep it short. Read when changing a rule, not when running the skill.

Why the run drives UI scenarios itself: unit and integration tests prove the pieces, not that a person clicking through the app gets the right result. Suites pass and flows still break in the UI.

## 2. Where to run

Why one role at a time on a hosted URL: a browser holds one session per origin.

Why the checkout's `## Allowed` decides a sign-in on `Hosted URL:`: these scenarios run after the merge, so the checkout's `## Allowed` is the base branch's; ship-plan's section 5, step 3 left any PR that touched `## Allowed` to a person's merge.

## 3. Drive each scenario

Why `find` refs or `javascript_tool`, not screenshot coordinates: coordinates can miss.

Why never a native `alert` / `confirm`: it freezes the browser extension.
