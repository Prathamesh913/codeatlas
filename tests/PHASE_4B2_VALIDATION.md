# Phase 4B.2 — Semantic Resolution Validation (Real-Codebase)

**Status**: Complete
**Date**: 2026-08-29
**Tool**: `codeatlas-semantic-resolver` v0.4.3
**Method**: `runResolution` executed per repository with inputs restricted to
**Phase 3 evidence + Phase 4A structural output + Phase 4B.1 investigation + bounded 4B.2 inspection**
(`repoRoot` is used for targeted reads only). The Phase 2A/2B manual maps were used **for comparison
after generation, never as generation input**. Output was generated into isolated directories:
`tests/evidence-cache/<repo>/validation/semantic/` (prior phase outputs in
`evidence/`, `structural/`, `investigation/`, `semantic/` untouched).

**Determinism**: a second full generation run produced **byte-identical files** for both repos
(all 6 output files × 2 repos, `cmp` verified). Timestamps are the only non-deterministic inputs
and are not written into these artifacts.

---

## 1. Scope

**Does**: evidence token profiles → Semantic Region carving (D-012) → bounded incremental
inspection (reuse-first, ≤3/region, ≤60/repo) → canonical resolution (feature / system /
ambiguous / unresolved) with aliases, keywords, provenance → evidence-backed relationships.

**Does NOT do** (verified in this validation): natural-language lookup, impact analysis, flow
generation, modification of Phase 2 maps / Phase 3 evidence / Phase 4A output / 4B.1 output /
repository source.

Automated fixture suite: `tests/semantic/resolution.test.js` — 12/12 pass (fixtures cover
split, cross-unit merge, shared-system extraction, notion-style naming guard, description
quality, ambiguity preservation, over-merge prevention, component+hook+store unity,
provenance, inspection justification, determinism, output isolation). Full suite:
**74/74 tests, 32 suites, 0 failures**.

---

## 2. D-012 — Structural Boundaries Do Not Define Semantic Boundaries

**Verdict: YES — proven by real repositories, in both directions.**

### Structural Unit → multiple semantic entities (correct splitting)

- **ProjectDock `unit-001`** (24 files = 8 production modules + 16 test files, glued by test
  imports and `__init__.py`): carved into **6 canonical regions + 2 unassigned** —
  `action(actions.py)`, `printable(ui.py)`, `rescan(app.py)`, `run(intelligence.py)`,
  `search(search.py)`, `workspace(workspace.py)`; `__init__.py`/`config.py` unassigned as
  plumbing; tests excluded by design. Semantic meaning was assigned per-file by evidence
  affinity, never by unit membership.
- **CinePrint 49-file collections-core unit (`unit-001`)**: contributed primary files to at
  least **8 distinct semantic entities** — `feature-collection`, `feature-save`,
  `feature-profile`, `system-poster` (notion.ts), `system-firebase`, `system-firestore`,
  `system-image`, `system-read-state`, `system-like`, `system-auth` fragments.
- **CinePrint route-tree unit**: split into ≥9 route regions (login, submit, saved,
  constellation, profile, privacy, artist/$slug, index, __root).

### Multiple Structural Units → one semantic entity (correct cross-unit merging)

- **CinePrint `feature-save`** = `src/lib/saved.ts` (collections-core unit) +
  `src/routes/saved.tsx` (route-tree unit) — structurally disconnected, semantically one
  capability ("Saved Posters"). Resolved feature, high confidence.
- **CinePrint `feature-collection`** spans `unit-001, unit-004, unit-121`
  (components + hook + lib core + read-state kept as ONE feature — the harness fixture
  behavior holds on real code).
- **CinePrint `system-image`** spans `unit-001, unit-002, unit-004`
  (`lib/poster-images.ts` + `components/PosterImage.tsx` + `automation/blob/import.ts`).
- **ProjectDock `system-pid`** spans `unit-033, unit-036` (`hyprland.py` + `sessions.py`)
  — a cross-unit merge, though an over-merge (see §8).

