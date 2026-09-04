// CodeAtlas Phase 4C.2 — Consolidation Rules
//
// Deterministic, evidence-typed rules that turn 4B.2 canonical output +
// annotation (4C.1B) + structural graph into consolidation decisions
// (D-013): demotions, separations, merges, non-merges — each with recorded
// evidence. Nothing here reads repository source; every signal comes from
// produced artifacts, with the annotation layer as the single classification
// authority (D-016, D-017).
//
// Evidence classes (grounded in tests/PHASE_4C_ARCHITECTURE_PROPOSAL.md §4):
//   S1  identical capability-class string realized in both participants
//   S1b same user-action verb (USER_VERBS) in capability strings of both
//   S5  direct application-file import edge + shared discriminative domain
//       term in both endpoint files' own vocabulary
//   S3  >= 2 shared discriminative domain terms
//   AM1 shared vocabulary is generic only          (anti-merge)
//   AM2 relation explained only by noise-class files (anti-merge)
//   AM3 persistence-service shape without domain interaction (anti-merge)

import { tokenize, stem, USER_VERBS, PERSISTENCE_TOKENS, STOP_TERMS } from '../semantic/tokens.js';

/** Vocabulary that can never carry a merge on its own (§4 weak evidence). */
export const GENERIC_TERMS = new Set([
  'service', 'context', 'config', 'manager', 'provider', 'wrapper', 'adapter',
  'registry', 'module', 'package', 'internal', 'impl', 'base', 'constant',
  'constant', 'generic', 'misc', 'component', 'hook', 'hooks', 'page', 'route',
  'view', 'model', 'schema', 'user',
]);

/** Action/plumbing verbs that describe behavior, never identity (§4 weak). */
export const PLUMBING_VERBS = new Set([
  ...USER_VERBS,
  'read', 'write', 'idle', 'fetch', 'query', 'render', 'parse', 'format',
  'validate', 'reset', 'init', 'initialize', 'register', 'subscribe', 'emit',
  'mount', 'dispatch', 'invoke', 'execute', 'resolve', 'serialize', 'deserialize',
  'action', 'actions', 'reducer', 'selector',
]);

/** Vendor/framework names are plumbing vocabulary, not domain identity. */
export const VENDOR_TERMS = new Set([
  'firebase', 'firestore', 'react', 'tanstack', 'vite', 'vercel', 'github',
  'postgres', 'redis', 'sonner', 'lucide',
]);

const EXCLUDED_MERGE_TERMS = new Set([...GENERIC_TERMS, ...PLUMBING_VERBS, ...VENDOR_TERMS]);

/**
 * Resolve an alias-style external target ('ext:@/components/FilterBar')
 * against the file inventory by unique suffix match ('@/x' commonly maps to
 * 'src/x'). Returns the inventory path, or null when ambiguous or absent.
 */
