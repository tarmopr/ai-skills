// Renames that need a `typescript` package, which this dependency-free repo doesn't have. They run only when
// TS_RENAME_TYPESCRIPT names a typescript package folder (e.g. some-repo/node_modules/typescript); without it
// this file defines no tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TS = process.env.TS_RENAME_TYPESCRIPT;
const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'rename.mjs');

function repo(t, files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-rename-ts-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const git = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8' });
  git('init', '-q');
  fs.mkdirSync(path.join(dir, 'node_modules'));
  fs.symlinkSync(path.resolve(TS), path.join(dir, 'node_modules/typescript'));
  const all = { 'package.json': '{"name":"x","private":true}\n', '.gitignore': 'node_modules\n',
    'tsconfig.json': '{"compilerOptions":{"strict":true,"jsx":"react-jsx","noEmit":true,"module":"esnext","moduleResolution":"bundler"},"include":["src"]}\n', ...files };
  for (const [f, text] of Object.entries(all)) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), text); }
  git('add', '-A');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'base');
  const run = (...args) => spawnSync(process.execPath, [script, ...args], { cwd: dir, encoding: 'utf8' });
  const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8');
  return { dir, run, read };
}

if (TS) {
  test('a re-export does not stop the rename: barrel consumers and local export lists are renamed', (t) => {
    const r = repo(t, {
      'src/utils.ts': 'export function formatFailure(e: unknown) { return String(e); }\n',
      'src/index.ts': "export { formatFailure } from './utils';\n",
      'src/app.ts': "import { formatFailure } from './index';\nexport const a = formatFailure(1);\n",
    });
    const out = r.run('--symbol', 'utils.formatFailure', '--new-name', 'toErrorText');
    assert.equal(out.status, 0, out.stderr);
    assert.equal(r.read('src/index.ts'), "export { toErrorText } from './utils';\n");
    assert.equal(r.read('src/app.ts'), "import { toErrorText } from './index';\nexport const a = toErrorText(1);\n");
  });

  test('a local export list does not stop the rename', (t) => {
    const r = repo(t, {
      'src/h.ts': 'function helper() { return 1; }\nexport { helper };\n',
      'src/use.ts': "import { helper } from './h';\nexport const v = helper();\n",
    });
    const out = r.run('--symbol', 'h.helper', '--new-name', 'assist');
    assert.equal(out.status, 0, out.stderr);
    assert.equal(r.read('src/h.ts'), 'function assist() { return 1; }\nexport { assist };\n');
    assert.equal(r.read('src/use.ts'), "import { assist } from './h';\nexport const v = assist();\n");
  });

  test('a shorthand property keeps its key', (t) => {
    const r = repo(t, { 'src/v.ts': 'const total = 1;\nexport const o = { total };\n' });
    const out = r.run('--at', 'src/v.ts:1:7', '--new-name', 'sum');
    assert.equal(out.status, 0, out.stderr);
    assert.equal(r.read('src/v.ts'), 'const sum = 1;\nexport const o = { total: sum };\n');
  });

  test('export const Widget in Widget.tsx renames the file and its import paths', (t) => {
    const r = repo(t, {
      'src/Widget.tsx': 'export const Widget = () => null;\n',
      'src/main.ts': "import { Widget } from './Widget';\nexport const w = Widget;\n",
    });
    const out = r.run('--symbol', 'Widget', '--new-name', 'Gadget');
    assert.equal(out.status, 0, out.stderr);
    assert.match(out.stdout, /1 file renames/);
    assert.ok(fs.existsSync(path.join(r.dir, 'src/Gadget.tsx')));
    assert.equal(r.read('src/main.ts'), "import { Gadget } from './Gadget';\nexport const w = Gadget;\n");
    assert.match(out.stdout, /Nothing else to check\./);
  });

  test('with --no-file-rename, import paths are not listed as leftovers', (t) => {
    const r = repo(t, {
      'src/Widget.tsx': 'export const Widget = () => null;\n',
      'src/main.ts': "import { Widget } from './Widget';\nexport const w = Widget;\n",
    });
    const out = r.run('--symbol', 'Widget', '--new-name', 'Gadget', '--no-file-rename');
    assert.equal(out.status, 0, out.stderr);
    assert.doesNotMatch(out.stdout, /--text/);
    assert.equal(r.read('src/main.ts'), "import { Gadget } from './Widget';\nexport const w = Gadget;\n");
  });

  test('a string passed to an ordinary call is a leftover; a module path is not', (t) => {
    const r = repo(t, {
      'src/Widget.tsx': 'export const Widget = () => null;\n',
      'src/w.test.ts': "import { Widget } from './Widget';\nconst it = (s: string, f: () => void) => f();\nit('Widget renders', () => { void Widget; });\nconst m = import('./Widget');\nvoid m;\n",
    });
    const out = r.run('--symbol', 'Widget', '--new-name', 'Gadget', '--no-file-rename');
    assert.equal(out.status, 0, out.stderr);
    assert.match(out.stdout, /src\/w\.test\.ts:3 string: it\('Widget renders'/);
    assert.match(out.stdout, /--lines 'src\/w\.test\.ts:3'$/m);
    assert.doesNotMatch(out.stdout, /w\.test\.ts:[14]/);
  });

  test('a non-ASCII file name among the leftovers is listed, not a crash', (t) => {
    const r = repo(t, {
      'src/a.ts': 'export function formatFailure() {}\n',
      'docs/ülevaade.md': 'Call formatFailure here.\n',
    });
    const out = r.run('--symbol', 'formatFailure', '--new-name', 'toErrorText');
    assert.equal(out.status, 0, out.stderr);
    assert.match(out.stdout, /docs\/ülevaade\.md:1 not compiled/);
  });

  test('a member rename in a file whose name has regex characters does not crash', (t) => {
    const r = repo(t, {
      'src/+page.ts': 'export class Loader { run() { return 1; } }\nexport const v = new Loader().run();\n',
      'src/other.ts': '// run the thing\nexport const x = 1;\n',
    });
    const out = r.run('--symbol', 'Loader.run', '--new-name', 'go');
    assert.equal(out.status, 0, out.stderr);
    assert.equal(r.read('src/+page.ts'), 'export class Loader { go() { return 1; } }\nexport const v = new Loader().go();\n');
  });

  test('a type declared in a .d.ts file is found by name', (t) => {
    const r = repo(t, { 'src/types.d.ts': 'interface Shape { a: number }\n', 'src/u.ts': 'export const s: Shape = { a: 1 };\n' });
    const out = r.run('--symbol', 'Shape', '--new-name', 'Form', '--no-file-rename');
    assert.equal(out.status, 0, out.stderr);
    assert.equal(r.read('src/u.ts'), 'export const s: Form = { a: 1 };\n');
  });

  test('an --at path from the exit-3 list works from a subdirectory', (t) => {
    const r = repo(t, { 'src/a.ts': 'export const one = 1;\n' });
    const out = spawnSync(process.execPath, [script, '--at', 'src/a.ts:1:14', '--new-name', 'uno'], { cwd: path.join(r.dir, 'src'), encoding: 'utf8' });
    assert.equal(out.status, 0, out.stderr);
    assert.equal(r.read('src/a.ts'), 'export const uno = 1;\n');
  });

  test('a tsconfig that fails to load is reported, not skipped silently', (t) => {
    const r = repo(t, { 'src/a.ts': 'export const one = 1;\n', 'tools/tsconfig.json': '{ not json' });
    const out = r.run('--symbol', 'one', '--new-name', 'uno');
    assert.equal(out.status, 0, out.stderr);
    assert.match(out.stdout, /Skipped tsconfig: tools\/tsconfig\.json/);
  });
}
