**Files read:**
1. ship-issue/SKILL.md
2. ship-plan/config-format.md
3. ship-plan/hosts/github.md
4. ship-plan/trackers/jira.md
5. ship-plan/templates-issue.md
6. ship-issue/worktree.md

### Q1

- **Step:** Read the skill
- **Command or tool call:** Read `ship-issue/SKILL.md`
- **Source:** ship-issue/SKILL.md, the skill itself
- **Told or worked out:** told
- **Files read for this step:** ship-issue/SKILL.md

- **Step:** Read the config format that SKILL.md links ("Before anything else"; "Repo override files")
- **Command or tool call:** Read `ship-plan/config-format.md`
- **Source:** ship-issue/SKILL.md, "Ship an issue" (Before anything else, read in full)
- **Told or worked out:** told
- **Files read for this step:** ship-plan/config-format.md

- **Step:** Read the host file (Host: absent, origin is github.com, so github)
- **Command or tool call:** Read `ship-plan/hosts/github.md`
- **Source:** ship-issue/SKILL.md, "Ship an issue" (Host and tracker)
- **Told or worked out:** told
- **Files read for this step:** ship-plan/hosts/github.md

- **Step:** Read the tracker file (## Jira present, so jira)
- **Command or tool call:** Read `ship-plan/trackers/jira.md`
- **Source:** ship-issue/SKILL.md, "Ship an issue" (Host and tracker)
- **Told or worked out:** told
- **Files read for this step:** ship-plan/trackers/jira.md

- **Step:** Read the issue templates (Tracker is not none)
- **Command or tool call:** Read `ship-plan/templates-issue.md`
- **Source:** ship-issue/SKILL.md, "Ship an issue" (Host and tracker, last sentence)
- **Told or worked out:** told
- **Files read for this step:** ship-plan/templates-issue.md

- **Step:** Read the worktree recipe (checkout is dirty and on another branch)
- **Command or tool call:** Read `ship-issue/worktree.md`
- **Source:** ship-issue/SKILL.md, "W. Which checkout" (When the current checkout is dirty or on another branch, read worktree.md)
- **Told or worked out:** told
- **Files read for this step:** ship-issue/worktree.md

(Repo override files under `.claude/ship-plan/...` are not under SKILLDIR, so not read here. config-drafting.md not read: the config exists and needs no draft.)

### Q2

- **Step:** Decide the checkout: a new worktree, not the main checkout
- **Command or tool call:** none, a decision (a read of the table in worktree.md)
- **Source:** ship-issue/worktree.md, "W. Which checkout" table, row "Main checkout, on another branch or dirty (another agent or the user is working)": "New worktree (recipe). Never switch, stash or commit someone else's tree, and never run its tests." Why: the main checkout is on `feature/BILL-401-statement-totals` with uncommitted changes, and that is not this issue's branch. Also ship-issue/SKILL.md, Red flags: "The main checkout is on another branch, I'll switch it" -> "Someone is working there. Use the worktree recipe."
- **Told or worked out:** told
- **Files read for this step:** none new

### Q3

- **Step:** 0. Check git runs unmodified
- **Command or tool call:** `git status`
- **Source:** ship-issue/worktree.md, "Worktree recipe" step 0
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** 1a. Fetch the base branch (origin exists)
- **Command or tool call:** `git fetch origin main --quiet`
- **Source:** ship-issue/worktree.md, "Worktree recipe" step 1; base `main` from the config
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** 1b. Find the main checkout path
- **Command or tool call:** `git rev-parse --path-format=absolute --git-common-dir` (prints `/work/billing-api/.git`, so `<main>` is `/work/billing-api`)
- **Source:** ship-issue/worktree.md, "Worktree recipe" step 1
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** 1c. Create the detached worktree from origin/main
- **Command or tool call:** `git worktree add --detach /work/billing-api/.claude/worktrees/BILL-450 origin/main`
- **Source:** ship-issue/worktree.md, "Worktree recipe" step 1
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** 1d. Enter the worktree
- **Command or tool call:** `EnterWorktree` with `path: /work/billing-api/.claude/worktrees/BILL-450`
- **Source:** ship-issue/worktree.md, "Worktree recipe" step 1
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** 2. Dependencies: the Prerequisites row with Background no, run in the worktree (in a permission mode that prompts, after the batch answers; otherwise now)
- **Command or tool call:** `make setup`
- **Source:** ship-issue/worktree.md, "Worktree recipe" step 2; config `## Prerequisites`
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** 3. Copy the git-ignored file from `## Worktree` `Copy:` (copy, never print)
- **Command or tool call:** `cp /work/billing-api/.env /work/billing-api/.claude/worktrees/BILL-450/.env`
- **Source:** ship-issue/worktree.md, "Worktree recipe" step 3
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** 4. Shared resources
- **Command or tool call:** none, the config has no `Shared:` field, so nothing to check
- **Source:** ship-issue/worktree.md, "Worktree recipe" step 4; ship-plan/config-format.md, `## Worktree`
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** 6. Commit hook check, once before the first commit
- **Command or tool call:** `git hook run pre-commit`
- **Source:** ship-issue/worktree.md, "Worktree recipe" step 6
- **Told or worked out:** told
- **Files read for this step:** none new

(Step 5 of the recipe is a note about the `/usr/bin/git` fallback; it applies only if step 0 failed, so no command.)

### Q4

- **Step:** Create the feature branch in the new worktree, from its detached origin/main
- **Command or tool call:** `git switch -c <type>/BILL-450-<slug> origin/main` (`<type>` one of feature, fix, docs, chore, refactor, from the issue; `<slug>` 3-6 words of the issue title in kebab case; the scenario gives neither)
- **Source:** ship-issue/SKILL.md, "I2. Research and spec" step 1; ship-plan/trackers/jira.md, "Issue keys" (key upper case); ship-plan/config-format.md, `## Repo` (`<type>`, `<slug>`)
- **Told or worked out:** told (type and slug are placeholders)
- **Files read for this step:** none new

### Q5

- **Step:** What never to do to the main checkout (`/work/billing-api`)
- **Command or tool call:** none. Never switch it, never stash it, never commit in it, and never run its tests.
- **Source:** ship-issue/worktree.md, "W. Which checkout" table: "Never switch, stash or commit someone else's tree, and never run its tests."
- **Told or worked out:** told
- **Files read for this step:** none new
