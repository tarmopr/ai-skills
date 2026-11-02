// Phases of one issue for the ship runner: which phase runs next, read from the ledgers,
// and the loop that runs one child per phase (per chunk of plan tasks for implement).
// The ledgers win over a child's RUNNER: marker.
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { emit } from './runner-lib.mjs';
import { resumeOrFresh, runChild } from './runner-child.mjs';

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
    if (e.code === 'ENOENT') return null;
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

// Everything the runner reads from both ledgers.
function readLedgers(root, key) {
  const issue = readLines(issueLedgerPath(root, key));
  const planLedger = planLedgerPath(root, issue);
  const plan = planLedger ? readLines(planLedger) : null;
  const issueFields = issue ? firstLineFields(issue[0]) : {};
  const planFields = plan ? firstLineFields(plan[0]) : {};

  let phase = 'spec';
  let unknown = null;
  if (plan) {
    phase = planPhase(planFields.Phase);
    if (!phase) unknown = `unknown ship-plan phase "${planFields.Phase}"`;
  } else if (issue) {
    const n = /^I(\d+)\b/.exec(issueFields.Phase ?? '');
    if (!n) unknown = `unknown ship-issue phase "${issueFields.Phase}"`;
    else phase = Number(n[1]) <= 3 ? 'spec' : Number(n[1]) <= 5 ? 'plan' : 'implement';
  }

  const all = [...(issue ?? []), ...(plan ?? [])];
  const lastIssueLine = (issue ?? []).filter((l) => l.trim()).at(-1) ?? '';
  const batch = /^Waiting: batch of (\d+)/.exec(lastIssueLine);
  const pending = all.filter((l) => PENDING.test(l)).length;
  const blockedLines = all.map((l) => BLOCKED.exec(l)).filter(Boolean);
  const doneTasks = new Set();
  for (const l of plan ?? []) {
    const m = /^Progress: task (\d+) done\b/.exec(l);
    if (m) doneTasks.add(Number(m[1]));
  }
  const planDoc = planFields.Plan || issueFields.Plan;
  return {
    phase: unknown ? 'unknown' : phase,
    unknown,
    waiting: Boolean(batch) || pending > 0,
    questions: pending || (batch ? Number(batch[1]) : 0),
    blocked: unknown ?? blockedLines.at(-1)?.[1] ?? null,
    blockedCount: blockedLines.length,
    doneTasks,
    planDoc: planDoc ? atRoot(root, planDoc) : null,
    signature: JSON.stringify([issue?.[0] ?? null, plan?.[0] ?? null, [...doneTasks].sort((a, b) => a - b)]),
  };
}

export function phaseFromLedgers(root, key) {
  const { phase, waiting, blocked } = readLedgers(root, key);
  return { phase, waiting, blocked };
}

export function phasePrompt({ skill, args, phase, chunk, answers }) {
  const range = chunk ? `, plan tasks ${chunk.from}–${chunk.to}` : '';
  let prompt = `Invoke the ai-skills:${skill} skill with the Skill tool, with the arguments "${args}". ` +
    `You are a ship-runner child: nobody is watching; follow the skill's Runner mode for phase ${phase}${range}.`;
  if (answers) prompt += `\n\nThe user's answers, copied exactly:\n${answers}`;
  return prompt;
}

