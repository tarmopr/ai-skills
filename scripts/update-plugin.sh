#!/usr/bin/env bash
# Bring this machine's installed tarmopr plugins (ai-skills, symbol-rename) up to the versions on main.
# Run after a change is merged and pushed with a bumped version in the plugin's .claude-plugin/plugin.json.
# First install: scripts/install-plugin.sh
set -euo pipefail

claude plugin marketplace update tarmopr
for plugin in ai-skills symbol-rename; do
  if claude plugin list --json | grep -q "\"id\": \"$plugin@tarmopr\""; then
    claude plugin update "$plugin@tarmopr"
  fi
done
echo "Run /reload-plugins in a running Claude Code session, or start a new one, to load the update."
