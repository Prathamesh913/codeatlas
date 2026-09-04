# Phase 4C.3 — Naming, Typing, VOI Inspection, and Projection Completeness

**Date:** 2026-09-04
**Goal:** make CodeAtlas user-facing and trustworthy enough for private beta without
pretending semantic interpretation is perfect. Four workstreams: (A) tiered naming and
typing authority, (B) value-of-information inspection, (C) projection completeness, (D)
full regression and oracle revalidation. No earlier stage was rewritten; no Phase 4C.4
work was started.

---

## 1. Files Changed

**Added**
- `src/canonical/{index,voi,naming,typing,describe,cli}.js` — the 4C.3 canonical-resolution
  stage (VOI inspection → naming/type resolution → canonical JSON).
- `src/project/render.js` — the Markdown projector (first implementation of the Phase 2
  template contracts; Markdown is a projection, JSON is the source of truth).
- `tests/canonical/canonical.test.js` (17 tests), `tests/projection/projection.test.js`
  (16 tests incl. two unfamiliar-repo smoke suites).
- `tests/fixtures/smoke-react-app/`, `tests/fixtures/smoke-python-cli/`.
- `tests/PHASE_4C3_FINAL.md` (this report).

**Modified**
- `package.json` (test glob + two new suites), `progress.md`, `SKILL.md`, decisions
  D-022/D-023.

**Untouched (checksum-verified):** Collector v2, Annotation, 4A, 4B.1, 4B.2, 4C.2,
schemas, templates, examples, all checkpoint-4c1 and phase-4c2 artifacts, Phase 2 oracle
maps (495-file manifest, 0 changes).

## 2. Naming Authority Tiers

Implemented in `src/canonical/naming.js` (`deriveName`), deterministic:

| Tier | Evidence | Use |
|---|---|---|
| 1 | Capability-class UI labels. A label carrying a user action verb + a domain noun yields a phrase name ("Search Artist" from "Search posters, artists, tags…") | Highest naming authority |
| 2 | The consolidation group's recorded shared vocabulary (`consolidation_shared_vocabulary`) | Names merged/multi-member identities |
| 3 | Behavioral vocabulary | **Alias/keyword material only** — measured churn ('Keep', 'Prev', 'Cache') removed it from renaming |
| 4 | Filenames/technical symbols | Last resort; keeps the recorded identity |

Guards: discriminative bound (df ≤ ⌈0.35·app files⌉), generic/plumbing/vendor exclusion,
gerund and function-word exclusion, name-collision fallback (a taken name falls to the
next candidate, recorded), and **seed-relatedness/exclusivity**: a label may retitle an
entity when it is that entity's own distinctive control (unique across entities) or when
it echoes the entity's seed vocabulary — a shared CTA ("Browse Posters" on every page)
never retitles an unrelated entity.

**Technical provenance is preserved** (workstream A.2): every rename records
`naming_evidence {previous_name, selected_from, tier, basis, rejected[], changed}`;
previous names become aliases; technical terms are kept in `implementation_terms` and
`keywords`. Nothing is discarded.

## 3. Technical-Name Corrections (validated corpus)

| Entity | Before | After | Evidence |
|---|---|---|---|
| `feature-artist` (browsing) | "Artist" | **"Search Artist"** (T1) | its own capability label "Search posters, artists, tags…" |
| `feature-submit` | "Submit" | **"Submit Poster"** (T1) | capability label |
| `system-image` (poster-data) | "Image" | **"Poster"** (T2) | the merged group's recorded shared vocabulary (S5 `poster`) |
| `system-like` | "Like" | kept (collision fallback recorded) | "Profile" taken by the profile feature |
| PD `feature-project` | "Project" | "Dir" (T2 group-shared) | recorded merge vocabulary |
| PD `system-cover` | "Cover" | "Color" (T2 group-shared) | recorded merge vocabulary |

General rules, not hardcoded strings: the same machinery handles analogous names.
ProjectDock retains implementation-grade names for entities with no user-facing text —
**honest**, because PD's measured capability-string count is 0 (GTK labels are dynamic);
each such name carries `basis: technical_vocabulary_only` plus aliases/keywords for lookup.

## 4. Type-Resolution Rules

