**Files read:**
1. verify-and-fix/SKILL.md
2. ship-plan/config-format.md
3. verify-and-fix/review-comments.md
4. ship-plan/hosts/github.md
5. ship-plan/trackers/jira.md
6. ship-plan/templates-issue.md

(I also ran one `ls` of the ship-plan folders to see which host and tracker files exist. That was a tool call other than a file read. It opened no file.)

Not read: `.claude/ship-plan/blockers.md`. SKILL.md says to read it before round 1, but it lives in the repo, not under skills. verify-and-fix/ui-testing.md was not read either: the config has no `## UI testing`. ship-plan/config-drafting.md and ship-plan/log-formats.md were not read: the config exists and no blocker came up.

### Q1

- **Step:** Read the skill, its entry file
- **Command or tool call:** read `verify-and-fix/SKILL.md`
- **Source:** verify-and-fix/SKILL.md, the skill itself
- **Told or worked out:** told
- **Files read for this step:** verify-and-fix/SKILL.md

- **Step:** Read the repo config format, as "Before round 1" requires
- **Command or tool call:** read `ship-plan/config-format.md`
- **Source:** verify-and-fix/SKILL.md, "Verify and fix" (the paragraph "Before round 1, read the repo's `.claude/ship-plan.md` ([format](../ship-plan/config-format.md))"); section 1 "Setup", the Config bullet
- **Told or worked out:** told
- **Files read for this step:** ship-plan/config-format.md

- **Step:** Read the host file for `github`. `Host:` is absent from the config, so it comes from the `origin` remote `git@github.com:acme/billing-api.git`, which is not Azure DevOps, so `github`.
- **Command or tool call:** read `ship-plan/hosts/github.md`
- **Source:** verify-and-fix/SKILL.md, "1. Setup", the Host and tracker bullet; ship-plan/config-format.md, "`## Repo`" (`Host:` default)
- **Told or worked out:** told
- **Files read for this step:** ship-plan/hosts/github.md

- **Step:** Read the tracker file for `jira`. `Tracker:` is absent, `## Jira` is present, so `jira`.
- **Command or tool call:** read `ship-plan/trackers/jira.md`
- **Source:** verify-and-fix/SKILL.md, "1. Setup", the Host and tracker bullet; ship-plan/config-format.md, "`## Repo`" (`Tracker:` default)
- **Told or worked out:** told
- **Files read for this step:** ship-plan/trackers/jira.md

- **Step:** Read review-comments.md. Section 4b says to read it when the branch has an open PR. It comes after the agents' review round, and I read it once Q2 shows PR #61.
- **Command or tool call:** read `verify-and-fix/review-comments.md`
- **Source:** verify-and-fix/SKILL.md, "4b. PR review comments"
- **Told or worked out:** told
- **Files read for this step:** verify-and-fix/review-comments.md

- **Step:** Read the issue-comment templates. review-comments.md ("Issue comment") points to the `Issue comment: review round` template, and the branch name carries BILL-430.
- **Command or tool call:** read `ship-plan/templates-issue.md`
- **Source:** verify-and-fix/review-comments.md, "Issue comment"
- **Told or worked out:** told
- **Files read for this step:** ship-plan/templates-issue.md

### Q2