Structural connectivity was also proven **unreliable** as a semantic signal: ProjectDock's
production modules import each other exclusively via relative imports
(`from . import actions, commands, …`, e.g. `app.py` imports 14 siblings) which **Phase 3 did
not capture** (0 import records for `app.py`). The "24-file core unit" is therefore held
together by test-file imports; carving still produced sensible per-module regions purely from
evidence affinity. This is the strongest real-repo argument for D-012.

---

## 3. Semantic Region Model & Carving Strategy (as validated)

- Regions are keyed on **evidence affinity** (weighted: UI labels 4.0, behavioral 3.0,
  filename 3.5, symbols 1.2, directory 0.8; IDF down-weights repo-generic terms) — confirmed
  working on both architectures.
- Directory tokens cannot seed a region (D-012 guard) — held (no "src"/"lib"/"components"
  entities were generated).
- UI-kit directories (`components/ui/`), generated artifacts (`routeTree.gen.ts`),
  `tests/` dir, and docs are excluded from canonical membership — held.
- Widget-primitive clusters (`card`, `modal`, …) are demoted to the supporting pool — held
  (no "Card" feature was minted despite shadcn-style components present in CinePrint).
- Shared-infrastructure carve (≥3 importers across ≥2 regions) produced both the best
  outcomes (`system-poster` from notion.ts) and a noise class (automation singletons, §7).
- **Gaps found** (documented, not fixed): co-located `*.test.ts` files and `automation/`
  scripts are not excluded (only the `tests/` directory is); the split/merge counters
  (`units_split_into_multiple_regions`: 1 PD / 4 CP) undercount the real splits above
  because they only count units with >1 region *primary-file* overlap.

---

## 4. Feature vs System Resolution

The feature/system scorer (UI labels, view-layer files, user verbs vs importer-region count,
persistence vocabulary, infra behavior) resolved **5 features + 3 systems for ProjectDock**
and **22 features + 19 systems for CinePrint**, preserving 2 + 7 ambiguous and 7 + 9
unresolved. Ambiguity preservation worked on genuinely contested areas (PD `actions.py`,
`intelligence.py`; CP auth client/server, automation notion-sync). Two systematic
mis-resolutions were observed and are documented in §7/§9: automation string literals
inflate feature scores (producing `ambiguous` where `unresolved`/exclusion was correct), and
infrastructure-flavored singleton files are promoted to Systems on vocabulary alone
(`system-types`, `system-env`, `system-client`).

---

## 5. ProjectDock Validation (oracle: Phase 2A, 11 features)

Counts: 65 files → 41 units → **17 regions** → 5 features, 3 systems, 2 ambiguous,
7 unresolved, **0 relationships**, 3 unassigned. Inspection: 46 files reused from 4B.1,
**3 additional reads** (actions.py, search.py, workspace.py — each justified with a recorded
question), 49/65 unique files (75.4%) across both phases.

| Phase 2A entity | Verdict | Generated as | Notes |
|---|---|---|---|
| project-discovery | PARTIALLY RECOVERED | `feature-rescan` (app.py) + `feature-root` (discovery.py) | capability present but split in two fragments with technical names |
| project-search | PARTIALLY RECOVERED | `feature-score` (search.py) | right module; canonical name from internal scoring symbols (symbol coincidence); alias "search" preserved |
| project-creation | PARTIALLY RECOVERED | `feature-creation` (creation.py) | correct isolation; name/description clunky ("create and choose creations") |
| project-actions | AMBIGUOUS (preserved) | `ambiguous-editor` (actions.py) | feature 2 vs system 2 — tie preserved, not forced |
| project-intelligence | AMBIGUOUS (preserved) | `ambiguous-run` (intelligence.py) | feature 3 vs system 2 — preserved |
| workspace-awareness | PARTIALLY RECOVERED (wrong type) | `system-workspace` | recovered as System; oracle treats it as a user capability |
| dev-session-management | PARTIALLY RECOVERED (over-merged) | `system-pid` = hyprland.py + sessions.py | merges two distinct oracle capabilities; technical name |
| tool-picker | PARTIALLY RECOVERED (wrong type) | `system-tool` | recovered as System; oracle says keyboard-first feature |
| keyboard-shortcuts | NOT RECOVERED | buried inside `feature-printable` (ui.py) | within-file capability invisible at file granularity |
| project-presentation | NOT RECOVERED | `unresolved-cover`, `unresolved-theme` | no UI/behavioral evidence crossed threshold |
| launcher-shell | NOT RECOVERED | fragments only (`feature-rescan`, `unresolved-layer`) | daemon/window/D-Bus capability never named |

