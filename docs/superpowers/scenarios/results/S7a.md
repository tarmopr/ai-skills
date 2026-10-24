**Files read:**
1. verify-and-fix/SKILL.md
2. ship-plan/config-format.md
3. ship-plan/hosts/github.md
4. verify-and-fix/review-comments.md
5. ship-plan/trackers/jira.md
6. ship-plan/templates-issue.md

(Not under SKILLDIR, so not read: the repo's `.claude/ship-plan/blockers.md` and any `.claude/ship-plan/verify-and-fix/*.md` override files. SKILL.md says to read them in Setup. ui-testing.md is not read: the config has no `## UI testing`.)

### Q1

- **Step:** Read the skill, then the config format, the GitHub host file, the PR review-comments file, then the Jira tracker file and the issue templates.
- **Command or tool call:** none, reading files only.
- **Source:** verify-and-fix/SKILL.md, "1. Setup" (config-format.md, hosts/<host>.md), "4b. PR review comments" (review-comments.md), and review-comments.md "Issue comment" (trackers/jira.md, templates-issue.md, because the branch name carries `BILL-430` and the config has `## Jira`).
- **Told or worked out:** told.
- **Files read for this step:** verify-and-fix/SKILL.md; ship-plan/config-format.md; ship-plan/hosts/github.md; verify-and-fix/review-comments.md; ship-plan/trackers/jira.md; ship-plan/templates-issue.md.

### Q2

- **Step:** Find the branch's own open PR.
- **Command or tool call:** `gh pr view --json number,url,reviewDecision`
- **Source:** ship-plan/hosts/github.md, "Find open PRs" ("The branch's own PR"); verify-and-fix/SKILL.md, "4b. PR review comments".
- **Told or worked out:** told.
- **Files read for this step:** none new.

### Q3

Nothing is asked of the user; nothing is written to a file.

- **Step:** Check auth.
- **Command or tool call:** `gh auth status`
- **Source:** ship-plan/hosts/github.md, "Auth check".
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** Get `<o>/<r>` (owner and repo), once.
- **Command or tool call:** `gh repo view --json nameWithOwner --jq .nameWithOwner` (prints `acme/billing-api`, so owner=`acme`, repo=`billing-api`)
- **Source:** ship-plan/hosts/github.md, "Repo identity".
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** Get `<host>`, once.
- **Command or tool call:** `gh repo view --json url --jq .url` (prints `https://github.com/acme/billing-api`, so host=`github.com`)
- **Source:** ship-plan/hosts/github.md, "Repo identity".
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** Get my login, once, to tell which comments are mine.
- **Command or tool call:** `gh api user --jq .login --hostname github.com`
- **Source:** ship-plan/hosts/github.md, "Auth check" and "Repo identity".
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** Fetch the inline review threads.
- **Command or tool call:** `gh api graphql -f query='query ReviewThreads($owner:String!,$name:String!,$n:Int!){repository(owner:$owner,name:$name){pullRequest(number:$n){reviewThreads(first:100){nodes{id isResolved isOutdated path line comments(first:50){nodes{id author{login} body createdAt}}}}}}}' -F owner=acme -F name=billing-api -F n=61 --hostname github.com`
- **Source:** ship-plan/hosts/github.md, "Fetch review items"; verify-and-fix/review-comments.md, "Fetch".
- **Told or worked out:** told (placeholders filled from the two `gh repo view` outputs and PR #61).
- **Files read for this step:** none new.

- **Step:** Fetch review bodies and conversation comments.
- **Command or tool call:** `gh pr view 61 --json reviews,comments`
- **Source:** ship-plan/hosts/github.md, "Fetch review items".
- **Told or worked out:** told.
- **Files read for this step:** none new.

### Q4

Files written (via the Write tool, not a shell command), in `.superpowers/verify-and-fix/fix-BILL-430-rounding/` (the directory is made first, in Setup, with `mkdir -p .superpowers/verify-and-fix/fix-BILL-430-rounding`, plus `ledger.md`). Nothing is asked of the user.

- **Step:** Stage only the fixed files by name.
- **Command or tool call:** `git add <fixed file 1> <fixed file 2>`
- **Source:** verify-and-fix/SKILL.md, "5. Triage and fix" (stage by name, never `git add -A`).
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** Commit once for this PR comment.
- **Command or tool call:** `git commit -m "fix(review): <what>"`
- **Source:** verify-and-fix/SKILL.md, "5. Triage and fix" (one commit per PR comment, `fix(review): <what>`, hooks run, no `--no-verify`).
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** Rerun the gates; once they pass, push.
- **Command or tool call:** `CI=true make test > .superpowers/verify-and-fix/fix-BILL-430-rounding/tests.log 2>&1`, then `tail .superpowers/verify-and-fix/fix-BILL-430-rounding/tests.log`, then `git push origin HEAD`
- **Source:** verify-and-fix/SKILL.md, "2. Gates", "5. Triage and fix" ("push once the round's gates pass"); verify-and-fix/review-comments.md, intro (push authorized, not `--force`).
- **Told or worked out:** told (the gate command is the config's `make test`; the log file name is `<gate>.log` worked out from "2. Gates").
- **Files read for this step:** none new.

- **Step:** Get the short sha for the reply.
- **Command or tool call:** `git rev-parse --short HEAD`
- **Source:** verify-and-fix/review-comments.md, "Review reply" (Fixed replies name the commit).
- **Told or worked out:** worked out.
- **Files read for this step:** none new.

- **Step:** Write the reply body to a file in the ledger directory.
- **Command or tool call:** Write tool, file_path `.superpowers/verify-and-fix/fix-BILL-430-rounding/reply-thread.md`, content: `Fixed in <short sha>: <what changed, one line>. Test: <test name>.`
- **Source:** ship-plan/hosts/github.md, "Reply to a review item"; verify-and-fix/review-comments.md, "Review reply".
- **Told or worked out:** told (the template); the file name is worked out.
- **Files read for this step:** none new.

- **Step:** Reply in the thread.
- **Command or tool call:** `gh api graphql -f query='mutation ReplyToThread($id:ID!,$body:String!){addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$id,body:$body}){comment{id}}}' -f id=<thread id> -F body=@.superpowers/verify-and-fix/fix-BILL-430-rounding/reply-thread.md --hostname github.com`
- **Source:** ship-plan/hosts/github.md, "Reply to a review item"; verify-and-fix/review-comments.md, "Reply".
- **Told or worked out:** told (`<thread id>` is the `id` of the thread from Q3's output).
- **Files read for this step:** none new.

- **Step:** Resolve the thread (Copilot's thread, which now has a reply).
- **Command or tool call:** `gh api graphql -f query='mutation ResolveThread($id:ID!){resolveReviewThread(input:{threadId:$id}){thread{isResolved}}}' -f id=<thread id> --hostname github.com`
- **Source:** ship-plan/hosts/github.md, "Resolve a bot's thread"; verify-and-fix/review-comments.md, "Resolve".
- **Told or worked out:** told.
- **Files read for this step:** none new.

- **Step:** Record the reply in the ledger.
- **Command or tool call:** Edit/Write `.superpowers/verify-and-fix/fix-BILL-430-rounding/ledger.md`, adding `Replied: thread <thread id> @ <last comment id> — fixed in <sha>` (and, when the item was first fetched, `Review: thread <thread id> @ <last comment id> Copilot <grade> — <one line> — <action>`).
- **Source:** verify-and-fix/review-comments.md, "What counts as new" and "Reply".
- **Told or worked out:** told.
- **Files read for this step:** none new.

### Q5

Yes. This is a standalone run, not under `ship-plan`, so the "skip it" exception does not apply. The branch name carries the key `BILL-430` and the config has `## Jira`, so `Tracker:` resolves to `jira`. Nothing is asked of the user.

- **Step:** Post the "Issue comment: review round" to BILL-430, after the replies.
- **Command or tool call:** `mcp__plugin_atlassian_atlassian__addOrEditJiraIssueComment` with `cloudId: "https://acme.atlassian.net"`, issue key `BILL-430`, and the comment in markdown:
  ```
  **Review round 1** on [#61](<pr url>): 1 comments from Copilot.

  | Comment | Grade | Result |
  |---|---|---|
  | Copilot: <one line> | <grade> | Fixed in `<short sha>` |

  Checks: <green / running>. Approval: <approved / waiting for <who or "code owners">>.
  ```
- **Source:** verify-and-fix/review-comments.md, "Issue comment"; ship-plan/trackers/jira.md, "Comment" and "Issue keys"; ship-plan/templates-issue.md, "Issue comment: review round"; verify-and-fix/SKILL.md `allowed-tools`.
- **Told or worked out:** told for the tool, `cloudId`, key and body; the parameter name for the issue key is worked out (`issueIdOrKey`), since jira.md only says "the issue key". `<pr url>` comes from Q2's output.
- **Files read for this step:** none new.
