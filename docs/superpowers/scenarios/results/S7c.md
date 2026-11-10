**Files read:**
1. `ship-plan/SKILL.md`
2. `ship-plan/config-format.md`
3. `ship-plan/notifiers/slack.md` (read only to check; its first line says "Never with `Channel: none`", and pre-flight step 6 reads it only when `## Slack` is missing or names a channel, so a real run with this config would not open it)
4. `ship-plan/phase-implement.md`
5. `ship-plan/phase-verify.md`
6. `ship-plan/phase-merge.md`
7. `ship-plan/hosts/github.md`
8. `ship-plan/trackers/jira.md`
9. `ship-plan/templates-issue.md`
10. `ship-plan/templates.md`
11. `verify-and-fix/SKILL.md`
12. `verify-and-fix/review-comments.md`

### Q1

- **Step:** Read the files the run needs, from pre-flight to the merge.
- **Command or tool call:** none (Read only). Order as listed above: SKILL.md → config-format.md → (notifiers/slack.md, check only) → phase-implement.md (sections 0–2b) → phase-verify.md (sections 3–4) → phase-merge.md (4R, 5) → hosts/github.md (`Host:` resolved to `github` from `git@github.com:acme/billing-api.git`) → trackers/jira.md (`Tracker:` resolved to `jira` from `## Jira`) → templates-issue.md (section 1, run has an issue, BILL-415) → templates.md (PR body) → verify-and-fix/SKILL.md (section 4) → verify-and-fix/review-comments.md (4R's definition of new feedback).
- **Source:** `ship-plan/SKILL.md` "Host and tracker" bullet and the phase index ("read it when this phase starts"); `ship-plan/phase-implement.md` "1. Tracker and branch" (templates); `ship-plan/phase-verify.md` "4. Verify, push, PR" step 1; `ship-plan/phase-merge.md` "4R. Review" step 3.
- **Told or worked out:** told.
- **Files read for this step:** all of the above, in that order.

### Q2

- **Step:** Pre-flight step 6, Slack channel: read `## Slack` from the config. It says `Channel: none`, so review requests go nowhere. The config has the section, so `.claude/ship-plan.local.md` is not consulted (it doesn't exist either way). Neither read condition holds (section missing, or names a channel), so `notifiers/slack.md` is not read and *Choose the channel* does not run.
- **Command or tool call:** none. The config is already read, no Slack tool is called (no `slack_search_channels`), and nothing is written to the config.
- **Source:** `ship-plan/phase-implement.md` "0. Pre-flight" step 6; `ship-plan/config-format.md` "`## Slack`" (`Channel:` … "`none` for no post"); `ship-plan/notifiers/slack.md` first line ("Never with `Channel: none`"); `ship-plan/SKILL.md` "Red flags" ("`none` means no post").
- **Told or worked out:** told.
- **Files read for this step:** none new.
- **Asked:** nothing asked.
- **Written:** nothing written.

### Q3

- **Step:** 4R step 2, Slack review request right after PR #59 opens: skipped. The channel is `none`, so nothing is posted, and the ledger gets no `Slack: posted <ts>` line. The AI review request (`gh pr edit 59 --add-reviewer @copilot`) goes ahead as usual, but it is not a Slack call.
- **Command or tool call:** none (no `slack_send_message`). "Skipped when the channel is `none`."
- **Source:** `ship-plan/phase-merge.md` "4R. Review" step 2 (**Review request:** … "Skipped when the channel is `none`"); `ship-plan/phase-verify.md` "4. Verify, push, PR" step 4; `ship-plan/notifiers/slack.md` first line.
- **Told or worked out:** told.
- **Files read for this step:** none new.

### Q4

- **Step:** 4R step 3, poll the review state: `alice-gh` approves with an empty review body and no threads or comments, so there is no new feedback (an empty review body is not new). `verify-and-fix --comments` does not run, and so there is no *Re-review request*. It would be skipped anyway with channel `none`, and there is no `Slack: posted` line. The review rules are met, so the run goes to section 5.
- **Command or tool call:** none for Slack (no `slack_send_message` thread reply). The poll itself is `gh pr view 59 --json reviewDecision,reviews,reviewRequests,mergeStateStatus,statusCheckRollup`.
- **Source:** `ship-plan/phase-merge.md` "4R. Review" step 3 (Re-review request "skipped when the channel is `none`"); `ship-plan/hosts/github.md` "Review state", "Fetch review items" (review body new only when "Its body is not empty"); `ship-plan/notifiers/slack.md` "Re-review request" ("No `Slack: posted <ts>` line means nothing was posted: post nothing here either").
- **Told or worked out:** told.
- **Files read for this step:** none new.

### Q5

- **Step:** Section 5 step 7, Slack *Mark merged* right after `gh pr merge 59 --squash --delete-branch` (merge SHA `3c2b1a0`): skipped. The channel is `none` and there is no `Slack: posted <ts>` line, so no reaction is added and no `Slack: merged reaction` line is written.
- **Command or tool call:** none (no `slack_add_reaction`). "Skipped when the channel is `none`."
- **Source:** `ship-plan/phase-merge.md` "5. Merge" step 7; `ship-plan/notifiers/slack.md` "Mark merged" ("With no `Slack: posted <ts>` line, nothing was posted: add nothing").
- **Told or worked out:** told.
- **Files read for this step:** none new.
