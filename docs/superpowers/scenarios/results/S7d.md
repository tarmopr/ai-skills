**Files read:** (order I opened them for this exercise)
1. `ship-plan/SKILL.md`
2. `ship-plan/config-format.md`
3. `ship-plan/phase-implement.md`
4. `ship-plan/notifiers/slack.md`
5. `ship-plan/hosts/github.md`
6. `ship-plan/trackers/jira.md`
7. `ship-plan/phase-verify.md`
8. `ship-plan/phase-merge.md`
9. `ship-plan/templates.md`
10. `ship-plan/templates-issue.md`
11. `verify-and-fix/SKILL.md`

### Q1

- **Step:** Order in which the run reads skill files, pre-flight to review-request post.
- **Command or tool call:** Read, in this order:
  1. `ship-plan/SKILL.md` (invocation)
  2. `ship-plan/config-format.md` (config format, read together with `.claude/ship-plan.md`)
  3. `ship-plan/hosts/github.md` (Host from `origin` = github.com → `github`)
  4. `ship-plan/trackers/jira.md` (Tracker from `## Jira` → `jira`)
  5. `ship-plan/phase-implement.md` (section 0 starts)
  6. `ship-plan/notifiers/slack.md` (pre-flight step 6: `## Slack` in the local file names a channel)
  7. `ship-plan/templates-issue.md` (section 1, run has an issue)
  8. `ship-plan/templates.md` (section 1, PR body)
  9. `ship-plan/phase-verify.md` (section 3/4 starts)
  10. `verify-and-fix/SKILL.md` (section 4 step 1, `--session`; no PR yet, so no `review-comments.md`)
  11. `ship-plan/phase-merge.md` (section 4 step 4 names section 4R steps 1–2)
- **Source:** `ship-plan/SKILL.md` intro bullet "Host and tracker", "The sections live in phase files"; `ship-plan/phase-implement.md` "0. Pre-flight" step 6, "1. Tracker and branch"; `ship-plan/phase-verify.md` "4. Verify, push, PR" steps 1, 4; `verify-and-fix/SKILL.md` "4b. PR review comments".
- **Told or worked out:** told
- **Files read for this step:** all of the above

### Q2

- **Step:** Read `## Slack` from the config.
- **Command or tool call:** Read `.claude/ship-plan.md` (already read in full at start): no `## Slack` section.
- **Source:** `ship-plan/phase-implement.md` "0. Pre-flight" step 6; `ship-plan/config-format.md` "`## Slack`"
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Fall back to the git-ignored local file.
- **Command or tool call:** Read `.claude/ship-plan.local.md` → `## Slack` / `- Channel: #ops-reviews (C0OPS999)`. Review requests go to `#ops-reviews`, channel id `C0OPS999`.
- **Source:** `ship-plan/phase-implement.md` "0. Pre-flight" step 6 ("Read `## Slack` from the config, else from `.claude/ship-plan.local.md`"); `ship-plan/config-format.md` "`## Slack`" ("is read when this section is missing, so a machine that answered before keeps working")
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Channel named → read the notifier file; no question.
- **Command or tool call:** Read `ship-plan/notifiers/slack.md`. *Choose the channel* not run (only when neither config nor local file has it). No `slack_search_channels` call.
- **Source:** `ship-plan/phase-implement.md` "0. Pre-flight" step 6; `ship-plan/notifiers/slack.md` "Choose the channel" ("Neither has it: ask now")
- **Told or worked out:** told
- **Files read for this step:** `ship-plan/notifiers/slack.md`

Asked about Slack: nothing asked.

### Q3

- **Step:** Write to `.claude/ship-plan.local.md`.
- **Command or tool call:** none — the local file is "read, never written".
- **Source:** `ship-plan/phase-implement.md` "0. Pre-flight" step 6; `ship-plan/config-format.md` "`## Slack`" ("is never written"); `ship-plan/notifiers/slack.md` "Choose the channel" ("Nothing is written to the local file")
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Write `## Slack` to `.claude/ship-plan.md`.
- **Command or tool call:** none — the committed write (`chore: record Slack channel for review requests`) belongs only to *Choose the channel*, which runs only when `## Slack` is missing from both config and local file. Here the local file has it.
- **Source:** `ship-plan/phase-implement.md` "0. Pre-flight" step 6; `ship-plan/notifiers/slack.md` "Choose the channel" ("Record it once, in the committed config")
- **Told or worked out:** told
- **Files read for this step:** none new

