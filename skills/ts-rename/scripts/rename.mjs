#!/usr/bin/env node
// Renames a TypeScript symbol and every reference to it across every tsconfig in a repo,
// using the TypeScript language service of the repo's own `typescript` package.
// Exit codes: 0 done, 1 error, 2 not found, 3 ambiguous.
import { createRequire } from 'node:module';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const t0 = Date.now();
const die = (code, msg) => { process.stderr.write(msg.endsWith('\n') ? msg : msg + '\n'); process.exit(code); };

// ---------- args ----------
const SELF = `"${process.argv[1]}"`; // absolute and double-quoted, like SKILL.md's allowed-tools pattern after ${CLAUDE_SKILL_DIR} expands
const USAGE = `Rename a TS symbol and every reference in every tsconfig*.json project of the repo:
  node ${SELF} --symbol <Name|Container.Name> --new-name <New>
  node ${SELF} --at <file>:<line>:<col> --new-name <New>       (locals, parameters, exit-3 candidates)
Container: a class, interface, function or the file's base name, chainable (apiClient.RequestOptions.timeoutMs).
Options: --project <tsconfig> (repeatable)  --in-comments  --in-strings  --no-file-rename  --dry-run  --verbose  --all-leftovers
Replace a word on given lines only (for the leftovers a rename lists; no type checking):
  node ${SELF} --text <Old> --new-name <New> --lines <file>:<line>,<line> [--lines <file>:<line>]...
Exit codes: 0 done, 1 error, 2 not found, 3 ambiguous (stderr lists --at candidates).
--text exits 1 when no listed line had the word; lines without it are named on stdout.`;
const argv = process.argv.slice(2);
const opts = { inComments: false, inStrings: false, fileRename: true, dryRun: false, verbose: false, projects: [], lines: [] };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  const next = () => { if (i + 1 >= argv.length) die(1, `${a} needs a value`); return argv[++i]; };
  switch (a) {
    case '--help': case '-h': process.stdout.write(USAGE + '\n'); process.exit(0); // process.exit never returns
    case '--text': opts.text = next(); break;
    case '--lines': opts.lines.push(next()); break;
    case '--symbol': opts.symbol = next(); break;
    case '--at': opts.at = next(); break;
    case '--new-name': opts.newName = next(); break;
    case '--project': opts.projects.push(next()); break;
    case '--in-comments': opts.inComments = true; break;
    case '--in-strings': opts.inStrings = true; break;
    case '--no-file-rename': opts.fileRename = false; break;
    case '--dry-run': opts.dryRun = true; opts.verbose = true; break;
    case '--verbose': opts.verbose = true; break;
    case '--all-leftovers': opts.allLeftovers = true; break;
    default: die(1, `unknown argument: ${a}`);
  }
}
if (!opts.newName) die(1, USAGE);
if (!/^[A-Za-z_$][\w$]*$/.test(opts.newName)) die(1, `not an identifier: ${opts.newName}`);
const isIdent = (w) => /^[A-Za-z_$][\w$]*$/.test(w);
const escRe = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Whole word. A regex escape such as \b, \w or \n right before it also counts as a boundary, so the name in
// a regex literal like /\bparseDate\(/ is found.
const wordRe = (w) => new RegExp(`(?:(?<![\\w$])|(?<=\\\\[bBdDwWsSnrt]))${escRe(w)}(?![\\w$])`, 'g');
// Lines as the TypeScript parser counts them (CRLF, LF, lone CR, U+2028, U+2029), separators kept for rejoining:
// even indexes are lines, odd ones their line breaks.
const splitLines = (text) => text.split(/(\r\n|[\n\r\u2028\u2029])/);

// ---------- repo ----------
let root;
try { root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim(); }
catch { root = process.cwd(); }
root = path.resolve(root);
const norm = (p) => path.resolve(p).split(path.sep).join('/');
const rel = (p) => path.relative(root, p).split(path.sep).join('/');

