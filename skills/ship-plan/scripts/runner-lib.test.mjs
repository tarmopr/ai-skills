// Tests for the ship runner state, lock and event log. Run: node --test skills/ship-plan/scripts/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acquireLock, emit, readState, releaseLock, runDir, setChildPid, writeState } from './runner-lib.mjs';

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
