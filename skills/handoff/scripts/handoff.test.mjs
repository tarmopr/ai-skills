// Tests for the handoff scripts. Run: node --test skills/handoff/scripts/*.test.mjs
// Every test runs against a scratch git repo and a scratch HOME, so the real
// ~/.claude/handoffs is never read or written.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { age, handoffDir, list, parse, repoRoot, setMeta, slug } from './lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const scratch = (p) => realpathSync(mkdtempSync(join(tmpdir(), `handoff-${p}-`)));

const GIT_ID = ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false'];
function git(cwd, ...args) {
  const r = spawnSync('git', [...GIT_ID, ...args], { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}
function repo() {
  const dir = scratch('repo');
  git(dir, 'init', '-q', '-b', 'main');
  writeFileSync(join(dir, 'README.md'), 'x\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'init');
  return dir;
}

// Runs a script with HOME pointed at a scratch dir; returns { status, stdout, stderr }.
function script(name, args, { cwd, home, input } = {}) {
  return spawnSync('node', [join(HERE, name), ...args], {
    cwd, input, encoding: 'utf8',
    env: { ...process.env, HOME: home, USERPROFILE: home },
  });
}

// In-process calls to lib.mjs read HOME through os.homedir().
function withHome(home, fn) {
  const old = process.env.HOME;
  process.env.HOME = home;
  try { return fn(); } finally { process.env.HOME = old; }
}

const SECTIONS = ['Resume', 'Goal', 'State', 'Next step', 'Decisions', 'Watch out', 'Pointers'];
function handoff({ meta = {}, body } = {}) {
  const m = { title: 'T', created: '2026-11-07T10:00:00Z', repo: 'r', branch: 'main', head: 'abc', status: 'pending', resume: 'go', ...meta };
  const fm = Object.entries(m).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}: ${v}`).join('\n');
  return `---\n${fm}\n---\n${body ?? SECTIONS.map((s) => `## ${s}\nx\n`).join('\n')}`;
}
function writeHandoff(dir, name, opts) {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${name}.md`);
  writeFileSync(file, handoff(opts));
  return file;
}

// ---- lib.mjs

test('slug: every non-alphanumeric becomes -', () => {
  assert.equal(slug('/Users/a b/my_repo.x'), '-Users-a-b-my-repo-x');
});

test('parse: no frontmatter returns the whole text as body', () => {
  assert.deepEqual(parse('# hi\n'), { meta: {}, body: '# hi\n', raw: '' });
});

test('parse: reads keys, strips matching quotes, handles CRLF', () => {
  const { meta, body } = parse('---\r\ntitle: "Hello"\r\nbranch: \'x\'\r\nempty:\r\n---\r\nbody\r\n');
  assert.deepEqual(meta, { title: 'Hello', branch: 'x', empty: '' });
  assert.equal(body, 'body\r\n');
});

test('setMeta: replaces an existing key, appends a new one, keeps the body', () => {
  const file = join(scratch('meta'), 'h.md');
  writeFileSync(file, '---\nstatus: pending\ntitle: T\n---\n## Body\n');
  setMeta(file, { status: 'consumed', consumed_at: 'now' });
  assert.equal(readFileSync(file, 'utf8'), '---\nstatus: consumed\ntitle: T\nconsumed_at: now\n---\n## Body\n');
});

test('setMeta: a file without frontmatter throws', () => {
  const file = join(scratch('meta'), 'h.md');
  writeFileSync(file, 'no frontmatter\n');
  assert.throws(() => setMeta(file, { status: 'consumed' }), /has no frontmatter/);
});

test('age: minutes, hours, days', () => {
  const now = Date.now();
  assert.equal(age(now - 5 * 60000), '5 min ago');
  assert.equal(age(now - 3 * 3600000), '3 h ago');
  assert.equal(age(now - 4 * 86400000), '4 days ago');
});

test('repoRoot: the repo root from a subdirectory and from a worktree; cwd outside git', () => {
  const dir = repo();
  mkdirSync(join(dir, 'sub'));
  assert.equal(repoRoot(join(dir, 'sub')), dir);
  const wt = join(scratch('wt'), 'w');
  git(dir, 'worktree', 'add', '-q', wt, '-b', 'feature/x');
  assert.equal(repoRoot(wt), dir);
  const plain = scratch('plain');
  assert.equal(repoRoot(plain), plain);
});

test('handoffDir: ~/.claude/handoffs/<slug of the repo root>', () => {
  const home = scratch('home');
  const dir = repo();
  assert.equal(withHome(home, () => handoffDir(dir)), join(home, '.claude', 'handoffs', slug(dir)));
});

test('list: no directory gives []; .md only, newest first, mtime when created is missing', () => {
  const home = scratch('home');
  const dir = repo();
  withHome(home, () => {
    assert.deepEqual(list(dir), []);
    const hd = handoffDir(dir);
    writeHandoff(hd, 'old', { meta: { created: '2026-01-01T00:00:00Z' } });
    writeHandoff(hd, 'new', { meta: { created: '2026-06-01T00:00:00Z' } });
    const nodate = writeHandoff(hd, 'nodate', { meta: { created: undefined } });
    const t = Date.parse('2026-03-01T00:00:00Z') / 1000;
    utimesSync(nodate, t, t);
    writeFileSync(join(hd, 'notes.txt'), 'ignored');
    assert.deepEqual(list(dir).map((h) => h.name), ['new', 'nodate', 'old']);
  });
});

// ---- check.mjs

test('check: a complete handoff passes', () => {
  const dir = repo();
  const file = writeHandoff(scratch('h'), 'h');
  const r = script('check.mjs', [file], { cwd: dir, home: scratch('home') });
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /^ok: /);
});

