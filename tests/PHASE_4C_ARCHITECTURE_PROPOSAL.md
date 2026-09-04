# Phase 4C — Architecture Proposal (Evidence Remediation & Semantic Consolidation)

**Status**: Proposed (design only — nothing implemented)
**Date**: 2026-08-29
**Basis**: `tests/PHASE_4C0_FAILURE_TAXONOMY.md` (failure classes A–I, all grounded in Phase 4B.2
artifacts). Phase 2A/2B maps are evaluation oracles only.

---

## 1. Answer to the Primary Question

**SEMANTIC REGION ≠ CANONICAL ENTITY — confirmed** (taxonomy §1). A region may be a fragment,
a complete entity, ambiguous, or noise. The pipeline must therefore be able to re-partition
regions by *shared responsibility* before canonical resolution — **if** the failure evidence
demands it. It does, but only partially, and with strict anti-merge safeguards (§2, §4).

## 2. Consolidation Decision — **YES (bounded), with non-merge and separation outputs**

Step 3's nine questions applied to the five fragmented/case-study areas, using 4B.2 artifacts:

### CP authentication (feature-login + ambiguous-auth + system-auth + system-auth-middleware [+ system-admin])

1. Fragments individually legitimate? Files are real; as *canonical entities* they are wrong granularity (4 fragments + 1 supporting system for one oracle capability+system).
2. Shared semantic vocabulary? YES — sign in / token / auth / identity across all fragments.
3. Shared user intent? YES — establishing identity gates saved-posters, collections, profile.
4. Complementary layers? YES — client provider (auth.tsx) ↔ server middleware ↔ admin verification ↔ initialization.
5. Direct interaction? YES — observed `collections.ts → auth-middleware.ts` region edge; provider/token flow documented in oracle notes.
6. Shared state? YES — auth token/session.
7. Same user journey? YES — sign-in flow.
8. Would merging improve navigation? YES — "authentication" as one entity with login as alias beats 4 scattered entries.
9. Would merging hide independent capabilities? NO — login page remains an alias/label; middleware is the system side.

**Verdict: consolidate** (fragments → 1 feature + 1 system). Cannot be done by carving: carve has
no cross-region union pass, and the infra carve path *prevents* re-attachment.

### CP poster browsing (feature-tag + feature-artist + feature-poster + feature-found)

Q2 partial (search/gallery/poster vocabulary overlaps), Q3 YES for Header+FilterBar+index.tsx
(browse/search the gallery), Q5 partial (shared PosterGrid/PosterCard components), Q9 **critical**:
artist-hero + artist/$slug.tsx are a *different* user goal (view one artist's portfolio) — the
current `feature-artist` already over-merges them. **Verdict: consolidate browsing fragments AND
separate artist-hero out of feature-artist** — consolidation must be able to *exclude* contested
members, not only union regions. Oracle poster-detail's Lightbox stays separate (different intent:
inspect one poster).

### CP poster data (system-poster + system-artist + system-firestore)

Q2 YES (poster/fetch/cache), Q4 YES (notion.ts = public read path + cache; posters.ts = types/mapping),
Q5 YES — **direct import edges notion.ts → posters.ts (e564/e565) already in evidence**.
Q9 caution: `firestore-db/shared` are generic persistence, not poster-specific; the sync script is
automation. **Verdict: consolidate notion.ts+posters.ts → poster-data system; leave firestore layer
as shared persistence; exclude automation script.**

### CP server infrastructure (system-app-error + system-error-response + context/logging)

Q2/Q4/Q7 YES (one error-handling responsibility). **Verdict: consolidate; simultaneously removes
the server half of feature-context (fixes D1 by separation).**

### PD session/pid area (system-pid = hyprland.py + sessions.py)

Q3 NO (window awareness vs dev-session tracking are distinct oracle capabilities), Q6 NO shared
domain state (both touch pids — plumbing), Q9 YES merging would hide two capabilities.
**Verdict: anti-merge; additionally the existing merge must be separable.**

### Can existing carving solve it? NO.

Carving assigns each file to exactly one term-group; infra-shaped singletons are locked out of
capability regions; there is no union pass and no re-assignment of contested members. Adding
merge logic inside carve would (a) reopen a frozen validated stage, (b) blur the boundary between
"evidence affinity" (carving) and "shared responsibility" (consolidation), and (c) make
merge decisions untestable in isolation. An explicit consolidation stage is the smallest change
that keeps D-012 carving intact.

