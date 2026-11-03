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
//   node runner.mjs answer <run-dir> <KEY> <file>   stores the answers outside the checkout, in
//                                              <git dir>/ship-runner/<run>/ (never told to children)
//   node runner.mjs status <run-dir>
// Exit: 0 done, 1 runner error, 2 usage error, 3 the run dir's lock is held; 128+n on signal n.
import { constants } from 'node:os';
import { appendFileSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { acquireLock, alive, clean, emit, groupAlive, makeDir, plainFile, readLock, readState, releaseLock, runDir, runGit, setChildPid, writeState } from './runner-lib.mjs';
import { findPlanLedger, ledgerOutcome, pendingQuestions, PHASE_ROWS, PHASES, phaseFromLedgers, runIssue } from './runner-phases.mjs';
import { endChildren, haltChildren } from './runner-child.mjs';
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
// How much a child may do in each mode, narrowest first: a rerun never takes a wider one (X5).
const WIDTH = { dontAsk: 0, acceptEdits: 1, auto: 2, bypassPermissions: 3 };

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

// git's output (runGit: no fsmonitor, no hooks, no bypass variable); on failure an Error whose
// message is git's own stderr.
function git(root, ...args) {
  try {
    return runGit(root, args).trim();
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
    out = runGit(root, ['status', '--porcelain']);
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

// An issue key (`PROJ-12`, `#12`, `owner-repo-12`): it names files, so nothing else.
const KEY = /^#?[A-Za-z0-9][A-Za-z0-9._-]*$/;
// A queue parent or a verify branch: it names the run dir, which the watching session puts in
// shell commands.
const RUN_ID = /^[A-Za-z0-9._/#-]+$/;

// The checkout's own git dir (per worktree), and the dir its info/exclude lives in.
const gitDir = (root) => git(root, 'rev-parse', '--absolute-git-dir');
const gitCommonDir = (root) => resolve(root, git(root, 'rev-parse', '--git-common-dir'));

// Where `answer` stores a run's answers: <git dir>/ship-runner/<run>/, outside the checkout. A
// child is told the run dir (SHIP_RUNNER), never this one, so it has no path to answer its own
// questions by; the runner reads answers only here.
const answersStore = (root, dir) => join(gitDir(root), 'ship-runner', basename(dir));

const answersName = (key) => `answers-${key}.md`;

// The run's first permission mode, kept in state.json and beside the answers store,
// <git dir>/ship-runner/<run>.mode (a child can edit state.json; the git dir is never named to it).
const modeFile = (root, dir) => `${answersStore(root, dir)}.mode`;
// The narrower of the two copies; null for a run with neither.
function firstMode(root, dir, state) {
  let stored = null;
  try {
    stored = readFileSync(modeFile(root, dir), 'utf8').trim();
  } catch {
    // none yet, or no git dir
  }
  let first = null;
  for (const m of [state?.mode, stored]) if (Object.hasOwn(WIDTH, m ?? '') && (first === null || WIDTH[m] < WIDTH[first])) first = m;
  return first;
}

// A file written while a child of this item ran (its recorded windows, [start, end] in ms; an
// open one runs to now) was not written by the user: the child that asked answered itself.
// A child runs as the same user, so the file's times are all there is to go by: both mtime and
// ctime must fall outside every window (utimes can backdate mtime, never ctime). A mitigation,
// not a full defence (see runner-session.md).
const inChildWindow = (item, ms) => (item.windows ?? []).some(([from, to]) => ms >= from && ms <= (to ?? Infinity));
const writtenInWindow = (item, st) => inChildWindow(item, st.mtimeMs) || inChildWindow(item, st.ctimeMs);

// Whether the store's answers file `name` of this item is usable: 'ok', 'missing', or 'rejected'
// (moved aside as answers-<KEY>@rejected-<n>.md, with an event, never used): a link rather than a
// plain file (plainFile; lstat, so a symlink's target is never judged), or written inside a child
// window of the item. Checked for a fresh file and again for a consumed one before each reuse.
function checkAnswers(store, dir, item, name) {
  const file = join(store, name);
  let st;
  try {
    st = lstatSync(file);
  } catch (e) {
    if (e.code === 'ENOENT') return 'missing';
    throw e;
  }
  let why = null;
  if (!plainFile(st)) why = `${name} is a link, not a plain file`;
  else if (writtenInWindow(item, st)) why = `${name} was written while a child of ${item.key} ran`;
  if (!why) return 'ok';
  const kept = unusedName(store, `answers-${item.key}@rejected-`);
  renameSync(file, join(store, kept));
  emit(dir, item.key, item.phase ?? '-', 'progress', `answers rejected: ${why} (kept as ${kept}); answer again`);
  return 'rejected';
}

// Whether the item's answers file (answers-<KEY>.md) is in the store and usable (checkAnswers).
const answersReady = (store, dir, item) => checkAnswers(store, dir, item, answersName(item.key)) === 'ok';

// An answers file not yet consumed puts a waiting item back in line (the `answer` command may race
// the runner's own state writes; the file is the record), and marks a queued one answered. The
// running item, and one that ended any other way (cut off, blocked, done), are left alone: a rerun
// re-queues those, and the file is still there for it.
function syncAnswers(state, dir, store) {
  for (const i of state.items) {
    if (i.key === state.current || !['waiting', 'queued'].includes(i.status) || !answersReady(store, dir, i)) continue;
    if (i.status === 'waiting') Object.assign(i, { status: 'queued', reason: '', answersFile: answersName(i.key) });
    else i.answersFile = answersName(i.key);
  }
}

// <prefix><n>.md with the first unused n, starting at 1.
function unusedName(store, prefix) {
  let n = 1;
  const taken = (f) => {
    try {
      lstatSync(f); // a dangling symlink is taken too
      return true;
    } catch (e) {
      if (e.code === 'ENOENT') return false;
      throw e;
    }
  };
  while (taken(join(store, `${prefix}${n}.md`))) n++;
  return `${prefix}${n}.md`;
}

// Rename answers-<KEY>.md to answers-<KEY>@<n>.md (`@` never occurs in a key), so it is used once.
function consumeAnswers(store, key) {
  const name = unusedName(store, `answers-${key}@`);
  renameSync(join(store, answersName(key)), join(store, name));
  return name;
}

// `.superpowers/` (ledgers, run dirs and child transcripts) in the repo's info/exclude, so a
// `git add -A` never commits them. True when it was added now.
function excludeRunFiles(root) {
  const file = join(gitCommonDir(root), 'info', 'exclude');
  let text = '';
  try {
    text = readFileSync(file, 'utf8');
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  if (text.split(/\r?\n/).some((l) => /^\/?\.superpowers\/?$/.test(l.trim()))) return false;
  mkdirSync(join(file, '..'), { recursive: true });
  appendFileSync(file, `${text && !text.endsWith('\n') ? '\n' : ''}.superpowers/\n`);
  return true;
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

// A file or branch name as an item key `answer` takes (KEY): every character a key cannot hold
// becomes '-', and what precedes the first letter or digit is dropped (else: fallback).
const asKey = (name, fallback) => name.replace(/[^A-Za-z0-9._-]/g, '-').replace(/^[^A-Za-z0-9]+/, '') || fallback;

// Parse `start …` arguments: { kind, id, items, skill, args } or an error string. Issue and queue
// keys must be issue keys (KEY), exit 2 otherwise.
function parseStart(root, [what, ...a]) {
  if (!a[0]) return `start ${what ?? ''}: missing argument`;
  const notKey = (k) => `start ${what}: "${k}" is not an issue key (letters, digits, . _ -, an optional leading #)`;
  const extra = (from) => (a.length > from ? `start ${what}: unexpected argument "${a[from]}"` : null);
  if (what === 'issue') {
    if (!KEY.test(a[0])) return notKey(a[0]);
    if (extra(1)) return extra(1);
    return { kind: 'issue', id: a[0], items: [newItem(a[0])], skill: 'ship-issue' };
  }
  const notId = (id) => `start ${what}: "${id}" holds a character other than letters, digits, . _ / # -`;
  if (what === 'queue') {
    if (!RUN_ID.test(a[0])) return notId(a[0]);
    const keys = (a[1] ?? '').split(',').map((k) => k.trim()).filter(Boolean);
    if (!keys.length) return 'start queue: no sub-issue keys';
    const bad = keys.find((k) => !KEY.test(k));
    if (bad) return notKey(bad);
    const twice = keys.find((k, n) => keys.indexOf(k) !== n);
    if (twice) return `start queue: ${twice} is in the list twice`;
    // after the keys only `--deps <KEY>:<DEP>,…`, with a value
    if (a.length > 2 && a[2] !== '--deps') return extra(2);
    if (a[2] === '--deps' && !a[3]) return 'start queue: --deps needs <KEY>:<DEP>,…';
    if (extra(4)) return extra(4);
    const deps = Object.fromEntries(keys.map((k) => [k, []]));
    for (const pair of (a[3] ?? '').split(',').filter(Boolean)) {
      const [k, d] = pair.split(':').map((x) => x.trim());
      if (!Object.hasOwn(deps, k) || !Object.hasOwn(deps, d)) return `start queue: --deps ${pair}: both keys must be in the queue`;
      if (k === d) return `start queue: --deps ${pair}: a key cannot wait for itself`;
      if (!deps[k].includes(d)) deps[k].push(d);
    }
    return { kind: 'queue', id: a[0], items: keys.map((k) => newItem(k, deps[k])), skill: 'ship-issue' };
  }
  if (what === 'plan') {
    if (extra(1)) return extra(1);
    // the path goes into the child's prompt in double quotes, and the run dir into the watching
    // session's commands in single quotes
    if (/["'\x00-\x1f\x7f]/.test(a[0])) return 'start plan: the path holds a quote or a control character';
    if (!existsSync(resolve(root, a[0]))) return `start plan: no plan at ${a[0]}`;
    return { kind: 'plan', id: a[0], items: [newItem(asKey(basename(a[0]).replace(/\.md$/, ''), 'plan'))], skill: 'ship-plan', args: a[0] };
  }
  if (what === 'verify') {
    if (!RUN_ID.test(a[0])) return notId(a[0]);
    // verify-and-fix's own arguments (base branch, --comments) follow `--`; the branch verified is
    // the checked-out one
    const extra = a[1] === '--' ? a.slice(2) : a.length > 1 ? null : [];
    if (!extra) return `start verify: after <branch> only -- <verify-and-fix arguments>`;
    if (extra.some((x) => /["\x00-\x1f\x7f]/.test(x))) return 'start verify: an argument after -- holds a quote or a control character';
    const item = newItem(asKey(a[0], 'verify'));
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

// The pid holding the run dir: its runner, alive; or, the runner dead, its child or anything left
// in the child's process group still alive (it may still write the ledgers). Null when nothing
// holds it.
function holder(dir) {
  const prev = readLock(dir);
  const live = (pid) => Number.isInteger(pid) && pid > 0 && alive(pid);
  if (prev && live(prev.runner)) return prev.runner;
  if (prev && (live(prev.child) || (Number.isInteger(prev.child) && prev.child > 0 && groupAlive(prev.child)))) return prev.child;
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
  let dir;
  try {
    dir = runDir(root, run.kind, run.id);
  } catch (e) {
    return usage(`start ${run.kind}: ${e.message}`);
  }

  // A live run first: its checkout may well be on its own branch. A child left running by a dead
  // runner still writes the ledgers: never start a second one.
  const held = holder(dir);
  if (held) {
    console.log(`held by ${held}`);
    return 3;
  }

  // the run dir names one run: two ids can share it (a/b and a-b)
  let prev = null;
  try {
    prev = readState(dir);
  } catch {
    // unreadable: the locked run reports it (a runner error, with its event)
  }
  if (prev && (prev.kind !== run.kind || prev.id !== run.id)) return usage(`start ${run.kind}: ${dir} holds the run ${prev.kind} ${prev.id}`);
  // a rerun keeps the first start's mode: none given takes it, a wider one is refused
  const first = prev ? firstMode(root, dir, prev) : null;
  if (first && modeFrom === 'default') {
    mode = first;
    modeFrom = 'state.json';
  } else if (first && WIDTH[mode] > WIDTH[first]) {
    return usage(`start: --permission-mode ${mode} is wider than this run's ${first} (its first start's); a rerun never widens it`);
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

// Everything after the lock is taken. Whatever happens (an error, a signal, an uncaught error), the
// run ends with a summary event and `stopped` set in state.json; the lock is released last, and
// kept when state.json could not be written or a child's process group outlived the stop.
async function runLocked({ root, dir, run, cfg, base: baseInfo, mode, modeFrom, allowBypass }) {
  const slug = run.id.replaceAll('/', '-');
  let state = null;
  let code = 0;
  let ended = false;
  // the item whose runIssue call is under way (a runner error marks it blocked, whatever its status)
  let current = null;
  // A signal or an uncaught error is ending the run (stop): children are halted, and the main path
  // parks at its next await, so it never writes over the end.
  let stopping = false;
  const parked = () => new Promise(() => {});
  // keep: the pid of a child's process group still alive: the lock stays, naming it, so no rerun
  // starts a second child beside it. A state.json that cannot be written still says the run is
  // going (stopped: null): the lock stays too, naming this runner, which is soon dead, so the next
  // start and the agent-dispatch hook see that it is not.
  const finish = (keep = null) => {
    if (ended) return;
    ended = true;
    let written = !state;
    if (state) {
      state.current = null;
      safe(() => emit(dir, slug, '-', 'summary', summaryText(state)));
      state.stopped = new Date().toISOString();
      safe(() => {
        writeState(dir, state);
        written = true;
      });
    } else safe(() => emit(dir, slug, '-', 'summary', 'no run state'));
    if (keep) {
      safe(() => setChildPid(dir, keep));
      console.error(`runner: child process group ${keep} is still alive; lock kept`);
    } else if (!written) console.error('runner: state.json not written; lock kept');
    else safe(() => releaseLock(dir));
  };
  // A runner error: the item under way blocked, every queued one not started, with the reason.
  const markError = (why) => {
    for (const i of state?.items ?? []) {
      if (i === current ? !['done', 'waiting', 'blocked', 'cut off'].includes(i.status) : i.status === 'running') Object.assign(i, { status: 'blocked', reason: why });
      else if (i.status === 'queued') Object.assign(i, { status: 'not started', reason: why });
    }
  };
  // Stop now: halt the children, mark the items, end every child's process group (SIGTERM, SIGKILL
  // after 1 s, then up to 3 s for it to be gone), write the end, exit.
  const stop = async (exitCode, mark) => {
    if (stopping) return;
    stopping = true;
    haltChildren();
    let left = [];
    try {
      safe(mark);
      left = await endChildren();
      if (left.length) safe(() => emit(dir, slug, '-', 'progress', `child process group ${left.join(', ')} still alive after SIGKILL; lock kept`));
    } finally {
      finish(left[0] ?? null);
      process.exit(exitCode);
    }
  };
  const onSignal = (sig) => stop(128 + (constants.signals[sig] ?? 0), () => {
    const why = `runner stopped (${sig})`;
    for (const i of state?.items ?? []) {
      if (i.status === 'running') {
        Object.assign(i, { status: 'cut off', reason: why });
        safe(() => emit(dir, i.key, i.phase ?? '-', 'cutoff', why));
      } else if (i.status === 'queued') Object.assign(i, { status: 'not started', reason: why });
    }
  });
  // an error thrown outside the awaited chain (an event handler, a timer): a runner error
  const onCrash = (e) => {
    const msg = e?.message ?? String(e);
    console.error(`runner: ${msg}`);
    stop(1, () => {
      markError(`runner error: ${msg}`);
      safe(() => emit(dir, '-', '-', 'blocked', `runner error: ${msg}`));
    });
  };
  const SIGNALS = ['SIGTERM', 'SIGINT', 'SIGHUP'];
  for (const sig of SIGNALS) process.on(sig, onSignal);
  process.on('uncaughtException', onCrash);
  process.on('unhandledRejection', onCrash);

  const refused = mode === 'bypassPermissions' && !allowBypass;
  if (refused) {
    mode = 'auto';
    modeFrom = 'bypass refused';
  }
  try {
    state = readState(dir);
    const changes = [];
    if (!state) state = { kind: run.kind, id: run.id, items: run.items, current: null, stopped: null };
    else {
      // resume from files: what was cut short runs again; the ledgers say where
      // verify again on a branch verified before: a new run, from a fresh snapshot of its ledger
      // so does one that ended any other way (blocked, cut off, …): an earlier closing Done: must
      // not end it again with no child. Not a waiting one, nor one holding answers: their questions
      // are in the lines after the old snapshot.
      if (state.kind === 'verify') {
        for (const i of state.items) {
          if (i.status === 'done') Object.assign(i, { status: 'queued', reason: '', phase: null, answersUnused: undefined });
          if (i.status !== 'waiting' && !i.answersFile) i.from = run.items[0].from;
        }
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
    // A child window left open by a runner that was stopped (a signal, a kill): what that child
    // started may have outlived it, so the window runs until now, and an answers file written
    // since for that item is rejected too.
    // origin's URL as the run starts: the guard fetches <base> from it before each child (a child
    // may change the remote's config later)
    let originUrl = null;
    try {
      originUrl = git(root, 'remote', 'get-url', 'origin');
    } catch {
      // no origin: a guarded change is never taken as upstream's
    }
    const startedAt = Date.now();
    for (const i of state.items) for (const w of i.windows ?? []) w[1] ??= startedAt;
    state.root = root;
    state.current = null;
    state.stopped = null;
    const store = answersStore(root, dir);
    // the first start's mode (X5), in state.json and in the store
    if (!Object.hasOwn(WIDTH, state.mode ?? '')) state.mode = mode;
    const kept = modeFile(root, dir);
    if (!existsSync(kept)) {
      makeDir(store);
      writeFileSync(kept, `${state.mode}\n`);
    }
    const save = () => {
      syncAnswers(state, dir, store);
      writeState(dir, state);
    };
    save();
    if (changes.length) emit(dir, slug, '-', 'progress', `queue changed: ${changes.join('; ')}`);
    if (excludeRunFiles(root)) emit(dir, slug, '-', 'progress', '.superpowers/ added to the git info/exclude');

    if (refused) {
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
      skill: run.skill, args: run.args, save, answersDir: store, upstream: { url: originUrl, base: baseInfo.name },
    };
    const pollMs = Number(process.env.SHIP_RUNNER_POLL_MS) || 30000;
    let ran = false; // a queue item has run in this start
    for (;;) {
      syncAnswers(state, dir, store);
      const item = nextItem(state);
      save();
      if (item && ran && state.kind === 'queue' && !restoreCheckout(root, baseInfo.name, state, item, dir)) break;
      if (!item) {
        // a single issue waits for its answers instead of ending
        const only = state.items[0];
        if (state.kind !== 'queue' && only.status === 'waiting') {
          while (!answersReady(store, dir, only)) {
            await new Promise((r) => setTimeout(r, pollMs));
            if (stopping) await parked();
          }
          continue;
        }
        break;
      }
      const ledgers = ledgerOpts(root, state, item);
      if (item.answersFile) {
        const waits = phaseFromLedgers(root, item.key, ledgers).waiting;
        if (answersReady(store, dir, item)) {
          const used = consumeAnswers(store, item.key);
          if (waits) item.answersFile = used;
          else {
            // nothing is waiting for them: never hand answers to a child that asked nothing
            Object.assign(item, { answersFile: null, answersUnused: used });
            emit(dir, item.key, item.phase ?? '-', 'progress', `answers not used, no question pending (${used})`);
          }
        } else if (!waits) item.answersFile = null; // consumed by a run killed mid-child: its questions are answered already
        else {
          // consumed by a run killed mid-child and the ledgers still wait: resume with it again, if it
          // is still the user's (that child may have written over it in its window)
          const seen = checkAnswers(store, dir, item, item.answersFile);
          if (seen === 'missing') emit(dir, item.key, item.phase ?? '-', 'progress', `answers file ${item.answersFile} is gone; the questions wait again`);
          if (seen !== 'ok') item.answersFile = null;
        }
      }
      state.current = item.key;
      ran = true;
      // the window an answers file of this item must not be written in; from the next millisecond:
      // the answers consumed just now (the rename sets their ctime, sub-millisecond) are before it
      const window = [Date.now() + 1, null];
      (item.windows ??= []).push(window);
      save();
      // closed once the item's outcome is known, before its event (runIssue's end): an `answer`
      // right after a `waiting` event finds no open window
      const ctx = { ...base, ledgers, beforeEnd: () => { window[1] ??= Date.now(); } };
      current = item;
      try {
        await runIssue(ctx, item);
        current = null;
      } finally {
        window[1] ??= Date.now();
        state.current = null;
        save();
      }
      // a failure every later child would hit too (no claude, auth, a bad model), or a child that
      // changed what the next child loads: nothing more starts
      if (ctx.stop) {
        const why = `runner stopped: ${ctx.stop}`.slice(0, 300);
        for (const i of state.items) if (i.status === 'queued') Object.assign(i, { status: 'not started', reason: why });
        break;
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
    if (stopping) await parked();
    code = 1;
    const why = `runner error: ${e.message}`;
    console.error(`runner: ${e.message}`);
    markError(why);
    safe(() => emit(dir, '-', '-', 'blocked', why));
  } finally {
    if (stopping) await parked();
    for (const sig of SIGNALS) process.off(sig, onSignal);
    process.off('uncaughtException', onCrash);
    process.off('unhandledRejection', onCrash);
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

// The checkout a run dir belongs to: <root>/.superpowers/ship-runner/<run>/, from where the run dir
// is, never from state.json (a child can edit it).
const rootOf = (dir) => resolve(dir, '..', '..', '..');

function answer([dirArg, key, file]) {
  if (!dirArg || !key || !file) return usage('answer <run-dir> <KEY> <file>');
  // only the watching session answers; a child answering its own questions is the thing to stop
  if (process.env.SHIP_RUNNER) return usage('answer: refused in a runner child (SHIP_RUNNER is set)');
  if (!KEY.test(key)) return usage(`answer: "${key}" is not an issue key`);
  const dir = resolve(dirArg);
  const state = readState(dir);
  if (!state) return usage(`answer: no run at ${dirArg}`);
  const item = state.items.find((i) => i.key === key);
  if (!item) return usage(`answer: ${key} is not in this run`);
  // an answers file written inside an open child window would only be set aside later
  if ((item.windows ?? []).some(([, to]) => to == null)) {
    return usage(`answer: a child of ${key} is running, or the run was stopped while one ran; answer once ${key} waits again (after the rerun, if the runner has exited)`);
  }
  // The file alone is the record: the runner (now, or on the next start) puts the item back in
  // line from it. Writing state.json here could lose a write of a runner that holds the lock.
  const store = answersStore(rootOf(dir), dir);
  makeDir(store);
  const tmp = join(store, `${answersName(key)}.${process.pid}.tmp`);
  writeFileSync(tmp, readFileSync(file));
  renameSync(tmp, join(store, answersName(key)));
  emit(dir, key, item.phase ?? '-', 'progress', 'answers received');
  console.log(`answers stored: ${join(store, answersName(key))}`);
  return 0;
}

function status([dirArg]) {
  if (!dirArg) return usage('status <run-dir>');
  const dir = resolve(dirArg);
  const state = readState(dir);
  if (!state) return usage(`status: no run at ${dirArg}`);
  const root = rootOf(dir);
  let store = null;
  try {
    store = answersStore(root, dir);
  } catch {
    // not a git checkout any more: no answers to show
  }
  const received = (i) => {
    if (!store) return false;
    try {
      const st = lstatSync(join(store, answersName(i.key)));
      return plainFile(st) && !writtenInWindow(i, st);
    } catch {
      return false;
    }
  };
  // every cell and line below may hold text a child wrote: one line each, no control characters
  const rows = [['key', 'status', 'phase', 'reason', 'cost', 'minutes']];
  for (const i of state.items) {
    const reason = [
      i.reason,
      received(i) ? 'answers received' : '',
      i.answersUnused ? `answers not used (${i.answersUnused})` : '',
    ].filter(Boolean).join('; ');
    rows.push([i.key, i.status, i.phase ?? '-', reason, `$${costOf(i).toFixed(2)}`, String(minutesOf(i))].map(clean));
  }
  const widths = rows[0].map((_, c) => Math.max(...rows.map((r) => r[c].length)));
  for (const r of rows) console.log(r.map((cell, c) => (c === r.length - 1 ? cell : cell.padEnd(widths[c]))).join('  '));
  const questions = state.items.flatMap((i) => pendingQuestions(root, i.key, ledgerOpts(root, state, i)).map((q) => clean(`${i.key}: ${q}`)));
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
