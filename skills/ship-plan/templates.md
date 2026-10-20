# PR and Jira templates

Write in plain English, in the repo's style: short sentences, what a user gets,
file paths in backticks. Quote numbers and names exactly. Fill each `<…>` from
the ledger, `verify-and-fix`'s report and `scenarios.md`, and `git log`. Leave no empty
section: write "None".

## PR body

```markdown
<2–3 sentences: what changes for a user, and why. With an issue: [<ID>](<url>)>

## Plan
<!-- only when no Jira issue is tracked (not configured, or unavailable): the PR is the record -->
Source: `<plan path>` · Spec: `<spec path, or "none">`

<Architecture, 2–4 sentences>

- [x] Task 1 — <title>
- [ ] Task 2 — <title> (not done: <why>)

## What changed
- <file or area>: <what, and why it was needed>

## How it was verified
| Gate | Result |
|---|---|
| <gate name as the config names it> | pass / fail / skipped / not run (reason) |

Scenarios (<n> run, <n> passed): <one line each, or "None: no UI testing configured">

## Decisions made without the user
- <Ruling> — cost if wrong: <…>

## Not tested
<scenario — why — or "None">

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

## PR comment: done

Without Jira, at close-out once base-branch CI is green.

```markdown
**Done.** <Base-branch CI run [<id>](<url>) is green. | Base branch has no CI; `verify-and-fix` was clean and is the gate. | No base-branch run for `<short sha>`; `verify-and-fix` was clean.> Merged as `<short sha>`.

- After-merge checks: <results, or "None configured">.
- Pending: <scenarios and what they need, or "None">.
- Follow-ups: <suggestions not done, anything outside the diff, or "None">.
- Decisions made without the user: see the PR body.
```

## PR comment: not merged

Without Jira, when the run ends with the PR still open: `verify-and-fix` not clean,
checks never registered, the base branch still red, a merge refused, or 5
review rounds. (Waiting on reviewers is "awaiting review": no PR comment.)

```markdown
**Not merged.** The PR is open because <verify is not clean: <reason> | checks never reported | its only red check is inherited from the base branch (run [<id>](<url>)) | the merge was refused: <exact error> | review is still open after 5 rounds>.
Done so far: <implemented tasks, gates that passed>.
Needs: <the question from the batch>.
```

## Review reply

One reply per PR review item (`verify-and-fix` section 4b). Short, in plain
words, quoting code where it settles the point. Fixed replies name the commit.

| Grade | Reply |
|---|---|
| Fixed | `Fixed in <short sha>: <what changed, one line>. Test: <test name>.` |
| Suggestion, out of scope | `Agreed, but outside this PR's scope. Noted as a follow-up<: <KEY-n> comment>.` |
| Follow-up while approved | `Good point. The PR is approved, and a push now would dismiss that approval, so I've noted it as a follow-up<: <KEY-n> comment>.` |
| Question | `<the answer>, see <path:line>: <quoted line>.` |
| Not valid | `I don't think this applies: <path:line> <quoted code> <why>. Happy to change it if I've missed something.` |
| Needs the user | `This needs a decision from the author: <the question>. I've raised it with them.` |

## PR comment: base branch red

Without Jira, when the run ends with the base branch red.

```markdown
**Merged, but the base branch is red.** Run [<id>](<url>) failed at `<job> → <step>`: `<error line>`.
Tried: <reruns / fix PRs / revert, with links>. State of deployments the base branch triggers: <half-updated? which steps are live>.
Needs: <the question from the batch>. The work is not done.
```

## Jira: issue question

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

1. `createJiraIssue` as "Jira: new issue" says, with `projectKey` from 2 and `parent: <epic key>` from 3. If the epic is rejected (another project, or the project has no epics), create the issue without it, record a `Lesson:`, and name the epic in the report.
2. If 4 named an issue: `executeWrite` with `createJiraIssueLink`, `linkType: "Relates"`, `inwardIssue: <new key>`, `outwardIssue: <related key>`. Both skills pre-approve `executeWrite` for this call. The pre-approval covers every operation `executeWrite` can run, so use it for `createJiraIssueLink` only; any other write operation is outside the skills' authorization. A refusal is recorded, not retried another way.

