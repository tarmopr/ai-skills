# `.claude/ship-plan.md`: the repo config

`ship-plan` and `verify-and-fix` hold the loop: the steps, the order, the rules. This file
holds everything about one repo: every command, reviewer, rule, CI and tracker
setting. **A command that is not in this file is never run as a gate.** The
skills do not guess a repo's tech; they read it here.

**When the config is missing or a section must be drafted, read [config-drafting.md](config-drafting.md).**

## Reading rules

- Sections are found by their `## ` heading, matched case-insensitively and ignoring surrounding whitespace. Order does not matter.
- Every section is optional. A missing section takes the default given below.
- A heading that matches no section here is named in the report as "unknown config section `## <heading>`". It is never silently ignored: a typo would otherwise switch something off.
- An unknown section's rows are not applied, with one exception: a heading that resembles `Never do`, `Fix rules` or `Security extras` (`## Never-do`, `## never do:`) is applied as that section anyway and flagged, because those sections only restrict. A near-miss of any other section (`## Gate`, `## Jira tracking`) is not applied.
- A table row with an empty command is skipped and named in the report.
- The config can add to the skills' "never on its own" list. Nothing in it removes anything from that list or widens the authorization, except the closed list in `## Allowed`.
- No secret goes in this file; it is committed. Name where a secret comes from instead.

## Repo override files

A repo extends a shared skill file with a file of the same name at
`.claude/ship-plan/<skill>/<file>.md`, where `<skill>` is `ship-plan`, `ship-issue` or
`verify-and-fix`. Examples:

- `.claude/ship-plan/verify-and-fix/ui-testing.md` extends `verify-and-fix/ui-testing.md`;
- `.claude/ship-plan/ship-issue/evidence.md` extends `ship-issue/evidence.md`, and holds the repo's own research techniques;
- `.claude/ship-plan/ship-plan/SKILL.md` extends `ship-plan/SKILL.md`. It is not under `.claude/skills/`, so it is never loaded as a skill of its own.

Rules:

- Whenever a skill reads one of its own files, it reads that file's repo counterpart next, if it exists. No override file: nothing changes.
- An override file may:
  - add steps, facts, commands, test values and failure paths;
  - make a rule stricter;
  - name `blockers.md` entries to read.
- An override file may not widen what a run is authorized to do, or remove a step of the shared file. Such a line is not applied and is named in the report as "override line not applied: `<file>`: `<line>`". Permissions live only in `## Allowed`.
- Logs stay where they are: `.claude/ship-plan/interruptions.md`, `.claude/ship-plan/blockers.md` and `.claude/ship-issue/interruptions.md`. Override files sit in the `<skill>` subfolders, and an override never replaces a log. A repo whose research techniques are still in `.claude/ship-issue/evidence.md` moves them, with `git mv`, to `.claude/ship-plan/ship-issue/evidence.md`: no skill reads the old path.

## Sections

### `## Repo`

| Field | Meaning | Default |
|---|---|---|
| `Host:` | `github` or `azure-devops` | From `git remote get-url origin`: `dev.azure.com` or `*.visualstudio.com` is `azure-devops`; anything else, GitHub Enterprise included, is `github`. Never asked when an `origin` remote exists; written only into a drafted config, never added to an existing one. |
| `Tracker:` | `jira`, `linear` or `none` | `## Jira` present: `jira`. `## Linear` present: `linear`. Neither: not decided yet; asked once with the issue question, then written here. |
| `Base branch:` | The branch PRs target and whose CI must be green | the host's *Default branch* |
| `Merge:` | `squash` or `merge` | `squash` |
| `Branch:` | Branch name pattern | `<type>/<slug>`; with an issue `<type>/<id>-<slug>` |
| `Approvals:` | Approvals a PR needs from someone other than the author: `none` (POCs, internal tools) or a number. Overrides what the rulesets say. | read from the base branch's rulesets, else branch protection, else 1 |
| `Copilot review:` | `yes` requests a Copilot review on every PR; `no` does not | `yes` |
| `Review wait:` | Minutes a run polls for reviews before it hands off | 120 |

Fields that mean something different per host:

- `Approvals:`. GitHub: rulesets, then branch protection, as the default says. Azure DevOps: the base branch's "Minimum number of reviewers" policy; no such policy means 0, because the policies were readable. The default is the host's *Read the review rule*.
- `Copilot review:`. GitHub only. On Azure DevOps it defaults to `no`, and a `yes` is named in the report as having no effect.
- `## CI` `Workflow:`. A workflow file on GitHub, a pipeline definition id on Azure DevOps.

`<type>` is one of `feature`, `fix`, `docs`, `chore`, `refactor`. `<slug>` is
3–6 words of the title in kebab case. Never a username prefix.

