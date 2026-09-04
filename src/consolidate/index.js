// CodeAtlas Phase 4C.2 — Orchestrator: Consolidation
//
// Pipeline position (approved 4C.2 architecture):
//   Collector v2 → Annotation → 4A → 4B.1 → 4B.2 → **4C.2 CONSOLIDATE**
//     → canonical JSON → Markdown projections (projections unchanged)
//
// Consumes (all read-only):
//   - annotation/files.json + annotation/strings.json   (4C.1B, D-016/D-017)
//   - structural graph.json + units.json                (4A)
//   - investigation candidates.json                     (4B.1 clue evidence)
//   - semantic regions/features/systems/unresolved/relationships (4B.2)
//
// Emits an ISOLATED <outputDir>/consolidation/ directory:
//   consolidations.json      — the decision log (merges, separations, demotions,
//                              non-merges, ambiguity decisions, id map)
//   features.json            — consolidated canonical features
//   systems.json             — consolidated canonical systems
//   unresolved.json          — ambiguous/unresolved/demoted/separated entities
//   relationships.json       — relationships remapped over consolidation
//   consolidation-report.json— counts + annotation-consumption record
//
// Hard boundaries:
//   - Canonical JSON remains the source of truth; this stage only refines it
//     with recorded evidence (D-013). Repositories are never written.
//   - Ambiguity is preserved unless strong typed evidence decides (§6).
//   - Deterministic: sorted iteration, no timestamps, no random ids.

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildEntityModel, evaluateDemotions, evaluateSplits, evaluateMerges, dfMaxFor, resolveAliasTarget } from './rules.js';
import { mintId, slugify } from './ids.js';
import { tokenize } from '../semantic/tokens.js';

export const TOOL = 'codeatlas-consolidator';
export const VERSION = '0.1.0';

const CONF_RANK = { high: 3, medium: 2, low: 1, unknown: 0 };
const RANK_CONF = ['unknown', 'low', 'medium', 'high'];

