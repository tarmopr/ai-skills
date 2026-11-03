# Ship config

## Repo
- Host: github
- Tracker: none
- Base branch: main
- Merge: merge

## Gates
| Gate | Command | Only when changed | Timeout |
|---|---|---|---|
| Unit | node --test 'hooks/*.test.mjs' 'skills/ship-plan/scripts/*.test.mjs' | | 10 |
| Skill shape | SKILLS_ROOT="$PWD/skills" node ~/.claude/skills/_specs/check-skills.mjs | skills/** | 5 |
| Version bump | if git diff --quiet origin/main...HEAD -- .claude-plugin/plugin.json; then echo 'bump version in .claude-plugin/plugin.json'; exit 1; fi | skills/**, hooks/** | 1 |

## CI
- Workflow: None
