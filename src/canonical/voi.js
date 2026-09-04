// CodeAtlas Phase 4C.3 — Value-of-Information Inspection (workstream B)
//
// A distinct, deterministic inspection stage between consolidation and
// canonical resolution (D-018). It never re-reads a repository wholesale:
//
//   1. Enumerate OPEN DECISION QUESTIONS from recorded state (entities,
//      consolidation decisions, relationships, annotation evidence).
//   2. Use existing evidence first — annotation string classes, declared
//      symbols, the clue index from 4B.1/4B.2, consolidation decisions.
//   3. Only when a question is open AND unread files could carry the missing
//      evidence type, inspect a bounded number of them (budget enforced,
//      deterministic ranking), reusing the 4B.1 clue extractor.
//   4. Record every question: reason, expected impact, evidence consulted,
//      files inspected, findings, decision, confidence, output change.
//
// Uncertainty is preserved: a question that stays open after inspection is
// recorded with what evidence WOULD resolve it, never forced.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractClues } from '../investigate/clues.js';
import { tokenize, PERSISTENCE_TOKENS } from '../semantic/tokens.js';
import { GENERIC_TERMS, PLUMBING_VERBS, VENDOR_TERMS } from '../consolidate/rules.js';

export const VOI_DEFAULTS = Object.freeze({
  maxReadsPerQuestion: 2,
  maxTotalReadsPerRepo: 40,
});

// Behavior vocabulary that marks shell/404/error-route chrome rather than a
// user capability. Matched against RAW clue text (tokenization would split
// 'NotFoundComponent' into unmatchable fragments). Deliberately narrow.
const SHELL_PATTERN = /notfound|404|errorboundary|errorcomponent|offline|skeleton|did\s+not\s+load/i;

// Path tokens that mark route/shell-shaped files.
const ROUTE_FILE_TOKENS = new Set(['page', 'pages', 'route', 'routes', 'layout', 'root', 'screen', 'app']);

// Terms that can never carry a VOI merge: generic/plumbing/vendor vocabulary,
// persistence plumbing, and language primitives.
const EXCLUDED = new Set([
  ...GENERIC_TERMS, ...PLUMBING_VERBS, ...VENDOR_TERMS, ...PERSISTENCE_TOKENS,
  'promise', 'string', 'number', 'boolean', 'object', 'array', 'json', 'parse',
  'async', 'await', 'return', 'export', 'import', 'const', 'type', 'data',
  'state', 'value', 'item', 'error', 'errors', 'result', 'content', 'option',
  'options', 'param', 'params', 'request', 'response', 'test',
]);

function behaviorTerms(clues) {
  const terms = new Set();
  for (const c of clues) {
    if (c.type === 'behavioral' && c.evidence_type !== 'comment') {
      for (const t of tokenize(c.raw || c.observed || '')) terms.add(t);
    }
  }
  return terms;
}

function rankCandidates(files, ctx, includeClued = false) {
  const { graphNodes, clueIndex, degree } = ctx;
  return files
    .filter((f) => includeClued || !clueIndex.has(f) || (clueIndex.get(f) || []).length === 0) // existing evidence first
    .sort((a, b) =>
      (graphNodes.get(b)?.declares?.length || 0) - (graphNodes.get(a)?.declares?.length || 0) ||
      (degree.get(b) || 0) - (degree.get(a) || 0) ||
      (a < b ? -1 : 1));
}

/** Deeper directory segments shared by both files (layer evidence). */
function sharedDeepSegment(a, b) {
  const da = a.split('/').slice(0, -1);
  const db = b.split('/').slice(0, -1);
  for (let i = da.length; i >= 2; i--) {
    const seg = da.slice(0, i).join('/');
    if (i >= 2 && db.slice(0, i).join('/') === seg && db.length >= i) return seg;
  }
  return null;
}

/**
 * Enumerate open decision questions (deterministic order).
 */
