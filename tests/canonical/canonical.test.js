// CodeAtlas Phase 4C.3 — Canonical Resolution Tests (naming, typing, VOI)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canonicalize } from '../../src/canonical/index.js';

// --- synthetic input helpers -------------------------------------------------

function annFile(path, cls = 'application', declares = []) {
  return { path, language: 'TypeScript', relevance_class: cls, mechanical_flags: {} };
}
function capString(file, value) {
  return { file, line: 1, value, context: 'plain', element: null, prop: null, classification: 'capability', reason: 'test', policy: {} };
}
function stateString(file, value) {
  return { file, line: 2, value, context: 'plain', element: null, prop: null, classification: 'state', reason: 'test', policy: {} };
}
function ctxString(file, value) {
  return { file, line: 3, value, context: 'plain', element: null, prop: null, classification: 'context', reason: 'test', policy: {} };
}

function buildInputs({ entities = [], files = [], strings = [], edges = [], merges = [], idMap = [], repoFiles = {}, clueFiles = {} }) {
  const graph = {
    nodes: files.map((p) => ({ id: p, kind: 'file', language: 'TypeScript', declares: [] })),
    edges: edges.map(([from, to], i) => ({ id: `e${i + 1}`, from, to, type: 'IMPORTS', provenance: {} })),
  };
  const annFiles = { files: files.map((p) => annFile(p)) };
  const annStrings = { strings };
  const candidates = {
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
  const shape = (e) => ({
    id: e.id, name: e.name || e.id, description: e.description || 'd',
    confidence: e.confidence || 'low',
    primary_files: e.primary, supporting_files: [],
    region_id: `region-${e.id}`,
    ...(e.kind === 'feature'
      ? { user_visible_purpose: null, user_interactions: [], aliases: e.aliases || [], keywords: e.keywords || [] }
      : { technical_role: null, semantic_role: null, supported_features: [] }),
    non_application_files: [],
    provenance: {},
    evidence: [],
    notes: [],
  });
  const features = { features: entities.filter((e) => e.kind === 'feature').map(shape) };
  const systems = { systems: entities.filter((e) => e.kind === 'system').map(shape) };
  const unresolved = {
    entities: entities.filter((e) => e.kind === 'ambiguous').map((e) => ({
      id: e.id, region_id: `region-${e.id}`, status: 'ambiguous', confidence: 'low',
      reason: 'test ambiguity', competing_interpretations: e.competing || [],
      primary_files: e.primary, evidence: [],
    })),
  };
  return {
    graph, candidates, annFiles, annStrings,
    semanticFeatures: { features: [] }, semanticSystems: { systems: [] },
    features, systems, unresolved,
    relationships: { relationships: [] },
    decisions: { decisions: { id_map: idMap, merges: merges, demotions: [], separations: [], non_splits: [], non_merges: [], ambiguity_preserved: [], dropped_relationships: [] } },
    repoRoot: null,
  };
}

function writeRepo(files) {
  const dir = mkdtempSync(join(tmpdir(), 'c3-repo-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = join(dir, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content);
  }
  return dir;
}

// --- naming authority --------------------------------------------------------

describe('4C.3 Naming — tiered authority', () => {
  it('Tier 1: a capability label with verb+noun names a feature, previous name kept as alias', () => {
    const inputs = buildInputs({
      entities: [{ id: 'feature-artist', kind: 'feature', name: 'Artist', primary: ['src/header.tsx'] }],
      files: ['src/header.tsx'],
      strings: [capString('src/header.tsx', 'Search posters, artists, tags…')],
    });
    const r = canonicalize(inputs);
    const f = r.features.find((x) => x.id === 'feature-artist');
    assert.ok(f, 'entity survives');
    // The label "Search posters, artists, tags…" names this entity's own
    // domain — the seed-related noun ('artist') is preferred in the phrase.
    assert.equal(f.name, 'Search Artist');
    assert.equal(f.provenance.naming_evidence.tier, 1);
    assert.ok(f.aliases.includes('Artist'), 'previous name preserved as alias');
    assert.ok(f.provenance.naming_evidence.changed === true);
  });

  it('Tier 4 fallback: entity with only technical identity keeps its name; symbols recorded as implementation terms', () => {
    const inputs = buildInputs({
      entities: [{ id: 'system-util', kind: 'system', name: 'Util', primary: ['src/util.ts'] }],
      files: ['src/util.ts'],
      strings: [],
    });
    const r = canonicalize(inputs);
    const s = r.systems.find((x) => x.id === 'system-util');
    assert.equal(s.name, 'Util');
    assert.equal(s.provenance.naming_evidence.tier, 4);
    assert.equal(s.provenance.naming_evidence.basis, 'technical_vocabulary_only');
  });

  it('behavior-only vocabulary never retitles an entity (Tier 3 is alias material)', () => {
    const inputs = buildInputs({
      entities: [{ id: 'feature-keep', kind: 'feature', name: 'Keep', primary: ['src/keep.ts'] }],
      files: ['src/keep.ts'],
      strings: [stateString('src/keep.ts', 'kept for later')],
    });
    const r = canonicalize(inputs);
    const f = r.features.find((x) => x.id === 'feature-keep');
    assert.equal(f.name, 'Keep', 'behavioral text must not retitle');
  });
});

// --- typing authority ----------------------------------------------------------

describe('4C.3 Typing — conservative type review', () => {
  it('T1: an infrastructure cluster with a filename-derived feature type is corrected to system', () => {
    const inputs = buildInputs({
      entities: [{ id: 'feature-sync', kind: 'feature', name: 'Sync', primary: ['src/data-sync.ts'] }],
      files: ['src/data-sync.ts'],
    });
    // Declared symbols give the model its behavior vocabulary.
    inputs.graph.nodes[0].declares = ['syncData', 'migrateDatabase', 'cacheStore'];
    const r = canonicalize(inputs);
    const s = r.systems.find((x) => x.id === 'feature-sync');
    assert.ok(s, 'corrected into systems');
    assert.equal(s.provenance.type_review.rule, 'T1_infrastructure_not_user_capability');
    assert.ok(!r.features.some((x) => x.id === 'feature-sync'));
  });

  it('T2 guard: a multi-file user capability with labels is NOT flipped to system', () => {
    const inputs = buildInputs({
      entities: [{ id: 'feature-editor', kind: 'feature', name: 'Editor', confidence: 'medium', primary: ['src/editor-modal.tsx', 'src/editor-core.ts'] }],
      files: ['src/editor-modal.tsx', 'src/editor-core.ts'],
      strings: [capString('src/editor-modal.tsx', 'Edit Entry')],
    });
    const r = canonicalize(inputs);
    const f = r.features.find((x) => x.id === 'feature-editor');
    assert.ok(f, 'stays a feature');
    assert.equal(f.provenance.type_review.corrected, false);
  });

  it('T3 guard: a shared system with UI strings and external consumers stays a system', () => {
    const inputs = buildInputs({
      entities: [{ id: 'system-auth', kind: 'system', name: 'Auth', confidence: 'medium', primary: ['src/auth.ts'] }],
      files: ['src/auth.ts', 'src/app.tsx'],
      strings: [capString('src/auth.ts', 'Sign In')],
      edges: [['src/app.tsx', 'src/auth.ts'], ['src/other.tsx', 'src/auth.ts']],
    });
    // src/other.tsx is not declared as an inventory file; add it
    inputs.graph.nodes.push({ id: 'src/other.tsx', kind: 'file', language: 'TypeScript', declares: [] });
    inputs.annFiles.files.push(annFile('src/other.tsx'));
    const r = canonicalize(inputs);
    const s = r.systems.find((x) => x.id === 'system-auth');
    assert.ok(s, 'stays a system');
    assert.equal(s.provenance.type_review.rule, 'T3_shared_system_with_ui_text');
  });
});

// --- VOI inspection --------------------------------------------------------------

describe('4C.3 VOI — value-of-information inspection', () => {
  it('reclassifies a route-shell entity (feature-lobby shape) with recorded evidence', () => {
    const repo = writeRepo({
      'src/__root.tsx': `export function NotFoundComponent() { return <p>Lost</p>; }\nexport function ErrorComponent() { return <p>Err</p>; }\n`,
    });
    const inputs = buildInputs({
      entities: [{ id: 'feature-lobby', kind: 'feature', name: 'Lobby', primary: ['src/__root.tsx'] }],
      files: ['src/__root.tsx'],
      strings: [
        stateString('src/__root.tsx', 'Lost'), stateString('src/__root.tsx', 'Interrupted'),
        ctxString('src/__root.tsx', 'Back'), ctxString('src/__root.tsx', 'Reload'),
      ],
      clueFiles: { 'src/__root.tsx': 'NotFoundComponent' },
    });
    inputs.repoRoot = repo;
    const r = canonicalize(inputs);
    assert.ok(!r.features.some((f) => f.id === 'feature-lobby'), 'reclassified away from canonical');
    const u = r.unresolved.find((x) => x.id === 'feature-lobby');
    assert.equal(u.status, 'reclassified_shell_context');
    const voi = r.report.voi.questions.find((q) => q.id === 'voi-shell-feature-lobby');
    assert.equal(voi.decision, 'reclassify_shell_context');
    assert.ok(voi.files_inspected.includes('src/__root.tsx'));
    assert.equal(voi.changed_output, true);
    rmSync(repo, { recursive: true, force: true });
  });

  it('confirms a consolidation merge by verifying its recorded vocabulary at behavior level', () => {
    const repo = writeRepo({
      'src/auth.ts': `export function initializeAuthSession() {}\n`,
      'src/auth-middleware.ts': `export function requireUid() {}\n`,
    });
    const inputs = buildInputs({
      entities: [{ id: 'system-auth', kind: 'system', name: 'Auth', primary: ['src/auth.ts', 'src/auth-middleware.ts'] }],
      files: ['src/auth.ts', 'src/auth-middleware.ts'],
    });
    inputs.repoRoot = repo;
    // The original pre-merge members (semantic output) provide the file
    // partitioning that merge_strength re-examines.
    inputs.semanticSystems = {
      systems: [
        { id: 'system-auth-init', name: 'Init', primary_files: ['src/auth.ts'], supporting_files: [] },
        { id: 'system-auth-middleware', name: 'Middleware', primary_files: ['src/auth-middleware.ts'], supporting_files: [] },
      ],
    };
    inputs.decisions.decisions.merges.push({
      members: ['system-auth-init', 'system-auth-middleware'],
      mode: 'single_system',
      evidence: [{ type: 'S5', edges: [{ edge: 'e1', shared_terms: ['auth'] }] }],
    });
    inputs.decisions.decisions.id_map.push({ original_ids: ['system-auth-init', 'system-auth-middleware'], final_id: 'system-auth', basis: 'merge' });
    const r = canonicalize(inputs);
    const voi = r.report.voi.questions.find((q) => q.kind === 'merge_strength');
    assert.ok(voi, 'merge_strength question enumerated');
    assert.equal(voi.decision, 'confirm_merge');
    assert.ok(voi.shared_terms.includes('auth'), 'recorded term confirmed by reading');
    assert.ok(r.systems.some((s) => s.id === 'system-auth'), 'merged entity stands');
    rmSync(repo, { recursive: true, force: true });
  });

  it('enforces the deterministic inspection budget', () => {
    const repo = writeRepo({
      'src/a.ts': 'export function alphaFn() {}\n',
      'src/b.ts': 'export function betaFn() {}\n',
    });
    const inputs = buildInputs({
      entities: [
        { id: 'feature-lobby-a', kind: 'feature', name: 'LA', primary: ['src/a.ts'] },
        { id: 'feature-lobby-b', kind: 'feature', name: 'LB', primary: ['src/b.ts'] },
      ],
      files: ['src/a.ts', 'src/b.ts'],
      strings: [
        stateString('src/a.ts', 'lost'), ctxString('src/a.ts', 'Back'), ctxString('src/a.ts', 'Reload'),
        stateString('src/b.ts', 'lost'), ctxString('src/b.ts', 'Back'), ctxString('src/b.ts', 'Reload'),
      ],
    });
    // make both read the same shell-ish content so both trigger shell questions
    writeFileSync(join(repo, 'src/a.ts'), 'export function NotFoundComponent() {}\n');
    writeFileSync(join(repo, 'src/b.ts'), 'export function ErrorComponent() {}\n');
    inputs.repoRoot = repo;
    const r = canonicalize(inputs, { maxVoiTotalReads: 1 });
    assert.ok(r.report.voi.budget.used <= 1, `budget enforced (used ${r.report.voi.budget.used})`);
    assert.equal(r.report.voi.budget.limit, 1);
    rmSync(repo, { recursive: true, force: true });
  });

  it('preserves ambiguity and records what would resolve it', () => {
    const inputs = buildInputs({
      entities: [{ id: 'ambiguous-x', kind: 'ambiguous', primary: ['src/x.ts'] }],
      files: ['src/x.ts'],
    });
    const r = canonicalize(inputs);
    const u = r.unresolved.find((x) => x.id === 'ambiguous-x');
    assert.equal(u.status, 'ambiguous');
    assert.ok(u.description.length > 0);
  });
});

// --- descriptions --------------------------------------------------------------

describe('4C.3 Descriptions — evidence-grounded templates', () => {
  it('feature descriptions cite capability evidence and never invent actions', () => {
    const inputs = buildInputs({
      entities: [{ id: 'feature-submit', kind: 'feature', name: 'Submit', confidence: 'high', primary: ['src/submit.tsx'] }],
      files: ['src/submit.tsx'],
      strings: [capString('src/submit.tsx', 'Submit Poster')],
    });
    const r = canonicalize(inputs);
    const f = r.features[0];
    assert.match(f.description, /[Ss]ubmit/);
    assert.ok(f.user_interactions.includes('Submit Poster'));
  });

  it('demoted entities keep a recorded, non-deleted description', () => {
    const inputs = buildInputs({
      entities: [],
      files: ['src/x.ts'],
    });
    inputs.unresolved.entities.push({
      id: 'feature-found', region_id: 'r', status: 'demoted_false_positive', confidence: 'low',
      reason: 'state-seeded identity', misleading_strings: [{ value: 'No posters found', classification: 'state', file: 'src/x.ts' }],
      primary_files: ['src/x.ts'],
    });
    const r = canonicalize(inputs);
    const u = r.unresolved.find((x) => x.id === 'feature-found');
    assert.match(u.description, /not deleted|false positive/i);
    assert.ok(u.misleading_strings.length === 1);
  });
});

// --- R6 regression: automation files cannot anchor canonical entities ---------
// (D0 demotion for automation anchors lives in the consolidation stage, whose
// test suite covers it; 4C.3 must never promote a noise-anchored entity and
// must keep anchor classes clean.)

describe('R6 regression — automation-file anchoring', () => {
  it('canonical anchors are application files only; noise provenance is preserved', () => {
    const inputs = buildInputs({
      entities: [{ id: 'feature-palette', kind: 'feature', name: 'Palette', primary: ['scripts/extract.js'] }],
      files: ['scripts/extract.js'],
    });
    inputs.annFiles.files[0].relevance_class = 'automation';
    const r = canonicalize(inputs);
    for (const e of [...r.features, ...r.systems]) {
      for (const pf of e.primary_files) {
        assert.equal(inputs.annFiles.files.find((f) => f.path === pf)?.relevance_class, 'application',
          'canonical anchors are application files only');
      }
      if (e.non_application_files?.length) {
        assert.ok(e.non_application_files.every((n) => n.relevance_class && n.file), 'noise provenance recorded');
      }
    }
  });
});

// --- R12 regression: misleading technical naming / type authority -------------

describe('R12 regression — technical language never outranks user-facing evidence', () => {
  it('a filename-implied name loses to a recorded capability label; filename survives as implementation term', () => {
    const inputs = buildInputs({
      entities: [{ id: 'system-notion', kind: 'system', name: 'Notion', primary: ['src/notion.ts'] }],
      files: ['src/notion.ts'],
      strings: [capString('src/notion.ts', 'Load Poster')],
    });
    const r = canonicalize(inputs);
    const s = r.systems.find((x) => x.id === 'system-notion');
    assert.ok(s, 'entity survives');
    assert.equal(s.name, 'Load Poster', 'capability label outranks filename');
    assert.equal(s.provenance.naming_evidence.tier, 1);
    assert.ok(s.provenance.implementation_terms.includes('notion'), 'technical name preserved');
    assert.ok(s.aliases.includes('Notion'), 'previous name preserved as alias');
  });

  it('a system is never forced into a feature merely because it spans multiple files', () => {
    const inputs = buildInputs({
      entities: [{ id: 'system-store', kind: 'system', name: 'Store', confidence: 'medium', primary: ['src/store-a.ts', 'src/store-b.ts', 'src/store-c.ts'] }],
      files: ['src/store-a.ts', 'src/store-b.ts', 'src/store-c.ts'],
    });
    const r = canonicalize(inputs);
    assert.ok(r.systems.some((s) => s.id === 'system-store'), 'stays a system');
    assert.ok(!r.features.some((f) => f.id === 'system-store'));
  });
});

// --- determinism -----------------------------------------------------------------

describe('4C.3 Determinism', () => {
  it('two identical runs produce identical canonical output', () => {
    const mk = () => buildInputs({
      entities: [
        { id: 'feature-artist', kind: 'feature', name: 'Artist', primary: ['src/header.tsx'] },
        { id: 'system-auth', kind: 'system', name: 'Auth', primary: ['src/auth.ts'] },
      ],
      files: ['src/header.tsx', 'src/auth.ts'],
      strings: [capString('src/header.tsx', 'Search posters')],
    });
    const a = canonicalize(mk());
    const b = canonicalize(mk());
    assert.equal(JSON.stringify(a.features), JSON.stringify(b.features));
    assert.equal(JSON.stringify(a.systems), JSON.stringify(b.systems));
    assert.equal(JSON.stringify(a.report), JSON.stringify(b.report));
  });
});
