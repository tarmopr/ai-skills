#!/usr/bin/env node
// Sets a handoff's status. Usage: node mark.mjs <handoff.md> consumed|pending
import { existsSync } from 'node:fs';
import { setMeta } from './lib.mjs';

const [file, status] = process.argv.slice(2);
if (!file || !existsSync(file) || !['consumed', 'pending'].includes(status)) {
  console.error('usage: mark.mjs <handoff.md> consumed|pending');
  process.exit(1);
}
setMeta(file, status === 'consumed'
  ? { status, consumed_at: new Date().toISOString() }
  : { status, consumed_at: '' });
console.log(`${file}: ${status}`);
