# Ship an issue: spec phase

Sections I0–I3 of [ship-issue](SKILL.md). Everything in SKILL.md applies here.

## I0. Route: what already exists

**Under `## Logs` `Location: local`,** when the store holds no log, copy the tracked logs into it first, as [`## Logs`](../ship-plan/config-format.md#-logs) says.

**Read the argument first,** without a `--runner`, `--session` or `--small` flag at its start or end (SKILL.md's "Runner or session"; the same words inside the text are text):

- **Its first word names an existing `.superpowers/ship-issue/<dir>/`** (an issue key as file names write it, so GitHub Issues' `#<n>` names `<n>/`; or with no issue the slug) in this checkout or one `git worktree list` shows: this is a resume, and the rest of the argument is answers. Record each as `Asked: … — <answer>` and a `Ruling: user <date>`, then continue from the ledger's first line.
- **An issue key** (the tracker's *Issue keys*): that is the issue.
- **Anything else** is a description, with no key yet: go to I1.
- **No argument:** take the key (with no issue, the slug) from the current branch name, but only if this skill's ledger for that key exists in this checkout; otherwise ask the I1 question. Never take a key from a branch you did not start.

With a key, take the first matching row. The issue's status comes from the tracker's *Read an issue*; with no issue, the first row does not apply:

| Found | Go to |
|---|---|
| Issue in status category Done (done, canceled, duplicate) | Stop and report. Ship nothing. |
| **A live run:** a ship-plan or ship-issue ledger for it, in any checkout (`git worktree list` shows them), changed in the last 30 minutes (`stat -f %Sm <ledger>` on macOS, `stat -c %y <ledger>` on Linux), or in the last 2 hours with a last line saying it is waiting (a sleep, a CI watch). **Not live:** a ship-issue ledger whose last line is `Waiting: batch …` and this run brings the answers | Stop and report: another session holds it. Older than that: resume, and write a `Lesson:`. |
| The issue's branch is checked out where this session cannot work: a worktree-isolated session, with the branch in the main checkout | Stop and report: "resume with `/ship-issue <KEY-n>` from a session in `<that checkout>`". |
| A ship-plan ledger for the issue's branch, or an open PR for the issue (the host's *Find open PRs*: by search for `<KEY-n>`; with no issue, the branch's own PR) | Invoke ship-plan **with no argument** but `--session` (I6), or with the user's answers and `--session` if this run was started with some. It resumes from its own ledger. |
| A committed plan for the issue, and the issue description already holds its `## Plan` | I6 |
| A committed plan, the issue not yet updated | I5 → I6 |
| This skill's ledger: its last `Stage:` line is `Stage: plan done <path> — combined with spec (small)`, that plan not yet committed (a `small` run cut off before I4) | I3 if the spec holds a `[pending Q<n>` marker or a batch waits, else I4 |
| This skill's ledger: its last `Stage:` line is `dispatched`, with no `done` after it (the session died during a stage) | Dispatch that stage again, same mode; it overwrites the file |
| A spec holding a `[pending Q<n>` marker | I3: the batch, or the answers this run brings |
| A spec with no plan | I4 |
| Anything less | I1 |

A spec or plan "for the issue" is a file under `docs/superpowers/specs/` or
`docs/superpowers/plans/` whose name contains the key in either case (with no issue, the slug). Do not redo approved work. An existing spec or plan counts as approved.

## I1. The issue

Every tracker call is made as the tracker's file says. A tracker call that fails is parked with its exact error in the I3 batch, as the tracker's *Auth* says, and nothing that needs the issue starts until it is answered. Only `Tracker: none` runs without an issue.

- **`Tracker:` undecided** (no `Tracker:`, no `## Jira`, no `## Linear`, no `## GitHub Issues`): ask "Which tracker does this repo use?" (templates-issue.md) **before anything else in I1, and wait for the answer.** Write it as `Tracker: <jira, linear, github or none>` in the config's `## Repo`, with the tracker's section drafted from the issue question (the tracker's *Where a new issue goes*), committed on the feature branch with the first commit this run makes (with `## Slack` when I3 asked too). A drafted config gets it inside the draft instead. Then read `../ship-plan/trackers/<tracker>.md`, unless the answer is `none`.
- **`Tracker: none`:** there is no issue and no issue question; the PR is the record. With no description given, ask "Describe the problem". Then go on with the slug (The ledger), and skip I5.
- **Issue key given:** the tracker's *Read an issue*: the issue with its comments and linked issues. Read the linked issues too.
- **Description given (no key):** ask the "Issue question" (templates-issue.md) **before continuing**, without the "No issue" option, and wait for the answer. Its candidates come from the tracker's *Find an issue*, and the places a new issue can go from the tracker's *Where a new issue goes*. Nothing else starts until the run has a key.
  - **An existing issue chosen:** continue as for a key given.
  - **A new issue:** create it as that question says (the chosen place and related issue), with two deliberate differences from "New issue": the description is only the template's problem paragraph, as the user described it (I5 adds the plan), and you set **no assignee and no status**. ship-plan's section 1 sets them when work starts.
- **Neither key nor description given:** ask first, with `AskUserQuestion`: "An existing issue (give the key)" or "Describe the problem". A description then goes through the issue question above.

These are the only questions asked before research.

**Size the issue,** from what I1 read; it picks the Spec stage's `## Models` row (I2 step 4):

- `small`: the change stays in one module or service; the issue says what to change, or it is a bug with a reproduction; and it needs no migration, widens no access, changes no money and adds no public contract (a route, an event, a schema). Configuration values, documentation, a rename, a flag, a validation rule or a step order are `small`. A value the issue does not give is a question for the batch, not a reason for `standard`;
- `standard`: a change across modules or services, a new public contract, or anything on the fail list: it widens access, changes money, needs a migration, or does something a follow-up commit cannot undo.

**`--small` given** (SKILL.md's "Runner or session"): the size is `small`, whatever the criteria above say. Write `Size: small — user: --small`. The Spec stage then returns `Resize:` only for the fail list (above); a change across modules or a new public contract stays `small`, with a `Ruling:` naming it.

Write `Size: <small|standard> — <the issue's words that decide it, quoted>` in the ledger once the checkout is chosen. A size may be raised, never lowered: a `small` Spec stage that finds the change is `standard` returns `Resize:` (I2 step 6).

Then choose the checkout (section W) before writing anything.

## I2. Research and spec: the Spec stage

1. **Branch,** once the issue key is known: `git switch -c <branch> origin/<base>` in the checkout chosen in section W (in a new worktree, from its detached `origin/<base>`), named by the config's `Branch:` pattern: `<type>/<KEY-n>-<slug>`, the key written as the tracker's *Issue keys* says (with no issue, `<type>/<slug>`). `<type>` is one of ship-plan's five (`feature`, `fix`, `docs`, `chore`, `refactor`), even when the config's pattern lists others such as `test`. Never a username prefix, and never the local base branch.
2. **Hand the issue over on disk.** Write `<ledger dir>/issue.md`: the issue as I1 read it (description, comments, linked issues), or the user's description. The stage reads it there and needs no tracker access. **For every open PR the issue names or links,** fetch its state now (the host's *Find open PRs*, a named PR's state, then `git fetch origin <its head branch>` and `git log --oneline origin/<base>..origin/<its head branch>`) and add it to `issue.md`: its head commit and the commits not yet on `<base>`. The same applies when this run creates the issue (I1): fetch the related PR's head right before writing its Context, and describe what the head holds, not what the PR's title says. **When the issue has a parent,** also list in `issue.md` the parent's sub-tasks that the tracker's *Read an issue* finds, where the tracker has them, looked up at this step (once the base commit date is known).
3. **Where the spec lives,** written into the ledger's first line as `Spec: <path>` before the dispatch: `<checkout>/docs/superpowers/specs/<yyyy-mm-dd>-<KEY-n>-<slug>-design.md`, committed on the feature branch, never in a second worktree. The key in a file name (the spec, the plan) is written the way the config's `Branch:` pattern writes it; titles, commit subjects and text keep the tracker's form.
4. **Dispatch the Spec stage** ([stage-prompts.md](stage-prompts.md), mode `new`, with `<spec path>` from step 3) with the `Spec stage (small)` row of `## Models` when the ledger's last `Size:` line says `small` (default `sonnet`, `high`), otherwise the `Spec stage` row (default `opus`, `high`); its builder check runs at the `Spec check` row (default `sonnet`, `high`). **A `small` row runs light** (the prompt's "Row small" section): a short research budget, one approach, no brainstorming skill and no builder check, a short spec, and the plan written in the same dispatch when no question is left, so I4 dispatches no Plan stage. It researches (code, history, the running system, read-only by [evidence.md](evidence.md)), records the baseline, drafts the approaches, rules where the confidence test passes, and writes the spec with each open choice marked `[pending Q<n>: …]`.
5. **Meanwhile, check the environment** for the later ship-plan run yourself: the Prerequisites (can they run in the chosen checkout?), auth (the host's *Auth check* (the auth status only, not your login); the tracker's *Auth*, unless the tracker is `none`; any auth check a Prerequisites row or `## Evidence` names), and **the base branch's last CI runs**: the host's *Find the base-branch run* (the base branch's last runs). A red base branch from someone else's work goes in the spec (step 6); ship-plan section 5, step 2 says how the run handles it. A command that would write to a shared environment goes in the batch instead.
6. **Take the report in.** A `Resize: standard — <reason>` line (a small-row stage that found the change crosses modules, adds a public contract or hits the fail list; it wrote no spec): write `Size: standard — <its reason>` and dispatch the Spec stage again, mode `new`, at the `Spec stage` row. `Status:` other than `done`: a wrong checkout is a bug in this run (fix the path and dispatch again); `blocked` goes in the batch. Otherwise check its `Skills:` line names the stage's required sub-skill (`superpowers:brainstorming` for the Spec stage in mode `new` at the `standard` row, none for the `small` row's spec, `superpowers:writing-plans` for the Plan stage); if it does not, write `Lesson: <stage> stage did not call <skill> — the stage prompt's REQUIRED SUB-SKILL line`. Then copy its `Ruling:`, `Parked:` and `Lesson:` lines into the ledger, its `Q<n>` lines into the I3 batch, and the step 5 findings into the spec. Check the file it names exists, then commit the spec on the branch. **A report with a `Plan:` path** (a `small` row): check that file exists too, write its path into the ledger's first-line `Plan:` field and `Stage: plan done <path> — combined with spec (small)` after the `Stage: spec done` line, and check its `Skills:` line names `superpowers:writing-plans` as well. That plan was written before the step 5 findings: copy them into its "Close-out notes for ship-plan" too. Never re-check its research yourself.

## I3. The one question batch

Collect every question the rest of the run could need, then ask them together.

1. **Design decisions:** the Spec stage's `Q<n>` lines, as it wrote them. It already applied ship-plan's confidence test (section 3); don't re-rule them here.
2. **What ship-plan's pre-flight would ask** (ship-plan section 0, steps 1, 6 and 8, and its authorization section): a draft config; the exact allow lines (`Bash(<command>)`) for every gate and Prerequisites command, in a permission mode that prompts; hosted sign-ins for `## UI testing` (a `Hosted URL:` one only if `## Allowed` lacks `Sign in on Hosted URL: test users`); a merge that `## CI` `Merge deploys to:` names and `## Allowed` doesn't cover (ship-plan section 5, step 3); a drafted tracker section (`## Jira`, `## Linear` or `## GitHub Issues`); **the Slack channel, if neither the config nor `.claude/ship-plan.local.md` has `## Slack`**: **When `## Slack` is missing from the config and from `.claude/ship-plan.local.md`, read [notifiers/slack.md](../ship-plan/notifiers/slack.md) and choose the channel.** Ask it as the notifier's *Choose the channel* says; the answer is written to the committed config only: commit `## Slack` to the config on the branch with the next commit this run makes; and anything on the "does not authorize" list. Ask them now, so ship-plan's pre-flight has nothing left.
3. **Environment decisions** (section W) that could not be settled.
4. **Standing answers** remove questions. Apply them first.

Ask with `AskUserQuestion`: at most 4 questions, the recommended option first,
marked "(Recommended)". If there are more than 4, or they need free text, send
one numbered message. End it with: **"Answer with `/ship-issue <KEY-n>
<your answers>`. I'm carrying on with everything that doesn't depend on it."**
With `## Runner` `Mode: runner` (a session-mode run there, SKILL.md's "Runner
or session"), the form is `/ship-issue <KEY-n> <your answers> --session`.
Carry on meanwhile with everything the
answers don't block. **Empty batch: ask nothing.** Each answer becomes a
`Ruling: user <date>` line. Answers to `Q<n>` lines go into the spec through
the Spec stage in mode `revise` (same `## Models` row), never by editing the
spec here; commit its result.
A `small` row's revise also writes the plan, or updates one it wrote; take
its report in as I2 step 6 says.

**As soon as the answers arrive, before the revise stage,** update the issue
(skipped with no issue); I5 adds only the plan:

- the tracker's *Comment*: the questions and the answers, one line each.
- **An answer that makes this issue wait for another issue or PR** ("wait for #<n>", "after ENG-123 merges"): link the two at once, as the tracker's *Link two issues* says for an issue that waits. A PR without its own issue: link the issue its branch or title names. Say in the comment what this issue waits for.

**A question found after the batch** is itself a lesson. Rule on it if the
confidence test passes. Otherwise, if it blocks the spec or plan, ask it
alone, with the same answer line. If it doesn't block, carry it into ship-plan
as `[needs a decision]` in the plan. Either way, write a `Lesson:` naming the
research step that would have caught it.
