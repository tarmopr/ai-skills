// Tests for the child launcher and stream reader. Run: node --test 'skills/ship-plan/scripts/*.test.mjs'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireLock, alive } from './runner-lib.mjs';
import { childArgs, endChildren, isEnvError, isLimitError, logStore, parseMarker, redact, resumeOrFresh, runChild } from './runner-child.mjs';

process.env.CLAUDE_BIN = join(dirname(fileURLToPath(import.meta.url)), 'fake-claude.mjs');

const fresh = () => mkdtempSync(join(tmpdir(), 'runner-child-'));
const base = (dir, env, extra = {}) => ({
  dir, cwd: dir, key: 'BILL-1', phase: 'spec', prompt: 'SECRET-PROMPT do the spec',
  model: 'opus', effort: 'high', mode: 'auto', resume: null, env, ...extra,
});

test('childArgs: resume appended only when given', () => {
  const head = ['-p', '--output-format', 'stream-json', '--verbose', '--model', 'opus', '--effort', 'high', '--permission-mode', 'auto'];
  assert.deepEqual(childArgs({ model: 'opus', effort: 'high', mode: 'auto', resume: null }), head);
  assert.deepEqual(childArgs({ model: 'opus', effort: 'high', mode: 'auto', resume: 's-9' }), [...head, '--resume', 's-9']);
  assert.deepEqual(childArgs({ model: 'opus', effort: 'high', mode: 'auto', resume: null, addDir: '/m/.superpowers/ship-logs' }), [...head, '--add-dir', '/m/.superpowers/ship-logs']);
});

// The local log store (`## Logs` `Location: local`) is the main checkout's .superpowers/ship-logs/:
// a child in a linked worktree gets it as --add-dir, or acceptEdits and dontAsk refuse its writes.
const gitRepo = () => {
  const main = realpathSync(fresh());
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: 'ignore' });
  git(main, 'init', '-q', '-b', 'main');
  git(main, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init');
  const wt = join(realpathSync(fresh()), 'wt');
  git(main, 'worktree', 'add', '-q', wt, '-b', 'side');
  return { main, wt };
};

test('logStore: the main checkout store from a linked worktree; null inside the main checkout or outside git; why for a bare or --separate-git-dir clone', () => {
  const { main, wt } = gitRepo();
  const store = join(main, '.superpowers', 'ship-logs');
  assert.deepEqual(logStore(wt), { store, expected: store });
  assert.equal(logStore(main), null);
  assert.equal(logStore(fresh()), null);
  const g = (cwd, ...a) => execFileSync('git', a, { cwd, stdio: 'ignore' });
  const bare = join(realpathSync(fresh()), 'b.git');
  g(fresh(), 'clone', '-q', '--bare', main, bare);
  const bwt = join(realpathSync(fresh()), 'bwt');
  g(bare, 'worktree', 'add', '-q', bwt, 'main');
  assert.match(logStore(bwt).why, /bare clone/);
  const top = realpathSync(fresh());
  g(top, 'init', '-q', '-b', 'main', `--separate-git-dir=${join(top, 'sep.git')}`, 's');
  g(join(top, 's'), '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init');
  const swt = join(top, 'swt');
  g(join(top, 's'), 'worktree', 'add', '-q', swt, '-b', 'side');
  assert.match(logStore(swt).why, /not the \.git folder of a checkout/);
});

test('runChild: a child in a linked worktree gets the log store as --add-dir, created', async () => {
  const { main, wt } = gitRepo();
  const dir = fresh();
  const log = join(dir, 'argv.json');
  const r = await runChild(base(dir, { FAKE_CLAUDE: 'ok:RUNNER: done', FAKE_CLAUDE_LOG: log }, { cwd: wt, logs: logStore(wt) }));
  assert.equal(r.ok, true);
  const store = join(main, '.superpowers', 'ship-logs');
  assert.deepEqual(JSON.parse(readFileSync(log, 'utf8')).argv.slice(-2), ['--add-dir', store]);
  assert.equal(lstatSync(store).mode & 0o777, 0o700);
});

