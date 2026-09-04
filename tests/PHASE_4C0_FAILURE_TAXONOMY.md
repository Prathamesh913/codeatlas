# Phase 4C.0 — Failure Taxonomy (Evidence & Semantic Quality)

**Status**: Complete (design only — no implementation)
**Date**: 2026-08-29
**Primary evidence**: Phase 4B.2 generated outputs (`tests/evidence-cache/<repo>/validation/semantic/`),
their provenance records, Phase 4B.1 candidates, Phase 4A/3 artifacts, and the Phase 2A/2B oracles
(used as evaluation reference only). All counts below were re-derived from the artifacts, not summarized.

**Baseline being classified** (Phase 4B.2, v0.4.3):

| | ProjectDock | CinePrint |
|---|---|---|
| Files inspected (4B.1+4B.2) | 49/65 (75.4%) | 206/253 (81.4%) |
| Canonical entities | 5 features, 3 systems | 22 features, 19 systems |
| Ambiguous / unresolved | 2 / 7 | 7 / 9 |
| Relationships | 0 | 32 |
| Measured false-positive/misnamed entities | ≥5 of 8 | ~21 of 41 |
| Conflations (distinct capabilities merged) | 1 (`system-pid`) | 2 (`feature-context`, `feature-service`) |

---

## 1. Primary Question

Phase 4B.2 proved **D-012: structural boundary ≠ semantic boundary**. Phase 4C.0 asks whether
**SEMANTIC REGION ≠ CANONICAL ENTITY** is also true.

**Answer: YES — validated against the 4B.2 artifacts.** The 57 CinePrint regions and 17
ProjectDock regions resolve into entities of every possible mismatch class:

| Region role in 4B.2 output | Real example |
|---|---|
| Fragment of one Feature | `region-017 save` and `region-030 login` are parts of the oracle's saved-posters / authentication |
| Fragment of one System | `region-025 firebase`, `region-037 poster`, `region-034 notion` are all parts of oracle poster-data-system |
| Complete entity | `region-001 collection` ≈ oracle collections feature (no further merge needed) |
| Ambiguous | `region-009/010/012` (PD actions/intelligence), CP auth client/server |
| Implementation noise | `region-053/056` (error/download automation systems), `region-026 found` |

Because regions span fragment/noise/complete/ambiguous classes, a stage between CARVE and
CANONICAL RESOLUTION that re-partitions regions by shared responsibility is *conditionally*
required — the condition (consolidation decision) is evaluated in
`tests/PHASE_4C_ARCHITECTURE_PROPOSAL.md` §2.

---

## 2. Taxonomy

Categories A–I, each grounded in concrete 4B.2 entities. Counts are entities touched, not
incidents.

### A. Observation Failures — raw evidence incomplete/incorrect (9 findings)

