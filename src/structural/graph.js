// CodeAtlas Phase 4A — Evidence Normalization + Graph Construction
//
// Phase 4A STRUCTURES what Phase 3 OBSERVED. It does not interpret meaning.
// This module loads Phase 3 evidence, normalizes file references, resolves
// internal module imports that Phase 3 left unresolved, and builds a derived
// implementation graph with full provenance back to the source evidence.

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, posix as pathPosix } from 'node:path';

export const TOOL = 'codeatlas-structural-graph';
export const VERSION = '0.4.0';

const SOURCE_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.mts', '.cts'];
const ASSET_EXTS = ['.css', '.scss', '.less', '.json', '.svg'];
const PY_INIT_EXT = '.py';

// Generated / build-artifact directory prefixes excluded from the implementation
// graph. Phase 3 does not exclude these; Phase 4A normalization drops them so the
// graph reflects source, not compiled output. Raw evidence is untouched.
export const EXCLUDE_GENERATED_PREFIXES = [
  '.vercel', '.output', 'dist', 'build', '.next', '.nuxt', '.turbo',
  'coverage', '__pycache__', '.git', 'node_modules', '.cache',
  '.parcel-cache', 'out',
];

export function normalizePath(p) {
  let n = String(p).split('\\').join('/');
  while (n.startsWith('./')) n = n.slice(2);
  return n;
}

export function isGenerated(p) {
  const parts = normalizePath(p).split('/');
  return parts.some((part) => EXCLUDE_GENERATED_PREFIXES.includes(part));
}

/**
 * Load Phase 3 evidence from a directory. Required: files.json + imports.json.
 * Optional: symbols.json, entrypoints.json, repository.json, config.json, manifest.json.
 */
export function loadEvidence(evidenceDir) {
  const read = (name) => {
    const fp = join(evidenceDir, name);
    if (!existsSync(fp)) return null;
    try {
      return JSON.parse(readFileSync(fp, 'utf-8'));
    } catch {
      return null;
    }
  };

  const files = read('files.json');
  const imports = read('imports.json');
  if (!Array.isArray(files)) throw new Error(`Phase 3 evidence missing or invalid: files.json (expected array) in ${evidenceDir}`);
  if (!Array.isArray(imports)) throw new Error(`Phase 3 evidence missing or invalid: imports.json (expected array) in ${evidenceDir}`);

  return {
    files,
    imports,
    symbols: read('symbols.json') || [],
    entrypoints: read('entrypoints.json') || [],
    repository: read('repository.json') || null,
    config: read('config.json') || null,
    manifest: read('manifest.json') || null,
  };
}

/**
 * Build a normalized implementation graph from Phase 3 evidence.
 *
 * Node kinds: file | external_dependency | unresolved_module | entry_point
 * Edge types: IMPORTS | DECLARES | REFERENCES | ENTRYPOINT_FOR
 */
