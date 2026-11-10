**Files read:**
1. `verify-and-fix/SKILL.md`
2. `ship-plan/config-format.md`
3. `ship-plan/SKILL.md` (section "Reading the logs")
4. `ship-plan/hosts/github.md`
5. `verify-and-fix/review-comments.md`
6. `ship-plan/trackers/jira.md`
7. `ship-plan/templates-issue.md` (section "Issue comment: review round")

### Q1

- **Step:** Load the skill.
- **Command or tool call:** Read `verify-and-fix/SKILL.md`
- **Source:** `verify-and-fix/SKILL.md` (the invocation)
- **Told or worked out:** told
- **Files read for this step:** `verify-and-fix/SKILL.md`

- **Step:** Before round 1: config format, then the logs' reading rule (defines `<logs>`; no `## Logs`, so `<logs>` = `.claude/`, blockers.md read by index).
- **Command or tool call:** Read `ship-plan/config-format.md`; Read `ship-plan/SKILL.md` at "Reading the logs"
- **Source:** `verify-and-fix/SKILL.md` intro ("Before round 1, read the repo's `.claude/ship-plan.md` ([format]…) … ([Reading the logs]…)"); `verify-and-fix/SKILL.md` "1. Setup" (Config)
- **Told or worked out:** told
- **Files read for this step:** `ship-plan/config-format.md`, `ship-plan/SKILL.md`

- **Step:** Setup: resolve host (no `Host:`, origin `github.com` → `github`) and tracker (`## Jira` present → `jira`); read the host file.
- **Command or tool call:** Read `ship-plan/hosts/github.md`
- **Source:** `verify-and-fix/SKILL.md` "1. Setup" (Host and tracker); `ship-plan/config-format.md` "## Repo" (`Host:`, `Tracker:` defaults)
- **Told or worked out:** told
- **Files read for this step:** `ship-plan/hosts/github.md`

- **Step:** Branch has an open PR, so read review-comments.md (section 4b) before round 1's comment fetch.
- **Command or tool call:** Read `verify-and-fix/review-comments.md`
- **Source:** `verify-and-fix/SKILL.md` "4b. PR review comments"
- **Told or worked out:** told
- **Files read for this step:** `verify-and-fix/review-comments.md`

- **Step:** Not read: `ui-testing.md` (no `## UI testing`), `config-drafting.md` (config exists), `runner-child.md`/`modes.md`/`runner-session.md` (no `SHIP_RUNNER` assumed, no `## Runner`, no `--runner`), `lessons.md` (only at section 8, after the rounds). At the end of round 1's comment handling (after the replies), for the issue comment: `ship-plan/trackers/jira.md`, then `ship-plan/templates-issue.md` (see Q5).
- **Command or tool call:** none, files not needed up to round 1's review
- **Source:** `verify-and-fix/SKILL.md` "3. UI scenarios", "Runner mode (ship-runner)", "Runner or session", "8. Self-improvement"; `verify-and-fix/review-comments.md` "Issue comment"
- **Told or worked out:** worked out
- **Files read for this step:** none new

### Q2

