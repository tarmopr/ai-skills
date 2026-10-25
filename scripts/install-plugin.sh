#!/usr/bin/env bash
# Install the ai-skills plugin on this machine: add the tarmopr marketplace if it is missing,
# then install ai-skills@tarmopr if it is not installed yet. Safe to run again.
# Later updates: scripts/update-plugin.sh
set -euo pipefail

if claude plugin marketplace list --json | grep -q '"name": "tarmopr"'; then
  echo "ok         marketplace tarmopr"
else
  claude plugin marketplace add tarmopr/ai-skills
fi

if claude plugin list --json | grep -q '"id": "ai-skills@tarmopr"'; then
  echo "ok         ai-skills@tarmopr (already installed; scripts/update-plugin.sh updates it)"
else
  claude plugin install ai-skills@tarmopr
  echo "Run /reload-plugins in a running Claude Code session, or start a new one, to load the skills."
fi
