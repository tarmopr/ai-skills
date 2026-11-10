# verify-and-fix: runner mode

## Runner mode

A runner child as [runner-child.md](../ship-plan/runner-child.md) defines it,
whose `state.json` also has `kind` `verify`. Never under `ship-plan`: the
runner's `kind` is then `issue`, `queue` or `plan`. The runner's prompt names
phase `verify`, the only one. All of SKILL.md and runner-child.md applies, except:

- **Questions** are wherever this skill would ask (section 1's one message, section 6's stops). With an open PR, post the batch as one numbered comment (the host's *PR comment*); without one, the ledger only. Carry on as section 6 says.
- **Progress milestones:** `review round <n>` (with each `Reviewed:` line), `CI <green|red>` (each time the PR's checks are read).
- **Blocked:** the loop ends `not clean` and no question waits for the user; the reason as the status line gives it.
- **The `Done:` line** is still the ledger's last line, every time (section 7).
- **The final line** has no `phase-done`: `done <the status line>` whenever it is not `waiting` or `blocked`.
