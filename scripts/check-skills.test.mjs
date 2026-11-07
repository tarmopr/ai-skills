// Tests for the skill shape checker's private-pattern handling (C4 and C13).
// Run: node --test scripts/*.test.mjs
// Each test runs the checker on a scratch copy of skills/, never on this checkout.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, 'check-skills.mjs');
const WORD = 'Zqxwordprivate';

function tree({ patterns } = {}) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'check-skills-')));
  cpSync(join(HERE, '..', 'skills'), join(dir, 'skills'), { recursive: true });
  if (patterns !== undefined) {
    mkdirSync(join(dir, '.claude'));
    writeFileSync(join(dir, '.claude', 'check-skills-private.txt'), patterns);
  }
  return dir;
}
function run(dir, env = {}) {
  const base = Object.fromEntries(Object.entries(process.env)
    .filter(([k]) => !['SKILLS_PRIVATE_PATTERNS', 'SKILLS_REQUIRE_PRIVATE', 'SKILLS_ROOT'].includes(k)));
  return spawnSync('node', [SCRIPT], { encoding: 'utf8', env: { ...base, SKILLS_ROOT: join(dir, 'skills'), ...env } });
}

test('the scratch copy passes as it is', () => {
  const r = run(tree({ patterns: `# c\n${WORD}\n` }));
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^ok: \d+ file\(s\)$/m);
});

test('a private name in a skill outside the FILES table is caught', () => {
  const dir = tree({ patterns: `${WORD}\n` });
  appendFileSync(join(dir, 'skills', 'retro', 'SKILL.md'), `\nSee ${WORD} here.\n`);
  const r = run(dir);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /retro\/SKILL\.md: C13 private: line \d+: See Zqxwordprivate here\./);
});

test('a private name in docs/rationale/ and in the scenarios is caught', () => {
  const dir = tree({ patterns: `${WORD}\n` });
  mkdirSync(join(dir, 'docs', 'rationale'), { recursive: true });
  mkdirSync(join(dir, 'docs', 'superpowers', 'scenarios'), { recursive: true });
  writeFileSync(join(dir, 'docs', 'rationale', 'r.md'), `${WORD}\n`);
  writeFileSync(join(dir, 'docs', 'superpowers', 'scenarios', 's.md'), `${WORD}\n`);
  const r = run(dir);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /rationale\/r\.md: C13 private: line 1/);
  assert.match(r.stdout, /scenarios\/s\.md: C13 private: line 1/);
});

test('an empty SKILLS_PRIVATE_PATTERNS falls back to the private file', () => {
  const dir = tree({ patterns: `${WORD}\n` });
  appendFileSync(join(dir, 'skills', 'retro', 'SKILL.md'), `\n${WORD}\n`);
  const r = run(dir, { SKILLS_PRIVATE_PATTERNS: '' });
  assert.equal(r.status, 1, r.stdout);
});

test('an inline # comment is stripped from a pattern line', () => {
  const dir = tree({ patterns: `${WORD}   # a note\n` });
  appendFileSync(join(dir, 'skills', 'retro', 'SKILL.md'), `\n${WORD}\n`);
  assert.equal(run(dir).status, 1);
});

test('an invalid pattern or a trailing backslash fails by line number and never echoes the patterns', () => {
  for (const bad of ['(unclosed', 'ends\\']) {
    const r = run(tree({ patterns: `${WORD}\n${bad}\n` }));
    assert.equal(r.status, 2, bad);
    assert.match(r.stderr, /check-skills-private\.txt line 2: invalid pattern/);
    assert.doesNotMatch(r.stdout + r.stderr, new RegExp(WORD));
  }
});

test('SKILLS_REQUIRE_PRIVATE=1 with no patterns fails; without it, the run says C4 is partial', () => {
  const dir = tree();
  const r = run(dir, { SKILLS_REQUIRE_PRIVATE: '1' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /no private patterns loaded/);
  const open = run(dir);
  assert.equal(open.status, 0, open.stdout);
  assert.match(open.stdout, /C4: no private patterns loaded/);
});
