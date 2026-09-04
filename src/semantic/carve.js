// CodeAtlas Phase 4B.2 — Semantic Carving
//
// Groups files into Semantic Regions by EVIDENCE AFFINITY (UI vocabulary,
// symbol families, behavior), never by Structural Unit membership.
// A region may be narrower than a unit (split) or span several units (merge).
// D-012: structural boundary != semantic boundary.

import { affinities, tokenize, PERSISTENCE_TOKENS, USER_VERBS } from './tokens.js';

const MIN_DF = 2;
const MIN_AFFINITY = 0.08;
const CONTESTED_RATIO = 0.75;
const MIN_REGION_SIZE = 2;

// Capability words that may name a real Feature/System despite being
// infrastructure-flavored; everything else in PERSISTENCE_TOKENS is treated
// as state plumbing when it is a lone file's only identity.
const CAPABILITY_TERMS = new Set(['session', 'auth', 'sync', 'firestore', 'firebase', 'persist', 'persistence']);

// Generated artifacts (e.g. TanStack `routeTree.gen.ts`, `.d.ts`) are build
// output, never semantic entities. They may still attach as supporting files.
const GENERATED_RE = /(\.gen\.|\.generated\.|\.d\.ts$)/i;
function isGenerated(file) {
  return GENERATED_RE.test(file);
}

// Design-system primitive directories (`components/ui/`, `ui/`) hold shared
// widgets, not user capabilities (Phase 2B finding: UI implementation noise is
// excluded from canonical entities). They may attach as supporting files.
function isUiKit(file) {
  const parts = file.split('/');
  return parts.length >= 2 && parts[parts.length - 2] === 'ui';
}

// Generic widget nouns. A region seeded by one of these is a UI primitive
// cluster, not a user capability; its members are demoted to the supporting
// pool where real features can claim them. Keeps e.g. shadcn-style
// `card`/`toggle`/`modal` clusters from becoming canonical Features.
const PRIMITIVE_TERMS = new Set([
  'card', 'modal', 'dialog', 'grid', 'list', 'bar', 'tab', 'tabs', 'button',
  'menu', 'sidebar', 'toggle', 'alert', 'breadcrumb', 'carousel', 'pagination',
  'avatar', 'badge', 'skeleton', 'tooltip', 'slider', 'popover', 'sheet',
  'drawer', 'checkbox', 'radio', 'switch', 'separator', 'scroll', 'spinner',
]);

function isDocOrTest(file) {
  return (
    file.startsWith('tests/') ||
    file.startsWith('.codeatlas/') ||
    file.includes('/.codeatlas/') ||
    file.startsWith('node_modules/') ||
    file.startsWith('.commandcode/') ||
    file.startsWith('.') // dotfiles like .gitignore, .env
  );
}

