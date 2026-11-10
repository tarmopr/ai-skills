**Files read:**
1. ship-issue/SKILL.md
2. ship-plan/config-format.md
3. ship-plan/SKILL.md
4. ship-issue/phase-spec.md
5. ship-issue/worktree.md
6. ship-plan/hosts/github.md
7. ship-plan/trackers/jira.md
8. ship-plan/templates-issue.md

### Q1

- **Step:** Load the skill: read config and logs by index first, resolve host and tracker
- **Command or tool call:** none, reading only
- **Source:** ship-issue/SKILL.md, intro ("Before anything else, read in full `.claude/ship-plan.md`")
- **Told or worked out:** told
- **Files read for this step:** ship-issue/SKILL.md

- **Step:** Config format (how to read `.claude/ship-plan.md`; `## Worktree`, `## Prerequisites`, `Branch:` default)
- **Command or tool call:** none, reading only
- **Source:** ship-issue/SKILL.md, intro ("format: ship-plan's config-format.md")
- **Told or worked out:** told
- **Files read for this step:** ship-plan/config-format.md

- **Step:** Where `<logs>` is (Reading the logs)
- **Command or tool call:** none, reading only
- **Source:** ship-issue/SKILL.md, intro ("by index (ship-plan's Reading the logs, defining `<logs>`)")
- **Told or worked out:** told
- **Files read for this step:** ship-plan/SKILL.md

- **Step:** Host file: no `Host:`, origin `git@github.com:acme/billing-api.git` → `github`
- **Command or tool call:** none, reading only
- **Source:** ship-issue/SKILL.md, "Host and tracker" bullet; ship-plan/config-format.md, `## Repo` (`Host:` default)
- **Told or worked out:** told
- **Files read for this step:** ship-plan/hosts/github.md

- **Step:** Tracker file: `## Jira` present → `jira`
- **Command or tool call:** none, reading only
- **Source:** ship-issue/SKILL.md, "Host and tracker" bullet; ship-plan/config-format.md, `## Repo` (`Tracker:` default)
- **Told or worked out:** told
- **Files read for this step:** ship-plan/trackers/jira.md

- **Step:** Tracker is not `none` → issue templates
- **Command or tool call:** none, reading only
- **Source:** ship-issue/SKILL.md, "Host and tracker" bullet ("When `Tracker:` is not `none` ... read templates-issue.md")
- **Told or worked out:** told
- **Files read for this step:** ship-plan/templates-issue.md

- **Step:** I0 route, I1 issue, I2 step 1 branch
- **Command or tool call:** none, reading only
- **Source:** ship-issue/SKILL.md, "I0. Route" / "I1. The issue" / "I2" (see phase-spec.md)
- **Told or worked out:** told
- **Files read for this step:** ship-issue/phase-spec.md

- **Step:** Section W: main checkout dirty and on another branch → worktree recipe
- **Command or tool call:** none, reading only
- **Source:** ship-issue/SKILL.md, "W. Which checkout" ("When the current checkout is dirty or on another branch, read worktree.md")
- **Told or worked out:** told
- **Files read for this step:** ship-issue/worktree.md

(Not read: modes.md, runner files: `printenv SHIP_QUEUE_PARENT` / `printenv SHIP_RUNNER` print nothing, no `## Runner`, so session mode. config-drafting.md: config exists, no section to draft. notifiers/slack.md: `## Slack` present. stage-prompts.md, evidence.md: first needed at I2 step 4, after the branch.)

### Q2

- **Step:** Work in a new worktree at `/work/billing-api/.claude/worktrees/BILL-450`, detached on `origin/main`, then branched there
- **Command or tool call:** none, a decision
- **Source:** ship-issue/worktree.md, "W. Which checkout" table: "Main checkout, on another branch or dirty (another agent or the user is working) | New worktree (recipe). Never switch, stash or commit someone else's tree, and never run its tests." Also ship-issue/SKILL.md, "W. Which checkout": "Main checkout, on `<base>`, clean: branch there. ... **When the current checkout is dirty or on another branch, read worktree.md.**"; Red flags: "Main checkout is on another branch, I'll switch it | Someone works there: worktree recipe."; "What invoking this skill authorizes": "creating and preparing a worktree when the current checkout is busy, only with section W's setup steps"
- **Told or worked out:** told
- **Files read for this step:** none new

Why: the main checkout is on `feature/BILL-401-statement-totals` with uncommitted changes, someone else is working there. No worktree is on BILL-450's branch (`git worktree list` shows only the main checkout).

