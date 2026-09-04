// CodeAtlas Phase 4C.3 — Projection Completeness (R11) + Unfamiliar-Repo Smoke Tests
//
// Runs the REAL full pipeline (Collector v2 → Annotation → 4A → 4B.1 → 4B.2 →
// 4C.2 → 4C.3 → projection) over small unfamiliar-style fixtures and asserts:
//   - no crashes, valid output, deterministic output,
//   - no source mutation, no unsupported certainty,
//   - complete projections (R11): every canonical entity has a page, every
//     page references valid entities/files, nothing silently omitted.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collect } from '../../src/collect.js';
import { annotate } from '../../src/annotate/index.js';
import { runPhase4A } from '../../src/structural/index.js';
import { runInvestigation } from '../../src/investigate/index.js';
import { runResolution } from '../../src/semantic/index.js';
import { runConsolidation } from '../../src/consolidate/index.js';
import { runCanonical } from '../../src/canonical/index.js';
import { render } from '../../src/project/render.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, '..', 'fixtures');

function runFullPipeline(fixtureName) {
  const work = mkdtempSync(join(tmpdir(), `c3-${fixtureName}-`));
  const repoDir = join(work, 'repo');
  cpSync(join(FIXTURES, fixtureName), repoDir, { recursive: true });
  const before = JSON.stringify(snapshotTree(repoDir));

  collect(repoDir, join(work, 'evidence'));
  annotate(join(work, 'evidence', 'evidence'), repoDir, work);
  const evidenceDir = join(work, 'evidence', 'evidence');
  runPhase4A(evidenceDir, work);
  runInvestigation({ evidenceDir, structuralDir: join(work, 'structural'), repoRoot: repoDir, outputDir: work });
  runResolution({ evidenceDir, structuralDir: join(work, 'structural'), investigationDir: join(work, 'investigation'), repoRoot: repoDir, outputDir: work });
  runConsolidation({
    evidenceDir, annotationDir: join(work, 'annotation'), structuralDir: join(work, 'structural'),
    investigationDir: join(work, 'investigation'), semanticDir: join(work, 'semantic'), outputDir: work,
  });
  runCanonical({
    evidenceDir, annotationDir: join(work, 'annotation'), structuralDir: join(work, 'structural'),
    investigationDir: join(work, 'investigation'), semanticDir: join(work, 'semantic'),
    consolidationDir: join(work, 'consolidation'), repoRoot: repoDir, outputDir: work,
  });
  render({ canonicalDir: join(work, 'canonical'), outputDir: work });

  // No source mutation.
  const after = JSON.stringify(snapshotTree(repoDir));
  assert.equal(after, before, `${fixtureName}: repository untouched by the pipeline`);
  return work;
}

function snapshotTree(dir) {
  const out = {};
  const walk = (d, prefix = '') => {
    for (const ent of readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
      if (ent.isDirectory()) walk(join(d, ent.name), rel);
      else out[rel] = readFileSync(join(d, ent.name), 'utf-8');
    }
  };
  walk(dir);
  return out;
}

