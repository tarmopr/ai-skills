**Files read:**
1. `ship-plan/SKILL.md`
2. `ship-plan/config-format.md`
3. `ship-plan/phase-implement.md`
4. `ship-plan/notifiers/slack.md`
5. `ship-plan/hosts/github.md`
6. `ship-plan/trackers/jira.md`
7. `ship-plan/phase-merge.md`
8. `ship-plan/phase-verify.md`
9. `ship-plan/templates-issue.md`
10. `ship-plan/templates.md`
11. `verify-and-fix/SKILL.md` (first 80 lines)

(I also ran one read-only `wc`/`grep` over `verify-and-fix/*.md` to look for Slack mentions. It found none.)

### Q1

- **Step:** Order the files are read in during the run, from pre-flight to the review request post.
- **Command or tool call:** Read, in this order:
  1. `ship-plan/SKILL.md`, at start.
  2. `ship-plan/config-format.md`, the config format, read with the config.
  3. `ship-plan/hosts/github.md`. Host from origin `github.com` → `github`.
  4. `ship-plan/trackers/jira.md`. `## Jira` present → `jira`.
  5. `ship-plan/phase-implement.md`, when section 0 starts.
  6. `ship-plan/notifiers/slack.md`, in pre-flight step 6, because the local file names a channel.
  7. `ship-plan/templates-issue.md`, in section 1 (the run has an issue).
  8. `ship-plan/phase-verify.md`, when section 3/4 starts.
  9. `verify-and-fix/SKILL.md`, in section 4 step 1.
  10. `ship-plan/templates.md`, for the PR body in section 4 step 3.
  11. `ship-plan/phase-merge.md`, when section 4R starts (section 4 step 4 → 4R steps 1–2).
- **Source:** `ship-plan/SKILL.md` intro "Host and tracker" and "The sections live in phase files"; `ship-plan/phase-implement.md` "0. Pre-flight" step 6 and "1. Tracker and branch"; `ship-plan/phase-verify.md` "4. Verify, push, PR" steps 1, 3, 4.
- **Told or worked out:** told
- **Files read for this step:** all of the above

### Q2

- **Step:** Read the committed config's `## Slack`.
- **Command or tool call:** Read `.claude/ship-plan.md`. It has no `## Slack`.
- **Source:** `ship-plan/phase-implement.md` "0. Pre-flight" step 6; `ship-plan/config-format.md` "`## Slack`"
- **Told or worked out:** told
- **Files read for this step:** `ship-plan/phase-implement.md`, `ship-plan/config-format.md`

- **Step:** Fall back to the local file.
- **Command or tool call:** Read `.claude/ship-plan.local.md`, which gives `Channel: #ops-reviews (C0OPS999)`. Review requests go to **#ops-reviews (C0OPS999)**. I know this because the config lacks `## Slack`, and the local file is read in that case ("so a machine that answered before keeps working").
- **Source:** `ship-plan/phase-implement.md` "0. Pre-flight" step 6; `ship-plan/config-format.md` "`## Slack`"; `ship-plan/notifiers/slack.md` "Choose the channel"
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Load the notifier, because a channel is named.
- **Command or tool call:** Read `notifiers/slack.md`. *Choose the channel* does not ask, because the local file has the channel. No `slack_search_channels` call. **Nothing asked** about Slack.
- **Source:** `ship-plan/phase-implement.md` "0. Pre-flight" step 6 ("When `## Slack` (config, else `.claude/ship-plan.local.md`) names a channel, read notifiers/slack.md"); `ship-plan/notifiers/slack.md` "Choose the channel" ("Neither has it: ask now")
- **Told or worked out:** told
- **Files read for this step:** `ship-plan/notifiers/slack.md`

### Q3

- **Step:** Write to `.claude/ship-plan.local.md`?
- **Command or tool call:** none. The local file is "read, never written".
- **Source:** `ship-plan/phase-implement.md` "0. Pre-flight" step 6; `ship-plan/config-format.md` "`## Slack`" ("is never written"); `ship-plan/notifiers/slack.md` "Choose the channel" ("Nothing is written to the local file")
- **Told or worked out:** told
- **Files read for this step:** none new
- Result: **nothing written**.

