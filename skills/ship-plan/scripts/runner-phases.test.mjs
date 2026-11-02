// Tests for the phases of one issue. Run: node --test 'skills/ship-plan/scripts/*.test.mjs'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findPlanLedger, implementChunks, pendingQuestions, phaseFromLedgers, phasePrompt, PHASES, PHASE_ROWS, runIssue, tailProgress } from './runner-phases.mjs';

process.env.CLAUDE_BIN = join(dirname(fileURLToPath(import.meta.url)), 'fake-claude.mjs');

const KEY = 'BILL-7';
const ISSUE = `.superpowers/ship-issue/${KEY}/ledger.md`;
const PLAN_LEDGER = '.superpowers/ship-plan/feat-bill-7/ledger.md';
const issueFirst = (n) => `Phase: I${n} | Issue: ${KEY} | Branch: feat/bill-7 | Spec: docs/spec.md | Plan: docs/plan.md | ship-plan ledger: ${PLAN_LEDGER}`;
const planFirst = (p) => `Phase: ${p} | Plan: docs/plan.md | Issue: ${KEY} | PR: #4 | merge: | base run: 1`;

function repo({ issue, plan, tasks } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'runner-phases-'));
  const put = (rel, text) => {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text);
  };
  if (issue) put(ISSUE, issue.join('\n') + '\n');
  if (plan) put(PLAN_LEDGER, plan.join('\n') + '\n');
  if (tasks) put('docs/plan.md', '# Plan\n\n' + Array.from({ length: tasks }, (_, i) => `### Task ${i + 1}: t${i + 1}\n\nbody\n`).join('\n'));
  return root;
}

const MODELS = Object.fromEntries(Object.values(PHASE_ROWS).map((row) => [row, { model: 'sonnet', effort: 'high' }]));
const ctxFor = (root, env, extra = {}) => ({ root, dir: join(root, 'run'), models: MODELS, mode: 'auto', env, ...extra });
const item = (extra = {}) => ({ key: KEY, phase: null, status: 'queued', reason: '', deps: [], sessions: [], answersFile: null, ...extra });
const events = (root) => (existsSync(join(root, 'run', 'events.log')) ? readFileSync(join(root, 'run', 'events.log'), 'utf8') : '');
const ledgerOps = (ops) => JSON.stringify(ops);

test('PHASES and PHASE_ROWS', () => {
  assert.deepEqual(PHASES, ['spec', 'plan', 'implement', 'verify', 'merge', 'close']);
  assert.equal(PHASE_ROWS.spec, 'Spec stage');
  assert.equal(PHASE_ROWS.implement, 'Phase: implement');
});

test('phaseFromLedgers: I2 -> spec; I5 -> plan; ship-plan 2b -> implement; 4R awaiting review -> merge; done -> finished', () => {
  const none = { waiting: false, blocked: null };
  assert.deepEqual(phaseFromLedgers(repo({ issue: [issueFirst(2)] }), KEY), { phase: 'spec', ...none });
  assert.deepEqual(phaseFromLedgers(repo({ issue: [issueFirst(5)] }), KEY), { phase: 'plan', ...none });
  assert.deepEqual(phaseFromLedgers(repo({ issue: [issueFirst(6)] }), KEY), { phase: 'implement', ...none });
  const at = (p) => phaseFromLedgers(repo({ issue: [issueFirst(6)], plan: [planFirst(p)] }), KEY).phase;
  assert.equal(at('2b'), 'implement');
  assert.equal(at('0'), 'implement');
  assert.equal(at('3'), 'verify');
  assert.equal(at('4'), 'verify');
  assert.equal(at('4R awaiting review'), 'merge');
  assert.equal(at('5 awaiting merge'), 'merge');
  assert.equal(at('6b'), 'merge');
  assert.equal(at('7'), 'close');
  assert.equal(at('8'), 'close');
  assert.equal(at('done'), 'finished');
  // a ship-plan ledger counts even while ship-issue still says I5
  assert.equal(phaseFromLedgers(repo({ issue: [issueFirst(5)], plan: [planFirst('3')] }), KEY).phase, 'verify');
  // no ship-issue ledger yet: nothing started
  assert.deepEqual(phaseFromLedgers(repo(), KEY), { phase: 'spec', ...none });
  const odd = phaseFromLedgers(repo({ issue: [issueFirst(6)], plan: [planFirst('9z')] }), KEY);
  assert.match(odd.blocked, /unknown ship-plan phase "9z"/);
});

