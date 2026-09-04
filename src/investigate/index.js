// CodeAtlas Phase 4B.1 — Orchestrator
//
// For each Structural Unit: select high-information files → targeted source
// inspection → semantic clue extraction → hypothesis generation → Semantic Candidate.
//
// Output (derived; Phase 3 evidence and Phase 4A structural output are untouched):
//   <outputDir>/investigation/candidates.json
//   <outputDir>/investigation/investigations.json
//   <outputDir>/investigation/units/unit-XXX.json

import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { selectHighInformationFiles } from './select.js';
import { inspectFiles } from './inspect.js';
import { hypothesize } from './hypothesize.js';

export const TOOL = 'codeatlas-semantic-investigator';
export const VERSION = '0.4.1';

export function runInvestigation({ evidenceDir, structuralDir, repoRoot, outputDir }) {
  const graph = JSON.parse(readFileSync(join(structuralDir, 'graph.json'), 'utf-8'));
  const analysis = JSON.parse(readFileSync(join(structuralDir, 'analysis.json'), 'utf-8'));
  const unitsDoc = JSON.parse(readFileSync(join(structuralDir, 'units.json'), 'utf-8'));
  const units = unitsDoc.units || [];

  const base = join(outputDir, 'investigation');
  const unitsDir = join(base, 'units');
  mkdirSync(unitsDir, { recursive: true });

  const candidates = [];
  const investigations = [];

  for (const unit of units) {
    const selected = selectHighInformationFiles(unit, graph, analysis);
    const inspected = inspectFiles(selected, repoRoot, graph);
    const hypo = hypothesize(unit, inspected, graph, analysis);

    const uninspected = unit.members.filter((f) => !selected.some((s) => s.file === f));

    const candidate = {
      id: `candidate-${unit.id}`,
      candidate_type: hypo.candidate_type,
      hypothesis: hypo.hypothesis,
      status: hypo.candidate_type,
      confidence: hypo.confidence,
      confidence_reason: hypo.confidence_reason,
      structural_units: [unit.id],
      primary_files: selected.map((s) => s.file),
      supporting_files: unit.members,
      evidence: hypo.evidence,
      competing_hypotheses: hypo.competing_hypotheses,
      ambiguity_notes: hypo.ambiguity_notes,
      investigation_scope: {
        unit_members: unit.members.length,
        inspected_count: inspected.length,
        uninspected_count: uninspected.length,
        repo_root: repoRoot,
      },
      inspected_files: inspected.map((r) => ({
        file: r.file,
        selection_reasons: selected.find((s) => s.file === r.file)?.reasons || [],
        read_ok: r.read_ok,
        clue_count: r.clues.length,
        clues: r.clues,
      })),
      uninspected_files: uninspected,
      structural_context: {
        size: unit.size,
        hubs: unit.hubs || [],
        bridges: unit.bridges || [],
        cycles: unit.cycles || [],
      },
    };

    const investigation = {
      unit_id: unit.id,
      selected_files: selected.map((s) => ({ file: s.file, selection_reasons: s.reasons })),
      inspected_files: inspected.map((r) => ({ file: r.file, read_ok: r.read_ok, clue_count: r.clues.length })),
      hypothesis: hypo.hypothesis,
      candidate_type: hypo.candidate_type,
    };

    candidates.push(candidate);
    investigations.push(investigation);

    writeJson(join(unitsDir, `${unit.id}.json`), candidate);
  }

  // Sort candidates: feature/system first, then ambiguous, then insufficient; within each, larger units first
  const order = { feature_candidate: 0, system_candidate: 1, ambiguous: 2, insufficient_evidence: 3 };
  candidates.sort((a, b) => {
    const oa = order[a.candidate_type] ?? 9;
    const ob = order[b.candidate_type] ?? 9;
    if (oa !== ob) return oa - ob;
    return b.structural_context.size - a.structural_context.size || (a.id < b.id ? -1 : 1);
  });

  writeJson(join(base, 'candidates.json'), {
    tool: TOOL,
    version: VERSION,
    generated_at: new Date().toISOString(),
    evidence_source: evidenceDir,
    structural_source: structuralDir,
    candidate_count: candidates.length,
    candidates,
  });
  writeJson(join(base, 'investigations.json'), {
    tool: TOOL,
    version: VERSION,
    generated_at: new Date().toISOString(),
    investigations,
  });

  const manifest = {
    tool: TOOL,
    version: VERSION,
    generated_at: new Date().toISOString(),
    evidence_source: evidenceDir,
    structural_source: structuralDir,
    repo_root: repoRoot,
    summary: {
      candidates: candidates.length,
      feature_candidates: candidates.filter((c) => c.candidate_type === 'feature_candidate').length,
      system_candidates: candidates.filter((c) => c.candidate_type === 'system_candidate').length,
      ambiguous: candidates.filter((c) => c.candidate_type === 'ambiguous').length,
      insufficient: candidates.filter((c) => c.candidate_type === 'insufficient_evidence').length,
    },
  };
  writeJson(join(base, 'manifest.json'), manifest);

  return { candidates, investigations, manifest, outputDir: base };
}

function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}
