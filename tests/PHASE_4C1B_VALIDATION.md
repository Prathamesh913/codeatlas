# Phase 4C.1B — Semantic Annotation Layer — Validation Report

**Date:** 2026-08-29
**Scope:** One deterministic annotation authority: (1) UI string classification (D-016),
(2) file-level semantic relevance classification (D-017). Annotation is **additive**:
raw evidence, collectors, structural analysis, investigation, carving, and canonical
resolution are untouched. No consolidation, naming, lookup, or VOI work was started.

---

## 1. Problem Addressed

Phase 4B.2 produced false-positive/misnamed entities because raw strings and files had
**no classification**: empty-state text, marketing prose, font configuration, automation
test literals, and genuine user actions all carried identical semantic weight. Measured
cases (from `tests/PHASE_4C0_FAILURE_TAXONOMY.md`, provenance re-verified against the
actual evidence during this phase):

| Entity | Actual seeding evidence (file:line verified) |
|---|---|
| `feature-found` | `title="No posters found"` + `Plot Twist: No Matches Found!` (`src/routes/index.tsx`) |
| `feature-artist-2` | `aria-label="CinePrint manifesto"` + manifesto prose (`src/routes/-components/home-discovery.tsx`) |
| `feature-preview` | visible text `RETRY PREVIEW` + `console.error` (`src/components/GalleryErrorBoundary.tsx`) |
| `feature-lobby` | navigation chrome in `__root.tsx` (4C.0 B4; string since removed by the owner) |
| `feature-service` | automation test literals (`automation/tmdb/service.test.ts` et al.) |
| alias pollution | `ctx.font = 'bold 52px "Bebas Neue", sans-serif'` (`src/lib/ticket.ts`) |
| PD test contamination | structural unit-001 = 8 production files **+ 16 test files** merged as one cluster |
| `feature-score` / `system-pid` | behavioral-symbol naming / cross-file term merge — **not string failures**; annotation is deliberately orthogonal (see §12) |

Additionally, **Python docstrings** ("Return [] on failure.") tripped state classification
during validation and are now excluded at extraction time (deterministic triple-quote scan).

## 2. Annotation Architecture

```
Phase 3 v2 OBSERVE                  Phase 4C.1B ANNOTATE (this phase)
evidence/                           annotation/
├── files.json      (read)   ──►    ├── files.json    relevance class + policy + flags (verbatim)
├── manifest.json   (read)          └── strings.json  per-string classification + provenance + policy
└── …               (untouched)
     source files read ONLY for string context (4C.0 Part C; never re-observed)
```

New module (only code change in `src/` this phase):

| File | Responsibility |
|---|---|
| `src/annotate/classify.js` | `classifyString(value, hint)` — the single UI-string authority (four classes, ordered deterministic rules) |
| `src/annotate/relevance.js` | `classifyRelevance(file)` — relevance classes + per-class downstream policy contract |
| `src/annotate/extract.js` | `extractStrings(content)` — bounded, dependency-free, span-claiming extraction (no AST) |
| `src/annotate/index.js` | `annotate(evidenceDir, repoRoot, outputDir)` — orchestrator; writes `annotation/files.json` + `annotation/strings.json` |
| `src/annotate/cli.js` | guarded CLI: `node src/annotate/cli.js <evidence-dir> [output-dir] [repo-root]` |

Input contract: Collector v2 `files.json` (+ `manifest.json` for `target_root` fallback).
`imports/symbols/entrypoints` are available but intentionally unconsumed — the smallest
layer that satisfies the contract. Strings are extracted **only** from files of relevance
class `application`/`supporting`; all other classes are policy-handled at file level
(their content stays in raw evidence and in the repositories — nothing is deleted).

## 3. UI Taxonomy (D-016)

Four classes, each with a fixed downstream policy embedded in every string entry:

| Class | can_seed_entity | can_name_entity | alias_eligible | support_only |
|---|---|---|---|---|
| capability | true | true | true | false |
| context | false | true | true | false |
| state | false | false | false | true |
| incidental | false | false | false | false |

`state.support_only=true` encodes 4C.0 B3 exactly: state vocabulary ("No saved posters")
may support an *existing* capability hypothesis but never seeds or names.

## 4. Contextual Classification Rules

Classification is syntax-first (bounded source parsing), lexicon-second — never content-only.
Extraction passes, in fixed order, each claiming character ranges so later passes never
duplicate a capture: JSX/HTML tags (element-aware props + text nodes) → GTK labels
(`Gtk.Label(label=…)`, `Gtk.Button(new_with_label(…)`) → error construction
(`throw new Error`, `raise ValueError`) → console (`error/warn` = diagnostic,
`log/info/debug` = output) → font values (`ctx.font`, `fontFamily`) → URLs → style classes →
`title:` route-head objects → generic props → plain literals (≥2 letters, docstring-excluded).

