# Issue templates

Read when a run asks the tracker question or the issue question, or writes to the issue: the new issue's text, the appended plan, and the comments. The tracker's own file says how each is sent.

## Which tracker does this repo use?

Asked when the config has no `Tracker:` and none can be resolved. Ask it **before the issue question**, on its own, with one `AskUserQuestion` call. Options, the recommended one first and marked "(Recommended)": "Jira"; "Linear"; under ship-plan only, "No tracker (the PR is the record)". Recommend the one whose integration the session has (the tracker's *Integration*) when only one is available. "Other" is always added by the tool. Under ship-issue there is no "No tracker" option: the run needs an issue.

The answer is a `Ruling: user <date>`. It is written as `Tracker: jira`, `linear` or `none` into the drafted config (config-drafting.md), never into an existing one.

## Issue question

Asked when a run has no issue key: none in the argument, the plan, or a
branch this run started. Ask it **before continuing**, on its own, with one
`AskUserQuestion` call: the answer comes back in the same turn, so the skill's
pre-approval holds. Never create an issue where the user did not choose.

**Gather the options** as the tracker's *Find an issue* and *Where a new issue goes* say: up to 3 candidate issues, and the places a new issue can go (Jira: project and epic; Linear: team and project).

**The question.** Every question has 2 to 4 options, the recommended one first
and marked "(Recommended)", then the rest in the order given. "Other" is always
added by the tool and takes any key.

| # | Header | Question | Options |
|---|---|---|---|
| 1 | Issue | Which issue tracks this work? | "Create a new issue"; the candidates as `<KEY>: <summary>`; under ship-plan only, "No issue (the PR is the record)". Fill the 4 slots in that order: under ship-plan, at most 2 candidates. Recommend a candidate only if it clearly matches, else "Create a new issue". |
| 2–3 | Where it goes | If a new issue: where should it go? | The places the tracker's *Where a new issue goes* defines, one question per place, in its order. The tracker file decides which of these rows it asks. The **default** comes first: the config's value, else that of the most relevant candidate, else the first listed. |
| 4 | Related | If a new issue: relate it to an existing issue? (optional) | "No related issue", then the issue candidates (an issue can be related to the new one without being the one that tracks the work). With none found, the second option is "Type an issue key in Other". |

Questions 2–4 begin "If a new issue" because they are ignored when 1 picks an
existing issue or "No issue". Keep every question and answer in the
conversation until the run's ledger exists (ship-plan creates its ledger with
the branch), then write each as an `Asked:` line and a `Ruling: user <date>`.

**After the answer, for a new issue:**

1. Create the issue as the tracker's *Create an issue* says, with the place from 2–3. If the tracker rejects an optional place (for example an epic from another project), create the issue without it, record a `Lesson:`, and name it in the report.
2. If 4 named an issue: link the two as the tracker's *Link two issues* says. A refusal is recorded, not retried another way.

## New issue

Fields: the place from "Issue question"; the issue type and fields from the
config; assign it to the user; set a priority only if the plan states one. If
the create is rejected for a missing required field, do not guess its value:
park it in the batch, with the field the error names. Then set the start
status as the tracker's *Set status* says. Title: the outcome, not the task
("Notes can be exported as GeoJSON", not "Implement export").

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

## Plan appended

Add the Plan section above at the end of the issue's text, as the tracker's *Append the plan* says. Never replace the user's text.

## Issue comment: merged

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
Simplify pass: <`<short sha>`, <n> edits | no changes>. <n> review rounds. Fixed: <count and one line each, with commits>. Rulings: <list or "None">.
```

## Issue comment: done

```markdown
**Done.** <Base-branch CI run [<id>](<url>) is green. | Base branch has no CI; `verify-and-fix` was clean and is the gate.>

- After-merge checks: <results, or "None configured">.
- Pending: <scenarios and what they need, or "None">.
- Follow-ups: <suggestions not done, anything outside the diff, with new issue keys if created, or "None">.
```

## Issue comment: base branch red

```markdown
**Merged, but the base branch is red.** Run [<id>](<url>) failed at `<job> → <step>`: `<error line>`.
Tried: <reruns / fix PRs / revert, with links>. State of deployments the base branch triggers: <half-updated? which steps are live>.
Needs: <the question from the batch>. Status stays as it is; no done transition.
```

## Issue comment: not merged

```markdown
**Not merged.** PR [#<n>](<pr url>) is open because <the reason, as in "PR comment: not merged">.
Done so far: <implemented tasks, gates that passed>.
Needs: <the question from the batch>. Status stays as it is; no done transition.
```

## Issue comment: review round

```markdown
**Review round <round>** on [#<pr>](<pr url>): <count> comments from <reviewers>.

| Comment | Grade | Result |
|---|---|---|
| <author>: <one line> | <grade> | Fixed in `<short sha>` / answered / follow-up / needs a decision |

Checks: <green / running>. Approval: <approved / waiting for <who or "code owners">>.
```

## Issue comment: awaiting review

```markdown
**Awaiting review.** PR [#<n>](<pr url>) is green, and every comment so far is handled (<rounds> review rounds). It needs <an approval from someone other than the author | a code owner's approval | <reviewer> to resolve their thread | a decision: <question>>.
Resume with `/ship-plan` in the checkout that holds the branch, or `/loop 30m /ship-plan` to keep checking.
```
