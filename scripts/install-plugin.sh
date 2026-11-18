#!/usr/bin/env bash
# Install plugins from this repo on this machine: add the tarmopr marketplace if it is missing,
# then install each named plugin that is not installed yet. Safe to run again.
# Usage: scripts/install-plugin.sh [plugin …]   (default: ai-skills; the other is symbol-rename)
# Later updates: scripts/update-plugin.sh
set -euo pipefail

if claude plugin marketplace list --json | grep -q '"name": "tarmopr"'; then
  echo "ok         marketplace tarmopr"
else
  claude plugin marketplace add tarmopr/ai-skills
fi

installed=0
for plugin in "${@:-ai-skills}"; do
  if claude plugin list --json | grep -q "\"id\": \"$plugin@tarmopr\""; then
    echo "ok         $plugin@tarmopr (already installed; scripts/update-plugin.sh updates it)"
  else
    claude plugin install "$plugin@tarmopr"
    installed=1
  fi
done
if (( installed )); then
  echo "Run /reload-plugins in a running Claude Code session, or start a new one, to load the skills."
fi
