# Slack notifier

Read when `## Slack` names a channel, or when it is missing and the channel must be chosen. Never with `Channel: none`. The format of `## Slack` is in [config-format.md](../config-format.md).

## Choose the channel

Read `## Slack` from the config, else from `.claude/ship-plan.local.md` (a git-ignored file on this machine). Either says where review requests go: a channel, or `none`. **Neither has it:** ask now, before the run goes on, in this step's own `AskUserQuestion` call (its answer comes back in the same turn, so no answer line is needed): "Post a review request to Slack when the PR is created?"
- Options: up to 2 channels found with `slack_search_channels` (`channel_types: "public_channel,private_channel"`, keywords from the repo name, its team, or "review"), as `#<name>`, the most relevant one recommended; "Don't post to Slack", recommended when no channel was found. "Other" takes a channel name: resolve it to an id with the same search. Not found: ask once more with the closest matches; still not found: don't post this run, and record nothing.
- **Record it once, in the committed config.** Once section 1 has created the feature branch, write `## Slack` with `Channel: #<name> (<id>)`, or `Channel: none`, to `.claude/ship-plan.md` only, as the feature branch's first commit (`chore: record Slack channel for review requests`). A drafted config gets it inside the draft instead, committed when the draft is confirmed. Nothing is written to `.claude/ship-plan.local.md` or `.git/info/exclude`.
- Keep the `Asked:` and `Ruling: user <date>` lines in the conversation until the ledger exists, then write them.
- Slack tools not connected: see Failures.

## People

The `People:` table in `## Slack` maps a host login to a Slack user id. It is repo-wide, because reviewers belong to the team. A login found in it is @-mentioned. A login missing from it is looked up with `slack_search_users`, by display name or email.
- Found: add it to the `People:` table, committed with the run's lessons.
- Not found: use the person's plain name, and record a `Lesson:`.

## Review request

`slack_send_message` with its `channel_id`, the text below as `message`, and `unfurl_app_links: true`, unless a standing answer in `interruptions.md` says otherwise (it outranks this default, as every standing answer does). Read it before the post: the message cannot be edited or deleted afterwards. Once per PR: record `Slack: posted <ts>` in the ledger and never post again for that PR, also not on a resume. Fix-forward, revert and lessons PRs are posted only when the review rule needs an approval. A failed post: see Failures.

Short; Slack unfurls the PR and issue links. Take `Size` from the host's *PR size* right before the post, never from memory: the message cannot be edited.

```markdown
:github-pr: **Review request:** <PR title> <pr url>
<1–2 sentences: what changes for a user.> <Issue: <issue url> | no issue>
Size: <files> files, +<added> −<removed>. Needs: <n approvals | code owner approval | no approval, review welcome>.
```

Write `code owner approval` only when the repo has a CODEOWNERS file (`CODEOWNERS`, `.github/CODEOWNERS` or `docs/CODEOWNERS`) whose rules match a changed file. Without one, a rule that requires code owners asks for no more than its approvals, and the host requests nobody: write `<n> approvals`, and say in the report that no reviewer was requested.

## Re-review request

When a review round has addressed comments from people, and a review request was posted for this PR (the ledger's `Slack: posted <ts>`): after `verify-and-fix --comments` has pushed its fixes and replied, once per round. No `Slack: posted <ts>` line means nothing was posted: post nothing here either.

- **What:** one reply in the review request's thread, `slack_send_message` with `thread_ts: <ts>` and the text below as `message`, naming each person whose comments were addressed this round and asking them to look again.
- **Who:** only people. Bots (Copilot, CI) and the PR's author are left out. A person whose only items were answered "not valid" or "follow-up" is still named: their comment got a reply they should read.
- **Mentions:** a person is @-mentioned when their Slack user is known (see People); otherwise their plain name.
- **Azure DevOps** has no "re-request a reviewer" action: this thread reply is the re-request.
- **Ledger:** record `Slack: re-review round <r> <ts> <names>` (`<r>` is the review round, `<ts>` the reply just posted), so a resume never posts it twice. Skip round `<r>` when its line is already there.

```markdown
<@mentions or names>: I've addressed your comments on the review request above. <What changed, in one line.> Please look again: <pr url>
```

## Mark merged

Right after the merge, add the `pr-merged` reaction to the review request post: `slack_add_reaction` with the channel and `<ts>` of `Slack: posted <ts>`, reaction name `pr-merged`. Once per PR: record `Slack: merged reaction` in the ledger, and skip it when the line is there, also on a resume. Fix-forward, revert, docs and lessons PRs get it too when they had a post. With no `Slack: posted <ts>` line, nothing was posted: add nothing.

## Failures

Slack failures are a `Lesson:`, never retried another way, and never a reason to stop.
- Slack tools not connected: don't post, record nothing, and write a `Lesson:` once the ledger exists.
- `pr-merged` is a workspace custom emoji. If the reaction is refused (unknown emoji), the run goes on, records a `Lesson:` for `blockers.md`, and never tries another emoji on its own.
