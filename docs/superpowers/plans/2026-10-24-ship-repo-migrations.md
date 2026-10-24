# Ship repo migrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the five repos that use `ship` or their own copies of the ship skills onto the shared, tool-neutral `ship-issue`, `ship-plan` and `verify-and-fix`. Then check that this machine's installed `ai-skills` plugin carries them.

**Architecture:** One PR per repo, in that repo, each opened only after the user approves it. Each PR moves the config and logs to the `ship-plan` names and adds `Host:` and `Tracker:`. forest-planner also turns its project skills into config. The skills reach this machine through the `ai-skills@tarmopr` marketplace plugin, installed on 2026-10-24; the symlinks in `~/.claude/skills` were removed that day.

**Tech Stack:** git and the repo's own host CLI (`az` for Azure DevOps, `gh` for GitHub).

**Spec:** `docs/superpowers/specs/2026-10-24-tool-neutral-ship-skills-design.md`, section "Removing `ship` and `verify`".

**Starts when:** the first plan, `docs/superpowers/plans/2026-10-24-tool-neutral-ship-skills.md`, is merged into `main` in this repo.

## Global Constraints

- **Never push, open a PR or merge** in another repo without the user's approval in chat for that repo.
- **Never touch a checkout that is dirty or on another branch.** Check first with `git status --short` and `git branch --show-current`, then put it in the report.
- **Open `ship` runs are dropped.** Don't resume or finish them: PRs 774, 775 and 776 in `FIS-wt-async`, 788 in `FIS-wt-svc8`, and 731, 755 and 757 in `FIS`.
- **Every moved file keeps its history:** use `git mv`, never delete and recreate.
- **Pipeline ids are read with `az pipelines list`, never guessed.**
- **Commit trailer:** `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## Review Focus

1. **A repo whose config prose still tells the agent to translate `gh` to `az`.** After the move it would contradict the host file, so the prose must be gone. Task 1 checks for it.
2. **A deploy pipeline named as `Workflow:`** (`fis-geoserver-container-app`). The skill would watch it, which is fine, but it must never rerun it. Task 2 adds it to `## Never do`.
3. **forest-planner's project skills deleted while repo rules still live only in them.** Task 5 checks that every repo-specific line ends up in the config, or in the report as a proposed skill change.
4. **forest-planner's own copies next to the plugin's.** Until its PR merges, forest-planner has both its project skills (`/ship-plan`) and the plugin's (`/ai-skills:ship-plan`). A run there must use the one the user named. Task 6 checks after the merge that only the plugin's remain.
5. **`azure-subscription` has no `origin` remote.** A run there must stop before opening a PR. Task 4 runs scenario S9's check by hand.

---

### Task 1: FIS

**Files (in `/Users/tarmoprotsin/Development/FIS`):** `.claude/ship.md` → `.claude/ship-plan.md`; `.claude/ship/` → `.claude/ship-plan/`

- [ ] **Step 1:** Check that the FIS checkout is clean and on `master`, then run `git fetch origin master` and `git switch -c chore/ship-plan-config origin/master`.
- [ ] **Step 2:** `git mv .claude/ship.md .claude/ship-plan.md` and `git mv .claude/ship .claude/ship-plan`.
- [ ] **Step 3: Edit `.claude/ship-plan.md`:**
  - in `## Repo`, add `Host: azure-devops` and `Tracker: linear`;
  - set `## CI` to `Workflow: 17`, keeping its `Green:` line;
  - delete the opening paragraph that maps `gh` to `az` (it begins "FIS is hosted on Azure DevOps"), but keep its path-filter facts as one `## CI` note;
  - keep `## Linear`, `## Never do` and every other section as they are.
- [ ] **Step 4: Check the result.**
  - Run `grep -n "gh \|maps to\|az repos pr" .claude/ship-plan.md`. Expected: no hits outside `## Never do`.
  - Then dispatch scenario S3 (Task 10 of the first plan) with this real config in place of the fictional one. Expected: its "Pass if" lines hold.
- [ ] **Step 5:** Commit with `chore: move ship config to ship-plan (Host, Tracker, Workflow 17)`. Then ask the user to approve the push and PR (`az repos pr create`).

### Task 2: fis-geoserver-container-app

- [ ] **Step 1:** Check the checkout is clean, then branch from `origin/main`.
- [ ] **Step 2:** Move the files with `git mv`, as in Task 1 Step 2.
- [ ] **Step 3: Edit `.claude/ship-plan.md`:**
  - in `## Repo`, add `Host: azure-devops` and `Tracker: none`;
  - get the id with `az pipelines list --query "[?name=='fis-geoserver-infra'].id" -o tsv`, then set `## CI` `Workflow:` to it;
  - keep today's prose as a note: "pr: none; deploys on push to main";
  - add to `## Never do`: "Rerun or queue pipeline `fis-geoserver-infra`: it deploys."
