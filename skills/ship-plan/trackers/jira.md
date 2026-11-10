# Jira

How the three skills do each tracker operation when the repo's tracker is Jira.
Every Jira call passes the config's `Site:` as `cloudId`. If an operation name
below is refused, `discover` it and use the name it returns. Parameter names
and shapes (the assignee, the description, a comment body) come from each
tool's schema as the client lists it, or as `discover` returns it: read it
before the first call to that tool, and never guess a field's shape. Where
this file names a parameter, it is the one to set.

Tools are `mcp__plugin_atlassian_atlassian__*`; a connector under another name prompts: record it in `blockers.md` and propose the allow line.

## Auth

`atlassianUserInfo`: its `account_id` is the assignee for every Jira call.

With no `## Jira` in the config, call `getAccessibleAtlassianResources`. One Jira site: use its URL. Several: ask which one first, in its own `AskUserQuestion` call.

**Jira unavailable** (not connected, or a call fails, now or later in the run): park "Jira unavailable: <exact error>" in the batch, continue with no Jira issue (the PR body carries the plan; a PR that exists gets its Plan section through the host's *PR comment*), and say so in the report. Never retry it through another route.

## Issue keys

Branch pattern: `<type>/<KEY-n>-<slug>` (`feature/PROJ-123-export-notes`), the key upper case: GitHub for Jira links the branch, its commits and its PR to the issue by it.

## Integration

- **`github`:** GitHub for Jira links the branch, its commits and its PR to the issue by the key in the branch name and the PR title. No link call. If the PR does not show on the issue's Development panel, record a `Lesson:`; the "Merged" comment carries the PR link either way.
- **`azure-devops`:** nothing links a PR to a Jira issue, and no remote link is made. The PR URL goes in the Merged comment.

Do not assume an integration closes the issue. You apply the done transition, only when the config's `Done means:` is met. If something sets it earlier, leave the status alone while reruns or fixes are still running, so it does not flip back and forth, and record a `Lesson:`: an integration now closes issues, and the config's `Notes:` need correcting.

## Find an issue

`searchJiraIssuesUsingJql` with `statusCategory != Done AND text ~ "<title words>"`, plus `AND project = <Project:>` when the config sets one. Up to 3, most relevant first.

## Read an issue

`getJiraIssue` with `view: "evidence"` (it includes linked issues), and its comments (`executeRead` with `listJiraIssueComments`; `discover` "list comments on a Jira issue" if that name is refused). Read the linked issues too.

**When the issue has a parent story** (ship-issue, I2 step 2), also list the parent's sub-tasks created since the base commit (`searchJiraIssuesUsingJql`: `parent = <story> AND created >= "<base commit date>"`) into `issue.md`: a sibling filed minutes earlier can already cover part of this issue.

## List sub-issues

Used by ship-queue. `searchJiraIssuesUsingJql` with the JQL `parent = <key> ORDER BY rank` and the fields `summary, status, assignee, priority, issuelinks, created`. An inward "is blocked by" issue link names a hard dependency. A status in the done status category is done. Tracker order: rank, as the query returns it.

## Where a new issue goes

Asked as templates-issue.md's "Issue question" says. Here, its two places are the **Project** and the **Epic**. The site: as *Auth* says.

- **Candidates:** as *Find an issue*.
- **Projects:** the config's `Project:`, then `executeRead` with `listJiraProjects` and `action: "create"`, preferring the candidates' projects. Up to 4 in total.
- **Epics:** `searchJiraIssuesUsingJql` with `issuetype = Epic AND statusCategory != Done AND text ~ "<title words>"`, scoped to the default project (below) when there is one. Up to 3.

**The places.**

- **Project** (question 2: "If a new issue: which project should it go in?"): the **default project** is the config's `Project:`, else the project of the most relevant candidate, else the first listed. Then the other listed projects.
- **Epic** (question 3: "If a new issue: add it to an epic? (optional)"): "No epic", then the epic candidates. With none found, the second option is "Type an epic key in Other". Recommend an epic only if it clearly matches.

**After the answer, for a new issue:** create it with `projectKey` from 2 and `parent: <epic key>` from 3 (an epic rejected, from another project or a project with no epics: as templates-issue.md says). A related issue from 4: *Link two issues*.

**No `## Jira` in the config, and the run tracks an issue** (new or existing):
draft the section (config-drafting.md) with the `Site:` above and the issue's
project as `Project:`. Fill `Start transition:` and `Done transition:` from
`executeRead` `listJiraIssueTransitions` on the issue: the transition into the
first "indeterminate" status, and the one into a "done" status. This run uses
the draft; each value is a `Ruling:`. It goes in the question batch like any
draft config; once confirmed it is committed on the feature branch (ship-plan:
with the product change; ship-issue: with the spec). "No Jira issue": no draft.

## Create an issue

As templates-issue.md's "New issue" says. `createJiraIssue`: `projectKey` and `parent` (epic) from *Where a new issue goes*, `issueType` from `Issue type:`, `additional_fields` from `Fields:`, `assignee` your account id, `description` in markdown, in one call with the run issue's labels and the fields `## Jira` names (a required team or component field), not afterwards. A missing required field: the one the repair hint names. Then `transitionJiraIssue` with `transitionName: <Start transition>`.

## Append the plan

Jira has no append: `editJiraIssue` replaces the whole description. Read it
with `getJiraIssue` and `responseContentFormat: "html"`, add the sections
templates-issue.md's "Plan appended" names (as HTML) at the end, and write the
full body back with `editJiraIssue` and `contentFormat: "html"`. Never write it
back as markdown: that drops media, mentions and panels. If the HTML format is
rejected, post the Plan section as a comment instead.

**Too big:** `<limit>` 32,767 characters (description or comment; the 2,000 headroom is for Jira's own markup), `<chunk>` 30,000. **Never attach the plan as a file:** it needs `uploadAttachmentToJiraIssue`, outside the `executeWrite` pre-approval (*Link two issues*).

## Assign

`editJiraIssue` with the `assignee` set to your account id (from `atlassianUserInfo`).

## Set status

Transitions are named as on the issue's workflow buttons, not by the status
they lead to: "Start progress" may lead to "In Progress". Use only the transitions the config names.

- **Start transition:** `transitionJiraIssue` with `transitionName: <Start transition>`. Skip the transition if the issue is already in the status it leads to. Applied again after a revert, if the issue has left the start status, with the failure in a comment.
- **Review transition:** `transitionJiraIssue` with `transitionName: <Review transition>`, if the config names one. Absent: the issue stays in the start status.
- **Done transition:** `transitionJiraIssue` with `transitionName: <Done transition>`, **only when `Done means:` is met** (with CI None, Done means is "merged").

## Link the PR

None: see *Integration*.

## Comment

`addOrEditJiraIssueComment` with the issue key and the comment in markdown.

## Link two issues

`executeWrite` with `createJiraIssueLink` and the inputs `{linkType, inwardIssue, outwardIssue}`; `type` is refused ("linkType: Required"). Both skills pre-approve `executeWrite` for this call only: the pre-approval covers every operation `executeWrite` can run, so any other write operation is outside the skills' authorization. A refusal is recorded, not retried another way.

- Related issue: `linkType: "Relates"`, `inwardIssue: <new key>`, `outwardIssue: <related key>`.
- An answer that makes this issue wait for another issue or PR ("wait for #<n>", "after ENG-123 merges"): `linkType: "Blocks"`, `inwardIssue: <the blocker>`, `outwardIssue: <the issue that waits>`; it reads "inwardIssue blocks outwardIssue", the reverse of what the names suggest. Fetch the waiting issue afterwards: its link must say "is blocked by" the blocker. Wrong way round: record it in the report for the user to remove (no operation deletes a link) and create the right one. A PR without its own issue: link the issue its branch or title names.
- A follow-up: link it to the run issue.

## Find an existing follow-up

`searchJiraIssuesUsingJql` with `project = <key> AND text ~ "<the follow-up's subject>" AND created >= -14d`.
