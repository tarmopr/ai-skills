# Ship a plan: implement phase

Sections 0, 1, 2 and 2b of [ship-plan](SKILL.md). Everything in SKILL.md applies here.

## 0. Pre-flight

**The ledger's folder** is named after the branch section 1 will use, which is
known once step 5 has settled the issue (or, on a branch already there for this
plan, at once). Until then, keep pre-flight's ledger lines in hand, and write
them, under the first line, as soon as the name is known. A resume (step 2)
reads ledgers that already exist, so it needs none of them.

**Under `## Logs` `Location: local`,** when the store holds no log, copy the
tracked logs into it now, as [`## Logs`](config-format.md#-logs) says.

1. **Config.** **When the config is missing or a section must be drafted, read [config-drafting.md](config-drafting.md).** Draft the config, or the section, as that file says; the draft goes at the top of the batch. Implementation proceeds; `verify-and-fix` runs no gate until the user confirms the draft. An existing config is read by its reading rules: every unknown config section goes at the top of the batch, and a near-miss of `Never do`, `Fix rules` or `Security extras` is applied anyway and flagged.
2. **Resume or start.** List `.superpowers/ship-plan/*/ledger.md` in every checkout that `git worktree list` prints, not only the current one. An open run in another checkout is worked on from the checkout that holds its branch (`git -C <path>`, `gh … -R <host>/<owner>/<repo>`), never by switching the current checkout to that branch. A ledger whose first line is not `Phase: done` is an open run. If the argument (read without a `--runner` or `--session` flag at its start or end, SKILL.md's "Runner or session") is not a plan path or an issue key that starts a new run, and an open run exists, this is a resumed run and the argument (if any) is answers: apply them to the parked questions, record each, switch to that ledger's branch (its `Branch:` line; with none, the head branch of the PR its first line names) if the checkout is on the base branch and clean (otherwise put it in the batch; and if its PR is already merged, the branch is gone: stay on the base branch), and continue from its first line. Several open runs: ask which one. **A run that is done is never resumed, and its plan is never shipped again**: step 3 skips any plan named in a `Phase: done` ledger. One exception, for answers only: with no open run, a `Phase: done` ledger whose batch is unanswered (an `Asked: … — pending` line) takes an argument that is answers. Apply them to its parked items as section 7, step 6 and section 8 say (run the **Not tested** scenarios once the user has signed in, merge a lessons PR the batch asked about), then end again as done. It never re-runs the plan.
3. **Resolve the plan.** A path; or an issue key (the tracker's *Read an issue*: the issue description may be the plan; with the tracker unavailable there is no plan, so park it and ask now). No argument and no open run: stop with "Nothing to resume. Name the plan to ship." Never pick a plan on your own. **A plan written by `ship-issue`** has a `From ship-issue` block in its close-out notes: copy its `Ruling:`, `Parked:`, `Asked:`, `Lesson:` and `Used:` lines into the ledger now, so they reach the PR body, the questions and section 8.
4. **Check tools and auth, in parallel:** the host's *Auth check*; the tracker's *Auth*, unless the tracker is `none`; `git fetch origin <base> --quiet`, then `git status --porcelain`. A dirty working tree that is not yours goes in the batch; never stash or discard it. **The tracker unavailable** (not connected, or the call fails), now or later in the run: as the tracker's *Auth* says, park it with the exact error, continue with no issue (the PR body carries the plan), and say so in the report. Never retry it through another route.
5. **The issue.**
   - **`Tracker:` undecided** (no `Tracker:`, no `## Jira`, no `## Linear`, no `## GitHub Issues`): ask "Which tracker does this repo use?" ([templates-issue.md](templates-issue.md)) **now, and wait for the answer**, before the issue question. Write it as `Tracker: <jira, linear, github or none>` in the config's `## Repo`, with the tracker's section drafted from the issue question (the tracker's *Where a new issue goes*), as the feature branch's first commit once section 1 has created it (with `## Slack` when step 6 asked too). A drafted config gets it inside the draft instead. Then read `trackers/<tracker>.md`, unless the answer is `none`.
   - **`Tracker: none`:** there is no issue. The run takes the no-issue path (section 1).
   - **Otherwise take the key,** stopping at the first hit: the argument; the plan's header, "Source:" line or `From ship-issue` block; the current branch name, if this run started that branch (the tracker's *Issue keys*). No key: ask the "Issue question" ([templates-issue.md](templates-issue.md)) **now, and wait for the answer** before anything that depends on it (the branch name does). It offers "No issue": that answer is accepted, recorded as a `Ruling: user <date>`, and the run continues with no tracker (section 1).
   - **When the plan's header has a `Tickets:` line (several issues in one PR), read [tickets.md](tickets.md) and do its *Pre-flight* section.** Never take batch keys from anywhere else.
6. **Slack channel.** Read `## Slack` from the config, else from `.claude/ship-plan.local.md` (a git-ignored file on this machine, read, never written). Either says where review requests go: a channel, or `none`. **When `## Slack` is missing from the config and from `.claude/ship-plan.local.md`, read [notifiers/slack.md](notifiers/slack.md) and choose the channel.** The notifier's *Choose the channel* asks the user, and this step waits for the answer. The answer is written to the committed config only. **When `## Slack` (config, else `.claude/ship-plan.local.md`) names a channel, read [notifiers/slack.md](notifiers/slack.md).** This step runs on every start and every resume, so the file is read before any hook point (section 4R, steps 2 and 3; section 5, step 7).
7. **`## Allowed` and `## CI` `Merge deploys to:`,** from the config as loaded. One ledger line per switched-on entry, `Allowed: <entry>`, and one per entry or name not applied, `Allowed: not applied: <entry or name> — <reason>` (a production-like name, an unknown entry; [config-format.md](config-format.md#-allowed)). When `Merge deploys to:` is set, one `Deploys: <env>[, <env>]` line. Section 5, step 3 confirms both against the base branch before a merge. The run never writes to `## Allowed`.
8. **Predict what the run will need from the user,** by reading the plan: every task marked `[needs a decision]`, "ask the user", "confirm", or open questions; hosted sign-ins for the config's `## UI testing` (a `Hosted URL:` one only if `## Allowed` lacks `Sign in on Hosted URL: test users`); a merge that `## CI` `Merge deploys to:` names and `## Allowed` doesn't cover (section 5, step 3), with the line that step proposes; anything on the "does not authorize" list.
9. **Answer what you can.** Apply every standing answer from `interruptions.md`, and decide every question the confidence test (section 3) allows. Record each as a `Ruling:` line.
10. **Ask the rest in one message** (ending with the `/ship-plan` answer line), using `AskUserQuestion` (at most 4 questions; the recommended option first, marked "(Recommended)"). More than 4, or questions that need free text: one numbered message. Say that you'll continue with everything that doesn't depend on the answers. If nothing is left to ask, don't ask anything and start.

Except for steps 5 and 6, do not wait for the answers. Start section 1 and every task that doesn't depend on them.

## 1. Tracker and branch

The PR body is in [templates.md](templates.md). **When the run has an issue, read [templates-issue.md](templates-issue.md); otherwise [templates-pr.md](templates-pr.md).**

**With an issue** (pre-flight step 5 found one, or created it from the
user's answer). Where it lives, its fields and its statuses come from the
config's tracker section (`## Jira`, `## Linear` or `## GitHub Issues`, or the draft made from the
issue question); follow its `Notes:`.

Start the work: the tracker's *Assign*, then the tracker's *Set status* to the
start status. Skip the status change if the issue is already in that status.
If the description does not already contain the plan, append it ("Plan
appended", with the tracker's *Append the plan*). Never overwrite what the user wrote.

**When the ledger has a `Tickets:` line, read [tickets.md](tickets.md) and do its *Start* section.**

Do not assume an integration closes the issue: the tracker's *Integration*
says what it links, and when you set the done status.

**No issue** (`Tracker: none`, the user answered "No issue", or the tracker is unavailable). No tracker step. The plan goes into the PR body
(templates.md, "PR body").

**Branch.** If you are on the base branch, create the branch from
`origin/<base>` in the current checkout (`git switch -c <name> origin/<base>`),
named by the config's `Branch:` pattern: `<type>/<slug>`, or `<type>/<id>-<slug>`
with an issue. `<type>` is `feature`, `fix`, `docs`, `chore` or `refactor`,
whichever fits the plan. `<slug>` is 3–6 words of the title in kebab case.
Write the issue key as the tracker's *Issue keys* says. Never prefix a branch with a username. Write `Branch: <name>` in the ledger once the branch is there, already there or new: a resume switches to it. Do not
create a worktree on your own. If the current checkout is on another branch
or dirty, put it in the batch; never switch it. If you are already on a branch
for this plan, stay on it; if its name does not start with one of the five types, put `Bash(git push origin <branch>)` and `Bash(git push -u origin <branch>)` in the pre-flight batch as allow lines.

## 2. Implement

**REQUIRED SUB-SKILL:** superpowers:subagent-driven-development, on the branch from section 1. Eleven adjustments:

- **Prerequisites first:** run the config's `## Prerequisites` before the first implementer dispatch, as `verify-and-fix`'s setup runs them (in order, each one's `Ready when` awaited, background rows with `run_in_background`); not from a draft the user has not confirmed. When `verify-and-fix` reaches its setup, it does not start a row again whose `Ready when` already passes. Background rows started here are stopped with TaskStop at close-out, right before the report (section 7, step 4).
- **Every implementer dispatch carries the repo's rules:** the config's `## Fix rules`, `## Never do` and `## Security extras`, verbatim, and the paths of the override files that apply to the task, always `.claude/ship-plan/ship-plan/SKILL.md` when it exists, and the rule "never edit `## Allowed` in `.claude/ship-plan.md`".
- **Every implementer dispatch carries the tracker's commit-text rule** when the tracker's *Integration* states one (GitHub Issues: no closing keyword such as `Fixes` before an issue reference, in any commit message; the issue only as `(#<n>)` at the end of a subject), verbatim.
- **Every implementer dispatch carries the plan's `## Global Constraints`,** verbatim, when the plan has that section.
- **Its pre-flight concerns and rulings** follow its own "Rulings, not stalls" rule. Anything it would stop for goes into `questions.md` (section 3). The run goes on with the tasks that don't depend on it.
- **Before it deletes its workspace,** copy every `Ruling:` line from its `progress.md` into this ledger. They go to the user in the report and the closing comment.
- **Every implementer and fixer prompt ends with** "Report in at most 20 lines: status, commits, tests run with their result, concerns."
- **Skip its final whole-branch review.** `verify-and-fix`'s review round 1 is the whole-branch review (its `code-reviewer` at the `Final review` row), and it runs after the simplify pass, on the simplified code.
- **Skip its last step,** `finishing-a-development-branch`. Go to section 2b.
- **Every implementer dispatch carries the commit trailers verbatim,** with the words "copy them exactly; do not substitute your own model name".
- **Check the trailers before each task review**, while the commits are still unpushed: `git log --format='%h %s%n%(trailers:only)' <BASE>..HEAD`, where `<BASE>` is the commit recorded before the dispatch. Fix any commit whose trailers differ from the session's with one command: `git rebase <BASE> -x 'git -c trailer.ifexists=replace commit --amend --no-edit --trailer "<trailer line 1>" --trailer "<trailer line 2>"'`. Record a `Ruling:`. A wrong trailer that is already pushed stays.
- **Every dispatch passes `model` and `effort`,** from the config's `## Models` ([config-format.md](config-format.md)): the implementer row the task's `Tier:` line picks (`Implementer (mechanical)`, `Implementer`, `Implementer (complex)`; untagged is `Implementer`), `Task review` for its spec and quality reviewers, `Escalation` for fix rounds 4–5 and any re-dispatch of a stuck implementer. These replace its Model Selection tiers. Never leave either out. **A tier may be raised, never lowered:** when a task turns out harder than its tag (a mechanical task that touches an authorization check), dispatch it a tier up and record a `Ruling:` with the reason. **A batch** (its "Batch small same-shape work") takes the highest tier among its tasks.

## 2b. Simplify

One pass over the whole branch, after the last task's review, and
before `verify-and-fix`. Only the steps below dispatch it.

1. Rewrite the ledger's first line to `Phase: 2b`. The tree is clean after section 2; if `git status --short` shows anything, section 2 is not finished: finish it first.
2. Dispatch `pr-review-toolkit:code-simplifier` with the `Simplify` row of `## Models` (default `sonnet`, `high`) and this prompt, every `<…>` filled in:

   ```
   Simplify the code this branch adds or changes, without changing what it does.

   Scope: the files in `git diff --name-only origin/<base>...HEAD`, and in
   them only the lines that diff adds or changes. You were dispatched fresh:
   "recently modified" and "the current session" mean this diff.

   Standards: the repo's agent instructions (<paths of CLAUDE.md / AGENTS.md
   that apply>) and the code around each change. They replace the JavaScript
   and React list in your own instructions wherever the two differ.

   Settled, do not undo: the plan <plan path> and these rulings:
   <every Ruling: line in this ledger>

   Edit only what keeps behaviour: names, nesting, a duplicate helper merged,
   dead code removed. Never change a public signature, a test's assertions,
   or a log or error message text, and never delete a test. Anything larger
   is a finding, not an edit. Do not commit, push or switch branches.

   End with: one line per edit (file:line, what, why), then `Findings:` with
   one line each (file:line, what you would change), or `none`.
   ```
3. **Commit its edits on their own**, in the repo's commit format (for example `refactor: simplify <area>`), with the commit trailers. Write `Simplify: <short sha> — <n> edits` in the ledger. No edits: `Simplify: no changes`, and a `Ruling: simplify pass made no edits — <its report's first line> — none`. Each of its `Findings:` lines goes in the ledger as `Simplify finding: <line>`. They are not fixed here: one the review round also raises is fixed there, and the rest go under Follow-ups in the closing comment.
4. **If the agent is unavailable,** dispatch `general-purpose` with the same prompt and row, and write a `Ruling:` saying so.

**Resuming at `Phase: 2b`** with no `Simplify:` line: a dirty tree holds the
simplifier's edits (the tasks are all committed); commit them as step 3 says.
A clean tree: dispatch again.
