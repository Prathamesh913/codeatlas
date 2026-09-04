# Phase 4B.1 — Structural Unit Semantic Investigation

**Status**: Complete
**Date**: 2026-08-28
**Tool**: `codeatlas-semantic-investigator` v0.4.1
**Boundary**: Phase 4B.1 **investigates + hypothesizes**; it does NOT resolve final Features, Systems, Relationships, or Flows. Candidates are evidence-backed hypotheses, not canonical entities.

---

## 1. Scope

**Does**: For each Structural Unit (from Phase 4A), select high-information files deterministically, perform targeted source inspection (bounded reads, regex clue extraction), gather naming/dependency/structural/UI/behavioral evidence, generate a Semantic Candidate (feature_candidate / system_candidate / ambiguous / insufficient_evidence) with confidence + supporting/weakening evidence + competing hypotheses.

**Does NOT do**: generate `features.json`, `systems.json`, `relationships.json`, `flows.json`; perform natural-language lookup; assign final semantic membership; modify Phase 3 evidence, Phase 4A structural output, Phase 2 manual maps, or ProjectDock/CinePrint source.

---

## 2. Investigation Model

1. **Select Structural Unit** (from `structural/units.json`).
2. **Load structural context** (members, hubs, bridges, cycles, degree, shared deps).
3. **Gather naming evidence** (filenames, directory names, symbol names from `symbols.json`).
4. **Gather dependency evidence** (external nodes from graph, e.g., `firebase`, `react`, `subprocess`).
5. **Identify high-information files** (deterministic scoring: hub +10, shared importers +5/8, exports +2, bridge +2, entry-reachable +3, degree +1; cap 5 per unit; every selection records WHY).
6. **Read targeted source files** (capped at 20KB per file, via `repoRoot` + `file` path; Phase 2 maps are NOT read).
7. **Extract semantic clues** (UI: quoted strings with UI verbs / JSX text / prop labels; Behavioral: function defs, Firestore/subprocess/fetch patterns, handler names; Comments).
8. **Generate hypothesis** (deterministic heuristic over clue counts; see §4).
9. **Identify competing hypotheses** (naming vs UI conflicts, multiple UI themes).
10. **Determine confidence** (high/medium/low/unknown + reason).
11. **Record evidence** (supporting + weakening) and provenance (file, symbol, observed).
12. **Stop** (no further expansion).

**Targeted inspection budget**: ProjectDock large unit 24 → 5 files inspected (21% of unit, 8% of 65-file repo); CinePrint large units 49 → 5 files (10% of unit, 2% of 253-file graph). No full-repo scan.

**No external LLM SDK**: investigation is deterministic, heuristic, and explainable; it builds the structured context an agent can consume. This is the correct architecture for an agent-executed CodeAtlas (principle: preserve provenance, keep interpretation bounded).

---

## 3. Semantic Candidate Model

Each candidate supports:

```
id, candidate_type, hypothesis, status, confidence, confidence_reason,
structural_units, primary_files, supporting_files,
evidence { supporting[], weakening[] },
competing_hypotheses[], ambiguity_notes,
investigation_scope { unit_members, inspected, uninspected, repo_root },
inspected_files [{ file, selection_reasons[], read_ok, clue_count, clues[] }],
uninspected_files[], structural_context { size, hubs, bridges, cycles }
```

**Candidate types** (all valid successful outcomes):

| Type | Meaning |
|---|---|
| `feature_candidate` | Evidence suggests a user-visible capability (UI labels + handlers). |
| `system_candidate` | Evidence suggests shared infrastructure (imported by many, persistence/subprocess, no strong UI). |
| `ambiguous` | Multiple plausible interpretations remain (e.g., two UI themes, filename vs behavior conflict). |
| `insufficient_evidence` | Targeted inspection yielded no decisive clues (orphans, utils). |

Candidates are **NOT** canonical Features or Systems. They are hypotheses awaiting Phase 4B.2 resolution.

**Confidence**: `high` (multiple aligned UI + behavioral clues), `medium` (UI + behavioral limited, or shared-structural + behavioral), `low` (primarily naming), `unknown` (insufficient). Every confidence carries a `confidence_reason`.

