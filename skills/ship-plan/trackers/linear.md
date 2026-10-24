# Linear

How the three skills do each tracker operation when the repo's tracker is Linear.

MCP tool names depend on how a connector is installed. The Linear tools are
listed as `mcp__plugin_engineering_linear__*`. A repo whose connector has
another name gets permission prompts. Record the name in `blockers.md` and
propose the allow line, as for any refused command.

Team, project and statuses come from the config's `## Linear`; follow its `Notes:`.

## Auth

Linear `get_user("me")`.

**Linear configured but unavailable** (not connected, or the call fails): park "Linear unavailable: <exact error>" in the batch, continue as if Linear were not configured (the PR body carries the plan), and say so in the report. Never retry it through another route. **A Linear call that fails later in the run** gets the same rule; if the PR already exists, post its Plan section with the host's *PR comment*.

## Issue keys

The team key followed by `-<n>` (for example `ENG-123`).

Branch pattern: `<type>/<id>-<slug>`.

**Never use Linear's `gitBranchName`**: it starts with the user's name.

## Integration

- **`github`:** Linear's GitHub integration links the branch and its PR to the issue by the issue key in the branch name and the PR title.
- **`azure-devops`:** nothing links the PR by key. The PR goes in `links` (see Link the PR) and in the Merged comment.

Do not assume an integration closes the issue. You attach the PR and you set the done status, only when the config's `Done means:` is met. If something sets it earlier, leave the status alone while reruns or fixes are still running, so it does not flip back and forth, and record a `Lesson:`: an integration now closes issues, and the config's `Notes:` need correcting.

## Find an issue

Stopping at the first hit:

1. an id in the argument;
2. the team key followed by `-<n>` in the plan's header or "Source:" line;
3. the same in the current branch name;
4. `list_issues` with the configured team and a `query` built from the plan's title words. Consider only issues that are not in a done, canceled or duplicate state.

| Search result | Action |
|---|---|
| Exactly one issue that clearly matches | Use it. |
| Several plausible matches | Use the one whose description matches the plan's goal best. Record a `Ruling:`, and list the others in the report as possibly related. |
| None | Create one in the configured team and project ("Create an issue"). |

## Read an issue

`get_issue` with the id, and its comments with `list_comments`. The issue description may be the plan; with Linear unavailable there is no plan, so park it and ask now.

## Where a new issue goes

The configured team and project, from the config's `## Linear`. No question is asked. If an answer names a related issue, or the new issue must wait for another, link them as "Link two issues" says.

**No `## Linear` in the config** (`Tracker: linear`, or the tracker question just answered Linear): draft the section ([config-drafting.md](../config-drafting.md)). Gather the options:

- **Team:** `list_teams`.
- **Project:** `list_projects` for the chosen team (the default, or the team of the most relevant candidate).
- **Start, Review and Done status:** `list_issue_statuses` for that team: the first "started" status, a review status if the team has one, and the first "completed" status.

Ask them in the issue question's batch, one question each (Team, Project, Start status, Review status, Done status), every question with 2 to 4 options, the recommended one first and marked "(Recommended)"; "Other" is added by the tool. More than 4 questions in the batch: ask the rest in a second `AskUserQuestion` call right after. The answers are the drafted `## Linear` (Team, Project, Start status, Review status, Done status; `Done means:` and `Notes:` left at their defaults), each a `Ruling: user <date>`. The draft goes in the question batch like any draft config, and once confirmed it is committed on the feature branch like `## Jira`'s draft (ship-plan: with the product change; ship-issue: with the spec). "No issue": no draft.

## Create an issue

`save_issue`: `team` and `project` from the config's `## Linear`,
`assignee: "me"`, `state: <Start status>`. Set `priority` only if the plan
states one. Title: the outcome, not the task ("Notes can be exported as
GeoJSON", not "Implement export").

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

`save_issue` with `patch: [{op: "append", text: "\n\n## Plan\n\n…"}]`. Use
the same Plan section as above. Never replace the user's text.

## Assign

`save_issue` with `assignee: "me"`.

## Set status

`save_issue` with `state: <status>`. Use only the statuses the config names.

- **Start status:** `save_issue` with `assignee: "me"` and `state: <Start status>`. Applied again after a revert, back to the start status, with the failure in a comment.
- **Review status:** `save_issue` with `state: <Review status>`, if the config names one. Absent: the issue stays in the start status.
- **Done status:** `save_issue` with `state: <Done status>`, **only when `Done means:` is met** (with CI None, Done means is "merged").

## Link the PR

`save_issue` with `links: [{url, title: "PR #n — <title>"}]`.

## Comment

`save_comment` with the issue id and the comment in markdown.

## Link two issues

`save_issue` on the issue being linked (the links are append-only):

- Related issue: `relatedTo: [<related key>]`.
- An answer that makes this issue wait for another issue or PR: `blockedBy: [<other key>]`. A PR without its own issue: link the issue its branch or title names.
- A follow-up: `relatedTo: [<run issue key>]` on the follow-up.

## Find an existing follow-up

Use "Find an issue" with the follow-up's subject as the `query`. When an issue already covers it, create nothing: name that issue in the Done comment's follow-ups. Otherwise create the follow-up and link it to the run issue as "Link two issues" says.
