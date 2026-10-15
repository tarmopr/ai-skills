# PR and Linear templates

Write in plain English, in the repo's style: short sentences, what a user gets,
file paths in backticks. Quote numbers and names exactly. Fill each `<…>` from
the ledger, `verify`'s report and `scenarios.md`, and `git log`. Leave no empty
section: write "None".

## PR body

```markdown
<2–3 sentences: what changes for a user, and why. With an issue: [<ID>](<url>)>

## Plan
<!-- only when no Linear issue is tracked (not configured, or unavailable): the PR is the record -->
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

Without Linear, at close-out once base-branch CI is green.

```markdown
**Done.** <Base-branch CI run [<id>](<url>) is green. | Base branch has no CI; `verify` was clean and is the gate. | No base-branch run for `<short sha>`; `verify` was clean.> Merged as `<short sha>`.

- After-merge checks: <results, or "None configured">.
- Pending: <scenarios and what they need, or "None">.
- Follow-ups: <suggestions not done, anything outside the diff, or "None">.
- Decisions made without the user: see the PR body.
```

## PR comment: not merged

Without Linear, when the run ends with the PR still open: `verify` not clean,
checks never registered, the base branch still red, a merge refused, or an
approval required.

```markdown
**Not merged.** The PR is open because <verify is not clean: <reason> | checks never reported | its only red check is inherited from the base branch (run [<id>](<url>)) | the merge was refused: <exact error> | it needs an approving review>.
Done so far: <implemented tasks, gates that passed>.
Needs: <the question from the batch>.
```

## PR comment: base branch red

Without Linear, when the run ends with the base branch red.

```markdown
**Merged, but the base branch is red.** Run [<id>](<url>) failed at `<job> → <step>`: `<error line>`.
Tried: <reruns / fix PRs / revert, with links>. State of deployments the base branch triggers: <half-updated? which steps are live>.
Needs: <the question from the batch>. The work is not done.
```

## Linear: new issue

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

## Linear: plan appended

`save_issue` with `patch: [{op: "append", text: "\n\n## Plan\n\n…"}]`. Use
the same Plan section as above. Never replace the user's text.

## Linear comment: merged

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

## Linear comment: done

```markdown
**Done.** <Base-branch CI run [<id>](<url>) is green. | Base branch has no CI; `verify` was clean and is the gate.>

- After-merge checks: <results, or "None configured">.
- Pending: <scenarios and what they need, or "None">.
- Follow-ups: <suggestions not done, anything outside the diff, with new issue ids if created, or "None">.
```

## Linear comment: base branch red

```markdown
**Merged, but the base branch is red.** Run [<id>](<url>) failed at `<job> → <step>`: `<error line>`.
Tried: <reruns / fix PRs / revert, with links>. State of deployments the base branch triggers: <half-updated? which steps are live>.
Needs: <the question from the batch>. Status stays <Start status>.
```

## Linear comment: not merged

```markdown
**Not merged.** PR [#<n>](<pr url>) is open because <the reason, as in "PR comment: not merged">.
Done so far: <implemented tasks, gates that passed>.
Needs: <the question from the batch>. Status stays <Start status>.
```