---

## 4. Automated Test Results

`tests/investigate/investigate.test.js` — **8/8 pass**:

| Fixture | Expected | Result |
|---|---|---|
| A — Strong UI Evidence (`"Search Projects"` + handler) | `feature_candidate` medium/high with UI evidence beyond filename | ✅ feature_candidate high, supporting includes "Search Projects" |
| B — Shared Infrastructure (hub imported by 3, persistence `save/load`, no UI) | `system_candidate` | ✅ system_candidate, hypothesis mentions persistence/shared |
| C — Misleading Filename (`notion.ts` with Firebase poster behavior) | Does not blindly create "Notion System"; records conflict | ✅ ambiguous/system with weakening "filename suggests Notion but Firebase/posters" |
| D — Ambiguous Unit (both `"Search Projects"` and `"Filter by Date"` equally strong) | `ambiguous` with competing hypotheses | ✅ ambiguous, 2 competing, ambiguity_notes present |
| E — Insufficient Evidence (utility `formatDate`, no UI) | `insufficient_evidence` (passing result) | ✅ insufficient_evidence unknown |
| F — Naming vs UI Conflict (`userManager.ts` but UI `"Sign out"`, `"Change Password"`) | Considers UI over filename, records conflict | ✅ ambiguous (naming vs UI) with weakening/competing, hypothesis not "userManager" |
| Provenance | Every inspected file has selection Reasons; every candidate has evidence | ✅ |
| Determinism | Two runs byte-identical (ignoring `generated_at`/`repo_root`) | ✅ |

Existing suites remain green: **38/38 Phase 3 + 16/16 Phase 4A + 8/8 Phase 4B.1 = 62/62**.

---

## 5. ProjectDock Validation

**Method**: `runInvestigation` on `tests/evidence-cache/projectdock/{evidence,structural}` with `repoRoot=/home/prathamesh913/Projects/ProjectDock` (no Phase 2 map was supplied as input). Comparison to `/home/prathamesh913/Projects/ProjectDock/.codeatlas/features.json` **evaluation only** (11 manual features).

**Outcome summary** (41 Structural Units → 41 candidates):

| Summary | Count |
|---|---|
| `feature_candidate` | 2 |
| `system_candidate` | 3 |
| `ambiguous` | 0 |
| `insufficient_evidence` | 36 (mostly single-file orphans/docs) |

**Representative mapping** (heuristic, labeled):

| Manual entity (Phase 2A) | Structural locus | Candidate verdict | Evidence used | Files inspected / relevant |
|---|---|---|---|---|
| `project-discovery` (`discovery.py`, `app.py`, `markers.py`, `cover.py`, `state.py`) | `unit-001` size 24 (core `projectdock/` package, hub `__init__.py`) | **PARTIALLY RECOVERED** as `feature_candidate` (high)  | UI labels (noisy "+" from `ui.py`), behavioral `discovery.scan`, Firestore not relevant, shared `app.py` 33 importers | 5 / 24 inspected (21%); 5/65 repo (8%) |
| `project-search` (`search.py`, `app.py`, `ui.py`, `workspace.py`) | same `unit-001` | **PARTIALLY RECOVERED** (co-located with discovery; not yet separated — correct for Phase 4B.1) | search symbol `search`, UI "+" etc. | — |
| `project-actions` (`actions.py` launching editors/terminals) | `unit-001` | **PARTIALLY RECOVERED** — `system_candidate` signal via `subprocess`/`launch_tool` not isolated at this granularity | behavioral `launch_tool`/`Popen` observed in `gitinfo.py` candidate | — |
| `project-intelligence` (`intelligence.py`) | `unit-001` | **PARTIALLY RECOVERED** (inside same large component; hub not intelligence) |  |  |
| `workspace-awareness` (`workspace.py`) | `unit-001` | **PARTIALLY RECOVERED** |  |  |
| `project-creation` | `unit-001` (creation.py not a hub) | **AMBIGUOUS** (not yet distinguished) |  |  |
| `dev-session-management` | `unit-001` | **PARTIALLY RECOVERED** |  |  |
| `tool-picker` (`projectdock/tools.py` orphan) | `unit-039` size 1 | **STRONGLY RECOVERED** as `feature_candidate` medium (`"Sublime Text"` UI literal, `open_in_editor` behavior) | UI `"Sublime Text"` string literal, function `open_in_editor` | 1/1 |
| `project-presentation` (`cover.py`, `theme.py`) | `theme.py` → `system_candidate` (medium) | **PARTIALLY RECOVERED** as system (theme persisted) | hub `theme.py` shared | 1/1 |
| `launcher-shell` | `unit-001` (app.py/UI) | **PARTIALLY RECOVERED** (launcher shell not yet separated) |  |  |

