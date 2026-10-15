#!/usr/bin/env bash
# Link every skill in this repo into ~/.claude/skills, so the repo is the source of truth.
# An existing real directory is moved to ~/.claude/skill-backups/<date>/ first, never deleted.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="$HOME/.claude/skills"
BACKUP="$HOME/.claude/skill-backups/$(date +%Y-%m-%d)"
mkdir -p "$TARGET"

for src in "$REPO"/skills/*/; do
  name="$(basename "$src")"
  dest="$TARGET/$name"
  if [ -L "$dest" ]; then
    [ "$(readlink "$dest")" = "${src%/}" ] && { echo "ok      $name"; continue; }
    rm "$dest"
  elif [ -e "$dest" ]; then
    mkdir -p "$BACKUP"
    mv "$dest" "$BACKUP/$name"
    echo "backup  $name -> $BACKUP/$name"
  fi
  ln -s "${src%/}" "$dest"
  echo "linked  $name"
done