test('waiting: Waiting: batch line or Asked … — pending', () => {
  const batch = repo({ issue: [issueFirst(3), 'Asked: which db? — pending', 'Waiting: batch of 1, sent 2026-11-03; heads: none'] });
  assert.equal(phaseFromLedgers(batch, KEY).waiting, true);
  const asked = repo({ issue: [issueFirst(6)], plan: [planFirst('3'), 'Asked: rename it? — pending'] });
  assert.equal(phaseFromLedgers(asked, KEY).waiting, true);
  const answered = repo({ issue: [issueFirst(3), 'Asked: which db? — postgres', 'Stage: spec done docs/spec.md — skills: x'] });
  assert.equal(phaseFromLedgers(answered, KEY).waiting, false);
  // a Waiting line that is no longer last does not count
  const resumed = repo({ issue: [issueFirst(4), 'Waiting: batch of 1, sent 2026-11-03; heads: none', 'Asked: which db? — postgres'] });
  assert.equal(phaseFromLedgers(resumed, KEY).waiting, false);
});

test('phaseFromLedgers: Blocked: line -> blocked text', () => {
  const root = repo({ issue: [issueFirst(6)], plan: [planFirst('3'), 'Blocked: CI secret missing'] });
  assert.equal(phaseFromLedgers(root, KEY).blocked, 'CI secret missing');
});

test('implementChunks: 12 tasks, size 5 -> [1-5, 6-10, 11-12]', () => {
  const root = repo({ tasks: 12 });
  const plan = join(root, 'docs/plan.md');
  assert.deepEqual(implementChunks(plan, 5), [{ from: 1, to: 5 }, { from: 6, to: 10 }, { from: 11, to: 12 }]);
  assert.deepEqual(implementChunks(plan), [{ from: 1, to: 5 }, { from: 6, to: 10 }, { from: 11, to: 12 }]);
  assert.deepEqual(implementChunks(plan, 12), [{ from: 1, to: 12 }]);
  writeFileSync(plan, '### Task 0: probe\n### Task 1: a\n### Task 2: b\n#### Task 9 not a heading\n');
  assert.deepEqual(implementChunks(plan, 2), [{ from: 0, to: 1 }, { from: 2, to: 2 }]);
});

test('phasePrompt: answers appended verbatim, never shell-interpolated', async () => {
  assert.equal(
    phasePrompt({ skill: 'ship-issue', args: KEY, phase: 'implement', chunk: { from: 1, to: 5 }, answers: null }),
    `Invoke the ai-skills:ship-issue skill with the Skill tool, with the arguments "${KEY}". You are a ship-runner child: nobody is watching; follow the skill's Runner mode for phase implement, plan tasks 1–5.`,
  );
  const answers = '1. use `rm -rf /` $(whoami) "quoted" $HOME\n2. yes';
  const p = phasePrompt({ skill: 'ship-issue', args: KEY, phase: 'spec', chunk: null, answers });
  assert.ok(p.endsWith(`for phase spec.\n\nThe user's answers, copied exactly:\n${answers}`));

  // through runIssue: answers reach the child on stdin, byte for byte, never in argv
  const root = repo({ issue: [issueFirst(3), 'Asked: q — pending', 'Waiting: batch of 1, sent 2026-11-03; heads: none'] });
  const ctx = ctxFor(root, { FAKE_CLAUDE: 'ok:RUNNER: phase-done', FAKE_CLAUDE_LOG: join(root, 'fake.json') });
  mkdirSync(ctx.dir, { recursive: true });
  writeFileSync(join(ctx.dir, `answers-${KEY}.md`), answers);
  const it = item({ status: 'queued', answersFile: `answers-${KEY}.md`, sessions: [{ phase: 'spec', sessionId: 's-9', costUsd: 1, turns: 2, minutes: 3 }] });
  await runIssue(ctx, it);
  const seen = JSON.parse(readFileSync(join(root, 'fake.json'), 'utf8'));
  assert.ok(seen.stdin.endsWith(`copied exactly:\n${answers}`));
  assert.ok(!seen.argv.some((a) => a.includes('whoami')));
  assert.deepEqual(seen.argv.slice(-2), ['--resume', 's-9']); // answers resume the phase's last session
  assert.equal(it.answersFile, null);
});

