// State, lock and event log for the ship runner.
// Node only, no dependencies, so it runs the same on macOS, Linux and Windows.
import { appendFileSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// <root>/.superpowers/ship-runner/<kind>-<id>/ ; every '/' in id becomes '-'.
export function runDir(root, kind, id) {
  return `${root}/.superpowers/ship-runner/${kind}-${id.replaceAll('/', '-')}/`;
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

export function acquireLock(dir, pid) {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'lock');
  const body = JSON.stringify({ runner: pid, child: null });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      writeFileSync(file, body, { flag: 'wx' });
      return { ok: true };
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
    const held = readLock(dir);
    if (held && Number.isInteger(held.runner) && alive(held.runner)) return { ok: false, holder: held.runner };
    rmSync(file, { force: true }); // stale lock: replace it
  }
  const held = readLock(dir);
  return { ok: false, holder: held ? held.runner : -1 };
}

// Temp file, then rename, like writeState: a reader never sees half a lock.
export function setChildPid(dir, pid) {
  const held = readLock(dir);
  if (!held) return;
  const tmp = join(dir, `lock.${process.pid}.tmp`);
  writeFileSync(tmp, JSON.stringify({ ...held, child: pid }));
  renameSync(tmp, join(dir, 'lock'));
}

export function releaseLock(dir) {
  rmSync(join(dir, 'lock'), { force: true });
}

// kind: start, progress, done, waiting, blocked, cutoff, summary
export function emit(dir, key, phase, kind, text) {
  mkdirSync(dir, { recursive: true });
  const line = `${new Date().toISOString()} ${key} ${phase} ${kind} ${String(text).replace(/\r?\n/g, ' ')}\n`;
  appendFileSync(join(dir, 'events.log'), line);
}
