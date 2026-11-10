# Runner child

Read by ship-plan, ship-issue and verify-and-fix when the ship runner started
this session as a child. The skill's own `modes.md` adds its rules; where the
two differ, the skill's file wins.

## Is this a runner child

`printenv SHIP_RUNNER` prints the runner's folder, `printenv SHIP_RUNNER_KEY`
prints the item key the runner gave this child, and that folder's `state.json`
has `current` equal to that key. Take the key from `SHIP_RUNNER_KEY`; never
derive it from a ledger, a plan's file name or a branch. `SHIP_RUNNER` without
`SHIP_RUNNER_KEY`, or a `state.json` naming another item or none: no runner
child, ignore this file. The runner's prompt names the phase. Nobody is watching.

## Questions and answers

- **Ask nothing: never `AskUserQuestion`, never wait for a reply.** Write each question to the ledger as `Asked: <the question, its options, the recommendation first> — pending`; the runner's `status` prints these lines as they are and the watching session asks from them. Post the batch as one numbered comment where the skill's `modes.md` says, ending with **"Answer in the session that started the run."** An outward-facing or destructive action is such a question, with its exact command; never run it. Carry on with everything the answers do not block.
- **Answers** come in a later runner prompt, after "The user's answers, copied exactly:". Rewrite each answered `Asked: … — pending` line in place with its answer, never as a second line: the runner counts the lines still ending in `— pending`.

## Ledger lines

- `Progress: <text>` at each milestone the skill's `modes.md` lists.
- `Blocked: <reason>` when nothing in the phase can go on and no question waits for the user.

## Never touch what the runner guards

No `answers-*` file (answers come only from the user, through the watching
session). Never change `.claude/settings.json`, `.claude/settings.local.json`,
`.mcp.json`, anything under `.claude/hooks/`, `.claude/agents/`,
`.claude/commands/` or `.claude/skills/`, a `CLAUDE.md` or `CLAUDE.local.md`, or
a script a settings hook names. The runner compares them around every child and
warns the user of a change. Work that needs one changed: write
`Blocked: <the change needed>` for the user to make and review.

## The final line

The final reply ends with exactly one line, nothing after it:
`RUNNER: <phase-done|waiting|blocked|done> <text>`.

- `phase-done`: the ledger's first line moved to the next phase;
- `waiting`: an `Asked: … — pending` line waits for the user;
- `blocked`: with the `Blocked:` line's reason;
- `done`: as the skill's `modes.md` says.
