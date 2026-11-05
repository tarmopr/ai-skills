# ship-queue SKILL.md: rationale

Incidents and reasons moved out of skills/ship-queue/SKILL.md to keep it short. Read when changing a rule, not when running the skill.

## The ledger

- "A ship-plan ledger that exists means "resume" to ship-plan, and a line written there by another skill would be read as that run's own." (Why the queue never writes a ship-issue or ship-plan ledger.)
- "A queue of a dozen sub-issues runs a dozen full ship-issue runs; several compactions are expected." (Why resume reads the ledger, not memory.)

## Q0. Pre-flight

- "The user has just invoked the skill and is probably still there. Everything that would stop every sub-issue is found now."
- Step 2: "The tracker's *List sub-issues* says so for GitHub Issues."
- Step 3: an auth failure stops the queue because "no sub-issue could run."
- Step 4: "A sub-issue's run takes hours and writes only its own ledgers, so the queue ledger's age alone does not show it." (Why the live check also reads the open sub-issue's ship-issue and ship-plan ledgers.)
- Step 7: no comment on someone else's sub-issue because "it is someone else's issue, and the summary names it."
- Step 9: permissions are listed at pre-flight because "They go in the user's settings, so they are asked once, here."

## Q1. Order

- Touching the same files or feature is not a dependency: "serial order already handles conflicts."

## Q2. The loop

- Base branch red: "every later PR would fail on the same red base, and ship-plan never merges red."
- Cut off: "a usage limit applies to every child, so the next one would be cut off too."

## Q4. Summary

- `Summary: posted <time>`: "a later run reads it as "this queue has ended" (Q0 step 4)."
- The handoff when the queue is not done: "so the next session finds the queue."

## Child sessions

- Incident: "one queue session carried five full runs through seven compactions, and every turn re-read all of it." (Why each run starts in its own headless session.)
- "Keep every flag, `--output-format json` above all: without it the file holds plain text and the `Cost:` line cannot be written."
- "The prompt comes from the file on stdin (`<`)."
- On waiting: "the harness wakes this session when the child exits. A child runs for hours."

## Resume and session end

- "The queued ship-issue and ship-plan runs write none of their own." (handoffs)
- Answers for a key with no pending question cover cases such as "already done before the queue, not in the queue, not a sub-issue"; they are never passed on because "a run that is done is never resumed with answers it did not ask for."

## Runner or session

- "With no flag the argument is read exactly as if this section did not exist."

## Red flags

- Child session row: "Each sub-issue runs in a child session (*Child sessions*), so this session stays small."