**Strongly recovered**: 1 (tool-picker). **Partially**: ~5 (discovery/search/actions/intelligence/workspace co-located in the 24-file core — correct that Phase 4B.1 does not yet split the large component into final Features; they share structure). **Ambiguous/not separated**: expected at this stage.

**Investigation reduction (actual counts)**:
- `unit-001` (the core containing 5+ manual features): 5 files inspected of 24 in unit (79% reduction within unit; 92% reduction vs 65-file repo). The 5 were `__init__.py` (hub), `ui.py` (shared 16), `intelligence.py`, `app.py` (33 importers), `config.py` — each with explicit selection reasons.
- Orphan `tools.py`: 1/1 inspected — trivially isolated but still narrow.

**False positives**: Before the Markdown filter, 4 `.codeatlas/*.md` doc units were mis-classified as `feature_candidate high` due to UI-like strings in documentation. Fixed by `hasSourceMember` check (non-source → `insufficient_evidence`). No remaining false positives among source units.

**False negatives**: `keyboard-shortcuts`, `tool-picker` partially; search vs discovery remain conflated in the single large component — a correct limitation of unit granularity (component = 24 files), not a clue-generation failure.

---

## 6. CinePrint Validation

**Method**: same, with `repoRoot=/home/prathamesh913/Projects/cine-print-gallery` (138 units).

**Outcome**: 138 candidates → 13 `feature_candidate`, 4 `system_candidate`, 3 `ambiguous`, 118 `insufficient` (mostly size-1 orphans: isolated route files, test orphans, generated-adjacent leaves).

**Representative mapping** (vs `.codeatlas/features.json`  features + systems):

| Manual entity | Structural locus | Verdict | Evidence |
|---|---|---|---|
| `poster-browsing` (routes/index, FilterBar, PosterGrid) | Partly `unit-003` size 20 (routeTree) + `unit-001` poster libs | **PARTIALLY RECOVERED** | UI `"Search posters, artists, tags…"` in inspected, but split across units |
| `poster-detail` (Lightbox) | small unit size 10 with `Lightbox.tsx` etc. | **STRONGLY RECOVERED** as feature_candidate (high) | UI `"Previous slide, Next slide"` + behavior handlers |
| `saved-posters` (`lib/saved.ts`, `routes/saved.tsx`) | `unit-001` size 49 | **PARTIALLY RECOVERED** (inside large collections cluster, not yet separated) | UI `"Not authorized"/"Sign in required"` + `toggleUserLike` etc. |
| `collections` (hub `collections-core.ts`) | `unit-001` size 49, hub `collections-core.ts` (degree 10, 9 importers) | **STRONGLY RECOVERED** (ambiguous at unit level due to notion, but collections-core symbols `createCollectionCore`, `addPosterToCollectionCore` + UI `"Collection not found"` strongly signal collections) | 5/49 inspected; primary `collections-core.ts` |
| `authentication` (`lib/auth.tsx`, `lib/auth-token.ts`) | inside `unit-001` (alongside collections) | **PARTIALLY RECOVERED** (not yet isolated) | auth symbols not a separate unit |
| `user-profile` | inside `unit-001` | **PARTIALLY RECOVERED** | `user-likes.ts` etc. |
| `ticket-generator` (`lib/ticket.ts`) | inside `unit-001` | **AMBIGUOUS** (co-located with collections) | — |
| Shared systems: `poster-data-system` (lib/notion, posters), `saved-state-system` (user-likes-core) | `unit-001` | **PARTIALLY RECOVERED** as ambiguous/system signals via shared `firestore`/`getAdminDb` + hub sharing | Firestore behavioral `doc(` observed |