test('runIssue: marker says phase-done but ledger unchanged -> blocked, no second run', async () => {
  const root = repo({ issue: [issueFirst(2)] });
  const it = await runIssue(ctxFor(root, { FAKE_CLAUDE: 'ok:RUNNER: phase-done spec written' }), item());
  assert.equal(it.status, 'blocked');
  assert.equal(it.reason, 'phase spec ended without progress');
  assert.equal(it.sessions.length, 1);
  assert.equal(existsSync(join(root, 'run', `${KEY}-spec-2.jsonl`)), false);
  assert.match(events(root), / BILL-7 spec blocked phase spec ended without progress$/m);
});

test('runIssue: no marker but ledger advanced -> continues (Review Focus 2)', async () => {
  const root = repo({ issue: [issueFirst(5)] });
  // unmarked children: the plan child advances to verify, the verify child finishes
  const ops = ledgerOps([
    { when: 'for phase plan.', file: ISSUE, firstLine: issueFirst(6) },
    { when: 'for phase plan.', file: PLAN_LEDGER, firstLine: planFirst('3') },
    { when: 'for phase verify.', file: PLAN_LEDGER, firstLine: planFirst('done'), append: ['Outcome: Done'] },
  ]);
  const saved = [];
  const it = await runIssue(ctxFor(root, { FAKE_CLAUDE: 'ok:', FAKE_CLAUDE_LEDGER_APPEND: ops }, { save: (i) => saved.push(i.status) }), item());
  assert.equal(it.status, 'done');
  assert.deepEqual(it.sessions, [
    { phase: 'plan', sessionId: 's-1', costUsd: 0.42, turns: 3, minutes: 3 },
    { phase: 'verify', sessionId: 's-1', costUsd: 0.42, turns: 3, minutes: 3 },
  ]);
  assert.ok(saved.length >= 1);
  assert.match(events(root), / BILL-7 plan start /);
  assert.match(events(root), / BILL-7 verify start /);
  assert.match(events(root), / BILL-7 finished done /);
});

test('runIssue: no marker and ledger unchanged -> cut off, no RUNNER: line', async () => {
  const root = repo({ issue: [issueFirst(2)] });
  const it = await runIssue(ctxFor(root, { FAKE_CLAUDE: 'ok:' }), item());
  assert.equal(it.status, 'cut off');
  assert.equal(it.reason, 'no RUNNER: line');
  assert.equal(it.sessions.length, 1);
  assert.match(events(root), / BILL-7 spec cutoff no RUNNER: line$/m);
});

test('runIssue: implement chunks follow heading numbers, gaps are not undone tasks', async () => {
  const root = repo({ issue: [issueFirst(6)], plan: [planFirst('2'), 'Progress: task 1 done', 'Progress: task 2 done', 'Progress: task 5 done'], tasks: 1 });
  writeFileSync(join(root, 'docs/plan.md'), '### Task 1: a\n### Task 2: b\n### Task 5: c\n### Task 6: d\n');
  const log = join(root, 'fake.json');
  await runIssue(ctxFor(root, { FAKE_CLAUDE: 'ok:RUNNER: phase-done', FAKE_CLAUDE_LOG: log }, { chunkSize: 3 }), item());
  // chunks [1,2,5] and [6]: the first is done, so the child gets tasks 6–6
  assert.match(JSON.parse(readFileSync(log, 'utf8')).stdin, /plan tasks 6–6\.$/);
});

