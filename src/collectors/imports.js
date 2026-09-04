// CodeAtlas Phase 3 — Import Collector

import { existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { safeReadFile, SOURCE_EXTENSIONS } from '../utils.js';

/**
 * Patterns for ES module imports (TypeScript/JavaScript).
 * Captures: import X from 'module', import { X } from 'module',
 *           import 'module', import * as X from 'module'
 */
const ESM_IMPORT_PATTERNS = [
  // import X from 'module'
  /import\s+(?:type\s+)?(\w+)\s+from\s+['"]([^'"]+)['"]/g,
  // import { X, Y } from 'module' or import { type X } from 'module'
  /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g,
  // import 'module' (side-effect)
  /import\s+['"]([^'"]+)['"]/g,
  // import * as X from 'module'
  /import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g,
];

/**
 * Patterns for CommonJS require (JavaScript/Node).
 */
const CJS_REQUIRE_PATTERNS = [
  // require('module')
  /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  // const X = require('module')
  /(?:const|let|var)\s+(\w+)\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];

/**
 * Patterns for Python imports.
 */
const PYTHON_IMPORT_PATTERNS = [
  // import x
  /^import\s+(\w+(?:\.\w+)*)/gm,
  // from x import y
  /^from\s+(\w+(?:\.\w+)*)\s+import\s+(.+)/gm,
];

/**
 * Common Node.js built-in modules.
 */
const NODE_BUILTINS = new Set([
  'fs', 'path', 'os', 'http', 'https', 'net', 'crypto', 'stream',
  'events', 'util', 'url', 'querystring', 'buffer', 'child_process',
  'cluster', 'dgram', 'dns', 'domain', 'readline', 'repl', 'tls',
  'tty', 'v8', 'vm', 'worker_threads', 'zlib', 'assert', 'console',
  'module', 'process', 'timers', 'perf_hooks', 'string_decoder',
  'node:fs', 'node:path', 'node:os', 'node:http', 'node:https',
  'node:crypto', 'node:stream', 'node:events', 'node:util', 'node:url',
  'node:buffer', 'node:child_process', 'node:net', 'node:tls',
  'node:worker_threads', 'node:zlib', 'node:assert', 'node:console',
  'node:module', 'node:process', 'node:timers',
]);

/**
 * Resolve a relative import to an actual file path.
 * Returns { resolved_path, status } where status is
 * 'resolved', 'unresolved', or 'ambiguous'.
 */
function resolveRelativeImport(sourceFile, target, root) {
  const sourceDir = dirname(join(root, sourceFile));

  // Try direct path
  const candidates = [
    join(sourceDir, target),
    join(sourceDir, target + '.ts'),
    join(sourceDir, target + '.tsx'),
    join(sourceDir, target + '.js'),
    join(sourceDir, target + '.jsx'),
    join(sourceDir, target + '.mjs'),
    join(sourceDir, target, 'index.ts'),
    join(sourceDir, target, 'index.tsx'),
    join(sourceDir, target, 'index.js'),
    join(sourceDir, target, 'index.jsx'),
    join(sourceDir, target, 'index.mjs'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return {
        resolved_path: relative(root, candidate),
        status: 'resolved',
      };
    }
  }

  return {
    resolved_path: null,
    status: 'unresolved',
  };
}

/**
 * Determine if an import target is local (relative path) or external (package).
 */
function classifyImportTarget(target) {
  if (target.startsWith('.') || target.startsWith('/')) {
    return 'local';
  }
  if (NODE_BUILTINS.has(target) || target.startsWith('node:')) {
    return 'node_builtin';
  }
  if (target.startsWith('@')) {
    return 'scoped_package';
  }
  // Check if it looks like a package name (no path separators except in scoped)
  if (!target.includes('/') || target.startsWith('@')) {
    return 'package';
  }
  // Could be a deep import from a package
  return 'package';
}

/**
 * Extract imports from a TypeScript/JavaScript file.
 */
function collectJsTsImports(filePath, content, root) {
  const imports = [];

  // ES module imports
  for (const pattern of ESM_IMPORT_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(content)) !== null) {
      const groups = match;

      // Side-effect import: import 'module'
      if (groups.length === 2 && !groups[0].includes('from')) {
        const target = groups[1];
        const classification = classifyImportTarget(target);
        const resolution = classification === 'local'
          ? resolveRelativeImport(filePath, target, root)
          : { resolved_path: null, status: 'not_local' };

        imports.push({
          source: filePath,
          target,
          type: 'import',
          classification,
          symbols: [],
          resolution_status: resolution.status,
          resolved_path: resolution.resolved_path,
          confidence: 'high',
        });
        continue;
      }

      // Named imports: import { X, Y } from 'module'
      if (groups[0].includes('{')) {
        const namedImports = groups[1]
          .replace(/type\s+/g, '')
          .split(',')
          .map(s => s.trim().split(/\s+as\s+/)[0].trim())
          .filter(Boolean);
        const target = groups[groups.length - 1];
        const classification = classifyImportTarget(target);
        const resolution = classification === 'local'
          ? resolveRelativeImport(filePath, target, root)
          : { resolved_path: null, status: 'not_local' };

        imports.push({
          source: filePath,
          target,
          type: 'import',
          classification,
          symbols: namedImports,
          resolution_status: resolution.status,
          resolved_path: resolution.resolved_path,
          confidence: 'high',
        });
        continue;
      }

      // Default or namespace import
      const symbol = groups[1];
      const target = groups[2] || groups[1];
      const classification = classifyImportTarget(target);
      const resolution = classification === 'local'
        ? resolveRelativeImport(filePath, target, root)
        : { resolved_path: null, status: 'not_local' };

      imports.push({
        source: filePath,
        target,
        type: 'import',
        classification,
        symbols: symbol !== target ? [symbol] : [],
        resolution_status: resolution.status,
        resolved_path: resolution.resolved_path,
        confidence: 'high',
      });
    }
  }

  // CommonJS require
  for (const pattern of CJS_REQUIRE_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(content)) !== null) {
      const groups = match;
      const target = groups[groups.length - 1];
      const symbol = groups.length > 2 ? groups[1] : null;
      const classification = classifyImportTarget(target);
      const resolution = classification === 'local'
        ? resolveRelativeImport(filePath, target, root)
        : { resolved_path: null, status: 'not_local' };

      imports.push({
        source: filePath,
        target,
        type: 'require',
        classification,
        symbols: symbol ? [symbol] : [],
        resolution_status: resolution.status,
        resolved_path: resolution.resolved_path,
        confidence: 'high',
      });
    }
  }

  return imports;
}

