# Phase 4B.2 — Design Audit (Semantic Carving & Canonical Resolution)

**Date**: 2026-08-28
**Inputs inspected**: Phase 3 evidence, Phase 4A structural output, Phase 4B.1 candidates
for ProjectDock + CinePrint; Phase 2A/2B maps read **for oracle framing only** (never as
generation input).

---

## 1. What information does 4B.2 receive?

| Layer | Artifact | What 4B.2 uses |
|---|---|---|
| Observed evidence | `evidence/files.json`, `imports.json`, `symbols.json`, `entrypoints.json`, `config.json` | file/language inventory, symbol names per file (`graph.nodes[].declares` covers all files, even uninspected), env/deps context |
| Structural | `structural/graph.json`, `units.json`, `analysis.json` | IMPORTS/REFERENCES edges (with provenance), connected components = Structural Units, hubs, bridges, shared-dependency importer counts, degrees |
| Investigated | `investigation/candidates.json` | per-unit UI/behavioral/naming clues **with file provenance** for the ≤5 inspected files per unit, selection reasons, competing hypotheses, ambiguity notes |
| Inspected boundaries | candidates | `inspected_files` (read + clue-carrying) vs `uninspected_files` (structural tokens only) |

Key asymmetry: **symbol evidence exists for every file** (Phase 3 symbols.json), while UI/behavioral
clue evidence exists only for the files 4B.1 inspected. Carving must weight both without pretending
they are equal.

## 2. What prevents direct candidate promotion?

Real evidence, both directions:

- **One unit → many entities.** ProjectDock `unit-001` (24 files: `app.py`, `ui.py`, `search.py`,
  `discovery.py`-adjacent modules, `workspace.py`, `theme.py`, `actions.py`, `intelligence.py` +
  tests) maps in the manual Phase 2A oracle to *at least* discovery, search, actions, intelligence,
  workspace-awareness, dev-sessions, presentation, launcher-shell. One candidate → many features.
- **Many units → one entity.** CinePrint poster browsing spans the route-tree unit
  (`src/routes/index.tsx`, `routeTree.gen.ts`) *and* the collections-core unit
  (`src/lib/notion.ts`, `posters.ts`, `poster-images.ts`) — structurally disconnected from each
  other at component granularity, semantically one capability.
- **Entities that must not be promoted at all.** 118/138 CinePrint and 36/41 ProjectDock candidates
  are `insufficient_evidence`; promoting any subset of them would fabricate semantics.

Conclusion: candidate → final entity is insufficient. An intermediate, evidence-carved layer is required.

## 3. What evidence can define a semantic boundary?

Ranked by observed reliability during this audit:

1. **UI vocabulary clusters** (most reliable): visible strings cluster user concepts
   (`"Search posters, artists, tags…"`, `"Add to Collection"`, `"Saved Posters"`).
2. **Symbol families**: camelCase/snake token overlap across files (`createCollectionCore`,
   `addPosterToCollectionCore`, `listMyCollectionsCore` → `collection`). Highest **coverage** —
   every file has declared symbols via Phase 3.
3. **Behavioral clusters**: persistence ops vs rendering/handlers vs subprocess (Firestore `doc(`
   vs `onClick` vs `Popen`).
4. **Shared-infrastructure usage shape**: a file imported by **multiple distinct regions** (not
   just many files) is a System signal. High import count alone is explicitly insufficient —
   `projectdock/__init__.py` (28 importers) is a package marker, not a system.
5. **Route/entry affinity**: `src/routes/*` locality.
6. **Naming**: filename tokens — supporting weight only; `notion.ts` proves filenames mislead.
7. **Directory locality**: weak (`src/lib/` holds auth+collections+posters together).
8. **Directional imports**: connect regions (below), define weak boundaries.

## 4. What evidence can connect semantic regions?

- **Cross-unit vocabulary identity**: same discriminative token clustering files in *different*
  Structural Units (route `saved.tsx` in route-tree unit + `lib/saved.ts` in collections unit →
  `saved`). Primary merge signal; does **not** require connectivity.
- **Cross-region IMPORTS/REFERENCES edges** (graph evidence with provenance) reinforce merges and
  become `USES`/`DEPENDS_ON` relationship evidence.
- **Handler→action chains** observed in clues (UI handler names calling symbol families).

## 5. Minimum additional source inspection

- Reuse 4B.1 clues first. Read a file only when a concrete resolution question is open:
  (a) region type undecided (feature vs system), (b) contested boundary (a file's two best themes
  are near-tied), (c) entity has no user-facing evidence at all.
- **Bounded incremental inspection**: per undecided region, inspect at most **3** extra
  highest-information uninspected members; **global cap 60** extra reads per repository.
  Rationale: at 60, worst-case total inspection (5/unit already done + 60) stays ≈ 25% of the
  CinePrint file graph and <10% of ProjectDock's — enough to resolve contested cases without
  drifting toward a repository scan. Every read records file/reason/question/result.

## 6. What remains impossible without richer analysis

- Implicit runtime wiring (dependency injection, dynamic imports, string-dispatched handlers).
- Call-chain behavior (needs AST/call graph) — e.g. keyboard-shortcut registration inside `ui.py`.
- State relationships hidden behind framework abstractions when the glue file was never inspected.
- User-visible purpose for units whose only evidence is plumbing.

**Blockers**: none for 4B.2 as scoped.
**Future enrichment**: AST call graph, tsconfig alias resolution, entry-point module anchoring,
per-file UI-text extraction at collection time, i18n label resolution.

---

## 7. Design decision to be validated

**D-012 — Structural Boundaries Do Not Define Semantic Boundaries.**
Implementation must therefore key Semantic Regions on *evidence affinity* (symbol/UI/behavioral
tokens), never on component membership; regions record `source_structural_units` as provenance,
not as a boundary. Splitting, merging, shared-system extraction, and unresolved preservation are
the four mandatory behaviors; fixtures A–H test each, including over-merge/over-split prevention.
