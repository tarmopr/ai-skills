# Docs PR

Read only when the ledger has a `Docs PR:` line and the code PR merged (section 7, step 2 of [SKILL.md](SKILL.md)).

**Docs PR,** when the ledger has a `Docs PR:` line (`ship-issue` held the spec out of the code PR, because the repo keeps docs and code in separate PRs) and the code PR has merged. Under "Awaiting review" and "Not merged" it waits: the docs describe code that is not on the base branch yet. Nothing else opens it: without this step the spec stays git-ignored in the ledger directory and never reaches the repository.

1. In the same checkout, never a second worktree (a worktree-isolated session cannot write to one): `git fetch origin <base>` right before the switch, never an earlier fetch (other PRs merge while this run waits), then `git switch -c docs/<ID>-<slug> origin/<base>`, with the feature branch's `<slug>` and `<ID>` written the way the config's `Branch:` pattern writes it.
2. Copy the held spec to the path the line names (`docs/superpowers/specs/…`), and rewrite only the spec's own line about where it lives. Make the other changes the line lists: rows in the agent instructions, an ADR the spec asks for, a pointer in an ADR it supersedes (only a proposed one; an accepted ADR is append-only).
3. Check every name, path and test the new text cites against `origin/<base>` with `git grep`. Fix the text, never the code.
4. Commit (`docs: <what> (<ID>)`), `git push -u origin <branch>`, and open the PR against `<base>` with the host's *Open the PR*. The body names the code PR and its merge SHA, and ends with the attribution line.
5. Request the AI review (the host's *Request an AI review*), and post the review request (the notifier's *Review request*; section 4R, step 2) when the review rule needs an approval. If the review rule needs no approval, merge it through sections 5–6. Otherwise leave it open and link it in the report as "docs PR, needs approval"; it never holds the run open.
6. Write `Docs PR: #<n> <url>` in the ledger. With an issue, name it in the Done comment's follow-ups.
