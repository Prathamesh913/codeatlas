// CodeAtlas Phase 4C.3 — Orchestrator: Canonical Resolution
//
// Pipeline position (approved 4C.3 architecture):
//   Collector v2 → Annotation → 4A → 4B.1 → 4B.2 → 4C.2 Consolidate
//     → **4C.3 VOI inspection → naming/type resolution** → canonical JSON
//     → Markdown projections
//
// Consumes (all read-only): consolidation outputs + consolidations.json,
// Phase 4B.2 semantic output (original member file partitioning), annotation,
// structural graph, investigation candidates.
//
// Emits an ISOLATED <outputDir>/canonical/ directory — the canonical JSON
// that Markdown projections render from:
//   features.json, systems.json, unresolved.json, relationships.json,
//   files.json, canonical-report.json
//
// Hard boundaries: no timestamps; sorted iteration everywhere; repositories
// never written; uncertainty preserved (VOI decisions that stay open are
// recorded with what evidence would resolve them).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildEntityModel, resolveAliasTarget, GENERIC_TERMS } from '../consolidate/rules.js';
import { mintId, slugify } from '../consolidate/ids.js';
import { enumerateQuestions, inspectQuestions, VOI_DEFAULTS } from './voi.js';
import { deriveName, namingDfMax } from './naming.js';
import { reviewType } from './typing.js';
import { describeFeature, describeSystem, describeUnresolved } from './describe.js';
import { tokenize, USER_VERBS } from '../semantic/tokens.js';

export const TOOL = 'codeatlas-canonical-resolver';
export const VERSION = '0.1.0';

const CONF_RANK = { high: 3, medium: 2, low: 1, unknown: 0 };

function load(i) {
  const read = (p) => JSON.parse(readFileSync(p, 'utf-8'));
  const consolidation = i.consolidation ?? {
    features: read(join(i.consolidationDir, 'features.json')),
    systems: read(join(i.consolidationDir, 'systems.json')),
    unresolved: read(join(i.consolidationDir, 'unresolved.json')),
    relationships: read(join(i.consolidationDir, 'relationships.json')),
    decisions: read(join(i.consolidationDir, 'consolidations.json')),
  };
  return {
    graph: i.graph ?? read(join(i.structuralDir, 'graph.json')),
    annFiles: i.annFiles ?? read(join(i.annotationDir, 'files.json')),
    annStrings: i.annStrings ?? read(join(i.annotationDir, 'strings.json')),
    candidates: i.candidates ?? read(join(i.investigationDir, 'candidates.json')),
    semanticFeatures: i.semanticFeatures ?? read(join(i.semanticDir, 'features.json')),
    semanticSystems: i.semanticSystems ?? read(join(i.semanticDir, 'systems.json')),
    ...consolidation,
  };
}

