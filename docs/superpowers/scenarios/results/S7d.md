**Files read:**
- ship-plan/SKILL.md
- ship-plan/config-format.md
- ship-plan/notifiers/slack.md
- ship-plan/hosts/github.md
- ship-plan/trackers/jira.md

### Q1

- **Step:** Read the skill and the files it links for this run (host github from the origin URL, tracker jira from `## Jira`, Slack channel found in the local file).
- **Command or tool call:** none, reading files only.
- **Source:** ship-plan/SKILL.md, "Before anything else..." and "Host and tracker"; 0. Pre-flight, step 6.
- **Told or worked out:** told.
- **Files read for this step:** ship-plan/SKILL.md, ship-plan/config-format.md, ship-plan/notifiers/slack.md, ship-plan/hosts/github.md, ship-plan/trackers/jira.md.

Order: SKILL.md, config-format.md, hosts/github.md, trackers/jira.md, notifiers/slack.md (slack.md is read because the local file names a channel, step 6).

### Q2

- **Step:** Pre-flight step 6: find the channel. `## Slack` is missing from `.claude/ship-plan.md`, so read `## Slack` from `.claude/ship-plan.local.md`. It has `Channel: #ops-reviews (C0OPS999)`. Review requests go to #ops-reviews, id C0OPS999. Because the channel is named, read notifiers/slack.md.
- **Command or tool call:** none (reading the two config files).
- **Source:** ship-plan/SKILL.md, "0. Pre-flight", step 6; ship-plan/config-format.md, "## Slack" ("the local file is read when this section is missing"); ship-plan/notifiers/slack.md, "Choose the channel" (only asks when neither has it).
- **Told or worked out:** told.
- **Files read for this step:** none new.

Ask anything about Slack: nothing asked. The "Choose the channel" question ("Post a review request to Slack when the PR is created?") runs only when neither file has `## Slack`; here the local file has it.

### Q3

- **Step:** Write to the config files.
- **Command or tool call:** none, nothing to write.
- **Source:** ship-plan/SKILL.md, "0. Pre-flight", step 6 ("a git-ignored file on this machine, read, never written"); ship-plan/notifiers/slack.md, "Choose the channel" ("Nothing is written to `.claude/ship-plan.local.md`"); ship-plan/config-format.md, "## Slack" (the committed section is written only when the run asks; it did not ask).
- **Told or worked out:** told.
- **Files read for this step:** none new.

`.claude/ship-plan.local.md`: nothing written. Slack lines in `.claude/ship-plan.md`: nothing written. No commit.

### Q4

- **Step:** Record the review rule (once per run), needed for the "Needs:" field.
- **Command or tool call:** `gh api repos/acme/billing-api/rules/branches/main --hostname github.com` (the rulesets; if unreadable, `gh api repos/acme/billing-api/branches/main/protection/required_pull_request_reviews --hostname github.com`; else assume 1). Result recorded as `Review rule: approvals <n> | code owners <yes/no> | stale dismissed <yes/no> | threads must be resolved <yes/no> | source <...>`.
- **Source:** ship-plan/SKILL.md, "4R. Review", step 1; ship-plan/hosts/github.md, "Read the review rule".
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** Read the PR size right before the post.
- **Command or tool call:** `gh pr view 60 --json changedFiles,additions,deletions`
- **Source:** ship-plan/notifiers/slack.md, "Review request"; ship-plan/hosts/github.md, "PR size".
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** Request the AI review (runs before the Slack post, in 4R step 2).
- **Command or tool call:** `gh pr edit 60 --add-reviewer @copilot` (unless `Copilot review: no`; the config has no such line, so the default `yes` applies).
- **Source:** ship-plan/SKILL.md, "4R. Review", step 2; ship-plan/hosts/github.md, "Request an AI review"; ship-plan/config-format.md, "## Repo" (`Copilot review:` default yes).
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** Post the review request in #ops-reviews.
- **Command or tool call:** `mcp__plugin_engineering_slack__slack_send_message` with
  - `channel_id`: `C0OPS999`
  - `unfurl_app_links`: `true`
  - message text (the text parameter of the tool, filled with the template):

```
:github-pr: **Review request:** Send dunning emails (BILL-420) https://github.com/acme/billing-api/pull/60
Customers with a failed payment now get reminder emails (dunning) before their account is suspended. Issue: https://acme.atlassian.net/browse/BILL-420
Size: <files> files, +<added> −<removed>. Needs: <n approvals | code owner approval | no approval, review welcome>.
```

  `<files>`, `<added>`, `<removed>` come from the `gh pr view 60` output above; the "Needs:" value comes from the recorded `Review rule:` (for example "1 approval"). The one-line description of the user-facing change is worked out from the plan (the plan was not given, so it is a placeholder in substance). No `thread_ts` (this is the top-level post).
- **Source:** ship-plan/notifiers/slack.md, "Review request"; ship-plan/SKILL.md, "4R. Review", step 2 and "What invoking this skill authorizes" (channel in `## Slack` only); ship-plan/trackers/jira.md (issue key BILL-420, site https://acme.atlassian.net).
- **Told or worked out:** told for the tool, channel id, `unfurl_app_links` and template; worked out for the issue URL (`<Site>/browse/BILL-420`), the user-facing sentence, and the name of the text parameter. A standing answer in `interruptions.md` could change `unfurl_app_links`; none is given.
- **Files read for this step:** none new.

### Q5

- **Step:** Record the post in the ledger, so a resume never posts it twice.
- **Command or tool call:** append to `.superpowers/ship-plan/<branch>/ledger.md` the line `Slack: posted <ts>` (`<ts>` is the message timestamp `slack_send_message` returns). Also the `Review rule:` line from Q4 and the first-line `PR: #60`.
- **Source:** ship-plan/notifiers/slack.md, "Review request" ("record `Slack: posted <ts>` in the ledger and never post again for that PR"); ship-plan/SKILL.md, "The ledger" and "4R. Review", step 1.
- **Told or worked out:** told.
- **Files read for this step:** none new.
