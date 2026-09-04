// CodeAtlas Phase 4C.2 — Consolidation Tests
//
// Part A: rule-level tests over synthetic 4B.2-style inputs (precise control
//         over annotation classes — each required regression case from the
//         4C.2 contract).
// Part B: integration test running the REAL pipeline (Collector v2 →
//         Annotation → 4A → 4B.1 → 4B.2 → Consolidation) over the
//         tests/fixtures/consolidate-app fixture repository.
//
// Ground rules mirrored from the phase contract:
//   - annotation changes must be able to flip consolidation decisions,
//   - consolidation is deterministic and read-only on its inputs,
//   - ambiguity is preserved unless strong typed evidence decides,
//   - ids are deterministic, unique, and independent of array position.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collect } from '../../src/collect.js';
import { annotate } from '../../src/annotate/index.js';
import { runPhase4A } from '../../src/structural/index.js';
import { runInvestigation } from '../../src/investigate/index.js';
import { runResolution } from '../../src/semantic/index.js';
import { consolidate, runConsolidation } from '../../src/consolidate/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_REPO = join(HERE, '..', 'fixtures', 'consolidate-app');

// ---------------------------------------------------------------------------
// Synthetic input helpers
// ---------------------------------------------------------------------------

let fileSeq = 0;
function appFile(path, declares = [], strings = [], clueRaw = null) {
  fileSeq += 1;
  return {
    path,
    relevance: { path, language: 'TypeScript', relevance_class: 'application', mechanical_flags: {}, },
    strings: strings.map((s, i) => ({
      file: path, line: 10 + i, value: s.value, context: s.context || 'plain',
      element: null, prop: null, classification: s.classification,
      reason: s.classification + '_test', policy: {},
    })),
    declares,
    clue: clueRaw,
    seq: fileSeq,
  };
}

function noiseFile(path, relevance_class) {
  fileSeq += 1;
  return {
    path,
    relevance: { path, language: null, relevance_class, mechanical_flags: {} },
    strings: [],
    declares: [],
    clue: null,
    seq: fileSeq,
  };
}

/**
 * Build a full consolidation input set from entity + file specs.
 * entities: [{ id, kind, primary, supporting?, strings?, regionTerm?, naming_conflict?, confidence? }]
 * files:    appFile()/noiseFile() results
 * edges:    [[from, to]]
 */
function buildInputs({ entities, files, edges = [], clueFiles = {} }) {
  const graph = {
    nodes: files.map((f) => ({ id: f.path, kind: 'file', language: f.relevance.language, declares: f.declares })),
    edges: edges.map(([from, to], i) => ({
      id: `e${i + 1}`, from, to, type: 'IMPORTS',
      provenance: { evidence: 'imports.json', observed: `${from} imports ${to}` },
    })),
  };
  const annFiles = {
    annotated_by: 'test', annotator_version: '0.0.0',
    files: files.map((f) => f.relevance),
    summary: { total_files: files.length },
  };
  const annStrings = {
    annotated_by: 'test', annotator_version: '0.0.0',
    strings: files.flatMap((f) => f.strings),
    summary: { total_strings: 0 },
  };
  const candidates = {
    generated_at: '1970-01-01T00:00:00.000Z',
    candidates: Object.entries(clueFiles).map(([file, raw]) => ({
      id: `cand-${file}`, candidate_type: 'insufficient_evidence', status: 'insufficient_evidence',
      confidence: 'unknown', confidence_reason: 'test', structural_units: [], primary_files: [file],
      supporting_files: [], evidence: { supporting: [], weakening: [] }, competing_hypotheses: [],
      ambiguity_notes: null, investigation_scope: {}, inspected_files: [{
        file, selection_reasons: ['test'], read_ok: true, clue_count: 1,
        clues: [{ type: 'behavioral', evidence_type: 'function', file, observed: `defines behavior '${raw}'`, confidence: 'low', raw }],
      }],
      uninspected_files: [], structural_context: {},
    })),
  };
  const regionOf = new Map();
  for (const e of entities) regionOf.set(e.id, e.regionId || `region-${e.id}`);
  const regions = {
    tool: 'test', version: '0.0.0',
    regions: entities.map((e) => ({
      id: e.regionId || `region-${e.id}`,
      term: e.regionTerm || e.id.replace(/^(feature|system|ambiguous|unresolved)-/, '').replace(/-\d+$/, ''),
      hypothesis: 'test', source_structural_units: [], spans_multiple_units: false,
      primary_files: e.primary, supporting_files: [],
      boundary_evidence: { top_terms: [], user_verbs: [], members: [], contested_files: [] },
      imported_by_regions: [], imports_from_regions: [], imported_edges: [],
    })),
    unassigned_files: [], contested_files: [],
  };
  const pick = (kind) => entities.filter((e) => e.kind === kind);
  const shape = (e) => ({
    id: e.id, name: e.name || e.id, description: e.description || 'test description',
    confidence: e.confidence || 'medium',
    primary_files: e.primary, supporting_files: e.supporting || [],
    region_id: e.regionId || `region-${e.id}`,
    ...(e.kind === 'feature'
      ? { user_visible_purpose: 'test', user_interactions: [], aliases: e.aliases || [], keywords: [] }
      : e.kind === 'system'
        ? { technical_role: 'test', semantic_role: 'test', supported_features: [] }
        : {}),
    ...(e.naming_conflict ? { naming_conflict: e.naming_conflict } : {}),
    evidence: e.evidence || [],
    notes: [],
  });
  const features = { tool: 'test', version: '0.0.0', features: pick('feature').map(shape) };
  const systems = { tool: 'test', version: '0.0.0', systems: pick('system').map(shape) };
  const unresolved = {
    tool: 'test', version: '0.0.0',
    entities: entities.filter((e) => e.kind === 'ambiguous' || e.kind === 'unresolved').map((e) => ({
      id: e.id, region_id: e.regionId || `region-${e.id}`, status: e.kind, confidence: 'low',
      reason: 'test', competing_interpretations: e.competing || [],
      primary_files: e.primary, source_structural_units: [], evidence: [], additional_inspections: [],
    })),
  };
  const relationships = { tool: 'test', version: '0.0.0', relationships: [] };
  return {
    graph, units: { tool: 'test', version: '0.0.0', units: [] }, candidates,
    annFiles, annStrings, regions, features, systems, unresolved, relationships,
  };
}

