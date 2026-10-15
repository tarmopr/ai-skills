#!/usr/bin/env node
// SessionStart hook: after a fresh start or /clear, tell Claude that this repo
// has a pending handoff, so it can offer /continue-handoff.
// A hint, not a gate: any failure exits 0 silently and the session starts as normal.
import { age, list } from './lib.mjs';

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { input += c; });
process.stdin.on('end', () => {
  try {
    let source = 'startup';
    let cwd = process.cwd();
    try { const j = JSON.parse(input || '{}'); source = j.source || source; cwd = j.cwd || cwd; } catch {}
    // After a compaction the summary already carries the work, and a resumed
    // conversation has its own history; a handoff would only compete with them.
    if (!['startup', 'clear'].includes(source)) return;
    const pending = list(cwd).filter((h) => h.meta.status === 'pending').slice(0, 3);
    if (!pending.length) return;
    const lines = pending.map((h) => `- ${h.name} (${age(h.created)}): ${h.meta.title || ''} — ${h.file}`);
    const context = [
      'Pending handoff(s) for this repo, written by an earlier session:',
      ...lines,
      'Do not act on it unprompted. In your first reply, mention it in one line and say the user can type `/continue-handoff` (or `/continue-handoff <name>`) to pick it up — unless the user\'s first message is clearly about something else, in which case mention it after answering.',
    ].join('\n');
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context } }));
  } catch {
    // never block a session start
  }
});
