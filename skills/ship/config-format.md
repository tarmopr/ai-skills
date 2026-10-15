# `.claude/ship.md`: the repo config

`ship` and `verify` hold the loop: the steps, the order, the rules. This file
holds everything about one repo: every command, reviewer, rule, CI and tracker
setting. **A command that is not in this file is never run as a gate.** The
skills do not guess a repo's tech; they read it here.

## Reading rules

- Sections are found by their `## ` heading, matched case-insensitively and ignoring surrounding whitespace. Order does not matter.
- Every section is optional. A missing section takes the default given below.
- A heading that matches no section here is named in the report as "unknown config section `## <heading>`". It is never silently ignored: a typo would otherwise switch something off.
- An unknown section's rows are not applied, with one exception: a heading that resembles `Never do`, `Fix rules` or `Security extras` (`## Never-do`, `## never do:`) is applied as that section anyway and flagged, because those sections only restrict. A near-miss of any other section (`## Gate`, `## Linear tracking`) is not applied.
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

Default: none, and then `verify` cannot end clean.

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

`None` means the repo has no CI at all, neither on PRs nor on pushes: `ship`
merges once `verify` is clean and reports "base branch has no CI". When this
section is absent and `.github/workflows/` holds no workflow file, treat it as
`None`. A repo whose workflows exist but do not cover a given PR or push (path
filters, PR-only triggers) is not `None`; `ship` handles that case per run.

### `## After merge`

Read-only checks run at close-out, once base-branch CI is green: a deployed
version answers, a published artifact exists. Never a write. Default: none.

### `## Linear`

Absent means no tracker: the PR is the record. Present:

| Field | Meaning | Default |
|---|---|---|
| `Team:` | Team name and key | required |
| `Project:` | Project name | none |
| `Start status:` | Set when implementation starts | required |
| `Done status:` | Set when Done means is met | required |
| `Done means:` | When the issue may be closed | merged and base-branch CI green; with CI `None`, merged |
| `Notes:` | Facts about the workspace, e.g. whether an integration closes issues | none |

### `## Never do`

Bullets. Each is added to the "never on its own" list of both skills for this
repo: `ship`'s authorization and `verify`'s stop conditions. Default: none.

## Drafting a missing config

1. **CI first.** Read `.github/workflows/*.yml`. From the jobs that run on `pull_request`, take each `run:` command, in order, as a gate. Setup, checkout, cache and install steps become Prerequisites, not gates. Service containers become a Prerequisites note. A step's `working-directory` becomes part of its command (`cd <dir> && …`). Expand a `${{ }}` expression to its literal value, or drop the step and list it under "consider adding". CI already knows the repo's tech.
   **Never a gate:** a step that deploys, publishes, uploads (coverage, artifacts), comments on the PR, or reads `secrets.*`. Those are outward actions; list them in the batch as "left out".
2. **Manifests fill gaps** when CI is missing or thin: `package.json` scripts, `*.sln` / `*.csproj`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `Makefile`, `Taskfile.yml`. Take only targets named lint, format check, typecheck, test, build.
3. **`## CI`:** `Workflow:` the workflow that runs on `push` to the base branch. No workflow file at all: `None`. Workflows on PRs only: leave `Workflow:` out and note "no push workflow" in the batch.
   **`## Repo`:** set `Merge:` from `gh repo view --json squashMergeAllowed,mergeCommitAllowed`: `squash` when allowed, else `merge`.
4. **Never invent** `## Linear`, `## Never do`, `## UI testing` sign-ins, or reviewers. List them in the batch as "consider adding".
5. **Write the draft** to `.claude/ship.md` and put it at the top of the question batch, with each gate's source (`ci.yml: job test, step 3`). Until the user confirms it, `verify` runs no gate. Once confirmed: under `ship`, it is committed on the feature branch; `verify` run on its own leaves it uncommitted and says so.

## Examples

Illustrative only. A Node web app:

```markdown
# Ship config

## Repo
- Base branch: main
- Merge: squash

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

## Linear
- Team: Acme (ACM) · Project: Web
- Start status: In Progress · Done status: Done
- Notes: the GitHub integration does not close issues.

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
