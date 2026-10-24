**Files read:**
1. ship-plan/SKILL.md
2. ship-plan/red-base.md
3. ship-plan/config-format.md (checked: Models, CI, Merge fields)
4. ship-plan/hosts/github.md
5. ship-plan/docs-pr.md
6. verify-and-fix/SKILL.md
7. ship-plan/trackers/jira.md
8. ship-plan/templates.md
9. ship-plan/templates-issue.md
10. verify-and-fix/review-comments.md

### Q1

- **Step:** Order of files from the red run onward (pre-flight already loaded SKILL.md, config-format.md, hosts/github.md, trackers/jira.md on resume; notifiers/slack.md is not read because `Channel: none`).
- **Command or tool call:** none, a list: (1) ship-plan/red-base.md (SKILL.md section 6 step 3); (2) ship-plan/hosts/github.md sections *Read a failed run*, *Open the PR*, *Wait for the PR's checks*, *Merge the PR*, *Find the base-branch run*, *Watch a run* (already loaded); (3) verify-and-fix/SKILL.md (red-base.md: "run `verify-and-fix` on this branch"); (4) ship-plan/templates.md and ship-plan/templates-issue.md (SKILL.md section 1, run has an issue; for the fix PR body, and the Jira comments); (5) verify-and-fix/review-comments.md once the fix PR is open (verify-and-fix section 4b); (6) ship-plan/trackers/jira.md (already loaded; for the comments). `superpowers:systematic-debugging` is named by red-base.md but is outside the skills directory.
- **Source:** ship-plan/SKILL.md, "6. Base-branch CI", step 3; ship-plan/red-base.md, item 1 "Real"; verify-and-fix/SKILL.md, "4b. PR review comments"
- **Told or worked out:** told
- **Files read for this step:** none new

### Q2

- **Step:** Read the failed base-branch run.
- **Command or tool call:** `gh run view 4300 --log-failed | tail -150`
- **Source:** ship-plan/red-base.md, item 1 ("the host's *Read a failed run*"); ship-plan/hosts/github.md, "Read a failed run" ("A red base-branch run: `gh run view <id> --log-failed | tail -150`")
- **Told or worked out:** told
- **Files read for this step:** ship-plan/red-base.md, ship-plan/hosts/github.md

### Q3

