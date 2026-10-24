# Drafting a missing config

Read only when the config is missing or a section must be drafted. The format is in [config-format.md](config-format.md).

## Drafting a missing config

0. **Host and tracker.** `Host:` comes from `git remote get-url origin` (`dev.azure.com` or `*.visualstudio.com` is `azure-devops`; anything else, GitHub Enterprise included, is `github`), and is written into the draft's `## Repo`. No `origin` remote: write no `Host:`, and note in the batch that PRs can't be opened. `Tracker:` comes from the tracker question (templates-issue.md, "Which tracker does this repo use?"), never from a guess; write it with the tracker's section.
1. **CI first.** On GitHub, read `.github/workflows/*.yml`. From the jobs that run on `pull_request`, take each `run:` command, in order, as a gate. Setup, checkout, cache and install steps become Prerequisites, not gates. Service containers become a Prerequisites note. A step's `working-directory` becomes part of its command (`cd <dir> && …`). Expand a `${{ }}` expression to its literal value, or drop the step and list it under "consider adding". CI already knows the repo's tech.
   **On Azure DevOps,** read the host's *Where CI is defined*. YAML pipelines are read like workflows: the `script:` and task steps of the jobs the PR build policy runs, in order, with the same never-a-gate rule. A classic pipeline has no commands to read: take the gates from the manifests (step 2) and put the pipeline id in `## CI`.
   **Never a gate:** a step that deploys, publishes, uploads (coverage, artifacts), comments on the PR, or reads `secrets.*`. Those are outward actions; list them in the batch as "left out".
2. **Manifests fill gaps** when CI is missing or thin: `package.json` scripts, `*.sln` / `*.csproj`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `Makefile`, `Taskfile.yml`. Take only targets named lint, format check, typecheck, test, build.
3. **`## CI`:** `Workflow:` the workflow that runs on `push` to the base branch (on Azure DevOps, the pipeline definition id). No CI at all, by the host's *Has CI*: `None`. Workflows on PRs only: leave `Workflow:` out and note "no push workflow" in the batch.
   **`## Repo`:** set `Merge:` from the host's *Allowed merge methods*: `squash` when allowed, else `merge`.
4. **Never invent** `## Jira` and `## Linear` (the issue question drafts them), `## Slack` (pre-flight asks for it), `## Never do`, `## UI testing` sign-ins, `## Evidence`, `## Worktree`, `## Models`, or reviewers. List them in the batch as "consider adding".
5. **Write the draft** to `.claude/ship-plan.md` (commit message `chore: add ship-plan config`) and put it at the top of the question batch, with each gate's source (`ci.yml: job test, step 3`). Until the user confirms it, `verify-and-fix` runs no gate. Once confirmed: under `ship-plan`, it is committed on the feature branch; `verify-and-fix` run on its own leaves it uncommitted and says so.

## Examples

Illustrative only. A Node web app:

```markdown
# Ship config

## Repo
- Host: github
- Tracker: jira
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
