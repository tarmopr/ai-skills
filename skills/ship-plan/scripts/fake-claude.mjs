#!/usr/bin/env node
// Test double for `claude -p --output-format stream-json --verbose`.
// Reads the prompt from stdin, then acts per FAKE_CLAUDE:
//   ok:<marker line>  init, hook, assistant, rate_limit_event and result lines; result ends with the marker
//   error             a result line with is_error: true
//   crash             exit 1, no output
//   crashafter        init and assistant lines (a session id), then exit 1 with no result line
//   apierror          a result line with is_error: true and an API authentication error
//   hang              an init line, then nothing, never exits by itself; ignores SIGTERM when
//                     FAKE_CLAUDE_IGNORE_TERM=1 (only SIGKILL ends it)
//   badresult         a result line whose `result` and `errors` cannot be turned into text (an
//                     object with no usable toString): the runner's reading of it throws
//   grandchild        starts a grandchild that holds stdout open for FAKE_CLAUDE_HOLD_MS (default 3000),
//                     then ok output (marker from FAKE_CLAUDE_MARKER) and exit; the grandchild's pid
//                     goes to FAKE_CLAUDE_PIDFILE when set, and it ignores SIGTERM when
//                     FAKE_CLAUDE_IGNORE_TERM=1
//   multi             a child with background tasks: two result lines, the first ending with the
//                     marker (FAKE_CLAUDE_MARKER, default RUNNER: phase-done), the second (a later
//                     task notification's turn) with none; num_turns 4 and 2, total_cost_usd 0.30 and 0.35
//   noresume          with --resume: the CLI's "No conversation found" result line, exit 1;
//                     otherwise like ok (marker from FAKE_CLAUDE_MARKER)
// FAKE_CLAUDE_LOG: when set, argv, stdin, SHIP_RUNNER, SHIP_RUNNER_KEY, SHIP_RUNNER_ALLOW_BYPASS and
//   the run dir's state.json `current` (null without one) are written there as JSON.
// FAKE_CLAUDE_LEDGER_APPEND: JSON [{file, when?, firstLine?, append?: string[]}], applied before
//   the output: file is relative to cwd; an op runs only when the prompt contains `when` (if set);
//   firstLine replaces line 1, replace [[old, new], …] swaps every line equal to old, append adds
//   lines at the end.
// FAKE_CLAUDE_RM: a path removed (recursively) after the ledger ops.
// FAKE_CLAUDE_STDERR: text written to stderr before the output.
// FAKE_CLAUDE_UTIMES: JSON [[file, epoch seconds], …]: each file's atime and mtime set, after the
//   ledger ops (a child backdating a file it wrote).
// FAKE_CLAUDE_LATE_WRITE: JSON {file, ms, text}: a background grandchild (same process group,
//   stdio ignored) writes text to file ms after the child starts, whether or not the child has
//   exited by then.
// FAKE_CLAUDE_CHMOD: JSON [[file, mode], …]: each file's mode set (e.g. 0 makes it unreadable).
// FAKE_CLAUDE_MKDIR: JSON [dir, …]: each dir made (recursively); $PPID in a path is the parent's
//   (the runner's) pid.
// FAKE_CLAUDE_LINK: JSON [[target, link, 'hard'|'sym'], …]: each link made, its folder first.
// FAKE_CLAUDE_GIT: JSON [[<git arg>, …], …], each run as `git <args>` in cwd after the ledger ops.
// FAKE_CLAUDE_NETFAILS: "<n>:<counter file>": the first n runs (counted in the file) write only a
//   result line with is_error: true and an ECONNREFUSED API error, before any ledger op; with
//   "<i>,<j>,…:<file>" (a comma in it), only those runs, numbered from 1.
// FAKE_CLAUDE_BY_KEY: JSON {<key>: {<env var>: <value>}}; the key is SHIP_RUNNER_KEY, else the prompt's
//   `with the arguments "<key>"`; its values override the env vars above for that child.
// The log's `head` is cwd's .git/HEAD (the branch the child started on), or null.
import { execFileSync, spawn } from 'node:child_process';
import { chmodSync, existsSync, linkSync, mkdirSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const chunks = [];
for await (const c of process.stdin) chunks.push(c);
const stdin = Buffer.concat(chunks).toString('utf8');
const argv = process.argv.slice(2);
// the item's key: SHIP_RUNNER_KEY (set for every runner child), else the prompt's arguments
const promptKey = process.env.SHIP_RUNNER_KEY || /with the arguments "([^"]*)"/.exec(stdin)?.[1];
Object.assign(process.env, JSON.parse(process.env.FAKE_CLAUDE_BY_KEY || '{}')[promptKey] ?? {});
const head = existsSync('.git/HEAD') ? readFileSync('.git/HEAD', 'utf8').trim() : null;
const stateCurrent = () => {
  try {
    return JSON.parse(readFileSync(`${process.env.SHIP_RUNNER}/state.json`, 'utf8')).current ?? null;
  } catch {
    return null;
  }
};
if (process.env.FAKE_CLAUDE_LOG) writeFileSync(process.env.FAKE_CLAUDE_LOG, JSON.stringify({ argv, stdin, head, shipRunner: process.env.SHIP_RUNNER, shipRunnerKey: process.env.SHIP_RUNNER_KEY ?? null, allowBypass: process.env.SHIP_RUNNER_ALLOW_BYPASS ?? null, stateCurrent: stateCurrent() }));

