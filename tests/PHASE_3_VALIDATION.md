# CodeAtlas Phase 3 — Validation Report

**Status**: Complete (validation done; Phase 4 not started)

**Date**: 2026-08-28
**Tool version**: `codeatlas-evidence-collector` v0.3.0
**Scope**: Minimal automated evidence collector. Mechanical observation only — no semantic interpretation.

---

## 1. Objective

Implement a narrow, dependency-free evidence collector that mechanically observes a codebase:

- Files (discovery + classification + exclusion rules)
- Imports / dependencies (local vs external, resolution status)
- Symbols / exports
- Entry points
- Config / dependency / env-var / URL evidence
- Repository metadata (languages, package files, framework clues)

Output is structured JSON under `.codeatlas/evidence/`, inspectable without the source code.
The collector **observes but does NOT interpret** — it never concludes that a file named
`auth.ts` is "authentication" or that `notion.ts` is a "Notion integration."

---

## 2. Implementation Summary

| Component | File | Responsibility |
|---|---|---|
| Orchestrator | `src/collect.js` | Pipeline + CLI entry point (guarded so it does not run on import) |
| Utils | `src/utils.js` | Exclusion set, source/config extension maps, language/file-type detection, env-var/URL extraction, framework-clue detection, safe readers |
| File discovery | `src/collectors/files.js` | Recursive walk, exclusion recording, source/config/other classification |
| Imports | `src/collectors/imports.js` | ESM/CJS + Python import extraction, local resolution, classification |
| Symbols | `src/collectors/symbols.js` | TS/JS export + Python def/class extraction, React component evidence |
| Entry points | `src/collectors/entrypoints.js` | package.json scripts, Python entry files, pyproject scripts |
| Config | `src/collectors/config.js` | npm deps, env-var names, URLs |
| Metadata | `src/collectors/metadata.js` | Languages (from files + package files), package/config files, git status |

- **Language**: Node.js vanilla ESM, zero external dependencies.
- **Tests**: built-in `node:test` + `node:assert/strict`.
- **Evidence output**: `.codeatlas/evidence/{manifest,repository,files,imports,symbols,entrypoints,config}.json`

---

## 3. Test Results

```
node --test tests/unit/*.test.js tests/fixtures/*.test.js

ℹ tests 38
ℹ pass  38
ℹ fail   0
```

### Unit coverage
- `files.test.js` — discovery, classification, exclusion reasons (incl. `node_modules`).
- `imports.test.js` — ESM/CJS/Python imports, local vs external, local resolution,
  unresolved detection, CSS imports, `process.env` references.
- `symbols.test.js` — TS/JS exports (function/class/const/default/React), Python def/class/`__main__`.

### Integration coverage (full pipeline over fixtures)
- `ts-app` — all 7 evidence files produced + valid JSON; React/Vite framework clues detected;
  npm `start`/`dev` scripts as entry points; `react` dependency + `REACT_APP_API_URL` env var.
- `python-app` — Python detected from source files; `main.py` imports + `create_app`/`__main__` symbols; `APP_API_URL` env var.
- `exclusion-app` — `node_modules`/`dist`/`__pycache__` excluded and recorded; excluded files
  absent from inventory; normal source (`src/index.ts`) preserved.

---

## 4. Real-Project Validation

### 4.1 ProjectDock (Python)
| Metric | Value |
|---|---|
| Files discovered | 65 (39 source, 9 config, 17 other) |
| Excluded | 3 |
| Imports captured | 290 |
| Symbols captured | 228 |
| Entry points | 1 (`pyproject.toml` scripts) |
| Env-var names | 3 (`OMARCHY_THEME`, `PROJECTDOCK_TRACE`, `WAYLAND_DISPLAY`) |
| Framework clues | 0 |
| Errors | 0 |

Python detected from actual `.py` files (not just package manifests). `__main__.py` observed.
No secrets collected — only env-var **names**.