export function canonicalize(inputs, options = {}) {
  const { graph, annFiles, annStrings, candidates, semanticFeatures, semanticSystems, features, systems, unresolved, relationships, decisions } = inputs;

  // --- Context -----------------------------------------------------------
  const relevanceByFile = new Map((annFiles.files || []).map((f) => [f.path, f]));
  const stringsByFile = new Map();
  for (const s of annStrings.strings || []) {
    if (!stringsByFile.has(s.file)) stringsByFile.set(s.file, []);
    stringsByFile.get(s.file).push(s);
  }
  const clueIndex = new Map();
  for (const c of candidates.candidates || []) {
    for (const f of c.inspected_files || []) {
      if (!clueIndex.has(f.file)) clueIndex.set(f.file, []);
      clueIndex.get(f.file).push(...(f.clues || []));
    }
  }
  const graphNodes = new Map((graph.nodes || []).map((n) => [n.id, n]));
  const inventoryPaths = [...relevanceByFile.keys()];
  const importEdges = [];
  const degree = new Map();
  for (const e of graph.edges || []) {
    if (e.type !== 'IMPORTS') continue;
    const from = String(e.from);
    let to = String(e.to);
    let fromFile = graphNodes.has(from) ? from : null;
    let toFile = graphNodes.has(to) ? to : null;
    if (!toFile && to.startsWith('ext:')) {
      const resolved = resolveAliasTarget(to, inventoryPaths);
      if (resolved) toFile = resolved;
    }
    if (!fromFile || !toFile || fromFile === toFile) continue;
    const rc = relevanceByFile.get(fromFile)?.relevance_class;
    if (rc !== 'application' && rc !== 'supporting') continue;
    importEdges.push({ id: e.id, from: fromFile, to: toFile });
    degree.set(fromFile, (degree.get(fromFile) || 0) + 1);
    degree.set(toFile, (degree.get(toFile) || 0) + 1);
  }

  const appFilePaths = [...relevanceByFile.values()].filter((f) => f.relevance_class === 'application').map((f) => f.path);
  const df = new Map();
  for (const p of appFilePaths) {
    const terms = new Set();
    for (const sym of graphNodes.get(p)?.declares || []) for (const t of tokenize(sym)) terms.add(t);
    for (const s of stringsByFile.get(p) || []) {
      if (s.classification === 'capability' || s.classification === 'context') for (const t of tokenize(s.value)) terms.add(t);
    }
    for (const t of terms) df.set(t, (df.get(t) || 0) + 1);
  }

  // --- Entity models over the consolidation output -------------------------
  const canonicalDocs = [
    ...(features.features || []).map((e) => ({ doc: e, kind: 'feature' })),
    ...(systems.systems || []).map((e) => ({ doc: e, kind: 'system' })),
  ];
  const models = canonicalDocs.map(({ doc, kind }) => {
    const m = buildEntityModel(doc, kind, {
      relevanceByFile, stringsByFile, cluesByFile: clueIndex, graphNodes,
      regionById: new Map(), importEdges, df, dfMax: 0, appFileCount: appFilePaths.length,
    });
    m.confidence = doc.confidence || 'unknown';
    m.currentName = doc.name;
    return m;
  });
  const ambiguousModels = (unresolved.entities || [])
    .filter((e) => e.status === 'ambiguous')
    .map((e) => buildEntityModel(e, 'ambiguous', {
      relevanceByFile, stringsByFile, cluesByFile: clueIndex, graphNodes,
      regionById: new Map(), importEdges, df, dfMax: 0, appFileCount: appFilePaths.length,
    }));

  // Original member file partitioning (for VOI merge re-examination).
  const originalFiles = new Map();
  for (const e of [...(semanticFeatures.features || []), ...(semanticSystems.systems || [])]) {
    originalFiles.set(e.id, e.primary_files || []);
  }

  // Merged canonical entity -> original member file groups.
  const idToMembers = new Map();
  for (const im of decisions.decisions?.id_map || []) {
    if (im.original_ids.length > 1) idToMembers.set(im.final_id, im.original_ids);
  }
  const mergeGroups = (decisions.decisions?.merges || []).map((g) => {
    const finalId = (decisions.decisions.id_map || []).find(
      (im) => im.original_ids.length > 1 && im.original_ids.slice().sort().join('|') === g.members.slice().sort().join('|')
    )?.final_id;
    return {
      members: g.members,
      mode: g.mode,
      evidence: g.evidence,
      output_id: finalId,
      member_files: g.members.map((id) => originalFiles.get(id) || []),
      members_files: g.members.flatMap((id) => originalFiles.get(id) || []),
    };
  }).filter((g) => g.output_id);

  const entityOfAppFile = new Map();
  for (const m of models) for (const f of m.appFiles) entityOfAppFile.set(f, m);

  // External consumers per entity (application files outside the entity
  // importing into it) — typing rule T3 input.
  const externalConsumers = new Map();
  for (const m of models) {
    const own = new Set([...m.appFiles, ...m.suppFiles]);
    const consumers = new Set();
    for (const e of importEdges) {
      if (own.has(e.to) && !own.has(e.from) && relevanceByFile.get(e.from)?.relevance_class === 'application') {
        consumers.add(e.from);
      }
    }
    externalConsumers.set(m.originalId, consumers.size);
  }

  const ctx = {
    relevanceByFile, stringsByFile, clueIndex, cluesByFile: clueIndex, graphNodes, importEdges, df,
    appFileCount: appFilePaths.length,
    entityOfAppFile, modelById: new Map(models.map((m) => [m.originalId, m])),
    degree, externalConsumers, repoRoot: inputs.repoRoot,
    USER_VERBS,
    voiDfMax: Math.max(3, Math.ceil(0.15 * Math.max(1, appFilePaths.length))),
    usedNames: new Set(),
    labelCounts: (() => {
      const counts = new Map();
      for (const m of models) {
        for (const s of m.strings.capability) {
          const k = s.value.trim().toLowerCase();
          counts.set(k, (counts.get(k) || 0) + 1);
        }
      }
      return counts;
    })(),
  };
  // Repository-wide user-facing vocabulary (Tier-3 naming plausibility gate).
  const userVocab = new Set();
  for (const s of annStrings.strings || []) {
    if (s.classification === 'capability' || s.classification === 'context') {
      for (const t of tokenize(s.value)) userVocab.add(t);
    }
  }
  ctx.userVocab = userVocab;

  // --- 1. VOI inspection -----------------------------------------------------
  const questions = enumerateQuestions({ models: [...models, ...ambiguousModels], mergeGroups, relationships: relationships.relationships || [], ctx });
  const { results: voiResults, budget } = inspectQuestions(questions, ctx, {
    maxReadsPerQuestion: options.maxVoiReadsPerQuestion ?? VOI_DEFAULTS.maxReadsPerQuestion,
    maxTotalReadsPerRepo: options.maxVoiTotalReads ?? VOI_DEFAULTS.maxTotalReadsPerRepo,
  });
  // New clues from VOI reads inform naming/typing below.
  for (const m of [...models, ...ambiguousModels]) {
    const clues = (m.appFiles || []).flatMap((f) => clueIndex.get(f) || []);
    m.voBehaviorTerms = clues
      .filter((c) => c.type === 'behavioral' && c.evidence_type !== 'comment' && String(c.observed || '').includes('VOI') === false)
      .flatMap((c) => tokenize(c.raw || c.observed || ''));
  }

  // --- 2. Apply VOI decisions --------------------------------------------------
  const taken = { feature: new Set(models.map((m) => m.originalId)), system: new Set(models.map((m) => m.originalId)) };
  const dropped = new Map(); // id -> reason
  const additions = [];       // restored/merged entities
  const voiLog = [];
  const modelById = ctx.modelById;

  for (const r of voiResults) {
    const entry = { ...r, changed_output: false };
    if (r.decision === 'reclassify_shell_context') {
      const m = modelById.get(r.subjects[0]);
      if (m) { dropped.set(m.originalId, 'reclassified_shell_context (VOI: ' + r.decision_reason.slice(0, 140) + ')'); entry.changed_output = true; }
    } else if (r.decision === 'merge' && r.kind === 'complementary_layers') {
      const [aId, bId] = r.subjects;
      const a = modelById.get(aId);
      const b = modelById.get(bId);
      if (a && b && a.kind === b.kind && !dropped.has(aId) && !dropped.has(bId)) {
        dropped.set(aId, `merged by VOI into ${a.kind} (VOI: ${r.decision_reason.slice(0, 120)})`);
        dropped.set(bId, `merged by VOI into ${a.kind} (VOI: ${r.decision_reason.slice(0, 120)})`);
        additions.push({
          kind: a.kind,
          files: [...new Set([...a.appFiles, ...b.appFiles, ...a.suppFiles, ...b.suppFiles])].sort(),
          supp: [...new Set([...a.suppFiles, ...b.suppFiles])].sort(),
          sourceEntities: [aId, bId],
          seedTerm: r.shared_terms?.[0] || a.seedTerm,
          voiEvidence: r,
          strings: {
            capability: [...a.strings.capability, ...b.strings.capability],
            context: [...a.strings.context, ...b.strings.context],
            state: [...a.strings.state, ...b.strings.state],
            incidental: [...a.strings.incidental, ...b.strings.incidental],
          },
        });
        entry.changed_output = true;
      } else if (a && b && a.kind !== b.kind) {
        entry.decision = 'keep_separate';
        entry.decision_reason += ' (mixed feature/system types — kept separate; type resolution is a 4C.3 typing decision, not a merge side effect.)';
      }
    } else if (r.decision === 'separate' && r.kind === 'merge_strength') {
      const g = mergeGroups.find((x) => x.output_id === r.subjects?.[0] || `voi-merge-${x.members.join('+')}` === r.id);
      void g;
      const group = mergeGroups.find((x) => `voi-merge-${x.members.join('+')}` === r.id);
      if (group && group.output_id) {
        dropped.set(group.output_id, `split by VOI (VOI: ${r.decision_reason.slice(0, 120)})`);
        for (const memberId of group.members) {
          const original = [...(semanticFeatures.features || []), ...(semanticSystems.systems || [])].find((e) => e.id === memberId);
          if (!original) continue;
          additions.push({
            kind: original.id.startsWith('system') ? 'system' : 'feature',
            files: (original.primary_files || []).slice(),
            supp: (original.supporting_files || []).slice(),
            sourceEntities: [memberId],
            seedTerm: memberId.replace(/^(feature|system)-/, '').replace(/-\d+$/, ''),
            restore: original,
            voiEvidence: r,
            strings: { capability: [], context: [], state: [], incidental: [] },
          });
        }
        entry.changed_output = true;
      }
    } else if (r.decision === 'retype_feature' || r.decision === 'retype_system') {
      const m = modelById.get(r.subjects[0]);
      if (m) { m.typeCorrection = r.decision === 'retype_feature' ? 'feature' : 'system'; entry.changed_output = true; }
    }
    voiLog.push(entry);
  }

  // --- 3. Assemble surviving canonical entities -----------------------------
  const survivors = models.filter((m) => !dropped.has(m.originalId));
  const relsById = new Map();
  for (const m of survivors) relsById.set(m.originalId, m);

  const takenIds = { feature: new Set(survivors.map((m) => m.originalId).filter((id) => id.startsWith('feature-'))), system: new Set(survivors.map((m) => m.originalId).filter((id) => id.startsWith('system-'))) };
  const outFeatures = [];
  const outSystems = [];
  const idLog = [];

  const buildOutput = (m, finalId) => {
    const kind = m.kind;
    // Naming (post-VOI so inspected behavior informs Tier 3).
    const groupShared = [
      ...((m.mergeSharedTerms || [])),
      ...((decisions.decisions?.merges || []).filter((g) => g.members.includes(m.originalId)).flatMap((g) => (g.evidence || []).flatMap((s) => s.terms || (s.edges || []).flatMap((e) => e.shared_terms || [])))),
    ].filter(Boolean);
    const naming = deriveName(m, {
      df, dfMax: namingDfMax(ctx.appFileCount),
      groupSharedTerms: groupShared,
      currentName: m.currentName || m.entity.name,
      kind,
      userVocab: ctx.userVocab,
      usedNames: ctx.usedNames,
      labelCounts: ctx.labelCounts,
    });
    ctx.usedNames.add(naming.name.toLowerCase());
    const typing = reviewType({ ...m, externalConsumers: externalConsumers.get(m.originalId) || 0, voBehaviorTerms: m.voBehaviorTerms || [] }, ctx);
    let outKind = kind;
    if (typing.corrected) outKind = typing.type;

    const desc = outKind === 'feature'
      ? describeFeature(m, ctx)
      : describeSystem({ ...m, externalConsumers: externalConsumers.get(m.originalId) || 0 }, ctx);

    const e = m.entity;
    const base = {
      id: finalId,
      name: naming.name,
      description: desc.description,
      ...(outKind === 'feature'
        ? {
            user_visible_purpose: desc.user_visible_purpose,
            user_interactions: desc.user_interactions,
            location_context: e.location_context || null,
          }
        : {
            technical_role: `Shared ${naming.name.toLowerCase()} responsibility (naming tier ${naming.tier}: ${naming.basis}).`,
            semantic_role: desc.description,
            supported_features: (e.supported_features || []).filter((f) => !dropped.has(f)),
          }),
      aliases: naming.aliases,
      keywords: [...new Set([...(e.keywords || []), ...naming.implementation_terms])].slice(0, 8),
      primary_files: [...m.appFiles, ...m.suppFiles].sort(),
      supporting_files: (e.supporting_files || []).filter((f) => !m.primary_files?.includes(f)).sort(),
      non_application_files: (e.non_application_files || []),
      data_dependencies: e.data_dependencies || null,
      confidence: typing.corrected ? typing.confidence : (m.confidence || e.confidence || 'unknown'),
      notes: [...(e.notes || [])],
      provenance: {
        ...(e.provenance || {}),
        naming_evidence: {
          previous_name: m.currentName || null,
          selected_from: naming.selected,
          tier: naming.tier,
          basis: naming.basis,
          rejected: naming.rejected,
          changed: naming.changed,
        },
        implementation_terms: naming.implementation_terms,
        type_review: typing,
        voi: voiLog.filter((v) => v.subjects.includes(m.originalId) && v.changed_output).map((v) => ({ id: v.id, decision: v.decision, reason: v.decision_reason })),
      },
      naming_conflict: e.naming_conflict || null,
      annotation_summary: e.annotation_summary || null,
      evidence: (e.evidence || []).slice(0, 20),
    };
    return { entity: base, outKind };
  };

  for (const m of survivors) {
    m.mergeSharedTerms = [];
    const kind = m.typeCorrection ? m.typeCorrection : m.kind;
    const { entity, outKind } = buildOutput(m, m.originalId);
    (outKind === 'feature' ? outFeatures : outSystems).push(entity);
    void kind;
  }

  // VOI-created entities (restored members and VOI merges).
  for (const add of additions) {
    const kind = add.kind;
    const model = buildEntityModel(
      { id: `voi-${add.sourceEntities.join('-')}`, name: add.seedTerm, description: '', confidence: 'low', primary_files: add.files, supporting_files: add.supp, aliases: add.restore?.aliases || [], keywords: add.restore?.keywords || [], evidence: add.restore?.evidence || [], notes: [], provenance: {} },
      kind,
      { relevanceByFile, stringsByFile, cluesByFile: clueIndex, graphNodes, regionById: new Map(), importEdges, df, dfMax: 0, appFileCount: appFilePaths.length }
    );
    if (add.strings) model.strings = add.strings;
    model.currentName = add.restore?.name || titleCaseSafe(add.seedTerm);
    model.mergeSharedTerms = [];
    const slug = slugify(add.seedTerm);
    const { id: finalId } = mintId({ kind, slug, files: add.files, taken: takenIds[kind] });
    const { entity, outKind } = buildOutput(model, finalId);
    entity.provenance = {
      ...entity.provenance,
      voi_created: true,
      source_entities: add.sourceEntities,
      voi_decision: add.voiEvidence?.decision,
      voi_reason: add.voiEvidence?.decision_reason,
    };
    entity.notes = [`Created by Phase 4C.3 value-of-information inspection (${add.voiEvidence?.decision}).`, ...(entity.notes || [])];
    idLog.push({ original_ids: add.sourceEntities, final_id: finalId, basis: `VOI ${add.voiEvidence?.decision}` });
    (outKind === 'feature' ? outFeatures : outSystems).push(entity);
  }

  outFeatures.sort((a, b) => (a.id < b.id ? -1 : 1));
  outSystems.sort((a, b) => (a.id < b.id ? -1 : 1));

  // --- 4. Unresolved output ----------------------------------------------------
  const unresolvedOut = [];
  for (const e of unresolved.entities || []) {
    if (dropped.has(e.id)) continue;
    const d = describeUnresolved(e);
    unresolvedOut.push({ ...e, description: d.description });
  }
  // Only entities reclassified away from canonical standing land here as new
  // entries; VOI-merged endpoints live on inside their merged entity.
  for (const [id, reason] of dropped) {
    if (!reason.startsWith('reclassified_shell_context')) continue;
    const m = modelById.get(id);
    unresolvedOut.push({
      id,
      region_id: m?.regionId || null,
      status: 'reclassified_shell_context',
      previous_status: m?.kind || 'unknown',
      confidence: 'low',
      reason,
      description: describeUnresolved({ status: 'reclassified_shell_context', reason }).description,
      primary_files: [...(m?.appFiles || []), ...(m?.suppFiles || [])],
      non_application_files: (m?.entity?.non_application_files || []).map((n) => n.file),
      evidence: (m?.entity?.evidence || []).slice(0, 10),
    });
  }
  unresolvedOut.sort((a, b) => (a.id < b.id ? -1 : 1));

  // --- 5. Relationships remap ---------------------------------------------------
  const oldToNew = new Map();
  for (const m of survivors) oldToNew.set(m.originalId, m.originalId);
  for (const add of additions) {
    for (const src of add.sourceEntities) oldToNew.set(src, null); // resolved below
  }
  // Build the final mapping: dropped -> null; merged/restored members -> their new entity id.
  for (const add of additions) {
    const createdId = (outFeatures.find((f) => f.provenance?.source_entities?.[0] === add.sourceEntities[0] && f.provenance?.voi_created) ||
      outSystems.find((s) => s.provenance?.source_entities?.[0] === add.sourceEntities[0] && s.provenance?.voi_created))?.id;
    for (const src of add.sourceEntities) oldToNew.set(src, createdId || null);
  }
  for (const [id, reason] of dropped) {
    if (!oldToNew.has(id)) oldToNew.set(id, null);
    else if (oldToNew.get(id) === id) oldToNew.set(id, null);
  }
  const relKey = (r) => `${r.source}|${r.target}|${r.relationship_type}`;
  const byKey = new Map();
  const droppedRels = [];
  for (const r of relationships.relationships || []) {
    const s = oldToNew.has(r.source) ? oldToNew.get(r.source) : r.source;
    const t = oldToNew.has(r.target) ? oldToNew.get(r.target) : r.target;
    if (!s || !t || s === 'null') { droppedRels.push({ ...r, drop_reason: 'endpoint resolved away by 4C.3 VOI decision' }); continue; }
    if (s === t) { droppedRels.push({ ...r, drop_reason: 'endpoints consolidated by 4C.3 VOI decision' }); continue; }
    const remapped = { ...r, source: s, target: t };
    if (s !== r.source || t !== r.target) {
      remapped.evidence = [...(r.evidence || []), { source: 'phase4c3_voi', evidence_type: 'remap', observed: `${r.source} -> ${s}, ${r.target} -> ${t}` }];
    }
    const k = relKey(remapped);
    if (byKey.has(k)) byKey.get(k).evidence.push(...(remapped.evidence || []).slice(-1));
    else byKey.set(k, remapped);
  }
  const relsOut = [...byKey.values()].sort((a, b) => (relKey(a) < relKey(b) ? -1 : 1));

  // --- 6. Canonical file index (reverse projection) -------------------------------
  // Authority: entity membership is authoritative; files.json is derived.
  const filesOut = buildReverseFileIndex({ features: outFeatures, systems: outSystems, inventoryPaths, relevanceByFile });
  const integrity = validateCanonicalIntegrity({ features: outFeatures, systems: outSystems, files: filesOut });

  // --- 7. Report ---------------------------------------------------------------------
  const report = {
    tool: TOOL,
    version: VERSION,
    inputs: {
      evidenceDir: inputs.evidenceDir || null,
      annotationDir: inputs.annotationDir || null,
      structuralDir: inputs.structuralDir || null,
      investigationDir: inputs.investigationDir || null,
      semanticDir: inputs.semanticDir || null,
      consolidationDir: inputs.consolidationDir || null,
    },
    counts: {
      canonical_in: models.length,
      features_in: (features.features || []).length,
      systems_in: (systems.systems || []).length,
      voi_questions: questions.length,
      voi_reads: budget.used,
      voi_budget: budget.limit,
      reclassified_shell: voiLog.filter((v) => v.decision === 'reclassify_shell_context').length,
      voi_merges: voiLog.filter((v) => v.decision === 'merge').length,
      voi_separations: voiLog.filter((v) => v.decision === 'separate').length,
      type_corrections: [...outFeatures, ...outSystems].filter((e) => e.provenance?.type_review?.corrected).length,
      renames: [...outFeatures, ...outSystems].filter((e) => e.provenance?.naming_evidence?.changed).length,
      features_out: outFeatures.length,
      systems_out: outSystems.length,
      ambiguous_out: unresolvedOut.filter((u) => u.status === 'ambiguous').length,
      unresolved_out: unresolvedOut.filter((u) => u.status === 'unresolved').length,
      demoted_out: unresolvedOut.filter((u) => u.status === 'demoted_false_positive').length,
      reclassified_out: unresolvedOut.filter((u) => u.status === 'reclassified_shell_context').length,
      relationships_out: relsOut.length,
      relationships_dropped: droppedRels.length,
      reverse_index_errors: integrity.errors.length,
    },
    voi: { budget, questions: voiLog },
    reverse_index_integrity: integrity,
    naming: [...outFeatures, ...outSystems].map((e) => ({
      id: e.id, name: e.name, tier: e.provenance.naming_evidence.tier, basis: e.provenance.naming_evidence.basis,
      changed: e.provenance.naming_evidence.changed, previous_name: e.provenance.naming_evidence.previous_name,
      rejected: e.provenance.naming_evidence.rejected,
    })),
  };

  return { features: outFeatures, systems: outSystems, unresolved: unresolvedOut, relationships: relsOut, files: filesOut, report };
}

