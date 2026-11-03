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
| Skill shape | node ~/.claude/skills/_specs/check-skills.mjs | skills/** | 5 |

## CI
- Workflow: None