| # | Finding | Evidence | Would better observation solve it? |
|---|---|---|---|
| A1 | **Python relative imports invisible.** `collectPythonImports` patterns (`^from\s+(\w+(?:\.\w+)*)`, `^import\s+(\w+…)`) cannot match a leading dot. `from . import actions, commands, …` (app.py imports 14 siblings) produces **no record at all** — not even `unresolved`. 0 of 290 PD import records has a leading-dot target; the real code has 25+ relative-import lines across 8 production files. | `imports.json` app.py: 11 records, all stdlib; real `app.py` line 22 | **YES — root cause.** Production import graph is empty; the 24-file "core unit" is held together by test imports and `__init__.py`. Directly explains PD relationships = 0 and fragmentary regions. |
| A2 | Absolute package-style internal imports observed but unresolved (`projectdock.cli`). Known since Phase 3/4A; Phase 4A normalization re-resolves 89 edges. | 4A Evidence Audit §3 | Partially — already mitigated downstream; collection-time resolution still recommended (self-contained evidence). |
| A3 | Co-located test files (`*.test.ts`) collected as ordinary source. Only `tests/` directory is excluded. | region-007 primary = 2 `.test.ts` + 1 source; region-016, region-002 include tests | **YES** — they became region *primary* members. |
| A4 | `automation/` and `scripts/` build/ops code collected without any relevance marker. | 7 automation-flavored CP systems; ambiguous-prop/outcome/external/search | **YES** — no layer can currently distinguish "app capability" from "build tooling". |
| A5 | Generated artifacts (`routeTree.gen.ts`) kept as structural hubs. Known/accepted in 4A; still excluded from carve but pollutes selection ranking. | 4A validation §7 | Partially — handled by `GENERATED_RE` at carve; selection still favors them. |
| A6 | UI text extracted without classification: empty states, errors, loading strings, page `<title>` metadata, marketing text all enter as `ui` clues. | `clues.js` propRe captures `title="ProjectDock"`; jsxRe (confidence **high**) captures "No posters found" | **YES** — the single most consequential classification gap (feeds B/C/F). |
| A7 | Investigator contains **repo-specific hardcoding**: `apiPatterns` includes `fetchNotionPosters|loadPublishedPosters|submitPosterToNotion`; `isUiLike` verb list includes `Poster|Collection|Project|Profile|Ticket|Notion`. | `clues.js` | **YES** — genericity violation; inflates CinePrint confidence and would not transfer to a third repo. |
| A8 | Python UI labels under-extracted (GTK label tuples not matched); PD `actions.py` read in 4B.2 returned 13 behavioral / 0 UI clues. | resolution-report additional_inspection_log | **YES** — contributes to PD action/intelligence ambiguity. |
| A9 | Path aliases (`@/`) unresolved; CinePrint internal edges missing in a few places. | 4A audit | Partially — minor edge loss. |

### B. Evidence Classification Failures — valid signal, semantically overweighted

| # | Entity | Signal that misfired | Overweighting mechanism |
|---|---|---|---|
| B1 | CP `feature-found` | "No posters found" empty-state JSX text (extraction confidence **high**) | Empty-state treated as capability identity; became region seed term |
| B2 | CP `feature-artist-2` | "Cineprint manifesto" marketing prose | Same path as B1 |
| B3 | CP `feature-preview` | "Retry preview" error-recovery text in GalleryErrorBoundary | Error state → capability |
| B4 | CP `feature-lobby` | "Back to lobby" navigation chrome in `__root.tsx` | Navigation fragment → capability |
| B5 | CP `feature-ticket` alias | "bebas neue" (font-family string) | Any quoted string can become an alias |
| B6 | CP ambiguous-prop/outcome/external/search | String literals in **automation** scripts counted as user-visible labels | `scoreRegion` counts `distinctLabels` from *all* ui clues; the naming guard excludes low-confidence literals but feature scoring does not — the same signal set is treated inconsistently inside one file |
| B7 | PD `feature-printable` | Filename/symbol tokens ("printable" — a key-press helper) outvoted visible labels ("ProjectDock", "rescan projects", "open config") because label vocabulary is proper nouns/verbs excluded from naming while symbols are eligible | Naming-source priority inverted (symbols above UI vocabulary for Python files) |

### C. Semantic Fragmentation Failures — one capability, too many entities

| # | Capability | Fragments produced | Oracle |
|---|---|---|---|
| C1 | CP authentication | `feature-login` + `ambiguous-auth` (auth.tsx, server-auth.ts) + `system-auth` (auth-initialization.ts) + `system-auth-middleware` (+ `system-admin`) | 1 feature + 1 system |
| C2 | CP poster browsing | `feature-tag` (Header) + `feature-artist` (FilterBar+artist-hero) + `feature-poster` (artist/$slug) + `feature-found` (index.tsx) | 1 feature (+artist-portfolio separate) |
| C3 | CP poster data | `system-poster` (notion.ts) + `system-artist` (posters.ts) + `system-firestore` | 1 system |
| C4 | CP server infra | `system-app-error` + `system-error-response` (+ context/logging misfiled into feature-context) | 1 system |
| C5 | PD project-discovery | `feature-rescan` (app.py) + `feature-root` (discovery.py) | 1 feature |
| C6 | CP artist-portfolio | `feature-poster` + artist-hero inside `feature-artist` | 1 feature |

