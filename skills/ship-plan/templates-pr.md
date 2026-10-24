# PR comment templates

Read when posting a comment on the PR. The PR body and the other templates are in [templates.md](templates.md).

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

## PR comment: base branch red

Without Jira, when the run ends with the base branch red.

```markdown
**Merged, but the base branch is red.** Run [<id>](<url>) failed at `<job> → <step>`: `<error line>`.
Tried: <reruns / fix PRs / revert, with links>. State of deployments the base branch triggers: <half-updated? which steps are live>.
Needs: <the question from the batch>. The work is not done.
```