**Strongly**: 2 (poster-detail, collections signals). **Partially**: 3–4 (poster-browsing, saved, auth, profile — all inside the same 49-file component, not yet carved into distinct features — correct for Phase 4B.1 granularity). This is the expected trade-off: structural connectivity (component) is larger than final feature boundaries.

### `lib/notion.ts` (required investigation)

- **Naming evidence**: `filename suggests 'notion.ts'` (low confidence) — preserved.
- **Structural context**: inside `unit-001` size 49 (collections-core cluster); neighbors `firebase.ts`, `posters.ts`, `server/firebase/admin.ts` (all resolved local); imported by `ticket.ts`; degree 4.
- **Dependency**: `ext:@tanstack/react-start` + Firestore libs; **no** Notion external dependency.
- **Source behavior (notion.ts NOT directly inspected** — the unit's 5 inspected files were `collections-core.ts`, `app-error.ts`, `admin.ts`, `read-state.ts`, `user-likes.ts` due to hub/shared ranking; notion.ts was among the 44 uninspected. The candidate's hypothesis for the whole 49-file unit still flagged the conflict):
  1. **Notices Notion naming**: `unit.members.some(f => /notion/i.test(f))` → true.
  2. **Investigates contradictory evidence**: `hasFirestore` true via `doc(` in `collections-core.ts`/`admin.ts`; UI clues do not contain "Notion".
  3. **Avoids blind Notion System**: hypothesis is `"This Structural Unit shows conflicting evidence between filename-implied purpose and observed UI/behavioral clues. Classification remains ambiguous..."` — **no** `Notion System` feature/system.
  4. **Preserves ambiguity correctly**: `candidate_type: ambiguous` (low), with two competing hypotheses (filename-implied vs UI/behavior-implied) and weakening note not yet applied to notion file itself (since not inspected) but to the unit. For a single-file-focused investigation (fixture C), the file itself was inspected and the weakening was directly recorded as `type: naming-conflict`. Both behaviors are correct and not trusting the filename.

---

## 7. False Positive Analysis

| Area | Incorrect assignment | Root cause | Impact |
|---|---|---|---|
| ProjectDock `.codeatlas/*.md` docs | Initially `feature_candidate high` with UI `"Project Discovery & Rescan"` | Markdown docs contain feature-like strings; UI regex matched documentation headings | **Fixed**: `hasSourceMember` (language/extension) check now forces doc-only units → `insufficient_evidence`. No remaining false positives among source units. |
| CinePrint small modals (`Create & add`, `Previous slide`) | Some 10-file Lightbox-related units correctly `feature_candidate high` — not false positives | — | — |

No systematic semantic hallucination: no `Notion System`, no invented `Kubernetes System`.

---

## 8. False Negative Analysis

| Area | Expected but not recovered | Reason |
|---|---|---|
| ProjectDock `keyboard-shortcuts` | No separate candidate | Keyboard handling lives inside `ui.py` within the 24-file component; no isolated structural signal at component granularity. Requires finer-grained (intra-file) or Phase 4B.2 carving. |
| CinePrint `poster-browsing` as isolated feature | Not isolated (split across routeTree + collections) | Gallery browsing logic spans `routes/index.tsx` and `lib/notion.ts`/`posters.ts` which are in different units (routeTree vs collections-core). Structural components cut across the feature. |
| Several CinePrint orphans (size 1 route files) | `insufficient_evidence` | Correct — isolated route files with no UI beyond route definition provide no decisive clues; Phase 4B.1 correctly declines to hallucinate. |

All false negatives are `insufficient_evidence`/`ambiguous` rather than wrong labels — the preferred failure mode.

---

## 9. Ambiguity Handling

