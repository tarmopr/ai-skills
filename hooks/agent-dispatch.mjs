#!/usr/bin/env node
// PreToolUse hook for the Agent tool: while a ship run is live in this repo,
// refuse a dispatch that passes no `model` or no `effort`. An omitted model
// inherits the session's (usually the most expensive seat), and the skills'
// "always pass both" rule has been lost after context compactions.
// Node only, no dependencies. Any internal error allows the call.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILLS = ['ship-plan', 'ship-issue', 'verify-and-fix', 'ship-queue'];
const LIVE_MS = 6 * 3600e3;

// Ledgers of a ship run under any root: changed in the last 6 hours and not `Phase: done`.
export function liveShipLedgers(roots, nowMs) {
  const live = [];
  for (const root of roots) {
    for (const skill of SKILLS) {
      const base = join(root, '.superpowers', skill);
      let runs;
      try {
        runs = readdirSync(base);
      } catch {
        continue;
      }
      for (const run of runs) {
        const file = join(base, run, 'ledger.md');
        try {
          if (statSync(file).mtimeMs < nowMs - LIVE_MS) continue;
          const first = readFileSync(file, 'utf8').split('\n', 1)[0];
          if (/^Phase: done\b/.test(first)) continue;
          live.push(file);
        } catch {
          // no ledger in this run folder
        }
      }
    }
  }
  return live;
}

// The deny reason, or null to allow.
export function decide(toolInput, live) {
  if (!live.length || toolInput?.subagent_type === 'fork') return null;
  const missing = ['model', 'effort'].filter((k) => !toolInput?.[k]);
  if (!missing.length) return null;
  return `A ship run is live (${live[0]}): pass both \`model\` and \`effort\` on every Agent dispatch, from the role's row of \`## Models\` in .claude/ship-plan.md (defaults: ship-plan/config-format.md). Missing: ${missing.join(', ')}.`;
}

function roots(cwd) {
  try {
    const out = execFileSync('git', ['-C', cwd, 'worktree', 'list', '--porcelain'], {
      encoding: 'utf8',
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const paths = out.split('\n').filter((l) => l.startsWith('worktree ')).map((l) => l.slice(9));
    return paths.length ? paths : [cwd];
  } catch {
    return [cwd];
  }
}

function main() {
  try {
    const input = JSON.parse(readFileSync(0, 'utf8'));
    const cwd = input.cwd || process.cwd();
    const reason = decide(input.tool_input, liveShipLedgers(roots(cwd), Date.now()));
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
  } catch {
    // allow
  }
  process.exit(0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
