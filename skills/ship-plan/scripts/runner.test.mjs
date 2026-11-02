// Tests for the runner CLI. Run: node --test 'skills/ship-plan/scripts/*.test.mjs'
// Every child is fake-claude.mjs (CLAUDE_BIN); FAKE_CLAUDE_BY_KEY gives each key its own behavior.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
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

// git in a test repo: no hooks, no signing, whatever the user's global config says
const git = (root, ...a) => execFileSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...a], { cwd: root, stdio: 'pipe', encoding: 'utf8' });
// Commit every change, so the checkout is clean again.
const commit = (root) => { git(root, 'add', '-A'); git(root, 'commit', '-q', '--no-verify', '-m', 'x'); };
// A git checkout on main, clean; the tests' own logs and answer files (*.json, *.txt) are ignored.
function repo() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'runner-cli-')));
  git(root, 'init', '-q', '-b', 'main');
  writeFileSync(join(root, '.gitignore'), '*.json\n*.txt\n');
  commit(root);
  return root;
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

test('parseConfig: ## Runner chunk, ## Models rows over defaults; never a permission mode', () => {
  assert.deepEqual(parseConfig(''), { chunkSize: 5, models: MODEL_DEFAULTS });
  assert.deepEqual(MODEL_DEFAULTS['Phase: close'], { model: 'sonnet', effort: 'medium' });
  const cfg = parseConfig([
    '## runner ', 'Mode: runner', 'Implement chunk: 3', '',
    '## Queue', '- Child permission mode: acceptEdits', '',
    '## Models', '| Role | Model | Effort |', '|---|---|---|',
    '| Phase: verify | `sonnet` | xhigh |', '| Phase: merge | haiku | |', '| Implementer | sonnet | medium |', '',
    '## Repo', 'Implement chunk: 9',
  ].join('\n'));
  assert.equal(cfg.chunkSize, 3);
  assert.equal(cfg.mode, undefined);
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

  const before = readFileSync(join(dir, 'state.json'), 'utf8');
  const r = cli(root, ['answer', dir, 'A-2', file]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(readFileSync(join(dir, 'answers-A-2.md'), 'utf8'), '1. postgres `$(whoami)`\n');
  // the file is the record: state.json is the runner's alone, so no runner write can be lost
  assert.equal(readFileSync(join(dir, 'state.json'), 'utf8'), before);
  assert.match(events(dir), / A-2 verify progress answers received$/m);
  assert.deepEqual(children(dir), []);
  assert.match(cli(root, ['status', dir]).stdout, /^A-2 +waiting +verify +1 question; answers received /m);

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
  commit(root);
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

  git(root, 'switch', '-q', '-c', 'feat/x');
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
  // verify again later: a new run, from a fresh snapshot of the ledger (4 lines now)
  const again = cli(root, ['start', 'verify', 'feat/x'], {
    FAKE_CLAUDE: 'ok:RUNNER: done', FAKE_CLAUDE_LEDGER_APPEND: ops([{ file: vf, append: ['Round 3: green', 'Done: ghi — clean'] }]),
  });
  assert.equal(again.status, 0, again.stderr);
  const st2 = readState(runDir(root, 'verify', 'feat/x'));
  assert.deepEqual(st2.items.map((i) => [i.status, i.sessions.length, i.from]), [['done', 2, 4]]);
  // another branch checked out: refused
  const other = cli(root, ['start', 'verify', 'feat/y']);
  assert.equal(other.status, 2);
  assert.match(other.stderr, /feat\/x/);
});

test('killed during an answered child: the rerun resumes with the consumed answers, no crash', () => {
  const root = repo();
  atVerify(root, 'R-1');
  put(root, planLedger('R-1'), [planFirst('R-1', '3'), Q]); // the question is still pending
  const dir = runDir(root, 'issue', 'R-1');
  writeState(dir, {
    kind: 'issue', id: 'R-1', current: 'R-1', stopped: null,
    items: [{ key: 'R-1', phase: 'verify', status: 'running', reason: '', deps: [], answersFile: 'answers-R-1-1.md',
      sessions: [{ phase: 'verify', sessionId: 's-3', costUsd: 0.1, turns: 1, minutes: 0 }] }],
  });
  writeFileSync(join(dir, 'answers-R-1-1.md'), 'postgres\n'); // consumed; answers-R-1.md is gone
  writeFileSync(join(dir, 'lock'), JSON.stringify({ runner: deadPid(), child: deadPid() }));
  const log = join(root, 'r.json');
  const r = cli(root, ['start', 'issue', 'R-1'], waitsThenShips('R-1', { FAKE_CLAUDE_LOG: log }));
  assert.equal(r.status, 0, r.stderr);
  const seen = JSON.parse(readFileSync(log, 'utf8'));
  assert.deepEqual(seen.argv.slice(-2), ['--resume', 's-3']);
  assert.match(seen.stdin, /copied exactly:\npostgres\n$/);
  assert.deepEqual([readState(dir).items[0].status, readState(dir).items[0].answersFile], ['done', null]);

  // killed after the child answered the ledger: a rerun drops the consumed answers
  const root2 = repo();
  atVerify(root2, 'R-1');
  const dir2 = runDir(root2, 'issue', 'R-1');
  writeState(dir2, { ...readState(dir), root: root2, stopped: null, items: [{ ...readState(dir).items[0], status: 'running', answersFile: 'answers-R-1-1.md' }] });
  writeFileSync(join(dir2, 'answers-R-1-1.md'), 'postgres\n');
  const log2 = join(root2, 'r.json');
  assert.equal(cli(root2, ['start', 'issue', 'R-1'], { ...ships('R-1'), FAKE_CLAUDE_LOG: log2 }).status, 0);
  const seen2 = JSON.parse(readFileSync(log2, 'utf8'));
  assert.ok(!seen2.argv.includes('--resume'));
  assert.doesNotMatch(seen2.stdin, /copied exactly/);
});

test('rerun re-queues a blocked item', () => {
  const root = repo();
  atVerify(root, 'X-1', 'X-2');
  const run = (x1) => cli(root, ['start', 'queue', 'P-1', 'X-1,X-2'], { FAKE_CLAUDE_BY_KEY: JSON.stringify({ 'X-1': x1, 'X-2': ships('X-2') }) });
  assert.equal(run({ FAKE_CLAUDE: 'ok:RUNNER: blocked CI secret missing' }).status, 0);
  const dir = runDir(root, 'queue', 'P-1');
  assert.deepEqual(readState(dir).items.map((i) => i.status), ['blocked', 'done']);
  assert.equal(run(ships('X-1')).status, 0);
  assert.deepEqual(readState(dir).items.map((i) => i.status), ['done', 'done']);
  assert.deepEqual(children(dir), ['X-1-verify-1.jsonl', 'X-1-verify-2.jsonl', 'X-2-verify-1.jsonl']);
});

test('child permission mode: --permission-mode only; bypass needs SHIP_RUNNER_ALLOW_BYPASS=1, never passed on', () => {
  const root = repo();
  // the config's mode line is not read
  put(root, '.claude/ship-plan.md', ['## Queue', '- Child permission mode: bypassPermissions']);
  commit(root);
  const log = join(root, 'm.json');
  const runOnce = (k, flags, env = {}) => {
    atVerify(root, k);
    const r = cli(root, ['start', ...flags, 'issue', k], { ...ships(k), FAKE_CLAUDE_LOG: log, ...env });
    assert.equal(r.status, 0, r.stderr);
    const seen = JSON.parse(readFileSync(log, 'utf8'));
    return { mode: seen.argv[seen.argv.indexOf('--permission-mode') + 1], allowBypass: seen.allowBypass, events: events(runDir(root, 'issue', k)) };
  };
  const d = runOnce('M-1', []);
  assert.equal(d.mode, 'auto');
  assert.match(d.events, / M-1 - progress child permission mode: auto \(default\)$/m);
  const f = runOnce('M-2', ['--permission-mode', 'acceptEdits']);
  assert.equal(f.mode, 'acceptEdits');
  assert.match(f.events, /child permission mode: acceptEdits \(flag\)$/m);

  const bad = cli(root, ['start', '--permission-mode', 'yolo', 'issue', 'M-3']);
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /^runner: start: --permission-mode must be one of auto, acceptEdits, dontAsk, bypassPermissions\n$/);
  assert.equal(existsSync(runDir(root, 'issue', 'M-3')), false);

  const refused = runOnce('M-4', ['--permission-mode', 'bypassPermissions'], { SHIP_RUNNER_ALLOW_BYPASS: '' });
  assert.equal(refused.mode, 'auto');
  assert.match(refused.events, / M-4 - progress bypassPermissions refused: set SHIP_RUNNER_ALLOW_BYPASS=1$/m);
  assert.match(refused.events, /child permission mode: auto \(flag\)$/m);

  const allowed = runOnce('M-5', ['--permission-mode', 'bypassPermissions'], { SHIP_RUNNER_ALLOW_BYPASS: '1' });
  assert.equal(allowed.mode, 'bypassPermissions');
  assert.equal(allowed.allowBypass, null); // stripped from the child's env
  assert.doesNotMatch(allowed.events, /refused/);
});