// The plan's `### Task <n>` headings in groups of `size`, as task-number ranges.
export function implementChunks(planPath, size = 5) {
  const numbers = [];
  for (const m of readFileSync(planPath, 'utf8').matchAll(/^### Task (\d+)?/gm)) {
    numbers.push(m[1] === undefined ? numbers.length + 1 : Number(m[1]));
  }
  const chunks = [];
  for (let i = 0; i < numbers.length; i += size) {
    const group = numbers.slice(i, i + size);
    chunks.push({ from: group[0], to: group.at(-1) });
  }
  return chunks;
}

// The first chunk with a task the ship-plan ledger has no `Progress: task <n> done` line for,
// or null (no plan file, or every chunk done: the child finishes the phase's other work).
function nextChunk(ledgers, size) {
  if (!ledgers.planDoc || !existsSync(ledgers.planDoc)) return null;
  for (const c of implementChunks(ledgers.planDoc, size)) {
    for (let n = c.from; n <= c.to; n++) if (!ledgers.doneTasks.has(n)) return c;
  }
  return null;
}

// Poll both ledgers every intervalMs; call onLine for new `Progress:` lines and for
// first-line `Phase:` changes. Returns stop(), which reads once more before stopping.
export function tailProgress(root, key, onLine, intervalMs = 5000) {
  const seen = new Map(); // file -> { first, count }
  const files = () => {
    const issueFile = issueLedgerPath(root, key);
    const planFile = planLedgerPath(root, readLines(issueFile));
    return planFile ? [issueFile, planFile] : [issueFile];
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
  const timer = setInterval(() => read(true), intervalMs);
  timer.unref?.();
  return () => {
    clearInterval(timer);
    read(true);
  };
}

const plural = (n) => `${n} question${n === 1 ? '' : 's'}`;

// Run the issue's phases until it is done, waiting, blocked or cut off.
// ctx: { root, dir, models: {[row]: {model, effort}}, mode, env, skill = 'ship-issue',
//        args = item.key, chunkSize = 5, save?(item) }. state.current is set by the caller.
export async function runIssue(ctx, item) {
  const { root, dir } = ctx;
  const key = item.key;
  const skill = ctx.skill ?? 'ship-issue';
  const args = ctx.args ?? key;
  let answers = item.answersFile
    ? readFileSync(isAbsolute(item.answersFile) ? item.answersFile : join(dir, item.answersFile), 'utf8')
    : null;

  const end = (status, reason, phase, kind, text) => {
    item.status = status;
    item.reason = reason;
    emit(dir, key, phase, kind, text);
    ctx.save?.(item);
    return item;
  };

  for (;;) {
    const before = readLedgers(root, key);
    if (before.phase === 'finished') {
      item.phase = 'finished';
      const reason = before.waiting ? 'questions pending' : '';
      return end('done', reason, 'finished', 'done', reason || 'all phases done');
    }
    if (before.unknown) return end('blocked', before.unknown, before.phase, 'blocked', before.unknown);
    if (before.waiting && !answers) return end('waiting', plural(before.questions), before.phase, 'waiting', plural(before.questions));

    const phase = before.phase;
    const row = PHASE_ROWS[phase];
    const pick = ctx.models?.[row];
    if (!pick) return end('blocked', `no ## Models row "${row}"`, phase, 'blocked', `no ## Models row "${row}"`);

    const chunk = phase === 'implement' ? nextChunk(before, ctx.chunkSize ?? 5) : null;
    const prompt = phasePrompt({ skill, args, phase, chunk, answers });
    const resume = answers ? item.sessions.filter((s) => s.phase === phase).at(-1)?.sessionId ?? null : null;
    item.phase = phase;
    item.status = 'running';
    ctx.save?.(item);
    emit(dir, key, phase, 'start', chunk ? `${phase}, plan tasks ${chunk.from}–${chunk.to}` : phase);

    const opts = {
      dir, cwd: root, key, phase, prompt, model: pick.model, effort: pick.effort,
      mode: ctx.mode ?? 'auto', resume, env: ctx.env ?? {},
    };
    const stop = tailProgress(root, key, (line) => emit(dir, key, phase, 'progress', line), ctx.tailMs ?? 5000);
    let r;
    try {
      r = resume ? await resumeOrFresh({ ...opts, freshPrompt: prompt }) : await runChild(opts);
    } finally {
      stop();
    }
    if (answers) {
      answers = null;
      item.answersFile = null;
    }
    item.sessions.push({ phase, sessionId: r.sessionId, costUsd: r.costUsd, turns: r.turns, minutes: r.minutes });
    ctx.save?.(item);

    if (!r.ok) return end('cut off', r.error, phase, 'cutoff', r.error);
    // The ledgers win over the marker.
    const after = readLedgers(root, key);
    if (after.phase === 'finished' || after.unknown) continue;
    if (after.waiting) return end('waiting', plural(after.questions), phase, 'waiting', plural(after.questions));
    if (r.marker?.status === 'blocked') {
      const why = r.marker.text || `phase ${phase} reported blocked`;
      return end('blocked', why, phase, 'blocked', why);
    }
    if (after.blockedCount > before.blockedCount) return end('blocked', after.blocked, phase, 'blocked', after.blocked);
    if (after.signature === before.signature) {
      const why = `phase ${phase} ended without progress`;
      return end('blocked', why, phase, 'blocked', why);
    }
  }
}
