// Tests for the runner CLI. Run: node --test 'skills/ship-plan/scripts/*.test.mjs'
// Every child is fake-claude.mjs (CLAUDE_BIN); FAKE_CLAUDE_BY_KEY gives each key its own behavior.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { alive } from './runner-lib.mjs';
import { closeSync, constants, existsSync, mkdirSync, mkdtempSync, openSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
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

// a runner that hangs fails its test (SIGTERM: it ends its children) instead of the whole suite
const cli = (root, args, env = {}) => spawnSync(process.execPath, [RUNNER, ...args], { cwd: root, env: { ...ENV, ...env }, encoding: 'utf8', timeout: 60000 });
// C1 (review round 1): `answer` stores answers in the checkout's git dir, never in the run dir a
// child is told about (SHIP_RUNNER); the runner reads them only there
const answersAt = (root, dir) => join(root, '.git', 'ship-runner', 'answers', basename(dir));
// the record of a run's first permission mode, beside the answers stores (X10: its own folder)
const recordAt = (root, dir) => join(root, '.git', 'ship-runner', 'modes', `${basename(dir)}.mode`);
const events = (dir) => (existsSync(join(dir, 'events.log')) ? readFileSync(join(dir, 'events.log'), 'utf8') : '');
const byKey = (state, k) => state.items.find((i) => i.key === k);
const children = (dir) => readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort();
const starts = (dir) => [...events(dir).matchAll(/ (\S+) \S+ start /g)].map((m) => m[1]);
const deadPid = () => spawnSync(process.execPath, ['-e', '']).pid;

test('parseConfig: ## Runner chunk, ## Models rows over defaults; never a permission mode', () => {
  // B4/B8/B12 (review round 1) added base, idleMinutes and warnings to the result
  assert.deepEqual(parseConfig(''), { chunkSize: 5, idleMinutes: 60, base: '', models: MODEL_DEFAULTS, logsLocal: false, warnings: [] });
  assert.equal(parseConfig('## logs\n- Location: `Local`\n').logsLocal, true);
  assert.equal(parseConfig('## Logs\nLocation: repo\n').logsLocal, false);
  assert.deepEqual(parseConfig('## Logs\nLocation: elsewhere\n').warnings, ['Location: "elsewhere" is not repo or local; using repo']);
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
  assert.equal(readFileSync(join(answersAt(root, dir), 'answers-A-2.md'), 'utf8'), '1. postgres `$(whoami)`\n');
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
  const answersRel = join('.git', 'ship-runner', 'answers', basename(dir), 'answers-B-1.md');
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
  assert.equal(existsSync(join(answersAt(root, dir), 'answers-B-1.md')), false); // consumed, kept as answers-B-1@1.md (C7)
  assert.equal(readFileSync(join(answersAt(root, dir), 'answers-B-1@1.md'), 'utf8'), 'postgres\n');
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
  // F3: what is left is the dead runner's child's process group, and how to end it
  assert.equal(held.stdout.trim(), `held by process group ${process.pid}: the child of a runner that is gone; end it with kill -- -${process.pid}`);
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
    items: [{ key: 'R-1', phase: 'verify', status: 'running', reason: '', deps: [], answersFile: 'answers-R-1@1.md',
      sessions: [{ phase: 'verify', sessionId: 's-3', costUsd: 0.1, turns: 1, minutes: 0 }] }],
  });
  mkdirSync(answersAt(root, dir), { recursive: true });
  writeFileSync(join(answersAt(root, dir), 'answers-R-1@1.md'), 'postgres\n'); // consumed; answers-R-1.md is gone
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
  writeState(dir2, { ...readState(dir), root: root2, stopped: null, items: [{ ...readState(dir).items[0], status: 'running', answersFile: 'answers-R-1@1.md' }] });
  mkdirSync(answersAt(root2, dir2), { recursive: true });
  writeFileSync(join(answersAt(root2, dir2), 'answers-R-1@1.md'), 'postgres\n');
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
    return { mode: seen.argv[seen.argv.indexOf('--permission-mode') + 1], allowBypass: seen.allowBypass, events: events(runDir(root, 'issue', k)), stderr: r.stderr };
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
  // B14 (review round 1): the label says why the flag's mode was not used; stderr says it too
  assert.match(refused.events, /child permission mode: auto \(bypass refused\)$/m);
  assert.match(refused.stderr, /^runner: bypassPermissions refused: set SHIP_RUNNER_ALLOW_BYPASS=1$/m);

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
  // F3: the first 5 paths (git status's, an untracked folder whole)
  assert.match(r.stderr, /^runner: start: the checkout must be clean and on main \(it is on main, with uncommitted changes: src\/\)\n$/);
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

test('start queue: answers for the running item arrive during its child, which is cut off -> the queue stops', () => {
  const root = repo();
  atVerify(root, 'A-1', 'A-2');
  const dir = runDir(root, 'queue', 'P-1');
  const answersRel = join('.git', 'ship-runner', 'answers', basename(dir), 'answers-A-1.md');
  const env = { 'A-1': { FAKE_CLAUDE: 'error', FAKE_CLAUDE_LEDGER_APPEND: ops([{ file: answersRel, append: ['postgres'] }]) }, 'A-2': ships('A-2') };
  const r = cli(root, ['start', 'queue', 'P-1', 'A-1,A-2'], { FAKE_CLAUDE_BY_KEY: JSON.stringify(env) });
  assert.equal(r.status, 0, r.stderr);
  const s = readState(dir);
  assert.deepEqual(s.items.map((i) => [i.key, i.status]), [['A-1', 'cut off'], ['A-2', 'not started']]);
  assert.equal(byKey(s, 'A-2').reason, 'session limit');
  assert.deepEqual(children(dir), ['A-1-verify-1.jsonl']);
  // T1 (review round 2): a cut-off item's answers are not looked at (B1): still in the store for
  // the rerun, never set aside
  assert.ok(existsSync(join(answersAt(root, dir), 'answers-A-1.md')));
  assert.doesNotMatch(events(dir), /answers rejected/);
});

test('start: the base branch is ## Repo Base branch: first, and the event names it', () => {
  const root = repo();
  put(root, '.claude/ship-plan.md', ['## Repo', 'Base branch: `develop`']);
  commit(root);
  atVerify(root, 'D-1');
  let r = cli(root, ['start', 'issue', 'D-1'], ships('D-1'));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /clean and on develop \(it is on main\)/);
  git(root, 'switch', '-q', '-c', 'develop');
  r = cli(root, ['start', 'issue', 'D-1'], ships('D-1'));
  assert.equal(r.status, 0, r.stderr);
  assert.match(events(runDir(root, 'issue', 'D-1')), / D-1 - progress base branch: develop \(config\)$/m);
  const r2 = repo();
  atVerify(r2, 'D-2');
  assert.equal(cli(r2, ['start', 'issue', 'D-2'], ships('D-2')).status, 0);
  assert.match(events(runDir(r2, 'issue', 'D-2')), / D-2 - progress base branch: main \(default, no origin\/HEAD\)$/m);
});

test('start verify <branch> -- <args>: the args reach verify-and-fix', () => {
  const root = repo();
  git(root, 'switch', '-q', '-c', 'feat/v');
  const vf = '.superpowers/verify-and-fix/feat-v/ledger.md';
  const log = join(root, 'v.json');
  const r = cli(root, ['start', 'verify', 'feat/v', '--', 'develop', '--comments'], {
    FAKE_CLAUDE: 'ok:RUNNER: done', FAKE_CLAUDE_LOG: log, FAKE_CLAUDE_LEDGER_APPEND: ops([{ file: vf, append: ['Done: abc — clean'] }]),
  });
  assert.equal(r.status, 0, r.stderr);
  assert.match(JSON.parse(readFileSync(log, 'utf8')).stdin, /verify-and-fix skill with the Skill tool, with the arguments "develop --comments"\./);
  const bad = cli(root, ['start', 'verify', 'feat/v', '--', 'a"b']);
  assert.equal(bad.status, 2);
  // D3 (review round 2): the message names the double quote, the one quote refused
  assert.match(bad.stderr, /start verify: an argument after -- holds a double quote or a control character/);
});

test('a runner error after the lock: blocked runner error event, summary, lock released', () => {
  const root = repo();
  atVerify(root, 'E-1');
  const dir = runDir(root, 'issue', 'E-1');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'state.json'), '{ not json');
  const r = cli(root, ['start', 'issue', 'E-1'], ships('E-1'));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /^runner: /m);
  assert.match(events(dir), /^\S+ - - blocked runner error: /m);
  assert.match(events(dir), / E-1 - summary /);
  assert.equal(existsSync(join(dir, 'lock')), false);
});

test('SIGTERM to the runner: its child is killed, the item cut off, summary written, lock released', async () => {
  const root = repo();
  atVerify(root, 'T-1');
  const dir = runDir(root, 'issue', 'T-1');
  const runner = spawn(process.execPath, [RUNNER, 'start', 'issue', 'T-1'], { cwd: root, env: { ...ENV, FAKE_CLAUDE: 'hang' }, stdio: 'ignore' });
  const exited = new Promise((r) => runner.on('close', (code, signal) => r({ code, signal })));
  let childPid = null;
  for (let i = 0; i < 200 && !childPid; i++) {
    await new Promise((r) => setTimeout(r, 25));
    try { childPid = JSON.parse(readFileSync(join(dir, 'lock'), 'utf8')).child; } catch { /* not yet */ }
  }
  assert.ok(childPid);
  runner.kill('SIGTERM');
  const { code } = await exited;
  assert.equal(code, 143);
  for (let i = 0; i < 40 && alive(childPid); i++) await new Promise((r) => setTimeout(r, 25));
  assert.equal(alive(childPid), false);
  assert.equal(existsSync(join(dir, 'lock')), false);
  const s = readState(dir);
  assert.ok(s.stopped);
  assert.deepEqual([s.items[0].status, s.items[0].reason], ['cut off', 'runner stopped (SIGTERM)']);
  assert.match(events(dir), / T-1 verify cutoff runner stopped \(SIGTERM\)$/m);
  assert.match(events(dir), / T-1 - summary 1 cut off; cost \$0\.00$/m);
});

test('parseConfig: ## Models roles match case-insensitively; bad rows, chunk and idle timeout are warned and ignored', () => {
  const cfg = parseConfig([
    '## Runner', 'Implement chunk: lots', 'Child idle timeout: 0.5', '',
    '## Models', '| Role | Model | Effort |', '|---|---|---|',
    '| phase: VERIFY | sonnet | xhigh |', '| Phase: deploy | opus | high |', '| Phase: merge | opus; rm -rf | high |',
    '| Phase: close | haiku | ultra |', '| Spec stage (small) | sonnet | high |', '| Plan stage | claude-opus-4-5[1m] | max |', '',
    '## Repo', 'Base branch: `develop`',
  ].join('\n'));
  assert.equal(cfg.chunkSize, 5);
  assert.equal(cfg.idleMinutes, 0.5);
  assert.equal(cfg.base, 'develop');
  assert.deepEqual(cfg.models['Phase: verify'], { model: 'sonnet', effort: 'xhigh' });
  assert.deepEqual(cfg.models['Phase: merge'], MODEL_DEFAULTS['Phase: merge']);
  assert.deepEqual(cfg.models['Phase: close'], MODEL_DEFAULTS['Phase: close']);
  assert.deepEqual(cfg.models['Plan stage'], { model: 'claude-opus-4-5[1m]', effort: 'max' });
  assert.equal(cfg.models['phase: VERIFY'], undefined);
  assert.deepEqual(cfg.warnings, [
    'Implement chunk: "lots" is not a positive whole number; using 5',
    '## Models row "Phase: deploy": no such runner phase; row ignored',
    '## Models row "Phase: merge": model "opus; rm -rf" is not a model name; row ignored',
    '## Models row "Phase: close": effort "ultra" is not low, medium, high, xhigh or max; row ignored',
  ]);
  assert.deepEqual(parseConfig('## Runner\nChild idle timeout: never\n').warnings, ['Child idle timeout: "never" is not a positive number of minutes; using 60']);
});