export function enumerateQuestions({ models, mergeGroups, relationships, ctx }) {
  const questions = [];
  const byId = new Map(models.map((m) => [m.originalId, m]));

  // Q2 — non-merged same-kind SYSTEM pairs with a direct import edge but no
  // shared identity vocabulary: complementary-layer question (server-infra
  // class). Feature+feature pairs with edges are dependency relationships,
  // never merges.
  const pairSeen = new Set();
  for (const e of ctx.importEdges) {
    const a = ctx.entityOfAppFile.get(e.from);
    const b = ctx.entityOfAppFile.get(e.to);
    if (!a || !b || a === b || a.kind !== b.kind) continue;
    if (a.kind !== 'system') continue;
    const key = [a.originalId, b.originalId].sort().join('|');
    if (pairSeen.has(key)) continue;
    pairSeen.add(key);
    const shared = [...a.discriminativeTerms].filter((t) => b.discriminativeTerms.has(t));
    if (shared.length === 0) {
      questions.push({
        id: `voi-complement-${key}`,
        kind: 'complementary_layers',
        subjects: [a.originalId, b.originalId],
        reason: `Direct application import edge (${e.from} -> ${e.to}) but no shared identity vocabulary — possible complementary layers of one responsibility that the generic-vocabulary anti-merge rule correctly blocked on string evidence alone.`,
        expected_impact: 'merge into one entity or confirm two entities; changes navigation grouping',
        candidate_files: rankCandidates([...new Set([...a.appFiles, ...b.appFiles])], ctx, true),
        edge: { id: e.id, from: e.from, to: e.to },
      });
    }
  }

  // Q3 — canonical features whose text evidence is state/incidental
  // dominated, that own a route/shell-shaped file, and whose behavior
  // mentions shell markers: capability vs shell chrome (feature-lobby class).
  for (const m of models) {
    if (m.kind !== 'feature' || m.isFragment) continue;
    const strings = [...m.strings.state, ...m.strings.incidental, ...m.strings.context];
    const stateShare = strings.length ? (m.strings.state.length + m.strings.incidental.length) / strings.length : 0;
    const behRaw = (m.appFiles || []).flatMap((f) => ctx.clueIndex.get(f) || []).map((c) => `${c.raw || ''} ${c.observed || ''}`).join(' ');
    const shellHitMatch = behRaw.match(SHELL_PATTERN);
    const shellHits = shellHitMatch ? [shellHitMatch[0]] : [];
    const ownsRouteFile = (m.appFiles || []).some((f) => {
      const base = f.split('/').pop().replace(/\.[A-Za-z0-9]+$/, '');
      const toks = tokenize(base);
      return toks.some((t) => ROUTE_FILE_TOKENS.has(t)) || base.startsWith('__');
    });
    if (stateShare >= 0.5 && shellHits.length >= 1 && m.strings.capability.length === 0 && m.strings.context.length >= 2 && ownsRouteFile) {
      questions.push({
        id: `voi-shell-${m.originalId}`,
        kind: 'shell_or_capability',
        subjects: [m.originalId],
        reason: `Text evidence is ${Math.round(stateShare * 100)}% state/incidental, the entity owns a route/shell-shaped file, and behavior vocabulary contains chrome markers (${shellHits.sort().join(', ')}) — user capability vs route-shell chrome is undecided.`,
        expected_impact: 'reclassify as shell context or confirm the capability; changes canonical coverage',
        // Existing 4B.1/4B.2 evidence left this question open, so previously
        // read files may be re-read under this specific question.
        candidate_files: rankCandidates(m.appFiles, ctx, true),
      });
    }
  }

  // Q1 — consolidation merge groups whose evidence carries no corroborating
  // signal (single-signal merges are provisional): re-examine by reading.
  // The recorded shared vocabulary (S3 terms, S5 edge terms) is what the
  // reads must confirm or contradict.
  for (const g of mergeGroups) {
    const signalTypes = new Set((g.evidence || []).map((s) => s.type));
    const corroborated = signalTypes.has('S3') || signalTypes.has('S1');
    if (corroborated || (g.evidence || []).length === 0) continue;
    const recordedTerms = [...new Set((g.evidence || []).flatMap((s) => [...(s.terms || []), ...((s.edges || []).flatMap((e) => e.shared_terms || []))]))];
    const files = g.members_files || [];
    if (!files.length) continue;
    questions.push({
      id: `voi-merge-${g.members.join('+')}`,
      kind: 'merge_strength',
      subjects: g.members,
      reason: `Merged on ${[...signalTypes].join('+')} only, without corroborating shared vocabulary — the merge is provisional and reading can confirm or separate it.`,
      expected_impact: 'confirm the merged entity or restore the pre-merge boundaries',
      candidate_files: rankCandidates(files, ctx, true),
      group: g,
      recorded_terms: recordedTerms,
    });
  }

  // Q5 — ambiguous entities with navigation impact.
  const relIds = new Set();
  for (const r of relationships) { relIds.add(r.source); relIds.add(r.target); }
  for (const m of models) {
    if (m.kind !== 'ambiguous') continue;
    const impact = relIds.has(m.originalId) || (m.appFiles || []).length >= 3;
    if (!impact) continue;
    questions.push({
      id: `voi-ambiguity-${m.originalId}`,
      kind: 'resolve_or_keep',
      subjects: [m.originalId],
      reason: 'Ambiguous entity is referenced by the relationship graph or spans multiple files — resolution would change navigation; inspection may find decisive evidence.',
      expected_impact: 'resolve to feature/system or preserve ambiguity with recorded needs',
      candidate_files: rankCandidates(m.appFiles, ctx),
    });
  }

  // Q6 — low-confidence canonical entities: type re-confirmation.
  for (const m of models) {
    if ((m.kind !== 'feature' && m.kind !== 'system') || m.confidence !== 'low') continue;
    questions.push({
      id: `voi-type-${m.originalId}`,
      kind: 'type_confirmation',
      subjects: [m.originalId],
      reason: `Canonical ${m.kind} with low confidence — behavioral evidence may confirm or correct the type.`,
      expected_impact: 'type flip with evidence, or confirmed type with raised/kept confidence',
      candidate_files: rankCandidates(m.appFiles, ctx),
    });
  }

  questions.sort((x, y) =>
    ['complementary_layers', 'shell_or_capability', 'merge_strength', 'resolve_or_keep', 'type_confirmation'].indexOf(x.kind) -
      ['complementary_layers', 'shell_or_capability', 'merge_strength', 'resolve_or_keep', 'type_confirmation'].indexOf(y.kind) ||
    (x.id < y.id ? -1 : 1));
  return questions;
}

