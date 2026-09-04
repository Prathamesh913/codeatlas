# CodeAtlas Agent Skill Instructions

This document defines the agent skill behavior, execution modes, and interface specifications for **CodeAtlas**. It is designed to guide both AI coding agents and automated CLI tools on how to interact with, generate, query, and synchronize a CodeAtlas semantic codebase map.

---

## 1. Core Entities

A CodeAtlas map is built from five primary entity types plus an optional provenance layer.

### 1.1 Feature
A user-visible capability, workflow outcome, or meaningful interactive surface.  
Features describe **what a user sees, does, or experiences** — not implementation machinery alone.

Example:
- Saved Poster List
- Featured Projects Carousel
- Settings Theme Selector

### 1.2 System
A cross-cutting architectural capability that supports one or more features, flows, or other systems.  
A system is **not** every library or directory; it exists only when it provides meaningful shared behavioral or architectural context.

Example:
- Authentication system
- Offline media caching system
- Client-side persistence system

### 1.3 File
A concrete implementation unit.  
Files describe where logic, UI, state, services, configuration, or data actually live.

### 1.4 Relationship
A directed edge connecting entities.  
Relationships can exist between:
- Feature ↔ Feature
- Feature ↔ File
- Feature ↔ System
- System ↔ File
- System ↔ System
- Flow ↔ Feature
- Flow ↔ System
- Flow ↔ File

The graph model is intentionally generic so one schema can represent all useful connections.

### 1.5 Flow
A step-by-step behavioral path explaining what happens when a user action or system event occurs.  
Flows translate technical behavior into a navigable, human-understandable sequence.

### 1.6 Evidence (optional provenance layer)
Evidence explains **why** the map believes a particular relationship, classification, or interpretation exists.  
Evidence may be attached inline to features, systems, flows, or relationships.

Evidence is supportive, not mandatory for all entries.

---

## 2. Feature Boundaries

One of the most important modeling responsibilities is deciding **what a feature is**.

### Rule of thumb
A feature exists when:
1. a user could reasonably notice or describe it, **or**
2. a user action or UI outcome depends on it meaningfully

A **system** exists when:
1. a shared capability supports multiple features or flows, **or**
2. architectural grouping adds navigation value beyond the file list

A **supporting file** is a file without its own user-facing concept; it exists to help implement a feature or system.

### Examples

| Concept | Type | Why |
|---|---|---|
| Saved Poster List | Feature | User can see, navigate, and act on it |
| Poster Grid Card | Supporting file | Reused UI primitive without independent user meaning in most maps |
| Offline Caching | System | Supports multiple features across screens |
| Authentication | System | Cross-cutting capability rather than a single visible component |

> Prefer **fewer, meaningful features** over a map full of components.

---

## 3. Core Execution Modes

CodeAtlas operates in five distinct modes:

1. **`scan`**: Bootstrap or completely refresh the CodeAtlas map from an existing repository.
2. **`lookup`**: Search and resolve natural human descriptions to specific semantic entities.
3. **`impact`**: Trace dependencies and relationships to predict risk and side-effects before a file or feature is modified.
4. **`flow`**: Trace and explain the end-to-end interactive path of a user action across components, state, systems, and services.
5. **`sync`**: Incrementally update only the changed parts of the map after a commit, feature addition, or refactor.

---

## 4. Mode Specifications

### Running a scan (private beta)

```bash
codeatlas <repository-path> [--output <directory>]
codeatlas --help
codeatlas --version
```

Output defaults to `<repository>/.codeatlas` and is never written into repository
sources. The run prints per-stage progress and ends with a summary line
(`N features, M systems, …`) plus the output directory. Exit code 0 means success;
anything else prints a `codeatlas: error: …` message. Stage-specific CLIs under
`src/*/cli.js` remain as internal entrypoints; the unified `bin/codeatlas.js`
(`codeatlas` via the package `bin` field) is the supported interface.

### Mode: `scan`

#### Purpose
Perform static, stylistic, semantic, and provenance-aware analysis on an unfamiliar codebase to construct the initial CodeAtlas model.

#### Conceptual Process
1. **Directory Reconnaissance**: List files and analyze structure (entry points, routes, configuration, folder conventions).
2. **Implementation Graph Construction**: Map imports, exports, composition, and shared dependencies.
3. **Candidate System Identification**: Detect cross-cutting capabilities before forcing every concept into a user-visible feature.
4. **Feature Grouping**: Group implementation into user-visible capabilities instead of treating every component as a feature.
5. **Relationship Generation**: Create explicit edges between features, systems, files, and flows.
6. **Flow Tracing**: Document important behavioral sequences across layers.
7. **Alias and Keyword Generation**: Add natural-language synonyms where useful for lookup.
8. **Evidence Collection**: Attach provenance where interpretation is non-obvious or high-stakes.
9. **Confidence Assignment**: Mark interpretations honestly with `high | medium | low | unknown`.
10. **Output Compilation**: Generate `.codeatlas/` JSON plus optional Markdown projections.

