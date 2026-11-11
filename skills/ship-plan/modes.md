# ship-plan: queued and runner modes

## Queued mode

**A run is queued** when it was started by ship-queue as its child session
(`printenv SHIP_QUEUE_PARENT` prints a parent key; the child ran ship-issue,
which invoked this skill, or ran this skill directly with answers) and the
parent's ledger here (`.superpowers/ship-queue/<parent>/ledger.md`) has a
`Current: <KEY> started …` line naming this run's issue (its ledger's
first-line `Issue:`, or before the ledger exists the plan's `From ship-issue`
block) with no `Result: <KEY>` line after it. A leftover queue ledger alone
does not make a run the user started queued. Nobody is watching. All of
SKILL.md and the phase files applies, except:

- **Several open runs** (section 0, step 2): the queue's other sub-issues can each hold one. Resume the one whose `Issue:` is the `Current:` key; never ask which. Answers from ship-queue for a `Phase: done` run with an `Asked: … — pending` line go to that done ledger, even with other runs open, applied as section 0, step 2 says for a done ledger.
- **Outcome line:** at close-out (section 7, step 1), write `Outcome: <Done|Base branch red|Awaiting review|Not merged>` under the first line, the outcome whose template the closing comment used; a resumed close-out replaces an existing `Outcome:` line, never adds a second. ship-queue reads it; `Base branch red` stops the queue.
- **Ask nothing: never `AskUserQuestion`, never wait for a reply** (section 0, step 10; section 3, step 5; section 7, step 6). The batch goes into `questions.md` and the ledger as unqueued (`Asked: … — pending`), and as one comment: the tracker's *Comment*; no issue, the host's *PR comment*; no PR either, the ledger only. Number the questions, each with its options, recommendation first, ending with **"Answer with `/ship-queue <parent> <KEY>: <your answers>`."** (`<parent>` is the queue ledger's `Parent:`); the queue resumes this run with `/ship-queue <parent> <KEY>: <answers>`. Carry on with all the answers do not block, as unqueued; the run then ends at section 7 as it would.
- **Review wait** (section 4R): checks green and only a person's approval or unresolved thread missing: hand off at once (step 5), not after `Review wait:`. The AI-review wait (at most 20 minutes) and every CI wait stay. The queue polls once more after its last sub-issue.
- **No handoffs of this run's own:** neither the session-end one (SKILL.md's ledger section) nor a next part's (section 7, step 2). The queue writes one for the whole queue and is the next part.
- **Lessons** (section 8): branch `docs/ship-plan-lessons-<yyyy-mm-dd>-<KEY-n>`, so a queue's runs on one day do not collide (none under `## Logs` `Location: local`). Write `Lessons branch: <name>` on creating it; the queue reads it to know the branch is its own. Write `Lessons PR:` as unqueued. The rest of section 8 is unchanged.

## Runner mode

A runner child as [runner-child.md](runner-child.md) defines it; its item key is
an issue key, a no-issue ship-issue slug, or the key of a run on a plan alone.
The runner's prompt names the phase (`implement`, `verify`, `merge` or `close`)
and, for `implement`, a range of plan tasks. Queued mode and runner-child.md
apply, except:

- **The batch comment** goes where queued mode posts it, ending with runner-child.md's answer line instead of the `/ship-queue` one.
- **Which run** (section 0, steps 2 and 3): the open run whose `Issue:` is the `current` key, or whose `Plan:` is this run's plan, whatever the argument. Never ask which; never start a second run for a plan with an open ledger.
- **The run's branch, first in every phase:** on `<base>`, clean, and the ship-plan ledger has a `Branch:` line: `git switch <branch>` (a rerun or the next queue item can leave the checkout on base). Branch gone because its PR merged: stay on `<base>`, as section 0, step 2 says.
- **Only the named phase, reading only its phase file:** `implement` is sections 0, 1, 2 and 2b ([phase-implement.md](phase-implement.md)); `verify`, 3 and 4 ([phase-verify.md](phase-verify.md)); `merge`, 4R, 5, 6 and 6b ([phase-merge.md](phase-merge.md)); `close`, 7 and 8 ([phase-close.md](phase-close.md)). Every phase first reads what SKILL.md's opening reads (`.claude/ship-plan.md`, both logs by index, `hosts/<host>.md`, `trackers/<tracker>.md`), `notifiers/slack.md` when `## Slack` names a channel, and each one's override counterpart; a later `implement` child, only as the `implement` bullet below says. The index's rules for section 3 and for steps naming another phase file's section still apply. When the phase's text sends the run to section 7 early (verify not clean, awaiting review, awaiting merge, not merged), read phase-close.md then and close out as written.
- **A phase ends where the next begins:** rewrite the ledger's first-line `Phase:` to it, keeping the other fields (`Phase: 3` after section 2b, `Phase: 4R` once section 4 reaches section 4R, `Phase: 7` after section 6b), then end. The close phase ends as section 7 says (`Phase: done` when the outcome is Done).
- **`implement` with a task range:** only those tasks. After each task's review passes, write `Progress: task <n> done`, `<n>` as its `### Task <n>` heading numbers it; a task parked instead (its question in the batch, the run going on without it), `Progress: task <n> parked`. The runner counts both as handled to pick the next range. The first child runs sections 0 and 1 first. A later child (ledger at `Phase: 2`) re-reads exactly the plan's header and `## Global Constraints`, its task range, the ship-plan ledger and `git log <base>..HEAD --oneline`, nothing else before its first task; what section 2 puts in a dispatch (config sections, `## Models` rows, `## Prerequisites`) is read when the dispatch is built. **`implement` with no range** (every task has its `Progress:` line): section 2's steps after the last task, then section 2b. **`implement`, the whole plan** (no `### Task` headings): sections 0 and 1, all the plan's work as section 2 does it, section 2's steps after the last task, then section 2b, in this one child.
- **Progress milestones:** `task <n> done` (or `parked`), `review round <n>` (each `verify-and-fix` call in section 4, each section 4R round), `PR #<n> opened`, `CI <green|red>` (each time the PR's checks or the base-branch run settle), `merged <sha>`.
- **Waiting** for a background agent, gate or CI watch: as verify-and-fix's section 2 says (one loop checking every 15 seconds, never a fixed `sleep` over 30 seconds before the first check). Pauses a skill or host file names on purpose keep their length: the review wait (section 4R, it waits for a person), a host's poll interval, red-base.md's waits before a rerun.
- **Blocked** also covers awaiting review or merge after close-out, and a tool failing on every route.
- **A question before the ledger's folder is known** (section 0, steps 5 and 6): end at once, the question in the `RUNNER:` line as `blocked`, naming where its answer goes (`## Slack` in `.claude/ship-plan.local.md` or the config; `Tracker:` in the config's `## Repo`; an issue key in the plan's `Source:` line). The watching session asks the user, who adds it there and reruns (runner-session.md).
- **`phase-done`** also when the range's tasks are done; **`done`** when the ledger says `Phase: done`.