### `## Prerequisites`

```markdown
| Command | Background | Ready when |
|---|---|---|
```

Rows run in order before the gates. `Background: yes` rows start with
`run_in_background` and are stopped when the loop ends. `Ready when` is a
command that exits 0 or a URL that answers; poll it for up to 3 minutes. Not
ready: every gate is "could not run", and the reason names the row.
Default: none.

### `## Gates`

```markdown
| Gate | Command | Only when changed | Timeout | Allowed skips | Notes |
|---|---|---|---|---|---|
```

- `Only when changed`: comma-separated globs matched against `git diff --name-only origin/<base>...HEAD`. Empty means always.
- `Timeout`: minutes. Default 20.
- `Allowed skips`: a number or `files: <globs>`, with the reason. Default 0.
  - A number: the skipped tests this gate always reports (standing `skip` / `xfail` markers). Up to that many skips is a pass, noted in the gate table; one more is "skipped".
  - `files: <globs>`: skips inside matching files are allowed, whatever their count. A skip in any other file makes the gate "skipped".
- `Notes`: how to run or judge this gate: a precondition, a second run under another setup, a known local-only failure. `verify-and-fix` follows it as part of the gate. Empty means none.
- The last three columns may be left out.
- Every command runs with `CI=true` in its environment and must be one-shot. A watch-mode or prompting command is a config error to fix, not something to wait on.

Default: none, and then `verify-and-fix` cannot end clean.

### `## Reviewers by path`

```markdown
| Paths | Agent |
|---|---|
```

Agents added to the review round when the diff touches the globs, beside the
generic reviewers. Default: none.

### `## Security extras`

Bullets appended to the generic security checklist: this repo's tenancy or
ownership rule, its access-control helper, its sensitive data. Default: none.

### `## Fix rules`

Bullets the fixer obeys: files never edited, generators to use, expected
values that need a separate justification to change. Default: none.

### `## UI testing`

`None` (the default) means no browser scenarios. Otherwise:

| Field | Meaning |
|---|---|
| `URL:` | Where the app runs |
| `Started by:` | A Prerequisites row, or a command |
| `Sign-in:` | Where test users come from. Never a password. |
| `User-visible paths:` | Globs. A diff touching them needs scenarios. |
| `Roles:` | The roles scenarios must cover |
| `Writes allowed:` | `yes` lets scenarios create and delete their own rows on a hosted URL. Default `no`: on a hosted URL only read-only scenarios run, and write scenarios are reported as pending. A local URL always allows writes. |
| `Notes:` | Facts for driving scenarios: a preflight command for a third-party flow and what it must report, test-mode values, what cannot run at `URL:`, the UI's languages, extra failure paths. `ui-testing.md` follows it. Longer procedures go in the override file `.claude/ship-plan/verify-and-fix/ui-testing.md`. Default: none. |
| `Hosted URL:` | Where scenarios that cannot run at `URL:` run, after the merge. The hosted-URL rules apply: the user signs in, unless `## Allowed` has `Sign in on Hosted URL: test users`, and only read-only scenarios run unless `Writes allowed: yes`. Default: none, and no scenario runs after the merge. |

### `## CI`