- [ ] **Step 4:** Commit with `chore: move ship config to ship-plan`. Then ask the user to approve the push and PR.

### Task 3: ship-skill-sandbox

- [ ] **Step 1:** Check the checkout is clean, then branch from `origin/main`.
- [ ] **Step 2:** Move the files with `git mv`. In `## Repo`, add `Tracker: none`. Leave out `Host:`, so this repo also exercises the remote default. `Workflow: ci.yml` stays.
- [ ] **Step 3:** Commit, then ask the user to approve the push and PR (`gh pr create`). This repo is the safe place for the user's live run of `ship-plan` after the rollout.

### Task 4: azure-subscription

- [ ] **Step 1:** Check the checkout is clean.
- [ ] **Step 2:** Move the files with `git mv`, add `Tracker: none`, and commit locally. There is no remote: nothing to push.
- [ ] **Step 3: Check by hand.** Read `ship-plan/SKILL.md`'s no-`origin` rule and confirm what a run here would do: work through `verify-and-fix`, then stop before §4 with its message. Put that line in the report.

### Task 5: forest-planner

**Files (in `/Users/tarmoprotsin/Development/forest-planner`):**
- Create: `.claude/ship-plan.md`
- Move: the logs from `.claude/skills/{ship-plan,ship-issue,verify-and-fix}/` to `.claude/ship-plan/` and `.claude/ship-issue/`
- Delete: `.claude/skills/ship-plan/`, `.claude/skills/ship-issue/`, `.claude/skills/verify-and-fix/`

- [ ] **Step 1:** Check the checkout is clean, then branch from `origin/main`.
- [ ] **Step 2: Compare.**
  - For each of the three project skills, run a diff against the shared one at `main` of `ai-skills`, and list each difference.
  - Sort every difference into one of two piles. **Repo-specific:** a command, path, team, status, gate, rule, `FOR-` key or Supabase detail. **Workflow:** anything else.
  - Save both lists to the scratchpad.
- [ ] **Step 3: Write `.claude/ship-plan.md`** from the repo-specific pile, in config-format sections:
  - `## Repo` with `Host: github` and `Tracker: linear`, and `## Linear` (team, project, statuses, `Notes:`);
  - `## Gates`, `## Prerequisites`, `## Reviewers by path`, `## Fix rules`, `## Never do`, `## UI testing`, `## Slack`, `## Models`, as present.

  Every line of the pile appears in the config, or in the report with the reason it was left out.
- [ ] **Step 4:** `git mv` the logs. `ship-plan` and `verify-and-fix` logs go to `.claude/ship-plan/` (`interruptions.md`, `blockers.md`) and `ship-issue`'s to `.claude/ship-issue/`. `evidence.md` goes where the shared `ship-issue` expects its evidence sources: read `ship-issue/evidence.md` and the config's `## Evidence` to decide. Merge two logs of the same name by appending, with a heading per source.
- [ ] **Step 5:** `git rm -r` the three project skill folders. Leave the other project skills (`add-translation`, `new-migration`, `promote-to-production`, `review-full-codebase`).
- [ ] **Step 6:** Dispatch a fresh subagent with scenario S1's questions against this repo's real config and the shared skills. Expected: no step needs a rule that was only in the deleted skills.
- [ ] **Step 7:** Commit with `chore: use the shared ship skills; repo config in .claude/ship-plan.md`. Then ask the user to approve the push and PR.
- [ ] **Step 8:** Report the workflow pile as "proposed changes to the shared skills", with the exact text. These are follow-ups for `ai-skills`, not part of this PR.

### Task 6: Check the installed plugin on this machine

Runs only after forest-planner's PR (Task 5) is merged. Nothing is linked: the skills come from the `ai-skills@tarmopr` plugin.

- [ ] **Step 1:** Run `./scripts/update-plugin.sh` in `/Users/tarmoprotsin/Development/ai-skills`. Then `claude plugin list`. Expected: `ai-skills@tarmopr` enabled, at the `version` in `main`'s `.claude-plugin/plugin.json`.
- [ ] **Step 2:** Run `find ~/.claude/skills -maxdepth 1 -type l`. Expected: no link into this repo, and no `ship-issue`, `ship-plan`, `verify-and-fix`, `handoff` or `continue-handoff` folder in `~/.claude/skills`, so no skill loads twice.
- [ ] **Step 3:** Run `node ~/.claude/skills/_specs/check-skills.mjs`. Expected: `ok`.
- [ ] **Step 4:** In forest-planner, `ls .claude/skills`. Expected: no `ship-plan`, `ship-issue` or `verify-and-fix` folder.
- [ ] **Step 5: Report** what was moved, each PR's state, and the dropped `ship` runs. Offer a live `/ai-skills:ship-plan` run, either on `ship-skill-sandbox` or on FIS.