## 3. Consolidation Contract (Step 4)

**Position in pipeline**: between CARVE and CANONICAL RESOLUTION.

**Inputs (minimum)**: semantic regions + boundary evidence (affinities, top terms, contested
files); Phase 4B.1 clue index (UI/behavioral per file); annotated UI-text classes + semantic
relevance classes (from 4C.1); symbol families; Phase 4A graph edges with provenance (imports,
REFERENCES); route/context evidence; alias/keyword clusters; structural unit provenance.

**Outputs**:
- `consolidations.json`: merge groups (fragment ids/files + group term proposal), each with
  confidence, merge evidence (typed, §4), competing merge hypotheses, source region/unit provenance;
- explicit **non-merge decisions** (pairs evaluated and rejected, with anti-merge evidence) and
  **separation decisions** (members removed from a region, e.g. artist-hero from feature-artist,
  server/request/context.ts from feature-context);
- unresolved groups (insufficient evidence to merge or separate — preserved, never forced).

**Question answered where**: Consolidation answers *"Which fragments represent the same larger
responsibility?"*; canonical resolution answers *"Is that responsibility a Feature or System,
what is it called, and how is it described?"*. These stay separate unless evidence shows the
merge decision itself determines the type — it does not (poster-data merges stay a System;
authentication merges become Feature + System split by layer).

## 4. Merge and Anti-Merge Evidence (Step 5)

**Strong merge evidence** (any one sufficient, ≥1 required):
- S1: same user action realized across layers of the group (UI control + state + service for one verb: "save poster" in saved.tsx + saved.ts).
- S2: complementary lifecycle stages of one flow (initialization → middleware → verification for auth).
- S3: unique shared domain vocabulary exclusive to the group (createCollectionCore/addPosterToCollectionCore family).
- S4: route + component + state + service jointly supporting one capability (feature-collection — already correct; consolidation must preserve, not re-merge blindly).
- S5: direct domain interaction edges (notion.ts → posters.ts) with domain vocabulary on both ends.

**Medium** (needs ≥2 plus no anti-merge signal): shared state ownership; same user journey;
repeated domain nouns; direct interaction without domain vocabulary.

**Weak — never merges independently**: generic dependency; shared utilities; words like
"service"/"context"/"manager"; framework imports; file proximity; importer count alone.

**Anti-merge evidence** (any one vetoes): distinct user goals; independent UI vocabularies;
different lifecycle ownership; relationship is shared-infrastructure-only; generic name only;
no behavioral relationship.

**Principle validated — shared dependency ≠ shared semantic responsibility** — against the three
conflations:

| Case | Shared signal present | Strong merge evidence present | Anti-merge evidence | Correct outcome |
|---|---|---|---|---|
| feature-context | token "context" | none (no shared action/flow/vocabulary) | distinct layers, distinct user goals, infra-only relation | **do not merge; separate** server/request/context.ts out |
| feature-service | token "service" | none | distinct domains (TMDB vs Firebase), automation relevance class | **do not merge; exclude automation members** |
| system-pid | "pid" plumbing, importer shape | none | distinct user goals (oracle), distinct UI vocabularies | **do not merge; separate** |

And against the true merges: authentication has S2+S3+S6; poster-data has S5+S3; browsing has
S1 (search action) — the same evidence classes separate the cases correctly.

## 5. UI String Taxonomy (Step 6)

One classification, defined once (single responsibility boundary), consumed everywhere:

| Class | Examples (real) | Extraction confidence | Semantic weight | Seed entity name? | Support-only? |
|---|---|---|---|---|---|
| **Capability signal** — primary actions, form actions, route titles, persistent headings, control labels | "create & add", "sign in", "Search posters, artists, tags…", "movie or show title" | high (JSX text node / action prop / route title) | full | YES | YES |
| **Context signal** — section labels, descriptive headings, metadata (`<title>`), document headers | "ProjectDock" window title, "CinePrint" branding, section headings | medium | reduced (names/aliases only, no scoring boost) | name/alias only | YES |
| **State signal** — empty states, loading, errors, confirmations, warnings, retry prompts | "No posters found", "no auth token", "image url is missing", "retry preview", "this page didn't load" | high as *text*, classified as state | none for identity; low for support; alias material only when a hypothesis already exists | **NEVER** | YES |
| **Incidental content** — marketing/manifesto prose, docs strings, log messages, font/brand names, test literals | "cineprint manifesto", "bebas neue", automation script literals | low | zero (excluded from scoring) | NEVER | NO |