// security review of 805dc4c: a child that swaps .superpowers or ship-logs for a symlink (to $HOME)
// must not widen the next child's write scope through --add-dir
for (const [what, link] of [['ship-logs', ['.superpowers', 'ship-logs']], ['.superpowers', ['.superpowers']]]) {
  test(`runChild: a symlinked ${what} gets no --add-dir, and one event says why`, async () => {
    const { main, wt } = gitRepo();
    const elsewhere = fresh();
    if (link.length === 2) mkdirSync(join(main, '.superpowers'));
    symlinkSync(elsewhere, join(main, ...link));
    const dir = fresh();
    const log = join(dir, 'argv.json');
    const r = await runChild(base(dir, { FAKE_CLAUDE: 'ok:RUNNER: done', FAKE_CLAUDE_LOG: log }, { cwd: wt, logs: logStore(wt) }));
    assert.equal(r.ok, true);
    assert.ok(!JSON.parse(readFileSync(log, 'utf8')).argv.includes('--add-dir'));
    const ev = readFileSync(join(dir, 'events.log'), 'utf8').split('\n').filter((l) => / progress log store not granted: /.test(l));
    assert.equal(ev.length, 1);
    assert.deepEqual(readdirSync(elsewhere), []); // nothing made through the link
  });
}

test('parseMarker: last RUNNER line wins; none -> null', () => {
  assert.deepEqual(parseMarker('x\nRUNNER: waiting 2 questions\n'), { status: 'waiting', text: '2 questions' });
  assert.deepEqual(parseMarker('RUNNER: blocked a\nmid\nRUNNER: phase-done\n'), { status: 'phase-done', text: '' });
  assert.equal(parseMarker('no marker here\nRUNNER: finished\n  RUNNER: done'), null);
  assert.equal(parseMarker(''), null);
});

test('runChild: several result lines (background tasks) -> turns summed, highest cost, an earlier marker kept', async () => {
  const dir = fresh();
  const r = await runChild(base(dir, { FAKE_CLAUDE: 'multi', FAKE_CLAUDE_MARKER: 'RUNNER: phase-done tasks 1-5' }));
  assert.equal(r.ok, true);
  assert.deepEqual(r.marker, { status: 'phase-done', text: 'tasks 1-5', stale: true }); // from an earlier turn
  assert.equal(r.turns, 6);
  assert.equal(r.costUsd, 0.35);
  assert.equal(r.minutes, 0);
  // every earlier marker is carried, flagged stale: runIssue trusts a stale blocked or done only
  // when the ledgers did not move
  assert.deepEqual((await runChild(base(dir, { FAKE_CLAUDE: 'multi', FAKE_CLAUDE_MARKER: 'RUNNER: blocked old reason' }))).marker,
    { status: 'blocked', text: 'old reason', stale: true });
});

test('runChild ok: sessionId, marker, cost; jsonl written; prompt not in argv', async () => {
  const dir = fresh();
  const log = join(dir, 'fake.json');
  const r = await runChild(base(dir, { FAKE_CLAUDE: 'ok:RUNNER: phase-done spec written', FAKE_CLAUDE_LOG: log }));
  assert.deepEqual(r, {
    ok: true, sessionId: 's-1', marker: { status: 'phase-done', text: 'spec written' },
    costUsd: 0.42, turns: 3, minutes: 0, error: null, // minutes: the child's wall clock, not duration_ms
  });
  const lines = readFileSync(join(dir, 'BILL-1-spec-1.jsonl'), 'utf8').trim().split('\n');
  assert.deepEqual(lines.map((l) => JSON.parse(l).type), ['system', 'system', 'assistant', 'rate_limit_event', 'result']);
  const seen = JSON.parse(readFileSync(log, 'utf8'));
  assert.equal(seen.stdin, 'SECRET-PROMPT do the spec');
  assert.ok(!seen.argv.some((a) => a.includes('SECRET-PROMPT')));
  // a second run of the same phase gets the next file number
  await runChild(base(dir, { FAKE_CLAUDE: 'ok:RUNNER: done' }));
  assert.ok(existsSync(join(dir, 'BILL-1-spec-2.jsonl')));
});

