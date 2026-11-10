# ship-issue worktree.md: rationale

Reasons moved out of skills/ship-issue/worktree.md to keep it short. Read when changing a rule, not when running the skill.

Why the checkout matters: ship-plan must run where the repo's untracked setup exists: installed dependencies and the files the config's `## Worktree` `Copy:` lists.

Why a worktree-isolated session treats the main checkout as busy: git cannot read it from there (`git -C` is refused), and `cat <main>/.git/HEAD` shows its branch but not whether it is dirty.

Why the worktree path is written out literally: a relative path would nest the new worktree inside the current one.

Why `Copy:` files are copied: they are git-ignored, so they never travel with the branch.

Why `Shared:` resources are checked: two checkouts running the same containerised suite can kill each other's run.
