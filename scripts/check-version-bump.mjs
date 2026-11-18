#!/usr/bin/env node
// The version-bump gate, for each plugin the marketplace lists: a change under the plugin's skills/
// or hooks/ must raise `version` in its .claude-plugin/plugin.json above the base branch's, or
// installed copies never update. Any other change to plugin.json may keep the version but never
// lower it below where the branch started (the merge base). A plugin the base branch doesn't have
// yet needs only a valid version (a plugin moved to a new folder counts as new). With no .claude-plugin/marketplace.json, the repo root is the one plugin.
// Usage: node scripts/check-version-bump.mjs [base ref, default origin/main]   (from anywhere in the repo)
// Exit: 0 pass, 1 bump missing or version lowered, 2 could not check (missing ref, unreadable
// or invalid plugin.json or marketplace.json, a failed git command).
import { spawnSync } from 'node:child_process';
import { posix } from 'node:path';

const MARKETPLACE = '.claude-plugin/marketplace.json';
const base = process.argv[2] || 'origin/main';

// Pathspecs below are the repo root's, wherever this runs from.
const top = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });
function git(...args) {
  const r = spawnSync('git', args, { encoding: 'utf8', cwd: top.status === 0 ? top.stdout.trim() : undefined });
  return r.status === 0 ? r.stdout : null;
}
function stop(code, message) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}
const exists = (ref, file) => git('cat-file', '-e', `${ref}:${file}`) !== null;
function version(ref, manifest) {
  const text = git('show', `${ref}:${manifest}`);
  if (text === null) stop(2, `cannot read ${manifest} at ${ref}`);
  let v;
  try { v = JSON.parse(text)?.version; } catch { stop(2, `${manifest} at ${ref} is not valid JSON`); }
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v ?? '');
  if (!m) stop(2, `${manifest} at ${ref}: not a version: ${JSON.stringify(v)}`);
  return { text: v, parts: m.slice(1).map(Number) };
}
const higher = (a, b) => {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
};

// Each plugin's folder, from the marketplace at a ref: `.` for the repo root, else e.g. `plugins/<name>`.
function pluginDirs(ref) {
  if (!exists(ref, MARKETPLACE)) return ['.'];
  let plugins;
  try { plugins = JSON.parse(git('show', `${ref}:${MARKETPLACE}`))?.plugins; } catch { stop(2, `${MARKETPLACE} at ${ref} is not valid JSON`); }
  if (!Array.isArray(plugins)) stop(2, `${MARKETPLACE} at ${ref}: no plugins list`);
  return plugins.map((p) => {
    if (typeof p?.source !== 'string') stop(2, `${MARKETPLACE}: plugin ${JSON.stringify(p?.name)} has no local source`);
    const dir = posix.normalize(p.source).replace(/\/$/, '');
    if (dir.startsWith('..') || posix.isAbsolute(dir)) stop(2, `${MARKETPLACE}: plugin source outside the repo: ${p.source}`);
    return dir;
  });
}

if (git('rev-parse', '--verify', '--quiet', `${base}^{commit}`) === null) stop(2, `base ref ${base} not found (fetch it first)`);
const name = base.replace(/^origin\//, '');
const errors = [];
// The base's plugins too: a branch that drops a plugin from the marketplace still bumps what it changed in it.
for (const dir of new Set([...pluginDirs(base), ...pluginDirs('HEAD')])) {
  const at = (p) => (dir === '.' ? p : `${dir}/${p}`);
  const MANIFEST = at('.claude-plugin/plugin.json');
  const watched = `${at('skills/')} or ${at('hooks/')}`;
  const changed = git('diff', '--name-only', `${base}...HEAD`, '--', at('skills'), at('hooks'));
  const manifest = git('diff', '--name-only', `${base}...HEAD`, '--', MANIFEST);
  if (changed === null || manifest === null) stop(2, `git diff ${base}...HEAD failed`);
  if (!changed.trim() && !manifest.trim()) {
    console.log(`no change under ${watched}: no bump needed`);
    continue;
  }
  const now = version('HEAD', MANIFEST);
  if (!exists(base, MANIFEST)) {
    console.log(`${MANIFEST}: new plugin at version ${now.text}`);
    continue;
  }
  const was = version(base, MANIFEST);
  if (!changed.trim()) {
    const fork = git('merge-base', base, 'HEAD')?.trim();
    if (!fork) stop(2, `no merge base of ${base} and HEAD`);
    const start = exists(fork, MANIFEST) ? version(fork, MANIFEST) : null;
    if (start && higher(start.parts, now.parts)) errors.push(`${MANIFEST}: version ${now.text} is lower than ${name}'s ${start.text}`);
    else console.log(`no change under ${watched}: no bump needed (version ${now.text})`);
    continue;
  }
  if (!higher(now.parts, was.parts)) {
    errors.push(manifest.trim()
      ? `${MANIFEST}: version ${now.text} must be higher than ${name}'s ${was.text}`
      : `${watched} changed: bump version in ${MANIFEST} (must be higher than ${name}'s ${was.text})`);
    continue;
  }
  console.log(`${MANIFEST}: version bumped: ${was.text} -> ${now.text}`);
}
if (errors.length) stop(1, errors.join('\n'));
