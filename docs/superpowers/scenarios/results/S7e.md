**Files read:**
1. ship-plan/SKILL.md
2. ship-plan/config-format.md
3. ship-plan/hosts/github.md
4. ship-plan/trackers/jira.md
5. ship-plan/phase-merge.md
6. ship-plan/red-base.md
7. ship-plan/phase-verify.md
8. ship-plan/phase-close.md
9. ship-plan/docs-pr.md
10. verify-and-fix/SKILL.md
11. ship-plan/templates.md
12. verify-and-fix/review-comments.md
13. ship-plan/templates-issue.md

(Not read: notifiers/slack.md, because `## Slack` `Channel: none` skips every notifier step. Not read: phase-implement.md, because the run resumes at `Phase: 6`.)

### Q1

- **Step:** Resume the run, load the config rules, the host and the tracker.
- **Command or tool call:** Read `ship-plan/SKILL.md`, then `ship-plan/config-format.md`, `ship-plan/hosts/github.md` (no `Host:`, and origin is `github.com`), `ship-plan/trackers/jira.md` (`## Jira` present)
- **Source:** ship-plan/SKILL.md, intro ("First, read `.claude/ship-plan.md` ([format](config-format.md))") and "Host and tracker"
- **Told or worked out:** told
- **Files read for this step:** ship-plan/SKILL.md, ship-plan/config-format.md, ship-plan/hosts/github.md, ship-plan/trackers/jira.md

- **Step:** Read the phase file for the ledger's `Phase: 6`.
- **Command or tool call:** Read `ship-plan/phase-merge.md`
- **Source:** ship-plan/SKILL.md, "The ledger" ("on a resume the file of the ledger's `Phase:`") and "## 6. Base-branch CI — see phase-merge.md"
- **Told or worked out:** told
- **Files read for this step:** ship-plan/phase-merge.md

- **Step:** Base run 4300 is red, so read the red-base procedure.
- **Command or tool call:** Read `ship-plan/red-base.md`
- **Source:** ship-plan/phase-merge.md, "## 6. Base-branch CI" step 3 ("When the base-branch run is red, read red-base.md")
- **Told or worked out:** told
- **Files read for this step:** ship-plan/red-base.md

- **Step:** Fix forward: run verify-and-fix on the fix branch.
- **Command or tool call:** Read `verify-and-fix/SKILL.md`
- **Source:** ship-plan/red-base.md step 1, **Real** ("run `verify-and-fix --session` on this branch")
- **Told or worked out:** told
- **Files read for this step:** verify-and-fix/SKILL.md (it re-reads `../ship-plan/hosts/github.md` and `../ship-plan/config-format.md`, which are already loaded. It does not read review-comments.md yet, because the fix branch has no open PR.)

- **Step:** Sections 4–6 again for the fix PR: push, PR, then the PR body template.
- **Command or tool call:** Read `ship-plan/phase-verify.md`, then `ship-plan/templates.md`
- **Source:** ship-plan/red-base.md, **Real** ("then do sections 4–6 again"). ship-plan/phase-verify.md, "## 4." step 3 ("Body: templates.md, "PR body"")
- **Told or worked out:** told
- **Files read for this step:** ship-plan/phase-verify.md, ship-plan/templates.md

- **Step:** 4R on the fix PR: poll the review items.
- **Command or tool call:** Read `verify-and-fix/review-comments.md`
- **Source:** ship-plan/phase-merge.md, "## 4R. Review" step 3 ("New feedback (as review-comments.md defines it)")
- **Told or worked out:** told
- **Files read for this step:** verify-and-fix/review-comments.md (phase-merge.md is already loaded for 4R, 5 and 6)

- **Step:** Section 5 step 6 after the fix PR merges: post "Issue comment: merged" on BILL-433.
- **Command or tool call:** Read `ship-plan/templates-issue.md`
- **Source:** ship-plan/phase-merge.md, "## 5. Merge" step 6. ship-plan/templates-issue.md, "Issue comment: merged"
- **Told or worked out:** told
- **Files read for this step:** ship-plan/templates-issue.md

- **Step:** Section 6 on the fix PR's merge commit: the run is green. Nothing new is read.
- **Command or tool call:** none (phase-merge.md is already loaded)
- **Source:** ship-plan/phase-merge.md, "## 6. Base-branch CI" step 2
- **Told or worked out:** told
- **Files read for this step:** none new

