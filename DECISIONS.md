# CodeAtlas Architecture Decisions

> Migrated verbatim from `progress.md` on 2026-09-04 (Phase 5A, D-030).
> `progress.md` retains a pointer to this file; no decision text, ID, or wording was changed in the migration.
> New decisions are recorded here with the next available IDs.


### D-001 — Semantic Model Before Scanner
**Status**: Accepted

**Decision**:
Define the feature, file, relationship, and flow models and schemas before building automated scanning tools.

**Reason**:
The hardest problem in codebase navigation is how to accurately represent and connect user concepts to source code, rather than simply listing files. Defining the contract first ensures future scanner implementations produce predictable, highly useful maps.

**Consequences**:
All future components (scanners, agents, CLI query tools, synchronization logic) must conform to and consume these schemas.

### D-002 — Decentralized, Flat-File JSON Storage
**Status**: Accepted

**Decision**:
Store CodeAtlas data in a dedicated directory `.codeatlas/` using separate structured JSON files (`features.json`, `files.json`, `relationships.json`, `flows.json`) alongside rendered human-readable Markdown documentation.

**Reason**:
Splitting the data into separate documents by entity type prevents massive single-file merges, allows easy git diff tracking, and allows targeted read/write operations by AI agents or scanner tools.

**Consequences**:
Enables incremental updates during sync tasks and allows agents to read only the slices they need without wasting token context.

### D-003 — Confidence as Enum, Not Numeric Score
**Status**: Accepted

**Decision**:
Use `confidence: high | medium | low | unknown` (string enum) for all entities and relationships instead of a 0–100 numeric score.

**Reason**:
Numeric precision implies false certainty for semantic inferences. An enum forces explicit bucketing and keeps notes as the place for nuance.

**Consequences**:
Schemas enforce enum; agents must map their uncertainty into four levels and explain via `notes`.

### D-004 — Centralized Relationships + Inline References (Dual Navigation)
**Status**: Accepted

**Decision**:
Store canonical edges in `relationships.json` (graph-friendly, one entry per directed edge) while also allowing `features[].primary_files/supporting_files` and `files[].features` to inline the most useful links for local navigation.

