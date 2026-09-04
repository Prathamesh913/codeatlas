// CodeAtlas Phase 4B.2 — Orchestrator: Semantic Carving & Canonical Resolution
//
// Pipeline:
//   Phase 3 evidence + Phase 4A structure + Phase 4B.1 investigations
//     -> evidence token profiles
//     -> Semantic Regions (carved by evidence affinity; may split or span units)
//     -> bounded incremental inspection (reuse-first)
//     -> canonical resolution: feature / system / ambiguous / unresolved
//     -> evidence-backed semantic relationships
//
// Output is written to an ISOLATED <outputDir>/semantic/ directory.
// Phase 3 evidence, Phase 4A structural output, Phase 4B.1 investigation
// output, and Phase 2 maps are never modified.

import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildProfiles } from './tokens.js';
import { carveRegions } from './carve.js';
import { createInspector, indexClues, resolveRegion, MAX_EXTRA_PER_REGION, MAX_EXTRA_TOTAL } from './resolve.js';
import { buildRelationships } from './relationships.js';

export const TOOL = 'codeatlas-semantic-resolver';
export const VERSION = '0.4.3';

export function runResolution({ evidenceDir, structuralDir, investigationDir, repoRoot, outputDir }) {
  const graph = JSON.parse(readFileSync(join(structuralDir, 'graph.json'), 'utf-8'));
  const analysis = JSON.parse(readFileSync(join(structuralDir, 'analysis.json'), 'utf-8'));
  const unitsDoc = JSON.parse(readFileSync(join(structuralDir, 'units.json'), 'utf-8'));
  const candidatesDoc = JSON.parse(readFileSync(join(investigationDir, 'candidates.json'), 'utf-8'));

  const { profiles, df, uiTerms, nameTerms, conceptTerms } = buildProfiles(graph, candidatesDoc.candidates);
  const carved = carveRegions(graph, profiles, df, unitsDoc.units, uiTerms, nameTerms, conceptTerms);
  const regions = carved.regions;

  const clueIndex = indexClues(candidatesDoc.candidates);
  const inspector = createInspector({ repoRoot, graph, clueIndex });

  const entities = regions.map((r) => resolveRegion(r, inspector, graph, df));

  // Stable canonical ids even when two regions share a term slug
  const used = new Map();
  for (const e of entities) {
    const n = used.get(e.id) || 0;
    used.set(e.id, n + 1);
    if (n > 0) e.id = `${e.id}-${n + 1}`;
  }

  const relationships = buildRelationships(entities, regions, graph);

  const features = entities
    .filter((e) => e.status === 'feature')
    .map((e) => ({
      id: e.id,
      name: e.name,
      description: e.description,
      user_visible_purpose: e.purpose,
      user_interactions: e.aliases.slice(0, 4).map((a) => `Recognized user phrasing: "${a}"`),
      location_context: e.source_structural_units.length
        ? `Implementation spans ${e.source_structural_units.length} structural area(s).`
        : null,
      aliases: e.aliases,
      keywords: e.keywords,
      primary_files: e.primary_files,
      supporting_files: e.supporting_files,
      data_dependencies: e.imports_from_regions,
      confidence: e.confidence,
      notes: [e.confidence_reason],
      region_id: e.region_id,
      spans_multiple_units: e.spans_multiple_units,
      contested_files: e.contested_files,
      naming_conflict: e.naming_conflict,
      additional_inspections: e.additional_inspections,
      evidence: e.evidence,
    }))
    .sort((a, b) => (a.id < b.id ? -1 : 1));

  const systems = entities
    .filter((e) => e.status === 'system')
    .map((e) => ({
      id: e.id,
      name: e.name,
      description: e.description,
      technical_role: `Shared ${e.term} capability consumed by ${e.imported_by_regions.length} semantic regions.`,
      semantic_role: e.purpose,
      supported_features: e.imported_by_regions.map((rid) => entities.find((x) => x.region_id === rid)?.id).filter(Boolean),
      primary_files: e.primary_files,
      supporting_files: e.supporting_files,
      confidence: e.confidence,
      notes: [e.confidence_reason],
      region_id: e.region_id,
      spans_multiple_units: e.spans_multiple_units,
      contested_files: e.contested_files,
      naming_conflict: e.naming_conflict,
      additional_inspections: e.additional_inspections,
      evidence: e.evidence,
    }))
    .sort((a, b) => (a.id < b.id ? -1 : 1));

  const unresolved = entities
    .filter((e) => e.status === 'ambiguous' || e.status === 'unresolved')
    .map((e) => ({
      id: e.id,
      region_id: e.region_id,
      status: e.status,
      confidence: e.confidence,
      reason: e.confidence_reason,
      competing_interpretations: e.competing_interpretations,
      primary_files: e.primary_files,
      source_structural_units: e.source_structural_units,
      evidence: e.evidence,
      additional_inspections: e.additional_inspections,
    }))
    .sort((a, b) => (a.id < b.id ? -1 : 1));

  const base = join(outputDir, 'semantic');
  mkdirSync(base, { recursive: true });

  const regionDocs = regions.map((r) => {
    const e = entities.find((x) => x.region_id === r.id);
    return {
      id: r.id,
      term: r.term,
      hypothesis: r.hypothesis,
      source_structural_units: r.source_structural_units,
      spans_multiple_units: r.spans_multiple_units,
      primary_files: r.primary_files,
      supporting_files: r.supporting_files,
      boundary_evidence: r.boundary_evidence,
      imported_by_regions: r.imported_by_regions,
      imports_from_regions: r.imports_from_regions,
      candidate_type: e?.status || 'unresolved',
      confidence: e?.confidence || 'unknown',
      competing_interpretations: e?.competing_interpretations || [],
      additional_inspections: e?.additional_inspections || [],
    };
  });

  const report = {
    tool: TOOL,
    version: VERSION,
    inputs: { evidenceDir, structuralDir, investigationDir, repoRoot },
    inspection: {
      files_reused_from_phase4b1: clueIndex.size - inspector.state.log.length,
      additional_files_inspected: inspector.state.total,
      additional_inspection_limit_per_region: MAX_EXTRA_PER_REGION,
      additional_inspection_limit_total: MAX_EXTRA_TOTAL,
      total_files_in_graph: graph.nodes.filter((n) => n.kind === 'file').length,
      additional_inspection_log: inspector.state.log,
    },
    counts: {
      structural_units: unitsDoc.units.length,
      semantic_regions: regions.length,
      features: features.length,
      systems: systems.length,
      ambiguous: unresolved.filter((u) => u.status === 'ambiguous').length,
      unresolved: unresolved.filter((u) => u.status === 'unresolved').length,
      relationships: relationships.length,
      unassigned_files: carved.unassigned.length,
      contested_files: carved.contested_files.length,
    },
    boundaries: {
      regions_spanning_multiple_units: regions.filter((r) => r.spans_multiple_units && !r.is_shared_infrastructure).length,
      units_split_into_multiple_regions: countSplits(unitsDoc.units, regionDocs),
    },
  };

  writeJson(join(base, 'regions.json'), { tool: TOOL, version: VERSION, regions: regionDocs, unassigned_files: carved.unassigned, contested_files: carved.contested_files });
  writeJson(join(base, 'features.json'), { tool: TOOL, version: VERSION, features });
  writeJson(join(base, 'systems.json'), { tool: TOOL, version: VERSION, systems });
  writeJson(join(base, 'relationships.json'), { tool: TOOL, version: VERSION, relationships });
  writeJson(join(base, 'unresolved.json'), { tool: TOOL, version: VERSION, entities: unresolved });
  writeJson(join(base, 'resolution-report.json'), report);

  return { regions: regionDocs, features, systems, unresolved, relationships, report };
}

function countSplits(units, regionDocs) {
  let n = 0;
  for (const u of units) {
    const touching = regionDocs.filter((r) => r.primary_files.some((f) => u.members.includes(f)));
    if (touching.length > 1) n++;
  }
  return n;
}

function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}
