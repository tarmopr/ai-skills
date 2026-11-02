**Files read:**
1. verify-and-fix/SKILL.md
2. ship-plan/config-format.md
3. ship-plan/hosts/github.md
4. verify-and-fix/review-comments.md
5. ship-plan/trackers/jira.md
6. ship-plan/templates-issue.md

(Repo files `.claude/ship-plan.md` and `.claude/ship-plan/blockers.md` are read in a real run. Repo overrides at `.claude/ship-plan/verify-and-fix/<file>.md` are read too. I did not read them here: they are outside SKILLDIR, and the scenario gives the config.)

### Q1
- **Step:** Read the skill, then the shared files in the order it links them, up to the first review round.
- **Command or tool call:** none. These are file reads.
- **Source:**
  - verify-and-fix/SKILL.md, "Before round 1, read the repo's `.claude/ship-plan.md`" (links config-format.md).
  - verify-and-fix/SKILL.md, "1. Setup" > "Host and tracker" (links hosts/github.md).
  - verify-and-fix/SKILL.md, "4b. PR review comments" (links review-comments.md).
  - verify-and-fix/review-comments.md, "Issue comment" (links trackers/jira.md and templates-issue.md; the branch carries BILL-430 and the tracker is Jira).
- **Told or worked out:** told.
- **Files read for this step:** the six files above, in that order.

### Q2
- **Step:** Find the branch's own open PR.
- **Command or tool call:** `gh pr view --json number,url,reviewDecision`
- **Source:** ship-plan/hosts/github.md, "Find open PRs" (the branch's own PR). It is called from verify-and-fix/SKILL.md, "4b. PR review comments".
- **Told or worked out:** told.
- **Files read for this step:** none new.

### Q3
- **Step:** Get `<o>/<r>` (owner and repo).
  - **Command or tool call:** `gh repo view --json nameWithOwner --jq .nameWithOwner` (gives `acme/billing-api`, so owner `acme`, name `billing-api`).
  - **Source:** ship-plan/hosts/github.md, "Repo identity".
  - **Told or worked out:** told.
  - **Files read for this step:** none new.
- **Step:** Get `<host>`.
  - **Command or tool call:** `gh repo view --json url --jq .url` (gives `https://github.com/acme/billing-api`, so host `github.com`).
  - **Source:** ship-plan/hosts/github.md, "Repo identity".
  - **Told or worked out:** told.
  - **Files read for this step:** none new.
- **Step:** Get my login, to tell which threads are mine.
  - **Command or tool call:** `gh api user --jq .login --hostname github.com`
  - **Source:** ship-plan/hosts/github.md, "Auth check".
  - **Told or worked out:** told.
  - **Files read for this step:** none new.
- **Step:** Fetch the inline threads.
  - **Command or tool call:** `gh api graphql -f query='query ReviewThreads($owner:String!,$name:String!,$n:Int!){repository(owner:$owner,name:$name){pullRequest(number:$n){reviewThreads(first:100){nodes{id isResolved isOutdated path line comments(first:50){nodes{id author{login} body createdAt}}}}}}}' -F owner=acme -F name=billing-api -F n=61 --hostname github.com`
  - **Source:** ship-plan/hosts/github.md, "Fetch review items"; verify-and-fix/review-comments.md, "Fetch".
  - **Told or worked out:** told.
  - **Files read for this step:** none new.
- **Step:** Fetch the review bodies and conversation comments.
  - **Command or tool call:** `gh pr view 61 --json reviews,comments`
  - **Source:** ship-plan/hosts/github.md, "Fetch review items".
  - **Told or worked out:** told.
  - **Files read for this step:** none new.

### Q4
- **Step:** Write the reply body into the ledger directory. This is a file write, not a shell command. The file name is my choice.
  - **Command or tool call:** Write tool, `file_path`: `.superpowers/verify-and-fix/fix-BILL-430-rounding/reply-thread-1.md`, `content`: `Fixed in <short sha>: <what changed, one line>. Test: <test name>.`
  - **Source:** ship-plan/hosts/github.md, "Reply to a review item"; verify-and-fix/review-comments.md, "Review reply" (Fixed row).
  - **Told or worked out:** worked out for the file name. The content is told.
  - **Files read for this step:** none new.
- **Step:** Reply in the Copilot thread.
  - **Command or tool call:** `gh api graphql -f query='mutation ReplyToThread($id:ID!,$body:String!){addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$id,body:$body}){comment{id}}}' -f id=<thread id> -F body=@.superpowers/verify-and-fix/fix-BILL-430-rounding/reply-thread-1.md --hostname github.com`
  - **Source:** ship-plan/hosts/github.md, "Reply to a review item"; verify-and-fix/review-comments.md, "Reply".
  - **Told or worked out:** told. `<thread id>` comes from the Q3 fetch.
  - **Files read for this step:** none new.
- **Step:** Resolve the thread. Copilot is a bot, and the thread has a reply now.
  - **Command or tool call:** `gh api graphql -f query='mutation ResolveThread($id:ID!){resolveReviewThread(input:{threadId:$id}){thread{isResolved}}}' -f id=<thread id> --hostname github.com`
  - **Source:** ship-plan/hosts/github.md, "Resolve a bot's thread"; verify-and-fix/review-comments.md, "Resolve".
  - **Told or worked out:** told.
  - **Files read for this step:** none new.

### Q5
- **Step:** Post the review-round comment on BILL-430 after the replies. The branch name carries `BILL-430`, the tracker is Jira, and this run is not under ship-plan, so the skip does not apply.
- **Command or tool call:** `mcp__plugin_atlassian_atlassian__addOrEditJiraIssueComment` with:
  - `cloudId`: `https://acme.atlassian.net`
  - the issue key: `BILL-430`
  - the comment in markdown:
    ```
    **Review round 1** on [#61](https://github.com/acme/billing-api/pull/61): 1 comments from Copilot.

    | Comment | Grade | Result |
    |---|---|---|
    | Copilot: <one line> | <grade> | Fixed in `<short sha>` |

    Checks: <green / running>. Approval: <approved / waiting for <who or "code owners">>.
    ```
  - No other Jira call. There is no transition: the Start, Review and Done transitions belong to ship-plan or ship-issue steps, not to this skill's review comments.
- **Source:**
  - verify-and-fix/review-comments.md, "Issue comment".
  - ship-plan/templates-issue.md, "Issue comment: review round".
  - ship-plan/trackers/jira.md, "Comment".
- **Told or worked out:** told for the tool, `cloudId` and template. Worked out for the key and body parameter names: jira.md says to take them from the tool's schema, which I did not read. The table row is filled from the Q3 fetch.
- **Files read for this step:** none new.
