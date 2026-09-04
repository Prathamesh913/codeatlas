// CodeAtlas Phase 4A — Orchestrator
//
// Loads Phase 3 evidence, normalizes it into an implementation graph, runs
// deterministic structural analysis, and writes derived JSON output.
//
// Output (derived; raw Phase 3 evidence is never modified):
//   <outputDir>/structural/graph.json     — nodes + edges with provenance
//   <outputDir>/structural/units.json     — candidate Structural Units
//   <outputDir>/structural/analysis.json  — structural signals

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildGraph, loadEvidence, TOOL, VERSION } from './graph.js';
import { analyze } from './analysis.js';

/**
 * Run the Phase 4A evidence-to-graph pipeline.
 *
 * @param {string} evidenceDir - Directory containing Phase 3 evidence JSON.
 * @param {string} outputDir - Directory under which `structural/` will be written.
 */
export function runPhase4A(evidenceDir, outputDir) {
  const evidence = loadEvidence(evidenceDir);
  const graph = buildGraph(evidence);
  const analysis = analyze(graph);
  const units = buildUnits(graph, analysis);

  const base = join(outputDir, 'structural');
  mkdirSync(base, { recursive: true });

  // Core derived files are structurally deterministic (no timestamps), so that
  // repeat runs produce byte-identical output. Provenance/time goes in manifest.json.
  const graphOut = {
    tool: TOOL,
    version: VERSION,
    nodes: graph.nodes,
    edges: graph.edges,
  };

  const unitsOut = {
    tool: TOOL,
    version: VERSION,
    structural_unit_term: 'Structural Unit',
    unit_count: units.length,
    units,
  };

  const analysisOut = {
    tool: TOOL,
    version: VERSION,
    ...analysis,
  };

  const summary = {
    nodes: graph.nodes.length,
    file_nodes: count(graph.nodes, 'file'),
    external_nodes: count(graph.nodes, 'external_dependency'),
    unresolved_nodes: count(graph.nodes, 'unresolved_module'),
    entry_nodes: count(graph.nodes, 'entry_point'),
    edges: graph.edges.length,
    imports_edges: countType(graph.edges, 'IMPORTS'),
    references_edges: countType(graph.edges, 'REFERENCES'),
    declares_edges: countType(graph.edges, 'DECLARES'),
    entrypoint_edges: countType(graph.edges, 'ENTRYPOINT_FOR'),
    components: analysis.connectivity.component_count,
    orphans: analysis.connectivity.orphan_count,
    hubs: analysis.hubs.length,
    bridges: analysis.bridges.length,
    cycles: analysis.cycles.length,
    structural_units: units.length,
  };

  const manifestOut = {
    tool: TOOL,
    version: VERSION,
    generated_at: new Date().toISOString(),
    evidence_source: evidenceDir,
    output_dir: base,
    summary,
  };

  writeJson(join(base, 'graph.json'), graphOut);
  writeJson(join(base, 'units.json'), unitsOut);
  writeJson(join(base, 'analysis.json'), analysisOut);
  writeJson(join(base, 'manifest.json'), manifestOut);

  return { graphOut, units, analysis, manifest: manifestOut, outputDir: base, evidenceDir };
}

/**
 * Build candidate Structural Units from connected components.
 *
 * A Structural Unit is a connected component of the file implementation graph,
 * annotated with structural signals (hubs, bridges, cycles, orphans). It is a
 * deliberately NEUTRAL term: it names no Feature or System.
 */
export function buildUnits(graph, analysis) {
  const fileIds = new Set(graph.nodes.filter((n) => n.kind === 'file').map((n) => n.id));

  const units = analysis.connectivity.components.map((comp) => {
    const members = comp.members;
    const memberSet = new Set(members);

    const hubs = analysis.hubs
      .filter((h) => memberSet.has(h.file))
      .map((h) => h.file)
      .sort();
    const bridges = analysis.bridges
      .filter((b) => memberSet.has(b.from) && memberSet.has(b.to))
      .map((b) => [b.from, b.to])
      .sort((a, b) => (a[0] + a[1] < b[0] + b[1] ? -1 : 1));
    const cycles = analysis.cycles
      .filter((c) => c.every((m) => memberSet.has(m)))
      .map((c) => c)
      .sort((a, b) => b.length - a.length || (a[0] < b[0] ? -1 : 1));
    const orphans = analysis.connectivity.orphans.filter((o) => memberSet.has(o));

    return {
      id: '',
      size: members.length,
      members,
      hubs,
      bridges,
      cycles,
      orphans,
      reason: buildReason(members, hubs, bridges, cycles, orphans),
    };
  });

  // Stable ordering: largest first, then lexicographically by smallest member.
  units.sort((a, b) => b.size - a.size || (a.members[0] < b.members[0] ? -1 : 1));
  units.forEach((u, i) => {
    u.id = `unit-${String(i + 1).padStart(3, '0')}`;
  });

  return units;
}

function buildReason(members, hubs, bridges, cycles, orphans) {
  const parts = [];
  parts.push(
    `Connected component of ${members.length} file(s) joined by IMPORTS/REFERENCES edges.`
  );
  if (hubs.length) parts.push(`Contains local hub(s): ${hubs.join(', ')}.`);
  if (bridges.length) parts.push(`Contains ${bridges.length} bridge edge(s).`);
  if (cycles.length) parts.push(`Contains ${cycles.length} dependency cycle(s).`);
  if (orphans.length) parts.push(`Contains orphan file(s): ${orphans.join(', ')}.`);
  return parts.join(' ');
}

function count(nodes, kind) {
  return nodes.filter((n) => n.kind === kind).length;
}
function countType(edges, type) {
  return edges.filter((e) => e.type === type).length;
}
function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}
