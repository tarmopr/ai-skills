# Seed content for the repo's log files

`ship-plan` and `verify-and-fix` create these in the repo, under `.claude/ship-plan/`, the first
time a run has something to write and the file is missing. They are committed
through `ship-plan`'s lessons PR.

## interruptions.md seed

````markdown
# Interruptions and standing answers

Every question a ship run asked the user, and every ruling the user
overturned. **Read this before pre-flight.** A question with a standing answer
here is not asked again: apply the answer and record
`Ruling: standing answer <entry title>`.

Tooling blockers do not go here. They go in [blockers.md](blockers.md).

Entry format:

```markdown
### <the question, short>
- **Asked:** <date>, <phase>, <exact question>
- **Why I could not decide:** <which part of the confidence test failed>
- **Answer:** <the user's answer, verbatim if short>
- **Standing answer:** <the rule the next run applies without asking, or "ask each time", with the reason>
- **Status:** open / standing / promoted to SKILL.md (<section>)
```

An overturned ruling uses the same format, with **Ruled:** in place of
**Asked:** and **Corrected to:** in place of **Answer:**.

## Standing answers

### Should I push, open the PR, merge, or rerun CI?
- **Answer:** yes, without asking. Push and PR once `verify-and-fix` is clean, merge once every check is green, rerun transient failures, and fix the base branch forward.
- **Status:** promoted to SKILL.md (authorization section)

### What should branches be called?
- **Answer:** `<type>/<slug>`, or `<type>/<id>-<slug>` with an issue; type one of feature, fix, docs, chore, refactor. The Jira key stays upper case. Never a username prefix.
- **Status:** promoted to SKILL.md (section 1)

### Can the agent edit settings or `allowed-tools`?
- **Answer:** never. Write commands in the pre-approved form. If one is refused anyway, put the exact `allowed-tools` line in the batch for the user to add.
- **Status:** promoted to SKILL.md (authorization section)

## Entries
````

## blockers.md seed

```markdown
# Known blockers

Read in full before the first round. Each entry: the symptom with the exact
error, the cause, the fix as an exact command, and the date. Correct a wrong
entry rather than adding a second.

## Gates and local environment

## CI

## UI
```
