// CodeAtlas Phase 4B.2 — Fixture harness
// Builds Phase 3-style evidence from a synthetic fixture repo, then runs the
// REAL pipeline: Phase 4A -> Phase 4B.1 -> Phase 4B.2.

import { mkdirSync, writeFileSync, mkdtempSync, readdirSync, statSync, readFileSync, copyFileSync } from 'node:fs';
import { join, dirname, posix } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { runPhase4A } from '../../src/structural/index.js';
import { runInvestigation } from '../../src/investigate/index.js';
import { runResolution } from '../../src/semantic/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
export const SRC_FIXTURES = join(HERE, 'src');

const EXT_LANG = {
  '.ts': 'TypeScript', '.tsx': 'TypeScript JSX', '.js': 'JavaScript',
  '.jsx': 'JavaScript JSX', '.mjs': 'JavaScript (ESM)', '.py': 'Python',
};

function listFiles(dir, prefix = '') {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    if (name === 'node_modules' || name === '.git') continue;
    const full = join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    if (statSync(full).isDirectory()) out.push(...listFiles(full, rel));
    else out.push({ full, rel });
  }
  return out;
}

function base(p) {
  return p.split('/').pop();
}

function declaredSymbols(content, ext) {
  const out = new Set();
  if (ext === '.py') {
    for (const m of content.matchAll(/^def\s+(\w+)/gm)) out.add(m[1]);
    for (const m of content.matchAll(/^class\s+(\w+)/gm)) out.add(m[1]);
  } else {
    for (const m of content.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)) out.add(m[1]);
    for (const m of content.matchAll(/export\s+(?:const|let|var)\s+(\w+)/g)) out.add(m[1]);
    for (const m of content.matchAll(/export\s+class\s+(\w+)/g)) out.add(m[1]);
    for (const m of content.matchAll(/(?:const|function)\s+([A-Z]\w+)/g)) out.add(m[1]);
  }
  return [...out];
}

function symbolsImported(content, target) {
  const esc = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const out = [];
  for (const re of [
    new RegExp(`import\\s*\\{([^}]+)\\}\\s*from\\s*["']${esc}["']`, 'g'),
    new RegExp(`import\\s+\\{([^}]+)\\}\\s+from\\s+["']${esc}["']`, 'g'),
  ]) {
    for (const m of content.matchAll(re)) {
      for (const s of m[1].split(',')) {
        const t = s.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim();
        if (t) out.push(t);
      }
    }
  }
  return [...new Set(out)];
}

/** Minimal Phase 3-compatible evidence generator for fixture repos. */
function buildEvidence(repoDir, evidenceDir) {
  const all = listFiles(repoDir);
  const rels = all.map((f) => f.rel);
  const filesJson = [];
  const imports = [];
  const symbols = [];
  const entrypoints = [];

  const resolveTarget = (target, sourceRel) => {
    if (target.startsWith('.')) {
      const cand0 = posix.normalize(posix.join(dirname(sourceRel) || '.', target));
      for (const ext of ['.ts', '.tsx', '.js', '.jsx', '.py', '']) {
        const cand = cand0 + ext;
        if (rels.includes(cand)) return { resolved: cand, classification: 'local' };
      }
      return { resolved: null, classification: 'local' };
    }
    const slash = target.split('.').join('/');
    for (const ext of ['.ts', '.tsx', '.js', '.jsx', '.py']) {
      if (rels.includes(slash + ext)) return { resolved: slash + ext, classification: 'package' };
    }
    return { resolved: null, classification: 'package' };
  };

  for (const { full, rel } of all) {
    const ext = '.' + (base(rel).split('.').pop() || '');
    const language = EXT_LANG[ext] || null;
    filesJson.push({
      path: rel, extension: ext, language, type: language || 'other',
      size: 100, included: true, excluded_reason: null,
    });
    if (!language) continue;

    const content = readFileSync(full, 'utf-8');

    let m;
    for (const re of [
      /(?:^|\n)\s*(?:import|export)\s+(?:[\w*\s{},]*\s+)?from\s+["']([^"']+)["']/g,
      /import\s*\(\s*["']([^"']+)["']\s*\)/g,
    ]) {
      while ((m = re.exec(content)) !== null) {
        const target = m[1];
        if (target.startsWith('@') && !target.includes('/')) continue;
        const { resolved, classification } = resolveTarget(target, rel);
        imports.push({
          source: rel, target, type: 'import', classification,
          symbols: symbolsImported(content, target),
          resolution_status: resolved ? 'resolved' : 'not_local',
          resolved_path: resolved || null, confidence: 'high',
        });
      }
    }
    for (const mm of content.matchAll(/^from\s+([\w.]+)\s+import\s+(.+)$/gm)) {
      const target = mm[1];
      const syms = mm[2].split(',').map((s) => s.trim().split(' as ')[0].replace(/[()]/g, '')).filter(Boolean);
      const { resolved, classification } = resolveTarget(target, rel);
      imports.push({
        source: rel, target, type: 'from_import', classification, symbols: syms,
        resolution_status: resolved ? 'resolved' : 'not_local',
        resolved_path: resolved || null, confidence: 'high',
      });
    }
    for (const mm of content.matchAll(/^import\s+([\w.]+)\s*$/gm)) {
      const target = mm[1];
      const { resolved, classification } = resolveTarget(target, rel);
      imports.push({
        source: rel, target, type: 'import', classification, symbols: [],
        resolution_status: resolved ? 'resolved' : 'not_local',
        resolved_path: resolved || null, confidence: 'high',
      });
    }
    for (const sym of declaredSymbols(content, ext)) {
      symbols.push({ file: rel, name: sym, symbol_kind: 'named_export', confidence: 'high' });
    }
  }

  mkdirSync(evidenceDir, { recursive: true });
  writeJson(join(evidenceDir, 'files.json'), filesJson);
  writeJson(join(evidenceDir, 'imports.json'), imports);
  writeJson(join(evidenceDir, 'symbols.json'), symbols);
  writeJson(join(evidenceDir, 'entrypoints.json'), entrypoints);
}

function writeJson(p, d) {
  writeFileSync(p, JSON.stringify(d, null, 2) + '\n');
}

/** Run 4A -> 4B.1 -> 4B.2 end to end on a fixture source directory. */
export function runPipeline(fixtureName) {
  const src = join(SRC_FIXTURES, fixtureName);
  const work = mkdtempSync(join(tmpdir(), `p4b2-${fixtureName}-`));
  const repoDir = join(work, 'repo');
  mkdirSync(repoDir, { recursive: true });
  copyTree(src, repoDir);

  const evidenceDir = join(work, 'evidence');
  buildEvidence(repoDir, evidenceDir);

  runPhase4A(evidenceDir, work);
  const structuralDir = join(work, 'structural');
  runInvestigation({ evidenceDir, structuralDir, repoRoot: repoDir, outputDir: work });
  const investigationDir = join(work, 'investigation');

  const res = runResolution({ evidenceDir, structuralDir, investigationDir, repoRoot: repoDir, outputDir: work });
  return { ...res, work, repoDir, structuralDir, investigationDir, evidenceDir };
}

function copyTree(from, to) {
  for (const ent of readdirSync(from, { withFileTypes: true })) {
    const a = join(from, ent.name);
    const b = join(to, ent.name);
    if (ent.isDirectory()) {
      mkdirSync(b, { recursive: true });
      copyTree(a, b);
    } else {
      mkdirSync(dirname(b), { recursive: true });
      copyFileSync(a, b);
    }
  }
}