/**
 * Run bounded VOI inspection over the enumerated questions.
 * Returns { results, reads, budget } — results carry findings + decisions.
 */
export function inspectQuestions(questions, ctx, options = {}) {
  const limits = { ...VOI_DEFAULTS, ...options };
  const state = { total: 0, log: [] };
  const results = [];

  for (const q of questions) {
    const inspected = [];
    if (ctx.repoRoot && state.total < limits.maxTotalReadsPerRepo) {
      for (const file of q.candidate_files.slice(0, limits.maxReadsPerQuestion)) {
        if (state.total >= limits.maxTotalReadsPerRepo) break;
        const full = join(ctx.repoRoot, file);
        if (!existsSync(full)) continue;
        let content;
        try {
          content = readFileSync(full, 'utf-8').slice(0, 20000);
        } catch {
          continue;
        }
        const node = ctx.graphNodes.get(file) || null;
        const clues = extractClues(content, file, node);
        const existing = ctx.clueIndex.get(file) || [];
        ctx.clueIndex.set(file, existing.concat(clues));
        state.total += 1;
        state.log.push({ question: q.id, file, reason: q.reason.slice(0, 120) });
        inspected.push({ file, clues, behaviorTerms: [...behaviorTerms(clues)].sort(), uiLabels: clues.filter((c) => c.type === 'ui').map((c) => c.raw) });
      }
    }

    results.push(evaluateQuestion(q, inspected, ctx));
  }
  return { results, budget: { used: state.total, limit: limits.maxTotalReadsPerRepo, per_question: limits.maxReadsPerQuestion, log: state.log } };
}

