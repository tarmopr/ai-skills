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
// What the agent must know was not covered (skipped tsconfigs, failed git mv, …): printed with the summary, and
// with any error, so a "not found" never hides that the project defining the symbol didn't load.
const notices = [];
// Usage and setup errors, not found, ambiguous (exit 3) and an unrenamable symbol go to stderr; refuse() sends a refusal
// after the lookup ("Nothing changed", "Stopped partway") to stdout, with every other outcome the agent acts on.
const die = (code, msg, fd = 2) => {
  const text = [msg.replace(/\n$/, ''), ...notices].join('\n');
  // writeSync: process.exit right after an async write cuts a pipe's output at 64 KB.
  fs.writeSync(fd, text + '\n');
  process.exit(code);
};
const refuse = (msg) => die(1, msg, 1);

// ---------- args ----------
const SELF = `"${process.argv[1]}"`; // absolute and double-quoted, like SKILL.md's allowed-tools pattern after ${CLAUDE_SKILL_DIR} expands
const USAGE = `Rename a TS symbol and every reference in every tsconfig*.json project of the repo:
  node ${SELF} --symbol <Name|Container.Name> --new-name <New>
  node ${SELF} --at <file>:<line>:<col> --new-name <New>       (locals, parameters, exit-3 candidates)
Container: a class, interface, function or the file's base name, chainable (apiClient.RequestOptions.timeoutMs).
Options: --project <tsconfig> (repeatable)  --in-comments  --in-strings  --no-file-rename  --dry-run  --verbose  --all-leftovers
  --allow-errors (write even when the check finds type errors the rename adds in the changed files, or fails to run)
Replace a word on given lines only (for the leftovers a rename lists; no type checking):
  node ${SELF} --text <Old> --new-name <New> --lines <file>:<line>,<line> [--lines <file>:<line>]...
Exit codes: 0 done, 1 error (also: nothing written because the rename would add type errors in the changed files, or the
check failed; refusals print on stdout), 2 not found, 3 ambiguous (stderr lists --at candidates).
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
    case '--allow-errors': opts.allowErrors = true; break;
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
// The repo of the file or tsconfig named by an absolute --at/--project/--lines path, else of the working directory.
const gitTop = (dir) => { try { return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; } };
const anchor = [opts.at && /^(.*):\d+:\d+$/.exec(opts.at)?.[1], opts.projects[0], opts.lines[0] && /^(.*):[\d,]+$/.exec(opts.lines[0])?.[1]]
  .find((p) => p && path.isAbsolute(p) && fs.existsSync(p));
// git prints the real path (/private/var/… on macOS); keep the form the path was given in, as TypeScript does,
// so the repo-membership checks compare like with like.
const rootFrom = (dir) => {
  const top = gitTop(dir);
  if (!top) return null;
  const up = path.relative(top, fs.realpathSync(dir));
  return up ? path.resolve(dir, ...up.split(path.sep).map(() => '..')) : dir;
};
const cwdRoot = rootFrom(process.cwd());
const root = path.resolve((anchor && rootFrom(path.dirname(anchor))) || cwdRoot || process.cwd());
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
    if (!fs.realpathSync(abs).startsWith(realRoot + path.sep)) refuse(`Nothing changed: ${m[1]} is outside the repo (${root})`);
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
  if (!n) refuse(out + miss);
  const done = [];
  if (!opts.dryRun) {
    for (const [abs, text] of writes) {
      try { fs.writeFileSync(abs, text); done.push(rel(abs)); }
      catch (e) { refuse(`Stopped partway: ${e.message}\nAlready written (${done.length}): ${done.join(', ') || 'nothing'}`); }
    }
  }
  process.stdout.write(out + miss + '\n');
  process.exit(0);
}
if (!!opts.symbol === !!opts.at) die(1, 'pass exactly one of --symbol or --at');

// ---------- typescript ----------

let ts;
try { ts = createRequire(path.join(root, 'package.json'))('typescript'); }
catch (e) { die(1, `typescript is not installed in ${root} (run npm install): ${e.message.split('\n')[0]}`); }

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
  // The pathspec also matches a tsconfig-utils/package.json; keep files named tsconfig*.json.
  return files.filter((f) => !f.includes('node_modules/') && /^tsconfig[^/]*\.json$/.test(path.basename(f))).map((f) => path.join(root, f));
}
const configPaths = (opts.projects.length ? opts.projects.map((p) => (fs.existsSync(path.resolve(p)) ? path.resolve(p) : path.resolve(root, p))) : discoverProjects());
if (!configPaths.length) die(1, 'no tsconfig*.json found');

const registry = ts.createDocumentRegistry(ts.sys.useCaseSensitiveFileNames, root);
const versions = new Map();
// The rename's result, checked before anything is written: file -> new text, or null for a file renamed away.
let overlay = null;
const moveTo = new Map(); // file renames, from -> to
const overlaid = (f) => overlay?.get(norm(f));
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
    getScriptFileNames: () => (overlay ? parsed.fileNames.map((f) => moveTo.get(norm(f)) ?? f) : parsed.fileNames),
    getScriptVersion: (f) => String(versions.get(norm(f)) ?? 0),
    getScriptSnapshot: (f) => {
      const o = overlaid(f);
      if (o !== undefined) return o === null ? undefined : ts.ScriptSnapshot.fromString(o);
      return fs.existsSync(f) ? ts.ScriptSnapshot.fromString(fs.readFileSync(f, 'utf8')) : undefined;
    },
    getCurrentDirectory: () => path.dirname(cfg),
    getCompilationSettings: () => parsed.options,
    getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
    fileExists: (f) => { const o = overlaid(f); return o !== undefined ? o !== null : ts.sys.fileExists(f); },
    readFile: (f, enc) => { const o = overlaid(f); return o !== undefined ? (o ?? undefined) : ts.sys.readFile(f, enc); },
    readDirectory: ts.sys.readDirectory,
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
    // No result cap: it applies before the container filter, so a common member name could hide the one asked for.
    const items = s.ls.getNavigateToItems(name, undefined, undefined, false); // false: include the repo's own .d.ts files
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
// The declaration, for the file rename and the container name: --at may point mid-word or at a use site.
const decl = (() => {
  const d = (owners[0].ls.getDefinitionAtPosition(target.file, target.pos) ?? []).find((x) => inRepo(x.fileName));
  if (!d) return target;
  const sf = owners.map(programOf).map((p) => p.getSourceFile(d.fileName)).find(Boolean);
  const n = sf && nameNodeAt(sf, d.textSpan.start, d.textSpan.start + d.textSpan.length);
  return { file: d.fileName, pos: n ? n.getStart(sf) : d.textSpan.start };
})();

// ---------- collect edits from every program ----------
// Programs that don't contain the declaring file can't reference it.
const edits = new Map(); // file -> Map(start -> {start, length, text})
let dropped = 0;
const addEdit = (file, start, length, text, spec = false) => {
  if (!inRepo(file)) { if (!norm(file).includes('/node_modules/')) dropped++; return; }
  const f = norm(file);
  if (!edits.has(f)) edits.set(f, new Map());
  const m = edits.get(f);
  const prev = m.get(start);
  if (prev && (prev.length !== length || prev.text !== text)) {
    // Prefer the longer replacement (prefix/suffix variant, e.g. shorthand property).
    if (text.length <= prev.text.length) return;
  }
  m.set(start, { start, length, text, spec });
};
// For a member, the names it is reached through (`cache` in `cache.current()`): a mention of the bare word
// elsewhere only means this member when it is qualified by one of these or by the container's name.
const isMember = ['property', 'method', 'getter', 'setter', 'accessor', 'enum member'].includes(info.kind);
const qualifiers = new Set(), containers = new Set();
if (isMember) {
  for (const w of (info.fullDisplayName ?? '').split('.').slice(0, -1)) if (/^[A-Za-z_$][\w$]*$/.test(w)) containers.add(w);
  containers.add(path.basename(decl.file).replace(/\.(d\.ts|tsx?|mts|cts)$/, ''));
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
// TypeScript's locations with prefix/suffix text keep code working: a shorthand property `{ old }` becomes
// `{ old: new }`, a destructured `{ old } = o` becomes `{ new: old } = o`. But at an import or export specifier it
// adds an alias (`import { new as old }`, `export { new as old }`) and stops, so the names used past it keep the
// old name. There the plain new name is written instead, and the rename continues from that specifier.
// --at on a name imported without `as`, or on a use of it, means the exported symbol. From there TypeScript renames
// only the local binding, which the specifier rule below would turn into a broken import.
{
  const prog = programOf(owners[0]), sf = prog.getSourceFile(target.file);
  const sym = sf && prog.getTypeChecker().getSymbolAtLocation(tokenAt(sf, target.pos));
  const plainImport = sym && sym.flags & ts.SymbolFlags.Alias && sym.declarations?.length
    && sym.declarations.every((d) => (ts.isImportSpecifier(d) || ts.isExportSpecifier(d)) && !d.propertyName);
  if (plainImport) target = decl;
}
const seenLoc = new Set();
const queue = [{ file: target.file, pos: target.pos }];
while (queue.length) {
  const { file, pos } = queue.shift();
  for (const s of services.filter((x) => programOf(x).getSourceFile(file))) {
    for (const l of s.ls.findRenameLocations(file, pos, opts.inStrings, opts.inComments, { providePrefixAndSuffixTextForRename: true }) ?? []) {
      const key = `${norm(l.fileName)}:${l.textSpan.start}`;
      if (seenLoc.has(key)) continue;
      seenLoc.add(key);
      const sf = programOf(s).getSourceFile(l.fileName);
      const parent = sf && tokenAt(sf, l.textSpan.start).parent;
      if ((l.prefixText || l.suffixText) && parent && (ts.isExportSpecifier(parent) || ts.isImportSpecifier(parent))) {
        addEdit(l.fileName, l.textSpan.start, l.textSpan.length, opts.newName);
        queue.push({ file: l.fileName, pos: l.textSpan.start });
      } else {
        addEdit(l.fileName, l.textSpan.start, l.textSpan.length, `${l.prefixText ?? ''}${opts.newName}${l.suffixText ?? ''}`);
      }
      if (isMember) {
        const before = (sf?.text ?? '').slice(Math.max(0, l.textSpan.start - 60), l.textSpan.start);
        const r = /([A-Za-z_$][\w$]*)\s*\??\.\s*$/.exec(before);
        if (r && r[1] !== 'this') qualifiers.add(r[1]);
      }
    }
  }
}
// For a member: how a mention outside the changed files must read to mean it. `recv.name`, `recv?.name`, or
// `recv\.name` inside a regex, with a receiver the rename saw; or a distinctive container name anywhere on the line.
const qualifiedRe = !isMember ? null : (() => {
  const q = [...qualifiers, ...containers].map(escRe);
  const named = [...containers].filter((w) => /^[A-Z]/.test(w) || w.length > 6).map(escRe);
  return new RegExp([q.length && `(?<![\\w$])(?:${q.join('|')})[?\\\\]*\\.${escRe(oldName)}(?![\\w$])`, named.length && `(?<![\\w$])(?:${named.join('|')})(?![\\w$])`].filter(Boolean).join('|'));
})();
if (dropped) { notices.push(`Not renamed: ${dropped} references outside ${root}; run from the repo that holds them.`); process.exitCode = 1; }

// ---------- file rename: a top-level declaration in <OldName>.ts(x) ----------
const fileRenames = [];
if (opts.fileRename) {
  const base = path.basename(decl.file);
  const ext = /\.(d\.ts|tsx?|mts|cts)$/.exec(base)?.[0];
  const sf = ext && base.slice(0, -ext.length) === oldName && services.map(programOf).map((p) => p.getSourceFile(decl.file)).find(Boolean);
  if (sf) {
    const declNames = (st) => (ts.isVariableStatement(st) ? st.declarationList.declarations.map((d) => d.name) : [ts.getNameOfDeclaration(st)]);
    // Only when the rename renames the declaration itself: --at on a default import's local name renames the local only.
    const isTopLevel = seenLoc.has(`${norm(decl.file)}:${decl.pos}`)
      && sf.statements.some((st) => declNames(st).some((n) => n && ts.isIdentifier(n) && n.getStart(sf) === decl.pos));
    if (isTopLevel) {
      const to = path.join(path.dirname(decl.file), opts.newName + ext);
      // On a case-insensitive file system a case-only rename finds the same file under the new name.
      const sameFile = fs.existsSync(to) && fs.statSync(to).ino === fs.statSync(decl.file).ino;
      if (fs.existsSync(to) && !sameFile) refuse(`Nothing changed: cannot rename ${rel(decl.file)}: ${rel(to)} already exists (rerun with --no-file-rename)`);
      fileRenames.push({ from: decl.file, to });
      // ts' getEditsForFileRename is minutes on a large program; instead rewrite every module specifier
      // (import/export, import type, and the first string argument of any call: import(), require, vi.mock, …)
      // whose last segment is the old file name and that resolves to the renamed file.
      const fromN = norm(decl.file);
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
                  addEdit(sf.fileName, node.getStart(sf) + 1, node.text.length, newSpec, true);
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

// ---------- the new texts ----------
const files = [...edits.keys()].sort();
let count = 0;
const overlaps = [], newTexts = new Map();
const lineOf = (text, pos) => (splitLines(text.slice(0, pos)).length + 1) / 2;
for (const f of files) {
  // A string edit inside a module path the file rename rewrites (--in-strings) is part of that rewrite.
  const all = [...edits.get(f).values()];
  const specs = all.filter((e) => e.spec);
  const list = all.filter((e) => e.spec || !specs.some((p) => e.start >= p.start && e.start + e.length <= p.start + p.length)).sort((a, b) => b.start - a.start);
  let text;
  try { text = fs.readFileSync(f, 'utf8'); } catch (e) { refuse(`Nothing changed: ${e.message}`); }
  let lastStart = Infinity;
  for (const e of list) {
    if (e.start + e.length > lastStart) { overlaps.push(`${rel(f)}:${lineOf(text, e.start)}`); continue; }
    text = text.slice(0, e.start) + e.text + text.slice(e.start + e.length);
    lastStart = e.start;
    count++;
  }
  newTexts.set(f, text);
}

// ---------- check the result before writing ----------
// TypeScript's rename doesn't check that the result compiles, and the agent is told to trust this output. So the
// changed files are type-checked in memory first, through the language service reading the new texts from an
// overlay. A line with more errors than before the rename is a problem, and any problem writes nothing, unless
// --allow-errors; a check that fails to run writes nothing either. Matching by line means an error that was there
// before doesn't block a valid rename, even when the rename rewrites its line, its message or its code. Not caught: a
// rename that fixes an error and adds another on the same line, or whose break TypeScript folds into an error already
// reported (a second missing property of the same argument). Refused by mistake: an error TypeScript hid behind an
// earlier one on another line (it reports one excess property per object) and shows once the rename fixes that one.
// Not covered: a break in a file the rename didn't change (an untyped object passed to the renamed type elsewhere, a
// subclass in another file, a clashing `export *`), and a rename that compiles but means something else (a capture,
// an override). The repo's own typecheck and tests find those.
const problems = [];
let checkFailed = null;
const compiled = new Map(); // file -> compiler options of a program that has it (for the leftover scan)
for (const s of services) for (const sf of programOf(s).getSourceFiles()) if (inRepo(sf.fileName) && !compiled.has(norm(sf.fileName))) compiled.set(norm(sf.fileName), programOf(s).getCompilerOptions());
const at = (sf, pos) => { const lc = sf.getLineAndCharacterOfPosition(pos); return `${rel(sf.fileName)}:${lc.line + 1}`; };
try {
  for (const { from, to } of fileRenames) moveTo.set(norm(from), norm(to));
  const toCheck = new Map(); // changed file -> the service that checks it
  for (const f of newTexts.keys()) {
    const s = services.find((x) => programOf(x).getSourceFile(f));
    if (s && inRepo(f)) toCheck.set(f, s);
  }
  const errorsOf = (s, f) => [...s.ls.getSyntacticDiagnostics(f), ...s.ls.getSemanticDiagnostics(f)].filter((d) => d.category === ts.DiagnosticCategory.Error);
  // Errors are counted per line: a line with more than before is a problem. A rename never adds or removes a line,
  // and it can change the code of an error already there: TypeScript gives an error a "did you mean" code (2551, 2552,
  // 2724, …) when a similar name exists, and the rename can make or drop that name.
  const errorKey = (d) => (d.file ? d.file.getLineAndCharacterOfPosition(d.start).line : -1);
  const bump = (list) => { for (const f of list) versions.set(f, (versions.get(f) ?? 0) + 1); };
  overlay = new Map();
  for (const [f, text] of newTexts) overlay.set(moveTo.get(f) ?? f, text);
  for (const [from, to] of moveTo) {
    if (!overlay.has(to)) overlay.set(to, fs.readFileSync(from, 'utf8'));
    if (!fs.existsSync(to)) overlay.set(from, null); // `to` exists only for a case-only rename on a case-insensitive disk: the same file
  }
  const changedPaths = [...overlay.keys()];
  bump(changedPaths);
  const after = new Map();
  for (const [f, s] of toCheck) { const e = errorsOf(s, moveTo.get(f) ?? f); if (e.length) after.set(f, e); }
  if (after.size) {
    const saved = overlay;
    overlay = null; bump(changedPaths);
    const msgs = new Map(); // diagnostic -> its message with the new name read as the old
    const msg = (d) => { if (!msgs.has(d)) msgs.set(d, ts.flattenDiagnosticMessageText(d.messageText, ' ').replace(wordRe(opts.newName), () => oldName)); return msgs.get(d); };
    const before = new Map(); // file -> line -> the errors on it
    for (const f of after.keys()) {
      const byLine = new Map();
      for (const d of errorsOf(toCheck.get(f), f)) { const k = errorKey(d); if (!byLine.has(k)) byLine.set(k, []); byLine.get(k).push(d); }
      before.set(f, byLine);
    }
    overlay = saved; bump(changedPaths);
    for (const [f, errs] of after) {
      // Pair each error with one the line had before: the same code and message (the new name read as the old) first,
      // then the same code, then any. What is left over is new.
      const fresh = new Map(); // line -> errors not yet paired
      for (const d of errs) { const k = errorKey(d); if (!fresh.has(k)) fresh.set(k, []); fresh.get(k).push(d); }
      for (const [k, list] of fresh) {
        const was = [...(before.get(f).get(k) ?? [])];
        for (const same of [(a, b) => a.code === b.code && msg(a) === msg(b), (a, b) => a.code === b.code, () => true]) {
          for (let i = 0; i < list.length; i++) {
            const j = was.findIndex((w) => same(list[i], w));
            if (j >= 0) { was.splice(j, 1); list.splice(i--, 1); }
          }
        }
        for (const d of list) problems.push(`${d.file ? at(d.file, d.start) : rel(f)}: TS${d.code} ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`);
      }
    }
  }
} catch (e) {
  checkFailed = e.message.split('\n')[0];
}
if (checkFailed && !opts.allowErrors) {
  fs.writeSync(1, [`Nothing changed: the check of the result failed (${checkFailed}). --allow-errors writes the rename unchecked.`, ...notices].join('\n') + '\n');
  process.exit(1);
}
if (checkFailed) notices.push(`The check of the result failed (${checkFailed}); written unchecked with --allow-errors.`);
if (problems.length) {
  const list = problems.slice(0, 20).map((p) => `  ${p}`).concat(problems.length > 20 ? [`  … ${problems.length - 20} more`] : []);
  if (!opts.allowErrors) {
    const msg = [`Nothing changed: renaming ${oldName} -> ${opts.newName} would add type errors:`, ...list,
      'Pick another name, or rename at the declaration with --symbol. A reference the rename misses (an untyped object key) is',
      'for the user: --allow-errors writes the rename anyway, and the key is then edited by hand.', ...notices];
    fs.writeSync(1, msg.join('\n') + '\n');
    process.exit(1);
  }
  notices.push(`${opts.dryRun ? 'With' : 'Written with'} --allow-errors; the rename adds these type errors:`, ...list);
}

// ---------- write ----------
// A failure partway (a read-only file, a full disk) stops with the list of what was already written.
const written = [], moved = [];
// On stdout, like refuse().
const stop = (e) => {
  const msg = [`Stopped partway: ${e.message}`, `Already written (${written.length}): ${written.map(rel).join(', ') || 'nothing'}`,
    ...(moved.length ? [`Already moved: ${moved.join(', ')}`] : []), 'Undo with git checkout on the written files (and move the moved ones back), or finish by hand.', ...notices];
  fs.writeSync(1, msg.join('\n') + '\n');
  process.exit(1);
};
try {
  for (const f of files) if (!opts.dryRun) { fs.writeFileSync(f, newTexts.get(f)); written.push(f); }
  for (const { from, to } of fileRenames) {
    if (opts.dryRun) continue;
    const r = spawnSync('git', ['mv', from, to], { cwd: root, encoding: 'utf8' });
    if (r.status !== 0) {
      // An untracked file can't be git mv'd; a tracked one failing (index.lock, a conflict) is worth knowing,
      // and so is git not running at all.
      const ls = spawnSync('git', ['ls-files', '--error-unmatch', from], { cwd: root });
      fs.renameSync(from, to);
      if (r.error || ls.error || ls.status === 0) notices.push(`git mv failed (${(r.error?.message ?? r.stderr ?? '').trim().split('\n')[0]}); renamed ${rel(from)} -> ${rel(to)} on disk only: stage it with git add -A.`);
    }
    moved.push(`${rel(from)} -> ${rel(to)}`);
  }
} catch (e) { stop(e); }
if (overlaps.length) notices.push(`Not renamed (overlapping edits, fix by hand): ${overlaps.join(', ')}`);

if (opts.verbose) {
  for (const f of files) process.stdout.write(`  ${rel(f)} (${edits.get(f).size})\n`);
  for (const { from, to } of fileRenames) process.stdout.write(`  ${rel(from)} -> ${rel(to)}\n`);
}

// What the compiler can't see. Every remaining whole-word match of the old name is classified with the parser:
// comments, strings, regex literals, JSX text and keys in vi.mock/jest.mock factories may mean this symbol;
// identifiers in compiled files are ones the language service found no reference for, and only counted; a module
// path that resolves is a path, not a mention, and one that doesn't resolve (an alias only the bundler knows) is
// listed. Files outside every tsconfig are scanned as text. For a member, a mention outside the changed files counts
// only when it is qualified (`cache.current`, `SessionCache`), since a bare common word (`current`, `reset`) is almost
// never it. Each line is listed once: --text replaces every mention on it.
// Up to 60 lines are listed (tier 0 first, up to the limit; a further tier only when it fits whole), the rest go to a file:
// listing costs far fewer tokens than a second model call, and after the rename a rerun can't find the old name.
const LIMIT = opts.allLeftovers ? Infinity : 60;
const tiers = [[], [], []]; // 0: changed files, mock keys, regexes, module paths, unresolved imports; 1: outside every tsconfig; 2: comments, strings and JSX text in files the rename didn't change
const outsideFiles = new Map();
let otherIds = 0; const otherIdFiles = new Set(); let unqualified = 0;
if (!opts.dryRun) {
  try {
    // -z: file names come raw, also non-ASCII ones (git otherwise C-quotes them).
    const g = spawnSync('git', ['grep', '-z', '-c', '-I', '-F', '--untracked', '-e', oldName], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 });
    if (g.status !== 0 && g.status !== 1) throw new Error(`git grep: ${g.error?.message ?? (g.stderr || '').trim().split('\n')[0]}`);
    const hits = g.status === 1 ? [] : g.stdout.split('\n').filter(Boolean).map((l) => l.slice(0, l.indexOf('\0')));
    const renamedTo = new Map(fileRenames.map((r) => [norm(r.to), norm(r.from)]));
    const changed = new Set([...files, ...fileRenames.map((r) => norm(r.to))]);
    const word = wordRe(oldName);
    const qualified = qualifiedRe;
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
    // Where a string is a module path: 'module' for import/export, import types and import()/require/mock-style
    // calls; 'call' for the first argument of any other call (a module path only if it resolves); else null.
    const specifierKind = (n) => {
      const p = n.parent;
      if (!p) return null;
      if ((ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) && p.moduleSpecifier === n || ts.isExternalModuleReference(p)
        || ts.isLiteralTypeNode(p) && ts.isImportTypeNode(p.parent)) return 'module';
      if (!ts.isCallExpression(p) || p.arguments[0] !== n) return null;
      return p.expression.kind === ts.SyntaxKind.ImportKeyword
        || /^(require(\.resolve)?|(.+\.)?(mock|doMock|unmock|requireActual|requireMock|importActual|importMock|unstable_mockModule))$/.test(p.expression.getText()) ? 'module' : 'call';
    };
    const selfDir = norm(path.dirname(path.resolve(process.argv[1]))) + '/';
    const seenLine = new Set();
    const push = (tier, entry) => { const k = `${entry.file}:${entry.line}`; if (!seenLine.has(k)) { seenLine.add(k); tiers[tier].push(entry); } };
    for (const relPath of hits) {
      const abs = norm(path.join(root, relPath));
      if (abs.startsWith(selfDir)) continue; // this tool's own files
      const text = fs.readFileSync(abs, 'utf8');
      const srcLines = splitLines(text).filter((_, i) => i % 2 === 0);
      const options = compiled.get(abs) ?? compiled.get(renamedTo.get(abs) ?? '');
      if (!/\.(m|c)?[jt]sx?$/.test(relPath) || !options) {
        srcLines.forEach((src, i) => {
          for (const m of src.matchAll(word)) {
            if (qualified && !qualified.test(src)) { unqualified++; continue; }
            outsideFiles.set(relPath, (outsideFiles.get(relPath) ?? 0) + 1);
            push(1, { file: relPath, line: i + 1, kind: 'not compiled', snippet: snippetOf(src, m.index) });
          }
        });
        continue;
      }
      const sf = ts.createSourceFile(abs, text, ts.ScriptTarget.Latest, true, /x$/.test(relPath) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      // Identifiers the language service didn't rename are other symbols, with two exceptions where it can't see
      // the reference: the file imports the old name from a module the compiler can't resolve (an alias only the
      // bundler knows), or, for a member, a key of an object literal without a contextual type in a changed file.
      const imported = (st) => {
        const c = ts.isImportDeclaration(st) && st.importClause;
        if (!c) return false;
        const names = [c.name, ...(c.namedBindings && ts.isNamedImports(c.namedBindings) ? c.namedBindings.elements.flatMap((e) => [e.name, e.propertyName]) : [])];
        return names.some((n) => n && n.text === oldName);
      };
      const unresolvedImport = sf.statements.some((st) => imported(st) && ts.isStringLiteral(st.moduleSpecifier)
        && !ts.resolveModuleName(st.moduleSpecifier.text, abs, options, ts.sys).resolvedModule);
      const idKind = unresolvedImport ? 'unresolved import' : isMember && changed.has(abs) ? 'identifier' : null;
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
          if (k === S.Identifier || k === S.PrivateIdentifier) kind = factory && isFactoryKey(node, factory) ? 'mock key' : idKind;
          else if (k === S.RegularExpressionLiteral) kind = 'regex';
          else if (k === S.JsxText) kind = 'jsx text';
          else if ([S.StringLiteral, S.NoSubstitutionTemplateLiteral, S.TemplateHead, S.TemplateMiddle, S.TemplateTail].includes(k)) {
            const spec = ts.isStringLiteralLike(node) ? specifierKind(node) : null;
            const resolves = spec && !!ts.resolveModuleName(node.text, abs, options, ts.sys).resolvedModule;
            kind = resolves ? null : spec === 'module' ? 'module path' : 'string';
          }
        }
        if (!kind) { if (node && (node.kind === ts.SyntaxKind.Identifier || node.kind === ts.SyntaxKind.PrivateIdentifier)) { otherIds++; otherIdFiles.add(relPath); } continue; }
        const { line, character } = sf.getLineAndCharacterOfPosition(pos);
        const src = srcLines[line];
        const inChanged = changed.has(abs);
        if (!inChanged && qualified && !qualified.test(src)) { unqualified++; continue; }
        const tier = inChanged || ['mock key', 'regex', 'module path', 'unresolved import'].includes(kind) ? 0 : 2;
        push(tier, { file: relPath, line: line + 1, kind, snippet: snippetOf(src, character) });
      }
    }
    const order = ['unresolved import', 'identifier', 'mock key', 'regex', 'module path', 'string', 'jsx text', 'comment', 'not compiled'];
    for (const t of tiers) t.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.file.localeCompare(b.file) || a.line - b.line);
  } catch (e) {
    notices.push(`Listing what is left failed (${e.message.split('\n')[0]}): the rename itself is done; search for ${oldName} yourself.`);
    process.exitCode = 1;
  }
}
const secs = ((Date.now() - t0) / 1000).toFixed(1);
const out = [`${opts.dryRun ? 'Would rename' : 'Renamed'} ${oldName} -> ${opts.newName}: ${files.length} files, ${count} edits, ${fileRenames.length} file renames, ${owners.length}/${services.length} projects, ${secs}s.`];
if (!opts.dryRun) {
  const shown = tiers[0].slice(0, LIMIT);
  const listOutside = shown.length + tiers[1].length <= LIMIT;
  if (listOutside) shown.push(...tiers[1]);
  const listOther = shown.length + tiers[2].length <= LIMIT;
  if (listOther) shown.push(...tiers[2]);
  const all = [...tiers[0], ...tiers[1], ...tiers[2]];
  const line = (l) => `${l.file}:${l.line} ${l.kind}: ${l.snippet}`;
  let rest = '';
  if (all.length > shown.length) {
    // In a private folder: a fixed name in a shared temp folder could be a planted symlink.
    try {
      const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ts-rename-')), 'leftovers.txt');
      fs.writeFileSync(file, all.map(line).join('\n') + '\n');
      const parts = [];
      if (tiers[0].length > LIMIT) parts.push(`${tiers[0].length - LIMIT} more in changed files, mock keys, regexes and module paths`);
      if (!listOutside && tiers[1].length) parts.push(`${tiers[1].length} in ${outsideFiles.size} files outside every tsconfig`);
      if (!listOther && tiers[2].length) parts.push(`${tiers[2].length} comments, strings or JSX text in files the rename didn't change`);
      rest = `Not listed: ${parts.join('; ')}. All ${all.length}: ${file}`;
    } catch (e) {
      notices.push(`Couldn't write the full list (${e.message.split('\n')[0]}), so all ${all.length} are listed.`);
      shown.splice(0, shown.length, ...all);
    }
  }
  out.push(...notices);
  if (shown.length) {
    out.push(`Not renamed: mentions of ${oldName} the compiler can't resolve. Rename the ones that mean this symbol:`);
    for (const l of shown) out.push(`  ${line(l)}`);
    const byFile = new Map();
    for (const l of shown) { if (!byFile.has(l.file)) byFile.set(l.file, new Set()); byFile.get(l.file).add(l.line); }
    const q = (x) => (/^[\w./@+-]+$/.test(x) ? x : `'${x.replace(/'/g, `'\\''`)}'`);
    // Only for a plain identifier: a quoted property name ("foo-bar") can't be passed safely as a word.
    if (isIdent(oldName)) {
      out.push(`One call renames the listed ones (delete the --lines entries that are something else):`);
      // Paths from the repo root; absolute when that is another repo than the working directory's, where --text would look.
      const own = cwdRoot && norm(cwdRoot) === norm(root);
      out.push(`  node ${SELF} --text ${q(oldName)} --new-name ${q(opts.newName)} ${[...byFile].map(([f, ls]) => `--lines ${q(`${own ? f : norm(path.join(root, f))}:${[...ls].join(',')}`)}`).join(' ')}`);
    }
  }
  if (rest) out.push(rest);
  const ign = [];
  if (otherIds) ign.push(`${otherIds} same-name identifiers in ${otherIdFiles.size} files that the language service found no reference to this symbol in`);
  if (unqualified) ign.push(`${unqualified} unqualified mentions of the word ${oldName} in other files, taken as not this member`);
  if (ign.length) out.push(`Ignore: ${ign.join('; ')}.`);
  if (!all.length && !notices.length) out.push('Nothing else to check.');
} else out.push(...notices);
process.stdout.write(out.join('\n') + '\n');
if (overlaps.length) process.exitCode = 1; // after the write: process.exit would cut a long output on a pipe