test('start refuses a checkout that is dirty or not on the base branch; verify needs its branch', () => {
  const root = repo();
  atVerify(root, 'C-1'); // ledgers under .superpowers/ do not make it dirty
  put(root, 'src/wip.js', ['x']);
  let r = cli(root, ['start', 'issue', 'C-1'], ships('C-1'));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /^runner: start: the checkout must be clean and on main \(it is on main, with uncommitted changes\)\n$/);
  assert.equal(existsSync(runDir(root, 'issue', 'C-1')), false);
  commit(root);
  git(root, 'switch', '-q', '-c', 'feat/other');
  r = cli(root, ['start', 'queue', 'P-1', 'C-1'], { FAKE_CLAUDE_BY_KEY: JSON.stringify({ 'C-1': ships('C-1') }) });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /it is on feat\/other\)/);
  // the base branch is origin/HEAD's when there is one
  git(root, 'update-ref', 'refs/remotes/origin/feat/other', 'HEAD');
  git(root, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/feat/other');
  r = cli(root, ['start', 'issue', 'C-1'], ships('C-1'));
  assert.equal(r.status, 0, r.stderr);
  // not a git checkout at all: refused
  const bare = realpathSync(mkdtempSync(join(tmpdir(), 'runner-cli-')));
  r = cli(bare, ['start', 'issue', 'C-2']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /the checkout must be clean and on main/);
});

