// Phases of one issue for the ship runner: which phase runs next, read from the ledgers,
// and the loop that runs one child per phase (per chunk of plan tasks for implement).
// The ledgers win over a child's RUNNER: marker.
import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync, readlinkSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, parse, posix, relative, resolve, sep } from 'node:path';
import { emit, readAnswers, runGit } from './runner-lib.mjs';
import { isEnvError, isLimitError, resumeOrFresh, runChild } from './runner-child.mjs';

export const PHASES = ['spec', 'plan', 'implement', 'verify', 'merge', 'close'];

// `## Models` row for each phase's child.
export const PHASE_ROWS = {
  spec: 'Spec stage',
  plan: 'Plan stage',
  implement: 'Phase: implement',
  verify: 'Phase: verify',
  merge: 'Phase: merge',
  close: 'Phase: close',
};

function readLines(file) {
  try {
    return readFileSync(file, 'utf8').replace(/\r?\n$/, '').split(/\r?\n/);
  } catch (e) {
    if (e.code === 'ENOENT' || e.code === 'ENOTDIR') return null;
    throw e;
  }
}

// `Phase: I2 | Issue: X | Plan: p` -> { Phase: 'I2', Issue: 'X', Plan: 'p' }
function firstLineFields(line) {
  const fields = {};
  for (const part of String(line ?? '').split(' | ')) {
    const m = part.match(/^([^:]+):\s*(.*)$/);
    if (m) fields[m[1].trim()] = m[2].trim();
  }
  return fields;
}

const atRoot = (root, p) => (isAbsolute(p) ? p : join(root, p));

