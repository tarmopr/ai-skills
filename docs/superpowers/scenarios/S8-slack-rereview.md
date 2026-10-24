# S8: Slack re-review reply and merged reaction, across a resume

A review round addressed comments from two people, one with a known Slack
user and one without. The run then loses its context, resumes, and merges.

## Prompt

You are running the `ship-plan` skill. Its files are in SKILLDIR/ship-plan/
(SKILL.md and the files it links), and the skills it calls are in
SKILLDIR/verify-and-fix/ and SKILLDIR/ship-issue/. Read SKILLDIR/ship-plan/SKILL.md
and every file it links that matters for this run.

**The repo:** `acme/billing-api` on github.com. `git remote get-url origin`
prints `git@github.com:acme/billing-api.git`. You are `dana-dev`, the PR's
author. Its `.claude/ship-plan.md`:

```markdown
# Ship config

## Repo
- Base branch: main
- Merge: squash

## Gates
| Gate | Command | Only when changed | Timeout |
|---|---|---|---|
| Tests | make test | | |

## CI
- Workflow: ci.yml

## Jira
- Site: https://acme.atlassian.net
- Project: BILL
- Start transition: Start progress
- Done transition: Done

## Slack
- Channel: #billing-reviews (C0BILL123)
- People:

| Login | Slack user |
|---|---|
| alice | U0ALICE01 |
```

**Where the run stands:** section 4R, step 3. The ledger at
`.superpowers/ship-plan/feature-BILL-440-credit-notes/ledger.md` reads:

```
Phase: 4R | Plan: docs/superpowers/plans/2026-10-22-BILL-440-credit-notes.md | Issue: BILL-440 | PR: #63 | merge: | base run:
Review rule: approvals 1 | code owners no | stale dismissed yes | threads must be resolved no | source ruleset
Slack: posted 1729771234.000100
```

PR #63 is `https://github.com/acme/billing-api/pull/63`, "Credit notes
(BILL-440)". The review request was posted to C0BILL123 with `ts`
`1729771234.000100`.

`verify-and-fix --comments` has just finished round 1 of this PR's review: it
fixed `alice`'s inline thread (commit `e1f2a3b`), answered `bob`'s review
body as "not valid" with quoted evidence, fixed Copilot's inline thread, ran
the gates, pushed, and replied to all three. `bob` has no display name and no
public email on GitHub. `slack_search_users` finds nobody for `bob`.

**Part A.** Answer, in order:

1. Which files under SKILLDIR do you read for this part, in order?
2. After the round: every Slack tool call, with every parameter, including the
   full message text.
3. Who is named in it, and how is each person written? Who is left out, and
   why?
4. Every line you add to the ledger for this, exactly.

**Part B.** The session's context is compacted right after the lines from
answer 4 were written. The user types `/ship-plan`. Assume the ledger holds
exactly the lines from answer 4, below the three lines shown above. The poll
shows no new comment; `alice` has approved; Copilot reviewed the last push
with no comments; the checks are green.

5. What do you do about Slack now? Every call, or "none" and why.
6. Merge: the PR merges as `4b3a2918f7e6d5c4b3a2918f7e6d5c4b3a2918f7`.
   Right after the merge, every Slack call with every parameter, and the
   ledger line.
7. The user types `/ship-plan` once more before close-out finishes (the
   ledger now holds the line from answer 6). Any Slack call?

## Pass if

- Part A: exactly one `slack_send_message`, to channel `C0BILL123` with
  `thread_ts: 1729771234.000100`. Its text mentions alice as `<@U0ALICE01>`
  and bob as plain "bob", and names neither Copilot nor `dana-dev`.
- `slack_search_users` is called for `bob`, not for `alice` (who is in
  `People:`).
- A `Lesson:` line records that bob's Slack user was not found.
- The ledger gets one `Slack: re-review …` line naming alice and bob, once.
- Part B, answer 5: no Slack message is posted (no second re-review reply).
- Answer 6: exactly one `slack_add_reaction`, name `pr-merged`, on channel
  `C0BILL123` and timestamp `1729771234.000100`, recorded as
  `Slack: merged reaction`.
- Answer 7: no Slack call.
