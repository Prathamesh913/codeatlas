# CodeAtlas Progress

## Project Vision
CodeAtlas is an agent-first codebase intelligence and semantic navigation system. It establishes a persistent, machine-readable, and human-navigable semantic map of a codebase, bridging the gap between human-understandable concepts (what a user sees, experiences, and interacts with) and technical implementations (files, components, routes, and data flow). This minimizes repeated full-codebase scanning and exploration for both human developers and AI coding agents.

## Core Principles
1. **Agent-First, Human-Readable**: Canonical data is structured in JSON for precise machine and agent consumption, while clean Markdown files are generated for human developers.
2. **Prioritize User Experience (Semantic-First)**: Emphasize what a feature does and how a user interacts with it, rather than focusing purely on technical implementation mechanics.
3. **Evidence vs. Interpretation**: Distinguish between hard static facts (such as imports and routes) and cognitive interpretations (such as grouping and intent mapping) by using explicit confidence levels and notes.
4. **Incremental and Evolutionary**: Build modularly. Define the data model and structural contracts before implementing automated analysis, synchronization, or CLI tools.
5. **No Overengineering**: Rely on standard, language-agnostic data structures and patterns rather than complex, lock-in dependencies or heavy database layers.

## Architecture Decisions

> The architecture decision record lives in `DECISIONS.md` (D-001 and later).
>
> Phase 5A (D-030) migrated the full D-001…D-023 text verbatim from this section into
> `DECISIONS.md`; this section is now a pointer so the record has a single home.

## Current Phase
### Phase 5A2 — GitHub Publication Preparation
**Status**: Complete (documentation + repository-productization; nothing published)

Delivered: README expanded for GitHub discovery (all generation artifacts incl.
`evidence/manifest.json` + INDEX.md query index, concept glossary, pipeline stages,
trust model, not-claims, maturity incl. ProjectDock/CinePrint + unfamiliar-repo gap,
install/usage/uninstall/troubleshooting/contribution/issue/private-beta/security/roadmap/
citation; the previous `npx codeatlas` example removed — npm availability does not
exist); `docs/{installation,uninstallation,usage,private-beta,release-readiness}.md`;
`CONTRIBUTING.md`, `SECURITY.md` (no invented contact; interim private-beta process),
`CODE_OF_CONDUCT.md` (Contributor Covenant 2.1, enforcement contact honestly absent),
`CHANGELOG.md`; `.github/` with 4 issue templates, PR template, offline CI (Node 18:
suite + CLI contract + whitelist + determinism/source-safe smoke; never publish);
`tests/docs/` extended 21→80 (repository file checks, local-link resolution,
npm-availability honesty, uninstall accuracy, template sanity, changelog/security/CI
accuracy). Decisions D-031/D-032. Suite 284/73/0; tarball still 54 files, 0
test/fixture/evidence content. Nothing pushed, published, or released — release blocked
pending owner license confirmation. See `tests/PHASE_5A2_GITHUB_PUBLICATION.md`.

### Phase 5A — Productization Foundation
**Status**: Complete (private-beta foundation; no 5B started)

Delivered: Git baseline (`20c33a9`, tag `v0.4.0-core-verified`) with a `.gitignore`
covering evidence caches, package artifacts, and local-only files; unified
`codeatlas` CLI (`bin/codeatlas.js`, 10 CLI tests) orchestrating all 8 stages with
`--help`/`--version`/`--output`, concise progress, and exit-code discipline; package
metadata (0.5.0, MIT provisional per D-027, `bin`, keywords, `files` whitelist:
54 files / ~108 kB, down from 205 / ~884 kB); rewritten README for private-beta
developers; regenerated honest examples (`sample-output/` from the real pipeline,
`minimal/` end-to-end walkthrough, obsolete `flows.json` removed); docs consistency
tests; full PD + CP validation under `phase-5a/` via the unified CLI itself (PD 3F/10S,
CP 15F/7S — matching 4C.3); decisions D-024…D-030 incl. the `DECISIONS.md` migration.
Full suite green. See `tests/PHASE_5A_PRODUCTIZATION.md`.

### Phase 4C.3 — Naming, Typing, VOI Inspection, and Projection Completeness
**Status**: Complete (implementation + real-corpus validation + regression gate; 4C.4 not started)

Delivered:
- `src/canonical/{index,voi,naming,typing,describe,cli}.js` — canonical-resolution stage:
  question-driven VOI inspection (D-023: 5 question classes, evidence-first, budget 2/read
  question + 40/repo, full decision log with `would_resolve_with`), tiered naming authority
  (D-022: T1 capability labels → phrase names, T2 consolidation shared vocabulary, T4
  technical fallback; seed-relatedness/exclusivity guards; previous names → aliases,
  technical terms → `implementation_terms`; renames recorded with rejected candidates),
  conservative type review (T1/T2/T3 guards, uncertainty preserved), evidence-grounded
  description templates per entity kind.
- `src/project/render.js` — the first Markdown projector (INDEX query index with
  technical→canonical mapping, per-entity pages, unresolved.md, ARCHITECTURE.md);
  deterministic; R11 completeness tests (every entity has a page, no fabricated pages,
  valid references, unresolved never omitted, aliases resolve, byte-identical re-render).
- Validated corpus (isolated `tests/evidence-cache/<repo>/phase-4c3/`): CP 23→22 canonical
  (feature-lobby reclassified as shell context by VOI; browsing "Search Artist", submit
  "Submit Poster", poster-data "Poster" — 4 T1/T2 renames recorded); PD 13 canonical,
  2 T2 renames, technical names honestly retained; all 4C.2 merges behavior-confirmed by
  reading; server-infra keep_separate recorded with would-resolve-with; inspection budget
  held (11/40 PD, 26/40 CP). Determinism: two full runs byte-identical (report input-path
  provenance only difference).
