// Tests for the ship runner state, lock and event log. Run: node --test skills/ship-plan/scripts/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, linkSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { acquireLock, answersNamed, emit, readAnswers, readLock, readState, releaseLock, runDir, runGit, setChildPid, writeState } from './runner-lib.mjs';

const fresh = () => mkdtempSync(join(tmpdir(), 'runner-lib-'));

test('runDir: kind and id, slashes dashed', () =>
  assert.equal(runDir('/r', 'plan', 'feature/x'), '/r/.superpowers/ship-runner/plan-feature-x/'));

test('state round-trips and is written atomically', () => {
  const dir = fresh();
  const state = {
    kind: 'queue', id: 'BILL-1', current: 'BILL-2', stopped: null,
    items: [{
      key: 'BILL-2', phase: 'spec', status: 'running', reason: '', deps: ['BILL-1'],
      sessions: [{ phase: 'spec', sessionId: 's1', costUsd: 0.5, turns: 3, minutes: 2 }], answersFile: null,
    }],
  };
  writeState(dir, state);
  assert.deepEqual(readState(dir), state);
  assert.equal(existsSync(join(dir, 'state.json.tmp')), false);
});

test('readState: missing file -> null', () => assert.equal(readState(fresh()), null));

test('lock: second acquire with live holder fails', () => {
  const dir = fresh();
  assert.deepEqual(acquireLock(dir, process.pid), { ok: true });
  assert.deepEqual(acquireLock(dir, 1), { ok: false, holder: process.pid });
});

test('lock: dead holder is replaced', () => {
  const dir = fresh();
  writeFileSync(join(dir, 'lock'), JSON.stringify({ runner: 999999, child: null }));
  assert.deepEqual(acquireLock(dir, process.pid), { ok: true });
  assert.equal(JSON.parse(readFileSync(join(dir, 'lock'), 'utf8')).runner, process.pid);
});

test('lock: child pid is set and cleared, release removes the lock', () => {
  const dir = fresh();
  acquireLock(dir, process.pid);
  setChildPid(dir, 4242);
  assert.deepEqual(JSON.parse(readFileSync(join(dir, 'lock'), 'utf8')), { runner: process.pid, child: 4242 });
  setChildPid(dir, null);
  assert.equal(JSON.parse(readFileSync(join(dir, 'lock'), 'utf8')).child, null);
  releaseLock(dir);
  assert.equal(existsSync(join(dir, 'lock')), false);
  releaseLock(dir);
});

test('emit: one line per call, newline in text flattened', () => {
  const dir = fresh();
  emit(dir, 'BILL-1', 'spec', 'waiting', 'a\nb');
  emit(dir, 'BILL-1', 'spec', 'done', 'ok');
  const lines = readFileSync(join(dir, 'events.log'), 'utf8').split('\n');
  assert.equal(lines.length, 3);
  assert.match(lines[0], /^\S+ BILL-1 spec waiting a b$/);
  assert.equal(lines[2], '');
});

test('setChildPid replaces the lock by rename, never writing it in place', () => {
  const dir = fresh();
  assert.equal(acquireLock(dir, process.pid).ok, true);
  // a read-only lock file: an in-place write fails, a rename over it does not
  chmodSync(join(dir, 'lock'), 0o444);
  setChildPid(dir, 4242);
  assert.deepEqual(JSON.parse(readFileSync(join(dir, 'lock'), 'utf8')), { runner: process.pid, child: 4242 });
  assert.deepEqual(readdirSync(dir), ['lock']); // no temp file left behind
});

// review round 1, C2: an atomic lock, an unreadable lock judged by its age, release by the owner only
test('lock: an empty or corrupt lock younger than 10 s is held; older, it is stale and taken over', () => {
  for (const body of ['', '{not json']) {
    const dir = fresh();
    writeFileSync(join(dir, 'lock'), body);
    assert.equal(acquireLock(dir, process.pid).ok, false, `young lock ${JSON.stringify(body)}`);
    assert.equal(readFileSync(join(dir, 'lock'), 'utf8'), body); // left alone
    const old = (Date.now() - 11000) / 1000;
    utimesSync(join(dir, 'lock'), old, old);
    assert.deepEqual(acquireLock(dir, process.pid), { ok: true });
    assert.equal(JSON.parse(readFileSync(join(dir, 'lock'), 'utf8')).runner, process.pid);
    assert.deepEqual(readdirSync(dir), ['lock']); // no temp or stale copy left behind
  }
});

test('lock: taken by a hard link of a complete temp file; a dead holder\'s lock is renamed away, not removed in place', () => {
  const dir = fresh();
  assert.deepEqual(acquireLock(dir, process.pid), { ok: true });
  assert.deepEqual(readdirSync(dir), ['lock']);
  assert.equal(statSync(join(dir, 'lock')).nlink, 1); // the temp name is gone
  const dead = fresh();
  writeFileSync(join(dead, 'lock'), JSON.stringify({ runner: 999999, child: null }));
  assert.deepEqual(acquireLock(dead, process.pid), { ok: true });
  assert.deepEqual(readdirSync(dead), ['lock']);
});

test('lock: releaseLock leaves a lock that another runner holds, or one it cannot read', () => {
  const dir = fresh();
  writeFileSync(join(dir, 'lock'), JSON.stringify({ runner: process.pid + 1, child: null }));
  releaseLock(dir);
  assert.ok(existsSync(join(dir, 'lock')));
  writeFileSync(join(dir, 'lock'), '{not json');
  releaseLock(dir);
  assert.ok(existsSync(join(dir, 'lock')));
  writeFileSync(join(dir, 'lock'), JSON.stringify({ runner: process.pid, child: null }));
  releaseLock(dir);
  assert.equal(existsSync(join(dir, 'lock')), false);
});