test('start: config warnings and the models in use are events', () => {
  const root = repo();
  put(root, '.claude/ship-plan.md', ['## Runner', 'Implement chunk: 0', '## Models', '| Phase: verify | sonnet | low |']);
  commit(root);
  atVerify(root, 'W-2');
  assert.equal(cli(root, ['start', 'issue', 'W-2'], ships('W-2')).status, 0);
  const ev = events(runDir(root, 'issue', 'W-2'));
  assert.match(ev, / W-2 - progress config: Implement chunk: "0" is not a positive whole number; using 5$/m);
  assert.match(ev, / W-2 - progress models: spec opus\/high, plan opus\/high, implement sonnet\/high, verify sonnet\/low, merge sonnet\/high, close sonnet\/medium$/m);
});

test('start: a child silent for Child idle timeout: is killed; the item is blocked', () => {
  const root = repo();
  put(root, '.claude/ship-plan.md', ['## Runner', 'Child idle timeout: 0.005']);
  commit(root);
  atVerify(root, 'I-1');
  const r = cli(root, ['start', 'issue', 'I-1'], { FAKE_CLAUDE: 'hang' });
  assert.equal(r.status, 0, r.stderr);
  const s = readState(runDir(root, 'issue', 'I-1'));
  assert.deepEqual([s.items[0].status, s.items[0].reason], ['blocked', 'child idle 0.005 min']);
});

test('start: a live run is "held by" (exit 3) even when its checkout is on the feature branch', () => {
  const root = repo();
  atVerify(root, 'L-1');
  const dir = runDir(root, 'issue', 'L-1');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'lock'), JSON.stringify({ runner: process.pid, child: null }));
  git(root, 'switch', '-q', '-c', 'feat/L-1');
  const r = cli(root, ['start', 'issue', 'L-1'], ships('L-1'));
  assert.equal(r.status, 3, r.stderr);
  assert.equal(r.stdout.trim(), `held by ${process.pid}`);
});

test('start queue: the base branch gone before the next item -> checkout busy with git\'s own words, no throw', () => {
  const root = repo();
  atVerify(root, 'G-1', 'G-2');
  const env = { 'G-1': { ...ships('G-1'), FAKE_CLAUDE_GIT: ops([['switch', '-q', '-c', 'feat/g1'], ['branch', '-q', '-D', 'main']]) }, 'G-2': ships('G-2') };
  const r = cli(root, ['start', 'queue', 'P-1', 'G-1,G-2'], { FAKE_CLAUDE_BY_KEY: JSON.stringify(env) });
  assert.equal(r.status, 0, r.stderr);
  const dir = runDir(root, 'queue', 'P-1');
  assert.deepEqual(readState(dir).items.map((i) => [i.status, i.reason]), [['done', ''], ['not started', 'checkout busy']]);
  assert.match(events(dir), / G-2 - blocked checkout busy: git switch main failed: .*main.*; queue stopped$/m);
});

test('start queue rerun with more keys and deps: they are merged into the run, and an event says so', () => {
  const root = repo();
  atVerify(root, 'M-1', 'M-2', 'M-3');
  const env = JSON.stringify({ 'M-1': ships('M-1'), 'M-2': ships('M-2'), 'M-3': ships('M-3') });
  assert.equal(cli(root, ['start', 'queue', 'P-1', 'M-1'], { FAKE_CLAUDE_BY_KEY: env }).status, 0);
  const r = cli(root, ['start', 'queue', 'P-1', 'M-1,M-2,M-3', '--deps', 'M-3:M-2'], { FAKE_CLAUDE_BY_KEY: env });
  assert.equal(r.status, 0, r.stderr);
  const dir = runDir(root, 'queue', 'P-1');
  const s = readState(dir);
  assert.deepEqual(s.items.map((i) => [i.key, i.status, i.deps]), [['M-1', 'done', []], ['M-2', 'done', []], ['M-3', 'done', ['M-2']]]);
  assert.match(events(dir), / P-1 - progress queue changed: added M-2, M-3; M-3 waits for M-2$/m);
  assert.deepEqual(starts(dir), ['M-1', 'M-2', 'M-3']);
});

test('start queue: a key twice or a key waiting for itself is refused', () => {
  const root = repo();
  let r = cli(root, ['start', 'queue', 'P-1', 'A-1,A-2,A-1']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /start queue: A-1 is in the list twice/);
  r = cli(root, ['start', 'queue', 'P-1', 'A-1,A-2', '--deps', 'A-1:A-1']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /start queue: --deps A-1:A-1: a key cannot wait for itself/);
});

test('consumed answers file gone while the questions still wait: an event says so', () => {
  const root = repo();
  atVerify(root, 'V-1');
  put(root, planLedger('V-1'), [planFirst('V-1', '3'), Q]);
  const dir = runDir(root, 'queue', 'P-9');
  writeState(dir, {
    kind: 'queue', id: 'P-9', current: 'V-1', stopped: null,
    items: [{ key: 'V-1', phase: 'verify', status: 'running', reason: '', deps: [], answersFile: 'answers-V-1@1.md',
      sessions: [{ phase: 'verify', sessionId: 's-3', costUsd: 0.1, turns: 1, minutes: 0 }] }],
  });
  assert.equal(cli(root, ['start', 'queue', 'P-9', 'V-1'], { FAKE_CLAUDE: 'crash' }).status, 0);
  assert.match(events(dir), / V-1 verify progress answers file answers-V-1@1\.md is gone; the questions wait again$/m);
  assert.deepEqual(children(dir), []);
  assert.equal(readState(dir).items[0].status, 'waiting');
});

