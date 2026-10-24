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

This repo is the source of truth. Each skill in `~/.claude/skills/` is a symlink to `skills/<name>/`
here, so editing either path edits the same file, and changes show up in Claude Code at the next session.

- **New machine:** clone the repo and run `./scripts/link-skills.sh` to link every skill, or pass names
  to link only some, e.g. `./scripts/link-skills.sh ship-issue ship-plan verify-and-fix`.
- **New skill:** create `skills/<name>/SKILL.md` in this repo, then run `./scripts/link-skills.sh`.
  If you created it in `~/.claude/skills/` first, move it here, then run the script.
- **Publish a change:** commit and push. Bump `version` in `.claude-plugin/plugin.json` so installed
  copies get the update.
- **Check before pushing:** `claude plugin validate .`

Don't install the plugin on the machine where the symlinks are, or every skill loads twice.
