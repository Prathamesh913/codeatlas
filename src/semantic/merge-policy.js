// CodeAtlas — Merge / clustering evidence policy (No Misleading Canonical Map)
//
// Decides whether two candidate entities (or files) may be merged into one
// semantic identity. Deterministic, explainable, conservative.
//
// Evidence hierarchy (strongest first):
//   L1 exact normalized-name match      — identical full compound names
//      (e.g. `checklistConfigMappings` === `checklistConfigMappings`).
//   L2 explicit alias match             — a recorded alias of A equals the
//      canonical name/alias of B.
//   L3 shared route/domain evidence     — the same capability-class string or
//      user-action verb + domain noun realized in both participants (S1/S1b).
//   L4 strong structural evidence       — a direct application-file import edge
//      whose endpoint files share discriminative domain vocabulary (S5), or
//      >= 2 shared discriminative domain terms exclusive to the pair (S3).
//
// A shared generic affix is NEVER sufficient: one common weak token
// (`config`, `validation`, `detail`, `master`, ...) does not merge, and a
// substring/containment match (`config` inside `locationTypeConfig`) does not
// merge. When evidence is insufficient the entities stay separate or
// unresolved — never speculatively merged.

import { stem } from './tokens.js';

/**
 * Tokens too generic to carry semantic identity on their own. A shared weak
 * token is weak evidence (AM1-class) unless accompanied by stronger evidence
 * (L1–L4). Compound names containing them (locationTypeConfig,
 * checklistConfigMappings, scoringMaster, areaCategorySubcategory) keep
 * their full compound identity; the weak affix alone never identifies them.
 */
export const WEAK_TOKENS = new Set([
  'config', 'configuration', 'detail', 'details', 'master', 'service',
  'controller', 'router', 'route', 'routes', 'manager', 'helper', 'helpers',
  'utility', 'utilities', 'util', 'utils', 'validation', 'validator',
  'validate', 'common', 'base', 'data', 'model', 'models', 'handler',
  'handlers', 'context', 'provider', 'wrapper', 'adapter', 'registry',
  'module', 'package', 'internal', 'impl', 'constant', 'constants', 'generic',
  'misc', 'component', 'hook', 'hooks', 'page', 'pages', 'view', 'views',
  'schema', 'schemas', 'user', 'users', 'type', 'types', 'item', 'items',
  'list', 'index', 'main', 'app', 'shared', 'core', 'lib', 'src',
]);

/** True when the token is generic plumbing/structural vocabulary. */
export function isWeakToken(term) {
  return WEAK_TOKENS.has(stem(String(term).toLowerCase()));
}

/** Normalize one identifier into stemmed tokens. */
export function normalizedTokens(name) {
  return String(name)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .map((t) => stem(t.toLowerCase()))
    .filter((t) => t.length >= 2);
}

/**
 * True when the ONLY resemblance between two names is substring/token
 * containment involving a weak token — e.g. `config` ⊂ `locationTypeConfig`,
 * or both names merely sharing the suffix `validation`. Such pairs must not
 * merge without L1–L4 evidence.
 */
export function isSubstringOnlyMatch(a, b) {
  const ta = normalizedTokens(a);
  const tb = normalizedTokens(b);
  if (!ta.length || !tb.length) return true;
  const setA = new Set(ta);
  const setB = new Set(tb);
  const shared = ta.filter((t) => setB.has(t));
  if (!shared.length) {
    // Fall back to raw substring: one normalized name containing the other.
    const na = ta.join('');
    const nb = tb.join('');
    if (na.includes(nb) || nb.includes(na)) return true;
    return false;
  }
  // Shared tokens exist: substring-only when every shared token is weak and
  // the full compound names differ.
  const strongShared = shared.filter((t) => !isWeakToken(t));
  if (strongShared.length > 0) return false;
  return ta.join('|') !== tb.join('|');
}

/**
 * Merge policy decision.
 *
 * @param {object} args
 * @param {string} args.aName
 * @param {string} args.bName
 * @param {object} args.evidence { exactNameMatch, aliasMatch, sharedDomainTerms,
 *   sharedCapabilityString, sharedUserAction, structuralEdgeWithSharedVocab }
 * @returns {{ merge: boolean, level: string|null, reason: string }}
 */
export function mayMerge({ aName = '', bName = '', evidence = {} }) {
  const {
    exactNameMatch = false,
    aliasMatch = false,
    sharedDomainTerms = [],
    sharedCapabilityString = false,
    sharedUserAction = false,
    structuralEdgeWithSharedVocab = false,
  } = evidence;
  if (exactNameMatch) {
    return { merge: true, level: 'L1', reason: 'exact normalized-name match' };
  }
  if (aliasMatch) {
    return { merge: true, level: 'L2', reason: 'explicit alias match' };
  }
  if (sharedCapabilityString || sharedUserAction) {
    return { merge: true, level: 'L3', reason: 'shared route/domain evidence (capability string or user action on one domain object)' };
  }
  const strongTerms = (sharedDomainTerms || []).filter((t) => !isWeakToken(t));
  if (structuralEdgeWithSharedVocab && strongTerms.length >= 1) {
    return { merge: true, level: 'L4', reason: `direct structural edge with shared discriminative vocabulary (${strongTerms.slice().sort().join(', ')})` };
  }
  if (strongTerms.length >= 2) {
    return { merge: true, level: 'L4', reason: `>= 2 shared discriminative domain terms exclusive to the pair (${strongTerms.slice().sort().join(', ')})` };
  }
  if (isSubstringOnlyMatch(aName, bName)) {
    return { merge: false, level: null, reason: `substring/weak-token resemblance only between "${aName}" and "${bName}" — generic affix similarity is not identity` };
  }
  return { merge: false, level: null, reason: 'insufficient evidence: no exact/alias/route-domain/structural signal; entities stay separate or unresolved' };
}