test('setChildPid: only the runner that holds the lock writes it', () => {
  const dir = fresh();
  const other = JSON.stringify({ runner: process.pid + 1, child: null });
  writeFileSync(join(dir, 'lock'), other);
  setChildPid(dir, 4242);
  assert.equal(readFileSync(join(dir, 'lock'), 'utf8'), other);
});

// C7: a run dir is one folder under ship-runner/
test('runDir: backslashes dashed too; an id with .. is refused', () => {
  assert.equal(runDir('/r', 'plan', 'a\\b/c'), '/r/.superpowers/ship-runner/plan-a-b-c/');
  assert.throws(() => runDir('/r', 'plan', '../x'), /\.\./);
  assert.throws(() => runDir('/r', 'issue', '..'), /\.\./);
});

// C5: child-written text reaches the watching session through events.log
test('emit: control characters are stripped from the line, a tab is kept', () => {
  const dir = fresh();
  emit(dir, 'K-1', 'spec', 'progress', 'Progress: \x1b[31mred\x1b[0m\x07 a\tb\r\x00\x9bc');
  const line = readFileSync(join(dir, 'events.log'), 'utf8');
  assert.match(line, /^\S+ K-1 spec progress Progress: \[31mred\[0m a\tb c\n$/);
});

// review round 2, batch E1 (S4)
test('readState: a state.json that is not JSON throws with its path', () => {
  const dir = fresh();
  writeFileSync(join(dir, 'state.json'), '{ not json');
  assert.throws(() => readState(dir), (e) => e.message.includes(join(dir, 'state.json')) && /JSON/.test(e.message));
});

test('readLock: missing -> null; unparseable -> null (acquireLock judges it by age); any other read error throws', () => {
  const dir = fresh();
  assert.equal(readLock(dir), null);
  writeFileSync(join(dir, 'lock'), '{ half');
  assert.equal(readLock(dir), null);
  const dir2 = fresh();
  mkdirSync(join(dir2, 'lock')); // a folder: EISDIR
  assert.throws(() => readLock(dir2), /EISDIR/);
});

// R2-1 (review round 2): a child can plant git code (fsmonitor, hooks); the runner's git never
// runs it, and never hands it SHIP_RUNNER_ALLOW_BYPASS
test('runGit: fsmonitor and hooks off, SHIP_RUNNER_ALLOW_BYPASS never in git\'s env', () => {
  const root = mkdtempSync(join(tmpdir(), 'runner-git-'));
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['config', 'core.hooksPath', join(root, 'hooks')], { cwd: root });
  const was = process.env.SHIP_RUNNER_ALLOW_BYPASS;
  process.env.SHIP_RUNNER_ALLOW_BYPASS = '1';
  try {
    assert.equal(runGit(root, ['-c', 'alias.env=!echo "[$SHIP_RUNNER_ALLOW_BYPASS]"', 'env']), '[]\n');
    assert.equal(runGit(root, ['config', 'core.hooksPath']).trim(), '/dev/null');
    assert.equal(runGit(root, ['config', 'core.fsmonitor']).trim(), 'false');
  } finally {
    if (was === undefined) delete process.env.SHIP_RUNNER_ALLOW_BYPASS;
    else process.env.SHIP_RUNNER_ALLOW_BYPASS = was;
  }
});

// T11 (review round 3): an answers file is read only as a plain file with one name
test('readAnswers: a plain file is read; a symlink (O_NOFOLLOW) and a second hard link throw', () => {
  const dir = mkdtempSync(join(tmpdir(), 'runner-lib-'));
  const plain = join(dir, 'answers-A-1.md');
  writeFileSync(plain, '1A\n');
  assert.equal(readAnswers(plain), '1A\n');
  const target = join(dir, 'events.log');
  writeFileSync(target, 'a child wrote this\n');
  symlinkSync(target, join(dir, 'answers-A-2.md'));
  assert.throws(() => readAnswers(join(dir, 'answers-A-2.md')), (e) => e.code === 'ELOOP' || /is a link/.test(e.message));
  linkSync(target, join(dir, 'answers-A-3.md'));
  assert.throws(() => readAnswers(join(dir, 'answers-A-3.md')), /answers-A-3\.md is a link, not a plain file/);
});

// X10: an answers file name of the item's own, never a path or another key's
test('answersNamed: answers-<KEY>.md or answers-<KEY>@<n>.md for this key only; consumed takes only @<n>', () => {
  assert.ok(answersNamed('A-1', 'answers-A-1.md'));
  assert.ok(answersNamed('A-1', 'answers-A-1@12.md'));
  assert.ok(answersNamed('#12.x', 'answers-#12.x@1.md', { consumed: true }));
  assert.ok(!answersNamed('A-1', 'answers-A-1.md', { consumed: true }));
  for (const bad of ['answers-A-2@1.md', '../answers-A-1@1.md', '/tmp/answers-A-1@1.md', 'answers-A-1@1.md/x', 'answers-A-1@rejected-1.md', 'answers-A-1@1xmd']) {
    assert.ok(!answersNamed('A-1', bad), bad);
  }
  assert.ok(!answersNamed('#12.x', 'answers-#12Ax@1.md'), 'a . in the key is literal');
});