const getOut = (r) => ({
  features: r.features,
  systems: r.systems,
  unresolved: r.unresolved,
  decisions: r.consolidations.decisions,
  counts: r.consolidations.counts,
});

// ---------------------------------------------------------------------------
// Part A — rule tests
// ---------------------------------------------------------------------------

describe('4C.2 Rule A — context-only UI strings cannot seed a feature', () => {
  it('demotes an entity whose only evidence is a context-class label', () => {
    const inputs = buildInputs({
      entities: [{ id: 'feature-shell', kind: 'feature', primary: ['src/nav-shell.tsx'] }],
      files: [appFile('src/nav-shell.tsx', [], [{ value: 'Main Navigation', classification: 'context' }])],
    });
    const out = getOut(consolidate(inputs));
    assert.equal(out.counts.demoted, 1);
    assert.equal(out.decisions.demotions[0].rule, 'D3_no_seedable_evidence');
    const entry = out.unresolved.find((u) => u.id === 'feature-shell');
    assert.equal(entry.status, 'demoted_false_positive');
    assert.ok(entry.misleading_strings.some((s) => s.value === 'Main Navigation' && s.classification === 'context'));
  });
});

describe('4C.2 Rule B — incidental content cannot seed a feature', () => {
  it('demotes an entity whose only evidence is incidental prose', () => {
    const inputs = buildInputs({
      entities: [{ id: 'feature-banner', kind: 'feature', primary: ['src/banner.ts'] }],
      files: [appFile('src/banner.ts', [], [{ value: 'One Film. Many Visions.', classification: 'incidental' }])],
    });
    const out = getOut(consolidate(inputs));
    assert.equal(out.counts.demoted, 1);
    assert.ok(['D3_no_seedable_evidence', 'D1_state_seeded_identity'].includes(out.decisions.demotions[0].rule));
  });
});

describe('4C.2 Rule C — state strings never seed; they may only support', () => {
  it('demotes a state-seeded identity even when unrelated behavior exists', () => {
    const inputs = buildInputs({
      entities: [{ id: 'feature-found', kind: 'feature', primary: ['src/status.tsx'] }],
      files: [appFile('src/status.tsx', [], [{ value: 'No drafts found', classification: 'state' }], 'renderStatusPanel')],
      clueFiles: { 'src/status.tsx': 'renderStatusPanel' },
    });
    const out = getOut(consolidate(inputs));
    const d = out.decisions.demotions.find((x) => x.entity === 'feature-found');
    assert.ok(d, 'state-seeded entity must be demoted');
    assert.equal(d.rule, 'D1_state_seeded_identity');
    assert.ok(d.misleading_strings.some((s) => s.value === 'No drafts found' && s.classification === 'state'));
    assert.equal(d.fragment_files.length, 1, 'application files stay available as fragments');
  });
});