#### Scan Evaluation Checklist
- [ ] Are descriptions written in user-visible terms where applicable?
- [ ] Have systems been separated from user-visible features?
- [ ] Are shared capabilities represented rather than duplicated?
- [ ] Do important relationships include at least minimal evidence when interpretation is ambiguous?
- [ ] Are uncertain conclusions documented in `confidence` and `notes` rather than assumed true?

---

### Mode: `lookup`

#### Purpose
Resolve a human-described problem, symptom, request, or feature to the best available matches in the semantic map.

#### Resolution States

**exact_match**
Confident single match where aliases, keywords, descriptions, and structural context align clearly.

**likely_match**
One or more strong candidates where one appears substantially more relevant than others.

**ambiguous_match**
Multiple plausible candidates where the request could refer to more than one feature, system, or flow.

**no_match**
No sufficiently supported match exists.

#### Lookup Rules
- Do not invent a confident match just because a word appears in names.
- Prefer alias/keyword and description alignment over filename similarity.
- For ambiguous matches, return candidates with reasons and clarification prompts.
- For no_match, return explicit uncertainty plus closest relevant entities if useful.

#### Example Output

```markdown
### CodeAtlas Lookup Results

**Query:** "The saved artwork collection is missing items"
**Resolution:** `ambiguous_match`

#### Candidate 1 — Saved Poster List
Confidence: high
Why relevant: matches "saved artwork" via alias + user-visible list behavior
Files:
- `src/features/saved-posters/SavedPosterList.tsx`
- `src/features/saved-posters/useSavedPosters.ts`

#### Candidate 2 — Poster Cache Sync
Confidence: medium
Why relevant: may explain missing items due to cache reconciliation behavior
Files:
- `src/systems/poster-sync/PosterSyncEngine.ts`

**Suggested clarification:**
Is the issue in the visible list UI or in whether saved posters sync/appear after reloading the app?
```

#### No-Match Example
- Result: `no_match`
- Reason: No feature, system, or flow clearly represents a "collaborative editing session" concept.
- Closest entities: Poster Editor, Poster Metadata Service
- Note: request may be outside current map scope.

---

### Mode: `impact`

#### Purpose
Evaluate scope and blast radius before changing a file, feature, system, or flow.

#### Conceptual Process
1. Resolve target to all affected entity types.
2. Traverse relationships outward through features, systems, files, and flows.
3. Identify shared logic, cross-cutting systems, and downstream consumers.
4. Return affected areas, confidence, and risk guidance.

#### Output Should Include
- Directly affected entities
- Indirectly affected entities via shared systems or reusable files
- Affected user-visible behaviors
- Affected flows
- Risk areas and suggested verification targets

#### Example

**Target:** `src/systems/poster-sync/PosterSyncEngine.ts`

**Affected features:**
- Saved Poster List (confidence: high)
- Poster Detail Availability (confidence: medium)

**Affected systems:**
- Offline Persistence System (confidence: high)

**Affected flows:**
- Save Poster Offline
- Reload Saved Collection

**Risk areas:**
- Cache invalidation timing
- Data rehydration ordering
- UI staleness after sync

---

### Mode: `flow`

#### Purpose
Explain what happens across the system when a user action or system event occurs.

#### Step Capabilities
Each flow step may include:
- description
- file
- feature or system reference
- action type
- preconditions
- outcomes
- branches
- evidence

#### Flow Expectations
- Keep flows useful for human understanding.
- Keep flows structured enough for agent navigation.
- Represent normal paths first.
- Record degraded/error paths as explicit branches when evidence supports them.
- Do not turn flows into exhaustive execution traces unless required for a specific narrow flow.

#### Example

```markdown
### CodeAtlas Flow: Save Poster Offline

Trigger: User taps Save for a poster while offline

1. UI requests save action
   - File: `SavedPosterButton.tsx`
   - Action: user_action
   - Preconditions: network may be unavailable
2. Poster metadata written to local persistence system
   - System: Offline Persistence System
   - Action: state_update
   - Outcomes: poster marked saved locally
3. Poster sync engine queues reconciliation
   - File: PosterSyncEngine.ts
   - Action: background_task
   - Branch: sync failed → retry later
4. UI reflects saved state
   - File: `SavedPosterList.tsx`
   - Action: render
   - Evidence: import of PosterSyncEngine + status selector
```

