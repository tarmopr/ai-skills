# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A Claude Code plugin (`ai-skills@tarmopr`, manifest `.claude-plugin/plugin.json`, marketplace `.claude-plugin/marketplace.json`) holding Markdown skills plus a few dependency-free Node scripts. The repo is public: plans and specs that name real repos stay local (`docs/superpowers/plans/`, `docs/superpowers/specs/`, `.superpowers/` are gitignored).

The repo is the source of truth. Installed copies come only through the marketplace plugin. Never add copies or symlinks to `~/.claude/skills/`, or every skill loads twice. Never edit `~/.claude/plugins/cache/`, because each update replaces it.

## Commands

- Unit tests: `node --test 'hooks/*.test.mjs' 'skills/*/scripts/*.test.mjs' 'scripts/*.test.mjs'`. With globs that match nothing, `node --test` passes with 0 tests, so the gate and CI run `ls` on the globs first.
- Single test file: `node --test skills/ship-plan/scripts/runner-queue.test.mjs`. Filter by name with `--test-name-pattern='<regex>'`.
- Skill shape check: `SKILLS_REQUIRE_PRIVATE=1 node scripts/check-skills.mjs [skill file …]`. For the files in its `FILES` table (the four ship skills, ship-queue to verify-and-fix), it pins:
  - required headings, including the `##` operation headings in `hosts/`, `trackers/` and `notifiers/`;
  - the phrases and read-line forms the skills must keep;
  - each of those skills' exact `allowed-tools`.

  A file missing from `FILES` gets no shape check (it is skipped silently), so add new ship-skill files there. The privacy scan covers every published `.md` file: `skills/`, `docs/superpowers/scenarios/` and `docs/rationale/`. Its YAML check needs `ruby`.
- Private patterns: names from other repos live in the gitignored `.claude/check-skills-private.txt` of the main checkout (worktrees find it there) or in a non-empty `SKILLS_PRIVATE_PATTERNS`. Format: one regex per line, `#` comments. Never commit them: this repo is public. `SKILLS_REQUIRE_PRIVATE=1` (the local gate) fails when none load. CI runs without them, so there it checks staging host names only.
- Version bump check: `node scripts/check-version-bump.mjs origin/main`.
- Plugin manifest check: `claude plugin validate .`. Its expected warnings: `CLAUDE.md` at the plugin root isn't loaded as context (intended, the file is for working on this repo), no icon, and local `.DS_Store` files (gitignored). Only errors block.
- There are no dependencies and no `package.json`: the scripts use only Node built-in modules. Glob arguments to `node --test` need Node 21 or newer.
- After a merge: run `./scripts/update-plugin.sh`, then `/reload-plugins` in running sessions.

CI (`.github/workflows/ci.yml`, job `test`) runs the unit tests and the shape check on every PR and on every push to `main`. On a PR it also runs the version bump check. Branch protection on `main` requires the `test` check to pass before a merge. The same gates are listed in `.claude/ship-plan.md`, so the repo ships itself with its own `ship-plan` skill (`Host: github`, `Tracker: none`, `Workflow: ci.yml`).

## Publishing rule

Any change under `skills/**` or `hooks/**` must raise `version` in `.claude-plugin/plugin.json` above the version on `main`. Without the bump, installed copies never get the change, and the `Version bump` gate fails.

## Architecture

**Skill chain.** `ship-queue` runs `ship-issue` once per sub-issue. `ship-issue` writes the spec and plan, then runs `ship-plan`. `ship-plan` implements the plan, then runs `verify-and-fix` and merges. `handoff` and `continue-handoff` save and resume session state. `retro` turns a session's lessons into proposed edits.

**`ship-plan` is the shared core.** Its `SKILL.md` stays short and reads companion files only when a condition needs them:
- `phase-*.md`: implement, verify, merge and close steps.
- `hosts/{github,azure-devops}.md`, `trackers/{jira,linear,github}.md`, `notifiers/slack.md`: one `##` section per named operation. Skills say "the host's *X*" and never call host commands directly. A new host or tracker must provide every operation heading the checker lists.
- `config-format.md`: the format of the per-repo `.claude/ship-plan.md` (`## Repo`, `## Gates`, `## Models`, `## Allowed`, `## Runner`, `## Logs`, …). `## Allowed` is a closed list that only a person edits.
- Repo overrides at `.claude/ship-plan/<skill>/<file>.md` are read right after the shared file of the same name. An override may add steps or make a rule stricter. It may never widen what a run may do.

**Hot path vs. rationale.** Skill text is compacted. The incidents and reasons behind each rule live in `docs/rationale/<skill>-SKILL.md`. Read the rationale when you change a rule, and keep the reasons there, not in `SKILL.md`. Rewording can drop phrases the checker needs, so run the shape check after any wording change.

**Hooks** (`hooks/hooks.json`):
- `SessionStart` runs `skills/handoff/scripts/session-start.mjs`, which reports pending handoffs. Handoffs live in `~/.claude/handoffs/<slug of the main checkout>/`. `handoff.test.mjs` runs every handoff script with:
  - `HOME` set to a scratch dir;
  - a scratch git repo where a script needs one;
  - no `GIT_*` env and no global git config;
  - a `gh` stub that always fails.

  So it never touches the real handoff dir, the real repo or the network. Keep new tests isolated the same way.
- `PreToolUse` on `Agent` runs `hooks/agent-dispatch.mjs`. While a ship run is live, meaning there is a fresh, unfinished `.superpowers/{ship-plan,ship-issue,verify-and-fix,ship-queue}/*/ledger.md` or a live `.superpowers/ship-runner/*/state.json`, it refuses any non-fork Agent dispatch that lacks `model` or `effort`. Every dispatch in the ship skills must pass both, taken from the config's `## Models` rows.

**Ship runner** (`skills/ship-plan/scripts/runner*.mjs`, opt-in with `Mode: runner` or `--runner`): a Node CLI (`start | answer | status`) that runs each phase as a headless `claude -p` child. The split is `runner.mjs` (CLI), `runner-lib.mjs`, `runner-phases.mjs` (phases, network retries), `runner-queue.mjs` (queue order and deps, spec-all-first) and `runner-child.mjs`. The tests use `fake-claude.mjs` as a stand-in for `claude -p --output-format stream-json`; its behaviour comes from the `FAKE_CLAUDE` env var (`ok:<marker>`, `error`, `crash`, `hang`, …).

**Behaviour tests are paper scenarios.** `docs/superpowers/scenarios/S*.md` are run by hand. A fresh subagent reads `skills/` and answers the scenario's questions, its answer is saved to `results/<id>.md` with home paths replaced by `SKILLDIR`, and it is graded against the scenario's `Pass if` lines. Never show the runner the `Pass if` lines. The full procedure is in `docs/superpowers/scenarios/README.md`. Add or rerun a scenario when a change alters skill behaviour.