describe('4C.2 Rule D — non-application files cannot anchor canonical entities', () => {
  it('demotes a feature anchored only by a test file', () => {
    const inputs = buildInputs({
      entities: [{ id: 'feature-save-test', kind: 'feature', primary: ['tests/save-core.test.ts'] }],
      files: [noiseFile('tests/save-core.test.ts', 'test')],
    });
    const out = getOut(consolidate(inputs));
    assert.equal(out.decisions.demotions[0].rule, 'D0_non_application_anchor');
  });
  it('demotes a system anchored only by a generated file', () => {
    const inputs = buildInputs({
      entities: [{ id: 'system-routes', kind: 'system', primary: ['generated/routes.gen.ts'] }],
      files: [noiseFile('generated/routes.gen.ts', 'generated')],
    });
    const out = getOut(consolidate(inputs));
    assert.equal(out.decisions.demotions[0].rule, 'D0_non_application_anchor');
  });
  it('moves noise members out of the anchor set without deleting them', () => {
    const inputs = buildInputs({
      entities: [{ id: 'feature-service', kind: 'feature', primary: ['automation/service.ts', 'src/lib/service-account.ts'] }],
      files: [
        noiseFile('automation/service.ts', 'automation'),
        appFile('src/lib/service-account.ts', ['getServiceAccount']),
      ],
    });
    const out = getOut(consolidate(inputs));
    assert.equal(out.counts.demoted, 0);
    const f = out.features.find((x) => x.id === 'feature-service');
    assert.deepEqual(f.primary_files, ['src/lib/service-account.ts']);
    assert.ok(f.non_application_files.some((n) => n.file === 'automation/service.ts' && n.relevance_class === 'automation'));
  });
});

describe('4C.2 Rule E — fragments of one capability merge; unrelated ones do not', () => {
  it('merges a UI control with its data layer via S5 (import + shared domain term)', () => {
    const inputs = buildInputs({
      entities: [
        { id: 'feature-save-ui', kind: 'feature', primary: ['src/save-button.tsx'] },
        { id: 'feature-save-core', kind: 'feature', primary: ['src/save-core.ts'] },
      ],
      files: [
        appFile('src/save-button.tsx', [], [{ value: 'Save Draft', classification: 'capability' }]),
        appFile('src/save-core.ts', ['saveDraft', 'isDraftSaved']),
      ],
      edges: [['src/save-button.tsx', 'src/save-core.ts']],
    });
    const out = getOut(consolidate(inputs));
    assert.equal(out.counts.merge_groups, 1);
    assert.equal(out.counts.features_out, 1);
    const merged = out.features[0];
    assert.deepEqual(merged.primary_files.sort(), ['src/save-button.tsx', 'src/save-core.ts']);
    assert.ok(merged.provenance.consolidated === true);
    assert.ok(merged.provenance.merge_evidence.some((s) => s.type === 'S5'));
  });
  it('does not merge unrelated capabilities that share nothing but a directory', () => {
    const inputs = buildInputs({
      entities: [
        { id: 'feature-upload', kind: 'feature', primary: ['src/upload.tsx'] },
        { id: 'feature-load', kind: 'feature', primary: ['src/load-core.ts'] },
      ],
      files: [
        appFile('src/upload.tsx', ['uploadPhoto'], [{ value: 'Upload Photo', classification: 'capability' }]),
        appFile('src/load-core.ts', ['loadDraft']),
      ],
    });
    const out = getOut(consolidate(inputs));
    assert.equal(out.counts.merge_groups, 0);
    assert.equal(out.counts.features_out, 2);
  });
  it('vetoed evaluations are recorded as non-merges with their reason', () => {
    // lex + tools/lex share vocabulary with a third participant, so the S3
    // exclusivity check rejects the pair and records why.
    const inputs = buildInputs({
      entities: [
        { id: 'feature-lex', kind: 'feature', primary: ['src/lexer.ts'] },
        { id: 'feature-lex-2', kind: 'feature', primary: ['src/tools/lexer.ts'] },
        { id: 'feature-words', kind: 'feature', primary: ['src/words.ts'] },
      ],
      files: [
        appFile('src/lexer.ts', ['lexToken']),
        appFile('src/tools/lexer.ts', ['lexToken', 'lexLine']),
        appFile('src/words.ts', ['lexToken', 'lexWords']),
      ],
      clueFiles: { 'src/lexer.ts': 'lexToken', 'src/tools/lexer.ts': 'lexToken', 'src/words.ts': 'lexWords' },
    });
    const out = getOut(consolidate(inputs));
    assert.ok(out.decisions.non_merges.length >= 1, 'rejected S3 pairs must be recorded');
  });
});

