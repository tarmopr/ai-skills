# Jira

How the three skills do each tracker operation when the repo's tracker is Jira.
Every Jira call passes the config's `Site:` as `cloudId`. If an operation name
below is refused, `discover` it and use the name it returns.

MCP tool names depend on how a connector is installed. The Atlassian tools are
listed as `mcp__plugin_atlassian_atlassian__*`. A repo whose connector has
another name gets permission prompts. Record the name in `blockers.md` and
propose the allow line, as for any refused command.

## Auth

`atlassianUserInfo`: its `account_id` is the assignee for every Jira call.

With no `## Jira` in the config, call `getAccessibleAtlassianResources`. One Jira site: use its URL. Several: ask which one first, in its own `AskUserQuestion` call.

**Jira unavailable** (not connected, or the call fails): park "Jira unavailable: <exact error>" in the batch, continue with no Jira issue (the PR body carries the plan), and say so in the report. Never retry it through another route. **A Jira call that fails later in the run** gets the same rule; if the PR already exists, post its Plan section as a `gh pr comment`.

## Issue keys

Keep the issue key upper case (`feature/PROJ-123-export-notes`): the GitHub for Jira integration links the branch, its commits and its PR to the issue by that key.

Branch pattern: `<type>/<KEY-n>-<slug>`, the key upper case so GitHub for Jira links it.

## Integration

- **`github`:** GitHub for Jira links the branch, its commits and its PR to the issue by the key in the branch name and the PR title. No link call. If the PR does not show on the issue's Development panel, record a `Lesson:`; the "Merged" comment carries the PR link either way.
- **`azure-devops`:** nothing links a PR to a Jira issue. No remote link is made (no new `executeWrite` operation beyond `createJiraIssueLink`). The PR URL goes in the Merged comment.

Do not assume an integration closes the issue. You apply the done transition, only when the config's `Done means:` is met. If something sets it earlier, leave the status alone while reruns or fixes are still running, so it does not flip back and forth, and record a `Lesson:`: an integration now closes issues, and the config's `Notes:` need correcting.

## Find an issue

`searchJiraIssuesUsingJql` with `statusCategory != Done AND text ~ "<title words>"`, plus `AND project = <Project:>` when the config sets one. Up to 3, most relevant first.

## Read an issue

`getJiraIssue` with `view: "evidence"` (it includes linked issues), and its comments (`executeRead` with `listJiraIssueComments`; `discover` "list comments on a Jira issue" if that name is refused). Read the linked issues too.

## Where a new issue goes

Asked when a run has no Jira issue key: none in the argument, the plan, or a
branch this run started. Ask it **before continuing**, on its own, with one
`AskUserQuestion` call: the answer comes back in the same turn, so the skill's
pre-approval holds. Never create an issue in a project the user did not choose.

**Site first.** `cloudId` is the config's `Site:`. With no `## Jira` in the
config, call `getAccessibleAtlassianResources`. One Jira site: use its URL.
Several: ask which one first, in its own `AskUserQuestion` call.

**Then gather the options.** If an operation name below is refused, `discover`
it and use the name it returns.

- **Candidates:** `searchJiraIssuesUsingJql` with `statusCategory != Done AND text ~ "<title words>"`, plus `AND project = <Project:>` when the config sets one. Up to 3, most relevant first.
- **Projects:** the config's `Project:`, then `executeRead` with `listJiraProjects` and `action: "create"`, preferring the candidates' projects. Up to 4 in total.
- **Epics:** `searchJiraIssuesUsingJql` with `issuetype = Epic AND statusCategory != Done AND text ~ "<title words>"`, scoped to the default project (below) when there is one. Up to 3.

**The question.** Every question has 2 to 4 options, the recommended one first
and marked "(Recommended)", then the rest in the order given. "Other" is always
added by the tool and takes any key.

| # | Header | Question | Options |
|---|---|---|---|
| 1 | Issue | Which Jira issue tracks this work? | "Create a new issue"; the candidates as `<KEY>: <summary>`; under ship-plan only, "No Jira issue (the PR is the record)". Fill the 4 slots in that order: under ship-plan, at most 2 candidates. Recommend a candidate only if it clearly matches, else "Create a new issue". |
| 2 | Project | If a new issue: which project should it go in? | The **default project**: the config's `Project:`, else the project of the most relevant candidate, else the first listed. Then the other listed projects. |
| 3 | Epic | If a new issue: add it to an epic? (optional) | "No epic", then the epic candidates. With none found, the second option is "Type an epic key in Other". Recommend an epic only if it clearly matches. |
| 4 | Related | If a new issue: relate it to an existing issue? (optional) | "No related issue", then the issue candidates (an issue can be related to the new one without being the one that tracks the work). With none found, the second option is "Type an issue key in Other". |

Questions 2–4 begin "If a new issue" because they are ignored when 1 picks an
existing issue or "No Jira issue". Keep every question and answer in the
conversation until the run's ledger exists (ship-plan creates its ledger with
the branch), then write each as an `Asked:` line and a `Ruling: user <date>`.

**After the answer, for a new issue:**

1. Create the issue as "Create an issue" says, with `projectKey` from 2 and `parent: <epic key>` from 3. If the epic is rejected (another project, or the project has no epics), create the issue without it, record a `Lesson:`, and name the epic in the report.
2. If 4 named an issue: link the two as "Link two issues" says, with `linkType: "Relates"`, `inwardIssue: <new key>`, `outwardIssue: <related key>`.

