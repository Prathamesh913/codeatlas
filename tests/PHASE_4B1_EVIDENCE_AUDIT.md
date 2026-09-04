# Phase 4B.1 — Semantic Evidence Audit

**Status**: Complete (feeds Phase 4B.1 design)
**Date**: 2026-08-28
**Inputs**: Phase 3 evidence (`tests/evidence-cache/*/evidence/`), Phase 4A structural output (`tests/evidence-cache/*/structural/`), targeted source samples from ProjectDock and CinePrint.

This audit inspects what information is available for semantic investigation per Structural Unit. It does not generate semantic candidates — it determines what *can* be investigated, what requires source reads, and what remains unknowable.

---

## 1. Structural Context

Per Structural Unit, Phase 4A provides:

| Signal | Available | Useful for investigation |
|---|---|---|
| `members` (files) | ✅ | Defines the investigation scope |
| `hubs` | ✅ | High-information file candidates (e.g., `projectdock/__init__.py` degree 15, `src/lib/collections-core.ts` degree 10, `automation/index.ts` degree 12) |
| `bridges` | ✅ | Files connecting weakly linked areas — often worth inspecting to understand unit boundaries |
| `cycles` | ✅ | Rare (0 in ProjectDock, 1 in CinePrint `routeTree.gen.ts ↔ router.tsx`) — flags generated, tightly coupled code |
| `entrypoint_reachability` | ⚠️ weak | Exists but trivial: ProjectDock anchors only to `pyproject.toml`, CinePrint npm scripts have `file: null`, so reachability is empty/minimal |
| `shared_dependencies` | ✅ | External + internal shared deps — e.g., ProjectDock `projectdock/app.py` (33 importers), CinePrint `automation/tmdb/types.ts` (11) |
| `degree` (per file) | ✅ | Ranks files by connectivity within unit |
| `size` | ✅ | Informs inspection budget |

**Representative units:**

- **ProjectDock `unit-001`** (size 24): core `projectdock/` package — `__init__.py`, `app.py`, `ui.py`, `search.py`, `intelligence.py` plus tests. Hub `__init__.py`. 12 bridges (each test file bridged to its source). No cycles.
- **ProjectDock `unit-002`** (size 2): `__main__.py` + `cli.py` — entry pair.
- **CinePrint `unit-001`** (size 49): collections/auth/firebase — hub `collections-core.ts`, bridges through `auth-initialization`, `service-account`, `read-state` tests.
- **CinePrint `unit-002`** (size 39): `automation/` — hub `automation/index.ts`, ingestion pipeline (blob, tmdb, notion).
- **CinePrint `unit-003`** (size 20): routing — hub `routeTree.gen.ts` (generated), 8 bridges to routes, cycle with `router.tsx`.

**Orphans**: ~90% of components are singletons (39 in ProjectDock, 133 in CinePrint). These are files importing only externals or isolated utilities — intentionally out of scope for semantic unit investigation until they gain structural context.

---

## 2. Naming Evidence

Available without source reads (from Phase 3):

| Source | Evidence | Example |
|---|---|---|
| Filenames | `path` | `projectdock/actions.py`, `src/lib/notion.ts`, `src/components/AddToCollectionModal.tsx` |
| Directory names | prefix of `path` | `automation/`, `src/lib/`, `tests/` |
| Symbol names | `symbols.json` `name` | `open_in_editor`, `fetchNotionPosters`, `PosterFetchError` |
| Exported names | `symbol_kind: named_export` | `sharedUtil`, `collections-core` exports |
| Config names | `entrypoints.json` `description`, `repository.json` `name` | `package.json script "dev": vite dev` |

**Naming is evidence. Naming is not truth.** Explicitly:

- `lib/notion.ts` (CinePrint) — filename suggests Notion integration, but Phase 3 imports are `firebase.ts`, `posters.ts`, `../server/firebase/admin.ts` + `ext:@tanstack/react-start`, and declared symbols are `PosterFetchError`, `fetchNotionPosters`, `loadPublishedPosters`, `submitPosterToNotion`. Phase 4A correctly placed it in `unit-001` (collections-core), not an automation/notion cluster. Source inspection reveals Firebase-backed poster loading with Firestore comments, not Notion API consumption as primary behavior. The name must be treated as one clue among many.
- Similarly, `projectdock/intelligence.py` or `src/lib/collections-core.ts` — names suggest broad scope, but must be validated against behavior.

**What is sufficient**: naming + directory + symbol evidence is sufficient to generate an initial hypothesis but never to conclude. It must be corroborated by dependency and source-level evidence.

**What requires source reads**: whether a name's suggested meaning matches behavior (e.g., `notion.ts` actually talks to Notion vs Firebase).

**What remains unknowable**: user intent behind a name without comments, UI labels, or behavioral confirmation.

---

## 3. Dependency Evidence

From `imports.json` (Phase 3) and graph external nodes (Phase 4A):

| Project | Distinct external deps | Examples |
|---|---|---|
| ProjectDock | 20 | `os`, `subprocess`, `shutil`, `shlex`, `pathlib` |
| CinePrint | 121 | `react`, `firebase`, `@tanstack/react-start`, `@tanstack/react-router`, `vite`, `zod` |