### 4.2 CinePrint — cine-print-gallery (TypeScript / React)
| Metric | Value |
|---|---|
| Files discovered | 398 (319 source, 26 config, 53 other) |
| Excluded | 4 |
| Imports captured | 1128 |
| Symbols captured | 1135 |
| Entry points | 2 (`dev`, `build` npm scripts) |
| Env-var names | 34 |
| URLs | 111 |
| Framework clues | 7 |
| Errors | 0 |

### 4.3 Misleading-filename test — `src/lib/notion.ts`
This file is **named** `notion.ts` but mechanically integrates with Firebase/TanStack, not Notion.
The collector observed it correctly:

- Captured imports: `@tanstack/react-start`, `./posters`, `./firebase`, `../server/firebase/admin`.
- Captured symbols: `PosterFetchError` class + plain-poster mapper functions.
- **Did NOT** label it "Notion integration" or infer any semantic meaning from the filename.

This confirms the Phase 3 boundary: the collector records what the file *does mechanically*
(its real dependencies), not what its name *suggests*. Correcting the misleading name is a
**Phase 4** semantic-interpretation task, not a Phase 3 one.

---

## 5. Phase 3 Non-Goals — Verified

- ✅ **No semantic interpretation.** No features, systems, intent, or "this is X" conclusions.
- ✅ **Unresolved imports preserved.** 11 unresolved imports in cine-print-gallery (from
  `.vercel/output` build artifacts) retained with `resolution_status: "unresolved"`. Nothing discarded.
- ✅ **Exclusion rules recorded + inspectable.** Each exclusion carries `path` + `reason` in
  `manifest.exclusions`. Excluded files are absent from the file inventory.
- ✅ **No secrets.** Only env-var **names** collected; never values. Verified on both projects.
- ✅ **No AST parsing.** V1 uses regex extraction as planned.
- ✅ **Zero external dependencies.** Pure Node ESM.
- ✅ **Phase 2A/2B maps untouched.** Evidence written to `.codeatlas/evidence/`, distinct from
  `features.json` / `systems.json` etc. No overwrite of prior validation maps.

---

## 6. Known Limitations (V1, expected — not blockers)

1. **Absolute package-style internal imports are not local-resolved.**
   `from projectdock.cli import main` is preserved but classified as external
   (`resolution_status: "not_local"`) rather than resolved to `projectdock/cli.py`.
   Only *relative* imports (`./foo`, `../bar`) resolve to local files. This is a regex-based V1
   limitation, not data loss — the import is still recorded. A future resolver (or Phase 4
   post-processing) can re-classify these.
2. **No type-aware resolution.** Symlinks, path aliases (`@/`, `~`), and `tsconfig` `paths` are
   not resolved in V1.
3. **Symbol/import extraction is regex-based.** Obscure syntax, dynamic `import()`, and code
   inside template strings may be missed. Confidence is marked `high` for clearly matched patterns.
4. **Language detection is extension-driven.** No content sniffing (e.g., `.js` files that are
   actually TypeScript-in-disguise) — consistent with the mechanical-observation goal.

---

## 7. Evidence File Inventory (per run)
```
.codeatlas/evidence/
  manifest.json       — tool version, summary counts, exclusions, errors
  repository.json     — root, detected languages, package/config files, framework clues, git status
  files.json          — per-file path, extension, language, type, size, inclusion
  imports.json        — per-import source, target, classification, symbols, resolution_status
  symbols.json        — per-symbol name, kind, file, export info, react evidence
  entrypoints.json    — npm scripts, python entry files, pyproject scripts
  config.json         — dependencies, framework clues, env-var names, URLs
```

---

## 8. Phase 3 → Phase 4 Boundary (must hold)

- **Phase 3 (done)**: produce raw, inspectable evidence. Mechanical only. The collector is
  forbidden from naming features, systems, or intent.
- **Phase 4 (NOT STARTED)**: consume `evidence/*.json` to construct the semantic map
  (features, systems, relationships, flows) with confidence + provenance. This is where the
  `notion.ts` misleading-name correction and grouping decisions belong.

> Do not begin Phase 4 until explicitly approved and planned in `progress.md`.
