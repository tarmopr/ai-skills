// Tests for the runner CLI. Run: node --test 'skills/ship-plan/scripts/*.test.mjs'
// Every child is fake-claude.mjs (CLAUDE_BIN); FAKE_CLAUDE_BY_KEY gives each key its own behavior.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readState, runDir, writeState } from './runner-lib.mjs';
import { MODEL_DEFAULTS, parseConfig } from './runner.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNNER = join(HERE, 'runner.mjs');
const ENV = { ...process.env, CLAUDE_BIN: join(HERE, 'fake-claude.mjs'), SHIP_RUNNER_POLL_MS: '50' };

const issueLedger = (k) => `.superpowers/ship-issue/${k}/ledger.md`;
const planLedger = (k) => `.superpowers/ship-plan/feat-${k.toLowerCase()}/ledger.md`;
const issueFirst = (k) => `Phase: I6 | Issue: ${k} | Branch: feat/${k} | Plan: docs/plan.md | ship-plan ledger: ${planLedger(k)}`;
const planFirst = (k, p) => `Phase: ${p} | Plan: docs/plan.md | Issue: ${k} | PR: #4`;
const Q = 'Asked: which db? — pending';

function repo() {
  return mkdtempSync(join(tmpdir(), 'runner-cli-'));
}
function put(root, rel, lines) {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), lines.join('\n') + '\n');
}
// Each key's ledgers at ship-plan phase 3: the next child is verify.
function atVerify(root, ...keys) {
  for (const k of keys) {
    put(root, issueLedger(k), [issueFirst(k)]);
    put(root, planLedger(k), [planFirst(k, '3')]);
  }
}
const ops = (o) => JSON.stringify(o);
// The verify child finishes the issue.
const ships = (k) => ({ FAKE_CLAUDE: 'ok:RUNNER: done', FAKE_CLAUDE_LEDGER_APPEND: ops([{ file: planLedger(k), firstLine: planFirst(k, 'done') }]) });
// The verify child parks a question; a child that gets answers marks it answered and finishes.
const waitsThenShips = (k, extra = {}) => ({
  FAKE_CLAUDE: 'ok:RUNNER: phase-done',
  FAKE_CLAUDE_LEDGER_APPEND: ops([
    { when: 'for phase verify.', file: planLedger(k), append: [Q] },
    { when: 'copied exactly', file: planLedger(k), firstLine: planFirst(k, 'done'), replace: [[Q, 'Asked: which db? — postgres']] },
  ]),
  ...extra,
});

const cli = (root, args, env = {}) => spawnSync(process.execPath, [RUNNER, ...args], { cwd: root, env: { ...ENV, ...env }, encoding: 'utf8' });
const events = (dir) => (existsSync(join(dir, 'events.log')) ? readFileSync(join(dir, 'events.log'), 'utf8') : '');
const byKey = (state, k) => state.items.find((i) => i.key === k);
const children = (dir) => readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort();
const starts = (dir) => [...events(dir).matchAll(/ (\S+) \S+ start /g)].map((m) => m[1]);
const deadPid = () => spawnSync(process.execPath, ['-e', '']).pid;

test('parseConfig: ## Runner chunk, ## Queue mode, ## Models rows over defaults', () => {
  assert.deepEqual(parseConfig(''), { chunkSize: 5, mode: 'auto', models: MODEL_DEFAULTS });
  assert.deepEqual(MODEL_DEFAULTS['Phase: close'], { model: 'sonnet', effort: 'medium' });
  const cfg = parseConfig([
    '## runner ', 'Mode: runner', 'Implement chunk: 3', '',
    '## Queue', '- Child permission mode: acceptEdits', '',
    '## Models', '| Role | Model | Effort |', '|---|---|---|',
    '| Phase: verify | `sonnet` | xhigh |', '| Phase: merge | haiku | |', '| Implementer | sonnet | medium |', '',
    '## Repo', 'Implement chunk: 9',
  ].join('\n'));
  assert.equal(cfg.chunkSize, 3);
  assert.equal(cfg.mode, 'acceptEdits');
  assert.deepEqual(cfg.models['Phase: verify'], { model: 'sonnet', effort: 'xhigh' });
  assert.deepEqual(cfg.models['Phase: merge'], { model: 'haiku', effort: 'high' }); // only a model: default effort
  assert.deepEqual(cfg.models['Spec stage'], { model: 'opus', effort: 'high' });
  assert.equal(parseConfig('## Runner\nImplement chunk: none\n').chunkSize, 5);
});

