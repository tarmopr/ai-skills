# Ship a plan: close phase

Sections 7 and 8 of [ship-plan](SKILL.md). Everything in SKILL.md applies here.

## 7. Close out

1. **Closing comment.**
   Four outcomes, one template each (templates-issue.md with an issue, templates-pr.md without):
   - **Done:** merged; the base branch green, or no CI (CI None, no base-branch run for the merge); and validation (section 6b) passed, apart from scenarios listed under **Not tested** and an `## After merge` failure this run's diff does not explain (reported). With an issue: "Issue comment: done", then the tracker's *Set status* to the done status, **only when `Done means:` is met** (with CI None, Done means is "merged"; scenarios under **Not tested** count only when `Done means:` names them). No issue: the host's *PR comment* with "PR comment: done".
     **Each `Tickets:` issue** gets the done status with the run issue, and only when all of these hold: the run issue got it; every plan task whose heading names its key is committed, none parked, skipped or left `[needs a decision]`; and the ledger's `Commits:` line counts at least one commit for it. Then "Issue comment: done (batch ticket)" and the tracker's *Set status* to the done status. Otherwise "Issue comment: not done (batch ticket)", naming what is missing; its status stays, and it goes in the batch. Under every other outcome, each `Tickets:` issue gets the run issue's comment for that outcome, and its status stays.
     Before writing the Done comment, read the `blockers.md` entries about what the base branch's CI (workflows or pipelines) does after a merge (for example a chart bump PR their bot opens and merges), check each one, and report its real state in the comment.
   - **Base branch red:** merged, and the base branch still red, or a validation failure (section 6b) still unfixed. "Issue comment: base branch red" or "PR comment: base branch red"; the issue stays in the start status.
   - **Awaiting review:** the PR is open, green, and every comment so far is handled, but it waits on reviewers (section 4R, step 5). "Issue comment: awaiting review"; without an issue, the report only (the PR shows its own state). The issue stays in its status. The report says how to resume.
   - **Not merged:** the PR is still open for another reason (verify not clean, checks never registered, the base branch red before merge, a refused merge, a deploy `## Allowed` does not cover, 5 review rounds), or no PR exists. "Issue comment: not merged" or "PR comment: not merged"; with no PR and no issue, the report is the only record.
2. **When the ledger has a `Docs PR:` line and the code PR merged, read [docs-pr.md](docs-pr.md).**
3. **A next part:** when the outcome is Done and the plan names a next part (a later plan or issue), write a handoff for it as the ledger section says, but as `HANDOFF-next.md` when the `handoff` skill is unavailable, so it never overwrites the session-end `HANDOFF.md`. Its resume line is not the ledger section's: it starts that part: `/ship-plan <its plan path>`, or `/ship-issue <its key>` when it has no plan yet.
4. **Lessons** (section 8), except under "Awaiting review" and `Phase: 5 awaiting merge`: they wait for the run's final close-out.
5. **Report,** concise, in this order, once every background prerequisite still running is stopped (TaskStop):
   1. **Needs you:** the batch.
   2. Status: base branch green or red (or "no CI"), PR, merge SHA, the docs PR, the lessons PR (and why it stays open, if it does), the issue link if any, and the ledger's `Allowed:` lines (section 0, step 7).
   3. Gate and scenario tables (from `verify-and-fix`), the `Simplify:` line, every unknown config section, and every override line not applied.
   4. **Decisions made for you:** every `Ruling:`, each with what it costs if wrong.
   5. **Not tested:** what, and why.
   6. The lessons recorded, and what section 8 proposes: each proposed shared-skill change, `## Allowed` line and loosening config line, with its exact text.
