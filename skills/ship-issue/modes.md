# ship-issue: queued and runner modes

## Queued mode

**A run is queued** when it was started by ship-queue as its child session
(`printenv SHIP_QUEUE_PARENT` prints a parent key; ship-queue's *Child sessions*
sets it) and that parent's ledger in this checkout
(`.superpowers/ship-queue/<parent>/ledger.md`) has a `Current: <KEY> started …`
line naming this run's issue, with no `Result: <KEY>` line after it. A leftover
queue ledger alone does not make a user-started run queued: it asks as unqueued.
Nobody watches. All of SKILL.md and the phase files applies, except:

- **Ask nothing: never `AskUserQuestion`, never wait for a reply,** wherever this skill would ask (I1, the I3 batch, a later question). Ledger lines as unqueued (`Asked: … — pending`, `Parked:`, for I3 the `Waiting: batch …` line). Post the batch as one issue comment (the tracker's *Comment*): questions numbered, each with options, recommendation first, ending **"Answer with `/ship-queue <parent> <KEY>: <your answers>`."** (`<parent>`: the queue ledger's `Parent:`); the queue's resume form is `/ship-queue <parent> <KEY>: <answers>`. Do everything the answers do not block (the Spec stage and its commit), then end the run.
- **A question before the issue is read** (a tracker call failing at I1): write it to the ledger with the exact error; end the run.
- **I0's live-run row** skips this issue's ledgers in the queue ledger's `Checkout:` (the parent queue's). One in any other checkout still counts.
- **No session-end handoff** of its own: the queue writes one for the whole queue.
- **ship-plan** runs in its own queued mode ([its modes.md](../ship-plan/modes.md#queued-mode)), found the same way.

## Runner mode

A runner child as [runner-child.md](../ship-plan/runner-child.md) defines it;
its item key is the issue key, or with no issue the slug. Queued mode and
runner-child.md apply, except:

- **The batch comment** goes where queued mode posts it, ending with runner-child.md's answer line instead of the `/ship-queue` one. After rewriting the answered `Asked:` lines, go on as I0 says for a resume with answers.
- **Never a worktree or another checkout** (section W, [worktree.md](worktree.md)): on `<base>`, clean, branch there, or `git switch <branch>` if this issue's branch exists (a resume); on this issue's branch, stay. Where W would create a worktree (checkout dirty or on another branch), write `Blocked: needs a new worktree — <reason>` (no ledger yet: in the `RUNNER:` line), end `RUNNER: blocked`.
- **Only the named phase, reading only its file:** `spec` is I0–I3 ([phase-spec.md](phase-spec.md)); `plan` is I4 and I5 ([phase-plan.md](phase-plan.md)). Set the first line's `Phase:` field (other fields kept) to `Phase: I4` once the spec holds no `[pending Q<n>` marker, to `Phase: I6` after I5, then end. **A `small` issue whose Spec stage wrote the plan** (last `Stage:` line `Stage: plan done <path> — combined with spec (small)`), with no `[pending Q<n>` marker and no batch waiting (no `Waiting: batch …`, no `Asked: … — pending`): `spec` goes on through I4 and I5 in the same child, reading [phase-plan.md](phase-plan.md), ending at `Phase: I6`; no plan child starts.
- **`implement`, `verify`, `merge` and `close` are ship-plan's:** skip this skill's reads before I0. No ship-plan ledger for this issue (none at the `ship-plan ledger:` path, none by I6's `Plan:`/`Issue:` match): I6. Else correct the field if it differs and invoke ship-plan with `--session` and no other argument, as I0's ship-plan-ledger row does; it runs in its Runner mode for the named phase and task range, and its `RUNNER:` line ends this run's reply.
- **I0's live-run row** skips this issue's ledgers in this checkout (the runner's lock runs one child at a time; the last write may be the previous child's), not those in other checkouts.
- **Progress milestones:** `spec done <path>`, `batch of <n> sent` (before the `Waiting: batch …` line, which then stays last until the answers come), `plan done <path>`.
- **Blocked** e.g. a stage `blocked` with nothing to ask.
- **`waiting`** also when a `Waiting: batch …` line waits for the user; **`done`** when the issue is in status category Done and nothing ships (I0's first row).