**24-file structural core carving (primary Phase 4B.2 criterion)**: unit-001 was successfully
carved into multiple regions (6 canonical + 2 unassigned from its 8 production files), so the
*mechanical* criterion is met. The regions are only *partially meaningful*: 4 of 8 production
files received reasonable identities (actions, search, workspace, creation); app.py became
"Rescan" (too narrow), ui.py became "Printable" (wrong, symbol coincidence), intelligence.py
stayed ambiguous. Root causes are in §7/§9/§10, not in the carving mechanism itself.

---

## 6. CinePrint Validation (oracle: Phase 2B, 10 features + 6 systems)

Counts: 253 files → 138 units → **57 regions** → 22 features, 19 systems, 7 ambiguous,
9 unresolved, 32 relationships, 56 unassigned. Inspection: 153 files reused from 4B.1,
**53 additional reads** (cap 60 respected; every read logged with region + question + result),
206/253 unique files (81.4%) across both phases.

### Features

| Phase 2B entity | Verdict | Generated as | Notes |
|---|---|---|---|
| poster-browsing | PARTIALLY RECOVERED / OVER-SPLIT | `feature-tag` (Header) + `feature-artist` (FilterBar + artist-hero) + `feature-poster` (artist/$slug) + `feature-found` (index.tsx, **misnamed**) | gallery core misnamed after empty-state string "no posters found"; search split across 3 entities |
| poster-detail | PARTIALLY RECOVERED | `feature-lightbox` (Lightbox.tsx) | lightbox recovered; `routes/poster/$id.tsx` left unassigned |
| saved-posters | STRONGLY RECOVERED | `feature-save` = lib/saved.ts + routes/saved.tsx | correct cross-unit merge; description polluted ("drains", "no auth token" label) |
| collections | STRONGLY RECOVERED | `feature-collection` (6 files: 2 modals, form, hook, core, read-state) | best recovery in either repo; high confidence; component+hook+state+service as one feature |
| artist-portfolio | PARTIALLY RECOVERED / OVER-SPLIT | `feature-poster` (artist/$slug.tsx) + artist-hero inside `feature-artist` | portfolio split across two entities with weak names |
| constellation-view | PARTIALLY RECOVERED | `feature-constellation` (constellation.tsx, low) | recovered; single file; thin description |
| poster-submission | STRONGLY RECOVERED | `feature-submit` (submit.tsx, 35 UI labels) | strong evidence, good aliases ("movie or show title") |
| authentication | PARTIALLY RECOVERED / OVER-SPLIT | `feature-login` + `ambiguous-auth` (auth.tsx, server-auth.ts) + `system-auth` + `system-auth-middleware` | all fragments present; 4 entities vs 1 oracle feature + 1 system |
| user-profile | STRONGLY RECOVERED | `feature-profile` = user-profile.ts + profile.tsx | cross-unit merge, high confidence |
| ticket-generator | PARTIALLY RECOVERED | `feature-ticket` (ticket.ts only) | ShareModal not attached; "bebas neue" font-name label leaked into alias |

### Systems

