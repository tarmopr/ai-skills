**Files read:**
1. ship-plan/SKILL.md
2. ship-plan/config-format.md
3. ship-plan/hosts/github.md
4. ship-plan/trackers/jira.md

(I also listed the skills directories once to see which files exist. I did not open notifiers/slack.md, because `## Slack` names `Channel: none`.)

### Q1

- **Step:** Files read over this part of the run, in order.
- **Command or tool call:** none, this is a list of files. Order: ship-plan/SKILL.md, ship-plan/config-format.md, ship-plan/hosts/github.md, ship-plan/trackers/jira.md. notifiers/slack.md is not read.
- **Source:** ship-plan/SKILL.md, "Before anything else, read the repo's `.claude/ship-plan.md` ([format](config-format.md))" and "Host and tracker" (read `hosts/<host>.md` and `trackers/<tracker>.md`). ship-plan/SKILL.md, "0. Pre-flight", step 6: "When `## Slack` (config, else `.claude/ship-plan.local.md`) names a channel, read [notifiers/slack.md]". A channel of `none` does not name a channel, and the section is not missing, so the file is not read.
- **Told or worked out:** told for the first four files. For slack.md, worked out that `none` does not trigger the read.
- **Files read for this step:** ship-plan/SKILL.md, ship-plan/config-format.md, ship-plan/hosts/github.md, ship-plan/trackers/jira.md.

### Q2

- **Step:** Pre-flight step 6, the Slack channel.
- **Command or tool call:** none. `.claude/ship-plan.md` has `## Slack` with `Channel: none`, so nothing is missing to choose and no channel is named. I do not read notifiers/slack.md and do not ask anything. Nothing asked. (`.claude/ship-plan.local.md` does not exist, but it is only read when the config's `## Slack` is missing.)
- **Source:** ship-plan/SKILL.md, "0. Pre-flight", step 6 ("Either says where review requests go: a channel, or `none`. When `## Slack` is missing ... read notifiers/slack.md and choose the channel"). ship-plan/config-format.md, "### `## Slack`" (`Channel:` is "`none` for no post").
- **Told or worked out:** told.
- **Files read for this step:** none new.

### Q3

- **Step:** Review request in Slack right after the PR #59 opens (4R, step 2).
- **Command or tool call:** none. The Slack channel is `none`, so the notifier's *Review request* is skipped. The only 4R step-2 action is the host's *Request an AI review*: `gh pr edit 59 --add-reviewer @copilot`. This is not a Slack call. `Copilot review:` is not set in the config, so it defaults to yes.
- **Source:** ship-plan/SKILL.md, "4R. Review", step 2 ("Skipped when the channel is `none`"). ship-plan/hosts/github.md, "Request an AI review".
- **Told or worked out:** told.
- **Files read for this step:** none new.

### Q4

- **Step:** Slack during review (4R, step 3, "Re-review request").
- **Command or tool call:** none. The review has no comments (`alice-gh` approves with none), so there is no new feedback, no `verify-and-fix --comments` round and no re-review request. Even with feedback, the re-review request is skipped when the channel is `none`. No Slack call.
- **Source:** ship-plan/SKILL.md, "4R. Review", step 3 ("the notifier's *Re-review request* (skipped when the channel is `none`)").
- **Told or worked out:** told.
- **Files read for this step:** none new.

### Q5

- **Step:** Slack right after the merge (5, step 6, "Mark merged").
- **Command or tool call:** none. The notifier's *Mark merged* (the `pr-merged` reaction on the review-request post) is skipped when the channel is `none`. There is also no post to react to. The merge itself is `gh pr merge 59 --squash --delete-branch`, and the SHA is read with `gh pr view 59 --json mergeCommit --jq .mergeCommit.oid`, which gives `3c2b1a0`. Neither is a Slack call. No Slack call.
- **Source:** ship-plan/SKILL.md, "5. Merge", step 6 ("Skipped when the channel is `none`"). ship-plan/hosts/github.md, "Merge the PR".
- **Told or worked out:** told.
- **Files read for this step:** none new.
