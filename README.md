# ai-skills

Claude Code skills by Tarmo Protsin.

| Skill | What it does |
| :- | :- |
| `ship-issue` | Takes an issue or a described problem through design, spec and plan to a merged PR (runs `ship-plan`). Works on GitHub, GitHub Enterprise or Azure DevOps, with Jira, Linear or no tracker |
| `ship-plan` | Carries a written implementation plan, unsupervised, to a merged PR on a green base branch. Works on GitHub, GitHub Enterprise or Azure DevOps, with Jira, Linear or no tracker |
| `verify-and-fix` | Brings a branch or PR to merge-ready: runs the repo's gates, UI scenarios and review rounds until clean, and answers the PR's review comments, from people and Copilot. Works on GitHub, GitHub Enterprise or Azure DevOps |
| `handoff` | Writes session state to a handoff file so work can continue in a fresh context |
| `continue-handoff` | Picks up the newest pending handoff in a new session |
| `retro` | Turns the current session's learnings into proposed changes to skills, CLAUDE.md/AGENTS.md, hooks, run logs and memory, and applies the ones you pick |

## Install

```bash
claude plugin marketplace add tarmopr/ai-skills
claude plugin install ai-skills@tarmopr
```

Skills are then available as `/ai-skills:ship-plan`, `/ai-skills:verify-and-fix` and so on. Get updates with
`claude plugin marketplace update tarmopr`.

## Maintaining (author workflow)

This repo is the source of truth. Every machine, the author's included, uses the skills through the
marketplace plugin (see Install), not through symlinks in `~/.claude/skills/`. Edit the skills here only:
the installed copy under `~/.claude/plugins/cache/` is replaced on every update.

- **New machine:** run the two Install commands. Cloning the repo is only needed to edit it.
- **New skill:** create `skills/<name>/SKILL.md` in this repo. Never add a copy or a symlink to
  `~/.claude/skills/`: with the plugin installed, every skill would load twice.
- **Publish a change:** commit on a branch, open a PR, and bump `version` in
  `.claude-plugin/plugin.json` so installed copies get the update. Once it is merged, run
  `./scripts/update-plugin.sh` (marketplace update, then plugin update) and restart Claude Code.
- **Check before pushing:** `claude plugin validate .`