- Unfamiliar-repo smoke fixtures (`smoke-react-app`, `smoke-python-cli`): full pipeline →
  no crashes, no source mutation, valid deterministic output, complete projections.
- Regression gate R1–R12 complete (mapping in `tests/PHASE_4C3_FINAL.md` §10).
- Full suite **194/194** (58 suites). Integrity: 495-file protected manifest 0 changes;
  repos 0 drift; oracle maps untouched. `tests/PHASE_4C3_FINAL.md`; decisions D-022/D-023.

### Phase 4C.2 — Consolidation
**Status**: Complete (implementation + real-codebase validation; 4C.3 not started)

Objective: a dedicated consolidation stage consuming the annotation layer to reduce
fragmentation, conflation, and false-positive entities before final canonical projection —
without modifying any earlier stage and without starting 4C.3.

Delivered:
- `src/consolidate/{index,rules,ids,cli}.js` — deterministic, read-only consolidator
  (D-013 contract): entity models from annotation + graph + clues; demotions D0/D1/D2/D3
  (never delete — `demoted_false_positive` entries with misleading strings recorded);
  separations with vocabulary/filename-stem bridges (D-012 protected); merge ladder
  S1/S1b/S3/S5 with AM1/AM2/AM3 anti-merge vetoes; mixed-type groups split by layer with
  external-consumer check; collision-safe id minting (D-021); relationships remapped over
  consolidation with drops recorded.
- Consumes annotation explicitly (D-019): relevance classes gate anchoring/noise/merge
  participation; string classes drive seed legality, demotion evidence, merge signals, and
  naming; mechanical flags consumed verbatim through the annotation layer. Decisions flip
  when annotation changes (tested).
- `tests/consolidation/consolidation.test.js` (24 tests: all mandated regression cases +
  full-pipeline integration over `tests/fixtures/consolidate-app/`). Full suite
  **162/162** (all 138 pre-existing tests unmodified).
- Real-corpus validation into isolated `tests/evidence-cache/<repo>/phase-4c2/` (fresh
  pipeline; checkpoint artifacts untouched — 479-file protected manifest, 0 changes):
  - **CinePrint**: 41 → 23 canonical entities. 14 demotions (9 noise-anchored D0 systems;
    `feature-found`/`feature-preview`/`feature-poster` D1 state-seeded; `system-firebase`
    D1; `feature-artist-2` D2 duplicate), `feature-context` conflation **split**
    (server/request/context.ts separated), auth fragments consolidated 4→1 system (S5),
    browsing fragments merged (S1), poster-data consolidated (S5; notion.ts absorbed),
    collections/save/submit/profile strong recoveries preserved whole (non-split guards).
    `feature-lobby` remains (context-seeded shell — recorded for 4C.3/VOI, not deleted).
  - **ProjectDock**: 15 → 13 canonical; 3 evidence-backed module merges (S5);
    `ambiguous-editor` preserved; 0 demotions (all modules hold behavioral evidence).
  - Determinism: two complete pipeline runs per repo → all consolidation artifacts
    **byte-identical**. Zero dependencies added. Owner-side repo drift (+2 files each)
    attributed and excluded from claims.
- `tests/PHASE_4C2_CONSOLIDATION.md`; SKILL.md §5b consolidation stage documented;
  decisions D-019–D-021 recorded.

### Phase 4C.1A — Collector v2 (Relative Imports & Mechanical Relevance Flags)
**Status**: Complete (implementation + validation)

Scope honored: exactly two collector responsibilities — nothing downstream changed.

- **Python relative imports fixed at the collector layer** (4C.0 root cause A1): the old patterns
  could never match a leading dot, so relative imports produced no record at all. v2 captures bare
  same-package (`from . import a, b`), relative module, parent/multi-level (`..`, `...`),
  parenthesized, and aliased forms (new additive `symbol_aliases`), emitting one record per
  imported name with `target` (dots+module), `classification: "relative"`, `relative_level`,
  `module`, `symbols`, and `raw` provenance.
- **Deterministic repository-local resolution (A3–A5)**: relative targets resolve only against the
  discovered Python inventory (`module.py` / `module/__init__.py`); package context derived from
  `__init__.py` presence; ascent only through regular packages; collection root is the hard
  boundary. Ambiguity → `unresolved` + sorted `resolution_candidates` (status value set unchanged
  for downstream compatibility); missing targets → `unresolved` + `target_not_found`. Documented
  V2 limits: bare names that are `__init__.py` symbols (real case: `cli.py .__version__`), PEP 420
  namespace packages, backslash continuations.
- **Mechanical relevance flags (D-017, B1–B3)**: single function `getMechanicalFlags` in
  `src/utils.js`; every inventory file gains `relevance_flags` (`is_test_like`,
  `is_generated_like`, `is_documentation_like`, `is_automation_like`) + compact
  `relevance_reasons` (path-segment / filename-pattern / extension rules; generic, conservative,
  non-exclusive; segments only — never filename stems, so `projectdock/tools.py` stays unflagged).
  Observations only: nothing excluded, nothing downweighted, no semantic decision.
- **Behavior changes (documented)**: plain `import a, b` now yields one record per target (v1 kept
  only the first); trailing comments no longer pollute symbols; version 0.3.0 → 0.4.0.