// Canonical file index — reverse projection of entity membership.
//
// Authority rule: canonical entity membership (primary_files /
// supporting_files on features/systems) is the authority; files.json is a
// deterministic REVERSE projection of it. A file lists an entity ID only
// when that entity explicitly references the file. No inference from
// filename similarity, directory proximity, or import adjacency. Files with
// no supported membership keep empty arrays. Ordering is deterministic
// (sorted, deduplicated); every referenced ID must exist.
export function buildReverseFileIndex({ features, systems, inventoryPaths, relevanceByFile }) {
const validIds = new Set([...features, ...systems].map((e) => e.id));
const kindOf = new Map([
  ...features.map((e) => [e.id, 'feature']),
  ...systems.map((e) => [e.id, 'system']),
]);
// Forward membership: file -> entity ids, from explicit entity records only.
const featsByFile = new Map();
const syssByFile = new Map();
for (const f of features) {
  for (const p of [...(f.primary_files || []), ...((f.supporting_files || []))]) {
    if (!validIds.has(f.id)) continue;
    if (!featsByFile.has(p)) featsByFile.set(p, new Set());
    featsByFile.get(p).add(f.id);
  }
}
for (const s of systems) {
  for (const p of [...(s.primary_files || []), ...((s.supporting_files || []))]) {
    if (!validIds.has(s.id)) continue;
    if (!syssByFile.has(p)) syssByFile.set(p, new Set());
    syssByFile.get(p).add(s.id);
  }
}
void kindOf;
return inventoryPaths.map((p) => {
  const cls = relevanceByFile.get(p)?.relevance_class || 'application';
  const feats = [...(featsByFile.get(p) || [])].sort();
  const syss = [...(syssByFile.get(p) || [])].sort();
  const owner = [...features, ...systems].find((f) => (f.primary_files || []).includes(p));
  const ext = p.split('.').pop() || '';
  return {
    path: p,
    type: cls !== 'application' ? cls : (/\.(tsx|jsx)$/.test(p) ? 'component' : /\.(ts|js|mjs|cjs)$/.test(p) ? 'module' : /\.py$/.test(p) ? 'module' : 'other'),
    language: relevanceByFile.get(p)?.language ?? null,
    relevance_class: cls,
    technical_role: owner ? `Implementation file of ${owner.id}.` : `${cls} file; not mapped to a canonical entity.`,
    semantic_role: owner ? (owner.description || '').slice(0, 200) : 'Not mapped to a canonical entity.',
    features: feats,
    systems: syss,
  };
}).sort((a, b) => (a.path < b.path ? -1 : 1));
}

