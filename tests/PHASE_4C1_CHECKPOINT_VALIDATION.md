# Phase 4C.1 Checkpoint Validation

**Date:** 2026-08-29
**Question under test:** *How much do improved observation (Collector v2) and centralized
annotation (4C.1A + 4C.1B) improve the existing Phase 4A → 4B.1 → 4B.2 pipeline WITHOUT
changing those downstream algorithms?*

## 1. Status

**COMPLETE — measurement checkpoint executed.** Downstream stages were run unchanged;
all results below are measurements, not fixes. Several failures remain **by design** and
are recorded, not repaired.

## 2. Purpose

Decide, with evidence, whether upstream remediation alone improves semantic recovery, and
exactly which new signals the unchanged downstream stages consume versus ignore. This
determines whether Phase 4C.2 (Consolidation) can begin.

## 3. Pipeline Under Test

```
Collector v2 (fresh, unchanged code)
    ↓  checkpoint-4c1/evidence/
Raw Evidence
    ↓  Phase 4C.1B annotate (unchanged)
checkpoint-4c1/annotation/
    ↓  runPhase4A        (UNCHANGED — checksum-verified)
checkpoint-4c1/structural/
    ↓  runInvestigation  (UNCHANGED — checksum-verified)
checkpoint-4c1/investigation/
    ↓  runResolution     (UNCHANGED — checksum-verified)
checkpoint-4c1/semantic/
    ↓
Comparison vs Phase 4B.2 baseline (tests/evidence-cache/<repo>/{structural,investigation,semantic})
```

All stages executed in isolated `tests/evidence-cache/<repo>/checkpoint-4c1/` locations.
Baseline artifacts untouched (verified by checksum).

## 4. Integrity Boundary

Checksummed before execution and re-verified after (257 files, **0 failures**):
`src/structural/**`, `src/investigate/**`, `src/semantic/**`, `schemas/**`, `templates/**`,
`examples/**`, prior Phase 3 evidence, prior Phase 4A/4B.1/4B.2 outputs (both repos),
Phase 2A ProjectDock oracle map (`.codeatlas/`), Phase 2B CinePrint oracle map (`.codeatlas/`).
Repos: ProjectDock **0 drift**; CinePrint owner-side drift only (new `TabToggle.tsx` +
`.vercel`/`.git` churn — external, not attributed to this phase; CodeAtlas only reads).

Downstream determinism: a full second pipeline run produced byte-identical canonical
artifacts (`features/systems/regions/relationships.json`, candidates) — the only diffs were
recorded provenance fields (`generated_at`, input paths) that the outputs intentionally carry.

## 5. Collector v2 Results

| Metric | ProjectDock | CinePrint |
|---|---|---|
| files discovered / included | 65 / 65 | 398 / 398 |
| imports captured | 345 (v1: 290) | 1128 |
| resolution status | 37 resolved, 1 unresolved (preserved `__version__`), 307 not_local | 561 resolved, 11 unresolved, 556 not_local |
| relative imports | **38 observed, 37 resolved, 1 unresolved** | 0 (no Python) |
| relevance-flagged files | test 17, docs 13, automation 1 | test 40, docs 28, automation 43, **generated 146** |

CP inventory vs the 4B.2-era evidence: 398 = 398; the only inventory delta is 36 `.vercel`
hashed rebuild renames (owner rebuilds) — no application-source inventory change. CP
evidence content differs only where the owner edited files. No files removed for flags.

## 6. Annotation Results

| | ProjectDock | CinePrint |
|---|---|---|
| relevance classes | app 22, supp 12, test 17, auto 1, gen 0, docs 13 | app 115, supp 37, test 40, auto 31, gen 146, docs 29 |
| strings (class) | 1311: cap 0 / ctx 25 / state 7 / incidental 1279 | 2288: cap 21 / ctx 467 / state 149 / incidental 1651 |

Regression examples re-verified on the checkpoint run: "No posters found" → **state**
(`state_lexicon:empty_result`); manifesto prose → **incidental** (`prose_length`);
"RETRY PREVIEW" → **state** (`state_lexicon:retry`); "Bebas Neue" (3 occurrences) →
**incidental**; `routeTree.gen.ts` → **generated** (0 strings); automation files →
**automation** (0 strings); raw evidence unchanged after annotation; runs deterministic.

## 7. Structural Changes (4A unchanged)

