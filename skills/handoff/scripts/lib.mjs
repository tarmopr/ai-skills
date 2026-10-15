// Shared helpers for the handoff and continue-handoff skills.
// Node only, no dependencies, so it runs the same on macOS, Linux and Windows.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

export function run(cmd, args, cwd = process.cwd()) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', timeout: 15000 });
  if (r.error || r.status !== 0) return null;
  return r.stdout.trim();
}

// The main checkout's root, also from inside a worktree, so every worktree of
// one repo shares one handoff directory.
export function repoRoot(cwd = process.cwd()) {
  const common = run('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], cwd);
  if (common) return basename(common) === '.git' ? dirname(common) : common;
  return resolve(cwd);
}

// Same shape as Claude Code's own project slug: every non-alphanumeric becomes '-'.
export function slug(root) {
  return root.replace(/[^A-Za-z0-9]/g, '-');
}

export function handoffDir(cwd = process.cwd()) {
  return join(homedir(), '.claude', 'handoffs', slug(repoRoot(cwd)));
}

export function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
  return dir;
}

// Minimal frontmatter: `key: value` lines between the first two `---` lines.
export function parse(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const meta = {};
  if (!m) return { meta, body: text, raw: '' };
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s?(.*)$/);
    if (kv) meta[kv[1]] = kv[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return { meta, body: text.slice(m[0].length), raw: m[0] };
}

export function setMeta(file, updates) {
  const text = readFileSync(file, 'utf8');
  const { raw, body } = parse(text);
  if (!raw) throw new Error(`${file} has no frontmatter`);
  let lines = raw.replace(/^---\r?\n|\r?\n---\r?\n?$/g, '').split(/\r?\n/);
  for (const [k, v] of Object.entries(updates)) {
    const i = lines.findIndex((l) => l.startsWith(`${k}:`));
    if (i >= 0) lines[i] = `${k}: ${v}`;
    else lines.push(`${k}: ${v}`);
  }
  writeFileSync(file, `---\n${lines.join('\n')}\n---\n${body}`);
}

export function list(cwd = process.cwd()) {
  const dir = handoffDir(cwd);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const file = join(dir, f);
      const { meta } = parse(readFileSync(file, 'utf8'));
      const created = Date.parse(meta.created || '') || statSync(file).mtimeMs;
      return { file, name: f.replace(/\.md$/, ''), meta, created };
    })
    .sort((a, b) => b.created - a.created);
}

export function age(ms) {
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}
