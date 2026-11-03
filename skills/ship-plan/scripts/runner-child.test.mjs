// Tests for the child launcher and stream reader. Run: node --test 'skills/ship-plan/scripts/*.test.mjs'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireLock, alive } from './runner-lib.mjs';
import { childArgs, isLimitError, parseMarker, resumeOrFresh, runChild } from './runner-child.mjs';

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
});

test('parseMarker: last RUNNER line wins; none -> null', () => {
  assert.deepEqual(parseMarker('x\nRUNNER: waiting 2 questions\n'), { status: 'waiting', text: '2 questions' });
  assert.deepEqual(parseMarker('RUNNER: blocked a\nmid\nRUNNER: phase-done\n'), { status: 'phase-done', text: '' });
  assert.equal(parseMarker('no marker here\nRUNNER: finished\n  RUNNER: done'), null);
  assert.equal(parseMarker(''), null);
});

test('runChild ok: sessionId, marker, cost; jsonl written; prompt not in argv', async () => {
  const dir = fresh();
  const log = join(dir, 'fake.json');
  const r = await runChild(base(dir, { FAKE_CLAUDE: 'ok:RUNNER: phase-done spec written', FAKE_CLAUDE_LOG: log }));
  assert.deepEqual(r, {
    ok: true, sessionId: 's-1', marker: { status: 'phase-done', text: 'spec written' },
    costUsd: 0.42, turns: 3, minutes: 3, error: null,
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
