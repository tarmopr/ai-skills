**Files read:** (all relative to SKILLDIR; repo files `.claude/ship-plan.md`, `.claude/ship-plan/interruptions.md` and `.claude/ship-plan/blockers.md` are read too but are not under SKILLDIR)
1. `ship-plan/SKILL.md`
2. `ship-plan/config-format.md`
3. `ship-plan/templates.md`
4. `verify-and-fix/SKILL.md`
5. `ship-plan/log-formats.md` (read only to check; the repo's two logs exist, so it is not used)

(I also listed the directory tree of SKILLDIR once to see what exists; no other file was opened.)

Shorthand: `ATL.` = `mcp__plugin_atlassian_atlassian__`, `SLACK.` = `mcp__plugin_engineering_slack__`. Branch = `feature/BILL-412-invoice-pdf-export`. Ledger dir = `.superpowers/ship-plan/feature/BILL-412-invoice-pdf-export/`.

### Q1
- **Step:** read the repo config and logs before anything else, then the skill's linked files.
- **Command or tool call:** Read, in order: `ship-plan/SKILL.md`; `.claude/ship-plan.md`; `.claude/ship-plan/interruptions.md`; `.claude/ship-plan/blockers.md`; `ship-plan/config-format.md`; `ship-plan/templates.md`; `verify-and-fix/SKILL.md`. (`ship-plan/log-formats.md` only to check the seeds.)
- **Source:** `ship-plan/SKILL.md`, intro ("Before anything else, read the repo's `.claude/ship-plan.md` ... `interruptions.md` and `blockers.md` in full"); `verify-and-fix/SKILL.md`, intro (it reads the same config and blockers).
- **Told or worked out:** told.
- **Files read for this step:** `ship-plan/SKILL.md`, `ship-plan/config-format.md`, `ship-plan/templates.md`, `verify-and-fix/SKILL.md`, `ship-plan/log-formats.md`.

### Q2
- **Step:** resume or start: list ledgers.
- **Command or tool call:** `ls .superpowers/ship-plan/*/ledger.md` (none found, so this is a new run; the argument is a plan path, so it is not answers to parked questions).
- **Source:** `ship-plan/SKILL.md`, "0. Pre-flight", step 2.
- **Told or worked out:** worked out (the skill says "List `.superpowers/ship-plan/*/ledger.md`" without a command).
- **Files read for this step:** none new.

- **Step:** resolve the plan: read the plan file.
- **Command or tool call:** Read `docs/superpowers/plans/2026-10-20-BILL-412-invoice-pdf-export.md`. No `From ship-issue` block, so nothing is copied into the ledger.
- **Source:** `ship-plan/SKILL.md`, "0. Pre-flight", step 3.
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** tool and auth checks, run in parallel (four calls in one message).
- **Command or tool call:** `gh auth status` | `ATL.atlassianUserInfo` (no parameters; `account_id` `5f1a2b3c4d5e6f7a8b9c0d1e` is the assignee) | `git fetch origin main --quiet`, then `git status --porcelain` (clean).
- **Source:** `ship-plan/SKILL.md`, "0. Pre-flight", step 4.
- **Told or worked out:** told (`<base>` = `main` from the config's `Base branch:`).
- **Files read for this step:** none new.

- **Step:** Slack channel check.
- **Command or tool call:** none: `## Slack` in the config names `#billing-reviews (C0BILL123)`, so no search, no question, no local file.
- **Source:** `ship-plan/SKILL.md`, "0. Pre-flight", step 6.
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** predict needs (steps 7-9).
- **Command or tool call:** none: no `[needs a decision]` task, no open question, no `## UI testing`, nothing on the "does not authorize" list, no standing answer to apply, so no batch.
- **Source:** `ship-plan/SKILL.md`, "0. Pre-flight", steps 7-9.
- **Told or worked out:** told.
- **Files read for this step:** none new.

### Q3
- **Step:** get the issue key.
- **Command or tool call:** none. The argument is a path, not a key; the next source, the plan header's `Source: BILL-412` line, gives `BILL-412`. Nothing asked.
- **Source:** `ship-plan/SKILL.md`, "0. Pre-flight", step 5 ("the argument; the plan's header, 'Source:' line ...").
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** questions to the user in pre-flight, and file writes.
- **Command or tool call:** Question asked: nothing asked (no issue question, no Slack question, no batch). Config written: nothing written. (`.claude/ship-plan.md` is not changed; `.claude/ship-plan.local.md` is not created; the only files written in the run are the ledger under `.superpowers/` and, at close-out, nothing in the config.)
- **Source:** `ship-plan/SKILL.md`, "0. Pre-flight", steps 5, 6 and 9.
- **Told or worked out:** told.
- **Files read for this step:** none new.

### Q4
- **Step:** read the issue (status, assignee, description) to decide the transition and whether the plan is already in it.
- **Command or tool call:** `ATL.getJiraIssue` with `cloudId: "https://acme.atlassian.net"`, `issueIdOrKey: "BILL-412"`, `responseContentFormat: "html"`. Result: To Do, unassigned, description lacks the plan.
- **Source:** `ship-plan/SKILL.md`, "1. Tracker and branch" ("Skip the transition if the issue is already in the status it leads to. If the description does not already contain the plan, append it"); `ship-plan/templates.md`, "Jira: plan appended" (read with `getJiraIssue` and `responseContentFormat: "html"`).
- **Told or worked out:** worked out for the parameter names; the format value is told.
- **Files read for this step:** none new.

- **Step:** assign to me.
- **Command or tool call:** `ATL.editJiraIssue` with `cloudId: "https://acme.atlassian.net"`, `issueIdOrKey: "BILL-412"`, `fields: {"assignee": {"accountId": "5f1a2b3c4d5e6f7a8b9c0d1e"}}`.
- **Source:** `ship-plan/SKILL.md`, "1. Tracker and branch" (`editJiraIssue` with the `assignee` set to your account id; every Jira call passes `Site:` as `cloudId`).
- **Told or worked out:** told (field shape worked out).
- **Files read for this step:** none new.

- **Step:** start transition.
- **Command or tool call:** `ATL.transitionJiraIssue` with `cloudId: "https://acme.atlassian.net"`, `issueIdOrKey: "BILL-412"`, `transitionName: "Start progress"`.
- **Source:** `ship-plan/SKILL.md`, "1. Tracker and branch"; config `## Jira` `Start transition:`.
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** append the plan to the description (never overwrite).
- **Command or tool call:** `ATL.editJiraIssue` with `cloudId: "https://acme.atlassian.net"`, `issueIdOrKey: "BILL-412"`, `contentFormat: "html"`, `fields: {"description": "<existing description HTML, unchanged>" + "<h2>Plan</h2>" + "Source: <plan path> · Spec: none" + architecture (2-4 sentences) + a task list of the 3 tasks, as HTML>`.
- **Source:** `ship-plan/templates.md`, "Jira: plan appended" and the "Plan" block of "Jira: new issue".
- **Told or worked out:** told (parameter nesting worked out).
- **Files read for this step:** none new.

### Q5
- **Step:** make sure the ledger directory is excluded from git, then create the branch from `origin/main` in the current checkout (no worktree).
- **Command or tool call:** `git switch -c feature/BILL-412-invoice-pdf-export origin/main`. Then: `mkdir -p .superpowers/ship-plan/feature/BILL-412-invoice-pdf-export`, and append `.superpowers/` to `.git/info/exclude` if it is not listed (never `.gitignore`). Then write the ledger's first line: `Phase: 1 | Plan: docs/superpowers/plans/2026-10-20-BILL-412-invoice-pdf-export.md | Issue: BILL-412 | PR: #- | merge: - | base run: -`.
- **Source:** `ship-plan/SKILL.md`, "1. Tracker and branch" (Branch: `<type>/<id>-<slug>`, issue key upper case, no username prefix, no worktree); "The ledger"; config `## Repo` `Base branch: main` (no `Branch:` pattern, so the default).
- **Told or worked out:** told for the `git switch -c <name> origin/<base>` form; name (`feature` type, slug `invoice-pdf-export`) worked out.
- **Files read for this step:** none new.

### Q6
- **Step:** run `verify-and-fix` to clean (already done, first call `clean`), then push.
- **Command or tool call:** `git push -u origin feature/BILL-412-invoice-pdf-export`
- **Source:** `ship-plan/SKILL.md`, "4. Verify, push, PR", steps 1-2.
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** write the PR body to a file (body per "PR body": 2-3 sentences with `[BILL-412](https://acme.atlassian.net/browse/BILL-412)`, no `## Plan` section because a Jira issue is tracked, What changed, How it was verified, Simplify pass, Decisions, Not tested, attribution line), then open the PR.
- **Command or tool call:** `gh pr create --base main --title "Invoice PDF export (BILL-412)" --body-file .superpowers/ship-plan/feature/BILL-412-invoice-pdf-export/pr-body.md`
- **Source:** `ship-plan/SKILL.md`, "4. Verify, push, PR", step 3; `ship-plan/templates.md`, "PR body".
- **Told or worked out:** told for `gh pr create --base <base>` and the title rule; `--title`/`--body-file` worked out.
- **Files read for this step:** none new.

- **Step:** get number and URL.
- **Command or tool call:** none: `gh pr create` prints the PR URL, `https://github.com/acme/billing-api/pull/57`; the number is the last path segment, 57. Write both into the ledger first line (`PR: #57`).
- **Source:** `ship-plan/SKILL.md`, "4. Verify, push, PR", step 3 and "The ledger".
- **Told or worked out:** worked out (the skill does not say how to get the number).
- **Files read for this step:** none new.

### Q7
- **Step:** repo coordinates (once).
- **Command or tool call:** `gh repo view --json nameWithOwner --jq .nameWithOwner` (acme/billing-api), and `gh repo view --json url --jq .url` (https://github.com/acme/billing-api, host `github.com`).
- **Source:** `ship-plan/SKILL.md`, "4R. Review", intro.
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** read the review rule (rulesets first).
- **Command or tool call:** `gh api repos/acme/billing-api/rules/branches/main --hostname github.com`. The one `pull_request` rule gives: record `Review rule: approvals 1 | code owners no | stale dismissed yes | threads must be resolved no | source ruleset` in the ledger. Branch protection call and `Approvals:` not used (the config has none).
- **Source:** `ship-plan/SKILL.md`, "4R. Review", step 1.
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** check whether Copilot is already requested.
- **Command or tool call:** `gh pr view 57 --json reviewRequests,reviews` (neither shows Copilot).
- **Source:** `ship-plan/SKILL.md`, "4R. Review", step 2.
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** request the AI review.
- **Command or tool call:** `gh pr edit 57 --add-reviewer @copilot`
- **Source:** `ship-plan/SKILL.md`, "4R. Review", step 2 (config has no `Copilot review: no`).
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** size for the Slack message, right before the post.
- **Command or tool call:** `gh pr view 57 --json changedFiles,additions,deletions`
- **Source:** `ship-plan/templates.md`, "Slack: review request".
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** Slack review request (once per PR; `interruptions.md` has no standing answer against it).
- **Command or tool call:** `SLACK.slack_send_message` with `channel_id: "C0BILL123"`, `unfurl_app_links: true`, `message` (text):
  `:github-pr: **Review request:** Invoice PDF export (BILL-412) https://github.com/acme/billing-api/pull/57`
  `<1-2 sentences: what a user gets, an invoice can be downloaded as a PDF.> https://acme.atlassian.net/browse/BILL-412`
  `Size: <files> files, +<added> −<removed>. Needs: 1 approval.`
  Then record `Slack: posted 1729771234.000100` in the ledger.
- **Source:** `ship-plan/SKILL.md`, "4R. Review", step 2; `ship-plan/templates.md`, "Slack: review request"; config `## Slack`.
- **Told or worked out:** told (the text parameter name is worked out; `message` assumed).
- **Files read for this step:** none new.

- **Step:** tracker status change.
- **Command or tool call:** `ATL.transitionJiraIssue` with `cloudId: "https://acme.atlassian.net"`, `issueIdOrKey: "BILL-412"`, `transitionName: "Start review"`.
- **Source:** `ship-plan/SKILL.md`, "4. Verify, push, PR", step 4; config `## Jira` `Review transition:`.
- **Told or worked out:** told.
- **Files read for this step:** none new.

### Q8
- **Step:** link the PR to the issue.
- **Command or tool call:** none. No link call: the key `BILL-412` in the branch name and the PR title is what links the PR (GitHub for Jira). If the PR does not show on the issue's Development panel, record a `Lesson:`. The "Merged" comment carries the PR link.
- **Source:** `ship-plan/SKILL.md`, "4. Verify, push, PR", step 5; "1. Tracker and branch" (branch naming).
- **Told or worked out:** told.
- **Files read for this step:** none new.

### Q9
- **Step:** wait for the PR's checks.
- **Command or tool call:** `gh pr checks 57 --watch --fail-fast` with `run_in_background` (while waiting, draft the closing comments). Finished and green: the command exits 0 and every check is pass (`SUCCESS`; `SKIPPED` also counts). Here the single `ci.yml` run passes. A non-zero exit means a red check, handled by step 7 of section 4. "No checks reported" does not apply (the workflow covers `pull_request` to `main`).
- **Source:** `ship-plan/SKILL.md`, "4. Verify, push, PR", steps 6-8.
- **Told or worked out:** told.
- **Files read for this step:** none new.

### Q10
- **Step:** gather placeholders (once).
- **Command or tool call:** `gh api user --jq .login --hostname github.com` (dana-dev); `<o>/<r>` and `<host>` are already known from Q7 (acme, billing-api, github.com).
- **Source:** `verify-and-fix/SKILL.md`, "4b. PR review comments".
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** poll for reviews (after checks are green). Copilot has not reviewed yet, so the rules are not met: one `sleep 300` with `run_in_background`, poll again, one status line `awaiting review: Copilot, <m> of 120 min` between sleeps.
- **Command or tool call:** `gh pr view 57 --json reviewDecision,reviews,reviewRequests,mergeStateStatus,statusCheckRollup`; and when waiting: `sleep 300`.
- **Source:** `ship-plan/SKILL.md`, "4R. Review", step 3.
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** fetch the threads.
- **Command or tool call:** `gh api graphql -f query='query ReviewThreads($owner:String!,$name:String!,$n:Int!){repository(owner:$owner,name:$name){pullRequest(number:$n){reviewThreads(first:100){nodes{id isResolved isOutdated path line comments(first:50){nodes{id author{login} body createdAt}}}}}}}' -F owner=acme -F name=billing-api -F n=57 --hostname github.com`
- **Source:** `verify-and-fix/SKILL.md`, "4b. PR review comments", Fetch.
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** fetch review bodies and conversation comments.
- **Command or tool call:** `gh pr view 57 --json reviews,comments`
- **Source:** `verify-and-fix/SKILL.md`, "4b. PR review comments", Fetch.
- **Told or worked out:** told.
- **Files read for this step:** none new.

(New feedback, the Copilot thread `PRRT_kwDOA1`, then runs `verify-and-fix --comments` per `ship-plan/SKILL.md` "4R. Review", step 3.)

### Q11
- **Step:** the fix, run by `verify-and-fix --comments`: failing test first, fix, commit `fix(review): close the PDF file handle` (a1b2c3d), gates, then push.
- **Command or tool call:** `git add app/invoices/pdf_export.py <test file>`; `git commit` (repo hooks run, with the trailers); `git push origin HEAD`.
- **Source:** `verify-and-fix/SKILL.md`, "5. Triage and fix" and "4b. PR review comments" (push `git push origin HEAD` while the PR branch is checked out).
- **Told or worked out:** told for push; staging by name and the commit message worked out.
- **Files read for this step:** none new.

- **Step:** reply in the thread (body written to a file in the ledger dir first: `Fixed in a1b2c3d: the PDF file handle is now closed. Test: <test name>.`).
- **Command or tool call:** `gh api graphql -f query='mutation ReplyToThread($id:ID!,$body:String!){addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$id,body:$body}){comment{id}}}' -f id=PRRT_kwDOA1 -F body=@.superpowers/verify-and-fix/feature/BILL-412-invoice-pdf-export/reply-PRRT_kwDOA1.md --hostname github.com`
- **Source:** `verify-and-fix/SKILL.md`, "4b. PR review comments", Reply; `ship-plan/templates.md`, "Review reply" (Fixed).
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** resolve the Copilot thread (it has a reply).
- **Command or tool call:** `gh api graphql -f query='mutation ResolveThread($id:ID!){resolveReviewThread(input:{threadId:$id}){thread{isResolved}}}' -f id=PRRT_kwDOA1 --hostname github.com`
- **Source:** `verify-and-fix/SKILL.md`, "4b. PR review comments", Reply (resolve).
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** re-request a reviewer.
- **Command or tool call:** none. Copilot is never re-requested; no person had requested changes or had an approval dismissed (alice-gh approves only afterwards).
- **Source:** `verify-and-fix/SKILL.md`, "4b. PR review comments", Re-request.
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** record `Replied: thread PRRT_kwDOA1 @ <last comment id> — fixed in a1b2c3d` and `Review:` lines in the ledger; tracker comment for the round (ship-plan posts it; `verify-and-fix` skips it under ship-plan).
- **Command or tool call:** `ATL.addOrEditJiraIssueComment` with `cloudId: "https://acme.atlassian.net"`, `issueIdOrKey: "BILL-412"`, `commentBody` (markdown): `**Review round 1** on [#57](https://github.com/acme/billing-api/pull/57): 1 comments from Copilot.` then a table row `| Copilot: file handle never closed (pdf_export.py:42) | Important | Fixed in `a1b2c3d` |` and `Checks: running. Approval: waiting for someone other than the author.`
- **Source:** `ship-plan/SKILL.md`, "4R. Review", step 3 ("post 'Jira comment: review round' from its review-item table"); `ship-plan/templates.md`, "Jira comment: review round"; `verify-and-fix/SKILL.md`, 4b "Jira".
- **Told or worked out:** told (parameter names worked out).
- **Files read for this step:** none new.

- **Step:** after the push, wait for checks again, then poll again.
- **Command or tool call:** `gh pr checks 57 --watch --fail-fast` (background), then `gh pr view 57 --json reviewDecision,reviews,reviewRequests,mergeStateStatus,statusCheckRollup` (alice-gh approved; Copilot reviewed the new push with no comments, so the rules are met).
- **Source:** `ship-plan/SKILL.md`, "4R. Review", step 3.
- **Told or worked out:** told.
- **Files read for this step:** none new.

### Q12
- **Step:** mergeability check.
- **Command or tool call:** `gh pr view 57 --json mergeable,mergeStateStatus,statusCheckRollup,reviewDecision` (every check `SUCCESS`/`SKIPPED`; `reviewDecision` APPROVED; not behind or conflicting).
- **Source:** `ship-plan/SKILL.md`, "5. Merge", step 1.
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** merge with the configured method (`Merge: squash`).
- **Command or tool call:** `gh pr merge 57 --squash --delete-branch`
- **Source:** `ship-plan/SKILL.md`, "5. Merge", step 3.
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** merge SHA.
- **Command or tool call:** `gh pr view 57 --json mergeCommit --jq .mergeCommit.oid` → `9f8e7d6c5b4a39281706f5e4d3c2b1a098765432` (recorded in the ledger by path, since the local branch is gone and the checkout is on `main`).
- **Source:** `ship-plan/SKILL.md`, "5. Merge", step 3.
- **Told or worked out:** told.
- **Files read for this step:** none new.

### Q13
- **Step:** tracker comment "Merged" (no done transition yet; no PR comment).
- **Command or tool call:** `ATL.addOrEditJiraIssueComment` with `cloudId: "https://acme.atlassian.net"`, `issueIdOrKey: "BILL-412"`, `commentBody` (markdown): `**Merged** in [#57](https://github.com/acme/billing-api/pull/57) (`9f8e7d6`). Base-branch CI is running; done follows when it is green.` then `### What was implemented` (per task), `### Test scenarios` table (or "None"), `Automated: ...`, `Gates: ...`, `### Review` (`Simplify pass: ...`, `1 review rounds. Fixed: 1 — file handle closed (a1b2c3d). Rulings: ...`).
- **Source:** `ship-plan/SKILL.md`, "5. Merge", step 5; `ship-plan/templates.md`, "Jira comment: merged".
- **Told or worked out:** told (parameter names worked out).
- **Files read for this step:** none new.

### Q14
- **Step:** find the push run for the merge commit (config `Workflow: ci.yml`).
- **Command or tool call:** `gh run list --workflow=ci.yml --branch=main --commit 9f8e7d6c5b4a39281706f5e4d3c2b1a098765432 --json databaseId,status` → run 4242.
- **Source:** `ship-plan/SKILL.md`, "6. Base-branch CI", step 1.
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** watch it.
- **Command or tool call:** `gh run watch 4242 --exit-status` with `run_in_background`. Exit 0 → green. (Only on exit 1: `gh run view 4242 --json status,conclusion` before calling it red.)
- **Source:** `ship-plan/SKILL.md`, "6. Base-branch CI", step 1.
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** decide green.
- **Command or tool call:** none. No `Green:` in the config, so the default applies (every check on the merge commit is success or skipped); run 4242 passed, so green. Go to section 7.
- **Source:** `ship-plan/SKILL.md`, "6. Base-branch CI", step 2; `ship-plan/config-format.md`, `## CI`.
- **Told or worked out:** told.
- **Files read for this step:** none new.

### Q15
- **Step:** After merge checks.
- **Command or tool call:** none: no `## After merge` section. Also read the `blockers.md` entries about the base branch's post-merge workflows: none.
- **Source:** `ship-plan/SKILL.md`, "7. Close out", steps 1-2.
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** closing comment: outcome Done.
- **Command or tool call:** `ATL.addOrEditJiraIssueComment` with `cloudId: "https://acme.atlassian.net"`, `issueIdOrKey: "BILL-412"`, `commentBody` (markdown): `**Done.** Base-branch CI run [4242](https://github.com/acme/billing-api/actions/runs/4242) is green.` then `- After-merge checks: None configured.` `- Pending: None.` `- Follow-ups: None.`
- **Source:** `ship-plan/SKILL.md`, "7. Close out", step 2 (Done); `ship-plan/templates.md`, "Jira comment: done".
- **Told or worked out:** told (parameter names and run URL form worked out).
- **Files read for this step:** none new.

- **Step:** done transition (Done means is the default, "merged and base-branch CI green", which is met).
- **Command or tool call:** `ATL.transitionJiraIssue` with `cloudId: "https://acme.atlassian.net"`, `issueIdOrKey: "BILL-412"`, `transitionName: "Done"`.
- **Source:** `ship-plan/SKILL.md`, "7. Close out", step 2; config `## Jira` `Done transition:`.
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** docs PR, report, ledger, batch.
- **Command or tool call:** Docs PR: none (no `Docs PR:` line). Report written to the user (needs-you empty, status, gate table, `Simplify:` line, rulings, not tested, lessons). Ledger first line rewritten to `Phase: done | ... | PR: #57 | merge: 9f8e7d6c5b4a39281706f5e4d3c2b1a098765432 | base run: 4242`. Batch: nothing to ask (nothing asked, no follow-up issue to create).
- **Source:** `ship-plan/SKILL.md`, "7. Close out", steps 3, 5, 6, 7.
- **Told or worked out:** told.
- **Files read for this step:** none new.

### Q16
- **Step:** collect lessons.
- **Command or tool call:** none. Questions asked this run: none. Rulings the user overturned: none. Tooling blockers got past: none. Approved config changes: none. `Lesson:` lines in the ledger: none. `ship-issue` `Asked:` lines: none (no `From ship-issue` block). So there is no `interruptions.md` or `blockers.md` entry to write, the logs already exist, and no lessons branch, no `gh pr list --state open --search lessons`, no commit, no PR. Ambiguity noted: the "Batch empty: open a docs-only PR" line is about the question batch, but with no entries a docs-only PR would carry no change, so I open none. If it were meant literally, the commands would be `git fetch origin main`, `git switch -c docs/ship-plan-lessons-2026-10-24 origin/main`, then commit, `git push -u origin docs/ship-plan-lessons-2026-10-24` and `gh pr create --base main`; I do not run them.
- **Source:** `ship-plan/SKILL.md`, "8. Lessons".
- **Told or worked out:** worked out (judgment on the empty case).
- **Files read for this step:** none new.

### Q17
- **Step:** questions asked and config changes over the whole run.
- **Command or tool call:** Questions asked to the user: none. Changes to `.claude/ship-plan.md`: none (no `Host:`/`Tracker:` line or anything else added; no `.claude/ship-plan.local.md` written).
- **Source:** `ship-plan/SKILL.md`, "0. Pre-flight" and "8. Lessons".
- **Told or worked out:** told.
- **Files read for this step:** none new.

### Q18
- **Step:** files under SKILLDIR read over the whole run, in order.
- **Command or tool call:** `ship-plan/SKILL.md`; `ship-plan/config-format.md`; `ship-plan/templates.md`; `verify-and-fix/SKILL.md`; `ship-plan/log-formats.md` (check only). Not read because they did not apply: `verify-and-fix/ui-testing.md` (no `## UI testing`); everything under `ship-issue/` (no `From ship-issue` block, and `ship-plan/log-formats.md` is the only log format needed); `ship-plan/hosts/azure-devops.md` (present in the baseline folder but not linked from `ship-plan/SKILL.md`; the repo is on GitHub); the removed `ship/` and `verify/` folders; `retro/`, `handoff/`, `continue-handoff/`. The baseline has no `ship-plan/hosts/github.md` and no `ship-plan/trackers/jira.md`, and no file for Linear.
- **Source:** `ship-plan/SKILL.md` (links: config-format, templates, log-formats), `verify-and-fix/SKILL.md`.
- **Told or worked out:** worked out.
- **Files read for this step:** none new.
