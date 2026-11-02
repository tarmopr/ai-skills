**Files read:**
1. ship-plan/SKILL.md (lines 1-494 only; the rest, after section 6, is not needed up to the review request)
2. ship-plan/notifiers/slack.md
3. ship-plan/config-format.md
4. ship-plan/hosts/github.md
5. ship-plan/trackers/jira.md

### Q1
- **Step:** list files read, in order.
- **Command or tool call:** none, answered by the list above.
- **Source:** ship-plan/SKILL.md, "Before anything else" (config-format.md), "Host and tracker" (hosts/github.md, trackers/jira.md), pre-flight step 6 (notifiers/slack.md).
- **Told or worked out:** told.
- **Files read for this step:** the five files above.

### Q2
- **Step:** read the repo's config. It has no `## Slack`.
- **Command or tool call:** Read tool on `.claude/ship-plan.md`.
- **Source:** ship-plan/SKILL.md, "0. Pre-flight" step 6.
- **Told or worked out:** told.
- **Files read for this step:** ship-plan/SKILL.md.

- **Step:** fall back to the local file. It gives `Channel: #ops-reviews (C0OPS999)`, so review requests go to C0OPS999. No `Channel: none`, no question.
- **Command or tool call:** Read tool on `.claude/ship-plan.local.md`.
- **Source:** ship-plan/SKILL.md, "0. Pre-flight" step 6 ("else from `.claude/ship-plan.local.md`... Either says where review requests go"); ship-plan/config-format.md, "`## Slack`" (the local file is read when the committed section is missing).
- **Told or worked out:** told.
- **Files read for this step:** ship-plan/config-format.md.

- **Step:** a channel is named, so read the notifier. Slack question asked: nothing asked. The "Post a review request to Slack when the PR is created?" question only fires when neither file has `## Slack`.
- **Command or tool call:** Read tool on ship-plan/notifiers/slack.md.
- **Source:** ship-plan/SKILL.md, "0. Pre-flight" step 6 ("When `## Slack`... names a channel, read notifiers/slack.md"); ship-plan/notifiers/slack.md, "Choose the channel".
- **Told or worked out:** told.
- **Files read for this step:** ship-plan/notifiers/slack.md.

### Q3
- **Step:** write to `.claude/ship-plan.local.md`?
- **Command or tool call:** none. Nothing written. The local file is "read, never written".
- **Source:** ship-plan/SKILL.md, pre-flight step 6; ship-plan/notifiers/slack.md, "Choose the channel" ("Nothing is written to `.claude/ship-plan.local.md`").
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** write `## Slack` to `.claude/ship-plan.md`?
- **Command or tool call:** none. Nothing written, so no commit. The "Record it once" commit (`chore: record Slack channel for review requests`) applies only when neither file had a channel, and one did. The skill does not migrate the local channel into the committed config.
- **Source:** ship-plan/notifiers/slack.md, "Choose the channel" ("Neither has it: ask... Record it once"); ship-plan/config-format.md, "`## Slack`".
- **Told or worked out:** worked out (the rule is conditional, and the condition is not met).
- **Files read for this step:** none new.

### Q4
- **Step:** precondition: read the review rule once (section 4R step 1). It gives the `Needs:` value.
- **Command or tool call:** `gh api repos/acme/billing-api/rules/branches/main --hostname github.com`. If it is not readable, `gh api repos/acme/billing-api/branches/main/protection/required_pull_request_reviews --hostname github.com`. Result recorded as `Review rule: approvals <n> | code owners <yes/no> | ...`.
- **Source:** ship-plan/SKILL.md, "4R. Review" step 1; ship-plan/hosts/github.md, "Read the review rule" and "Repo identity".
- **Told or worked out:** told (`<o>/<r>` and `<host>` filled from the scenario).
- **Files read for this step:** none new.

- **Step:** check CODEOWNERS, to choose between `code owner approval` and `<n> approvals`.
- **Command or tool call:** Read tool on `CODEOWNERS`, `.github/CODEOWNERS` and `docs/CODEOWNERS`, matched against the changed files. Assume none exists, so the text says `<n> approvals`.
- **Source:** ship-plan/notifiers/slack.md, "Review request" (the paragraph after the template).
- **Told or worked out:** told for the rule; worked out for the tool (no command is given).
- **Files read for this step:** none new.

- **Step:** PR size, right before the post.
- **Command or tool call:** `gh pr view 60 --json changedFiles,additions,deletions`
- **Source:** ship-plan/notifiers/slack.md, "Review request"; ship-plan/hosts/github.md, "PR size".
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** post the review request (4R step 2, after the Copilot request `gh pr edit 60 --add-reviewer @copilot`). Read the text first, since the message cannot be edited or deleted.
- **Command or tool call:** tool `mcp__plugin_engineering_slack__slack_send_message` with these parameters:
  - `channel_id`: `C0OPS999`
  - `unfurl_app_links`: `true` (default; `interruptions.md` may override it with a standing answer)
  - `message`:
```
:github-pr: **Review request:** Send dunning emails (BILL-420) https://github.com/acme/billing-api/pull/60
<1-2 sentences: what changes for a user, e.g. customers with a failed payment now get dunning emails.> Issue: https://acme.atlassian.net/browse/BILL-420
Size: <files> files, +<added> −<removed>. Needs: <n> approvals.
```
- **Source:** ship-plan/notifiers/slack.md, "Review request"; ship-plan/SKILL.md, "4R. Review" step 2 and "What invoking this skill authorizes" (post only in the recorded channel).
- **Told or worked out:** told for the tool, `channel_id`, `unfurl_app_links` and template. Worked out: the issue URL (`Site:` plus `/browse/` plus key, which the skill does not spell out), the user-facing sentence, and the `Needs:` value (placeholders from the review rule and CODEOWNERS result).
- **Files read for this step:** none new.

### Q5
- **Step:** record the post in the ledger once `slack_send_message` returns the message `ts`.
- **Command or tool call:** Edit tool, appending the line `Slack: posted <ts>` to `.superpowers/ship-plan/feature-BILL-420-<slug>/ledger.md`. The folder name is the branch with `/` written as `-`; `<slug>` is a placeholder. It also gets `Review rule: approvals <n> | code owners <yes/no> | stale dismissed <yes/no> | threads must be resolved <yes/no> | source <...>` from 4R step 1. No `Asked:` line, since nothing was asked. A later re-review reply and the `pr-merged` reaction both read `<ts>` from this line.
- **Source:** ship-plan/notifiers/slack.md, "Review request" ("Once per PR: record `Slack: posted <ts>`... never post again for that PR, also not on a resume"); ship-plan/SKILL.md, "The ledger" and "4R. Review" step 1.
- **Told or worked out:** told for the line; worked out for the file path and tool.
- **Files read for this step:** none new.