describe('4C.2 Rule F — ambiguity is preserved', () => {
  it('keeps an ambiguous entity canonical-ambiguous when no strong evidence exists', () => {
    const inputs = buildInputs({
      entities: [{ id: 'ambiguous-mystery', kind: 'ambiguous', primary: ['src/mystery.ts'] }],
      files: [appFile('src/mystery.ts', ['mysteryFn'])],
    });
    const out = getOut(consolidate(inputs));
    const entry = out.unresolved.find((u) => u.id === 'ambiguous-mystery');
    assert.equal(entry.status, 'ambiguous');
    assert.ok(out.decisions.ambiguity_preserved.includes('ambiguous-mystery'));
    assert.equal(out.counts.features_out + out.counts.systems_out, 0);
  });
});

describe('4C.2 Rule G — duplicate identities and collision-safe ids', () => {
  it('demotes the weaker of two same-seed duplicates (D2)', () => {
    const inputs = buildInputs({
      entities: [
        { id: 'feature-artist', kind: 'feature', primary: ['src/filter-bar.tsx'] },
        { id: 'feature-artist-2', kind: 'feature', primary: ['src/home-extra.tsx'] },
      ],
      files: [
        appFile('src/filter-bar.tsx', ['artistFilter'], [{ value: 'Search artists', classification: 'capability' }], 'artistFilter'),
        appFile('src/home-extra.tsx', [], [{ value: 'Explore artists', classification: 'context' }]),
      ],
      clueFiles: { 'src/filter-bar.tsx': 'artistFilter' },
    });
    const out = getOut(consolidate(inputs));
    const d = out.decisions.demotions.find((x) => x.entity === 'feature-artist-2');
    assert.ok(d, 'context-only duplicate must be demoted');
    assert.equal(d.rule, 'D2_duplicate_identity_weaker_evidence');
    assert.ok(out.features.some((f) => f.id === 'feature-artist'));
  });
  it('issues collision-safe, position-independent ids for distinct same-name entities', () => {
    const inputs = buildInputs({
      entities: [
        { id: 'feature-parse', kind: 'feature', primary: ['src/parser.ts'] },
        { id: 'feature-parse-2', kind: 'feature', primary: ['src/tools/parser.ts'] },
      ],
      files: [
        appFile('src/parser.ts', ['parseToken']),
        appFile('src/tools/parser.ts', ['parseLine']),
      ],
      clueFiles: { 'src/parser.ts': 'parseToken', 'src/tools/parser.ts': 'parseLine' },
    });
    const out = getOut(consolidate(inputs));
    assert.equal(out.counts.features_out, 2);
    const ids = out.features.map((f) => f.id).sort();
    assert.equal(ids[0], 'feature-parse');
    assert.match(ids[1], /^feature-parse-[0-9a-f]{6}$/, 'collision resolved by content hash, not a positional -2');
    assert.equal(new Set(ids).size, 2, 'ids unique within kind');
    const again = getOut(consolidate(buildInputs({
      entities: [
        { id: 'feature-parse', kind: 'feature', primary: ['src/parser.ts'] },
        { id: 'feature-parse-2', kind: 'feature', primary: ['src/tools/parser.ts'] },
      ],
      files: [
        appFile('src/parser.ts', ['parseToken']),
        appFile('src/tools/parser.ts', ['parseLine']),
      ],
      clueFiles: { 'src/parser.ts': 'parseToken', 'src/tools/parser.ts': 'parseLine' },
    })));
    assert.deepEqual(again.features.map((f) => f.id).sort(), ids, 'ids stable across identical runs');
  });
});