test('runChild: env passed through, SHIP_RUNNER is the run dir', async () => {
  const dir = fresh();
  const log = join(dir, 'fake.json');
  const r = await runChild(base(dir, { FAKE_CLAUDE: 'ok:RUNNER: done', FAKE_CLAUDE_LOG: log }));
  assert.equal(r.ok, true);
  assert.equal(JSON.parse(readFileSync(log, 'utf8')).shipRunner, dir);
});

// D5 (review round 3): the child is told its item key, never left to derive it
test('runChild: SHIP_RUNNER_KEY is the item key, over any the env passes', async () => {
  const dir = fresh();
  const log = join(dir, 'fake.json');
  const r = await runChild(base(dir, { FAKE_CLAUDE: 'ok:RUNNER: done', FAKE_CLAUDE_LOG: log, SHIP_RUNNER_KEY: 'OTHER-9' }));
  assert.equal(r.ok, true);
  assert.equal(JSON.parse(readFileSync(log, 'utf8')).shipRunnerKey, 'BILL-1');
});

test('runChild error / crash: ok false, error text set', async () => {
  const dir = fresh();
  const e = await runChild(base(dir, { FAKE_CLAUDE: 'error' }));
  assert.equal(e.ok, false);
  assert.equal(e.sessionId, 's-1');
  assert.match(e.error, /usage limit reached/);
  const c = await runChild(base(dir, { FAKE_CLAUDE: 'crash' }));
  assert.equal(c.ok, false);
  assert.equal(c.sessionId, null);
  assert.equal(c.marker, null);
  assert.match(c.error, /exit 1/);
  assert.match(c.error, /no result line/);
});

test('runChild: missing binary -> ok false, error set', async () => {
  const dir = fresh();
  const saved = process.env.CLAUDE_BIN;
  process.env.CLAUDE_BIN = join(dir, 'no-such-claude');
  try {
    const r = await runChild(base(dir, { FAKE_CLAUDE: 'ok:RUNNER: done' }));
    assert.equal(r.ok, false);
    assert.match(r.error, /ENOENT/);
  } finally {
    process.env.CLAUDE_BIN = saved;
  }
});

test('resumeOrFresh: noresume -> second fresh run, event "resume failed"', async () => {
  const dir = fresh();
  const log = join(dir, 'fake.json');
  const r = await resumeOrFresh(base(dir, { FAKE_CLAUDE: 'noresume', FAKE_CLAUDE_MARKER: 'RUNNER: waiting 1 question', FAKE_CLAUDE_LOG: log }, {
    resume: 's-old', freshPrompt: 'FRESH prompt',
  }));
  assert.equal(r.ok, true);
  assert.deepEqual(r.marker, { status: 'waiting', text: '1 question' });
  const seen = JSON.parse(readFileSync(log, 'utf8'));
  assert.ok(!seen.argv.includes('--resume'));
  assert.equal(seen.stdin, 'FRESH prompt');
  assert.match(readFileSync(join(dir, 'events.log'), 'utf8'), /^\S+ BILL-1 spec progress resume failed, fresh child$/m);
  const failed = JSON.parse(readFileSync(join(dir, 'BILL-1-spec-1.jsonl'), 'utf8'));
  assert.equal(failed.subtype, 'error_during_execution');
  assert.ok(existsSync(join(dir, 'BILL-1-spec-2.jsonl')));
});

test('runChild: result errors[] are in the error text', async () => {
  const dir = fresh();
  const r = await runChild(base(dir, { FAKE_CLAUDE: 'noresume' }, { resume: 's-old' }));
  assert.equal(r.ok, false);
  assert.equal(r.sessionId, 's-old');
  assert.match(r.error, /exit 1/);
  assert.match(r.error, /No conversation found with session ID: s-old/);
});