Order until green: ship-plan/SKILL.md → ship-plan/config-format.md → ship-plan/hosts/github.md → ship-plan/trackers/jira.md → ship-plan/phase-merge.md → ship-plan/red-base.md → verify-and-fix/SKILL.md → ship-plan/phase-verify.md → ship-plan/templates.md → verify-and-fix/review-comments.md → ship-plan/templates-issue.md.

### Q2

- **Step:** Read the failed base-branch run.
- **Command or tool call:** `gh run view 4300 --log-failed | tail -150`
- **Source:** ship-plan/red-base.md step 1 ("**Red:** the host's *Read a failed run*"). ship-plan/hosts/github.md, "## Read a failed run"
- **Told or worked out:** told
- **Files read for this step:** none new

### Q3

Classification: **Real**, so fix forward. It is not "Transient infrastructure": `## CI` has no `Merge deploys to:` and no `## Allowed`, and the job ran the repo's own test. It is not "Transient, listed in `blockers.md`": blockers.md lists none. It is not "A new transient": no outage, and the failing test is one this PR changed. Rule, ship-plan/red-base.md step 1:
> **Real:** fix forward. `git fetch origin <base> --quiet`, then `git switch -c fix/<id-or-slug>-base-after-<pr> origin/<base>`, with `<id>` written as the config's `Branch:` pattern writes it. Find the root cause (superpowers:systematic-debugging), write a failing test, fix, run `verify-and-fix --session` on this branch, then do sections 4–6 again with the title "Fix <base> after #<n>: <what>".

Also: "A failing gate, a red CI job, a flaky test, or a merge conflict is **work, not a question.**" (ship-plan/phase-verify.md, "## 3. Questions"). Nothing asked.

- **Step:** Check blockers.md for a transient entry that matches.
- **Command or tool call:** `grep -n '^##' .claude/ship-plan/blockers.md` (no match, so nothing is applied and no `Used:` line is written)
- **Source:** ship-plan/SKILL.md, "Reading the logs" steps 1–4. ship-plan/red-base.md step 1, "Transient, listed in `blockers.md`"
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Record the red run in the ledger.
- **Command or tool call:** Edit `.superpowers/ship-plan/feature-BILL-433-tax-rounding/ledger.md` to append `CI: base run 4300 red — test → unit: tests/test_tax.py::test_round_half_even, changed by #62; real, fix forward 1 of 3`
- **Source:** ship-plan/SKILL.md, "The ledger" ("CI results"). ship-plan/red-base.md step 2 (at most 3 fix-forward cycles)
- **Told or worked out:** worked out (line text)
- **Files read for this step:** none new

- **Step:** Fetch the base branch.
- **Command or tool call:** `git fetch origin main --quiet`
- **Source:** ship-plan/red-base.md step 1, **Real**
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Create the fix branch from origin/main.
- **Command or tool call:** `git switch -c fix/BILL-433-base-after-62 origin/main`
- **Source:** ship-plan/red-base.md step 1, **Real**. ship-plan/trackers/jira.md, "## Issue keys" (key upper case). ship-plan/config-format.md, `## Repo` `Branch:` default `<type>/<id>-<slug>`
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Record the branch.
- **Command or tool call:** Edit the ledger to append `Branch: fix/BILL-433-base-after-62`
- **Source:** ship-plan/SKILL.md, "The ledger" (a `Branch: <name>` line)
- **Told or worked out:** worked out
- **Files read for this step:** none new

- **Step:** Root cause, systematic debugging.
- **Command or tool call:** Skill `superpowers:systematic-debugging`
- **Source:** ship-plan/red-base.md step 1, **Real**
- **Told or worked out:** told
- **Files read for this step:** none new (that skill is outside `skills/`)

- **Step:** Read the test and the rounding code: delegate, because the session reads no source files itself.
- **Command or tool call:** Agent `subagent_type: "Explore"`, `model: "sonnet"`, `effort: "medium"`, `description: "Find tax rounding root cause"`, `prompt: "Read tests/test_tax.py::test_round_half_even and the code it calls, and git show 7d6e5f4 for those files. Why does it fail on main at 7d6e5f4 but passed on PR #62? Is there an interaction with commits merged to main between the PR's last CI run and the merge? At most 30 lines, file:line quotes."`
- **Source:** ship-plan/SKILL.md, "This session reads little itself" (`Research` row, default `sonnet`, `medium`. No `## Models` in the config.) and "Every Agent dispatch passes both `model` and `effort`"
- **Told or worked out:** told (role and model); worked out (prompt)
- **Files read for this step:** none new

