#!/usr/bin/env bash
# Bring this machine's installed ai-skills plugin up to the version on main.
# Run after a change is merged and pushed with a bumped version in .claude-plugin/plugin.json.
# First install: scripts/install-plugin.sh
set -euo pipefail

claude plugin marketplace update tarmopr
claude plugin update ai-skills@tarmopr
echo "Run /reload-plugins in a running Claude Code session, or start a new one, to load the update."