function issueLedgerPath(root, key) {
  return join(root, '.superpowers', 'ship-issue', key.replace(/^#/, ''), 'ledger.md');
}

function planLedgerPath(root, issueLines) {
  const p = issueLines ? firstLineFields(issueLines[0])['ship-plan ledger'] : '';
  return p ? atRoot(root, p) : null;
}

function planPhase(value) {
  if (value === 'done') return 'finished';
  if (/^(0|1|2|2b)$/.test(value)) return 'implement';
  if (/^(3|4)$/.test(value)) return 'verify';
  if (/^4R/.test(value) || /^(5|5 awaiting merge|6|6b)$/.test(value)) return 'merge';
  if (/^(7|8)$/.test(value)) return 'close';
  return null;
}

const PENDING = /^Asked: .* — pending\s*$/;
const BLOCKED = /^Blocked: (.+)$/;

/**
 * Ledger options for a run that has no ship-issue ledger (`start plan`, `start verify`).
 * @typedef {object} LedgerOpts
 * @property {string|(() => string|null)} [ledger] read this ledger directly (relative to root or
 *   absolute; a function is called on every read, for a ledger a child creates); the ship-issue
 *   ledger is not read. Missing: the run starts at `only`, else at `implement`.
 * @property {string} [only] run this phase alone: a ledger before it reads as it, past it as finished.
 * @property {number} [from] lines of that ledger written before the run (a snapshot): only later
 *   lines count for Done:, Asked: and Blocked:.
 * @property {string} [planDoc] the plan, until a ledger names one.
 */

// The ledger files read for this run: { issueFile, planFile } (either may be null).
function ledgerFiles(root, key, opts = {}) {
  if (opts.ledger !== undefined) {
    const p = typeof opts.ledger === 'function' ? opts.ledger() : opts.ledger;
    return { issueFile: null, planFile: p ? atRoot(root, p) : null };
  }
  const issueFile = issueLedgerPath(root, key);
  return { issueFile, planFile: planLedgerPath(root, readLines(issueFile)) };
}

// Everything the runner reads from both ledgers.
function readLedgers(root, key, opts = {}) {
  const direct = opts.ledger !== undefined;
  const { issueFile, planFile } = ledgerFiles(root, key, opts);
  const issue = issueFile ? readLines(issueFile) : null;
  const plan = planFile ? readLines(planFile) : null;
  const issueFields = issue ? firstLineFields(issue[0]) : {};
  const planFields = plan ? firstLineFields(plan[0]) : {};
  const hasPhaseLine = Boolean(plan && /^Phase:/.test(plan[0]));
  const planBody = plan ? (direct ? plan.slice(opts.from ?? 0) : plan) : null;

  let phase = 'spec';
  let unknown = null;
  if (plan && (hasPhaseLine || !direct)) {
    phase = planPhase(planFields.Phase);
    if (!phase) unknown = `unknown ship-plan phase "${planFields.Phase}"`;
  } else if (direct) {
    // no ledger yet, or a verify-and-fix ledger (no Phase: line; it ends with a Done: line)
    phase = planBody?.some((l) => /^Done: /.test(l)) ? 'finished' : opts.only ?? 'implement';
  } else if (issue) {
    const n = /^I(\d+)\b/.exec(issueFields.Phase ?? '');
    if (!n) unknown = `unknown ship-issue phase "${issueFields.Phase}"`;
    else phase = Number(n[1]) <= 3 ? 'spec' : Number(n[1]) <= 5 ? 'plan' : 'implement';
  }
  if (opts.only && !unknown && phase !== 'finished') {
    const at = PHASES.indexOf(phase);
    const only = PHASES.indexOf(opts.only);
    if (at > only) phase = 'finished';
    else if (at < only) phase = opts.only;
  }

  const all = [...(issue ?? []), ...(planBody ?? [])];
  const lastIssueLine = (issue ?? []).filter((l) => l.trim()).at(-1) ?? '';
  const batch = /^Waiting: batch of (\d+)/.exec(lastIssueLine);
  const pendingLines = all.filter((l) => PENDING.test(l));
  const pending = pendingLines.length;
  const blockedLines = all.map((l) => BLOCKED.exec(l)).filter(Boolean);
  const doneTasks = new Set(); // handled: done, or parked (its question waits in the batch)
  for (const l of planBody ?? []) {
    const m = /^Progress: task (\d+) (?:done|parked)\b/.exec(l);
    if (m) doneTasks.add(Number(m[1]));
  }
  const planDoc = planFields.Plan || issueFields.Plan || opts.planDoc;
  // ship-plan writes its one Outcome: line under the first line and replaces it when the close-out
  // runs again: the first one is the newest (a second one, left by an older close-out, sits below it)
  const outcome = (planBody ?? []).map((l) => /^Outcome: (.+)$/.exec(l)?.[1]).find(Boolean) ?? null;
  // the phase that writes a finished ledger's last lines: verify-and-fix's (no Phase: line), the
  // only phase run, else ship-plan's close-out
  const finishedBy = direct && !hasPhaseLine ? opts.only ?? 'verify' : opts.only ?? 'close';
  return {
    outcome,
    finishedBy,
    branch: planFields.Branch || issueFields.Branch || null,
    phase: unknown ? 'unknown' : phase,
    unknown,
    waiting: Boolean(batch) || pending > 0,
    questions: pending || (batch ? Number(batch[1]) : 0),
    pendingLines,
    blocked: unknown ?? blockedLines.at(-1)?.[1] ?? null,
    blockedCount: blockedLines.length,
    doneTasks,
    planDoc: planDoc ? atRoot(root, planDoc) : null,
    // a ledger without a Phase: line advances only by growing
    signature: JSON.stringify([issue?.[0] ?? null, plan?.[0] ?? null, [...doneTasks].sort((a, b) => a - b),
      direct && !hasPhaseLine ? plan?.length ?? 0 : null]),
  };
}

// The ship-plan ledger whose first line's Plan: field names planPath: an open one first, else a
// done one, else null.
export function findPlanLedger(root, planPath) {
  const base = join(root, '.superpowers', 'ship-plan');
  let names;
  try {
    names = readdirSync(base).sort();
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
  const want = resolve(root, planPath);
  let done = null;
  for (const name of names) {
    const file = join(base, name, 'ledger.md');
    const first = readLines(file)?.[0];
    if (!first) continue;
    const f = firstLineFields(first);
    if (!f.Plan || resolve(root, f.Plan) !== want) continue;
    if (f.Phase !== 'done') return file;
    done ??= file;
  }
  return done;
}

// The ship-plan ledger's `Outcome:` (written at close-out, under the first line), or null.
export function ledgerOutcome(root, key, opts = {}) {
  return readLedgers(root, key, opts).outcome;
}

// Every `Asked: … — pending` line of the run's ledgers.
export function pendingQuestions(root, key, opts = {}) {
  return readLedgers(root, key, opts).pendingLines;
}

/**
 * Where the issue stands, from its ledgers.
 * `.blocked` is the last `Blocked:` line ever written to either ledger (or an unknown-phase
 * reason); it may be left over from an earlier attempt, so callers that want "blocked by this
 * run" must compare against a snapshot taken before the run, as runIssue does.
 * opts: LedgerOpts, for a run without a ship-issue ledger.
 */
export function phaseFromLedgers(root, key, opts = {}) {
  const { phase, waiting, blocked } = readLedgers(root, key, opts);
  return { phase, waiting, blocked };
}

// chunk: { from, to } for a task range, { whole: true } for a plan without task headings.
const rangeText = (chunk) => (!chunk ? '' : chunk.whole ? ', the whole plan' : `, plan tasks ${chunk.from}–${chunk.to}`);

export function phasePrompt({ skill, args, phase, chunk, answers }) {
  const range = chunk?.whole ? `${rangeText(chunk)} (it has no ### Task headings)` : rangeText(chunk);
  let prompt = `Invoke the ai-skills:${skill} skill with the Skill tool, with the arguments "${args}". ` +
    `You are a ship-runner child: nobody is watching; follow the skill's Runner mode for phase ${phase}${range}.`;
  if (answers) prompt += `\n\nThe user's answers, copied exactly:\n${answers}`;
  return prompt;
}

// The plan's `### Task <n>` headings in groups of `size`, as task-number ranges.
export function implementChunks(planPath, size = 5) {
  return taskGroups(readFileSync(planPath, 'utf8'), size).map((group) => ({ from: group[0], to: group.at(-1) }));
}

// The plan's task numbers (heading number, or ordinal when a heading has none) in groups of size.
function taskGroups(planText, size) {
  const numbers = [];
  for (const m of planText.matchAll(/^### Task (\d+)?/gm)) {
    numbers.push(m[1] === undefined ? numbers.length + 1 : Number(m[1]));
  }
  const groups = [];
  for (let i = 0; i < numbers.length; i += size) groups.push(numbers.slice(i, i + size));
  return groups;
}

// The plan's text: from the checkout, else (a plan committed only on the run's branch, while the
// checkout is on the base branch) from the ledgers' Branch: or its origin copy. { missing } when
// neither has it: a plan that cannot be read is never "every task done".
function planText(root, ledgers) {
  if (!ledgers.planDoc) return { missing: 'the ledgers name no plan' };
  try {
    return { text: readFileSync(ledgers.planDoc, 'utf8') };
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  const rel = relative(root, ledgers.planDoc).split(sep).join('/');
  const b = ledgers.branch;
  let said = '';
  for (const ref of b && !b.startsWith('-') ? [b, `origin/${b}`] : []) {
    try {
      return { text: runGit(root, ['show', `${ref}:${rel}`]) };
    } catch (e) {
      // not on this ref: try the next; git's words on the run's own branch go in the reason
      said ||= String(e.stderr ?? '').trim().replace(/\s*\n\s*/g, ' ') || e.message;
    }
  }
  return { missing: `plan ${rel} not found in the checkout${b ? ` or on ${b}` : ', and the ledgers name no branch'}${said ? ` (git: ${said})` : ''}` };
}

// The first chunk with a task the ship-plan ledger has no `Progress: task <n> done|parked` line
// for; { whole: true } when the plan has no `### Task` headings (one child does all of it); null
// when every chunk is done (the child finishes the phase's other work); { missing } when the plan
// cannot be read.
function nextChunk(root, ledgers, size) {
  const plan = planText(root, ledgers);
  if (plan.missing) return plan;
  const groups = taskGroups(plan.text, size);
  if (!groups.length) return { whole: true };
  // the chunk's own task numbers, so a gap (tasks 1, 2, 5) never looks undone
  const group = groups.find((g) => g.some((n) => !ledgers.doneTasks.has(n)));
  return group ? { from: group[0], to: group.at(-1) } : null;
}

// Poll both ledgers every intervalMs; call onLine for new `Progress:` lines and for
// first-line `Phase:` changes. Returns stop(), which reads once more before stopping.
// A read that fails is retried on the next tick; onError gets the first failure, once.
export function tailProgress(root, key, onLine, intervalMs = 5000, opts = {}, onError = () => {}) {
  let failed = false;
  const fail = (e) => {
    if (failed) return;
    failed = true;
    try {
      onError(e);
    } catch {
      // reporting must never stop the run
    }
  };
  const seen = new Map(); // file -> { first, count }
  const files = () => {
    const { issueFile, planFile } = ledgerFiles(root, key, opts);
    return [issueFile, planFile].filter(Boolean);
  };
  const read = (report) => {
    for (const file of files()) {
      const lines = readLines(file) ?? [];
      const prev = seen.get(file) ?? { first: null, count: 0 };
      if (report) {
        if (lines[0] !== undefined && lines[0] !== prev.first && lines[0].startsWith('Phase:')) onLine(lines[0]);
        for (const l of lines.slice(1 + prev.count)) if (l.startsWith('Progress:')) onLine(l);
      }
      seen.set(file, { first: lines[0] ?? null, count: Math.max(0, lines.length - 1) });
    }
  };
  read(false);
  const timer = setInterval(() => {
    try {
      read(true);
    } catch (e) {
      // a ledger mid-rewrite or unreadable: try again next tick; never crash the runner
      fail(e);
    }
  }, intervalMs);
  timer.unref?.();
  return () => {
    clearInterval(timer);
    try {
      read(true);
    } catch (e) {
      // as above: a last read that fails loses only progress lines, never the run
      fail(e);
    }
  };
}

// What the next child loads from the checkout (permission rules, hooks, MCP servers, agents,
// commands, skills, memory files): a child that changes one could widen what every later child may
// do. The run's own files under .claude/ (ship-plan.md, ship-plan/, ship-issue/) are written by
// children by design and never guarded.
export const GUARDED_FILES = [
  '.claude/settings.json', '.claude/settings.local.json', '.mcp.json',
  'CLAUDE.md', 'CLAUDE.local.md', '.claude/CLAUDE.md', '.claude/CLAUDE.local.md',
];
export const GUARDED_DIRS = ['.claude/hooks', '.claude/agents', '.claude/commands', '.claude/skills'];
const NOT_GUARDED = /^\.claude\/(?:ship-plan\.md$|ship-plan\/|ship-issue\/)/;

// Every file under rel (a checkout-relative dir), '/'-separated. A symlink is listed itself (its
// target is part of its hash), and a symlinked dir is walked too, inside the checkout or not.
// `seen` holds the real path of every dir walked: a dir reached twice (a cycle) is walked once.
function filesUnder(root, rel, seen) {
  let real;
  let entries;
  try {
    real = realpathSync(join(root, rel));
    if (seen.has(real)) return [];
    seen.add(real);
    entries = readdirSync(join(root, rel), { withFileTypes: true });
  } catch (e) {
    if (e.code === 'ENOENT' || e.code === 'ENOTDIR' || e.code === 'ELOOP') return [];
    throw e;
  }
  return entries.flatMap((d) => {
    const p = `${rel}/${d.name}`;
    if (d.isDirectory()) return filesUnder(root, p, seen);
    if (d.isSymbolicLink() && isDir(join(root, p))) return [p, ...filesUnder(root, p, seen)];
    return [p];
  });
}

function isDir(file) {
  try {
    return statSync(file).isDirectory();
  } catch {
    return false; // dangling, or a loop: hashed as such
  }
}

// Files inside the checkout that a settings `hooks` command names ("$CLAUDE_PROJECT_DIR"/x.sh,
// ./x.sh, x/y.py), checkout-relative and '/'-separated.
function hookScripts(root) {
  const commands = [];
  const collect = (v) => {
    if (Array.isArray(v)) v.forEach(collect);
    else if (v && typeof v === 'object') {
      if (typeof v.command === 'string') commands.push(v.command);
      Object.values(v).forEach(collect);
    }
  };
  for (const f of ['.claude/settings.json', '.claude/settings.local.json']) {
    try {
      collect(JSON.parse(readFileSync(join(root, f), 'utf8')).hooks);
    } catch {
      // missing or not JSON: its own hash still guards it
    }
  }
  const found = new Set();
  for (const c of commands) {
    for (const word of c.split(/\s+/)) {
      const t = word.replace(/["']/g, '').replace(/\$\{?CLAUDE_PROJECT_DIR\}?/g, root);
      if (!t) continue;
      const rel = relative(root, resolve(root, t));
      if (!rel || rel.startsWith('..') || isAbsolute(rel)) continue;
      try {
        if (statSync(join(root, rel)).isFile()) found.add(rel.split(sep).join('/'));
      } catch {
        // not a file: a program name or an argument
      }
    }
  }
  return [...found];
}

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

// A symlink: its target and what it resolves to (the file's sha256, `dir`, or `dangling`).
function linkHash(file) {
  let to;
  try {
    to = statSync(file).isDirectory() ? 'dir' : sha(readFileSync(file));
  } catch (e) {
    if (e.code !== 'ENOENT' && e.code !== 'ENOTDIR' && e.code !== 'ELOOP') throw e;
    to = 'dangling';
  }
  return `link:${readlinkSync(file)}:${to}`;
}

// { [checkout-relative path]: sha256 of its bytes, linkHash for a symlink, or 'absent' }, over
// GUARDED_FILES, GUARDED_DIRS that are symlinks, every file under GUARDED_DIRS and the hook scripts
// the settings name.
export function guardedHashes(root) {
  const seen = new Set();
  const linkedDirs = GUARDED_DIRS.filter((d) => {
    try {
      return lstatSync(join(root, d)).isSymbolicLink();
    } catch {
      return false;
    }
  });
  const paths = new Set([...GUARDED_FILES, ...linkedDirs, ...GUARDED_DIRS.flatMap((d) => filesUnder(root, d, seen)), ...hookScripts(root)]);
  const hashes = {};
  for (const p of [...paths].filter((x) => !NOT_GUARDED.test(x)).sort()) {
    const file = join(root, p);
    try {
      hashes[p] = lstatSync(file).isSymbolicLink() ? linkHash(file) : sha(readFileSync(file));
    } catch (e) {
      if (e.code !== 'ENOENT' && e.code !== 'ENOTDIR' && e.code !== 'EISDIR') throw e;
      hashes[p] = 'absent';
    }
  }
  return hashes;
}

// The guarded paths whose hash differs between two guardedHashes results (a path in only one
// counts as absent in the other).
export function guardedChanges(before, after) {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return keys.filter((k) => (before[k] ?? 'absent') !== (after[k] ?? 'absent'));
}

// Where a checkout path really lives, as git sees it: each symlink on the way (checkout-relative,
// its folder resolved, so never beyond another link) and the path it ends at. { outside: true }
// when a link on the way or the end is outside the checkout: content git cannot vouch for.
function resolveChain(realRoot, rel) {
  const inside = (abs) => {
    const r = relative(realRoot, abs);
    return r && !r.startsWith('..') && !isAbsolute(r) ? r.split(sep).join('/') : null;
  };
  const paths = [];
  let parts = rel.split('/');
  let cur = realRoot;
  for (let hops = 0; parts.length;) {
    const name = parts.shift();
    if (!name || name === '.') continue;
    if (name === '..') {
      cur = dirname(cur);
      continue;
    }
    const next = join(cur, name);
    let link = false;
    try {
      link = lstatSync(next).isSymbolicLink();
    } catch {
      // absent: the path is taken as it is
    }
    if (!link) {
      cur = next;
      continue;
    }
    const at = inside(next);
    if (!at || ++hops > 40) return { outside: true };
    paths.push(at);
    const target = readlinkSync(next);
    if (isAbsolute(target)) cur = parse(target).root;
    parts = [...target.split(/[\\/]/), ...parts];
  }
  const end = inside(cur);
  if (!end) return { outside: true };
  paths.push(end);
  return { paths };
}

// git status entries for these checkout paths: changed, staged, untracked or ignored ('/'-separated;
// a folder git reports whole ends in '/'). null when git cannot tell.
function statusEntries(root, paths) {
  if (!paths.length) return [];
  let out;
  try {
    out = runGit(root, ['status', '--porcelain', '-z', '--ignored=matching', '--untracked-files=all', '--', ...paths.map((p) => `:(literal)${p}`)]);
  } catch {
    return null;
  }
  const entries = [];
  const parts = out.split('\0');
  for (let i = 0; i < parts.length; i++) {
    if (!parts[i]) continue;
    entries.push(parts[i].slice(3));
    if (/^(?:[RC].|.[RC])/.test(parts[i])) entries.push(parts[++i] ?? ''); // a rename: its old path too
  }
  return entries;
}
const touches = (entry, p) => entry === p || entry.startsWith(`${p}/`) || (entry.endsWith('/') && p.startsWith(entry));
const chainsOf = (root, rels) => {
  const realRoot = realpathSync(root);
  return new Map(rels.map((p) => [p, resolveChain(realRoot, p)]));
};
const gitPaths = (chains) => [...new Set([...chains.values()].flatMap((c) => c.paths ?? []))];

// origin/<base> as the runner fetches it itself, before a child (up: { url, base }, the url read
// when the run started): its commit id, or null (no origin, a fetch that failed, a base name that
// is not a plain branch name). The ref is written by this fetch, with no child running.
function fetchBase(root, up) {
  if (!up?.url || !/^[A-Za-z0-9._/-]+$/.test(up.base ?? '') || up.base.startsWith('-')) return null;
  const ref = `refs/remotes/origin/${up.base}`;
  try {
    runGit(root, ['fetch', '-q', '--no-tags', '--', up.url, `+refs/heads/${up.base}:${ref}`]);
    return runGit(root, ['rev-parse', '--verify', '-q', `${ref}^{commit}`]).trim() || null;
  } catch {
    return null;
  }
}

// { mode, type, oid } of a path in commit sha, or null when the commit has nothing there (or the
// path is beyond a link of that commit).
function treeEntry(root, commit, rel) {
  const out = runGit(root, ['ls-tree', '-z', commit, '--', rel]);
  for (const line of out.split('\0')) {
    const m = /^(\d+) (\w+) ([0-9a-f]+)\t(.*)$/s.exec(line);
    if (m && m[4] === rel) return { mode: m[1], type: m[2], oid: m[3] };
  }
  return null;
}
const blobAt = (root, oid) => runGit(root, ['cat-file', 'blob', oid], { encoding: 'buffer' });

// What a symlink at rel with this target resolves to in commit sha, as linkHash says it: a file's
// sha256, `dir` or `dangling`; null when it leaves the checkout (git cannot vouch for that).
function resolvedAt(root, commit, rel, target, hops = 0) {
  if (isAbsolute(target) || hops > 40) return null;
  const p = posix.normalize(posix.join(posix.dirname(rel), target.replaceAll('\\', '/')));
  if (p === '..' || p.startsWith('../')) return null;
  if (p === '.' || p === '') return 'dir';
  const e = treeEntry(root, commit, p);
  if (!e) return 'dangling';
  if (e.type === 'tree') return 'dir';
  if (e.type !== 'blob') return null;
  if (e.mode === '120000') return resolvedAt(root, commit, p, blobAt(root, e.oid).toString('utf8'), hops + 1);
  return sha(blobAt(root, e.oid));
}

// The value guardedHashes would give rel in a checkout of commit sha, or null when that cannot be
// told (a link out of the checkout, a submodule).
function hashAt(root, commit, rel) {
  const e = treeEntry(root, commit, rel);
  if (!e || e.type === 'tree') return 'absent';
  if (e.type !== 'blob') return null;
  if (e.mode !== '120000') return sha(blobAt(root, e.oid));
  const target = blobAt(root, e.oid).toString('utf8');
  const to = resolvedAt(root, commit, rel, target);
  return to === null ? null : `link:${target}:${to}`;
}

// What the guard takes before a child: the guarded hashes; the git status of the guarded paths
// (null when git cannot tell); and origin/<base>, fetched by the runner now (fetchBase).
export function guardSnapshot(root, up) {
  const hashes = guardedHashes(root);
  const dirty = statusEntries(root, gitPaths(chainsOf(root, Object.keys(hashes))));
  return { hashes, dirty, upstream: dirty ? fetchBase(root, up) : null };
}

// The guarded paths a child changed (K2): those whose hash differs from the snapshot, less the
// ones whose content now is exactly what origin/<base> held when the runner fetched it before the
// child (snap.upstream; a child switches to a newer origin/<base> by design): the bytes, or a
// link's target and what it resolves to, equal to that commit's, or absent in both. Never vouched
// for by what the child can change (refs, the index, git status): git status only refuses (a path
// that differed from HEAD before the child, or that leads out of the checkout counts). No
// upstream commit, or git unable to tell: every changed path counts.
export function guardedChildChanges(root, snap) {
  const after = guardedHashes(root);
  const changed = guardedChanges(snap.hashes, after);
  if (!changed.length || !snap.upstream || !snap.dirty) return changed;
  const chains = chainsOf(root, changed);
  return changed.filter((p) => {
    const c = chains.get(p);
    if (c.outside || c.paths.some((g) => snap.dirty.some((e) => touches(e, g)))) return true;
    let want = null;
    try {
      want = hashAt(root, snap.upstream, p);
    } catch {
      // git cannot read it: not vouched for
    }
    return want === null || want !== (after[p] ?? 'absent');
  });
}

const plural = (n) => `${n} question${n === 1 ? '' : 's'}`;

// Run the issue's phases until it is done, waiting, blocked or cut off.
// ctx: { root, dir, models: {[row]: {model, effort}}, mode, env, skill = 'ship-issue',
//        args = item.key, chunkSize = 5, tailMs = 5000, idleMs?, ledgers?: LedgerOpts, save?(item),
//        upstream?: { url, base } (origin's <base>, where guarded changes may come from: guardSnapshot) }.
// A child that fails on a usage limit cuts the item off (the run stops); any other child failure
// blocks it with the error's first 300 characters. ctx.stop is set (and the event ends "; run
// stopped") when no later child should start: a failure of the environment (no claude, an API or
// auth error, a bad model: isEnvError), or a child that changed a guarded file (guardedChildChanges).
// Answers files are read from ctx.answersDir (default ctx.dir). state.current is set by the caller.
export async function runIssue(ctx, item) {
  const { root, dir } = ctx;
  const key = item.key;
  const skill = ctx.skill ?? 'ship-issue';
  const args = ctx.args ?? key;
  let answers = item.answersFile
    ? readAnswers(isAbsolute(item.answersFile) ? item.answersFile : join(ctx.answersDir ?? dir, item.answersFile))
    : null;

  // the outcome saved (ctx.beforeEnd first: the runner closes the item's child window there)
  // before its event: whoever acts on the event finds state.json saying so already
  const end = (status, reason, phase, kind, text) => {
    item.status = status;
    item.reason = reason;
    ctx.beforeEnd?.(item);
    ctx.save?.(item);
    emit(dir, key, phase, kind, text);
    return item;
  };

  for (;;) {
    const before = readLedgers(root, key, ctx.ledgers);
    const finished = before.phase === 'finished';
    if (finished && !before.waiting) {
      item.phase = 'finished';
      return end('done', '', 'finished', 'done', 'all phases done');
    }
    if (before.unknown) return end('blocked', before.unknown, before.phase, 'blocked', before.unknown);
    // Finished but asking (verify-and-fix's closing Done:, a close-out batch): the answers go to
    // the phase that asked, the last one run.
    const phase = finished ? item.sessions.at(-1)?.phase ?? before.finishedBy : before.phase;
    if (finished) item.phase = phase;
    if (before.waiting && !answers) return end('waiting', plural(before.questions), phase, 'waiting', plural(before.questions));

    const row = PHASE_ROWS[phase];
    const pick = ctx.models?.[row];
    if (!pick) return end('blocked', `no ## Models row "${row}"`, phase, 'blocked', `no ## Models row "${row}"`);

    const chunk = phase === 'implement' ? nextChunk(root, before, ctx.chunkSize ?? 5) : null;
    if (chunk?.missing) return end('blocked', chunk.missing, phase, 'blocked', chunk.missing);
    const prompt = phasePrompt({ skill, args, phase, chunk, answers });
    const resume = answers ? item.sessions.filter((s) => s.phase === phase).at(-1)?.sessionId ?? null : null;
    item.phase = phase;
    item.status = 'running';
    ctx.save?.(item);
    emit(dir, key, phase, 'start', `${phase}${rangeText(chunk)}`);

    const opts = {
      dir, cwd: root, key, phase, prompt, model: pick.model, effort: pick.effort,
      mode: ctx.mode ?? 'auto', resume, env: ctx.env ?? {}, idleMs: ctx.idleMs,
    };
    // hashed before the tail starts: a hash that throws leaves no timer behind
    const guarded = guardSnapshot(root, ctx.upstream);
    const stop = tailProgress(root, key, (line) => emit(dir, key, phase, 'progress', line), ctx.tailMs ?? 5000, ctx.ledgers,
      (e) => emit(dir, key, phase, 'progress', `ledger read failed: ${e.code || e.message}`));
    let r;
    try {
      r = resume ? await resumeOrFresh({ ...opts, freshPrompt: prompt }) : await runChild(opts);
    } finally {
      stop();
    }
    // answers are used once a child has run with them; a failed child leaves them for the rerun
    if (answers && r.ok) {
      answers = null;
      item.answersFile = null;
    }
    const session = (c) => ({ phase, sessionId: c.sessionId, costUsd: c.costUsd, turns: c.turns, minutes: c.minutes });
    if (r.failedResume) item.sessions.push(session(r.failedResume));
    item.sessions.push(session(r));
    ctx.save?.(item);

    const changed = guardedChildChanges(root, guarded);
    if (changed.length) {
      const more = changed.length > 5 ? ` and ${changed.length - 5} more` : '';
      ctx.stop = `child changed ${changed.slice(0, 5).join(', ')}${more}`;
      return end('blocked', ctx.stop, phase, 'blocked', `${ctx.stop}; run stopped`);
    }
    if (!r.ok) {
      if (isLimitError(r.error)) return end('cut off', r.error, phase, 'cutoff', r.error);
      const why = String(r.error).slice(0, 300);
      if (isEnvError(r.error)) {
        ctx.stop = why;
        return end('blocked', why, phase, 'blocked', `${why}; run stopped`);
      }
      return end('blocked', why, phase, 'blocked', why);
    }
    // The ledgers win over the marker.
    const after = readLedgers(root, key, ctx.ledgers);
    // A direct ledger (verify-and-fix) ends with a Done: line even when the run is blocked:
    // a Blocked: line this child wrote wins over that Done:.
    if (ctx.ledgers?.ledger !== undefined && after.blockedCount > before.blockedCount) {
      return end('blocked', after.blocked, phase, 'blocked', after.blocked);
    }
    if (after.phase === 'finished' || after.unknown) continue;
    if (after.waiting) return end('waiting', plural(after.questions), phase, 'waiting', plural(after.questions));
    if (r.marker?.status === 'blocked') {
      const why = r.marker.text || `phase ${phase} reported blocked`;
      return end('blocked', why, phase, 'blocked', why);
    }
    if (after.blockedCount > before.blockedCount) return end('blocked', after.blocked, phase, 'blocked', after.blocked);
    if (after.signature === before.signature) {
      // No ledger change: without a RUNNER: line the child did not finish its phase.
      if (!r.marker) return end('blocked', 'no RUNNER: line', phase, 'blocked', 'no RUNNER: line');
      // nothing to do: the issue was finished already (ship-issue I0's first row)
      if (r.marker.status === 'done') {
        const why = r.marker.text || 'already done';
        return end('done', why, phase, 'done', why);
      }
      const why = `phase ${phase} ended without progress`;
      return end('blocked', why, phase, 'blocked', why);
    }
  }
}
