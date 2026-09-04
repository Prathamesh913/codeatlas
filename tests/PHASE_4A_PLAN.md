# Phase 4A — Design Plan: Evidence-to-Graph Prototype

**Status**: Adopted (implemented in `src/structural/`)
**Date**: 2026-08-28
**Depends on**: `PHASE_4A_EVIDENCE_AUDIT.md`

This plan defines the minimal normalized implementation graph and deterministic structural analysis that Phase 4A builds from Phase 3 evidence. It deliberately stays inside the Phase 4A boundary: **structure, not semantics.**

---

## 1. Evidence Inputs

Phase 4A loads a Phase 3 evidence directory containing:

| File | Required | Used for |
|---|---|---|
| `files.json` | ✅ | file nodes, language, generated-dir filtering |
| `imports.json` | ✅ | IMPORTS edges, resolution, REFERENCES |
| `symbols.json` | optional | DECLARES edges, REFERENCES matching |
| `entrypoints.json` | optional | entry_point nodes, ENTRYPOINT_FOR edges |
| `repository.json` | optional | context only (not used for graph) |
| `config.json` | optional | context only (not used for graph) |

Missing optional files are tolerated (empty). `files.json`/`imports.json` absence throws a clear validation error.

---

## 2. Normalization Strategy

Raw Phase 3 evidence is normalized before graph construction:

1. **Path normalization** — forward slashes, strip leading `./`.
2. **Generated-dir filtering** — drop file nodes whose path starts with a known generated prefix (`.vercel`, `dist`, `build`, `.next`, `.nuxt`, `.turbo`, `coverage`, `__pycache__`, `.git`, `node_modules`, `.cache`, `.parcel-cache`, `out`). *Rationale:* Phase 3 omits these for some tools; the implementation graph must reflect source, not compiled output. Raw evidence is unchanged.
3. **Internal module resolution (Phase 4A bridge)** — for imports Phase 3 left `not_local`/`unresolved`, attempt to map the target to a known file node:
   - relative (`./x`, `../x`) → resolve against the source file's directory with source extensions;
   - absolute module (`projectdock.cli` → `projectdock/cli.py`) → dot→slash + extensions, plus Python `__init__.py`.
   - On success → file node + `resolution_status: "resolved_phase4a"`. On failure → external or unresolved node as appropriate.
4. **Edge provenance** — every edge records the source evidence file, source file, observed statement, and resolution status.

---

## 3. Graph Model

### Node types
| Type | ID scheme | Notes |
|---|---|---|
| `file` | `<normalized path>` | `src/lib/notion.ts`, `projectdock/cli.py` |
| `external_dependency` | `ext:<target>` | third-party / stdlib / unscoped package |
| `unresolved_module` | `unresolved:<target>` | dangling reference, **preserved** |
| `entry_point` | `entry:<file|label>` | from `entrypoints.json` |

`config_artifact` was considered but **subsumed** by `file` nodes (config files are already files in `files.json`); adding a separate type would duplicate without new signal.

### Edge types
| Type | From → To | Provenance |
|---|---|---|
| `IMPORTS` | file → file/ext/unresolved | `imports.json` |
| `DECLARES` | file → `symbol:<name>` | `symbols.json` (symbol is provenance, not a graph node) |
| `REFERENCES` | file → file | `imports.json`+`symbols.json` (imported symbol matched a declared symbol) |
| `ENTRYPOINT_FOR` | entry_point → file | `entrypoints.json` |

`EXPORTS` was considered but is the **inverse of IMPORTS** and is not stored separately; `DECLARES` already carries export/symbol evidence. No semantic edge types (`IMPLEMENTS_FEATURE`, `AUTHENTICATES`, …) are created — that is Phase 4B.

### Provenance
Every edge carries `{ evidence, source_file, observed, … }`. The graph is a **derived projection**; Phase 3 evidence files are never modified. Output JSON is written to a sibling `structural/` directory.

---

## 4. Structural Signals

Deterministic, explainable graph analysis (no ML/embeddings/opaque scoring):

- **Connectivity** — undirected connected components over file↔file `IMPORTS`+`REFERENCES` edges.
- **Hubs** — highest undirected-degree file in each component with degree ≥ 2 (local hub). Also a global high-degree list.
- **Bridges** — Tarjan bridge-finding on the undirected file graph (edges whose removal disconnects a component).
- **Cycles** — Tarjan strongly-connected-components (size > 1) on directed `IMPORTS` edges.
- **Shared dependencies** — files imported by ≥ 2 distinct files.
- **Entry-point reachability** — BFS from each `ENTRYPOINT_FOR` file over the undirected file graph.
- **Orphans** — size-1 components with degree 0.

---

## 5. Structural Unit Definition

**Term**: **Structural Unit** (deliberately neutral — never Feature/System).

**Definition**: a Structural Unit is one **connected component** of the file implementation graph, annotated with its hubs, bridges, cycles, and orphans. Rationale:
- neutral and non-semantic,
- deterministic and stable for experimentation,
- directly traceable to IMPORTS/REFERENCES edges (hence to evidence),
- covers the four allowed shapes (connected group, hub+neighbors, entry-reachable subgraph, repeated cluster) without inventing semantics.

IDs: `unit-NNN`, assigned after sorting by (size desc, smallest member path asc) for determinism.

---

## 6. Output Format

```
<outputDir>/structural/
  graph.json      — { tool, version, nodes[], edges[] }            (deterministic)
  units.json      — { tool, version, structural_unit_term, units[] } (deterministic)
  analysis.json   — { tool, version, connectivity, hubs, bridges, cycles, shared_dependencies, entrypoint_reachability, degree }
  manifest.json   — { tool, version, generated_at, evidence_source, summary }  (provenance; non-deterministic timestamp isolated here)
```

Requirements: JSON canonical; derived data clearly separated from raw evidence; every structural conclusion traceable to evidence; Phase 2 semantic maps and Phase 3 evidence untouched.

---

## 7. Determinism Requirements
- Node arrays sorted by id; edge arrays sorted by `(from,to,type,observed)`.
- Components sorted by (size desc, min-member asc); units re-indexed after sort.
- All graph/units/analysis files are **timestamp-free** so repeat runs are byte-identical. The only non-deterministic field (`generated_at`) lives in `manifest.json`.

---

## 8. Provenance Requirements
- Every edge references its source evidence + file + observed statement.
- Unresolved references survive as `unresolved_module` nodes.
- Raw Phase 3 evidence is read-only.

---

## 9. Explicit Non-Goals
- No Features, Systems, Relationships, or Flows.
- No semantic naming of clusters (e.g. `notion.ts` is never labeled "Notion System").
- No natural-language lookup.
- No AST/control-flow analysis.
- No modification of Phase 3 collector (only normalization in Phase 4A).

---

## 10. Known Limitations
- Internal module resolution is best-effort (regex/path heuristics); path aliases `@/` are not resolved.
- Entry-point reachability is weak because npm scripts / Python console-scripts are not anchored to modules.
- Orphan rate is high in both audited repos (most files import only externals); the useful signal is in the few large clusters + hubs, not the singletons.
- Generated-dir filtering is a Phase 4A normalization; ideally it should also happen in Phase 3 (`EXCLUSION_DIRS`).