| Metric | PD baseline (4B.2-era) | PD checkpoint | CP baseline | CP checkpoint |
|---|---:|---:|---:|---:|
| graph files | 65 | 65 | 253 | 253 |
| nodes | 86 | 88 | 382 | 382 |
| edges | 569 | **625** | 1546 | 1546 |
| units | 41 | **28** | 138 | 138 |
| largest unit | 24 (8 prod + 16 test) | **38 (22 prod + 16 test)** | 49 | 49 |
| top hub | `__init__.py` | **`app.py`** | routeTree.gen.ts | routeTree.gen.ts |
| orphan count | 39 raw / 0 in graph after uniting | 0 | 0 | 0 |

**Hypothesis 1 CONFIRMED:** resolved Python relative imports significantly improved PD
connectivity (569→625 edges, 41→28 units). **Hypothesis 2 CONFIRMED:** the largest PD unit
is no longer production-glued-through-tests — all 22 production modules are now directly
interconnected (hub `app.py`); the 16 test files ride along but production↔production edges
dominate. CP structural output is **bit-identical** to baseline — expected and valid:
annotation is not consumed by 4A, and CP evidence structure is unchanged.

## 8. Investigation Changes (4B.1 unchanged)

| | PD baseline | PD checkpoint | CP baseline | CP checkpoint |
|---|---:|---:|---:|---:|
| units investigated | 41 | 28 | 138 | 138 |
| feature / system candidates | 2 / 3 | **1 / 0** | 13 / 4 | 13 / 4 |
| ambiguous candidates | 0 | 0 | 3 | 3 |
| insufficient_evidence | 36 | 27 | 118 | 118 |
| unique source reads | 46 | 32 | 153 | 153 |

CP investigation is identical. PD investigation **changed shape**: fewer unit candidates
(41→28) but *weaker* unit-level typing (0 system candidates, 1 feature candidate) — with
production modules now individually connected, unit-level evidence no longer inflates
per-unit type signals. The downstream resolver compensated with more of its own bounded
reads (3→14). This is a measured behavioral shift of unchanged code under better evidence.

## 9. Semantic Recovery

### ProjectDock (oracle: 11 features)

Counts: 65 files → 28 units → **18 regions → 3 features, 12 systems, 1 ambiguous,
2 unresolved, 18 relationships, 1 unassigned** (baseline: 17 regions, 5F/3S/2A/7U,
**0 relationships**, 3 unassigned).

| Phase 2A entity | Baseline verdict | Checkpoint verdict |
|---|---|---|
| project-discovery | PARTIAL (rescan + root split) | PARTIAL — `feature-rescan` (app.py) + `system-project` (discovery.py, technical name, typed System) |
| project-search | PARTIAL (`feature-score`) | PARTIAL — unchanged technical name |
| project-creation | PARTIAL (`feature-creation`) | PARTIAL — `system-creation` (type flipped to System; technical name) |
| project-actions | AMBIGUOUS preserved | AMBIGUOUS **preserved** (`ambiguous-editor`) ✓ |
| project-intelligence | AMBIGUOUS preserved (`ambiguous-run`) | PARTIAL — `system-run` (typed System; ambiguity no longer preserved) |
| workspace-awareness | PARTIAL wrong type | unchanged — `system-workspace` |
| dev-session-management | PARTIAL over-merged (`system-pid` = hyprland + sessions) | PARTIAL — `system-session` (sessions.py alone); **baseline conflation resolved**; hyprland.py now separate (`system-has`) |
| tool-picker | PARTIAL wrong type | unchanged — `system-tool` |
| keyboard-shortcuts | NOT RECOVERED | NOT RECOVERED (still inside `feature-printable`) |
| project-presentation | NOT RECOVERED | **PARTIAL** — `system-cover` + `system-theme` now canonical (technical names) |
| launcher-shell | NOT RECOVERED | NOT RECOVERED (fragments; `unresolved-layer`) |

Coverage: production modules with a canonical entity **9 → 15 of 17** (all except
`actions.py` = preserved ambiguity and `config.py` = unassigned). Strong recoveries: 0 → 0.
Relationships: **0 → 18** (evidence-backed USES/DEPENDS_ON; e.g. `feature-rescan →
system-session`, `feature-printable → system-creation` — all endpoints are production
modules). Ambiguity: 2 → 1 (run resolved; editor preserved).

### CinePrint (oracle: 10 features + 6 systems)