// ---------- --text: replace a whole word on the given lines only ----------
// Every spec is checked before any file is written, so a refusal leaves everything as it was.
if (opts.text !== undefined) {
  if (opts.symbol || opts.at) die(1, '--text takes no --symbol or --at');
  if (!isIdent(opts.text)) die(1, `not an identifier: ${opts.text}`);
  if (!opts.lines.length) die(1, '--text needs --lines <file>:<line>,<line>');
  const re = wordRe(opts.text);
  const realRoot = fs.realpathSync(root);
  const plan = new Map(); // abs -> { name, lines: Set }
  const missed = [];
  for (const spec of opts.lines) {
    const m = /^(.*):(\d+(?:,\d+)*)$/.exec(spec);
    if (!m) die(1, `--lines must be <file>:<line>,<line>: ${spec}`);
    const abs = path.resolve(root, m[1]); // the paths a rename prints are relative to the repo root
    if (!fs.existsSync(abs)) { missed.push(`${m[1]} (no such file)`); continue; }
    if (!fs.realpathSync(abs).startsWith(realRoot + path.sep)) die(1, `Nothing changed: ${m[1]} is outside the repo (${root})`);
    if (!plan.has(abs)) plan.set(abs, { name: m[1], lines: new Set() });
    for (const ln of m[2].split(',')) plan.get(abs).lines.add(Number(ln));
  }
  let n = 0, nLines = 0; const writes = [];
  for (const [abs, { name, lines }] of plan) {
    const parts = splitLines(fs.readFileSync(abs, 'utf8'));
    let changed = false;
    for (const ln of lines) {
      const before = parts[(ln - 1) * 2];
      const after = before === undefined ? before : before.replace(re, () => { n++; return opts.newName; });
      if (before === undefined || after === before) { missed.push(`${name}:${ln}`); continue; }
      parts[(ln - 1) * 2] = after; nLines++; changed = true;
    }
    if (changed) writes.push([abs, parts.join('')]);
  }
  const out = `${opts.dryRun ? 'Would replace' : 'Replaced'} ${opts.text} -> ${opts.newName}: ${n} mentions on ${nLines} lines in ${writes.length} files.`;
  const miss = missed.length ? `\nNo ${opts.text} on (nothing changed there): ${missed.join(', ')}` : '';
  if (!n) die(1, out + miss);
  if (!opts.dryRun) for (const [abs, text] of writes) fs.writeFileSync(abs, text);
  process.stdout.write(out + miss + '\n');
  process.exit(0);
}
if (!!opts.symbol === !!opts.at) die(1, 'pass exactly one of --symbol or --at');

// ---------- typescript ----------

let ts;
try { ts = createRequire(path.join(root, 'package.json'))('typescript'); }
catch (e) { die(1, `typescript is not installed in ${root} (run npm install): ${e.message.split('\n')[0]}`); }
const notices = []; // printed on stdout with the summary: what the agent must know was not covered

// ---------- projects ----------
function discoverProjects() {
  let files;
  try {
    files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', '*tsconfig*.json'], { cwd: root, encoding: 'utf8' })
      .split('\n').filter(Boolean);
  } catch (e) {
    files = fs.existsSync(path.join(root, 'tsconfig.json')) ? ['tsconfig.json'] : [];
    notices.push(`Only ${files[0] ?? 'no tsconfig'} used: git ls-files failed (${String(e.message).split('\n')[0]}); pass --project for the others.`);
  }
  return files.filter((f) => !f.includes('node_modules/')).map((f) => path.join(root, f));
}
const configPaths = (opts.projects.length ? opts.projects.map((p) => (fs.existsSync(path.resolve(p)) ? path.resolve(p) : path.resolve(root, p))) : discoverProjects());
if (!configPaths.length) die(1, 'no tsconfig*.json found');

