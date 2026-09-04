// CodeAtlas Phase 4A — Structural Graph Fixture Tests
//
// Deterministic tests over minimal Phase 3 evidence fixtures.
// These validate the graph builder + structural analysis without any
// semantic interpretation (no Features, Systems, or Flows are produced).

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { runPhase4A, buildUnits } from '../../src/structural/index.js';
import { loadEvidence, buildGraph } from '../../src/structural/graph.js';
import { analyze } from '../../src/structural/analysis.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIX = join(__dirname, '..', 'fixtures', 'structural');

function runScenario(name) {
  const out = mkdtempSync(join(tmpdir(), `p4a-${name}-`));
  const res = runPhase4A(join(FIX, name, 'evidence'), out);
  return { res, out };
}

function loadScenario(name) {
  const ev = loadEvidence(join(FIX, name, 'evidence'));
  const graph = buildGraph(ev);
  const analysis = analyze(graph);
  return { ev, graph, analysis };
}

describe('Fixture A — Linear Dependency (A → B → C)', () => {
  it('produces one connected Structural Unit with correct members', () => {
    const { analysis } = loadScenario('linear-a');
    assert.equal(analysis.connectivity.component_count, 1);
    const comp = analysis.connectivity.components[0];
    assert.deepEqual(comp.members, ['A.ts', 'B.ts', 'C.ts']);
  });

  it('detects no cycle', () => {
    const { analysis } = loadScenario('linear-a');
    assert.equal(analysis.cycles.length, 0);
  });

  it('entry-point reachability covers the whole chain', () => {
    const { analysis } = loadScenario('linear-a');
    const ep = analysis.entrypoint_reachability[0];
    assert.ok(ep, 'should have an entry point');
    assert.equal(ep.entry_file, 'A.ts');
    assert.deepEqual(ep.reachable_files, ['A.ts', 'B.ts', 'C.ts']);
  });

  it('writes valid deterministic JSON', () => {
    const { res, out } = runScenario('linear-a');
    for (const f of ['graph.json', 'units.json', 'analysis.json']) {
      const p = join(out, 'structural', f);
      assert.ok(existsSync(p), `${f} exists`);
      assert.doesNotThrow(() => JSON.parse(readFileSync(p, 'utf-8')), `${f} valid JSON`);
    }
    // determinism: re-run yields identical graph.json
    const out2 = mkdtempSync(join(tmpdir(), 'p4a-A2-'));
    runPhase4A(join(FIX, 'linear-a', 'evidence'), out2);
    const a = readFileSync(join(out, 'structural', 'graph.json'), 'utf-8');
    const b = readFileSync(join(out2, 'structural', 'graph.json'), 'utf-8');
    assert.equal(a, b, 'graph.json is deterministic across runs');
  });
});

describe('Fixture B — Shared Hub (A ─┐ / H / B ─┘)', () => {
  it('identifies H as a local hub', () => {
    const { analysis } = loadScenario('shared-hub-b');
    const hub = analysis.hubs.find((h) => h.file === 'H.ts');
    assert.ok(hub, 'H.ts should be a hub');
    assert.equal(hub.degree, 2);
  });

  it('adds a REFERENCES edge for the imported symbol', () => {
    const { graph } = loadScenario('shared-hub-b');
    const ref = graph.edges.find(
      (e) => e.type === 'REFERENCES' && e.from === 'A.ts' && e.to === 'H.ts'
    );
    assert.ok(ref, 'should have REFERENCES edge A.ts -> H.ts');
    assert.deepEqual(ref.provenance.matched_symbols, ['sharedUtil']);
  });

  it('assigns no semantic meaning', () => {
    const { res } = runScenario('shared-hub-b');
    const units = res.units;
    assert.ok(units.length >= 1);
    assert.ok(!JSON.stringify(res.units).includes('Feature'));
    assert.ok(!JSON.stringify(res.units).includes('System'));
  });
});

