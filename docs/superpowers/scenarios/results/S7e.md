**Files read:**
1. `ship-plan/SKILL.md`
2. `ship-plan/phase-merge.md`
3. `ship-plan/red-base.md`
4. `ship-plan/hosts/github.md`
5. `ship-plan/config-format.md` (lines 1–200: `## Repo` `Branch:`, `## CI` `Green:`, `## Jira`)
6. `ship-plan/phase-verify.md`
7. `ship-plan/trackers/jira.md`
8. `verify-and-fix/SKILL.md`
9. `ship-plan/templates.md`
10. `ship-plan/templates-pr.md` (headings only, to check)
11. `ship-plan/templates-issue.md` (headings, "Issue comment: merged", "Issue comment: base branch red")
12. `ship-plan/phase-close.md` (one grep hit only, to check where "base branch red" is used)

### Q1

- **Step:** Section 6, step 3 sends the red run to red-base.md.
- **Command or tool call:** Read `ship-plan/red-base.md`
- **Source:** `ship-plan/phase-merge.md` "## 6. Base-branch CI" step 3 ("When the base-branch run is red, read red-base.md")
- **Told or worked out:** told
- **Files read for this step:** `ship-plan/red-base.md` (`ship-plan/SKILL.md`, `ship-plan/phase-merge.md`, `ship-plan/hosts/github.md`, `ship-plan/trackers/jira.md`, `ship-plan/config-format.md` are already in context from the resume at `Phase: 6`)

- **Step:** Fix forward: run verify-and-fix on the fix branch.
- **Command or tool call:** Read `verify-and-fix/SKILL.md`
- **Source:** `ship-plan/red-base.md` step 1 "Real"; `verify-and-fix/SKILL.md` "## 1. Setup" (host file `../ship-plan/hosts/github.md`, already read)
- **Told or worked out:** told
- **Files read for this step:** `verify-and-fix/SKILL.md` (superpowers:systematic-debugging is a skill outside `skills/`; review-comments.md is not read: no open PR yet, not `--comments`)

- **Step:** Sections 4–6 again: verify, push, PR.
- **Command or tool call:** Read `ship-plan/phase-verify.md`, then `ship-plan/templates.md` for the PR body
- **Source:** `ship-plan/red-base.md` step 1 "Real" ("do sections 4–6 again"); `ship-plan/SKILL.md` "## 4. Verify, push, PR"; `ship-plan/phase-verify.md` section 4 step 3 ("templates.md, 'PR body'")
- **Told or worked out:** told
- **Files read for this step:** `ship-plan/phase-verify.md`, `ship-plan/templates.md`

- **Step:** 4R review, 5 merge, 6 base CI, 6b for the fix PR.
- **Command or tool call:** `ship-plan/phase-merge.md` (already in context; re-entered, not re-read), then `ship-plan/templates-issue.md` for section 5 step 6 "Issue comment: merged"
- **Source:** `ship-plan/phase-merge.md` "## 4R", "## 5. Merge" step 6, "## 6", "## 6b"; `notifiers/slack.md` not read (`Channel: none`); `verify-and-fix/review-comments.md` only if section 4R finds new feedback (assumed none)
- **Told or worked out:** told
- **Files read for this step:** `ship-plan/templates-issue.md`

Order: `ship-plan/red-base.md` → `verify-and-fix/SKILL.md` → `ship-plan/phase-verify.md` → `ship-plan/templates.md` → (`ship-plan/phase-merge.md`, in context) → `ship-plan/templates-issue.md`.

### Q2

- **Step:** Read the failed base-branch run.
- **Command or tool call:** `gh run view 4300 --log-failed | tail -150`
- **Source:** `ship-plan/red-base.md` step 1 ("the host's *Read a failed run*"); `ship-plan/hosts/github.md` "## Read a failed run"
- **Told or worked out:** told
- **Files read for this step:** `ship-plan/red-base.md`, `ship-plan/hosts/github.md`

### Q3

- **Step:** Check blockers.md for a matching entry.
- **Command or tool call:** `grep -n '^##' .claude/ship-plan/blockers.md` (no heading matches: no transient listed, per the scenario)
- **Source:** `ship-plan/SKILL.md` "### Reading the logs" steps 1, 3, 4
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Classify: **Real.** Not transient: the failure is in the repo's own test `tests/test_tax.py::test_round_half_even`, which this PR changed; no runner, network or billing error; no outage; not in `blockers.md`; no `Merge deploys to:`, so no deploy-rerun case. Rule quoted: "**Real:** fix forward. `git fetch origin <base> --quiet`, then `git switch -c fix/<id-or-slug>-base-after-<pr> origin/<base>`, with `<id>` written as the config's `Branch:` pattern writes it. Find the root cause (superpowers:systematic-debugging), write a failing test, fix, run `verify-and-fix --session` on this branch, then do sections 4–6 again with the title "Fix <base> after #<n>: <what>"." Also SKILL.md Red flags: "Only a failure listed as transient gets a rerun ... Anything else gets a root cause." No rerun.
- **Command or tool call:** none (classification); ledger line in `.superpowers/ship-plan/feature-BILL-433-tax-rounding/ledger.md`: `CI: base run 4300 red: test → unit, tests/test_tax.py::test_round_half_even; Real, fix forward (cycle 1 of 3)`
- **Source:** `ship-plan/red-base.md` step 1 (Transient / Real bullets), step 2; `ship-plan/SKILL.md` "## Red flags", "### The ledger"
- **Told or worked out:** worked out
- **Files read for this step:** none new

