# ship-issue phase-spec.md: rationale

Incidents and reasons moved out of skills/ship-issue/phase-spec.md to keep it short. Read when changing a rule, not when running the skill.

## I0. Route: what already exists

Why a key is never taken from a branch this run did not start: it is someone else's work.

Why a ledger changed in the last 2 hours with a waiting last line counts as live: ship-plan's longest planned wait is 20 minutes, so a waiting ledger can stay untouched far longer than 30 minutes while its session is alive.

Why a live run stops this one: two sessions resuming the same run cause double reruns, merges and comments. A ledger older than the windows means the session died.

Why a worktree-isolated session stops when the issue's branch is in the main checkout: git does not allow the same branch in two worktrees.

## I1. The issue

Why the fail list is written out here rather than referenced to ship-plan's confidence test (phase-verify.md, section 3): it adds "needs a migration", which sizing and the `--small` resize rule in stage-prompts.md both use.

## I2. Research and spec: the Spec stage

Why the branch type is one of ship-plan's five even when the config lists others: ship-plan's pre-approved push patterns match only those five, and any other type makes every push prompt.

Why every PR the issue names is fetched now: an issue written minutes earlier can already be stale; it can describe a PR without a change the PR gained minutes before.

Why never a second worktree for the spec or the docs: a worktree-isolated session's stage cannot write to one or enter it, and a docs PR opened before the code PR merges falls behind the base branch and loses its approval.

Why a red base branch goes in the spec: a red base branch from someone else's work will fail this PR's checks too.

Why the session never re-checks the stage's research: that would load into this session the context the stage exists to keep out of it.

## I3. The one question batch

Why the answer line is `/ship-issue <KEY-n> <your answers>` (with `--session` under `Mode: runner`): that form restarts the skill, renews its pre-approval (a plain reply clears it), and resumes from the ledger.

Why the issue is updated as soon as answers arrive, links included: the user reads the issue to see where the run stands; a dependency that is only in the ledger is invisible to them.