export function resolveAliasTarget(extId, inventoryPaths) {
  const raw = String(extId).replace(/^ext:/, '');
  const candidate = raw.replace(/^@\//, '').replace(/^\.\//, '');
  if (!candidate || candidate.includes('*')) return null;
  const base = candidate.replace(/\.(js|ts|tsx|jsx|mjs|cjs|py|json)$/i, '');
  const exts = ['tsx', 'ts', 'jsx', 'js', 'mjs', 'cjs', 'py', 'json'];
  const candidates = [candidate, ...exts.map((x) => `${base}.${x}`), ...exts.map((x) => `${base}/index.${x}`), `${base}/__init__.py`];
  const matches = inventoryPaths.filter(
    (p) => candidates.includes(p) || candidates.some((c) => p.endsWith(`/${c}`))
  );
  return matches.length === 1 ? matches[0] : null;
}

/** A term is discriminative when it occurs in few application files. */
export function dfMaxFor(appFileCount) {
  return Math.max(3, Math.ceil(0.15 * Math.max(1, appFileCount)));
}

/**
 * Route/module-shaped strings ('/login', 'firebase/app', './util') are
 * structural references (Tier 4 context), not text that pollutes identity.
 */
export function isPathShaped(value) {
  const v = String(value).trim();
  if (/\s/.test(v)) return false;
  return v.startsWith('/') || v.startsWith('@') || v.startsWith('./') || v.startsWith('../') || v.includes('/') || /^[\w-]+\.(js|ts|tsx|jsx|mjs|cjs|py|json)$/.test(v);
}

const CONF_RANK = { high: 3, medium: 2, low: 1, unknown: 0 };

function normalizeLabel(v) {
  return String(v).trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Build the annotation-grounded model of one canonical entity.
 * All string evidence comes from annotation/strings.json (classes), all file
 * evidence from annotation/files.json (relevance classes), all behavioral
 * evidence from the 4B.1 clue index, all symbols from the 4A graph.
 */
export function buildEntityModel(entity, kind, ctx) {
  const { relevanceByFile, stringsByFile, cluesByFile, graphNodes, regionById, df, dfMax } = ctx;
  const files = [...(entity.primary_files || [])].sort();
  const supporting = [...(entity.supporting_files || [])].sort();

  const classOf = (f) => relevanceByFile.get(f)?.relevance_class || 'application';
  const appFiles = files.filter((f) => classOf(f) === 'application');
  const suppFiles = files.filter((f) => classOf(f) === 'supporting');
  const noiseFiles = files.filter((f) => !['application', 'supporting'].includes(classOf(f)))
    .map((f) => ({ file: f, relevance_class: classOf(f) }));
  const supportingKept = supporting.filter((f) => ['application', 'supporting'].includes(classOf(f)));
  const supportingNoise = supporting.filter((f) => !['application', 'supporting'].includes(classOf(f)))
    .map((f) => ({ file: f, relevance_class: classOf(f) }));

  const ownFiles = [...appFiles, ...suppFiles];
  const strings = { capability: [], context: [], state: [], incidental: [] };
  for (const f of ownFiles) {
    for (const s of stringsByFile.get(f) || []) {
      if (strings[s.classification]) strings[s.classification].push({ value: s.value, file: f, line: s.line, reason: s.reason });
    }
  }

  const behaviorClues = [];
  for (const f of ownFiles) {
    for (const c of cluesByFile.get(f) || []) {
      if (c.type === 'behavioral' && c.evidence_type !== 'comment') behaviorClues.push({ file: f, observed: c.observed, raw: c.raw || '' });
    }
  }

  const symbols = [];
  for (const f of appFiles) {
    const node = graphNodes.get(f);
    for (const sym of node?.declares || []) symbols.push({ file: f, symbol: sym });
  }

  const region = entity.region_id ? regionById.get(entity.region_id) : null;
  // The canonical identity is 4B.2's RESOLVED term (the id slug), which the
  // naming guard may have corrected away from the carving term (notion.ts).
  const seedTerm =
    entity.id.replace(/^(feature|system|ambiguous|unresolved)-/, '').replace(/-\d+$/, '') ||
    region?.term ||
    'misc';

  // Vocabulary: capability-string tokens + symbols + behavior (user-facing
  // and identity material). Context strings are naming material only, so they
  // feed seed support but not merge vocabulary — nav links and section labels
  // would otherwise bridge unrelated capabilities.
  const vocab = new Set();
  const capabilityTokens = new Set();
  const identityTokens = new Set(); // capability strings + symbols — merge-grade
  const contextTokens = new Set();
  for (const s of strings.capability) for (const t of tokenize(s.value)) { vocab.add(t); capabilityTokens.add(t); identityTokens.add(t); }
  for (const s of strings.context) for (const t of tokenize(s.value)) { vocab.add(t); contextTokens.add(t); }
  for (const sym of symbols) for (const t of tokenize(sym.symbol)) { vocab.add(t); identityTokens.add(t); }
  for (const b of behaviorClues) for (const t of tokenize(b.raw)) vocab.add(t);

  // Seed-term support by evidence class (stem-matched, per identity token —
  // ids like `error-response` carry two identity tokens).
  const seedTokens = [...new Set(tokenize(seedTerm))];  const seedSupport = { capability: 0, context: 0, behavior: 0, symbol: 0, state: 0, incidental: 0 };
  const tokHas = (text) => seedTokens.some((st) => tokenize(text).includes(st));
  for (const s of strings.capability) if (tokHas(s.value)) seedSupport.capability++;
  for (const s of strings.context) if (tokHas(s.value)) seedSupport.context++;
  for (const s of strings.state) if (tokHas(s.value) && !isPathShaped(s.value)) seedSupport.state++;
  for (const s of strings.incidental) if (tokHas(s.value) && !isPathShaped(s.value)) seedSupport.incidental++;
  for (const b of behaviorClues) if (tokHas(b.raw)) seedSupport.behavior++;
  for (const sym of symbols) if (tokHas(sym.symbol)) seedSupport.symbol++;

  // Per-file identity vocabulary (for S5 endpoint checks): capability-string
  // tokens + declared symbols. Context strings are excluded — nav links would
  // bridge unrelated capabilities through shared section vocabulary.
  const fileVocab = new Map();
  for (const f of ownFiles) {
    const set = new Set();
    const node = graphNodes.get(f);
    for (const sym of node?.declares || []) for (const t of tokenize(sym)) set.add(t);
    for (const s of stringsByFile.get(f) || []) {
      if (s.classification === 'capability') {
        for (const t of tokenize(s.value)) set.add(t);
      }
    }
    fileVocab.set(f, set);
  }

  // Merge-grade discriminative terms: capability/symbol vocabulary only,
  // minus plumbing verbs, vendor names, and generic vocabulary — shared
  // actions and shared frameworks are not shared identity (§4 weak evidence).
  const identityTerms = new Set(
    [...identityTokens].filter((t) => !EXCLUDED_MERGE_TERMS.has(t) && (df.get(t) || 0) <= dfMax)
  );
  const discriminativeTerms = identityTerms;

  // A member whose vocabulary is dominated by persistence/generic plumbing.
  const allTokens = [...vocab];
  const infraShare = allTokens.length
    ? allTokens.filter((t) => PERSISTENCE_TOKENS.has(t) || GENERIC_TERMS.has(t) || STOP_TERMS.has(t)).length / allTokens.length
    : 0;
  const infraDominated = strings.capability.length === 0 && infraShare >= 0.6;

  // Seed legality (D-016 / D-014): capability text may seed; state and
  // incidental text never may; a naming-seeded identity is legal only with
  // corroborating context/behavior evidence. An identity token that occurs
  // ONLY inside state/incidental strings was necessarily seeded by them.
  const seedStateOnly =
    seedSupport.state + seedSupport.incidental > 0 &&
    seedSupport.capability + seedSupport.context + seedSupport.behavior + seedSupport.symbol === 0;

  const hasUserVerbInContext = [...contextTokens].some((t) => USER_VERBS.has(t));
  const seedLegal =
    strings.capability.length > 0 ||
    behaviorClues.length > 0 ||
    hasUserVerbInContext ||
    (seedSupport.context + seedSupport.symbol + seedSupport.behavior > 0);

  return {
    originalId: entity.id,
    kind,
    status: kind,
    regionId: entity.region_id || null,
    seedTerm,
    confidence: entity.confidence || 'unknown',
    entity,
    files,
    supporting,
    appFiles,
    suppFiles,
    noiseFiles,
    supportingKept,
    supportingNoise,
    strings,
    behaviorClues,
    symbols,
    vocab,
    capabilityTokens,
    contextTokens,
    fileVocab,
    seedTokens,
    seedSupport,
    seedStateOnly,
    seedLegal,
    infraDominated,
    discriminativeTerms,
    labels: new Set(strings.capability.map((s) => normalizeLabel(s.value))),
    userVerbs: [...capabilityTokens].filter((t) => USER_VERBS.has(t)),
    dfMax,
  };
}

/**
 * Demotion rules for canonical entities (task 4C.2 §4 C+D). Demotion never
 * deletes: the entity, its files, and the exact misleading strings are
 * recorded, and its application files stay available as merge fragments.
 */
export function evaluateDemotions(models) {
  const demotions = [];
  for (const m of models) {
    if (m.kind !== 'feature' && m.kind !== 'system') continue; // ambiguity untouched

    if (m.appFiles.length === 0 && m.suppFiles.length === 0 && m.files.length > 0) {
      demotions.push({
        entity: m.originalId,
        kind: m.kind,
        rule: 'D0_non_application_anchor',
        reason: `No application or supporting file anchors this ${m.kind}; every primary file is ${[...new Set(m.noiseFiles.map((n) => n.relevance_class))].join('/')} class (annotation relevance, D-017).`,
        misleading_strings: [],
        fragment_files: [],
      });
      continue;
    }

    if (m.seedStateOnly) {
      const misleading = [
        ...m.strings.state.filter((s) => tokenize(s.value).includes(stem(m.seedTerm))).map((s) => ({ value: s.value, classification: 'state', file: s.file })),
        ...m.strings.incidental.filter((s) => tokenize(s.value).includes(stem(m.seedTerm))).map((s) => ({ value: s.value, classification: 'incidental', file: s.file })),
      ];
      demotions.push({
        entity: m.originalId,
        kind: m.kind,
        rule: 'D1_state_seeded_identity',
        reason: `Identity term "${m.seedTerm}" occurs in this entity's application evidence only inside state/incidental-class strings (seed=false, D-016); state text never seeds an entity.`,
        misleading_strings: misleading,
        fragment_files: m.appFiles,
      });
      continue;
    }

    if (!m.seedLegal) {
      demotions.push({
        entity: m.originalId,
        kind: m.kind,
        rule: 'D3_no_seedable_evidence',
        reason: 'No capability-class string, no behavioral evidence, and no user-action vocabulary: the entity rests on context/incidental text alone, which may name but never seed (D-016).',
        misleading_strings: [
          ...m.strings.context.slice(0, 6).map((s) => ({ value: s.value, classification: 'context', file: s.file })),
          ...m.strings.incidental.slice(0, 3).map((s) => ({ value: s.value, classification: 'incidental', file: s.file })),
        ],
        fragment_files: m.appFiles,
      });
    }
  }

  // D2 — duplicate identity: two same-kind entities sharing one seed term,
  // where one holds seedable evidence (capability/behavior) and the other
  // holds only naming-grade material. The weaker duplicate cannot stand as
  // an independent canonical identity; the stronger keeps it. Entities with
  // their own seedable evidence are distinct capabilities (id minting
  // resolves their name collision instead).
  const byIdentity = new Map();
  for (const m of models) {
    if (m.kind !== 'feature' && m.kind !== 'system') continue;
    if (demotions.some((d) => d.entity === m.originalId)) continue;
    const key = `${m.kind}|${m.seedTerm}`;
    if (!byIdentity.has(key)) byIdentity.set(key, []);
    byIdentity.set(key, [...byIdentity.get(key), m]);
  }
  for (const [, group] of byIdentity) {
    if (group.length < 2) continue;
    const tier = (m) => (m.strings.capability.length > 0 || m.behaviorClues.length > 0 ? 1 : 0);
    const sorted = [...group].sort((a, b) =>
      tier(b) - tier(a) || (CONF_RANK[b.confidence] ?? 0) - (CONF_RANK[a.confidence] ?? 0) ||
      (a.originalId < b.originalId ? -1 : 1));
    const winner = sorted[0];
    for (const loser of sorted.slice(1)) {
      if (tier(loser) > 0) continue; // distinct capabilities — id minting resolves the collision
      demotions.push({
        entity: loser.originalId,
        kind: loser.kind,
        rule: 'D2_duplicate_identity_weaker_evidence',
        reason: `Seed term "${loser.seedTerm}" is already carried by ${winner.originalId}, which holds seedable evidence (capability/behavioral) the duplicate lacks; a context-only duplicate cannot be a second canonical identity (D-016).`,
        misleading_strings: loser.strings.context.slice(0, 6).map((s) => ({ value: s.value, classification: 'context', file: s.file })),
        fragment_files: loser.appFiles,
      });
    }
  }
  return demotions;
}

function componentTerms(files, model) {
  const set = new Set();
  for (const f of files) {
    for (const t of model.fileVocab.get(f) || []) set.add(t);
  }
  return set;
}

/**
 * Separation rule (task 4C.2 §4 B): a canonical entity whose application
 * files form >1 import-connected component, bridged by no shared
 * user-facing vocabulary, conflates distinct responsibilities. The strongest
 * component keeps the identity; others are separated (never deleted).
 */
export function evaluateSplits(model, ctx) {
  const nonSplits = [];
  if (model.kind !== 'feature' && model.kind !== 'system') return { splits: [], nonSplits };
  const nodes = [...model.appFiles, ...model.suppFiles];
  if (nodes.length < 2) return { splits: [], nonSplits };

  // Connected components over application-file import edges (both directions).
  const adj = new Map(nodes.map((f) => [f, new Set()]));
  for (const e of ctx.importEdges) {
    const a = e.from, b = e.to;
    if (adj.has(a) && adj.has(b)) { adj.get(a).add(b); adj.get(b).add(a); }
  }
  const seen = new Set();
  const components = [];
  for (const f of nodes) {
    if (seen.has(f)) continue;
    const comp = [];
    const stack = [f];
    seen.add(f);
    while (stack.length) {
      const cur = stack.pop();
      comp.push(cur);
      for (const n of adj.get(cur) || []) {
        if (!seen.has(n) && adj.has(n)) { seen.add(n); stack.push(n); }
      }
    }
    components.push(comp.sort());
  }
  if (components.length < 2) return { splits: [], nonSplits };

  // Bridge checks — components sharing user-facing domain vocabulary
  // (capability strings / symbols, no df cap — a core domain noun like
  // "poster" legitimately bridges one capability's files), or sharing a
  // filename stem (saved.ts / saved.tsx are one capability's file pair,
  // D-012), serve the same surface and must not be separated. Generic
  // stems ('context' in ContextMenu.tsx vs context.ts) do not bridge.
  const stemTokensOf = (files) =>
    new Set(files.flatMap((f) => {
      const base = f.split('/').pop().replace(/\.[A-Za-z0-9]+$/, '');
      // Filename stems keep action verbs ('saved'/'save' binds saved.ts to
      // saved.tsx); only generic stems ('context') are excluded.
      return tokenize(base).filter((t) => !GENERIC_TERMS.has(t));
    }));
  const termSets = components.map((c) => componentTerms(c, model));
  const stemSets = components.map((c) => stemTokensOf(c));
  for (let i = 0; i < components.length; i++) {
    for (let j = i + 1; j < components.length; j++) {
      const bridge = [...termSets[i]].filter((t) => termSets[j].has(t) && !EXCLUDED_MERGE_TERMS.has(t));
      const stemBridge = [...stemSets[i]].filter((t) => stemSets[j].has(t));
      if (bridge.length || stemBridge.length) {
        nonSplits.push({
          entity: model.originalId,
          components: [components[i], components[j]],
          reason: bridge.length
            ? `Components share user-facing domain vocabulary (${bridge.sort().join(', ')}) — one responsibility, not a conflation.`
            : `Components share a filename stem (${stemBridge.sort().join(', ')}) — one capability's file pair (D-012).`,
        });
        return { splits: [], nonSplits };
      }
    }
  }

  // Rank components: keep the identity with the strongest seed-legal evidence.
  const ranked = components.map((files) => {
    let cap = 0, beh = 0, ctxN = 0;
    for (const f of files) {
      for (const s of ctx.stringsByFile.get(f) || []) {
        if (s.classification === 'capability') cap++;
        else if (s.classification === 'context') ctxN++;
      }
      beh += (ctx.cluesByFile.get(f) || []).filter((c) => c.type === 'behavioral' && c.evidence_type !== 'comment').length;
    }
    return { files, score: cap * 2 + beh + ctxN * 0.5 };
  }).sort((a, b) => b.score - a.score || (a.files[0] < b.files[0] ? -1 : 1));

  const kept = ranked[0];
  const separated = ranked.slice(1).map((c) => ({
    files: c.files,
    status: model.kind === 'system' ? 'system' : 'unresolved',
    reason: `Separated from ${model.originalId}: import-disconnected application files with no shared user-facing vocabulary (conflation split, D-013).`,
  }));
  return { splits: [{ entity: model.originalId, kept: kept.files, separated }], nonSplits };
}

/** Shared discriminative terms between two models. */
function sharedDiscriminative(a, b) {
  return [...a.discriminativeTerms].filter((t) => b.discriminativeTerms.has(t)).sort();
}

/**
 * Merge evaluation (task 4C.2 §4 A, §5). Participants: surviving canonical
 * entities plus demotion/separation fragments. Every evaluated pair is
 * recorded — accepted as merge evidence, or rejected with its anti-merge
 * reason. Insufficient evidence records nothing beyond the non-merge.
 */
export function evaluateMerges(participants, ctx) {
  const accepted = [];
  const nonMerges = [];

  const pairs = [];
  for (let i = 0; i < participants.length; i++) {
    for (let j = i + 1; j < participants.length; j++) {
      pairs.push([participants[i], participants[j]]);
    }
  }
  pairs.sort((x, y) => (x[0].originalId + '|' + x[1].originalId < y[0].originalId + '|' + y[1].originalId ? -1 : 1));

  for (const [a, b] of pairs) {
    if (!a.appFiles.length || !b.appFiles.length) continue;
    const signals = [];

    // S1 — identical capability-class string realized in both participants,
    // AND the shared action is about each participant's own domain (the label
    // intersects both seed vocabularies). A bare shared CTA like "Browse
    // Posters" on two unrelated pages is navigation, not shared identity.
    for (const label of a.labels) {
      if (!b.labels.has(label)) continue;
      const labelTokens = new Set(tokenize(label));
      const aboutA = [...labelTokens].some((t) => a.seedTokens.includes(t));
      const aboutB = [...labelTokens].some((t) => b.seedTokens.includes(t));
      if (aboutA && aboutB) {
        signals.push({ type: 'S1', description: `identical capability string "${label}" realized in both participants, naming both entities' own domain`, files: [] });
        break;
      }
    }
    // S1b — same user action (verb) AND the same domain noun in capability
    // strings of both participants: one action realized on one object.
    if (!signals.length) {
      const capStrings = (m) => m.strings.capability.map((s) => tokenize(s.value));
      let s1b = null;
      outer: for (const at of capStrings(a)) {
        if (!at.some((t) => USER_VERBS.has(t))) continue;
        for (const bt of capStrings(b)) {
          if (!bt.some((t) => USER_VERBS.has(t))) continue;
          const verbs = at.filter((t) => USER_VERBS.has(t) && bt.includes(t));
          const nouns = at.filter((t) => !USER_VERBS.has(t) && bt.includes(t) && !EXCLUDED_MERGE_TERMS.has(t) && (ctx.df.get(t) || 0) <= ctx.dfMax);
          if (verbs.length && nouns.length) {
            s1b = { verbs: [...new Set(verbs)].sort(), nouns: [...new Set(nouns)].sort() };
            break outer;
          }
        }
      }
      if (s1b) {
        signals.push({ type: 'S1b', description: `same user action (${s1b.verbs.join(', ')}) on the same domain object (${s1b.nouns.join(', ')}) in capability strings of both participants`, files: [] });
      }
    }
    // S5 — direct application-file import edge + shared discriminative term
    // in both endpoint files' own vocabulary.
    const edgeEvidence = [];
    for (const e of ctx.importEdges) {
      const { from, to } = e;
      const ab = a.appFiles.includes(from) && b.appFiles.includes(to);
      const ba = a.appFiles.includes(to) && b.appFiles.includes(from);
      if (!ab && !ba) continue;
      const fa = ab ? from : to;
      const fb = ab ? to : from;
      const va = a.fileVocab.get(fa) || new Set();
      const vb = b.fileVocab.get(fb) || new Set();
      // S5 shared terms must be identity material (non-generic, non-plumbing,
      // non-vendor). No df cap: the direct edge carries the specificity —
      // this is the proposal's notion.ts → posters.ts evidence class.
      const shared = [...va].filter((t) => vb.has(t) && !EXCLUDED_MERGE_TERMS.has(t));
      if (shared.length) {
        edgeEvidence.push({ edge: e.id, from, to, shared_terms: shared.sort() });
      }
    }
    if (edgeEvidence.length) {
      signals.push({ type: 'S5', description: 'direct application-file import with shared discriminative domain vocabulary at both ends', edges: edgeEvidence });
    }
    // S3 — at least two shared discriminative domain terms EXCLUSIVE to the
    // pair (present in no third participant's vocabulary). Exclusivity is
    // what the proposal means by "unique shared domain vocabulary" and is
    // what keeps single-linkage chains from swallowing a repository.
    const pairShared = sharedDiscriminative(a, b);
    const thirdPartyTerms = new Set();
    for (const other of participants) {
      if (other === a || other === b) continue;
      for (const t of other.discriminativeTerms) thirdPartyTerms.add(t);
    }
    const exclusive = pairShared.filter((t) => !thirdPartyTerms.has(t));
    if (exclusive.length >= 2) {
      signals.push({ type: 'S3', description: 'shared discriminative domain vocabulary exclusive to the pair', terms: exclusive });
    } else if (pairShared.length >= 2) {
      nonMerges.push({ pair: [a.originalId, b.originalId], signals: [{ type: 'S3-weak', terms: pairShared }], veto: 'AM1', reason: 'shared terms also occur in other participants — vocabulary is not exclusive to the pair (§4 S3)' });
    }

    if (!signals.length) continue;

    // Anti-merge checks (§4) — any veto rejects the pair.
    const allSharedTerms = new Set(pairShared);
    if (allSharedTerms.size && [...allSharedTerms].every((t) => GENERIC_TERMS.has(t))) {
      nonMerges.push({ pair: [a.originalId, b.originalId], signals, veto: 'AM1', reason: 'shared vocabulary is generic only ("service"/"context"-class words never merge, §4)' });
      continue;
    }
    const noisySide = (m) => m.appFiles.length === 0;
    if (noisySide(a) || noisySide(b)) {
      nonMerges.push({ pair: [a.originalId, b.originalId], signals, veto: 'AM2', reason: 'relation explained only by non-application files (D-017)' });
      continue;
    }
    const s3Only = signals.every((s) => s.type === 'S3');
    if (s3Only && (a.infraDominated || b.infraDominated)) {
      nonMerges.push({ pair: [a.originalId, b.originalId], signals, veto: 'AM3', reason: 'one participant is a persistence/generic service; shared-dependency is not shared responsibility (§4)' });
      continue;
    }
    accepted.push({ pair: [a.originalId, b.originalId], a, b, signals });
  }

  return { accepted, nonMerges };
}
