**Files read:**
1. ship-plan/SKILL.md
2. ship-plan/red-base.md
3. ship-plan/hosts/github.md
4. ship-plan/docs-pr.md
5. verify-and-fix/SKILL.md
6. ship-plan/config-format.md
7. ship-plan/templates.md
8. ship-plan/templates-issue.md
9. ship-plan/trackers/jira.md
10. verify-and-fix/review-comments.md

(Not readable: the repo override files under `.claude/ship-plan/...` and the skill `superpowers:systematic-debugging`. Both are outside SKILLDIR. Not read: notifiers/slack.md because `Channel: none`, verify-and-fix/ui-testing.md because there is no `## UI testing`, ship-plan/log-formats.md because lessons come after green.)

### Q1
- **Step:** Files read from here until base is green, in order. SKILL.md section 6 was already read.
- **Command or tool call:** none, this is a list.
  1. ship-plan/red-base.md (SKILL.md section 6, step 3).
  2. ship-plan/hosts/github.md (*Read a failed run*, *Open the PR*, *Merge the PR*, *Watch a run*).
  3. verify-and-fix/SKILL.md (red-base "Real" says run `verify-and-fix`).
  4. ship-plan/config-format.md (linked from verify-and-fix; `Green:` and `## Models` rows).
  5. ship-plan/templates.md (PR body, section 4 step 3 and section 1).
  6. ship-plan/templates-issue.md (the run has an issue).
  7. ship-plan/trackers/jira.md (*Link the PR* is "None"; *Comment* for the "merged" comment, section 5 step 6).
  8. verify-and-fix/review-comments.md, only once the fix PR is open and feedback arrives (verify-and-fix 4b / `--comments`).
  - After green: ship-plan/docs-pr.md at section 7 step 2.
- **Source:** ship-plan/SKILL.md, section 6 step 3 and section 4; ship-plan/red-base.md step 1 "Real".
- **Told or worked out:** told. The order is worked out from the "read when" lines.
- **Files read for this step:** none new.

### Q2
- **Step:** Read the failed run.
- **Command or tool call:** `gh run view 4300 --log-failed | tail -150`
- **Source:** ship-plan/hosts/github.md, "Read a failed run" ("A red base-branch run: `gh run view <id> --log-failed | tail -150`"); ship-plan/red-base.md step 1 ("**Red:** the host's *Read a failed run*, then classify").
- **Told or worked out:** told.
- **Files read for this step:** ship-plan/red-base.md, ship-plan/hosts/github.md.

### Q3
- **Step:** Classify the failure.
- **Command or tool call:** none, a decision. Result: **Real**, so fix forward.
  - Not a rerun: `blockers.md` lists no transient, and the scenario says it is not an outage.
  - Not "a new transient": that needs an external service, registry or network fault, and "the same step passed on the PR". Here the failing test is one this PR changed.
  - The config has no `Merge deploys to:`, so the deploy-rerun branch does not apply.
  - Quoted rule: "**Real:** fix forward. `git fetch origin <base> --quiet`, then `git switch -c fix/<id-or-slug>-base-after-<pr> origin/<base>` ... Find the root cause (superpowers:systematic-debugging), write a failing test, fix, run `verify-and-fix` on this branch, then do sections 4–6 again with the title "Fix <base> after #<n>: <what>"."
  - Also quoted, SKILL.md Red flags: "Only a failure listed as transient gets a rerun ... Anything else gets a root cause."
  - Cycle 1 of at most 3 ("At most 3 fix-forward cycles in one run").
- **Source:** ship-plan/red-base.md step 1 and step 2; ship-plan/SKILL.md section 6 and Red flags.
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** Record the ruling in the ledger.
- **Command or tool call:** `echo "Ruling: base run 4300 red is real, fix forward — tests/test_tax.py::test_round_half_even failed on 7d6e5f4, test changed by #62, not an outage, no blockers.md entry — cost if wrong: one extra fix PR (revert if root cause not found in one attempt)" >> .superpowers/ship-plan/feature-BILL-433-tax-rounding/ledger.md`
- **Source:** ship-plan/SKILL.md, "The ledger" and section 3 step 2 (`Ruling: <decision> — <evidence quoted> — <cost if wrong>`).
- **Told or worked out:** worked out. The line format is told; the exact command is built.
- **Files read for this step:** none new.

- **Step:** Fetch the base branch.
- **Command or tool call:** `git fetch origin main --quiet`
- **Source:** ship-plan/red-base.md step 1 "Real".
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** Create the fix branch from origin/main. The `<id>` is written as the `Branch:` pattern writes it, `<type>/<id>-<slug>`.
- **Command or tool call:** `git switch -c fix/BILL-433-base-after-62 origin/main`
- **Source:** ship-plan/red-base.md step 1 "Real"; ship-plan/config-format.md "## Repo" (`Branch:`); ship-plan/trackers/jira.md "Issue keys" (key upper case).
- **Told or worked out:** told.
- **Files read for this step:** ship-plan/config-format.md, ship-plan/trackers/jira.md.