test('resumeOrFresh: no result line on resume -> fresh run too', async () => {
  const dir = fresh();
  const r = await resumeOrFresh(base(dir, { FAKE_CLAUDE: 'crash' }, { resume: 's-old', freshPrompt: 'FRESH' }));
  assert.equal(r.ok, false);
  assert.match(readFileSync(join(dir, 'events.log'), 'utf8'), /resume failed, fresh child/);
  assert.ok(existsSync(join(dir, 'BILL-1-spec-2.jsonl')));
});

test('resumeOrFresh: fallback without freshPrompt throws', async () => {
  const dir = fresh();
  await assert.rejects(resumeOrFresh(base(dir, { FAKE_CLAUDE: 'noresume' }, { resume: 's-old' })), /freshPrompt is missing/);
});

test('resumeOrFresh: usage-limit is_error on resume is not retried', async () => {
  const dir = fresh();
  const r = await resumeOrFresh(base(dir, { FAKE_CLAUDE: 'error' }, { resume: 's-old', freshPrompt: 'FRESH' }));
  assert.equal(r.ok, false);
  assert.equal(existsSync(join(dir, 'events.log')), false);
  assert.equal(existsSync(join(dir, 'BILL-1-spec-2.jsonl')), false);
});

test('child pid set while running, cleared after', async () => {
  const dir = fresh();
  acquireLock(dir, process.pid);
  const running = runChild(base(dir, { FAKE_CLAUDE: 'ok:RUNNER: done' }));
  const during = JSON.parse(readFileSync(join(dir, 'lock'), 'utf8')).child;
  assert.ok(Number.isInteger(during) && during > 0);
  await running;
  assert.equal(JSON.parse(readFileSync(join(dir, 'lock'), 'utf8')).child, null);
});

test('resumeOrFresh: a resume that ran (session id seen) then crashed is a crash, not a dead session: no fresh child', async () => {
  const dir = fresh();
  const r = await resumeOrFresh(base(dir, { FAKE_CLAUDE: 'crashafter' }, { resume: 's-old', freshPrompt: 'FRESH' }));
  assert.equal(r.ok, false);
  assert.equal(r.sessionId, 's-1');
  assert.match(r.error, /exit 1/);
  assert.match(r.error, /no result line/);
  assert.equal(existsSync(join(dir, 'events.log')), false);
  assert.equal(existsSync(join(dir, 'BILL-1-spec-2.jsonl')), false);
});

test('resumeOrFresh: the dead resume is returned with the fresh child, for its cost', async () => {
  const dir = fresh();
  const r = await resumeOrFresh(base(dir, { FAKE_CLAUDE: 'noresume' }, { resume: 's-old', freshPrompt: 'FRESH' }));
  assert.equal(r.ok, true);
  assert.equal(r.failedResume.ok, false);
  assert.equal(r.failedResume.sessionId, 's-old');
  assert.equal(r.failedResume.costUsd, 0);
  assert.equal(r.failedResume.turns, 0);
});

test('isLimitError: usage and rate limits only; crashes and API errors are not', () => {
  assert.equal(isLimitError('is_error: usage limit reached'), true);
  assert.equal(isLimitError('is_error: Claude AI usage limit reached|1762160400'), true);
  assert.equal(isLimitError('is_error: 5-hour limit reached ∙ resets 3pm'), true);
  assert.equal(isLimitError('exit 1; rate limit rejected'), true);
  assert.equal(isLimitError('exit 1; no result line'), false);
  assert.equal(isLimitError('is_error: API Error: 401 authentication_error'), false);
  assert.equal(isLimitError('spawn failed: ENOENT'), false);
  assert.equal(isLimitError(null), false);
});

test('runChild: an API error result is reported as it is', async () => {
  const dir = fresh();
  const r = await runChild(base(dir, { FAKE_CLAUDE: 'apierror' }));
  assert.equal(r.ok, false);
  assert.match(r.error, /authentication_error/);
  assert.equal(isLimitError(r.error), false);
});

