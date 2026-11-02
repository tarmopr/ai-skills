// Tests for the queue scheduler. Run: node --test 'skills/ship-plan/scripts/*.test.mjs'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextItem } from './runner-queue.mjs';

const item = (key, extra = {}) => ({ key, phase: null, status: 'queued', reason: '', deps: [], sessions: [], answersFile: null, ...extra });
const state = (...items) => ({ kind: 'queue', id: 'P-1', items, current: null, stopped: null });
const by = (s, key) => s.items.find((i) => i.key === key);

test('nextItem: deps on a waiting item -> not started, reason names it', () => {
  const s = state(item('A', { status: 'waiting' }), item('B', { deps: ['A'] }), item('C', { deps: ['B'] }), item('D'));
  assert.equal(nextItem(s).key, 'D');
  assert.equal(by(s, 'B').status, 'not started');
  assert.equal(by(s, 'B').reason, 'depends on A (waiting)');
  // transitive: C depends on a not-started item
  assert.equal(by(s, 'C').status, 'not started');
  assert.equal(by(s, 'C').reason, 'depends on B (not started)');
  for (const bad of ['blocked', 'cut off', 'not started']) {
    const t = state(item('A', { status: bad }), item('B', { deps: ['A'] }));
    assert.equal(nextItem(t), null);
    assert.equal(by(t, 'B').reason, `depends on A (${bad})`);
  }
});

test('nextItem: answered item goes before untouched (Review Focus 3)', () => {
  const s = state(item('A', { status: 'done' }), item('B'), item('C', { answersFile: 'answers-C.md' }));
  assert.equal(nextItem(s).key, 'C');
  by(s, 'C').status = 'done';
  assert.equal(nextItem(s).key, 'B');
});

test('nextItem: waits for a queued dep, takes the next item whose deps are done', () => {
  const s = state(item('A', { deps: ['B'] }), item('B'), item('C', { status: 'done' }), item('D', { deps: ['C'] }));
  assert.equal(nextItem(s).key, 'B');
  by(s, 'B').status = 'done';
  assert.equal(nextItem(s).key, 'A');
  by(s, 'A').status = 'done';
  assert.equal(nextItem(s).key, 'D');
  by(s, 'D').status = 'done';
  assert.equal(nextItem(s), null);
});

test('nextItem: a dependency that comes back (answered) frees its dependents again', () => {
  const s = state(item('A', { status: 'waiting' }), item('B', { deps: ['A'] }));
  assert.equal(nextItem(s), null);
  assert.equal(by(s, 'B').status, 'not started');
  Object.assign(by(s, 'A'), { status: 'queued', answersFile: 'answers-A.md' });
  assert.equal(nextItem(s).key, 'A');
  assert.equal(by(s, 'B').status, 'queued');
  // a not-started item for another cause stays
  const t = state(item('A', { status: 'not started', reason: 'session limit' }));
  assert.equal(nextItem(t), null);
  assert.equal(by(t, 'A').reason, 'session limit');
});

test('nextItem: a cycle or a dep outside the queue never runs; reason says why', () => {
  const s = state(item('A', { deps: ['B'] }), item('B', { deps: ['A'] }), item('C', { deps: ['Z'] }));
  assert.equal(nextItem(s), null);
  assert.equal(by(s, 'A').reason, 'depends on B (queued)');
  assert.equal(by(s, 'B').status, 'not started');
  assert.equal(by(s, 'C').reason, 'depends on Z (not in queue)');
});