| Phase 2B system | Verdict | Generated as | Notes |
|---|---|---|---|
| poster-data-system | PARTIALLY RECOVERED / OVER-SPLIT | `system-poster` (notion.ts — **correctly renamed from "notion"**) + `system-artist` (posters.ts — **misnamed**) + `system-firestore` (firestore-db/shared + sync script) | oracle single system split into 3; posters.ts misnamed by symbol vocabulary |
| authentication-system | PARTIALLY RECOVERED / OVER-SPLIT | `system-auth` + `system-auth-middleware` + `system-admin` + `ambiguous-auth` | fragments correct individually |
| saved-state-system | PARTIALLY RECOVERED | `system-read-state` (read-state.ts) + `system-like` (user-likes*) | saved.ts itself was merged into `feature-save`; likes split out (entity not in oracle — plausible but extra) |
| collections-system | MERGED INTO FEATURE | inside `feature-collection` | acceptable modeling; oracle's separate system not reproduced |
| image-system | STRONGLY RECOVERED | `system-image` (poster-images.ts + PosterImage.tsx + automation/blob/import.ts) | matches oracle; spans units |
| server-infrastructure | PARTIALLY RECOVERED / OVER-SPLIT | `system-app-error` + `system-error-response` (+ request context/logging misappropriated into `feature-context`) | error infra split; request layer over-merged with UI ContextMenu (§8) |

**Large structural clusters**: the 49-file collections-core cluster was successfully separated
into distinct capabilities (collections vs saved vs poster-data vs image vs auth vs firestore)
— real semantic carving of structurally co-located code. The 39/20-file clusters
(automation/blob, route tree) also fragmented, but into several noise entities (§7).

---

## 7. notion.ts — Critical Validation

File: `src/lib/notion.ts`. Checklist:

1. **Filename evidence available** — YES. It seeded `region-034` with term "notion"
   (filename weight 3.5, affinity 0.7486, contested with "poster").
2. **Structural context considered** — YES. Unit-001 membership, importers
   (`region-046`/ticket), and the shared-infrastructure carve path all contributed.
3. **Imports/dependencies considered** — YES. Edges `notion.ts → firebase.ts`,
   `notion.ts → posters.ts`, `notion.ts → server/firebase/admin.ts` are in the entity
   evidence (phase4a_graph, e564–e569).
4. **Source-derived evidence considered** — YES. Bounded 4B.2 inspection read `notion.ts`
   itself (18 clues: `loadPublishedPosters`, `toPlainPoster`, `PosterFetchError`, Firestore
   read operations, TanStack server functions).
5. **Stronger evidence outweighed the filename** — YES. The naming-vs-behavior guard fired:
   canonical entity is **`system-poster` / name "Poster"** (medium confidence), with
   `naming_conflict: {seed_term: "notion", behavior_term: "poster"}` recorded and both
   vocabularies preserved (region term retained as provenance).
6. **No unsupported canonical "Notion System"** — **CONFIRMED.** No `system-notion` entity
   exists in `features.json`/`systems.json`. (The real Notion automation cluster —
   `automation/notion/*` — is preserved separately as `ambiguous` regions `sync`/`report`,
   not asserted as a System either.)

**Residual defect (documented, not fixed)**: the systems.json `technical_role` field for this
entity still reads *"Shared notion capability consumed by 1 semantic regions."* — the
pre-guard seed term leaks into one output field, contradicting the canonical name in the same
object. Additionally, systems lose their `aliases`/`keywords` in the systems.json mapping
(the entity has them; the output projection drops them), so the "notion" alias vocabulary is
not exposed for lookup. Cosmetic but real output-quality defects.

**Interpretation**: `lib/notion.ts` is the public poster-data read path (Firestore-backed,
2-minute in-memory cache, `PosterFetchError`); it correctly contributes to the poster-data
capability, and its Notion-flavored symbols (`fetchNotionPosters`, `submitPosterToNotion`)
remain visible as naming evidence only.

---

## 8. Boundary Quality Audit (central Phase 4B.2 evaluation)

### Over-merging (real cases found)

| Case | Entities | Why wrong | Root cause |
|---|---|---|---|
| CinePrint `feature-context` | `components/ContextMenu.tsx` + `server/request/context.ts` (+ logging, PosterGrid as support) | UI right-click menu and server request-context infrastructure are unrelated capabilities sharing the token "context" | dependency bias + generic-token coincidence; no layer-awareness |
| CinePrint `feature-service` | `automation/tmdb/service.ts` + `service-account.ts` + test | TMDB automation and Firebase service-account config are unrelated; "service" is coincidental vocabulary | symbol coincidence + automation noise |
| ProjectDock `system-pid` | `hyprland.py` + `sessions.py` | workspace/window tracking and dev-session management are distinct oracle capabilities sharing "pid" plumbing | shared-infrastructure heuristic over generic token; technical name |