- **Step:** Find the branch's own PR.
- **Command or tool call:** `gh pr view --json number,url,reviewDecision`
- **Source:** `verify-and-fix/SKILL.md` "4b. PR review comments"; `ship-plan/hosts/github.md` "Find open PRs" (The branch's own PR)
- **Told or worked out:** told
- **Files read for this step:** none new

### Q3

- **Step:** Repo identity: owner/name (once).
- **Command or tool call:** `gh repo view --json nameWithOwner --jq .nameWithOwner` (→ `acme/billing-api`)
- **Source:** `verify-and-fix/review-comments.md` intro ("Repo identity and your login come from the host's *Repo identity* and *Auth check*"); `ship-plan/hosts/github.md` "Repo identity"
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Repo identity: host (once).
- **Command or tool call:** `gh repo view --json url --jq .url` (→ host `github.com`)
- **Source:** `ship-plan/hosts/github.md` "Repo identity"
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Auth check.
- **Command or tool call:** `gh auth status` (not in the skill's `allowed-tools`: prompts)
- **Source:** `ship-plan/hosts/github.md` "Auth check"
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Your login (once), to tell whether a thread's last comment is yours.
- **Command or tool call:** `gh api user --jq .login --hostname github.com`
- **Source:** `ship-plan/hosts/github.md` "Auth check", "Fetch review items" (New when)
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Fetch inline threads.
- **Command or tool call:** `gh api graphql -f query='query ReviewThreads($owner:String!,$name:String!,$n:Int!){repository(owner:$owner,name:$name){pullRequest(number:$n){reviewThreads(first:100){nodes{id isResolved isOutdated path line comments(first:50){nodes{id author{login} body createdAt}}}}}}}' -F owner=acme -F name=billing-api -F n=61 --hostname github.com`
- **Source:** `verify-and-fix/review-comments.md` "Fetch"; `ship-plan/hosts/github.md` "Fetch review items"
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Fetch review bodies and conversation comments.
- **Command or tool call:** `gh pr view 61 --json reviews,comments`
- **Source:** `ship-plan/hosts/github.md` "Fetch review items"
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Record the new item in the ledger (Copilot thread, unresolved, last comment not mine, no ledger line).
- **Command or tool call:** Edit `.superpowers/verify-and-fix/fix-BILL-430-rounding/ledger.md`, line `Review: thread <thread id> @ <last comment id> Copilot <grade> — <one line> — <action>`
- **Source:** `verify-and-fix/review-comments.md` "What counts as new"; `ship-plan/hosts/github.md` "Fetch review items" (key table)
- **Told or worked out:** told
- **Files read for this step:** none new

### Q4

- **Step:** Write the reply body to a file in the ledger dir.
- **Command or tool call:** Write `.superpowers/verify-and-fix/fix-BILL-430-rounding/reply-<thread id>.md` with `Fixed in <short sha>: <what changed, one line>. Test: <test name>.`
- **Source:** `verify-and-fix/review-comments.md` "Reply", "Review reply" (Fixed); `ship-plan/hosts/github.md` "Reply to a review item"
- **Told or worked out:** told (file name worked out)
- **Files read for this step:** none new

- **Step:** Reply in the thread.
- **Command or tool call:** `gh api graphql -f query='mutation ReplyToThread($id:ID!,$body:String!){addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$id,body:$body}){comment{id}}}' -f id=<thread id> -F body=@.superpowers/verify-and-fix/fix-BILL-430-rounding/reply-<thread id>.md --hostname github.com`
- **Source:** `ship-plan/hosts/github.md` "Reply to a review item"
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Resolve the thread (Copilot is a bot, thread now has a reply).
- **Command or tool call:** `gh api graphql -f query='mutation ResolveThread($id:ID!){resolveReviewThread(input:{threadId:$id}){thread{isResolved}}}' -f id=<thread id> --hostname github.com`
- **Source:** `verify-and-fix/review-comments.md` "Reply" (Resolve); `ship-plan/hosts/github.md` "Resolve a bot's thread"
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Record the reply in the ledger.
- **Command or tool call:** Edit `.superpowers/verify-and-fix/fix-BILL-430-rounding/ledger.md`, line `Replied: thread <thread id> @ <last comment id> — fixed in <sha>`
- **Source:** `verify-and-fix/review-comments.md` "Reply"
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Re-request a reviewer.
- **Command or tool call:** none: Copilot is a bot; never re-request a bot
- **Source:** `verify-and-fix/review-comments.md` "Reply" (Re-request); `ship-plan/hosts/github.md` "Re-request a reviewer"
- **Told or worked out:** told
- **Files read for this step:** none new

### Q5

- **Step:** Decide: yes. Branch `fix/BILL-430-rounding` carries key `BILL-430`, tracker is `jira` (`## Jira` present), run on its own (not under ship-plan).
- **Command or tool call:** Read `ship-plan/trackers/jira.md`; Read `ship-plan/templates-issue.md`
- **Source:** `verify-and-fix/review-comments.md` "Issue comment"; `ship-plan/trackers/jira.md` "Issue keys"
- **Told or worked out:** told
- **Files read for this step:** `ship-plan/trackers/jira.md`, `ship-plan/templates-issue.md`

- **Step:** Post `Issue comment: review round` after the replies.
- **Command or tool call:** `mcp__plugin_atlassian_atlassian__addOrEditJiraIssueComment` with cloudId `https://acme.atlassian.net`, issue key `BILL-430`, comment body in markdown (parameter names as the tool's schema gives them, read before the call):
  ```
  **Review round 1** on [#61](<pr url>): 1 comments from Copilot.

  | Comment | Grade | Result |
  |---|---|---|
  | Copilot: <one line> | <grade> | Fixed in `<short sha>` |

  Checks: <green / running>. Approval: <approved / waiting for <who or "code owners">>.
  ```
- **Source:** `verify-and-fix/review-comments.md` "Issue comment"; `ship-plan/trackers/jira.md` intro (`Site:` as `cloudId`, schema first), "Comment"; `ship-plan/templates-issue.md` "Issue comment: review round"
- **Told or worked out:** told
- **Files read for this step:** none new
