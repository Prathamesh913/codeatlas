// CodeAtlas Phase 4B.2 — Evidence Token Profiles
//
// Turns Phase 3/4A/4B.1 evidence into per-file weighted term profiles.
// Semantic boundaries are derived from these evidence affinities — NOT from
// Structural Unit membership (D-012).

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Words too generic to carry semantic meaning.
export const STOP_TERMS = new Set([
  'index', 'test', 'tests', 'spec', 'src', 'lib', 'utils', 'util', 'helper', 'helpers',
  'common', 'shared', 'core', 'main', 'app', 'application', 'file', 'files', 'type',
  'types', 'interface', 'class', 'def', 'self', 'this', 'new', 'get', 'set', 'use',
  'on', 'handle', 'handler', 'props', 'state', 'data', 'item', 'items', 'list',
  'const', 'let', 'var', 'function', 'return', 'import', 'from', 'export', 'default',
  'value', 'values', 'result', 'results', 'error', 'errors', 'code', 'true', 'false',
  'null', 'none', 'undifined', 'and', 'or', 'the', 'for', 'with', 'about', 'into',
  'out', 'all', 'one', 'two', 'public', 'private', 'server', 'client', 'api', 'json',
  'js', 'ts', 'tsx', 'jsx', 'py', 'mjs', 'cjs', 'md', 'my', 'panel',
]);

// Tokens that specifically signal user-facing behavior.
export const USER_VERBS = new Set([
  'save', 'search', 'add', 'create', 'delete', 'remove', 'open', 'submit', 'sign',
  'login', 'logout', 'filter', 'sort', 'share', 'download', 'upload', 'edit',
  'update', 'rename', 'pin', 'like', 'unpin', 'unlike', 'browse', 'view', 'toggle',
  'copy', 'send', 'pick', 'choose', 'close', 'dismiss', 'retry', 'load', 'rescan',
  'scan', 'manage', 'organize', 'sync', 'generate', 'attach', 'launch', 'present',
]);

// Vocabulary that marks infrastructure/state plumbing rather than a user
// capability. Used both for system-leaning resolution and to keep state
// stores from seeding their own standalone regions.
export const PERSISTENCE_TOKENS = new Set([
  'firestore', 'firebase', 'database', 'db', 'cache', 'persist', 'persistence',
  'storage', 'store', 'session', 'token', 'auth', 'admin', 'middleware', 'client',
  'sync', 'migration', 'logging', 'error', 'config', 'settings', 'server',
]);

const WEIGHTS = {
  ui: 4.0, // visible label text — strongest semantic evidence
  behavioral: 3.0, // handlers / API-ish function names
  symbol: 1.2, // declared symbols (reinforce identity, should not outvote the filename)
  filename: 3.5, // a file's own name is its strongest identity claim
  directory: 0.8, // locality is context, not identity
};

/**
 * Collapse trivial inflections so `action`/`actions` and `poster`/`posters` and
 * `liked`/`like` share one term. Deliberately shallow (no real stemmer).
 */
export function stem(term) {
  let t = term;
  if (t.length > 4 && t.endsWith('ies')) t = t.slice(0, -3) + 'y';
  else if (t.length > 4 && t.endsWith('ed')) t = t.slice(0, -1); // liked -> like, saved -> save
  if (t.length > 3 && t.endsWith('us')) return t; // status, focus
  if (t.length > 3 && t.endsWith('ss')) return t;
  if (t.length > 3 && t.endsWith('s')) t = t.slice(0, -1);
  return t;
}

/** Split identifiers (camelCase / snake_case / kebab) into lowercase stemmed terms. */
export function tokenize(name) {
  return String(name)
    .replace(/\.[A-Za-z0-9]+$/, '') // extension
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .map((t) => stem(t.toLowerCase()))
    .filter((t) => t.length >= 3 && !/^\d+$/.test(t) && !STOP_TERMS.has(t));
}

function addTerms(map, terms, weight) {
  for (const t of terms) map.set(t, (map.get(t) || 0) + weight);
}

/**
 * Build weighted term profiles for every file, from:
 *  - filename + directory tokens
 *  - declared symbols (available for ALL files via Phase 3)
 *  - Phase 4B.1 clues (UI / behavioral), available for inspected files only
 */
export function buildProfiles(graph, candidates) {
  const profiles = new Map(); // file -> Map(term -> weight)
  const df = new Map(); // term -> number of files containing it
  const uiTerms = new Map(); // file -> Set(term) seen in user-visible text
  const nameTerms = new Map(); // file -> Set(term) taken from its OWN filename

  const clueTermsByFile = new Map(); // file -> [{terms, kind}]
  const conceptTerms = new Set();
  for (const cand of candidates || []) {
    for (const insp of cand.inspected_files || []) {
      const list = clueTermsByFile.get(insp.file) || [];
      for (const clue of insp.clues || []) {
        if (clue.type === 'ui') {
          const terms = tokenize(clue.raw || '');
          list.push({ terms, kind: 'ui' });
          for (const t of terms) conceptTerms.add(t);
        } else if (clue.type === 'behavioral' && clue.raw) {
          const terms = tokenize(clue.raw);
          list.push({ terms, kind: 'behavioral' });
          for (const t of terms) conceptTerms.add(t);
        }
        // naming clues intentionally contribute at filename weight only (once)
      }
      clueTermsByFile.set(insp.file, list);
    }
  }

  for (const node of graph.nodes) {
    if (node.kind !== 'file') continue;
    if (!node.language) continue;
    const prof = new Map();
    const seen = new Set();

    const parts = node.id.split('/');
    const base = parts[parts.length - 1];
    const dirs = parts.slice(0, -1);

    const own = tokenize(base).filter((t) => !seen.has(t) && seen.add(t));
    addTerms(prof, own, WEIGHTS.filename);
    for (const t of own) conceptTerms.add(t);
    for (const d of dirs) {
      const dt = tokenize(d);
      addTerms(prof, dt, WEIGHTS.directory);
    }
    for (const sym of node.declares || []) {
      const st = tokenize(sym);
      addTerms(prof, st, WEIGHTS.symbol);
      for (const t of st) conceptTerms.add(t);
    }

    const uiSet = new Set();
    for (const entry of clueTermsByFile.get(node.id) || []) {
      addTerms(prof, entry.terms, WEIGHTS[entry.kind] || WEIGHTS.symbol);
      if (entry.kind === 'ui') for (const t of entry.terms) uiSet.add(t);
    }

    if (prof.size) {
      profiles.set(node.id, prof);
      if (own.length) nameTerms.set(node.id, new Set(own));
      if (uiSet.size) uiTerms.set(node.id, uiSet);
      for (const t of prof.keys()) df.set(t, (df.get(t) || 0) + 1);
    }
  }

  return { profiles, df, uiTerms, nameTerms, conceptTerms };
}

/** Inverse-document-frequency so generic terms (poster in a poster app) don't dominate. */
export function idf(term, df, totalFiles) {
  const d = df.get(term) || 1;
  return Math.log(1 + totalFiles / d);
}

/**
 * TF-IDF-style affinity of a file to a term, normalized by file profile mass.
 * Returns a sorted list of [term, score] (deterministic: score desc, term asc).
 */
export function affinities(profile, df, totalFiles) {
  let mass = 0;
  for (const w of profile.values()) mass += w;
  if (!mass) return [];
  const out = [];
  for (const [term, w] of profile) {
    out.push([term, (w / mass) * idf(term, df, totalFiles)]);
  }
  out.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  return out;
}
