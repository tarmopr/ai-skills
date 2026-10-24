# S5: No config, GitHub remote

A repo that has never run the skills. The run drafts the config, decides the
host from the remote, and asks once which tracker the repo uses.

## Prompt

You are running the `ship-plan` skill. Its files are in SKILLDIR/ship-plan/
(SKILL.md and the files it links), and the skills it calls are in
SKILLDIR/verify-and-fix/ and SKILLDIR/ship-issue/. Read SKILLDIR/ship-plan/SKILL.md
and every file it links that matters for this run.

**The repo:** `acme/notes-web` on github.com. `git remote get-url origin`
prints `git@github.com:acme/notes-web.git`. The checkout is on `main`, clean.
There is no `.claude/ship-plan.md`, no `.claude/ship.md`, no
`.claude/ship-plan.local.md`, and no `.claude/ship-plan/` folder.

`.github/workflows/ci.yml`:

```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: make setup
      - run: make lint
      - run: make test
```

`gh repo view --json squashMergeAllowed,mergeCommitAllowed` answers
`{"squashMergeAllowed": true, "mergeCommitAllowed": true}`.

**The invocation:** `/ship-plan docs/superpowers/plans/2026-10-22-notes-export.md`.
The plan names no issue key anywhere, and the branch is not one this run
started.

Answer, in order:

1. Which files under SKILLDIR do you read in pre-flight, in order?
2. Write out the full draft `.claude/ship-plan.md` you produce, exactly.
   Where does each line come from?
3. List every question you ask the user in pre-flight, in the order you ask
   them, each with its exact text and options, and say which ones you wait
   for before going on.
4. How many times is the tracker question asked in this run? Is the host ever
   asked?
5. The user answers the tracker question with the option for no tracker.
   What changes in the draft, and what happens to the issue question?
6. Instead, the user answers "Jira". What happens next, up to the point where
   the run has an issue (or none)? Which further files do you read?
7. When is the draft committed, on which branch, and with what commit
   message?

## Pass if

- `ship-plan/config-drafting.md` is read.
- The draft has `Host: github` under `## Repo`, with the remote as its source.
- The host is never asked.
- The tracker question is asked exactly once in the run, as "Which tracker
  does this repo use?", with the options Jira, Linear and "No tracker (the PR
  is the record)", and the run waits for its answer.
- Answer 5: the draft gets `Tracker: none`, no question about a Jira or
  Linear issue follows, and no file under `ship-plan/trackers/` is read (the
  PR is the record).
- Answer 6: the draft gets `Tracker: jira`, and `ship-plan/trackers/jira.md`
  is read; `ship-plan/trackers/linear.md` is not.
