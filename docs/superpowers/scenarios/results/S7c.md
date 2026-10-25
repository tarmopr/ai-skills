**Files read:**
1. `ship-plan/SKILL.md`
2. `ship-plan/config-format.md`

(`ship-plan/notifiers/slack.md` is not read: `## Slack` names `none`, not a channel. Other files such as `hosts/github.md` and `trackers/jira.md` are read for the PR, the merge and Jira steps of the run, but they have nothing to do with Slack, so none was opened for these questions.)

### Q1
- **Step:** list the files read, in order.
- **Command or tool call:** none, this is the list above.
- **Source:** `ship-plan/SKILL.md`, heading "0. Pre-flight", step 6 (Slack channel); `ship-plan/config-format.md`, heading "`## Slack`".
- **Told or worked out:** told.
- **Files read for this step:** `ship-plan/SKILL.md`, `ship-plan/config-format.md`.

### Q2
- **Step:** pre-flight step 6, read `## Slack` from the config.
- **Command or tool call:** none. No tool call is needed. The config says `Channel: none`, and `.claude/ship-plan.local.md` does not exist and is not needed. `## Slack` is present, so it is not "missing" and the channel is not chosen or asked about. The channel is not a named channel, so `notifiers/slack.md` is not read.
- **Source:** `ship-plan/SKILL.md`, "0. Pre-flight" step 6 ("Either says where review requests go: a channel, or `none`. When `## Slack` is missing ... read notifiers/slack.md and choose the channel ... When `## Slack` ... names a channel, read notifiers/slack.md"); `ship-plan/config-format.md`, "`## Slack`" (`Channel:` is "`#<name> (<channel id>)`, or `none` for no post").
- **Told or worked out:** told.
- **Files read for this step:** none new (`ship-plan/SKILL.md`, `ship-plan/config-format.md` already read).
- **Question asked:** nothing asked.
- **File written:** nothing written.

### Q3
- **Step:** the review request after the PR opens (section 4, step 4; section 4R, step 2).
- **Command or tool call:** none. Nothing is posted to Slack, because the channel is `none` and the review-request hook is "Skipped when the channel is `none`".
- **Source:** `ship-plan/SKILL.md`, "4R. Review" step 2 ("Review request: the notifier's Review request ... when `## Slack` ... names a channel. Skipped when the channel is `none`"); "What invoking this skill authorizes" (Slack posts only in the channel recorded in `## Slack`); "Red flags" ("`none` means no post").
- **Told or worked out:** told.
- **Files read for this step:** none new.

### Q4
- **Step:** the review poll and fix rounds (section 4R, step 3); the alice-gh approval with no comments needs no `verify-and-fix --comments` round, so no re-review request either.
- **Command or tool call:** none. No Slack call. The re-review request applies only after a round that addressed comments from people, and it is also "skipped when the channel is `none`". Here there are no comments, so there is no round.
- **Source:** `ship-plan/SKILL.md`, "4R. Review" step 3 ("when it addressed comments from people, the notifier's Re-review request (skipped when the channel is `none`)").
- **Told or worked out:** told.
- **Files read for this step:** none new.

### Q5
- **Step:** section 5, step 7, Slack: Mark merged, right after the merge.
- **Command or tool call:** none. No `slack_add_reaction` call. The `pr-merged` reaction goes on the review-request post. There is no post (Q3), and the step is "Skipped when the channel is `none`".
- **Source:** `ship-plan/SKILL.md`, "5. Merge" step 7 ("Slack: the notifier's Mark merged, right after the merge. Skipped when the channel is `none`").
- **Told or worked out:** told.
- **Files read for this step:** none new.