**Reason**:
Pure graph requires traversal for every lookup; pure inline duplication causes drift. Dual storage gives fast local reads (agent can check a file's `features` without loading the graph) and complete graph queries via `relationships.json`.

**Consequences**:
`sync` must keep both representations consistent; validation must cross-check them.

### D-005 — Generic, Language-Agnostic Schemas with Extensibility
**Status**: Accepted

**Decision**:
Keep `file.type` as a free-form string, `relationship_type` as a constrained enum that is expected to grow, and allow `additionalProperties: true` on all schemas.

**Reason**:
Locking to React/TS or to a fixed type taxonomy would require schema redesign for new stacks. Extensibility avoids breaking changes.

**Consequences**:
Validation ensures required fields but tolerates new metadata; future relationship types can be added without migration.

### D-006 — Templates as Generation Contracts, Not Hand-Written Docs
**Status**: Accepted

**Decision**:
Provide `templates/*.template.md` (Handlebars-style placeholders) that define how JSON becomes Markdown. The canonical truth stays JSON; Markdown is always regeneratable.

**Reason**:
Prevents drift between machine and human views and makes `.codeatlas/*.md` reproducible from CI.

**Consequences**:
Sample outputs in `examples/sample-output/*.md` are rendered examples of that contract, not manually authored docs.

### D-007 — Systems Are a First-Class Entity
**Status**: Accepted

**Decision**:
Add `systems.json` / `system.schema.json` to represent cross-cutting architectural capabilities separately from user-visible features.

**Reason**:
Phase 2 validation showed that some important concepts are neither user-visible features nor individual files. Auth, persistence, and sync repeatedly supported multiple features and needed their own semantic boundary.

**Consequences**:
`SKILL.md`, templates, examples, and relationship conventions now include systems. Existing feature/file/relationship/flow data remains valid without systems.

### D-008 — Optional Aliases, Keywords, and Evidence
**Status**: Accepted

**Decision**:
Add optional `aliases`, `keywords`, and inline `evidence` structures to the semantic model.

**Reason**:
Both validation runs showed natural-language mismatches and missing provenance. The model needed structured support for lookup vocabulary and explanation without forcing exhaustive metadata on every entry.

**Consequences**:
Lookup can now use aliases/keywords; relationships and classifications can include lightweight provenance; backward compatibility is preserved because the new fields remain optional.

### D-009 — Phase 4A Normalizes, Does Not Re-Collect
**Status**: Accepted

**Decision**:
Phase 4A builds the implementation graph by *normalizing* Phase 3 evidence (resolving internal module imports against the file inventory, filtering generated/build artifacts, deriving REFERENCES from imported-vs-declared symbols). It does **not** modify the Phase 3 collector.

**Reason**:
Phase 3 left internal Python module imports (`projectdock.cli`) unresolved and collected some build artifacts (`.vercel/output`). These are normalization concerns squarely within "Evidence Normalization + Structural Analysis," and fixing them in Phase 4A keeps the observation layer clean and the boundary explicit.

**Consequences**:
ProjectDock gains 89 resolved internal edges (0 → 24-file core cluster); CinePrint drops ~145 spurious `.vercel` nodes. Raw Phase 3 evidence remains read-only. The same fixes are recommended as a *future* Phase 3 enhancement (self-contained evidence) but are not required for Phase 4A.

### D-010 — Structural Unit = Connected Component (Neutral Term)
**Status**: Accepted

**Decision**:
A "Structural Unit" is one connected component of the file implementation graph, annotated with hubs/bridges/cycles/orphans. The term is deliberately neutral; it never names a Feature or System.

**Reason**:
Phase 4A must structure without interpreting. Connected components are deterministic, traceable to IMPORTS/REFERENCES edges, and cover the allowed shapes (connected group, hub+neighbors, entry-reachable subgraph, repeated cluster) without inventing semantics.

**Consequences**:
`units.json` carries only structural metadata + a structural `reason` string. Semantic naming (e.g. correcting `lib/notion.ts`) remains Phase 4B's job.

### D-013 — Consolidation Is a Distinct Stage Between Carving and Canonical Resolution
**Status**: Accepted (design; implementation pending 4C)

**Decision**: Add an explicit consolidation stage that consumes Semantic Regions plus evidence
annotations and emits merge groups, non-merge decisions, and separations — each with typed,
strong/medium/weak evidence and mandatory anti-merge checks. Canonical resolution then classifies
consolidated groups (Feature vs System), names them, and describes them.

**Reason**: 4B.2 measured both failure directions: fragmentation (authentication → 4 entities,
browsing → 4, poster-data → 3) that carving cannot repair (no union pass; infra carve blocks
re-attachment), and conflation (feature-context, feature-service, system-pid) that only
anti-merge evidence can veto. Mixing either into carving would reopen a frozen validated stage
and blur evidence-affinity (D-012) with shared-responsibility reasoning.

**Consequences**: `consolidations.json` becomes a pipeline artifact; merging without recorded
merge evidence is forbidden; separation (e.g. artist-hero out of feature-artist) is a first-class
outcome; region identity remains provenance.

### D-014 — Semantic Evidence Has Explicit Reliability Tiers
**Status**: Accepted (design)

**Decision**: Tier 1 observed behavior/responsibility > Tier 2 user interactions/explicit UI
actions > Tier 3 state/data ownership + domain symbol families > Tier 4 structural context >
Tier 5 filenames/paths. Higher tiers outvote lower tiers for identity and naming; lower tiers may
seed only provisional identities requiring corroboration.

**Reason**: notion.ts succeeded because behavior (T1) implicitly outvoted the filename (T5) via an
ad-hoc guard; feature-score, feature-found, and system-artist failed because T3 symbols or
unclassified T2 text outvoted better evidence. Explicit tiers make identity and naming testable
(R9, R10) instead of exceptional.

**Consequences**: naming source priority follows the tiers; provisional regions need corroboration
to become canonical; tier provenance is recorded per claim.

### D-015 — Entity Identification and Entity Naming Are Separate
**Status**: Accepted (design)

**Decision**: A region/fragment/merge-group identity (with provenance) is stable; the canonical
name is a derived, revisable function over the identity's evidence, using a fixed source priority
(user-facing actions > route/context names > domain vocabulary > behavior/symbols > filenames)
with discriminative guards. Rejected candidates are recorded (`naming_evidence.rejected[]`),
extending the existing `naming_conflict` rather than adding new name fields.

**Reason**: feature-score had a correct boundary and an unusable name; feature-found had both
wrong — distinct failure classes requiring distinct fixes. The 4B.2 naming guard fixed notion.ts
but leaked seed terms through `technical_role` (projection), showing naming was not a first-class,
single-authority step.

**Consequences**: renames never redefine boundaries; symbol vocabulary survives as aliases/
keywords; naming is unit-testable (R9–R11).

### D-016 — Raw UI Text Requires Classification Before Entity Seeding
**Status**: Accepted (design)

**Decision**: UI strings are classified once, in the evidence-annotation layer, as capability /
context / state / incidental signals. Capability signals may seed identities and names; context
signals contribute names/aliases only; state signals (empty states, errors, loading, retry)
never seed and only support existing hypotheses; incidental content carries zero semantic weight.

**Reason**: 4B.2's most damaging false positives were unclassified strings ("No posters found" →
feature-found; "cineprint manifesto" → feature-artist-2; "bebas neue" as alias; automation
literals inflating feature scores). The same signal was even treated inconsistently within one
stage (naming guard excluded low-confidence literals; scoring counted them).