Measured driver: carving is per-file token affinity with a one-file-per-region fallback for
infra-shaped files and **no cross-region merge pass**; files with weak evidence (auth-initialization,
Header vs FilterBar) can never re-attach.

### D. Semantic Conflation Failures — distinct capabilities merged

| # | Entity | Members | Why wrong | Shared signal |
|---|---|---|---|---|
| D1 | CP `feature-context` | ContextMenu.tsx + server/request/context.ts (+ logging, PosterGrid as support) | UI context menu ≠ server request context | generic token "context" |
| D2 | CP `feature-service` | automation/tmdb/service.ts + service-account.ts + test | TMDB client config ≠ Firebase service account | generic token "service" |
| D3 | PD `system-pid` | hyprland.py + sessions.py | workspace/window awareness ≠ dev-session management | plumbing vocabulary "pid" |

All three: **shared dependency/vocabulary ≠ shared semantic responsibility.** None had shared user
intent, shared state, or complementary layers.

### E. Entity Classification Failures — correct boundary, wrong Feature/System type

| # | Entity | Issue |
|---|---|---|
| E1 | PD `system-workspace` | Oracle: user-visible capability (workspace awareness) |
| E2 | PD `system-tool` | Oracle: keyboard-first user feature (tool picker) |
| E3 | CP `system-like` | Plausible but extra vs oracle (oracle nests likes under saved-state) — granularity divergence, borderline |
| E4 | PD `system-pid` (also D3) | Both capabilities are user-facing features in the oracle |

### F. Naming Failures — correct entity, unusable name

| # | Entity | Generated name | Should express |
|---|---|---|---|
| F1 | PD search.py region | "Score" | Project Search (symbol "score" is internal ranking) |
| F2 | CP index.tsx region | "Found" | Poster browsing / gallery (also B1 — boundary wrong here) |
| F3 | CP posters.ts region | "Artist" (system) | Poster data core (symbol vocabulary bias) |
| F4 | CP notion.ts region | correctly renamed Poster, but `technical_role` still says "Shared **notion** capability" | seed-term leak into projection |
| F5 | PD sessions+hyprland | "Pid" | Dev Sessions / Workspace Awareness |
| F6 | CP artist-hero+FilterBar | "Artist" (id-collided "Artist 2" elsewhere) | search/filter vs portfolio hero |
| F7 | id collisions | `feature-artist-2`, `system-poster(-2)` | duplicate-slug disambiguation is mechanical, not semantic |

### G. Description Failures — correct entity, unusable description

| # | Entity | Generated | Problem |
|---|---|---|---|
| G1 | CP `feature-save` | "Lets users save and load drains and users" | object noun from symbol artifact ("drain") |
| G2 | CP `feature-found` | "Presents founds in the interface" | gibberish noun |
| G3 | CP `feature-lightbox` | "Presents lightbox in the interface. The interface labels it 'close'." | object = technical component name; label is generic control text |
| G4 | PD `feature-creation` | "Lets users create and choose creations" | stilted; "creations" not user vocabulary |
| G5 | All systems | Fixed template "Shared X capability for N other implementation areas…" | acceptable shape but X leaks seed terms (F4) and no domain behavior verbs |
| G6 | PD features | `user_interactions` = synthesized "Recognized user phrasing: …" strings | not actual interactions; padding |

### H. Projection Failures — correct internal data lost in output

| # | Finding | Evidence |
|---|---|---|
| H1 | Systems lose `aliases`/`keywords` in the systems.json mapping (the resolved entity HAS them; index.js systems projection drops them). `system-poster` naming conflict therefore has no exposed "notion" alias. | `system-poster` output object: aliases/keywords undefined; `system.schema.json` **already declares** `aliases`+`keywords` — pure contract violation |
| H2 | `technical_role` built from pre-guard seed term `e.term`, contradicting the renamed `name` in the same object | notion.ts → system-poster |
| H3 | `source_structural_units` absent from features.json projection (present internally); consumers can't see D-012 provenance without opening regions.json | features mapping |
| H4 | Region split/merge counters undercount (`units_split_into_multiple_regions`: 1 PD / 4 CP vs measured 6+ / 9+) | counter counts only units with >1 region primary-file overlap |
| H5 | PD `feature-rescan`'s supporting files include none of the modules app.py actually orchestrates — because A1 removed the edges that would have attached them | regions.json |