test('runChild: no stream line for idleMs -> the child is killed, error child idle', async () => {
  const dir = fresh();
  acquireLock(dir, process.pid);
  const t0 = Date.now();
  const running = runChild(base(dir, { FAKE_CLAUDE: 'hang' }, { idleMs: 300 }));
  await new Promise((r) => setTimeout(r, 100));
  const pid = JSON.parse(readFileSync(join(dir, 'lock'), 'utf8')).child;
  const r = await running;
  assert.equal(r.ok, false);
  assert.match(r.error, /^child idle 0\.005 min/);
  assert.ok(Date.now() - t0 < 5000);
  assert.equal(alive(pid), false);
});

test('runChild: resolves when the child exits, even while a grandchild holds stdout', async () => {
  const dir = fresh();
  const t0 = Date.now();
  const r = await runChild(base(dir, { FAKE_CLAUDE: 'grandchild', FAKE_CLAUDE_HOLD_MS: '8000' }));
  assert.equal(r.ok, true, r.error);
  assert.deepEqual(r.marker, { status: 'done', text: '' });
  assert.ok(Date.now() - t0 < 5000, `took ${Date.now() - t0} ms`);
});

test('runChild: a transcript write that fails never crashes the runner; one event says so', async () => {
  const dir = fresh();
  const r = await runChild(base(dir, { FAKE_CLAUDE: 'ok:RUNNER: done', FAKE_CLAUDE_RM: dir }, { cwd: fresh() }));
  assert.equal(r.ok, true);
  const ev = readFileSync(join(dir, 'events.log'), 'utf8').split('\n').filter(Boolean);
  assert.equal(ev.length, 1);
  assert.match(ev[0], / BILL-1 spec progress child transcript not written: /);
});

// review round 1, C6: a failed child's stderr reaches events.log and state.json: a short tail, no tokens
test('runChild: the stderr in the error is its last 300 characters, tokens redacted', async () => {
  const dir = fresh();
  const secrets = 'gh token ghp_abcdefghijklmnopqrstuvwxyz0123 key sk-ant-api03-abcdefghijklmnopqrst slack xoxb-123-456-abc auth: Bearer eyJhbGciOi.x.y';
  const r = await runChild(base(dir, { FAKE_CLAUDE: 'crash', FAKE_CLAUDE_STDERR: `${'x'.repeat(900)} ${secrets}` }));
  assert.equal(r.ok, false);
  const tail = r.error.split('; stderr: ')[1];
  assert.ok(tail.length <= 300, `stderr tail is ${tail.length} chars`);
  assert.doesNotMatch(r.error, /ghp_abc|sk-ant-api03|xoxb-123|eyJhbGciOi/);
  assert.equal(r.error.match(/\[redacted\]/g).length, 4);
});

// C9: failures every later child would hit too stop the run
test('isEnvError: no claude, API or auth errors, a bad model; not a crash, a limit or an item\'s own failure', () => {
  for (const e of ['spawn failed: ENOENT; no result line', 'spawn failed: EACCES', 'is_error: API Error: 401 {"type":"authentication_error"}',
    'exit 1; is_error: There\'s an issue with the selected model (opus-9). It may not exist', 'is_error: Invalid API key · Please run /login',
    'is_error: Credit balance is too low']) assert.equal(isEnvError(e), true, e);
  for (const e of ['exit 1; no result line', 'killed by SIGKILL; no result line', 'child idle 60 min', 'no RUNNER: line',
    'exit 1; no result line; stderr: API Error: 401']) assert.equal(isEnvError(e), false, e);
});