| Field | Meaning | Default |
|---|---|---|
| `Workflow:` | The workflow file whose push run on the base branch is watched | all runs on the merge commit |
| `Green:` | What counts as green | every check on the merge commit is success or skipped |
| `Merge deploys to:` | `<env>[, <env>]`: the environments base-branch CI deploys to after a merge. A fact, set by a person, a drafted config or a lesson; it grants nothing. A merge check uses the union of the base branch's and the branch's own ([`## Allowed`](#-allowed)). Present: the merge rule in `## Allowed` applies. | none: merging works as today |

`None` means the repo has no CI at all, neither on PRs nor on pushes: `ship-plan`
merges once `verify-and-fix` is clean and reports "base branch has no CI". When this
section is absent and the host's *Has CI* is false, treat it as `None`. A missing `.github/` folder alone never means `None`. A repo whose workflows exist but do not cover a given PR or push (path
filters, PR-only triggers) is not `None`; `ship-plan` handles that case per run.

### `## After merge`

Read-only checks run in `ship-plan`'s section 6b, once base-branch CI is green: a deployed
version answers, a published artifact exists. Never a write. Default: none.

### `## Jira`

Every run tracks its work in a Jira issue unless the user says otherwise:
with no issue key, both skills ask templates-issue.md's "Issue question".
Absent: that question finds the site and drafts this section.

| Field | Meaning | Default |
|---|---|---|
| `Site:` | Atlassian site URL, passed as `cloudId` | required |
| `Project:` | Default project for new issues: the recommended answer in the issue question | none |
| `Issue type:` | Type for new issues | Task |
| `Fields:` | Extra fields for new issues, as `additional_fields` (e.g. a required team or component) | none |
| `Start transition:` | Transition name applied when implementation starts | required |
| `Review transition:` | Transition name applied when the PR is opened for review, e.g. "Start review" | none: the issue stays in the start status |
| `Done transition:` | Transition name applied when Done means is met | required |
| `Done means:` | When the issue may be closed | merged and base-branch CI green; with CI `None`, merged |
| `Notes:` | Facts about the site, e.g. whether an automation moves issues on PR merge | none |

Transitions are named as on the issue's workflow buttons, not by the status
they lead to: "Start progress" may lead to "In Progress".

### `## Slack`

Where the review request for each new PR is posted. Absent means not decided
yet: the next run asks once in pre-flight and writes the answer here, on its
feature branch. This committed section is the only place a run writes the
channel. `.claude/ship-plan.local.md` (git-ignored, this machine only, the same
`## Slack` format) is read when this section is missing, so a machine that
answered before keeps working, and is never written. This section wins over the
local file.

| Field | Meaning |
|---|---|
| `Channel:` | `#<name> (<channel id>)`, or `none` for no post. The id is what `slack_send_message` takes; the name is for people. |
| `People:` | A table, `host login | Slack user id`, repo-wide because reviewers belong to the team. Filled the first time a login is seen. Used to @-mention people in the re-review request; a login not in it is named in plain text. |

### `## Linear`

Present when `Tracker: linear`. Absent with a Linear tracker: the issue
question finds the team and drafts this section.

| Field | Meaning | Default |
|---|---|---|
| `Team:` | Team name and key | required |
| `Project:` | Project name | none |
| `Start status:` | Set when implementation starts | required |
| `Review status:` | Set when the PR is opened for review | none: the issue stays in the start status |
| `Done status:` | Set when Done means is met | required |
| `Done means:` | When the issue may be closed | merged and base-branch CI green; with CI `None`, merged |
| `Notes:` | Facts about the workspace, e.g. whether an integration closes issues | none |

### `## Evidence`

Read by `ship-issue` only; `ship-plan` and `verify-and-fix` skip it. The
read-only sources a run may use to measure the running system before designing
a change (`ship-issue`'s evidence.md). A source not listed here is never used.

```markdown
| Source | Environment | Read-only command or tool | Notes |
|---|---|---|---|
```

Default: none, and then research is code and history only.

### `## Worktree`

Read by `ship-issue` only, when it has to create a worktree because the
current checkout is busy. Dependencies come from `## Prerequisites`.

| Field | Meaning | Default |
|---|---|---|
| `Copy:` | Git-ignored files a run needs, copied from the main checkout (`.env`, local secrets files) | none |
| `Shared:` | Resources two checkouts cannot use at once: fixed container names, ports | none |

### `## Models`

The model and effort for each subagent role. Every dispatch passes both
explicitly: an omitted model inherits the session's, and the session is
usually the most expensive seat. The session itself (it runs the stages, the
implementation loop, triage and merges) keeps the model it was started on:
start runs on Opus at high effort.

| Role | Used by | Default |
|---|---|---|
| `Spec stage` | `ship-issue` I2: research, design, spec | `opus`, `xhigh` |
| `Plan stage` | `ship-issue` I4: the plan, from the spec alone | `opus`, `high` |
| `Implementer (mechanical)` | `ship-plan` section 2: a task tagged `Tier: mechanical` | `haiku`, `high` |
| `Implementer` | `ship-plan` section 2: a task tagged `Tier: standard`, or untagged | `sonnet`, `high` |
| `Implementer (complex)` | `ship-plan` section 2: a task tagged `Tier: complex` | `opus`, `high` |
| `Escalation` | `ship-plan` section 2: fix rounds 4–5, a stuck implementer | `opus`, `high` |
| `Task review` | `ship-plan` section 2: each task's spec and quality reviewers | `sonnet`, `high` |
| `Final review` | `ship-plan` section 2: the whole-branch review | `opus`, `xhigh` |
| `Simplify` | `ship-plan` section 2b: the simplify pass over the whole diff | `sonnet`, `high` |
| `Review round` | `verify-and-fix` section 4: every review agent | `opus`, `high` |

Model: `sonnet`, `opus`, `haiku`, `fable`, or a full model ID. Effort: `low`,
`medium`, `high`, `xhigh` or `max`. A role left out takes its default; a row
with only a model keeps the default effort.

**Task tiers.** Each plan task may carry a `Tier:` line, which picks its
implementer row:

- `mechanical`: the plan gives the exact code or rename, in 1–2 files, with no design choice left (a rename, a file move, a field the plan spells out);
- `standard`: the usual case, several files following patterns that already exist;
- `complex`: concurrency, security or authorization, a data migration, a change across layers, or a judgment call the plan leaves to the implementer.

When in doubt, `standard`. Mechanical tasks save money only when they pass
first time: cheap models often need more turns, and every fix round adds a
review. If they need fix rounds, set `Implementer (mechanical)` to `sonnet`.

```markdown
## Models
| Role | Model | Effort |
|---|---|---|
| Implementer | sonnet | medium |
| Final review | opus | max |
```

### `## Never do`

Bullets. Each is added to the "never on its own" list of both skills for this
repo: `ship-plan`'s authorization and `verify-and-fix`'s stop conditions. Default: none.

### `## Allowed`

A closed list of opt-in permissions. The skills define the list; a repo can only
switch entries on, one line each. Absent: nothing is switched on, and every run
behaves as today.

| Entry | Meaning |
|---|---|
| `Merge that deploys to: <env>[, <env>]` | Merging is authorized even though base-branch CI then deploys to these non-production environments. A production-like name (below) is not applied, and the report says so. |
| `Sign in on Hosted URL: test users` | On `## UI testing` `Hosted URL:`, the run signs in itself, with the test users that `Sign-in:` names. Without it, the user signs in, as today. |

- **A branch's own edit never widens its own run:** when either field is set, a merge first runs `git diff origin/<base>...HEAD -- .claude/ship-plan.md`. A diff that touches `## Allowed`, or removes or changes `Merge deploys to:` other than by adding an environment, makes the PR a hand merge; otherwise the working tree's `## Allowed` is the base branch's, and its `Merge deploys to:` the union of both.
- **Production-like names:** an environment name that contains `prod`, `prd` or `live`, case-insensitive, is never applied in `Merge that deploys to:`. The report names it; the line's other names still apply.
- **`## Never do` wins:** when a `## Never do` line forbids what an entry allows, the stricter rule wins.
- **Coverage:** `Merge that deploys to:` covers every merge the run is already authorized to make in this repo: the code PR, a fix-forward or revert PR (`red-base.md`), the docs PR and the lessons PR. It never covers rerunning or queueing a run that deploys; the host files' rerun rules stay, and the run hands off instead.
- **The merge rule:** with `## CI` `Merge deploys to:` present, the run merges only when `Merge that deploys to:` covers it: every environment listed there is named in `Merge that deploys to:` and is applied (not production-like). Otherwise the merge goes into the question batch, with the exact `## Allowed` line that would allow it, to add to `.claude/ship-plan.md` on `<base>` only if `<env>` is not production. For a production-like environment no line allows the merge: the batch asks the user to merge it by hand and proposes no `## Allowed` line.
- **Only a person edits it.** A run never adds, changes or removes a line here: not on the feature branch, not in the lessons PR, not when drafting a config. Any PR whose diff touches `## Allowed`, or removes or changes `Merge deploys to:` other than by adding an environment (code, fix-forward, revert, docs or lessons PR), is a hand merge: the run never merges it, it stays open, and the report says why.
- **Visible on every run:** the run lists each switched-on entry in the ledger at pre-flight and in the report's status section.
- **Closed:** a line that is not one of the entries above is named in the report as "unknown `## Allowed` entry: `<line>`" and is not applied. No other section, no override file and no standing answer in `interruptions.md` grants a permission.

## Loosening changes

A config change that loosens what a run checks or may do. These are:

- `Writes allowed: yes`;
- `Approvals:` lowered or `none`;
- `Copilot review: no`;
- a larger `Allowed skips` or new `files:` globs;
- a removed or weakened gate;
- a removed `## Never do` / `## Fix rules` / `## Security extras` line;
- a changed `URL:` / `Sign-in:`, or an added or changed `Hosted URL:`;
- a removed `Merge deploys to:`, or an environment removed from it;
- a changed `Green:` or `Workflow:`;
- a gate `Notes` entry that changes how the gate is judged.

A run proposes each one in the report with its exact line, and never writes it,
unless the user approved that change in this run's batch: an answer there is
approval for that one change. A lessons PR whose config diff holds a change not
on the "may be written" list below, without that approval, is never merged by
the run. A `## Allowed` line is never written, approved or not.

A config lesson that adds a fact or makes a check stricter may be written: a new
gate, a `## Never do` or `## Fix rules` line, a `## UI testing` `Notes:`, a
`Merge deploys to:` environment, a `Prerequisites` row, a tighter `Allowed skips`.
A change that fits both lists is a loosening change. Any other config change is
written only when the user approved it.
