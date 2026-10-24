# PR review comments

Read when the branch has an open PR (including `--comments` mode).

## PR review comments

When the branch has an open PR (the host's *Find open PRs*, the branch's own
PR), its review comments are findings too, from people and from bot reviewers.
Every round, after the agents, fetch the ones not handled yet. Invoking this
skill on a branch with an open PR authorizes, for that PR only: committing,
`git push origin HEAD` while the PR's head branch is checked out (never
`--force`, never on the base branch), replying in its threads, resolving a
bot's threads, and re-requesting a review (below). Never approve, dismiss a
review, resolve a person's thread, merge, or request a new reviewer.

Repo identity and your login come from the host's *Repo identity* and *Auth
check*. Run each once.

**Fetch.** The host's *Fetch review items*.

**What counts as new.** Every item is keyed as the host's *Fetch review items*
says; the ledger records
`Review: <key> <author> <grade> — <one line> — <action>`. The table of keys
and of when each is new is in that operation.

Read each item with the code it points at, at `HEAD`: an
outdated thread may already be fixed. Then grade it in section 5 with the
agents' findings, by the same rules: a comment is right or wrong on its merits,
not by who wrote it.

**Reply** to every item once its fix is pushed (templates below, "Review
reply"; write the body to a file in the ledger directory), with the host's
*Reply to a review item*.

- **Resolve** a bot's thread, with the host's *Resolve a bot's thread*, once it has a reply of any kind (fixed, answered, follow-up, not valid). A person's thread is theirs to resolve. On a host without bot reviewers this never applies, and a person's thread stays theirs to resolve on every host.
- **Re-request** a person with the host's *Re-request a reviewer* when every change they requested is addressed, or when your push dismissed their approval. Never re-request a bot: a ruleset that wants it re-reviews on push by itself.

Record each reply as `Replied: <key> — <fixed in <sha> | answered | follow-up | not valid | needs a decision>`.

**Issue comment.** When the run has an issue and the repo's tracker is not
`none`, post ship-plan's `Issue comment: review round`
([templates-issue.md](../ship-plan/templates-issue.md)) with the tracker's
*Comment* after the replies. Under `ship-plan`, skip it: ship-plan posts it.

**`--comments` mode** (how `ship-plan` calls this skill while a PR waits for
review): the PR's comments are the only new findings. Run this section and section 5 on
them, then the gates. Run a review round only when a fix changes behaviour, and
then only on the fix commits (`git diff <commit before the fixes>..HEAD`), not
the whole branch: reviewers already saw the rest. A red PR check is a finding
in this mode too. The round count starts at 1 on each call. **Clean in this
mode:** every gate passed, every comment has a reply and none graded "needs
the user" is undecided, and the fix-diff round, if one ran, found no Critical
or Important issue.

## Review reply

One reply per PR review item (`verify-and-fix` section 4b). Short, in plain
words, quoting code where it settles the point. Fixed replies name the commit.

| Grade | Reply |
|---|---|
| Fixed | `Fixed in <short sha>: <what changed, one line>. Test: <test name>.` |
| Suggestion, out of scope | `Agreed, but outside this PR's scope. Noted as a follow-up<: <KEY-n> comment>.` |
| Follow-up while approved | `Good point. The PR is approved, and a push now would dismiss that approval, so I've noted it as a follow-up<: <KEY-n> comment>.` |
| Question | `<the answer>, see <path:line>: <quoted line>.` |
| Not valid | `I don't think this applies: <path:line> <quoted code> <why>. Happy to change it if I've missed something.` |
| Needs the user | `This needs a decision from the author: <the question>. I've raised it with them.` |

A reply that promises a change in another file or a later PR names a place you
have grepped first. On #159 a reply promised a README line the README already
had, and the correction took a second comment and an edit of the Done comment.