Classification heuristics (deterministic, no LLM): empty-state/error lexicon ("no ", "not found",
"failed", "error", "loading", "retry", "try again", "didn't load", "unauthorized"), question/
confirmation shapes, position (error boundary, skeleton, empty-check branch), length/prose
density (incidental), brand/dictionary-of-things-not-actions.

Worked rule: **"No posters found" must not seed `feature-found`; it may support poster-browsing
once stronger evidence (route identity, grid components, search action) exists** — exactly the
Step 6 requirement.

**Single responsibility boundary**: classification happens in the new evidence-annotation layer
(4C.1) — after mechanical collection (Phase 3 stays observation-only; classifying text is
interpretation), before carve/score. 4B.2 already demonstrated the drift risk of doing it in two
places: the naming guard excludes low-confidence literals while feature scoring counts them (B6).
One annotator, all consumers.

## 6. Evidence Reliability Hierarchy (Step 7)

Proposed and validated against the failure set:

- **Tier 1 — Observed behavior / direct responsibility**: what the code does (Firestore reads,
  subprocess launch, server functions, handler wiring).
- **Tier 2 — User interactions / explicit UI actions**: capability-class UI text + bound handlers.
- **Tier 3 — State/data ownership and domain symbol families** (collections-core*, saved* singletons).
- **Tier 4 — Structural context** (unit membership, importer counts, infra shape, routes).
- **Tier 5 — Filenames/path hints.**

Validation against the five required cases:

| Case | Tier signals in conflict | Outcome under hierarchy |
|---|---|---|
| notion.ts | T5 "notion" vs T1 poster loading + T3 PosterFetchError | **T1 overrules T5** — canonical "Poster" + recorded conflict. This is why 4B.2's behavioral guard was correct: it implicitly applied T1>T5; the hierarchy makes it a rule instead of an ad-hoc exception, and tiers 2–4 (labels absent, imports Firebase/posters, infra shape) corroborate. |
| feature-found | T2-mislabeled state text only | With D-016, the state string is not a T2 capability signal; region has no T1/T3 identity → unresolved/supporting, not a Feature. |
| feature-score | T3 "score" symbols vs T2 "search" evidence + oracle intent | Naming priority (§7) ranks T2 above T3 for *names*; identity stays, name becomes Project Search; "score" survives as keyword/alias. |
| system-artist | T3 "artist" symbols vs T1 poster fetch behavior + consumer vocabulary (poster) | T1 + S5 edge evidence → consolidation into poster-data; symbol term demoted to keyword. |
| authentication fragments | each fragment holds a different tier (login: T2; middleware: T4 infra; initialization: T3/T1) | No single tier decides a fragment's fate; consolidation combines tiers across fragments (§2). Tiers are per-claim, not per-stage. |

Rule derived: higher tiers *outvote* lower tiers for identity and naming; lower tiers may seed
*only* provisional identities that must be corroborated (the 4B.2 provisional-region mechanism,
generalized).

## 7. Upstream Evidence Remediation Design (Step 8) — no implementation

### A. Python relative imports (fixes A1)

Missed patterns (all verified against real ProjectDock source): `from . import a, b, …`;
`from .mod import x`; `from ..pkg import y`; parenthesized/multi-line `from x import (…)`;
`import a, b` (multi-target). Design:

1. **Pattern extension** (collector v2): capture optional leading dots: `^from\s+(\.*)([\w.]*)\s+import\s+(.+)$`; comma-split plain `import` lines; record `relative_level` = dot count.
2. **Package-context resolution**: derive the file's package path from its path + nearest enclosing `__init__.py` chain; for level *n*, base = package path minus (n−1) components; target = base + module path.
3. **`from . import sym` symbol-is-module resolution**: each imported name may be a *submodule* — try `<dir>/<sym>.py` and `<dir>/<sym>/__init__.py` against the file inventory (this is the app.py case: 14 sibling modules from one line).
4. **False-resolution prevention**: resolve ONLY to files present in the Phase 3 file inventory; both a module and a package candidate existing → `ambiguous`; nothing existing → `unresolved` with reason (preserved, never dropped — Phase 3 contract).
5. **Statuses**: `resolved` (+resolved_path, confidence high), `ambiguous`, `unresolved`, `not_local` (stdlib/external unchanged).