test('check: no file is a usage error', () => {
  const r = script('check.mjs', [], { cwd: repo(), home: scratch('home') });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /usage: check\.mjs/);
});

test('check: missing keys, a bad status, an indented key and a missing section are each listed', () => {
  const dir = repo();
  const h = scratch('h');
  const file = join(h, 'h.md');
  writeFileSync(file, handoff({ meta: { resume: undefined, status: 'done' } }).replace('branch: main', '  branch: main')
    .replace('## Watch out\n', ''));
  const r = script('check.mjs', [file], { cwd: dir, home: scratch('home') });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /missing `resume`/);
  assert.match(r.stdout, /missing `branch`/);
  assert.match(r.stdout, /status must be pending or consumed/);
  assert.match(r.stdout, /must not be indented/);
  assert.match(r.stdout, /missing section: ## Watch out/);
});

test('check: backticked paths and commits are checked; placeholders and digit-only ids are not', () => {
  const dir = repo();
  const head = git(dir, 'rev-parse', 'HEAD');
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src', 'a.ts'), '');
  const home = scratch('home');
  mkdirSync(join(home, 'notes'));
  writeFileSync(join(home, 'notes', 'n.md'), '');
  const body = SECTIONS.map((s) => `## ${s}\nx\n`).join('\n') + [
    '`src/a.ts:12-20`', '`src/`', '`~/notes/n.md`', `\`${head.slice(0, 7)}\``, // exist
    '`src/missing.ts`', '`deadbeefcafe`', // do not exist
    '`src/<name>.ts`', '`https://x.io/a.md`', '`12345678`', '`README.md`', // skipped (no slash, placeholder, URL, digits)
  ].join('\n');
  const file = writeHandoff(scratch('h'), 'h', { body });
  const r = script('check.mjs', [file], { cwd: dir, home });
  assert.equal(r.status, 1);
  const problems = r.stdout.split('\n').filter((l) => l.startsWith('  - '));
  assert.deepEqual(problems, [
    '  - path not found: src/missing.ts',
    '  - commit not found locally: deadbeefcafe (fetch, or fix it)',
  ]);
});

// ---- mark.mjs

test('mark: consumed sets consumed_at; pending clears it', () => {
  const file = writeHandoff(scratch('h'), 'h');
  const home = scratch('home');
  let r = script('mark.mjs', [file, 'consumed'], { home });
  assert.equal(r.status, 0, r.stderr);
  let { meta } = parse(readFileSync(file, 'utf8'));
  assert.equal(meta.status, 'consumed');
  assert.ok(!Number.isNaN(Date.parse(meta.consumed_at)));
  r = script('mark.mjs', [file, 'pending'], { home });
  ({ meta } = parse(readFileSync(file, 'utf8')));
  assert.equal(meta.status, 'pending');
  assert.equal(meta.consumed_at, '');
});

test('mark: an unknown status or a missing file is a usage error', () => {
  const file = writeHandoff(scratch('h'), 'h');
  const home = scratch('home');
  assert.equal(script('mark.mjs', [file, 'done'], { home }).status, 1);
  assert.equal(script('mark.mjs', [join(scratch('h'), 'none.md'), 'consumed'], { home }).status, 1);
  assert.equal(parse(readFileSync(file, 'utf8')).meta.status, 'pending');
});

// ---- list.mjs

