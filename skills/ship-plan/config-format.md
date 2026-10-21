# `.claude/ship-plan.md`: the repo config

`ship-plan` and `verify-and-fix` hold the loop: the steps, the order, the rules. This file
holds everything about one repo: every command, reviewer, rule, CI and tracker
setting. **A command that is not in this file is never run as a gate.** The
skills do not guess a repo's tech; they read it here.

## Reading rules

- Sections are found by their `## ` heading, matched case-insensitively and ignoring surrounding whitespace. Order does not matter.
- Every section is optional. A missing section takes the default given below.
- A heading that matches no section here is named in the report as "unknown config section `## <heading>`". It is never silently ignored: a typo would otherwise switch something off.
- An unknown section's rows are not applied, with one exception: a heading that resembles `Never do`, `Fix rules` or `Security extras` (`## Never-do`, `## never do:`) is applied as that section anyway and flagged, because those sections only restrict. A near-miss of any other section (`## Gate`, `## Jira tracking`) is not applied.
- A table row with an empty command is skipped and named in the report.
- The config can add to the skills' "never on its own" list. Nothing in it removes anything from that list or widens the authorization.
- No secret goes in this file; it is committed. Name where a secret comes from instead.

## Sections

### `## Repo`

| Field | Meaning | Default |
|---|---|---|
| `Base branch:` | The branch PRs target and whose CI must be green | `gh repo view --json defaultBranchRef --jq .defaultBranchRef.name` |
| `Merge:` | `squash` or `merge` | `squash` |
| `Branch:` | Branch name pattern | `<type>/<slug>`; with an issue `<type>/<id>-<slug>` |
| `Approvals:` | Approvals a PR needs from someone other than the author: `none` (POCs, internal tools) or a number. Overrides what the rulesets say. | read from the base branch's rulesets, else branch protection, else 1 |
| `Copilot review:` | `yes` requests a Copilot review on every PR; `no` does not | `yes` |
| `Review wait:` | Minutes a run polls for reviews before it hands off | 120 |

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
| Gate | Command | Only when changed | Timeout | Allowed skips |
|---|---|---|---|---|
```

- `Only when changed`: comma-separated globs matched against `git diff --name-only origin/<base>...HEAD`. Empty means always.
- `Timeout`: minutes. Default 20.
- `Allowed skips`: the number of skipped tests this gate always reports (standing `skip` / `xfail` markers), with the reason. Up to that many skips is a pass, noted in the gate table; one more is "skipped". Default 0. The last two columns may be left out.
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

### `## CI`

| Field | Meaning | Default |
|---|---|---|
| `Workflow:` | The workflow file whose push run on the base branch is watched | all runs on the merge commit |
| `Green:` | What counts as green | every check on the merge commit is success or skipped |

`None` means the repo has no CI at all, neither on PRs nor on pushes: `ship-plan`
merges once `verify-and-fix` is clean and reports "base branch has no CI". When this
section is absent and `.github/workflows/` holds no workflow file, treat it as
`None`. A repo whose workflows exist but do not cover a given PR or push (path
filters, PR-only triggers) is not `None`; `ship-plan` handles that case per run.

### `## After merge`

Read-only checks run at close-out, once base-branch CI is green: a deployed
version answers, a published artifact exists. Never a write. Default: none.

### `## Jira`

Every run tracks its work in a Jira issue unless the user says otherwise:
with no issue key, both skills ask templates.md's "Jira: issue question".
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
yet: the next run asks once in pre-flight. It writes the answer at once to
`.claude/ship-plan.local.md` (git-ignored, this machine only, the same
`## Slack` format), and commits it here for the team on its feature branch.
This section wins over the local file.

| Field | Meaning |
|---|---|
| `Channel:` | `#<name> (<channel id>)`, or `none` for no post. The id is what `slack_send_message` takes; the name is for people. |

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

## Drafting a missing config