function evaluateQuestion(q, inspected, ctx) {
  const findings = inspected.map((i) => ({ file: i.file, behavior_terms: i.behaviorTerms, ui_labels: i.uiLabels }));
  const base = {
    id: q.id,
    kind: q.kind,
    subjects: q.subjects,
    reason: q.reason,
    expected_impact: q.expected_impact,
    evidence_consulted: 'annotation string classes, declared symbols, 4B.1/4B.2 clue index, consolidation decisions, relationship graph',
    files_inspected: inspected.map((i) => i.file),
    findings,
    inspection_changed_output: false,
  };

  if (q.kind === 'shell_or_capability') {
    const m = ctx.modelById.get(q.subjects[0]);
    const known = new Set([...(m?.strings?.context || []).map((s) => s.value), ...(m?.strings?.state || []).map((s) => s.value), ...(m?.strings?.incidental || []).map((s) => s.value)]);
    const behRaw = inspected.map((i) => `${i.file}: ${(ctx.clueIndex.get(i.file) || []).map((c) => `${c.raw || ''} ${c.observed || ''}`).join(' ')}`).join(' ');
    const shellHitMatch = behRaw.match(SHELL_PATTERN);
    const shellHits = shellHitMatch ? [shellHitMatch[0]] : [];
    // A "new capability" is a high-confidence UI label that annotation had
    // not already classified as context/state/incidental text.
    const newCapability = inspected.some((i) => i.uiLabels.some((l) => {
      const raw = (l || '').trim();
      return raw.length >= 4 && !known.has(raw);
    }));
    if (shellHits.length >= 1 && !newCapability) {
      return { ...base, decision: 'reclassify_shell_context', confidence: 'medium', decision_reason: `Inspection confirmed shell/error-route behavior (${shellHits.sort().join(', ')}) and found no capability label beyond the already-recorded context/state text — reclassified as shell context, preserved as unresolved.` };
    }
    return { ...base, decision: 'keep_canonical', confidence: 'low', decision_reason: newCapability ? 'Inspection surfaced a user-facing label beyond the recorded shell text — the feature stands.' : 'Inspection did not find decisive shell evidence; the feature stands with its recorded uncertainty.' };
  }

  if (q.kind === 'complementary_layers') {
    const [aId, bId] = q.subjects;
    const a = ctx.modelById.get(aId);
    const b = ctx.modelById.get(bId);
    const readA = inspected.filter((i) => a?.appFiles.includes(i.file));
    const readB = inspected.filter((i) => b?.appFiles.includes(i.file));
    const termsA = new Set([...(a?.vocab || []), ...readA.flatMap((i) => i.behaviorTerms)]);
    const termsB = new Set([...(b?.vocab || []), ...readB.flatMap((i) => i.behaviorTerms)]);
    // Shared terms must be user-plausible (they occur in the repository's
    // user-facing vocabulary) as well as discriminative — framework and
    // plumbing tokens never merge responsibilities.
    const shared = [...termsA].filter((t) => termsB.has(t) && !EXCLUDED.has(t) && t.length >= 4 && (ctx.df.get(t) || 0) <= (ctx.voiDfMax || Infinity) && ctx.userVocab.has(t));
    const dirs = readA.length && readB.length
      ? sharedDeepSegment(readA[0].file, readB[0].file)
      : null;
    if (shared.length >= 2 || (shared.length >= 1 && dirs)) {
      return { ...base, decision: 'merge', confidence: 'medium', decision_reason: `Inspection found shared user-plausible behavioral vocabulary (${shared.sort().slice(0, 5).join(', ')})${dirs ? ` within the shared architectural layer '${dirs}'` : ''} — complementary layers of one responsibility; merged with VOI evidence.`, shared_terms: shared.sort() };
    }
    return { ...base, decision: 'keep_separate', confidence: 'low', decision_reason: `Inspection found no decisive user-plausible shared behavioral vocabulary beyond the import edge (found: ${shared.sort().slice(0, 5).join(', ') || 'none'}); the entities remain separate.`, would_resolve_with: 'distinctive user-facing behavior terms confirmed in both implementations, or a common architectural layer with complementary behavior' };
  }

  if (q.kind === 'merge_strength') {
    // The reads must confirm or contradict the merge's RECORDED shared
    // vocabulary — the same evidence class the consolidation merged on,
    // verified at behavior level.
    const recorded = new Set(q.recorded_terms || []);
    const readTerms = new Set(inspected.flatMap((i) => i.behaviorTerms));
    const confirmed = [...recorded].filter((t) => readTerms.has(t));
    if (recorded.size === 0) {
      return { ...base, decision: 'confirm_merge', confidence: 'low', decision_reason: 'No recorded shared vocabulary to verify; the merge stands as recorded by consolidation.' };
    }
    if (confirmed.length >= 1) {
      return { ...base, decision: 'confirm_merge', confidence: 'medium', decision_reason: `Inspection confirmed the recorded shared vocabulary at behavior level (${confirmed.sort().join(', ')}) — the consolidation merge stands.`, shared_terms: confirmed.sort() };
    }
    return { ...base, decision: 'separate', confidence: 'medium', decision_reason: `Inspection did not confirm any recorded shared term (${[...recorded].sort().join(', ')}) in the inspected behavior — the pre-merge boundaries are restored with recorded evidence.`, shared_terms: [] };
  }

  if (q.kind === 'type_confirmation') {
    const m = ctx.modelById.get(q.subjects[0]);
    const beh = new Set(inspected.flatMap((i) => i.behaviorTerms));
    const uiHandler = [...beh].some((t) => ['handler', 'onclick', 'toggle', 'submit', 'modal', 'button'].includes(t));
    const infra = [...beh].some((t) => ['firestore', 'subprocess', 'middleware', 'migration', 'admin', 'config'].includes(t));
    if (m?.kind === 'system' && uiHandler && !infra) {
      return { ...base, decision: 'retype_feature', confidence: 'low', decision_reason: 'Inspection surfaced user-interface handler behavior; type corrected to feature with recorded evidence.' };
    }
    if (m?.kind === 'feature' && infra && !uiHandler) {
      return { ...base, decision: 'retype_system', confidence: 'low', decision_reason: 'Inspection surfaced infrastructure behavior; type corrected to system with recorded evidence.' };
    }
    return { ...base, decision: 'keep_type', confidence: 'low', decision_reason: 'Inspection found no decisive type evidence; the recorded type stands.' };
  }

  // resolve_or_keep
  return {
    ...base,
    decision: 'keep_ambiguous',
    confidence: 'low',
    decision_reason: 'Inspection did not produce decisive evidence; ambiguity preserved. Resolution would require: a capability-class label or a decisive behavioral signature in the subject files.',
    would_resolve_with: 'capability-class UI string in the subject files, or a decisive behavioral signature (handler wiring vs infrastructure behavior)',
  };
}
