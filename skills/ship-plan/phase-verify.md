# Ship a plan: verify phase

Sections 3 and 4 of [ship-plan](SKILL.md). Everything in SKILL.md applies here.

## 3. Questions

Every time you'd want to ask the user something:

1. **Check `interruptions.md`.** If there is a standing answer, apply it and note `Ruling: standing answer <entry>`. None grants a permission ([`## Allowed`](config-format.md#-allowed)).
2. **Apply the confidence test.** Decide it yourself, with a `Ruling: <decision> — <evidence quoted> — <cost if wrong>` line, when **all four** hold:
   - the plan, the spec, the repo's agent instructions, a standing answer, or existing code points one way, and you can quote it;
   - a follow-up commit can undo it;
   - it is not in the "does not authorize" list;
   - it doesn't **widen** access or change money: nothing new becomes visible or allowed to a role, and nothing changes what a customer is charged. Those need the user, even if you are confident. **Narrowing access to what the spec already states,** through the repo's existing mechanism (its access-control layer, an existing role check), passes this part. Pick the variant the codebase already uses for the same case, and quote that sibling.
3. **"Should we go beyond the spec?"** (widen a role, add a feature the spec leaves out) is not a question for this run. Rule for what the spec says, and list the alternative under Follow-ups in the closing comment.
4. **Otherwise, park it** in `questions.md`: the question, the options, your recommendation, and what is blocked by it. Then keep working on everything else.
5. **Ask only when nothing unblocked is left.** Then ask the whole of `questions.md` at once. The usual moment is the close-out (section 7). Mid-run, the only reason is that every remaining path is blocked, for example a denied merge with nothing else to do.

A failing gate, a red CI job, a flaky test, or a merge conflict is **work, not
a question.** `verify-and-fix`'s section 6 stop conditions are parked here, not asked
on the spot, except for a destructive action.

## 4. Verify, push, PR

1. **REQUIRED SUB-SKILL:** `verify-and-fix`, with `--session` among its arguments (it never starts a runner of its own from here). Run it until it reports `clean` or `clean before merge; N scenarios pending`. Its setup step collects its own questions; those go into `questions.md` unless blocked. Pending scenarios are listed in the ledger as **pending after merge**.
   `not clean: <reason>`: never push and never open the PR. A reason the loop can still work on (a gate failure, a review finding) is work: keep going. A reason that needs the user (an unconfirmed draft config, a gate that could not run, no gates, round 5, a fix that still fails) is parked in `questions.md`; when nothing unblocked is left, go to close-out (section 7) with no PR, and ask the batch. Never call `verify-and-fix` again on an unchanged reason.
   **No `origin` remote:** stop here, before the push, and say in the report that no PR can be opened.
2. **Push:** `git push -u origin <branch>`.
3. **Open the PR:** the host's *Open the PR* against `<base>`. Title: the outcome in plain words, plus ` (<ID>)` when there is an issue. Body: templates.md, "PR body" (with its `## Plan` section when there is no issue). It ends with the attribution line.
4. **Ask for review** (section 4R, steps 1–2): record the review rule, request the AI review, post the review request, and with an issue set the review status (the tracker's *Set status*) if the config names one. CI and the reviews run in parallel.
5. **With an issue:** the tracker's *Link the PR*, as its *Integration* says for this host.
6. **Wait for checks:** the host's *Wait for the PR's checks*. While waiting, draft the closing comments. If no checks are reported:
   - **CI None** — the config's `## CI` says `None`, or the host's *Has CI* finds none: there is nothing to wait for. Record `CI: None` in the ledger and go to section 4R; `verify-and-fix` clean is the gate, not a question.
   - Otherwise the host's *Does CI cover this diff*. **No CI covers this PR**: there is no PR CI for this diff. Record "no PR CI for this diff", go to section 4R, and say so in the report.
   - CI does cover it: CI has not registered yet. Wait up to 10 minutes, then treat it as a blocker: park it and close out with the PR open ("not merged").
7. **A red check:** the host's *Read a failed run*.
   - A transient failure listed in `blockers.md`: the host's *Rerun a failed PR check*.
   - **A new transient on the PR:** a test the diff does not touch fails, and the same test passed on the base branch's last run: the host's *Rerun a failed PR check* once, and record a `Lesson:` for `blockers.md`; section 8's write gate decides. A second failure is a gate failure.
   - Anything else is a gate failure. Back to `verify-and-fix` (with `--session`, and `--comments` once the PR is in review, so only the fix is re-reviewed): fix it with a test first, run the gates, then run a review round unless the fix keeps behaviour. Commit, `git push origin <branch>`, and wait again.
8. **Every check green:** section 4R.
