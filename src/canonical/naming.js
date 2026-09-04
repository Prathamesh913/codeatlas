// CodeAtlas Phase 4C.3 — Tiered Naming Authority (workstream A)
//
// Deterministic naming policy over consolidated canonical entities. Evidence
// tiers (D-014, refined for naming):
//
//   Tier 1 — user-facing behavioral language: capability-class strings
//            (real UI labels/actions). For features, a label that carries a
//            user action verb plus a domain noun yields the strongest name
//            ("Search Posters" from "Search posters, artists, tags…").
//   Tier 2 — domain language: the consolidation group's recorded shared
//            vocabulary and discriminative context-class terms.
//   Tier 3 — architectural language: behavioral evidence (clues/symbols)
//            that is discriminative repository-wide.
//   Tier 4 — implementation language: filenames, technical symbols.
//
// Higher tiers outrank lower tiers. Technical names are never discarded:
// they survive as aliases + `implementation_terms`, and every rename is
// recorded with selected/rejected candidates (`naming_evidence`).
//
// Guards: a candidate must be discriminative repository-wide (df <= naming
// threshold) and must not be generic, plumbing, or vendor vocabulary. For
// naming the threshold is deliberately looser than the merge threshold: the
// subject noun of an application ("poster" in a poster gallery) is a valid
// canonical name even when frequent.

import { tokenize, USER_VERBS } from '../semantic/tokens.js';
import { GENERIC_TERMS, PLUMBING_VERBS, VENDOR_TERMS } from '../consolidate/rules.js';

const EXCLUDED = new Set([
  ...GENERIC_TERMS, ...PLUMBING_VERBS, ...VENDOR_TERMS,
  // Additional vendor/brand names that must never become canonical names.
  'google', 'github', 'twitter', 'figma', 'unsplash', 'stripe', 'vercel',
  // Words that describe the map, not the capability.
  'entity', 'area', 'feature', 'system', 'implementation', 'module', 'component',
]);

export function namingDfMax(appFileCount) {
  return Math.max(5, Math.ceil(0.35 * Math.max(1, appFileCount)));
}

// Function words and process words are never identity material.
const FUNCTION_WORDS = new Set(['another', 'your', 'here', 'this', 'that', 'more', 'all', 'any', 'new', 'other', 'back', 'next']);
const isGerund = (t) => t.length > 5 && t.endsWith('ing');

