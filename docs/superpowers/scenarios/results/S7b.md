**Files read:**
1. ship-issue/SKILL.md
2. ship-plan/config-format.md
3. ship-issue/worktree.md
4. ship-plan/hosts/github.md
5. ship-plan/trackers/jira.md
6. ship-plan/templates-issue.md

(`.claude/ship-plan.md`, the interruptions logs, `blockers.md` and the `.claude/ship-plan/...` override files are not under SKILLDIR. Per the paper-exercise rule I use the scenario's config and treat the logs and overrides as absent.)

### Q1
- **Step:** Read the skill files, in the order the skill pulls them in. I opened worktree.md third; the skill needs it only at W, after the tracker files.
- **Command or tool call:** Read tool on each file, in this order:
  1. ship-issue/SKILL.md
  2. ship-plan/config-format.md (SKILL.md "Before anything else, read in full" and "Host and tracker")
  3. ship-plan/hosts/github.md (`origin` is `git@github.com:acme/billing-api.git`, so `Host:` is github; config-format.md `## Repo`)
  4. ship-plan/trackers/jira.md (the config has `## Jira`, so `Tracker:` is jira)
  5. ship-plan/templates-issue.md ("When `Tracker:` is not `none` ... read templates-issue.md")
  6. ship-issue/worktree.md (SKILL.md section W: "When the current checkout is dirty or on another branch, read worktree.md")
- **Source:** ship-issue/SKILL.md, headings "Ship an issue" (Host and tracker bullet) and "W. Which checkout".
- **Told or worked out:** told.
- **Files read for this step:** the six above.

### Q2
- **Step:** Choose the checkout. The main checkout is dirty and on `feature/BILL-401-statement-totals`, which is not this issue's branch, so BILL-450 works in a new worktree.
- **Command or tool call:** none, this is a decision. Nothing is asked of the user and nothing is written at this point.
- **Source:**
  - ship-issue/worktree.md, heading "W. Which checkout", table row: "Main checkout, on another branch or dirty (another agent or the user is working) | New worktree (recipe). Never switch, stash or commit someone else's tree, and never run its tests."
  - ship-issue/SKILL.md, heading "W. Which checkout".
  - ship-issue/SKILL.md, heading "Red flags": "The main checkout is on another branch, I'll switch it | Someone is working there. Use the worktree recipe."
- **Told or worked out:** told.
- **Files read for this step:** none new.

### Q3
In order. `<main>` is `/work/billing-api`, which the `rev-parse` below confirms.

- **Step:** Recipe step 0, check git runs unmodified. Run in the session's cwd, the main checkout, and read-only.
- **Command or tool call:** `git status`
- **Source:** ship-issue/worktree.md, heading "Worktree recipe", step 0.
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** Recipe step 1, fetch the base branch.
- **Command or tool call:** `git fetch origin main --quiet`
- **Source:** ship-issue/worktree.md, "Worktree recipe", step 1.
- **Told or worked out:** told. `<base>` is `main`, from the scenario config.
- **Files read for this step:** none new.

- **Step:** Recipe step 1, find the main checkout's path.
- **Command or tool call:** `git rev-parse --path-format=absolute --git-common-dir`. It prints `/work/billing-api/.git`, so `<main>` is `/work/billing-api`.
- **Source:** ship-issue/worktree.md, "Worktree recipe", step 1.
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** Recipe step 1, create the detached worktree from `origin/main`. The path is written out in full.
- **Command or tool call:** `git worktree add --detach /work/billing-api/.claude/worktrees/BILL-450 origin/main`
- **Source:** ship-issue/worktree.md, "Worktree recipe", step 1.
- **Told or worked out:** told, with `<KEY-n>` filled as `BILL-450`.
- **Files read for this step:** none new.

- **Step:** Recipe step 1, enter the worktree.
- **Command or tool call:** `EnterWorktree` with `path: /work/billing-api/.claude/worktrees/BILL-450`
- **Source:** ship-issue/worktree.md, "Worktree recipe", step 1.
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** Recipe step 2, dependencies. This is the only Prerequisites row with `Background: no`. It runs inside the worktree. In a permission mode that prompts, its allow line `Bash(make setup)` goes in the I3 batch and it runs after the answers arrive; otherwise it runs now.
- **Command or tool call:** `make setup`
- **Source:** ship-issue/worktree.md, "Worktree recipe", step 2; the scenario's `## Prerequisites`.
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** Recipe step 3, copy the git-ignored `Copy:` file from the main checkout. Copied, never printed.
- **Command or tool call:** `cp /work/billing-api/.env /work/billing-api/.claude/worktrees/BILL-450/.env`
- **Source:** ship-issue/worktree.md, "Worktree recipe", step 3; the scenario's `## Worktree` (`Copy: .env`).
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** Recipe step 4, shared resources. The config has no `Shared:` line, so there is nothing to check.
- **Command or tool call:** none, the config has no `Shared:` line.
- **Source:** ship-issue/worktree.md, "Worktree recipe", step 4.
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** Recipe step 6, run the commit hook once before the first commit. I did not use the `/usr/bin/git` fallback, so step 5 does not apply.
- **Command or tool call:** `git hook run pre-commit`
- **Source:** ship-issue/worktree.md, "Worktree recipe", step 6.
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** Exclude `.superpowers/` for the ledger. This is ledger setup, not a recipe step. It goes in the shared git dir's exclude file, not `.gitignore`.
- **Command or tool call:** `Edit` on `/work/billing-api/.git/info/exclude`, adding the line `.superpowers/`
- **Source:** ship-issue/SKILL.md, heading "The ledger": "Add `.superpowers/` to `<git-common-dir>/info/exclude` ... never to `.gitignore`."
- **Told or worked out:** worked out. The file says where, not which tool.
- **Files read for this step:** none new.

### Q4
- **Step:** Create the BILL-450 branch in the new worktree, from its detached `origin/main`. The `Branch:` pattern is not in the config, so the default `<type>/<id>-<slug>` applies. The key stays upper case.
- **Command or tool call:** `git switch -c <type>/BILL-450-<slug> origin/main`
  - `<type>` is one of `feature`, `fix`, `docs`, `chore` or `refactor`. The scenario gives no title or type for BILL-450, so I leave it as a placeholder. `<slug>` is 3 to 6 kebab-case words of the title.
- **Source:**
  - ship-issue/SKILL.md, heading "I2. Research and spec: the Spec stage", step 1: "`git switch -c <branch> origin/<base>` in the checkout chosen in section W (in a new worktree, from its detached `origin/<base>`)".
  - ship-plan/config-format.md, heading "`## Repo`", `Branch:` default.
  - ship-plan/trackers/jira.md, heading "Issue keys".
- **Told or worked out:** told. The `<type>` and `<slug>` placeholders are left open.
- **Files read for this step:** none new.

### Q5
- **Step:** What never happens to the main checkout.
- **Command or tool call:** none. I never switch, stash or commit its tree, and never run its tests. My only touches are the read-only `git status` and `git fetch`, and the `cp` that reads `.env` from it.
- **Source:**
  - ship-issue/worktree.md, heading "W. Which checkout", table: "Never switch, stash or commit someone else's tree, and never run its tests."
  - ship-issue/SKILL.md, heading "Red flags": "The main checkout is on another branch, I'll switch it | Someone is working there."
- **Told or worked out:** told.
- **Files read for this step:** none new.
