#!/usr/bin/env bash
# Runs the Roslyn rename tool, building it once per version of rename.cs into a per-user cache.
set -euo pipefail

skill_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source_file="$skill_dir/rename.cs"
version="$(git hash-object "$source_file" | cut -c1-12)"
cache_root="${XDG_CACHE_HOME:-$HOME/.cache}/csharp-rename"
build_dir="$cache_root/$version"
dll="$build_dir/rename.dll"

if [[ ! -f "$dll" ]]; then
  # One build at a time: dotnet builds a file-based app in one folder per source path, so two first runs at once
  # break each other's build. A lock older than 10 minutes is left over from a killed build.
  mkdir -p "$cache_root"
  lock="$cache_root/$version.lock"
  waited=0
  until mkdir "$lock" 2>/dev/null; do
    # A stale lock is removed once; one that can't be removed (not an empty folder) waits out the limit below.
    if [[ -n "$(find "$lock" -maxdepth 0 -mmin +10 2>/dev/null)" ]] && rmdir "$lock" 2>/dev/null; then
      continue
    fi
    if (( waited++ >= 300 )); then
      echo "csharp-rename: waited 5 minutes for another build ($lock); delete that folder if no build is running." >&2
      exit 1
    fi
    sleep 1
  done
  trap 'rmdir "$lock" 2>/dev/null || true' EXIT

  # The run that held the lock may have built it.
  if [[ ! -f "$dll" ]]; then
    echo "Building csharp-rename (one-time, ~30s)..." >&2
    staging_dir="$build_dir.tmp.$$"
    rm -rf "$build_dir" # a folder without rename.dll is a broken earlier build; mv onto it would nest staging inside
    # Build from the skill's folder, so a global.json in the repo being renamed doesn't pick the SDK for this .NET 10 tool.
    if ! build_log="$(cd "$skill_dir" && dotnet publish "$source_file" --use-current-runtime -p:PublishReadyToRun=true -o "$staging_dir" -v q 2>&1)"; then
      echo "$build_log" >&2
      rm -rf "$staging_dir"
      exit 1
    fi
    mv "$staging_dir" "$build_dir"
    if [[ ! -f "$dll" ]]; then
      echo "csharp-rename: no rename.dll in $build_dir after the build; delete that folder and rerun." >&2
      exit 1
    fi

    # Each version is ~60 MB. Drop only versions no run has used for 30 days, so a session still using one keeps it.
    # A cleanup failure must not stop the rename.
    { find "$cache_root" -mindepth 2 -maxdepth 2 -name rename.dll -mtime +30 -print 2>/dev/null || true; } | while read -r stale_dll; do
      rm -rf "$(dirname "$stale_dll")" || true
    done
  fi

  # exec below skips the EXIT trap.
  rmdir "$lock" 2>/dev/null || true
  trap - EXIT
fi

touch -c "$dll"
exec dotnet "$dll" "$@"