Result: nothing written (no lines, no commit) to either file.

### Q4

- **Step:** Check `interruptions.md` for a standing answer about the review-request post.
- **Command or tool call:** `grep -n '^##' .claude/ship-plan/interruptions.md` (scenario gives no matching entry → default applies)
- **Source:** `ship-plan/notifiers/slack.md` "Review request" ("unless a standing answer in `interruptions.md` says otherwise … read it before the post"); `ship-plan/SKILL.md` "Reading the logs"
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Review rule (4R step 1), for the `Needs:` part.
- **Command or tool call:** `gh api repos/acme/billing-api/rules/branches/main --hostname github.com` (else `gh api repos/acme/billing-api/branches/main/protection/required_pull_request_reviews --hostname github.com`)
- **Source:** `ship-plan/phase-merge.md` "4R. Review" step 1; `ship-plan/hosts/github.md` "Read the review rule"
- **Told or worked out:** told
- **Files read for this step:** `ship-plan/phase-merge.md`

- **Step:** Request the AI review (4R step 2, before the Slack post).
- **Command or tool call:** `gh pr edit 60 --add-reviewer @copilot`
- **Source:** `ship-plan/phase-merge.md` "4R. Review" step 2; `ship-plan/hosts/github.md` "Request an AI review"
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Check for a CODEOWNERS file matching a changed file (decides `code owner approval` vs `<n> approvals`).
- **Command or tool call:** Read `CODEOWNERS`, `.github/CODEOWNERS`, `docs/CODEOWNERS` (whichever exists)
- **Source:** `ship-plan/notifiers/slack.md` "Review request"
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** PR size right before the post.
- **Command or tool call:** `gh pr view 60 --json changedFiles,additions,deletions`
- **Source:** `ship-plan/notifiers/slack.md` "Review request"; `ship-plan/hosts/github.md` "PR size"
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Post the review request.
- **Command or tool call:** `mcp__plugin_engineering_slack__slack_send_message` with
  - `channel_id`: `C0OPS999`
  - `unfurl_app_links`: `true`
  - `message`:
    ```
    **Review request:** Send dunning emails (BILL-420) https://github.com/acme/billing-api/pull/60
    <1–2 sentences: what changes for a user, from the plan> Issue: https://acme.atlassian.net/browse/BILL-420
    Size: <changedFiles> files, +<additions> −<deletions>. Needs: <n> approvals.
    ```
    (No `Post prefix:` set → nothing before `**Review request:**`. `Needs:` is `code owner approval` instead only if a CODEOWNERS rule matches a changed file; `<n>` from the `Review rule:` line.)
- **Source:** `ship-plan/phase-merge.md` "4R. Review" step 2 ("Review request"); `ship-plan/notifiers/slack.md` "Review request"; `ship-plan/config-format.md` "`## Slack`" (`Post prefix:` absent: nothing); `ship-plan/SKILL.md` "What invoking this skill authorizes" (`## Slack` channel only); `ship-plan/trackers/jira.md` "Issue keys" for the key
- **Told or worked out:** told (template, tool, parameters); issue URL `https://acme.atlassian.net/browse/BILL-420` worked out from `Site:` + key
- **Files read for this step:** none new

### Q5

- **Step:** Record the post in the ledger, once per PR.
- **Command or tool call:** append to `.superpowers/ship-plan/<branch with / as ->/ledger.md` (branch e.g. `feature/BILL-420-send-dunning-emails` → `feature-BILL-420-send-dunning-emails`) the line:
  `Slack: posted <ts>`
  (`<ts>` from the `slack_send_message` result; never post again for PR #60, also not on a resume). No `Used:` line, since no `interruptions.md` entry applied; no ledger line about the channel source is prescribed.
- **Source:** `ship-plan/notifiers/slack.md` "Review request" ("Once per PR: record `Slack: posted <ts>` in the ledger"); `ship-plan/SKILL.md` "The ledger", "Reading the logs" step 5
- **Told or worked out:** told
- **Files read for this step:** none new