test('list.mjs: pending only by default, consumed too with --all', () => {
  const dir = repo();
  const home = scratch('home');
  let r = script('list.mjs', [], { cwd: dir, home });
  assert.match(r.stdout, /no pending handoffs/);
  const hd = withHome(home, () => handoffDir(dir));
  writeHandoff(hd, 'p', { meta: { title: 'Open one' } });
  writeHandoff(hd, 'c', { meta: { status: 'consumed', title: 'Done one' } });
  r = script('list.mjs', [], { cwd: dir, home });
  assert.match(r.stdout, /^PENDING +p .*Open one$/m);
  assert.doesNotMatch(r.stdout, /Done one/);
  r = script('list.mjs', ['--all'], { cwd: dir, home });
  assert.match(r.stdout, /^consumed +c .*Done one$/m);
});

// ---- session-start.mjs

test('session-start: on startup and clear, names pending handoffs; nothing otherwise', () => {
  const dir = repo();
  const home = scratch('home');
  const hd = withHome(home, () => handoffDir(dir));
  const run = (source) => script('session-start.mjs', [], { home, input: JSON.stringify({ source, cwd: dir }) });

  assert.equal(run('startup').stdout, '', 'no handoffs yet');
  writeHandoff(hd, 'p', { meta: { title: 'Open one' } });
  writeHandoff(hd, 'c', { meta: { status: 'consumed', title: 'Done one' } });
  for (const source of ['startup', 'clear']) {
    const out = JSON.parse(run(source).stdout).hookSpecificOutput;
    assert.equal(out.hookEventName, 'SessionStart');
    assert.match(out.additionalContext, /- p \(.*\): Open one/);
    assert.doesNotMatch(out.additionalContext, /Done one/);
    assert.match(out.additionalContext, /\/continue-handoff/);
  }
  for (const source of ['compact', 'resume']) assert.equal(run(source).stdout, '');
});

test('session-start: at most three handoffs; bad input exits 0 silently', () => {
  const dir = repo();
  const home = scratch('home');
  const hd = withHome(home, () => handoffDir(dir));
  for (const n of [1, 2, 3, 4]) writeHandoff(hd, `h${n}`, { meta: { created: `2026-11-0${n}T00:00:00Z` } });
  const r = script('session-start.mjs', [], { home, input: JSON.stringify({ source: 'startup', cwd: dir }) });
  const ctx = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
  assert.deepEqual([...ctx.matchAll(/^- (h\d)/gm)].map((m) => m[1]), ['h4', 'h3', 'h2']);
  const bad = script('session-start.mjs', [], { cwd: scratch('plain'), home, input: 'not json' });
  assert.equal(bad.status, 0);
  assert.equal(bad.stdout, '');
});

// ---- gather.mjs

test('gather: branch, HEAD, no upstream, dirty paths, recent ledgers, pending handoffs, suggested file', () => {
  const dir = repo();
  const home = scratch('home');
  git(dir, 'switch', '-q', '-c', 'feature/x');
  writeFileSync(join(dir, 'new.txt'), '');
  mkdirSync(join(dir, '.superpowers', 'ship-plan', 'f'), { recursive: true });
  writeFileSync(join(dir, '.superpowers', 'ship-plan', 'f', 'ledger.md'), 'Phase: 2\n');
  const hd = withHome(home, () => handoffDir(dir));
  writeHandoff(hd, 'earlier', { meta: { title: 'Earlier one' } });

  const r = script('gather.mjs', ['my topic!'], { cwd: dir, home });
  assert.equal(r.status, 0, r.stderr);
  const o = r.stdout;
  assert.match(o, new RegExp(`^repo root: ${dir}$`, 'm'));
  assert.match(o, /^branch: feature\/x$/m);
  assert.match(o, /^HEAD: [0-9a-f]{40} init$/m);
  assert.match(o, /^upstream: none \(branch not pushed\)$/m);
  assert.match(o, /^uncommitted: 2 path\(s\)$/m);
  assert.match(o, /^ {2}\.superpowers\/ship-plan\/f\/ledger\.md {2}\(0 min ago\)$/m);
  assert.match(o, /^ {2}earlier .*Earlier one$/m);
  assert.match(o, new RegExp(`^suggested file: ${hd}/\\d{8}-\\d{4}-my-topic\\.md$`, 'm'));
});

test('gather: from a subdirectory it reports the cwd; the name defaults to the branch', () => {
  const dir = repo();
  mkdirSync(join(dir, 'sub'));
  const r = script('gather.mjs', [], { cwd: join(dir, 'sub'), home: scratch('home') });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^cwd: .*sub \(worktree or subdirectory\)$/m);
  assert.match(r.stdout, /^suggested file: .*-main\.md$/m);
});