- **Step:** Write a failing test that reproduces the failure, watch it fail, then fix.
- **Command or tool call:** Edit `tests/test_tax.py` (or the test file the root cause points at) and Edit `<rounding source file>`. Confirm red, then green: `CI=true make test`
- **Source:** ship-plan/red-base.md step 1, **Real** ("write a failing test, fix"). ship-plan/config-format.md, `## Gates` ("Every command runs with `CI=true`")
- **Told or worked out:** worked out
- **Files read for this step:** none new

- **Step:** Commit the fix.
- **Command or tool call:** `git add tests/test_tax.py <rounding source file>`, then `git commit -m "fix: <what> (BILL-433)"`
- **Source:** ship-plan/SKILL.md, "allowed-tools pre-approves" (`git add <files>`, `git commit`). verify-and-fix/SKILL.md, "## 5." ("Stage only the files you fixed, by name")
- **Told or worked out:** worked out (message)
- **Files read for this step:** none new

- **Step:** Run verify-and-fix on the fix branch.
- **Command or tool call:** Skill `ai-skills:verify-and-fix`, args `--session`
- **Source:** ship-plan/red-base.md step 1, **Real**. ship-plan/SKILL.md, "Runner or session" ("Every nested ship skill … red-base.md's fix-forward … gets `--session`"). ship-plan/phase-verify.md, "## 4." step 1
- **Told or worked out:** told
- **Files read for this step:** verify-and-fix/SKILL.md

- **Step:** verify-and-fix setup: its ledger.
- **Command or tool call:** `mkdir -p .superpowers/verify-and-fix/fix-BILL-433-base-after-62`
- **Source:** verify-and-fix/SKILL.md, "## 1. Setup", **Ledger**
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** verify-and-fix setup: the base.
- **Command or tool call:** `git fetch origin main --quiet`, then `git rev-parse --verify --quiet origin/HEAD` (if it prints nothing: `git remote set-head origin --auto`)
- **Source:** verify-and-fix/SKILL.md, "## 1. Setup", **Base**
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** verify-and-fix: run the gate.
- **Command or tool call:** `CI=true make test > .superpowers/verify-and-fix/fix-BILL-433-base-after-62/Tests.log 2>&1`, then `tail -60 .superpowers/verify-and-fix/fix-BILL-433-base-after-62/Tests.log`, then write `Gated: <HEAD sha> — Tests` in its ledger
- **Source:** verify-and-fix/SKILL.md, "## 2. Gates"
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** verify-and-fix: size the diff for review round 1.
- **Command or tool call:** `git diff --shortstat origin/main...HEAD`
- **Source:** verify-and-fix/SKILL.md, "## 4. Review round", **Round 1**
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** verify-and-fix: review round 1 (small diff: code-reviewer plus security).
- **Command or tool call:** Agent `subagent_type: "pr-review-toolkit:code-reviewer"`, `model: "opus"`, `effort: "high"` (`Review round`, small diff), prompt: scope `git diff origin/main...HEAD`, the ledger's `Ruling:` lines, findings only (at most 25 lines), never run a gate or edit this tree. Also Skill `security-review`. Then write `Reviewed: <HEAD sha> — round 1, full, code-reviewer, security-review`
- **Source:** verify-and-fix/SKILL.md, "## 4. Review round"
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** verify-and-fix ends; check its status line.
- **Command or tool call:** none (it writes `Done: <HEAD sha> — clean` in its ledger. Assumed clean.)
- **Source:** verify-and-fix/SKILL.md, "## 7. Report". ship-plan/phase-verify.md, "## 4." step 1
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Push the fix branch.
- **Command or tool call:** `git push -u origin fix/BILL-433-base-after-62`
- **Source:** ship-plan/phase-verify.md, "## 4." step 2
- **Told or worked out:** told
- **Files read for this step:** ship-plan/phase-verify.md

