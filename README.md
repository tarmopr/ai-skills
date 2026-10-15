# ai-skills

Claude Code skills by Tarmo Protsin.

| Skill | What it does |
| :- | :- |
| `ship` | Carries a written implementation plan, unsupervised, to a merged PR on a green base branch |
| `verify` | Brings a branch or PR to merge-ready: runs the repo's gates, UI scenarios and review rounds until clean |
| `handoff` | Writes session state to a handoff file so work can continue in a fresh context |
| `continue-handoff` | Picks up the newest pending handoff in a new session |

## Install

```bash
claude plugin marketplace add tarmopr/ai-skills
claude plugin install ai-skills@tarmopr
```

Skills are then available as `/ai-skills:ship`, `/ai-skills:verify` and so on. Get updates with
`claude plugin marketplace update tarmopr`.

## Maintaining (author workflow)

This repo is the source of truth. Each skill in `~/.claude/skills/` is a symlink to `skills/<name>/`
here, so editing either path edits the same file, and changes show up in Claude Code at the next session.

- **New machine:** clone the repo and run `./scripts/link-skills.sh`.
- **New skill:** create `skills/<name>/SKILL.md` in this repo, then run `./scripts/link-skills.sh`.
  If you created it in `~/.claude/skills/` first, move it here, then run the script.
- **Publish a change:** commit and push. Bump `version` in `.claude-plugin/plugin.json` so installed
  copies get the update.
- **Check before pushing:** `claude plugin validate .`

Don't install the plugin on the machine where the symlinks are, or every skill loads twice.
