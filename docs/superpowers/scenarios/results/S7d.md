**Files read:**
1. ship-plan/SKILL.md
2. ship-plan/notifiers/slack.md
3. ship-plan/config-format.md
4. ship-plan/hosts/github.md
5. ship-plan/trackers/jira.md

### Q1

- **Step:** Read the skill, then the notifier, then the config format, the host file and the tracker file.
- **Command or tool call:** none, reading files only.
- **Source:** ship-plan/SKILL.md, "Ship a plan" (host and tracker resolution) and "0. Pre-flight" step 6.
- **Told or worked out:** told
- **Files read for this step:** ship-plan/SKILL.md, ship-plan/notifiers/slack.md, ship-plan/config-format.md, ship-plan/hosts/github.md, ship-plan/trackers/jira.md

### Q2

- **Step:** Resolve the host from the origin remote.
- **Command or tool call:** `git remote get-url origin` (prints `git@github.com:acme/billing-api.git`, so the host is `github`)
- **Source:** ship-plan/SKILL.md, "Ship a plan" (Host and tracker); ship-plan/config-format.md, "`## Repo`" (`Host:` default).
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Find where review requests go. The config has no `## Slack`, so read `## Slack` from `.claude/ship-plan.local.md`. It names `Channel: #ops-reviews (C0OPS999)`, so the channel is `#ops-reviews`, channel id `C0OPS999`. The config does not have the section, so the local file is the fallback, and `## Slack` is "decided". Then read notifiers/slack.md, because the section names a channel.
- **Command or tool call:** none, reading `.claude/ship-plan.md` and `.claude/ship-plan.local.md`.
- **Source:** ship-plan/SKILL.md, "0. Pre-flight" step 6; ship-plan/config-format.md, "`## Slack`" ("`.claude/ship-plan.local.md` ... is read when this section is missing"); ship-plan/notifiers/slack.md, "Choose the channel".
- **Told or worked out:** told
- **Files read for this step:** none new (ship-plan/notifiers/slack.md was already read)

- **Step:** Ask about Slack?
- **Command or tool call:** none. The "Choose the channel" question is asked only when neither the config nor the local file has `## Slack`. The local file has it.
- **Source:** ship-plan/notifiers/slack.md, "Choose the channel" ("Neither has it: ask now").
- **Told or worked out:** told
- **Files read for this step:** none new

Question asked about Slack: nothing asked.

### Q3

- **Step:** Write to `.claude/ship-plan.local.md`?
- **Command or tool call:** none. The local file is "read, never written".
- **Source:** ship-plan/SKILL.md, "0. Pre-flight" step 6; ship-plan/notifiers/slack.md, "Choose the channel" ("Nothing is written to `.claude/ship-plan.local.md`").
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Write `## Slack` to `.claude/ship-plan.md`?
- **Command or tool call:** none. The `## Slack` write (with the commit `chore: record Slack channel for review requests`) happens only when the channel was chosen in this run. Here the channel was read from the local file, so nothing is chosen and nothing is committed.
- **Source:** ship-plan/notifiers/slack.md, "Choose the channel" (the "Record it once" bullet); ship-plan/config-format.md, "`## Slack`".
- **Told or worked out:** told
- **Files read for this step:** none new

Files written: nothing written. No lines go into `.claude/ship-plan.local.md` or `.claude/ship-plan.md`, and there is no commit.

### Q4

- **Step:** Take the PR size right before the post.
- **Command or tool call:** `gh pr view 60 --json changedFiles,additions,deletions`
- **Source:** ship-plan/hosts/github.md, "PR size"; ship-plan/notifiers/slack.md, "Review request" ("Take `Size` from the host's *PR size* right before the post").
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Post the review request. The call comes after the PR is opened (section 4, step 4; section 4R, step 2). `Slack: posted <ts>` is not yet in the ledger, so this is the first post for the PR.
- **Command or tool call:** `mcp__plugin_engineering_slack__slack_send_message` with:
  - `channel_id`: `C0OPS999`
  - `unfurl_app_links`: `true`
  - `text`:
    ```
    :github-pr: **Review request:** Send dunning emails (BILL-420) https://github.com/acme/billing-api/pull/60
    <1-2 sentences: what changes for a user, from the plan.> Issue: https://acme.atlassian.net/browse/BILL-420
    Size: <changedFiles> files, +<additions> −<deletions>. Needs: <n> approvals.
    ```
    (`<n>` from the `Review rule:` line. `<changedFiles>`, `<additions>`, `<deletions>` come from the `gh pr view 60` output above. No `thread_ts`, because this is a new post.)
- **Source:** ship-plan/notifiers/slack.md, "Review request"; ship-plan/hosts/github.md, "PR size"; ship-plan/trackers/jira.md, "Issue keys" (the key BILL-420 and `Site:` `https://acme.atlassian.net` give the issue URL; the `/browse/` path is worked out).
- **Told or worked out:** told for the tool, the parameters and the template; worked out for the issue URL (`https://acme.atlassian.net/browse/BILL-420`) and the user-facing sentence.
- **Files read for this step:** none new

### Q5

- **Step:** Record the post in the ledger, `.superpowers/ship-plan/<branch>/ledger.md`.
- **Command or tool call:** none, a ledger line: `Slack: posted <ts>` (`<ts>` is the timestamp `slack_send_message` returns). It is never posted again for this PR, also not on a resume.
- **Source:** ship-plan/notifiers/slack.md, "Review request" ("record `Slack: posted <ts>` in the ledger"); ship-plan/SKILL.md, "The ledger".
- **Told or worked out:** told
- **Files read for this step:** none new
