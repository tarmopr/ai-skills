# S16: GitHub with GitHub Issues as the tracker

A github.com repo that tracks work in its own GitHub Issues, with no
`## GitHub Issues` section yet. The Linear integration is connected but not
used by this repo.

## Prompt

You are running the `ship-issue` skill, which hands off to `ship-plan`. Their
files are in SKILLDIR/ship-issue/ and SKILLDIR/ship-plan/ (each SKILL.md and
the files it links), and `verify-and-fix` is in SKILLDIR/verify-and-fix/. Read
SKILLDIR/ship-issue/SKILL.md, SKILLDIR/ship-plan/SKILL.md and every file they
link that matters for this run.

**The repo:** `acme/tide-tables` on github.com. `git remote get-url origin`
prints `https://github.com/acme/tide-tables.git`. CI is GitHub Actions,
`.github/workflows/ci.yml`, on pull requests and on pushes to `main`. The
repo has 40 issues, open and closed. Its labels are GitHub's defaults only
(`bug`, `documentation`, `duplicate`, `enhancement`, `good first issue`,
`help wanted`, `invalid`, `question`, `wontfix`). It has one open milestone,
`v1.2`, due in two weeks. The Linear MCP is connected in this session; the
Atlassian MCP is not.

**Its `.claude/ship-plan.md`:**

```markdown
# Ship config

## Repo
- Host: github
- Tracker: github
- Base branch: main
- Merge: squash

## Gates
| Gate | Command | Only when changed | Timeout |
|---|---|---|---|
| Tests | make test | | 10 |

## CI
- Workflow: ci.yml

## Slack
- Channel: none
```

**The invocation:** `/ship-issue the hourly endpoint accepts malformed dates
and returns an empty list instead of an error`. No issue key is given.

**What the world answers, unless a question says otherwise:**

- `gh auth status` succeeds; `hasIssuesEnabled` is `true`.
- Searching open issues for the title words finds one: `#12` "Hourly chart
  shows gaps after DST", which is not this problem.
- The user answers the issue question with "Create a new issue", milestone
  `v1.2`, no related issue. The new issue is `#41`. The work is a fix.
- The plan, once written, is 9,000 characters. The issue body you create is
  1,500 characters.
- The PR you open is `#57`. It is approved and merged; the merge commit is
  `abc1234`.

Answer, in order, with the exact commands and tool calls:

1. Suppose instead the config had no `Tracker:` line and no tracker section.
   Which question is asked about the tracker, with which options, which one is
   recommended, and why?
2. Suppose `gh auth status` failed with "You are not logged into any GitHub
   hosts". What happens to the issue for the rest of the run, and what is
   reported?
3. Auth is fine. What is drafted for the missing tracker section, what does
   the issue question ask (every question and its options), and which exact
   commands create the issue and set its start status?
4. Which branch name does the run use for `#41`? Separately: the current
   branch is `fix/2fa-login`, which this run started. Which issue key does it
   carry?
5. Append the plan to the issue: every command. What changes if the body plus
   the plan would be 70,000 characters?
6. Open the PR: what in the PR title, the PR body and the commit messages
   refers to the issue, and what must none of them contain?
7. The PR is opened, then merged, then the base-branch run for `abc1234`
   passes. Every issue command, in order, and when. Then, separately: what if
   that base-branch run had failed?

## Pass if

- Answer 1: "Which tracker does this repo use?" with the options Jira, Linear,
  GitHub Issues and "No tracker (the PR is the record)"; "GitHub Issues" is
  recommended because the host is GitHub and the repo has issues, even though
  the Linear integration is connected.
- Answer 2: parked as "GitHub Issues unavailable: <exact error>" in the
  batch, no other route is tried (no GitHub MCP), and, under ship-issue,
  nothing that needs the issue starts until it is answered.
- Answer 3: the drafted `## GitHub Issues` has `Start label: in-progress`,
  `Review label: in-review`, `Type labels: fix → bug, feature → enhancement`,
  with no question asked for it. The issue question offers "Create a new
  issue" and `#12` as a candidate, and a milestone question with "No
  milestone" first and `v1.2`. The create command is
  `gh issue create -R acme/tide-tables` with `--label bug`,
  `--milestone "v1.2"` and `--body-file` (no assignee at creation under
  ship-issue; ship-plan assigns with `--add-assignee @me` when work starts).
  The milestone list comes from `gh api repos/acme/tide-tables/milestones`
  with no `?` in the command. `in-progress` is created with
  `gh label create` after `gh label list` does not find it, then added with
  `gh issue edit 41 … --add-label in-progress`.
- Answer 4: `fix/41-<slug>`; `fix/2fa-login` carries no key.
- Answer 5: `gh issue view 41 … --json body`, then the whole body written
  back with `gh issue edit 41 … --body-file`. A committed plan: `## Plan`,
  `## Done when` and a `Full plan: <path> on branch <branch>` line. A
  git-ignored plan at 70,000 characters: `## Plan`, `## Done when` and a
  pointer line, and the plan goes in comments headed `Full plan (<i>/<n>)`.
- Answer 6: the PR body links the issue as `[#41](<issue url>)`; a title or
  commit subject names it at most as `(#41)` at its end. No closing keyword
  (`Fixes #41`, `Closes #41`, `Resolves: #41` or the like) anywhere.
- Answer 7: at PR open, `--add-label in-review --remove-label in-progress`.
  After the green base-branch run: the labels are removed, then
  `gh issue close 41 … --reason completed`, with no inline comment; every
  comment goes through `gh issue comment … --body-file`, and the Merged
  comment carries the PR's URL. Never closed before the base-branch run is green. If
  the run had failed, the issue stays open with its label, and a comment
  says why.
- `ship-plan/trackers/github.md` is read; `jira.md` and `linear.md` are not,
  and no Linear or Atlassian tool is called. No `gh project` command appears.