/**
 * Validate bidirectional integrity between canonical entities and the file
 * index. Reports problems clearly; never silently repairs.
 *
 * Checks: entity references to missing files, file references to missing
 * entities, mismatched feature/system membership, duplicate memberships,
 * nondeterministic (unsorted) ordering.
 *
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateCanonicalIntegrity({ features, systems, files }) {
const errors = [];
const fileByPath = new Map((files || []).map((f) => [f.path, f]));
const kindOf = new Map([
  ...features.map((e) => [e.id, 'feature']),
  ...systems.map((e) => [e.id, 'system']),
]);
const sorted = (arr) => [...arr].sort();
for (const e of [...features, ...systems]) {
  const kind = kindOf.get(e.id);
  for (const p of [...(e.primary_files || []), ...((e.supporting_files || []))]) {
    const rec = fileByPath.get(p);
    if (!rec) {
      errors.push(`entity ${e.id} references missing file record: ${p}`);
      continue;
    }
    const listed = kind === 'feature' ? (rec.features || []) : (rec.systems || []);
    if (!listed.includes(e.id)) {
      errors.push(`mismatched membership: entity ${e.id} lists ${p} but files.json does not list ${e.id} under ${kind === 'feature' ? 'features' : 'systems'}`);
    }
    // Cross-kind mismatch: a feature id must never appear under systems.
    const other = kind === 'feature' ? (rec.systems || []) : (rec.features || []);
    if (other.includes(e.id)) {
      errors.push(`mismatched feature/system membership: ${e.id} (${kind}) appears under the wrong key in ${p}`);
    }
  }
  for (const key of ['primary_files', 'supporting_files']) {
    const arr = e[key] || [];
    if (new Set(arr).size !== arr.length) errors.push(`duplicate memberships in ${e.id}.${key}`);
    if (JSON.stringify(arr) !== JSON.stringify(sorted(arr))) errors.push(`nondeterministic ordering in ${e.id}.${key} (not sorted)`);
  }
}
for (const f of files || []) {
  for (const [key, expectKind] of [['features', 'feature'], ['systems', 'system']]) {
    const arr = f[key] || [];
    if (new Set(arr).size !== arr.length) errors.push(`duplicate memberships in files.json ${f.path}.${key}`);
    if (JSON.stringify(arr) !== JSON.stringify(sorted(arr))) errors.push(`nondeterministic ordering in files.json ${f.path}.${key} (not sorted)`);
    for (const id of arr) {
      if (!kindOf.has(id)) errors.push(`file ${f.path} references missing entity: ${id}`);
      else if (kindOf.get(id) !== expectKind) errors.push(`mismatched feature/system membership: file ${f.path}.${key} lists ${id} which is a ${kindOf.get(id)}`);
    }
  }
}
return { ok: errors.length === 0, errors: errors.slice().sort() };
}


function titleCaseSafe(term) {
  return String(term)
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function runCanonical(inputs, options = {}) {
  const dirs = ['annotationDir', 'structuralDir', 'investigationDir', 'semanticDir', 'consolidationDir'];
  for (const d of dirs) {
    if (inputs[d] && !existsSync(inputs[d])) throw new Error(`canonical: ${d} not found at ${inputs[d]}`);
  }
  const loaded = load(inputs);
  loaded.repoRoot = inputs.repoRoot;
  loaded.outputDir = inputs.outputDir;
  loaded.evidenceDir = inputs.evidenceDir || null;
  const result = canonicalize(loaded, options);
  const base = join(inputs.outputDir, 'canonical');
  mkdirSync(base, { recursive: true });
  const writeJson = (name, data) => writeFileSync(join(base, name), JSON.stringify(data, null, 2) + '\n', 'utf-8');
  writeJson('features.json', { tool: TOOL, version: VERSION, features: result.features });
  writeJson('systems.json', { tool: TOOL, version: VERSION, systems: result.systems });
  writeJson('unresolved.json', { tool: TOOL, version: VERSION, entities: result.unresolved });
  writeJson('relationships.json', { tool: TOOL, version: VERSION, relationships: result.relationships });
  writeJson('files.json', { tool: TOOL, version: VERSION, files: result.files });
  writeJson('canonical-report.json', result.report);
  return result;
}