test('start queue: each item after the first starts on the base branch; a dirty checkout stops the queue', () => {
  const root = repo();
  atVerify(root, 'G-1', 'G-2', 'G-3');
  const logs = (k) => join(root, `${k}.json`);
  // G-1's child leaves the checkout on its own branch, clean
  const env = {
    'G-1': { ...ships('G-1'), FAKE_CLAUDE_GIT: ops([['switch', '-q', '-c', 'feat/g1']]) },
    'G-2': { ...ships('G-2'), FAKE_CLAUDE_LOG: logs('G-2') },
    'G-3': { ...ships('G-3'), FAKE_CLAUDE_LOG: logs('G-3') },
  };
  let r = cli(root, ['start', 'queue', 'P-1', 'G-1,G-2,G-3'], { FAKE_CLAUDE_BY_KEY: JSON.stringify(env) });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(readState(runDir(root, 'queue', 'P-1')).items.map((i) => i.status), ['done', 'done', 'done']);
  for (const k of ['G-2', 'G-3']) assert.equal(JSON.parse(readFileSync(logs(k), 'utf8')).head, 'ref: refs/heads/main');
  assert.equal(git(root, 'symbolic-ref', '--short', 'HEAD').trim(), 'main');

  // H-1's child leaves uncommitted work: nothing else starts
  const root2 = repo();
  atVerify(root2, 'H-1', 'H-2', 'H-3');
  const env2 = {
    'H-1': { ...ships('H-1'), FAKE_CLAUDE_LEDGER_APPEND: ops([{ file: planLedger('H-1'), firstLine: planFirst('H-1', 'done') }, { file: 'src/wip.js', append: ['x'] }]) },
    'H-2': ships('H-2'), 'H-3': ships('H-3'),
  };
  r = cli(root2, ['start', 'queue', 'P-1', 'H-1,H-2,H-3'], { FAKE_CLAUDE_BY_KEY: JSON.stringify(env2) });
  assert.equal(r.status, 0, r.stderr);
  const dir = runDir(root2, 'queue', 'P-1');
  assert.deepEqual(readState(dir).items.map((i) => [i.status, i.reason]), [['done', ''], ['not started', 'checkout busy'], ['not started', 'checkout busy']]);
  assert.deepEqual(starts(dir), ['H-1']);
  assert.match(events(dir), / H-2 - blocked checkout busy: src\/; queue stopped$/m);
});

