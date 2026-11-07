# Ship config

## Repo
- Host: github
- Tracker: none
- Base branch: main
- Merge: merge

## Gates
| Gate | Command | Only when changed | Timeout |
|---|---|---|---|
| Unit | node --test 'hooks/*.test.mjs' 'skills/*/scripts/*.test.mjs' | | 10 |
| Skill shape | node scripts/check-skills.mjs | skills/**, docs/superpowers/scenarios/**, scripts/check-skills.mjs | 5 |
| Version bump | if git diff --quiet origin/main...HEAD -- .claude-plugin/plugin.json; then echo 'bump version in .claude-plugin/plugin.json'; exit 1; fi | skills/**, hooks/** | 1 |

## CI
- Workflow: ci.yml