Over-merging is therefore **real but bounded**: 3 cases across both repos, none of them
merging two *major* user capabilities.

### Over-splitting (the dominant failure mode)

- CinePrint poster-browsing → 4 fragments (found/tag/artist/poster).
- CinePrint authentication → 4 fragments (login/auth-ambiguous/auth/auth-middleware).
- CinePrint poster-data → 3 systems (poster/artist/firestore) instead of 1.
- CinePrint server-infrastructure → 2 systems + misappropriation into feature-context.
- ProjectDock project-discovery → 2 fragments (rescan/root).

Root cause: carving is per-file token affinity with a one-file-per-region fallback for
infra-shaped files; there is **no cross-file merge pass** that unions regions sharing a
feature's hub (e.g. `loadPublishedPosters` consumers), and infra-shaped singletons cannot
re-attach to a parent capability. Fixture H ("component + hook + store = ONE feature") holds
only when the evidence tokens are strong; real repos have many weak-evidence files.

### Correct structural splitting — VERIFIED

Real examples in §2 (PD unit-001 → 6 regions; CP collections-core unit → ≥8 entities;
route-tree unit → ≥9 regions). Note the built-in counter undercounts (reports 1 and 4).

### Correct cross-unit merging — VERIFIED

Real examples in §2 (`feature-save`, `feature-collection`, `system-image`, PD `system-pid`).
8 CinePrint regions span multiple units (including infrastructure regions).

### Ambiguity preservation — VERIFIED

2 PD + 7 CP ambiguous entities preserved with competing feature/system signal sets and no
forced type (PD actions/intelligence; CP auth client/server, notion automation sync/report,
tmdb search, external-image tooling, account). `unresolved` regions (PD 7, CP 9) were left
unnamed rather than minted.

---

## 9. False Positives (generated entities that are wrong)

| # | Generated entity | Files | Why wrong | Root cause category |
|---|---|---|---|---|
| 1 | CP `feature-found` | routes/index.tsx | main gallery page named after empty-state string "no posters found"; description "Presents founds" is gibberish | UI text false positive (empty-state) |
| 2 | CP `feature-artist-2` | routes/-components/home-discovery.tsx | marketing/manifesto text misread as artist capability; "2" suffix from id collision | UI text false positive + id collision |
| 3 | CP `feature-page` | lib/error-page.ts | generic token "page"; error page is not a user capability | symbol coincidence |
| 4 | CP `feature-url` | automation/parser.ts + test | parser plumbing named "Url" | symbol coincidence + automation noise |
| 5 | CP `feature-palette` | scripts/extract-palettes.js | build script + placeholder text | UI text false positive + automation noise |
| 6 | CP `feature-bio` | lib/bio-editor.ts | sub-capability of user-profile; too granular | over-splitting / insufficient evidence resolved anyway |
| 7 | CP `feature-preview` | GalleryErrorBoundary.tsx | error-boundary retry text ("retry preview") | UI text false positive (error state) |
| 8 | CP `feature-lobby` | routes/__root.tsx | root layout named after "back to lobby" link | UI text false positive (navigation chrome) |
| 9 | CP `feature-tag` | Header.tsx | search fragment; oracle has no "tag" feature | over-splitting |
| 10 | CP `feature-privacy` | routes/privacy.tsx | real page but not an oracle capability; low value | over-generation (minor) |
| 11 | CP `feature-context` / `feature-service` | see §8 | over-merges | dependency bias / symbol coincidence |
| 12 | CP `system-artist` | lib/posters.ts | poster-data core misnamed "artist" from symbol vocabulary | filename/symbol bias (inverse notion.ts case) |
| 13 | CP `system-types`/`env`/`client`/`download`/`access`/`optimize`/`cineprint-draft` | automation/blob, tmdb, shared | build/automation plumbing promoted to canonical Systems | insufficient evidence incorrectly resolved (infra heuristic + no automation exclusion) |
| 14 | PD `feature-printable` | ui.py | whole GTK UI named after a key-press helper token ("printable") | symbol coincidence + missing GTK label vocabulary for naming |
| 15 | PD `feature-score` | search.py | search capability named after internal scoring | symbol coincidence |
| 16 | PD `system-pid` | hyprland.py + sessions.py | over-merge + technical name | shared-token infra heuristic |

