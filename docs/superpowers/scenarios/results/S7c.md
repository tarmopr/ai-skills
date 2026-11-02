**Files read:**
1. ship-plan/SKILL.md (lines 1-494 of 614; the rest is sections 6b to 8, after the merge, so not needed)
2. ship-plan/config-format.md
3. ship-plan/notifiers/slack.md (read only to check; the run never opens it, see Q2)
4. ship-plan/hosts/github.md
5. ship-plan/trackers/jira.md
6. ship-plan/templates.md
7. ship-plan/templates-issue.md
8. verify-and-fix/SKILL.md (lines 1-120)

Repo files named in the skill (`.claude/ship-plan/interruptions.md`, `.claude/ship-plan/blockers.md`, `.claude/ship-plan/ship-plan/*` overrides) are outside SKILLDIR and not given by the scenario. I treat them as having no standing answer and no override.

### Q1
- **Step:** the files read over the run, to the merge, in the order the run reads them
- **Command or tool call:** none, only reads. Run order: ship-plan/SKILL.md; ship-plan/config-format.md (linked at the top of SKILL.md); ship-plan/hosts/github.md (host resolved from the `git@github.com:` origin); ship-plan/trackers/jira.md (`## Jira` is present); ship-plan/templates-issue.md (section 1 with an issue; its sibling templates.md is the link target; I read templates.md first); ship-plan/templates.md; verify-and-fix/SKILL.md (section 4, "REQUIRED SUB-SKILL"). I did not read verify-and-fix/review-comments.md: the single approval has no body and no threads, so nothing is new feedback. ship-plan/notifiers/slack.md is not in the run's list (see Q2).
- **Source:** ship-plan/SKILL.md, headings "Before anything else" (the paragraph at the top of the file), "Host and tracker", "1. Tracker and branch", "4. Verify, push, PR"
- **Told or worked out:** told
- **Files read for this step:** all eight above

### Q2
- **Step:** pre-flight step 6. Read `## Slack` from the config: `Channel: none`. Nothing is asked and the notifier file is not opened.
- **Command or tool call:** none. `Channel: none` is a decision, so there is no `slack_search_channels` call and no `AskUserQuestion`. Asked: nothing asked. Written: nothing written. No `## Slack` commit is made, because the section is present.
- **Source:** ship-plan/SKILL.md, "0. Pre-flight", step 6 (a missing `## Slack` triggers "Choose the channel"; here it is present and says `none`). ship-plan/notifiers/slack.md, opening paragraph: "Read when `## Slack` names a channel... Never with `Channel: none`." ship-plan/config-format.md, "`## Slack`", `Channel:` row.
- **Told or worked out:** told
- **Files read for this step:** none new (ship-plan/SKILL.md and ship-plan/config-format.md already read)

### Q3
- **Step:** right after PR #59 opens, section 4 step 4 hands off to 4R step 2. The Slack review request is skipped.
- **Command or tool call:** none. Nothing is posted because the channel is `none`. No `Slack: posted <ts>` line goes in the ledger. Only the AI review request and the host steps run: `gh pr edit 59 --add-reviewer @copilot`. This assumes Copilot review is not disabled and not already requested; the config has no `Copilot review:` line, so the default is `yes`.
- **Source:** ship-plan/SKILL.md, "4R. Review", step 2 ("Skipped when the channel is `none`"). ship-plan/notifiers/slack.md, "Review request" (not opened in the run). ship-plan/hosts/github.md, "Request an AI review".
- **Told or worked out:** told
- **Files read for this step:** none new

### Q4
- **Step:** the review poll. `alice-gh` approves with no comments, so no `verify-and-fix --comments` round runs and no re-review request is due. No Slack call.
- **Command or tool call:** none for Slack. Polling is `gh pr view 59 --json reviewDecision,reviews,reviewRequests,mergeStateStatus,statusCheckRollup`.
- **Source:** ship-plan/SKILL.md, "4R. Review", step 3. The notifier's Re-review request is posted only after a round that addressed comments from people, and "skipped when the channel is `none`". ship-plan/notifiers/slack.md, "Re-review request": "No `Slack: posted <ts>` line means nothing was posted: post nothing here either." ship-plan/hosts/github.md, "Review state".
- **Told or worked out:** told
- **Files read for this step:** none new

### Q5
- **Step:** section 5 step 7, right after `gh pr merge 59 --squash --delete-branch` merges as `3c2b1a0`. The `pr-merged` reaction is skipped.
- **Command or tool call:** none. `slack_add_reaction` is not called. With channel `none` there is no `Slack: posted <ts>` line and no post to react to, so nothing is recorded.
- **Source:** ship-plan/SKILL.md, "5. Merge", step 7 ("Skipped when the channel is `none`"). ship-plan/notifiers/slack.md, "Mark merged": "With no `Slack: posted <ts>` line, nothing was posted: add nothing."
- **Told or worked out:** told
- **Files read for this step:** none new
