# Ship config

## Repo
- Host: github
- Tracker: none
- Base branch: main
- Merge: merge

## Gates
| Gate | Command | Only when changed | Timeout |
|---|---|---|---|
| Unit | ls hooks/*.test.mjs skills/*/scripts/*.test.mjs scripts/*.test.mjs > /dev/null && node --test 'hooks/*.test.mjs' 'skills/*/scripts/*.test.mjs' 'scripts/*.test.mjs' | | 10 |
| Skill shape | SKILLS_REQUIRE_PRIVATE=1 node scripts/check-skills.mjs | skills/**, docs/superpowers/scenarios/**, docs/rationale/**, scripts/check-skills.mjs | 5 |
| Version bump | node scripts/check-version-bump.mjs origin/main | skills/**, hooks/**, .claude-plugin/plugin.json, scripts/check-version-bump.mjs | 1 |

## CI
- Workflow: ci.yml
