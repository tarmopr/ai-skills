// Child launcher and stream reader for the ship runner.
// Starts `claude -p` with stream-json output, logs every stdout line, and reads the final result.
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, lstatSync, mkdirSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, sep } from 'node:path';
import { createInterface } from 'node:readline';
import { emit, groupAlive, makeDir, runGit, setChildPid } from './runner-lib.mjs';

export function childArgs({ model, effort, mode, resume, addDir }) {
  const args = ['-p', '--output-format', 'stream-json', '--verbose', '--model', model, '--effort', effort, '--permission-mode', mode];
  if (resume) args.push('--resume', resume);
  if (addDir) args.push('--add-dir', addDir);
  return args;
}

// The local log store (`## Logs` `Location: local`): <main checkout>/.superpowers/ship-logs, the main
// checkout being the parent of the common git dir. Computed once, at the runner's start, before any
// child runs: a child can rewrite a linked worktree's gitfile or commondir, so git is not asked
// again. Returns { store, expected } (expected: the store's real path, as it is now) when the store
// lies outside root (a linked worktree), where a child's edits there need --add-dir; { why } when
// there is no main checkout (a bare clone; a submodule or a --separate-git-dir clone, whose common
// dir is not its parent's .git folder); null inside root or outside git.
export function logStore(root) {
  let common;
  try {
    common = runGit(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim();
  } catch {
    return null;
  }
  try {
    if (runGit(common, ['rev-parse', '--is-bare-repository']).trim() === 'true') return { why: `${common} is a bare clone: no main checkout` };
    const main = dirname(common);
    const dotGit = join(main, '.git');
    if (!lstatSync(dotGit, { throwIfNoEntry: false })?.isDirectory() || realpathSync(dotGit) !== realpathSync(common)) {
      return { why: `${common} is not the .git folder of a checkout (a submodule or --separate-git-dir clone)` };
    }
    const store = join(main, '.superpowers', 'ship-logs');
    const rel = relative(realpathSync(root), store);
    if (!(rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel))) return null;
    return { store, expected: join(realpathSync(main), '.superpowers', 'ship-logs') };
  } catch (e) {
    return { why: `${common}: ${e.code || e.message}` };
  }
}

// The store fixed at start ({ store, expected }) to pass as --add-dir: { dir } (its real path) or
// { why } when it is refused. A child may have swapped .superpowers or ship-logs for a symlink (to
// $HOME, say), so each folder is made 0700 if missing, then must be a real folder, checked before
// the next is made through it, and the store must still resolve to `expected`.
// The window between this check and the spawn is accepted: a daemon an earlier child left running
// can already write whatever that child could.
export function grantLogStore({ store, expected }) {
  const main = dirname(dirname(store));
  try {
    for (const d of [join(main, '.superpowers'), store]) {
      try {
        mkdirSync(d, { mode: 0o700 });
      } catch (e) {
        if (e.code !== 'EEXIST') throw e;
      }
      const st = lstatSync(d);
      if (st.isSymbolicLink()) return { why: `${d} is a symlink` };
      if (!st.isDirectory()) return { why: `${d} is not a folder` };
    }
    const real = realpathSync(store);
    if (real !== expected) return { why: `${store} resolves to ${real}, not ${expected}` };
    return { dir: real };
  } catch (e) {
    return { why: `${store}: ${e.code || e.message}` };
  }
}

const MARKER = /^RUNNER: (phase-done|waiting|blocked|done)\b ?(.*)$/gm;

// The last RUNNER line in the result text, or null.
export function parseMarker(resultText) {
  let last = null;
  for (const m of String(resultText ?? '').matchAll(MARKER)) last = { status: m[1], text: m[2] };
  return last;
}

// A child error that a usage or rate limit caused (the run is cut off and resumes once the limit
// resets), as opposed to a crash, an API or auth error or a bad model (the item is blocked).
const LIMIT = /usage limit|rate limit|limit reached|limit resets|out of (?:extra )?usage/i;
export function isLimitError(error) {
  return LIMIT.test(String(error ?? '').split('; stderr: ')[0]);
}