---

### Mode: `sync`

#### Purpose
Maintain CodeAtlas currency without expensive full rewrites.

#### Conceptual Contract
1. Detect changed files and affected relationships.
2. Update only entities whose meaning, edges, or evidence changed.
3. Preserve intentional manual annotations where possible.
4. Regenerate affected Markdown projections.
5. Leave unrelated entities untouched.

> Sync is designed here as a contract; it is not implemented in Phase 2C.

---

## 5. Evidence and Provenance Rules

Evidence is **optional but encouraged** when:
- interpretation depends on indirect signals
- the same term could refer to multiple entities
- the conclusion is high-stakes for future navigation or refactoring
- the scanner or agent wants to explain why a system boundary exists

Evidence may reference:
- file
- symbol
- line range
- description

Line numbers may be omitted if they are likely to become stale.

Evidence may appear on:
- features
- systems
- relationships
- flow steps

Evidence should remain lightweight and inspectable, not ceremonial.

---

## 5b. Evidence Collection Boundary — Phase 3 vs Phase 4

CodeAtlas separates **mechanical observation** from **semantic interpretation**. This boundary is
load-bearing and must not be crossed.

### Phase 3 — Evidence Collector (observation only)
The `codeatlas-evidence-collector` mechanically scans a codebase and writes raw, inspectable
evidence to `.codeatlas/evidence/` (`manifest`, `repository`, `files`, `imports`, `symbols`,
`entrypoints`, `config` JSON).

Rules the collector obeys:
- It records **what a file does mechanically** — its real imports, symbols, entry points, env-var
  names, URLs — never what its name *suggests*.
- A file named `auth.ts` is evidence of a file; the collector does **not** conclude "authentication
  system."
- A file named `notion.ts` that imports Firebase is observed as Firebase-dependent; the collector
  does **not** infer "Notion integration." Correcting the misleading name is a Phase 4 task.
- Unresolved imports are **preserved**, not discarded (`resolution_status: "unresolved"` /
  `"not_local"`).
- **Collector v2 (v0.4.0)**: Python relative imports (`from . import x`, `from .mod import y`,
  `from ..pkg import z`, parenthesized lists, aliases) are collected and resolved **deterministically
  against the discovered repository inventory only** — never invented. Ambiguous targets are
  preserved with sorted `resolution_candidates`; unresolvable targets keep `resolution_status:
  "unresolved"` with a structured `resolution_reason` (e.g. `target_not_found`,
  `relative_level_exceeds_package_root`). Absolute imports are recorded exactly as before.
- **Collector v2** attaches **mechanical relevance flags** to every inventory file
  (`relevance_flags`: `is_test_like` / `is_generated_like` / `is_documentation_like` /
  `is_automation_like`, with compact `relevance_reasons`). These are deterministic path/type
  **observations only** (D-017) — they never exclude a file, never downweight anything, and are
  not semantic relevance decisions; the Phase 4C.1B annotation layer interprets them.
- Exclusion rules (`node_modules`, `dist`, `__pycache__`, …) are recorded with reasons and are
  inspectable.
- No secrets: only env-var **names** are collected, never values.
- It produces **no features, systems, relationships, or flows**. Those are Phase 4 outputs.

### Phase 4C.1B — Semantic Annotation (classify only)
An **additive** layer — `codeatlas-annotator` (`src/annotate/`) — reads raw Collector v2
evidence (never mutating it) and writes a separate `annotation/` artifact
(`files.json`, `strings.json`). It is the **single classification authority**:

- **UI string classification (D-016)**: every user-visible string candidate is classified
  `capability` / `context` / `state` / `incidental` from bounded deterministic source
  context (element-aware props, JSX text, error construction, console calls, font/URL/class
  literals) — never from string content alone. State lexicon outranks interactive context
  ("Retry preview" in an error boundary is state, not capability). Each entry carries
  compact provenance (file, line, value, context, reason) and a fixed policy
  (`can_seed_entity` / `can_name_entity` / `alias_eligible` / `support_only`):
  capability seeds; context supports naming only; state is support-only; incidental has
  zero semantic weight. String candidates are extracted only for `application`/`supporting`
  files; other relevance classes are policy-handled at file level.