**Structural neighborhood** (graph-derived, not just `imports.json`):
- **Direct neighbors**: file→file `IMPORTS` edges (resolved)
- **Reverse importers**: who imports a given file (`shared_dependencies` — e.g., `projectdock/app.py` ← 33 files)
- **Hubs / shared deps**: files imported by ≥2 distinct files within the graph
- **Entry-point paths**: weak today, but hubs serve as proxy entry points for investigation

**Dependency evidence suggests implementation context, not semantic meaning**:
- `firebase` imports → suggests persistence / auth / Firestore usage, not automatically "Firebase System". CinePrint `unit-001` contains Firebase across collections, auth, ticket — the shared usage hints at a possible system_candidate, but requires behavioral support (e.g., `getAdminDb`, Firestore reads).
- `subprocess` / `os` / `shlex` in ProjectDock → suggests shell/launcher integration (`actions.py` launching editors/terminals via `uwsm-app`), not "Subprocess System".
- `react` / `@tanstack/react-start` → UI framework, not feature meaning.

**What is sufficient**: repeated shared dependency across a cluster strengthens a system_candidate hypothesis when corroborated by common behavioral patterns.

**What requires source reads**: what the dependency is *used for* (e.g., `db` from `firebase.ts` → Firestore `getDocs` vs Auth).

---

## 4. Structural Neighborhood

For any file, the graph provides:

- **Direct neighbors**: `IMPORTS` + `REFERENCES` edges (e.g., `src/lib/notion.ts` ↔ `src/lib/firebase.ts`, `src/lib/posters.ts`, `src/server/firebase/admin.ts`; `← src/lib/ticket.ts`).
- **Hubs**: highest-degree file in unit (e.g., `projectdock/__init__.py` degree 15).
- **Shared dependencies**: files imported by many distinct peers (ProjectDock `projectdock/app.py` 33, `ui.py` 16).
- **Bridges**: edges whose removal disconnects the unit (useful to understand sub-areas).
- **Entry-point reachability**: currently weak; investigation uses hubs as entry proxies.

**What is sufficient**: structural proximity is sufficient to define the investigation scope (the Structural Unit itself) and to prioritize hubs/shared deps.

**What remains unknowable without source**: whether proximity implies shared user meaning or merely shared plumbing.

---

## 5. Source-Level Evidence

Available only by reading selected files (bounded, not full-repo scan):

| Clue category | Example observations | Provenance |
|---|---|---|
| **UI evidence** | Button text `"Save Poster"`, `"Add to Collection"`, `"Search Projects"`, placeholders, `aria-label`, JSX text, headings, route labels | file, line range |
| **Behavioral** | `fetch(...)`, `getDocs`, `setDoc`, `createServerFn`, `useState`, `onClick` → `submitPosterToNotion`, `launch_tool` → `Popen`, state transitions | file, symbol |
| **Naming (reinforced)** | Function `open_in_editor`, class `PosterFetchError` | file, symbol |
| **Comments** | `// Public path: reads go through CLIENT Firestore SDK` | file |

**Targeted reads are mandatory for hypotheses.** Evidence audit shows:

- **Sufficient without source**: ProjectDock `unit-001` naming + shared dep (`app.py`) strongly suggests a central system, but UI vs system distinction still requires source (e.g., `ui.py` UI labels vs `intelligence.py` agent behavior).
- **Requires source**: CinePrint `unit-001` — `notion.ts` naming vs Firebase behavior conflict; collections vs saved posters vs poster browsing are only distinguishable via UI strings (`"Saved"`, collection card labels) and Firestore collection names.
- **Unknowable without broader inspection**: cross-unit flows (e.g., automation pipeline `automation/index.ts` → Firestore) require reading the hub + 1–2 bridged files, not the whole unit.

**Minimum source context** (heuristic): For a unit of size N, inspect ≤5 files selected by: hub files, shared dependencies, entry-reachable, files with exported symbols, bridge endpoints — capped and ordered deterministically. Record *why* each was selected.

---

## 6. Evidence Gaps

### A. Blocking gaps
**None.** All Phase 4B.1 semantic investigation can proceed with Phase 3 + Phase 4A + bounded source reads. No Phase 3/4A modification is required.

### B. Future enrichment (not blocking)
1. **UI text extraction precision** — regex over string literals misses dynamically constructed labels and i18n keys; richer JSX parsing would improve UI clue recall.
2. **Entry-point anchoring** — resolving npm script commands and Python console-scripts to modules would strengthen entry-point file selection and reachability.
3. **Generated files as orphans** — Phase 4A filters `.vercel`, but `routeTree.gen.ts` is intentionally kept as a hub; distinguishing generated hubs from source hubs in clues would help (e.g., generated routes vs hand-written route components).
4. **Cross-unit flows** — single-unit investigation suffices for 4B.1; flow-level hypotheses remain Phase 4B.2.

---

## 7. Conclusion

For both corpora, every large Structural Unit (size ≥10) has sufficient naming + dependency + structural neighborhood evidence to form a hypothesis, but **requires targeted source reads** to decide between feature_candidate, system_candidate, ambiguous, or insufficient_evidence. Small units (size 1–2) and many orphan singletons are expected to yield `insufficient_evidence` without additional context — a correct, desirable outcome.
