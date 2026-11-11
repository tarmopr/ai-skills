**Files read:**
1. `ship-plan/SKILL.md`
2. `ship-plan/config-format.md`
3. `ship-plan/phase-implement.md`
4. `ship-plan/hosts/github.md`
5. `ship-plan/trackers/jira.md`
6. `ship-plan/phase-verify.md`
7. `ship-plan/phase-merge.md`
8. `ship-plan/templates-issue.md`
9. `ship-plan/templates.md`
10. `verify-and-fix/SKILL.md`

Not read: `ship-plan/notifiers/slack.md`. Pre-flight step 6 reads it only when `## Slack` names a channel, or when `## Slack` is missing from both the config and `.claude/ship-plan.local.md`. Here the config says `Channel: none`, so neither case applies.

### Q1

- **Step:** list the files read from pre-flight to the merge.
- **Command or tool call:** none. Only files were read: the 10 above, in that order.
- **Source:** `ship-plan/SKILL.md` "Host and tracker" (read `hosts/github.md` and `trackers/jira.md`) and "The sections live in phase files"; `ship-plan/phase-implement.md` section 1 (read `templates-issue.md`, since the run has an issue); `ship-plan/phase-verify.md` section 4, step 1 (`verify-and-fix`); `ship-plan/phase-implement.md` section 0, step 6 (`notifiers/slack.md` is read only when a channel is named).
- **Told or worked out:** told
- **Files read for this step:** all 10 above.

### Q2

- **Step:** pre-flight step 6: read the Slack channel from the config.
- **Command or tool call:** none. `## Slack` is part of `.claude/ship-plan.md`, which the run already read in full at its start. It says `Channel: none`, so review requests go nowhere. `.claude/ship-plan.local.md` is not read, because the committed section wins and that file does not exist. The run does not read `notifiers/slack.md` and does not do the notifier's *Choose the channel*.
- **Source:** `ship-plan/phase-implement.md` "## 0. Pre-flight", step 6; `ship-plan/config-format.md` "### `## Slack`" (`Channel:` … `none` for no post); `ship-plan/SKILL.md` "Red flags" ("`none` means no post").
- **Told or worked out:** told
- **Files read for this step:** none new.

Asked: nothing asked. Written: nothing written. The config already has `## Slack`.

### Q3

- **Step:** section 4R, step 2: the review request, right after PR #59 opens.
- **Command or tool call:** none. Nothing is posted: the notifier's *Review request* is "Skipped when the channel is `none`". No `slack_send_message`, no `slack_search_channels`.
- **Source:** `ship-plan/phase-merge.md` "## 4R. Review", step 2; `ship-plan/phase-verify.md` "## 4. Verify, push, PR", step 4.
- **Told or worked out:** told
- **Files read for this step:** none new.

### Q4

- **Step:** section 4R, step 3: poll the review state. `alice-gh` approves with no comments.
- **Command or tool call:** none (Slack). There is no new feedback, so the run makes no `verify-and-fix --comments` call and sends no *Re-review request*. That request is also "skipped when the channel is `none`". The review rules are met, so the run goes on to section 5.
- **Source:** `ship-plan/phase-merge.md` "## 4R. Review", step 3; `ship-plan/hosts/github.md` "## Fetch review items" (an approval with an empty body is not new).
- **Told or worked out:** told
- **Files read for this step:** none new.

### Q5

- **Step:** section 5, step 7: mark the post as merged, right after the merge as `3c2b1a0`.
- **Command or tool call:** none. The notifier's *Mark merged* (adding the `Merged reaction:`) is "Skipped when the channel is `none`". No `slack_add_reaction`. There was no post to react to anyway.
- **Source:** `ship-plan/phase-merge.md` "## 5. Merge", step 7; `ship-plan/SKILL.md` "What invoking this skill authorizes" (Slack only in the `## Slack` channel).
- **Told or worked out:** told
- **Files read for this step:** none new.
