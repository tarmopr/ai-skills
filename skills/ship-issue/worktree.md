# W. Which checkout

Read when the current checkout is dirty or on another branch.

ship-plan must run where the repo's untracked setup exists: installed
dependencies and the files the config's `## Worktree` `Copy:` lists.

| Where this session is | Action |
|---|---|
| Main checkout, on `<base>`, clean | Branch there. |
| Main checkout, on this issue's branch | Stay. |
| Main checkout, on another branch or dirty (another agent or the user is working) | New worktree (recipe). Never switch, stash or commit someone else's tree, and never run its tests. |
| A worktree on this issue's branch | Stay. |
| A worktree holding other work | New worktree (recipe). Don't rename or reuse this one. |

From a worktree-isolated session, git cannot read the main checkout: `git -C`
is refused. `cat <main>/.git/HEAD` shows its branch but not whether it is dirty.
**Treat it as busy** and use a new worktree.

**Worktree recipe.** Run each command as its own plain command, never inside
`$( … )`.

0. **Git must run unmodified.** Run plain `git status` once. If a hook refuses it, that goes in the batch with the hook's message. Until it is fixed, the run falls back to the full git path (`/usr/bin/git`), and step 5 applies.
1. **Create it from `origin/<base>`.** `git fetch origin <base> --quiet`, when the repo has an `origin` remote. `git rev-parse --path-format=absolute --git-common-dir` prints `<main>/.git`; `<main>` is its parent. Then, with that path written out literally (a relative path would nest it inside the current worktree):
   `git worktree add --detach <main>/.claude/worktrees/<KEY-n> origin/<base>`
   Then call `EnterWorktree` with that `path`. The worktree starts detached on `origin/<base>`; I2 step 1 creates the branch once the key is known, so nothing needs renaming.
2. **Dependencies:** the config's Prerequisites rows with `Background: no`, in order. In a permission mode that prompts, their allow lines are in the I3 batch, so run them once the answers arrive; research needs only the code. Otherwise run them now.
3. **Untracked files:** `cp <main>/<file> <file>` for each file in `## Worktree` `Copy:`. They are git-ignored, so they never travel with the branch. Copy them, never print them.
4. **Shared resources:** before a gate or a Background Prerequisite, check each item in `## Worktree` `Shared:` (fixed container names, ports). If another checkout holds one, wait until it is free. Two checkouts running the same containerised suite can kill each other's run.
5. **ship-plan's pre-approved git commands** (`Bash(git push origin …)`, …) match only while step 0 holds. On the `/usr/bin/git` fallback they don't match: every push, merge and revert would prompt, and unattended the run stalls at the first one. The step 0 batch item says so.
6. **Commit hooks:** `git hook run pre-commit` once, before the first commit. A hook that lints from the main checkout can fail on files under `.claude/worktrees/`. If it fails because of the worktree path, that goes in the batch, with the ignore line the linter needs.
7. **Anything that cannot be done** goes in the I3 batch. Say what it blocks, and don't discover it later.