**Consequences**: carve/resolve/consolidation consume classes and must not re-read raw UI text
for scoring; genuine UI-only features (login, submit) must remain capability-class (R2–R4 guard).

### D-017 — Observation Scope and Semantic Relevance Are Separate
**Status**: Accepted (design)

**Decision**: Phase 3 keeps observing everything (with mechanical relevance *flags* for tests/
automation/generated paths); a semantic relevance *classification* (application_source / test /
automation / generated / docs) then governs what may seed, join, or be inspected — test and
automation files may connect the structural graph but cannot be primary seed files for canonical
entities, and their string literals are incidental-class.

**Reason**: co-located `*.test.ts` files became region primary members and `automation/`/`scripts/`
code became 7 canonical Systems in 4B.2; yet tests are structurally load-bearing (ProjectDock's
core unit is test-glued), and raw evidence inspectability (D-002) forbids deletion.

**Consequences**: relevance reclassification (e.g. a `scripts/` file directly imported by routes)
must itself be evidence-recorded; filtering happens at consumption, never by destroying evidence.

### D-018 — Inspection Optimizes Decision Information, Not File Importance
**Status**: Accepted (design)

**Decision**: Source reads are allocated by value-of-information: enumerate open resolution
questions, type the missing evidence each needs, rank unread files by likelihood of carrying that
evidence, and read only while a question is open and viable candidates exist (budgets unchanged:
≤3/region, ≤60/repo). Files that structurally cannot carry the missing evidence type are excluded
without reading. Selection solely by graph importance (hubs/degree/coverage) is retired.

**Reason**: CinePrint's 81.4% inspection decomposes into 52.6% singleton fallback reads (89% →
insufficient_evidence), 9.1% reads into automation noise, and 5.1% reads that could not change
any outcome (wrong evidence type); only ~7% of all reads directly informed canonical entities.
4B.1/4B.2 selection ranked file importance, never decision value.

**Consequences**: read logs gain a predicted_value field; determinism and provenance are
preserved; reads remain question-logged (R12).

### D-019 — Consolidation Consumes the Annotation Layer as Its Evidence Authority
**Status**: Accepted (implemented 4C.2)

