# GitHub Issues

How the three skills do each tracker operation when the repo's tracker is GitHub Issues.

Every command passes `-R <Repo>`. `<Repo>` is the config's `## GitHub Issues`
`Repo:`, else the `origin` repo (`<o>/<r>` from the host's *Repo identity*),
written `<owner>/<name>` on github.com and `<host>/<owner>/<name>` on GitHub Enterprise:
`-R` takes the host only from that prefix, and without it `gh` asks github.com.
`gh api` takes `repos/<owner>/<name>/…` and `--hostname <host>` instead, as the
host's *Repo identity* says. Labels and `Done means:` come from the config's
`## GitHub Issues`; follow its `Notes:`. A body or comment the run writes goes
in a file in the ledger dir (before the ledger dir exists, in `.superpowers/`)
and is passed with `--body-file`, never inline.

Status is labels, progress is comments. There is no board: never call
`gh project`.

## Auth

`gh auth status`, then `gh repo view <Repo> --json hasIssuesEnabled`.

**GitHub Issues configured but unavailable** (not signed in, the call fails, or `hasIssuesEnabled` is `false`): park "GitHub Issues unavailable: <exact error>" in the batch, continue as if no tracker were configured (the PR body carries the plan), and say so in the report. Never retry it through another route. **A `gh issue`, `gh label` or milestones `gh api` call that fails later in the run** gets the same rule; if the PR already exists, post its Plan section with the host's *PR comment*.

## Issue keys

`#<n>`, `<owner>/<name>#<n>`, or an issue URL `https://<host>/<owner>/<name>/issues/<n>`. Text, titles and comments write `#<n>`; branch names and file names write `<n>`.

Branch pattern: `<type>/<n>-<slug>`.

An issue's open PR (the host's *Find open PRs*, by search) is one whose body links the issue's URL, matched on `/issues/<n>)`, never `#<n>`: a search for `#<n>` or `<n>` matches any PR that mentions the number.

