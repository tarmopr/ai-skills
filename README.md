# ai-skills

Claude Code skills by Tarmo Protsin.

| Skill | What it does |
| :- | :- |
| `ship-queue` | Ships every sub-issue of a parent issue with `ship-issue`, one after another; logs what could not finish, moves on, and ends with a summary of what you need to do. Linear or Jira |
| `ship-issue` | Takes an issue or a described problem through design, spec and plan to a merged PR (runs `ship-plan`). Works on GitHub, GitHub Enterprise or Azure DevOps, with Jira, Linear, GitHub Issues or no tracker |
| `ship-plan` | Carries a written implementation plan, unsupervised, to a merged PR on a green base branch. Works on GitHub, GitHub Enterprise or Azure DevOps, with Jira, Linear, GitHub Issues or no tracker |
| `verify-and-fix` | Brings a branch or PR to merge-ready: runs the repo's gates, UI scenarios and review rounds until clean, and answers the PR's review comments, from people and Copilot. Works on GitHub, GitHub Enterprise or Azure DevOps |
| `handoff` | Writes session state to a handoff file so work can continue in a fresh context |
| `continue-handoff` | Picks up the newest pending handoff in a new session |
| `retro` | Turns the current session's learnings into proposed changes to skills, CLAUDE.md/AGENTS.md, hooks, run logs and memory, and applies the ones you pick |

## Install

```bash
claude plugin marketplace add tarmopr/ai-skills
claude plugin install ai-skills@tarmopr
```

From a clone of this repo, `./scripts/install-plugin.sh` does both, skipping whichever is already done.

Skills are then available as `/ai-skills:ship-plan`, `/ai-skills:verify-and-fix` and so on. Get updates with
`claude plugin marketplace update tarmopr`.

## Switching a repo to GitHub Issues

Update the plugin first (`claude plugin marketplace update tarmopr`, then `/reload-plugins`). Then set
`- Tracker: github` under `## Repo` in the repo's `.claude/ship-plan.md`. The next run drafts a
`## GitHub Issues` section with the defaults (`in-progress` and `in-review` labels) if the config has none.
Status is shown with labels, progress with issue comments, and the run closes the issue itself once
`Done means:` is met; it never writes a closing keyword such as `Fixes #<n>`.

## Repo-specific instructions

The shared skills name no repo. A repo adds its own instructions in override files at
`.claude/ship-plan/<skill>/<file>.md` (for example `.claude/ship-plan/verify-and-fix/ui-testing.md`):
whenever a skill reads one of its own files, it reads the repo's file of the same name next. An override may
add steps or make a rule stricter, never widen what a run may do. The config's `## Allowed` section is a closed
list, edited only by a person, of the few permissions a repo can switch on, such as a merge that deploys to a
staging environment. See [config-format.md](skills/ship-plan/config-format.md).

## Models, review size and the dispatch hook

Each subagent role runs at the model and effort of its row in the config's `## Models` (defaults in
`skills/ship-plan/config-format.md`). `ship-issue` sizes each issue: a `small` one (one module, a clear
reproduction or a spelled-out change, nothing touching access, money or migrations) gets its spec on
`Spec stage (small)`, the rest on `Spec stage`. `verify-and-fix` sends a small diff (at most 200 changed lines,
nothing under `## Risk paths`) to one code reviewer plus the security review, and later rounds review only the
fixes. `ship-queue` runs each sub-issue in a fresh `claude -p` child session (`## Queue`, `Queue run` row) and
logs each one's cost. While a ship run is live, the plugin's `PreToolUse` hook refuses any Agent dispatch that
passes no `model` or no `effort`.

## Ship runner (opt-in)

Set `## Runner` `Mode: runner` in `.claude/ship-plan.md`, or pass `--runner`, and a dependency-free Node script
(`skills/ship-plan/scripts/runner.mjs`) runs each phase (spec, plan, implement in chunks, verify, merge, close) as a
short headless `claude -p` child. The session you started only relays progress and questions, so it works with
Remote Control on a phone. A question parks only that sub-issue and the queue goes on. The default is
`Mode: session`, today's single-session path.

## Maintaining (author workflow)

This repo is the source of truth. Every machine, the author's included, uses the skills through the
marketplace plugin (see Install), not through symlinks in `~/.claude/skills/`. Edit the skills here only:
the installed copy under `~/.claude/plugins/cache/` is replaced on every update.

- **New machine:** run the two Install commands, or `./scripts/install-plugin.sh` from a clone.
  Cloning the repo is only needed to edit it.
- **New skill:** create `skills/<name>/SKILL.md` in this repo. Never add a copy or a symlink to
  `~/.claude/skills/`: with the plugin installed, every skill would load twice.
- **Publish a change:** commit on a branch, open a PR, and bump `version` in
  `.claude-plugin/plugin.json` so installed copies get the update. Once it is merged, run
  `./scripts/update-plugin.sh` (marketplace update, then plugin update), then `/reload-plugins` in each running
  Claude Code session (new sessions load it on their own).
- **Check before pushing:** `claude plugin validate .`