// ---------------------------------------------------------------------------
// Phase 4C.1A (Collector v2) — Python imports: relative syntax + deterministic
// repository-local resolution.
//
// Relative imports (`from . import x`, `from .mod import y`, `from ..pkg import z`)
// were previously INVISIBLE: the old patterns required a leading `\w`, so a
// leading dot matched nothing and no record was produced. Relative imports are
// now captured, classified (`relative`), and resolved ONLY against the
// discovered Python file inventory (A3: files are never invented). Unresolved
// and ambiguous targets are preserved with structured reasons — never dropped,
// never fabricated as external dependencies (A4).
// ---------------------------------------------------------------------------

/**
 * Join parenthesized multi-line statements into single logical statements so
 * `from .mod import (\n  a,\n  b,\n)` parses like its one-line form.
 */
function joinPythonStatements(content) {
  const out = [];
  let buf = null;
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (buf !== null) {
      buf.push(trimmed);
      if (trimmed.includes(')')) {
        out.push(buf.join(' '));
        buf = null;
      }
      continue;
    }
    if (/^from\s+\S+\s+import\s+\(/.test(trimmed) && !trimmed.includes(')')) {
      buf = [trimmed];
      continue;
    }
    out.push(trimmed);
  }
  if (buf !== null) out.push(buf.join(' ')); // unterminated: preserve as observed
  return out.filter(Boolean);
}