describe('Fixture C — Two Chains connected by a Bridge', () => {
  it('forms a single component with bridges identified', () => {
    const { analysis } = loadScenario('bridge-c');
    assert.equal(analysis.connectivity.component_count, 1);
    assert.ok(analysis.bridges.length >= 1, 'should detect bridge edges');
    // The connective edge C—D is among the bridges.
    const hasCD = analysis.bridges.some(
      (b) => (b.from === 'C.ts' && b.to === 'D.ts') || (b.from === 'D.ts' && b.to === 'C.ts')
    );
    assert.ok(hasCD, 'C.ts—D.ts should be identified as a connecting bridge');
  });

  it('explains the bridge with underlying evidence', () => {
    const { graph, analysis } = loadScenario('bridge-c');
    const bridge = analysis.bridges.find(
      (b) => (b.from === 'C.ts' && b.to === 'D.ts') || (b.from === 'D.ts' && b.to === 'C.ts')
    );
    const edge = graph.edges.find(
      (e) =>
        e.type === 'IMPORTS' &&
        ((e.from === 'C.ts' && e.to === 'D.ts') || (e.from === 'D.ts' && e.to === 'C.ts'))
    );
    assert.ok(edge, 'bridge backed by an IMPORTS edge');
    assert.ok(edge.provenance.evidence === 'imports.json');
  });
});

describe('Fixture D — Cycle (A → B → C → A)', () => {
  it('detects the dependency cycle', () => {
    const { analysis } = loadScenario('cycle-d');
    assert.equal(analysis.cycles.length, 1);
    assert.deepEqual(analysis.cycles[0].slice().sort(), ['A.ts', 'B.ts', 'C.ts']);
  });

  it('does not assign semantic meaning to the cycle', () => {
    const { res } = runScenario('cycle-d');
    assert.ok(!JSON.stringify(res.graphOut).toLowerCase().includes('feature'));
  });
});

describe('Fixture E — Unresolved Reference', () => {
  it('preserves the unresolved module node and does not crash', () => {
    const { graph } = loadScenario('unresolved-e');
    const unresolved = graph.nodes.find((n) => n.kind === 'unresolved_module');
    assert.ok(unresolved, 'unresolved module node should be preserved');
    assert.equal(unresolved.id, 'unresolved:missing-module');
  });

  it('keeps A and B connected while preserving the dangling import', () => {
    const { analysis, graph } = loadScenario('unresolved-e');
    assert.equal(analysis.connectivity.component_count, 1);
    const dangling = graph.edges.find(
      (e) => e.type === 'IMPORTS' && e.to === 'unresolved:missing-module'
    );
    assert.ok(dangling, 'dangling import edge preserved');
    assert.equal(dangling.provenance.resolution_status, 'unresolved');
  });
});

describe('Fixture F — Orphan', () => {
  it('identifies the isolated file as an orphan', () => {
    const { analysis } = loadScenario('orphan-f');
    assert.equal(analysis.connectivity.component_count, 2);
    assert.deepEqual(analysis.connectivity.orphans, ['Z.ts']);
  });

  it('keeps the connected pair as a separate unit', () => {
    const { analysis } = loadScenario('orphan-f');
    const pair = analysis.connectivity.components.find((c) => c.members.includes('A.ts'));
    assert.ok(pair, 'A.ts in a component');
    assert.deepEqual(pair.members, ['A.ts', 'B.ts']);
  });
});

describe('buildUnits — Structural Unit neutrality', () => {
  it('produces units without Feature/System semantics', () => {
    const { ev, graph, analysis } = loadScenario('linear-a');
    const units = buildUnits(graph, analysis);
    assert.equal(units.length, 1);
    assert.match(units[0].id, /^unit-\d{3}$/);
    assert.ok(units[0].reason.includes('Connected component'), 'reason is structural, not semantic');
  });
});