Counts identical to baseline: 57 regions, 22 features, 19 systems, 7 ambiguous, 9
unresolved, 32 relationships, 56 unassigned. **All 41 canonical entities have identical
ids and primary files; 40/41 have identical descriptions and aliases** (`feature-found`'s
description wording changed because the owner edited `index.tsx` content). All baseline
verdicts stand unchanged: 4 strong features (saved-posters, collections,
poster-submission, user-profile) + strong `system-image` **preserved**; fragmentation and
conflations unchanged (see §11/§12).

## 10. False Positive Changes

| Baseline failure entity | Checkpoint status | Why |
|---|---|---|
| CP `feature-found` | **STILL PRESENT** | annotation classified "No posters found" as state/seed=false, but 4B.2 does not consume `annotation/strings.json` — the unchanged clue pipeline still labels the entity "no posters found" |
| CP `feature-artist-2` | **STILL PRESENT** | same — manifesto aria-label still enters via 4B.1 clue extraction |
| CP `feature-preview` | **STILL PRESENT** | same — "RETRY PREVIEW" still read as visible text |
| CP `feature-lobby` | **STILL PRESENT** | "BACK TO LOBBY" still in `__root.tsx` (owner re-added uppercase variant); annotation classifies it but nothing consumes the class |
| CP `feature-palette` | **STILL PRESENT** | automation script file is relevance=automation in annotation, unconsumed |
| CP `feature-service` conflation | **STILL PRESENT** | unchanged code + unchanged inputs |
| CP `system-artist` naming | **STILL PRESENT** | posters.ts symbol vocabulary still drives naming |
| PD `feature-score` naming | **STILL PRESENT** | unchanged |
| PD `system-pid` conflation | **RESOLVED** | upstream: relative imports split the over-merged unit; 4B.2 no longer merges hyprland+sessions |
| automation-derived entities (CP) | **STILL PRESENT** | relevance=automation available, unconsumed |

**The dominant pattern: annotation classifies every measured failure signal correctly, and
the unchanged downstream stages ignore the classification.** The only false-positive
resolution came from evidence-level connectivity, not from annotation.

## 11. Fragmentation Changes

| Oracle area | Baseline fragments | Checkpoint fragments | Delta |
|---|---|---|---|
| CP authentication | 4 (+admin) | 4 (+admin): `feature-login`, `ambiguous-auth`, `system-auth`, `system-auth-middleware` | unchanged |
| CP poster browsing | 4 | 4: `feature-tag`, `feature-artist`, `feature-poster`, `feature-found` | unchanged |
| CP poster-data | 3 | 3: `system-poster`, `system-artist`, `system-firestore` | unchanged |
| CP server-infrastructure | 2 (+ misappropriated request layer in `feature-context`) | unchanged | unchanged |
| PD project-discovery | 2 (`feature-rescan` + `feature-root`) | 2 (`feature-rescan` + `system-project`) | same size, different second fragment |
| PD project-presentation | 0 (unresolved) | 2 (`system-cover`, `system-theme`) | new (improved coverage, technical names) |

Nothing was merged; measurement only.

## 12. Conflation Changes

| Baseline conflation | Checkpoint | Assessment |
|---|---|---|
| CP `feature-context` (ContextMenu.tsx + server/request/context.ts) | **remains** — identical primary files | unchanged (needs consolidation/layer awareness) |
| CP `feature-service` (automation/tmdb/service.ts + service-account.ts + test) | **remains** — identical primary files | unchanged |
| PD `system-pid` (hyprland.py + sessions.py) | **RESOLVED** — now separate `system-has` (hyprland.py) and `system-session` (sessions.py) | improved purely by upstream evidence |

**Conflations 3 → 2.** Guardrail "conflation must not exceed 3": **PASS** (improved).

## 13. Naming and Description Changes

- **Unchanged technical naming:** `feature-score` (PD search.py), `system-artist` (CP posters.ts) — unchanged code consumes the same symbol vocabulary.
- **New technical names (PD):** `system-has`, `system-dir`, `system-fetch`, `system-marker`, `system-run`, `system-project`, `system-cover`, `system-theme`, `system-session`, `system-creation` — the resolver now names 10 previously-unresolved/ambiguous modules, but from symbol/filename vocabulary because its naming logic is unchanged. Descriptions follow the same template ("Shared has capability for 2 other implementation areas…").
- **Improved descriptions:** `feature-rescan` ("Lets users rescan and scan projects and roots") — reads better than baseline because evidence improved.
- **Unchanged gibberish:** `feature-found` ("Lets users filter founds. The interface labels it 'no posters found'"), `feature-save` ("save and load drains and users. The interface labels it 'no auth token'") — state strings still leak into labels/descriptions because annotation is unconsumed.
- **ID collisions:** `feature-artist-2` suffix artifact persists (unchanged logic).
- **notion.ts:** unchanged and correct (§15).