// C10 (review round 1, security follow-up): a child's window ends only once its whole process group
// is gone, so nothing it started can write after the window closes
test('runChild: when the child exits, its process group is ended before runChild resolves, SIGTERM ignored or not', async () => {
  for (const ignore of ['0', '1']) {
    const dir = fresh();
    const pidfile = join(dir, 'g.pid');
    const r = await runChild(base(dir, { FAKE_CLAUDE: 'grandchild', FAKE_CLAUDE_HOLD_MS: '20000', FAKE_CLAUDE_PIDFILE: pidfile, FAKE_CLAUDE_IGNORE_TERM: ignore }));
    assert.equal(r.ok, true, r.error);
    const gpid = Number(readFileSync(pidfile, 'utf8'));
    assert.equal(alive(gpid), false, `grandchild alive after runChild (ignore SIGTERM: ${ignore})`);
  }
});

// C12: more token shapes; the whole token run goes
test('redact: GitHub, OpenAI/Anthropic, Slack, AWS keys and bearer tokens, whole', () => {
  const cases = [
    'ghp_abcdefghijklmnopqrstuvwxyz0123', 'gho_ABCDEFGHIJKLMNOPQRSTUV', 'github_pat_11ABCDEFG0_abcdefghijklmnopqrstuvwxyz',
    'sk-ant-api03-abc_def-ghi_jklmnopqrstuvwxyz', 'sk-proj_abcdefghijklmnopqrstu', 'xoxb-123-456-abc', 'xoxp-1-2', 'xoxo-9-z', 'xoxs-1-a', 'xoxr-7-q',
    'AKIAABCDEFGHIJKLMNOP',
  ];
  for (const t of cases) assert.equal(redact(`a ${t} b`), 'a [redacted] b', t);
  assert.equal(redact('Authorization: Bearer eyJhbG.ciOi-J_IU~z+/9=, next'), 'Authorization: [redacted], next');
  assert.equal(redact('sk-short and AKIA123 stay'), 'sk-short and AKIA123 stay');
});

// review round 2, batch E1
// S4: a child that could not be spawned never started a session, but a fresh child would fail the
// same way: it is not a dead resume
test('resumeOrFresh: a resume that cannot be spawned is returned as it is, no fresh child', async () => {
  const dir = fresh();
  const saved = process.env.CLAUDE_BIN;
  process.env.CLAUDE_BIN = join(dir, 'no-such-claude');
  try {
    const r = await resumeOrFresh(base(dir, {}, { resume: 's-old', freshPrompt: 'FRESH' }));
    assert.equal(r.ok, false);
    assert.match(r.error, /^spawn failed: ENOENT/);
    assert.equal(r.failedResume, undefined);
    assert.equal(existsSync(join(dir, 'events.log')), false);
    assert.deepEqual(readdirSync(dir).filter((f) => f.endsWith('.jsonl')), ['BILL-1-spec-1.jsonl']);
  } finally {
    process.env.CLAUDE_BIN = saved;
  }
});

// S1/T3/X3: what a runner stopped by a signal does with its children
test('endChildren: SIGTERM, then SIGKILL for a child that ignores it; returns the groups still alive', async () => {
  const dir = fresh();
  const running = runChild(base(dir, { FAKE_CLAUDE: 'hang', FAKE_CLAUDE_IGNORE_TERM: '1' }));
  const file = join(dir, 'BILL-1-spec-1.jsonl');
  for (let i = 0; i < 400 && !(existsSync(file) && /"init"/.test(readFileSync(file, 'utf8'))); i++) await new Promise((r) => setTimeout(r, 25));
  const t0 = Date.now();
  assert.deepEqual(await endChildren(), []);
  assert.ok(Date.now() - t0 >= 900, 'SIGKILL only after the SIGTERM grace');
  const r = await running;
  assert.match(r.error, /killed by SIGKILL/);

  // a group that cannot be ended (left alive whatever the signal): its pid comes back
  const dir2 = fresh();
  const running2 = runChild(base(dir2, { FAKE_CLAUDE: 'hang' }));
  for (let i = 0; i < 400 && !existsSync(join(dir2, 'BILL-1-spec-1.jsonl')); i++) await new Promise((r) => setTimeout(r, 25));
  await new Promise((r) => setTimeout(r, 100));
  const left = await endChildren({ isAlive: () => true, graceMs: 50, waitMs: 50 });
  assert.equal(left.length, 1);
  assert.ok(Number.isInteger(left[0]) && left[0] > 0);
  await running2;
});