/**
 * Split an imported-name list (`a, b as c`) into symbols plus an alias map.
 * Strips a single trailing comment. Returns { symbols, aliases }.
 */
function splitPythonImportList(list) {
  const cleaned = list.replace(/^\(/, '').replace(/\)$/, '').replace(/\s+#.*$/, '');
  const symbols = [];
  const aliases = {};
  for (const part of cleaned.split(',')) {
    const item = part.trim();
    if (!item) continue;
    const asMatch = item.match(/^([\w.]+)\s+as\s+(\w+)$/);
    if (asMatch) {
      symbols.push(asMatch[1]);
      aliases[asMatch[1]] = asMatch[2];
    } else if (/^[\w.]+$/.test(item)) {
      symbols.push(item);
    }
  }
  return { symbols, aliases };
}

function pythonHasInit(pyFiles, dirParts) {
  return pyFiles.has([...dirParts, '__init__.py'].join('/'));
}

/**
 * Base directory for a relative import of the given level, following Python
 * package semantics (A5): level 1 = the source file's own package; each
 * further level ascends one package. Ascending is only possible through
 * regular packages (directories containing `__init__.py`) and the collection
 * root is the hard boundary — imports never resolve outside the inventory.
 *
 * @returns {{ parts: string[] }} on success, or { error: string }.
 */
function resolvePythonRelativeBase(dirParts, level, pyFiles) {
  let parts = [...dirParts];
  for (let steps = level - 1; steps > 0; steps--) {
    if (parts.length === 0 || !pythonHasInit(pyFiles, parts)) {
      return { error: 'relative_level_exceeds_package_root' };
    }
    parts = parts.slice(0, -1);
    if (!pythonHasInit(pyFiles, parts)) {
      // Landing spot must itself be a package (or the collection root when
      // the root is a package). Otherwise Python itself would reject the
      // import ("attempted relative import beyond top-level package").
      return { error: 'relative_level_exceeds_package_root' };
    }
  }
  return { parts };
}

/**
 * Resolve one relative module target against the inventory. For
 * `from . import name` the imported name is tried as a module (A3):
 * `name.py` then `name/__init__.py`. For `from .mod import sym` the module is
 * the target. Both candidates valid -> ambiguous (preserved, deterministic
 * ordering); none -> unresolved.
 */
function resolvePythonRelativeImport(sourcePath, level, modulePath, pyFiles) {
  const dirParts = sourcePath.split('/').slice(0, -1);
  const base = resolvePythonRelativeBase(dirParts, level, pyFiles);
  if (base.error) {
    return { status: 'unresolved', reason: base.error };
  }

  const stem = [...base.parts, ...modulePath.split('.')];
  const moduleFile = stem.join('/') + '.py';
  const packageInit = [...stem, '__init__.py'].join('/');
  const hasModuleFile = pyFiles.has(moduleFile);
  const hasPackageInit = pyFiles.has(packageInit);

  if (hasModuleFile && hasPackageInit) {
    return { status: 'unresolved', reason: 'ambiguous', candidates: [moduleFile, packageInit].sort() };
  }
  if (hasModuleFile) return { status: 'resolved', path: moduleFile };
  if (hasPackageInit) return { status: 'resolved', path: packageInit };
  return { status: 'unresolved', reason: 'target_not_found' };
}

/**
 * Extract imports from a Python file (Collector v2).
 *
 * Record model (additive over Phase 3 v1 — existing fields unchanged):
 * - absolute imports: identical to v1, plus `raw` (observed statement) and
 *   `symbol_aliases` when aliases are present.
 * - plain `import a, b`: one record per target (v1 captured only the first).
 * - relative imports: additionally `relative_level` (1 = same package),
 *   `module` (imported module), `classification: 'relative'`; unresolved
 *   records carry `resolution_reason` ('target_not_found' |
 *   'ambiguous' | 'relative_level_exceeds_package_root') and, when
 *   ambiguous, sorted `resolution_candidates`. `resolution_status` stays
 *   within the v1 value set ('resolved' | 'unresolved' | 'not_local') so
 *   downstream consumers need no changes.
 */
function collectPythonImports(filePath, content, pyFiles) {
  const imports = [];

  for (const stmt of joinPythonStatements(content)) {
    // import x[.y][, z][, w as v]
    const importMatch = stmt.match(/^import\s+(.+)$/);
    if (importMatch) {
      const { symbols, aliases } = splitPythonImportList(importMatch[1]);
      for (const name of symbols) {
        const record = {
          source: filePath,
          target: name,
          type: 'import',
          classification: name.includes('.') ? 'package' : 'local',
          symbols: [],
          resolution_status: 'not_local',
          resolved_path: null,
          confidence: 'high',
          raw: stmt,
        };
        if (aliases[name]) record.symbol_aliases = { [name]: aliases[name] };
        imports.push(record);
      }
      continue;
    }

    // from [..dots][module] import a, b as c | ( a, b )
    const fromMatch = stmt.match(/^from\s+(\.*)([\w.]*)\s+import\s+(.+)$/);
    if (!fromMatch) continue;
    const dots = fromMatch[1].length;
    const module = fromMatch[2];
    const { symbols, aliases } = splitPythonImportList(fromMatch[3]);

    if (dots === 0) {
      // Absolute from-import — existing Phase 3 behavior preserved.
      const record = {
        source: filePath,
        target: module,
        type: 'from_import',
        classification: module.includes('.') ? 'package' : 'local',
        symbols,
        resolution_status: 'not_local',
        resolved_path: null,
        confidence: 'high',
        raw: stmt,
      };
      if (Object.keys(aliases).length) record.symbol_aliases = aliases;
      imports.push(record);
      continue;
    }

    // Relative from-import.
    const emitRelative = (mod, syms, recordAliases) => {
      const res = resolvePythonRelativeImport(filePath, dots, mod, pyFiles);
      const record = {
        source: filePath,
        target: '.'.repeat(dots) + mod,
        type: 'from_import',
        classification: 'relative',
        relative_level: dots,
        module: mod,
        symbols: syms,
        resolution_status: res.status,
        resolved_path: res.status === 'resolved' ? res.path : null,
        confidence: 'high',
        raw: stmt,
      };
      if (res.status === 'unresolved') {
        record.resolution_reason = res.reason;
        if (res.candidates) record.resolution_candidates = res.candidates;
      }
      if (recordAliases && Object.keys(recordAliases).length) {
        record.symbol_aliases = recordAliases;
      }
      imports.push(record);
    };

    if (module) {
      // `from .mod import sym...` — the module is the resolution target.
      emitRelative(module, symbols, aliases);
    } else {
      // `from . import name...` — each imported name is tried as a module.
      for (const name of symbols) {
        emitRelative(name, [name], aliases[name] ? { [name]: aliases[name] } : null);
      }
    }
  }

  return imports;
}

/**
 * Collect all imports from source files.
 */
export function collectImports(classifiedFiles, root) {
  const allImports = [];
  const errors = [];

  // Repository-local Python module inventory (A3): the only targets relative
  // imports may resolve to. Package context (A5) is derived from __init__.py
  // presence within this set.
  const pyFiles = new Set(
    classifiedFiles.source
      .filter((f) => f.language === 'Python')
      .map((f) => f.path.split('\\').join('/'))
  );

  for (const file of classifiedFiles.source) {
    const content = safeReadFile(join(root, file.path));
    if (content === null) {
      errors.push({
        file: file.path,
        error: 'could not read file',
        confidence: 'low',
      });
      continue;
    }

    try {
      let fileImports;
      if (file.language === 'Python') {
        fileImports = collectPythonImports(file.path, content, pyFiles);
      } else {
        fileImports = collectJsTsImports(file.path, content, root);
      }
      allImports.push(...fileImports);
    } catch (err) {
      errors.push({
        file: file.path,
        error: `parse error: ${err.message}`,
        confidence: 'low',
      });
    }
  }

  return { imports: allImports, errors };
}
