# Phase 4A — Evidence Audit

**Status**: Complete (feeds the Phase 4A design + plan)
**Date**: 2026-08-28
**Inputs audited**: Phase 3 evidence (`tests/evidence-cache/{projectdock,cineprint}/evidence/*.json`) plus the Phase 3 collector source (`src/collectors/*.js`, `src/utils.js`).

This audit inspects the *actual* Phase 3 output — it does not assume the evidence model is sufficient. Findings below are grounded in real counts from two codebases.

---

## 1. Repository Metadata (`repository.json`)

**What exists**: `root`, `name`, `detected_languages`, `package_files`, `config_files`, `framework_clues`, `git_initialized`.

**Useful for structural analysis**:
- `detected_languages` — confirms the language mix (Python for ProjectDock; TypeScript/JavaScript for CinePrint).
- `package_files` / `config_files` — identifies build/manifest anchors.
- `git_initialized` — minor provenance.

**Missing / weak**:
- No directory tree or package-root signal beyond filename guesses. Phase 4A re-derives structure from file paths + imports instead.
- `framework_clues` is empty for ProjectDock (no `package.json`); for CinePrint it lists 7 clues (React, Vite, TanStack, etc.). Useful context but not needed to build the graph.

---

## 2. File Inventory (`files.json`)

**What exists**: per file — `path`, `extension`, `language`, `type`, `size`, `included`, `excluded_reason`. 65 files (ProjectDock), 398 files (CinePrint).

**Grouping support actually present in evidence**:
- **By directory**: YES — `path` carries directory structure (`projectdock/cli.py`, `src/lib/notion.ts`). Phase 4A uses this for generated-dir filtering and path-based module resolution.
- **By language**: YES — `language` field.
- **By import relationships**: PARTIAL — directory co-location is a weak proxy; true relationships come from `imports.json`.
- **By entry-point proximity**: NO direct field; only via `entrypoints.json`.
- **By shared dependencies**: NO direct field; derivable from `imports.json` (see §3).

**Missing**:
- No explicit module/package boundary marker. Phase 4A infers boundaries from import connectivity (connected components).
- `included:false` files are rare; Phase 3 already excludes most build dirs, but **not all** (see §6 — `.vercel/output` leaked into CinePrint).

---

## 3. Import Graph (`imports.json`)

**What exists**: per import — `source`, `target`, `type` (`import`/`from_import`), `classification` (`local`/`package`/`node_builtin`/`scoped_package`), `symbols`, `resolution_status` (`resolved`/`not_local`/`unresolved`), `resolved_path`, `confidence`.

**Audited counts**:

| Project | imports | resolved | not_local | unresolved |
|---|---|---|---|---|
| ProjectDock | 290 | 0 (Phase 3) | 290 | 0 |
| CinePrint | 1128 | 561 | 556 | 11 |

**Critical finding — ProjectDock internal imports are unresolved by Phase 3.**
- 78 imports are `classification: "package"` with targets like `projectdock.cli`, `models.user`, `services.auth_service` — these are **internal project modules**, but Phase 3 leaves `resolution_status: "not_local"` and `resolved_path: null`.
- 212 imports are `classification: "local"` with targets like `os`, `sys`, `re`, `subprocess` — these are **Python standard library**, correctly external.

So Phase 3 *observes* the imports but does **not resolve** internal module paths. Raw Phase 3 evidence therefore yields **zero file→file edges** for ProjectDock. This is the single biggest structural gap.

