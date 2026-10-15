# Seed content for the repo's ship-issue log

`ship-issue` creates `.claude/ship-issue/interruptions.md` in the repo the
first time a run has something to write and the file is missing. It is
committed through ship-plan's lessons PR: ship-plan's section 8 writes it when the
plan carries a `From ship-issue` block.

Tooling blockers do not go here: they go in `.claude/ship-plan/blockers.md`.
Research techniques for the repo go in the config's `## Evidence`.

## interruptions.md seed

````markdown
# Interruptions and standing answers (ship-issue)

Every question a ship-issue run asked the user, and every ruling the user
overturned. **Read this before I0.** A question with a standing answer here, or
in `.claude/ship-plan/interruptions.md`, is not asked again: apply the answer
and record `Ruling: standing answer <entry title>`.

Entry format:

```markdown
### <the question, short>
- **Asked:** <date>, <phase I0–I6>, <exact question>
- **Why I could not decide:** <which part of the confidence test failed>
- **Answer:** <the user's answer, verbatim if short>
- **Standing answer:** <the rule the next run applies without asking, or "ask each time", with the reason>
- **Could the batch have caught it?** <which I2 research step would have predicted the question; the fix becomes a change to I2 or to `## Evidence`>
- **Status:** open / standing / promoted to SKILL.md (<section>)
```

An overturned ruling uses the same format, with **Ruled:** in place of
**Asked:**.
````