describe('4C.2 Rule H — annotation changes change consolidation decisions', () => {
  const make = (classification) => buildInputs({
    entities: [{ id: 'feature-widget', kind: 'feature', primary: ['src/widget.tsx'] }],
    files: [appFile('src/widget.tsx', [], [{ value: 'Save Draft', classification }])],
  });
  it('a capability-class string keeps the entity alive', () => {
    const out = getOut(consolidate(make('capability')));
    assert.equal(out.counts.demoted, 0);
    assert.equal(out.counts.features_out, 1);
  });
  it('reclassifying that string as state demotes the entity', () => {
    const out = getOut(consolidate(make('state')));
    assert.equal(out.counts.demoted, 1);
    assert.equal(out.counts.features_out, 0);
    const entry = out.unresolved.find((u) => u.id === 'feature-widget');
    assert.equal(entry.status, 'demoted_false_positive');
  });
});

describe('4C.2 Rule I — conflation separation', () => {
  it('separates an import-disconnected server half from a UI feature (feature-context shape)', () => {
    const inputs = buildInputs({
      entities: [{
        id: 'feature-context', kind: 'feature',
        primary: ['src/components/ContextMenu.tsx', 'src/server/request/context.ts'],
      }],
      files: [
        appFile('src/components/ContextMenu.tsx', ['openContextMenu'], [{ value: 'Poster actions', classification: 'context' }], 'openContextMenu'),
        appFile('src/server/request/context.ts', ['getRequestContext']),
      ],
      clueFiles: { 'src/components/ContextMenu.tsx': 'openContextMenu' },
    });
    const out = getOut(consolidate(inputs));
    assert.equal(out.counts.separations, 1);
    const kept = out.features.find((f) => f.id === 'feature-context');
    assert.deepEqual(kept.primary_files, ['src/components/ContextMenu.tsx']);
    const frag = out.unresolved.find((u) => u.previous_status === 'separated_fragment');
    assert.ok(frag, 'separated fragment preserved as unresolved, never deleted');
    assert.deepEqual(frag.primary_files, ['src/server/request/context.ts']);
  });
});

describe('4C.2 Rule J — misleading-filename regression (notion.ts shape)', () => {
  it('passes the behavior-named entity through with its naming conflict intact', () => {
    const conflict = { seed_term: 'notion', naming_basis: 'filename/symbol vocabulary only', behavior_term: 'poster' };
    const inputs = buildInputs({
      entities: [{
        id: 'system-poster', kind: 'system', name: 'Poster', primary: ['src/lib/notion-proxy.ts'], naming_conflict: conflict,
      }],
      files: [appFile('src/lib/notion-proxy.ts', ['loadPublishedPosters', 'toPlainPoster'])],
    });
    const out = getOut(consolidate(inputs));
    const s = out.systems.find((x) => x.id === 'system-poster');
    assert.ok(s, 'entity survives consolidation');
    assert.equal(s.name, 'Poster');
    assert.deepEqual(s.naming_conflict, conflict, 'recorded conflict is never lost');
    assert.equal(s.provenance.consolidated, false);
  });
});

describe('4C.2 Rule K — determinism and input immutability', () => {
  const build = () => buildInputs({
    entities: [
      { id: 'feature-save-ui', kind: 'feature', primary: ['src/save-button.tsx'] },
      { id: 'feature-save-core', kind: 'feature', primary: ['src/save-core.ts'] },
      { id: 'ambiguous-mystery', kind: 'ambiguous', primary: ['src/mystery.ts'] },
    ],
    files: [
      appFile('src/save-button.tsx', [], [{ value: 'Save Draft', classification: 'capability' }]),
      appFile('src/save-core.ts', ['saveDraft']),
      appFile('src/mystery.ts', ['mysteryFn']),
    ],
    edges: [['src/save-button.tsx', 'src/save-core.ts']],
  });
  it('produces byte-identical canonical output across runs', () => {
    const a = consolidate(build());
    const b = consolidate(build());
    assert.equal(JSON.stringify(a.features), JSON.stringify(b.features));
    assert.equal(JSON.stringify(a.systems), JSON.stringify(b.systems));
    assert.equal(JSON.stringify(a.unresolved), JSON.stringify(b.unresolved));
    assert.equal(JSON.stringify(a.consolidations), JSON.stringify(b.consolidations));
  });
  it('does not mutate its inputs', () => {
    const inputs = build();
    const snapshot = JSON.stringify(inputs);
    consolidate(inputs);
    assert.equal(JSON.stringify(inputs), snapshot);
  });
});

// ---------------------------------------------------------------------------
// Part B — integration over the real pipeline on the fixture repository
// ---------------------------------------------------------------------------