**Decision**: The consolidation stage is the single merge authority and consumes the annotation
layer (`annotation/files.json` relevance classes + `annotation/strings.json` string classes,
with the collector's mechanical flags verbatim) for every decision: anchor eligibility (D0),
seed legality (D1/D3), duplicate identity (D2), merge signals (S1/S1b/S3/S5), separation
bridges, and merge naming. No consolidation rule may re-read raw UI text for scoring or
classification.

**Reason**: The 4C.1 checkpoint proved annotation is correct but consumed by nothing — every
measured CP false positive persisted. Centralizing consumption in one stage (a) makes the
decision flip testable by mutating one annotation field, (b) prevents the B6-class
guard-vs-scoring divergence inside consolidation, and (c) keeps 4B.2 frozen.

**Consequences**: every consolidation decision cites annotation evidence; output entities carry
`annotation_summary`; reclassification of one string demonstrably changes consolidation
outcomes (tested).

### D-020 — Consolidation Outputs Are Decision-Complete and Demotion Never Deletes
**Status**: Accepted (implemented 4C.2)

**Decision**: `consolidations.json` records merges (with typed evidence), non-merges (with
veto class), separations, non-splits (with the bridging evidence), demotions (with the exact
misleading strings), ambiguity preservations, dropped relationships, and the full id map.
Demoted entities become `demoted_false_positive` entries in `unresolved.json` — files,
evidence, and the misleading strings all survive. Ids are evidence-derived slugs with
content-hash collision suffixes, deterministic and independent of array position.

**Reason**: "Do not make the output look better by deleting difficult cases without recording
why" requires the no-delete + full-decision-log design; the 4B.2 positional `-2` id scheme
must be retired at the one stage that re-issues ids.

**Consequences**: consolidation output is auditable decision-by-decision; canonical JSON
remains the source of truth; ambiguity survives unless strong typed evidence decides.

### D-021 — Identity Is Carried by Evidence, Never by Array Position
**Status**: Accepted (implemented 4C.2)

**Decision**: Canonical ids minted by consolidation derive from the entity's own evidence
(resolved seed term; 4B.2 positional suffixes stripped). A genuine slug collision resolves by
appending a 6-hex FNV-1a hash of the entity's own sorted file set. Two same-seed entities
where one lacks seedable evidence are not two entities — the weaker is demoted (D2) rather
than suffixed.

**Reason**: `feature-artist-2` was a carve-order artifact, not an identity; suffix-stripping
plus evidence tiers separates "same capability twice" (demote) from "two capabilities with
one name" (hash).

**Consequences**: ids are stable across identical runs, unique within kind, independent of
input order; covered by regression tests.

### D-022 — Names Come from User-Facing and Group-Shared Evidence; Technical Language Is Provenance, Never Loss
**Status**: Accepted (implemented 4C.3)

**Decision**: Canonical names are derived by a tiered authority: Tier 1 capability-class
labels (a verb+noun label yields a phrase name, eligible when the label is the entity's own
distinctive control or echoes its seed vocabulary), Tier 2 the consolidation group's
recorded shared vocabulary, Tier 4 the recorded technical identity. Behavioral (Tier 3)
vocabulary is alias/keyword material only — measured churn removed it from renaming.
Renames record `naming_evidence {previous_name, selected_from, tier, basis, rejected[]}`;
previous names become aliases and technical terms survive as `implementation_terms`.

**Reason**: 4B.2/4C.2 left technical template names ("Cmake", "Image" for poster-data,
"Artist" for browsing) canonical because no later stage consumed stronger evidence. The
measured churn of behavioral renames ('Keep', 'Prev', 'Cache') showed raw symbols must
never outrank user-facing language — and that shared CTAs ("Browse Posters" on every page)
must never retitle unrelated entities (seed-relatedness/exclusivity guard).

**Consequences**: every rename is auditable and reversible via aliases; collision fallback
keeps names unique; repos with no user-facing text (ProjectDock) honestly retain technical
names with `technical_vocabulary_only` basis.

### D-023 — Inspection Is Question-Driven, Evidence-First, and Budgeted
**Status**: Accepted (implemented 4C.3)

**Decision**: Source re-inspection happens only inside the VOI stage, only for enumerated
open questions (complementary layers, shell-vs-capability, merge strength, ambiguity
impact, type confirmation), only after existing evidence (annotation, symbols, clue index,
consolidation decisions, relationships) has been consulted, under a deterministic per-
question and per-repo budget. Every question records reason, expected impact, evidence
consulted, files inspected, findings, decision, confidence, output change, and — when left
open — what evidence would resolve it.

**Reason**: the 4C.1 checkpoint showed inspection ranked file importance, never decision
value (81.4% inspection, most reads null). Question-driven reads changed real outcomes
(feature-lobby reclassified as shell context; all 4C.2 merges behavior-confirmed) with
11–26 reads per repo instead of a repository re-scan.

**Consequences**: uncertainty is preserved and operationalized (`would_resolve_with`);
VOI can confirm or reverse consolidation decisions only with recorded read evidence; the
budget is visible in the report and enforced deterministically.

### D-012 — Structural Boundaries Do Not Define Semantic Boundaries
**Status**: Accepted (validated on real codebases)

**Decision**:
Semantic Regions are carved on **evidence affinity** (UI vocabulary, symbol families, behavior
tokens — weighted and IDF-normalized), never on Structural Unit membership. Structural Units are
provenance (`source_structural_units`), not boundaries. Splitting a unit into several entities,
spanning several units with one entity, extracting shared systems, and leaving evidence-poor
areas unresolved are all mandatory, first-class behaviors.

**Reason**:
Real-codebase validation proved both directions: ProjectDock's 24-file core unit (8 production
modules + 16 test files) carved into 6+ canonical regions, and CinePrint's 49-file
collections-core unit into 8+ entities — while `feature-save`, `feature-collection`,
`feature-profile`, and `system-image` each span multiple disconnected Structural Units.
Structural connectivity is even *unreliable* as evidence: ProjectDock production modules import
each other via relative imports Phase 3 did not capture, so the unit was test-glued, yet
token-affinity carving still separated sensible regions.