for (const fixture of ['smoke-react-app', 'smoke-python-cli']) {
  describe(`4C.3 Unfamiliar-repo smoke — ${fixture}`, () => {
    const work = runFullPipeline(fixture);
    const canonicalDir = join(work, 'canonical');
    const mdDir = join(work, 'markdown');

    it('produces valid canonical artifacts', () => {
      for (const name of ['features.json', 'systems.json', 'unresolved.json', 'relationships.json', 'files.json', 'canonical-report.json']) {
        const doc = JSON.parse(readFileSync(join(canonicalDir, name), 'utf-8'));
        assert.ok(doc, `${name} parses`);
      }
    });

    it('asserts no unsupported certainty (no unknown entity without recorded reason)', () => {
      const unresolved = JSON.parse(readFileSync(join(canonicalDir, 'unresolved.json'), 'utf-8')).entities;
      for (const u of unresolved) {
        assert.ok(u.reason || u.description, `${u.id} carries a recorded reason`);
      }
    });

    it('R11: every canonical feature and system has a Markdown page', () => {
      const features = JSON.parse(readFileSync(join(canonicalDir, 'features.json'), 'utf-8')).features;
      const systems = JSON.parse(readFileSync(join(canonicalDir, 'systems.json'), 'utf-8')).systems;
      for (const f of features) assert.ok(existsSync(join(mdDir, 'features', `${f.id}.md`)), `page for ${f.id}`);
      for (const s of systems) assert.ok(existsSync(join(mdDir, 'systems', `${s.id}.md`)), `page for ${s.id}`);
    });

    it('R11: no Markdown entity page exists without a canonical entity', () => {
      const features = new Set(JSON.parse(readFileSync(join(canonicalDir, 'features.json'), 'utf-8')).features.map((f) => f.id));
      const systems = new Set(JSON.parse(readFileSync(join(canonicalDir, 'systems.json'), 'utf-8')).systems.map((s) => s.id));
      for (const f of readdirSync(join(mdDir, 'features'))) assert.ok(features.has(f.replace(/\.md$/, '')), `no fabricated page ${f}`);
      for (const s of readdirSync(join(mdDir, 'systems'))) assert.ok(systems.has(s.replace(/\.md$/, '')), `no fabricated page ${s}`);
    });

    it('R11: every page references only valid entity ids and recorded files', () => {
      const features = JSON.parse(readFileSync(join(canonicalDir, 'features.json'), 'utf-8')).features;
      const systems = JSON.parse(readFileSync(join(canonicalDir, 'systems.json'), 'utf-8')).systems;
      const validIds = new Set([...features, ...systems].map((e) => e.id));
      const validFiles = new Set(JSON.parse(readFileSync(join(canonicalDir, 'files.json'), 'utf-8')).files.map((f) => f.path));
      const rels = JSON.parse(readFileSync(join(canonicalDir, 'relationships.json'), 'utf-8')).relationships;
      for (const r of rels) {
        assert.ok(validIds.has(r.source) && validIds.has(r.target), `relationship endpoints valid: ${r.source} -> ${r.target}`);
      }
      for (const e of [...features, ...systems]) {
        const page = readFileSync(join(mdDir, e.id.startsWith('feature') ? 'features' : 'systems', `${e.id}.md`), 'utf-8');
        for (const pf of e.primary_files) {
          assert.ok(validFiles.has(pf), `${e.id} references recorded file ${pf}`);
          assert.ok(page.includes(pf), `page of ${e.id} lists its file ${pf}`);
        }
      }
    });

    it('R11: unresolved/ambiguous entities appear in the projection (never silently omitted)', () => {
      const unresolved = JSON.parse(readFileSync(join(canonicalDir, 'unresolved.json'), 'utf-8')).entities;
      const page = readFileSync(join(mdDir, 'unresolved.md'), 'utf-8');
      for (const u of unresolved) assert.ok(page.includes(u.id), `unresolved page includes ${u.id}`);
      const index = readFileSync(join(mdDir, 'INDEX.md'), 'utf-8');
      for (const u of unresolved) assert.ok(index.includes(u.id), `index includes ${u.id}`);
    });

    it('R11: technical aliases resolve to canonical names in the index', () => {
      const features = JSON.parse(readFileSync(join(canonicalDir, 'features.json'), 'utf-8')).features;
      const systems = JSON.parse(readFileSync(join(canonicalDir, 'systems.json'), 'utf-8')).systems;
      const index = readFileSync(join(mdDir, 'INDEX.md'), 'utf-8');
      for (const e of [...features, ...systems]) {
        for (const t of e.provenance?.implementation_terms || []) {
          assert.ok(index.includes(`\`${t}\``), `implementation term '${t}' indexed for ${e.id}`);
        }
      }
    });

    it('repeated rendering is deterministic (byte-identical)', () => {
      const first = readFileSync(join(mdDir, 'INDEX.md'), 'utf-8');
      render({ canonicalDir, outputDir: join(work, 'rerender') });
      const second = readFileSync(join(work, 'rerender', 'markdown', 'INDEX.md'), 'utf-8');
      assert.equal(first, second);
    });
  });
}
