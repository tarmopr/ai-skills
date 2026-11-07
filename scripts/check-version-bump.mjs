#!/usr/bin/env node
// The version-bump gate: a change under skills/ or hooks/ must raise `version` in
// .claude-plugin/plugin.json above the base branch's, or installed copies never update.
// Any other change to plugin.json may keep the version but never lower it.
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
  let v;
  try { v = JSON.parse(text).version; } catch { stop(2, `${MANIFEST} at ${ref} is not valid JSON`); }
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
const manifest = git('diff', '--name-only', `${base}...HEAD`, '--', MANIFEST);
if (changed === null || manifest === null) stop(2, `git diff ${base}...HEAD failed`);
if (!changed.trim() && !manifest.trim()) {
  console.log('no change under skills/ or hooks/: no bump needed');
  process.exit(0);
}
const was = version(base);
const now = version('HEAD');
const name = base.replace(/^origin\//, '');
if (!changed.trim()) {
  if (higher(was.parts, now.parts)) stop(1, `${MANIFEST}: version ${now.text} is lower than ${name}'s ${was.text}`);
  console.log(`no change under skills/ or hooks/: no bump needed (version ${now.text})`);
  process.exit(0);
}
if (!higher(now.parts, was.parts)) {
  stop(1, manifest.trim()
    ? `${MANIFEST}: version ${now.text} must be higher than ${name}'s ${was.text}`
    : `skills/ or hooks/ changed: bump version in ${MANIFEST} (must be higher than ${name}'s ${was.text})`);
}
console.log(`version bumped: ${was.text} -> ${now.text}`);