test('start verify: a question before the closing Done: waits; the answer resumes the verify session', async () => {
  const root = repo();
  git(root, 'switch', '-q', '-c', 'feat/q');
  const vf = '.superpowers/verify-and-fix/feat-q/ledger.md';
  const VQ = 'Asked: drop the flag? A) yes (recommended) B) no — pending';
  const dir = runDir(root, 'verify', 'feat/q');
  const log = join(root, 'v.json');
  const env = {
    ...ENV, FAKE_CLAUDE: 'ok:RUNNER: waiting 1 question', FAKE_CLAUDE_LOG: log,
    FAKE_CLAUDE_LEDGER_APPEND: ops([
      { when: 'phase verify.', file: vf, append: [VQ, 'Done: abc — not clean: 1 question'] },
      { when: 'copied exactly', file: vf, replace: [[VQ, 'Asked: drop the flag? A) yes (recommended) B) no — A']], append: ['Done: def — clean'] },
    ]),
  };
  const child = spawn(process.execPath, [RUNNER, 'start', 'verify', 'feat/q'], { cwd: root, env, stdio: 'ignore' });
  const exited = new Promise((r) => child.on('close', r));
  for (let i = 0; i < 200 && !/ feat-q verify waiting 1 question$/m.test(events(dir)); i++) await new Promise((r) => setTimeout(r, 25));
  assert.match(events(dir), / feat-q verify waiting 1 question$/m);
  assert.match(cli(root, ['status', dir]).stdout, /Pending questions:\nfeat-q: Asked: drop the flag\? A\) yes \(recommended\) B\) no — pending\n/);
  writeFileSync(join(root, 'a.txt'), 'A\n');
  assert.equal(cli(root, ['answer', dir, 'feat-q', join(root, 'a.txt')]).status, 0);
  assert.equal(await exited, 0);
  const seen = JSON.parse(readFileSync(log, 'utf8'));
  assert.deepEqual(seen.argv.slice(-2), ['--resume', 's-1']);
  assert.deepEqual(readState(dir).items.map((i) => i.status), ['done']);
});

test('start queue: an item whose close-out says Base branch red stops the queue', () => {
  const root = repo();
  atVerify(root, 'R-1', 'R-2', 'R-3');
  const red = { FAKE_CLAUDE: 'ok:RUNNER: done', FAKE_CLAUDE_LEDGER_APPEND: ops([{ file: planLedger('R-1'), firstLine: planFirst('R-1', 'done'), append: ['Outcome: Base branch red'] }]) };
  const r = cli(root, ['start', 'queue', 'P-1', 'R-1,R-2,R-3'], { FAKE_CLAUDE_BY_KEY: JSON.stringify({ 'R-1': red, 'R-2': ships('R-2'), 'R-3': ships('R-3') }) });
  assert.equal(r.status, 0, r.stderr);
  const dir = runDir(root, 'queue', 'P-1');
  assert.deepEqual(readState(dir).items.map((i) => [i.status, i.reason]), [['done', ''], ['not started', 'base branch red'], ['not started', 'base branch red']]);
  assert.deepEqual(starts(dir), ['R-1']);
  assert.match(events(dir), / R-1 finished blocked base branch red; queue stopped$/m);
});