function titleCase(term) {
  return String(term)
    .split(/[-_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Load all inputs from directories, or accept preloaded objects (tests). */
function loadInputs(i) {
  const read = (p) => JSON.parse(readFileSync(p, 'utf-8'));
  const graph = i.graph ?? read(join(i.structuralDir, 'graph.json'));
  const units = i.units ?? read(join(i.structuralDir, 'units.json'));
  const candidates = i.candidates ?? read(join(i.investigationDir, 'candidates.json'));
  const annFiles = i.annotationFiles ?? read(join(i.annotationDir, 'files.json'));
  const annStrings = i.annotationStrings ?? read(join(i.annotationDir, 'strings.json'));
  const regions = i.regions ?? read(join(i.semanticDir, 'regions.json'));
  const features = i.features ?? read(join(i.semanticDir, 'features.json'));
  const systems = i.systems ?? read(join(i.semanticDir, 'systems.json'));
  const unresolved = i.unresolved ?? read(join(i.semanticDir, 'unresolved.json'));
  const relationships = i.relationships ?? read(join(i.semanticDir, 'relationships.json'));
  return { graph, units, candidates, annFiles, annStrings, regions, features, systems, unresolved, relationships };
}

export function consolidate(inputs) {
  const { graph, units, candidates, annFiles, annStrings, regions, features, systems, unresolved, relationships } = inputs;

  // --- Context -----------------------------------------------------------
  const relevanceByFile = new Map();
  for (const f of annFiles.files || []) relevanceByFile.set(f.path, f);
  const stringsByFile = new Map();
  for (const s of annStrings.strings || []) {
    if (!stringsByFile.has(s.file)) stringsByFile.set(s.file, []);
    stringsByFile.get(s.file).push(s);
  }
  const cluesByFile = new Map();
  for (const c of candidates.candidates || []) {
    for (const f of c.inspected_files || []) {
      if (!cluesByFile.has(f.file)) cluesByFile.set(f.file, []);
      cluesByFile.get(f.file).push(...(f.clues || []));
    }
  }
  // 4B.2's bounded additional inspections are part of the evidence base too
  // (their clues never entered the 4B.1 index). Reconstruct them from the
  // recorded evidence entries so behavioral presence is not undercounted.
  for (const doc of [features, systems, unresolved]) {
    for (const e of doc.features || doc.systems || doc.entities || []) {
      for (const ev of e.evidence || []) {
        if (ev.source !== 'phase4b2_additional_inspection' || !ev.file) continue;
        if (!cluesByFile.has(ev.file)) cluesByFile.set(ev.file, []);
        const list = cluesByFile.get(ev.file);
        if (!list.some((c) => c.observed === ev.observed && c.file === ev.file)) {
          list.push({ type: ev.evidence_type || 'behavioral', evidence_type: ev.evidence_type || 'behavioral', file: ev.file, observed: ev.observed, raw: ev.observed, confidence: ev.confidence || 'low' });
        }
      }
    }
  }
  const graphNodes = new Map((graph.nodes || []).map((n) => [n.id, n]));
  const regionById = new Map((regions.regions || []).map((r) => [r.id, r]));
  const inventoryPaths = [...relevanceByFile.keys()];

  // IMPORTS edges between real file nodes, plus alias-style targets
  // ('ext:@/lib/saved') resolved by unique inventory suffix match. Alias
  // resolution is a consolidation-stage interpretation of recorded evidence —
  // 4A output and raw evidence stay untouched.
  const importEdges = [];
  for (const e of graph.edges || []) {
    if (e.type !== 'IMPORTS') continue;
    const from = String(e.from);
    const to = String(e.to);
    const fromFile = graphNodes.has(from) ? from : null;
    let toFile = graphNodes.has(to) ? to : null;
    let viaAlias = false;
    if (!toFile && to.startsWith('ext:')) {
      const resolved = resolveAliasTarget(to, inventoryPaths);
      if (resolved) { toFile = resolved; viaAlias = true; }
    }
    if (!fromFile || !toFile || fromFile === toFile) continue;
    if (relevanceByFile.get(fromFile)?.relevance_class === 'application' ||
        relevanceByFile.get(fromFile)?.relevance_class === 'supporting') {
      importEdges.push({ id: e.id, from: fromFile, to: toFile, via_alias: viaAlias });
    }
  }

  // Document frequency of vocabulary terms over application files.
  const appFilePaths = [...relevanceByFile.values()].filter((f) => f.relevance_class === 'application').map((f) => f.path);
  const df = new Map();
  for (const path of appFilePaths) {
    const terms = new Set();
    for (const sym of graphNodes.get(path)?.declares || []) for (const t of tokenize(sym)) terms.add(t);
    for (const s of stringsByFile.get(path) || []) {
      if (s.classification === 'capability' || s.classification === 'context') for (const t of tokenize(s.value)) terms.add(t);
    }
    for (const t of terms) df.set(t, (df.get(t) || 0) + 1);
  }
  const dfMax = dfMaxFor(appFilePaths.length);

  const ctx = { relevanceByFile, stringsByFile, cluesByFile, graphNodes, regionById, importEdges, df, dfMax, appFileCount: appFilePaths.length };

  // --- Entity models ------------------------------------------------------
  const canonical = [
    ...(features.features || []).map((e) => buildEntityModel(e, 'feature', ctx)),
    ...(systems.systems || []).map((e) => buildEntityModel(e, 'system', ctx)),
  ];
  const ambiguousModels = (unresolved.entities || [])
    .filter((e) => e.status === 'ambiguous' || e.status === 'unresolved')
    .map((e) => buildEntityModel(e, e.status, ctx));

  // --- 1. Demotions (D0/D1/D3) -------------------------------------------
  const demotionDecisions = evaluateDemotions(canonical);
  const demotedIds = new Set(demotionDecisions.map((d) => d.entity));
  for (const m of canonical) if (demotedIds.has(m.originalId)) m.isFragment = true;

  // --- 2. Separations (conflation splits) --------------------------------
  const separationDecisions = [];
  const nonSplits = [];
  const fragmentModels = [];
  for (const m of canonical) {
    if (m.isFragment) continue;
    const { splits, nonSplits: ns } = evaluateSplits(m, ctx);
    nonSplits.push(...ns);
    for (const split of splits) {
      separationDecisions.push(split);
      m.appFiles = split.kept.filter((f) => m.appFiles.includes(f));
      m.suppFiles = split.kept.filter((f) => m.suppFiles.includes(f));
      m.files = [...m.appFiles, ...m.suppFiles];
      for (const frag of split.separated) {
        const pseudo = {
          id: `fragment-of-${m.originalId}`,
          primary_files: frag.files,
          supporting_files: [],
          region_id: m.regionId,
          confidence: 'low',
        };
        const fm = buildEntityModel(pseudo, frag.status === 'system' ? 'system' : 'unresolved', ctx);
        fm.isFragment = true;
        fm.fragmentOf = m.originalId;
        fm.parentKind = m.kind;
        fm.seedTerm = m.seedTerm; // inherit the parent's canonical identity
        fm.fragmentReason = frag.reason;
        fm.fragmentStatus = frag.status;
        fragmentModels.push(fm);
      }
    }
  }

  // --- 3. Merge evaluation -------------------------------------------------
  const participants = [
    ...canonical.filter((m) => !m.isFragment || m.appFiles.length > 0),
    ...fragmentModels.filter((m) => m.appFiles.length > 0),
    ...ambiguousModels.filter((m) => m.appFiles.length > 0),
  ];
  const { accepted, nonMerges } = evaluateMerges(participants, ctx);

  // Union-find over accepted pairs (deterministic single-linkage).
  const indexOf = new Map(participants.map((p, i) => [p.originalId, i]));
  const parent = participants.map((_, i) => i);
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const union = (a, b) => { parent[find(a)] = find(b); };
  for (const acc of accepted) union(indexOf.get(acc.pair[0]), indexOf.get(acc.pair[1]));
  const groups = new Map();
  for (let i = 0; i < participants.length; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(participants[i]);
  }

  // --- 4. Group outcomes ----------------------------------------------------
  const groupFiles = (members) => {
    const app = new Set(), supp = new Set();
    for (const m of members) {
      for (const f of m.appFiles) app.add(f);
      for (const f of (m.suppFiles || [])) supp.add(f);
      for (const f of (m.supportingKept || [])) supp.add(f);
    }
    return { app: [...app].sort(), supp: [...supp].sort() };
  };
  const sideOf = (m) => {
    if (m.strings.capability.length > 0) return 'feature';
    if (m.isFragment) {
      if (m.kind === 'feature') return 'feature'; // demoted canonical feature
      if (m.kind === 'system') return 'system'; // demoted canonical system
      return 'system'; // separated fragment: the non-kept data/infra layer
    }
    if (m.kind === 'feature') return m.infraDominated ? 'system' : 'feature';
    return 'system';
  };
  const sharedGroupTerms = (members) => {
    const counts = new Map();
    for (const m of members) {
      for (const t of m.discriminativeTerms || []) counts.set(t, (counts.get(t) || 0) + 1);
    }
    return [...counts.entries()].filter(([, n]) => n >= 2).map(([t]) => t).sort();
  };
  const bestMember = (members) =>
    [...members].sort((a, b) =>
      (CONF_RANK[b.confidence] ?? 0) - (CONF_RANK[a.confidence] ?? 0) ||
      (a.originalId < b.originalId ? -1 : 1))[0];

  const groupOutcomes = [];
  for (const [root, members] of [...groups.entries()].sort((x, y) => (x[1].map((m) => m.originalId).join('|') < y[1].map((m) => m.originalId).join('|') ? -1 : 1))) {
    if (members.length < 2) continue;
    const featureSide = members.filter((m) => sideOf(m) === 'feature');
    const systemSide = members.filter((m) => sideOf(m) === 'system');
    const mergeEvidence = accepted
      .filter((a) => members.some((m) => m.originalId === a.pair[0]) && members.some((m) => m.originalId === a.pair[1]))
      .flatMap((a) => a.signals.map((s) => ({ between: a.pair, ...s })));
    const out = { members: members.map((m) => m.originalId), featureSide, systemSide, mergeEvidence };

    if (featureSide.length && systemSide.length) {
      // External-consumer check: system-side files imported from outside the
      // group are shared infrastructure → keep a feature + system pair;
      // otherwise the system side is an internal layer of one capability.
      const files = groupFiles(members);
      const inGroup = new Set([...files.app, ...files.supp]);
      const external = importEdges.some(
        (e) => systemSide.some((m) => m.appFiles.includes(e.to)) &&
          !inGroup.has(e.from) &&
          relevanceByFile.get(e.from)?.relevance_class === 'application'
      );
      out.mode = external ? 'feature_and_system' : 'single_feature';
    } else if (featureSide.length) out.mode = 'single_feature';
    else out.mode = 'single_system';
    groupOutcomes.push(out);
  }

  // --- 5. Build output entities ---------------------------------------------
  const idMap = [];
  const takenByKind = { feature: new Set(), system: new Set() };
  const outputFeatures = [];
  const outputSystems = [];
  const groupedIds = new Set(groupOutcomes.flatMap((g) => g.members));

  const attachAnnotationSummary = (m) => {
    const classes = {};
    for (const f of [...m.appFiles, ...m.suppFiles, ...(m.noiseFiles || []).map((n) => n.file)]) {
      const c = relevanceByFile.get(f)?.relevance_class || 'application';
      classes[c] = (classes[c] || 0) + 1;
    }
    const str = { capability: m.strings.capability.length, context: m.strings.context.length, state: m.strings.state.length, incidental: m.strings.incidental.length };
    return { relevance_classes: classes, strings: str };
  };

  const baseEntity = (m, finalId, kindName, extra) => {
    const e = m.entity;
    return {
      id: finalId,
      name: extra.name,
      description: extra.description,
      ...(kindName === 'feature'
        ? {
            user_visible_purpose: e.user_visible_purpose ?? e.purpose ?? null,
            user_interactions: e.user_interactions ?? [],
            location_context: e.location_context ?? null,
          }
        : {
            technical_role: e.technical_role ?? null,
            semantic_role: e.semantic_role ?? null,
            supported_features: e.supported_features ?? [],
          }),
      aliases: extra.aliases,
      keywords: extra.keywords,
      primary_files: extra.primary_files,
      supporting_files: extra.supporting_files,
      non_application_files: extra.non_application_files,
      confidence: extra.confidence,
      notes: extra.notes,
      provenance: extra.provenance,
      naming_basis: extra.naming_basis,
      naming_conflict: extra.naming_conflict,
      annotation_summary: extra.annotation_summary,
      evidence: extra.evidence,
    };
  };

  const namingFor = (members, kindName) => {
    const shared = sharedGroupTerms(members);
    let term = null;
    let basis = null;
    if (shared.length) {
      term = shared[0];
      basis = 'consolidation_shared_vocabulary';
    } else {
      const best = bestMember(members);
      term = best.seedTerm;
      basis = 'strongest_member_identity';
    }
    const name = titleCase(term);
    return { term, name, basis, shared };
  };

  for (const g of groupOutcomes) {
    const members = g.members
      .map((id) => participants.find((p) => p.originalId === id))
      .filter((m) => !m.isFragment || m.appFiles.length > 0);
    const allMembers = members;
    const noise = allMembers.flatMap((m) => [...(m.noiseFiles || []), ...(m.supportingNoise || [])])
      .map((n) => ({ file: n.file, relevance_class: n.relevance_class }))
      .sort((a, b) => (a.file < b.file ? -1 : 1));
    const files = groupFiles(allMembers);
    const confRank = Math.min(...allMembers.map((m) => CONF_RANK[m.confidence] ?? 0));
    const confidence = RANK_CONF[Math.max(1, confRank)] || 'low';
    const namingConflicts = allMembers.map((m) => m.entity.naming_conflict).filter(Boolean);
    const prov = {
      consolidated: true,
      source_entities: allMembers.map((m) => m.originalId).sort(),
      source_regions: [...new Set(allMembers.map((m) => m.regionId).filter(Boolean))].sort(),
      merge_evidence: g.mergeEvidence,
    };

    if (g.mode === 'single_feature' || g.mode === 'single_system') {
      const kindName = g.mode === 'single_feature' ? 'feature' : 'system';
      const naming = namingFor(allMembers, kindName);
      const best = bestMember(allMembers.filter((m) => sideOf(m) === (kindName === 'feature' ? 'feature' : 'system')));
      const { id, collided } = mintId({ kind: kindName, slug: slugify(naming.term), files: files.app, taken: takenByKind[kindName] });
      idMap.push({ original_ids: allMembers.map((m) => m.originalId).sort(), final_id: id, basis: `merge (${g.mode})`, naming_basis: naming.basis, collided });
      const entity = baseEntity(best, id, kindName, {
        name: naming.name,
        description: best.entity.description,
        aliases: [...new Set(allMembers.flatMap((m) => m.entity.aliases || []).concat(naming.term))].slice(0, 6),
        keywords: naming.shared.slice(0, 8),
        primary_files: files.app,
        supporting_files: files.supp,
        non_application_files: noise,
        confidence,
        notes: [
          `Consolidated from ${allMembers.length} region entities by Phase 4C.2 (${g.mode}).`,
          ...(g.mode === 'single_feature' && g.featureSide.length && g.systemSide.length
            ? ['System-side members had no external consumers and were absorbed as internal layers of the capability.']
            : []),
          best.entity.notes?.[0],
        ].filter(Boolean),
        provenance: prov,
        naming_basis: naming.basis,
        naming_conflict: namingConflicts[0] || null,
        annotation_summary: attachAnnotationSummary({ appFiles: files.app, suppFiles: files.supp, noiseFiles: noise, strings: allMembers.reduce((acc, m) => ({
          capability: acc.capability.concat(m.strings.capability),
          context: acc.context.concat(m.strings.context),
          state: acc.state.concat(m.strings.state),
          incidental: acc.incidental.concat(m.strings.incidental),
        }), { capability: [], context: [], state: [], incidental: [] }) }),
        evidence: [
          ...g.mergeEvidence.map((s) => ({ source: 'phase4c2_consolidation', evidence_type: 'merge', observed: `${s.type}: ${s.description} (between ${s.between.join(' + ')})` })),
          ...best.entity.evidence || [],
        ].slice(0, 24),
      });
      (kindName === 'feature' ? outputFeatures : outputSystems).push(entity);
    } else {
      // feature_and_system: consolidated pair split by layer.
      for (const [kindName, side] of [['feature', g.featureSide], ['system', g.systemSide]]) {
        const naming = namingFor(side, kindName);
        const best = bestMember(side);
        const sideFiles = groupFiles(side);
        const sideNoise = allMembers
          .flatMap((m) => [...(m.noiseFiles || []), ...(m.supportingNoise || [])])
          .filter((n) => side.some((s) => [...s.appFiles, ...s.suppFiles].includes(n.file)))
          .map((n) => ({ file: n.file, relevance_class: n.relevance_class }))
          .sort((a, b) => (a.file < b.file ? -1 : 1));
        const { id, collided } = mintId({ kind: kindName, slug: slugify(naming.term), files: sideFiles.app, taken: takenByKind[kindName] });
        idMap.push({ original_ids: side.map((m) => m.originalId).sort(), final_id: id, basis: `merge (${g.mode}, ${kindName} layer)`, naming_basis: naming.basis, collided });
        const entity = baseEntity(best, id, kindName, {
          name: naming.name,
          description: best.entity.description,
          aliases: [...new Set(side.flatMap((m) => m.entity.aliases || []).concat(naming.term))].slice(0, 6),
          keywords: naming.shared.slice(0, 8),
          primary_files: sideFiles.app,
          supporting_files: sideFiles.supp,
          non_application_files: sideNoise,
          confidence,
          notes: [
            `Consolidated from ${side.length} ${kindName}-layer member(s) of a ${g.members.length}-member merge group.`,
            'The group split by layer: user-facing capability (feature) vs shared infrastructure (system).',
            best.entity.notes?.[0],
          ].filter(Boolean),
          provenance: { ...prov, layer: kindName },
          naming_basis: naming.basis,
          naming_conflict: namingConflicts[0] || null,
          annotation_summary: attachAnnotationSummary({ appFiles: sideFiles.app, suppFiles: sideFiles.supp, noiseFiles: sideNoise, strings: side.reduce((acc, m) => ({
            capability: acc.capability.concat(m.strings.capability),
            context: acc.context.concat(m.strings.context),
            state: acc.state.concat(m.strings.state),
            incidental: acc.incidental.concat(m.strings.incidental),
          }), { capability: [], context: [], state: [], incidental: [] }) }),
          evidence: [
            ...g.mergeEvidence.map((s) => ({ source: 'phase4c2_consolidation', evidence_type: 'merge', observed: `${s.type}: ${s.description} (between ${s.between.join(' + ')})` })),
            ...best.entity.evidence || [],
          ].slice(0, 24),
        });
        (kindName === 'feature' ? outputFeatures : outputSystems).push(entity);
      }
    }
  }

  // Untouched canonical entities (pass-through with noise-file cleanup).
  const untouched = canonical.filter((m) => !groupedIds.has(m.originalId) && !m.isFragment);
  for (const m of untouched) {
    const kindName = m.kind;
    const primary = [...m.appFiles, ...m.suppFiles].sort();
    const noise = [...(m.noiseFiles || []), ...(m.supportingNoise || [])]
      .map((n) => ({ file: n.file, relevance_class: n.relevance_class }))
      .sort((a, b) => (a.file < b.file ? -1 : 1));
    // Strip 4B.2's positional collision suffix ('artist-2') — the id must be
    // derived from evidence, not array order (§7). Collisions with a real
    // sibling slug resolve through mintId's content hash.
    const slug = slugify(m.originalId.replace(/^(feature|system)-/, '').replace(/-\d+$/, ''));
    const { id, collided } = mintId({ kind: kindName, slug, files: primary, taken: takenByKind[kindName] });
    idMap.push({ original_ids: [m.originalId], final_id: id, basis: 'pass-through (annotation cleanup only)', collided });
    const e = m.entity;
    const entity = baseEntity(m, id, kindName, {
      name: e.name,
      description: e.description,
      aliases: e.aliases || [],
      keywords: e.keywords || [],
      primary_files: primary,
      supporting_files: m.supportingKept,
      non_application_files: noise,
      confidence: e.confidence,
      notes: [...(e.notes || []), ...(noise.length ? [`Primary files re-classified by annotation relevance (D-017): ${noise.length} non-application file(s) moved out of the anchor set.`] : [])],
      provenance: { consolidated: false, source_entities: [m.originalId], source_regions: m.regionId ? [m.regionId] : [] },
      naming_basis: 'unchanged_from_phase4b2',
      naming_conflict: e.naming_conflict || null,
      annotation_summary: attachAnnotationSummary(m),
      evidence: e.evidence || [],
    });
    (kindName === 'feature' ? outputFeatures : outputSystems).push(entity);
  }

  // --- 6. Unresolved output ---------------------------------------------------
  const unresolvedOut = [];
  const ambiguousPreserved = [];
  for (const m of ambiguousModels) {
    if (groupedIds.has(m.originalId)) continue;
    unresolvedOut.push({ ...m.entity });
    if (m.status === 'ambiguous') ambiguousPreserved.push(m.originalId);
  }
  for (const d of demotionDecisions) {
    if (groupedIds.has(d.entity)) continue; // absorbed by a merge — recorded there
    const m = canonical.find((x) => x.originalId === d.entity);
    unresolvedOut.push({
      id: d.entity,
      region_id: m?.regionId || null,
      status: 'demoted_false_positive',
      previous_status: d.kind,
      confidence: 'low',
      reason: d.reason,
      rule: d.rule,
      misleading_strings: d.misleading_strings,
      primary_files: [...(m?.appFiles || []), ...(m?.suppFiles || [])],
      non_application_files: (m?.noiseFiles || []).map((n) => n.file),
      fragment_available: (m?.appFiles || []).length > 0,
    });
  }
  for (const fm of fragmentModels) {
    if (groupedIds.has(fm.originalId)) continue;
    if (fm.fragmentStatus === 'system') {
      const { id } = mintId({ kind: 'system', slug: slugify(fm.seedTerm), files: fm.appFiles, taken: takenByKind.system });
      idMap.push({ original_ids: [fm.originalId], final_id: id, basis: 'separated fragment (system layer)', collided: false });
      outputSystems.push(baseEntity(fm, id, 'system', {
        name: titleCase(fm.seedTerm),
        description: fm.entity.description,
        aliases: [],
        keywords: [...fm.discriminativeTerms].slice(0, 8),
        primary_files: fm.appFiles,
        supporting_files: fm.suppFiles,
        non_application_files: fm.noiseFiles.map((n) => n.file),
        confidence: 'low',
        notes: [fm.fragmentReason],
        provenance: { consolidated: false, source_entities: [fm.fragmentOf], source_regions: fm.regionId ? [fm.regionId] : [], separated_from: fm.fragmentOf },
        naming_basis: 'inherited_seed_term',
        naming_conflict: null,
        annotation_summary: attachAnnotationSummary(fm),
        evidence: fm.entity.evidence || [],
      }));
    } else {
      const { id } = mintId({ kind: 'unresolved', slug: slugify(fm.seedTerm), files: fm.appFiles, taken: new Set() });
      unresolvedOut.push({
        id,
        region_id: fm.regionId,
        status: 'unresolved',
        previous_status: 'separated_fragment',
        confidence: 'low',
        reason: fm.fragmentReason,
        primary_files: fm.appFiles,
        source_entities: [fm.fragmentOf],
      });
    }
  }
  unresolvedOut.sort((a, b) => (a.id < b.id ? -1 : 1));
  outputFeatures.sort((a, b) => (a.id < b.id ? -1 : 1));
  outputSystems.sort((a, b) => (a.id < b.id ? -1 : 1));

  // --- 7. Relationships remap ---------------------------------------------------
  const oldToNew = new Map();
  for (const m of idMap) for (const o of m.original_ids) oldToNew.set(o, m.final_id);
  const relsOut = [];
  const droppedRelationships = [];
  const relKey = (r) => `${r.source}|${r.target}|${r.relationship_type}`;
  const byKey = new Map();
  for (const r of relationships.relationships || []) {
    const s = oldToNew.get(r.source) || null;
    const t = oldToNew.get(r.target) || null;
    if (!s || !t) {
      droppedRelationships.push({ ...r, drop_reason: !s ? `source entity ${r.source} demoted/separated` : `target entity ${r.target} demoted/separated` });
      continue;
    }
    if (s === t) {
      droppedRelationships.push({ ...r, drop_reason: `endpoints consolidated into ${s}` });
      continue;
    }
    const remapped = { ...r, source: s, target: t, evidence: [...(r.evidence || []), { source: 'phase4c2_consolidation', evidence_type: 'remap', observed: `endpoints remapped ${r.source} -> ${s}, ${r.target} -> ${t}` }] };
    const k = relKey(remapped);
    if (byKey.has(k)) byKey.get(k).evidence.push(...remapped.evidence);
    else byKey.set(k, remapped);
  }
  relsOut.push(...byKey.values());
  relsOut.sort((a, b) => (relKey(a) < relKey(b) ? -1 : 1));

  // --- 8. Report ------------------------------------------------------------------
  const counts = {
    canonical_entities_in: canonical.length,
    features_in: (features.features || []).length,
    systems_in: (systems.systems || []).length,
    ambiguous_in: (unresolved.entities || []).filter((e) => e.status === 'ambiguous').length,
    unresolved_in: (unresolved.entities || []).filter((e) => e.status === 'unresolved').length,
    demoted: demotionDecisions.length,
    separations: separationDecisions.length,
    merge_groups: groupOutcomes.length,
    features_out: outputFeatures.length,
    systems_out: outputSystems.length,
    ambiguous_out: unresolvedOut.filter((e) => e.status === 'ambiguous').length,
    unresolved_out: unresolvedOut.filter((e) => e.status === 'unresolved').length,
    demoted_false_positives_out: unresolvedOut.filter((e) => e.status === 'demoted_false_positive').length,
    relationships_in: (relationships.relationships || []).length,
    relationships_out: relsOut.length,
    relationships_dropped: droppedRelationships.length,
    id_collisions_resolved: idMap.filter((m) => m.collided).length,
  };

  const report = {
    tool: TOOL,
    version: VERSION,
    inputs: {
      evidenceDir: inputs.evidenceDir || null,
      annotationDir: inputs.annotationDir || null,
      structuralDir: inputs.structuralDir || null,
      investigationDir: inputs.investigationDir || null,
      semanticDir: inputs.semanticDir || null,
    },
    counts,
    annotation_consumption: {
      files_json: 'relevance classes gate anchoring (D0), noise partitioning, and merge participation (AM2)',
      strings_json: 'string classes drive seed legality (D1/D3), demotion evidence, merge signals (S1/S1b/S3/S5), and naming',
      mechanical_flags: 'consumed verbatim through the annotation layer (D-017); never re-derived here',
      graph: 'application-file import edges drive separation components and S5 merge evidence',
      investigation_candidates: '4B.1 clue index supplies behavioral evidence for seed legality and splits',
    },
  };

  const consolidations = {
    tool: TOOL,
    version: VERSION,
    inputs: report.inputs,
    rules: {
      demotions: {
        D0: 'entity anchored by no application/supporting file (relevance policy, D-017)',
        D1: 'identity term occurs in application evidence only inside state/incidental strings (never seed, D-016)',
        D3: 'no capability string, no behavioral evidence, no user-action vocabulary — context may name, never seed (D-016)',
      },
      separations: 'import-disconnected application components with no shared discriminative user-facing vocabulary (§4 conflation)',
      merges: {
        strong: ['S1 identical capability string', 'S1b shared user-action verb in capability strings', 'S5 application import edge + shared discriminative domain term at both ends', 'S3 >= 2 shared discriminative domain terms'],
        anti: ['AM1 generic vocabulary only', 'AM2 noise-file-only relation', 'AM3 persistence service without domain interaction'],
        mixed_type: 'feature+system groups split by layer; system side with external consumers stays a separate system (D-013 auth/poster-data shape)',
      },
      ambiguity: 'ambiguous/unresolved entities merge only under strong evidence; otherwise preserved verbatim (§6)',
      ids: 'evidence-derived slug + FNV-1a file-set hash on collision — deterministic, position-independent (§7)',
    },
    decisions: {
      demotions: demotionDecisions,
      separations: separationDecisions,
      non_splits: nonSplits,
      merges: groupOutcomes.map((g) => ({
        members: g.members,
        mode: g.mode,
        feature_side: g.featureSide.map((m) => m.originalId),
        system_side: g.systemSide.map((m) => m.originalId),
        evidence: g.mergeEvidence,
      })),
      non_merges: nonMerges,
      ambiguity_preserved: ambiguousPreserved,
      id_map: idMap,
      dropped_relationships: droppedRelationships,
    },
    counts,
  };

  return { features: outputFeatures, systems: outputSystems, unresolved: unresolvedOut, relationships: relsOut, consolidations, report };
}

export function runConsolidation({ evidenceDir, annotationDir, structuralDir, investigationDir, semanticDir, outputDir }) {
  for (const [label, dir] of [['annotation', annotationDir], ['structural', structuralDir], ['investigation', investigationDir], ['semantic', semanticDir]]) {
    if (!existsSync(dir)) throw new Error(`consolidate: ${label} inputs not found at ${dir}`);
  }
  const inputs = loadInputs({ evidenceDir, annotationDir, structuralDir, investigationDir, semanticDir });
  const result = consolidate(inputs);

  const base = join(outputDir, 'consolidation');
  mkdirSync(base, { recursive: true });
  const writeJson = (name, data) => writeFileSync(join(base, name), JSON.stringify(data, null, 2) + '\n', 'utf-8');
  writeJson('features.json', { tool: TOOL, version: VERSION, features: result.features });
  writeJson('systems.json', { tool: TOOL, version: VERSION, systems: result.systems });
  writeJson('unresolved.json', { tool: TOOL, version: VERSION, entities: result.unresolved });
  writeJson('relationships.json', { tool: TOOL, version: VERSION, relationships: result.relationships });
  writeJson('consolidations.json', result.consolidations);
  writeJson('consolidation-report.json', result.report);
  return result;
}