test('runIssue: child ok:false -> cut off', async () => {
  const root = repo({ issue: [issueFirst(2)] });
  const it = await runIssue(ctxFor(root, { FAKE_CLAUDE: 'error' }), item());
  assert.equal(it.status, 'cut off');
  assert.match(it.reason, /usage limit reached/);
  assert.match(events(root), / BILL-7 spec cutoff /);
});

test('runIssue: ledger waiting after the child -> waiting, n questions', async () => {
  const root = repo({ issue: [issueFirst(1)] });
  const ops = ledgerOps([{ file: ISSUE, firstLine: issueFirst(3), append: ['Asked: a — pending', 'Asked: b — pending', 'Waiting: batch of 2, sent 2026-11-03; heads: none'] }]);
  const it = await runIssue(ctxFor(root, { FAKE_CLAUDE: 'ok:RUNNER: phase-done', FAKE_CLAUDE_LEDGER_APPEND: ops }), item());
  assert.equal(it.status, 'waiting');
  assert.match(events(root), / BILL-7 spec waiting 2 questions$/m);
});

test('runIssue: RUNNER: blocked -> blocked with its text', async () => {
  const root = repo({ issue: [issueFirst(2)] });
  const it = await runIssue(ctxFor(root, { FAKE_CLAUDE: 'ok:RUNNER: blocked branch checked out elsewhere' }), item());
  assert.equal(it.status, 'blocked');
  assert.equal(it.reason, 'branch checked out elsewhere');
});

test('runIssue: implement runs one child per chunk not yet done, Progress lines emitted', async () => {
  const root = repo({ issue: [issueFirst(6)], plan: [planFirst('2'), 'Progress: task 1 done', 'Progress: task 2 done'], tasks: 4 });
  const ops = ledgerOps([
    { when: 'plan tasks 1–2', file: PLAN_LEDGER, append: ['Progress: should not run'] },
    { when: 'plan tasks 3–4', file: PLAN_LEDGER, append: ['Progress: task 3 done', 'Progress: task 4 done'] },
    { when: 'for phase implement.', file: PLAN_LEDGER, firstLine: planFirst('done') },
  ]);
  const log = join(root, 'fake.json');
  const it = await runIssue(ctxFor(root, { FAKE_CLAUDE: 'ok:RUNNER: phase-done', FAKE_CLAUDE_LEDGER_APPEND: ops, FAKE_CLAUDE_LOG: log }, { chunkSize: 2 }), item());
  assert.equal(it.status, 'done');
  assert.deepEqual(it.sessions.map((s) => s.phase), ['implement', 'implement']);
  const ev = events(root);
  assert.match(ev, / BILL-7 implement start implement, plan tasks 3–4$/m);
  assert.match(ev, / BILL-7 implement progress Progress: task 4 done$/m);
  assert.doesNotMatch(ev, /should not run/);
});

test('runIssue: waiting ledger and no answers -> waiting, no child', async () => {
  const root = repo({ issue: [issueFirst(3), 'Asked: q — pending', 'Waiting: batch of 1, sent 2026-11-03; heads: none'] });
  const it = await runIssue(ctxFor(root, { FAKE_CLAUDE: 'crash' }), item());
  assert.equal(it.status, 'waiting');
  assert.equal(it.sessions.length, 0);
});

test('runIssue: missing ## Models row -> blocked, no child', async () => {
  const root = repo({ issue: [issueFirst(2)] });
  const it = await runIssue(ctxFor(root, { FAKE_CLAUDE: 'crash' }, { models: {} }), item());
  assert.equal(it.status, 'blocked');
  assert.equal(it.reason, 'no ## Models row "Spec stage"');
});

test('tailProgress: Progress lines and first-line Phase changes, nothing old', async () => {
  const root = repo({ issue: [issueFirst(6)], plan: [planFirst('2'), 'Progress: old line'] });
  const seen = [];
  const stop = tailProgress(root, KEY, (l) => seen.push(l), 20);
  writeFileSync(join(root, PLAN_LEDGER), [planFirst('3'), 'Progress: old line', 'Ruling: x', 'Progress: task 1 done'].join('\n') + '\n');
  await new Promise((r) => setTimeout(r, 60));
  stop();
  assert.deepEqual(seen, [planFirst('3'), 'Progress: task 1 done']);
});