`classifyString` precedence (first match wins; §1 of the module documents each rule's
measured justification):

1. **State lexicon** — empty results (`no … found`, `not found`, `no matches/results/…`),
   retry (`retry`, `try again`), error (`failed`, `error`, `unable to`, `unauthorized`, `invalid`…),
   loading, confirmations. **Overrides every other signal** — this is the measured rule:
   "No posters found" arrived through a weak `title=` prop and MUST still be state; a
   `retry` button inside an error boundary is error-recovery, not a capability identity.
2. `error_construction` / `console_diagnostic` → state; `console_output` → incidental.
3. Non-text kinds → incidental: `url`, `class_name`, `canvas_font`/`font_config`
   (font/brand values — kills the "Bebas Neue" alias), `markdown_heading`.
4. **Prose length** (≥10 words) → incidental (marketing/manifesto).
5. **Interactive context** (button/a/input/select/textarea/summary or `*[A-Z]?\\w*(Button|Link|Tab|Menu|…)`):
   verb-first phrase → **capability** (`interactive_verb_phrase`); noun phrase → **context**
   (`control_destination_label`).
6. `placeholder` with verb-first → capability (`action_placeholder`) — a search placeholder
   labels the control's primary action; else context hint.
7. Headings/labels (`h1–h6`, `title`, `label`, `Gtk.Label`) → context (`heading_or_label`);
   `doc_title` → context; element-less props → context (`prop_label`).
8. Everything else → incidental (`unpositioned_literal`) — safe zero-weight default.

The action-verb set is bounded (~60 common UI verbs, exact first-word match incl. common
inflections). Navigation decision (U2, documented): verb-first navigation = capability
("Open Project"); destination noun phrases = context ("Saved Posters") — this is what
prevents navigation chrome ("Back to lobby") from seeding a standalone Feature.

## 5. Semantic Relevance Classes (D-017) and Multi-Flag Precedence

Six classes; precedence so the most semantically restrictive mechanically-observable role wins:

**generated > test > automation > documentation > supporting > application**

- `generated` — collector flag `is_generated_like` (covers the whole `.vercel/` tree).
- `test` — `is_test_like` (a test is a test regardless of directory: `automation/x.test.ts` → test).
- `automation` — `is_automation_like`.
- `documentation` — `is_documentation_like` or markdown extension.
- `supporting` — non-source content, or deterministic configuration by location/filename
  (`config/` segment, `*.config.js|ts`).
- `application` — source language without disqualifying flags.

Deliberate humility: utilities inside product source trees (`src/lib/…`) remain application —
flags must never claim more than they observe. Collector flags and flag reasons are copied
**verbatim** into every annotation entry (`mechanical_flags`, `mechanical_flag_reasons`) —
zero information loss (S7). Per-class policy contract (data, not yet implemented anywhere):

| Class | entity_seeding | naming_support | inspection | structural_participation |
|---|---|---|---|---|
| application | eligible | full | normal | preserved |
| supporting | weakened | support | low | preserved |
| test | excluded | none | low | preserved |
| automation | excluded | none | low | preserved |
| generated | excluded | none | skip | preserved |
| documentation | excluded | context_only | skip | preserved |

## 6. Provenance Model

Every string entry (compact, machine-readable, per Part D):

```json
{ "file": "src/routes/index.tsx", "line": 240, "value": "No posters found",
  "context": "prop", "element": "Link", "prop": "title",
  "classification": "state", "reason": "state_lexicon:empty_result",
  "policy": { "can_seed_entity": false, "can_name_entity": false, "alias_eligible": false, "support_only": true } }
```

Every file entry: `{ path, language, relevance_class, relevance_reasons[], mechanical_flags,
mechanical_flag_reasons, semantic_policy }`. Reason vocabularies are closed
(`state_lexicon:empty_result|retry|error|loading|confirmation`, `interactive_verb_phrase`,
`control_destination_label`, `heading_or_label`, `prop_label`, `visible_text`,
`action_placeholder`, `placeholder_hint`, `prose_length`, `font_or_brand_value`,
`url_literal`, `style_class`, `error_construction`, `console_diagnostic`, `console_output`,
`documentation_content`, `unpositioned_literal`, `mechanical_flag:*`, `config_location`,
`config_filename`, `non_source_content`, `source_language:*`).

## 7. Downstream Policy Contract (documented, NOT implemented)

| Relevance | Structural graph | Investigation | Entity seeding | Naming | Inspection |
|---|---|---|---|---|---|
| application | participates | normal | eligible | full | normal |
| supporting | participates | low priority | weakened | support | low |
| test | participates structurally | low priority | cannot seed user Feature | none | low |
| automation | participates structurally | low priority | cannot seed product Feature | none | low |
| generated | participates structurally | skip | cannot seed | none | skip |
| documentation | participates | skip | cannot seed canonical entity | context only | skip |