Classification: **Real**, so fix forward. Not "transient, listed in `blockers.md`": it lists none. Not "a new transient": that is "an external service down, a registry, the network", and the test is one this PR changed (SKILL.md section 4 step 7's new-transient rule also needs "a test the diff does not touch"). Quoted rule: "**Real:** fix forward. `git switch -c fix/<id-or-slug>-base-after-<pr> origin/<base>`. Find the root cause (superpowers:systematic-debugging), write a failing test, fix, run `verify-and-fix` on this branch, then do sections 4–6 again with the title "Fix <base> after #<n>: <what>"." Nothing is asked. Ledger (Edit tool, `.superpowers/ship-plan/feature-BILL-433-tax-rounding/ledger.md`, by path because the feature branch is gone): add `CI: base run 4300 red at test → unit, tests/test_tax.py::test_round_half_even; real; fix-forward cycle 1 of 3`; the first line stays `Phase: 6`.

- **Step:** Refresh the base ref.
- **Command or tool call:** `git fetch origin main`
- **Source:** ship-plan/SKILL.md, "The run" / allowed-tools (`git fetch origin *`); ship-plan/docs-pr.md fetches right before a switch the same way
- **Told or worked out:** worked out
- **Files read for this step:** none new

- **Step:** Create the fix branch from the base.
- **Command or tool call:** `git switch -c fix/BILL-433-base-after-62 origin/main`
- **Source:** ship-plan/red-base.md, item 1 "Real"; ship-plan/SKILL.md, "1. Tracker and branch" (key upper case in the branch name)
- **Told or worked out:** told (id filled in)
- **Files read for this step:** none new

- **Step:** Root cause (superpowers:systematic-debugging): see what the merge changed, then reproduce.
- **Command or tool call:** `git log --oneline -5 origin/main`, then `git diff 7d6e5f4^ 7d6e5f4 -- tests/test_tax.py`, then `python -m pytest tests/test_tax.py::test_round_half_even` (the runner is a guess from the test id; the config names only `make test`)
- **Source:** ship-plan/red-base.md, item 1 "Real" ("Find the root cause")
- **Told or worked out:** worked out
- **Files read for this step:** none new

- **Step:** Fix, test first. The failing test already exists (it is red on main, reproduced above); if the root cause shows a missing case, add one and watch it fail. Then the fix.
- **Command or tool call:** Edit tool on `<test file or tax-rounding source>` with `<old>` and `<new>` (placeholders, the cause is not known yet)
- **Source:** ship-plan/red-base.md, item 1 "Real" ("write a failing test, fix"); verify-and-fix/SKILL.md, "5. Triage and fix" (never weaken or delete a test)
- **Told or worked out:** told
- **Files read for this step:** verify-and-fix/SKILL.md

- **Step:** verify-and-fix setup.
- **Command or tool call:** `git fetch origin main --quiet`, then `mkdir -p .superpowers/verify-and-fix/fix/BILL-433-base-after-62`, then `git rev-parse --verify --quiet origin/HEAD` (and `git remote set-head origin --auto` only if that prints nothing)
- **Source:** verify-and-fix/SKILL.md, "1. Setup"
- **Told or worked out:** told
- **Files read for this step:** verify-and-fix/SKILL.md

- **Step:** Run the gate exactly as configured, then read the tail.
- **Command or tool call:** `CI=true make test > .superpowers/verify-and-fix/fix/BILL-433-base-after-62/Tests.log 2>&1`, then `tail -50 .superpowers/verify-and-fix/fix/BILL-433-base-after-62/Tests.log`
- **Source:** verify-and-fix/SKILL.md, "2. Gates"; `.claude/ship-plan.md`, `## Gates`
- **Told or worked out:** told (log file name worked out)
- **Files read for this step:** none new

- **Step:** Review round on `git diff origin/main...HEAD` (code-reviewer and silent-failure-hunter always; pr-test-analyzer because tests changed; security-review skill). Fixes get gates and a fresh round unless behaviour-keeping.
- **Command or tool call:** Agent tool, one call each, `subagent_type` `pr-review-toolkit:code-reviewer`, `pr-review-toolkit:silent-failure-hunter`, `pr-review-toolkit:pr-test-analyzer`, each with `model: "opus"`, `effort: "high"` (no `## Models` in the config, so the `Review round` default), prompt: review `git diff origin/main...HEAD` plus the ledger's `Ruling:` lines; and Skill tool `security-review`
- **Source:** verify-and-fix/SKILL.md, "4. Review round"; ship-plan/config-format.md, "`## Models`"
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Commit the fix (no simplify pass: red-base.md says sections 4-6 again, not 2b).
- **Command or tool call:** `git add <fixed files, by name>`, then `git commit -m "fix: <what> (BILL-433)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"`
- **Source:** verify-and-fix/SKILL.md, "5. Triage and fix" (stage by name, never `git add -A`); ship-plan/SKILL.md, "2. Implement" (trailers)
- **Told or worked out:** worked out (message wording)
- **Files read for this step:** none new

- **Step:** Section 4: push (verify-and-fix reported clean).
- **Command or tool call:** `git push -u origin fix/BILL-433-base-after-62`
- **Source:** ship-plan/SKILL.md, "4. Verify, push, PR", step 2
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Section 4: write the PR body from the template (issue exists, so no `## Plan` section; ends with the attribution line), then open the PR.
- **Command or tool call:** Write tool to `.superpowers/ship-plan/feature-BILL-433-tax-rounding/pr-body.md` (body per templates.md "PR body": 2-3 sentences with the BILL-433 link, What changed, How it was verified with the `Tests` row, Simplify pass `no changes`, Decisions made without the user, Not tested, last line `🤖 Generated with [Claude Code](https://claude.com/claude-code)`); then `gh pr create --base main --title "Fix main after #62: <what> (BILL-433)" --body-file .superpowers/ship-plan/feature-BILL-433-tax-rounding/pr-body.md`
- **Source:** ship-plan/hosts/github.md, "Open the PR"; ship-plan/SKILL.md, "4. Verify, push, PR", step 3; ship-plan/templates.md, "PR body"; ship-plan/red-base.md (title)
- **Told or worked out:** told (`--title`/`--body-file` flags and file path worked out)
- **Files read for this step:** ship-plan/templates.md, ship-plan/hosts/github.md

### Q4

Short answer: no. While the base branch is red the docs PR is not opened. It is opened once, in section 7 (close-out), step 3, after the base branch is green (section 6, step 2: "Green ... go to 7") and after step 2's closing comment, before step 4's lessons. Rule: SKILL.md, "7. Close out", step 3: "When the ledger has a `Docs PR:` line and the code PR merged, read [docs-pr.md]"; red flags: "A held spec reaches the repository only through section 7, step 3. Open the docs PR at close-out." (The fix-forward loop is sections 4-6 only; if the 3-cycle cap ended the run still red, section 7 would still run and docs-pr.md applies, since only "Awaiting review" and "Not merged" wait.) Nothing asked. Files read for it: ship-plan/docs-pr.md, plus ship-plan/hosts/github.md (*Open the PR*, *Request an AI review*, *Read the review rule*) and ship-plan/templates.md (PR body); no notifier (`Channel: none`). Steps, run in this checkout:

- **Step:** Refresh the base, branch for docs (slug `tax-rounding` from `feature/BILL-433-tax-rounding`).
- **Command or tool call:** `git fetch origin main`, then `git switch -c docs/BILL-433-tax-rounding origin/main`
- **Source:** ship-plan/docs-pr.md, step 1
- **Told or worked out:** told
- **Files read for this step:** ship-plan/docs-pr.md

- **Step:** Copy the held spec to the path the line names and rewrite only the spec's own "where it lives" line; "also nothing else" means no other changes.
- **Command or tool call:** `cp .superpowers/ship-issue/BILL-433/2026-10-19-BILL-433-tax-rounding-design.md docs/superpowers/specs/2026-10-19-BILL-433-tax-rounding-design.md`, then Edit tool on that file (the location line only)
- **Source:** ship-plan/docs-pr.md, step 2
- **Told or worked out:** told for the paths (`cp` worked out)
- **Files read for this step:** none new

- **Step:** Check every name, path and test the text cites.
- **Command or tool call:** `git grep -n -e <cited name> origin/main` for each cited name (fix the text, never the code)
- **Source:** ship-plan/docs-pr.md, step 3
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Commit, push, open the PR (body names code PR #62 and merge `7d6e5f4`, ends with the attribution line).
- **Command or tool call:** `git add docs/superpowers/specs/2026-10-19-BILL-433-tax-rounding-design.md`, then `git commit -m "docs: tax rounding design (BILL-433)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"`, then `git push -u origin docs/BILL-433-tax-rounding`, then `gh pr create --base main --title "docs: tax rounding design (BILL-433)" --body-file <body file>`
- **Source:** ship-plan/docs-pr.md, step 4; ship-plan/hosts/github.md, "Open the PR"
- **Told or worked out:** told (flags and body file worked out)
- **Files read for this step:** ship-plan/hosts/github.md

- **Step:** Review: record the rule, then request the AI review if approvals are needed (no Slack post, channel is none); if no approval is needed merge through sections 5-6, else leave open as "docs PR, needs approval".
- **Command or tool call:** `gh api repos/acme/billing-api/rules/branches/main --hostname github.com` (if the review rule is not already recorded in the ledger); `gh pr edit <n> --add-reviewer @copilot`
- **Source:** ship-plan/docs-pr.md, step 5; ship-plan/hosts/github.md, "Read the review rule", "Request an AI review"
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Record it in the ledger.
- **Command or tool call:** Edit tool on the ledger, add the line `Docs PR: #<n> <url>`; with an issue, name it in the Done comment's follow-ups.
- **Source:** ship-plan/docs-pr.md, step 6
- **Told or worked out:** told
- **Files read for this step:** none new