- **Step:** Write `## Slack` to `.claude/ship-plan.md`?
- **Command or tool call:** none. The committed config gets `## Slack` only from the answer to *Choose the channel*, which is asked only when neither file has the channel. Here nothing was asked, so nothing is written and there is no `chore: record Slack channel for review requests` commit.
- **Source:** `ship-plan/notifiers/slack.md` "Choose the channel" ("Record it once, in the committed config", under "Neither has it"); `ship-plan/config-format.md` "`## Slack`"
- **Told or worked out:** worked out
- **Files read for this step:** none new
- Result: **nothing written**, no commit.

### Q4

- **Step:** Repo identity, for `gh api` calls.
- **Command or tool call:** `gh repo view --json nameWithOwner --jq .nameWithOwner` (→ `acme/billing-api`), then `gh repo view --json url --jq .url` (host `github.com`).
- **Source:** `ship-plan/hosts/github.md` "Repo identity"
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Record the review rule (4R step 1). It feeds `Needs:`.
- **Command or tool call:** `gh api repos/acme/billing-api/rules/branches/main --hostname github.com`. If that cannot be read: `gh api repos/acme/billing-api/branches/main/protection/required_pull_request_reviews --hostname github.com`. Then record the ledger line `Review rule: approvals <n> | code owners <yes/no> | stale dismissed <yes/no> | threads must be resolved <yes/no> | source <…>`.
- **Source:** `ship-plan/phase-merge.md` "4R. Review" step 1; `ship-plan/hosts/github.md` "Read the review rule"
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Request the AI review (4R step 2, before the Slack post).
- **Command or tool call:** `gh pr view 60 --json reviewRequests,reviews`, then `gh pr edit 60 --add-reviewer @copilot` (skip it if Copilot is already requested).
- **Source:** `ship-plan/phase-merge.md` "4R. Review" step 2; `ship-plan/hosts/github.md` "Request an AI review"
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Check for a standing answer that changes the post.
- **Command or tool call:** `grep -n '^##' .claude/ship-plan/interruptions.md` (the repo log). Read any matching entry. I assume none matches.
- **Source:** `ship-plan/notifiers/slack.md` "Review request" ("unless a standing answer in interruptions.md says otherwise … read it before the post"); `ship-plan/SKILL.md` "Reading the logs"
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** PR size, right before the post.
- **Command or tool call:** `gh pr view 60 --json changedFiles,additions,deletions`
- **Source:** `ship-plan/notifiers/slack.md` "Review request"; `ship-plan/hosts/github.md` "PR size"
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Decide the `Needs:` wording (CODEOWNERS).
- **Command or tool call:** Read `CODEOWNERS`, `.github/CODEOWNERS`, `docs/CODEOWNERS` (whichever exists) and match its rules against the changed files. Write `code owner approval` only on a match; otherwise `<n> approvals` from the review rule.
- **Source:** `ship-plan/notifiers/slack.md` "Review request"
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Post the review request.
- **Command or tool call:** `mcp__plugin_engineering_slack__slack_send_message` with:
  - `channel_id`: `"C0OPS999"`
  - `unfurl_app_links`: `true`
  - `message`:
    ```
    :github-pr: **Review request:** Send dunning emails (BILL-420) https://github.com/acme/billing-api/pull/60
    <1–2 sentences: what changes for a user, from the plan's Goal.> Issue: https://acme.atlassian.net/browse/BILL-420
    Size: <files> files, +<added> −<removed>. Needs: <n> approvals.
    ```
    (`Needs: code owner approval.` only if CODEOWNERS matches a changed file.)
- **Source:** `ship-plan/phase-merge.md` "4R. Review" step 2 ("Review request: the notifier's *Review request* … when `## Slack` (config, else `.claude/ship-plan.local.md`) names a channel"); `ship-plan/notifiers/slack.md` "Review request"
- **Told or worked out:** told. The issue URL form `<Site>/browse/BILL-420` is worked out.
- **Files read for this step:** none new

### Q5

- **Step:** Record the post once, so no resume posts again.
- **Command or tool call:** Append `Slack: posted <ts>` to `.superpowers/ship-plan/feature-BILL-420-send-dunning-emails/ledger.md`, where `<ts>` is the message ts that `slack_send_message` returned. No `Asked:` or `Ruling: user` line about Slack, because nothing was asked.
- **Source:** `ship-plan/notifiers/slack.md` "Review request" ("record `Slack: posted <ts>` in the ledger and never post again for that PR, also not on a resume"); `ship-plan/SKILL.md` "The ledger"
- **Told or worked out:** told. The branch/ledger name `feature/BILL-420-send-dunning-emails` is worked out from the title.
- **Files read for this step:** none new
