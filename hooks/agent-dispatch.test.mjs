// Tests for the Agent-dispatch hook. Run: node --test hooks/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decide, liveShipLedgers } from './agent-dispatch.mjs';

const now = Date.now();
const fresh = () => mkdtempSync(join(tmpdir(), 'agent-dispatch-'));

function ledger(root, sub, firstLine, ageMs = 0) {
  const dir = join(root, '.superpowers', sub);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'ledger.md');
  writeFileSync(file, `${firstLine}\nRuling: x\n`);
  const t = (now - ageMs) / 1000;
  utimesSync(file, t, t);
  return file;
}

test('no ledger: allow', () => {
  const dir = fresh();
  assert.equal(decide({ prompt: 'x' }, liveShipLedgers([dir], now)), null);
});

test('live ship-plan ledger, effort missing: deny names effort, the ledger and ## Models', () => {
  const dir = fresh();
  ledger(dir, 'ship-plan/feature-x', 'Phase: 2 | Plan: p | Issue: none');
  const r = decide({ prompt: 'x', model: 'sonnet' }, liveShipLedgers([dir], now));
  assert.match(r, /Missing: effort/);
  assert.match(r, /feature-x\/ledger\.md/);
  assert.match(r, /## Models/);
});

test('live, model and effort given: allow', () => {
  const dir = fresh();
  ledger(dir, 'ship-plan/feature-x', 'Phase: 2 | Plan: p');
  assert.equal(decide({ prompt: 'x', model: 'sonnet', effort: 'high' }, liveShipLedgers([dir], now)), null);
});

test('Phase: done: allow', () => {
  const dir = fresh();
  ledger(dir, 'ship-plan/feature-x', 'Phase: done | Plan: p');
  assert.equal(decide({ prompt: 'x' }, liveShipLedgers([dir], now)), null);
});

test('ledger older than 6 h: allow', () => {
  const dir = fresh();
  ledger(dir, 'ship-plan/feature-x', 'Phase: 2 | Plan: p', 6 * 3600e3 + 1000);
  assert.equal(decide({ prompt: 'x' }, liveShipLedgers([dir], now)), null);
});

test('fork: allow', () => {
  const dir = fresh();
  ledger(dir, 'ship-plan/feature-x', 'Phase: 2 | Plan: p');
  assert.equal(decide({ prompt: 'x', subagent_type: 'fork' }, liveShipLedgers([dir], now)), null);
});

test('verify-and-fix ledger with no Phase line, fresh: deny names model when it is missing', () => {
  const dir = fresh();
  ledger(dir, 'verify-and-fix/feature-x', 'Round 1: gates green');
  const r = decide({ prompt: 'x', effort: 'high' }, liveShipLedgers([dir], now));
  assert.match(r, /Missing: model/);
});

test('ship-issue and ship-queue ledgers count', () => {
  const a = fresh();
  ledger(a, 'ship-issue/PROJ-1', 'Phase: I2 | Issue: PROJ-1');
  assert.equal(liveShipLedgers([a], now).length, 1);
  const b = fresh();
  ledger(b, 'ship-queue/PROJ-9', 'Phase: running | Parent: PROJ-9');
  assert.equal(liveShipLedgers([b], now).length, 1);
});

test('both missing: the reason names both', () => {
  const dir = fresh();
  ledger(dir, 'ship-issue/PROJ-1', 'Phase: I2');
  assert.match(decide({ prompt: 'x' }, liveShipLedgers([dir], now)), /Missing: model, effort/);
});

test('another skill folder under .superpowers does not count', () => {
  const dir = fresh();
  ledger(dir, 'sdd/some-plan', 'Phase: 2');
  assert.deepEqual(liveShipLedgers([dir], now), []);
});

test('two roots: a live ledger in the second root counts', () => {
  const a = fresh();
  const b = fresh();
  const file = ledger(b, 'ship-plan/feature-y', 'Phase: 4 | Plan: p');
  assert.deepEqual(liveShipLedgers([a, b], now), [file]);
});

test('a root that does not exist: no ledgers, no throw', () => {
  assert.deepEqual(liveShipLedgers([join(tmpdir(), 'no-such-dir-agent-dispatch')], now), []);
});
