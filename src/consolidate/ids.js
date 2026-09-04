// CodeAtlas Phase 4C.2 — Deterministic Identity Minting
//
// Canonical entity ids must be (task 4C.2 §7):
//   - deterministic,
//   - unique within their entity type,
//   - stable across identical runs,
//   - independent of array position,
//   - safe when similarly named candidates exist.
//
// 4B.2 disambiguated slug collisions with a positional counter (`-2`, `-3` —
// the `feature-artist-2` artifact). Consolidation replaces that scheme: a
// collision is resolved by appending a short FNV-1a hash of the entity's own
// file set, which is a pure function of entity content, never of order.

/**
 * FNV-1a 32-bit hash, rendered as 6 hex characters.
 * @param {string} str
 * @returns {string}
 */
export function contentHash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0').slice(0, 6);
}

/** Lowercase kebab slug of a term. */
export function slugify(term) {
  return String(term)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'misc';
}

/**
 * Mint a unique, deterministic id for one entity kind.
 *
 * @param {object} opts
 * @param {string} opts.kind       id prefix ('feature' | 'system' | 'unresolved' | 'demoted')
 * @param {string} opts.slug       evidence-derived slug
 * @param {string[]} opts.files    the entity's own file set (hash input)
 * @param {Set<string>} opts.taken ids already issued for this kind
 * @returns {{ id: string, collided: boolean }}
 */
export function mintId({ kind, slug, files, taken }) {
  const base = `${kind}-${slug}`;
  if (!taken.has(base)) {
    taken.add(base);
    return { id: base, collided: false };
  }
  // Position-independent disambiguation: hash of this entity's own file set.
  const key = `${kind}|${slug}|${[...files].sort().join('|')}`;
  let id = `${base}-${contentHash(key)}`;
  // Astronomically unlikely, but keep minting deterministic on repeat clash.
  let n = 2;
  while (taken.has(id)) {
    id = `${base}-${contentHash(`${key}|${n}`)}`;
    n++;
  }
  taken.add(id);
  return { id, collided: true };
}