const argvOf = (log) => JSON.parse(readFileSync(log, 'utf8')).argv;
const notGranted = (dir) => (existsSync(join(dir, 'events.log')) ? readFileSync(join(dir, 'events.log'), 'utf8') : '')
  .split('\n').filter((l) => / progress log store not granted: /.test(l));

test('runChild: under Location: repo a child in a linked worktree gets no --add-dir and no store', async () => {
  const { main, wt } = gitRepo();
  const dir = fresh();
  const log = join(dir, 'argv.json');
  assert.equal((await runChild(base(dir, { FAKE_CLAUDE: 'ok:RUNNER: done', FAKE_CLAUDE_LOG: log }, { cwd: wt }))).ok, true);
  assert.ok(!argvOf(log).includes('--add-dir'));
  assert.equal(existsSync(join(main, '.superpowers')), false);
});

test('runChild: a child in the main checkout gets no --add-dir, even under Location: local', async () => {
  const { main } = gitRepo();
  const dir = fresh();
  const log = join(dir, 'argv.json');
  assert.equal((await runChild(base(dir, { FAKE_CLAUDE: 'ok:RUNNER: done', FAKE_CLAUDE_LOG: log }, { cwd: main, logs: logStore(main) }))).ok, true);
  assert.ok(!argvOf(log).includes('--add-dir'));
  assert.deepEqual(notGranted(dir), []);
});

test('runChild: a store that cannot be made gets no --add-dir, one event, and the run goes on', async () => {
  const { main, wt } = gitRepo();
  mkdirSync(join(main, '.superpowers'), { mode: 0o500 }); // no write: ship-logs cannot be made
  const dir = fresh();
  const log = join(dir, 'argv.json');
  try {
    const r = await runChild(base(dir, { FAKE_CLAUDE: 'ok:RUNNER: done', FAKE_CLAUDE_LOG: log }, { cwd: wt, logs: logStore(wt) }));
    assert.equal(r.ok, true);
    assert.ok(!argvOf(log).includes('--add-dir'));
    assert.equal(notGranted(dir).length, 1);
    assert.match(notGranted(dir)[0], /EACCES/);
  } finally {
    chmodSync(join(main, '.superpowers'), 0o700);
  }
});

// final review: a child can rewrite a linked worktree's gitfile, so the store is fixed once, at the
// runner's start; a later child gets that store, never one a rewritten gitfile points to
test('runChild: the store given is used as it is, whatever the worktree gitfile says later', async () => {
  const { main, wt } = gitRepo();
  const logs = logStore(wt);
  const other = gitRepo();
  writeFileSync(join(wt, '.git'), `gitdir: ${join(other.main, '.git', 'worktrees', 'wt')}\n`);
  const dir = fresh();
  const log = join(dir, 'argv.json');
  assert.equal((await runChild(base(dir, { FAKE_CLAUDE: 'ok:RUNNER: done', FAKE_CLAUDE_LOG: log }, { cwd: wt, logs }))).ok, true);
  assert.deepEqual(argvOf(log).slice(-2), ['--add-dir', join(main, '.superpowers', 'ship-logs')]);
  assert.equal(existsSync(join(other.main, '.superpowers')), false);
});

test('runChild: a store that resolves elsewhere than expected is refused', async () => {
  const { wt } = gitRepo();
  const logs = { ...logStore(wt), expected: '/nowhere/.superpowers/ship-logs' };
  const dir = fresh();
  const log = join(dir, 'argv.json');
  assert.equal((await runChild(base(dir, { FAKE_CLAUDE: 'ok:RUNNER: done', FAKE_CLAUDE_LOG: log }, { cwd: wt, logs }))).ok, true);
  assert.ok(!argvOf(log).includes('--add-dir'));
  assert.match(notGranted(dir)[0], /resolves to/);
});