**Consequences**:
Region carving cannot assume unit membership predicts semantics; over-merge/over-split
prevention and ambiguity preservation must be enforced at resolution time. Validated weaknesses
(automation/test noise, UI-string false positives, over-splitting) are documented in
`tests/PHASE_4B2_VALIDATION.md` with root causes — not hidden.

### D-011 — Deterministic Heuristic Investigator, No External Model SDK
**Status**: Accepted

**Decision**:
Phase 4B.1 semantic investigation is a deterministic, heuristic pipeline (high-information file selection → targeted source reads → regex clue extraction → rule-based hypothesis with confidence/competing/ambiguity). No OpenAI/Anthropic SDK is added.

**Reason**:
CodeAtlas is intended to run inside an AI coding-agent environment; the agent *is* the reasoning layer. Bundling an external model API would couple the library to a vendor, require secrets, and hide provenance. A deterministic investigator preserves explainability, keeps every hypothesis traceable to structural + source evidence, and still demonstrates that investigation narrowing works. An agent can later refine the template hypotheses.

**Consequences**:
`src/investigate/` is zero-dependency, fully testable, and produces the same candidates on every run (ignoring timestamps). Semantic Candidate hypotheses are template-generated and intentionally coarse — Phase 4B.2 will polish them.

### D-024 — Git Baseline Policy (verified state before productization)
**Status**: Accepted (implemented 5A)

**Decision**: The repository is initialized with Git, ignores machine-generated and
local-only files (`.gitignore`: `node_modules/`, `tests/evidence-cache/`, package
artifacts, `.codeatlas/`, logs, editor files, temp dirs), and records one verified
baseline commit (`chore: establish verified Phase 4C.3 baseline`, tag
`v0.4.0-core-verified`) before any productization change. Generated evidence-cache
artifacts and user-owned source repositories are never committed; history is never
rewritten.

**Reason**: No published artifact can exist without version control and a reproducible
baseline; evidence caches are regenerable outputs, not source.

**Consequences**: every later change is reviewable against the tagged baseline; the
protected-integrity manifests keep their independent role for validation artifacts.

### D-025 — Unified CLI Contract (one executable, orchestrated stages)
**Status**: Accepted (implemented 5A)