No 4B.1/4B.2 code consumes these yet. The contract exists so later stages consume ONE
classification authority instead of recreating ad-hoc exclusions.

## 8. Actual Phase 4B.2 Regression Cases (Part I)

Verified against real Collector v2 evidence + real repositories (current owner-edited trees;
`Plot Twist: No Matches Found!` still present at `index.tsx:308`):

| # | Failure input | Annotation result | Effect |
|---|---|---|---|
| 1 | "No posters found" (`index.tsx:240`) | **state** `state_lexicon:empty_result`, seed=false | `feature-found` cannot seed |
| 2 | "Plot Twist: No Matches Found!" (`index.tsx:308`) | **state** `state_lexicon:empty_result` | same |
| 3 | Manifesto prose (`home-discovery.tsx:34`) | **incidental** `prose_length`, zero weight | `feature-artist-2` prose weight gone |
| 4 | `aria-label="CinePrint manifesto"` (line 19) | **context** `prop_label`, seed=false | cannot seed; naming/alias support only |
| 5 | "RETRY PREVIEW" (`GalleryErrorBoundary.tsx:54`) | **state** `state_lexicon:retry` (overrides interactive context) | `feature-preview` cannot seed |
| 6 | `console.error("Uncaught error in gallery content:")` (line 24) | **state** | same |
| 7 | "Bebas Neue" (`ticket.ts:166` full canvas string; `:190/:198`) | **incidental** `font_or_brand_value` / `unpositioned_literal`, alias=false | alias pollution impossible |
| 8 | `routeTree.gen.ts` | relevance **generated**, 0 strings extracted | build artifacts zero-weight |
| 9 | `.vercel/**` (145 files) | **145/145 generated**, 0 strings | rebuild noise zero-weight |
| 10 | `automation/**` (31 CP files) | **automation**, 0 strings | `feature-service` literal pollution structurally impossible |
| 11 | PD `tests/**` (17 files) | **test**, 0 strings | unit-001 test literal pollution structurally impossible |
| 12 | "Search posters, artists, tags…" (`FilterBar.tsx:71`, Header ×2) | **capability** `action_placeholder` | genuine search capability preserved |
| 13 | "Unpin Poster" (`ContextMenu.tsx:137`), "Poster actions" (:111) | **context** (visible_text/prop_label) | `feature-context` cannot seed from strings |

`feature-score` (PD `search.py`) and `system-pid` (`hyprland.py` + `sessions.py`): both files
classify `application`; annotation contributes no false signals but does not and must not
rename or un-merge — those belong to 4C.3 naming/consolidation (R7/R8 gate work).

## 9. ProjectDock Validation

Relevance distribution (65 inventory files):

| application | supporting | test | automation | generated | documentation |
|---|---|---|---|---|---|
| 22 | 12 | 17 | 1 | 0 | 13 |

String classification (1,311 strings from the 22 application + some supporting source files):
**capability 0, context 25, state 7, incidental 1,279.**

Structural insight (Part J): the 4B.2 false positives drew from structural **unit-001 = 24
members: 8 application + 16 test** files merged as one connected component. Annotation now
names every member's class while the structural graph is untouched (validation run: 88 nodes /
625 edges, byte-unchanged from 4C.1A). Tests cannot seed entities under the policy contract,
so "production + tests" clusters no longer translate into "production + tests" semantics.

PD state strings are now exclusively real failure values (`raise ValueError("invalid target")`,
`"no project root available"`, `"creation failed"`); docstring prose ("Return [] on failure.")
was measured as false state during validation and is excluded at extraction (triple-quote
scan, tested). PD `capability=0` is the honest mechanical result: ProjectDock has **no
static `Gtk.Button` labels** — actions render via dynamically composed `set_label(f"…")`
labels and CSS-styled boxes. Its 25 context strings ("Run Dev Server", "Run Tests",
"Build Project", "open config", …) remain available for naming support.

## 10. CinePrint Validation

Relevance distribution (398 inventory files):

| application | supporting | test | automation | generated | documentation |
|---|---|---|---|---|---|
| 115 | 37 | 40 | 31 | 146 | 29 |

String classification (2,288 strings): **capability 21, context 467, state 149,
incidental 1,651.** Context breakdown: jsx_text 466, prop 61, class_name 18, doc_title 12,
canvas_font 10, url 7; state: error-lexicon 78, retry 18, empty-result 16, loading 8,
confirmation 1, error_construction 23, console 5.