Fixture cases: sibling list-import (multi-symbol); dotted sibling; parent-level `..` at package root (unresolved/ambiguous expected); nonexistent sibling (unresolved preserved); stdlib untouched; absolute package-style unchanged; parenthesized multi-line import; determinism.

### B. Test / Automation / Generated relevance (fixes A3, A4; separates observation scope from semantic relevance)

Raw evidence **keeps everything** (inspectability, D-002; tests still provide structural
connectivity — PD's unit-001 depends on them). Design:

- **OBSERVATION SCOPE** (Phase 3, mechanical): add deterministic relevance *flags* derivable from path/name: `tests/`, `*.test.*`, `*.spec.*`, `__tests__/` → test; `automation/`, `scripts/`, `tools/` (configurable) → automation; `.gen.`, `.generated.`, minified → generated; docs/config as today. Flags are observations of location/naming, not interpretations.
- **SEMANTIC RELEVANCE** (annotation layer, 4C.1): relevance class per file = application_source (default) / test / automation / generated / docs, combining flags + behavioral corroboration (e.g. a `scripts/` file that a route imports directly can be re-classified by evidence, with the reclassification recorded).
- **Consequences downstream** (consumed, not re-decided): test/automation/generated files may not be *primary seed* files for regions; their UI literals are incidental-class (§5); they attach to canonical entities at most as supporting files; inspection selection deprioritizes them unless a question specifically targets them.

### C. UI filtering

Per §5: the taxonomy lives in the annotation layer; Phase 3 continues to record raw text
(observation scope), annotation classifies it once, carve/resolve/consolidation consume classes.
No layer may re-read raw UI text for scoring (single-responsibility boundary; prevents the B6
divergence class).

## 8. Naming and Description Remediation (Step 9)

**ENTITY IDENTIFICATION ≠ ENTITY NAMING.** Identification (region/fragment/merge-group identity)
is stable and provenance-linked; naming is a derived, revisable function over the identity's
evidence. 4B.2's naming guard proved the need (it fixed notion.ts but could not fix feature-score
because scoring-symbol terms *were* the region's only vocabulary; and it leaked via
`technical_role`).

**Naming source priority** (deterministic):
1. user-facing primary actions/capability labels (capability signals),
2. route/context names (route segments, page titles — context signals),
3. domain vocabulary (consolidated alias/keyword clusters with limited document frequency),
4. behavior/symbol families (Tier 3),
5. filenames (last resort).

Guardrails: a candidate name must be *discriminative* (df threshold — "project" in a project
launcher can never be a name); symbol-derived candidates must be user-plausible (present in
capability/context/domain vocabulary), else fall through; every rename records what was rejected
and why. **Field design — smallest change**: keep `name`; keep `aliases` (alternative_names);
extend the existing `naming_conflict` structure into `naming_evidence` {selected_from, rejected:
[{name, reason, source_tier}]} — the rejected_names concept is justified and absorbed there; no
new primary_name/alternative_names field trio is added.

