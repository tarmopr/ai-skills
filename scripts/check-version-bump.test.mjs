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
const run = (dir, base = 'main', cwd = dir) => spawnSync('node', [SCRIPT, base], { cwd, encoding: 'utf8', env: ENV });

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
    assert.match(r.stderr, /^\.claude-plugin\/plugin\.json: version .* must be higher than main's 1\.2\.3$/m);
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
  assert.match(r.stderr, /^\.claude-plugin\/plugin\.json: version 1\.2\.4 must be higher than main's 1\.2\.4$/m);
});

test('a base ref that does not exist: fails, never passes', () => {
  const dir = repo();
  commit(dir, { 'skills/a/SKILL.md': 'b\n', '.claude-plugin/plugin.json': manifest('1.2.4') });
  const r = run(dir, 'origin/nope');
  assert.doesNotMatch(r.stderr, /bump version/);
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

test('a minor or major bump that resets the lower parts: passes', () => {
  for (const version of ['1.3.0', '2.0.0']) {
    const dir = repo();
    commit(dir, { 'skills/a/SKILL.md': 'b\n', '.claude-plugin/plugin.json': manifest(version) });
    const r = run(dir);
    assert.equal(r.status, 0, `${version}: ${r.stderr}`);
  }
});

test('the base changed skills/ but this branch did not: passes (three-dot diff)', () => {
  const dir = repo();
  commit(dir, { 'docs/x.md': 'y\n' });
  git(dir, 'switch', '-q', 'main');
  commit(dir, { 'skills/a/SKILL.md': 'main\n', '.claude-plugin/plugin.json': manifest('1.2.4') });
  git(dir, 'switch', '-q', 'b');
  const r = run(dir);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /no bump needed/);
});

test('only plugin.json changed and the version lowered: fails; same version, other field: passes', () => {
  let dir = repo();
  commit(dir, { '.claude-plugin/plugin.json': manifest('1.2.2') });
  let r = run(dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /1\.2\.2 is lower than main's 1\.2\.3/);
  dir = repo();
  commit(dir, { '.claude-plugin/plugin.json': manifest('1.2.3', '\n  "description": "d",') });
  r = run(dir);
  assert.equal(r.status, 0, r.stderr);
});

test('plugin.json that is not JSON, or deleted: could not check (exit 2)', () => {
  let dir = repo();
  commit(dir, { 'skills/a/SKILL.md': 'b\n', '.claude-plugin/plugin.json': '{ nope' });
  let r = run(dir);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /plugin\.json at HEAD is not valid JSON/);
  dir = repo();
  write(dir, 'skills/a/SKILL.md', 'c\n');
  git(dir, 'rm', '-q', '.claude-plugin/plugin.json');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'rm');
  r = run(dir);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /cannot read \.claude-plugin\/plugin\.json at HEAD/);
});

test('run from a subdirectory: the paths are still the repo root\'s', () => {
  const dir = repo();
  commit(dir, { 'hooks/h.mjs': 'x\n' });
  const r = run(dir, 'main', join(dir, 'docs'));
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stderr, /bump version/);
});

test('only plugin.json changed and the base bumped later: compared with where the branch started', () => {
  const dir = repo();
  commit(dir, { '.claude-plugin/plugin.json': manifest('1.2.3', '\n  "description": "d",') });
  git(dir, 'switch', '-q', 'main');
  commit(dir, { 'skills/a/SKILL.md': 'm\n', '.claude-plugin/plugin.json': manifest('1.2.4') });
  git(dir, 'switch', '-q', 'b');
  const r = run(dir);
  assert.equal(r.status, 0, r.stderr);
});

test('plugin.json that is JSON but not an object: could not check (exit 2), named as such', () => {
  const dir = repo();
  commit(dir, { 'skills/a/SKILL.md': 'b\n', '.claude-plugin/plugin.json': 'null\n' });
  const r = run(dir);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /plugin\.json at HEAD: not a version: undefined/);
});
