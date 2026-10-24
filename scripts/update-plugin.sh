#!/usr/bin/env bash
# Bring this machine's installed ai-skills plugin up to the version on main.
# Run after a change is merged and pushed with a bumped version in .claude-plugin/plugin.json.
# First install: claude plugin marketplace add tarmopr/ai-skills && claude plugin install ai-skills@tarmopr
set -euo pipefail

claude plugin marketplace update tarmopr
claude plugin update ai-skills@tarmopr
echo "Restart Claude Code to load the update."
