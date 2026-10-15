#!/usr/bin/env node
// Checks a handoff before it is announced: frontmatter, required sections, and
// that every file path and commit it names in backticks exists.
// Usage: node check.mjs <handoff.md>     exit 0 = ok, 1 = problems listed
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { parse, repoRoot, run } from './lib.mjs';

const file = process.argv[2];
if (!file || !existsSync(file)) { console.error(`usage: check.mjs <handoff.md> (got ${file})`); process.exit(1); }
const text = readFileSync(file, 'utf8');
const { meta, body } = parse(text);
const root = repoRoot();
const problems = [];

for (const k of ['title', 'created', 'repo', 'branch', 'head', 'status', 'resume']) {
  if (!meta[k]) problems.push(`frontmatter: missing \`${k}\``);
}
if (meta.status && !['pending', 'consumed'].includes(meta.status)) problems.push(`frontmatter: status must be pending or consumed`);
const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
if (fm && fm[1].split(/\r?\n/).some((l) => /^[ \t]+\S/.test(l))) problems.push('frontmatter: top-level keys must not be indented');

for (const s of ['## Resume', '## Goal', '## State', '## Next step', '## Decisions', '## Watch out', '## Pointers']) {
  if (!body.includes(`\n${s}`) && !body.startsWith(s)) problems.push(`missing section: ${s}`);
}

const EXT = /\.(md|mdx|ts|tsx|js|mjs|cjs|jsx|sql|json|jsonc|toml|ya?ml|sh|ps1|py|css|html|txt|log)$/;
const ticks = [...body.matchAll(/`([^`\n]+)`/g)].map((m) => m[1].trim());
for (const t of new Set(ticks)) {
  // A path: no spaces, no placeholders, ends in a known extension or a slash.
  const p = t.replace(/:\d+(-\d+)?$/, '');
  if (!/\s|[<>*…{}$]|^https?:/.test(p) && (EXT.test(p) || p.endsWith('/')) && p.includes('/')) {
    const abs = p.startsWith('~/') ? join(homedir(), p.slice(2)) : isAbsolute(p) ? p : join(root, p);
    if (!existsSync(abs)) problems.push(`path not found: ${t}`);
  }
  // A commit: 7–40 hex with at least one letter (run ids and migration versions are all digits).
  if (/^[0-9a-f]{7,40}$/.test(t) && /[a-f]/.test(t)) {
    if (run('git', ['cat-file', '-e', `${t}^{commit}`], root) === null) problems.push(`commit not found locally: ${t} (fetch, or fix it)`);
  }
}

if (problems.length) {
  console.log(`${file}\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  process.exit(1);
}
console.log(`ok: ${file}`);