## 14. Relationship Changes

| | PD baseline | PD checkpoint | CP baseline | CP checkpoint |
|---|---:|---:|---:|---:|
| semantic relationships | **0** | **18** | 32 | 32 |

ProjectDock gained its first semantic relationships — every one evidence-backed
(imports/edges between production modules), e.g. `feature-rescan →` 12 entities (app.py
hub), `feature-printable →` 5. This is a direct effect of resolved relative imports flowing
through unchanged 4A→4B.2. CP relationships are byte-identical.

## 15. notion.ts Regression (mandatory)

1. Never promoted to a "Notion System": **CONFIRMED** — no `system-notion` exists in checkpoint output.
2. Behavioral evidence outweighs filename evidence: **CONFIRMED** — `system-poster` (name "Poster", primary file `src/lib/notion.ts`) is unchanged from baseline.
3. Firebase/poster behavior visible: **CONFIRMED** — `system-poster`/`system-firestore`/`system-firebase` unchanged.
4. Naming conflict recorded: **CONFIRMED** — `naming_conflict: {seed_term: "notion", naming_basis: "filename/symbol vocabulary only — absent from inspected UI and behavioral evidence", behavior_term: "poster"}` present verbatim.
5. Canonical identity does not regress: **CONFIRMED** — entity ids/files byte-stable.

## 16. Inspection Efficiency (measured)

| | PD baseline | PD checkpoint | CP baseline | CP checkpoint |
|---|---:|---:|---:|---:|
| 4B.1 unique reads | 46 | 32 | 153 | 153 |
| 4B.2 additional reads | 3 | 14 | 53 | 53 |
| total unique inspected | 49/65 | 46/65 | 206/253 | 206/253 |
| inspection rate | 75.4% | **70.8%** | 81.4% | **81.4%** |

PD improved (−4.6 pp) because 4B.1 reads fewer units, though 4B.2 spent more of its bounded
budget (3→14 reads) — unchanged code redistributed effort under better evidence. CP is
unchanged. Neither meets the 4C.0 ≤50% projection — as projected, that target requires 4C.2
consolidation and 4C.3 VOI work; upstream signals alone do not reach it (relevance classes
are unconsumed). Breakdown by read class (high-value / singleton / confirmatory / tie-break)
is derivable from `additional_inspection_log`; the totals above are the measured rates.

## 17. Signal Consumption Analysis (critical)

| Signal | Produced by | Available to | Actually consumed by | Observed effect |
|---|---|---|---|---|
| Resolved Python relative imports | Collector v2 | 4A (via evidence) | **4A ✓** (graph normalization) → 4B.1 → 4B.2 | PD edges 569→625, units 41→28, hub app.py; 15/17 modules canonicalized; **18 relationships**; `system-pid` conflation resolved; presentation recovered |
| Mechanical relevance flags | Collector v2 | all stages (in evidence files.json) | **none** (zero code references in src/structural, src/investigate, src/semantic) | none |
| Semantic relevance classes (files.json) | 4C.1B annotation | all stages (annotation/files.json) | **none** | none |
| UI taxonomy classes (strings.json) | 4C.1B annotation | all stages | **none** | none — feature-found/artist-2/preview/lobby persist |
| Capability strings | 4C.1B | — | **none** | none (PD capability=0 measured; CP 21 capabilities unconsumed) |
| Context strings | 4C.1B | — | **none** | none |
| State strings | 4C.1B | — | **none** | none — state text still leaks into labels ("no posters found", "no auth token") |
| Incidental strings | 4C.1B | — | **none** | none — prose/font noise still weights entities |

**The annotation layer is currently a fully-wired-but-unplugged input.** Every known UI
false-positive signal is correctly classified with seed=false, and the unchanged resolver
reaches the same false conclusions because it reads clues through its own unannotated path.
This is the checkpoint's central integration finding.