- **Validation**: 96/96 tests green (74 pre-existing UNMODIFIED + 22 new: R1A–R1J on
  `tests/fixtures/python-rel-app`, M1–M8 on `tests/fixtures/flags-app` — see
  `tests/PHASE_4C1A_VALIDATION.md`).
- **ProjectDock**: files 65=65; imports 290→345; relative observed 38 / resolved 37 / unresolved 1
  (preserved `__version__`); app.py 11→32 records (14-name bare line individually resolved);
  potential file→file edges 0→30. **Unmodified Phase 4A on v2 evidence**: units 41→28, orphans
  39→27 — the production package is structurally connected for the first time (no downstream
  semantic improvement claimed yet).
- **CinePrint**: files 398=398; imports 1128=1128; flags: test 40, generated 146 (145 `.vercel` +
  `routeTree.gen.ts`), docs 28, automation 43; 12 files multi-flagged; 245 flagged files all remain
  in inventory; application source unflagged. **Unmodified Phase 4A on v2 evidence: identical to
  baseline on every field** — zero regression. (Inventory set differs from baseline only by 29
  `.vercel` hashed renames from the owner's parallel rebuild — verified, not collector behavior.)
- SKILL.md §5b updated (evidence contract: relative-import resolution + mechanical flags).

### Phase 4C.0 — Evidence Remediation & Semantic Consolidation Design
**Status**: Complete (design only — no implementation, no behavior change)

Objective: Classify the Phase 4B.2 failures, decide whether semantic regions require a
consolidation stage before canonical resolution, and design the smallest remediation
architecture. See `tests/PHASE_4C0_FAILURE_TAXONOMY.md` and `tests/PHASE_4C_ARCHITECTURE_PROPOSAL.md`.

Documented:
- **Failure taxonomy A–I** grounded in 4B.2 artifacts: 9 observation failures (A1: Python relative
  imports produce NO record at all — patterns cannot match a leading dot; 0/290 PD import records
  have leading-dot targets while real code has 25+ relative-import lines; the earlier 4A audit
  caught only the package-style absolute gap), 7 evidence-classification failures (empty states,
  errors, manifesto text, font names as capability evidence; automation literals counted in
  scoring but not naming), 6 fragmentation capabilities (auth→4, browsing→4, poster-data→3,
  server-infra→2, discovery→2, portfolio split), 3 conflations (feature-context, feature-service,
  system-pid), 4 type misclassifications, 7 naming failures, 6 description failures, 5 projection
  failures (systems.json drops aliases/keywords the schema already declares; technical_role seed
  leak; undercounting split metrics), and the 81.4% inspection decomposition (133/153 CP 4B.1
  reads were singleton fallbacks — 118 returned insufficient_evidence; 23/53 CP 4B.2 reads went
  into automation noise; 13 null tie-break reads).
- **Consolidation decision: YES (bounded)** — validated per-area against nine questions:
  authentication fragments, browsing fragments, poster-data fragments, and server-error infra
  consolidate (strong merge evidence: complementary layers, unique domain vocabulary, direct
  import edges e564/e565, shared state/journey); system-pid, feature-context, feature-service do
  NOT (shared vocabulary/dependency only). Consolidation must also output non-merges and
  separations (artist-hero out of feature-artist; server/request/context.ts out of feature-context).
- **Accepted architecture decisions D-013–D-018** (below), each grounded in measured 4B.2 evidence.
- **Proposed pipeline (smallest correct)**: Phase 3 v2 OBSERVE (relative imports, relevance flags)
  → 4C.1 ANNOTATE (UI-text taxonomy + semantic relevance classes — single classification authority)
  → 4A STRUCTURE / 4B.1 INVESTIGATE (VOI) / 4B.2 CARVE re-run unchanged on improved inputs →
  4C.2 CONSOLIDATE (merge/non-merge/separation with anti-merge evidence) → 4C.3 CANONICAL
  RESOLUTION v2 + R1–R12 regression gate + real-repo revalidation.
- **Upstream remediation designs** (not implemented): relative-import resolution via package
  context with symbol-is-module handling and unresolved/ambiguous preservation; observation scope
  vs semantic relevance separation (raw evidence keeps everything); UI string taxonomy
  (capability / context / state / incidental) with "state signals never seed" rule.
- **Naming/description remediation design**: identification separated from naming; naming source
  priority (user actions > routes > domain vocabulary > symbols > filenames) with discriminative
  guards; naming_evidence {selected_from, rejected[]} extends the existing naming_conflict (no new
  field trio); template ladder with mandatory generic fallback (no gibberish nouns); systems
  projection completeness.
- **VOI inspection design**: open-question enumeration → missing-evidence typing (unreadable-for-
  purpose files excluded without reads) → candidate ranking → read-while-question-open; projected
  CP inspection ≤50% of repo files (from 81.4%), justified by measured waste classes.
- **Regression fixtures R1–R12** defined, each using a real 4B.2 failure as oracle.
- **Success criteria**: reduced false positives, reduced over-splitting (auth ≤2, browsing ≤2,
  poster-data 1, discovery 1), improved PD recovery, CP inspection ≤50%, preserved ambiguity,
  preserved notion.ts behavior — with guardrails (conflation must not rise; UI filtering must not
  remove genuine UI-only features; unresolved imports preserved; consolidation provenance kept).
- SKILL.md intentionally **not** changed: the pipeline revision is a proposal; the implemented
  pipeline description stays accurate until 4C implementation is approved.

### Phase 4B.2 — Semantic Carving & Canonical Resolution
**Status**: Complete (implementation + real-codebase validation done; no further phase started)

Objective: Consume Phase 4B.1 Semantic Candidates (plus Phase 3 evidence and Phase 4A structure)
to carve **Semantic Regions** by evidence affinity and resolve final Features, Systems,
Relationships, and Semantic Regions with aliases, keywords, and full provenance — refining or
leaving ambiguous/insufficient areas unresolved. See `tests/PHASE_4B2_DESIGN_AUDIT.md`,
`tests/PHASE_4B2_VALIDATION.md`.

Delivered:
- `src/semantic/{tokens,carve,resolve,relationships,index}.js` — deterministic resolver:
  evidence token profiles → Semantic Regions (D-012 carving; splits and cross-unit merges) →
  bounded incremental inspection (reuse-first, ≤3 reads/region, ≤60/repo, every read justified)
  → canonical resolution (feature / system / ambiguous / unresolved) → evidence-backed
  relationships. Output isolated to `<outputDir>/semantic/` (regions, features, systems,
  relationships, unresolved, resolution-report). Byte-for-byte deterministic across runs.
- `tests/semantic/resolution.test.js` — **12/12 pass** (split, cross-unit merge, shared-system
  extraction, notion naming guard, description quality, ambiguity preservation, over-merge
  prevention, component+hook+store unity, provenance, inspection justification, determinism,
  output isolation).
- Validated on ProjectDock (17 regions → 5 features, 3 systems, 2 ambiguous, 7 unresolved;
  unit-001's 8 production files carved into 6 regions + 2 unassigned) and CinePrint (57 regions
  → 22 features, 19 systems, 7 ambiguous, 9 unresolved; 49-file collections-core cluster
  separated into collections/saved/poster-data/image/auth/firestore capabilities).
- D-012 proven on real code in both directions: unit→many entities and units→one entity
  (`feature-save` = lib/saved.ts + routes/saved.tsx; `system-image` spans 3 units).
- notion.ts criterion **passed**: canonical entity is `system-poster` ("Poster", medium) with
  `naming_conflict {seed: notion → behavior: poster}` recorded; no "Notion System" was minted.
- Inspection efficiency: ProjectDock 46 reused + 3 additional (94% reuse); CinePrint 153 reused
  + 53 additional (74% reuse; 4B.2 marginal cost 4.6% / 20.9% of repo files).
- Known defects documented, not fixed (per validation discipline): over-splitting is the
  dominant failure mode; automation/`*.test.ts` noise and empty-state UI-string false positives
  inflate CinePrint entities; 3 over-merges (feature-context, feature-service, system-pid);
  ProjectDock relationships = 0 due to the Phase 3 relative-import collection gap;
  systems.json drops aliases/keywords and leaks a seed term in `technical_role`.

### Phase 4B.1 — Structural Unit Semantic Investigation
**Status**: Complete (validation done; consumed by Phase 4B.2)

Objective: Investigate each Structural Unit (from Phase 4A) with bounded, explainable source inspection and produce evidence-backed **Semantic Candidates** (feature_candidate / system_candidate / ambiguous / insufficient_evidence). **Investigates + hypothesizes only — no final Features/Systems/Relationships/Flows.** See `tests/PHASE_4B1_EVIDENCE_AUDIT.md`, `tests/PHASE_4B1_VALIDATION.md`.

Delivered:
- `src/investigate/{select,clues,inspect,hypothesize,index,cli}.js` — deterministic pipeline: high-information file selection → targeted reads (cap 5) → UI/behavioral/naming clue extraction → rule-based hypothesis with confidence/competing/ambiguity. No external LLM SDK (D-011).
- Candidate model with explicit uncertainty (4 types, confidence enum + reason, supporting/weakening evidence, competing hypotheses, inspected_files with selection_reasons).
- `tests/investigate/investigate.test.js` — **8/8 pass** (fixtures A–F: strong UI, shared infra, misleading filename, ambiguous, insufficient, naming-vs-UI, plus provenance/determinism).
- Validated on ProjectDock (41 candidates: 2 feature, 3 system, 0 ambiguous, 36 insufficient; large core unit 24 investigated via 5 files; `lib/notion.ts` equivalent not applicable) and CinePrint (138 candidates: 13 feature, 4 system, 3 ambiguous, 118 insufficient; `lib/notion.ts` inside 49-file collections-core → `ambiguous` with competing hypotheses, no blind Notion System).
- Investigation reduction demonstrated: 5/24 (79% within-unit), 5/49 (90% within-unit). No Phase 2 maps, Phase 3 evidence, Phase 4A output, or repo source modified.
- Phase 2 semantic maps and Phase 3/4A artifacts remain untouched.

### Phase 4A — Evidence-to-Graph Prototype
**Status**: Complete (validation done; Phase 4B not started)

Objective: Transform Phase 3 evidence into a navigable, explainable implementation graph (normalized nodes/edges + deterministic structural analysis) and emit candidate **Structural Units**. **Structuring only — no semantic interpretation.** See `tests/PHASE_4A_PLAN.md`, `tests/PHASE_4A_EVIDENCE_AUDIT.md`, `tests/PHASE_4A_VALIDATION.md`.

Delivered:
- `src/structural/{graph,analysis,index,cli}.js` — load → normalize → graph → analyze → units → JSON. Guarded CLI (`node src/structural/cli.js <evidence-dir> [output-dir]`).
- Normalization: internal module resolution (ProjectDock gains 89 resolved internal edges), generated-dir filtering (CinePrint drops ~145 `.vercel` nodes), REFERENCES from imported-vs-declared symbols.
- Graph: nodes `file`/`external_dependency`/`unresolved_module`/`entry_point`; edges `IMPORTS`/`DECLARES`/`REFERENCES`/`ENTRYPOINT_FOR`. Full provenance.
- Structural signals: connected components, hubs, bridges (Tarjan), cycles (Tarjan SCC), shared dependencies, entry-point reachability, orphans.
- `tests/structural/structural.test.js` — **16/16 pass** (fixtures A–F: linear, hub, bridge, cycle, unresolved, orphan) + determinism check.
- Validated on ProjectDock (65 files → 24-file core cluster; `app.py` 33 importers, `__init__.py` 28, `ui.py` 16 as shared hubs) and CinePrint (253 files → clusters of 49/39/20/10; collections/automation/routing hubs; one explainable route-tree cycle).
- `lib/notion.ts` correctly placed in the 49-file collections-core cluster with its real Firebase/poster neighbors; symbol *names* mentioning Notion preserved as naming evidence, never asserted as a System.
- Phase 2 semantic maps and Phase 3 evidence remain untouched. Phase 3 collector unmodified.

### Phase 3 — Minimal Automated Evidence Collection
**Status**: Complete (validation done; Phase 4 not started)

Objective: A narrow, dependency-free collector that mechanically observes a codebase (files, imports, symbols, entry points, config, metadata) and emits structured JSON evidence under `.codeatlas/evidence/`. **Observation only — no semantic interpretation.** See `tests/PHASE_3_VALIDATION.md` for the full report.

Delivered:
- `src/collect.js` orchestrator + guarded CLI.
- `src/utils.js` shared utilities (exclusion set, extension maps, language/file-type detection, env-var/URL/framework-clue extraction, safe readers).
- `src/collectors/{files,imports,symbols,entrypoints,config,metadata}.js`.
- `tests/unit/*.test.js` + `tests/fixtures/*.test.js` — **38/38 passing**.
- Validated on real codebases: ProjectDock (Python) and cine-print-gallery (TS/React), 0 errors each.
- Confirmed the Phase 3/4 boundary on the misleading `lib/notion.ts` filename (mechanically observed Firebase/TanStack deps; no "Notion integration" inference).

### Phase 2C — Semantic Model Revision
**Status**: Complete

Objective: Revise the CodeAtlas semantic model based on evidence from ProjectDock (Phase 2A) and CinePrint (Phase 2B) before any automation.

## Validation Summary

### Phase 4C.0 — Design Validation
**Status**: Complete (design-only phase; validation = evidence-grounding of the design)
- Every taxonomy entry traces to 4B.2 artifacts (entity ids, file paths, read logs, counters) — no summarized or invented failures.
- New root cause discovered and verified at source level: Python relative-import patterns match nothing (`\w` cannot match a leading dot), so relative imports are absent from evidence entirely — stricter than the "unresolved" gap recorded in earlier audits.
- Consolidation decision validated per-area with the nine-question protocol; anti-merge principle tested against all three 4B.2 conflation cases and holds (shared dependency ≠ shared semantic responsibility).
- Evidence hierarchy validated against the five mandated cases (notion.ts, feature-found, feature-score, system-artist, authentication fragments).
- All six proposed decisions accepted with measured justification; SKILL.md pipeline description left unchanged (revision is proposed, not implemented).

### Phase 4B.2 — Semantic Resolution Validation
**Status**: Complete
- 12/12 semantic fixture tests pass; full suite 74/74 (32 suites), 0 failures.
- Determinism: independent full regeneration produced byte-identical output for both repos.
- D-012 validated on real code, both directions (PD unit-001 → 6 regions; CP 49-file cluster → 8+ entities; `feature-save`/`system-image` span units).
- notion.ts: filename outvoted by behavior; canonical `system-poster` + recorded naming conflict; no unsupported "Notion System".
- Recovery: CinePrint 5/10 oracle features strongly recovered (collections, saved-posters, submission, user-profile, + auth/login fragment), rest partial; ProjectDock 0/11 fully strong — partial/ambiguous/no-recovery documented entity-by-entity.
- Measured noise: ~12/22 CP features and ~9/19 CP systems are false positives/misnames (automation + UI-string artifacts); over-splitting is the dominant failure mode; 3 over-merges found.
- Relationships: 32 CP (provenance OK, semantic support thin); 0 PD (Phase 3 relative-import gap — upstream evidence defect).
- Blockers for lookup documented (3) + future enrichment (5). Recommendation: architecture validated; canonical maps not yet clean enough for natural-language lookup.
- See `tests/PHASE_4B2_VALIDATION.md`.

### Phase 4B.1 — Semantic Investigation Validation
**Status**: Complete
- 8/8 investigate fixture tests pass (A–F) + provenance/determinism; 16/16 Phase 4A + 38/38 Phase 3 still green (62/62).
- ProjectDock: 41 candidates (2 feature, 3 system, 0 ambiguous, 36 insufficient). Large core 24 inspected via 5 files (79% reduction). False positives from docs fixed; `notion` case N/A.
- CinePrint: 138 candidates (13 feature, 4 system, 3 ambiguous, 118 insufficient). Large clusters 49/39/20 investigated via 5 each (90% reduction). `lib/notion.ts` in 49-file unit → `ambiguous` with competing hypotheses, no blind Notion System.
- Investigation reduction, false positives/negatives, and ambiguity handling demonstrated. No canonical Features/Systems/Relationships/Flows generated.
- Recommendation: **YES**, Semantic Candidate model is sufficient to begin Phase 4B.2.
- See `tests/PHASE_4B1_VALIDATION.md`.

### Phase 4A — Evidence-to-Graph Validation
**Status**: Complete
- 16/16 structural fixture tests pass (A–F) + determinism; 38/38 Phase 3 tests still green.
- ProjectDock: 65 files → 41 components (24-file core cluster); `app.py` (33 importers), `__init__.py` (28), `ui.py` (16) as shared hubs. 89 internal imports resolved by Phase 4A normalization.
- cine-print-gallery: 253 files (after generated-dir filtering) → clusters of 49/39/20/10; collections/automation/routing hubs; 1 explainable route-tree cycle.
- `lib/notion.ts` placed in collections-core cluster; structure + naming evidence supplied, no semantic assertion.
- Recommendation: **YES**, structural graph is sufficient to begin designing Phase 4B.
- See `tests/PHASE_4A_VALIDATION.md`.

### Phase 3 — Evidence Collector Validation
**Status**: Complete
- 38/38 tests pass (unit + fixture integration).
- ProjectDock: 65 files, 290 imports, 228 symbols, 0 errors. Python detected from real `.py` files.
- cine-print-gallery: 398 files, 1128 imports, 1135 symbols, 0 errors.
- Unresolved imports preserved (not discarded); exclusion rules recorded + inspectable.
- No secrets collected — only env-var names.
- Misleading `lib/notion.ts` observed mechanically; semantic correction deferred to Phase 4.
- Known V1 limitation: absolute package-style internal imports are preserved but not local-resolved.

### Phase 2A — ProjectDock Validation
**Status**: Complete

Findings:
- Semantic mapping successfully narrowed natural-language investigation.
- User-first feature descriptions were critical.
- Feature/file dual navigation worked.
- Flows helped trace multi-file behavior.
- Evidence/provenance was missing.
- Aliases/keywords were missing.
- Ambiguity and no-match behavior was handled only by convention.
- Failure modes and error branches needed richer representation.

### Phase 2B — CinePrint Cross-Architecture Validation
**Status**: Complete

Findings:
- Semantic mapping generalized to a React/TypeScript architecture.
- Feature boundaries could remain separate from UI components.
- Shared/cross-cutting systems emerged as meaningful concepts.
- One system could support multiple features.
- Misleading filenames could be corrected through semantic interpretation.
- UI implementation noise could be excluded.
- Complex state/data/service relationships needed explicit representation.
- The model needed to distinguish systems from user-visible features.

## Completed
- 2026-09-04 — Phase 5A2 GitHub Publication Preparation: README expanded (generation artifacts, concepts incl. structural units + flows-explicitly-absent, pipeline stages, trust model, not-claims, maturity incl. ProjectDock/CinePrint + unfamiliar-repo gap, install/usage/uninstall/troubleshooting/contribution/issue/private-beta/security/roadmap/citation; `npx codeatlas` availability claim removed); `docs/{installation,uninstallation,usage,private-beta,release-readiness}.md`; `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md` (CC 2.1, no invented contact), `CHANGELOG.md`; `.github/` (4 issue templates, PR template, offline CI on Node 18 — suite + CLI + whitelist + deterministic/source-safe smoke, never publish); `tests/docs/` 21→80 incl. local-link resolution + npm-honesty + template sanity; decisions D-031/D-032. 284/73/0. Nothing published; release blocked pending owner license confirmation. `tests/PHASE_5A2_GITHUB_PUBLICATION.md`.
- 2026-09-04 — Phase 5A Productization Foundation: Git baseline (`20c33a9`, tag `v0.4.0-core-verified`; `.gitignore` covers evidence caches/package artifacts/local files); unified `codeatlas` CLI (`bin/codeatlas.js`: `--help`/`--version`/`--output`, progress + summary, exit-code discipline; 10 CLI tests); package 0.5.0 with MIT (provisional, D-027), `bin`, keywords, `files` whitelist (54 files / ~108 kB); README rewritten for private beta; examples regenerated from the real pipeline (`sample-output/`, `minimal/` walkthrough; `flows.json` removed); docs consistency tests (21); PD + CP validation under `phase-5a/` via the unified CLI (results match 4C.3); `DECISIONS.md` created with verbatim D-001…D-023 migration + new D-024…D-030. Full suite green (see below). `tests/PHASE_5A_PRODUCTIZATION.md`.
- 2026-09-04 — Phase 4C.3 Naming/Typing/VOI/Projection: `src/canonical/` (VOI inspection D-023, tiered naming D-022, type review, description templates) + `src/project/render.js` (first Markdown projector, R11) + tests `tests/canonical/` (17) + `tests/projection/` (16, incl. 2 unfamiliar-repo smoke suites) + fixtures `smoke-react-app`/`smoke-python-cli`. Feature-lobby reclassified shell-context by VOI; all 4C.2 merges behavior-confirmed; 4 T1/T2 renames on CP (Search Artist, Submit Poster, Poster, +), 2 on PD; technical provenance preserved (aliases/implementation_terms/naming_evidence). CP canonical 23→22, PD 13 stable. Determinism byte-identical; 495-file manifest 0 changes; 194/194 tests. `tests/PHASE_4C3_FINAL.md`; decisions D-022/D-023; SKILL.md updated.
- 2026-09-03 — Phase 4C.2 Consolidation: `src/consolidate/{index,rules,ids,cli}.js` — dedicated consolidation stage after 4B.2 consuming the annotation layer (D-019): demotions D0 (noise anchor)/D1 (state-seeded identity)/D2 (weaker duplicate)/D3 (context-only), separations with vocabulary+filename-stem bridges, merge ladder S1/S1b/S3/S5 with AM1/AM2/AM3 anti-merge vetoes, mixed-type layer partition with external-consumer check, collision-safe id minting (D-021), relationship remap; decision-complete `consolidations.json` (D-020). Tests `tests/consolidation/consolidation.test.js` (24) + fixture `tests/fixtures/consolidate-app/` — full suite 162/162 (138 pre-existing unmodified). Real-corpus validation `tests/evidence-cache/<repo>/phase-4c2/` (protected manifest 479 files 0 changes; byte-identical double runs): CP 41→23 canonical (14 demotions incl. feature-found/preview/palette/artist-2; context conflation split; auth 4→1 system; browsing merged; poster-data consolidated), PD 15→13 (3 S5 merges, ambiguity preserved); feature-lobby remains recorded for 4C.3/VOI. `tests/PHASE_4C2_CONSOLIDATION.md`; SKILL.md §5b; decisions D-019–D-021.
- 2026-08-29 — Phase 4C.1 Checkpoint: re-ran 4A → 4B.1 → 4B.2 UNCHANGED against Collector v2 + Annotation evidence into isolated `tests/evidence-cache/<repo>/checkpoint-4c1/` (protected manifest: downstream src, schemas/templates/examples, all baseline outputs, both Phase 2 oracle maps — 257 files, 0 changes; repos 0 drift / owner-only CP drift). Results: PD structural transformed by resolved relative imports (edges 569→625, units 41→28, hub `app.py`, 22 production modules self-connected); PD semantic: 18 regions, 3F/12S/1A/2U, **first-ever 18 relationships**, module coverage 9→15/17, `system-pid` conflation RESOLVED (conflations 3→2), presentation recovered, `ambiguous-run` resolved (ambiguity 2→1), new technical names need 4C.3; CP byte-stable (41 entities identical ids/files, notion.ts + naming_conflict preserved, all 5 strong recoveries preserved). Annotation proven correct but **unconsumed**: all CP UI false positives persist unchanged (feature-found/artist-2/preview/lobby/palette) because downstream reads no annotation signal — the central checkpoint finding. Inspection: PD 75.4→70.8%, CP 81.4% unchanged (≤50% target NOT YET EXPECTED before 4C.2/4C.3). Determinism verified (byte-identical canonical outputs across full pipeline re-runs). 138/138 tests green. `tests/PHASE_4C1_CHECKPOINT_VALIDATION.md` (21 sections incl. signal-consumption matrix). Recommendation A: proceed to Phase 4C.2.
- 2026-08-29 — Phase 4C.1B Semantic Annotation Layer: `src/annotate/{classify,relevance,extract,index,cli}.js` — one deterministic annotation authority (D-016 UI string taxonomy capability/context/state/incidental with contextual, syntax-first rules; D-017 semantic relevance classes generated>test>automation>documentation>supporting>application with verbatim collector-flag preservation and a documented downstream policy contract). Tests `tests/unit/annotation.test.js` (42 new: R2–R4 failure regressions, U1–U8 UI taxonomy, S1–S8 relevance, K byte-identical determinism, L raw-evidence immutability; 138/138 total) + fixture `tests/fixtures/annotate-app/`. Real-repo validation into `tests/evidence-cache/<repo>/validation/annotation/` (PD: 65 files = 22 application/12 supporting/17 test/1 automation/13 documentation, 1,311 strings, unit-001's 8 production + 16 test members now distinguishable with structural edges preserved; CP: 398 files = 115/37/40/31/146/29, 2,288 strings = 21 capability/467 context/149 state/1,651 incidental; all measured 4B.2 failure strings reclassified seed=false). Docstring false-state fix (deterministic triple-quote scan). `tests/PHASE_4C1B_VALIDATION.md`; SKILL.md §5b pipeline updated.
- 2026-08-29 — Phase 4C.1A Collector v2: `src/collectors/imports.js` (Python relative-import capture + inventory-only deterministic resolution, multi-target split, aliases, parenthesized join, provenance `raw`), `src/utils.js` + `src/collectors/files.js` (mechanical relevance flags on all inventory files), `src/collect.js` (v0.4.0); tests `tests/unit/python-relative-imports.test.js` + `tests/unit/relevance-flags.test.js` (22 new, 96/96 total); fixtures `tests/fixtures/python-rel-app` + `tests/fixtures/flags-app`; `tests/PHASE_4C1A_VALIDATION.md`; real-repo validation runs into `tests/evidence-cache/<repo>/validation/{evidence,structural}/` (PD: 38 relative imports observed/37 resolved, 4A units 41→28 unmodified; CP: structurally identical, flags verified, nothing excluded). SKILL.md §5b evidence contract updated.
- 2026-08-29 — Phase 4C.0 design: `tests/PHASE_4C0_FAILURE_TAXONOMY.md` (failure classes A–I with measured 4B.2 evidence; failure→cause→remediation matrix; 81.4% inspection decomposition) and `tests/PHASE_4C_ARCHITECTURE_PROPOSAL.md` (consolidation decision YES-bounded with anti-merge safeguards; consolidation contract; UI string taxonomy; evidence reliability tiers; upstream remediation designs incl. Python relative-import root cause — leading-dot patterns match nothing; VOI inspection; R1–R12 regression fixtures; implementation order; success criteria + guardrails). Accepted decisions D-013–D-018. No implementation; no pipeline behavior changed.
- 2026-08-29 — Phase 4B.2 added `src/semantic/{tokens,carve,resolve,relationships,index}.js`: deterministic Semantic Region carving (D-012), bounded justified inspection, canonical feature/system/ambiguous/unresolved resolution, evidence-backed relationships; `tests/semantic/resolution.test.js` (12/12) and `tests/PHASE_4B2_VALIDATION.md` (ProjectDock + CinePrint real-codebase validation, notion.ts analysis, boundary/false-positive/false-negative audit, determinism check).
- 2026-08-29 — Added architecture decision D-012 (structural boundaries do not define semantic boundaries; evidence-affinity carving) validated on real codebases.
- 2026-08-28 — Phase 4B.1 added `src/investigate/{select,clues,inspect,hypothesize,index,cli}.js`: deterministic semantic investigation (high-information selection, targeted reads, clue extraction, hypothesis with confidence/competing/ambiguity) + `tests/investigate/investigate.test.js` (8/8) and `tests/PHASE_4B1_EVIDENCE_AUDIT.md`, `tests/PHASE_4B1_VALIDATION.md`.
- 2026-08-28 — Phase 4A added `src/structural/{graph,analysis,index,cli}.js`: evidence normalization, implementation graph, deterministic structural analysis, and Structural Units.
- 2026-08-28 — Phase 4A added `tests/structural/structural.test.js` (fixtures A–F, 16/16 pass) and `tests/PHASE_4A_EVIDENCE_AUDIT.md`, `tests/PHASE_4A_PLAN.md`, `tests/PHASE_4A_VALIDATION.md`.
- 2026-08-28 — Phase 4A added architecture decisions D-009 (normalize, don't re-collect) and D-010 (Structural Unit = connected component, neutral term).
- 2026-08-28 — Phase 4A validated on ProjectDock and cine-print-gallery; recommendation YES to begin Phase 4B design.
- 2026-05-13 — Phase 1 foundation created: schemas, templates, sample output, SKILL.md, README, and initial validation.
- 2026-05-28 — Phase 2C added `schemas/system.schema.json` and first-class system support.
- 2026-05-28 — Phase 2C added optional `aliases` and `keywords` to features.
- 2026-05-28 — Phase 2C added optional inline `evidence` to features, systems, relationships, and flow steps.
- 2026-05-28 — Phase 2C enriched flow steps with optional `preconditions`, `outcomes`, and `branches`.
- 2026-05-28 — Phase 2C updated `SKILL.md` with feature/system/file boundary rules and lookup resolution states (`exact_match`, `likely_match`, `ambiguous_match`, `no_match`).
- 2026-05-28 — Phase 2C added `templates/SYSTEMS.template.md`.
- 2026-05-28 — Phase 2C updated `FEATURE_MAP.template.md`, `FLOW.template.md`, and `ARCHITECTURE.template.md` to reflect revised model.
- 2026-05-28 — Phase 2C created revised example output demonstrating systems, aliases, keywords, evidence, branches, and cross-layer flow.
- 2026-05-28 — Phase 2C created `tests/PHASE_2C_VALIDATION.md` with change rationale and backward compatibility assessment.
- 2026-05-28 — Phase 2C updated `README.md` with revised conceptual model and status.

## Validation
**Phase 2C model revision validation:**
- Updated schemas remain valid JSON Schema draft-07.
- Revised example JSON validates against updated required/optional fields.
- Entity references in examples resolve correctly.
- Relationship graph now explicitly supports feature ↔ system ↔ file edges.
- Markdown projections remain non-canonical.
- No automation was built during Phase 2C.
- Phase 3 automation built and validated (see Phase 3 — Evidence Collector Validation).
- Phase 3 wrote only to `.codeatlas/evidence/`; Phase 2A/2B validation maps were not overwritten.

## Open Questions
- **Q-001 — Stable IDs across renames:** Still deferred to future sync design.
- **Q-002 — Feature granularity:** Phase 2C added clearer boundary guidance but real-codebase calibration continues.
- **Q-003 — Relationship weight/ranking:** Still deferred; confidence + description remain sufficient.
- **Q-004 — Sync merge strategy:** Still deferred; preservation of manual notes remains an open implementation concern.
- **Q-005 — External services inventory:** Still deferred; external systems remain inline for now.
- **Q-006 — Flow depth control:** Phase 2C added branches/preconditions/outcomes but kept them optional; avoid turning flows into exhaustive traces until future validation demands it.
- **Q-007 — Local resolution of absolute package-style imports:** Phase 3 V1 preserves them as `not_local`. Phase 4A normalization already re-classifies `projectdock.cli` → `projectdock/cli.py` at graph time. A future Phase 3 enhancement can do it at collection time for self-contained evidence (recommended, not blocking).
- **Q-008 — Generated-dir exclusions:** Phase 3 `EXCLUSION_DIRS` misses `.vercel`/`.output`/`.next`. Phase 4A filters them; Phase 3 should add them (recommended, not blocking).
- **Q-009 — Entry-point → module anchoring:** npm scripts / `[project.scripts]` are not resolved to modules, so entry-point reachability is weak. Phase 4B may need this.

## Next Step
**Phase 5A2 (GitHub Publication Preparation) is complete. Do NOT start Phase 5B.**

The repository is a complete GitHub project for private-beta discovery: documentation set
(docs/, CONTRIBUTING, SECURITY, CoC, CHANGELOG), issue/PR templates, offline CI, and
honesty pinned by tests (npm availability does not exist; public release blocked pending
owner license confirmation). Recommended next actions in priority order: (1) owner
confirms or replaces the provisional MIT license; (2) create the public GitHub repository
(add the real URL to `package.json` `repository` and changelog links), configure private
security/feedback channels; (3) push and recruit the 3–5 developer private-beta cohort
per `docs/private-beta.md`; (4) act on feedback. Semantic work stays deferred until beta
feedback names a concrete problem.

> Do not begin Phase 5B or any semantic refinement phase without explicit approval and a
> documented plan in `progress.md`. Do not publish to npm, create a GitHub release, or
> push without explicit owner instruction.
