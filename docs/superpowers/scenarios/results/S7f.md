**Files read:**
1. `ship-plan/SKILL.md`
2. `ship-plan/phase-merge.md`
3. `ship-plan/tickets.md`
4. `ship-plan/phase-close.md`
5. `ship-plan/hosts/github.md`
6. `ship-plan/trackers/jira.md`
7. `ship-plan/templates-issue.md`
8. `ship-plan/config-format.md` (searched only, for the `Done means:` and `Green:` defaults)

### Q1

- **Step:** Resume: host and tracker files.
- **Command or tool call:** none (reading files only).
- **Source:** `ship-plan/SKILL.md`, intro bullet "Host and tracker" (`Host:` from `origin` = github; `Tracker:` from `## Jira`).
- **Told or worked out:** told
- **Files read for this step:** `ship-plan/SKILL.md`, `ship-plan/hosts/github.md`, `ship-plan/trackers/jira.md`

- **Step:** Resume at the ledger's `Phase: 5`: its phase file.
- **Command or tool call:** none
- **Source:** `ship-plan/SKILL.md`, "The ledger" ("on a resume the file of the ledger's `Phase:`"); section index "5. Merge — see phase-merge.md".
- **Told or worked out:** told
- **Files read for this step:** `ship-plan/phase-merge.md`

- **Step:** Section 5, step 4: ledger has a `Tickets:` line, so do tickets.md's *Before the merge*.
- **Command or tool call:** none
- **Source:** `ship-plan/phase-merge.md`, "5. Merge", step 4.
- **Told or worked out:** told
- **Files read for this step:** `ship-plan/tickets.md`

- **Step:** Section 5, step 6: "Issue comment: merged" template.
- **Command or tool call:** none
- **Source:** `ship-plan/phase-merge.md`, "5. Merge", step 6; `ship-plan/templates-issue.md` header ("Read when a run … writes to the issue").
- **Told or worked out:** told
- **Files read for this step:** `ship-plan/templates-issue.md`

- **Step:** Section 6 green, 6b: nothing configured (no `## After merge`, no `## UI testing`); red-base.md not needed.
- **Command or tool call:** none
- **Source:** `ship-plan/phase-merge.md`, "6. Base-branch CI" step 2, "6b. Validate the deploy".
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Section 7: close phase file; check `Done means:` default.
- **Command or tool call:** none
- **Source:** `ship-plan/SKILL.md` index "7. Close out — see phase-close.md"; `ship-plan/config-format.md` row `Done means:` (default "merged and base-branch CI green").
- **Told or worked out:** told
- **Files read for this step:** `ship-plan/phase-close.md`, `ship-plan/config-format.md`

- **Step:** Section 7, step 1: `Tickets:` line, so tickets.md *Close-out* (and its templates).
- **Command or tool call:** none
- **Source:** `ship-plan/phase-close.md`, "7. Close out", step 1 Done bullet.
- **Told or worked out:** told
- **Files read for this step:** `ship-plan/tickets.md` (again, its *Close-out* and *Templates*)

Order in the run: `ship-plan/SKILL.md` → `ship-plan/hosts/github.md` → `ship-plan/trackers/jira.md` → `ship-plan/phase-merge.md` → `ship-plan/tickets.md` → `ship-plan/templates-issue.md` → `ship-plan/phase-close.md` → `ship-plan/config-format.md` → `ship-plan/tickets.md`. Not read: `notifiers/slack.md` (channel `none`), `red-base.md` (base green), `log-formats.md` (only to create a missing log at lessons).

### Q2