**Decision**: `codeatlas <repository-path> [--output <directory>]` (plus `--help`,
`--version`) is the single user-facing executable (`bin/codeatlas.js`, package `bin`
field). It orchestrates the existing stage functions — never duplicating pipeline logic —
with concise progress, a summary count line, exit 0 on success and non-zero on failure.
Default output is `<repository>/.codeatlas` (D-002's sanctioned location); source files
in the analyzed repository are never modified. Stage-specific CLIs remain internal and
documented as such.

**Reason**: Seven separate `node src/<stage>/cli.js` invocations with ordered directory
arguments are not a shippable interface; a thin orchestrator preserves the validated
modules while giving beta users one documented command.

**Consequences**: CLI behavior (help/version/failure/rerun/immutability) is regression-
tested by spawning the real executable; programmatic stage APIs are unchanged.

### D-026 — Package Version 0.5.0
**Status**: Accepted (implemented 5A)

**Decision**: Package version is `0.5.0`. The CLI `--version` output reads the version
from `package.json` at runtime, so the binary, the metadata, and the docs cannot drift
apart. Prior module-internal versions (collector 0.4.0, semantic 0.4.3, annotator/
consolidator/canonical 0.1.0) remain as stage provenance and are unchanged.

**Reason**: `0.3.0` predated the validated pipeline; 0.5.0 marks the first
productization-ready foundation without claiming a 1.0-stable contract.

**Consequences**: `npm pack` produces `codeatlas-0.5.0.tgz`; version-gated tests enforce
the 0.5.x line.

### D-027 — License Choice (MIT, provisional pending owner confirmation)
**Status**: Accepted provisionally (implemented 5A) — **flagged for owner review**

**Decision**: The package is licensed MIT (`LICENSE`, `license` field). MIT was chosen as
the conservative standard permissive license for an npm-distributed developer tool: it
imposes no copyleft obligations on beta users and matches ecosystem defaults. This choice
is provisional: the README states it is subject to owner confirmation, and changing it
later requires no code changes.

**Reason**: A beta package with `license: TBD` cannot be responsibly distributed; of the
standard options, a permissive license minimizes friction and legal surface for evaluators.

**Consequences**: distribution is unblocked; the owner may replace MIT with another
license by editing `LICENSE` and the `license` field only.

### D-028 — npm Files Whitelist (runtime and docs only)
**Status**: Accepted (implemented 5A)

**Decision**: The `files` whitelist ships `src/`, `schemas/`, `templates/`, `bin/`,
`README.md`, `SKILL.md`, `LICENSE` only. Tests, fixtures, evidence caches, temporary
outputs, and phase reports are excluded. Verified by `npm pack --dry-run` (54 files /
~108 kB, down from 205 files / ~884 kB with test content).

**Reason**: Generated evidence and internal reports must never reach consumers; the
whitelist makes that structural rather than procedural.

**Consequences**: `npm pack` output is auditable in one glance; docs tests assert the
whitelist excludes test/fixture/evidence paths.

### D-029 — README and Output Contract (private-beta honesty)
**Status**: Accepted (implemented 5A)

**Decision**: `README.md` is rewritten for a private-beta developer: what CodeAtlas is,
installation/execution, CLI options, output directory structure, a worked example,
concept definitions (feature/system/file/relationship/flows-explicitly-absent),
ambiguity representation, source-safety guarantees, honest limitations, maturity
(private beta / experimental), and feedback guidance. Examples are regenerated from the
current pipeline (`examples/sample-output/` + `examples/minimal/`); obsolete artifacts
(`flows.json`, pre-4B.2 projection names) were removed. A docs test suite pins the
honesty contract (no flows.json promises, no universal-language claims, SKILL.md stage
coverage, example shapes).

**Reason**: The Phase-2C-era README contradicted the shipped tool ("CLI does not exist")
and the examples promised ungenerated artifacts — both release-blocking for trust.

**Consequences**: a new developer can understand and run CodeAtlas within five minutes;
documentation drift is caught by tests.

### D-030 — Decision Record Has a Single Home (DECISIONS.md)
**Status**: Accepted (implemented 5A)

**Decision**: `DECISIONS.md` is the single home of the architecture decision record.
D-001…D-023 were migrated verbatim from `progress.md` (IDs, order, and wording
preserved, including the original D-012/D-011 trailing order); `progress.md` keeps a
pointer. New decisions are recorded here with the next available IDs.

**Reason**: Three documents referenced a `DECISIONS.md` that did not exist while the
record lived inside `progress.md`; a second partial record would drift, so the full
record moved exactly once, mechanically, with the migration itself recorded here.

**Consequences**: phase prompts can keep referencing PROGRESS.md / SKILL.md /
DECISIONS.md truthfully; `progress.md` stays a phase log.