export function buildGraph(evidence) {
  const { files, imports, symbols, entrypoints } = evidence;

  // --- File nodes (exclude generated/build artifacts) ---
  const fileNodes = new Map();
  for (const f of files) {
    if (f.included === false) continue;
    const id = normalizePath(f.path);
    if (isGenerated(id)) continue;
    fileNodes.set(id, {
      id,
      kind: 'file',
      language: f.language || null,
      file_type: f.type || null,
      size: f.size ?? null,
      declares: [],
    });
  }

  // --- Symbol index (file -> Set of declared symbol names) ---
  const symbolsByFile = new Map();
  for (const s of symbols) {
    const fid = normalizePath(s.file);
    if (!symbolsByFile.has(fid)) symbolsByFile.set(fid, new Set());
    symbolsByFile.get(fid).add(s.name);
  }
  for (const [fid, set] of symbolsByFile) {
    if (fileNodes.has(fid)) fileNodes.get(fid).declares = [...set].sort();
  }

  // --- Entry-point nodes ---
  const entryNodes = new Map();
  for (const ep of entrypoints) {
    const eid = 'entry:' + normalizePath(ep.file || ep.description || `ep${entryNodes.size}`);
    entryNodes.set(eid, {
      id: eid,
      kind: 'entry_point',
      label: ep.description || ep.type,
      entry_type: ep.type || null,
      target_file: ep.file ? normalizePath(ep.file) : null,
      confidence: ep.confidence || null,
    });
  }

  const edges = [];
  let edgeSeq = 0;
  const addEdge = (from, to, type, provenance) => {
    edges.push({ id: `e${edgeSeq++}`, from, to, type, provenance });
  };

  // Attempt to resolve an import target to a known file node.
  const resolveToFile = (target, sourceFile) => {
    // Relative import (./ or ../)
    if (target.startsWith('.')) {
      const joined = pathPosix.normalize(pathPosix.join(sourceFile ? dirname(sourceFile) : '.', target));
      const cand = normalizePath(joined);
      for (const ext of [...SOURCE_EXTS, ...ASSET_EXTS]) {
        if (fileNodes.has(cand + ext)) return cand + ext;
      }
      if (fileNodes.has(cand + `/__init__${PY_INIT_EXT}`)) return cand + `/__init__${PY_INIT_EXT}`;
      return null;
    }
    // Absolute module path (projectdock.cli -> projectdock/cli.py)
    const slash = normalizePath(target.split('.').join('/'));
    for (const ext of [...SOURCE_EXTS, ...ASSET_EXTS]) {
      if (fileNodes.has(slash + ext)) return slash + ext;
    }
    if (fileNodes.has(slash + `/__init__${PY_INIT_EXT}`)) return slash + `/__init__${PY_INIT_EXT}`;
    return null;
  };

  // --- IMPORTS edges + REFERENCES edges ---
  for (const imp of imports) {
    const srcId = normalizePath(imp.source);
    if (!fileNodes.has(srcId)) continue; // source is generated/excluded

    const target = imp.target;
    const symbolsList = Array.isArray(imp.symbols) ? imp.symbols : [];
    let targetId = null;
    let targetKind = null;
    let resolution = imp.resolution_status || 'not_local';

    // 1. Already resolved by Phase 3
    if (resolution === 'resolved' && imp.resolved_path) {
      const rp = normalizePath(imp.resolved_path);
      if (fileNodes.has(rp)) {
        targetId = rp;
        targetKind = 'file';
        resolution = 'resolved';
      }
    }
    // 2. Phase 4A normalization (internal module imports left unresolved by Phase 3)
    if (!targetId) {
      const rid = resolveToFile(target, srcId);
      if (rid) {
        targetId = rid;
        targetKind = 'file';
        resolution = 'resolved_phase4a';
      }
    }
    // 3. Fallback classification
    if (!targetId) {
      if (resolution === 'unresolved') {
        targetId = 'unresolved:' + normalizePath(target);
        targetKind = 'unresolved_module';
      } else {
        targetId = 'ext:' + normalizePath(target);
        targetKind = 'external_dependency';
      }
    }

    addEdge(srcId, targetId, 'IMPORTS', {
      evidence: 'imports.json',
      source_file: srcId,
      target,
      observed: `file '${srcId}' imports '${target}'${symbolsList.length ? ` (symbols: ${symbolsList.join(', ')})` : ''}`,
      import_type: imp.type || null,
      classification: imp.classification || null,
      resolution_status: resolution,
    });

    // REFERENCES: an imported symbol is actually declared by the target file
    if (targetKind === 'file' && symbolsList.length && symbolsByFile.get(targetId)) {
      const declared = symbolsByFile.get(targetId);
      const matched = symbolsList.filter((s) => declared.has(s));
      if (matched.length) {
        addEdge(srcId, targetId, 'REFERENCES', {
          evidence: 'imports.json+symbols.json',
          source_file: srcId,
          target_file: targetId,
          matched_symbols: matched,
          observed: `file '${srcId}' imports symbol(s) ${matched.join(', ')} declared by '${targetId}'`,
        });
      }
    }
  }

  // --- DECLARES edges (file -> symbol; symbol is provenance, not a graph node) ---
  for (const [fid, set] of symbolsByFile) {
    if (!fileNodes.has(fid)) continue;
    for (const name of set) {
      addEdge(fid, `symbol:${name}`, 'DECLARES', {
        evidence: 'symbols.json',
        source_file: fid,
        symbol: name,
        observed: `file '${fid}' declares symbol '${name}'`,
      });
    }
  }

  // --- ENTRYPOINT_FOR edges ---
  for (const [eid, node] of entryNodes) {
    if (node.target_file && fileNodes.has(node.target_file)) {
      addEdge(eid, node.target_file, 'ENTRYPOINT_FOR', {
        evidence: 'entrypoints.json',
        entry: node.label,
        target_file: node.target_file,
        observed: `entry point '${node.label}' enters file '${node.target_file}'`,
      });
    }
  }

  // --- Collect all nodes (file + entry + referenced external/unresolved) ---
  const nodes = [...fileNodes.values(), ...entryNodes.values()];
  const refIds = new Set();
  for (const e of edges) {
    if (e.type === 'DECLARES') continue;
    refIds.add(e.to);
  }
  for (const id of refIds) {
    if (!nodes.some((n) => n.id === id)) {
      let kind = 'external_dependency';
      let label = id.startsWith('ext:') ? id.slice(4) : id.slice('unresolved:'.length);
      if (id.startsWith('unresolved:')) {
        kind = 'unresolved_module';
        label = id.slice('unresolved:'.length);
      }
      nodes.push({ id, kind, label, category: kind === 'unresolved_module' ? 'unresolved' : 'external' });
    }
  }

  // Deterministic ordering
  nodes.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  edges.sort((a, b) => {
    const ka = a.from + a.to + a.type + a.provenance.observed;
    const kb = b.from + b.to + b.type + b.provenance.observed;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });

  return {
    nodes,
    edges,
    meta: { file_node_count: fileNodes.size, entry_node_count: entryNodes.size },
  };
}
