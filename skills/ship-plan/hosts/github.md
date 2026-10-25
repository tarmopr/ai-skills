# Host: GitHub

The commands `ship-plan`, `verify-and-fix` and `ship-issue` use when the
config's `Host:` is `github` (or there is no `Host:` and `origin` is not an
Azure DevOps URL). Write each command exactly as shown: the `gh` lines in the
skills' `allowed-tools` match only these forms.

`<n>` is the PR number, `<id>` a workflow run id, `<base>` the base branch,
`<branch>` the PR's head branch, `<sha>` a commit.

## Auth check

`gh auth status`.

Your login: `gh api user --jq .login --hostname <host>` (see *Repo identity* for `<host>`). Run it once.

## Repo identity

`<o>/<r>` is `gh repo view --json nameWithOwner --jq .nameWithOwner`. `<host>` is the host of `gh repo view --json url --jq .url` (`github.com`, or a GitHub Enterprise host). Append `--hostname <host>` to every `gh api` call, after its other arguments: `gh api` does not read the host from the git remote the way `gh pr` does, so on GitHub Enterprise it asks `github.com` and answers 404, or another account's login.

Run each once.

## Default branch

`gh repo view --json defaultBranchRef --jq .defaultBranchRef.name`.

## Has CI

`.github/workflows/` holds a workflow file. No workflow file at all: CI None.

## Where CI is defined

Read `.github/workflows/*.yml`. From the jobs that run on `pull_request`, take each `run:` command, in order, as a gate. Setup, checkout, cache and install steps become Prerequisites, not gates. Service containers become a Prerequisites note. A step's `working-directory` becomes part of its command (`cd <dir> && …`). Expand a `${{ }}` expression to its literal value, or drop the step and list it under "consider adding".

**Never a gate:** a step that deploys, publishes, uploads (coverage, artifacts), comments on the PR, or reads `secrets.*`.

`Workflow:` is the workflow that runs on `push` to the base branch. Workflows on PRs only: leave `Workflow:` out and note "no push workflow" in the batch.

## Allowed merge methods

`gh repo view --json squashMergeAllowed,mergeCommitAllowed`: `squash` when allowed, else `merge`.

## Open the PR

`gh pr create --base <base>`. The body ends with the attribution line.

## PR web URL

In `gh pr create`'s output, and in `gh pr view <n> --json number,url`.

## PR size

`gh pr view <n> --json changedFiles,additions,deletions`, right before it is used, never from memory.

## Find open PRs