Aggregate noise: **~12 of 22 CinePrint features and ~9 of 19 CinePrint systems are
false positives or misnames**; ProjectDock: 2 of 5 features misnamed, all 3 systems are
type-mismatches or over-merges. This is reported as measured — not inflated.

## 10. False Negatives (oracle entities not recovered)

| Missed entity | Why missed | Fixable within current architecture? | Requires richer evidence? |
|---|---|---|---|
| PD keyboard-shortcuts | lives inside ui.py; file-granularity carving cannot split one file | NO | YES — function-level evidence (call graph / per-symbol UI text) |
| PD launcher-shell | daemon/D-Bus/window behavior spans app.py+ui.py+cli.py; no edge evidence connects them (relative imports uncollected) | PARTLY — collecting relative imports would reconnect the graph | YES for within-file behavior |
| PD project-presentation | cover.py/theme.py lack UI/behavioral clues after capped inspection | YES — deeper targeted reads of cover/theme would likely find labels (cap 3/region was consumed by other questions) | NO |
| PD project-actions / project-intelligence | evidence tie → preserved ambiguous (correct behavior, no canonical recovery) | PARTLY — Python/GTK label extraction (e.g. menu tuples) would break the ties | YES for label extraction at collection time |
| CP poster-detail core route (`routes/poster/$id.tsx`) | identity tokens below affinity threshold → unassigned | YES — threshold/seed tuning | NO |
| CP collection detail route (`routes/c/$id.tsx`) | same | YES | NO |
| CP ShareModal not attached to ticket feature | supporting-attachment requires vocab overlap + direct edge | YES | NO |
| CP "collections-system" as separate system | collections state merged into the feature (modeling divergence, not a miss) | — | manual entity may be over-granular |
| CP likes under saved-state | generated `system-like` is separate; oracle nests likes in saved-state | — | granularity judgment call; both defensible |

Phase 3 relative-import collection gap (`from . import …`) is the single most impactful
**upstream** evidence defect discovered: it severed ProjectDock's production import graph
(0 records for `app.py`), which in turn explains the 0-relationship ProjectDock output.

---

## 11. Investigation Efficiency (actual counts)

| Metric | ProjectDock | CinePrint |
|---|---|---|
| Repository files in graph | 65 | 253 |
| Structural units (4A) | 41 | 138 |
| Files reused from Phase 4B.1 clue evidence | 46 | 153 |
| Additional files inspected by 4B.2 (logged, justified) | **3** | **53** (cap 60) |
| Total unique files inspected (4B.1 + 4B.2) | 49 (75.4%) | 206 (81.4%) |
| 4B.2 reuse rate (reused / total inspected) | 94% | 74% |
| Additional inspection vs whole-repo scan | 4.6% | 20.9% |

Honest reading: repo-wide inspection coverage is high because Phase 4B.1 read nearly every
small unit's members (small units dominate both repos). The 4B.2 stage itself stayed within
its design budget (≤3/region, ≤60/repo: 3 and 53) and reused existing evidence for the
majority of its needs. The design audit's "≈25% CinePrint / <10% ProjectDock" worst-case
applied to the *additional* reads and held (20.9% and 4.6%).

---

## 12. Canonical Output Quality Audit

- **Names**: mixed. Good: Collection, Save, Profile, Submit, Login, Poster (from notion.ts).
  Bad: Printable, Score, Found, Artist 2, Page, Url, Lobby (technical echoes / UI-string
  artifacts). Several names come from symbol coincidence rather than user vocabulary.