const registry = ts.createDocumentRegistry(ts.sys.useCaseSensitiveFileNames, root);
const versions = new Map();
const services = [];
const configErrors = [];
for (const cfg of configPaths) {
  const read = ts.readConfigFile(cfg, ts.sys.readFile);
  if (read.error) { configErrors.push(`${rel(cfg)} (${ts.flattenDiagnosticMessageText(read.error.messageText, ' ')})`); continue; }
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, path.dirname(cfg), undefined, cfg);
  const errs = parsed.errors.filter((d) => d.code !== 18003); // 18003: no inputs, handled below
  if (!parsed.fileNames.length) {
    // A solution config ("files": [] plus references) has nothing of its own; any other config matching no file is reported.
    const solution = Array.isArray(read.config.files) && !read.config.files.length && read.config.references?.length;
    if (!solution) configErrors.push(`${rel(cfg)} (matches no files)`);
    continue;
  }
  if (errs.length) notices.push(`${rel(cfg)} loaded with errors, so references may be missed: ${errs.map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' ')).join('; ')}`);
  const host = {
    getScriptFileNames: () => parsed.fileNames,
    getScriptVersion: (f) => String(versions.get(norm(f)) ?? 0),
    getScriptSnapshot: (f) => (fs.existsSync(f) ? ts.ScriptSnapshot.fromString(fs.readFileSync(f, 'utf8')) : undefined),
    getCurrentDirectory: () => path.dirname(cfg),
    getCompilationSettings: () => parsed.options,
    getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
    fileExists: ts.sys.fileExists, readFile: ts.sys.readFile, readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists, getDirectories: ts.sys.getDirectories, realpath: ts.sys.realpath,
    useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
  };
  services.push({ cfg, ls: ts.createLanguageService(host, registry) });
}
if (!services.length) die(1, `no loadable tsconfig:\n${configErrors.join('\n')}`);
if (configErrors.length) notices.push(`Skipped tsconfig: ${configErrors.join(', ')}. Its files were not renamed; check them or pass --project.`);

const inRepo = (f) => { const n = norm(f); return n.startsWith(norm(root) + '/') && !n.includes('/node_modules/'); };
const programOf = (s) => (s.program ??= s.ls.getProgram());