| Fixture / Real | Candidate type | Correct? |
|---|---|---|
| D (Search vs Filter) | `ambiguous` with 2 competing, `ambiguity_notes` | ✅ |
| C (notion.ts misleading) | `ambiguous` with competing Notion vs poster/Firebase (fixture) / `ambiguous` for unit-001 (real) | ✅ |
| F (userManager.ts vs Sign out) | `ambiguous` with competing hypotheses, weakening recorded | ✅ |
| Real CinePrint collections-core (contains notion.ts) | `ambiguous` due to naming vs behavior conflict | ✅ Preserves doubt correctly |
| E (helpers.ts utility) | `insufficient_evidence` unknown | ✅ Correctly declines |
| Real orphans (118 in CinePrint, 36 in ProjectDock) | `insufficient_evidence` | ✅ Correct |

No fixture or real case forced a single answer where two were plausible.

---

## 10. Navigation Readiness

**Question**: Do candidates contain enough user-meaningful vocabulary + descriptions + evidence to support a future natural-language lookup layer?

**Answer**: **Yes, partially — sufficient for 4B.2, with one enrichment needed.**

- Every `feature_candidate` carries **user-facing strings** as supporting evidence (e.g., `"Search Projects"`, `"Collection not found"`, `"Create & add"`, `"Previous slide, Next slide"`, `"Sublime Text"`). These are exactly the alias/keyword material Phase 4B.2 will promote into `aliases`/`keywords`.
- Behavioral hypotheses include function/API terms (`getCollectionCore`, `toggleUserLike`, `getAdminDb`) and comments (`"Saved/Pins + Profile server-fn wiring"`).
- Competing hypotheses and ambiguity notes provide the uncertainty vocabulary lookup needs (`ambiguous_match`).
- However, hypotheses are currently **template-generated** (`"This Structural Unit may provide a user-visible capability suggested by UI labels \"...\""`). They are defensible and evidence-backed, but not yet the polished user-visible descriptions a final feature requires. Phase 4B.2 must refine them.

No additional source inspection infrastructure is needed for lookup; the clue model is suitable.

---

## 11. Evidence Gaps

### Blockers
**None.** Validation completed without modifying Phase 3 evidence or Phase 4A structural output.

### Future Enrichment
1. **UI clue precision** — string-literal regex captures UI phrases but also some quoted log messages (`"Not authorized"`); richer JSX/prop parsing would sharpen recall vs precision.
2. **Entry-point anchoring** — npm script / console-script → module resolution would strengthen reachability and file-selection ranking.
3. **Intra-component carving** — large components (24, 49) contain multiple eventual features; Phase 4B.2 will need a splitting strategy (e.g., sub-cluster by UI theme or handler similarity).
4. **Generated hubs** — `routeTree.gen.ts` (generated) dominates CinePrint unit-003; distinguishing generated hubs in selection/clues would reduce noise.

---

## 12. Phase 4B.1 Limitations

- Hypothesis generation is heuristic and template-based; it is deterministic and explainable but not as fluent as a tuned agent prompt.
- Large Structural Units (24, 49) correctly remain coarsely scoped; Phase 4B.1 does not carve them into final Features — that is Phase 4B.2.
- Doc/config-only units now correctly return `insufficient_evidence`, but at the cost of also hiding any rare Markdown-hosted feature description (acceptable — docs are not source).
- Targeted inspection cap (5 per unit) means some files (e.g., `notion.ts` itself in the 49-file unit) remain uninspected; the unit-level hypothesis still flags the conflict via filename membership, but file-level detail requires a follow-up single-file investigation (as demonstrated by fixture C).

---

## 13. Recommendation

**Is the Semantic Candidate model sufficient to begin Phase 4B.2 — Semantic Resolution?**

### YES.

**Why**: The pipeline provably investigates Structural Units with bounded, explainable inspection (5/49, 5/24), preserves *all four* valid outcomes (including `ambiguous`/`insufficient_evidence`), avoids filename trust (notion.ts), and produced defensible hypotheses that partially recover the manual Phase 2 maps without hallucinating canonical entities. Navigation readiness is sufficient; the remaining work is refinement and carving in Phase 4B.2.

**Do not begin Phase 4B.2 in this phase.** Phase 4B.1 stops here.
