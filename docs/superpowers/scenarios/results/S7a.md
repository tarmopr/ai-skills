**Files read:**
1. `verify-and-fix/SKILL.md`
2. `ship-plan/config-format.md`
3. `ship-plan/SKILL.md`
4. `ship-plan/hosts/github.md`
5. `verify-and-fix/review-comments.md`
6. `ship-plan/trackers/jira.md`
7. `ship-plan/templates-issue.md`

### Q1

- **Step:** load the skill.
- **Command or tool call:** Read `verify-and-fix/SKILL.md`.
- **Source:** invocation `/verify-and-fix`.
- **Told or worked out:** told.
- **Files read for this step:** `verify-and-fix/SKILL.md`.

- **Step:** before round 1, read the config format, to read `.claude/ship-plan.md` in full by its reading rules (Host absent: `github` from the `origin` remote; Tracker absent: `jira` from `## Jira`; `## Models` absent: defaults).
- **Command or tool call:** Read `ship-plan/config-format.md`.
- **Source:** `verify-and-fix/SKILL.md` intro ("Before round 1, read the repo's `.claude/ship-plan.md` ([format]…)"), `## 1. Setup` "Host and tracker" and "Config".
- **Told or worked out:** told.
- **Files read for this step:** `ship-plan/config-format.md`.

- **Step:** how to read `<logs>/ship-plan/blockers.md` by index (`<logs>` = `.claude/`, no `## Logs`).
- **Command or tool call:** Read `ship-plan/SKILL.md` (section "Reading the logs").
- **Source:** `verify-and-fix/SKILL.md` intro ("[Reading the logs](../ship-plan/SKILL.md#reading-the-logs)").
- **Told or worked out:** told.
- **Files read for this step:** `ship-plan/SKILL.md`.