- **Descriptions**: feature descriptions follow the user-capability template and anchor in
  real labels (e.g. "Lets users create and add collections. The interface labels it 'create &
  add'.") — good cases match the task's "Good" bar. Bad cases produce gibberish objects
  ("save and load drains", "Presents founds", "Presents lightbox") because the object noun is
  a symbol artifact. System descriptions are generic templates ("Shared X capability for N
  other implementation areas…") — they explain shared responsibility but with a fixed
  phrasing; `technical_role` leaks pre-guard seed terms in one case (§7).
- **Aliases**: features carry real UI vocabulary ("add to collection", "sign in",
  "movie or show title", "create & add") — the strongest lookup asset generated. Polluted by
  empty-state/error strings ("no posters found", "no auth token", "image url is missing") and
  font/brand names ("bebas neue"). **Systems emit no aliases/keywords at all** (projection
  drops them) — a gap for lookup on system vocabulary like "notion".
- **Keywords**: evidence-backed but include stemming artifacts ("faile", "publishe",
  "drain") and technical echoes ("slug", "route", "component").
- **Provenance**: **strong everywhere.** Every entity carries `evidence[]` typed by source
  (`phase4b1_clue`, `phase4b2_affinity`, `phase4a_graph`, `phase4b2_additional_inspection`,
  `phase4b2_naming_guard`), plus confidence + reason, contested-file lists, and
  additional-inspection logs. Every extra read has a recorded question. Traceability fully
  satisfies the Phase 4B.2 requirement.
- **Relationships**: 32 CinePrint / 0 ProjectDock. Each carries a concrete Phase 4A edge with
  provenance. However the "support beyond simple file connectivity" bar is **not met**:
  descriptions are templates, several edges connect junk entities, and support-file membership
  inflates targets (e.g. `USES system-image` evidenced by `PosterGrid → PosterCard` component
  import). ProjectDock's 0 relationships trace to the Phase 3 relative-import gap, not the
  relationship builder.
- **JSON validity**: all 12 generated files parse; generated features conform to the
  `feature.schema.json` required set (id, name, description, user_visible_purpose,
  user_interactions, primary_files, confidence).

---

## 13. Evidence Gaps, Blockers vs Future Enrichment

**Blockers for lookup-readiness (must fix before natural-language lookup):**
1. Phase 3 Python relative-import collection (`from . import …`) — upstream evidence defect;
   severs ProjectDock production connectivity (documented as Phase 3 enhancement; Q-007
   adjacent but distinct).
2. Automation/test exclusion at carve time (co-located `*.test.ts`, `automation/`, `scripts/`
   string-literal inflation of feature scores).
3. Empty-state/error/navigation-chrome label filtering (found/page/preview/lobby class).

**Future enrichment (not blockers for the architecture, but required for full recovery):**
4. Function-level evidence for within-file capabilities (keyboard shortcuts, launcher shell).
5. Cross-file merge pass / hub-based region union against over-splitting.
6. Systems aliases/keywords emission + `technical_role` naming fix.
7. GTK/Python UI-label extraction for Python architecture parity.
8. Semantic relationship support beyond single file imports (call-chain or flow evidence).

---

## 14. Recommendation

The Phase 4B.2 architecture is **validated**: D-012 holds in both directions on real
repositories, carving reproduces the component+hook+store unity and cross-unit merge
behaviors on real code, ambiguity is preserved instead of forced, provenance is complete,
and output is deterministic and isolated. The notion.ts acceptance criterion passed at the
canonical level.

The generated canonical maps are **not yet** clean enough to serve directly as a
natural-language lookup substrate: measured noise is ~50% of CinePrint entities (dominated by
automation infrastructure and UI-string artifacts), over-splitting fragments several oracle
capabilities, and ProjectDock's recovery is weak where Python evidence is thin. All
identified defects are documented above with root causes; the bounded list in §13 (three
blockers + five enrichments) is the required follow-up. **No fixes were implemented in this
validation pass.**