test('phaseFromLedgers { ledger }: a plan run reads the ship-plan ledger directly, implement until it exists', () => {
  const root = repo({ plan: [planFirst('3')] });
  // no ship-issue ledger: without the option this would be spec
  assert.equal(phaseFromLedgers(root, 'plan', {}).phase, 'spec');
  assert.deepEqual(phaseFromLedgers(root, 'plan', { ledger: PLAN_LEDGER }), { phase: 'verify', waiting: false, blocked: null });
  assert.equal(phaseFromLedgers(root, 'plan', { ledger: '.superpowers/ship-plan/none/ledger.md' }).phase, 'implement');
  assert.equal(phaseFromLedgers(root, 'plan', { ledger: () => null }).phase, 'implement');
  assert.equal(phaseFromLedgers(root, 'plan', { ledger: () => PLAN_LEDGER }).phase, 'verify');
});

test('findPlanLedger: the open ledger whose Plan: field names the plan, else a done one, else null', () => {
  const root = repo();
  const put = (slug, first) => {
    mkdirSync(join(root, '.superpowers/ship-plan', slug), { recursive: true });
    writeFileSync(join(root, '.superpowers/ship-plan', slug, 'ledger.md'), first + '\n');
  };
  assert.equal(findPlanLedger(root, 'docs/plan.md'), null);
  put('a-old', 'Phase: done | Plan: docs/plan.md | PR: #1');
  put('b-other', 'Phase: 2 | Plan: docs/other.md');
  assert.equal(findPlanLedger(root, 'docs/plan.md'), join(root, '.superpowers/ship-plan/a-old/ledger.md'));
  put('c-open', 'Phase: 3 | Plan: docs/plan.md | PR: #2');
  assert.equal(findPlanLedger(root, './docs/plan.md'), join(root, '.superpowers/ship-plan/c-open/ledger.md'));
});

test('phaseFromLedgers { ledger, only: verify }: verify alone; Done: after the snapshot finishes it', () => {
  // a ship-plan ledger: before verify -> verify, past it -> finished
  const at = (p) => phaseFromLedgers(repo({ plan: [planFirst(p)] }), 'x', { ledger: PLAN_LEDGER, only: 'verify' }).phase;
  assert.equal(at('2'), 'verify');
  assert.equal(at('3'), 'verify');
  assert.equal(at('5 awaiting merge'), 'finished');
  assert.equal(at('done'), 'finished');
  // a verify-and-fix ledger has no Phase: line; a Done: line written after the snapshot ends it
  const root = repo();
  const VF = '.superpowers/verify-and-fix/feat-x/ledger.md';
  const opts = { ledger: VF, only: 'verify' };
  assert.deepEqual(phaseFromLedgers(root, 'feat-x', opts), { phase: 'verify', waiting: false, blocked: null });
  mkdirSync(dirname(join(root, VF)), { recursive: true });
  writeFileSync(join(root, VF), 'Round 1: gates green\nBlocked: old\nDone: abc — clean\n');
  assert.equal(phaseFromLedgers(root, 'feat-x', opts).phase, 'finished');
  // snapshot after line 3: the old Done: and Blocked: lines no longer count
  assert.deepEqual(phaseFromLedgers(root, 'feat-x', { ...opts, from: 3 }), { phase: 'verify', waiting: false, blocked: null });
  writeFileSync(join(root, VF), 'Round 1: gates green\nBlocked: old\nDone: abc — clean\nAsked: rename? — pending\n');
  assert.equal(phaseFromLedgers(root, 'feat-x', { ...opts, from: 3 }).waiting, true);
});

test('pendingQuestions: every Asked … — pending line of both ledgers', () => {
  const root = repo({ issue: [issueFirst(6), 'Asked: a? — pending', 'Asked: b? — yes'], plan: [planFirst('3'), 'Asked: c? — pending'] });
  assert.deepEqual(pendingQuestions(root, KEY), ['Asked: a? — pending', 'Asked: c? — pending']);
  assert.deepEqual(pendingQuestions(root, 'p', { ledger: PLAN_LEDGER }), ['Asked: c? — pending']);
});

