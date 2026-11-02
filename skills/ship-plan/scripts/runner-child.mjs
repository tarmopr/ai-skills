// Child launcher and stream reader for the ship runner.
// Starts `claude -p` with stream-json output, logs every stdout line, and reads the final result.
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { emit, setChildPid } from './runner-lib.mjs';

export function childArgs({ model, effort, mode, resume }) {
  const args = ['-p', '--output-format', 'stream-json', '--verbose', '--model', model, '--effort', effort, '--permission-mode', mode];
  if (resume) args.push('--resume', resume);
  return args;
}

const MARKER = /^RUNNER: (phase-done|waiting|blocked|done)\b ?(.*)$/gm;

// The last RUNNER line in the result text, or null.
export function parseMarker(resultText) {
  let last = null;
  for (const m of String(resultText ?? '').matchAll(MARKER)) last = { status: m[1], text: m[2] };
  return last;
}

// <dir>/<key>-<phase>-<n>.jsonl with the first unused n, starting at 1.
function logFile(dir, key, phase) {
  for (let n = 1; ; n++) {
    const file = join(dir, `${key}-${phase}-${n}.jsonl`);
    if (!existsSync(file)) return file;
  }
}

// One child run. Returns the ChildResult plus whether a result line was seen.
function runOnce({ dir, cwd, key, phase, prompt, model, effort, mode, resume, env }) {
  mkdirSync(dir, { recursive: true });
  const file = logFile(dir, key, phase);
  appendFileSync(file, ''); // claim the number before the child starts
  return new Promise((resolve) => {
    let sessionId = null;
    let result = null;
    let stderr = '';
    let spawnError = null;

    const child = spawn(process.env.CLAUDE_BIN || 'claude', childArgs({ model, effort, mode, resume }), {
      cwd,
      env: { ...process.env, ...env, SHIP_RUNNER: dir },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (child.pid) setChildPid(dir, child.pid);

    child.on('error', (e) => { spawnError = e; });
    child.stdin.on('error', () => {}); // child exited before reading the prompt; the exit code tells the story
    child.stdin.end(prompt);
    child.stderr.on('data', (d) => { stderr = (stderr + d).slice(-2000); });

    const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
    lines.on('line', (line) => {
      appendFileSync(file, line + '\n');
      let msg;
      try { msg = JSON.parse(line); } catch { return; } // not JSON: logged, otherwise ignored
      if (msg && typeof msg.session_id === 'string') sessionId = msg.session_id;
      if (msg && msg.type === 'result') result = msg;
    });
    const linesDone = new Promise((r) => lines.on('close', r));
    const exited = new Promise((r) => child.on('close', (code, signal) => r({ code, signal })));

    Promise.all([exited, linesDone]).then(([{ code, signal }]) => {
      setChildPid(dir, null);
      const errors = [];
      if (spawnError) errors.push(`spawn failed: ${spawnError.code || spawnError.message}`);
      else if (code !== 0) errors.push(signal ? `killed by ${signal}` : `exit ${code}`);
      if (!result) errors.push('no result line');
      else if (result.is_error) errors.push(`is_error: ${String(result.result ?? '').trim() || result.subtype || 'unknown'}`);
      if (errors.length && stderr.trim()) errors.push(`stderr: ${stderr.trim()}`);
      resolve({
        sawResult: Boolean(result),
        child: {
          ok: errors.length === 0,
          sessionId,
          marker: result ? parseMarker(result.result) : null,
          costUsd: result?.total_cost_usd ?? null,
          turns: result?.num_turns ?? null,
          minutes: typeof result?.duration_ms === 'number' ? Math.round(result.duration_ms / 60000) : null,
          error: errors.length ? errors.join('; ') : null,
        },
      });
    });
  });
}

export async function runChild(opts) {
  return (await runOnce(opts)).child;
}

// Try the resume; when it dies without a result line, start a fresh child with opts.freshPrompt.
export async function resumeOrFresh(opts) {
  if (!opts.resume) return runChild(opts);
  const first = await runOnce(opts);
  if (first.child.ok || first.sawResult) return first.child;
  emit(opts.dir, opts.key, opts.phase, 'progress', 'resume failed, fresh child');
  return runChild({ ...opts, resume: null, prompt: opts.freshPrompt });
}