- **Semantic relevance (D-017)**: every file gets a relevance class
  `generated > test > automation > documentation > supporting > application` (precedence
  order; most restrictive mechanically-observable role wins) with the collector's flags
  preserved verbatim. Relevance is **not** Feature/System classification and never excludes
  a file; it carries a downstream policy contract (seeding/naming/inspection) that later
  stages consume instead of recreating ad-hoc exclusions.

Annotation is deterministic (byte-identical re-runs), dependency-free, and must remain
classification-only: if a change would *exclude* evidence, *recollect* anything, or *mint*
a Feature/System, it belongs to another stage. See `tests/PHASE_4C1B_VALIDATION.md`.

### Phase 4A — Structural Analysis (structure only)
A stage consumes `.codeatlas/evidence/` to build a **navigable implementation graph** (`structural/graph.json`, `units.json`, `analysis.json`) — nodes `file`/`external_dependency`/`unresolved_module`/`entry_point`, edges `IMPORTS`/`DECLARES`/`REFERENCES`/`ENTRYPOINT_FOR`, plus hubs/bridges/cycles/orphans. It **structures**; it does NOT interpret. No Features/Systems are named. See `tests/PHASE_4A_VALIDATION.md`.

### Phase 4B.1 — Semantic Investigation (investigate + hypothesize)
A stage consumes the Structural Units + targeted source reads to produce **Semantic Candidates** (`investigation/candidates.json`, `investigation/units/*.json`) — each is a hypothesis (`feature_candidate` / `system_candidate` / `ambiguous` / `insufficient_evidence`) with confidence + supporting/weakening evidence + competing hypotheses. It **hypothesizes**; it does NOT resolve. See `tests/PHASE_4B1_VALIDATION.md`.

**Candidates are not Features. Candidates are not Systems.** They are evidence-backed hypotheses awaiting resolution. The pipeline must be capable of `ambiguous` and `insufficient_evidence` — never hallucinate to achieve coverage.

### Phase 4B.2 — Semantic Resolution (implemented + validated)
A stage consumes Phase 3 evidence + Phase 4A structure + Phase 4B.1 candidates to carve
**Semantic Regions** by evidence affinity (D-012: structural boundaries do not define semantic
boundaries) and resolve final `features.json`, `systems.json`, `relationships.json`, and
`regions.json` with aliases, keywords, and per-entity provenance. Ambiguous and
evidence-poor areas are preserved as `ambiguous`/`unresolved` — never forced to reach coverage.
Extra source inspection is bounded (≤3 reads/region, ≤60/repo) and every read is logged with
its justifying question. Output goes to an isolated `semantic/` directory; earlier phase
artifacts are never modified. `flows.json` is **not** generated by the resolver — flows require
call-chain evidence that does not exist yet. See `tests/PHASE_4B2_VALIDATION.md` for validated
strengths and known quality limits (over-splitting, automation/UI-string noise).

> The Phase 3 collector must remain interpretation-free. If a change would make the collector
> *name* a concept (feature/system/intent), that change belongs in Phase 4A/4B, not here.
> Phase 4C.1B annotation must remain exclusion-free and resolution-free: it classifies; it
> never deletes evidence, never re-collects, and never names a Feature/System.
> Phase 4A must remain interpretation-free; if a change would name a user concept, it belongs in 4B.1.
> Phase 4B.1 must remain resolution-free; if a change would mint a final Feature/System, it belongs in 4B.2.

