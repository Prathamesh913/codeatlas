// CodeAtlas Phase 4B.2 — Canonical Resolution
//
// Turns Semantic Regions into Features / Systems / ambiguous / unresolved.
// Reuses Phase 4B.1 evidence first; performs bounded incremental inspection
// only when a concrete resolution question is open. Every extra read records
// file, reason, question answered, and resulting evidence.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractClues } from '../investigate/clues.js';
import { STOP_TERMS, tokenize, USER_VERBS, PERSISTENCE_TOKENS } from './tokens.js';

// Safety limits (documented in PHASE_4B2_DESIGN_AUDIT.md §5):
// per-region extra reads stay small; the global cap keeps total inspection
// well below a repository scan (~<10% of ProjectDock, ~24% of CinePrint worst case).
export const MAX_EXTRA_PER_REGION = 3;
export const MAX_EXTRA_TOTAL = 60;

const UI_FILE_TOKENS = new Set(['page', 'pages', 'screen', 'modal', 'dialog', 'form', 'card', 'grid', 'view', 'route', 'routes', 'menu', 'bar', 'list', 'tab', 'button', 'header', 'lightbox']);

/** Index all Phase 4B.1 clues by file. */
export function indexClues(candidates) {
  const byFile = new Map();
  for (const c of candidates || []) {
    for (const f of c.inspected_files || []) {
      if (!byFile.has(f.file)) byFile.set(f.file, []);
      byFile.get(f.file).push(...(f.clues || []));
    }
  }
  return byFile;
}

export function createInspector({ repoRoot, graph, clueIndex }) {
  const state = { total: 0, log: [] };
  return {
    clueIndex,
    state,
    hasEvidence(file) {
      const cl = clueIndex.get(file) || [];
      return cl.some((c) => c.type === 'ui' || (c.type === 'behavioral' && c.evidence_type !== 'comment'));
    },
    /** Bounded incremental inspection with recorded justification. */
    inspectExtra(region, files, question) {
      const added = [];
      for (const file of files.slice(0, MAX_EXTRA_PER_REGION)) {
        if (state.total >= MAX_EXTRA_TOTAL) break;
        if (clueIndex.has(file) && (clueIndex.get(file) || []).length) continue; // already inspected
        const full = join(repoRoot, file);
        if (!existsSync(full)) {
          state.log.push({ region: region.id, file, question, result: 'file not found' });
          continue;
        }
        let content;
        try {
          content = readFileSync(full, 'utf-8').slice(0, 20000);
        } catch {
          state.log.push({ region: region.id, file, question, result: 'read failed' });
          continue;
        }
        const node = graph.nodes.find((n) => n.id === file) || null;
        const clues = extractClues(content, file, node);
        const existing = clueIndex.get(file) || [];
        clueIndex.set(file, existing.concat(clues));
        state.total++;
        added.push({ file, clues });
        state.log.push({
          region: region.id,
          file,
          reason: 'region lacked source-derived UI/behavioral evidence in Phase 4B.1',
          question,
          result: { clue_count: clues.length, ui_clues: clues.filter((c) => c.type === 'ui').length, behavioral_clues: clues.filter((c) => c.type === 'behavioral').length },
        });
      }
      return added;
    },
  };
}

