// State, lock and event log for the ship runner.
// Node only, no dependencies, so it runs the same on macOS, Linux and Windows.
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { appendFileSync, closeSync, constants, fstatSync, linkSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

// Every git call of the runner. A child can set `core.fsmonitor` or `core.hooksPath` in the git
// config, or write a hook: the runner's own git (status, switch) would run that code. Both are
// switched off here, and SHIP_RUNNER_ALLOW_BYPASS is never in git's env, so what git runs anyway
// (a filter, an alias) never gets it. `refs/replace/` objects and an `info/grafts` file a child
// added are ignored (GIT_NO_REPLACE_OBJECTS, GIT_GRAFT_FILE), as defence in depth: a plan read from
// a run branch is that commit's own. git's hint that grafts are deprecated is off, so git's words in
// a failure are its error alone. Returns stdout; a failure throws as execFileSync does (git's words
// in e.stderr); { encoding: 'buffer' } returns bytes.
export const SAFE_GIT = ['-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', '-c', 'advice.graftFileDeprecated=false'];
export function runGit(cwd, args, { encoding = 'utf8' } = {}) {
  const env = { ...process.env, GIT_NO_REPLACE_OBJECTS: '1', GIT_GRAFT_FILE: '/dev/null' };
  delete env.SHIP_RUNNER_ALLOW_BYPASS;
  return execFileSync('git', [...SAFE_GIT, ...args], { cwd, env, encoding, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
}

// A run dir, an answers store or the mode records' folder: its parents as usual, itself 0700 (the
// user's alone) when made now.
export function makeDir(dir) {
  mkdirSync(dirname(resolve(dir)), { recursive: true });
  try {
    mkdirSync(dir, { mode: 0o700 });
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
}

// <root>/.superpowers/ship-runner/<kind>-<id>/ ; every '/' and '\' in id becomes '-'. An id with
// `..` is refused (throws): the run dir is always one folder under ship-runner/.
export function runDir(root, kind, id) {
  if (String(id).includes('..')) throw new Error(`run id "${id}" holds ..`);
  return `${root}/.superpowers/ship-runner/${kind}-${id.replace(/[\\/]/g, '-')}/`;
}

// Text a child wrote (ledger lines, error text, stderr) as one safe line: line breaks become a
// space, every other control character (C0, DEL, C1) but the tab is dropped.
export function clean(text) {
  return String(text).replace(/\r\n|[\r\n]/g, ' ').replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, '');
}

// The run's state.json, or null when there is none. Any other failure throws, naming the file.
export function readState(dir) {
  const file = join(dir, 'state.json');
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw Object.assign(new Error(`${file}: ${e.message}`), { code: e.code });
  }
}

// The name of an answers file of item `key` in the store: answers-<KEY>.md as `answer` writes it,
// or answers-<KEY>@<n>.md once used (consumed: true accepts only that); never a path.
export function answersNamed(key, name, { consumed = false } = {}) {
  const k = String(key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^answers-${k}${consumed ? '@\\d+' : '(?:@\\d+)?'}\\.md$`).test(String(name));
}

// An answers file is the user's only as a plain file with one name: a symlink, or a second hard
// link to a file the runner writes (events.log, …), would hand a child's text on as answers.
export const plainFile = (st) => st.isFile() && st.nlink === 1;

// An answers file's text, through one descriptor: never through a symlink (O_NOFOLLOW), and only
// from a plain file (plainFile); anything else throws.
export function readAnswers(file) {
  const fd = openSync(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    if (!plainFile(fstatSync(fd))) throw new Error(`${file} is a link, not a plain file`);
    return readFileSync(fd, 'utf8');
  } finally {
    closeSync(fd);
  }
}

// Write to a temp file, then rename, so a crash never leaves half a state file.
// The temp name carries the pid: the runner and an `answer` command may write at the same time.
export function writeState(dir, state) {
  makeDir(dir);
  const tmp = join(dir, `state.json.${process.pid}.tmp`);
  writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n');
  renameSync(tmp, join(dir, 'state.json'));
}

export function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code !== 'ESRCH'; // EPERM: exists, owned by someone else
  }
}

// Whether any process of the process group led by pid is left (EPERM: one exists, another user's).
export function groupAlive(pid) {
  try {
    process.kill(-pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

// { runner, child } pids, or null: no lock, or one that cannot be parsed (empty, mid-write; acquireLock
// judges it by its age). A lock that cannot be read at all (EACCES, EISDIR, …) throws.
export function readLock(dir) {
  let text;
  try {
    text = readFileSync(join(dir, 'lock'), 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// A lock that cannot be parsed (empty, or mid-write by another tool) and is younger than this is
// held: its writer may be about to fill it.
const UNREADABLE_LOCK_MS = 10000;

// The lock as one open file: { body (parsed, or null when unreadable), ino, mtimeMs }, or null if
// there is none. Inode and body come from the same open file, so they belong together.
function lockFile(file) {
  let fd;
  try {
    fd = openSync(file, 'r');
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
  try {
    const { ino, mtimeMs } = fstatSync(fd);
    let body = null;
    try {
      body = JSON.parse(readFileSync(fd, 'utf8'));
    } catch {
      // unreadable: judged by its age
    }
    return { body, ino, mtimeMs };
  } finally {
    closeSync(fd);
  }
}

const unique = () => `${process.pid}.${randomBytes(4).toString('hex')}`;

// { ok: true }, or { ok: false, holder } (the live runner's pid, or 'unknown' for a lock that
// cannot be read yet). The lock appears whole or not at all: a complete temp file is hard-linked
// to `lock` (EEXIST: someone has it). A stale lock (dead runner, or unreadable and older than
// 10 s) is renamed aside, never removed in place: of two runners taking it over, one rename wins;
// a lock that turns out to be fresh once aside (another runner took it over first) is put back.
export function acquireLock(dir, pid) {
  makeDir(dir);
  const file = join(dir, 'lock');
  const tmp = join(dir, `lock.${unique()}.tmp`);
  writeFileSync(tmp, JSON.stringify({ runner: pid, child: null }));
  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        linkSync(tmp, file);
        return { ok: true };
      } catch (e) {
        if (e.code !== 'EEXIST') throw e;
      }
      const seen = lockFile(file);
      if (!seen) continue; // released meanwhile: try again
      const { body } = seen;
      if (!body && Date.now() - seen.mtimeMs < UNREADABLE_LOCK_MS) return { ok: false, holder: 'unknown' };
      if (body && Number.isInteger(body.runner) && alive(body.runner)) return { ok: false, holder: body.runner };
      const aside = join(dir, `lock.stale.${unique()}`);
      try {
        renameSync(file, aside);
      } catch (e) {
        if (e.code === 'ENOENT') continue; // another runner moved it first
        throw e;
      }
      if (statSync(aside).ino !== seen.ino) {
        // not the lock judged stale: another runner's fresh one. Put it back, unless a third has
        // a lock by now.
        try {
          linkSync(aside, file);
        } catch (e) {
          if (e.code !== 'EEXIST') throw e;
        }
        rmSync(aside, { force: true });
        continue;
      }
      rmSync(aside, { force: true });
    }
    const held = lockFile(file)?.body;
    return { ok: false, holder: Number.isInteger(held?.runner) ? held.runner : 'unknown' };
  } finally {
    rmSync(tmp, { force: true });
  }
}

// Temp file, then rename, like writeState: a reader never sees half a lock. Only the runner that
// holds the lock writes it.
export function setChildPid(dir, pid) {
  const held = readLock(dir);
  if (!held || held.runner !== process.pid) return;
  const tmp = join(dir, `lock.${process.pid}.tmp`);
  writeFileSync(tmp, JSON.stringify({ ...held, child: pid }));
  renameSync(tmp, join(dir, 'lock'));
}

// Removes the lock only when `pid` (this process) holds it: never another runner's, never one
// that cannot be read.
export function releaseLock(dir, pid = process.pid) {
  if (readLock(dir)?.runner !== pid) return;
  rmSync(join(dir, 'lock'), { force: true });
}

// kind: start, progress, done, waiting, blocked, cutoff, summary
export function emit(dir, key, phase, kind, text) {
  makeDir(dir);
  const line = `${new Date().toISOString()} ${clean(key)} ${clean(phase)} ${kind} ${clean(text)}\n`;
  appendFileSync(join(dir, 'events.log'), line);
}
