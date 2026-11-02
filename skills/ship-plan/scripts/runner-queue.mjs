// Queue scheduling for the ship runner: which item runs next. Pure: reads and updates the state
// object, writes nothing.

// A dependency in one of these states holds its dependents back for this run.
const HOLDS = new Set(['waiting', 'blocked', 'cut off', 'not started']);
const DEPENDS = /^depends on /;

/**
 * The next item to run, or null. Before choosing, every queued item whose deps hold it back
 * becomes `not started` with reason `depends on <KEY> (<status>)` (transitively); an item that is
 * `not started` only because of a dependency is re-checked first, so an answered dependency frees
 * it. Among queued items whose deps are all `done`, answered ones (answersFile set) go first, then
 * queue order. When nothing can run, queued items left (a cycle) become `not started`.
 * @param {{items: Array<{key: string, status: string, reason: string, deps: string[], answersFile: string|null}>}} state
 */
export function nextItem(state) {
  const items = state.items;
  const byKey = new Map(items.map((i) => [i.key, i]));
  for (const i of items) {
    if (i.status === 'not started' && DEPENDS.test(i.reason)) Object.assign(i, { status: 'queued', reason: '' });
  }
  const hold = (i, dep, why) => Object.assign(i, { status: 'not started', reason: `depends on ${dep} (${why})` });

  for (let changed = true; changed; ) {
    changed = false;
    for (const i of items) {
      if (i.status !== 'queued') continue;
      for (const d of i.deps ?? []) {
        const dep = byKey.get(d);
        if (!dep || HOLDS.has(dep.status)) {
          hold(i, d, dep ? dep.status : 'not in queue');
          changed = true;
          break;
        }
      }
    }
  }

  const ready = items.filter((i) => i.status === 'queued' && (i.deps ?? []).every((d) => byKey.get(d)?.status === 'done'));
  const next = ready.find((i) => i.answersFile) ?? ready[0] ?? null;
  if (!next) {
    // only a cycle is left: each waits on a queued item that waits on it
    for (const i of items.filter((x) => x.status === 'queued')) {
      const d = i.deps.find((k) => byKey.get(k)?.status !== 'done');
      hold(i, d, byKey.get(d).status);
    }
  }
  return next;
}
