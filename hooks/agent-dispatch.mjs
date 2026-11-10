#!/usr/bin/env node
// PreToolUse hook for Agent: while a ship run is live in this checkout, deny a dispatch without
// `model` or `effort` (an omitted model inherits the session's costly one; the skills' rule gets
// lost after compactions). Node only, no dependencies. Any internal error allows the call.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILLS = ['ship-plan', 'ship-issue', 'verify-and-fix', 'ship-queue'];
const LIVE_MS = 6 * 3600e3;
const DEFAULTS = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'ship-plan', 'config-format.md');
const DONE = /^Phase: done\b/;

const attempt = (fn, fallback) => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};
const read = (file) => readFileSync(file, 'utf8');
const list = (dir) => attempt(() => readdirSync(dir), []);
// Whether a ledger's first line is `Phase: done`; null when it cannot be read.
const phaseDone = (file) => attempt(() => DONE.test(read(file).split('\n', 1)[0]), null);

// Run ended: first line `Phase: done`; last line `Done:`, `Summary: posted` or `Stopped:`; a
// verify-and-fix whose same-named ship-plan ledger is done (even with lines after `Done:`); or a
// ship-issue whose `ship-plan ledger:` is done or sat in a checkout now gone. A missing ledger in
// a checkout that exists stays live: ship-issue writes the path before ship-plan creates the file.
function ended(text, root, skill, run) {
  const lines = text.split('\n').filter((l) => l.trim());
  const first = lines[0] ?? '';
  if (DONE.test(first) || /^(Done:|Summary: posted\b|Stopped:)/.test(lines.at(-1) ?? '')) return true;
  if (skill === 'verify-and-fix' && phaseDone(join(root, '.superpowers', 'ship-plan', run, 'ledger.md'))) return true;
  const m = first.match(/\bship-plan ledger: ([^|\s]+)/);
  if (!m || m[1] === 'none') return false;
  const sp = isAbsolute(m[1]) ? m[1] : join(root, m[1]);
  const done = phaseDone(sp);
  if (done !== null) return done;
  const checkout = sp.split(/[\\/]\.superpowers[\\/]/)[0];
  return checkout !== sp && !existsSync(checkout);
}

// Whether pid is a running process (EPERM: it is, owned by someone else).
function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code !== 'ESRCH';
  }
}

// The run's lock names a runner that died without writing `stopped`. No readable lock: false.
function deadRunner(runDir) {
  const lock = attempt(() => JSON.parse(read(join(runDir, 'lock'))), null);
  return Number.isInteger(lock?.runner) && !alive(lock.runner);
}

// The first live ship run under root, or null: a ledger changed in the last 6 h and not ended, or
// a fresh ship-runner state.json with `stopped` null and no dead runner's lock.
export function liveShipRun(root, nowMs) {
  const fresh = (file) => statSync(file).mtimeMs >= nowMs - LIVE_MS;
  const base = join(root, '.superpowers');
  for (const skill of SKILLS) {
    for (const run of list(join(base, skill))) {
      const file = join(base, skill, run, 'ledger.md');
      if (attempt(() => fresh(file) && !ended(read(file), root, skill, run), false)) return file;
    }
  }
  for (const run of list(join(base, 'ship-runner'))) {
    const dir = join(base, 'ship-runner', run);
    const file = join(dir, 'state.json');
    if (attempt(() => fresh(file) && JSON.parse(read(file)).stopped == null && !deadRunner(dir), false)) return file;
  }
  return null;
}

// The deny reason, or null to allow. findLive runs only when a field is missing.
export function decide(toolInput, findLive) {
  if (toolInput?.subagent_type === 'fork') return null;
  const missing = ['model', 'effort'].filter((k) => !toolInput?.[k]);
  if (!missing.length) return null;
  const live = findLive();
  if (!live) return null;
  return `A ship run is live (${live}): pass both \`model\` and \`effort\` on every Agent dispatch, from the role's row of \`## Models\` in .claude/ship-plan.md (defaults: ${DEFAULTS}). A dispatch that is not part of that run: pass any \`model\` and \`effort\` that fit the task. Missing: ${missing.join(', ')}.`;
}

// The session's own checkout only: a live run in another worktree must not gate this session.
// Known gap: work on another checkout's run through `git -C` (phase-implement step 2) is not gated.
function checkoutRoot(cwd) {
  const opts = { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] };
  return attempt(() => execFileSync('git', ['-C', cwd, 'rev-parse', '--show-toplevel'], opts).trim() || cwd, cwd);
}

function main() {
  try {
    const input = JSON.parse(read(0));
    const cwd = input.cwd || process.cwd();
    const reason = decide(input.tool_input, () => liveShipRun(checkoutRoot(cwd), Date.now()));
    if (reason) {
      const out = { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason };
      process.stdout.write(JSON.stringify({ hookSpecificOutput: out }));
    }
  } catch (e) {
    process.stderr.write(`agent-dispatch: ${e?.message ?? e}\n`); // allow, and say why
  }
  process.exit(0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
