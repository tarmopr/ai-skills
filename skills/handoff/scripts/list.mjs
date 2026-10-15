#!/usr/bin/env node
// Lists this repo's handoffs, newest first. Pending only, unless --all.
// Usage: node list.mjs [--all]
import { age, handoffDir, list } from './lib.mjs';

const all = process.argv.includes('--all');
const rows = list().filter((h) => all || h.meta.status === 'pending');
console.log(`handoff directory: ${handoffDir()}`);
if (!rows.length) { console.log(all ? 'no handoffs' : 'no pending handoffs'); process.exit(0); }
for (const h of rows) {
  console.log(`${h.meta.status === 'pending' ? 'PENDING ' : 'consumed'}  ${h.name}  (${age(h.created)})  ${h.meta.title || ''}`);
  console.log(`          ${h.file}`);
}