// A child error every later child would hit too: claude cannot be started, the API refuses the
// account (auth, credit, overload) or the model. The run stops on it instead of blocking item
// after item. Not a usage limit (isLimitError, checked first) and not an item's own failure.
const ENV = /^spawn failed:|\bAPI Error\b|authentication|unauthori[sz]ed|invalid (?:x-)?api[ _-]?key|credit balance|not_found_error|permission_error|selected model|model .*(?:not found|does not exist|not available)|\/login\b|oauth/i;
export function isEnvError(error) {
  return ENV.test(String(error ?? '').split('; stderr: ')[0]);
}

// Secrets a child's error text or stderr may print, each whole token as [redacted]: GitHub
// tokens and fine-grained PATs, OpenAI/Anthropic-style keys, Slack tokens, AWS access key ids,
// bearer headers (the word Bearer included).
const TOKENS = /gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|xox[abposr]-[A-Za-z0-9-]+|AKIA[0-9A-Z]{16}|Bearer [A-Za-z0-9._~+/=-]+/g;
export const redact = (text) => String(text).replace(TOKENS, '[redacted]');
// How much of a failed child's stderr reaches the item's reason and the events.
const STDERR_TAIL = 300;

// <dir>/<key>-<phase>-<n>.jsonl with the first unused n, starting at 1.
function logFile(dir, key, phase) {
  for (let n = 1; ; n++) {
    const file = join(dir, `${key}-${phase}-${n}.jsonl`);
    if (!existsSync(file)) return file;
  }
}

// The CLI's answer to `--resume <unknown id>`: an is_error result naming "No conversation found".
function isResumeFailure(result) {
  if (!result?.is_error) return false;
  const texts = [result.result, ...(Array.isArray(result.errors) ? result.errors : [])].map(String);
  return texts.some((t) => /No conversation found/.test(t));
}

// Children still running, so a runner that is stopped (a signal, an uncaught error) can end them
// (endChildren).
const active = new Set();

// Set once the runner is ending (haltChildren): no child starts after it, and a running child's
// result is never handed back, so nothing the runner's main path does can race its end.
let halted = false;
export function haltChildren() {
  halted = true;
}

