// The TypeScript rename itself needs the target repo's `typescript` package, which this dependency-free repo
// doesn't have; these tests cover the parts that run without it: --help, argument errors and --text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'rename.mjs');
const run = (cwd, ...args) => spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' });
const scratch = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ts-rename-'));

test('--help prints usage and exits 0', () => {
  const r = run(scratch(), '--help');
  assert.equal(r.status, 0);
  assert.match(r.stdout, /--symbol <Name\|Container\.Name> --new-name <New>/);
  assert.match(r.stdout, /--text <Old> --new-name <New> --lines/);
});

test('an invalid new name is refused before anything runs', () => {
  const r = run(scratch(), '--symbol', 'a', '--new-name', '1bad');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /not an identifier: 1bad/);
});

test('--text replaces the whole word on the listed lines only', () => {
  const dir = scratch();
  const f = path.join(dir, 'a.ts');
  fs.writeFileSync(f, ['// current state', 'expect(src).toMatch(/\\bcurrent\\(/);', 'const currentX = current;', 'current;'].join('\n'));
  const r = run(dir, '--text', 'current', '--new-name', 'snapshot', '--lines', 'a.ts:1,2,3');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Replaced current -> snapshot: 3 mentions on 3 lines in 1 files\./);
  assert.deepEqual(fs.readFileSync(f, 'utf8').split('\n'),
    ['// snapshot state', 'expect(src).toMatch(/\\bsnapshot\\(/);', 'const currentX = snapshot;', 'current;']);
});

test('--text reports lines without the word and fails when nothing changed', () => {
  const dir = scratch();
  fs.writeFileSync(path.join(dir, 'a.ts'), 'other\n');
  const r = run(dir, '--text', 'current', '--new-name', 'snapshot', '--lines', 'a.ts:1');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /No current on \(nothing changed there\): a\.ts:1/);
});

test('--text refuses a file outside the repo, also through a symlink', () => {
  const repo = scratch(), outside = scratch();
  spawnSync('git', ['init', '-q'], { cwd: repo });
  const target = path.join(outside, 'b.ts');
  fs.writeFileSync(target, 'current\n');
  fs.symlinkSync(target, path.join(repo, 'link.ts'));
  for (const spec of [`${target}:1`, '../b.ts:1', 'link.ts:1']) {
    const r = run(repo, '--text', 'current', '--new-name', 'snapshot', '--lines', spec);
    if (spec === '../b.ts:1') { assert.equal(r.status, 1); continue; } // resolves to a missing file in the repo's parent
    assert.equal(r.status, 1, spec);
    assert.match(r.stderr, /outside the repo/, spec);
  }
  assert.equal(fs.readFileSync(target, 'utf8'), 'current\n');
});