**No `## Jira` in the config, and the run tracks an issue** (new or existing):
draft the section (config-format.md) with the `Site:` above and the issue's
project as `Project:`. Fill `Start transition:` and `Done transition:` from
`executeRead` `listJiraIssueTransitions` on the issue: the transition into the
first "indeterminate" status, and the one into a "done" status. This run uses
the draft; each value is a `Ruling:`. The draft goes in the question batch,
like any draft config, and once confirmed it is committed on the feature branch
(ship-plan: with the product change; ship-issue: with the spec). "No Jira
issue": no draft.

## Jira: new issue

`createJiraIssue`: `cloudId` from `Site:`, `projectKey` and `parent` (epic)
from "Jira: issue question", `issueType` from `Issue type:`, `additional_fields` from `Fields:`, `assignee`
your account id, `description` in markdown. Set `priority` only if the plan
states one. If the create is rejected for a missing required field, do not
guess its value: park it in the batch, with the field the repair hint names.
Then `transitionJiraIssue` with `transitionName: <Start transition>`. Summary:
the outcome, not the task ("Notes can be exported as GeoJSON", not "Implement
export").

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

## Jira: plan appended

Jira has no append: `editJiraIssue` replaces the whole description. Read it
with `getJiraIssue` and `responseContentFormat: "html"`, add the Plan section
above (as HTML) at the end, and write the full body back with `editJiraIssue`
and `contentFormat: "html"`. Never write it back as markdown: that drops media,
mentions and panels. If the HTML format is rejected, post the Plan section as a
comment instead. Never replace the user's text.

A description or a comment holds at most 32,767 characters. When the appended
text would exceed it, follow ship-issue's I5 "Too big for Jira": comments headed
`Full plan (<i>/<n>)`, never a file attachment.

## Jira comment: merged

```markdown
**Merged** in [#<n>](<pr url>) (`<short sha>`). <Base-branch CI is running; done follows when it is green. | Base branch has no CI; done follows at close-out.>

### What was implemented
- <per plan task: what now happens, the main files>

### Test scenarios
| # | Role | Scenario | Where | Result |
|---|---|---|---|---|
| 1 | <role> | <steps in one line> | local / pending | Pass / Fail / Not run |

Automated: <new or changed tests, with file paths>.
Gates: <from verify's gate table: all pass / exceptions>.

### Review
<n> review rounds. Fixed: <count and one line each, with commits>. Rulings: <list or "None">.
```

## Jira comment: done

```markdown
**Done.** <Base-branch CI run [<id>](<url>) is green. | Base branch has no CI; `verify-and-fix` was clean and is the gate.>

- After-merge checks: <results, or "None configured">.
- Pending: <scenarios and what they need, or "None">.
- Follow-ups: <suggestions not done, anything outside the diff, with new issue keys if created, or "None">.
```

## Jira comment: base branch red

```markdown
**Merged, but the base branch is red.** Run [<id>](<url>) failed at `<job> → <step>`: `<error line>`.
Tried: <reruns / fix PRs / revert, with links>. State of deployments the base branch triggers: <half-updated? which steps are live>.
Needs: <the question from the batch>. Status stays as it is; no done transition.
```

## Jira comment: not merged

```markdown
**Not merged.** PR [#<n>](<pr url>) is open because <the reason, as in "PR comment: not merged">.
Done so far: <implemented tasks, gates that passed>.
Needs: <the question from the batch>. Status stays as it is; no done transition.
```

## Jira comment: review round

```markdown
**Review round <round>** on [#<pr>](<pr url>): <count> comments from <reviewers>.

| Comment | Grade | Result |
|---|---|---|
| <author>: <one line> | <grade> | Fixed in `<short sha>` / answered / follow-up / needs a decision |

Checks: <green / running>. Approval: <approved / waiting for <who or "code owners">>.
```

## Jira comment: awaiting review

```markdown
**Awaiting review.** PR [#<n>](<pr url>) is green, and every comment so far is handled (<rounds> review rounds). It needs <an approval from someone other than the author | a code owner's approval | <reviewer> to resolve their thread | a decision: <question>>.
Resume with `/ship-plan` in the checkout that holds the branch, or `/loop 30m /ship-plan` to keep checking.
```

## Slack: review request

Short; Slack unfurls the PR and Jira links.

```markdown
**Review request:** <PR title> <pr url>
<1–2 sentences: what changes for a user.> <Jira: <issue url> | no Jira issue>
Size: <files> files, +<added> −<removed>. Needs: <n approvals | code owner approval | no approval, review welcome>.
```
