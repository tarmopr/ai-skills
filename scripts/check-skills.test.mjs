// Tests for the skill shape checker's private-pattern handling (C4 and C13).
// Run: node --test scripts/*.test.mjs
// Each test runs the checker on a scratch copy of skills/, never on this checkout.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
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
// No SKILLS_* overrides and no GIT_* (a GIT_DIR would point the checker at this repo's private file).
const BASE_ENV = Object.fromEntries(Object.entries(process.env)
  .filter(([k]) => !k.startsWith('GIT_') && !['SKILLS_PRIVATE_PATTERNS', 'SKILLS_REQUIRE_PRIVATE', 'SKILLS_ROOT'].includes(k)));
Object.assign(BASE_ENV, { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' });
function run(dir, env = {}, skills = join(dir, 'skills')) {
  return spawnSync('node', [SCRIPT], { encoding: 'utf8', env: { ...BASE_ENV, SKILLS_ROOT: skills, ...env } });
}
function git(cwd, ...args) {
  const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'core.hooksPath=/dev/null', ...args],
    { cwd, encoding: 'utf8', env: BASE_ENV });
  assert.equal(r.status, 0, r.stderr);
}
const PRIVATE_HIT = /C13 private: line \d+ \(private text not shown\)/;

test('the scratch copy passes as it is', () => {
  const r = run(tree({ patterns: `# c\n${WORD}\n` }));
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^ok: \d+ file\(s\) \(C4: 1 private pattern\(s\) from check-skills-private\.txt\)$/m);
});

test('a private name in a skill outside the FILES table is caught', () => {
  const dir = tree({ patterns: `${WORD}\n` });
  appendFileSync(join(dir, 'skills', 'retro', 'SKILL.md'), `\nSee ${WORD} here.\n`);
  const r = run(dir);
  assert.equal(r.status, 1);
  assert.match(r.stdout, new RegExp(`retro/SKILL\\.md: ${PRIVATE_HIT.source}`));
  assert.doesNotMatch(r.stdout, new RegExp(WORD), 'the private text is never echoed');
});

test('a private name in docs/rationale/ and in the scenarios is caught', () => {
  const dir = tree({ patterns: `${WORD}\n` });
  mkdirSync(join(dir, 'docs', 'rationale'), { recursive: true });
  mkdirSync(join(dir, 'docs', 'superpowers', 'scenarios'), { recursive: true });
  writeFileSync(join(dir, 'docs', 'rationale', 'r.md'), `${WORD}\n`);
  writeFileSync(join(dir, 'docs', 'superpowers', 'scenarios', 's.md'), `${WORD}\n`);
  const r = run(dir);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /^rationale\/r\.md: C13 private: line 1 /m);
  assert.match(r.stdout, /^scenarios\/s\.md: C13 private: line 1 /m);
});

test('a private name in the root .md files or .claude/ship-plan.md is caught', () => {
  const dir = tree({ patterns: `${WORD}\n` });
  writeFileSync(join(dir, 'CLAUDE.md'), `x\n${WORD}\n`);
  writeFileSync(join(dir, '.claude', 'ship-plan.md'), `${WORD}\n`);
  const r = run(dir);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /^CLAUDE\.md: C13 private: line 2 /m);
  assert.match(r.stdout, /^\.claude\/ship-plan\.md: C13 private: line 1 /m);
});

test('an empty SKILLS_PRIVATE_PATTERNS falls back to the private file', () => {
  const dir = tree({ patterns: `${WORD}\n` });
  appendFileSync(join(dir, 'skills', 'retro', 'SKILL.md'), `\n${WORD}\n`);
  const r = run(dir, { SKILLS_PRIVATE_PATTERNS: '' });
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, PRIVATE_HIT);
});

test('a non-empty SKILLS_PRIVATE_PATTERNS replaces the file, and the ok line names it', () => {
  const dir = tree({ patterns: 'Unusedword\n' });
  appendFileSync(join(dir, 'skills', 'retro', 'SKILL.md'), `\n${WORD}\n`);
  const r = run(dir, { SKILLS_PRIVATE_PATTERNS: `${WORD}\nOther` });
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, PRIVATE_HIT);
  const ok = run(tree({ patterns: `${WORD}\n` }), { SKILLS_PRIVATE_PATTERNS: 'Aaa\nBbb' });
  assert.match(ok.stdout, /\(C4: 2 private pattern\(s\) from SKILLS_PRIVATE_PATTERNS\)/);
});

test('from a worktree, the main checkout\'s private file is used', () => {
  const dir = tree({ patterns: `${WORD}\n` });
  writeFileSync(join(dir, '.gitignore'), '.claude/check-skills-private.txt\n');
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'init');
  const wt = join(realpathSync(mkdtempSync(join(tmpdir(), 'check-skills-wt-'))), 'w');
  git(dir, 'worktree', 'add', '-q', wt);
  appendFileSync(join(wt, 'skills', 'retro', 'SKILL.md'), `\n${WORD}\n`);
  const r = run(dir, { SKILLS_REQUIRE_PRIVATE: '1' }, join(wt, 'skills'));
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, PRIVATE_HIT);
  writeFileSync(join(wt, 'skills', 'retro', 'SKILL.md'), 'clean\n');
  assert.match(run(dir, {}, join(wt, 'skills')).stdout, /from check-skills-private\.txt \(main checkout\)/);
});

