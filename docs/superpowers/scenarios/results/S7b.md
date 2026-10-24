**Files read:**
1. ship-issue/SKILL.md
2. ship-plan/config-format.md
3. ship-issue/worktree.md
4. ship-plan/hosts/github.md
5. ship-plan/trackers/jira.md
6. ship-plan/templates-issue.md

### Q1

- **Step:** Read the skill itself.
- **Command or tool call:** Read `file_path=/Users/tarmoprotsin/Development/ai-skills/skills/ship-issue/SKILL.md`
- **Source:** ship-issue/SKILL.md, "Before anything else, read in full" and "Ship an issue".
- **Told or worked out:** told
- **Files read for this step:** ship-issue/SKILL.md

- **Step:** Read the config format (the repo's `.claude/ship-plan.md` itself is given by the scenario). It resolves `Host:` from the `origin` remote (`git@github.com:acme/billing-api.git` -> github) and `Tracker:` from `## Jira` (-> jira).
- **Command or tool call:** Read `file_path=/Users/tarmoprotsin/Development/ai-skills/skills/ship-plan/config-format.md`
- **Source:** ship-issue/SKILL.md, "Before anything else, read in full" and "Host and tracker"; ship-plan/config-format.md, "`## Repo`".
- **Told or worked out:** told
- **Files read for this step:** ship-plan/config-format.md

- **Step:** Read the worktree file, because the main checkout is dirty and on another branch.
- **Command or tool call:** Read `file_path=/Users/tarmoprotsin/Development/ai-skills/skills/ship-issue/worktree.md`
- **Source:** ship-issue/SKILL.md, "W. Which checkout" ("When the current checkout is dirty or on another branch, read worktree.md").
- **Told or worked out:** told
- **Files read for this step:** ship-issue/worktree.md

- **Step:** Read the host file.
- **Command or tool call:** Read `file_path=/Users/tarmoprotsin/Development/ai-skills/skills/ship-plan/hosts/github.md`
- **Source:** ship-issue/SKILL.md, "Host and tracker" (`../ship-plan/hosts/<host>.md`).
- **Told or worked out:** told
- **Files read for this step:** ship-plan/hosts/github.md

- **Step:** Read the tracker file (tracker is not `none`).
- **Command or tool call:** Read `file_path=/Users/tarmoprotsin/Development/ai-skills/skills/ship-plan/trackers/jira.md`
- **Source:** ship-issue/SKILL.md, "Host and tracker" (`../ship-plan/trackers/<tracker>.md`).
- **Told or worked out:** told
- **Files read for this step:** ship-plan/trackers/jira.md

- **Step:** Read the issue templates (tracker is not `none`).
- **Command or tool call:** Read `file_path=/Users/tarmoprotsin/Development/ai-skills/skills/ship-plan/templates-issue.md`
- **Source:** ship-issue/SKILL.md, "Host and tracker" ("When `Tracker:` is not `none`, or the tracker question is asked, read templates-issue.md").
- **Told or worked out:** told
- **Files read for this step:** ship-plan/templates-issue.md

### Q2

- **Step:** Decide where the run works: a new worktree at `/work/billing-api/.claude/worktrees/BILL-450`, not the main checkout. The main checkout is on `feature/BILL-401-statement-totals` with uncommitted changes, so it is busy.
- **Command or tool call:** none, a decision. Rule quoted from ship-issue/worktree.md: "Main checkout, on another branch or dirty (another agent or the user is working) | New worktree (recipe). Never switch, stash or commit someone else's tree, and never run its tests."
- **Source:** ship-issue/SKILL.md, "W. Which checkout"; ship-issue/worktree.md, "W. Which checkout" (table); ship-issue/SKILL.md, "Red flags" ("The main checkout is on another branch, I'll switch it" -> "Someone is working there. Use the worktree recipe.").
- **Told or worked out:** told
- **Files read for this step:** none new

### Q3

All commands run as separate plain commands, never inside `$( … )`. The first three run in the main checkout, before the worktree exists.

- **Step:** Step 0: check that git runs unmodified.
- **Command or tool call:** `git status`
- **Source:** ship-issue/worktree.md, "W. Which checkout", Worktree recipe step 0.
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Step 1: fetch the base branch.
- **Command or tool call:** `git fetch origin main --quiet`
- **Source:** ship-issue/worktree.md, Worktree recipe step 1 (an `origin` remote exists); `main` from the config's `Base branch: main`.
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Step 1: find the main checkout's path (prints `/work/billing-api/.git`, so `<main>` is `/work/billing-api`).
- **Command or tool call:** `git rev-parse --path-format=absolute --git-common-dir`
- **Source:** ship-issue/worktree.md, Worktree recipe step 1.
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Step 1: create the worktree, detached on `origin/main`, with the path written out.
- **Command or tool call:** `git worktree add --detach /work/billing-api/.claude/worktrees/BILL-450 origin/main`
- **Source:** ship-issue/worktree.md, Worktree recipe step 1.
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Step 1: enter the worktree.
- **Command or tool call:** `EnterWorktree` with `path=/work/billing-api/.claude/worktrees/BILL-450`
- **Source:** ship-issue/worktree.md, Worktree recipe step 1.
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Step 2: dependencies, the one Prerequisites row with `Background: no`. The scenario names no permission mode; in a prompting mode this waits for the I3 batch answers, otherwise it runs now.
- **Command or tool call:** `make setup`
- **Source:** ship-issue/worktree.md, Worktree recipe step 2; the scenario's `## Prerequisites`.
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Step 3: copy the `Copy:` file from the main checkout into the worktree (copy, never print).
- **Command or tool call:** `cp /work/billing-api/.env /work/billing-api/.claude/worktrees/BILL-450/.env`
- **Source:** ship-issue/worktree.md, Worktree recipe step 3; the scenario's `## Worktree` `Copy: .env`.
- **Told or worked out:** told (the recipe gives `cp <main>/<file> <file>`; I wrote the paths out)
- **Files read for this step:** none new

- **Step:** Step 4: shared resources. The config has no `Shared:`, so there is nothing to check.
- **Command or tool call:** none, the config has no `Shared:` row.
- **Source:** ship-issue/worktree.md, Worktree recipe step 4.
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Step 6: run the commit hook once before the first commit, from the worktree.
- **Command or tool call:** `git hook run pre-commit`
- **Source:** ship-issue/worktree.md, Worktree recipe step 6.
- **Told or worked out:** told
- **Files read for this step:** none new

### Q4

- **Step:** Create the branch for BILL-450 in the new worktree, from its detached `origin/main`. `<type>` is one of `feature`, `fix`, `docs`, `chore`, `refactor` (the issue's title is not given); `<slug>` is 3-6 words of the title in kebab case; the key stays upper case. The config sets no `Branch:`, so the default `<type>/<id>-<slug>` applies.
- **Command or tool call:** `git switch -c feature/BILL-450-<slug> origin/main`
- **Source:** ship-issue/SKILL.md, "I2. Research and spec: the Spec stage", step 1; ship-plan/trackers/jira.md, "Issue keys"; ship-plan/config-format.md, "`## Repo`" (`Branch:` default).
- **Told or worked out:** told (placeholders `<type>` and `<slug>` filled from the issue's title once read)
- **Files read for this step:** none new

### Q5

- **Step:** What I never do to the main checkout (`/work/billing-api`).
- **Command or tool call:** none. I never switch it off `feature/BILL-401-statement-totals`, never stash it, never commit in it, and never run its tests. Quoted: "Never switch, stash or commit someone else's tree, and never run its tests." I also never take BILL-401 from its branch name, because that branch is not one this skill started.
- **Source:** ship-issue/worktree.md, "W. Which checkout" (table); ship-issue/SKILL.md, "Red flags" and "I0. Route: what already exists" (No argument: "Never take a key from a branch you did not start: it is someone else's work.").
- **Told or worked out:** told
- **Files read for this step:** none new