- **Step:** Find the root cause with a research agent. I do not read source myself, and the CI tail is already read. The skill `superpowers:systematic-debugging` is named but is not under SKILLDIR.
- **Command or tool call:** Agent with `subagent_type: "Explore"`, `model: "sonnet"`, `effort: "medium"`, `prompt: "Why does tests/test_tax.py::test_round_half_even fail on main at 7d6e5f4 when it passed on PR #62's head? CI log tail: <paste>. Compare git diff <pr-head-sha>..7d6e5f4 for the tested code and the commits that merged between. Report at most 30 lines with file:line quotes."`
- **Source:** ship-plan/SKILL.md "This session reads little itself"; ship-plan/config-format.md `## Models` (`Research` row, default sonnet, medium); ship-plan/red-base.md "Real".
- **Told or worked out:** worked out. The agent prompt is mine.
- **Files read for this step:** none new.

- **Step:** Create the verify-and-fix ledger directory.
- **Command or tool call:** `mkdir -p .superpowers/verify-and-fix/fix-BILL-433-base-after-62`
- **Source:** verify-and-fix/SKILL.md, "1. Setup" (Ledger).
- **Told or worked out:** told.
- **Files read for this step:** verify-and-fix/SKILL.md.

- **Step:** Write the failing test. The edit is to `tests/test_tax.py`, plus a new case that reproduces the root cause. The exact lines depend on the agent's finding, so none are quoted here.
- **Command or tool call:** Edit `tests/test_tax.py` with `old_string: <existing case>`, `new_string: <case reproducing the cause>`. Then run the gate:
  `CI=true make test > .superpowers/verify-and-fix/fix-BILL-433-base-after-62/tests.log 2>&1`
  then `tail -60 .superpowers/verify-and-fix/fix-BILL-433-base-after-62/tests.log` (it must fail).
- **Source:** verify-and-fix/SKILL.md, "2. Gates" (exact command, `CI=true`, log to the ledger directory, read the last 60 lines) and "5. Triage and fix" (test first).
- **Told or worked out:** told for the gate form; worked out for the test edit.
- **Files read for this step:** none new.

- **Step:** Fix the code and rerun the gate. The gate must pass.
- **Command or tool call:** Edit `<source file>` with `old_string: <buggy lines>`, `new_string: <fix>`. Then `CI=true make test > .superpowers/verify-and-fix/fix-BILL-433-base-after-62/tests.log 2>&1` and `tail -60 .superpowers/verify-and-fix/fix-BILL-433-base-after-62/tests.log`
- **Source:** verify-and-fix/SKILL.md, "2. Gates"; ship-plan/red-base.md "Real".
- **Told or worked out:** worked out for the edit; the gate form is told.
- **Files read for this step:** none new.

- **Step:** Commit the fix. Files are staged by name, never `git add -A`. The trailer is copied exactly from the session reminder.
- **Command or tool call:** `git add tests/test_tax.py <source file>`
  then `git commit -m "fix: <what> (BILL-433)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"`
- **Source:** verify-and-fix/SKILL.md, "5. Triage and fix" (stage by name, no `--no-verify`); ship-plan/SKILL.md section 2 (trailers).
- **Told or worked out:** told for the rules; worked out for the commands.
- **Files read for this step:** none new.

- **Step:** Review round 1 of `verify-and-fix`. Run it unless the fix keeps behaviour; I assume it changes behaviour. Size check first, then the agents.
- **Command or tool call:**
  - `git diff --shortstat origin/main...HEAD`. A small diff has at most 200 changed lines and no file under `## Risk paths` (the config has none), so the panel is `code-reviewer` plus the security review.
  - Agent `subagent_type: "pr-review-toolkit:code-reviewer"`, `model: "opus"`, `effort: "xhigh"` (the `Final review` row), `prompt: "<scope: git diff origin/main...HEAD; ledger Ruling lines; findings only, one line each file:line grade what why, at most 25 lines; never run a gate or test command in this tree and never edit it>"`.
  - Skill `security-review` on the branch.
  - Then `echo "Reviewed: <sha> — round 1, full, code-reviewer + security-review" >> .superpowers/verify-and-fix/fix-BILL-433-base-after-62/ledger.md`
  - If it finds Critical or Important issues, fix each with a failing test first and rerun the gates and a delta round.
