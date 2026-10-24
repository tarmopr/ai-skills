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

A reply that promises a change in another file or a later PR names a place you
have grepped first. On #159 a reply promised a README line the README already
had, and the correction took a second comment and an edit of the Done comment.

## Slack: review request

Short; Slack unfurls the PR and Jira links. Take `Size` from `gh pr view <n> --json changedFiles,additions,deletions` right before the post, never from memory: the message cannot be edited.

```markdown
:github-pr: **Review request:** <PR title> <pr url>
<1–2 sentences: what changes for a user.> <Jira: <issue url> | no Jira issue>
Size: <files> files, +<added> −<removed>. Needs: <n approvals | code owner approval | no approval, review welcome>.
```