1. **CI first.** Read `.github/workflows/*.yml`. From the jobs that run on `pull_request`, take each `run:` command, in order, as a gate. Setup, checkout, cache and install steps become Prerequisites, not gates. Service containers become a Prerequisites note. A step's `working-directory` becomes part of its command (`cd <dir> && …`). Expand a `${{ }}` expression to its literal value, or drop the step and list it under "consider adding". CI already knows the repo's tech.
   **Never a gate:** a step that deploys, publishes, uploads (coverage, artifacts), comments on the PR, or reads `secrets.*`. Those are outward actions; list them in the batch as "left out".
2. **Manifests fill gaps** when CI is missing or thin: `package.json` scripts, `*.sln` / `*.csproj`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `Makefile`, `Taskfile.yml`. Take only targets named lint, format check, typecheck, test, build.
3. **`## CI`:** `Workflow:` the workflow that runs on `push` to the base branch. No workflow file at all: `None`. Workflows on PRs only: leave `Workflow:` out and note "no push workflow" in the batch.
   **`## Repo`:** set `Merge:` from `gh repo view --json squashMergeAllowed,mergeCommitAllowed`: `squash` when allowed, else `merge`.
4. **Never invent** `## Jira` (the issue question drafts it), `## Slack` (pre-flight asks for it), `## Never do`, `## UI testing` sign-ins, `## Evidence`, `## Worktree`, `## Models`, or reviewers. List them in the batch as "consider adding".
5. **Write the draft** to `.claude/ship-plan.md` and put it at the top of the question batch, with each gate's source (`ci.yml: job test, step 3`). Until the user confirms it, `verify-and-fix` runs no gate. Once confirmed: under `ship-plan`, it is committed on the feature branch; `verify-and-fix` run on its own leaves it uncommitted and says so.

## Examples

Illustrative only. A Node web app:

```markdown
# Ship config

## Repo
- Base branch: main
- Merge: squash
- Approvals: 1
- Review wait: 180

## Prerequisites
| Command | Background | Ready when |
|---|---|---|
| npm ci | no | exit 0 |
| npm run dev | yes | http://localhost:5173 answers |

## Gates
| Gate | Command | Only when changed | Timeout |
|---|---|---|---|
| Lint | npm run lint | | |
| Types | npx tsc --noEmit | | |
| Unit | npx vitest run | | |
| E2E | npx playwright test | src/**, e2e/** | 30 |
| Build | npm run build | | |

## Reviewers by path
| Paths | Agent |
|---|---|
| db/migrations/** | migration-reviewer |

## Security extras
- Every query that reads user data filters by `account_id`.

## Fix rules
- Never edit an existing migration; add a new one.

## UI testing
- URL: http://localhost:5173
- Started by: Prerequisites row `npm run dev`
- Sign-in: users seeded by `db/seed.sql`
- User-visible paths: src/**
- Roles: admin, member

## CI
- Workflow: ci.yml

## Jira
- Site: https://acme.atlassian.net · Project: WEB · Issue type: Task
- Fields: Team = Web
- Start transition: Start progress · Done transition: Done
- Notes: GitHub for Jira links PRs by key; no automation closes issues.

## Evidence
| Source | Environment | Read-only command or tool | Notes |
|---|---|---|---|
| Logs | staging | Grafana Loki, `{app="web"}` | count over 7 days first |
| HTTP | staging | `curl -s https://staging.acme.test/api/health` | no sign-in |

## Worktree
- Copy: .env, .env.local
- Shared: port 5173; container `web-db-test`

## Slack
- Channel: #web-reviews (C0123ABCD)

## Never do
- Run `npm publish`.
```

Gate rows for other stacks:

| Stack | Gates |
|---|---|
| .NET | `dotnet format --verify-no-changes` · `dotnet build -warnaserror` · `dotnet test` |
| Python | `ruff check .` · `mypy .` · `pytest -q` |
| Go | `go vet ./...` · `go test ./...` |
| Terraform | `terraform fmt -check -recursive` · `terraform validate` · `tflint` |
