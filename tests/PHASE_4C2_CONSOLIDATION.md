# Phase 4C.2 — Consolidation Validation

**Date:** 2026-09-03
**Scope:** A dedicated consolidation stage (`src/consolidate/`) between Phase 4B.2 and the
canonical projection, consuming the annotation layer (4C.1B) to reduce fragmentation,
conflation, and false-positive entities **before final canonical projection** — without
modifying Collector v2, Annotation, 4A, 4B.1, or 4B.2, and without starting 4C.3.

---

## 1. Implementation Summary

New module `src/consolidate/` (zero dependencies, deterministic, read-only on inputs):

| File | Responsibility |
|---|---|
| `index.js` | Orchestrator: load inputs → entity models → demote → separate → merge → issue ids → remap relationships → write `consolidation/` artifacts |
| `rules.js` | Entity annotation (relevance partitioning, string classes, seed support), demotion rules D0/D1/D2/D3, separation + bridge rules, merge evidence ladder S1/S1b/S3/S5 with anti-merge AM1/AM2/AM3, alias-target resolution |
| `ids.js` | Deterministic identity minting: evidence slug + FNV-1a content-hash collision suffix (position-independent) |
| `cli.js` | Guarded CLI: `node src/consolidate/cli.js <evidence> <annotation> <structural> <investigation> <semantic> [out]` |

Artifacts written to an isolated `<outputDir>/consolidation/` directory:
`features.json`, `systems.json`, `unresolved.json`, `relationships.json`,
`consolidations.json` (the complete decision log), `consolidation-report.json`.

Tests: `tests/consolidation/consolidation.test.js` (24 tests over 11 rule groups +
a full-pipeline integration test). Fixture repo: `tests/fixtures/consolidate-app/`.

## 2. Pipeline Changes

```
Collector v2 → Annotation → 4A → 4B.1 → 4B.2 → 4C.2 CONSOLIDATE → canonical JSON → Markdown projections
```

- 4C.2 is a **distinct stage/module** — no consolidation logic hides in other stages.
- Every stage before it ran **unchanged** (checksum-verified, §17).
- Canonical JSON remains the source of truth; consolidation refines it with recorded
  evidence (D-013). No Markdown projector exists yet; projections remain templates/examples.

## 3. Consolidation Rules (deterministic, evidence-typed)

**Demotions** (canonical features/systems only; ambiguity untouched):
- **D0 `non_application_anchor`** — no application/supporting primary file (relevance
  policy, D-017). Test/generated/automation/docs files can never anchor.
- **D1 `state_seeded_identity`** — the identity token(s) occur in the entity's application
  evidence ONLY inside state/incidental-class strings (path/module-shaped strings excluded —
  they are Tier-4 references). State text never seeds (D-016).
- **D2 `duplicate_identity_weaker_evidence`** — two same-kind entities share one seed term;
  the one without seedable evidence (capability strings/behavior) is demoted as a duplicate.
- **D3 `no_seedable_evidence`** — no capability string, no behavioral evidence, no
  user-action vocabulary: context may name, never seed (D-016).

**Separations** (conflation splits): an entity whose application files form >1
import-connected component, with **no bridge** — components sharing user-facing domain
vocabulary (capability strings/symbols, no df cap) or a filename stem (`saved.ts`/
`saved.tsx`) are one responsibility (D-012) and are **not** split. Generic stems
(`context` in `ContextMenu.tsx` vs `context.ts`) do not bridge.

**Merges** (single-linkage over accepted pairs; every pair evaluation recorded):
- Strong signals: **S1** identical capability string naming both entities' own domain;
  **S1b** same user-action verb + same domain noun in capability strings;
  **S3** ≥2 shared discriminative domain terms (capability/symbol vocabulary, exclusive to
  the pair — present in no third participant); **S5** direct application-file import edge
  with shared domain vocabulary at both ends.
- Anti-merge vetoes: **AM1** shared vocabulary generic or not pair-exclusive;
  **AM2** relation explained only by noise-class files; **AM3** persistence-service shape
  without domain interaction. Weak evidence (shared utilities, generic words like
  "service"/"context", framework imports, importer counts) can never merge (§4).
- **Mixed-type groups** (feature+system) split by layer: members with capability strings
  are the feature side; the rest the system side. If the system side has external
  consumers (imported from outside the group) the output is a feature + system pair;
  otherwise the system side is absorbed as an internal layer of one feature.

**Ambiguity:** ambiguous/unresolved entities merge only under strong evidence (recorded,
with competing interpretations preserved in the merge record); otherwise they pass through
verbatim and are listed in `ambiguity_preserved`.