// ---------- locate the declaration ----------
function nameNodeAt(sf, start, end) {
  let found;
  const visit = (node) => {
    if (found) return;
    if (node.getStart(sf) === start && node.end === end) {
      const n = ts.getNameOfDeclaration(node);
      if (n) { found = n; return; }
    }
    if (node.pos <= start && node.end >= end) ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

let target; // { file, pos }
if (opts.at) {
  const m = /^(.*):(\d+):(\d+)$/.exec(opts.at);
  if (!m) die(1, '--at must be <file>:<line>:<col> (1-based)');
  // Relative to the working directory, else to the repo root (as the exit-3 candidates print it).
  const file = fs.existsSync(path.resolve(m[1])) ? path.resolve(m[1]) : path.resolve(root, m[1]);
  if (!fs.existsSync(file)) die(2, `file not found: ${m[1]}`);
  const text = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  let pos;
  try { pos = sf.getPositionOfLineAndCharacter(Number(m[2]) - 1, Number(m[3]) - 1); }
  catch { die(2, `position out of range: ${opts.at}`); }
  target = { file, pos };
} else {
  const parts = opts.symbol.split('.');
  const name = parts.pop();
  const container = parts.join('.');
  const seen = new Map();
  for (const s of services) {
    const items = s.ls.getNavigateToItems(name, 500, undefined, false); // false: include the repo's own .d.ts files
    for (const it of items) {
      if (it.name !== name || it.kind === 'alias' || !inRepo(it.fileName)) continue;
      if (container && !(it.containerName === container || it.containerName?.endsWith('.' + container)
        || it.containerName === `"${container}"`
        || path.basename(it.fileName).replace(/\.(d\.ts|tsx?|mts|cts)$/, '') === container
        || `${path.basename(it.fileName).replace(/\.(d\.ts|tsx?|mts|cts)$/, '')}.${it.containerName}` === container)) continue;
      const key = `${norm(it.fileName)}:${it.textSpan.start}`;
      if (!seen.has(key)) seen.set(key, { s, it });
    }
  }
  if (!seen.size) die(2, `not found: ${opts.symbol}${container ? '' : ' (for a member try Container.Name, for a local use --at)'}`);
  // One symbol can show up as several declarations (overloads, declaration merging): group by rename identity.
  const groups = new Map();
  for (const { s, it } of seen.values()) {
    const sf = programOf(s).getSourceFile(it.fileName);
    const nameNode = sf && nameNodeAt(sf, it.textSpan.start, it.textSpan.start + it.textSpan.length);
    const pos = nameNode ? nameNode.getStart(sf) : it.textSpan.start;
    const lc = sf ? sf.getLineAndCharacterOfPosition(pos) : { line: 0, character: 0 };
    const locs = s.ls.findRenameLocations(it.fileName, pos, false, false, { providePrefixAndSuffixTextForRename: true }) ?? [];
    const decl = locs.map((l) => `${norm(l.fileName)}:${l.textSpan.start}`).sort()[0] ?? `${norm(it.fileName)}:${pos}`;
    if (!groups.has(decl)) groups.set(decl, { file: it.fileName, pos, it, where: `${rel(it.fileName)}:${lc.line + 1}:${lc.character + 1}` });
  }
  if (groups.size > 1) {
    const all = [...groups.values()];
    const lines = all.slice(0, 10).map((g) => `  --at ${g.where}  ${g.it.kind} ${g.it.containerName ? g.it.containerName + '.' : ''}${g.it.name}`);
    if (all.length > 10) lines.push(`  … ${all.length - 10} more; narrow with --symbol <Container or file base name>.${name}`);
    die(3, `Nothing changed: ${opts.symbol} matches ${all.length} symbols. Rerun with one of:\n${lines.join('\n')}`);
  }
  const g = [...groups.values()][0];
  target = { file: g.file, pos: g.pos };
}

// ---------- rename info ----------
const owners = services.filter((s) => programOf(s).getSourceFile(target.file));
if (!owners.length) die(1, `${rel(target.file)} is not part of any tsconfig (${services.map((s) => rel(s.cfg)).join(', ')})`);
const info = owners[0].ls.getRenameInfo(target.file, target.pos, { allowRenameOfImportPath: false });
if (!info.canRename) die(1, `cannot rename at ${rel(target.file)}: ${info.localizedErrorMessage}`);
const oldName = info.displayName;
if (oldName === opts.newName) die(1, 'new name equals old name');

// ---------- collect edits from every program ----------
// Programs that don't contain the declaring file can't reference it.
const edits = new Map(); // file -> Map(start -> {start, length, text})
const addEdit = (file, start, length, text) => {
  if (!inRepo(file)) return;
  const f = norm(file);
  if (!edits.has(f)) edits.set(f, new Map());
  const m = edits.get(f);
  const prev = m.get(start);
  if (prev && (prev.length !== length || prev.text !== text)) {
    // Prefer the longer replacement (prefix/suffix variant, e.g. shorthand property).
    if (text.length <= prev.text.length) return;
  }
  m.set(start, { start, length, text });
};
// For a member, the names it is reached through (`cache` in `cache.current()`): a mention of the bare word
// elsewhere only means this member when it is qualified by one of these or by the container's name.
const isMember = ['property', 'method', 'getter', 'setter', 'accessor'].includes(info.kind);
const qualifiers = new Set(), containers = new Set();
if (isMember) {
  for (const w of (info.fullDisplayName ?? '').split('.').slice(0, -1)) if (/^[A-Za-z_$][\w$]*$/.test(w)) containers.add(w);
  containers.add(path.basename(target.file).replace(/\.(d\.ts|tsx?|mts|cts)$/, ''));
}
// The identifier token at a position.
const tokenAt = (sf, pos) => {
  let node = sf;
  for (;;) {
    const child = node.getChildren(sf).find((c) => c.getStart(sf) <= pos && pos < c.end);
    if (!child) return node;
    node = child;
  }
};
// With prefix/suffix text, TypeScript stops at an export or import specifier and adds an alias
// (`export { old as new }`), so files importing through a re-export keep the old name. Without it, a shorthand
// property `{ old }` would change the object's key. So: the full set of locations comes from the plain call, and the
// prefix/suffix text is used only where it protects a shorthand property or binding, never on a specifier.
for (const s of owners) {
  const locs = s.ls.findRenameLocations(target.file, target.pos, opts.inStrings, opts.inComments, { providePrefixAndSuffixTextForRename: false }) ?? [];
  const withAffix = new Map((s.ls.findRenameLocations(target.file, target.pos, opts.inStrings, opts.inComments, { providePrefixAndSuffixTextForRename: true }) ?? [])
    .map((l) => [`${norm(l.fileName)}:${l.textSpan.start}`, l]));
  for (const l of locs) {
    const a = withAffix.get(`${norm(l.fileName)}:${l.textSpan.start}`);
    let text = opts.newName;
    if (a && (a.prefixText || a.suffixText)) {
      const sf = programOf(s).getSourceFile(l.fileName);
      const parent = sf && tokenAt(sf, l.textSpan.start).parent;
      if (parent && !ts.isExportSpecifier(parent) && !ts.isImportSpecifier(parent)) text = `${a.prefixText ?? ''}${opts.newName}${a.suffixText ?? ''}`;
    }
    addEdit(l.fileName, l.textSpan.start, l.textSpan.length, text);
    if (isMember) {
      const before = (programOf(s).getSourceFile(l.fileName)?.text ?? '').slice(Math.max(0, l.textSpan.start - 60), l.textSpan.start);
      const r = /([A-Za-z_$][\w$]*)\s*\??\.\s*$/.exec(before);
      if (r && r[1] !== 'this') qualifiers.add(r[1]);
    }
  }
}

// ---------- file rename: a top-level declaration in <OldName>.ts(x) ----------
const fileRenames = [];
if (opts.fileRename) {
  const base = path.basename(target.file);
  const ext = /\.(d\.ts|tsx?|mts|cts)$/.exec(base)?.[0];
  if (ext && base.slice(0, -ext.length) === oldName) {
    const sf = programOf(owners[0]).getSourceFile(target.file);
    const declNames = (st) => (ts.isVariableStatement(st) ? st.declarationList.declarations.map((d) => d.name) : [ts.getNameOfDeclaration(st)]);
    const isTopLevel = sf.statements.some((st) => declNames(st).some((n) => n && ts.isIdentifier(n) && n.getStart(sf) === target.pos));
    if (isTopLevel) {
      const to = path.join(path.dirname(target.file), opts.newName + ext);
      // On a case-insensitive file system a case-only rename finds the same file under the new name.
      const sameFile = fs.existsSync(to) && fs.realpathSync(to) === fs.realpathSync(target.file);
      if (fs.existsSync(to) && !sameFile) die(1, `Nothing changed: cannot rename ${rel(target.file)}: ${rel(to)} already exists (rerun with --no-file-rename)`);
      fileRenames.push({ from: target.file, to });
      // ts' getEditsForFileRename is minutes on a large program; instead rewrite every module specifier
      // (import/export, import(), import type, vi.mock/require-style call args) whose last segment is the
      // old file name and that resolves to the renamed file.
      const fromN = norm(target.file);
      const segRe = new RegExp(`(^|/)${escRe(oldName)}(\\.(?:d\\.ts|tsx?|mts|cts|js|jsx|mjs|cjs))?$`);
      for (const s of services) {
        const prog = programOf(s);
        const options = prog.getCompilerOptions();
        const cache = ts.createModuleResolutionCache(path.dirname(s.cfg), (x) => x, options);
        for (const sf of prog.getSourceFiles()) {
          if (!inRepo(sf.fileName) || !sf.text.includes(oldName)) continue;
          const visit = (node) => {
            if (ts.isStringLiteralLike(node) && segRe.test(node.text)) {
              const p = node.parent;
              const isSpec = (ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) && p.moduleSpecifier === node
                || ts.isExternalModuleReference(p)
                || ts.isCallExpression(p) && p.arguments[0] === node
                || ts.isLiteralTypeNode(p) && ts.isImportTypeNode(p.parent);
              if (isSpec) {
                const r = ts.resolveModuleName(node.text, sf.fileName, options, ts.sys, cache).resolvedModule;
                if (r && norm(r.resolvedFileName) === fromN) {
                  const newSpec = node.text.replace(segRe, (_m, pre, ext) => `${pre}${opts.newName}${ext ?? ''}`);
                  addEdit(sf.fileName, node.getStart(sf) + 1, node.text.length, newSpec);
                }
              }
            }
            ts.forEachChild(node, visit);
          };
          visit(sf);
        }
      }
    }
  }
}

// ---------- apply ----------
// A failure partway (a read-only file, a full disk) stops with the list of what was already written.
const files = [...edits.keys()].sort();
let count = 0;
const overlaps = [], written = [];
const stop = (e) => die(1, `Stopped partway: ${e.message}\nAlready written (${written.length}): ${written.map(rel).join(', ') || 'nothing'}\nUndo with git checkout on those files, or finish by hand.`);
try {
  for (const f of files) {
    const list = [...edits.get(f).values()].sort((a, b) => b.start - a.start);
    let text = fs.readFileSync(f, 'utf8');
    let lastStart = Infinity;
    for (const e of list) {
      if (e.start + e.length > lastStart) { overlaps.push(`${rel(f)}:${text.slice(0, e.start).split('\n').length}`); continue; }
      text = text.slice(0, e.start) + e.text + text.slice(e.start + e.length);
      lastStart = e.start;
      count++;
    }
    if (!opts.dryRun) { fs.writeFileSync(f, text); written.push(f); }
  }
  for (const { from, to } of fileRenames) {
    if (opts.dryRun) continue;
    const r = spawnSync('git', ['mv', from, to], { cwd: root, encoding: 'utf8' });
    if (r.status !== 0) {
      // An untracked file can't be git mv'd; a tracked one failing (index.lock, a conflict) is worth knowing.
      const tracked = spawnSync('git', ['ls-files', '--error-unmatch', from], { cwd: root }).status === 0;
      fs.renameSync(from, to);
      if (tracked) notices.push(`git mv failed (${(r.stderr || '').trim().split('\n')[0]}); renamed ${rel(from)} -> ${rel(to)} on disk only: stage it with git add -A.`);
    }
    written.push(to);
  }
} catch (e) { stop(e); }
if (overlaps.length) notices.push(`Not renamed (overlapping edits, fix by hand): ${overlaps.join(', ')}`);

if (opts.verbose) {
  for (const f of files) process.stdout.write(`  ${rel(f)} (${edits.get(f).size})\n`);
  for (const { from, to } of fileRenames) process.stdout.write(`  ${rel(from)} -> ${rel(to)}\n`);
}

// What the compiler can't see. Every remaining whole-word match of the old name is classified with the parser:
// comments, strings, regex literals, JSX text and keys in vi.mock/jest.mock factories may mean this symbol;
// identifiers in compiled files are ones the language service found no reference for, and only counted; module
// specifiers are paths, not mentions. Files outside every tsconfig are scanned as text. For a member, a mention outside the changed files counts only when it is qualified
// (`cache.current`, `SessionCache`), since a bare common word (`current`, `reset`) is almost never it.
// Listing everything that fits costs far fewer tokens than a second model call to fetch the rest.
const LIMIT = opts.allLeftovers ? Infinity : 60; // lines listed; the rest go to a file
const tiers = [[], [], []]; // 0: changed files, mock keys, regex; 1: outside every tsconfig; 2: other comments/strings
const outsideFiles = new Map();
let otherIds = 0; const otherIdFiles = new Set(); let unqualified = 0;
if (!opts.dryRun) {
  // -z and quotePath=false: file names come raw, also non-ASCII ones (git otherwise C-quotes them).
  const g = spawnSync('git', ['-c', 'core.quotePath=false', 'grep', '-z', '-c', '-I', '-F', '--untracked', '-e', oldName], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 });
  if (g.status !== 0 && g.status !== 1) stop(new Error(`the rename is done, but listing what is left failed: git grep ${g.error?.message ?? (g.stderr || '').trim().split('\n')[0]}`));
  const hits = g.status === 1 ? [] : g.stdout.split('\n').filter(Boolean).map((l) => l.slice(0, l.indexOf('\0')));
  const compiled = new Set();
  for (const s of services) for (const sf of programOf(s).getSourceFiles()) if (inRepo(sf.fileName)) compiled.add(norm(sf.fileName));
  const renamedTo = new Map(fileRenames.map((r) => [norm(r.to), norm(r.from)]));
  const changed = new Set([...files, ...fileRenames.map((r) => norm(r.to))]);
  const word = wordRe(oldName);
  const qualified = !isMember ? null : (() => {
    // `recv.name`, `recv?.name`, or `recv\.name` inside a regex; or a distinctive container name anywhere on the line.
    const q = [...qualifiers, ...containers].map(escRe);
    const named = [...containers].filter((w) => /^[A-Z]/.test(w) || w.length > 6).map(escRe);
    return new RegExp([q.length && `(?<![\\w$])(?:${q.join('|')})[?\\\\]*\\.${escRe(oldName)}(?![\\w$])`, named.length && `(?<![\\w$])(?:${named.join('|')})(?![\\w$])`].filter(Boolean).join('|'));
  })();
  const snippetOf = (src, character) => {
    const from = Math.max(0, character - 40);
    return (from ? '…' : '') + src.slice(from, from + 90).trim() + (src.length > from + 90 ? '…' : '');
  };
  // A top-level key of the object a vi.mock/jest.mock factory returns: `() => ({ name: ... })` or `() => { return { name } }`.
  const isFactoryKey = (id, factory) => {
    const prop = id.parent;
    if (!prop || prop.name !== id || !(ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop) || ts.isMethodDeclaration(prop))) return false;
    let o = prop.parent.parent;
    while (o && (ts.isParenthesizedExpression(o) || ts.isAsExpression(o) || ts.isSatisfiesExpression?.(o))) o = o.parent;
    if (o && ts.isReturnStatement(o)) o = o.parent?.parent;
    return o === factory;
  };
  const isMockCall = (n) => ts.isCallExpression(n) && /(^|\.)(mock|doMock|unstable_mockModule)$/.test(n.expression.getText());
  // A path in import/export, import(), require/vi.mock-style calls or an import type: not a mention of the symbol.
  const isModuleSpecifier = (n) => {
    const p = n.parent;
    return !!p && ((ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) && p.moduleSpecifier === n
      || ts.isExternalModuleReference(p)
      || ts.isCallExpression(p) && p.arguments[0] === n && (p.expression.kind === ts.SyntaxKind.ImportKeyword
        || /^(require|(.+\.)?(mock|doMock|unmock|requireActual|importActual|importMock|unstable_mockModule))$/.test(p.expression.getText()))
      || ts.isLiteralTypeNode(p) && ts.isImportTypeNode(p.parent));
  };
  const selfDir = norm(path.dirname(path.resolve(process.argv[1]))) + '/';
  for (const relPath of hits) {
    const abs = norm(path.join(root, relPath));
    if (abs.startsWith(selfDir)) continue; // this tool's own files
    const text = fs.readFileSync(abs, 'utf8');
    const srcLines = splitLines(text).filter((_, i) => i % 2 === 0);
    if (!/\.(m|c)?[jt]sx?$/.test(relPath) || !(compiled.has(abs) || compiled.has(renamedTo.get(abs) ?? ''))) {
      srcLines.forEach((src, i) => {
        for (const m of src.matchAll(word)) {
          if (qualified && !qualified.test(src)) { unqualified++; continue; }
          outsideFiles.set(relPath, (outsideFiles.get(relPath) ?? 0) + 1);
          tiers[1].push({ file: relPath, line: i + 1, kind: 'not compiled', snippet: snippetOf(src, m.index) });
        }
      });
      continue;
    }
    const sf = ts.createSourceFile(abs, text, ts.ScriptTarget.Latest, true, /x$/.test(relPath) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    for (const m of text.matchAll(word)) {
      const pos = m.index;
      let node = sf, kind = 'comment', factory = null;
      for (;;) {
        if (isMockCall(node) && node.arguments[1]) factory = node.arguments[1];
        const child = node.getChildren(sf).find((c) => c.getStart(sf) <= pos && pos < c.end);
        if (!child) break;
        if (child.kind >= ts.SyntaxKind.FirstJSDocNode && child.kind <= ts.SyntaxKind.LastJSDocNode) { node = null; break; }
        node = child;
      }
      if (node && node !== sf && node.getStart(sf) <= pos) {
        const k = node.kind, S = ts.SyntaxKind;
        if (k === S.Identifier || k === S.PrivateIdentifier) kind = factory && isFactoryKey(node, factory) ? 'mock key' : null;
        else if (k === S.RegularExpressionLiteral) kind = 'regex';
        else if (k === S.JsxText) kind = 'jsx text';
        else if ([S.StringLiteral, S.NoSubstitutionTemplateLiteral, S.TemplateHead, S.TemplateMiddle, S.TemplateTail].includes(k)) kind = isModuleSpecifier(node) ? null : 'string';
      }
      if (!kind) { if (node.kind === ts.SyntaxKind.Identifier || node.kind === ts.SyntaxKind.PrivateIdentifier) { otherIds++; otherIdFiles.add(relPath); } continue; }
      const { line, character } = sf.getLineAndCharacterOfPosition(pos);
      const src = srcLines[line];
      const inChanged = changed.has(abs);
      if (!inChanged && qualified && !qualified.test(src)) { unqualified++; continue; }
      const tier = inChanged || kind === 'mock key' || kind === 'regex' ? 0 : 2;
      tiers[tier].push({ file: relPath, line: line + 1, kind, snippet: snippetOf(src, character) });
    }
  }
  const order = ['mock key', 'regex', 'string', 'jsx text', 'comment', 'not compiled'];
  for (const t of tiers) t.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.file.localeCompare(b.file) || a.line - b.line);
}
const secs = ((Date.now() - t0) / 1000).toFixed(1);
const out = [`${opts.dryRun ? 'Would rename' : 'Renamed'} ${oldName} -> ${opts.newName}: ${files.length} files, ${count} edits, ${fileRenames.length} file renames, ${owners.length}/${services.length} projects, ${secs}s.`, ...notices];
if (!opts.dryRun) {
  const shown = tiers[0].slice(0, LIMIT);
  const listOutside = shown.length + tiers[1].length <= LIMIT;
  if (listOutside) shown.push(...tiers[1]);
  const listOther = shown.length + tiers[2].length <= LIMIT;
  if (listOther) shown.push(...tiers[2]);
  const all = [...tiers[0], ...tiers[1], ...tiers[2]];
  const line = (l) => `${l.file}:${l.line} ${l.kind}: ${l.snippet}`;
  if (shown.length) {
    out.push(`Not renamed: mentions of ${oldName} the compiler can't resolve. Rename the ones that mean this symbol:`);
    for (const l of shown) out.push(`  ${line(l)}`);
    const byFile = new Map();
    for (const l of shown) { if (!byFile.has(l.file)) byFile.set(l.file, new Set()); byFile.get(l.file).add(l.line); }
    const q = (x) => (/^[\w./@+-]+$/.test(x) ? x : `'${x.replace(/'/g, `'\\''`)}'`);
    // Only for a plain identifier: a quoted property name ("foo-bar") can't be passed safely as a word.
    if (isIdent(oldName)) {
      out.push(`One call renames the listed ones (delete the --lines entries that are something else):`);
      out.push(`  node ${SELF} --text ${q(oldName)} --new-name ${q(opts.newName)} ${[...byFile].map(([f, ls]) => `--lines ${q(`${f}:${[...ls].join(',')}`)}`).join(' ')}`);
    }
  }
  if (all.length > shown.length) {
    // The rename is already applied, so a rerun can't list these again: they go to a file instead.
    const file = path.join(os.tmpdir(), `ts-rename-${oldName.replace(/[^\w$]/g, '_')}-${process.pid}.txt`);
    fs.writeFileSync(file, all.map(line).join('\n') + '\n');
    const parts = [];
    if (tiers[0].length > LIMIT) parts.push(`${tiers[0].length - LIMIT} more in changed files, mock keys and regexes`);
    if (!listOutside && tiers[1].length) parts.push(`${tiers[1].length} in ${outsideFiles.size} files outside every tsconfig`);
    if (!listOther && tiers[2].length) parts.push(`${tiers[2].length} comments/strings in files that don't use this symbol`);
    out.push(`Not listed: ${parts.join('; ')}. All ${all.length}: ${file}`);
  }
  const ign = [];
  if (otherIds) ign.push(`${otherIds} same-name identifiers in ${otherIdFiles.size} files that the language service found no reference to this symbol in`);
  if (unqualified) ign.push(`${unqualified} unqualified mentions of the word ${oldName} in other files, taken as not this member`);
  if (ign.length) out.push(`Ignore: ${ign.join('; ')}.`);
  if (!all.length && !notices.length) out.push('Nothing else to check.');
}
process.stdout.write(out.join('\n') + '\n');
if (overlaps.length) process.exit(1);