### I. Inspection Efficiency Failures — why 206/253 (81.4%)?

Measured decomposition of CinePrint inspection:

| Class | Reads | Share | Decision value |
|---|---|---|---|
| 4B.1 singleton-unit fallback reads | 133 | 52.6% of total | 15 produced the feature/system candidates that seeded canonical entities; **118 (89%) returned `insufficient_evidence`** |
| 4B.1 multi-file unit reads (caps 5) | 20 | 7.9% | Mostly confirmatory (collections/notion conflict, automation pipeline) |
| 4B.2 additional reads into `automation/`+`scripts/` noise regions | 23 | 9.1% | Decisions about regions that should never have been carved — a relevance filter decides these without reads |
| 4B.2 additional reads for feature/system tie-breaks that stayed ambiguous | 13 | 5.1% | Null value: the missing evidence type does not exist in those files (server/config files queried for UI text) |
| 4B.2 additional reads that informed real canonical entities | ~18 | 7.1% | High value (profile, save, submit, login, ticket, notion, …) |
| 4B.1 evidence reused at 4B.2 (no new read) | 153 cumulative | — | Correct reuse |

Root cause: `selectHighInformationFiles` ranks **file importance** (hubs, degree, importers) and
the budget is per-unit coverage ("cap 5, or all if unit small", singleton fallback reads the
sole member). It never asks *which decision is open and which file can change it*. 4B.2's
question-driven log is a step in the right direction but still reads without predicting whether
the file can carry the missing evidence type. ProjectDock is the same shape (39/46 singleton
reads; 36 → insufficient_evidence).

---

## 3. Failure → Cause → Remediation Matrix

Upstream = fix belongs at observation/classification layer; Downstream = fix belongs at
consolidation/resolution/projection layer. No implementation is proposed here.