From a branch name, the key is only the digits between `<type>/` and the next `-`: `fix/7-sync-auth` carries `#7`; `fix/2fa-login` carries no key. Numbers are common in branch names, so a branch this run did not start (verify-and-fix on its own, a resumed or someone else's branch) carries a key only when its PR body links that issue (`[#<n>](…/issues/<n>)`) or a ship-plan or ship-issue ledger exists for the branch. Otherwise it has no issue: a hand-made `fix/<n>-page-styling` never comments on `#<n>`.

## Integration

Nothing links a branch to an issue. The PR body's issue link (templates.md, written `[#<n>](<issue url>)`) puts the PR in the issue's timeline. That is the only reference the run makes.

**No closing keyword.** GitHub closes an issue on merge to the default branch when a PR title, PR body or commit message has a closing keyword (`close`, `closes`, `closed`, `fix`, `fixes`, `fixed`, `resolve`, `resolves`, `resolved`, in any case, optionally followed by `:`) directly before an issue reference. The run never writes one, in any of the three. A commit subject or PR title names the issue only as `(#<n>)` at its end (`fix: reject malformed dates (#<n>)`, never `fix #<n>` or `Fixes: #<n>`). An implementer or fixer sees only its own prompt, so ship-plan section 2 and verify-and-fix's fix rules put this rule in every dispatch, and ship-issue's Plan stage keeps it out of the plan's commit subjects. The run closes the issue itself (*Set status*).

Do not assume nothing closes the issue. You set the done status, only when the config's `Done means:` is met. If the issue is closed earlier, leave it closed while reruns or fixes are still running, so it does not flip back and forth, and record a `Lesson:`: something closes issues, and the config's `Notes:` need correcting.

## Find an issue

A key in the argument, in the plan's header or "Source:" line, or in the current branch name is used directly: that is a given key, not a search.

Otherwise return candidates only: `gh issue list -R <Repo> --state open --search "<title words>" --limit 3 --json number,title,labels`, most relevant first. The choice is the user's, through templates-issue.md's "Issue question": nothing is picked or created here.

## Read an issue

`gh issue view <n> -R <Repo> --json number,title,body,state,labels,milestone,assignees,comments`. Issues the body or the comments name as related or blocking (`#<m>`, or an issue URL) are read the same way. `state: CLOSED` counts as a done status category. The issue body may be the plan; with GitHub Issues unavailable there is no plan, so park it and ask now.

## Where a new issue goes

The config's `Repo:`. One place to choose, the milestone, and only when the repo has open milestones: `gh api repos/<owner>/<name>/milestones --hostname <host>` (the API returns open milestones only; never add a `?` query, which the shell expands). The question is "If a new issue: add it to a milestone? (optional)": "No milestone" first, then up to 3 open milestones, soonest `due_on` first (none set: most recently created). No open milestones: no question. If an answer names a related issue, or the new issue must wait for another, link them as "Link two issues" says.

**No `## GitHub Issues` in the config** (`Tracker: github`, or the tracker question just answered GitHub Issues): draft the section ([config-drafting.md](../config-drafting.md)) with the defaults and no questions:

```markdown
## GitHub Issues
- Start label: in-progress
- Review label: in-review
- Type labels: fix → bug, feature → enhancement
```

`Repo:` is written only when the issues live outside the `origin` repo; on an Azure DevOps host it is required, and its absence is a question in the batch. The draft goes in the question batch like any draft config, and once confirmed it is committed on the feature branch like `## Linear`'s draft (ship-plan: with the product change; ship-issue: with the spec). "No issue": no draft.

## Create an issue

`gh issue create -R <Repo> --title "<title>" --body-file <file> --assignee @me`, plus:

- `--label <label>` when `Type labels:` maps the branch type to a label and `gh label list -R <Repo> --search <label> --json name` returns a label whose `name` is exactly `<label>` (`--search` also matches longer names: `bug-bounty` is not `bug`; a type label is never created);
- `--milestone "<title>"` when the user chose one.

Then *Set status* to the start label. Title: the outcome, not the task ("Notes can be exported as GeoJSON", not "Implement export"); it never starts with a closing keyword.

```markdown
<one paragraph: the problem and who has it, from the plan's Goal>

## Plan

Source: `<plan path>` · Spec: `<spec path, or "none">`

<Architecture, in 2–4 sentences>

- [ ] Task 1 — <title>
- [ ] Task 2 — <title>
…

## Done when

<the plan's acceptance criteria, or "Merged, base-branch CI green, and the scenarios below pass">
```

## Append the plan

GitHub has no append: `gh issue edit` replaces the whole body. Read it with `gh issue view <n> -R <Repo> --json body`, add the sections at the end, and write the full body back with `gh issue edit <n> -R <Repo> --body-file <file>`. Never change or reflow the user's text.

**What is appended.** ship-plan appends the `## Plan` section from "Create an issue" only. ship-issue appends `## Plan`, then `## Done when`, then `## Full plan` with the plan text.

**Too big for GitHub.** A body or a comment holds at most 65,536 characters. When the existing body plus the sections would exceed it (count the text you would write; leave 2,000 characters of headroom), the fallback is fixed:

- The body gets `## Plan` and `## Done when` only, then one line: `Full plan: in the comments "Full plan (1/<n>)" … "(<n>/<n>)"; the local file <plan path> is authoritative.`
- The plan text goes in *Comment* comments headed `Full plan (<i>/<n>)`, each under 60,000 characters. Split only between top-level sections or `### Task` headings, never inside a code block; a single section that is still too long is split between its steps.
- If even `## Plan` and `## Done when` do not fit, post them as a comment too, and leave the body as it is.
- Record the fallback as a `Ruling:` with the character counts.

**The local plan file is authoritative.** ship-plan always gets the file, never the issue text.

## Assign

`gh issue edit <n> -R <Repo> --add-assignee @me`.

## Set status

Status is a label. Use only the labels the config names.

- **A label the repo lacks** is created once, before it is first added: `gh label list -R <Repo> --search <label> --json name`, and when no exact name matches, `gh label create <label> -R <Repo> --color <hex> --description "<text>"` (start label `fbca04`, "Work in progress"; review label `0e8a16`, "PR open for review").
- **Start label:** `gh issue edit <n> -R <Repo> --add-label <Start label> --add-assignee @me`, and `--remove-label <Review label>` when the issue has it. Applied again after a revert: first `gh issue reopen <n> -R <Repo>` if the issue is closed, then the start label, with the failure in a comment.
- **Review label:** `gh issue edit <n> -R <Repo> --add-label <Review label> --remove-label <Start label>`, if the config names one. `Review label: none`: the issue keeps the start label.
- **Done,** **only when `Done means:` is met** (with CI None, Done means is "merged"): `gh issue edit <n> -R <Repo> --remove-label <Start label> --remove-label <Review label>` (only the labels it has), then `gh issue close <n> -R <Repo> --reason completed`. The done comment is posted with *Comment* first; `gh issue close` takes no comment. Not met (base branch red, not merged): the issue stays open with its label, and the reason goes in a comment.

## Link the PR

No call: the PR body's issue link (Integration) puts the PR on the issue, and the PR URL goes in the review comment and the Merged comment.

## Comment

`gh issue comment <n> -R <Repo> --body-file <file>`, the comment in markdown.

## Link two issues

A comment on the issue being linked (GitHub mentions are the links; no sub-issues, no native dependencies):

- Related issue: `Related to #<m>`.
- An answer that makes this issue wait for another issue or PR: `Blocked by #<m>`. A PR without its own issue: the PR's URL.
- A follow-up: `Follow-up of #<n>` on the follow-up.

## Find an existing follow-up

Use "Find an issue" with the follow-up's subject as the search. When an issue already covers it, create nothing: name that issue in the Done comment's follow-ups. Otherwise create the follow-up (with the run issue's milestone, no question) and link it to the run issue as "Link two issues" says.