### Phase 4C.2 — Consolidation (merge / split / demote with recorded evidence)
A distinct stage — `codeatlas-consolidator` (`src/consolidate/`) — runs **after** 4B.2 and
before canonical projection. It is the **single merge authority** (D-013, D-019): it
consumes the annotation layer (`annotation/files.json` + `annotation/strings.json`,
including the collector's mechanical flags verbatim), the structural graph, 4B.1 clue
evidence, and 4B.2's semantic entities, and emits an isolated `consolidation/` artifact
set (`features/systems/unresolved/relationships.json` + the `consolidations.json` decision
log + a report):

- **Demotions (never deletions)** — entities anchored by no application file (D0), whose
  identity occurs only in state/incidental strings (D1), evidence-weaker duplicate
  identities (D2), or entities resting on context text alone (D3) are moved to
  `unresolved.json` as `demoted_false_positive` with the exact misleading strings recorded.
- **Separations** — import-disconnected components of one entity with no shared
  user-facing vocabulary or filename stem are split apart (conflation fix); shared
  vocabulary or a shared filename stem is a bridge and protects D-012 cross-file entities.
- **Merges** — only under strong typed evidence (identical domain-naming capability
  strings; shared action + object; pair-exclusive discriminative vocabulary; direct
  application import edges with domain vocabulary at both ends), with anti-merge vetoes
  (generic-only vocabulary, noise-only relations, persistence services). Mixed
  feature+system groups split by layer; externally-consumed system layers stay separate.
- **Ambiguity** — ambiguous/unresolved entities merge only under strong evidence and are
  otherwise preserved verbatim.
- **Ids** — evidence-derived slugs with content-hash collision suffixes: deterministic,
  unique, position-independent (the positional `-2` artifact is retired).

Consolidation reads repositories **never** (all inputs are produced artifacts), performs
**no source reads**, is byte-deterministic, and records every decision — merges,
non-merges, separations, non-splits, demotions, ambiguity preservations, and the id map —
in `consolidations.json`. See `tests/PHASE_4C2_CONSOLIDATION.md`.

### Phase 4C.3 — Canonical Resolution (VOI inspection, naming/typing, projection)
The final interpretation layer — `codeatlas-canonical-resolver` (`src/canonical/`) plus the
projector (`src/project/render.js`). Canonical JSON is the source of truth; Markdown is a
projection rendered from it.

- **VOI inspection (D-023)**: a distinct, deterministic stage enumerates open decision
  questions from recorded state (complementary system layers, shell-vs-capability, merge
  strength, ambiguity impact, type confirmation), consults existing evidence first
  (annotation, symbols, clue index, consolidation decisions), and performs only bounded,
  budgeted, question-driven reads (≤2/question, ≤40/repo). Every question records reason,
  impact, evidence, reads, findings, decision, confidence, output change — and
  `would_resolve_with` when left open. Uncertainty is never forced.
- **Tiered naming (D-022)**: Tier 1 capability labels (verb+noun phrase names for the
  entity's own distinctive controls), Tier 2 consolidation shared vocabulary, Tier 4
  technical fallback. Behavioral vocabulary is alias/keyword material only. Every rename
  records `naming_evidence` (previous name, tier, basis, rejected candidates); technical
  names survive as aliases + `implementation_terms`; name collisions fall back
  deterministically.
- **Type review**: conservative guards only (filename-only infrastructure "features" →
  system; spanning alone never flips; UI strings alone never flip shared systems).
  Uncertain entities keep their recorded type.
- **Descriptions**: evidence-grounded templates per entity kind — features cite real
  capability labels/verbs; systems state shared responsibility; unresolved/ambiguous/
  demoted entries state exactly why and what would resolve them.
- **Projection**: `INDEX.md` (query index incl. technical-name → canonical mapping and
  file→entity navigation), per-entity pages, `unresolved.md` (never silently omitted),
  `ARCHITECTURE.md`. Flows are stated as absent rather than fabricated. R11 completeness
  and determinism are regression-tested, including two unfamiliar-repo smoke suites.

See `tests/PHASE_4C3_FINAL.md`.

---

## 6. Aliases and Keywords

### Aliases
Natural-language synonyms or alternative phrasings users might actually say.

Examples:
- saved artwork
- my posters
- poster collection

### Keywords
Core tokens representing the concept vocabulary.

Examples:
- saved
- poster
- collection

### Usage Rules
- Aliases and keywords are primarily for lookup.
- Do not turn them into an ontology.
- Use them sparingly and only when they improve natural-language resolution.
- Systems and flows may use them if useful; features must support them first.

---

## 7. Model Relationships Clearly

The relationship graph is intentionally generic.

Use explicit `source`, `target`, and `relationship_type`.

### Recommended conventions
- Use `source` / `target` IDs when possible for unambiguous resolution.
- Keep canonical edges in `relationships.json`.
- Allow inline references in entities for fast local navigation, but keep them consistent with the canonical graph.

### Important boundary rules
- A **feature** is a user-visible or user-meaningful capability.
- A **system** is an architectural enabler.
- A **file** is implementation.
- Do not over-create features just because a component exists.
- Do not collapse systems into features when shared architecture is the real organizing concept.

---

## 8. Agent Operating Principles

1. **Be cognitive**: combine structural facts with semantic reasoning.
2. **Never fabricate certainty**: use `confidence` and `notes`.
3. **Separate feature, system, and file concerns**: do not mash them together when they are distinct.
4. **Use aliases and keywords for language alignment**, not for hallucinated meaning.
5. **Prefer likely candidates with reasoning** over forced single answers.
6. **Return explicit no_match when evidence is insufficient**.
7. **Keep Markdown projections secondary to JSON truth**.
8. **Keep schemas inspectable, flat, and token-efficient**.
