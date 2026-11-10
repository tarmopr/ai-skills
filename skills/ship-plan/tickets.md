# Batch tickets

Read when the plan's header has a `Tickets:` line (pre-flight step 5), and in each later phase when the ledger has one. A run with a `Tickets:` line delivers several issues in one PR; each section below is one phase's part.

## Pre-flight

A plan that delivers several issues in one PR lists them in a `Tickets: <key>, <key>, …` line in its header, the run issue first; each plan task names the key it delivers in its heading (`### Task 2: … (ENG-124)`). Read each other issue with the tracker's *Read an issue*. A key that does not resolve, or an issue already in a done status category, is parked with what was found, and the run goes on without it. Record `Tickets: <keys>` in the ledger, the run issue left out. With no run issue (`Tracker: none`, "No issue", the tracker unavailable) the line is ignored, and the report says so. Never take keys from anywhere else: not from the parent's other sub-tasks, linked issues, labels or commit subjects.

## Start

Each `Tickets:` issue starts when the run issue does (section 1): the tracker's *Assign*, then *Set status* to the start status, skipped when it is already there. Its description is not touched; the run issue carries the plan. A refused assignment or transition (a required field missing, a workflow that does not offer it) is parked with its exact error and does not stop the run.

## Before the merge

Right before the merge (section 5, step 4): for each listed key, count the PR's commits whose subject carries it, `git log --format=%s origin/<base>..HEAD` after step 2's fetch, and write `Commits: <key> <n>, …` in the ledger. Section 7, step 1 reads it.

## Close-out

At section 7, step 1. Each `Tickets:` issue gets the done status with the run issue, and only when all of these hold: the run issue got it; every plan task whose heading names its key is committed, none parked, skipped or left `[needs a decision]`; and the ledger's `Commits:` line counts at least one commit for it. Then "Issue comment: done (batch ticket)" and the tracker's *Set status* to the done status. Otherwise "Issue comment: not done (batch ticket)", naming what is missing; its status stays, and it goes in the batch. Under every other outcome, each `Tickets:` issue gets the run issue's comment for that outcome, and its status stays.

## Templates

### Issue comment: done (batch ticket)

On each issue of the plan's `Tickets:` line that gets the done status with the run issue.

```markdown
**Done** with <run issue key>, in <PR link> (merge `<sha>`): <n> commit(s) carry this key. <Base-branch CI run [<id>](<url>) is green. | Base branch has no CI.>
```

### Issue comment: not done (batch ticket)

On each issue of the plan's `Tickets:` line that does not get the done status although the run issue does.

```markdown
**Not done.** <run issue key> merged in <PR link>, but this issue's part is not in it: <tasks parked or skipped, or "no commit carries this key">. It stays in its status.
```