/** Score a region for feature vs system interpretation. */
export function scoreRegion(region, inspector, graph) {
  const clueIndex = inspector.clueIndex;
  const files = region.primary_files;
  const clues = files.flatMap((f) => clueIndex.get(f) || []);
  const uiClues = clues.filter((c) => c.type === 'ui');
  const behaviorClues = clues.filter((c) => c.type === 'behavioral');
  const distinctLabels = [...new Set(uiClues.map((c) => (c.raw || '').toLowerCase()))];
  const terms = new Set(region.boundary_evidence.top_terms);

  const feature = { score: 0, signals: [] };
  const system = { score: 0, signals: [] };

  if (distinctLabels.length >= 2) {
    feature.score += 3;
    feature.signals.push(`${distinctLabels.length} distinct user-visible labels`);
  } else if (distinctLabels.length === 1) {
    feature.score += 2;
    feature.signals.push('1 user-visible label');
  }
  if (region.boundary_evidence.user_verbs.length) {
    feature.score += 2;
    feature.signals.push(`user-action verbs in evidence: ${region.boundary_evidence.user_verbs.join(', ')}`);
  }
  const uiFiles = files.filter((f) => {
    const t = tokenize(f);
    return /\.tsx?$/i.test(f) && t.some((x) => UI_FILE_TOKENS.has(x));
  });
  if (uiFiles.length) {
    feature.score += 2;
    feature.signals.push(`${uiFiles.length} view-layer file(s)`);
  }
  if (behaviorClues.some((c) => /state\/handler|UI state/i.test(c.observed))) {
    feature.score += 1;
    feature.signals.push('UI state/handler behavior observed');
  }

  if (region.imported_by_regions.length >= 2) {
    if (distinctLabels.length) {
      system.score += 3;
      system.signals.push(`imported by ${region.imported_by_regions.length} distinct semantic regions (coexists with user-visible labels — ambiguous signal)`);
    } else {
      system.score += 4;
      system.signals.push(`imported by ${region.imported_by_regions.length} distinct semantic regions`);
    }
  } else if (region.imported_by_regions.length === 1) {
    system.score += 1;
    system.signals.push('imported by 1 other region');
  }
  if (region.is_shared_infrastructure) {
    system.score += 3;
    system.signals.push('carved as shared infrastructure (no semantic clustering of its own)');
  }
  if ([...terms].some((t) => PERSISTENCE_TOKENS.has(t))) {
    system.score += 2;
    system.signals.push('persistence/infrastructure vocabulary');
  }
  if (behaviorClues.some((c) => /Firestore|persistence|subprocess|desktop integration/i.test(c.observed))) {
    system.score += 2;
    system.signals.push('infrastructure behavior observed');
  }
  if (!distinctLabels.length && region.boundary_evidence.members.length >= 3) {
    system.score += 1;
    system.signals.push('multi-file area without user-visible text');
  }

  return { feature, system, uiClues, behaviorClues, distinctLabels, clues };
}