test('start verify: a verify ledger that cannot be read is an error, not "no ledger"', () => {
  const root = repo();
  git(root, 'switch', '-q', '-c', 'feat/z');
  mkdirSync(join(root, '.superpowers/verify-and-fix/feat-z/ledger.md'), { recursive: true }); // a folder
  const r = cli(root, ['start', 'verify', 'feat/z'], { FAKE_CLAUDE: 'crash' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /EISDIR/);
  assert.equal(existsSync(runDir(root, 'verify', 'feat/z')), false); // refused before the run starts
});

// review round 1, batch C (runner security)

test('answer: stored in the checkout\'s git dir, not the run dir; the child is never told where; consumed as answers-<KEY>@<n>.md', () => {
  const root = repo();
  atVerify(root, 'W-1');
  const dir = runDir(root, 'queue', 'P-1');
  const log = join(root, 'w.json');
  const env = { 'W-1': waitsThenShips('W-1', { FAKE_CLAUDE_LOG: log }) };
  assert.equal(cli(root, ['start', 'queue', 'P-1', 'W-1'], { FAKE_CLAUDE_BY_KEY: JSON.stringify(env) }).status, 0);
  assert.equal(readState(dir).items[0].status, 'waiting');
  const seen = readFileSync(log, 'utf8');
  assert.equal(JSON.parse(seen).shipRunner, dir);
  assert.doesNotMatch(seen, /\.git[/\\]ship-runner/);
  writeFileSync(join(root, 'a.txt'), 'postgres\n');
  const r = cli(root, ['answer', dir, 'W-1', join(root, 'a.txt')]);
  assert.equal(r.status, 0, r.stderr);
  const stored = join(answersAt(root, dir), 'answers-W-1.md');
  assert.equal(r.stdout.trim(), `answers stored: ${stored}`);
  assert.equal(readFileSync(stored, 'utf8'), 'postgres\n');
  assert.ok(!readdirSync(dir).some((f) => f.startsWith('answers-')));
  assert.match(cli(root, ['status', dir]).stdout, /^W-1 +waiting +verify +1 question; answers received /m);
  assert.equal(cli(root, ['start', 'queue', 'P-1', 'W-1'], { FAKE_CLAUDE_BY_KEY: JSON.stringify(env) }).status, 0);
  assert.equal(readState(dir).items[0].status, 'done');
  assert.match(JSON.parse(readFileSync(log, 'utf8')).stdin, /copied exactly:\npostgres\n$/);
  assert.deepEqual(readdirSync(answersAt(root, dir)), ['answers-W-1@1.md']);
  // a runner child cannot answer through the CLI either
  const child = cli(root, ['answer', dir, 'W-1', join(root, 'a.txt')], { SHIP_RUNNER: dir });
  assert.equal(child.status, 2);
  assert.match(child.stderr, /runner child/);
});

test('answers a child wrote itself: in the run dir never read; in the store during its own child rejected, with an event', () => {
  const root = repo();
  atVerify(root, 'J-1');
  const dir = runDir(root, 'queue', 'P-1');
  const runRel = join(dir.slice(root.length + 1), 'answers-J-1.md');
  const storeRel = join('.git', 'ship-runner', 'answers', basename(dir), 'answers-J-1.md');
  const selfAnswer = (file) => ({ 'J-1': waitsThenShips('J-1', {
    FAKE_CLAUDE: 'ok:RUNNER: waiting 1 question',
    FAKE_CLAUDE_LEDGER_APPEND: ops([{ when: 'for phase verify.', file: planLedger('J-1'), append: [Q] }, { file, append: ['postgres'] }]),
  }) });
  assert.equal(cli(root, ['start', 'queue', 'P-1', 'J-1'], { FAKE_CLAUDE_BY_KEY: JSON.stringify(selfAnswer(runRel)) }).status, 0);
  assert.equal(readState(dir).items[0].status, 'waiting');
  assert.doesNotMatch(cli(root, ['status', dir]).stdout, /answers received/);
  // a rerun does not take it either: nothing runs
  assert.equal(cli(root, ['start', 'queue', 'P-1', 'J-1']).status, 0);
  assert.deepEqual(children(dir), ['J-1-verify-1.jsonl']);

  const root2 = repo();
  atVerify(root2, 'J-1');
  const dir2 = runDir(root2, 'queue', 'P-1');
  assert.equal(cli(root2, ['start', 'queue', 'P-1', 'J-1'], { FAKE_CLAUDE_BY_KEY: JSON.stringify(selfAnswer(storeRel)) }).status, 0);
  const s = readState(dir2);
  assert.deepEqual([s.items[0].status, s.items[0].answersFile], ['waiting', null]);
  assert.deepEqual(children(dir2), ['J-1-verify-1.jsonl']);
  assert.match(events(dir2), / J-1 verify progress answers rejected: answers-J-1\.md was written while a child of J-1 ran \(kept as answers-J-1@rejected-1\.md\); answer again$/m);
  assert.equal(existsSync(join(answersAt(root2, dir2), 'answers-J-1.md')), false);
  assert.doesNotMatch(cli(root2, ['status', dir2]).stdout, /answers received/);
});

test('start/answer: a key that is not a plain issue key, or a run id with .., is refused (exit 2)', () => {
  const root = repo();
  put(root, 'docs/x..y.md', ['# Plan']);
  commit(root);
  for (const args of [['issue', 'A 1'], ['issue', '../A-1'], ['queue', 'P-1', 'A-1,A/2'], ['queue', 'P-1', 'A-1,A-2', '--deps', 'A-1:A@2'], ['plan', 'docs/x..y.md']]) {
    const r = cli(root, ['start', ...args]);
    assert.equal(r.status, 2, `${args.join(' ')}: ${r.stderr}`);
  }
  assert.equal(existsSync(join(root, '.superpowers', 'ship-runner')), false);
  atVerify(root, 'W-1');
  const dir = runDir(root, 'queue', 'P-1');
  assert.equal(cli(root, ['start', 'queue', 'P-1', 'W-1'], { FAKE_CLAUDE_BY_KEY: JSON.stringify({ 'W-1': ships('W-1') }) }).status, 0);
  writeFileSync(join(root, 'a.txt'), 'x\n');
  const r = cli(root, ['answer', dir, '../W-1', join(root, 'a.txt')]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /not an issue key/);
});

test('start: .superpowers/ is added to the git info/exclude, once', () => {
  const root = repo();
  atVerify(root, 'X-1');
  const exclude = join(root, '.git', 'info', 'exclude');
  writeFileSync(exclude, '# git ls-files --others --exclude-from=.git/info/exclude\n*.log'); // no final newline
  assert.equal(cli(root, ['start', 'issue', 'X-1'], ships('X-1')).status, 0);
  assert.equal(readFileSync(exclude, 'utf8'), '# git ls-files --others --exclude-from=.git/info/exclude\n*.log\n.superpowers/\n');
  assert.equal(cli(root, ['start', 'issue', 'X-1'], ships('X-1')).status, 0);
  assert.equal(readFileSync(exclude, 'utf8').match(/\.superpowers/g).length, 1);
  assert.equal(git(root, 'status', '--porcelain', '--untracked-files=all'), '');
});

test('status: control characters in child-written text (ledger lines, reasons) are stripped', () => {
  const root = repo();
  atVerify(root, 'S-1');
  put(root, planLedger('S-1'), [planFirst('S-1', '3'), 'Asked: \x1b]0;pwned\x07which \x1b[2Jdb? — pending']);
  const dir = runDir(root, 'queue', 'P-1');
  writeState(dir, {
    kind: 'queue', id: 'P-1', current: null, stopped: 'x',
    items: [{ key: 'S-1', phase: 'verify', status: 'blocked', reason: 'bad\x1b[31m\rthing\x9b', deps: [], sessions: [], answersFile: null }],
  });
  const out = cli(root, ['status', dir]).stdout;
  assert.doesNotMatch(out, /[\x00-\x08\x0b-\x1f\x7f-\x9f]/);
  assert.match(out, /^S-1 +blocked +verify +bad\[31m thing /m);
  assert.match(out, /S-1: Asked: \]0;pwnedwhich \[2Jdb\? — pending/);
});

// USER RULING (review round 4): the guard warns, never stops. These tests replaced the "blocked,
// run stopped" ones; the tests of the exemptions (recorded base, branch tips) went with them.
const warned = (key, files, phase = 'verify') => ` ${key} ${phase} progress guarded files changed during the child (by the child or a branch switch): ${files}; the run goes on\n`;
const summaryLine = (dir) => events(dir).split('\n').filter((l) => / summary /.test(l)).at(-1);
test('a child that changes .claude/settings.local.json, .claude/settings.json or .mcp.json: a warning event, the run goes on, the summary names them', () => {
  for (const file of ['.claude/settings.local.json', '.claude/settings.json', '.mcp.json']) {
    const root = repo();
    atVerify(root, 'A-1', 'A-2');
    if (file === '.mcp.json') put(root, file, ['{}']); // changed, not only created
    const env = { 'A-1': { ...ships('A-1'), FAKE_CLAUDE_LEDGER_APPEND: ops([{ file: planLedger('A-1'), firstLine: planFirst('A-1', 'done') }, { file, append: ['{"hooks":{}}'] }]) }, 'A-2': ships('A-2') };
    const r = cli(root, ['start', 'queue', 'P-1', 'A-1,A-2'], { FAKE_CLAUDE_BY_KEY: JSON.stringify(env) });
    assert.equal(r.status, 0, r.stderr);
    const dir = runDir(root, 'queue', 'P-1');
    assert.deepEqual(readState(dir).items.map((i) => [i.status, i.reason]), [['done', ''], ['done', '']], events(dir));
    assert.deepEqual(starts(dir), ['A-1', 'A-2']);
    assert.ok(events(dir).includes(warned('A-1', file)), events(dir));
    assert.doesNotMatch(events(dir), / blocked /);
    assert.ok(summaryLine(dir).endsWith(` P-1 - summary 2 done; cost $0.84; guarded files changed: A-1 (${file})`), summaryLine(dir));
    // round 5: status names them too, in the item's reason
    const out = cli(root, ['status', dir]).stdout;
    assert.ok(out.split('\n').some((l) => /^A-1 +done +/.test(l) && l.includes(`guarded files changed: ${file}`)), out);
    assert.doesNotMatch(out, /^A-2 .*guarded/m);
  }
});

test('an environmental child failure (spawn error, API or auth error) stops the queue; an item\'s own failure does not', () => {
  const root = repo();
  atVerify(root, 'A-1', 'A-2', 'A-3');
  let r = cli(root, ['start', 'queue', 'P-1', 'A-1,A-2,A-3'], { FAKE_CLAUDE_BY_KEY: JSON.stringify({ 'A-1': { FAKE_CLAUDE: 'apierror' }, 'A-2': ships('A-2'), 'A-3': ships('A-3') }) });
  assert.equal(r.status, 0, r.stderr);
  let dir = runDir(root, 'queue', 'P-1');
  let s = readState(dir);
  assert.equal(byKey(s, 'A-1').status, 'blocked');
  assert.match(byKey(s, 'A-1').reason, /authentication_error/);
  for (const k of ['A-2', 'A-3']) {
    assert.equal(byKey(s, k).status, 'not started');
    assert.match(byKey(s, k).reason, /^runner stopped: is_error: API Error: 401 /);
  }
  assert.match(events(dir), / A-1 verify blocked is_error: API Error: 401 .*; run stopped$/m);
  assert.deepEqual(starts(dir), ['A-1']);

  const root2 = repo();
  atVerify(root2, 'B-1', 'B-2');
  r = cli(root2, ['start', 'queue', 'P-1', 'B-1,B-2'], { CLAUDE_BIN: join(root2, 'no-such-claude') });
  assert.equal(r.status, 0, r.stderr);
  dir = runDir(root2, 'queue', 'P-1');
  assert.deepEqual(readState(dir).items.map((i) => [i.status, i.reason]), [['blocked', 'spawn failed: ENOENT; no result line'], ['not started', 'runner stopped: spawn failed: ENOENT; no result line']]);

  // no RUNNER: line, or the child's own Blocked:: only that item
  const root3 = repo();
  atVerify(root3, 'C-1', 'C-2', 'C-3');
  const env3 = { 'C-1': { FAKE_CLAUDE: 'ok:' }, 'C-2': { FAKE_CLAUDE: 'ok:RUNNER: blocked CI secret missing' }, 'C-3': ships('C-3') };
  r = cli(root3, ['start', 'queue', 'P-1', 'C-1,C-2,C-3'], { FAKE_CLAUDE_BY_KEY: JSON.stringify(env3) });
  assert.equal(r.status, 0, r.stderr);
  dir = runDir(root3, 'queue', 'P-1');
  assert.deepEqual(readState(dir).items.map((i) => [i.status, i.reason]), [['blocked', 'no RUNNER: line'], ['blocked', 'CI secret missing'], ['done', '']]);
});

// C10 (review round 1, security follow-up): a child runs as the same user, so the file's own times
// are all the runner has: utimes can backdate mtime, never ctime
test('answers a child wrote and backdated (mtime before its window, ctime inside): rejected', () => {
  const root = repo();
  atVerify(root, 'U-1');
  const dir = runDir(root, 'queue', 'P-1');
  const storeRel = join('.git', 'ship-runner', 'answers', basename(dir), 'answers-U-1.md');
  const env = { 'U-1': {
    FAKE_CLAUDE: 'ok:RUNNER: waiting 1 question',
    FAKE_CLAUDE_LEDGER_APPEND: ops([{ file: planLedger('U-1'), append: [Q] }, { file: storeRel, append: ['postgres'] }]),
    FAKE_CLAUDE_UTIMES: ops([[storeRel, 1000000000]]),
  } };
  assert.equal(cli(root, ['start', 'queue', 'P-1', 'U-1'], { FAKE_CLAUDE_BY_KEY: JSON.stringify(env) }).status, 0);
  assert.deepEqual(readState(dir).items.map((i) => [i.status, i.answersFile]), [['waiting', null]]);
  assert.match(events(dir), / U-1 verify progress answers rejected: answers-U-1\.md was written while a child of U-1 ran/m);
  assert.deepEqual(children(dir), ['U-1-verify-1.jsonl']);
});

test('answers a background grandchild writes after its parent child exited: never accepted', async () => {
  const root = repo();
  atVerify(root, 'G-1');
  const dir = runDir(root, 'queue', 'P-1');
  const storeRel = join('.git', 'ship-runner', 'answers', basename(dir), 'answers-G-1.md');
  const env = { 'G-1': {
    FAKE_CLAUDE: 'ok:RUNNER: waiting 1 question',
    FAKE_CLAUDE_LEDGER_APPEND: ops([{ file: planLedger('G-1'), append: [Q] }]),
    FAKE_CLAUDE_LATE_WRITE: ops({ file: storeRel, ms: 1500, text: 'postgres\n' }),
  } };
  assert.equal(cli(root, ['start', 'queue', 'P-1', 'G-1'], { FAKE_CLAUDE_BY_KEY: JSON.stringify(env) }).status, 0);
  await new Promise((r) => setTimeout(r, 2000)); // past the grandchild's write, had it lived
  assert.equal(cli(root, ['start', 'queue', 'P-1', 'G-1']).status, 0);
  assert.deepEqual(readState(dir).items.map((i) => [i.status, i.answersFile]), [['waiting', null]]);
  assert.deepEqual(children(dir), ['G-1-verify-1.jsonl']);
});

// C11: everything the next child loads from the checkout, beyond settings and .mcp.json
test('a child that changes a hook, agent, command, skill, CLAUDE.md or a hook script the settings name: a warning event, done; its ledgers under .claude/ are not guarded', () => {
  const guarded = ['.claude/hooks/pre.sh', '.claude/agents/a.md', '.claude/commands/c.md', '.claude/skills/s/SKILL.md', 'CLAUDE.md', 'CLAUDE.local.md', '.claude/CLAUDE.md', '.claude/CLAUDE.local.md', 'tools/check.sh'];
  for (const file of guarded) {
    const root = repo();
    put(root, '.claude/settings.json', [JSON.stringify({ hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'bash "$CLAUDE_PROJECT_DIR"/tools/check.sh --fast' }] }] } })]);
    put(root, 'tools/check.sh', ['exit 0']);
    commit(root);
    atVerify(root, 'A-1');
    const r = cli(root, ['start', 'issue', 'A-1'], { ...ships('A-1'), FAKE_CLAUDE_LEDGER_APPEND: ops([{ file: planLedger('A-1'), firstLine: planFirst('A-1', 'done') }, { file, append: ['changed'] }]) });
    assert.equal(r.status, 0, r.stderr);
    const dir = runDir(root, 'issue', 'A-1');
    assert.deepEqual(readState(dir).items.map((i) => [i.status, i.reason]), [['done', '']], file);
    assert.ok(events(dir).includes(warned('A-1', file)), `${file}: ${events(dir)}`);
    assert.ok(summaryLine(dir).endsWith(`; guarded files changed: A-1 (${file})`), summaryLine(dir));
  }
  const root = repo();
  atVerify(root, 'A-1', 'A-2');
  const mine = ['.claude/ship-plan.md', '.claude/ship-plan/interruptions.md', '.claude/ship-issue/log.md'].map((file) => ({ file, append: ['x'] }));
  const env = { 'A-1': { ...ships('A-1'), FAKE_CLAUDE_LEDGER_APPEND: ops([{ file: planLedger('A-1'), firstLine: planFirst('A-1', 'done') }, ...mine]) }, 'A-2': ships('A-2') };
  assert.equal(cli(root, ['start', 'queue', 'P-1', 'A-1,A-2'], { FAKE_CLAUDE_BY_KEY: JSON.stringify(env) }).status, 0);
  // the new files leave the checkout busy for A-2; what matters here: no guard warning
  assert.doesNotMatch(events(runDir(root, 'queue', 'P-1')), /guarded/);
});