**Resolution status reliability**:
- `resolved` (CinePrint 561) is reliable — `resolved_path` points to a real file.
- `not_local` is reliable as "external" but **conflates** (a) third-party packages, (b) stdlib, (c) **unresolved internal modules** (ProjectDock's 78). Phase 4A must normalize (b)/(c) by attempting module→file resolution against the file inventory.
- `unresolved` (CinePrint 11): genuine dangling references (e.g. `./compiled.js` inside `.vercel` build output). Must be **preserved**, not dropped.

**Direction**: imports are directed (A imports B). Direction is reliable where `resolved_path` exists; for `not_local` we only know A depends on external B.

**Path aliases**: CinePrint uses `@/`-style aliases in places; Phase 3 cannot resolve them (no `tsconfig` `paths` consumption). These remain external/unresolved — acceptable, no semantic loss.

---

## 4. Symbols (`symbols.json`)

**What exists**: per symbol — `file`, `name`, `symbol_kind` (`function`/`class`/`named_export`/`entry_clue`/…), `confidence`. 228 (ProjectDock), 1135 (CinePrint).

**Useful for structural analysis**:
- **Public module boundaries**: `named_export` / top-level `function`/`class` mark a file's public surface.
- **Entry-point candidates**: `entry_clue` (e.g. `__main__`) flags module-entry intent.
- **Shared implementation units**: cross-referencing imported `symbols` against declared symbols enables **REFERENCES** edges (file A imports symbol X that file B declares → stronger A→B link than module-level import alone).

**Audit result**: Phase 4A matched **50 REFERENCES edges** (ProjectDock) and **223 REFERENCES edges** (CinePrint) this way. This is a real, evidence-backed refinement of the graph.

**Missing**: no symbol→symbol call graph (Phase 3 is regex, not AST). Acceptable; not needed for structural units.

---

## 5. Entrypoints (`entrypoints.json`)

**What exists**: per entry — `type` (`npm_script`/`python_entry`/…), `file`, `description`, `confidence`.

**Audit**:
- ProjectDock: 1 `python_entry` anchored to `pyproject.toml` (a config file, not a source module). Phase 4A creates an `entry_point` node + `ENTRYPOINT_FOR` edge to `pyproject.toml`, but BFS reachability from it is trivial (no source file imports `pyproject.toml`).
- CinePrint: 2 `npm_script` entries (`dev`, `build`) with `file: null`. **No file anchor** → Phase 4A cannot seed traversal from them.

**Useful**: entry points *would* anchor structural traversal if they resolved to a module. Today only weak anchoring exists.

**Missing (gap)**: npm script commands (`vite dev`, `vite build`) are not parsed into entry modules; Python `[project.scripts]` console-script targets are not resolved to modules. This limits entry-point reachability (see §6).

---

## 6. Dependencies / Config (`config.json`)

**What exists**: `dependencies` (npm sections), `framework_clues`, `env_vars` (names only), `urls`. 83 deps + 34 env vars (CinePrint); 0 deps + 3 env vars (ProjectDock).

**Useful for graph enrichment**:
- **External dependency nodes**: every distinct `not_local` import target becomes an `external_dependency` node (ProjectDock: 20 distinct; CinePrint: 121 distinct). Multiple files importing the same external package is a shared-dependency signal — but Phase 4A treats it as *shared implementation behavior*, **never** as a System.
- `env_vars` / `urls` are left for later semantic phases; not used by the structural graph.

**Missing / weak**:
- **Generated directories not excluded by Phase 3**: CinePrint's `.vercel/output/...` build artifacts (`.mjs` bundles) were collected as source and contributed ~145 spurious file nodes + self-referential edges. Phase 4A normalizes them out via a generated-dir denylist (`.vercel`, `dist`, `build`, `.next`, …). Raw evidence is untouched.
- No `tsconfig`/`paths` alias resolution (see §3).

---

## 7. Evidence Gaps

### A. Blocking gaps
**None.** Phase 4A can be built and validated entirely from the existing evidence via normalization. No Phase 3 change is required to complete Phase 4A.

### B. Useful future enrichment (not blocking)
1. **Internal module resolution in Phase 3** (resolve `projectdock.cli` → `projectdock/cli.py`). Phase 4A already does this in normalization, but doing it at collection time would make evidence self-contained. *Recommended Phase 3 follow-up.*
2. **Generated/build directory exclusions in Phase 3** (add `.vercel`, `.output`, `.next`, etc. to `EXCLUSION_DIRS`). Phase 4A filters them; Phase 3 omitting them pollutes raw evidence. *Recommended Phase 3 follow-up.*
3. **Entry-point → module resolution** (parse npm scripts / `[project.scripts]` to anchor files). Would enable real entry-point reachability.
4. **Path-alias (`@/`, `~`) resolution** via `tsconfig`/`paths` — would recover a few CinePrint edges.
5. **Symbol call graph** (AST) — would sharpen REFERENCES; out of scope for V1 structural analysis.

---

## 8. Conclusion

Phase 3 evidence is **sufficient to build a navigable implementation graph** after modest, well-scoped normalization:
- resolve internal module imports against the file inventory,
- drop generated/build artifacts,
- derive REFERENCES from imported-vs-declared symbols,
- preserve unresolved references and external nodes.

No semantic entities are required or produced. The next step is the design plan (`PHASE_4A_PLAN.md`).