`src/canonical/typing.js` — conservative, evidence-recorded:

- **T1** — a feature with no capability string, no user-action vocabulary, no
  user-surface file, and ≥2 infrastructure behavior markers is corrected to system.
- **T2 guard** — file count alone never flips a labeled capability to system.
- **T3 guard** — a system with UI strings and ≥2 external consumers stays a system.
- Uncertain entities keep their recorded type; the review is recorded per entity under
  `provenance.type_review`. On the validated corpus **0 corrections fired** (4C.2 typing
  held up), and the rules are regression-tested on synthetic fixtures.

## 5. VOI Architecture

`src/canonical/voi.js` — a distinct, deterministic stage between consolidation and
canonical resolution:

1. **Question enumeration** from recorded state (no arbitrary source scans):
   - `complementary_layers` — same-kind system pairs with a direct import edge but no
     shared identity vocabulary (server-infra class);
   - `shell_or_capability` — state/incidental-dominated features owning a route/shell
     file with chrome markers in behavior (feature-lobby class);
   - `merge_strength` — consolidation merges whose evidence carried no corroborating
     signal, re-verified by reading (poster-data / auth / collections class);
   - `resolve_or_keep` — ambiguous entities with relationship impact;
   - `type_confirmation` — low-confidence canonical entities.
2. **Existing evidence first**: annotation string classes, declared symbols, the 4B.1/4B.2
   clue index, consolidation decisions, relationships. Files already carrying clue
   evidence are not re-read except under a specific open question.
3. **Bounded reads** reuse the 4B.1 clue extractor (≤2 files/question, ≤40/repo,
   deterministic ranking by declares → degree → path).
4. **Decision log**: every question records reason, expected impact, evidence consulted,
   files inspected, findings, decision, confidence, and whether the output changed —
   plus `would_resolve_with` for questions left open.

## 6. Inspection Budget and Prioritization

- Budget: `maxReadsPerQuestion = 2`, `maxTotalReadsPerRepo = 40` (deterministic,
  configurable, recorded in `canonical-report.json`).
- Actual usage: ProjectDock **11 reads** (11 questions); CinePrint **26 reads**
  (15 questions). The stage performs no wholesale re-inspection; upstream stages are
  unchanged, so the repo-level inspection rate is unchanged (CP ≈81.6%, PD ≈70%) — the
  ≤50% target remains a VOI/consolidation outcome for future tuning, not something this
  phase forced by skipping evidence.

## 7. VOI Decisions (mandated cases)

- **feature-lobby → reclassified_shell_context.** Inspection of `__root.tsx` confirmed
  404/shell behavior (NotFound/Error components) with no capability label beyond the
  recorded state/context text. The entity moved out of canonical features into
  `unresolved.json` (status `reclassified_shell_context`, fully reversible, evidence
  recorded). The checkpoint's last standing UI false positive is resolved by inspection.
- **server-infra (app-error + error-response) → keep_separate.** Reads found no
  user-plausible shared behavioral vocabulary beyond the import edge; the generic-vocabulary
  anti-merge stands. Recorded with `would_resolve_with` (shared responsibility terms
  confirmed in both implementations, or a common architectural layer with complementary
  behavior).
- **image vs poster-data → grouping confirmed.** The 4C.2 merge's recorded shared
  vocabulary (`poster`) was confirmed at behavior level by reading (`notion.ts` loads/
  caches posters; `posters.ts` provides the poster domain types), and the merged entity
  was renamed "Poster" (T2). The oracle tension (Phase 2B had a separate image-system)
  remains recorded in `provenance.naming_evidence` and the merge record.
- Additionally, all three 4C.2 merge groups (auth, collections, poster-data) were
  **confirmed by reading** — consolidation decisions survived VOI re-examination.

## 8. Projection Completeness Changes

`src/project/render.js` implements the Phase 2 template contracts for the first time:

- `INDEX.md` — query index: features/systems by name with aliases, technical-name →
  canonical-name mapping (implementation terms), file→entity navigation index,
  unresolved/ambiguous listing, relationships, explicit empty-flows statement.
- `features/<id>.md`, `systems/<id>.md` — canonical name, type, confidence, description,
  purpose/interactions, aliases/keywords, files (incl. recorded non-application files),
  relationships, naming provenance, evidence, notes.
