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
  echo "Building csharp-rename (one-time, ~30s)..." >&2
  staging_dir="$build_dir.tmp.$$"
  # Build from the skill's folder, so a global.json in the repo being renamed doesn't pick the SDK for this .NET 10 tool.
  if ! build_log="$(cd "$skill_dir" && dotnet publish "$source_file" --use-current-runtime -p:PublishReadyToRun=true -o "$staging_dir" -v q 2>&1)"; then
    echo "$build_log" >&2
    rm -rf "$staging_dir"
    exit 1
  fi

  # Another run may have finished the same build first: then keep its copy. A folder without rename.dll is a
  # broken earlier build: replace it. (mv onto an existing folder would nest staging inside it.)
  if [[ -f "$dll" ]]; then
    rm -rf "$staging_dir"
  else
    rm -rf "$build_dir"
    mv "$staging_dir" "$build_dir" 2>/dev/null || rm -rf "$staging_dir"
  fi
  if [[ ! -f "$dll" ]]; then
    echo "csharp-rename: no rename.dll in $build_dir after the build; delete that folder and rerun." >&2
    exit 1
  fi

  # Each version is ~60 MB. Drop only versions no run has used for 30 days, so a session still using one keeps it.
  # A cleanup failure (a folder another run is removing) must not stop the rename.
  { find "$cache_root" -mindepth 2 -maxdepth 2 -name rename.dll -mtime +30 -print 2>/dev/null || true; } | while read -r stale_dll; do
    rm -rf "$(dirname "$stale_dll")" || true
  done
fi

touch -c "$dll"
exec dotnet "$dll" "$@"
