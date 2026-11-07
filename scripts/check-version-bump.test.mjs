// Tests for the version-bump gate. Run: node --test scripts/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'check-version-bump.mjs');
const ENV = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));
Object.assign(ENV, { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' });

function git(cwd, ...args) {
  const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'core.hooksPath=/dev/null', ...args],
    { cwd, encoding: 'utf8', env: ENV });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}
function write(dir, file, text) {
  mkdirSync(dirname(join(dir, file)), { recursive: true });
  writeFileSync(join(dir, file), text);
}
const manifest = (version, extra = '') => `{\n  "name": "p",${extra}\n  "version": "${version}"\n}\n`;

// A repo with `main` at version 1.2.3 and a branch `b` checked out from it.
function repo() {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'version-bump-')));
  git(dir, 'init', '-q', '-b', 'main');
  write(dir, '.claude-plugin/plugin.json', manifest('1.2.3'));
  write(dir, 'skills/a/SKILL.md', 'a\n');
  write(dir, 'docs/x.md', 'x\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'init');
  git(dir, 'switch', '-q', '-c', 'b');
  return dir;
}
function commit(dir, files) {
  for (const [f, t] of Object.entries(files)) write(dir, f, t);
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'change');
}
const run = (dir, base = 'main') => spawnSync('node', [SCRIPT, base], { cwd: dir, encoding: 'utf8', env: ENV });

test('no change under skills/ or hooks/: passes without a bump', () => {
  const dir = repo();
  commit(dir, { 'docs/x.md': 'y\n' });
  const r = run(dir);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /no bump needed/);
});

test('skills/ changed and the version raised: passes', () => {
  const dir = repo();
  commit(dir, { 'skills/a/SKILL.md': 'b\n', '.claude-plugin/plugin.json': manifest('1.2.10') });
  const r = run(dir);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /1\.2\.3 -> 1\.2\.10/);
});

test('hooks/ changed and plugin.json not touched: fails', () => {
  const dir = repo();
  commit(dir, { 'hooks/h.mjs': 'x\n' });
  const r = run(dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /bump version in \.claude-plugin\/plugin\.json/);
});

test('plugin.json edited but the version unchanged or lowered: fails', () => {
  for (const version of ['1.2.3', '1.2.2', '0.9.9']) {
    const dir = repo();
    commit(dir, { 'skills/a/SKILL.md': 'b\n', '.claude-plugin/plugin.json': manifest(version, '\n  "description": "d",') });
    const r = run(dir);
    assert.equal(r.status, 1, `${version}: ${r.stdout}`);
    assert.match(r.stderr, /must be higher than main's 1\.2\.3/);
  }
});

test('the base moved on and already holds the branch version: fails', () => {
  const dir = repo();
  commit(dir, { 'skills/a/SKILL.md': 'b\n', '.claude-plugin/plugin.json': manifest('1.2.4') });
  git(dir, 'switch', '-q', 'main');
  commit(dir, { 'docs/x.md': 'z\n', '.claude-plugin/plugin.json': manifest('1.2.4') });
  git(dir, 'switch', '-q', 'b');
  const r = run(dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /must be higher than main's 1\.2\.4/);
});

test('a base ref that does not exist: fails, never passes', () => {
  const dir = repo();
  commit(dir, { 'skills/a/SKILL.md': 'b\n', '.claude-plugin/plugin.json': manifest('1.2.4') });
  const r = run(dir, 'origin/nope');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /base ref origin\/nope not found/);
});

test('an unparseable version: fails', () => {
  const dir = repo();
  commit(dir, { 'skills/a/SKILL.md': 'b\n', '.claude-plugin/plugin.json': manifest('next') });
  const r = run(dir);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /not a version: "next"/);
});
