#!/usr/bin/env node
// The ship runner's CLI. Run from the checkout:
//   node runner.mjs start [--permission-mode auto|acceptEdits|dontAsk|bypassPermissions] <run>, <run> one of:
//   (bypassPermissions only with SHIP_RUNNER_ALLOW_BYPASS=1 in the runner's env; never passed to children)
//   node runner.mjs start issue <KEY>
//   node runner.mjs start queue <PARENT> <KEY>,<KEY>… [--deps <KEY>:<DEP>,…]   (<KEY> waits for <DEP>)
//   node runner.mjs start plan <path>          ship-plan from implement
//   node runner.mjs start verify <branch> [-- <args>]   verify-and-fix alone, on the checked-out
//                                              branch; <args> (base branch, --comments) passed to it
// Every start but verify needs a clean checkout on the base branch (.superpowers/ aside).
//   node runner.mjs answer <run-dir> <KEY> <file>
//   node runner.mjs status <run-dir>
// Exit: 0 done, 1 runner error, 2 usage error, 3 the run dir's lock is held; 128+n on signal n.
import { execFileSync } from 'node:child_process';
import { constants } from 'node:os';
import { existsSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { acquireLock, alive, emit, readLock, readState, releaseLock, runDir, writeState } from './runner-lib.mjs';
import { findPlanLedger, ledgerOutcome, pendingQuestions, PHASE_ROWS, PHASES, phaseFromLedgers, runIssue } from './runner-phases.mjs';
import { killChildren } from './runner-child.mjs';
import { nextItem } from './runner-queue.mjs';

// `## Models` rows the runner's children use, with their defaults.
export const MODEL_DEFAULTS = {
  'Spec stage': { model: 'opus', effort: 'high' },
  'Plan stage': { model: 'opus', effort: 'high' },
  'Phase: implement': { model: 'sonnet', effort: 'high' },
  'Phase: verify': { model: 'opus', effort: 'high' },
  'Phase: merge': { model: 'sonnet', effort: 'high' },
  'Phase: close': { model: 'sonnet', effort: 'medium' },
};

const strip = (v) => v.replace(/`/g, '').trim();

export const CHILD_MODES = ['auto', 'acceptEdits', 'dontAsk', 'bypassPermissions'];

const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
const MODEL_NAME = /^[A-Za-z0-9.[\]_-]+$/;

/**
 * What the runner reads from `.claude/ship-plan.md`: `## Runner` `Implement chunk:` (default 5) and
 * `Child idle timeout:` (minutes, default 60), `## Repo` `Base branch:`, and `## Models` rows over
 * MODEL_DEFAULTS (roles matched case-insensitively). Never the permission mode: a child can edit
 * the working tree and every local git ref, so the mode comes only from `start --permission-mode`.
 * Headings match case-insensitively; a field line may start with `- `. A value the runner cannot
 * use is left out, with a line in `warnings`.
 */
export function parseConfig(text) {
  const sections = new Map();
  let lines = null;
  for (const line of String(text).split(/\r?\n/)) {
    const h = /^##\s+(.+?)\s*$/.exec(line);
    if (h) sections.set(h[1].toLowerCase(), (lines = []));
    else lines?.push(line);
  }
  const field = (section, name) => {
    for (const l of sections.get(section) ?? []) {
      const m = /^\s*(?:[-*]\s+)?([^:|]+):\s*(.*)$/.exec(l);
      if (m && m[1].trim().toLowerCase() === name.toLowerCase()) return strip(m[2]);
    }
    return '';
  };
  const warnings = [];
  const chunkText = field('runner', 'Implement chunk');
  let chunkSize = 5;
  if (chunkText) {
    if (/^\d+$/.test(chunkText) && Number(chunkText) > 0) chunkSize = Number(chunkText);
    else warnings.push(`Implement chunk: "${chunkText}" is not a positive whole number; using 5`);
  }
  const idleText = field('runner', 'Child idle timeout');
  let idleMinutes = 60;
  if (idleText) {
    if (/^\d+(\.\d+)?$/.test(idleText) && Number(idleText) > 0) idleMinutes = Number(idleText);
    else warnings.push(`Child idle timeout: "${idleText}" is not a positive number of minutes; using 60`);
  }
  const models = structuredClone(MODEL_DEFAULTS);
  const known = new Map(Object.keys(MODEL_DEFAULTS).map((k) => [k.toLowerCase(), k]));
  for (const l of sections.get('models') ?? []) {
    if (!l.trim().startsWith('|')) continue;
    const [cell, model, effort] = l.trim().replace(/^\||\|$/g, '').split('|').map(strip);
    if (!cell || !model || cell.toLowerCase() === 'role' || /^-+$/.test(cell)) continue;
    const role = known.get(cell.replace(/\s+/g, ' ').toLowerCase());
    if (!role) {
      // other roles are the skills' own (subagent dispatches); a Phase: row is the runner's
      if (/^phase:/i.test(cell)) warnings.push(`## Models row "${cell}": no such runner phase; row ignored`);
      continue;
    }
    if (!MODEL_NAME.test(model)) {
      warnings.push(`## Models row "${cell}": model "${model}" is not a model name; row ignored`);
      continue;
    }
    if (effort && !EFFORTS.includes(effort)) {
      warnings.push(`## Models row "${cell}": effort "${effort}" is not low, medium, high, xhigh or max; row ignored`);
      continue;
    }
    models[role] = { model, effort: effort || MODEL_DEFAULTS[role].effort };
  }
  return { chunkSize, idleMinutes, base: field('repo', 'Base branch'), models, warnings };
}

function readConfig(root) {
  try {
    return parseConfig(readFileSync(join(root, '.claude', 'ship-plan.md'), 'utf8'));
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    return parseConfig('');
  }
}

// git's output; on failure an Error whose message is git's own stderr.
function git(root, ...args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (e) {
    throw new Error(String(e.stderr ?? '').trim().replace(/\s*\n\s*/g, ' ') || e.message);
  }
}

// { name, from }: the config's `## Repo` `Base branch:`, else origin/HEAD's branch, else main.
function baseBranch(root, cfg) {
  if (cfg.base) return { name: cfg.base, from: 'config' };
  try {
    return { name: git(root, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD').replace(/^origin\//, ''), from: 'origin/HEAD' };
  } catch {
    return { name: 'main', from: 'default, no origin/HEAD' };
  }
}

function headBranch(root) {
  try {
    return git(root, 'symbolic-ref', '--short', 'HEAD');
  } catch {
    return '(detached or not a git checkout)';
  }
}

// Changed or untracked paths, .superpowers/ left out (the runner's and the skills' own files);
// { error } with git's words when git cannot tell.
function changedPaths(root) {
  let out;
  try {
    out = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    return { error: `git status failed: ${String(e.stderr ?? '').trim().replace(/\s*\n\s*/g, ' ') || e.message}` };
  }
  return { paths: out.split('\n').filter(Boolean).map((l) => l.slice(3)).filter((p) => !/^"?\.superpowers(\/|"?$)/.test(p)) };
}

function checkoutRoot() {
  try {
    return git(process.cwd(), 'rev-parse', '--show-toplevel');
  } catch {
    return process.cwd();
  }
}

const verifyLedger = (branch) => `.superpowers/verify-and-fix/${branch.replaceAll('/', '-')}/ledger.md`;

// How a run's item finds its ledgers (runner-phases LedgerOpts); undefined: the ship-issue ledger.
function ledgerOpts(root, state, item) {
  if (state.kind === 'plan') return { ledger: () => findPlanLedger(root, state.id), planDoc: state.id };
  if (state.kind === 'verify') return { ledger: verifyLedger(state.id), only: 'verify', from: item.from ?? 0 };
  return undefined;
}

const answersName = (key) => `answers-${key}.md`;

// An answers file not yet consumed puts a waiting item back in line (the `answer` command may race
// the runner's own state writes; the file is the record), and marks a queued one answered. The
// running item, and one that ended any other way (cut off, blocked, done), are left alone: a rerun
// re-queues those, and the file is still there for it.
function syncAnswers(state, dir) {
  for (const i of state.items) {
    if (i.key === state.current || !existsSync(join(dir, answersName(i.key)))) continue;
    if (i.status === 'waiting') Object.assign(i, { status: 'queued', reason: '', answersFile: answersName(i.key) });
    else if (i.status === 'queued') i.answersFile = answersName(i.key);
  }
}

// Rename answers-<KEY>.md to answers-<KEY>-<n>.md (first unused n), so it is used once.
function consumeAnswers(dir, key) {
  let n = 1;
  while (existsSync(join(dir, `answers-${key}-${n}.md`))) n++;
  const name = `answers-${key}-${n}.md`;
  renameSync(join(dir, answersName(key)), join(dir, name));
  return name;
}

const ORDER = ['done', 'waiting', 'blocked', 'cut off', 'not started', 'queued', 'running'];
const costOf = (item) => item.sessions.reduce((sum, s) => sum + (s.costUsd ?? 0), 0);
const minutesOf = (item) => item.sessions.reduce((sum, s) => sum + (s.minutes ?? 0), 0);

function summaryText(state) {
  const counts = ORDER.map((st) => [st, state.items.filter((i) => i.status === st).length]).filter(([, n]) => n);
  const cost = state.items.reduce((sum, i) => sum + costOf(i), 0);
  return `${counts.map(([st, n]) => `${n} ${st}`).join(', ')}; cost $${cost.toFixed(2)}`;
}

function usage(msg) {
  console.error(`runner: ${msg}`);
  return 2;
}

const newItem = (key, deps = []) => ({ key, phase: null, status: 'queued', reason: '', deps, sessions: [], answersFile: null });

// Parse `start …` arguments: { kind, id, items, skill, args } or an error string.
function parseStart(root, [what, ...a]) {
  if (!a[0]) return `start ${what ?? ''}: missing argument`;
  if (what === 'issue') return { kind: 'issue', id: a[0], items: [newItem(a[0])], skill: 'ship-issue' };
  if (what === 'queue') {
    const keys = (a[1] ?? '').split(',').map((k) => k.trim()).filter(Boolean);
    if (!keys.length) return 'start queue: no sub-issue keys';
    const twice = keys.find((k, n) => keys.indexOf(k) !== n);
    if (twice) return `start queue: ${twice} is in the list twice`;
    const deps = Object.fromEntries(keys.map((k) => [k, []]));
    const at = a.indexOf('--deps');
    for (const pair of at === -1 ? [] : (a[at + 1] ?? '').split(',').filter(Boolean)) {
      const [k, d] = pair.split(':').map((x) => x.trim());
      if (!deps[k] || !deps[d]) return `start queue: --deps ${pair}: both keys must be in the queue`;
      if (k === d) return `start queue: --deps ${pair}: a key cannot wait for itself`;
      if (!deps[k].includes(d)) deps[k].push(d);
    }
    return { kind: 'queue', id: a[0], items: keys.map((k) => newItem(k, deps[k])), skill: 'ship-issue' };
  }
  if (what === 'plan') {
    if (!existsSync(resolve(root, a[0]))) return `start plan: no plan at ${a[0]}`;
    return { kind: 'plan', id: a[0], items: [newItem(basename(a[0]).replace(/\.md$/, ''))], skill: 'ship-plan', args: a[0] };
  }
  if (what === 'verify') {
    // verify-and-fix's own arguments (base branch, --comments) follow `--`; the branch verified is
    // the checked-out one
    const extra = a[1] === '--' ? a.slice(2) : a.length > 1 ? null : [];
    if (!extra) return `start verify: after <branch> only -- <verify-and-fix arguments>`;
    if (extra.some((x) => /["\x00-\x1f\x7f]/.test(x))) return 'start verify: an argument after -- holds a quote or a control character';
    const item = newItem(a[0].replaceAll('/', '-'));
    try {
      item.from = readFileSync(join(root, verifyLedger(a[0])), 'utf8').replace(/\r?\n$/, '').split(/\r?\n/).length;
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
      item.from = 0;
    }
    return { kind: 'verify', id: a[0], items: [item], skill: 'verify-and-fix', args: extra.join(' ') };
  }
  return `start: unknown run "${what}" (issue, queue, plan, verify)`;
}

// Run fn; a throw is reported on stderr and otherwise ignored (the run's last writes must all be
// tried, whatever fails before them).
function safe(fn) {
  try {
    fn();
  } catch (e) {
    console.error(`runner: ${e.message}`);
  }
}

// The pid holding the run dir: its runner, alive; or, the runner dead, its child still alive (it
// still writes the ledgers). Null when nothing holds it.
function holder(dir) {
  const prev = readLock(dir);
  const live = (pid) => Number.isInteger(pid) && alive(pid);
  if (prev && live(prev.runner)) return prev.runner;
  if (prev && live(prev.child)) return prev.child;
  return null;
}

async function start(rest) {
  const root = checkoutRoot();
  // --permission-mode <m> (before any `--`): the only source of the children's mode
  const args = [...rest];
  let mode = 'auto';
  let modeFrom = 'default';
  const dd = args.indexOf('--');
  const at = args.slice(0, dd === -1 ? args.length : dd).indexOf('--permission-mode');
  if (at !== -1) {
    mode = args[at + 1];
    modeFrom = 'flag';
    args.splice(at, 2);
    if (!CHILD_MODES.includes(mode)) return usage(`start: --permission-mode must be one of ${CHILD_MODES.join(', ')}`);
  }
  // read once, never passed on: children inherit process.env
  const allowBypass = process.env.SHIP_RUNNER_ALLOW_BYPASS === '1';
  delete process.env.SHIP_RUNNER_ALLOW_BYPASS;
  const run = parseStart(root, args);
  if (typeof run === 'string') return usage(run);
  const dir = runDir(root, run.kind, run.id);

  // A live run first: its checkout may well be on its own branch. A child left running by a dead
  // runner still writes the ledgers: never start a second one.
  const held = holder(dir);
  if (held) {
    console.log(`held by ${held}`);
    return 3;
  }

  const cfg = readConfig(root);
  const base = baseBranch(root, cfg);
  const head = headBranch(root);
  if (run.kind === 'verify') {
    if (head !== run.id) return usage(`start verify: the checkout is on ${head}, not ${run.id}`);
  } else {
    const changed = changedPaths(root);
    if (head !== base.name || changed.error || changed.paths.length) {
      return usage(`start: the checkout must be clean and on ${base.name} (it is on ${head}${changed.paths?.length ? ', with uncommitted changes' : ''}${changed.error ? `; ${changed.error}` : ''})`);
    }
  }
  const lock = acquireLock(dir, process.pid);
  if (!lock.ok) {
    console.log(`held by ${lock.holder}`);
    return 3;
  }
  return runLocked({ root, dir, run, cfg, base, mode, modeFrom, allowBypass });
}

// Everything after the lock is taken. Whatever happens (an error, a signal), the run ends with a
// summary event, `stopped` set in state.json, and the lock released, last.
async function runLocked({ root, dir, run, cfg, base: baseInfo, mode, modeFrom, allowBypass }) {
  const slug = run.id.replaceAll('/', '-');
  let state = null;
  let code = 0;
  let ended = false;
  const finish = () => {
    if (ended) return;
    ended = true;
    if (state) {
      state.current = null;
      safe(() => emit(dir, slug, '-', 'summary', summaryText(state)));
      state.stopped = new Date().toISOString();
      safe(() => writeState(dir, state));
    } else safe(() => emit(dir, slug, '-', 'summary', 'no run state'));
    safe(() => releaseLock(dir));
  };
  const onSignal = (sig) => {
    killChildren('SIGTERM');
    if (state) {
      const why = `runner stopped (${sig})`;
      for (const i of state.items) {
        if (i.status === 'running') {
          Object.assign(i, { status: 'cut off', reason: why });
          safe(() => emit(dir, i.key, i.phase ?? '-', 'cutoff', why));
        } else if (i.status === 'queued') Object.assign(i, { status: 'not started', reason: why });
      }
    }
    finish();
    process.exit(128 + (constants.signals[sig] ?? 0));
  };
  const SIGNALS = ['SIGTERM', 'SIGINT', 'SIGHUP'];
  for (const sig of SIGNALS) process.on(sig, onSignal);

  try {
    state = readState(dir);
    const changes = [];
    if (!state) state = { kind: run.kind, id: run.id, items: run.items, current: null, stopped: null };
    else {
      // resume from files: what was cut short runs again; the ledgers say where
      // verify again on a branch verified before: a new run, from a fresh snapshot of its ledger
      if (state.kind === 'verify') {
        for (const i of state.items) if (i.status === 'done') Object.assign(i, { status: 'queued', reason: '', phase: null, from: run.items[0].from, answersUnused: undefined });
      }
      for (const i of state.items) {
        if (['running', 'cut off', 'not started', 'blocked'].includes(i.status)) Object.assign(i, { status: 'queued', reason: '' });
        if (i.status === 'waiting' && !phaseFromLedgers(root, i.key, ledgerOpts(root, state, i)).waiting) Object.assign(i, { status: 'queued', reason: '' });
      }
      // a queue started again with more keys or deps: they join the run
      if (state.kind === 'queue') {
        const added = [];
        const waits = [];
        for (const n of run.items) {
          const old = state.items.find((i) => i.key === n.key);
          if (!old) {
            state.items.push(n);
            added.push(n.key);
            if (n.deps.length) waits.push(`${n.key} waits for ${n.deps.join(', ')}`);
            continue;
          }
          const more = n.deps.filter((d) => !(old.deps ?? []).includes(d));
          if (more.length) {
            old.deps = [...(old.deps ?? []), ...more];
            waits.push(`${n.key} waits for ${more.join(', ')}`);
          }
        }
        if (added.length) changes.push(`added ${added.join(', ')}`);
        changes.push(...waits);
      }
    }
    state.root = root;
    state.current = null;
    state.stopped = null;
    const save = () => {
      syncAnswers(state, dir);
      writeState(dir, state);
    };
    save();
    if (changes.length) emit(dir, slug, '-', 'progress', `queue changed: ${changes.join('; ')}`);

    const refused = mode === 'bypassPermissions' && !allowBypass;
    if (refused) {
      mode = 'auto';
      modeFrom = 'bypass refused';
      console.error('runner: bypassPermissions refused: set SHIP_RUNNER_ALLOW_BYPASS=1');
      emit(dir, slug, '-', 'progress', 'bypassPermissions refused: set SHIP_RUNNER_ALLOW_BYPASS=1');
    }
    emit(dir, slug, '-', 'progress', `child permission mode: ${mode} (${modeFrom})`);
    if (run.kind !== 'verify') emit(dir, slug, '-', 'progress', `base branch: ${baseInfo.name} (${baseInfo.from})`);
    for (const w of cfg.warnings) emit(dir, slug, '-', 'progress', `config: ${w}`);
    const used = PHASES.map((p) => `${p} ${cfg.models[PHASE_ROWS[p]].model}/${cfg.models[PHASE_ROWS[p]].effort}`);
    emit(dir, slug, '-', 'progress', `models: ${used.join(', ')}`);

    const base = {
      root, dir, models: cfg.models, mode, env: {}, chunkSize: cfg.chunkSize, idleMs: cfg.idleMinutes * 60000,
      skill: run.skill, args: run.args, save,
    };
    const pollMs = Number(process.env.SHIP_RUNNER_POLL_MS) || 30000;
    let ran = false; // a queue item has run in this start
    for (;;) {
      syncAnswers(state, dir);
      const item = nextItem(state);
      save();
      if (item && ran && state.kind === 'queue' && !restoreCheckout(root, baseInfo.name, state, item, dir)) break;
      if (!item) {
        // a single issue waits for its answers instead of ending
        const only = state.items[0];
        if (state.kind !== 'queue' && only.status === 'waiting') {
          while (!existsSync(join(dir, answersName(only.key)))) await new Promise((r) => setTimeout(r, pollMs));
          continue;
        }
        break;
      }
      const ledgers = ledgerOpts(root, state, item);
      if (item.answersFile) {
        const waits = phaseFromLedgers(root, item.key, ledgers).waiting;
        if (existsSync(join(dir, answersName(item.key)))) {
          const used = consumeAnswers(dir, item.key);
          if (waits) item.answersFile = used;
          else {
            // nothing is waiting for them: never hand answers to a child that asked nothing
            Object.assign(item, { answersFile: null, answersUnused: used });
            emit(dir, item.key, item.phase ?? '-', 'progress', `answers not used, no question pending (${used})`);
          }
        } else if (!waits || !existsSync(join(dir, item.answersFile))) {
          // consumed by a run killed mid-child: its questions are answered already, or the file is gone
          if (waits) emit(dir, item.key, item.phase ?? '-', 'progress', `answers file ${item.answersFile} is gone; the questions wait again`);
          item.answersFile = null;
        }
        // else: consumed by a run killed mid-child and the ledgers still wait: resume with it again
      }
      state.current = item.key;
      ran = true;
      save();
      try {
        await runIssue({ ...base, ledgers }, item);
      } finally {
        state.current = null;
        save();
      }
      if (item.status === 'cut off') {
        for (const i of state.items) if (i.status === 'queued') Object.assign(i, { status: 'not started', reason: 'session limit' });
        break;
      }
      // ship-plan's close-out found the base branch red: the next item would fail on it too
      if (/^Base branch red\b/.test(ledgerOutcome(root, item.key, ledgers) ?? '')) {
        for (const i of state.items) if (i.status === 'queued') Object.assign(i, { status: 'not started', reason: 'base branch red' });
        emit(dir, item.key, item.phase ?? '-', 'blocked', 'base branch red; queue stopped');
        break;
      }
    }
  } catch (e) {
    code = 1;
    const why = `runner error: ${e.message}`;
    console.error(`runner: ${e.message}`);
    if (state) for (const i of state.items) if (i.status === 'running') Object.assign(i, { status: 'blocked', reason: why });
    safe(() => emit(dir, '-', '-', 'blocked', why));
  } finally {
    for (const sig of SIGNALS) process.off(sig, onSignal);
    finish();
  }
  return code;
}

// Before a queue item after the first: back to the base branch when the checkout is clean.
// Dirty (or git fails): this item and every queued one are not started, and false stops the queue.
// Never throws: a failure here stops the queue with its reason.
function restoreCheckout(root, baseName, state, item, dir) {
  let why;
  try {
    const changed = changedPaths(root);
    why = changed.error ?? (changed.paths.length ? changed.paths.slice(0, 5).join(', ') : '');
    if (!why) {
      try {
        git(root, 'switch', '-q', baseName);
        return true;
      } catch (e) {
        why = `git switch ${baseName} failed: ${e.message}`;
      }
    }
  } catch (e) {
    why = e.message;
  }
  item.status = 'queued';
  for (const i of state.items) if (i.status === 'queued') Object.assign(i, { status: 'not started', reason: 'checkout busy' });
  safe(() => emit(dir, item.key, '-', 'blocked', `checkout busy: ${why}; queue stopped`));
  return false;
}

function answer([dirArg, key, file]) {
  if (!dirArg || !key || !file) return usage('answer <run-dir> <KEY> <file>');
  const dir = resolve(dirArg);
  const state = readState(dir);
  if (!state) return usage(`answer: no run at ${dirArg}`);
  const item = state.items.find((i) => i.key === key);
  if (!item) return usage(`answer: ${key} is not in this run`);
  // The file alone is the record: the runner (now, or on the next start) puts the item back in
  // line from it. Writing state.json here could lose a write of a runner that holds the lock.
  const tmp = join(dir, `${answersName(key)}.${process.pid}.tmp`);
  writeFileSync(tmp, readFileSync(file));
  renameSync(tmp, join(dir, answersName(key)));
  emit(dir, key, item.phase ?? '-', 'progress', 'answers received');
  console.log(`answers stored: ${join(dir, answersName(key))}`);
  return 0;
}

function status([dirArg]) {
  if (!dirArg) return usage('status <run-dir>');
  const dir = resolve(dirArg);
  const state = readState(dir);
  if (!state) return usage(`status: no run at ${dirArg}`);
  const root = state.root ?? resolve(dir, '..', '..', '..'); // <root>/.superpowers/ship-runner/<run>/
  const rows = [['key', 'status', 'phase', 'reason', 'cost', 'minutes']];
  for (const i of state.items) {
    const reason = [
      i.reason,
      existsSync(join(dir, answersName(i.key))) ? 'answers received' : '',
      i.answersUnused ? `answers not used (${i.answersUnused})` : '',
    ].filter(Boolean).join('; ');
    rows.push([i.key, i.status, i.phase ?? '-', reason, `$${costOf(i).toFixed(2)}`, String(minutesOf(i))]);
  }
  const widths = rows[0].map((_, c) => Math.max(...rows.map((r) => r[c].length)));
  for (const r of rows) console.log(r.map((cell, c) => (c === r.length - 1 ? cell : cell.padEnd(widths[c]))).join('  '));
  const questions = state.items.flatMap((i) => pendingQuestions(root, i.key, ledgerOpts(root, state, i)).map((q) => `${i.key}: ${q}`));
  console.log(questions.length ? `\nPending questions:\n${questions.join('\n')}` : '\nNo pending questions.');
  return 0;
}

export async function main(argv) {
  const [cmd, ...rest] = argv;
  if (cmd === 'start') return start(rest);
  if (cmd === 'answer') return answer(rest);
  if (cmd === 'status') return status(rest);
  return usage('usage: runner.mjs start <issue|queue|plan|verify> … | answer <run-dir> <KEY> <file> | status <run-dir>');
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (e) {
    console.error(`runner: ${e.message}`);
    process.exitCode = 1;
  }
}