export function carveRegions(graph, profiles, df, units, uiTerms = new Map(), nameTerms = new Map(), conceptTerms = new Set()) {
  const totalFiles = profiles.size;
  const maxDf = Math.max(MIN_DF + 1, Math.ceil(totalFiles * 0.7));

  const isConcept = (t) => conceptTerms.size === 0 || conceptTerms.has(t);
  const sharedEligible = new Set(
    [...df.entries()].filter(([t, d]) => isConcept(t) && d >= MIN_DF && d <= maxDf).map(([t]) => t)
  );
  const soloEligible = new Set(
    [...df.entries()].filter(([t, d]) => isConcept(t) && d === 1).map(([t]) => t)
  );

  const inDegree = new Map();
  const outDegree = new Map();
  for (const e of graph.edges) {
    if (e.type !== 'IMPORTS' && e.type !== 'REFERENCES') continue;
    inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1);
    outDegree.set(e.from, (outDegree.get(e.from) || 0) + 1);
  }

  const unitOf = new Map();
  for (const u of units || []) for (const m of u.members) unitOf.set(m, u.id);

  // Assign every file to a seed term — the strongest evidence-backed term whose
  // affinity clears the threshold. Shared-eligible terms form groups; a term
  // seen only in this file may still win when it is the file's own name or
  // its visible UI text (a single-purpose module's identity).
  const assignments = new Map();
  const unassigned = [];
  for (const [file, profile] of [...profiles].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (isDocOrTest(file) || isGenerated(file) || isUiKit(file)) {
      unassigned.push(file);
      continue;
    }
    const node = graph.nodes.find((n) => n.id === file);
    if (!node || !node.language) {
      unassigned.push(file);
      continue;
    }
    const parts = file.split('/');
    const dirTermSet = new Set(parts.slice(0, -1).flatMap((d) => tokenize(d)));
    const fileUi = uiTerms.get(file) || new Set();
    const ownName = nameTerms.get(file) || new Set();
    // Directory tokens describe WHERE a file lives, never WHAT it is (D-012):
    // they stay in the affinity profile but cannot seed a region unless the
    // same term is also carried by the file's own name or visible UI text.
    const eligible = new Set([
      ...[...df.entries()]
        .filter(
          ([t, d]) =>
            isConcept(t) && d >= MIN_DF && d <= maxDf && (!dirTermSet.has(t) || ownName.has(t) || fileUi.has(t))
        )
        .map(([t]) => t),
      ...[...df.entries()]
        .filter(
          ([t, d]) =>
            d === 1 &&
            isConcept(t) &&
            (ownName.has(t) || (fileUi.has(t) && !USER_VERBS.has(t)))
        )
        .map(([t]) => t),
    ]);
    const ranked = affinities(profile, df, totalFiles).filter(([t]) => eligible.has(t));
    if (!ranked.length || ranked[0][1] < MIN_AFFINITY) {
      unassigned.push(file);
      continue;
    }
    const [term, score] = ranked[0];
    const second = ranked.find(([t]) => t !== term);
    const contested = second && second[1] >= CONTESTED_RATIO * score ? second[0] : null;
    assignments.set(file, { term, score, contested });
  }

  const groups = new Map();
  for (const [file, a] of assignments) {
    if (!groups.has(a.term)) groups.set(a.term, []);
    groups.get(a.term).push(file);
  }

  const importers = new Map();
  for (const e of graph.edges) {
    if (e.type !== 'IMPORTS' && e.type !== 'REFERENCES') continue;
    if (!importers.has(e.to)) importers.set(e.to, new Set());
    importers.get(e.to).add(e.from);
  }

  const termCounts = (files) => {
    const c = new Map();
    for (const f of files) {
      const p = profiles.get(f);
      if (!p) continue;
      for (const [t, w] of p) c.set(t, (c.get(t) || 0) + w);
    }
    return [...c.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  };

  const regions = [];
  let seq = 0;
  const droppedSingletonFiles = [];

  const pushRegion = (term, sorted, provisional, opts = {}) => {
    const contested = sorted.filter((f) => assignments.get(f)?.contested);
    const sourceUnits = [...new Set(sorted.map((f) => unitOf.get(f)).filter(Boolean))].sort();
    const topTerms = termCounts(sorted).slice(0, 8).map(([t]) => t);
    const userVerbs = topTerms.filter((t) => USER_VERBS.has(t));
    regions.push({
      id: `region-${String(++seq).padStart(3, '0')}`,
      term,
      hypothesis: opts.hypothesis || `Evidence clusters around the concept "${term}".`,
      source_structural_units: opts.sourceUnits || sourceUnits,
      spans_multiple_units: opts.spansMultipleUnits ?? sourceUnits.length > 1,
      primary_files: sorted,
      supporting_files: [],
      boundary_evidence: {
        seed_term: opts.seedTerm || term,
        members: sorted.map((f) => ({
          file: f,
          affinity: Number((assignments.get(f)?.score || 0).toFixed(4)),
          contested_with: assignments.get(f)?.contested || null,
        })),
        contested_files: contested,
        shared_by_regions: opts.sharedByRegions || 0,
        ...(opts.hostRegionIds ? { host_region_ids: opts.hostRegionIds } : {}),
        top_terms: topTerms,
        user_verbs: userVerbs,
      },
      imported_by_regions: opts.hostRegionIds || [],
      imports_from_regions: [],
      imported_edges: [],
      is_shared_infrastructure: !!opts.infra,
      is_provisional: provisional,
      _files: new Set(sorted),
      _regionsImportingThis: new Set(opts.hostRegionIds || []),
      _importedRegions: new Set(),
    });
  };

  // Pass 1 — multi-file evidence groups become regions.
  for (const [term, files] of [...groups].sort((a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1))) {
    const sorted = files.slice().sort();
    if (sorted.length < MIN_REGION_SIZE) continue;
    // Widget-noun regions are UI primitive clusters, not capabilities: demote
    // their members to the supporting pool (real features may claim them).
    if (PRIMITIVE_TERMS.has(term)) {
      droppedSingletonFiles.push(...sorted);
      continue;
    }
    pushRegion(term, sorted, false);
  }

  const fileToRegion = new Map();
  for (const r of regions) for (const f of r.primary_files) fileToRegion.set(f, r.id);

  // Pass 2 — lone files. A singleton becomes a provisional region only when
  // it is NOT better explained as shared infrastructure, carries its own
  // name-identity, declares symbols, and is wired into the graph. resolveRegion
  // then decides via bounded inspection: canonical entity or unresolved.
  const isInfraShaped = (f) => {
    const set = importers.get(f) || new Set();
    const hostRegions = new Set([...set].map((x) => fileToRegion.get(x)).filter(Boolean));
    return set.size >= 3 && hostRegions.size >= 2 ? { importers: set.size, hostRegions } : null;
  };
  for (const [term, files] of [...groups].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (files.length >= MIN_REGION_SIZE) continue;
    const f = files[0];
    if (PRIMITIVE_TERMS.has(term)) {
      droppedSingletonFiles.push(f);
      continue;
    }
    if (isInfraShaped(f)) {
      droppedSingletonFiles.push(f);
      continue;
    }
    const hasUiEvidence = (uiTerms.get(f) || new Set()).size > 0;
    if (!hasUiEvidence) {
      const node = graph.nodes.find((n) => n.id === f);
      const nameOwned = (nameTerms.get(f) || new Set()).has(term);
      const wired = (inDegree.get(f) || 0) > 0 || (outDegree.get(f) || 0) > 0;
      const substantive = (node?.declares?.length || 0) >= 1;
      // State-store modules (store, cache, config, …) support the feature
      // that owns them — they never stand alone on their own name. Capability
      // words (session, auth, sync, persistence) are excluded from this rule.
      const plumbingWord = PERSISTENCE_TOKENS.has(term) && !CAPABILITY_TERMS.has(term);
      if (!(nameOwned && wired && substantive) || plumbingWord) {
        // Second chance: if the shared term collapsed to a lone file but the
        // file carries a DIFFERENT own-name identity, re-seed under that name
        // (same wiring/substantive/plumbing requirements). Keeps e.g.
        // discovery.py alive when "scan" clustered it with nothing else.
        // If an existing region's members already claim that identity, the
        // file belongs there as support — not as a duplicate entity.
        const identityClaimed = (t) =>
          regions.some(
            (r) => r.term === t || r.primary_files.some((m) => (nameTerms.get(m) || new Set()).has(t))
          );
        const fallback = [...(nameTerms.get(f) || new Set())].find(
          (t) =>
            t !== term &&
            !PRIMITIVE_TERMS.has(t) &&
            !(PERSISTENCE_TOKENS.has(t) && !CAPABILITY_TERMS.has(t)) &&
            !identityClaimed(t)
        );
        if (wired && substantive && fallback) {
          pushRegion(fallback, [f], true);
        } else {
          droppedSingletonFiles.push(f);
        }
        continue;
      }
    }
    pushRegion(term, [f], true);
  }

  const fileToRegion2 = new Map();
  for (const r of regions) for (const f of r.primary_files) fileToRegion2.set(f, r.id);

  const infraCandidates = [];
  for (const file of unassigned.concat(droppedSingletonFiles)) {
    if (fileToRegion2.has(file)) continue;
    const set = importers.get(file) || new Set();
    const hostRegions = new Set([...set].map((x) => fileToRegion2.get(x)).filter(Boolean));
    if (set.size >= 3 && hostRegions.size >= 2) {
      infraCandidates.push({ file, importers: set.size, hostRegions: [...hostRegions].sort() });
    }
  }
  infraCandidates.sort((a, b) => b.importers - a.importers || (a.file < b.file ? -1 : 1));

  for (const ic of infraCandidates) {
    pushRegion(
      (ic.file.split('/').pop() || ic.file).replace(/\.[^.]+$/, ''),
      [ic.file],
      false,
      {
        infra: true,
        hypothesis: `Shared module "${ic.file}" is used by ${ic.hostRegions.length} distinct semantic regions (${ic.importers} importers).`,
        sourceUnits: [...new Set([unitOf.get(ic.file)].filter(Boolean))].sort(),
        spansMultipleUnits: true,
        seedTerm: 'shared-infrastructure',
        sharedByRegions: ic.hostRegions.length,
        hostRegionIds: ic.hostRegions,
      }
    );
  }

  for (const r of regions) for (const f of r.primary_files) fileToRegion.set(f, r.id);

  // Supporting-attachment: leftover source files that directly touch a region and share
  // eligible vocabulary join as SUPPORTING files rather than becoming new entities.
  const adjacency = new Map();
  for (const e of graph.edges) {
    if (e.type !== 'IMPORTS' && e.type !== 'REFERENCES') continue;
    if (!adjacency.has(e.from)) adjacency.set(e.from, new Set());
    if (!adjacency.has(e.to)) adjacency.set(e.to, new Set());
    adjacency.get(e.from).add(e.to);
    adjacency.get(e.to).add(e.from);
  }
  const leftovers = [...new Set([...unassigned, ...droppedSingletonFiles])].filter((f) => !fileToRegion.has(f));
  for (const file of leftovers.sort()) {
    if (isDocOrTest(file)) continue;
    const neighbors = adjacency.get(file) || new Set();
    const profile = profiles.get(file);
    if (!profile) continue;
    const candidates = [];
    for (const region of regions) {
      if (region.is_shared_infrastructure) continue;
      const linked = [...neighbors].some((n) => region.primary_files.includes(n));
      if (!linked) continue;
      // vocab overlap check using region top_terms
      const regionTop = new Set(region.boundary_evidence.top_terms);
      let shared = 0;
      for (const t of profile.keys()) if (regionTop.has(t)) shared++;
      if (shared) candidates.push({ region, score: shared });
    }
    if (!candidates.length) continue;
    candidates.sort((a, b) => b.score - a.score || (a.region.id < b.region.id ? -1 : 1));
    const target = candidates[0].region;
    target.supporting_files.push(file);
    target.boundary_evidence.members.push({ file, affinity: Number(candidates[0].score.toFixed(4)), attached_as: 'supporting' });
    fileToRegion.set(file, target.id);
  }
  for (const r of regions) r.supporting_files.sort();

  for (const e of graph.edges) {
    if (e.type !== 'IMPORTS' && e.type !== 'REFERENCES') continue;
    const a = fileToRegion.get(e.from);
    const b = fileToRegion.get(e.to);
    if (!a || !b || a === b) continue;
    const ra = regions.find((r) => r.id === a);
    const rb = regions.find((r) => r.id === b);
    if (!ra || !rb) continue;
    if (!rb.imported_by_regions.includes(ra.id)) rb.imported_by_regions.push(ra.id);
    if (!ra.imports_from_regions.includes(rb.id)) ra.imports_from_regions.push(rb.id);
    ra.imported_edges.push({ edge: e.id, to_region: rb.id, file_from: e.from, file_to: e.to });
  }
  for (const r of regions) {
    r.imported_by_regions.sort();
    r.imports_from_regions.sort();
    r.boundary_evidence.shared_by_regions = r.imported_by_regions.length;
    delete r._files;
    delete r._regionsImportingThis;
    delete r._importedRegions;
  }

  const contestedFiles = [...assignments.entries()]
    .filter(([, a]) => a.contested)
    .map(([f]) => f)
    .sort();

  // Docs/tests remain unassigned by design; report only source leftovers.
  // Includes dropped singletons that no region claimed as primary/support.
  const claimed = new Set([...fileToRegion.keys()]);
  const sourceUnassigned = [...new Set([...unassigned, ...droppedSingletonFiles])]
    .filter((f) => !isDocOrTest(f) && !claimed.has(f))
    .sort();

  return { regions, unassigned: sourceUnassigned, contested_files: contestedFiles };
}