if (process.env.FAKE_CLAUDE_NETFAILS) {
  const [n, file] = process.env.FAKE_CLAUDE_NETFAILS.split(/:(.*)/s);
  const seen = existsSync(file) ? Number(readFileSync(file, 'utf8')) : 0;
  writeFileSync(file, String(seen + 1));
  if (n.includes(',') ? n.split(',').map(Number).includes(seen + 1) : seen < Number(n)) {
    process.stdout.write(JSON.stringify({ type: 'result', subtype: 'success', is_error: true, num_turns: 0, total_cost_usd: 0, duration_ms: 100, result: 'API Error: Connection refused — a firewall or proxy may be blocking it (ECONNREFUSED)' }) + '\n');
    process.exit(0);
  }
}
for (const op of JSON.parse(process.env.FAKE_CLAUDE_LEDGER_APPEND || '[]')) {
  if (op.when && !stdin.includes(op.when)) continue;
  const lines = existsSync(op.file) ? readFileSync(op.file, 'utf8').replace(/\n$/, '').split('\n') : [];
  if (op.firstLine) lines[0] = op.firstLine;
  for (const [from, to] of op.replace || []) lines.forEach((l, i) => { if (l === from) lines[i] = to; });
  lines.push(...(op.append || []));
  mkdirSync(dirname(op.file), { recursive: true });
  writeFileSync(op.file, lines.join('\n') + '\n');
}
for (const [file, t] of JSON.parse(process.env.FAKE_CLAUDE_UTIMES || '[]')) utimesSync(file, t, t);
if (process.env.FAKE_CLAUDE_LATE_WRITE) {
  const { file, ms, text } = JSON.parse(process.env.FAKE_CLAUDE_LATE_WRITE);
  const code = `setTimeout(() => { require('fs').mkdirSync(require('path').dirname(${JSON.stringify(file)}), { recursive: true }); require('fs').writeFileSync(${JSON.stringify(file)}, ${JSON.stringify(text)}); }, ${Number(ms)})`;
  spawn(process.execPath, ['-e', code], { stdio: 'ignore' }).unref();
}
if (process.env.FAKE_CLAUDE_STDERR) process.stderr.write(process.env.FAKE_CLAUDE_STDERR);
if (process.env.FAKE_CLAUDE_RM) rmSync(process.env.FAKE_CLAUDE_RM, { recursive: true, force: true });
for (const [file, m] of JSON.parse(process.env.FAKE_CLAUDE_CHMOD || '[]')) chmodSync(file, m);
for (const d of JSON.parse(process.env.FAKE_CLAUDE_MKDIR || '[]')) mkdirSync(d.replaceAll('$PPID', String(process.ppid)), { recursive: true });
for (const [target, link, how] of JSON.parse(process.env.FAKE_CLAUDE_LINK || '[]')) {
  mkdirSync(dirname(link), { recursive: true });
  (how === 'sym' ? symlinkSync : linkSync)(target, link);
}
for (const args of JSON.parse(process.env.FAKE_CLAUDE_GIT || '[]')) execFileSync('git', args, { stdio: 'ignore' });

const mode = process.env.FAKE_CLAUDE || 'ok:RUNNER: done';
const session_id = 's-1';
const out = (o) => process.stdout.write(JSON.stringify({ ...o, session_id }) + '\n');