test('a git dir not named .git (--separate-git-dir): no main-checkout lookup', () => {
  const dir = tree({ patterns: `${WORD}\n` });
  const gd = join(realpathSync(mkdtempSync(join(tmpdir(), 'check-skills-gd-'))), 'repo.git');
  writeFileSync(join(dir, '.gitignore'), '.claude/check-skills-private.txt\n');
  git(dir, 'init', '-q', '-b', 'main', `--separate-git-dir=${gd}`);
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'init');
  const wt = join(realpathSync(mkdtempSync(join(tmpdir(), 'check-skills-wt-'))), 'w');
  git(dir, 'worktree', 'add', '-q', wt);
  const r = run(dir, { SKILLS_REQUIRE_PRIVATE: '1' }, join(wt, 'skills'));
  assert.equal(r.status, 2, r.stdout);
  assert.match(r.stderr, /no private patterns loaded/);
});

test('a staging host name in a ship-skill file fails C4; a sentence ending in staging. does not', () => {
  const dir = tree({ patterns: `${WORD}\n` });
  appendFileSync(join(dir, 'skills', 'ship-queue', 'SKILL.md'), '\nDeploys go to staging.\n');
  assert.equal(run(dir).status, 0);
  appendFileSync(join(dir, 'skills', 'ship-queue', 'SKILL.md'), 'Open app.staging.example.com\n');
  const r = run(dir);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /ship-queue\/SKILL\.md: C4 repo specific: line \d+: Open app\.staging\.example\.com/);
});

test('a private name in a ship-skill file is reported once (C13), and no other check echoes it', () => {
  const dir = tree({ patterns: `${WORD}\n` });
  // This line also trips C3 (a tech command), C5 (a literal main) and C9 (a tool call in a SKILL body).
  appendFileSync(join(dir, 'skills', 'ship-queue', 'SKILL.md'), `\nrun npm and gh pr on origin/main for ${WORD}\n`);
  const r = run(dir);
  assert.equal(r.status, 1);
  assert.equal(r.stdout.split('\n').filter((l) => /C13 private/.test(l)).length, 1, r.stdout);
  assert.doesNotMatch(r.stdout, /C4 repo specific/);
  assert.match(r.stdout, /C3 tech command: line \d+ \(private text not shown\)/);
  assert.doesNotMatch(r.stdout, new RegExp(WORD, 'i'));
});

test('patterns match case-insensitively and across a line break', () => {
  const dir = tree({ patterns: 'Twoword Name\n' });
  appendFileSync(join(dir, 'skills', 'retro', 'SKILL.md'), '\nsee TWOWORD name here\n');
  let r = run(dir);
  assert.equal(r.status, 1);
  assert.match(r.stdout, PRIVATE_HIT);
  const wrap = tree({ patterns: 'Twoword Name\n' });
  appendFileSync(join(wrap, 'skills', 'retro', 'SKILL.md'), '\nsee Twoword\nName here\n');
  r = run(wrap);
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, PRIVATE_HIT);
});

test('a tracked file that is not .md (a script, a test, a manifest) is scanned too', () => {
  const dir = tree({ patterns: `${WORD}\n` });
  writeFileSync(join(dir, '.gitignore'), '.claude/check-skills-private.txt\n');
  mkdirSync(join(dir, 'hooks'));
  writeFileSync(join(dir, 'hooks', 'h.mjs'), `// fixed in ${WORD.toLowerCase()}\n`);
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'init');
  const r = run(dir);
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /^hooks\/h\.mjs: C13 private: line 1 \(private text not shown\)/m);
});

test('comments go on their own line: an inline # after a space is refused; a # inside a word is kept', () => {
  const r = run(tree({ patterns: `# full-line comment\n${WORD}   # a note\n` }));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /check-skills-private\.txt line 2: invalid pattern \(a comment goes on its own line\)/);
  assert.doesNotMatch(r.stderr, new RegExp(WORD));
  const mid = tree({ patterns: 'mid#word\n' });
  appendFileSync(join(mid, 'skills', 'retro', 'SKILL.md'), '\nsee mid only\n');
  assert.equal(run(mid).status, 0, 'a # inside a word is part of the pattern, not a comment');
  appendFileSync(join(mid, 'skills', 'retro', 'SKILL.md'), 'mid#word\n');
  assert.equal(run(mid).status, 1);
});

test('an invalid pattern or a trailing backslash fails by line number and never echoes the patterns', () => {
  for (const bad of ['(unclosed', 'ends\\']) {
    const r = run(tree({ patterns: `${WORD}\n${bad}\n` }));
    assert.equal(r.status, 2, bad);
    assert.match(r.stderr, /check-skills-private\.txt line 2: invalid pattern/);
    assert.doesNotMatch(r.stdout + r.stderr, new RegExp(WORD));
    assert.doesNotMatch(r.stdout + r.stderr, /unclosed|ends\\/);
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

test('round 4: anchored and wrapped names never reach any message; untracked files and file names are scanned', () => {
  const dir = tree({ patterns: '^zqxsecret\nacmeco zqxcorp\n' });
  appendFileSync(join(dir, 'skills', 'ship-queue', 'SKILL.md'), '\nzqxsecret uses npm here\nrun npm for acmeco\nzqxcorp here\n');
  writeFileSync(join(dir, '.gitignore'), '.claude/check-skills-private.txt\n');
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'init');
  mkdirSync(join(dir, 'hooks'));
  writeFileSync(join(dir, 'hooks', 'new.mjs'), 'zqxsecret\n');
  writeFileSync(join(dir, 'skills', 'retro', 'zqxsecret-notes.txt'), 'x\n');
  const r = run(dir);
  assert.equal(r.status, 1);
  assert.doesNotMatch(r.stdout, /zqxsecret|acmeco|zqxcorp/i, r.stdout);
  assert.match(r.stdout, /^hooks\/new\.mjs: C13 private: line 1 \(private text not shown\)/m);
  assert.match(r.stdout, /C13 private: file name \(private text not shown\)/);
});