test('start queue: three items, the middle one waits, the third (no deps) still ships', () => {
  const root = repo();
  atVerify(root, 'A-1', 'A-2', 'A-3', 'A-4');
  const byKeyEnv = { 'A-1': ships('A-1'), 'A-2': { ...waitsThenShips('A-2'), FAKE_CLAUDE: 'ok:RUNNER: waiting 1 question' }, 'A-3': ships('A-3'), 'A-4': ships('A-4') };
  const r = cli(root, ['start', 'queue', 'P-1', 'A-1,A-2,A-3,A-4', '--deps', 'A-4:A-2'], { FAKE_CLAUDE_BY_KEY: JSON.stringify(byKeyEnv) });
  assert.equal(r.status, 0, r.stderr);
  const dir = runDir(root, 'queue', 'P-1');
  const s = readState(dir);
  assert.deepEqual(s.items.map((i) => [i.key, i.status]), [['A-1', 'done'], ['A-2', 'waiting'], ['A-3', 'done'], ['A-4', 'not started']]);
  assert.equal(byKey(s, 'A-4').reason, 'depends on A-2 (waiting)');
  assert.deepEqual(byKey(s, 'A-4').deps, ['A-2']);
  assert.equal(s.current, null);
  assert.ok(s.stopped);
  assert.equal(existsSync(join(dir, 'lock')), false);
  assert.deepEqual(starts(dir), ['A-1', 'A-2', 'A-3']);
  const summary = events(dir).split('\n').filter((l) => / summary /.test(l));
  assert.equal(summary.length, 1);
  assert.match(summary[0], / P-1 - summary 2 done, 1 waiting, 1 not started; cost \$1\.26$/);
  // a dep outside the queue is refused before anything runs
  const bad = cli(repo(), ['start', 'queue', 'P-2', 'A-1', '--deps', 'A-1:Z-9']);
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /Z-9/);
});

test('start queue: cut off stops the queue; remaining not started: session limit', () => {
  const root = repo();
  atVerify(root, 'A-1', 'A-2', 'A-3');
  const run = (a1) => cli(root, ['start', 'queue', 'P-1', 'A-1,A-2,A-3'], { FAKE_CLAUDE_BY_KEY: JSON.stringify({ 'A-1': a1, 'A-2': ships('A-2'), 'A-3': ships('A-3') }) });
  assert.equal(run({ FAKE_CLAUDE: 'error' }).status, 0);
  const dir = runDir(root, 'queue', 'P-1');
  let s = readState(dir);
  assert.equal(byKey(s, 'A-1').status, 'cut off');
  assert.match(byKey(s, 'A-1').reason, /usage limit reached/);
  for (const k of ['A-2', 'A-3']) assert.deepEqual([byKey(s, k).status, byKey(s, k).reason], ['not started', 'session limit']);
  assert.deepEqual(children(dir), ['A-1-verify-1.jsonl']);
  assert.match(events(dir), / A-1 verify cutoff /);
  assert.match(events(dir), / P-1 - summary 1 cut off, 2 not started; cost \$0\.01$/m);
  // rerunning the command resumes from the files: everything ships
  assert.equal(run(ships('A-1')).status, 0);
  s = readState(dir);
  assert.deepEqual(s.items.map((i) => i.status), ['done', 'done', 'done']);
  assert.deepEqual(children(dir), ['A-1-verify-1.jsonl', 'A-1-verify-2.jsonl', 'A-2-verify-1.jsonl', 'A-3-verify-1.jsonl']);
});