- **The branch's own PR:** `gh pr view --json number,url,reviewDecision`.
- **By search:** `gh pr list --state open --search "<KEY-n>"` (an issue's PR), `gh pr list --state open --search lessons` (open lessons PRs).
- **A named PR's state:** `gh pr view <n> --json state,mergedAt,headRefOid`, then `git fetch origin <its head branch>` and `git log --oneline origin/<base>..origin/<its head branch>`.
- **By changed files under a folder** (copies in flight): `gh pr list --state open --json number,files --jq '.[] | select(any(.files[]; .path | startswith("<that folder>/"))) | .number'`, then `gh pr diff <n> | grep -n -e <name>` for each PR it lists: a hit is a copy in flight.

## Wait for the PR's checks

`gh pr checks <n> --watch --fail-fast` with `run_in_background`. Read once, without waiting: `gh pr checks <n>`.

If it answers "no checks reported":
- **CI None** — the config's `## CI` says `None`, or `.github/workflows/` holds no workflow file: there is nothing to wait for.
- Otherwise see *Does CI cover this diff*.

## Does CI cover this diff

Read each workflow's `on:` block: its `pull_request` trigger, branch filters and `paths` / `paths-ignore`. **No workflow covers this PR** (a docs-only diff under `paths-ignore`, a PR-only filter that excludes this base): there is no PR CI for this diff.

A workflow does cover it: CI has not registered yet. Wait up to 10 minutes, then treat it as a blocker.

## Read a failed run

A red PR check: `gh run view <run-id> --log-failed | tail -150`. A red base-branch run: `gh run view <id> --log-failed | tail -150`.

## Rerun a failed PR check

`gh run rerun <run-id> --failed`. Keep the rerun a separate command, so it matches the pre-approval.

## Read the review rule

Record
`Review rule: approvals <n> | code owners <yes/no> | stale dismissed <yes/no> | threads must be resolved <yes/no> | source <config/ruleset/protection/unknown/none possible/user>`:
- **The rulesets:** `gh api repos/<o>/<r>/rules/branches/<base> --hostname <host>`. Every rule with `"type": "pull_request"` counts; take the strictest of each of `required_approving_review_count`, `require_code_owner_review`, `dismiss_stale_reviews_on_push` and `required_review_thread_resolution` from its `parameters`.
- **Else classic branch protection:** `gh api repos/<o>/<r>/branches/<base>/protection/required_pull_request_reviews --hostname <host>`. A 403 or 404 means unknown, not none.
- **The config's `Approvals:`** (`## Repo`: `none` for POCs and internal tools, or a number) applies when neither could be read, and can raise what they say (source `config`), never lower it: GitHub enforces its own rules whatever the config says.
- **Nothing readable and no `Approvals:`:** assume 1.
- **Both answer 403 with a message that the feature needs a paid plan or a public repository** (for example "Upgrade to GitHub Pro or make this repository public to enable this feature"): the repository can have no rulesets and no branch protection, so GitHub enforces no review rule. Record source `none possible`. With no `Approvals:`, assume 1. Once the PR's checks are green, every remaining path is blocked (only another collaborator could approve), so ask now, as SKILL.md section 3, step 5 allows, without waiting out `Review wait:` first. The question, part of this run's batch: "Add `Approvals: none` to `## Repo`?", with the 403 text quoted. It is a loosening change ([config-format.md](../config-format.md#loosening-changes)).
  - **Yes:** record it as an `Asked:` line, and record the rule again, replacing the first line, as `Review rule: approvals 0 | … | source user`. This run's PR and its lessons PR are then judged by that line, and section 8 writes `Approvals: none` on the lessons branch.
  - **No, or no answer:** the rule stays at 1, and section 4R waits and hands off as usual.

## Request an AI review

Code owners are requested by GitHub; request nobody else. **Copilot,** unless the config says `Copilot review: no`, `blockers.md` records that Copilot review is unavailable here, or `gh pr view <n> --json reviewRequests,reviews` already shows it (a ruleset can request it automatically): `gh pr edit <n> --add-reviewer @copilot`. If that is refused, go on without it, record a `Lesson:` for `blockers.md` ("Copilot review unavailable: <error>"), and propose `Copilot review: no` as a config change. Never try another route.

## Re-request a reviewer

Re-request a person with `gh pr edit <n> --add-reviewer <login>` when every change they requested is addressed, or when your push dismissed their approval (their latest review turned `DISMISSED`). Never re-request Copilot: a ruleset that wants it re-reviews on push by itself.

## Fetch review items

- Threads: `gh api graphql -f query='query ReviewThreads($owner:String!,$name:String!,$n:Int!){repository(owner:$owner,name:$name){pullRequest(number:$n){reviewThreads(first:100){nodes{id isResolved isOutdated path line comments(first:50){nodes{id author{login} body createdAt}}}}}}}' -F owner=<owner> -F name=<repo> -F n=<n> --hostname <host>`
- Review bodies and conversation comments: `gh pr view <n> --json reviews,comments`.

Every item is keyed by GraphQL node ids (the `id` fields above, which `gh pr view` also returns).

| Item | Key | New when |
|---|---|---|
| Inline thread | `thread <thread id> @ <last comment id>` | Unresolved, its last comment is not yours, and the ledger has no line for this key. A reviewer's reply in a handled thread changes the last comment, so it is new. |
| Review body | `review <review id>` | Its body is not empty, whatever its state (an approval can carry a request), and the ledger has no line for this key. **Not** Copilot's summary review: its findings arrive as threads. |
| Conversation comment | `comment <comment id>` | Not yours, not from a bot other than Copilot (CI, coverage and the Jira integration are not reviewers), and the ledger has no line for this key. |

Copilot's login shows as `Copilot` or `copilot-pull-request-reviewer`, with or
without `[bot]`.

## Reply to a review item

Write the body to a file in `verify-and-fix`'s ledger directory and pass it with `-F body=@<file>`:

- an inline thread: `gh api graphql -f query='mutation ReplyToThread($id:ID!,$body:String!){addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$id,body:$body}){comment{id}}}' -f id=<thread id> -F body=@<file> --hostname <host>`;
- a review body or a conversation comment: `gh pr comment <n> --body-file <file>`, quoting the start of what you answer.

## Resolve a bot's thread

Resolve a Copilot thread once it has a reply of any kind (fixed, answered, follow-up, not valid): `gh api graphql -f query='mutation ResolveThread($id:ID!){resolveReviewThread(input:{threadId:$id}){thread{isResolved}}}' -f id=<thread id> --hostname <host>`. A person's thread is theirs to resolve.

## Review state

Poll: `gh pr view <n> --json reviewDecision,reviews,reviewRequests,mergeStateStatus,statusCheckRollup`, and the threads and comments as *Fetch review items* says.

- **Approvals:** in `reviews`, take each reviewer's latest review, leave out yours and Copilot's, and count those in state `APPROVED`; the count reaches the rule's number, no latest review is `CHANGES_REQUESTED`, and `reviewDecision` is `APPROVED` or empty (GitHub leaves it empty when no rule requires review; when a rule does, `APPROVED` also covers code owners).
- **Copilot review pending:** once Copilot was requested, it is pending until `reviews` holds a Copilot review submitted after the PR's last push, whatever `reviewRequests` shows (`--add-reviewer @copilot` can exit 0 and leave `reviewRequests` empty while Copilot still reviews; a push can start another review).
- **A dismissed approval:** that reviewer's latest review is now `DISMISSED`.

## Merge state

`gh pr view <n> --json mergeable,mergeStateStatus,statusCheckRollup,reviewDecision`. Every check must be `SUCCESS` or `SKIPPED`. CI None, or no PR CI for this diff: there are no checks to read. **`reviewDecision` is `REVIEW_REQUIRED` or `CHANGES_REQUESTED`, or `mergeStateStatus` is `BLOCKED` with every check green:** the review rules are not met after all (a code owner, an unresolved thread, a rule section 4R could not read). Never use `--admin`, and never approve.

**Behind the base branch or conflicting:** fetch the PR branch first (`git fetch origin <branch>`): the user may already have pressed GitHub's "Update branch".

## Merge the PR

Merge with the configured method: `gh pr merge <n> --squash --delete-branch` (or `--merge`). Record the merge SHA: `gh pr view <n> --json mergeCommit --jq .mergeCommit.oid`. `--delete-branch` also switches the local checkout to the base branch and deletes the local feature branch; continue from there (sections 6–8 branch from `origin/<base>`), and read this run's ledger by its path, since the branch it is named after is gone.

**The merge is refused** by the permission system, or by GitHub (a disallowed merge method, a branch policy): do not retry it, and do not try another route.

## Find the base-branch run

`gh run list --workflow=<config Workflow> --branch=<base> --commit <sha> --json databaseId,status` (no `Workflow:` configured: `gh run list --branch <base> --commit <sha> --json databaseId,status,workflowName`, and watch every run). It may take a few seconds to appear. **No run for `<sha>` within 5 minutes** (the workflows do not run on pushes, or their path filters exclude this commit): record "no base-branch run for `<sha>`", treat it like CI None for this merge, and say so in the report.

The base branch's last runs: `gh run list --branch <base> --workflow <config Workflow> --limit 3`.

## Watch a run

`gh run watch <id> --exit-status` with `run_in_background`. If it exits 1, check `gh run view <id> --json status,conclusion` before calling the run red: `gh run watch` also exits 1 on a transient GitHub API error while the run carries on.

Green, as the config's `Green:` defines.

## Rerun a base-branch run

`gh run rerun <id> --failed`, then watch again. Keep the rerun a separate command, so it matches the pre-approval.

## PR comment

`gh pr comment <n> --body-file <file>`.

## Run web URL

In `gh run view <id>`'s output.

## Never

- `--admin`.
- Approving the PR, dismissing a review, resolving a human reviewer's thread, or requesting a reviewer other than Copilot (code owners are requested by GitHub).