// The child and everything it started: the child leads its own process group (spawned detached).
function killGroup(child, signal) {
  try {
    if (process.platform === 'win32') child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch {
    // already gone
  }
}

// After the child exits, how long its stdout may stay open (a grandchild can hold it) before the
// runner stops reading it.
const DRAIN_MS = 1000;
// After an idle kill with SIGTERM, how long before SIGKILL.
const KILL_GRACE_MS = 5000;
// When a child's process group is ended: how long it gets after SIGTERM before SIGKILL, and how
// long the runner then waits for the group to be gone.
const END_GRACE_MS = 1000;
const END_WAIT_MS = 3000;

// End the process groups these children lead (a background job, a grandchild included) and wait
// until they are gone: SIGTERM, SIGKILL after graceMs, then up to waitMs. Returns the pids of the
// groups still alive. A process that left its group (setsid) is out of reach: no same-user defence
// is complete. Windows: nothing to do (no process groups).
async function endGroups(kids, { isAlive = groupAlive, graceMs = END_GRACE_MS, waitMs = END_WAIT_MS } = {}) {
  if (process.platform === 'win32') return [];
  const left = () => kids.filter((c) => c.pid && isAlive(c.pid));
  const until = async (ms) => {
    for (const t0 = Date.now(); left().length && Date.now() - t0 < ms;) await new Promise((r) => setTimeout(r, 25));
  };
  if (!left().length) return [];
  for (const c of left()) killGroup(c, 'SIGTERM');
  await until(graceMs);
  for (const c of left()) killGroup(c, 'SIGKILL');
  await until(waitMs);
  return left().map((c) => c.pid);
}

// After the child exits: what it left in its group is ended before the item's window may close,
// so nothing the child started can write after it.
const endGroup = (child) => endGroups([child]);

// Every running child's group ended, as endGroups does; for a runner that is stopping (after
// haltChildren). Returns the pids of the groups still alive: the runner keeps its lock for them.
export async function endChildren(opts) {
  if (process.platform === 'win32') {
    for (const c of active) killGroup(c, 'SIGTERM');
    return [];
  }
  return endGroups([...active], opts);
}

// One child run. Returns the ChildResult plus whether it failed the way a dead resume fails.
// idleMs: no stdout line for that long kills the child's process group (default: never).
function runOnce({ dir, cwd, key, phase, prompt, model, effort, mode, resume, env, idleMs, logs }) {
  if (halted) return new Promise(() => {}); // the runner is ending: it writes the end itself
  makeDir(dir);
  const file = logFile(dir, key, phase);
  appendFileSync(file, ''); // claim the number before the child starts
  // a failure to write the transcript or the lock never stops the run: said once, in an event
  const said = new Set();
  const soft = (what, fn) => {
    try {
      fn();
    } catch (e) {
      if (said.has(what)) return;
      said.add(what);
      try {
        emit(dir, key, phase, 'progress', `${what}: ${e.code || e.message}`);
      } catch {
        // the event log is unwritable too: nothing more to do
      }
    }
  };
  // logs: the store logStore fixed at start, under `## Logs` `Location: local` only
  const grant = logs?.store ? grantLogStore(logs) : {};
  if (grant.why) soft('events', () => emit(dir, key, phase, 'progress', `log store not granted: ${grant.why}`));
  const addDir = grant.dir ?? null;
  return new Promise((resolve) => {
    let sessionId = null;
    let result = null;
    // a child with background tasks ends a turn per task notification: one result line each.
    // num_turns and duration_ms count that turn only, and the RUNNER: line may sit in an earlier one
    let turns = 0;
    let marker = null; // the last RUNNER: line of any result; `stale` when a later result had none
    let costUsd = null;
    const startedAt = Date.now();
    let stderr = '';
    let spawnError = null;
    let idle = null;
    let rateLimited = false;

    const child = spawn(process.env.CLAUDE_BIN || 'claude', childArgs({ model, effort, mode, resume, addDir }), {
      cwd,
      // the run dir and the item's key (state.json's `current` while it runs), set last: the child
      // reads its key here instead of deriving it
      env: { ...process.env, ...env, SHIP_RUNNER: dir, SHIP_RUNNER_KEY: key },
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: process.platform !== 'win32', // its own process group, so an idle kill ends its children too
    });
    active.add(child);
    if (child.pid) soft('lock not updated', () => setChildPid(dir, child.pid));

    let idleTimer = null;
    let killTimer = null;
    const touch = () => {
      if (!idleMs) return;
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        idle = `child idle ${Number((idleMs / 60000).toFixed(3))} min`;
        killGroup(child, 'SIGTERM');
        killTimer = setTimeout(() => killGroup(child, 'SIGKILL'), KILL_GRACE_MS);
        killTimer.unref?.();
      }, idleMs);
    };
    touch();

    child.stdin.on('error', () => {}); // child exited before reading the prompt; the exit code tells the story
    child.stdin.end(prompt);
    child.stderr.on('data', (d) => { stderr = (stderr + d).slice(-2000); });

    const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
    lines.on('line', (line) => {
      touch();
      soft('child transcript not written', () => appendFileSync(file, line + '\n'));
      let msg;
      try { msg = JSON.parse(line); } catch { return; } // not JSON: logged, otherwise ignored
      if (msg && typeof msg.session_id === 'string') sessionId = msg.session_id;
      if (msg && msg.type === 'result') {
        result = msg;
        if (typeof msg.num_turns === 'number') turns += msg.num_turns;
        if (typeof msg.total_cost_usd === 'number') costUsd = Math.max(costUsd ?? 0, msg.total_cost_usd);
        // a later turn without a line (a background task's notice) keeps the earlier one, flagged:
        // the work after it may have overtaken a blocked or done, so runIssue trusts those only
        // while the ledgers stand still
        const m = parseMarker(msg.result);
        if (m) marker = m;
        else if (marker) marker = { ...marker, stale: true };
      }
      if (msg && msg.type === 'rate_limit_event' && msg.rate_limit_info?.status === 'rejected') rateLimited = true;
    });
    const linesDone = new Promise((r) => lines.on('close', r));

    let finished = false;
    const finish = async (code, signal) => {
      if (finished) return;
      finished = true;
      if (halted) return; // the runner is ending: endChildren has the group, the lock stays as it is
      clearTimeout(idleTimer);
      clearTimeout(killTimer);
      if (!spawnError) await endGroup(child);
      active.delete(child);
      if (!spawnError) {
        // a grandchild may hold stdout open after the child is gone: read what is there, then stop
        let drained;
        await Promise.race([linesDone, new Promise((r) => { drained = setTimeout(r, DRAIN_MS); })]);
        clearTimeout(drained);
        child.stdout.destroy();
        child.stderr.destroy();
        lines.close();
      }
      if (halted) return;
      soft('lock not updated', () => setChildPid(dir, null));
      const errors = [];
      if (idle) errors.push(idle); // the kill explains the missing result line and the exit code
      else if (spawnError) errors.push(`spawn failed: ${spawnError.code || spawnError.message}`);
      else if (code !== 0) errors.push(signal ? `killed by ${signal}` : `exit ${code}`);
      if (!result) {
        if (!idle) errors.push('no result line');
      } else if (result.is_error) {
        const listed = Array.isArray(result.errors) ? result.errors.join('; ') : '';
        errors.push(`is_error: ${[String(result.result ?? '').trim(), listed].filter(Boolean).join('; ') || result.subtype || 'unknown'}`);
      }
      if (errors.length && rateLimited) errors.push('rate limit rejected');
      if (errors.length && stderr.trim()) errors.push(`stderr: ${redact(stderr).trim().slice(-STDERR_TAIL)}`);
      resolve({
        // dead: the CLI said so, or the child started but never a session (no session id, no
        // result); one that could not be spawned is not: a fresh child would fail the same way
        resumeFailed: isResumeFailure(result) || (!result && !sessionId && !idle && !spawnError),
        child: {
          ok: errors.length === 0,
          sessionId,
          marker: result ? marker : null,
          costUsd,
          turns: result ? turns : null,
          minutes: result ? Math.round((Date.now() - startedAt) / 60000) : null,
          error: errors.length ? redact(errors.join('; ')) : null,
        },
      });
    };
    child.on('error', (e) => {
      spawnError = e;
      if (!child.pid) finish(null, null); // never started: no 'exit' follows
    });
    child.on('exit', (code, signal) => finish(code, signal));
  });
}

export async function runChild(opts) {
  return (await runOnce(opts)).child;
}

// Try the resume; when the session cannot be resumed (the CLI's "No conversation found" result, or
// a child that never started a session), start a fresh child with opts.freshPrompt. A resume that
// started and then failed is returned as it is: its session is not dead. The fresh child's result
// carries the dead resume as `failedResume`, so its cost is recorded too.
export async function resumeOrFresh(opts) {
  if (!opts.resume) return runChild(opts);
  const first = await runOnce(opts);
  if (first.child.ok || !first.resumeFailed) return first.child;
  if (!opts.freshPrompt) throw new Error('resumeOrFresh: resume failed and opts.freshPrompt is missing');
  emit(opts.dir, opts.key, opts.phase, 'progress', 'resume failed, fresh child');
  return { ...(await runChild({ ...opts, resume: null, prompt: opts.freshPrompt })), failedResume: first.child };
}