function titleCase(term) {
  return String(term)
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const isVerb = (t) => USER_VERBS.has(t) || PLUMBING_VERBS.has(t);

/**
 * Derive the canonical name for one entity.
 *
 * @param {object} model annotation-grounded entity model (consolidate rules shape)
 * @param {object} ctx   { df, dfMax, groupSharedTerms, currentName, kind }
 */
export function deriveName(model, ctx) {
  const { df, dfMax, groupSharedTerms = [], currentName, kind } = ctx;
  const vocab = model.vocab instanceof Set ? model.vocab : new Set(model.vocab || []);
  const capStrings = model.strings?.capability || [];
  const ctxStrings = model.strings?.context || [];
  const candidates = [];
  const rejected = [];

  const nameOk = (t) => !isVerb(t) && !EXCLUDED.has(t) && !FUNCTION_WORDS.has(t) && !isGerund(t) && t.length >= 3;

  // --- Tier 1: capability-class strings --------------------------------
  const seedTokens = model.seedTokens || [...new Set(tokenize(model.seedTerm))];
  const t1Counts = new Map();
  for (const s of capStrings) {
    for (const t of tokenize(s.value)) {
      if (!nameOk(t)) continue;
      t1Counts.set(t, (t1Counts.get(t) || 0) + 1);
    }
  }
  // A capability label with a user action verb + a domain noun is the
  // strongest possible feature name ("Search Posters") — when the label is
  // this entity's OWN distinctive control. A label shared across entities
  // (a common CTA like "Browse Posters" on every page) may only retitle an
  // entity whose own seed vocabulary the label echoes.
  const seedRelated = (toks) => toks.some((t) => seedTokens.includes(t));
  const labelExclusive = (label) => (ctx.labelCounts?.get(label.trim().toLowerCase()) || 0) === 1;
  let t1Phrase = null;
  for (const s of capStrings) {
    const toks = tokenize(s.value);
    if (!seedRelated(toks) && !labelExclusive(s.value)) continue;
    const verb = toks.find((t) => USER_VERBS.has(t));
    const seedNoun = toks.find((t) => nameOk(t) && seedTokens.includes(t) && (df.get(t) || 0) <= dfMax);
    const noun = seedNoun || toks.find((t) => nameOk(t) && (df.get(t) || 0) <= dfMax);
    if (verb && noun) { t1Phrase = { verb, noun, label: s.value }; break; }
  }
  for (const [t, n] of t1Counts) {
    if (!seedRelated([t]) && !labelExclusive(capStrings.find((s) => tokenize(s.value).includes(t))?.value || '')) continue;
    if ((df.get(t) || 0) > dfMax) {
      rejected.push({ name: titleCase(t), tier: 1, reason: `term occurs in ${df.get(t)} application files (over the discriminative bound ${dfMax})` });
      continue;
    }
    candidates.push({ tier: 1, term: t, basis: 'capability_string', weight: 50 + n * 10 - (df.get(t) || 0) });
  }
  if (t1Phrase) {
    candidates.push({ tier: 1, term: `${t1Phrase.verb} ${t1Phrase.noun}`, basis: 'capability_label', weight: 200, phrase: t1Phrase });
  }

  // --- Tier 2: the consolidation group's shared vocabulary only ----------
  // Context strings are naming SUPPORT (aliases/keywords) but not rename
  // material: single-entity page furniture ("Privacy Policy" in a footer)
  // must not retitle an entity.
  const t2Counts = new Map();
  for (const t of groupSharedTerms) {
    if (!nameOk(t)) continue;
    t2Counts.set(t, (t2Counts.get(t) || 0) + 2);
  }
  for (const [t, n] of t2Counts) {
    // A context term must be repeated within the entity or recorded as the
    // group's shared vocabulary — one incidental page label ("Privacy
    // Policy" in a login page footer) is furniture, not identity.
    const repeated = n >= 2 || groupSharedTerms.includes(t);
    if (!repeated) continue;
    if ((df.get(t) || 0) > dfMax) {
      rejected.push({ name: titleCase(t), tier: 2, reason: `term occurs in ${df.get(t)} application files (over the discriminative bound ${dfMax})` });
      continue;
    }
    candidates.push({ tier: 2, term: t, basis: groupSharedTerms.includes(t) ? 'consolidation_shared_vocabulary' : 'domain_vocabulary', weight: 30 + n * 5 - (df.get(t) || 0) });
  }

  // --- Tier 3: behavioral vocabulary → alias material, never names -------
  // Behavioral/symbol terms (even user-plausible ones) proved to churn
  // canonical names ('Keep', 'Prev', 'Cache'); they are recorded as
  // implementation_terms/keywords instead of driving renames.

  // --- Tier 4: implementation language (the recorded identity) ----------
  candidates.push({ tier: 4, term: model.seedTerm, basis: 'technical_vocabulary_only', weight: 0 });

  candidates.sort((x, y) => x.tier - y.tier || y.weight - x.weight || (x.term < y.term ? -1 : 1));
  const usedNames = ctx.usedNames || new Set();

  const best = candidates.find((c) => {
    if (c.tier === 4) return true; // the recorded identity is always allowed
    const candidate = c.phrase ? titleCase(c.phrase.verb + ' ' + c.phrase.noun) : titleCase(c.term);
    return !usedNames.has(candidate.toLowerCase());
  }) || candidates[candidates.length - 1];

  let name;
  let tier;
  let basis;
  if (!best || best.tier === 4) {
    name = currentName || titleCase(model.seedTerm);
    tier = 4;
    basis = 'technical_vocabulary_only';
    for (const c of candidates.filter((x) => x.tier < 4).slice(0, 3)) {
      rejected.push({ name: titleCase(c.term), tier: c.tier, reason: 'no Tier 1-3 candidate is discriminative and user-plausible enough to replace the recorded identity' });
    }
  } else if (best.phrase) {
    name = titleCase(`${best.phrase.verb} ${best.phrase.noun}`);
    tier = best.tier;
    basis = best.basis;
  } else {
    name = titleCase(best.term);
    tier = best.tier;
    basis = best.basis;
  }

  const aliases = new Set();
  if (currentName && currentName.toLowerCase() !== name.toLowerCase()) aliases.add(currentName);
  for (const a of model.entity?.aliases || []) {
    if (a && a.toLowerCase() !== name.toLowerCase()) aliases.add(a);
  }
  const implementation_terms = [...new Set([
    model.seedTerm.replace(/-/g, ' '),
    ...(model.entity?.keywords || []),
    ...(model.entity?.naming_conflict ? [model.entity.naming_conflict.seed_term.replace(/-/g, ' ')] : []),
  ])].filter((t) => t.toLowerCase() !== name.toLowerCase()).slice(0, 6);

  return {
    name,
    tier,
    basis,
    selected: best && best.tier < 4 ? { term: best.term, tier: best.tier, basis: best.basis } : { term: model.seedTerm, tier: 4, basis: 'technical_vocabulary_only' },
    rejected,
    aliases: [...aliases].slice(0, 6),
    implementation_terms,
    changed: currentName ? currentName.toLowerCase() !== name.toLowerCase() : false,
  };
}
