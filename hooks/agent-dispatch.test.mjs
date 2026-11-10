// Tests for the Agent-dispatch hook. Run: node --test hooks/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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

function ledgerLines(root, sub, lines, ageMs = 0) {
  const dir = join(root, '.superpowers', sub);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'ledger.md');
  writeFileSync(file, `${lines.join('\n')}\n`);
  const t = (now - ageMs) / 1000;
  utimesSync(file, t, t);
  return file;
}

test('verify-and-fix ledger ending with Done: allow', () => {
  const dir = fresh();
  ledgerLines(dir, 'verify-and-fix/feature-x', ['Round 1: gates green', 'Done: abc1234 — clean']);
  assert.deepEqual(liveShipLedgers([dir], now), []);
});

test('verify-and-fix ledger with a round after Done: live again', () => {
  const dir = fresh();
  ledgerLines(dir, 'verify-and-fix/feature-x', ['Done: abc1234 — clean', 'Round 1: gates green']);
  assert.equal(liveShipLedgers([dir], now).length, 1);
});

test('ship-queue ledger ending with Summary: posted or Stopped: allow', () => {
  const a = fresh();
  ledgerLines(a, 'ship-queue/PROJ-9', ['Phase: running | Parent: PROJ-9', 'Summary: posted 2026-11-02 10:00']);
  assert.deepEqual(liveShipLedgers([a], now), []);
  const b = fresh();
  ledgerLines(b, 'ship-queue/PROJ-9', ['Phase: preflight | Parent: PROJ-9', 'Stopped: config missing']);
  assert.deepEqual(liveShipLedgers([b], now), []);
});

test('ship-issue ledger whose ship-plan ledger is Phase: done: allow', () => {
  const dir = fresh();
  ledgerLines(dir, 'ship-plan/feature-x', ['Phase: done | Plan: p']);
  ledgerLines(dir, 'ship-issue/PROJ-1', ['Phase: I4 | Issue: PROJ-1 | Branch: feature/x | Spec: s | Plan: p | ship-plan ledger: .superpowers/ship-plan/feature-x/ledger.md']);
  assert.deepEqual(liveShipLedgers([dir], now), []);
});

test('ship-issue ledger whose ship-plan ledger is open: live', () => {
  const dir = fresh();
  ledgerLines(dir, 'ship-plan/feature-x', ['Phase: 4 | Plan: p'], 7 * 3600e3);
  const file = ledgerLines(dir, 'ship-issue/PROJ-1', ['Phase: I4 | Issue: PROJ-1 | ship-plan ledger: .superpowers/ship-plan/feature-x/ledger.md']);
  assert.deepEqual(liveShipLedgers([dir], now), [file]);
});

test('deny reason gives the absolute defaults path and what an unrelated session passes', () => {
  const dir = fresh();
  ledger(dir, 'ship-plan/feature-x', 'Phase: 2 | Plan: p');
  const r = decide({ prompt: 'x' }, liveShipLedgers([dir], now));
  assert.match(r, /\/skills\/ship-plan\/config-format\.md/);
  assert.doesNotMatch(r, /defaults: ship-plan\/config-format\.md/);
  assert.match(r, /not part of that run/);
});

function runnerState(root, id, state, ageMs = 0) {
  const dir = join(root, '.superpowers', 'ship-runner', id);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'state.json');
  writeFileSync(file, JSON.stringify(state));
  const t = (now - ageMs) / 1000;
  utimesSync(file, t, t);
  return file;
}

test('live runner state counts as a live ship run', () => {
  const dir = fresh();
  const file = runnerState(dir, 'issue-X', { kind: 'issue', id: 'X', current: 'X', stopped: null });
  const live = liveShipLedgers([dir], now);
  assert.deepEqual(live, [file]);
  assert.match(decide({ model: 'sonnet' }, live), /Missing: effort/);
});