- **Step:** Fetch the base branch.
- **Command or tool call:** `git fetch origin main --quiet`
- **Source:** `ship-plan/red-base.md` step 1 "Real"
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Create the fix branch from `origin/main` (`<id>` as `Branch:` writes it, default `<type>/<id>-<slug>`, Jira key upper case).
- **Command or tool call:** `git switch -c fix/BILL-433-base-after-62 origin/main`
- **Source:** `ship-plan/red-base.md` step 1 "Real"; `ship-plan/config-format.md` "### `## Repo`" `Branch:`; `ship-plan/trackers/jira.md` "## Issue keys"
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Record the branch in the run's ledger.
- **Command or tool call:** none (file write): ledger line `Branch: fix/BILL-433-base-after-62`
- **Source:** `ship-plan/SKILL.md` "### The ledger"
- **Told or worked out:** worked out
- **Files read for this step:** none new

- **Step:** Find the root cause.
- **Command or tool call:** Skill tool, `skill: "superpowers:systematic-debugging"`; code reading via Agent tool, `subagent_type: "Explore"`, `model: "sonnet"`, `effort: "medium"`, `description: "Root cause test_round_half_even"`, `prompt: "Why does tests/test_tax.py::test_round_half_even fail on origin/main at 7d6e5f4 when it passed on PR #62? Compare with commits merged to main after #62's base (git log). Log tail: <tail>. At most 30 lines, file:line quotes."`
- **Source:** `ship-plan/red-base.md` step 1 "Real"; `ship-plan/SKILL.md` "This session reads little itself", "Every Agent dispatch passes both `model` and `effort`"
- **Told or worked out:** worked out (agent prompt); told (skill, model/effort defaults)
- **Files read for this step:** none new

- **Step:** Failing test, then fix (the changed test already fails on main; reproduce with the configured gate).
- **Command or tool call:** `CI=true make test > .superpowers/verify-and-fix/fix-BILL-433-base-after-62/Tests.log 2>&1`, then `tail -60 .superpowers/verify-and-fix/fix-BILL-433-base-after-62/Tests.log`; edit the fix
- **Source:** `ship-plan/red-base.md` step 1 "Real"; `verify-and-fix/SKILL.md` "## 2. Gates", "## 5. Triage and fix" (never weaken or delete a test)
- **Told or worked out:** worked out
- **Files read for this step:** none new

- **Step:** Commit the fix, files by name.
- **Command or tool call:** `git add <fixed files>`, then `git commit -m "fix: <what> after #62 (BILL-433)"`
- **Source:** `ship-plan/SKILL.md` "pre-approves commands" (local: `git add <files>`, `git commit`); `verify-and-fix/SKILL.md` "## 5. Triage and fix" (stage by name, never `--no-verify`)
- **Told or worked out:** worked out (message)
- **Files read for this step:** none new

- **Step:** Verify the fix branch (section 4, step 1).
- **Command or tool call:** Skill tool, `skill: "ai-skills:verify-and-fix"`, `args: "--session"`. Inside it: `git fetch origin main --quiet`; `mkdir -p .superpowers/verify-and-fix/fix-BILL-433-base-after-62`; `CI=true make test > .superpowers/verify-and-fix/fix-BILL-433-base-after-62/Tests.log 2>&1`; `tail -60 .superpowers/verify-and-fix/fix-BILL-433-base-after-62/Tests.log`; `git diff --shortstat origin/main...HEAD` (small diff: `pr-review-toolkit:code-reviewer` at `## Models` `Review round`, `model: "opus"`, `effort: "high"`, plus the `security-review` skill). Ends `clean`.
- **Source:** `ship-plan/red-base.md` step 1 "Real"; `ship-plan/phase-verify.md` "## 4" step 1; `ship-plan/SKILL.md` "## Runner or session" (nested gets `--session`); `verify-and-fix/SKILL.md` "## 1. Setup", "## 2. Gates", "## 4. Review round"
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Push the fix branch.
- **Command or tool call:** `git push -u origin fix/BILL-433-base-after-62`
- **Source:** `ship-plan/phase-verify.md` "## 4" step 2; `ship-plan/SKILL.md` "What invoking this skill authorizes" (follow-up branches fixing a red base branch)
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Open the fix PR (body from templates.md "PR body", `[BILL-433](https://acme.atlassian.net/browse/BILL-433)` link, no closing keyword, attribution line last; written to a file first).
- **Command or tool call:** `gh pr create --base main --title "Fix main after #62: <what> (BILL-433)" --body-file .superpowers/ship-plan/feature-BILL-433-tax-rounding/pr-body-fix.md`
- **Source:** `ship-plan/red-base.md` step 1 "Real" (title); `ship-plan/phase-verify.md` "## 4" step 3 (` (<ID>)`, templates.md body); `ship-plan/hosts/github.md` "## Open the PR"; `ship-plan/templates.md` "## PR body"
- **Told or worked out:** told (command form, title); worked out (body file path)
- **Files read for this step:** `ship-plan/templates.md`

Nothing asked. Nothing written beyond the ledger lines above and the PR body file.