**Descriptions** (deterministic templates over semantic intent + domain vocabulary + behavioral
role; no LLM):
- Feature — answers *"What can a user accomplish?"*: `"<Verb phrase> <domain object(s)>"` built
  from consolidated capability signals + domain nouns, optionally anchored by one representative
  capability-class label. Fallback ladder: capability template → role template ("Provides
  <domain> management in the interface.") → generic ("Supports part of the application's
  interface; evidence is insufficient for a user-facing description."). **The object noun must
  come from capability/context/domain vocabulary; if none exists, the generic template is
  mandatory** (kills the "Presents founds" / "save and load drains" class).
- System — answers *"What shared responsibility does this provide?"*: `"<Behavior verbs> as a
  shared responsibility for <N> capability areas; architectural support rather than a
  user-visible action."` built from behavior evidence, never from the pre-guard seed term
  (fixes F4/G5).
- Drop the synthesized `user_interactions` padding (G6) in favor of real capability labels or omission.

## 9. Inspection Efficiency → Value-of-Information (Step 10)

Why CinePrint reached 206/253 (81.4%) — measured (taxonomy §I): 133 singleton fallback reads
(118 → insufficient_evidence), 20 multi-file confirmatory reads, 23 reads into automation noise,
13 tie-break reads that could not change the outcome (the missing evidence type does not exist in
those files), ~18 high-value reads. The selection strategy ranks **file importance**, never
**decision value**; 4B.2's question log is question-*shaped* but not question-*gated*.

**VOI inspection design** (deterministic, bounded, explainable):

1. **Open-question enumeration** from region state: (a) no source evidence; (b) feature/system tie;
   (c) contested file between two terms; (d) consolidation pending (cross-fragment evidence); (e)
   naming ambiguity. Questions come from the same state 4B.2 already logs.
2. **Missing-evidence typing**: each question names the evidence type that can answer it (UI
   capability text / behavioral ops / vocabulary / importer structure). A file that structurally
   cannot carry that type (e.g. server config for a UI question) is excluded *without reading* —
   this alone removes the 13 null reads.
3. **Candidate ranking**: unread members of the region (plus, for consolidation questions,
   members of sibling fragments) ranked by likelihood to carry the evidence type: declares count,
   view/route-shaped names, importer degree, relevance class (application_source first).
4. **Read while** a question is open AND a viable candidate exists AND budgets (≤3/region,
   ≤60/repo) hold; **stop** when the question is answerable or candidates are exhausted.
5. **Provenance unchanged**: region, file, question, result — plus predicted_value; determinism
   preserved (fixed question order, fixed ranking keys, fixed caps).

Estimated effect (derived from measured waste, to be confirmed by validation, not promised):
relevance filtering removes the 23 automation reads; evidence-typing removes ~13 null reads;
question-gating replaces most singleton fallback reads (133 → reads only where a canonical or
consolidation question references the file). Combined floor ≈ 21% of current total; a realistic
target band is **≤50% of repo files** with *no loss* of high-value reads (the ~18 that informed
canonical entities are all question-driven and survive).

## 10. Proposed Phase 4C Architecture (Step 11) — smallest correct shape

```
Phase 3 (v2)   — OBSERVE        collector v2: relative imports + relevance flags (+ exclusions)   [4C.1a]
Phase 4C.1     — ANNOTATE       evidence annotation: UI-text taxonomy + semantic relevance classes [4C.1b]
Phase 4A       — STRUCTURE      unchanged (consumes evidence v2)
Phase 4B.1     — INVESTIGATE    unchanged logic; VOI selection consumes annotations
Phase 4B.2     — CARVE          unchanged logic; consumes annotated evidence
Phase 4C.2     — CONSOLIDATE    regions → fragments → merge groups / non-merges / separations
Phase 4C.3     — CANONICAL RESOLUTION v2 + VALIDATION
                                tiered naming, description templates, projection completeness,
                                R1–R12 regression gate, real-repo revalidation vs Phase 2A/2B
```

Notes on the shape:
- **Annotation is a new evidence-layer stage, not a pipeline re-order**: it runs after collection
  and before structure/investigate/carve, which then *re-run unchanged* on the improved inputs
  (the pipeline is deterministic and cheap — real runs complete in seconds). This honors
  "prefer root-cause remediation" without modifying frozen, validated stage logic.
- **No separate "canonical validation" runtime stage is added to the dataflow**: validation is a
  gate (fixtures R1–R12 + oracle comparison) executed in 4C.3, not a transform. Naming/description/
  projection fixes belong to resolution, not to a fourth stage.
- Rejected alternative: doing consolidation inside 4B.2 (§2 — reopens frozen stage, mixes concerns,
  untestable in isolation). Rejected alternative: skipping re-collection and patching downstream
  (leaves A1 — PD relationships stay 0 for a non-root-cause reason).

Evaluation against the required criteria:

| Criterion | Assessment |
|---|---|
| Isolation | Each new unit (collector v2, annotator, consolidator) has its own artifacts (`evidence/` v2 + `annotations/`, `consolidations.json`) and fixture suite; validated stages re-run unchanged |
| Regression testing | R1–R12 gate at 4C.3; existing 74 tests must stay green |
| Provenance | Every annotation, merge, non-merge, separation, and read carries typed evidence + reason |
| Determinism | All stages remain rule-based; fixed orderings; byte-identical output requirement retained |
| Token efficiency | VOI cuts reads; annotations let later stages skip files without reading |
| Maintainability | One classification authority (annotation); one merge authority (consolidation); no duplicated heuristics |

## 11. Regression Fixtures (Step 12)

| ID | Name | Real 4B.2 oracle | Assertion |
|---|---|---|---|
| R1 | Python relative import | app.py `from . import actions,…` invisible | Sibling list-import resolves to per-module edges; `..` and missing targets preserved unresolved; no false resolves |
| R2 | Empty-state pollution | feature-found ("No posters found") | State-class text cannot seed an entity; may support an existing browsing hypothesis |
| R3 | Error-message pollution | feature-preview / feature-page | Error-class text cannot define Features |
| R4 | Marketing/manifesto pollution | feature-artist-2 ("cineprint manifesto") | Incidental prose creates no entities |
| R5 | Authentication consolidation | auth 4-fragment split | Fragments consolidate to feature+system WITHOUT merging profile/ticket (anti-merge holds) |
| R6 | Browsing consolidation | browsing 4-fragment split | Browsing fragments consolidate; artist-hero separates to portfolio |
| R7 | Shared-dependency anti-merge | feature-context | Features sharing infrastructure stay distinct; server/request/context separates from ContextMenu |
| R8 | Generic-vocabulary anti-merge | feature-service | "service" cannot merge TMDB automation with Firebase service-account |
| R9 | Misleading filename | notion.ts | Behavior still overrules filename; conflict recorded; canonical poster resolution preserved |
| R10 | Naming artifact | feature-score | "score" cannot name the entity when user evidence says search |
| R11 | Projection completeness | system-poster aliases lost | System aliases/keywords survive projections (schema conformance) |
| R12 | Inspection efficiency | 23 automation + 13 null reads; 133 orphan reads | With sufficient evidence, no reads occur; every read still question-logged; budgets hold |

Each fixture uses real 4B.2 artifacts as the oracle where possible (entity names, file paths, and
counts above are taken from `validation/semantic/` outputs).

## 12. Architecture Decisions (Step 13) — accepted only

| Decision | Statement | Evidence for acceptance |
|---|---|---|
| **D-013** | Carving and canonical resolution require an explicit consolidation stage between them | Fragmentation cases C1–C6 cannot be unioned by carve (no merge pass; infra carve blocks re-attachment); conflation cases D1–D3 require separations. Consolidation outputs merges, non-merges, AND separations. |
| **D-014** | Semantic evidence has explicit reliability tiers (behavior > user actions > state/domain symbols > structure > filename) | notion.ts success was an ad-hoc exception; feature-score/system-artist failures show implicit weighting is inconsistent; tiers make identity/naming testable (R9, R10). |
| **D-015** | Entity identification and entity naming are separate concerns | feature-score: boundary correct, name wrong; feature-found: boundary AND name wrong — different failure classes need different fixes; naming_conflict already exists but is ad-hoc and leaks (technical_role). |
| **D-016** | Raw UI text requires classification before entity seeding | B1–B6 all stem from unclassified text; one annotation authority prevents the guard-vs-scoring divergence measured in B6. |
| **D-017** | Observation scope and semantic relevance are separate | A3/A4: tests/automation/generated are structurally load-bearing (PD unit-001) but must not seed capabilities; deletion would break D-002 inspectability and 4A connectivity. |
| **D-018** | Inspection optimizes decision information, not file importance | 81.4% decomposition: 52.6% singleton fallback reads (89% null), 9.1% noise reads, 5.1% impossible-to-answer reads; importance ranking caused all three. |

Rejected candidates: none of D-013–D-018 rejected; no additional decisions accepted (e.g. a
"flows require call-graph" rule is already implicit in 4B.2 scope and needs no new number).

## 13. Recommended Implementation Order (Step 14) — no implementation now

| # | Step | Problem | Input → Output | Tests | Real regression cases | Risk | Validation |
|---|---|---|---|---|---|---|---|
| 1 | Collector v2 (relative imports, multi-target, relevance flags, exclusion lists) | A1, A3, A4, Q-008 | source → `evidence/` v2 | new import fixtures + R1 | app.py 14-sibling import; 8 PD production files regain edges | Over-eager resolution → false edges | unresolved/ambiguous preserved; PD internal edge count vs grep-verified baseline; all Phase 3 suites green |
| 2 | Annotation stage (UI taxonomy + relevance classes) | B1–B6, A6 | evidence → `annotations/` | unit tests per class; R2, R3, R4 | "No posters found"; manifesto; bebas neue; automation literals | Over-filtering genuine UI-only features (login/submit must stay capability-class) | fixture gate + spot audit vs oracle labels |
| 3 | Re-run 4A/4B.1/4B.2 on v2 inputs | A1 fallout (PD connectivity), I | annotations + evidence → structural/investigation/semantic v2 | existing 74 tests (must pass unchanged) | PD regions regain import provenance; H5 resolved | Regression in validated stages (must be zero — inputs only) | byte-determinism; diff report vs 4B.2 baseline |
| 4 | Consolidation stage | C1–C6, D1–D3 | regions + annotations + graph → `consolidations.json` | fixtures R5–R8 (+ separations) | auth merge; browsing merge + artist-hero split; context/service/pid anti-merge | Over-merging | anti-merge evidence mandatory per merge; oracle comparison on both repos |
| 5 | Canonical resolution v2 (tiers, naming priority, description templates, projection completeness) | E, F, G, H | merge groups → features/systems/relationships v2 | R9, R10, R11 + schema validation | notion.ts; feature-score; system-poster projection | Naming drift from identifiers (aliases must retain symbols) | R-gate + oracle verdict table re-run |
| 6 | VOI inspection in investigate/resolve | I | region state → read queue | R12 | 23 automation reads; 13 null reads; orphan fallbacks | Under-reading real ties | read count vs 4B.2 baseline; every read question-logged; recovery must not degrade |
| 7 | Full real-repo validation + success-criteria measurement | all | pipeline v2 → validation report | full suite + oracle audit | Phase 2A/2B verdict tables | — | success criteria §12 met; guardrails hold |

Upstream-first ordering is deliberate: steps 1–2 remove the causes of several downstream failures;
steps 4–6 then operate on cleaner inputs; step 3 reuses frozen validated logic.

## 14. Success Criteria (Step 15) — baseline: Phase 4B.2 measured values

**Primary criteria** (measured against the same Phase 2A/2B verdict method):

1. **Reduced false positives**: CP false-positive/misnamed canonical entities from ~21/41 →
   direction: substantially reduced; exact target set at 4C.3 validation (measured, not invented).
2. **Reduced over-splitting**: auth ≤2 canonical entities (from 4+1); browsing fragments ≤2
   (from 4); poster-data systems 3→1; PD discovery 2→1.
3. **Improved recovery**: PD strongly-recovered from 0 → measured (creation/search/discovery are
   the realistic candidates); CP strong recoveries (5) must not regress.
4. **Reduced inspection**: CP total inspection ≤50% of repo files (from 81.4%) — justified by
   measured waste classes alone exceeding 40 points (taxonomy §I).
5. **Preserved ambiguity**: ambiguous/unresolved outcomes never forced to fill coverage; PD
   actions/intelligence may resolve *only* if new evidence (A8) genuinely breaks the tie.
6. **Preserved notion.ts behavior**: canonical poster resolution + recorded conflict (R9).

**Guardrails**:

- Consolidation reducing fragmentation must not increase conflation: D1–D3 cases remain
  separated; conflated-entity count ≤ 3 (current).
- UI filtering must not remove genuine UI-only Features (login, submit — both nearly UI-only —
  must remain canonical).
- Relative-import resolution must preserve unresolved/ambiguous imports (no silent drops, no
  false resolves).
- Consolidation must preserve provenance: every merge/separation cites fragment evidence and
  remains auditable against regions.json.
- Raw evidence and historical phase artifacts remain untouched; 74 existing tests stay green.

---

## 15. Recommendation

Phase 4C as specified here (collector v2 → annotation → consolidation → canonical v2 → VOI) is
the smallest architecture that addresses every accepted root cause; D-013…D-018 are each grounded
in measured 4B.2 evidence. **Design stops here — no implementation in Phase 4C.0.**
