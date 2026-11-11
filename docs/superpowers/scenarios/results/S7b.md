**Files read:** ship-issue/SKILL.md, ship-plan/config-format.md, ship-issue/worktree.md, ship-issue/phase-spec.md, ship-plan/SKILL.md, ship-plan/hosts/github.md, ship-plan/trackers/jira.md, ship-plan/templates-issue.md

### Q1

- **Step:** Skill entry: config format, logs, host/tracker resolution, sections W and I0–I2 index.
- **Command or tool call:** none (file read)
- **Source:** ship-issue/SKILL.md (top)
- **Told or worked out:** told
- **Files read for this step:** ship-issue/SKILL.md

- **Step:** Read `.claude/ship-plan.md` in full, by its format.
- **Command or tool call:** none (file read)
- **Source:** ship-issue/SKILL.md "Before anything else, read in full"
- **Told or worked out:** told
- **Files read for this step:** ship-plan/config-format.md

- **Step:** Read the three logs by index (defines `<logs>` = `.claude/`, no `## Logs`).
- **Command or tool call:** none (file read)
- **Source:** ship-issue/SKILL.md (link to ship-plan's "Reading the logs"); ship-plan/SKILL.md "Reading the logs"
- **Told or worked out:** told
- **Files read for this step:** ship-plan/SKILL.md

- **Step:** Host from origin (`github.com` → github); tracker from `## Jira` → jira; tracker not none → issue templates.
- **Command or tool call:** none (file reads)
- **Source:** ship-issue/SKILL.md "Host and tracker"; ship-plan/config-format.md `## Repo`
- **Told or worked out:** told
- **Files read for this step:** ship-plan/hosts/github.md, ship-plan/trackers/jira.md, ship-plan/templates-issue.md

- **Step:** I0 route (BILL-450 To Do, nothing exists → I1), I1 read issue + size, then W, then I2 step 1 branch.
- **Command or tool call:** none (file read)
- **Source:** ship-issue/SKILL.md "I0"–"I2" index; ship-issue/phase-spec.md "I0", "I1", "I2"
- **Told or worked out:** told
- **Files read for this step:** ship-issue/phase-spec.md

- **Step:** Section W: main checkout on another branch and dirty → worktree rules.
- **Command or tool call:** none (file read)
- **Source:** ship-issue/SKILL.md "W. Which checkout"
- **Told or worked out:** told
- **Files read for this step:** ship-issue/worktree.md

Not read (not needed before the branch): ship-plan/config-drafting.md (config exists), ship-issue/log-formats.md (close-out), ship-issue/modes.md (no `SHIP_QUEUE_PARENT`/`SHIP_RUNNER`), ship-plan/notifiers/slack.md (`## Slack` present), ship-issue/stage-prompts.md and evidence.md (after the branch).

### Q2

- **Step:** Work in a new worktree `/work/billing-api/.claude/worktrees/BILL-450`, created detached from `origin/main`; main checkout is on another branch with uncommitted changes (someone else working). Rule: "Main checkout, on another branch or dirty (another agent or the user is working) | New worktree (recipe). Never switch, stash or commit someone else's tree, and never run its tests." Also SKILL.md: "**When the current checkout is dirty or on another branch, read [worktree.md](worktree.md).**" and Red flag "Main checkout is on another branch, I'll switch it | Someone works there: worktree recipe." Authorized by "creating and preparing a worktree when the current checkout is busy, only with section W's setup steps".
- **Command or tool call:** none (decision)
- **Source:** ship-issue/worktree.md table; ship-issue/SKILL.md "W. Which checkout", "Red flags", "What invoking this skill authorizes"
- **Told or worked out:** told
- **Files read for this step:** none new

### Q3

- **Step:** Step 0: check git runs unmodified.
- **Command or tool call:** `git status`
- **Source:** ship-issue/worktree.md "Worktree recipe" step 0
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Step 1: fetch base.
- **Command or tool call:** `git fetch origin main --quiet`
- **Source:** ship-issue/worktree.md step 1
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Step 1: find main checkout path (prints `/work/billing-api/.git`, so `<main>` = `/work/billing-api`).
- **Command or tool call:** `git rev-parse --path-format=absolute --git-common-dir`
- **Source:** ship-issue/worktree.md step 1
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Step 1: create detached worktree.
- **Command or tool call:** `git worktree add --detach /work/billing-api/.claude/worktrees/BILL-450 origin/main`
- **Source:** ship-issue/worktree.md step 1
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Step 1: enter it.
- **Command or tool call:** `EnterWorktree` with `path: /work/billing-api/.claude/worktrees/BILL-450`
- **Source:** ship-issue/worktree.md step 1
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Step 2: Prerequisites row `Background: no` (Ready when: exit 0). In a prompting permission mode: its allow line `Bash(make setup)` goes in the I3 batch and it runs after answers; otherwise now.
- **Command or tool call:** `make setup` (in /work/billing-api/.claude/worktrees/BILL-450)
- **Source:** ship-issue/worktree.md step 2; ship-issue/phase-spec.md "I3" item 2; ship-plan/config-format.md `## Prerequisites`
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Step 3: copy `## Worktree` `Copy:` file (copy, never print).
- **Command or tool call:** `cp /work/billing-api/.env /work/billing-api/.claude/worktrees/BILL-450/.env` (recipe form `cp <main>/.env .env`, run from the worktree)
- **Source:** ship-issue/worktree.md step 3; ship-plan/config-format.md `## Worktree`
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Step 4: shared resources — `Shared:` not set (default none).
- **Command or tool call:** none, no `Shared:` items
- **Source:** ship-issue/worktree.md step 4; ship-plan/config-format.md `## Worktree`
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Ledger prep: exclude `.superpowers/` (common dir `/work/billing-api/.git`).
- **Command or tool call:** `git rev-parse --git-common-dir`, then Edit tool on `/work/billing-api/.git/info/exclude` adding line `.superpowers/` (if missing)
- **Source:** ship-issue/SKILL.md "The ledger"
- **Told or worked out:** worked out (edit form)
- **Files read for this step:** none new

- **Step:** Step 6: commit hooks, once before the first commit (after the branch, before the spec commit).
- **Command or tool call:** `git hook run pre-commit`
- **Source:** ship-issue/worktree.md step 6
- **Told or worked out:** told
- **Files read for this step:** none new

### Q4

- **Step:** Create the branch in the worktree, from its detached `origin/main`; `<type>` one of feature/fix/docs/chore/refactor, key upper case.
- **Command or tool call:** `git switch -c <type>/BILL-450-<slug> origin/main` (e.g. `git switch -c feature/BILL-450-<slug> origin/main`)
- **Source:** ship-issue/phase-spec.md "I2" step 1; ship-plan/trackers/jira.md "Issue keys"; ship-plan/config-format.md `## Repo` `Branch:`
- **Told or worked out:** told
- **Files read for this step:** none new

### Q5

- **Step:** Never switch, stash or commit someone else's tree in the main checkout, and never run its tests (no gates, no Prerequisites there); don't rename or reuse it; no ledger written there (ledger goes in the chosen worktree).
- **Command or tool call:** none
- **Source:** ship-issue/worktree.md table row "Main checkout, on another branch or dirty"; ship-issue/SKILL.md "Red flags", "The ledger"
- **Told or worked out:** told
- **Files read for this step:** none new
