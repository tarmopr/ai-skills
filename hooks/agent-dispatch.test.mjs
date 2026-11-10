// Tests for the Agent-dispatch hook. Run: node --test hooks/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decide, liveShipRun } from './agent-dispatch.mjs';

const now = Date.now();
const fresh = () => mkdtempSync(join(tmpdir(), 'agent-dispatch-'));
const live = (dir) => liveShipRun(dir, now);
const scan = (dir) => () => live(dir);

function ledger(root, sub, firstLine, ageMs = 0) {
  return ledgerLines(root, sub, [firstLine, 'Ruling: x'], ageMs);
}

function ledgerLines(root, sub, lines, ageMs = 0) {
  const dir = join(root, '.superpowers', sub);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'ledger.md');
  writeFileSync(file, `${lines.join('\n')}\n`);
  const t = (now - ageMs) / 1000;
  utimesSync(file, t, t);
  return file;
}

test('no ledger: allow', () => {
  assert.equal(decide({ prompt: 'x' }, scan(fresh())), null);
});

test('live ship-plan ledger, effort missing: deny names effort, the ledger and ## Models', () => {
  const dir = fresh();
  ledger(dir, 'ship-plan/feature-x', 'Phase: 2 | Plan: p | Issue: none');
  const r = decide({ prompt: 'x', model: 'sonnet' }, scan(dir));
  assert.match(r, /Missing: effort/);
  assert.match(r, /feature-x\/ledger\.md/);
  assert.match(r, /## Models/);
});

test('model and effort given, or a fork: allow without scanning', () => {
  const boom = () => assert.fail('scanned');
  assert.equal(decide({ prompt: 'x', model: 'sonnet', effort: 'high' }, boom), null);
  assert.equal(decide({ prompt: 'x', subagent_type: 'fork' }, boom), null);
});

test('Phase: done: allow', () => {
  const dir = fresh();
  ledger(dir, 'ship-plan/feature-x', 'Phase: done | Plan: p');
  assert.equal(live(dir), null);
});

test('ledger older than 6 h: allow', () => {
  const dir = fresh();
  ledger(dir, 'ship-plan/feature-x', 'Phase: 2 | Plan: p', 6 * 3600e3 + 1000);
  assert.equal(live(dir), null);
});

test('verify-and-fix ledger with no Phase line, fresh: deny names model when it is missing', () => {
  const dir = fresh();
  ledger(dir, 'verify-and-fix/feature-x', 'Round 1: gates green');
  assert.match(decide({ prompt: 'x', effort: 'high' }, scan(dir)), /Missing: model/);
});

test('ship-issue and ship-queue ledgers count', () => {
  const a = fresh();
  assert.equal(live(a), null);
  const issue = ledger(a, 'ship-issue/PROJ-1', 'Phase: I2 | Issue: PROJ-1');
  assert.equal(live(a), issue);
  const b = fresh();
  const queue = ledger(b, 'ship-queue/PROJ-9', 'Phase: running | Parent: PROJ-9');
  assert.equal(live(b), queue);
});

test('both missing: the reason names both', () => {
  const dir = fresh();
  ledger(dir, 'ship-issue/PROJ-1', 'Phase: I2');
  assert.match(decide({ prompt: 'x' }, scan(dir)), /Missing: model, effort/);
});

test('another skill folder under .superpowers does not count', () => {
  const dir = fresh();
  ledger(dir, 'sdd/some-plan', 'Phase: 2');
  assert.equal(live(dir), null);
});

test('a root that does not exist: no live run, no throw', () => {
  assert.equal(live(join(tmpdir(), 'no-such-dir-agent-dispatch')), null);
});

test('verify-and-fix ledger ending with Done: allow', () => {
  const dir = fresh();
  ledgerLines(dir, 'verify-and-fix/feature-x', ['Round 1: gates green', 'Done: abc1234 — clean']);
  assert.equal(live(dir), null);
});

test('verify-and-fix ledger with a round after Done: live again', () => {
  const dir = fresh();
  const file = ledgerLines(dir, 'verify-and-fix/feature-x', ['Done: abc1234 — clean', 'Round 1: gates green']);
  assert.equal(live(dir), file);
});

test('verify-and-fix ledger with a line after Done:, its same-named ship-plan ledger Phase: done: allow', () => {
  const dir = fresh();
  ledgerLines(dir, 'ship-plan/feature-x', ['Phase: done | Plan: p']);
  ledgerLines(dir, 'verify-and-fix/feature-x', ['Done: abc1234 — clean', 'Review: r1 someone APPROVED — fine — none']);
  assert.equal(live(dir), null);
});

test('verify-and-fix ledger with a line after Done:, its ship-plan ledger open or absent: live', () => {
  const open = fresh();
  ledgerLines(open, 'ship-plan/feature-x', ['Phase: 4 | Plan: p'], 7 * 3600e3);
  const file = ledgerLines(open, 'verify-and-fix/feature-x', ['Done: abc1234 — clean', 'Round 2: gates green']);
  assert.equal(live(open), file);
  const alone = fresh();
  const other = ledgerLines(alone, 'verify-and-fix/feature-y', ['Done: abc1234 — clean', 'Round 2: gates green']);
  assert.equal(live(alone), other);
});

test('ship-queue ledger ending with Summary: posted or Stopped: allow', () => {
  const a = fresh();
  ledgerLines(a, 'ship-queue/PROJ-9', ['Phase: running | Parent: PROJ-9', 'Summary: posted 2026-11-02 10:00']);
  assert.equal(live(a), null);
  const b = fresh();
  ledgerLines(b, 'ship-queue/PROJ-9', ['Phase: preflight | Parent: PROJ-9', 'Stopped: config missing']);
  assert.equal(live(b), null);
});

test('ship-issue ledger whose ship-plan ledger is Phase: done: allow', () => {
  const dir = fresh();
  ledgerLines(dir, 'ship-plan/feature-x', ['Phase: done | Plan: p']);
  ledgerLines(dir, 'ship-issue/PROJ-1', ['Phase: I4 | Issue: PROJ-1 | Branch: feature/x | Spec: s | Plan: p | ship-plan ledger: .superpowers/ship-plan/feature-x/ledger.md']);
  assert.equal(live(dir), null);
});

test('ship-issue ledger whose ship-plan ledger is open: live', () => {
  const dir = fresh();
  ledgerLines(dir, 'ship-plan/feature-x', ['Phase: 4 | Plan: p'], 7 * 3600e3);
  const file = ledgerLines(dir, 'ship-issue/PROJ-1', ['Phase: I4 | Issue: PROJ-1 | ship-plan ledger: .superpowers/ship-plan/feature-x/ledger.md']);
  assert.equal(live(dir), file);
});

test('ship-issue ledger whose ship-plan ledger sat in a checkout that is gone: allow', () => {
  const dir = fresh();
  const gone = join(fresh(), 'removed-worktree');
  ledgerLines(dir, 'ship-issue/PROJ-1', [`Phase: I6 | Issue: PROJ-1 | ship-plan ledger: ${join(gone, '.superpowers', 'ship-plan', 'feature-x', 'ledger.md')}`]);
  assert.equal(live(dir), null);
});

test('ship-issue ledger whose ship-plan ledger is not written yet, in a checkout that exists: live', () => {
  const abs = fresh();
  const absFile = ledgerLines(abs, 'ship-issue/PROJ-1', [`Phase: I6 | Issue: PROJ-1 | ship-plan ledger: ${join(fresh(), '.superpowers', 'ship-plan', 'feature-x', 'ledger.md')}`]);
  assert.equal(live(abs), absFile);
  const rel = fresh();
  const relFile = ledgerLines(rel, 'ship-issue/PROJ-2', ['Phase: I6 | Issue: PROJ-2 | ship-plan ledger: .superpowers/ship-plan/feature-y/ledger.md']);
  assert.equal(live(rel), relFile);
});

test('deny reason gives the absolute defaults path and what an unrelated session passes', () => {
  const dir = fresh();
  ledger(dir, 'ship-plan/feature-x', 'Phase: 2 | Plan: p');
  const r = decide({ prompt: 'x' }, scan(dir));
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
  assert.equal(live(dir), file);
  assert.match(decide({ model: 'sonnet' }, scan(dir)), /Missing: effort/);
});

test('runner state stopped, older than 6 h or unreadable: allow', () => {
  const dir = fresh();
  runnerState(dir, 'issue-A', { stopped: '2026-11-02T10:00:00Z' });
  runnerState(dir, 'issue-B', { stopped: null }, 6 * 3600e3 + 1000);
  const bad = join(dir, '.superpowers', 'ship-runner', 'issue-C');
  mkdirSync(bad, { recursive: true });
  writeFileSync(join(bad, 'state.json'), '{not json');
  assert.equal(live(dir), null);
});

// review round 1, C8: a runner that died without writing `stopped` leaves no live run behind
test('runner state with a lock: live only while the lock\'s runner pid is alive; no lock: the state decides', () => {
  const dead = fresh();
  const deadRun = runnerState(dead, 'issue-D', { stopped: null });
  writeFileSync(join(dirname(deadRun), 'lock'), JSON.stringify({ runner: spawnSync(process.execPath, ['-e', '']).pid, child: null }));
  assert.equal(live(dead), null);
  const alive = fresh();
  const liveRun = runnerState(alive, 'issue-L', { stopped: null });
  writeFileSync(join(dirname(liveRun), 'lock'), JSON.stringify({ runner: process.pid, child: null }));
  assert.equal(live(alive), liveRun);
  const noLock = fresh();
  const noLockRun = runnerState(noLock, 'issue-N', { stopped: null });
  assert.equal(live(noLock), noLockRun);
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
  const r = spawnSync(process.execPath, [HOOK], { input: '{not json', encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /agent-dispatch: .*JSON/);
});