All 21 capability strings are genuine user actions — "Submit", "Log out", "Close",
"Toggle Sidebar", "Submit Poster", "Delete", "Sign in", "Reset View", "Clear all",
"Browse all →", "Browse the Archive", "Browse gallery", "Browse Posters" (×2),
"Search posters, artists, tags…" (×3), "Search star systems...", "Submit another poster".
No empty-state, error, navigation-chrome, font, or automation string classified capability.

The strings responsible for the known failures (manifesto aria-label/prose, "RETRY PREVIEW",
"Bebas Neue", "No posters found") all carry corrected classes with seed=false — see §8.

## 11. Determinism

`annotate()` executed twice per repository into separate output directories; both artifacts
compared byte-for-byte: **ProjectDock files.json + strings.json BYTE-IDENTICAL;
CinePrint files.json + strings.json BYTE-IDENTICAL.** In-suite: the fixture pipeline runs
twice and asserts byte equality (test K). Outputs are sorted deterministically (files by
path; strings by file/line/value/context), contain no timestamps and no random IDs.

## 12. Backward Compatibility

- Raw Collector v2 evidence byte-identical after annotation (in-suite test L on fixture
  evidence; real evidence caches never written to — annotation writes only to
  `validation/annotation/`).
- Phase 3 consumers unaffected: nothing under `src/collectors/`, `src/collect.js`,
  `src/structural/`, `src/investigate/`, `src/semantic/` changed this phase (checksum
  manifest `sha256sum -c src.final` passes; the only `src/` addition is `src/annotate/`).
- Phase 4A can still consume raw evidence unchanged (evidence untouched; 4A outputs in
  `validation/structural/` unchanged from 4C.1A).
- No 4B.1 changes, no 4B.2 changes, no consolidation, no naming, no lookup, no VOI.
- Annotation tolerates flag-less (v1) evidence deterministically (tested).

## 13. Tests

**138 total / 37 suites / 0 failures** — all 96 pre-existing tests unmodified and green,
plus 42 new annotation tests in `tests/unit/annotation.test.js` (42 = 41 + 1 docstring
rule added during validation): R2/R2b/R3/R3b/R4/R4b (failure regressions), U1–U8 + U2b/U5b
(UI taxonomy), S1–S7b + backward-compat (relevance), and the end-to-end pipeline suite
(collect → annotate → assert, K/L byte checks, S8 no-exclusion, provenance-shape checks).

Fixtures: `tests/fixtures/annotate-app/` — 12 files reproducing every failure shape
(empty state, error boundary, manifesto, canvas font, headings/labels, generated route
tree, tests, automation, multi-flag automation test, docs, config).

## 14. Known Limitations

1. **Bounded parsing, not an AST** (explicit design constraint): strings inside larger JS
   strings or comments may be captured; template-literal interpolation stops matches;
   text-node element attribution is nearest-preceding-tag (e.g. `RETRY PREVIEW` attributes
   to the `<RotateCw/>` icon inside its anchor — classification unaffected because the
   state lexicon outranks context).
2. **Data-resident action labels**: command labels held in plain arrays/objects ("Unpin
   Poster" lives in a `<span>`, PD quick-actions in `label=` props) classify **context**,
   not capability — without observable UI syntax, capability would over-seed. They still
   support naming/aliases. The PD `capability=0` result follows from this plus dynamic
   f-string labels (`set_label(f"{name} …")`), which are not statically extractable.
3. **Python f-strings** with interpolation are not cleanly extractable (same class as
   template literals).
4. **Docstring interior lines** of *multi-line* triple-quoted blocks are skipped only for
   plain-literal and error passes; exotic mixed-quote constructs could evade the parity scan.
5. **Evidence/source drift**: annotation reads file *lists* from collected evidence and file
   *contents* at annotation time; if a repository changes after collection, line numbers may
   drift for edited files (CP owner edited 5 source files between evidence collection and
   this validation — handled, but worth remembering).
6. **Placeholder/capability judgment**: verb-first placeholders ("Search projects") are
   capability — a deliberate documented interpretation (U5), conservative because it
   requires a bounded verb.

## 15. Explicit Non-Goals

No recollection; no collector changes; no exclusions; no string deletion; no Phase 4A/4B.1/
4B.2 modifications; no consolidation; no canonical-resolution changes; no naming; no lookup;
no VOI inspection; no ProjectDock or CinePrint modification; no downstream policy execution.

## 16. Verdict

Phase 4C.1B is implemented and validated: one deterministic annotation authority, four-class
UI taxonomy with contextual rules, six-class relevance model with documented precedence,
zero information loss, byte-identical determinism on both real repositories, all measured
4B.2 failure shapes reclassified with seed=false, and raw evidence + downstream stages
provably untouched. **Recommendation: YES — the checkpoint (re-run 4A → 4B.1 → 4B.2
unchanged against Collector v2 + Annotation evidence) is ready to be requested.** Do not
begin the checkpoint or Phase 4C.2 automatically.