- **Step:** host file for host operations (Find open PRs, Repo identity, Wait for the PR's checks, Fetch review items…).
- **Command or tool call:** Read `ship-plan/hosts/github.md`.
- **Source:** `verify-and-fix/SKILL.md` `## 1. Setup` "Host and tracker" ("Read `../ship-plan/hosts/<host>.md`").
- **Told or worked out:** told.
- **Files read for this step:** `ship-plan/hosts/github.md`.

- **Step:** branch has an open PR (#61): read the PR review comments rules (also covers the authorized push for a red CI job).
- **Command or tool call:** Read `verify-and-fix/review-comments.md`.
- **Source:** `verify-and-fix/SKILL.md` `## 4b. PR review comments`; `## 2. Gates` "CI, read-only" ("authorized (review-comments.md)").
- **Told or worked out:** told.
- **Files read for this step:** `verify-and-fix/review-comments.md`.

- **Step:** round 1 review (agents at `## Models` defaults from config-format.md, security-review skill): no further file under `skills/`. Not read: `config-drafting.md` (config exists), `ui-testing.md` (no `## UI testing`), `runner-child.md`/`modes.md`/`runner-session.md` (no `SHIP_RUNNER`, no `## Runner`, no `--runner`), tracker file (read where referenced, after the replies), `lessons.md` (section 8, at the end).
- **Command or tool call:** none: nothing further to read before round 1.
- **Source:** `verify-and-fix/SKILL.md` `## 3. UI scenarios`, `## 4. Review round`, `## Runner mode (ship-runner)`, `## Runner or session`, `## 8. Self-improvement`.
- **Told or worked out:** worked out.
- **Files read for this step:** none new.

### Q2

- **Step:** find the branch's own open PR.
- **Command or tool call:** `gh pr view --json number,url,reviewDecision`
- **Source:** `verify-and-fix/SKILL.md` `## 4b. PR review comments` (host's *Find open PRs*, the branch's own PR); `ship-plan/hosts/github.md` `## Find open PRs`.
- **Told or worked out:** told.
- **Files read for this step:** none new.

### Q3

- **Step:** repo identity, `<o>/<r>` (once).
- **Command or tool call:** `gh repo view --json nameWithOwner --jq .nameWithOwner`
- **Source:** `verify-and-fix/review-comments.md` intro ("Repo identity and your login come from the host's *Repo identity* and *Auth check*"); `ship-plan/hosts/github.md` `## Repo identity`.
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** repo identity, `<host>` (once): host of the URL, `github.com`.
- **Command or tool call:** `gh repo view --json url --jq .url`
- **Source:** `ship-plan/hosts/github.md` `## Repo identity`.
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** your login (once), to tell which last comments are yours.
- **Command or tool call:** `gh api user --jq .login --hostname github.com`
- **Source:** `verify-and-fix/review-comments.md` intro; `ship-plan/hosts/github.md` `## Auth check`.
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** fetch inline threads.
- **Command or tool call:** `gh api graphql -f query='query ReviewThreads($owner:String!,$name:String!,$n:Int!){repository(owner:$owner,name:$name){pullRequest(number:$n){reviewThreads(first:100){nodes{id isResolved isOutdated path line comments(first:50){nodes{id author{login} body createdAt}}}}}}}' -F owner=acme -F name=billing-api -F n=61 --hostname github.com`
- **Source:** `verify-and-fix/review-comments.md` "Fetch."; `ship-plan/hosts/github.md` `## Fetch review items`.
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** fetch review bodies and conversation comments.
- **Command or tool call:** `gh pr view 61 --json reviews,comments`
- **Source:** `ship-plan/hosts/github.md` `## Fetch review items`.
- **Told or worked out:** told.
- **Files read for this step:** none new.

### Q4

- **Step:** write the reply body to a file in the ledger directory.
- **Command or tool call:** Write, `file_path: .superpowers/verify-and-fix/fix-BILL-430-rounding/reply-<thread id>.md`, `content: Fixed in <short sha>: <what changed, one line>. Test: <test name>.`
- **Source:** `verify-and-fix/review-comments.md` "Reply" and `## Review reply` (Fixed row); `ship-plan/hosts/github.md` `## Reply to a review item`.
- **Told or worked out:** told (file name worked out).
- **Files read for this step:** none new.

- **Step:** reply in the inline thread.
- **Command or tool call:** `gh api graphql -f query='mutation ReplyToThread($id:ID!,$body:String!){addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$id,body:$body}){comment{id}}}' -f id=<thread id> -F body=@.superpowers/verify-and-fix/fix-BILL-430-rounding/reply-<thread id>.md --hostname github.com`
- **Source:** `verify-and-fix/review-comments.md` "Reply"; `ship-plan/hosts/github.md` `## Reply to a review item`.
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** resolve the Copilot thread (bot thread, now has a reply).
- **Command or tool call:** `gh api graphql -f query='mutation ResolveThread($id:ID!){resolveReviewThread(input:{threadId:$id}){thread{isResolved}}}' -f id=<thread id> --hostname github.com`
- **Source:** `verify-and-fix/review-comments.md` "Resolve"; `ship-plan/hosts/github.md` `## Resolve a bot's thread`.
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** ledger line for the reply. Writes `.superpowers/verify-and-fix/fix-BILL-430-rounding/ledger.md` line: `Replied: thread <thread id> @ <last comment id> — fixed in <sha>`. No re-request (Copilot is a bot).
- **Command or tool call:** none: ledger edit, no command.
- **Source:** `verify-and-fix/review-comments.md` "Record each reply as…", "Re-request … Never re-request a bot."
- **Told or worked out:** told.
- **Files read for this step:** none new.

### Q5

- **Step:** yes: branch carries key `BILL-430`, tracker `jira`, run on its own (not under ship-plan): post "Issue comment: review round" after the replies, with the tracker's *Comment*. Read the tool's schema for parameter names before the first call.
- **Command or tool call:** `mcp__plugin_atlassian_atlassian__addOrEditJiraIssueComment` with `cloudId: "https://acme.atlassian.net"`, `issueIdOrKey: "BILL-430"`, `commentBody:` (markdown)
  ```
  **Review round 1** on [#61](<pr url>): 1 comments from Copilot.

  | Comment | Grade | Result |
  |---|---|---|
  | Copilot: <one line> | <grade> | Fixed in `<short sha>` |

  Checks: <green / running>. Approval: <approved / waiting for <who or "code owners">>.
  ```
- **Source:** `verify-and-fix/review-comments.md` "Issue comment."; `ship-plan/trackers/jira.md` intro (Site as `cloudId`, schema first), `## Issue keys`, `## Comment`; `ship-plan/templates-issue.md` `## Issue comment: review round`.
- **Told or worked out:** told (parameter names for key and body from the tool's schema; worked out).
- **Files read for this step:** `ship-plan/trackers/jira.md`, `ship-plan/templates-issue.md`.