test('runIssue { ledgers }: plan run starts at implement with the plan doc, ship-plan skill and path', async () => {
  const root = repo({ tasks: 2 });
  const ops = ledgerOps([{ when: 'for phase implement', file: PLAN_LEDGER, firstLine: 'Phase: done | Plan: docs/plan.md' }]);
  const log = join(root, 'fake.json');
  const ctx = ctxFor(root, { FAKE_CLAUDE: 'ok:RUNNER: phase-done', FAKE_CLAUDE_LEDGER_APPEND: ops, FAKE_CLAUDE_LOG: log }, {
    skill: 'ship-plan', args: 'docs/plan.md',
    ledgers: { ledger: () => findPlanLedger(root, 'docs/plan.md'), planDoc: 'docs/plan.md' },
  });
  const it = await runIssue(ctx, item({ key: 'plan' }));
  assert.equal(it.status, 'done');
  assert.match(JSON.parse(readFileSync(log, 'utf8')).stdin, /ai-skills:ship-plan skill .* "docs\/plan\.md".*phase implement, plan tasks 1–2\.$/);
});

test('runIssue { ledger, only: verify }: Blocked: then the closing Done: ends blocked, not done', async () => {
  const root = repo();
  const VF = '.superpowers/verify-and-fix/feat-x/ledger.md';
  mkdirSync(dirname(join(root, VF)), { recursive: true });
  writeFileSync(join(root, VF), 'Blocked: old\nDone: abc — clean\n'); // an earlier run, before the snapshot
  const ops = ledgerOps([{ file: VF, append: ['Blocked: gate e2e could not run', 'Done: def — not clean: gate e2e could not run'] }]);
  const ctx = ctxFor(root, { FAKE_CLAUDE: 'ok:RUNNER: blocked gate e2e could not run', FAKE_CLAUDE_LEDGER_APPEND: ops }, {
    skill: 'verify-and-fix', args: '', ledgers: { ledger: VF, only: 'verify', from: 2 },
  });
  const it = await runIssue(ctx, item({ key: 'feat-x' }));
  assert.equal(it.status, 'blocked');
  assert.equal(it.reason, 'gate e2e could not run');
  assert.match(events(root), /feat-x verify blocked gate e2e could not run/);
});

test('runIssue { ledger, only: verify }: a clean Done: with no new Blocked: ends done', async () => {
  const root = repo();
  const VF = '.superpowers/verify-and-fix/feat-x/ledger.md';
  mkdirSync(dirname(join(root, VF)), { recursive: true });
  writeFileSync(join(root, VF), 'Blocked: old\n');
  const ops = ledgerOps([{ file: VF, append: ['Done: def — clean'] }]);
  const ctx = ctxFor(root, { FAKE_CLAUDE: 'ok:RUNNER: done clean', FAKE_CLAUDE_LEDGER_APPEND: ops }, {
    skill: 'verify-and-fix', args: '', ledgers: { ledger: VF, only: 'verify', from: 1 },
  });
  const it = await runIssue(ctx, item({ key: 'feat-x' }));
  assert.equal(it.status, 'done');
});

