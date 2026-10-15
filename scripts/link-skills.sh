#!/usr/bin/env bash
# Link skills from this repo into ~/.claude/skills, so the repo is the source of truth.
# Usage: link-skills.sh [skill-name ...]   (no names: link every skill in skills/)
# An existing real directory is moved to ~/.claude/skill-backups/<date>/ first, never deleted.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="$HOME/.claude/skills"
BACKUP="$HOME/.claude/skill-backups/$(date +%Y-%m-%d)"
mkdir -p "$TARGET"

if [ "$#" -gt 0 ]; then
  srcs=()
  for name in "$@"; do
    [ -d "$REPO/skills/$name" ] || { echo "no such skill: $name" >&2; exit 1; }
    srcs+=("$REPO/skills/$name/")
  done
else
  srcs=("$REPO"/skills/*/)
fi

for src in "${srcs[@]}"; do
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