## 18. Remaining Failures (classified, not fixed)

| Failure | Class |
|---|---|
| CP `feature-found` / `feature-artist-2` / `feature-preview` / `feature-lobby` / `feature-palette` | **unchanged because signal is unconsumed** (annotation correct, resolver unaware) |
| CP conflation `feature-context` | **unchanged because signal is unconsumed** + requires consolidation |
| CP conflation `feature-service` | unchanged because signal is unconsumed |
| CP `system-artist` / PD `feature-score` technical naming | requires canonical resolution v2 (naming) |
| CP fragmentation (auth 4, browsing 4, poster-data 3, server-infra 2) | requires consolidation |
| PD technical names (`system-has`, `system-dir`, …) | requires canonical resolution v2 (naming) |
| PD type flips (creation/discovery/intelligence → System) | requires canonical resolution v2 (typing) |
| PD `ambiguous-run` ambiguity loss | requires canonical resolution v2 (ambiguity thresholds — unchanged code resolved it) |
| PD keyboard-shortcuts (within-file capability) | requires VOI inspection |
| Inspection >50% | requires consolidation + VOI |
| `feature-artist-2` ID collision artifact | requires canonical resolution v2 |

## 19. Success Criteria Evaluation (pre-registered, 4C.0)

| Criterion | Verdict |
|---|---|
| CP false positives ≈21/41 reduced | **FAIL** (unchanged — unconsumed signals) |
| auth ≤2 fragments | **FAIL** (4, unchanged) |
| browsing ≤2 fragments | **FAIL** (4, unchanged) |
| poster-data = 1 | **FAIL** (3, unchanged) |
| PD discovery = 1 | **FAIL** (2 fragments, unchanged count) |
| PD strong recovery >0 | **FAIL** (0 strong; 8 partial, coverage 9→15 modules) |
| Preserve CP's 5 strong recoveries | **PASS** (output byte-stable) |
| CP inspection ≤50% | **FAIL** (81.4% unchanged; PD 70.8% — NOT YET EXPECTED before 4C.2/4C.3) |
| Ambiguity preserved | **PARTIAL** (CP 7 ✓; PD 2→1 — `ambiguous-run` resolved by unchanged code) |
| notion.ts preserved | **PASS** |
| Guardrail: conflation ≤3 | **PASS** (3 → 2) |
| Guardrail: genuine UI-only features survive (CP login/submit) | **PASS** (`feature-login`, `feature-submit` canonical) |
| Guardrail: unresolved imports preserved | **PASS** (PD 1 relative unresolved preserved; CP 11) |
| Guardrail: provenance preserved | **PASS** (all artifacts carry tool/version/inputs/conflict records) |

## 20. Interpretation

**How much improvement came from upstream evidence quality alone?** Substantial but
asymmetric. Collector v2's resolved relative imports — the one upstream signal downstream
code already consumes — delivered real PD gains: 41→28 units, production self-connectivity
(22 production modules in one component, hub `app.py`), first-ever 18 semantic
relationships, coverage 9→15/17 production modules, presentation recovered from
not-recovered, and the `system-pid` conflation resolved (3→2 overall). CP was correctly
stable. Annotation produced **zero** semantic change — by construction, since no downstream
code reads it — while simultaneously proving the classification layer is correct and ready.

**Which remaining failures prove 4C.2/4C.3 are still necessary?** Every CP false positive
and both remaining conflations persist *despite correct annotation* — they require 4C.2 to
wire relevance/taxonomy consumption into carving/resolution (and to consolidate fragments).
Technical naming (`system-has`, `system-artist`, `feature-score`), type flips
(creation/discovery → System), the `ambiguous-run` ambiguity loss, and the ID-collision
artifact require 4C.3 canonical resolution v2. Within-file capabilities
(PD keyboard-shortcuts) require VOI inspection. Inspection ≤50% requires both. The new PD
system proliferation (12 systems, template descriptions) is itself evidence that
consolidation — not more evidence — is the next binding constraint.

## 21. Recommendation

**A. Proceed to Phase 4C.2 Consolidation.**

Rationale: evidence quality is no longer the binding constraint (hypotheses 1–2 proven);
classification is correct but unplugged; the measured failures are exactly the classes 4C.2
(consolidation + annotation consumption) and 4C.3 (naming/typing/VOI) exist to fix. No
upstream fix is indicated before consolidation.