- `unresolved.md` — every ambiguous/unresolved/demoted/reclassified entity with reason,
  misleading strings, and what would resolve it.
- `ARCHITECTURE.md` — systems/features overview + relationship graph.

Deterministic (no timestamps, sorted iteration). R11 tests enforce: every canonical
entity has a page; no fabricated pages; pages reference valid entities/files; relationship
endpoints valid; unresolved entities appear in `unresolved.md` and `INDEX.md`; technical
aliases resolve in the index; repeated rendering byte-identical.

## 9. Description-Template Changes

`src/canonical/describe.js` — separate strategies: features ("Lets users …" from
capability strings/behavior verbs, anchored by a real capability label); systems ("Shared
… responsibility for N other capability areas … Architectural support rather than a
user-visible action"); unresolved ("Insufficient evidence to resolve this area: …");
ambiguous (competing interpretations); demoted ("Recorded as a false positive rather than
deleted: …"). Every sentence derives from recorded evidence; each entity page explains
why its files are included (`fileWhy`). The 4B.2 class of leaked state labels
("The interface labels it 'no auth token'") is gone — only capability-class labels are
cited.

## 10. R1–R12 Regression Status

| ID | Case | Status |
|---|---|---|
| R1 | context-only UI string cannot seed | ✅ 4C.2 Rule A (consolidation D3) |
| R2 | incidental string cannot seed | ✅ 4C.2 Rule B |
| R3 | state-only string cannot create (may support) | ✅ 4C.2 Rule C (D1) |
| R4 | test-file anchoring blocked | ✅ 4C.2 Rule D (D0) |
| R5 | generated-file anchoring blocked | ✅ 4C.2 Rule D (D0) |
| R6 | automation-file anchoring blocked | ✅ 4C.2 D0 + 4C.3 anchor-class test |
| R7 | valid fragment merge | ✅ 4C.2 Rule E (S5/S1) |
| R8 | unrelated anti-merge (+ veto recording) | ✅ 4C.2 Rule E |
| R9 | ambiguity preservation | ✅ 4C.2 Rule F + 4C.3 VOI keep |
| R10 | duplicate-name / ID collision | ✅ 4C.2 Rule G + D2 |
| R11 | projection completeness | ✅ 4C.3 projection tests (both smoke repos + validated corpora) |
| R12 | misleading technical naming / type authority | ✅ 4C.3 naming + typing tests |

(The project's original R1–R12 numbering from `PHASE_4C_ARCHITECTURE_PROPOSAL.md` differs;
the mapping above preserves each case's intent — R1-relative-imports and R9-notion were
implemented and validated in 4C.1A/4B.2 respectively, and the notion.ts naming guard is
re-covered here by the R12 regression.)

## 11. ProjectDock Before/After

| Metric | 4C.1 checkpoint | 4C.2 | **4C.3 final** |
|---|---:|---:|---:|
| Canonical entities | 15 | 13 | **13** (3F/10S) |
| Renames | — | — | **2** (T2, recorded) |
| VOI reads | — | — | 11 / 40 budget |
| Ambiguous / unresolved | 1 / 2 | 1 / 1 | **1 / 1** |
| Relationships | 18 | 14 | **14** |
| Demoted false positives | — | 0 | **0** (all PD modules hold behavioral evidence) |
| Inspection rate | 70.8% | 70.1% | 70.1% (unchanged stages) |

Honest note: PD names remain implementation-grade ("Cmake", "Marker", …) because PD
produces no capability-class text for the namer to use; every name records its basis and
the technical vocabulary is fully indexed for lookup.

## 12. CinePrint Before/After

| Metric | 4C.1 checkpoint | 4C.2 | **4C.3 final** |
|---|---:|---:|---:|
| Canonical entities | 41 | 23 | **22** (15F/7S) |
| False positives (found/artist-2/preview/palette) | 5 present | 4 demoted | **resolved** (demoted; `feature-lobby` reclassified by VOI) |
| Auth fragmentation | 4 systems | 1 system | **1 system ("Admin")**, VOI-confirmed |
| Browsing fragmentation | 4 features | 1 merged | **"Search Artist"**, user-facing name |
| poster-data | 3 systems | 1 merged ("Image") | **1 system ("Poster")**, VOI-confirmed + renamed |
| Conflations | 2 | 1 (service) | **1** (service, reduced to its application file) |
| Ambiguous preserved | 7 | 6 | **6** (+1 resolved by evidence in 4C.2) |
| Demoted/reclassified (preserved, not deleted) | — | 14 | **15** (14 demoted + 1 shell) |
| Relationships | 32 | 24 | **23** |
| Inspection rate | 81.4% | 81.6% | 81.6% (+26 targeted VOI reads) |

## 13. Oracle Tensions and Preserved Ambiguities

- **image/poster-data grouping**: Phase 2B oracle had separate image-system; the merged
  entity is VOI-confirmed and named "Poster". Tension recorded in provenance; reversal
  path documented.
- **server-infra**: oracle had one server-infrastructure system; the evidence ladder and
  VOI reads say keep_separate. Recorded with what would resolve it.
- **PD naming**: oracle capabilities are user-facing; PD's observable text is not. Names
  stay implementation-grade with full lookup provenance — honest rather than fabricated.
- **Preserved ambiguity**: CP 6 ambiguous entities preserved verbatim; PD
  `ambiguous-editor` preserved; `ambiguous-auth` remains resolved only by recorded
  evidence; nothing was forced.

## 14. Inspection-Rate and Budget Results

See §6. The budget held (11/40 PD, 26/40 CP); every read is question-logged with reason,
findings, and decision. Upstream inspection rates are unchanged by design — this phase
adds decision-directed reads only, and demonstrates the machinery the ≤50% target will be
reached with (evidence-first + budgeted question-driven reads), not by arbitrary skipping.

## 15. Determinism Results

Two complete pipeline runs per repo (phase-4c3 vs phase-4c3-det): all canonical artifacts
(features/systems/unresolved/relationships/files.json) and all Markdown projections are
**byte-identical**. `canonical-report.json` differs only in recorded input directory paths
(provenance), verified content-equal otherwise. No timestamps anywhere in stage output.

## 16. Source/Artifact Integrity Results

- Protected manifest (downstream src incl. 4C.2/4C.3 modules, collector, annotation,
  schemas, templates, examples, checkpoint-4c1, phase-4c2, prior semantic outputs, both
  Phase 2 oracle maps): **495 files, 0 changes**.
- ProjectDock and CinePrint: **0 drift** attributable to CodeAtlas (repos only read).
- Phase 2 oracle maps, checkpoint-4c1, phase-4c2 artifacts: untouched.
- No external SDK/runtime dependency (`dependencies`: none).

## 17. Full Test Results

**194 tests / 58 suites / 0 failures** — 138 pre-existing (unmodified since 4C.1) + 24
consolidation (4C.2) + 17 canonical + 16 projection/smoke (4C.3). No test was weakened;
no expectation rewritten to hide a regression.

## 18. Remaining Limitations

1. PD canonical names remain implementation-grade (no user-facing text observable);
   lookup works via aliases/keywords/implementation_terms.
2. CP inspection ≈81.6% / PD ≈70.1% — the ≤50% projection requires retiring singleton
   fallback reads in 4B.1/4B.2 (D-018 work) and was explicitly not forced here.
3. Description grammar for evidence-poor entities is plain ("Covers the … part of the
   interface").
4. Two oracle tensions recorded (image grouping, server-infra separation) — both carry
   `would_resolve_with` paths.
5. Flows remain unprojected (no call-chain evidence) — stated explicitly in projections
   rather than fabricated.

## 19. Recommendation for Private Beta Readiness

**Ready for a private beta of the JSON-first map with Markdown navigation**, with the
following framing: CinePrint's canonical map is now genuinely user-facing (capability-
derived names, demoted noise recorded rather than deleted, VOI-audited grouping);
ProjectDock's map is structurally reliable with technical naming and full lookup
provenance. Agents should treat `confidence: low/unknown` and `unresolved.md` as
first-class navigation signals — the pipeline now says what it knows, what it guessed,
and what it could not decide. Recommended beta scope: read-only map consumption
(lookup, navigation, file→entity queries); not yet: automated map writing back into
repositories, natural-language lookup server, or flow assertions.
