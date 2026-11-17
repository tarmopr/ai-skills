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
  assert.equal(git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'again', '--allow-empty').status, 0, 'git works');
  const run = (...args) => spawnSync(process.execPath, [script, ...args], { cwd: dir, encoding: 'utf8', env: { ...process.env, TMPDIR: dir } });
  const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8');
  return { dir, run, read, git };
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

  test('a property used through shorthand destructuring keeps the local name', (t) => {
    const r = repo(t, {
      'src/p.ts': 'export interface P { total: number }\n',
      'src/use.ts': "import type { P } from './p';\nexport function f({ total }: P) { return total; }\nexport function g(p: P) { const { total } = p; return total + 1; }\nexport const o: P = { total: 1 };\n",
    });
    const out = r.run('--symbol', 'P.total', '--new-name', 'sum');
    assert.equal(out.status, 0, out.stderr);
    assert.equal(r.read('src/p.ts'), 'export interface P { sum: number }\n');
    assert.equal(r.read('src/use.ts'), "import type { P } from './p';\nexport function f({ sum: total }: P) { return total; }\nexport function g(p: P) { const { sum: total } = p; return total + 1; }\nexport const o: P = { sum: 1 };\n");
  });

  test('renaming a destructured local does not touch the property it came from', (t) => {
    const r = repo(t, {
      'src/p.ts': 'export interface P { total: number }\nexport const def: P = { total: 1 };\n',
      'src/use.ts': "import { def } from './p';\nconst { total } = def;\nexport const v = total;\n",
    });
    const out = r.run('--at', 'src/use.ts:2:9', '--new-name', 'amount');
    assert.equal(out.status, 0, out.stderr);
    assert.equal(r.read('src/p.ts'), 'export interface P { total: number }\nexport const def: P = { total: 1 };\n');
    assert.equal(r.read('src/use.ts'), "import { def } from './p';\nconst { total: amount } = def;\nexport const v = amount;\n");
  });

  test('through an import and a local re-export, a shorthand property keeps its key', (t) => {
    const r = repo(t, {
      'src/a.ts': 'export const w = 1;\n',
      'src/f.ts': "import { w } from './a';\nexport { w };\n",
      'src/g.ts': "import { w } from './f';\nexport const o = { w };\n",
    });
    const out = r.run('--symbol', 'a.w', '--new-name', 'sumAll');
    assert.equal(out.status, 0, out.stderr);
    assert.equal(r.read('src/f.ts'), "import { sumAll } from './a';\nexport { sumAll };\n");
    assert.equal(r.read('src/g.ts'), "import { sumAll } from './f';\nexport const o = { w: sumAll };\n");
  });

  test('the file rename is a git rename', (t) => {
    const r = repo(t, { 'src/Widget.tsx': 'export const Widget = () => null;\n', 'src/main.ts': "import { Widget } from './Widget';\nexport const w = Widget;\n" });
    const out = r.run('--symbol', 'Widget', '--new-name', 'Gadget');
    assert.equal(out.status, 0, out.stderr);
    assert.match(r.git('status', '--porcelain').stdout, /^R. src\/Widget\.tsx -> src\/Gadget\.tsx$/m);
    assert.ok(!fs.existsSync(path.join(r.dir, 'src/Widget.tsx')));
  });

  test('--at mid-word or at a use site still renames the file', (t) => {
    for (const at of ['src/Widget.tsx:1:16', 'src/main.ts:2:18']) {
      const r = repo(t, { 'src/Widget.tsx': 'export const Widget = () => null;\n', 'src/main.ts': "import { Widget } from './Widget';\nexport const w = Widget;\n" });
      const out = r.run('--at', at, '--new-name', 'Gadget');
      assert.equal(out.status, 0, out.stderr);
      assert.match(out.stdout, /1 file renames/, at);
      assert.equal(r.read('src/Gadget.tsx'), 'export const Gadget = () => null;\n', at);
      assert.equal(r.read('src/main.ts'), "import { Gadget } from './Gadget';\nexport const w = Gadget;\n", at);
    }
  });

  test('a git mv that fails on a tracked file is reported; an untracked file is moved quietly', (t) => {
    const r = repo(t, { 'src/Widget.tsx': 'export const Widget = () => null;\n', 'src/main.ts': "import { Widget } from './Widget';\nexport const w = Widget;\n" });
    fs.writeFileSync(path.join(r.dir, '.git/index.lock'), '');
    const out = r.run('--symbol', 'Widget', '--new-name', 'Gadget');
    fs.rmSync(path.join(r.dir, '.git/index.lock'));
    assert.equal(out.status, 0, out.stderr);
    assert.match(out.stdout, /git mv failed .* on disk only: stage it with git add -A/);
    assert.ok(fs.existsSync(path.join(r.dir, 'src/Gadget.tsx')));
    assert.doesNotMatch(out.stdout, /Nothing else to check/);
    const u = repo(t, { 'src/main.ts': 'export const x = 1;\n' });
    fs.writeFileSync(path.join(u.dir, 'src/Thing.ts'), 'export const Thing = 1;\n');
    const out2 = u.run('--symbol', 'Thing', '--new-name', 'Item');
    assert.equal(out2.status, 0, out2.stderr);
    assert.doesNotMatch(out2.stdout, /git mv failed/);
    assert.ok(fs.existsSync(path.join(u.dir, 'src/Item.ts')));
  });

  test('configs with errors, configs matching no files and solution configs', (t) => {
    const r = repo(t, {
      'src/a.ts': 'export const one = 1;\n',
      'tsconfig.bad.json': '{"compilerOptions":{"bogusOption":true},"include":["src"]}\n',
      'tsconfig.ext.json': '{"extends":"./missing.json","include":["src"]}\n',
      'tsconfig.empty.json': '{"include":["nothing"]}\n',
      'tsconfig.solution.json': '{"files":[],"references":[{"path":"./tsconfig.json"}]}\n',
      'packages/tsconfig-utils/package.json': '{"name":"tsconfig-utils"}\n',
    });
    const out = r.run('--symbol', 'one', '--new-name', 'uno');
    assert.equal(out.status, 0, out.stderr);
    assert.equal(r.read('src/a.ts'), 'export const uno = 1;\n');
    assert.match(out.stdout, /tsconfig\.bad\.json loaded with errors/);
    assert.match(out.stdout, /tsconfig\.ext\.json loaded with errors/);
    assert.match(out.stdout, /Skipped tsconfig: tsconfig\.empty\.json \(matches no files\)/);
    assert.doesNotMatch(out.stdout, /solution|package\.json/);
    assert.doesNotMatch(out.stdout, /Nothing else to check/);
  });

  test('a not-found symbol still shows a skipped tsconfig', (t) => {
    const r = repo(t, { 'src/a.ts': 'export const one = 1;\n', 'tools/tsconfig.json': '{ not json' });
    const out = r.run('--symbol', 'nope', '--new-name', 'x');
    assert.equal(out.status, 2);
    assert.match(out.stderr, /not found: nope/);
    assert.match(out.stderr, /Skipped tsconfig: tools\/tsconfig\.json/);
  });

  test('more than 60 leftovers: 60 listed, all in a file; --all-leftovers lists all', (t) => {
    const lines = Array.from({ length: 70 }, (_, i) => `// counter ${i}`).join('\n');
    const r = repo(t, { 'src/a.ts': `export const counter = 1;\n${lines}\n` });
    const out = r.run('--symbol', 'counter', '--new-name', 'tally');
    assert.equal(out.status, 0, out.stderr);
    assert.equal(out.stdout.split('\n').filter((l) => / comment: /.test(l)).length, 60);
    const m = /Not listed: 10 more in changed files, mock keys, regexes and module paths\. All 70: (\S+)/.exec(out.stdout);
    assert.ok(m, out.stdout);
    assert.equal(fs.readFileSync(m[1], 'utf8').trim().split('\n').length, 70);
    const r2 = repo(t, { 'src/a.ts': `export const counter = 1;\n${lines}\n` });
    const out2 = r2.run('--symbol', 'counter', '--new-name', 'tally', '--all-leftovers');
    assert.equal(out2.stdout.split('\n').filter((l) => / comment: /.test(l)).length, 70);
    assert.doesNotMatch(out2.stdout, /Not listed/);
  });

  test('vi.mock and require paths follow a file rename; the factory key is listed', (t) => {
    const r = repo(t, {
      'src/Widget.ts': 'export const Widget = 1;\n',
      'src/w.test.ts': "declare const vi: { mock(p: string, f: () => unknown): void };\ndeclare function require(p: string): unknown;\nvi.mock('./Widget', () => ({ Widget: 2 }));\nexport const x = require('./Widget');\n",
    });
    const out = r.run('--symbol', 'Widget', '--new-name', 'Gadget');
    assert.equal(out.status, 0, out.stderr);
    assert.match(r.read('src/w.test.ts'), /vi\.mock\('\.\/Gadget'.*\nexport const x = require\('\.\/Gadget'\);/);
    assert.match(out.stdout, /src\/w\.test\.ts:3 mock key/);
  });

  test('an import path that does not resolve is listed, not dropped', (t) => {
    const r = repo(t, {
      'src/Widget.ts': 'export const Widget = 1;\n',
      'src/w.test.ts': "declare const vi: { mock(p: string): void };\nvi.mock('@app/Widget');\nexport {};\n",
    });
    const out = r.run('--symbol', 'Widget', '--new-name', 'Gadget');
    assert.equal(out.status, 0, out.stderr);
    assert.match(out.stdout, /src\/w\.test\.ts:2 module path: vi\.mock\('@app\/Widget'\)/);
  });

  test('--in-strings with a file rename is not an overlap', (t) => {
    const r = repo(t, { 'src/Widget.tsx': 'export const Widget = () => null;\n', 'src/main.ts': "import { Widget } from './Widget';\nexport const w = Widget;\n" });
    const out = r.run('--symbol', 'Widget', '--new-name', 'Gadget', '--in-strings');
    assert.equal(out.status, 0, out.stdout + out.stderr);
    assert.equal(r.read('src/main.ts'), "import { Gadget } from './Gadget';\nexport const w = Gadget;\n");
  });

  test('a write failure partway lists what was already written', (t) => {
    if (process.getuid?.() === 0) return; // root ignores the read-only bit
    const r = repo(t, { 'src/Widget.tsx': 'export const Widget = () => null;\n', 'src/main.ts': "import { Widget } from './Widget';\nexport const w = Widget;\n" });
    fs.chmodSync(path.join(r.dir, 'src/main.ts'), 0o444);
    const out = r.run('--symbol', 'Widget', '--new-name', 'Gadget');
    assert.equal(out.status, 1);
    assert.match(out.stdout, /Stopped partway: .*\nAlready written \(1\): src\/Widget\.tsx/);
  });

  test('exit codes: 3 ambiguous (nothing written, the printed --at works), 2 not found, 1 not renamable', (t) => {
    const r = repo(t, { 'src/a.ts': 'export const one = 1;\n', 'src/b.ts': 'export const one = 2;\n' });
    const amb = r.run('--symbol', 'one', '--new-name', 'uno');
    assert.equal(amb.status, 3);
    assert.equal(r.git('status', '--porcelain').stdout, '');
    const at = /--at (src\/a\.ts:\d+:\d+)/.exec(amb.stderr)[1];
    assert.equal(r.run('--at', at, '--new-name', 'uno').status, 0);
    assert.equal(r.read('src/a.ts'), 'export const uno = 1;\n');
    assert.equal(r.run('--symbol', 'nope', '--new-name', 'x').status, 2);
    const kw = r.run('--at', 'src/b.ts:1:1', '--new-name', 'x');
    assert.equal(kw.status, 1);
    assert.match(kw.stderr, /cannot rename/);
  });

  test('the printed --text command renames the listed lines, also after CR and U+2028 line breaks', (t) => {
    const r = repo(t, { 'src/a.ts': 'export const counter = 1;\r\n// a\r// b // counter here\n' });
    const out = r.run('--symbol', 'counter', '--new-name', 'tally');
    const cmd = /^ {2}node (".*?") --text (\S+) --new-name (\S+) --lines '?([^' ]+)'?$/m.exec(out.stdout);
    assert.ok(cmd, out.stdout);
    const res = spawnSync(process.execPath, [JSON.parse(cmd[1]), '--text', cmd[2], '--new-name', cmd[3], '--lines', cmd[4]], { cwd: r.dir, encoding: 'utf8' });
    assert.equal(res.status, 0, res.stderr);
    assert.equal(r.read('src/a.ts'), 'export const tally = 1;\r\n// a\r// b // tally here\n');
  });

  test('a rename --dry-run writes nothing', (t) => {
    const r = repo(t, { 'src/Widget.tsx': 'export const Widget = () => null;\n', 'src/main.ts': "import { Widget } from './Widget';\nexport const w = Widget;\n" });
    const out = r.run('--symbol', 'Widget', '--new-name', 'Gadget', '--dry-run');
    assert.equal(out.status, 0, out.stderr);
    assert.match(out.stdout, /^Would rename Widget -> Gadget/m);
    assert.equal(r.git('status', '--porcelain').stdout, '');
  });

  test('a member rename lists qualified mentions only, one line per line', (t) => {
    const r = repo(t, {
      'src/SessionCache.ts': 'export class SessionCache { current() { return 1; } }\nexport const cache = new SessionCache();\nexport const v = cache.current();\n',
      'docs/n.md': 'Call cache.current and current.\nThe current state.\nSessionCache current docs.\n',
    });
    const out = r.run('--symbol', 'SessionCache.current', '--new-name', 'snapshot');
    assert.equal(out.status, 0, out.stderr);
    assert.equal(out.stdout.split('\n').filter((l) => /^ {2}docs\/n\.md:1 /.test(l)).length, 1);
    assert.match(out.stdout, /^ {2}docs\/n\.md:3 /m);
    assert.match(out.stdout, /Ignore: .*1 unqualified mentions/);
  });

  test('run from another repo with absolute paths, the target repo is used', (t) => {
    const r = repo(t, { 'src/Widget.ts': 'export const Widget = 1;\n', 'src/use.ts': "import { Widget } from './Widget';\nexport const w = Widget;\n" });
    const other = repo(t, {});
    const out = spawnSync(process.execPath, [script, '--project', path.join(r.dir, 'tsconfig.json'), '--at', path.join(r.dir, 'src/Widget.ts:1:14'), '--new-name', 'Gadget'], { cwd: other.dir, encoding: 'utf8' });
    assert.equal(out.status, 0, out.stderr);
    assert.equal(r.read('src/use.ts'), "import { Gadget } from './Gadget';\nexport const w = Gadget;\n");
    assert.match(r.git('status', '--porcelain').stdout, /^R. src\/Widget\.ts -> src\/Gadget\.ts$/m);
  });

  // Only where the file system ignores case (macOS, Windows by default).
  if (fs.existsSync(path.join(os.tmpdir().toUpperCase() === os.tmpdir() ? os.tmpdir().toLowerCase() : os.tmpdir().toUpperCase()))) {
    test('a case-only rename renames the file', (t) => {
      const r = repo(t, { 'src/Widget.tsx': 'export const Widget = () => null;\n', 'src/main.ts': "import { Widget } from './Widget';\nexport const w = Widget;\n" });
      const out = r.run('--symbol', 'Widget', '--new-name', 'WIDGET');
      assert.equal(out.status, 0, out.stderr);
      assert.match(out.stdout, /1 file renames/);
      assert.ok(fs.readdirSync(path.join(r.dir, 'src')).includes('WIDGET.tsx'));
    });
  }

  // The check before writing: a rename that would add type errors writes nothing.
  const unchanged = (r) => assert.equal(r.git('status', '--porcelain').stdout, '');

  test('a library global with the new name is not a clash', (t) => {
    const r = repo(t, { 'src/a.ts': 'export function f() {\n  const foo = 2;\n  return foo;\n}\n' });
    const out = r.run('--at', 'src/a.ts:2:9', '--new-name', 'parseInt');
    assert.equal(out.status, 0, out.stdout + out.stderr);
    assert.match(r.read('src/a.ts'), /const parseInt = 2;\n {2}return parseInt;/);
  });

  test('a member renamed onto an existing member writes nothing and names the type error', (t) => {
    const r = repo(t, { 'src/c.ts': 'export class C {\n  alpha() { return 1; }\n  beta() { return 2; }\n}\n' });
    const out = r.run('--symbol', 'C.alpha', '--new-name', 'beta');
    assert.equal(out.status, 1);
    assert.match(out.stdout, /src\/c\.ts:2: TS2393 /);
    unchanged(r);
  });

  test('a key the rename misses (an object literal without a contextual type) fails the check', (t) => {
    const r = repo(t, { 'src/o.ts': 'export interface Opts { timeoutMs: number }\nexport function run(o: Opts) { return o.timeoutMs; }\nconst cfg = { timeoutMs: 5 };\nrun(cfg);\n' });
    const out = r.run('--symbol', 'Opts.timeoutMs', '--new-name', 'waitMs');
    assert.equal(out.status, 1);
    assert.match(out.stdout, /src\/o\.ts:4: TS2345 /);
    unchanged(r);
  });

  test('--allow-errors writes anyway and lists what the rename broke', (t) => {
    const r = repo(t, { 'src/o.ts': 'export interface Opts { timeoutMs: number }\nexport function run(o: Opts) { return o.timeoutMs; }\nconst cfg = { timeoutMs: 5 };\nrun(cfg);\n' });
    const out = r.run('--symbol', 'Opts.timeoutMs', '--new-name', 'waitMs', '--allow-errors');
    assert.equal(out.status, 0, out.stderr);
    assert.match(out.stdout, /Written with --allow-errors; the rename adds these type errors:\n {2}src\/o\.ts:4: TS2345 /);
    assert.match(out.stdout, /src\/o\.ts:3 identifier: const cfg = \{ timeoutMs: 5 \};/);
    assert.match(r.read('src/o.ts'), /interface Opts \{ waitMs: number \}/);
  });

  test('a member renamed onto a key another file already uses fails the check there', (t) => {
    const r = repo(t, {
      'src/i.ts': 'export interface I { alpha: number; beta?: number }\n',
      'src/use.ts': "import type { I } from './i';\nexport const x: I = { alpha: 1, beta: 2 };\n",
    });
    const out = r.run('--symbol', 'I.alpha', '--new-name', 'beta');
    assert.equal(out.status, 1);
    assert.match(out.stdout, /src\/use\.ts:2: TS1117 /);
    unchanged(r);
  });

  test('errors that were there before the rename are not counted', (t) => {
    const r = repo(t, { 'src/a.ts': 'export function foo() { return 1; }\nconst x: string = 1;\nexport const y = foo() + x;\n' });
    const out = r.run('--symbol', 'foo', '--new-name', 'bar');
    assert.equal(out.status, 0, out.stdout + out.stderr);
    assert.match(r.read('src/a.ts'), /function bar\(\)/);
  });

  test('uses of a name imported from a module the compiler cannot resolve are listed, not ignored', (t) => {
    const r = repo(t, {
      'src/d.ts': 'export function parseDate(s: string) { return s; }\n',
      'src/use.ts': "// @ts-ignore\nimport { parseDate } from '~/d';\nexport const x = parseDate('1');\n",
    });
    const out = r.run('--symbol', 'd.parseDate', '--new-name', 'readDate');
    assert.equal(out.status, 0, out.stdout + out.stderr);
    assert.match(out.stdout, /src\/use\.ts:2 unresolved import: import \{ parseDate \} from '~\/d';/);
    assert.match(out.stdout, /src\/use\.ts:3 unresolved import: /);
  });

  test('a reference that only a second tsconfig sees is renamed', (t) => {
    const r = repo(t, {
      'tsconfig.test.json': '{"compilerOptions":{"strict":true,"noEmit":true,"module":"esnext","moduleResolution":"bundler"},"include":["test"]}\n',
      'src/h.ts': 'export function helper() { return 1; }\n',
      'test/h.test.ts': "import { helper } from '../src/h';\nexport const t = helper();\n",
    });
    const out = r.run('--symbol', 'helper', '--new-name', 'assist');
    assert.equal(out.status, 0, out.stdout + out.stderr);
    assert.match(out.stdout, /2\/2 projects/);
    assert.equal(r.read('test/h.test.ts'), "import { assist } from '../src/h';\nexport const t = assist();\n");
  });

  test('references in files outside the repo are reported and exit 1', (t) => {
    const r = repo(t, {});
    const shared = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-rename-shared-'));
    t.after(() => fs.rmSync(shared, { recursive: true, force: true }));
    fs.writeFileSync(path.join(shared, 's.ts'), "import { helper } from '" + path.relative(shared, path.join(r.dir, 'src/h')) + "';\nexport const s = helper();\n");
    fs.mkdirSync(path.join(r.dir, 'src'));
    fs.writeFileSync(path.join(r.dir, 'src/h.ts'), 'export function helper() { return 1; }\n');
    fs.writeFileSync(path.join(r.dir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, noEmit: true, module: 'esnext', moduleResolution: 'bundler' }, include: ['src', path.relative(r.dir, shared)] }));
    const out = r.run('--symbol', 'helper', '--new-name', 'assist');
    assert.equal(out.status, 1, out.stdout + out.stderr);
    assert.match(out.stdout, /Not renamed: 2 references outside /);
    assert.match(fs.readFileSync(path.join(shared, 's.ts'), 'utf8'), /helper\(\)/);
  });

  test('a file rename onto an existing file is refused before anything is written', (t) => {
    const r = repo(t, { 'src/Widget.tsx': 'export const Widget = () => null;\n', 'src/Gadget.tsx': 'export const other = 1;\n' });
    const out = r.run('--symbol', 'Widget', '--new-name', 'Gadget');
    assert.equal(out.status, 1);
    assert.match(out.stdout, /Nothing changed: cannot rename src\/Widget\.tsx: src\/Gadget\.tsx already exists/);
    unchanged(r);
  });

  test('the printed --text command uses absolute paths when the repo is not the working directory\'s', (t) => {
    const r = repo(t, { 'src/Widget.ts': 'export const Widget = 1;\n', 'src/note.ts': '// Widget is used here\nexport {};\n' });
    const other = repo(t, { 'src/note.ts': '// Widget elsewhere\n' });
    const out = spawnSync(process.execPath, [script, '--at', path.join(r.dir, 'src/Widget.ts:1:14'), '--new-name', 'Gadget', '--no-file-rename'], { cwd: other.dir, encoding: 'utf8' });
    assert.equal(out.status, 0, out.stderr);
    const cmd = out.stdout.split('\n').find((l) => l.includes('--text')).trim();
    const args = [...cmd.matchAll(/'([^']*)'|(\S+)/g)].map((m) => m[1] ?? m[2]).slice(2); // drop `node` and the script
    const run2 = spawnSync(process.execPath, [script, ...args], { cwd: other.dir, encoding: 'utf8' });
    assert.equal(run2.status, 0, run2.stdout + run2.stderr);
    assert.equal(r.read('src/note.ts'), '// Gadget is used here\nexport {};\n');
    assert.equal(other.read('src/note.ts'), '// Widget elsewhere\n');
  });

  // Where the check finds a break, and renames that are fine.
  const refused = (r, out, re) => { assert.equal(out.status, 1, out.stdout + out.stderr); assert.match(out.stdout, re); unchanged(r); };

  test('an error the file already had with the same code is not reported in place of the new one', (t) => {
    const r = repo(t, { 'src/c.ts': 'export class C {\n  alpha() { return 1; }\n  beta() { return 2; }\n}\nclass D { x() {} x() {} }\n' });
    const out = r.run('--symbol', 'C.alpha', '--new-name', 'beta');
    refused(r, out, /src\/c\.ts:2: TS2393 /);
    assert.doesNotMatch(out.stdout, /src\/c\.ts:5:/);
  });

  test('an error already on a line the rename changes is not counted as new', (t) => {
    const r = repo(t, { 'src/a.ts': 'export function foo() { return 1; }\nexport const x: string = foo();\n' });
    const out = r.run('--symbol', 'foo', '--new-name', 'bar');
    assert.equal(out.status, 0, out.stdout + out.stderr);
    assert.match(r.read('src/a.ts'), /const x: string = bar\(\);/);
  });

  test('an error already on a line that is rewritten never blocks the rename', (t) => {
    const r = repo(t, {
      'src/q.ts': "export interface Q { limit: number }\nconst limit = 'x';\nexport const q: Q = { limit };\n",
      'src/u.ts': "import type { Q } from './q';\nconst maxRows = 'y';\nexport const n: number = maxRows;\nexport const m = (x: Q) => x.limit;\n",
    });
    const out = r.run('--symbol', 'Q.limit', '--new-name', 'maxRows');
    assert.equal(out.status, 0, out.stdout + out.stderr);
    assert.match(r.read('src/q.ts'), /\{ maxRows: limit \}/);
    assert.match(r.read('src/u.ts'), /x\.maxRows/);
  });

  test('a new error is found even when the rename fixes another of the same code in the file', (t) => {
    const r = repo(t, { 'src/a.ts': 'interface Box { oldProp: number; other: number }\nconst lit = { newProp: 1, other: 2 };\nexport const p: Box = lit;\nconst lit2 = { oldProp: 1, other: 2 };\nexport const q: Box = lit2;\n' });
    refused(r, r.run('--symbol', 'Box.oldProp', '--new-name', 'newProp'), /src\/a\.ts:5: TS2741 /);
  });

  test('an error that only gains or loses its "did you mean" is not new', (t) => {
    const r = repo(t, {
      'src/q.ts': 'export interface Q { limit: number }\nexport const f = (x: Q) => x.limit + x.limt;\n',
      'src/b.ts': 'export function foo() { return 1; }\nexport const v = foo() + bar2;\n',
    });
    let out = r.run('--symbol', 'Q.limit', '--new-name', 'maxRows');
    assert.equal(out.status, 0, out.stdout + out.stderr);
    r.git('checkout', '-q', '-f', '.');
    out = r.run('--symbol', 'foo', '--new-name', 'bar');
    assert.equal(out.status, 0, out.stdout + out.stderr);
    assert.match(r.read('src/b.ts'), /bar\(\) \+ bar2/);
  });

  test('a file rename of a file that already has an error is checked under the new path and written', (t) => {
    const r = repo(t, { 'src/Widget.ts': 'export function Widget() { return 1; }\nexport const n: number = "x";\n', 'src/use.ts': "import { Widget } from './Widget';\nexport const v = Widget();\n" });
    const out = r.run('--symbol', 'Widget', '--new-name', 'Gadget');
    assert.equal(out.status, 0, out.stdout + out.stderr);
    assert.ok(fs.existsSync(path.join(r.dir, 'src/Gadget.ts')));
  });

  test('a new name that is a keyword fails the check (syntax errors count)', (t) => {
    const r = repo(t, { 'src/a.ts': 'export function f() {\n  const item = 1;\n  return item;\n}\n' });
    refused(r, r.run('--at', 'src/a.ts:2:9', '--new-name', 'class'), /TS1\d{3} /);
  });

  test('a check that fails to run writes nothing, or writes unchecked with --allow-errors', (t) => {
    const r = repo(t, { 'src/a.ts': 'export function foo() { return 1; }\nexport const v = foo();\n' });
    const stub = path.join(r.dir, 'node_modules/typescript');
    fs.unlinkSync(stub);
    fs.mkdirSync(stub);
    fs.writeFileSync(path.join(stub, 'package.json'), '{"name":"typescript","main":"index.js"}\n');
    fs.writeFileSync(path.join(stub, 'index.js'), `const ts = require(${JSON.stringify(path.resolve(TS))});
module.exports = { ...ts, createLanguageService(h, r) { const ls = ts.createLanguageService(h, r); return { ...ls, getSemanticDiagnostics() { throw new Error('boom'); } }; } };\n`);
    refused(r, r.run('--symbol', 'foo', '--new-name', 'bar'), /^Nothing changed: the check of the result failed \(boom\)/);
    const out = r.run('--symbol', 'foo', '--new-name', 'bar', '--allow-errors');
    assert.equal(out.status, 0, out.stdout + out.stderr);
    assert.match(out.stdout, /The check of the result failed \(boom\); written unchecked with --allow-errors\./);
    assert.match(r.read('src/a.ts'), /bar\(\)/);
  });

  test('an error whose code the rename changes on its line is not new (namespace, default-export module, shorthand)', (t) => {
    const r = repo(t, {
      'src/n1.ts': 'export namespace N1 { export type Bar = 2; }\nexport type T = N1.Fooo;\n',
      'src/n2.ts': 'export namespace N2 { export type Foo = 1; }\nexport type T = N2.Fooo;\n',
      'src/m.ts': 'export function foo() { return 1; }\nexport default 1;\n',
      'src/u.ts': "import { foo, fooo } from './m';\nexport const v = foo();\n",
      'src/s.ts': 'const bar = 1;\nexport const o = { fooo, bar };\n',
    });
    for (const args of [['--symbol', 'N1.Bar', '--new-name', 'Foo'], ['--symbol', 'N2.Foo', '--new-name', 'Bar'], ['--symbol', 'm.foo', '--new-name', 'bar'], ['--at', 'src/s.ts:1:7', '--new-name', 'foo']]) {
      const out = r.run(...args);
      assert.equal(out.status, 0, args.join(' ') + '\n' + out.stdout + out.stderr);
      r.git('checkout', '-q', '-f', '.');
    }
  });

  test('a barrel that already exports the new name fails the check', (t) => {
    const r = repo(t, {
      'src/a.ts': 'export const foo = 1;\n', 'src/b.ts': 'export const bar = 2;\n',
      'src/index.ts': "export { foo } from './a';\nexport { bar } from './b';\n",
    });
    refused(r, r.run('--symbol', 'a.foo', '--new-name', 'bar'), /src\/index\.ts:\d: TS2300 /);
  });

  test('a member renamed onto one a base class already has fails the check', (t) => {
    const r = repo(t, {
      'src/base.ts': 'export class Base {\n  bar = "s";\n}\n',
      'src/c.ts': "import { Base } from './base';\nexport interface I { foo: number }\nexport class C extends Base implements I {\n  foo = 1;\n}\n",
    });
    refused(r, r.run('--symbol', 'I.foo', '--new-name', 'bar'), /TS2416 /);
  });

  test('--dry-run reports the problems and exits 1', (t) => {
    const r = repo(t, { 'src/c.ts': 'export class C {\n  alpha() { return 1; }\n  beta() { return 2; }\n}\n' });
    refused(r, r.run('--symbol', 'C.alpha', '--new-name', 'beta', '--dry-run'), /^Nothing changed: renaming alpha -> beta would add type errors:/);
  });

  test('a new name that exists elsewhere but changes no reference is not a problem', (t) => {
    const r = repo(t, {
      'src/api.ts': 'export function foo() { return 1; }\n',
      'src/q.ts': "import * as api from './api';\nimport { foo as f } from './api';\nconst bar = 2;\nexport function g(items: number[]) { return items.length + bar; }\nexport const v = api.foo() + f() + bar;\n",
      'src/t.ts': 'export interface Foo { a: number }\nexport const Bar = 1;\n',
      'src/fn.ts': 'export function bar() { return 1; }\nexport function h(items: number[]) { return items.length; }\n',
    });
    for (const [args, file, re] of [
      [['--symbol', 'api.foo', '--new-name', 'bar'], 'src/q.ts', /api\.bar\(\) \+ f\(\) \+ bar/],
      [['--symbol', 'Foo', '--new-name', 'Bar'], 'src/t.ts', /interface Bar \{/],
      [['--at', 'src/fn.ts:2:19', '--new-name', 'bar'], 'src/fn.ts', /function h\(bar: number\[\]\) \{ return bar\.length; \}/],
    ]) {
      const out = r.run(...args);
      assert.equal(out.status, 0, args.join(' ') + '\n' + out.stdout + out.stderr);
      assert.match(r.read(file), re, args.join(' '));
      r.git('checkout', '-q', '-f', '.');
    }
  });

  test('--at on an aliased import renames the alias only, and on a default import does not rename the file', (t) => {
    const r = repo(t, {
      'src/a.ts': 'export function foo() { return 1; }\n',
      'src/Widget.ts': 'export default function Widget() { return 1; }\n',
      'src/use.ts': "import { foo as f } from './a';\nimport Widget from './Widget';\nexport const v = f() + Widget();\n",
    });
    let out = r.run('--at', 'src/use.ts:3:18', '--new-name', 'g');
    assert.equal(out.status, 0, out.stdout + out.stderr);
    assert.equal(r.read('src/a.ts'), 'export function foo() { return 1; }\n');
    assert.match(r.read('src/use.ts'), /import \{ foo as g \} from '\.\/a';/);
    r.git('checkout', '-q', '-f', '.');
    out = r.run('--at', 'src/use.ts:3:24', '--new-name', 'Gadget');
    assert.equal(out.status, 0, out.stdout + out.stderr);
    assert.match(out.stdout, /0 file renames/);
    assert.ok(fs.existsSync(path.join(r.dir, 'src/Widget.ts')));
  });
}