**Ids:** slug from evidence (identity term; positional suffixes like `-2` stripped), unique
within kind; collisions resolved by a 6-hex FNV-1a hash of the entity's own sorted file set
— deterministic, stable, position-independent. Every id change is recorded in `id_map`.

## 4. Annotation Signals Consumed (exact)

| Signal | Consumed for |
|---|---|
| `annotation/files.json` relevance classes | D0 anchoring; noise partitioning (`non_application_files`); merge participation (AM2); split component graphs (application files only); external-consumer checks |
| `annotation/strings.json` string classes (capability/context/state/incidental) | Seed legality (D1/D3); demotion evidence (`misleading_strings`); merge signals (S1/S1b/S3/S5); separation bridges; merge naming |
| String `policy` (seed/name/alias flags) | Enforced via class-based rules — state/incidental never seed; context never seeds alone |
| Mechanical flags | Consumed verbatim **through** the annotation layer (D-017), never re-derived |
| Structural graph (edges, declares) | Separation components; S5 edges; external-consumer checks; symbol vocabulary |
| Investigation candidates (4B.1 clues) + 4B.2 additional-inspection evidence | Behavioral evidence for seed legality, split ranking, and tier comparison |
| Semantic entities/regions | The consolidation subjects + seed terms + region provenance |

Consumption is **demonstrable, not decorative**: Rule H flips a consolidation decision by
reclassifying one string (capability → state ⇒ entity demoted); every output entity carries
an `annotation_summary`; every decision cites its annotation evidence.

## 5. Merge Decisions (phase-4c2 real-corpus runs)