- **Step:** Write the PR body.
- **Command or tool call:** Write `.superpowers/ship-plan/feature-BILL-433-tax-rounding/fix-pr-body.md` from templates.md "PR body": the [BILL-433](https://acme.atlassian.net/browse/BILL-433) link with no closing keyword, no `## Plan` (an issue is tracked), What changed, the gate table (Tests | pass), Decisions, Not tested, and the attribution line `🤖 Generated with [Claude Code](https://claude.com/claude-code)`
- **Source:** ship-plan/phase-verify.md, "## 4." step 3. ship-plan/templates.md, "## PR body"
- **Told or worked out:** worked out (file path); told (content)
- **Files read for this step:** ship-plan/templates.md

- **Step:** Open the fix PR.
- **Command or tool call:** `gh pr create --base main --title "Fix main after #62: <what> (BILL-433)" --body-file .superpowers/ship-plan/feature-BILL-433-tax-rounding/fix-pr-body.md`
- **Source:** ship-plan/hosts/github.md, "## Open the PR". ship-plan/red-base.md, **Real** (title "Fix <base> after #<n>: <what>"). ship-plan/phase-verify.md, "## 4." step 3 (" (<ID>)" when there is an issue)
- **Told or worked out:** told (form); worked out (combined title, `--title`/`--body-file` flags)
- **Files read for this step:** none new

### Q4

While the base branch is red: **no**. The docs PR is opened only at close-out. Rules: "A held spec lands only through section 7, step 2: open the docs PR at close-out." (ship-plan/SKILL.md, Red flags). "The run ends at section 7 and nowhere else." The red-base fix loop runs before section 7, and the docs describe code that must be on a green base branch first.

When, in this run: once the fix PR has merged, its base run is green (section 6) and 6b has run (no `## After merge`, no `## UI testing`, so nothing to check), the run goes to section 7. Then step 2: "When the ledger has a `Docs PR:` line and the code PR merged, read docs-pr.md." The outcome is Done, and the Done comment names the docs PR under follow-ups (docs-pr.md step 6).

Files read for it: ship-plan/phase-close.md (section 7) → ship-plan/docs-pr.md. For its *Open the PR*, *Request an AI review* and *Review state*, ship-plan/hosts/github.md, already loaded. If the review rule needs no approval, it merges through sections 5–6 in ship-plan/phase-merge.md, already loaded. ship-plan/templates-issue.md for the Done comment, already loaded. notifiers/slack.md is not read (`Channel: none`).

- **Step:** Go to close-out after base green.
- **Command or tool call:** Read `ship-plan/phase-close.md`
- **Source:** ship-plan/SKILL.md, "## 7. Close out — see phase-close.md"
- **Told or worked out:** told
- **Files read for this step:** ship-plan/phase-close.md

- **Step:** Ledger has `Docs PR:` and the code PR merged: read the docs-PR procedure.
- **Command or tool call:** Read `ship-plan/docs-pr.md`
- **Source:** ship-plan/phase-close.md, "## 7. Close out" step 2
- **Told or worked out:** told
- **Files read for this step:** ship-plan/docs-pr.md

- **Step:** Fetch right before the switch.
- **Command or tool call:** `git fetch origin main`
- **Source:** ship-plan/docs-pr.md step 1
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Create the docs branch.
- **Command or tool call:** `git switch -c docs/BILL-433-tax-rounding origin/main`
- **Source:** ship-plan/docs-pr.md step 1
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Copy the held spec and add the `Shipped also:` line.
- **Command or tool call:** Read `.superpowers/ship-issue/BILL-433/2026-10-19-BILL-433-tax-rounding-design.md`, Write `docs/superpowers/specs/2026-10-19-BILL-433-tax-rounding-design.md` (its location line rewritten), then `git diff --stat 7d6e5f4^ 7d6e5f4`. "also nothing else", so there are no other changes.
- **Source:** ship-plan/docs-pr.md step 2
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Check the cited names against the base branch.
- **Command or tool call:** `git grep -n -e <name> origin/main --` for each name, path and test the spec cites
- **Source:** ship-plan/docs-pr.md step 3
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Commit, push, open.
- **Command or tool call:** `git add docs/superpowers/specs/2026-10-19-BILL-433-tax-rounding-design.md`, then `git commit -m "docs: <what> (BILL-433)"`, then `git push -u origin docs/BILL-433-tax-rounding`, then `gh pr create --base main --title "<title>" --body-file <file>` (the body names #62 and `7d6e5f4`, and ends with the attribution line)
- **Source:** ship-plan/docs-pr.md step 4. ship-plan/hosts/github.md, "## Open the PR"
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** AI review, then merge or leave open; record it.
- **Command or tool call:** `gh pr edit <docs n> --add-reviewer @copilot`. Then merge through sections 5–6 if the rule needs no approval, else "docs PR, needs approval". Then Edit the ledger to append `Docs PR: #<n> <url>`
- **Source:** ship-plan/docs-pr.md steps 5–6. ship-plan/hosts/github.md, "## Request an AI review"
- **Told or worked out:** told
- **Files read for this step:** none new