- **Source:** verify-and-fix/SKILL.md, "4. Review round" (Round 1, small diff, security every round, reviewer prompt rules) and "5. Triage and fix"; ship-plan/config-format.md `## Models`.
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** Push the fix branch. Section 4 step 2 names the branch.
- **Command or tool call:** `git push -u origin fix/BILL-433-base-after-62`
- **Source:** ship-plan/SKILL.md section 4 step 2 ("**Push:** `git push -u origin <branch>`").
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** Write the PR body to a file. Title: `Fix main after #62: <what> (BILL-433)`. The body follows the templates.md "PR body" shape: the issue link only with no closing keyword, What changed, a gates table with `Tests | pass`, Simplify "no changes" or "None", Decisions, Not tested, and the final line `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. The body names #62 and `7d6e5f4`.
- **Command or tool call:** Write `file_path: .superpowers/verify-and-fix/fix-BILL-433-base-after-62/pr-body.md`, `content: <that body>`
- **Source:** ship-plan/templates.md "PR body"; ship-plan/SKILL.md section 1 and section 4 step 3.
- **Told or worked out:** told for the template; worked out for the path.
- **Files read for this step:** ship-plan/templates.md, ship-plan/templates-issue.md.

- **Step:** Open the fix PR.
- **Command or tool call:** `gh pr create --base main --title "Fix main after #62: <what> (BILL-433)" --body-file .superpowers/verify-and-fix/fix-BILL-433-base-after-62/pr-body.md`
- **Source:** ship-plan/hosts/github.md "Open the PR" (`gh pr create --base <base>`); ship-plan/red-base.md "Real" (title); ship-plan/SKILL.md section 4 step 3.
- **Told or worked out:** told. `--title` and `--body-file` are my choice of flags, and the title merges red-base's "Fix <base> after #<n>: <what>" with section 4 step 3's ` (<ID>)`.
- **Files read for this step:** none new.

Nothing asked of the user. Nothing written but the ledger lines, the verify-and-fix `Reviewed:` line, and the PR body file above.

### Q4
- **Step:** Open the docs PR while the base branch is red?
- **Command or tool call:** none. No.
  - `docs-pr.md` runs as section 7 step 2: "Read only when the ledger has a `Docs PR:` line and the code PR merged (section 7, step 2 of SKILL.md)".
  - The flowchart reaches section 7 from a red base only through the fix-forward loop (`Fix-forward branch -> 3 Verify`), so it comes only after 6 and 6b, or after the loop gives up.
  - SKILL.md Red flags: "The run ends when the base branch is green, the closing comment is written, the docs PR is open (when the ledger has a `Docs PR:` line), and lessons are recorded."
  - The Red flags row also says: "A held spec reaches the repository only through section 7, step 2. Open the docs PR at close-out."
  - Opening the docs PR now would also create a PR whose checks may be red only because main is red (section 5 step 2: "never merge red and never fix that here").
- **Source:** ship-plan/SKILL.md, flowchart, "7. Close out" step 2, Red flags; ship-plan/docs-pr.md header.
- **Told or worked out:** worked out. The "not while red" reading comes from the ordering, since docs-pr.md only conditions on "the code PR merged".
- **Files read for this step:** none new.

- **Step:** When the docs PR is opened, and the files read. It happens in section 7, after the fix PR merges and base run 4300's successor is green (section 6), validation 6b passes (no `## After merge` checks, no `Hosted URL:`), and the "Done" closing comment (section 7 step 1) is written. It comes before the next-part handoff, the lessons (section 8) and the report. The only file read for it is ship-plan/docs-pr.md. hosts/github.md is already read; notifiers/slack.md is skipped because `Channel: none`.
- **Command or tool call:**
  1. `git fetch origin main`
  2. `git switch -c docs/BILL-433-tax-rounding origin/main`
  3. `cp .superpowers/ship-issue/BILL-433/2026-10-19-BILL-433-tax-rounding-design.md docs/superpowers/specs/2026-10-19-BILL-433-tax-rounding-design.md`, then Edit that file to rewrite only the spec's own "where it lives" line. The `Docs PR:` line lists no other changes ("also nothing else").
  4. `git grep -n -e <each name, path and test the spec cites> origin/main`. Fix the text, never the code.
  5. `git add docs/superpowers/specs/2026-10-19-BILL-433-tax-rounding-design.md`, then `git commit -m "docs: tax rounding design spec (BILL-433)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"`
  6. `git push -u origin docs/BILL-433-tax-rounding`
  7. Write the body file (names #62, its merge SHA `7d6e5f4`, and the attribution line), then `gh pr create --base main --title "docs: tax rounding design spec (BILL-433)" --body-file <file>`
  8. `gh pr edit <n> --add-reviewer @copilot`. If the review rule needs no approval, merge it through sections 5–6 with `gh pr merge <n> --squash --delete-branch`. Otherwise leave it open and link it in the report as "docs PR, needs approval".
  9. Ledger line `Docs PR: #<n> <url>`, and name it in the Done comment's follow-ups.
- **Source:** ship-plan/docs-pr.md steps 1–6; ship-plan/SKILL.md "7. Close out" step 2; ship-plan/hosts/github.md "Open the PR", "Request an AI review", "Merge the PR".
- **Told or worked out:** told for the sequence. The `cp`, `git add`, `git commit` and body-file commands are worked out. The branch slug `tax-rounding` and `<ID>` `BILL-433` follow the `Branch:` pattern, taken from the feature branch `feature/BILL-433-tax-rounding`.
- **Files read for this step:** ship-plan/docs-pr.md.
