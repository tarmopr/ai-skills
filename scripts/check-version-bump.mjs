#!/usr/bin/env node
// The version-bump gate: a change under skills/ or hooks/ must raise `version` in
// .claude-plugin/plugin.json above the base branch's, or installed copies never update.
// Usage: node scripts/check-version-bump.mjs [base ref, default origin/main]
// Exit: 0 pass, 1 bump missing, 2 could not check (missing ref, unreadable version).
import { spawnSync } from 'node:child_process';

const MANIFEST = '.claude-plugin/plugin.json';
const base = process.argv[2] || 'origin/main';

function git(...args) {
  const r = spawnSync('git', args, { encoding: 'utf8' });
  return r.status === 0 ? r.stdout : null;
}
function stop(code, message) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}
function version(ref) {
  const text = git('show', `${ref}:${MANIFEST}`);
  if (text === null) stop(2, `cannot read ${MANIFEST} at ${ref}`);
  const v = JSON.parse(text).version;
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v ?? '');
  if (!m) stop(2, `${MANIFEST} at ${ref}: not a version: ${JSON.stringify(v)}`);
  return { text: v, parts: m.slice(1).map(Number) };
}
const higher = (a, b) => {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
};

if (git('rev-parse', '--verify', '--quiet', `${base}^{commit}`) === null) stop(2, `base ref ${base} not found (fetch it first)`);
const changed = git('diff', '--name-only', `${base}...HEAD`, '--', 'skills', 'hooks');
if (changed === null) stop(2, `git diff ${base}...HEAD failed`);
if (!changed.trim()) {
  console.log('no change under skills/ or hooks/: no bump needed');
  process.exit(0);
}
const was = version(base);
const now = version('HEAD');
if (!higher(now.parts, was.parts)) {
  const touched = git('diff', '--name-only', `${base}...HEAD`, '--', MANIFEST)?.trim();
  stop(1, touched
    ? `${MANIFEST}: version ${now.text} must be higher than ${base.replace(/^origin\//, '')}'s ${was.text}`
    : `skills/ or hooks/ changed: bump version in ${MANIFEST} (must be higher than ${base.replace(/^origin\//, '')}'s ${was.text})`);
}
console.log(`version bumped: ${was.text} -> ${now.text}`);
