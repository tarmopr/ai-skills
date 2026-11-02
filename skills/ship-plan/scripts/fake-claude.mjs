#!/usr/bin/env node
// Test double for `claude -p --output-format stream-json --verbose`.
// Reads the prompt from stdin, then acts per FAKE_CLAUDE:
//   ok:<marker line>  init, hook, assistant, rate_limit_event and result lines; result ends with the marker
//   error             a result line with is_error: true
//   crash             exit 1, no output
//   noresume          with --resume: the CLI's "No conversation found" result line, exit 1;
//                     otherwise like ok (marker from FAKE_CLAUDE_MARKER)
// FAKE_CLAUDE_LOG: when set, argv, stdin and SHIP_RUNNER are written there as JSON.
// FAKE_CLAUDE_LEDGER_APPEND: JSON [{file, when?, firstLine?, append?: string[]}], applied before
//   the output: file is relative to cwd; an op runs only when the prompt contains `when` (if set);
//   firstLine replaces line 1, append adds lines at the end.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const chunks = [];
for await (const c of process.stdin) chunks.push(c);
const stdin = Buffer.concat(chunks).toString('utf8');
const argv = process.argv.slice(2);
if (process.env.FAKE_CLAUDE_LOG) writeFileSync(process.env.FAKE_CLAUDE_LOG, JSON.stringify({ argv, stdin, shipRunner: process.env.SHIP_RUNNER }));

for (const op of JSON.parse(process.env.FAKE_CLAUDE_LEDGER_APPEND || '[]')) {
  if (op.when && !stdin.includes(op.when)) continue;
  const lines = existsSync(op.file) ? readFileSync(op.file, 'utf8').replace(/\n$/, '').split('\n') : [];
  if (op.firstLine) lines[0] = op.firstLine;
  lines.push(...(op.append || []));
  mkdirSync(dirname(op.file), { recursive: true });
  writeFileSync(op.file, lines.join('\n') + '\n');
}

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
} else if (mode === 'crash') process.exit(1);
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
