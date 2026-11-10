#!/usr/bin/env node
// PreToolUse hook for the Agent tool: while a ship run is live in this checkout,
// refuse a dispatch that passes no `model` or no `effort`. An omitted model
// inherits the session's (usually the most expensive seat), and the skills'
// "always pass both" rule has been lost after context compactions.
// Node only, no dependencies. Any internal error allows the call.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILLS = ['ship-plan', 'ship-issue', 'verify-and-fix', 'ship-queue'];
const LIVE_MS = 6 * 3600e3;
const DEFAULTS = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'ship-plan', 'config-format.md');

// Whether a ledger's first line is `Phase: done`; null when it cannot be read.
function phaseDone(file) {
  try {
    return /^Phase: done\b/.test(readFileSync(file, 'utf8').split('\n', 1)[0]);
  } catch {
    return null;
  }
}

// A ledger whose run has ended: `Phase: done` first (ship-plan, ship-queue);
// a last line `Done:` (verify-and-fix), `Summary: posted` or `Stopped:` (ship-queue);
// a verify-and-fix ledger whose same-named ship-plan ledger is done, even with a line after
// its `Done:`; or a ship-issue ledger whose `ship-plan ledger:` is done, or sat in a checkout
// that is gone (a worktree removed after the merge). A missing ledger in a checkout that
// exists stays live: ship-issue writes the path before ship-plan creates the file.
function ended(text, root, skill, run) {
  const lines = text.split('\n').filter((l) => l.trim());
  const first = lines[0] || '';
  const last = lines[lines.length - 1] || '';
  if (/^Phase: done\b/.test(first)) return true;
  if (/^(Done:|Summary: posted\b|Stopped:)/.test(last)) return true;
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

// A runner run's lock names a runner that is gone: it died without writing `stopped`. A missing
// or unreadable lock says nothing (state.json decides).
function deadRunner(runDir) {
  let lock;
  try {
    lock = JSON.parse(readFileSync(join(runDir, 'lock'), 'utf8'));
  } catch {
    return false;
  }
  return Number.isInteger(lock?.runner) && !alive(lock.runner);
}

function list(dir) {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

// The first live ship run under root, or null: a ledger changed in the last 6 hours and not
// ended, or a runner run (ship-runner/*/state.json) that is fresh, `stopped` null, with no lock
// of a dead runner.
export function liveShipRun(root, nowMs) {
  const fresh = (file) => statSync(file).mtimeMs >= nowMs - LIVE_MS;
  for (const skill of SKILLS) {
    for (const run of list(join(root, '.superpowers', skill))) {
      const file = join(root, '.superpowers', skill, run, 'ledger.md');
      try {
        if (fresh(file) && !ended(readFileSync(file, 'utf8'), root, skill, run)) return file;
      } catch {
        // no ledger in this run folder
      }
    }
  }
  for (const run of list(join(root, '.superpowers', 'ship-runner'))) {
    const dir = join(root, '.superpowers', 'ship-runner', run);
    const file = join(dir, 'state.json');
    try {
      if (fresh(file) && JSON.parse(readFileSync(file, 'utf8')).stopped == null && !deadRunner(dir)) return file;
    } catch {
      // no readable state in this run folder
    }
  }
  return null;
}

// The deny reason, or null to allow. findLive runs only when a field is missing, so a
// dispatch that passes both never scans the checkout.
export function decide(toolInput, findLive) {
  if (toolInput?.subagent_type === 'fork') return null;
  const missing = ['model', 'effort'].filter((k) => !toolInput?.[k]);
  if (!missing.length) return null;
  const live = findLive();
  if (!live) return null;
  return `A ship run is live (${live}): pass both \`model\` and \`effort\` on every Agent dispatch, from the role's row of \`## Models\` in .claude/ship-plan.md (defaults: ${DEFAULTS}). A dispatch that is not part of that run: pass any \`model\` and \`effort\` that fit the task. Missing: ${missing.join(', ')}.`;
}

// The session's own checkout only, never the repo's other worktrees: a live run in one
// worktree must not gate an unrelated session in another. Known gap: a session that works
// on a run held in another checkout through `git -C` (ship-plan phase-implement step 2)
// is not gated; the skills' own "pass both" rule still applies there.
function checkoutRoot(cwd) {
  try {
    const top = execFileSync('git', ['-C', cwd, 'rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return top || cwd;
  } catch {
    return cwd;
  }
}

function main() {
  try {
    const input = JSON.parse(readFileSync(0, 'utf8'));
    const cwd = input.cwd || process.cwd();
    const reason = decide(input.tool_input, () => liveShipRun(checkoutRoot(cwd), Date.now()));
    if (reason) {
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: reason,
          },
        }),
      );
    }
  } catch (e) {
    // allow, and say why
    process.stderr.write(`agent-dispatch: ${e?.message ?? e}\n`);
  }
  process.exit(0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