**CinePrint** (5 groups):
| Group | Mode | Evidence |
|---|---|---|
| `feature-artist` + `feature-tag` | single_feature | S1 — identical capability string "Search posters, artists, tags…" naming both domains (browsing consolidation; R6 partial) |
| `feature-add` + `feature-collection` | single_feature | shared collection vocabulary (owner's new modal consolidated into collections) |
| `feature-profile` + `system-like` | feature_and_system | S5 `user-profile.ts → user-likes.ts`, shared `profile` (likes belong to the profile domain) |
| `system-admin` + `system-auth` + `system-auth-middleware` + `ambiguous-auth` | single_system | S5 edges (`auth.tsx → auth-initialization.ts`, `auth-middleware.ts → server-auth.ts`) with shared `auth`/`uid` vocabulary — the auth system consolidates 4→1 (R5); `ambiguous-auth` resolved by recorded evidence |
| `system-artist` + `system-image` + `system-poster` | single_system | S5 `notion.ts → posters.ts` + poster-images edges — poster-data consolidation (notion.ts absorbed at file level) |

**ProjectDock** (3 groups): `feature-printable` + `feature-creation` + `system-cover`
(feature_and_system), `feature-project` + `system-marker`, `system-run` +
`unresolved-command` (→ `system-cmake`) — all S5 edge + shared-symbol evidence between
production modules; recorded with full provenance.

Non-merges: 88 pair evaluations recorded in the smoke baseline; the validated runs record
every vetoed pair with its veto class (AM1/AM2/AM3).

## 6. Split and Demotion Decisions

**Separation (1):** `feature-context` — kept `ContextMenu.tsx` (the UI feature),
separated `src/server/request/context.ts` (import-disconnected server half, generic-only
shared stem) → unresolved fragment. R7 satisfied: the conflation is split, nothing deleted.

**Non-splits (D-012 guards):** `feature-artist` (shared "artist" vocabulary),
`feature-collection`, `feature-profile` (filename stem `profile`), `feature-save`
(filename stem `save`), `system-image` (shared `image`/`poster` vocabulary) — the split
rule refused to break validated cross-file entities.

**Demotions (CinePrint, 14):**
- D0 (noise anchor, 9): `feature-palette`, `feature-url`, `system-access`,
  `system-cineprint-draft`, `system-client`, `system-download`, `system-env`,
  `system-optimize`, `system-types` — automation/test-anchored entities eliminated.
- D1 (state-seeded identity, 4): `feature-found` ("No posters found"), `feature-preview`
  ("RETRY PREVIEW"), `feature-poster` ("No Posters Found"), `system-firebase`.
- D2 (weaker duplicate, 1): `feature-artist-2` (manifesto/context-only twin of
  `feature-artist`).
**ProjectDock: 0 demotions** — every PD entity holds real behavioral evidence.

## 7. Ambiguity Decisions

- **Preserved:** CP `ambiguous-account/-external/-outcome/-prop/-search/-vite` (6) pass
  through verbatim; PD `ambiguous-editor` preserved. All are listed in
  `decisions.ambiguity_preserved`.
- **Resolved by evidence:** CP `ambiguous-auth` joined the auth consolidation under S5
  edge evidence; its competing interpretations are preserved inside the merge record.
- PD `ambiguous-run`/`unresolved-*` entities were resolved by 4B.2 into modules during the
  checkpoint phase and pass through consolidation untouched.

## 8. ID Strategy and Collision Results

- Pass-through ids re-issued deterministically from their own slug; the positional
  `feature-artist-2` artifact cannot recur: the suffix is stripped and a genuine collision
  resolves to `feature-<slug>-<hash6>`.
- Regression tests assert: uniqueness, determinism across runs, hash-not-position
  disambiguation, and D2 demotion of evidence-weaker duplicates.
- Validated runs resolved **0 collisions** (the duplicate was demoted instead); the
  collision mechanism is covered by tests and by the PD smoke run (`system-dir` vs
  `system-dir-70f9c7`).

## 9. ProjectDock Before/After (checkpoint → phase-4c2)

Owner drift first (external, not CodeAtlas): owner added
`projectdock/hyprland/projectdock.lua` and `tests/test_v020_fixes.py` → 65→67 files,
345→359 imports.

| Metric | Checkpoint (4C.1) | Phase 4C.2 | Why |
|---|---:|---:|---|
| Canonical entities | 15 (3F/12S) | 13 (3F/10S) | 3 evidence-backed merges |
| Features / systems | 3 / 12 | 3 / 10 | printable+creation+cover; project+marker; run+command |
| Ambiguous / unresolved | 1 / 2 | 1 / 1 | `unresolved-command` merged into the commands/intelligence group |
| Demoted false positives | — | 0 | every PD module holds behavioral evidence (honest) |
| Relationships | 18 | 14 | 4 endpoints consolidated; remaps recorded |
| Ambiguity preserved | ambiguous-editor | ambiguous-editor ✓ | |
| notion.ts-shape naming | n/a | n/a | PD naming unchanged (4C.3 scope) |
| Inspection rate | 70.8% | 70.1% | 4C.2 performs zero reads |
| oracle project-discovery | 2 fragments | 2 fragments (rescan + project/marker cluster) | shared vocabulary is repo-generic — anti-merge held; needs 4C.3/VOI |

## 10. CinePrint Before/After (checkpoint → phase-4c2)

Owner drift: owner added `src/components/EditCollectionModal.tsx` +
`src/routes/-components/collection-hero.tsx` → 398→400 files; 4B.2 carved 24 features
(two new: `feature-add`, `feature-edit`).

| Metric | Checkpoint (4C.1) | Phase 4C.2 | Why |
|---|---:|---:|---|
| Canonical entities | 41 (22F/19S) | 23 (16F/7S) | 14 demotions + 5 merge groups |
| Features / systems | 22 / 19 | 16 / 7 | noise systems eliminated; auth + poster-data + browsing consolidated |
| Ambiguous preserved | 7 | 6 (+1 resolved by evidence) | `ambiguous-auth` → auth system |
| False positives (measured set) | 5 present | 4 demoted, 1 remains | see §11 |
| Conflations | 2 (context, service) | 1 (service) | context split; service reduced to its application file |
| Relationships | 32 | 24 | demoted endpoints dropped (recorded), rest remapped |
| Inspection rate | 81.4% | 81.6% | 4C.2 performs zero reads |
| Strong recoveries (collections, saved, submit, profile) | preserved | **preserved** | collections/save/submit/profile all pass through whole (non-split guards) |
| system-image | strong, standalone | absorbed into the poster-data system | see §12 — recorded oracle tension |

## 11. False-Positive Analysis (the five mandated entities)

| Entity | Checkpoint state | Phase 4C.2 outcome | Evidence for the decision |
|---|---|---|---|
| `feature-found` | present (high) | **demoted (D1)** | identity "found" occurs only in state-class strings ("No posters found"); state never seeds (D-016); file preserved as fragment |
| `feature-artist-2` | present (medium) | **demoted (D2)** | context-only duplicate of `feature-artist`'s identity; no capability/behavior of its own |
| `feature-preview` | present (medium) | **demoted (D1)** | identity "preview" only in state text ("RETRY PREVIEW"); error boundary preserved as fragment |
| `feature-palette` | present (medium) | **demoted (D0)** | only anchor is `scripts/extract-palettes.js` (automation class, D-017) |
| `feature-lobby` | present (high) | **remains (recorded)** | context-class nav labels + route-shell behavior (NotFound/Error components) satisfy the seed-legality rules; removing it would violate "do not delete entities solely because their names look suspicious". Recorded as a 4C.3/VOI candidate (shell/404 chrome, state-heavy composition) |

Plus 9 additional noise-anchored systems demoted (D0) that the checkpoint had measured as
automation/test artifacts.

## 12. Fragmentation / Conflation Analysis

- **Authentication:** 4 fragments + admin → **1 system** (`system-admin` merged group);
  `feature-login` remains the login feature (its CTA vocabulary is context-class — the
  layer split follows evidence). Oracle's feature+system shape reproduced.
- **Browsing:** `feature-tag` + `feature-artist` merged (S1); `feature-found` demoted;
  `feature-poster` demoted (state identity). Browsing surfaces consolidated from 4
  entities to 1 (+ gallery fragments preserved).
- **Poster-data:** `system-poster` + `system-artist` + `system-image` → 1 system (S5);
  notion.ts absorbed at file level; automation scripts excluded from the anchor set.
  **Recorded oracle tension:** system-image was a standalone strong recovery; the merge is
  evidence-defensible (direct edges + shared vocabulary) and no file/evidence was lost,
  but the entity regrouping should be re-examined with 4C.3 VOI.
- **Server infrastructure:** `system-app-error`/`system-error-response` remain separate —
  their shared term (`error`) is repo-generic/stop-listed; per the anti-merge rules this
  merge did not fire. Recorded for 4C.3 (vocabulary vs responsibility question).
- **`feature-context` conflation:** **split** (server half separated) ✓.
- **`feature-service` conflation:** reduced to its single application file
  (`service-account.ts`); automation members moved to `non_application_files` ✓.
- **PD `system-pid`-class over-merges:** none reintroduced; the split guards + anti-merge
  vetoes held (no test-glued or hub-glued merges).

## 13. Known Remaining Problems (honest)

1. `feature-lobby` survives (context-seeded shell nav) — needs VOI judgment (4C.3).
2. Technical names persist and new merged entities inherit technical names
   (`system-cmake`, `system-valid`, poster-data named `system-image`) — naming is
   explicitly 4C.3 (D-015); consolidation recorded `naming_basis` for every rename.
3. Server-infra merge did not fire (generic shared vocabulary) — recorded, not forced.
4. CP relationships 32→24: demoted endpoints drop their edges (recorded); relationship
   quality still thin (4C.3).
5. Inspection >50% target: unchanged (81.6%/70.1%) — consolidation reads nothing; the
   reduction requires 4C.3 VOI (D-018).
6. PD discovery remains 2 fragments — shared vocabulary is repo-generic; anti-merge held.

## 14. Test Results

- Full suite: **162 tests / 49 suites / 0 failures** (138 pre-existing, unmodified +
  24 new consolidation tests).
- New tests cover every mandated case: context-only/incidental/state seeding, test-
  and generated-anchoring, fragment merge, unrelated anti-merge, veto recording,
  ambiguity preservation, D2 duplicates, collision-safe ids, annotation-mutation
  sensitivity, determinism, input immutability, conflation separation, notion.ts
  naming-conflict preservation, full-pipeline integration, and the no-noise-anchor
  invariant.
- No existing test was weakened or rewritten.

## 15. Determinism Results

Two complete pipeline runs (fresh collection → consolidation) per repo into
`phase-4c2/` and `phase-4c2-det/`: all five consolidation artifacts **byte-identical**
for both repos (the `-det` runs were removed after verification). The consolidation stage
records no timestamps; all iteration is over sorted structures.

## 16. Integrity Results

- Protected manifest (downstream `src/`, `src/annotate`, collector, schemas, templates,
  examples, all checkpoint-4c1 and baseline outputs, both Phase 2 oracle maps,
  `package.json`): **479 files, 0 changes**.
- `src/structural`, `src/investigate`, `src/semantic`, Collector v2, Annotation: unmodified.
- Repositories: never written by CodeAtlas; ProjectDock +2 files and CinePrint +2 files
  are **owner-side** drift (attributed above, excluded from CodeAtlas claims).
- Phase 2 oracle maps untouched; checkpoint-4c1 outputs untouched.
- No external SDK/runtime dependency introduced (`dependencies`: none).
- No generated artifact treated as source evidence: generated/automation/test classes are
  excluded from anchors and merge vocabulary by rule (tested).

## 17. Recommendation for Phase 4C.3

Proceed to **4C.3 Canonical Resolution v2 + VOI** with this exact backlog, in order:
1. **Naming** (D-015): the tiered naming authority over consolidated identities —
   `system-cmake`/`system-valid`/poster-data-as-`system-image`/browsing-as-`feature-artist`
   all carry recorded `naming_basis` waiting for it.
2. **VOI inspection** (D-018): open-question reads for `feature-lobby` (shell vs
   capability), the server-infra merge question, and the image/poster-data regrouping.
3. **Projection completeness** (R11) and the R1–R12 regression gate.
4. Description templates for consolidated entities (drop member-template inheritance).
