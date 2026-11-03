// State, lock and event log for the ship runner.
// Node only, no dependencies, so it runs the same on macOS, Linux and Windows.
import { randomBytes } from 'node:crypto';
import { appendFileSync, closeSync, fstatSync, linkSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

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

export function readState(dir) {
  try {
    return JSON.parse(readFileSync(join(dir, 'state.json'), 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}

// Write to a temp file, then rename, so a crash never leaves half a state file.
// The temp name carries the pid: the runner and an `answer` command may write at the same time.
export function writeState(dir, state) {
  mkdirSync(dir, { recursive: true });
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

// { runner, child } pids, or null.
export function readLock(dir) {
  try {
    return JSON.parse(readFileSync(join(dir, 'lock'), 'utf8'));
  } catch {
    return null; // missing or unreadable lock counts as no holder
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
  mkdirSync(dir, { recursive: true });
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
  mkdirSync(dir, { recursive: true });
  const line = `${new Date().toISOString()} ${clean(key)} ${clean(phase)} ${kind} ${clean(text)}\n`;
  appendFileSync(join(dir, 'events.log'), line);
}