// USER RULING (review round 4): what the guard compares is the files before and after each child,
// whatever moved them: a branch switch counts too, and the warning says so. The runner's own switch
// back to the base branch between queue items is not during a child.
test('a child that switches to a branch with another CLAUDE.md and commits a settings change: warned for that child only, the queue goes on', () => {
  const root = repo();
  put(root, 'CLAUDE.md', ['v1']);
  git(root, 'add', 'CLAUDE.md');
  commit(root);
  git(root, 'switch', '-q', '-c', 'feat/A-1');
  put(root, 'CLAUDE.md', ['v2, from the run branch']);
  commit(root);
  git(root, 'switch', '-q', 'main');
  atVerify(root, 'A-1', 'A-2');
  const childGit = (...cmds) => ops(cmds.map((c) => ['-c', 'user.email=t@example.com', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...c]));
  const env = {
    'A-1': { ...ships('A-1'), FAKE_CLAUDE_GIT: childGit(['switch', '-q', 'feat/A-1']) },
    'A-2': { ...ships('A-2'), FAKE_CLAUDE_LEDGER_APPEND: ops([{ file: planLedger('A-2'), firstLine: planFirst('A-2', 'done') }, { file: '.claude/agents/x.md', append: ['widened'] }]),
      FAKE_CLAUDE_GIT: childGit(['switch', '-q', '-c', 'feat/A-2'], ['add', '.claude/agents/x.md'], ['commit', '-q', '--no-verify', '-m', 'x']) },
  };
  const r = cli(root, ['start', 'queue', 'P-1', 'A-1,A-2'], { FAKE_CLAUDE_BY_KEY: JSON.stringify(env) });
  assert.equal(r.status, 0, r.stderr);
  const dir = runDir(root, 'queue', 'P-1');
  assert.deepEqual(readState(dir).items.map((i) => [i.key, i.status]), [['A-1', 'done'], ['A-2', 'done']], events(dir));
  assert.ok(events(dir).includes(warned('A-1', 'CLAUDE.md')), events(dir));
  assert.ok(events(dir).includes(warned('A-2', '.claude/agents/x.md')), events(dir));
  assert.equal((events(dir).match(/guarded files changed during/g) ?? []).length, 2, 'no warning for the runner\'s own switch back to main');
  assert.ok(summaryLine(dir).endsWith('; guarded files changed: A-1 (CLAUDE.md), A-2 (.claude/agents/x.md)'), summaryLine(dir));
  // a rerun's summary names only what changed during its own children
  assert.equal(cli(root, ['start', 'queue', 'P-1', 'A-1,A-2']).status, 2, 'the checkout is on feat/A-2');
  git(root, 'switch', '-q', 'main');
  assert.equal(cli(root, ['start', 'queue', 'P-1', 'A-1,A-2']).status, 0);
  assert.match(summaryLine(dir), / P-1 - summary 2 done; cost \$\d+\.\d\d$/);
});

// review round 2, batch E1 (runner lifecycle and answers)

