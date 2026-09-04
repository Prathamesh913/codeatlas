# Phase 4A — Evidence-to-Graph Validation

**Status**: Complete
**Date**: 2026-08-28
**Tool**: `codeatlas-structural-graph` v0.4.0
**Boundary**: Phase 4A **structures**; it does **not** interpret. No Features, Systems, Relationships, or Flows are produced.

---

## 1. Scope

**Does**: load Phase 3 evidence → normalize → build a navigable implementation graph (files, external deps, unresolved modules, entry points; edges IMPORTS/DECLARES/REFERENCES/ENTRYPOINT_FOR) → run deterministic structural analysis (components, hubs, bridges, cycles, shared deps, reachability, orphans) → emit candidate **Structural Units** (connected components).

**Does NOT do**: name features/systems; infer intent; perform lookup; modify Phase 3 evidence or Phase 2 semantic maps.

---

## 2. Evidence Audit Summary

Full audit: `tests/PHASE_4A_EVIDENCE_AUDIT.md`. Key points:
- **Usable**: `files.json` (paths/languages), `imports.json` (directed deps + classification), `symbols.json` (declares + REFERENCES matching), `entrypoints.json` (weak anchoring).
- **Missing / weak**: Phase 3 leaves internal Python module imports (`projectdock.cli`) unresolved (0 file→file edges for ProjectDock as-collected); CinePrint `.vercel/output` build artifacts leaked in; entry points rarely anchor to a module.
- **Blocking gaps**: none. All gaps are handled by Phase 4A normalization or documented as future enrichment.

---

## 3. Graph Model
- **Nodes**: `file`, `external_dependency`, `unresolved_module`, `entry_point`. (`config_artifact` subsumed by `file`.)
- **Edges**: `IMPORTS`, `DECLARES`, `REFERENCES`, `ENTRYPOINT_FOR`. (`EXPORTS` = inverse of IMPORTS, not stored separately; no semantic edges.)
- **Provenance**: every edge records source evidence + file + observed statement. Output written to `structural/`; Phase 3 evidence untouched.

---

## 4. Structural Analysis (real runs)

### ProjectDock
| Metric | Value |
|---|---|
| File nodes | 65 |
| External dep nodes | 20 (distinct) |
| IMPORTS edges | 290 (89 `resolved_phase4a`, 201 `not_local`) |
| REFERENCES edges | 50 |
| DECLARES edges | 228 |
| Components | 41 (1 large = 24 files, 1 pair, 39 orphans) |
| Hubs | 1 (`projectdock/__init__.py`, degree 15) |
| Shared deps | `projectdock/app.py` (33 importers), `projectdock/__init__.py` (28), `projectdock/ui.py` (16) |
| Cycles | 0 |

### CinePrint
| Metric | Value |
|---|---|
| File nodes | 253 (after generated-dir filtering of ~145 `.vercel` artifacts) |
| External dep nodes | 121 |
| IMPORTS edges | 740 (224 Phase-3 resolved, 9 unresolved, rest external) |
| REFERENCES edges | 223 |
| DECLARES edges | 583 |
| Components | 138 (clusters of 49, 39, 20, 10; 133 orphans) |
| Hubs | `src/routeTree.gen.ts` (14), `automation/index.ts` (12), `src/lib/collections-core.ts` (10), `src/components/AddToCollectionModal.tsx` (3) |
| Cycles | 1 (`src/routeTree.gen.ts ↔ src/router.tsx` — generated route tree, explainable) |

---

## 5. Automated Test Results

`tests/structural/structural.test.js` — **16/16 pass** against fixtures A–F:

| Fixture | Expectation | Result |
|---|---|---|
| A — Linear (A→B→C) | 1 unit, no cycle, entry reachability covers chain | ✅ |
| B — Shared Hub (A,B→H) | H identified as hub (degree 2); REFERENCES edge via symbol | ✅ |
| C — Bridge (A→B→C→D→E) | C—D identified as connecting bridge, evidence-backed | ✅ |
| D — Cycle (A→B→C→A) | cycle detected, no semantic label | ✅ |
| E — Unresolved | unresolved node preserved; no crash | ✅ |
| F — Orphan | isolated file identified | ✅ |
| Neutrality | units contain no Feature/System terms | ✅ |
| Determinism | `graph.json` byte-identical across runs | ✅ |

Existing Phase 3 suite (38/38) remains green — no regression.

---

## 6. ProjectDock Validation (vs Phase 2A map, evaluation only)

Phase 2A established ProjectDock as a cohesive desktop-app package with a clear core (`app.py`, UI, workspace, intelligence). Structural output:

- **STRONGLY ALIGNED**: the 24-file connected component is the `projectdock` package core. `app.py` (33 importers) and `__init__.py` (28) emerge as dominant shared implementation units — exactly the cross-cutting core Phase 2A described. `ui.py` (16) is a secondary hub.
- **STRONGLY ALIGNED**: Phase 4A's local hub `projectdock/__init__.py` matches Phase 2A's "package entry" intuition, derived purely from import degree.
- **PARTIAL**: 39 orphans are mostly config/other/standalone files with no internal imports — expected; they are not "lost," merely not structurally connected.
- **WEAK**: entry-point reachability is trivial (the only entry point anchors to `pyproject.toml`, a config file). Would improve if Phase 3 resolved console-script targets to modules.
- **Unexpected artifact**: none. Generation is clean and explainable.

**Navigation reduction (heuristic)**: the largest cluster (24 files) covers 37% of the 65-file graph. A "core app" investigation narrows from 65 → 24 candidate files immediately, and `app.py`/`__init__.py`/`ui.py` pinpoint the shared surface.

---

## 7. CinePrint Validation (vs Phase 2B map, evaluation only)

Phase 2B described collections, automation/sync, routing, auth, and a misleading `lib/notion.ts`. Structural output:

- **STRONGLY ALIGNED**: four real clusters surface — `collections-core` (49 files: `collections-core.ts`, `collections.ts`, `poster-images.ts`, `firestore-*`), `automation` (39: `automation/index.ts` hub), route tree (20: `routeTree.gen.ts` hub), `AddToCollectionModal` (10). These match Phase 2B's collections / automation / routing areas.
- **STRONGLY ALIGNED**: shared deps `automation/tmdb/types.ts` (11), `automation/blob/client.ts` (10), `collections-core.ts` (9) confirm cross-cutting automation/collections utilities.
- **STRONGLY ALIGNED**: cycle `routeTree.gen.ts ↔ router.tsx` is a real, explainable generated cycle — useful to surface, not hide.

### `lib/notion.ts` (the misleading-filename test)
- Structurally located in the **49-file `collections-core` cluster**.
- Imports `firebase.ts`, `posters.ts`, `server/firebase/admin.ts` (all resolved local) + `@tanstack/react-start` (external).
- Imported by `src/lib/ticket.ts`. Degree 4.
- Declares symbol names that *mention* Notion: `fetchNotionPosters`, `loadPublishedPosters`, `submitPosterToNotion`.
- **Phase 4A conclusion**: none. It reports structure + observed symbol *names* (naming evidence), never a "Notion System."
- **Value**: a future semantic interpreter receives both structural context (embedded in collections/firebase area) and naming evidence (`*Notion*` symbols) — enough to investigate the file correctly instead of trusting only its filename. This is precisely the Phase 3/4 boundary working.

**Navigation reduction (heuristic)**: a "collections" query lands in the 49-file cluster = 19% of the 253-file graph; "automation" → 39 files (15%); "routing" → 20 files (8%). Investigation space drops from 253 to 20–49 files.

---

## 8. Evidence Gaps

### Bugs / Blockers
**None.** Phase 4A completes and validates on both corpora without modifying Phase 3.

### Future Enrichment (recommended, not blocking)
1. **Phase 3 internal module resolution** (`projectdock.cli` → `projectdock/cli.py`) — Phase 4A already does this in normalization; doing it at collection time makes evidence self-contained.
2. **Phase 3 generated-dir exclusions** (add `.vercel`, `.output`, `.next`, … to `EXCLUSION_DIRS`) — Phase 4A filters them; Phase 3 omitting them pollutes raw evidence.
3. **Entry-point → module resolution** (parse npm scripts / `[project.scripts]`) — enables real reachability.
4. **Path-alias (`@/`, `~`) resolution** via `tsconfig` `paths`.
5. **AST symbol call graph** — would sharpen REFERENCES (out of V1 scope).

---

## 9. Phase 4A Limitations
- Internal module resolution is best-effort (path heuristics); aliases unresolved.
- High orphan rate in both repos (most files import only externals) — signal lives in the few large clusters + hubs.
- Entry-point reachability weak due to unanchored scripts.
- Graph is module/file-level; no function-level call graph.

---

## 10. Recommendation

**Is the structural graph sufficient to begin designing Phase 4B — Semantic Interpretation?**

### YES.

**Why**:
- The pipeline provably transforms raw Phase 3 evidence into a navigable, explainable implementation graph with full provenance.
- On both corpora it recovers the architecture Phase 2A/2B found manually (ProjectDock core + shared `app.py`/`__init__.py`/`ui.py`; CinePrint collections/automation/routing clusters + hubs + an explainable cycle).
- It reduces investigation space to 19–37% of files for the dominant areas, and it correctly handled the `notion.ts` misleading-name case by supplying structure + naming evidence without semantic assertion.
- All gaps are enrichment-level, not blockers; Phase 4B can consume `structural/{graph,units,analysis}.json` as its evidence base.

**Do not begin Phase 4B in this phase.** Phase 4A stops here.
