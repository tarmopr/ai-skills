# ship-issue SKILL.md: rationale

Incidents and reasons moved out of skills/ship-issue/SKILL.md to keep it short. Read when changing a rule, not when running the skill.

The skill held no dated incidents or incident tags; what moved here are reasons that sat beside rules. Each rule itself stays in the skill.

## I6. Hand off

Why `--session` is always passed: "this run already is a session-mode run, or a runner child, so it never hands over to a new runner midway, whatever `## Runner` `Mode:` says."

## Queued mode (ship-queue)

On who waits for a queued run: "The queue started this run and waits for it to end; nobody is watching it."

Why the batch comment's answer line names the queue: "so the user's answers resume the queue, not this run alone; the queue's resume form is `/ship-queue <parent> <KEY>: <answers>`."

Why I0's live-run row skips this issue's ledgers in the queue ledger's `Checkout:`: "the queue that names it in `Current:` is this run's parent session, which started this child after its own Q0 step 4 checked that no other session holds the queue, and whose earlier child of this sub-issue (a cut-off run being resumed) has ended."

## Runner mode (ship-runner)

Why `Asked:` lines carry the question, options and recommendation: "The runner's `status` prints them as they are, and the watching session asks from them."

Where answers come from: "answers come only from the user, through the watching session".

Why the guarded files are never changed: "the runner compares them before and after every child, and a change sends the user a warning to review it (the run goes on, and later children load the change)."

## Red flags

Row "I'll start ship-plan's ledger for it": "Never. An existing ship-plan ledger means "resume", and the plan path would be read as answers." (The rule and reason stay in "The ledger".)

Row "Quicker to write the spec or plan here": "The stages run as subagents so this session stays small and keeps one effort level. Dispatch them."