test('runIssue { ledger, only: verify }: a question before the closing Done: ends waiting; answers resume it', async () => {
  const root = repo();
  const VF = '.superpowers/verify-and-fix/feat-x/ledger.md';
  const Q = 'Asked: rename it? A) yes (recommended) B) no — pending';
  const ops = ledgerOps([
    { when: 'for phase verify.', file: VF, append: ['Round 1: green', Q, 'Done: abc — clean'] },
    { when: 'copied exactly', file: VF, replace: [[Q, 'Asked: rename it? A) yes (recommended) B) no — A']], append: ['Done: def — clean'] },
  ]);
  const log = join(root, 'fake.json');
  const ctx = ctxFor(root, { FAKE_CLAUDE: 'ok:RUNNER: waiting 1 question', FAKE_CLAUDE_LEDGER_APPEND: ops, FAKE_CLAUDE_LOG: log }, {
    skill: 'verify-and-fix', args: '', ledgers: { ledger: VF, only: 'verify', from: 0 },
  });
  const it = await runIssue(ctx, item({ key: 'feat-x' }));
  assert.equal(it.status, 'waiting');
  assert.equal(it.reason, '1 question');
  assert.match(events(root), / feat-x verify waiting 1 question$/m);
  assert.deepEqual(pendingQuestions(root, 'feat-x', ctx.ledgers), [Q]);

  // the answers resume the verify session, even though the ledger ends with Done:
  writeFileSync(join(ctx.dir, 'answers-feat-x.md'), 'A\n');
  Object.assign(it, { status: 'queued', answersFile: 'answers-feat-x.md' });
  await runIssue(ctx, it);
  const seen = JSON.parse(readFileSync(log, 'utf8'));
  assert.deepEqual(seen.argv.slice(-2), ['--resume', 's-1']);
  assert.match(seen.stdin, /phase verify\.\n\nThe user's answers, copied exactly:\nA\n$/);
  assert.equal(it.status, 'done');
  assert.deepEqual(it.sessions.map((s) => s.phase), ['verify', 'verify']);
});

test('runIssue: a ship-plan ledger at Phase: done with a pending batch is waiting, not done', async () => {
  const root = repo({ issue: [issueFirst(6)], plan: [planFirst('done'), 'Outcome: Done', 'Asked: merge the lessons PR? — pending'] });
  const it = await runIssue(ctxFor(root, { FAKE_CLAUDE: 'crash' }), item({ sessions: [{ phase: 'close', sessionId: 's-7', costUsd: 0, turns: 1, minutes: 0 }] }));
  assert.deepEqual([it.status, it.reason], ['waiting', '1 question']);
  assert.match(events(root), / BILL-7 close waiting 1 question$/m);
});

test('runIssue: Progress: task <n> parked counts as handled; 7 tasks, task 3 parked -> next chunk 6–7', async () => {
  const done = (n) => `Progress: task ${n} done`;
  const root = repo({ issue: [issueFirst(6)], plan: [planFirst('2'), done(1), done(2), 'Progress: task 3 parked', done(4), done(5)], tasks: 7 });
  const log = join(root, 'fake.json');
  await runIssue(ctxFor(root, { FAKE_CLAUDE: 'ok:RUNNER: phase-done', FAKE_CLAUDE_LOG: log }), item());
  assert.match(JSON.parse(readFileSync(log, 'utf8')).stdin, /plan tasks 6–7\.$/);
});

test('runIssue: a plan with no ### Task headings runs implement once over the whole plan', async () => {
  const root = repo({ issue: [issueFirst(6)], plan: [planFirst('2')], tasks: 1 });
  writeFileSync(join(root, 'docs/plan.md'), '# Plan\n\n1. do a\n2. do b\n');
  const log = join(root, 'fake.json');
  const ops = ledgerOps([{ file: PLAN_LEDGER, firstLine: planFirst('done') }]);
  const it = await runIssue(ctxFor(root, { FAKE_CLAUDE: 'ok:RUNNER: phase-done', FAKE_CLAUDE_LOG: log, FAKE_CLAUDE_LEDGER_APPEND: ops }), item());
  assert.equal(it.status, 'done');
  assert.match(JSON.parse(readFileSync(log, 'utf8')).stdin, /phase implement, the whole plan \(it has no ### Task headings\)\.$/);
  assert.match(events(root), / BILL-7 implement start implement, the whole plan$/m);
});

test('runIssue: RUNNER: done with the ledgers unchanged -> done (already finished), not blocked', async () => {
  const root = repo();
  const it = await runIssue(ctxFor(root, { FAKE_CLAUDE: 'ok:RUNNER: done issue already in Done' }), item());
  assert.deepEqual([it.status, it.reason], ['done', 'issue already in Done']);
  assert.match(events(root), / BILL-7 spec done issue already in Done$/m);
});

test('tailProgress: stop() never throws on an unreadable ledger', () => {
  const root = repo();
  let path = null;
  const stop = tailProgress(root, 'x', () => {}, 60000, { ledger: () => path });
  path = root; // a directory: reading it fails with EISDIR
  assert.doesNotThrow(() => stop());
});