test('runner state stopped, older than 6 h or unreadable: allow', () => {
  const dir = fresh();
  runnerState(dir, 'issue-A', { stopped: '2026-11-02T10:00:00Z' });
  runnerState(dir, 'issue-B', { stopped: null }, 6 * 3600e3 + 1000);
  const bad = join(dir, '.superpowers', 'ship-runner', 'issue-C');
  mkdirSync(bad, { recursive: true });
  writeFileSync(join(bad, 'state.json'), '{not json');
  assert.deepEqual(liveShipLedgers([dir], now), []);
});

// review round 1, C8: a runner that died without writing `stopped` leaves no live run behind
test('runner state with a lock: live only while the lock\'s runner pid is alive; no lock: the state decides', () => {
  const dir = fresh();
  const deadRun = runnerState(dir, 'issue-D', { stopped: null });
  const dead = spawnSync(process.execPath, ['-e', '']).pid;
  writeFileSync(join(dirname(deadRun), 'lock'), JSON.stringify({ runner: dead, child: null }));
  const liveRun = runnerState(dir, 'issue-L', { stopped: null });
  writeFileSync(join(dirname(liveRun), 'lock'), JSON.stringify({ runner: process.pid, child: null }));
  const noLock = runnerState(dir, 'issue-N', { stopped: null });
  assert.deepEqual(liveShipLedgers([dir], now).sort(), [liveRun, noLock].sort());
});

// The hook end to end, in a scratch repo with a linked worktree. No GIT_* from a calling hook
// and no global or system git config.
const HOOK = join(dirname(fileURLToPath(import.meta.url)), 'agent-dispatch.mjs');
const GIT_ENV = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));
Object.assign(GIT_ENV, { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' });
function git(cwd, ...args) {
  const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args], { cwd, encoding: 'utf8', env: GIT_ENV });
  assert.equal(r.status, 0, r.stderr);
}
function repoWithWorktree() {
  const base = fresh();
  const main = join(base, 'main');
  const wt = join(base, 'wt');
  mkdirSync(join(main, 'sub'), { recursive: true });
  git(main, 'init', '-q');
  git(main, 'commit', '-q', '--allow-empty', '-m', 'init');
  git(main, 'worktree', 'add', '-q', '--detach', wt);
  mkdirSync(join(wt, 'sub'));
  return { main, wt };
}
function runHook(cwd, toolInput = { prompt: 'x' }) {
  const r = spawnSync(process.execPath, [HOOK], { input: JSON.stringify({ cwd, tool_input: toolInput }), encoding: 'utf8', env: GIT_ENV });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout ? JSON.parse(r.stdout).hookSpecificOutput : null;
}

test('hook: a live run in another worktree of the repo does not gate this session', () => {
  const { main, wt } = repoWithWorktree();
  ledger(wt, 'ship-plan/feature-other', 'Phase: 4R awaiting review | Plan: p');
  assert.equal(runHook(main), null);
  assert.equal(runHook(join(main, 'sub')), null);
});

test('hook: a live run in the session\'s own worktree gates it, from any folder in it', () => {
  const { main, wt } = repoWithWorktree();
  ledger(wt, 'ship-plan/feature-own', 'Phase: 2 | Plan: p');
  for (const cwd of [wt, join(wt, 'sub')]) {
    const out = runHook(cwd);
    assert.equal(out.permissionDecision, 'deny');
    assert.match(out.permissionDecisionReason, /feature-own\/ledger\.md/);
  }
  ledger(main, 'ship-issue/PROJ-1', 'Phase: I2 | Issue: PROJ-1');
  assert.match(runHook(join(main, 'sub')).permissionDecisionReason, /PROJ-1\/ledger\.md/);
});

test('hook: outside a git repo, the cwd itself is the root', () => {
  const dir = fresh();
  ledger(dir, 'ship-plan/feature-x', 'Phase: 2 | Plan: p');
  assert.equal(runHook(dir).permissionDecision, 'deny');
  assert.equal(runHook(dir, { prompt: 'x', model: 'sonnet', effort: 'low' }), null);
});

test('hook: an internal error allows the call and says why on stderr', () => {
  const r = spawnSync(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), 'agent-dispatch.mjs')], { input: '{not json', encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /agent-dispatch: .*JSON/);
});