function titleCase(term) {
  return term
    .split(/[-_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function joinAnd(arr) {
  if (arr.length <= 1) return arr.join('');
  return arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1];
}

/** Naive plural for description nouns; leaves short/irregular terms alone. */
function pluralize(term) {
  if (term.length < 4 || /(s|x|z|ch|sh|y)$/i.test(term)) return term;
  return `${term}s`;
}

function buildDescription(region, scoring, kind, namingTerm) {
  const obj = namingTerm.replace(/[-_]/g, ' ');
  // Directory tokens describe where code lives, never what it does (D-012):
  // they must not become the object of a user-facing description.
  const dirTerms = new Set(
    region.primary_files.flatMap((f) => f.split('/').slice(0, -1).flatMap((d) => tokenize(d)))
  );
  if (kind === 'feature') {
    const objStem = namingTerm;
    const objIsVerb = USER_VERBS.has(objStem);
    let verbs = region.boundary_evidence.user_verbs.filter((v) => v !== objStem);
    if (objIsVerb) verbs = [objStem, ...verbs];
    verbs = verbs.slice(0, 2);
    const nouns = (
      objIsVerb
        ? region.boundary_evidence.top_terms
            .filter((t) => t !== objStem && !USER_VERBS.has(t) && !STOP_TERMS.has(t) && !dirTerms.has(t))
            .slice(0, 2)
        : [objStem]
    ).map(pluralize);
    let description = verbs.length
      ? `Lets users ${joinAnd(verbs)}${nouns.length ? ` ${nouns.join(' and ')}` : ''}.`
      : nouns.length
        ? `Presents ${nouns.join(' and ')} in the interface.`
        : 'Lets users work with this part of the interface.';
    // A representative visible label anchors the description in real UI text.
    const label = scoring.distinctLabels.find((l) => l.length >= 4 && /[a-z]{3}/i.test(l));
    if (label && !description.toLowerCase().includes(label.toLowerCase())) {
      description += ` The interface labels it "${label}".`;
    }
    const purpose = `Let users ${verbs[0] || 'work with'} ${
      nouns.join(' and ') || 'this part of the app'
    } from the interface.`;
    return { description, purpose };
  }
  const sharedN = region.imported_by_regions.length || region.boundary_evidence.shared_by_regions || 0;
  const infra = scoring.system.signals.some((s) => /persistence|Firestore/i.test(s))
    ? 'storing and retrieving'
    : 'providing';
  const consumers = sharedN === 1 ? '1 other implementation area' : `${sharedN || 'multiple'} other implementation areas`;
  return {
    description: `Shared ${obj} capability for ${consumers}: it handles ${infra} ${obj} so features do not re-implement it. Architectural support rather than a user-visible action.`,
    purpose: `Keeps ${obj} behavior consistent across the features that depend on it.`,
  };
}

export function resolveRegion(region, inspector, graph, df = new Map()) {
  const files = region.primary_files;
  let scoring = scoreRegion(region, inspector, graph);
  const additional = [];

  // Question 1: is there any source-derived evidence at all?
  if (!scoring.uiClues.length && !scoring.behaviorClues.some((c) => c.evidence_type !== 'comment')) {
    const ranked = files
      .filter((f) => !inspector.hasEvidence(f))
      .map((f) => ({ f, node: graph.nodes.find((n) => n.id === f) }))
      .sort((a, b) => (b.node?.declares?.length || 0) - (a.node?.declares?.length || 0) || (a.f < b.f ? -1 : 1));
    const added = inspector.inspectExtra(region, ranked.map((x) => x.f), 'does this region have source-derived UI/behavioral evidence, or only naming?');
    if (added.length) {
      additional.push(...added);
      scoring = scoreRegion(region, inspector, graph);
    }
  }

  // Question 1b: a provisional (single-file) region must earn canonical status.
  const stillNoEvidence =
    !scoring.uiClues.length && !scoring.behaviorClues.some((c) => c.evidence_type !== 'comment');
  if (region.is_provisional && stillNoEvidence) {
    const ranked = files.filter((f) => !inspector.hasEvidence(f)).sort((a, b) => (a < b ? -1 : 1));
    const added = inspector.inspectExtra(region, ranked, 'can this single-file region justify being its own semantic entity?');
    if (added.length) {
      additional.push(...added);
      scoring = scoreRegion(region, inspector, graph);
    }
  }

  // Question 2: feature vs system undecided?
  const diff = Math.abs(scoring.feature.score - scoring.system.score);
  const both = scoring.feature.score >= 2 && scoring.system.score >= 2;
  if (both && diff <= 1) {
    const ranked = files
      .filter((f) => !inspector.hasEvidence(f))
      .sort((a, b) => a < b ? -1 : 1);
    const added = inspector.inspectExtra(region, ranked, 'is this area a user-visible capability or a shared architectural one?');
    if (added.length) {
      additional.push(...added);
      scoring = scoreRegion(region, inspector, graph);
    }
  }

  const f = scoring.feature;
  const s = scoring.system;
  const finalDiff = Math.abs(f.score - s.score);
  const finalBoth = f.score >= 2 && s.score >= 2;
  const hasSourceEvidence =
    scoring.uiClues.length > 0 || scoring.behaviorClues.some((c) => c.evidence_type !== 'comment');

  let status, confidence;
  let confidence_reason;

  if (region.is_provisional && !hasSourceEvidence) {
    // A lone file that still shows no user-visible or behavioral evidence after
    // bounded inspection must not be promoted just because it exists.
    status = 'unresolved';
    confidence = 'unknown';
    confidence_reason = 'Single-file region with no source-derived UI or behavioral evidence after bounded inspection; promoting it would fabricate a semantic entity.';
  } else if (finalBoth && finalDiff <= 1) {
    status = 'ambiguous';
    confidence = 'low';
    confidence_reason = `Feature signals (${f.score}: ${f.signals.join('; ')}) and system signals (${s.score}: ${s.signals.join('; ')}) are comparable; evidence does not decide between a user-visible capability and shared infrastructure.`;
  } else if (s.score >= 3 && s.score > f.score) {
    status = 'system';
    confidence = s.score >= 6 && f.score <= 2 ? 'high' : s.score >= 5 ? 'medium' : 'low';
    confidence_reason = `System signals dominate (${s.score} vs feature ${f.score}): ${s.signals.join('; ')}.`;
  } else if (f.score >= 2 && f.score > s.score) {
    status = 'feature';
    confidence = scoring.distinctLabels.length >= 3 && scoring.behaviorClues.length >= 2 ? 'high' : f.score >= 4 ? 'medium' : 'low';
    confidence_reason = `Feature signals dominate (${f.score} vs system ${s.score}): ${f.signals.join('; ')}.`;
  } else {
    status = 'unresolved';
    confidence = 'unknown';
    confidence_reason = `Neither feature (${f.score}) nor system (${s.score}) evidence crossed the resolution threshold.`;
  }

  // --- Naming-vs-behavior guard -------------------------------------------
  // A seed term supported ONLY by naming (filename / symbol names / low-stakes
  // string literals), while inspected behavior points at a different dominant
  // concept, must not become the canonical name. Example: `lib/notion.ts`
  // behaves as poster data loading, not Notion integration. Behavior wins;
  // the naming-based interpretation is preserved as a recorded conflict.
  const behaviorCounts = new Map();
  for (const c of scoring.behaviorClues) {
    for (const t of tokenize(c.raw || '')) behaviorCounts.set(t, (behaviorCounts.get(t) || 0) + 1);
  }
  for (const c of scoring.uiClues) {
    if (c.confidence === 'low') continue; // string literals in e.g. automation scripts are not user vocabulary
    for (const t of tokenize(c.raw || '')) behaviorCounts.set(t, (behaviorCounts.get(t) || 0) + 1);
  }
  const seedTerm = region.term;
  const seedInEvidence =
    (behaviorCounts.get(seedTerm) || 0) > 0 ||
    scoring.distinctLabels.some((l) => tokenize(l).includes(seedTerm));
  let namingTerm = seedTerm;
  let namingConflict = null;
  // Shared-infrastructure regions take their term from the module's own
  // filename and their meaning from cross-region usage shape, so a lexical
  // mismatch with behavior is expected (persistence.js calls save/load) and
  // is not evidence of a misleading name.
  if (!region.is_shared_infrastructure && !seedInEvidence && behaviorCounts.size) {
    const totalFiles = graph.nodes.filter((n) => n.kind === 'file').length || 1;
    const ranked = [...behaviorCounts.entries()]
      .filter(([t]) => !STOP_TERMS.has(t))
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
    // A rename must rest on a discriminative behavior term — a term used
    // across the whole repository (e.g. "project" in a project launcher)
    // cannot serve as an entity name, so the seed term stands and the
    // conflict is recorded instead.
    const discriminative = ([t]) => (df.get(t) || 1) <= 0.15 * totalFiles;
    const top = ranked.find(([t]) => !USER_VERBS.has(t) && discriminative([t]));
    if (top && top[0] !== seedTerm) {
      namingConflict = {
        seed_term: seedTerm,
        naming_basis: 'filename/symbol vocabulary only — absent from inspected UI and behavioral evidence',
        behavior_term: top[0],
      };
      namingTerm = top[0];
    } else if (ranked.length && ranked[0][0] !== seedTerm) {
      namingConflict = {
        seed_term: seedTerm,
        naming_basis: 'filename/symbol vocabulary only — absent from inspected UI and behavioral evidence',
        behavior_term: ranked[0][0],
        renamed: false,
        note: 'behavior vocabulary is too generic to name the entity; seed term retained and conflict recorded',
      };
    }
  }

  // Entity naming — from evidence terms, never raw technical filename
  const descriptiveTerms = region.boundary_evidence.top_terms
    .filter((t) => !STOP_TERMS.has(t) && !/^(ts|js|tsx|py|test|index)$/.test(t))
    .slice(0, 5);
  if (!descriptiveTerms.includes(namingTerm)) descriptiveTerms.unshift(namingTerm);

  // Aliases: visible UI vocabulary first, then behavior-derived phrases.
  // Fragmentary labels ('+', '↵') are not user language.
  const labels = scoring.distinctLabels
    .filter((l) => l.length >= 4 && /[a-z]{3}/i.test(l))
    .slice(0, 4);
  const verb = region.boundary_evidence.user_verbs[0];
  const obj = namingTerm.replace(/[-_]/g, ' ');
  const aliasCandidates = [...labels];
  if (verb && verb !== obj && !labels.some((l) => l.toLowerCase().includes(obj))) {
    aliasCandidates.push(`${verb} ${obj}`, `${verb} ${pluralize(obj)}`);
  }
  if (!aliasCandidates.length) aliasCandidates.push(obj, pluralize(obj));
  // A recorded naming conflict means BOTH vocabularies aid lookup: the
  // behavior-derived canonical name and the naming-based seed term.
  if (namingConflict) aliasCandidates.push(namingConflict.seed_term.replace(/[-_]/g, ' '));

  const desc = buildDescription(region, scoring, status === 'system' ? 'system' : 'feature', namingTerm);

  const evidence = [];
  for (const c of scoring.uiClues.slice(0, 8)) {
    evidence.push({ source: 'phase4b1_clue', evidence_type: 'ui', file: c.file, observed: c.observed, confidence: c.confidence });
  }
  for (const c of scoring.behaviorClues.slice(0, 8)) {
    evidence.push({ source: 'phase4b1_clue', evidence_type: 'behavioral', file: c.file, observed: c.observed, confidence: c.confidence });
  }
  for (const m of region.boundary_evidence.members.slice(0, 8)) {
    evidence.push({ source: 'phase4b2_affinity', evidence_type: 'symbol-vocabulary', file: m.file, observed: `affinity ${m.affinity}${m.contested_with ? ` (contested with "${m.contested_with}")` : ''}` });
  }
  for (const ie of region.imported_edges.slice(0, 6)) {
    evidence.push({ source: 'phase4a_graph', evidence_type: 'import', edge: ie.edge, observed: `${ie.file_from} -> ${ie.file_to}` });
  }
  for (const a of additional) {
    for (const c of a.clues.slice(0, 4)) {
      evidence.push({ source: 'phase4b2_additional_inspection', evidence_type: c.type, file: c.file, observed: c.observed, confidence: c.confidence });
    }
  }
  if (namingConflict) {
    evidence.push({
      source: 'phase4b2_naming_guard',
      evidence_type: 'naming-conflict',
      observed: `seed term "${namingConflict.seed_term}" is supported only by naming; inspected behavior indicates "${namingConflict.behavior_term}". Both interpretations preserved.`,
    });
  }

  const name = titleCase(obj);

  const idKind =
    status === 'feature' ? 'feature' : status === 'system' ? 'system' : status === 'ambiguous' ? 'ambiguous' : 'unresolved';
  const entitySlug = namingTerm.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'misc';

  return {
    id: `${idKind}-${entitySlug}`,
    region_id: region.id,
    term: region.term,
    resolved_term: namingTerm,
    name,
    status,
    confidence,
    confidence_reason,
    description: desc.description,
    purpose: desc.purpose,
    aliases: [...new Set(aliasCandidates)].slice(0, 5),
    keywords: descriptiveTerms,
    source_structural_units: region.source_structural_units,
    spans_multiple_units: region.spans_multiple_units,
    primary_files: files,
    supporting_files: region.supporting_files,
    imported_by_regions: region.imported_by_regions,
    imports_from_regions: region.imports_from_regions,
    naming_conflict: namingConflict,
    competing_interpretations:
      status === 'ambiguous'
        ? [
            { interpretation: 'feature', score: f.score, signals: f.signals },
            { interpretation: 'system', score: s.score, signals: s.signals },
          ]
        : [],
    contested_files: region.boundary_evidence.contested_files,
    evidence,
    additional_inspections: additional.map((a) => a.file),
  };
}
