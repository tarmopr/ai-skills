// The TypeScript rename itself needs the target repo's `typescript` package, which this dependency-free repo
// doesn't have (rename.ts.test.mjs covers it when TS_RENAME_TYPESCRIPT is set); these tests cover the parts that
// run without it: --help, argument errors and --text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'rename.mjs');
const run = (cwd, ...args) => spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' });
// A git repo of its own, so the repo root never depends on where the temp folder is.
function scratch(t, files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-rename-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  spawnSync('git', ['init', '-q'], { cwd: dir });
  for (const [f, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), text); }
  return dir;
}
const read = (dir, f) => fs.readFileSync(path.join(dir, f), 'utf8');

test('--help prints usage and exits 0', (t) => {
  const r = run(scratch(t), '--help');
  assert.equal(r.status, 0);
  assert.match(r.stdout, /--symbol <Name\|Container\.Name> --new-name <New>/);
  assert.match(r.stdout, /--text <Old> --new-name <New> --lines/);
});

test('argument errors exit 1 before anything runs', (t) => {
  const dir = scratch(t);
  for (const [args, msg] of [
    [['--symbol', 'a', '--new-name', '1bad'], /not an identifier: 1bad/],
    [['--symbol', 'a'], /--new-name <New>/],
    [['--symbol', 'a', '--at', 'x.ts:1:1', '--new-name', 'b'], /pass exactly one of --symbol or --at/],
    [['--symbol', 'a', '--new-name'], /--new-name needs a value/],
    [['--symbol', 'a', '--new-name', 'b'], /typescript is not installed/],
    [['--text', 'a', '--new-name', 'b'], /--text needs --lines/],
    [['--text', 'a.b', '--new-name', 'b', '--lines', 'x.ts:1'], /not an identifier: a\.b/],
    [['--text', 'a', '--new-name', 'b', '--lines', 'x.ts'], /--lines must be <file>:<line>,<line>: x\.ts/],
    [['--text', 'a', '--new-name', 'b', '--lines', 'x.ts:,'], /--lines must be <file>:<line>,<line>: x\.ts:,/],
    [['--text', 'a', '--symbol', 'a', '--new-name', 'b', '--lines', 'x.ts:1'], /--text takes no --symbol or --at/],
  ]) {
    const r = run(dir, ...args);
    assert.equal(r.status, 1, args.join(' '));
    assert.match(r.stderr, msg, args.join(' '));
  }
});

test('--text replaces the whole word on the listed lines only', (t) => {
  const dir = scratch(t, { 'a.ts': ['// current state', 'expect(src).toMatch(/\\bcurrent\\(/);', 'const currentX = current; $current; current$;', 'current;', 'current current'].join('\n') });
  const r = run(dir, '--text', 'current', '--new-name', 'snapshot', '--lines', 'a.ts:1,2,3', '--lines', 'a.ts:5');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, 'Replaced current -> snapshot: 5 mentions on 4 lines in 1 files.\n');
  assert.deepEqual(read(dir, 'a.ts').split('\n'),
    ['// snapshot state', 'expect(src).toMatch(/\\bsnapshot\\(/);', 'const currentX = snapshot; $current; current$;', 'current;', 'snapshot snapshot']);
});

test('--text keeps CRLF line endings', (t) => {
  const dir = scratch(t, { 'a.ts': 'current\r\nother\r\n' });
  const r = run(dir, '--text', 'current', '--new-name', 'snapshot', '--lines', 'a.ts:1');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(read(dir, 'a.ts'), 'snapshot\r\nother\r\n');
});

test('--text paths are relative to the repo root, also from a subdirectory', (t) => {
  const dir = scratch(t, { 'sub/f.ts': 'current\n' });
  const r = run(path.join(dir, 'sub'), '--text', 'current', '--new-name', 'snapshot', '--lines', 'sub/f.ts:1');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(read(dir, 'sub/f.ts'), 'snapshot\n');
});

test('--text reports lines without the word on stdout and still replaces the rest', (t) => {
  const dir = scratch(t, { 'a.ts': 'current\nother\n' });
  const r = run(dir, '--text', 'current', '--new-name', 'snapshot', '--lines', 'a.ts:1,2');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, 'Replaced current -> snapshot: 1 mentions on 1 lines in 1 files.\nNo current on (nothing changed there): a.ts:2\n');
});

test('--text fails and writes nothing when no listed line has the word', (t) => {
  const dir = scratch(t, { 'a.ts': 'other\n' });
  const r = run(dir, '--text', 'current', '--new-name', 'snapshot', '--lines', 'a.ts:1');
  assert.equal(r.status, 1);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /No current on \(nothing changed there\): a\.ts:1/);
  assert.equal(read(dir, 'a.ts'), 'other\n');
});

test('--text --dry-run writes nothing', (t) => {
  const dir = scratch(t, { 'a.ts': 'current\n' });
  const r = run(dir, '--text', 'current', '--new-name', 'snapshot', '--lines', 'a.ts:1', '--dry-run');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, 'Would replace current -> snapshot: 1 mentions on 1 lines in 1 files.\n');
  assert.equal(read(dir, 'a.ts'), 'current\n');
});

test('--text refuses a file outside the repo before writing any file', (t) => {
  const outside = scratch(t, { 'b.ts': 'current\n' });
  const dir = scratch(t, { 'a.ts': 'current\n' });
  fs.symlinkSync(path.join(outside, 'b.ts'), path.join(dir, 'link.ts'));
  for (const spec of [path.join(outside, 'b.ts:1'), `../${path.basename(outside)}/b.ts:1`, 'link.ts:1']) {
    const r = run(dir, '--text', 'current', '--new-name', 'snapshot', '--lines', 'a.ts:1', '--lines', spec);
    assert.equal(r.status, 1, spec);
    assert.match(r.stderr, /Nothing changed: .* is outside the repo/, spec);
  }
  assert.equal(read(outside, 'b.ts'), 'current\n');
  assert.equal(read(dir, 'a.ts'), 'current\n');
});