### Q3

- **Step:** Recipe step 0: check git runs unmodified
- **Command or tool call:** `git status`
- **Source:** ship-issue/worktree.md, "Worktree recipe" step 0
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Recipe step 1: fetch the base
- **Command or tool call:** `git fetch origin main --quiet`
- **Source:** ship-issue/worktree.md, "Worktree recipe" step 1
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Recipe step 1: find `<main>`
- **Command or tool call:** `git rev-parse --path-format=absolute --git-common-dir` (prints `/work/billing-api/.git`, so `<main>` = `/work/billing-api`)
- **Source:** ship-issue/worktree.md, "Worktree recipe" step 1
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Recipe step 1: create the detached worktree
- **Command or tool call:** `git worktree add --detach /work/billing-api/.claude/worktrees/BILL-450 origin/main`
- **Source:** ship-issue/worktree.md, "Worktree recipe" step 1
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Recipe step 1: move the session into it
- **Command or tool call:** `EnterWorktree` with `path: "/work/billing-api/.claude/worktrees/BILL-450"`
- **Source:** ship-issue/worktree.md, "Worktree recipe" step 1
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Recipe step 2: dependencies, Prerequisites rows with `Background: no`, in order (now, unless the permission mode prompts; then its allow line `Bash(make setup)` goes in the I3 batch and it runs once the answers arrive); ready when exit 0
- **Command or tool call:** `make setup` (run in `/work/billing-api/.claude/worktrees/BILL-450`)
- **Source:** ship-issue/worktree.md, "Worktree recipe" step 2; ship-plan/config-format.md, `## Prerequisites`
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Recipe step 3: copy untracked files from `## Worktree` `Copy:` (copy, never print)
- **Command or tool call:** `cp /work/billing-api/.env .env` (cwd `/work/billing-api/.claude/worktrees/BILL-450`, so the target is `/work/billing-api/.claude/worktrees/BILL-450/.env`)
- **Source:** ship-issue/worktree.md, "Worktree recipe" step 3; ship-plan/config-format.md, `## Worktree`
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Recipe step 4: shared resources
- **Command or tool call:** none, `## Worktree` has no `Shared:`
- **Source:** ship-issue/worktree.md, "Worktree recipe" step 4
- **Told or worked out:** worked out
- **Files read for this step:** none new

- **Step:** Ledger prep: add `.superpowers/` to `/work/billing-api/.git/info/exclude` (git-common-dir from the rev-parse above), never `.gitignore`
- **Command or tool call:** Edit (or Write if missing) on `/work/billing-api/.git/info/exclude`, adding the line `.superpowers/`
- **Source:** ship-issue/SKILL.md, "The ledger"
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Recipe step 6: commit hooks, once before the first commit (the spec commit, after the branch exists)
- **Command or tool call:** `git hook run pre-commit`
- **Source:** ship-issue/worktree.md, "Worktree recipe" step 6
- **Told or worked out:** told
- **Files read for this step:** none new

### Q4

- **Step:** Create the branch from the worktree's detached `origin/main`, pattern `<type>/<KEY-n>-<slug>`, key upper case
- **Command or tool call:** `git switch -c <type>/BILL-450-<slug> origin/main` (run in `/work/billing-api/.claude/worktrees/BILL-450`; `<type>` one of `feature`, `fix`, `docs`, `chore`, `refactor`; `<slug>` 3–6 words of the issue title, kebab case; e.g. `git switch -c feature/BILL-450-<slug> origin/main`)
- **Source:** ship-issue/phase-spec.md, "I2" step 1; ship-plan/trackers/jira.md, "Issue keys"; ship-plan/config-format.md, `## Repo` (`Branch:` default)
- **Told or worked out:** told
- **Files read for this step:** none new

### Q5

- **Step:** Leave the main checkout alone
- **Command or tool call:** none. Never switch, stash or commit someone else's tree, and never run its tests: no `git switch`, `git stash`, `git commit`, no `make test` or `make setup` in `/work/billing-api`; never branch from the local `main`
- **Source:** ship-issue/worktree.md, "W. Which checkout" table ("Never switch, stash or commit someone else's tree, and never run its tests"); ship-issue/SKILL.md, Red flags ("Main checkout is on another branch, I'll switch it"); ship-issue/phase-spec.md, "I2" step 1 ("never the local base branch")
- **Told or worked out:** told
- **Files read for this step:** none new