- **Step:** Section 5, step 1: merge state (checks green, rules met, not behind, so step 2 does not run).
- **Command or tool call:** `gh pr view 64 --json mergeable,mergeStateStatus,statusCheckRollup,reviewDecision`
- **Source:** `ship-plan/phase-merge.md` "5. Merge" step 1; `ship-plan/hosts/github.md` "Merge state".
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Section 5, step 3: deploy check skipped (no `Allowed:`/`Deploys:` ledger line, no `## Allowed` or `Merge deploys to:` in config).
- **Command or tool call:** none, "merge exactly as before, with no added command".
- **Source:** `ship-plan/phase-merge.md` "5. Merge" step 3.
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** tickets.md *Before the merge*: fetch base (step 2's fetch did not run, PR not behind).
- **Command or tool call:** `git fetch origin main`
- **Source:** `ship-plan/tickets.md` "Before the merge" ("after step 2's fetch"); `ship-plan/SKILL.md` pre-approved form `git fetch origin <ref>`.
- **Told or worked out:** worked out (step 2 skipped, so the fetch is run here)
- **Files read for this step:** `ship-plan/tickets.md`

- **Step:** Count each key's commit subjects.
- **Command or tool call:** `git log --format=%s origin/main..HEAD`
- **Source:** `ship-plan/tickets.md` "Before the merge".
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Write the counts in the ledger (keys of the ledger's `Tickets:` line). BILL-471: 2 subjects; BILL-472: 0.
- **Command or tool call:** none (ledger edit). Line written:
  `Commits: BILL-471 2, BILL-472 0`
- **Source:** `ship-plan/tickets.md` "Before the merge" ("write `Commits: <key> <n>, …` in the ledger").
- **Told or worked out:** told (counts worked out)
- **Files read for this step:** none new

- **Step:** Merge (section 5, step 4), then record SHA.
- **Command or tool call:** `gh pr merge 64 --squash --delete-branch`, then `gh pr view 64 --json mergeCommit --jq .mergeCommit.oid` (→ `9e8f7a6…`)
- **Source:** `ship-plan/phase-merge.md` "5. Merge" step 4; `ship-plan/hosts/github.md` "Merge the PR".
- **Told or worked out:** told
- **Files read for this step:** none new. Ledger first line rewritten after it:
  `Phase: 5 | Plan: docs/superpowers/plans/2026-10-20-BILL-470-invoice-export.md | Issue: BILL-470 | PR: #64 | merge: 9e8f7a6`

### Q3

Section 5, step 6 first posts "Issue comment: merged" on BILL-470 only (no status change). Close-out outcome is **Done** (merged, `ci.yml` run green, no 6b validation configured; `Done means:` default "merged and base-branch CI green" met).

- **Step:** BILL-470 (run issue): "Issue comment: done", status changes to Done.
- **Command or tool call:** `mcp__plugin_atlassian_atlassian__addOrEditJiraIssueComment` cloudId `https://acme.atlassian.net`, issue key `BILL-470`, comment body = "Issue comment: done" (`**Done.** Base-branch CI run [<id>](<url>) is green.` / After-merge checks: None configured / Pending: None / Follow-ups: <…>); then `mcp__plugin_atlassian_atlassian__transitionJiraIssue` cloudId `https://acme.atlassian.net`, issue key `BILL-470`, `transitionName: "Done"`. (Parameter names per tool schema.)
- **Source:** `ship-plan/phase-close.md` "7. Close out" step 1: "With an issue: "Issue comment: done", then the tracker's *Set status* to the done status, **only when `Done means:` is met**"; `ship-plan/templates-issue.md` "Issue comment: done"; `ship-plan/trackers/jira.md` "Comment", "Set status" (Done transition).
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** BILL-471: "Issue comment: done (batch ticket)", status changes to Done (Task 2 committed, not parked; `Commits:` 2).
- **Command or tool call:** `mcp__plugin_atlassian_atlassian__addOrEditJiraIssueComment` cloudId `https://acme.atlassian.net`, issue key `BILL-471`, body `**Done** with BILL-470, in [#64](<pr url>) (merge `9e8f7a6`): 2 commit(s) carry this key. Base-branch CI run [<id>](<url>) is green.`; then `mcp__plugin_atlassian_atlassian__transitionJiraIssue` cloudId `https://acme.atlassian.net`, issue key `BILL-471`, `transitionName: "Done"`.
- **Source:** `ship-plan/tickets.md` "Close-out": "Each `Tickets:` issue gets the done status with the run issue, and only when all of these hold: the run issue got it; every plan task whose heading names its key is committed, none parked, skipped or left `[needs a decision]`; and the ledger's `Commits:` line counts at least one commit for it. Then "Issue comment: done (batch ticket)" and the tracker's *Set status* to the done status."
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** BILL-472: "Issue comment: not done (batch ticket)", status stays; goes in the batch (Task 3 `[needs a decision]`; `Commits:` 0).
- **Command or tool call:** `mcp__plugin_atlassian_atlassian__addOrEditJiraIssueComment` cloudId `https://acme.atlassian.net`, issue key `BILL-472`, body `**Not done.** BILL-470 merged in [#64](<pr url>), but this issue's part is not in it: Task 3 (Export fixtures for credit notes) parked, needs a decision; no commit carries this key. It stays in its status.` No transition.
- **Source:** `ship-plan/tickets.md` "Close-out": "Otherwise "Issue comment: not done (batch ticket)", naming what is missing; its status stays, and it goes in the batch."
- **Told or worked out:** told
- **Files read for this step:** none new
