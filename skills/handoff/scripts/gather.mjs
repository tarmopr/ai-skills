#!/usr/bin/env node
// Prints the facts a handoff needs that git, gh and the filesystem can answer,
// so the handoff spends its words on what only the session knows.
// Usage: node gather.mjs [name]
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { age, ensureDir, handoffDir, list, repoRoot, run } from './lib.mjs';

const root = repoRoot();
const cwd = process.cwd();
const out = [];
const say = (s = '') => out.push(s);

say(`repo root: ${root}`);
if (cwd !== root) say(`cwd: ${cwd} (worktree or subdirectory)`);

const branch = run('git', ['branch', '--show-current']);
if (branch !== null) {
  const head = run('git', ['log', '-1', '--format=%H %s']);
  say(`branch: ${branch || '(detached)'}`);
  say(`HEAD: ${head}`);
  const up = run('git', ['rev-parse', '--abbrev-ref', '@{upstream}']);
  if (up) {
    const ab = run('git', ['rev-list', '--left-right', '--count', `${up}...HEAD`]);
    const [behind, ahead] = (ab || '0 0').split(/\s+/);
    say(`upstream: ${up} (ahead ${ahead}, behind ${behind})`);
  } else {
    say('upstream: none (branch not pushed)');
  }
  const base = run('git', ['rev-parse', '--abbrev-ref', 'origin/HEAD'])?.replace(/^origin\//, '') || 'main';
  const tip = run('git', ['log', '-1', '--format=%h %s', `origin/${base}`]);
  if (tip) say(`origin/${base}: ${tip} (as of the last fetch)`);
  const dirty = (run('git', ['status', '--porcelain']) || '').split('\n').filter(Boolean);
  say(`uncommitted: ${dirty.length ? dirty.length + ' path(s)' : 'none'}`);
  for (const l of dirty.slice(0, 20)) say(`  ${l}`);
  if (dirty.length > 20) say(`  … ${dirty.length - 20} more`);
  const stashes = (run('git', ['stash', 'list']) || '').split('\n').filter(Boolean).length;
  if (stashes) say(`stashes: ${stashes}`);
  const wts = (run('git', ['worktree', 'list']) || '').split('\n').filter(Boolean);
  if (wts.length > 1) { say('worktrees:'); for (const w of wts) say(`  ${w}`); }

  if (branch && run('gh', ['--version'])) {
    const pr = run('gh', ['pr', 'view', branch, '--json', 'number,state,url,mergeStateStatus',
      '--jq', '"#\\(.number) \\(.state) \\(.mergeStateStatus) \\(.url)"']);
    say(`PR for this branch: ${pr || 'none'}`);
    const runs = run('gh', ['run', 'list', '--branch', branch, '--limit', '3', '--json',
      'databaseId,workflowName,status,conclusion,headSha,event',
      '--jq', '.[] | "\\(.databaseId) \\(.workflowName) \\(.status) \\(.conclusion) \\(.headSha[0:8])\\(if .event == "workflow_dispatch" then " (dispatched: sha is the ref it ran from, not necessarily what it deployed)" else "" end)"']);
    if (runs) { say('recent runs on this branch:'); for (const l of runs.split('\n')) say(`  ${l}`); }
  }
}

// Ledgers and notes that skills keep in git-ignored directories.
const LEDGER_DIRS = ['.superpowers', '.claude/ship', '.claude/verify'];
const recent = [];
const walk = (dir, depth) => {
  if (depth > 5 || !existsSync(dir)) return;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, depth + 1);
    else if (e.name.endsWith('.md')) {
      const m = statSync(p).mtimeMs;
      if (Date.now() - m < 3 * 86400000) recent.push([m, p]);
    }
  }
};
for (const d of LEDGER_DIRS) walk(join(root, d), 0);
recent.sort((a, b) => b[0] - a[0]);
if (recent.length) {
  say('ledgers and notes (.md) changed in the last 3 days (newest first):');
  for (const [m, p] of recent.slice(0, 15)) say(`  ${relative(root, p)}  (${age(m)})`);
}

const dir = ensureDir(handoffDir());
const pending = list().filter((h) => h.meta.status === 'pending');
say(`handoff directory: ${dir}`);
if (pending.length) {
  say('pending handoffs (a new one usually supersedes them):');
  for (const h of pending) say(`  ${h.name}  (${age(h.created)}) ${h.meta.title || ''}`);
}
const name = (process.argv[2] || branch || 'session').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '').replace(/^(\d{8})/, '$1-');
say(`suggested file: ${join(dir, `${stamp}-${name}.md`)}`);
say(`now: ${new Date().toISOString()}`);

process.stdout.write(out.join('\n') + '\n');