- **Step:** Find the branch's own open PR
- **Command or tool call:** `gh pr view --json number,url,reviewDecision`
- **Source:** ship-plan/hosts/github.md, "Find open PRs" (the branch's own PR); verify-and-fix/SKILL.md, "4b. PR review comments"
- **Told or worked out:** told
- **Files read for this step:** none new

### Q3

- **Step:** Auth check, once
- **Command or tool call:** `gh auth status`
- **Source:** ship-plan/hosts/github.md, "Auth check"
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Fill `<o>/<r>` (gives `acme/billing-api`, so `<owner>`=`acme`, `<repo>`=`billing-api`)
- **Command or tool call:** `gh repo view --json nameWithOwner --jq .nameWithOwner`
- **Source:** ship-plan/hosts/github.md, "Repo identity"
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Fill `<host>` (prints `https://github.com/acme/billing-api`, so `<host>`=`github.com`)
- **Command or tool call:** `gh repo view --json url --jq .url`
- **Source:** ship-plan/hosts/github.md, "Repo identity"
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** My login, once. The "new" test for threads and comments needs it ("its last comment is not yours").
- **Command or tool call:** `gh api user --jq .login --hostname github.com`
- **Source:** ship-plan/hosts/github.md, "Auth check" and "Repo identity"
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Fetch the inline threads of PR #61. `<n>` is 61, from the Q2 output.
- **Command or tool call:** `gh api graphql -f query='query ReviewThreads($owner:String!,$name:String!,$n:Int!){repository(owner:$owner,name:$name){pullRequest(number:$n){reviewThreads(first:100){nodes{id isResolved isOutdated path line comments(first:50){nodes{id author{login} body createdAt}}}}}}}' -F owner=acme -F name=billing-api -F n=61 --hostname github.com`
- **Source:** ship-plan/hosts/github.md, "Fetch review items"; verify-and-fix/review-comments.md, "Fetch"
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Fetch the review bodies and conversation comments
- **Command or tool call:** `gh pr view 61 --json reviews,comments`
- **Source:** ship-plan/hosts/github.md, "Fetch review items"
- **Told or worked out:** told
- **Files read for this step:** none new

### Q4

- **Step:** Push the fix, once the round's gates pass. This is the precondition for the reply, not part of Q4.
- **Command or tool call:** `git push origin HEAD`
- **Source:** verify-and-fix/review-comments.md, intro; verify-and-fix/SKILL.md, "5. Triage and fix"
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Write the reply body to a file in the ledger directory (the Fixed template)
- **Command or tool call:** Write tool, `file_path`: `.superpowers/verify-and-fix/fix-BILL-430-rounding/reply-1.md`, `content`: `Fixed in <short sha>: <what changed, one line>. Test: <test name>.`
- **Source:** ship-plan/hosts/github.md, "Reply to a review item"; verify-and-fix/review-comments.md, "Review reply" (Fixed row)
- **Told or worked out:** told for the template. The file name `reply-1.md` is worked out: the skill only says "a file in the ledger directory".
- **Files read for this step:** none new

- **Step:** Reply in the Copilot thread
- **Command or tool call:** `gh api graphql -f query='mutation ReplyToThread($id:ID!,$body:String!){addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$id,body:$body}){comment{id}}}' -f id=<thread id> -F body=@.superpowers/verify-and-fix/fix-BILL-430-rounding/reply-1.md --hostname github.com`
- **Source:** ship-plan/hosts/github.md, "Reply to a review item"
- **Told or worked out:** told. `<thread id>` is the `id` of the unresolved thread from the Q3 fetch.
- **Files read for this step:** none new

- **Step:** Resolve the thread. Copilot is a bot reviewer and the thread now has a reply.
- **Command or tool call:** `gh api graphql -f query='mutation ResolveThread($id:ID!){resolveReviewThread(input:{threadId:$id}){thread{isResolved}}}' -f id=<thread id> --hostname github.com`
- **Source:** ship-plan/hosts/github.md, "Resolve a bot's thread"; verify-and-fix/review-comments.md, "Resolve"
- **Told or worked out:** told
- **Files read for this step:** none new

- **Step:** Record the reply in the ledger. Nothing is re-requested: Copilot is a bot ("Never re-request a bot").
- **Command or tool call:** append to `.superpowers/verify-and-fix/fix-BILL-430-rounding/ledger.md`: `Replied: thread <thread id> @ <last comment id> — fixed in <sha>`
- **Source:** verify-and-fix/review-comments.md, "Reply" (the `Replied:` line)
- **Told or worked out:** told
- **Files read for this step:** none new

### Q5

Yes, one Jira call. Nothing asked and nothing else is written to Jira. The branch name carries the key `BILL-430`, the tracker is `jira` (not `none`), and this is a standalone run (not under `ship-plan`), so the "Issue comment" step applies. No transition is made.

- **Step:** Post the review-round comment on BILL-430, after the replies
- **Command or tool call:** `mcp__plugin_atlassian_atlassian__addOrEditJiraIssueComment` with `cloudId`: `https://acme.atlassian.net`, the issue key `BILL-430`, and the comment in markdown. The skill does not name the key and body parameters; I would pass them as `issueIdOrKey` and `commentBody`. Body:

```
**Review round 1** on [#61](<pr url>): 1 comments from Copilot.

| Comment | Grade | Result |
|---|---|---|
| Copilot: <one line> | <grade> | Fixed in `<short sha>` |

Checks: <green / running>. Approval: <approved / waiting for <who or "code owners">>.
```

- **Source:** verify-and-fix/review-comments.md, "Issue comment"; ship-plan/templates-issue.md, "Issue comment: review round"; ship-plan/trackers/jira.md, "Comment"; ship-plan/config-format.md, "`## Jira`" (`Site:` is passed as `cloudId`)
- **Told or worked out:** told for the tool, `cloudId` and template. The two parameter names are worked out.
- **Files read for this step:** none new