6. **Mark the ledger** `Phase: done` when the outcome is Done, and if this run was started by `/loop`, end the report with "Done: stop the `/loop`." Every other outcome keeps the run open, so a later `/ship-plan` resumes it.
7. **Ask the batch once,** after the report, with `AskUserQuestion` when the answers are choices. When the user answers, carry on, even on a `Phase: done` ledger (section 0, step 2): run the pending scenarios once they have signed in, add a new tracker or PR comment, and record each answer in `interruptions.md`.
   **Before creating a follow-up issue,** whether this batch approved it or an earlier answer did (a `Ruling: user` line copied from `ship-issue`'s I3 batch), check that a reviewer has not filed it already. Read the PR's review bodies and comments (the host's *Fetch review items*), and search the tracker as the tracker's *Find an existing follow-up* says. When an issue already covers it, create nothing: name that issue in the Done comment's follow-ups, and record a `Ruling:` that quotes the line of it that covers the follow-up. An approver once filed an issue that covered both follow-ups the I3 batch had approved; creating them as well would have split the work in two. Also grep `.claude/ship-plan/*.md` and `.claude/ship-issue/*.md` for the follow-up's subject: a log entry can name the issue when a tracker text search misses it (a run once filed a duplicate of an issue that `interruptions.md` named, because that issue's summary said "fail once", not "flaky"). Create each issue as the tracker's *Create an issue* says, and link it to the run issue as the tracker's *Link two issues* says. With `Tracker: none` there is no follow-up issue: it stays under Follow-ups.

## 8. Lessons

Last, after everything else: the merge, base-branch CI, validation (section
6b), the docs PR and the closing comment; then the report. On a branch from
`origin/<base>` (`docs/ship-plan-lessons-<yyyy-mm-dd>`), never on the feature branch.
Run `git fetch origin <base>` right before `git switch -c`: an earlier
fetch is stale, and a lessons PR branched from it conflicts with every
lessons PR that merged meanwhile. Then merge
the branch of every open lessons PR
(the host's *Find open PRs*, by search) that the lessons-PR guard (below)
allows into the new branch, so the logs build on them instead of conflicting.
A guarded one is left out: its PR stays open, and the report names it as left
out, with the guard's reason. Each `Lesson:` line in the
ledger, `verify-and-fix`'s included (they name their target file), goes where
these rules say:

- **Repo learnings are written, not proposed:**
  - **A procedure, fact, failure path or step only this repo needs** goes into the matching override file, `.claude/ship-plan/<skill>/<file>.md`, created if missing. It may only add or make a rule stricter ([Repo override files](config-format.md#repo-override-files)).
  - **Every question you asked this run** (pre-flight, mid-run, final) becomes an `.claude/ship-plan/interruptions.md` entry. When the user answers, fill in the answer and a **standing answer**: the rule that lets the next run decide on its own. A standing answer never grants a permission: for a missing one it points to the proposed `## Allowed` line.
  - **Every ruling the user overturned** becomes an entry too. That is how the confidence test gets calibrated.
  - **Every tooling blocker** you got past goes into `.claude/ship-plan/blockers.md`, in its format.
  - Create either log from [log-formats.md](log-formats.md) if it is missing.
  - **Under `ship-issue`** (the plan has a `From ship-issue` block): its `Asked:` lines (questions from phases I0–I6) go into `.claude/ship-issue/interruptions.md` instead, created from [../ship-issue/log-formats.md](../ship-issue/log-formats.md) if missing.
- **Config lessons follow the narrowing rule** ([Loosening changes](config-format.md#loosening-changes)), in `.claude/ship-plan.md` on the same branch: one on its "may be written" list is written; a loosening change is proposed with its exact line, and written only when this run's batch approved it; a `## Allowed` line is never written. Exceptions, committed on the feature branch instead because the run needs them now: `## Slack` (section 0, step 6), `Tracker:` (section 0, step 5), and a drafted `## Jira`, `## Linear` or `## GitHub Issues`.
- **Generic learnings are proposed:** a lesson that would help every repo (a missing step, a wrong order, a rule that misfired) goes in the report as "proposed shared-skill change", with the exact text, written generically: no repo, team or org name, issue key, URL or repo command. Never edit the shared skill files: every repo uses them, and they are published from their own git repository.
- **Missing `## Allowed` permissions are proposed:** when the run was held up for want of an entry on the closed list (a refusal, a question the user had to answer to allow something, an action the user did by hand), the report proposes the exact `## Allowed` line and the reason, for the user to add ([`## Allowed`](config-format.md#-allowed)). A hold-up no entry fits is a proposed shared-skill change; a command the permission system refused takes section 5, step 5's route (an `allowed-tools` line proposed, settings never edited).
- **A rule for the whole repo,** not for this loop: propose a change to the repo's agent instructions file (for example `CLAUDE.md`) in the report, with the exact text. Never edit it.
- **The lessons-PR guard:** before merging a lessons PR, or its branch into a new lessons branch, this run's or one an earlier session opened, `git fetch origin <lessons branch>`, then read its diff (`git diff origin/<base>...origin/<lessons branch>`). When it touches `## Allowed`, or changes the config in a way not on the "may be written" list ([Loosening changes](config-format.md#loosening-changes)) that this run's batch did not approve, never merge it, even when it is green and mergeable, and leave its branch as it is: it stays open, without holding the run open, and the report links it as "lessons PR, left open: <line> — <why>" (`## Allowed` is a section only a person edits; or the config change needs an approval in this run's batch).
- **Batch empty:** open a docs-only PR, record `Lessons PR: #<n>` in the ledger, and wait for its checks. A PR the guard stops is reported as the guard says. Otherwise, if the review rule (section 4R, step 1) needs no approval, merge it through sections 5–6; if it needs one, request the AI review (the host's *Request an AI review*), leave it open for review, and link it in the report as "lessons PR, needs approval"; it never holds the run open.
- **Batch not empty:** commit and push the branch with those entries marked `Answer: pending` *before* you ask, so the lessons survive if the session ends. When the answers come, fill them in, then open the PR and merge it the same way.

During the run, write lessons in the ledger as `Lesson:` lines. Editing the
log files on the feature branch mixes them into the product PR.
