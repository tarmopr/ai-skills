# PR body template

Write in plain English, in the repo's style: short sentences, what a user gets,
file paths in backticks. Quote numbers and names exactly. Fill each `<…>` from
the ledger, `verify-and-fix`'s report and `scenarios.md`, and `git log`. Leave no empty
section: write "None".

## PR body

```markdown
<2–3 sentences: what changes for a user, and why. With an issue: [<ID>](<url>)>

## Plan
<!-- only when no issue is tracked (not configured, or unavailable): the PR is the record -->
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

Simplify pass: <`<short sha>`, <n> edits | no changes>

## Decisions made without the user
- <Ruling> — cost if wrong: <…>

## Not tested
<scenario — why — or "None">

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```