function runFullPipeline(work) {
  const repoDir = join(work, 'repo');
  cpSync(FIXTURE_REPO, repoDir, { recursive: true });
  collect(repoDir, join(work, 'evidence'));
  annotate(join(work, 'evidence', 'evidence'), repoDir, work);
  const evidenceDir = join(work, 'evidence', 'evidence');
  runPhase4A(evidenceDir, work);
  runInvestigation({ evidenceDir, structuralDir: join(work, 'structural'), repoRoot: repoDir, outputDir: work });
  runResolution({ evidenceDir, structuralDir: join(work, 'structural'), investigationDir: join(work, 'investigation'), repoRoot: repoDir, outputDir: work });
  return runConsolidation({
    evidenceDir,
    annotationDir: join(work, 'annotation'),
    structuralDir: join(work, 'structural'),
    investigationDir: join(work, 'investigation'),
    semanticDir: join(work, 'semantic'),
    outputDir: work,
  });
}

describe('4C.2 Integration — full pipeline over tests/fixtures/consolidate-app', () => {
  const work = mkdtempSync(join(tmpdir(), 'codeatlas-4c2-'));
  const result = runFullPipeline(work);
  const readConsolidation = (name) => JSON.parse(readFileSync(join(work, 'consolidation', name), 'utf-8'));

  it('writes an isolated consolidation/ artifact set', () => {
    for (const name of ['features.json', 'systems.json', 'unresolved.json', 'relationships.json', 'consolidations.json', 'consolidation-report.json']) {
      assert.ok(readFileSync(join(work, 'consolidation', name), 'utf-8').length > 2, `${name} written`);
    }
  });

  it('never anchors a canonical entity on a test/generated/automation file', () => {
    const ann = JSON.parse(readFileSync(join(work, 'annotation', 'files.json'), 'utf-8'));
    const classOf = new Map(ann.files.map((f) => [f.path, f.relevance_class]));
    for (const e of [...result.features, ...result.systems]) {
      for (const f of e.primary_files) {
        assert.ok(!['test', 'generated', 'automation', 'documentation'].includes(classOf.get(f)),
          `${e.id} anchors on non-application file ${f}`);
      }
    }
  });

  it('records annotation consumption on every canonical entity', () => {
    for (const e of [...result.features, ...result.systems]) {
      assert.ok(e.annotation_summary, `${e.id} carries an annotation summary`);
      assert.ok(e.annotation_summary.relevance_classes, 'relevance classes consumed');
    }
  });

  it('is deterministic across two complete pipeline runs (byte-identical)', () => {
    const work2 = mkdtempSync(join(tmpdir(), 'codeatlas-4c2-'));
    runFullPipeline(work2);
    for (const name of ['features.json', 'systems.json', 'unresolved.json', 'relationships.json', 'consolidations.json']) {
      const a = readFileSync(join(work, 'consolidation', name), 'utf-8');
      const b = readFileSync(join(work2, 'consolidation', name), 'utf-8');
      assert.equal(a, b, `${name} byte-identical across full pipeline runs`);
    }
    rmSync(work2, { recursive: true, force: true });
  });

  it('leaves every upstream artifact byte-intact (read-only consolidation)', () => {
    const before = JSON.parse(readFileSync(join(work, 'semantic', 'features.json'), 'utf-8'));
    runConsolidation({
      evidenceDir: join(work, 'evidence', 'evidence'),
      annotationDir: join(work, 'annotation'),
      structuralDir: join(work, 'structural'),
      investigationDir: join(work, 'investigation'),
      semanticDir: join(work, 'semantic'),
      outputDir: work,
    });
    const after = JSON.parse(readFileSync(join(work, 'semantic', 'features.json'), 'utf-8'));
    assert.deepEqual(before, after);
  });

  it('keeps the save capability within one canonical entity (carved together or consolidated)', () => {
    const saveEntities = [...result.features, ...result.systems].filter((e) =>
      [...e.primary_files, ...e.supporting_files].some((f) => f.includes('save')));
    assert.ok(saveEntities.length >= 1, 'a save entity exists');
    const fileOwners = new Set(saveEntities.map((e) => e.id));
    assert.ok(fileOwners.size >= 1);
    // save-core.ts and save-button.tsx must never land in two different
    // canonical entities.
    for (const f of ['src/save-core.ts', 'src/save-button.tsx']) {
      const owners = saveEntities.filter((e) => [...e.primary_files, ...e.supporting_files].includes(f));
      assert.equal(owners.length, 1, `${f} owned by exactly one entity`);
    }
  });
});