// The runner in the background, once its child has started (its transcript has the init line,
// written after the fake's own SIGTERM handler is set). { runner, exited, child }.
async function runnerWithChild(root, dir, args, env) {
  const runner = spawn(process.execPath, [RUNNER, ...args], { cwd: root, env: { ...ENV, ...env }, stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  runner.stderr.on('data', (d) => { stderr += d; });
  const exited = new Promise((r) => runner.on('close', (code, signal) => r({ code, signal, stderr })));
  let child = null;
  const ready = () => existsSync(dir) && readdirSync(dir).some((f) => f.endsWith('.jsonl') && /"init"/.test(readFileSync(join(dir, f), 'utf8')));
  for (let i = 0; i < 400 && !(child && ready()); i++) {
    await new Promise((r) => setTimeout(r, 25));
    try { child = JSON.parse(readFileSync(join(dir, 'lock'), 'utf8')).child; } catch { /* not yet */ }
  }
  assert.ok(child && ready(), 'the child never started');
  return { runner, exited, child };
}
const killQuietly = (pid) => { try { process.kill(pid, 'SIGKILL'); } catch { /* gone */ } };

// S1/T3/X3: a child that ignores SIGTERM must not outlive the runner's lock
test('SIGTERM to the runner, its child ignoring SIGTERM: the runner waits, SIGKILLs it, then releases the lock', async () => {
  const root = repo();
  atVerify(root, 'T-1');
  const dir = runDir(root, 'issue', 'T-1');
  const { runner, exited, child } = await runnerWithChild(root, dir, ['start', 'issue', 'T-1'], { FAKE_CLAUDE: 'hang', FAKE_CLAUDE_IGNORE_TERM: '1' });
  try {
    runner.kill('SIGTERM');
    const { code } = await exited;
    assert.equal(code, 143);
    // the child is dead (a group still alive would keep the lock, naming it: see runner-child.test)
    assert.equal(alive(child), false);
    assert.equal(existsSync(join(dir, 'lock')), false);
    const s = readState(dir);
    assert.ok(s.stopped);
    assert.deepEqual([s.items[0].status, s.items[0].reason], ['cut off', 'runner stopped (SIGTERM)']);
    // nothing after the stop: one child, one summary
    assert.deepEqual(children(dir), ['T-1-verify-1.jsonl']);
    assert.equal(events(dir).split('\n').filter((l) => / summary /.test(l)).length, 1);
  } finally {
    killQuietly(child);
  }
});

// T5: every signal the runner handles stops a queue the same way
test('SIGINT or SIGHUP during a 2-item queue: the running item cut off, the queued one not started, exit 128+n', async () => {
  for (const [sig, code] of [['SIGINT', 130], ['SIGHUP', 129]]) {
    const root = repo();
    atVerify(root, 'Q-1', 'Q-2');
    const dir = runDir(root, 'queue', 'P-1');
    const env = { FAKE_CLAUDE_BY_KEY: JSON.stringify({ 'Q-1': { FAKE_CLAUDE: 'hang' }, 'Q-2': ships('Q-2') }) };
    const { runner, exited, child } = await runnerWithChild(root, dir, ['start', 'queue', 'P-1', 'Q-1,Q-2'], env);
    try {
      runner.kill(sig);
      assert.equal((await exited).code, code, sig);
      const why = `runner stopped (${sig})`;
      assert.deepEqual(readState(dir).items.map((i) => [i.key, i.status, i.reason]), [['Q-1', 'cut off', why], ['Q-2', 'not started', why]], sig);
      assert.equal(alive(child), false, sig);
      assert.equal(existsSync(join(dir, 'lock')), false, sig);
      assert.deepEqual(starts(dir), ['Q-1'], sig);
      assert.match(events(dir), new RegExp(` P-1 - summary 1 cut off, 1 not started; cost \\$0\\.00$`, 'm'), sig);
    } finally {
      killQuietly(child);
    }
  }
});

// S4: an error thrown outside the awaited chain (here: a result line the runner cannot read) ends
// the run like any runner error, not with the lock and a "running" item left behind
test('an uncaught error while locked: item blocked runner error, the rest not started, summary, stopped set, lock released, exit 1', () => {
  const root = repo();
  atVerify(root, 'U-1', 'U-2');
  const r = cli(root, ['start', 'queue', 'P-1', 'U-1,U-2'], { FAKE_CLAUDE_BY_KEY: JSON.stringify({ 'U-1': { FAKE_CLAUDE: 'badresult' }, 'U-2': ships('U-2') }) });
  assert.equal(r.status, 1, r.stderr);
  assert.match(r.stderr, /^runner: .*primitive/m);
  const dir = runDir(root, 'queue', 'P-1');
  const s = readState(dir);
  assert.ok(s.stopped);
  assert.equal(byKey(s, 'U-1').status, 'blocked');
  assert.match(byKey(s, 'U-1').reason, /^runner error: .*primitive/);
  assert.equal(byKey(s, 'U-2').status, 'not started');
  assert.match(byKey(s, 'U-2').reason, /^runner error: /);
  assert.match(events(dir), /^\S+ - - blocked runner error: /m);
  assert.match(events(dir), / P-1 - summary 1 blocked, 1 not started; /);
  assert.equal(existsSync(join(dir, 'lock')), false);
  assert.deepEqual(starts(dir), ['U-1']);
});

// S2: a runner error before the item's child started (its plan ledger cannot be read)
test('a runner error before the item starts: that item blocked, the queued ones not started, each with the reason', () => {
  const root = repo();
  atVerify(root, 'A-1', 'A-2');
  // the issue ledger as a folder: reading it fails with EISDIR (a ship-plan ledger path that is a
  // folder is skipped by the lookup since the FOR-528 fix, so it no longer serves here)
  const il = join(root, issueLedger('A-1'));
  execFileSync('rm', [il]);
  mkdirSync(il);
  const r = cli(root, ['start', 'queue', 'P-1', 'A-1,A-2'], { FAKE_CLAUDE_BY_KEY: JSON.stringify({ 'A-1': ships('A-1'), 'A-2': ships('A-2') }) });
  assert.equal(r.status, 1, r.stderr);
  const dir = runDir(root, 'queue', 'P-1');
  const s = readState(dir);
  assert.deepEqual(s.items.map((i) => [i.key, i.status]), [['A-1', 'blocked'], ['A-2', 'not started']]);
  for (const i of s.items) assert.match(i.reason, /^runner error: .*EISDIR/);
  assert.deepEqual(children(dir), []);
});

// T4: a runner error after the item's child ran (a guarded file the child made unreadable)
test('a runner error after the item started: the running item blocked runner error, the queued one not started', () => {
  const root = repo();
  put(root, '.claude/settings.json', ['{}']); // ignored (*.json): the checkout stays clean
  atVerify(root, 'A-1', 'A-2');
  const env = { 'A-1': { ...ships('A-1'), FAKE_CLAUDE_CHMOD: ops([['.claude/settings.json', 0]]) }, 'A-2': ships('A-2') };
  const r = cli(root, ['start', 'queue', 'P-1', 'A-1,A-2'], { FAKE_CLAUDE_BY_KEY: JSON.stringify(env) });
  assert.equal(r.status, 1, r.stderr);
  const dir = runDir(root, 'queue', 'P-1');
  const s = readState(dir);
  assert.deepEqual([byKey(s, 'A-1').status, byKey(s, 'A-1').phase], ['blocked', 'verify']);
  assert.match(byKey(s, 'A-1').reason, /^runner error: .*EACCES/);
  assert.equal(byKey(s, 'A-2').status, 'not started');
  assert.match(byKey(s, 'A-2').reason, /^runner error: .*EACCES/);
  assert.deepEqual(starts(dir), ['A-1']);
  assert.equal(existsSync(join(dir, 'lock')), false);
});

// S4: state.json not written at the end -> it still says the run is going (stopped: null); a
// lock naming the dead runner tells the hook and the next start it is not
test('state.json cannot be written at the end: the lock is kept (naming the dead runner), exit 1', () => {
  const root = repo();
  atVerify(root, 'S-1');
  const dir = runDir(root, 'issue', 'S-1');
  // the runner writes state.json through state.json.<its pid>.tmp: a folder there makes it fail
  const r = cli(root, ['start', 'issue', 'S-1'], { ...ships('S-1'), FAKE_CLAUDE_MKDIR: ops([join(dir, 'state.json.$PPID.tmp')]) });
  assert.equal(r.status, 1, r.stderr);
  assert.match(r.stderr, /lock kept/);
  const lock = JSON.parse(readFileSync(join(dir, 'lock'), 'utf8'));
  assert.equal(lock.runner, r.pid);
  assert.equal(alive(lock.runner), false);
  assert.equal(readState(dir).stopped, null);
  assert.match(events(dir), / S-1 - summary /);
});

// S4: parseStart takes exactly the arguments of its run
test('start: an extra or unknown argument, or --deps with no value, is refused (exit 2)', () => {
  const root = repo();
  put(root, 'docs/p.md', ['# Plan']);
  commit(root);
  const cases = [
    ['issue', 'A-1', 'B-1'],
    ['queue', 'P-1', 'A-1,A-2', '--dep', 'A-2:A-1'],
    ['queue', 'P-1', 'A-1,A-2', '--deps'],
    ['queue', 'P-1', 'A-1,A-2', '--deps', ''],
    ['queue', 'P-1', 'A-1,A-2', '--deps', 'A-2:A-1', 'extra'],
    ['plan', 'docs/p.md', 'more'],
  ];
  for (const args of cases) {
    const r = cli(root, ['start', ...args]);
    assert.equal(r.status, 2, `${args.join(' ')}: ${r.stderr}`);
    assert.match(r.stderr, /^runner: start /, args.join(' '));
  }
  assert.equal(existsSync(join(root, '.superpowers', 'ship-runner')), false);
});

// T1: B1 pinned. An answers file for an item that ended blocked (here written by another item's
// child) does not put it back in line: only a waiting item is requeued by its answers
test('answers for a blocked item arriving during another item\'s child: the blocked item is not run again', () => {
  const root = repo();
  atVerify(root, 'A-1', 'A-2');
  const dir = runDir(root, 'queue', 'P-1');
  const answersRel = join('.git', 'ship-runner', 'answers', basename(dir), 'answers-A-1.md');
  const env = {
    'A-1': { FAKE_CLAUDE: 'ok:RUNNER: blocked CI secret missing' },
    'A-2': { ...ships('A-2'), FAKE_CLAUDE_LEDGER_APPEND: ops([{ file: planLedger('A-2'), firstLine: planFirst('A-2', 'done') }, { file: answersRel, append: ['postgres'] }]) },
  };
  const r = cli(root, ['start', 'queue', 'P-1', 'A-1,A-2'], { FAKE_CLAUDE_BY_KEY: JSON.stringify(env) });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(starts(dir), ['A-1', 'A-2']);
  assert.deepEqual(readState(dir).items.map((i) => [i.key, i.status]), [['A-1', 'blocked'], ['A-2', 'done']]);
  assert.ok(existsSync(join(answersAt(root, dir), 'answers-A-1.md')));
});

// T2: a window left open by a stopped runner ends when the next start begins (w[1] ??= startedAt);
// without that, a single issue would wait for ever, every answer inside the open window
test('a single-issue rerun after a runner stopped mid-child: the open window ends at the start, the answer resumes the child', async () => {
  const root = repo();
  atVerify(root, 'T-2');
  put(root, planLedger('T-2'), [planFirst('T-2', '3'), Q]);
  const dir = runDir(root, 'issue', 'T-2');
  writeState(dir, {
    kind: 'issue', id: 'T-2', current: null, stopped: new Date().toISOString(), root,
    items: [{ key: 'T-2', phase: 'verify', status: 'cut off', reason: 'runner stopped (SIGTERM)', deps: [], answersFile: null,
      sessions: [{ phase: 'verify', sessionId: 's-7', costUsd: 0.1, turns: 1, minutes: 0 }], windows: [[Date.now() - 60000, null]] }],
  });
  const log = join(root, 't2.json');
  const runner = spawn(process.execPath, [RUNNER, 'start', 'issue', 'T-2'], { cwd: root, env: { ...ENV, ...waitsThenShips('T-2', { FAKE_CLAUDE_LOG: log }) }, stdio: 'ignore' });
  const exited = new Promise((r) => runner.on('close', (code) => r(code)));
  try {
    const waiting = () => / T-2 verify waiting /.test(events(dir)) && (readState(dir)?.items[0].windows ?? []).every((w) => w[1] !== null);
    for (let i = 0; i < 200 && !waiting(); i++) await new Promise((r) => setTimeout(r, 25));
    assert.ok(waiting(), 'waiting, with every window closed');
    writeFileSync(join(root, 'a.txt'), 'postgres\n');
    const a = cli(root, ['answer', dir, 'T-2', join(root, 'a.txt')]);
    assert.equal(a.status, 0, a.stderr);
    assert.equal(await exited, 0);
  } finally {
    runner.kill('SIGKILL');
  }
  const seen = JSON.parse(readFileSync(log, 'utf8'));
  assert.deepEqual(seen.argv.slice(-2), ['--resume', 's-7']);
  assert.match(seen.stdin, /copied exactly:\npostgres\n$/);
  assert.equal(readState(dir).items[0].status, 'done');
  assert.doesNotMatch(events(dir), /answers rejected/);
});

// S3: an answer written while a child of the item runs (or a stopped run left its window open)
// would only be set aside later: refused up front
test('answer while the item\'s child window is open: refused (exit 2), nothing stored', () => {
  const root = repo();
  atVerify(root, 'A-1');
  const dir = runDir(root, 'queue', 'P-1');
  writeState(dir, {
    kind: 'queue', id: 'P-1', current: 'A-1', stopped: null, root,
    items: [{ key: 'A-1', phase: 'verify', status: 'running', reason: '', deps: [], sessions: [], answersFile: null, windows: [[Date.now() - 1000, null]] }],
  });
  writeFileSync(join(dir, 'lock'), JSON.stringify({ runner: process.pid, child: process.pid }));
  writeFileSync(join(root, 'a.txt'), 'postgres\n');
  const r = cli(root, ['answer', dir, 'A-1', join(root, 'a.txt')]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /^runner: answer: a child of A-1 is running/m);
  assert.equal(existsSync(join(answersAt(root, dir), 'answers-A-1.md')), false);
  assert.doesNotMatch(events(dir), /answers received/);
});

// X1: consumed answers are checked again before each reuse: a child that overwrote them during its
// window (then crashed, or was stopped) never hands the next child its own text
test('consumed answers overwritten during the item\'s window: not reused on the rerun, set aside with an event', () => {
  const root = repo();
  atVerify(root, 'R-1');
  put(root, planLedger('R-1'), [planFirst('R-1', '3'), Q]);
  const dir = runDir(root, 'queue', 'P-9');
  writeState(dir, {
    kind: 'queue', id: 'P-9', current: 'R-1', stopped: null, root,
    items: [{ key: 'R-1', phase: 'verify', status: 'running', reason: '', deps: [], answersFile: 'answers-R-1@1.md',
      sessions: [{ phase: 'verify', sessionId: 's-3', costUsd: 0.1, turns: 1, minutes: 0 }], windows: [[Date.now() - 60000, null]] }],
  });
  mkdirSync(answersAt(root, dir), { recursive: true });
  writeFileSync(join(answersAt(root, dir), 'answers-R-1@1.md'), 'forged\n'); // inside the open window
  writeFileSync(join(dir, 'lock'), JSON.stringify({ runner: deadPid(), child: deadPid() }));
  const r = cli(root, ['start', 'queue', 'P-9', 'R-1'], waitsThenShips('R-1'));
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(children(dir), []);
  assert.deepEqual(readState(dir).items.map((i) => [i.status, i.answersFile]), [['waiting', null]]);
  assert.match(events(dir), / R-1 verify progress answers rejected: answers-R-1@1\.md was written while a child of R-1 ran \(kept as answers-R-1@rejected-1\.md\); answer again$/m);
});

// X1, the other way: the user's answers consumed just before the child started (the rename sets
// ctime) are the same answers on a rerun after the runner was killed mid-child
test('answered, then the runner killed mid-child: the rerun resumes with the consumed answers', async () => {
  const root = repo();
  atVerify(root, 'K-1');
  put(root, planLedger('K-1'), [planFirst('K-1', '3'), Q]);
  const dir = runDir(root, 'queue', 'P-1');
  assert.equal(cli(root, ['start', 'queue', 'P-1', 'K-1']).status, 0); // no child: the ledger waits
  writeFileSync(join(root, 'a.txt'), 'postgres\n');
  assert.equal(cli(root, ['answer', dir, 'K-1', join(root, 'a.txt')]).status, 0);
  const { runner, exited, child } = await runnerWithChild(root, dir, ['start', 'queue', 'P-1', 'K-1'], { FAKE_CLAUDE: 'hang' });
  try {
    runner.kill('SIGKILL'); // no handler: the child is left, its window open
    await exited;
  } finally {
    killQuietly(child);
  }
  for (let i = 0; i < 80 && alive(child); i++) await new Promise((r) => setTimeout(r, 25));
  assert.equal(readState(dir).items[0].answersFile, 'answers-K-1@1.md');
  const log = join(root, 'k.json');
  const r = cli(root, ['start', 'queue', 'P-1', 'K-1'], waitsThenShips('K-1', { FAKE_CLAUDE_LOG: log }));
  assert.equal(r.status, 0, r.stderr);
  assert.match(JSON.parse(readFileSync(log, 'utf8')).stdin, /copied exactly:\npostgres\n$/);
  assert.equal(readState(dir).items[0].status, 'done');
  assert.doesNotMatch(events(dir), /answers rejected/);
});

// X2: an answers file that is a link (symbolic, or a second hard link to a file the runner writes
// after the window, like events.log) is not the user's
test('an answers file that is a symlink or a hard link: rejected on the rerun, never read', () => {
  for (const how of ['sym', 'hard']) {
    const root = repo();
    atVerify(root, 'L-1');
    const dir = runDir(root, 'queue', 'P-1');
    const env = { 'L-1': {
      FAKE_CLAUDE: 'crashafter',
      FAKE_CLAUDE_LEDGER_APPEND: ops([{ file: planLedger('L-1'), append: [Q] }]),
      FAKE_CLAUDE_LINK: ops([[join(dir, 'events.log'), join(answersAt(root, dir), 'answers-L-1.md'), how]]),
    } };
    assert.equal(cli(root, ['start', 'queue', 'P-1', 'L-1'], { FAKE_CLAUDE_BY_KEY: JSON.stringify(env) }).status, 0);
    assert.equal(readState(dir).items[0].status, 'blocked', how);
    const log = join(root, 'l.json');
    const r = cli(root, ['start', 'queue', 'P-1', 'L-1'], waitsThenShips('L-1', { FAKE_CLAUDE_LOG: log }));
    assert.equal(r.status, 0, r.stderr);
    assert.equal(existsSync(log), false, `${how}: a child ran with the linked file`);
    assert.deepEqual(readState(dir).items.map((i) => [i.status, i.answersFile]), [['waiting', null]], how);
    assert.match(events(dir), / L-1 verify progress answers rejected: answers-L-1\.md is a link, not a plain file \(kept as answers-L-1@rejected-1\.md\); answer again$/m, how);
    assert.doesNotMatch(cli(root, ['status', dir]).stdout, /answers received/, how);
  }
});

// T6: a linked worktree has its own git dir (the answers store) and shares the common one (the
// exclude)
test('a linked worktree: answers stored in its own git dir and used; .superpowers/ in the common exclude', () => {
  const main = repo();
  git(main, 'switch', '-q', '-c', 'other');
  const wt = join(realpathSync(mkdtempSync(join(tmpdir(), 'runner-wt-'))), 'wt');
  git(main, 'worktree', 'add', '-q', wt, 'main');
  atVerify(wt, 'W-1');
  const dir = runDir(wt, 'queue', 'P-1');
  const log = join(wt, 'w.json');
  const env = { FAKE_CLAUDE_BY_KEY: JSON.stringify({ 'W-1': waitsThenShips('W-1', { FAKE_CLAUDE_LOG: log }) }) };
  assert.equal(cli(wt, ['start', 'queue', 'P-1', 'W-1'], env).status, 0);
  assert.equal(readState(dir).items[0].status, 'waiting');
  writeFileSync(join(wt, 'a.txt'), 'postgres\n');
  const a = cli(wt, ['answer', dir, 'W-1', join(wt, 'a.txt')]);
  assert.equal(a.status, 0, a.stderr);
  assert.equal(a.stdout.trim(), `answers stored: ${join(main, '.git', 'worktrees', 'wt', 'ship-runner', 'answers', basename(dir), 'answers-W-1.md')}`);
  assert.equal(cli(wt, ['start', 'queue', 'P-1', 'W-1'], env).status, 0);
  assert.equal(readState(dir).items[0].status, 'done');
  assert.match(JSON.parse(readFileSync(log, 'utf8')).stdin, /copied exactly:\npostgres\n$/);
  assert.match(readFileSync(join(main, '.git', 'info', 'exclude'), 'utf8'), /^\.superpowers\/$/m);
  assert.equal(git(wt, 'status', '--porcelain', '--untracked-files=all'), '');
});

// ## Logs Location: local: a child in a linked worktree may write the main checkout's log store;
// under repo it gets no --add-dir
test('## Logs Location: a runner child in a linked worktree gets the log store as --add-dir only under local', () => {
  for (const loc of ['local', 'repo']) {
    const main = repo();
    put(main, '.claude/ship-plan.md', ['## Logs', `Location: ${loc}`]);
    commit(main);
    git(main, 'switch', '-q', '-c', 'other');
    const wt = join(realpathSync(mkdtempSync(join(tmpdir(), 'runner-wt-'))), 'wt');
    git(main, 'worktree', 'add', '-q', wt, 'main');
    atVerify(wt, 'L-1');
    const log = join(wt, 'l.json');
    assert.equal(cli(wt, ['start', 'issue', 'L-1'], { ...ships('L-1'), FAKE_CLAUDE_LOG: log }).status, 0);
    const argv = JSON.parse(readFileSync(log, 'utf8')).argv;
    const store = join(main, '.superpowers', 'ship-logs');
    if (loc === 'local') assert.deepEqual(argv.slice(argv.indexOf('--add-dir'), argv.indexOf('--add-dir') + 2), ['--add-dir', store], loc);
    else assert.ok(!argv.includes('--add-dir'), loc);
  }
});

// final review: the store is fixed at the runner's start; a child that repoints the worktree's
// gitfile to another clone never moves a later child's --add-dir there
test('## Logs Location: local: a rewritten worktree gitfile does not move the store a later child gets', () => {
  const main = repo();
  put(main, '.claude/ship-plan.md', ['## Logs', 'Location: local']);
  commit(main);
  git(main, 'switch', '-q', '-c', 'other');
  const wt = join(realpathSync(mkdtempSync(join(tmpdir(), 'runner-wt-'))), 'wt');
  git(main, 'worktree', 'add', '-q', wt, 'main');
  const evil = join(realpathSync(mkdtempSync(join(tmpdir(), 'runner-evil-'))), 'evil');
  git(main, 'clone', '-q', main, evil);
  git(evil, 'switch', '-q', '-c', 'other2');
  const ewt = join(dirname(evil), 'ewt');
  git(evil, 'worktree', 'add', '-q', ewt, 'main');
  writeFileSync(join(evil, '.git', 'info', 'exclude'), '.superpowers/\n');
  atVerify(wt, 'A-1', 'A-2');
  const [log1, log2] = [join(wt, 'a1.json'), join(wt, 'a2.json')];
  const env = { FAKE_CLAUDE_BY_KEY: JSON.stringify({
    'A-1': { ...ships('A-1'), FAKE_CLAUDE_LOG: log1, FAKE_CLAUDE_LEDGER_APPEND: ops([
      { file: planLedger('A-1'), firstLine: planFirst('A-1', 'done') },
      { file: '.git', firstLine: `gitdir: ${join(evil, '.git', 'worktrees', 'ewt')}` },
    ]) },
    'A-2': { ...ships('A-2'), FAKE_CLAUDE_LOG: log2 },
  }) };
  cli(wt, ['start', 'queue', 'P-1', 'A-1,A-2'], env);
  const store = join(main, '.superpowers', 'ship-logs');
  const argv1 = JSON.parse(readFileSync(log1, 'utf8')).argv;
  assert.deepEqual(argv1.slice(argv1.indexOf('--add-dir'), argv1.indexOf('--add-dir') + 2), ['--add-dir', store]);
  assert.ok(existsSync(log2), 'the second child ran');
  const argv2 = JSON.parse(readFileSync(log2, 'utf8')).argv;
  if (argv2.includes('--add-dir')) assert.equal(argv2[argv2.indexOf('--add-dir') + 1], store);
  assert.equal(existsSync(join(evil, '.superpowers', 'ship-logs')), false);
});

// K1: a verify run started again after it ended blocked (or cut off, or not started) reads its
// ledger from a fresh snapshot, like a done one: the earlier closing Done: does not end it
test('start verify again after a blocked verify: a fresh ledger snapshot, a new child', () => {
  const root = repo();
  git(root, 'switch', '-q', '-c', 'feat/k');
  const vf = '.superpowers/verify-and-fix/feat-k/ledger.md';
  const dir = runDir(root, 'verify', 'feat/k');
  let r = cli(root, ['start', 'verify', 'feat/k'], {
    FAKE_CLAUDE: 'ok:RUNNER: blocked CI secret missing', FAKE_CLAUDE_LEDGER_APPEND: ops([{ file: vf, append: ['Blocked: CI secret missing', 'Done: abc — blocked'] }]),
  });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(readState(dir).items.map((i) => [i.status, i.reason]), [['blocked', 'CI secret missing']]);
  r = cli(root, ['start', 'verify', 'feat/k'], { FAKE_CLAUDE: 'ok:RUNNER: done', FAKE_CLAUDE_LEDGER_APPEND: ops([{ file: vf, append: ['Done: def — clean'] }]) });
  assert.equal(r.status, 0, r.stderr);
  const s = readState(dir);
  assert.deepEqual(s.items.map((i) => [i.status, i.sessions.length, i.from]), [['done', 2, 2]]);
  assert.deepEqual(children(dir), ['feat-k-verify-1.jsonl', 'feat-k-verify-2.jsonl']);
});

// R2-1/X4 (review round 2): git code a child planted (core.fsmonitor, core.hooksPath, a hook) never
// runs from the runner's own git calls (status at start and between items, switch between items)
test('a planted fsmonitor or hook in the git config: never run by the runner\'s git', () => {
  const root = repo();
  atVerify(root, 'A-1', 'A-2');
  const marker = join(root, 'ran.txt');
  const script = (name) => {
    writeFileSync(join(root, name), `#!/bin/sh\necho "${name}:[$SHIP_RUNNER_ALLOW_BYPASS]" >> "${marker}"\nexit 1\n`, { mode: 0o755 });
    return join(root, name);
  };
  writeFileSync(join(root, '.gitignore'), '*.json\n*.txt\nhk/\n*.sh\n');
  commit(root);
  // planted last: the test's own git below this line would run them
  mkdirSync(join(root, 'hk'));
  script('hk/post-checkout');
  script('hk/reference-transaction');
  execFileSync('git', ['config', 'core.fsmonitor', script('fsmonitor.sh')], { cwd: root });
  execFileSync('git', ['config', 'core.hooksPath', join(root, 'hk')], { cwd: root });
  // each child leaves the checkout on its own branch: the runner switches back before A-2
  const leaves = (k) => ({ ...ships(k), FAKE_CLAUDE_GIT: ops([['-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', 'switch', '-q', '-c', `feat/${k}`]]) });
  const r = cli(root, ['start', 'queue', 'P-1', 'A-1,A-2', '--permission-mode', 'bypassPermissions'],
    { SHIP_RUNNER_ALLOW_BYPASS: '1', FAKE_CLAUDE_BY_KEY: JSON.stringify({ 'A-1': leaves('A-1'), 'A-2': leaves('A-2') }) });
  assert.equal(r.status, 0, r.stderr);
  const s = readState(runDir(root, 'queue', 'P-1'));
  assert.deepEqual(s.items.map((i) => i.status), ['done', 'done'], events(runDir(root, 'queue', 'P-1')));
  assert.equal(existsSync(marker) ? readFileSync(marker, 'utf8') : '', '');
});

// review round 2, batch E2

// X5: a child can edit the config's `Child permission mode:`, and state.json; the first start's mode
// is recorded in <git dir>/ship-runner/modes/ (state.json only copies it), and a rerun never widens it
test('a rerun never widens the first start\'s permission mode: wider exit 2, none given uses it, narrower allowed', () => {
  const root = repo();
  const log = join(root, 'm.json');
  const dir = runDir(root, 'queue', 'P-1');
  // each start adds a key, so each runs one new child
  const start = (flags, keys, env = {}) => {
    atVerify(root, ...keys);
    const byKey = Object.fromEntries(keys.map((k) => [k, ships(k)]));
    return cli(root, ['start', ...flags, 'queue', 'P-1', keys.join(',')], { FAKE_CLAUDE_BY_KEY: JSON.stringify(byKey), FAKE_CLAUDE_LOG: log, ...env });
  };
  const childMode = () => {
    const seen = JSON.parse(readFileSync(log, 'utf8'));
    rmSync(log);
    return seen.argv[seen.argv.indexOf('--permission-mode') + 1];
  };
  assert.equal(start(['--permission-mode', 'acceptEdits'], ['M-1']).status, 0);
  assert.equal(childMode(), 'acceptEdits');
  assert.equal(readState(dir).mode, 'acceptEdits');
  for (const wider of ['auto', 'bypassPermissions']) {
    const r = start(['--permission-mode', wider], ['M-1', 'M-2'], { SHIP_RUNNER_ALLOW_BYPASS: '1' });
    assert.equal(r.status, 2, wider);
    assert.match(r.stderr, new RegExp(`--permission-mode ${wider} is wider than this run's acceptEdits`));
    assert.ok(r.stderr.includes(recordAt(root, dir)), `F2: the message names the record: ${r.stderr}`);
    assert.equal(existsSync(log), false);
  }
  assert.equal(start([], ['M-1', 'M-2']).status, 0);
  assert.equal(childMode(), 'acceptEdits');
  assert.match(events(dir), /child permission mode: acceptEdits \(first start\)$/m);
  assert.equal(start(['--permission-mode', 'dontAsk'], ['M-1', 'M-2', 'M-3']).status, 0);
  assert.equal(childMode(), 'dontAsk');
  assert.equal(readState(dir).mode, 'acceptEdits');
  // a child that widens state.json's mode: the copy in the git dir still holds
  writeState(dir, { ...readState(dir), mode: 'bypassPermissions' });
  const r = start(['--permission-mode', 'auto'], ['M-1', 'M-2', 'M-3', 'M-4']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /wider than this run's acceptEdits/);
});

// round 5: start() reads the mode record before it takes the lock, and the locked run reads it
// again. A record made in between (a first start of the same run that has ended) holds: the
// children never run wider than it.
test('a mode record made between the start\'s check and its lock: the children run no wider than it', async () => {
  const root = repo();
  atVerify(root, 'M-1');
  const log = join(root, 'm.json');
  const dir = runDir(root, 'issue', 'M-1');
  // the config is a FIFO: the runner stops reading it, after its check of the record, before its lock
  const fifo = join(root, '.claude', 'ship-plan.md');
  writeFileSync(join(root, '.git', 'info', 'exclude'), '.claude/\n');
  mkdirSync(dirname(fifo));
  execFileSync('mkfifo', [fifo]);
  const runner = spawn(process.execPath, [RUNNER, 'start', 'issue', 'M-1'], { cwd: root, env: { ...ENV, ...ships('M-1'), FAKE_CLAUDE_LOG: log }, stdio: 'ignore' });
  const exited = new Promise((r) => runner.on('exit', (c) => r(c)));
  const early = exited.then((c) => {
    closeSync(openSync(fifo, constants.O_RDONLY | constants.O_NONBLOCK)); // frees the open below
    throw new Error(`the runner exited (${c}) before it read the config`);
  });
  const w = await Promise.race([open(fifo, 'w'), early]); // once the runner reads it
  early.catch(() => {});
  writeState(dir, { kind: 'issue', id: 'M-1', items: [{ key: 'M-1', phase: null, status: 'queued', reason: '', deps: [], sessions: [], answersFile: null }], current: null, stopped: null });
  mkdirSync(dirname(recordAt(root, dir)), { recursive: true });
  writeFileSync(recordAt(root, dir), 'dontAsk\n');
  await w.close();
  assert.equal(await exited, 0);
  const seen = JSON.parse(readFileSync(log, 'utf8'));
  assert.equal(seen.argv[seen.argv.indexOf('--permission-mode') + 1], 'dontAsk');
  assert.equal(readState(dir).mode, 'dontAsk');
  assert.match(events(dir), /child permission mode: dontAsk \(first start\)$/m);
});

// X6: a run id goes into shell commands the watching session writes
test('start: a queue parent or verify branch outside [A-Za-z0-9._/#-], or a plan path with a quote or a control character, is refused (exit 2)', () => {
  const root = repo();
  put(root, "docs/it's.md", ['# Plan']);
  commit(root);
  for (const args of [['queue', 'P;1', 'A-1'], ['queue', 'P 1', 'A-1'], ['queue', '$(x)', 'A-1'], ['plan', "docs/it's.md"]]) {
    const r = cli(root, ['start', ...args]);
    assert.equal(r.status, 2, `${args.join(' ')}: ${r.stderr}`);
  }
  git(root, 'switch', '-q', '-c', "feat/it's");
  const v = cli(root, ['start', 'verify', "feat/it's"]);
  assert.equal(v.status, 2, v.stderr);
  assert.match(v.stderr, /letters, digits/);
  assert.equal(existsSync(join(root, '.superpowers', 'ship-runner')), false);
});

// X8: a plan or branch named with a leading `_` gave an item key `answer` refused
test('start plan docs/_draft.md: its item key is one `answer` takes', async () => {
  const root = repo();
  put(root, 'docs/_draft.md', ['# Plan', '### Task 1: a']);
  commit(root);
  const pl = '.superpowers/ship-plan/feat-d/ledger.md';
  // ship-plan's real ledger: Branch: on a body line of its own (G-a, review round 4)
  const first = 'Phase: 2 | Plan: docs/_draft.md | Issue: none | PR: #';
  const env = {
    FAKE_CLAUDE: 'ok:RUNNER: waiting',
    FAKE_CLAUDE_LEDGER_APPEND: ops([
      { when: 'phase implement', file: pl, firstLine: first, append: ['Branch: feat/d', Q] },
      { when: 'copied exactly', file: pl, firstLine: first.replace('Phase: 2', 'Phase: done'), replace: [[Q, 'Asked: which db? — postgres']] },
    ]),
  };
  const runner = spawn(process.execPath, [RUNNER, 'start', 'plan', 'docs/_draft.md'], { cwd: root, env: { ...ENV, ...env }, stdio: 'ignore' });
  const exited = new Promise((r) => runner.on('close', r));
  try {
    const dir = runDir(root, 'plan', 'docs/_draft.md');
    for (let i = 0; i < 400 && !/ waiting /.test(events(dir)); i++) await new Promise((r) => setTimeout(r, 25));
    const key = readState(dir).items[0].key;
    writeFileSync(join(root, 'a.txt'), '1A\n');
    const a = cli(root, ['answer', dir, key, join(root, 'a.txt')]);
    assert.equal(a.status, 0, `${key}: ${a.stderr}`);
    assert.equal(await exited, 0);
    assert.equal(readState(dir).items[0].status, 'done');
  } finally {
    killQuietly(runner.pid);
  }
});

// X8: two ids can share a run dir (a/b and a-b): the second is refused, never run on the first's state
test('start: a run dir that holds another run (a/b vs a-b) is refused (exit 2)', () => {
  const root = repo();
  git(root, 'switch', '-q', '-c', 'a/b');
  const done = { FAKE_CLAUDE: 'ok:RUNNER: done', FAKE_CLAUDE_LEDGER_APPEND: ops([{ file: '.superpowers/verify-and-fix/a-b/ledger.md', append: ['Done: x — clean'] }]) };
  assert.equal(cli(root, ['start', 'verify', 'a/b'], done).status, 0);
  git(root, 'switch', '-q', '-c', 'a-b');
  const r = cli(root, ['start', 'verify', 'a-b'], done);
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stderr, /holds the run verify a\/b/);
  assert.equal(readState(runDir(root, 'verify', 'a-b')).id, 'a/b');
});

// X8: the checkout comes from the run dir's place, never from state.json's root (a child can edit it)
test('answer: the answers store is found from the run dir, not from state.json\'s root', () => {
  const root = repo();
  const elsewhere = repo();
  atVerify(root, 'W-1');
  const r = cli(root, ['start', 'queue', 'P-1', 'W-1'], { FAKE_CLAUDE_BY_KEY: JSON.stringify({ 'W-1': { ...waitsThenShips('W-1'), FAKE_CLAUDE: 'ok:RUNNER: waiting' } }) });
  assert.equal(r.status, 0, r.stderr);
  const dir = runDir(root, 'queue', 'P-1');
  writeState(dir, { ...readState(dir), root: elsewhere });
  writeFileSync(join(root, 'a.txt'), '1A\n');
  const a = cli(root, ['answer', dir, 'W-1', join(root, 'a.txt')]);
  assert.equal(a.status, 0, a.stderr);
  assert.equal(readFileSync(join(answersAt(root, dir), 'answers-W-1.md'), 'utf8'), '1A\n');
  assert.equal(existsSync(join(elsewhere, '.git', 'ship-runner')), false);
});

// X8: the run dir and the answers store are the user's alone
test('the run dir and the answers store are created 0700', () => {
  const root = repo();
  atVerify(root, 'W-1');
  assert.equal(cli(root, ['start', 'queue', 'P-1', 'W-1'], { FAKE_CLAUDE_BY_KEY: JSON.stringify({ 'W-1': { ...waitsThenShips('W-1'), FAKE_CLAUDE: 'ok:RUNNER: waiting' } }) }).status, 0);
  const dir = runDir(root, 'queue', 'P-1');
  writeFileSync(join(root, 'a.txt'), '1A\n');
  assert.equal(cli(root, ['answer', dir, 'W-1', join(root, 'a.txt')]).status, 0);
  assert.equal(statSync(dir).mode & 0o777, 0o700);
  assert.equal(statSync(answersAt(root, dir)).mode & 0o777, 0o700);
});

// X5, second review: the record in the git dir is checked whether or not state.json is there; an
// existing run with no readable record is taken as the narrowest mode (fail closed)
test('the first-mode record: checked without state.json; missing or unreadable for an existing run -> dontAsk only, exit 2 with how to start anew', () => {
  const root = repo();
  const log = join(root, 'm.json');
  const dir = runDir(root, 'queue', 'P-1');
  const record = recordAt(root, dir);
  const start = (flags, keys) => {
    atVerify(root, ...keys);
    const byKey = Object.fromEntries(keys.map((k) => [k, ships(k)]));
    return cli(root, ['start', ...flags, 'queue', 'P-1', keys.join(',')], { FAKE_CLAUDE_BY_KEY: JSON.stringify(byKey), FAKE_CLAUDE_LOG: log });
  };
  const childMode = () => {
    const seen = JSON.parse(readFileSync(log, 'utf8'));
    rmSync(log);
    return seen.argv[seen.argv.indexOf('--permission-mode') + 1];
  };
  assert.equal(start(['--permission-mode', 'acceptEdits'], ['M-1']).status, 0);
  assert.equal(readFileSync(record, 'utf8'), 'acceptEdits\n');
  rmSync(join(dir, 'state.json'));
  const a = start(['--permission-mode', 'auto'], ['M-1']);
  assert.equal(a.status, 2, a.stderr);
  assert.match(a.stderr, /wider than this run's acceptEdits/);
  assert.ok(a.stderr.includes(record), `F2: the message names the record: ${a.stderr}`);

  for (const broken of [null, 'yolo\n']) {
    if (broken === null) rmSync(record);
    else writeFileSync(record, broken);
    const w = start(['--permission-mode', 'acceptEdits'], ['M-1']);
    assert.equal(w.status, 2, w.stderr);
    assert.match(w.stderr, /no readable record of this run's first permission mode: it runs only as dontAsk; to start a new run instead, delete .*queue-P-1/);
    assert.ok(w.stderr.includes(record), `F2: the message names the record: ${w.stderr}`);
  }
  const n = start([], ['M-1', 'M-2']);
  assert.equal(n.status, 0, n.stderr);
  assert.equal(childMode(), 'dontAsk');
  assert.equal(readFileSync(record, 'utf8'), 'dontAsk\n');
  assert.equal(readState(dir).mode, 'dontAsk');
});

// review round 3, batch G2

// X9/F2/T8: the record of the first mode and the answers store outlived a deleted run dir: every
// later start with that id was capped at the old mode, and the old answers could feed the new run
test('a start whose run dir is gone: the stale mode record and answers store are removed, with an event; a new run', () => {
  const root = repo();
  atVerify(root, 'M-1');
  put(root, planLedger('M-1'), [planFirst('M-1', '3'), Q]);
  const dir = runDir(root, 'queue', 'P-1');
  assert.equal(cli(root, ['start', '--permission-mode', 'dontAsk', 'queue', 'P-1', 'M-1']).status, 0); // waits, no child
  writeFileSync(join(root, 'a.txt'), 'old\n');
  assert.equal(cli(root, ['answer', dir, 'M-1', join(root, 'a.txt')]).status, 0);
  assert.equal(readFileSync(recordAt(root, dir), 'utf8'), 'dontAsk\n');
  rmSync(dir, { recursive: true });
  const r = cli(root, ['start', '--permission-mode', 'auto', 'queue', 'P-1', 'M-1'], waitsThenShips('M-1'));
  assert.equal(r.status, 0, r.stderr);
  assert.equal(readFileSync(recordAt(root, dir), 'utf8'), 'auto\n');
  assert.equal(readState(dir).mode, 'auto');
  assert.match(events(dir), /child permission mode: auto \(flag\)$/m);
  // the old answers are gone with the old run: the item waits for new ones
  assert.deepEqual(children(dir), []);
  assert.deepEqual(readState(dir).items.map((i) => [i.status, i.answersFile]), [['waiting', null]]);
  assert.equal(existsSync(join(answersAt(root, dir), 'answers-M-1.md')), false);
  const said = `run dir gone: removed the old run's mode record ${recordAt(root, dir)} and answers store ${answersAt(root, dir)}; a new run`;
  assert.ok(events(dir).includes(` P-1 - progress ${said}\n`), events(dir));
});

// X10: the mode records and the answers stores in their own folders
test('the git dir holds the mode records under ship-runner/modes/ and the answers stores under ship-runner/answers/', () => {
  const root = repo();
  atVerify(root, 'W-1');
  assert.equal(cli(root, ['start', 'queue', 'P-1', 'W-1'], { FAKE_CLAUDE_BY_KEY: JSON.stringify({ 'W-1': { ...waitsThenShips('W-1'), FAKE_CLAUDE: 'ok:RUNNER: waiting' } }) }).status, 0);
  const dir = runDir(root, 'queue', 'P-1');
  writeFileSync(join(root, 'a.txt'), '1A\n');
  assert.equal(cli(root, ['answer', dir, 'W-1', join(root, 'a.txt')]).status, 0);
  assert.deepEqual(readdirSync(join(root, '.git', 'ship-runner')).sort(), ['answers', 'modes']);
  assert.deepEqual(readdirSync(join(root, '.git', 'ship-runner', 'modes')), ['queue-P-1.mode']);
  assert.deepEqual(readdirSync(answersAt(root, dir)), ['answers-W-1.md']);
});

// X10: state.json's answersFile is a name in the store, answers-<KEY>@<n>.md: never a path out of it,
// never another item's
test('state.json naming an answers file outside the store, or another item\'s: never read, an event says so', () => {
  const root0 = repo();
  for (const bad of ['../../../../secret.txt', join(root0, 'secret.txt'), 'answers-X-9@1.md']) {
    const root = bad.startsWith('/') ? root0 : repo();
    atVerify(root, 'R-1');
    put(root, planLedger('R-1'), [planFirst('R-1', '3'), Q]);
    writeFileSync(join(root, 'secret.txt'), 'forged\n');
    const dir = runDir(root, 'queue', 'P-1');
    mkdirSync(answersAt(root, dir), { recursive: true });
    writeFileSync(join(answersAt(root, dir), 'answers-X-9@1.md'), 'forged\n');
    writeState(dir, {
      kind: 'queue', id: 'P-1', current: null, stopped: new Date().toISOString(), root,
      items: [{ key: 'R-1', phase: 'verify', status: 'cut off', reason: '', deps: [], answersFile: bad,
        sessions: [{ phase: 'verify', sessionId: 's-3', costUsd: 0.1, turns: 1, minutes: 0 }], windows: [] }],
    });
    const log = join(root, 'r.json');
    const r = cli(root, ['start', 'queue', 'P-1', 'R-1'], waitsThenShips('R-1', { FAKE_CLAUDE_LOG: log }));
    assert.equal(r.status, 0, r.stderr);
    assert.equal(existsSync(log), false, `${bad}: no child`);
    assert.deepEqual(readState(dir).items.map((i) => [i.status, i.answersFile]), [['waiting', null]], bad);
    assert.ok(events(dir).includes(` R-1 verify progress state.json names the answers file ${bad}, not one of R-1's in the store; ignored\n`), events(dir));
  }
});

// T9 (review round 3): K1 keeps a verify item's old ledger snapshot while it holds consumed
// answers: a rerun after the answered child was cut off resumes it with them
test('start verify: answered, the answered child cut off, a rerun: the resumed child gets the answers', () => {
  const root = repo();
  git(root, 'switch', '-q', '-c', 'feat/a');
  const vf = '.superpowers/verify-and-fix/feat-a/ledger.md';
  const dir = runDir(root, 'verify', 'feat/a');
  // a first start's child asked (a single run waits for its answers, so its state is written here)
  put(root, vf, [Q]);
  writeState(dir, {
    kind: 'verify', id: 'feat/a', current: null, stopped: new Date().toISOString(), root,
    items: [{ key: 'feat-a', phase: 'verify', status: 'waiting', reason: '1 question', deps: [], answersFile: null, from: 0,
      sessions: [{ phase: 'verify', sessionId: 's-1', costUsd: 0.1, turns: 1, minutes: 0 }], windows: [] }],
  });
  writeFileSync(join(root, 'a.txt'), 'postgres\n');
  assert.equal(cli(root, ['answer', dir, 'feat-a', join(root, 'a.txt')]).status, 0);
  let r = cli(root, ['start', 'verify', 'feat/a'], { FAKE_CLAUDE: 'error' });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(readState(dir).items.map((i) => [i.status, i.answersFile]), [['cut off', 'answers-feat-a@1.md']]);
  const log = join(root, 'v.json');
  r = cli(root, ['start', 'verify', 'feat/a'], {
    FAKE_CLAUDE: 'ok:RUNNER: done', FAKE_CLAUDE_LOG: log,
    FAKE_CLAUDE_LEDGER_APPEND: ops([{ when: 'copied exactly', file: vf, replace: [[Q, 'Asked: which db? — postgres']], append: ['Done: x — clean'] }]),
  });
  assert.equal(r.status, 0, r.stderr);
  const seen = JSON.parse(readFileSync(log, 'utf8'));
  assert.match(seen.stdin, /copied exactly:\npostgres\n$/);
  assert.deepEqual(seen.argv.slice(-2), ['--resume', 's-1']);
  assert.deepEqual(readState(dir).items.map((i) => [i.status, i.from]), [['done', 0]]);
});

// D5: the runner tells each child its item key (SHIP_RUNNER_KEY), the one state.json's current names
test('a child gets SHIP_RUNNER_KEY, its item key: a verify branch #12-fix is 12-fix', () => {
  const root = repo();
  git(root, 'switch', '-q', '-c', '#12-fix');
  const log = join(root, 'k.json');
  const r = cli(root, ['start', 'verify', '#12-fix'], {
    FAKE_CLAUDE: 'ok:RUNNER: done', FAKE_CLAUDE_LOG: log,
    FAKE_CLAUDE_LEDGER_APPEND: ops([{ file: '.superpowers/verify-and-fix/#12-fix/ledger.md', append: ['Done: x — clean'] }]),
  });
  assert.equal(r.status, 0, r.stderr);
  const dir = runDir(root, 'verify', '#12-fix');
  const seen = JSON.parse(readFileSync(log, 'utf8'));
  assert.equal(seen.shipRunnerKey, '12-fix');
  // the key state.json names as current while the child runs (round 4 suggestion: pinned)
  assert.equal(seen.stateCurrent, seen.shipRunnerKey);
  assert.deepEqual(readState(dir).items.map((i) => [i.key, i.status]), [['12-fix', 'done']]);
});

// F3: a verify rerun took a fresh ledger snapshot unless the item was waiting or held answers, so a
// question a cut-off child had asked was hidden; the old snapshot stays while lines after it wait
test('start verify again after a child that asked and was cut off: the old snapshot is kept, the question still waits', () => {
  const root = repo();
  git(root, 'switch', '-q', '-c', 'feat/q');
  const vf = '.superpowers/verify-and-fix/feat-q/ledger.md';
  const dir = runDir(root, 'verify', 'feat/q');
  let r = cli(root, ['start', 'verify', 'feat/q'], { FAKE_CLAUDE: 'error', FAKE_CLAUDE_LEDGER_APPEND: ops([{ file: vf, append: [Q] }]) });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(readState(dir).items[0].status, 'cut off');
  const log = join(root, 'q.json');
  const runner = spawnSync(process.execPath, [RUNNER, 'start', 'verify', 'feat/q'], { cwd: root, env: { ...ENV, FAKE_CLAUDE: 'ok:RUNNER: done', FAKE_CLAUDE_LOG: log }, encoding: 'utf8', timeout: 3000 });
  // a single run waits for its answers: stopped by the timeout, with the item waiting and no child
  assert.equal(existsSync(log), false, 'no child');
  assert.deepEqual(readState(dir).items.map((i) => [i.status, i.from]), [['waiting', 0]], runner.stderr);
  r = cli(root, ['status', dir]);
  assert.match(r.stdout, /Pending questions:\nfeat-q: Asked: which db\? — pending\n/);
});

// F3: the start refusal names the uncommitted paths, the first 5
test('start refuses a dirty checkout naming the first 5 changed paths and how many more', () => {
  const root = repo();
  atVerify(root, 'C-1');
  for (let n = 1; n <= 7; n++) put(root, `f${n}.md`, ['x']);
  const r = cli(root, ['start', 'issue', 'C-1'], ships('C-1'));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /\(it is on main, with uncommitted changes: f1\.md, f2\.md, f3\.md, f4\.md, f5\.md and 2 more\)\n$/);
});

// T11: status shows `answers received` only for a plain answers file in the store
test('status: an answers file that is a link is not shown as received', () => {
  const root = repo();
  atVerify(root, 'S-1', 'S-2');
  const dir = runDir(root, 'queue', 'P-1');
  writeState(dir, {
    kind: 'queue', id: 'P-1', current: null, stopped: '2026-11-03T00:00:00Z',
    items: ['S-1', 'S-2'].map((key) => ({ key, phase: 'verify', status: 'waiting', reason: '1 question', deps: [], sessions: [], answersFile: null })),
  });
  mkdirSync(answersAt(root, dir), { recursive: true });
  writeFileSync(join(answersAt(root, dir), 'answers-S-1.md'), '1A\n');
  symlinkSync(join(answersAt(root, dir), 'answers-S-1.md'), join(answersAt(root, dir), 'answers-S-2.md'));
  const r = cli(root, ['status', dir]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^S-1 +waiting +verify +1 question; answers received /m);
  assert.match(r.stdout, /^S-2 +waiting +verify +1 question +\$/m);
});