function ok(marker) {
  out({ type: 'system', subtype: 'init', cwd: process.cwd(), tools: ['Skill'] });
  out({ type: 'system', subtype: 'hook_started', hook_name: 'SessionStart' });
  out({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'working' }] } });
  out({ type: 'rate_limit_event', rate_limit_info: { status: 'allowed' } });
  out({
    type: 'result', subtype: 'success', is_error: false, num_turns: 3, total_cost_usd: 0.42,
    duration_ms: 150000, result: `Work done.\n${marker}`,
  });
}

if (mode.startsWith('ok:')) ok(mode.slice(3));
else if (mode === 'error') {
  out({ type: 'system', subtype: 'init', cwd: process.cwd(), tools: [] });
  out({ type: 'result', subtype: 'success', is_error: true, num_turns: 1, total_cost_usd: 0.01, duration_ms: 1000, result: 'usage limit reached' });
} else if (mode === 'apierror') {
  out({ type: 'system', subtype: 'init', cwd: process.cwd(), tools: [] });
  out({ type: 'result', subtype: 'success', is_error: true, num_turns: 0, total_cost_usd: 0, duration_ms: 500, result: 'API Error: 401 {"type":"authentication_error","message":"invalid x-api-key"}' });
} else if (mode === 'badresult') {
  out({ type: 'system', subtype: 'init', cwd: process.cwd(), tools: [] });
  const bad = { toString: 1, valueOf: 1 };
  out({ type: 'result', subtype: 'error_during_execution', is_error: true, num_turns: 0, total_cost_usd: 0, result: bad, errors: [bad] });
} else if (mode === 'crash') process.exit(1);
else if (mode === 'crashafter') {
  out({ type: 'system', subtype: 'init', cwd: process.cwd(), tools: ['Skill'] });
  out({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'working' }] } });
  process.exitCode = 1;
} else if (mode === 'hang') {
  if (process.env.FAKE_CLAUDE_IGNORE_TERM === '1') process.on('SIGTERM', () => {});
  out({ type: 'system', subtype: 'init', cwd: process.cwd(), tools: ['Skill'] });
  setInterval(() => {}, 1 << 30);
} else if (mode === 'grandchild') {
  const ms = Number(process.env.FAKE_CLAUDE_HOLD_MS) || 3000;
  const ignore = process.env.FAKE_CLAUDE_IGNORE_TERM === '1' ? "process.on('SIGTERM', () => {}); " : '';
  const g = spawn(process.execPath, ['-e', `${ignore}setTimeout(() => {}, ${ms})`], { stdio: ['ignore', 'inherit', 'ignore'] });
  g.unref();
  if (process.env.FAKE_CLAUDE_PIDFILE) writeFileSync(process.env.FAKE_CLAUDE_PIDFILE, String(g.pid));
  ok(process.env.FAKE_CLAUDE_MARKER || 'RUNNER: done');
}
else if (mode === 'multi') {
  out({ type: 'system', subtype: 'init', cwd: process.cwd(), tools: ['Skill'] });
  out({ type: 'result', subtype: 'success', is_error: false, num_turns: 4, total_cost_usd: 0.30, duration_ms: 60000,
    result: `Tasks done.\n${process.env.FAKE_CLAUDE_MARKER || 'RUNNER: phase-done'}` });
  out({ type: 'system', subtype: 'task_notification' });
  out({ type: 'result', subtype: 'success', is_error: false, num_turns: 2, total_cost_usd: 0.35, duration_ms: 2000,
    result: 'Stale wait finished; nothing new.' });
}
else if (mode === 'noresume') {
  const i = argv.indexOf('--resume');
  if (i !== -1) {
    // what claude 2.1.316 prints for an unknown session id: one result line, exit 1
    const id = argv[i + 1];
    process.stdout.write(JSON.stringify({
      type: 'result', subtype: 'error_during_execution', is_error: true, num_turns: 0, total_cost_usd: 0,
      session_id: id, errors: [`No conversation found with session ID: ${id}`],
    }) + '\n');
    process.exitCode = 1; // not process.exit: let the piped write flush
  } else ok(process.env.FAKE_CLAUDE_MARKER || 'RUNNER: phase-done');
} else {
  process.stderr.write(`fake-claude: unknown FAKE_CLAUDE ${mode}\n`);
  process.exit(2);
}