| Failure | Repo | Category | Root Cause | Upstream/Downstream | Candidate Fix | Risk |
|---|---|---|---|---|---|---|
| `feature-found` | CP | B/C/F | Empty-state text promoted to capability identity | Upstream | UI text taxonomy (state signals never seed) | Suppressing genuine UI-only features |
| `feature-artist-2` | CP | B | Marketing prose + id collision | Upstream (incidental class) + Downstream (slug dedupe) | Incidental-content class; semantic id dedupe | Over-filtering distinctive copy |
| `feature-preview`, `feature-lobby`, `feature-palette`, `feature-url`, `feature-page` | CP | B | Error/nav/build literals as capability evidence | Upstream | State/incidental classification | Losing retry-flow capabilities hidden in error text (mitigate: support-only weight) |
| automation Systems (`types/env/client/…`) | CP | A/D | No semantic-relevance distinction | Upstream | Relevance classes (application/test/automation/generated) gating seeding | Hiding a genuine capability that lives in a "scripts" dir (mitigate: downweight, don't delete; escape hatch via direct importers) |
| ambiguous-prop/outcome/external/search inflation | CP | B | Automation literals counted as labels in scoring (inconsistent with naming guard) | Upstream classification; Downstream consistency | Classify once at annotation; all consumers obey | Layer bypass if any consumer keeps raw text |
| authentication split | CP | C | Regions resolved without consolidation | Downstream | Consolidation stage (merge evidence) | Over-merging with profile/ticket (anti-merge evidence needed) |
| browsing split | CP | C | Search vocabulary split across Header/FilterBar/index; empty-state seeded wrong core | Downstream + Upstream | Consolidation + B1 fix | Re-merging artist-portfolio (anti-merge: distinct route/goal) |
| poster-data split | CP | C | notion.ts and posters.ts never unioned despite direct import edge; posters.ts misnamed | Downstream | Consolidation (complementary layers + direct edge evidence) | Pulling firestore-db into poster-data (it is generic persistence) |
| server-infra split + context theft | CP | C/D | Two error systems; context/logging attached to UI ContextMenu | Downstream | Consolidation incl. separating feature-context's server half | None significant |
| `feature-context` | CP | D | Generic token across layers | Downstream | Anti-merge evidence: layer mismatch + distinct user goals | False anti-merge on legitimately cross-layer features (auth) — distinguish "same responsibility across layers" from "same word in different layers" |
| `feature-service` | CP | D | Generic token + automation files | Upstream relevance + Downstream anti-merge (generic-name class) | Relevance filter + generic-vocabulary anti-merge rule | tmdb service.ts legitimately named (it *is* a TMDB service) — must resolve as automation, not merge with Firebase |
| `system-pid` | PD | D/E | Plumbing vocabulary over generic token | Downstream | Anti-merge: distinct user goals, no shared state | sessions+hyprland genuinely interact via pids — require user-intent evidence to merge, else separate |
| `feature-score` | PD | F | Internal symbol family outranked user vocabulary for naming | Downstream | Naming source priority (user actions > routes > domain > symbols > filenames) | Names drift from code identifiers (mitigate: keep symbol as alias/keyword) |
| `feature-printable` | PD | B/F | Whole-UI file named by symbol; labels not extracted (A8) | Upstream (GTK label extraction) + Downstream (naming priority) | Both | — |
| `system-artist` | CP | F/C | Symbol-vocabulary seeding of infra-shaped file | Downstream | Behavior term + consumer vocabulary dominate infra naming | — |
| Systems lose aliases/keywords | both | H | Projection drops fields the schema allows | Downstream | Projection completeness fix | None |
| `technical_role` seed leak | CP | H/F | Projection builds from pre-guard term | Downstream | Projection uses resolved naming | None |
| PD relationships = 0 | PD | A | Relative imports unobserved → no cross-region edges | Upstream | A1 fix; relationships regenerate | False edges from over-eager resolution (preserve unresolved; resolve only into inventory) |
| 81.4% inspection | CP | I | Importance-ranked, per-unit coverage reads; no question-value gate | Downstream (investigate/resolve selection) | Value-of-information inspection queue | Under-reading real ties (mitigate: read whenever a question has a candidate file that can answer it) |
| PD weak recovery | PD | A+B | Missing production edges + under-extracted GTK UI strings | Upstream | A1 + A8 | — |

---

## 4. Category Rollup

| Category | Distinct failures | Dominant repos | Layer |
|---|---|---|---|
| A. Observation | 9 | PD (imports), CP (relevance) | Upstream |
| B. Evidence classification | 7 | CP | Upstream (annotate) |
| C. Fragmentation | 6 capabilities | CP (5), PD (1) | Downstream (consolidation) |
| D. Conflation | 3 | both | Downstream (anti-merge) |
| E. Type misclassification | 4 | PD (3), CP (1) | Downstream (resolution) |
| F. Naming | 7 | both | Downstream (resolution/projection) |
| G. Description | 6 | both | Downstream (resolution/projection) |
| H. Projection | 5 | both | Downstream (projection) |
| I. Inspection efficiency | 1 systemic | CP (severe), PD | Downstream (selection) |

Separation of concerns for the proposal:

- **Upstream evidence defects** (A, B): fixed by Phase 3 collector v2 + one new evidence
  annotation stage. These are *enabling* fixes — several downstream failures (B6→D2, A1→C5/H5,
  A3/A4→C) shrink automatically once inputs are correct.
- **Semantic resolution defects** (C, D, E, I): fixed by one new consolidation stage + hardened
  resolution/selection. Consolidation must output merges, non-merges, and separations.
- **Projection/naming defects** (F, G, H): fixed inside canonical resolution/projection; no new
  stage warranted.

No category requires LLM interpretation, lookup, or flow generation.
