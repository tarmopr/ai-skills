#!/usr/bin/env bash
# Bring this machine's installed tarmopr plugins (ai-skills, symbol-rename) up to the versions on main.
# Run after a change is merged and pushed with a bumped version in the plugin's .claude-plugin/plugin.json.
# First install: scripts/install-plugin.sh
set -euo pipefail

claude plugin marketplace update tarmopr
installed="$(claude plugin list --json)"
updated=0
for plugin in ai-skills symbol-rename; do
  if grep -q "\"id\": \"$plugin@tarmopr\"" <<<"$installed"; then
    claude plugin update "$plugin@tarmopr"
    updated=1
  fi
done
if (( ! updated )); then
  echo "No tarmopr plugin is installed: run scripts/install-plugin.sh [plugin …] first." >&2
  exit 1
fi
if ! grep -q '"id": "symbol-rename@tarmopr"' <<<"$installed"; then
  echo "symbol-rename@tarmopr is not installed. ts-rename and csharp-rename left ai-skills in 0.19.0; to keep them: scripts/install-plugin.sh symbol-rename"
fi
echo "Run /reload-plugins in a running Claude Code session, or start a new one, to load the update."