**No `## Jira` in the config, and the run tracks an issue** (new or existing):
draft the section (config-drafting.md) with the `Site:` above and the issue's
project as `Project:`. Fill `Start transition:` and `Done transition:` from
`executeRead` `listJiraIssueTransitions` on the issue: the transition into the
first "indeterminate" status, and the one into a "done" status. This run uses
the draft; each value is a `Ruling:`. The draft goes in the question batch,
like any draft config, and once confirmed it is committed on the feature branch
(ship-plan: with the product change; ship-issue: with the spec). "No Jira
issue": no draft.

## Create an issue

`createJiraIssue`: `cloudId` from `Site:`, `projectKey` and `parent` (epic)
from "Where a new issue goes", `issueType` from `Issue type:`, `additional_fields` from `Fields:`, `assignee`
your account id, `description` in markdown. Set `priority` only if the plan
states one. If the create is rejected for a missing required field, do not
guess its value: park it in the batch, with the field the repair hint names.
Then `transitionJiraIssue` with `transitionName: <Start transition>`. Summary:
the outcome, not the task ("Notes can be exported as GeoJSON", not "Implement
export").

Create each issue in one call with the run issue's labels and the fields the config's `## Jira` names (for example Cross-Functional Team and Work Type), not afterwards.

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

Jira has no append: `editJiraIssue` replaces the whole description. Read it
with `getJiraIssue` and `responseContentFormat: "html"`, add the Plan section
above (as HTML) at the end, and write the full body back with `editJiraIssue`
and `contentFormat: "html"`. Never write it back as markdown: that drops media,
mentions and panels. If the HTML format is rejected, post the Plan section as a
comment instead. Never replace the user's text.

Add the `## Plan` section from "Create an issue", then `## Done when`, then `## Full plan` with the plan text.

**Too big for Jira.** A description or a comment holds at most 32,767 characters. When the existing description plus the three sections would exceed it (count the text you would write; leave 2,000 characters of headroom for Jira's own markup), the fallback is fixed:

- The description gets `## Plan` and `## Done when` only, then one line: `Full plan: in the comments "Full plan (1/<n>)" … "(<n>/<n>)"; the local file <plan path> is authoritative.`
- The plan text goes in `addOrEditJiraIssueComment` comments headed `Full plan (<i>/<n>)`, each under 30,000 characters. Split only between top-level sections or `### Task` headings, never inside a code block; a single section that is still too long is split between its steps.
- If even `## Plan` and `## Done when` do not fit, post them as a comment too, and leave the description as it is.
- **Never attach the plan as a file.** Attaching needs an `executeWrite` operation (`uploadAttachmentToJiraIssue`) that neither skill authorizes; the `executeWrite` pre-approval is for `createJiraIssueLink` only. Record the fallback as a `Ruling:` with the character counts.

**The local plan file is authoritative.** Jira's conversion of markdown can reflow lists, code and links. ship-plan always gets the file, never the issue text.

## Assign

`editJiraIssue` with the `assignee` set to your account id (from `atlassianUserInfo`).

## Set status

Transitions are named as on the issue's workflow buttons, not by the status
they lead to: "Start progress" may lead to "In Progress". Use only the transitions the config names.

- **Start transition:** `transitionJiraIssue` with `transitionName: <Start transition>`. Skip the transition if the issue is already in the status it leads to. Applied again after a revert, if the issue has left the start status, with the failure in a comment.
- **Review transition:** `transitionJiraIssue` with `transitionName: <Review transition>`, if the config names one. Absent: the issue stays in the start status.
- **Done transition:** `transitionJiraIssue` with `transitionName: <Done transition>`, **only when `Done means:` is met** (with CI None, Done means is "merged").

## Link the PR

None. The key in the branch name and the PR title links it on `github`; see Integration. On `azure-devops` the PR URL goes in the Merged comment.

## Comment

`addOrEditJiraIssueComment` with `cloudId` from `Site:`, the issue key and the comment in markdown.

## Link two issues

`executeWrite` with `createJiraIssueLink` and the inputs `{linkType, inwardIssue, outwardIssue}`; `type` is refused ("linkType: Required"). Both skills pre-approve `executeWrite` for this call. The pre-approval covers every operation `executeWrite` can run, so use it for `createJiraIssueLink` only; any other write operation is outside the skills' authorization. A refusal is recorded, not retried another way.

- Related issue: `linkType: "Relates"`, `inwardIssue: <new key>`, `outwardIssue: <related key>`.
- An answer that makes this issue wait for another issue or PR ("wait for #99", "after ORIG-8101 merges"): `linkType: "Blocks"`, the other issue as the blocker. A PR without its own issue: link the issue its branch or title names.
- A follow-up: link it to the run issue.

## Find an existing follow-up

**Before creating a follow-up issue,** whether this batch approved it or an earlier answer did (a `Ruling: user` line copied from `ship-issue`'s I3 batch), check that a reviewer has not filed it already. Read the PR's review bodies and comments (`gh pr view <n> --json reviews,comments`), and search the project with `searchJiraIssuesUsingJql` (`project = <key> AND text ~ "<the follow-up's subject>" AND created >= -14d`). When an issue already covers it, create nothing: name that issue in the Done comment's follow-ups, and record a `Ruling:` that quotes the line of it that covers the follow-up. ORIG-8340's approver filed ORIG-8361, which covered both follow-ups the I3 batch had approved; creating them as well would have split the work in two. Also grep `.claude/ship-plan/*.md` and `.claude/ship-issue/*.md` for the follow-up's subject: a log entry can name the issue when a Jira text search misses it (ORIG-8125 filed ORIG-8371 as a duplicate of ORIG-8346, which `interruptions.md` named, because ORIG-8346's summary says "fail once", not "flaky").