test('answer while running: stored, no second child started', () => {
  const root = repo();
  atVerify(root, 'A-1', 'A-2');
  const dir = runDir(root, 'queue', 'P-1');
  const item = (k, extra) => ({ key: k, phase: 'verify', status: 'queued', reason: '', deps: [], sessions: [], answersFile: null, ...extra });
  writeState(dir, {
    kind: 'queue', id: 'P-1', current: 'A-1', stopped: null,
    items: [item('A-1', { status: 'running' }), item('A-2', { status: 'waiting', reason: '1 question' })],
  });
  // the runner (this test process) and its child are alive
  writeFileSync(join(dir, 'lock'), JSON.stringify({ runner: process.pid, child: process.pid }));
  const file = join(root, 'answers.txt');
  writeFileSync(file, '1. postgres `$(whoami)`\n');

  const r = cli(root, ['answer', dir, 'A-2', file]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(readFileSync(join(dir, 'answers-A-2.md'), 'utf8'), '1. postgres `$(whoami)`\n');
  const s = readState(dir);
  assert.deepEqual([byKey(s, 'A-2').status, byKey(s, 'A-2').answersFile], ['queued', 'answers-A-2.md']);
  assert.equal(byKey(s, 'A-1').status, 'running');
  assert.match(events(dir), / A-2 verify progress answers received$/m);
  assert.deepEqual(children(dir), []);

  // a second runner on the same run dir is refused while the first holds the lock
  const again = cli(root, ['start', 'queue', 'P-1', 'A-1,A-2'], { FAKE_CLAUDE_BY_KEY: JSON.stringify({ 'A-1': ships('A-1'), 'A-2': ships('A-2') }) });
  assert.equal(again.status, 3);
  assert.equal(again.stdout.trim(), `held by ${process.pid}`);
  assert.deepEqual(children(dir), []);
  // unknown key: refused
  assert.equal(cli(root, ['answer', dir, 'Z-9', file]).status, 2);
});

test('answered mid-run: goes before untouched items, resumes its own session (Review Focus 3)', () => {
  const root = repo();
  atVerify(root, 'B-1', 'B-2', 'B-3');
  const dir = runDir(root, 'queue', 'P-1');
  const answersRel = join(dir.slice(root.length + 1), 'answers-B-1.md');
  const log = join(root, 'b1.json');
  const env = {
    'B-1': waitsThenShips('B-1', { FAKE_CLAUDE_LOG: log }),
    // while B-2's child runs, the user's answer for B-1 arrives
    'B-2': { ...ships('B-2'), FAKE_CLAUDE_LEDGER_APPEND: ops([{ file: planLedger('B-2'), firstLine: planFirst('B-2', 'done') }, { file: answersRel, append: ['postgres'] }]) },
    'B-3': ships('B-3'),
  };
  const r = cli(root, ['start', 'queue', 'P-1', 'B-1,B-2,B-3'], { FAKE_CLAUDE_BY_KEY: JSON.stringify(env) });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(starts(dir), ['B-1', 'B-2', 'B-1', 'B-3']);
  const seen = JSON.parse(readFileSync(log, 'utf8'));
  assert.deepEqual(seen.argv.slice(-2), ['--resume', 's-1']);
  assert.match(seen.stdin, /copied exactly:\npostgres\n$/);
  const s = readState(dir);
  assert.deepEqual(s.items.map((i) => i.status), ['done', 'done', 'done']);
  assert.equal(byKey(s, 'B-1').answersFile, null);
  assert.equal(existsSync(join(dir, 'answers-B-1.md')), false); // consumed, kept as answers-B-1-1.md
  assert.equal(readFileSync(join(dir, 'answers-B-1-1.md'), 'utf8'), 'postgres\n');
});

test('rerun after kill with dead child pid: resumes the same item and phase, no duplicate (Review Focus 1)', () => {
  const root = repo();
  atVerify(root, 'K-1');
  const dir = runDir(root, 'issue', 'K-1');
  const killed = {
    kind: 'issue', id: 'K-1', current: 'K-1', stopped: null,
    items: [{ key: 'K-1', phase: 'verify', status: 'running', reason: '', deps: [], sessions: [{ phase: 'plan', sessionId: 's-0', costUsd: 1, turns: 2, minutes: 3 }], answersFile: null }],
  };
  writeState(dir, killed);
  writeFileSync(join(dir, 'K-1-verify-1.jsonl'), '{"type":"system"}\n'); // the killed child's partial log

  // the runner died but its child is still alive: no second child
  writeFileSync(join(dir, 'lock'), JSON.stringify({ runner: deadPid(), child: process.pid }));
  const held = cli(root, ['start', 'issue', 'K-1'], ships('K-1'));
  assert.equal(held.status, 3);
  assert.equal(held.stdout.trim(), `held by ${process.pid}`);
  assert.deepEqual(children(dir), ['K-1-verify-1.jsonl']);

  // both dead: the rerun takes over and runs verify once
  writeFileSync(join(dir, 'lock'), JSON.stringify({ runner: deadPid(), child: deadPid() }));
  const r = cli(root, ['start', 'issue', 'K-1'], ships('K-1'));
  assert.equal(r.status, 0, r.stderr);
  const s = readState(dir);
  assert.equal(s.items.length, 1);
  assert.equal(s.items[0].status, 'done');
  assert.deepEqual(s.items[0].sessions.map((x) => x.phase), ['plan', 'verify']);
  assert.deepEqual(children(dir), ['K-1-verify-1.jsonl', 'K-1-verify-2.jsonl']);
  assert.deepEqual(starts(dir), ['K-1']);
  assert.match(events(dir), / K-1 verify start verify$/m);
});

test('start issue waiting: picks up answers file and resumes with --resume <sessionId>', async () => {
  const root = repo();
  atVerify(root, 'W-1');
  const dir = runDir(root, 'issue', 'W-1');
  const log = join(root, 'w.json');
  const child = spawn(process.execPath, [RUNNER, 'start', 'issue', 'W-1'], { cwd: root, env: { ...ENV, ...waitsThenShips('W-1', { FAKE_CLAUDE_LOG: log }) }, stdio: 'ignore' });
  const exited = new Promise((r) => child.on('close', r));
  const until = async (ok) => {
    for (let i = 0; i < 200 && !ok(); i++) await new Promise((r) => setTimeout(r, 25));
    assert.ok(ok());
  };
  await until(() => / W-1 verify waiting /.test(events(dir)));
  await new Promise((r) => setTimeout(r, 150)); // a few polls: it must not exit while waiting
  assert.equal(child.exitCode, null);
  let s = readState(dir);
  assert.deepEqual([s.items[0].status, s.stopped], ['waiting', null]);
  assert.ok(existsSync(join(dir, 'lock')));

  writeFileSync(join(root, 'a.txt'), 'postgres\n');
  assert.equal(cli(root, ['answer', dir, 'W-1', join(root, 'a.txt')]).status, 0);
  assert.equal(await exited, 0);
  const seen = JSON.parse(readFileSync(log, 'utf8'));
  assert.deepEqual(seen.argv.slice(-2), ['--resume', 's-1']);
  assert.match(seen.stdin, /copied exactly:\npostgres\n$/);
  s = readState(dir);
  assert.equal(s.items[0].status, 'done');
  assert.ok(s.stopped);
  assert.deepEqual(children(dir), ['W-1-verify-1.jsonl', 'W-1-verify-2.jsonl']);
});

test('answers for an item whose ledgers are not waiting: not passed to the child, status says not used', () => {
  const root = repo();
  atVerify(root, 'N-1');
  const dir = runDir(root, 'issue', 'N-1');
  writeState(dir, {
    kind: 'issue', id: 'N-1', current: null, stopped: 'x',
    items: [{ key: 'N-1', phase: 'verify', status: 'waiting', reason: '1 question', deps: [], sessions: [{ phase: 'verify', sessionId: 's-5', costUsd: 0, turns: 1, minutes: 0 }], answersFile: null }],
  });
  writeFileSync(join(root, 'a.txt'), 'late answer\n');
  assert.equal(cli(root, ['answer', dir, 'N-1', join(root, 'a.txt')]).status, 0);
  const log = join(root, 'n.json');
  assert.equal(cli(root, ['start', 'issue', 'N-1'], { ...ships('N-1'), FAKE_CLAUDE_LOG: log }).status, 0);
  const seen = JSON.parse(readFileSync(log, 'utf8'));
  assert.doesNotMatch(seen.stdin, /late answer|copied exactly/);
  assert.ok(!seen.argv.includes('--resume'));
  const s = readState(dir);
  assert.deepEqual([s.items[0].status, s.items[0].answersFile], ['done', null]);
  assert.match(cli(root, ['status', dir]).stdout, /N-1 +done +finished +answers not used/);
});

test('status prints the table and pending questions', () => {
  const root = repo();
  atVerify(root, 'S-1', 'S-2', 'S-3');
  put(root, planLedger('S-2'), [planFirst('S-2', '3'), Q, 'Asked: rename it? — yes', 'Asked: drop table? — pending']);
  const dir = runDir(root, 'queue', 'P-1');
  const sess = (c, m) => ({ phase: 'verify', sessionId: 's', costUsd: c, turns: 1, minutes: m });
  writeState(dir, {
    kind: 'queue', id: 'P-1', current: null, stopped: '2026-11-03T00:00:00Z',
    items: [
      { key: 'S-1', phase: 'finished', status: 'done', reason: '', deps: [], sessions: [sess(0.5, 2), sess(0.25, 3)], answersFile: null },
      { key: 'S-2', phase: 'verify', status: 'waiting', reason: '2 questions', deps: [], sessions: [sess(1, 4)], answersFile: null },
      { key: 'S-3', phase: null, status: 'not started', reason: 'depends on S-2 (waiting)', deps: ['S-2'], sessions: [], answersFile: null },
    ],
  });
  const r = cli(root, ['status', dir]);
  assert.equal(r.status, 0, r.stderr);
  const lines = r.stdout.split('\n');
  assert.match(lines[0], /^key +status +phase +reason +cost +minutes$/);
  assert.match(r.stdout, /^S-1 +done +finished +\$0\.75 +5$/m);
  assert.match(r.stdout, /^S-2 +waiting +verify +2 questions +\$1\.00 +4$/m);
  assert.match(r.stdout, /^S-3 +not started +- +depends on S-2 \(waiting\) +\$0\.00 +0$/m);
  assert.match(r.stdout, /Pending questions:\nS-2: Asked: which db\? — pending\nS-2: Asked: drop table\? — pending\n/);
});

test('start plan: ship-plan child at implement; start verify: verify-and-fix alone on the checked-out branch', () => {
  const root = repo();
  put(root, 'docs/plan.md', ['# Plan', '### Task 1: a', '### Task 2: b']);
  const pl = '.superpowers/ship-plan/feat-x/ledger.md';
  const log = join(root, 'p.json');
  const r = cli(root, ['start', 'plan', 'docs/plan.md'], {
    FAKE_CLAUDE: 'ok:RUNNER: done', FAKE_CLAUDE_LOG: log,
    FAKE_CLAUDE_LEDGER_APPEND: ops([{ file: pl, firstLine: 'Phase: done | Plan: docs/plan.md | Branch: feat/x' }]),
  });
  assert.equal(r.status, 0, r.stderr);
  const seen = JSON.parse(readFileSync(log, 'utf8'));
  assert.match(seen.stdin, /ai-skills:ship-plan skill with the Skill tool, with the arguments "docs\/plan\.md"\..*phase implement, plan tasks 1–2\.$/);
  assert.deepEqual(seen.argv.slice(4, 8), ['--model', 'sonnet', '--effort', 'high']);
  assert.equal(readState(runDir(root, 'plan', 'docs/plan.md')).items[0].status, 'done');

  const git = (...a) => execFileSync('git', a, { cwd: root, stdio: 'pipe' });
  git('init', '-q', '-b', 'feat/x');
  const vf = '.superpowers/verify-and-fix/feat-x/ledger.md';
  put(root, vf, ['Round 1: old', 'Done: abc — clean']); // an earlier run's end line does not end this one
  const v = cli(root, ['start', 'verify', 'feat/x'], {
    FAKE_CLAUDE: 'ok:RUNNER: done', FAKE_CLAUDE_LOG: log,
    FAKE_CLAUDE_LEDGER_APPEND: ops([{ file: vf, append: ['Round 2: green', 'Done: def — clean'] }]),
  });
  assert.equal(v.status, 0, v.stderr);
  const vs = JSON.parse(readFileSync(log, 'utf8'));
  assert.match(vs.stdin, /ai-skills:verify-and-fix skill .* phase verify\.$/);
  assert.deepEqual(vs.argv.slice(4, 8), ['--model', 'opus', '--effort', 'high']);
  const st = readState(runDir(root, 'verify', 'feat/x'));
  assert.deepEqual(st.items.map((i) => [i.status, i.sessions.length]), [['done', 1]]);
  // another branch checked out: refused
  const other = cli(root, ['start', 'verify', 'feat/y']);
  assert.equal(other.status, 2);
  assert.match(other.stderr, /feat\/x/);
});
