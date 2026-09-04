# Phase 4C.1A — Collector v2 Validation

**Status**: Complete
**Date**: 2026-08-29
**Tool**: `codeatlas-evidence-collector` v0.4.0 (was v0.3.0)
**Scope**: Exactly two responsibilities — (1) correct Python relative import collection with
deterministic repository-local resolution, (2) mechanical relevance flags on file evidence.
No semantic annotation, no relevance *decisions*, no downstream stage modified.

---

## 1. Problem Addressed

Phase 4C.0 (taxonomy A1, accepted root cause): the Phase 3 Python import patterns
(`^from\s+(\w+(?:\.\w+)*)…`, `^import\s+(\w+…)`) require a leading `\w`, so a leading dot can
never match. Every relative import — `from . import actions`, `from .actions import run_action`,
`from ..config import Config` — produced **no record at all** (not even an unresolved one).
Measured consequence: 0/290 ProjectDock import records had a leading-dot target while the real
code contains 38 relative-import statements across 10 files (column-0 and indented). ProjectDock's
production package was structurally held together by test imports, contributing to 0 relationships
and weak semantic recovery. Additionally, 4C.0 D-017 established that raw evidence must stay broad
while later stages need mechanical, non-semantic signals to distinguish tests/automation/generated/
docs from application source.

## 2. Relative Import Syntax Supported

| Form | Example | Behavior |
|---|---|---|
| Bare same-package | `from . import actions` | one record per name; the name is tried as a module (`actions.py`, then `actions/__init__.py`) |
| Multi-name bare | `from . import discovery, search` | one record per name — none dropped |
| Parenthesized bare | `from . import (actions, discovery)` | multi-line statements joined deterministically; per-name records |
| Relative module | `from .actions import run_action` | module is the resolution target; symbols preserved |
| Parent package | `from ..config import Config` | level 2 resolves through the package hierarchy |
| Multi-level | `from ...package.module import thing` | level preserved (`relative_level: 3`); resolves only if a valid target exists |
| Parenthesized module | `from .search import (alpha, beta)` | symbols preserved in order |
| Aliases | `from .actions import run_action as action_runner`; `from . import cover as _cover` | `symbol_aliases: {imported: alias}` (additive; v1 stripped aliases) |
| Mixed absolute | `import os`, `import projectdock.cli`, `from projectdock.config import Config` | **unchanged v1 behavior** (classification/`not_local`); plus `raw` provenance |

Two deliberate observation improvements (documented behavior changes, both from the accepted
4C.0 design): plain `import a, b` now emits **one record per target** (v1 silently captured only
the first), and a single trailing comment on an import line no longer pollutes the last symbol.

## 3. Resolution Algorithm

1. **Inventory-only targets (A3)**: the candidate set is exactly the discovered Python source
   files (`classified.source`, language Python). Files are never invented; no filesystem probing
   beyond the walk that produced the inventory.
2. **Package context (A5)**: a file's package is derived from `__init__.py` presence inside the
   inventory, not from raw parent directories.
3. **Base directory for level *L***: start at the source file's own directory; ascend *L−1*
   packages. An ascent step is valid only out of a regular package (`__init__.py` present) and
   only into a package (or into the collection root when the root itself is a package — the
   fixture root-package case). The collection root is a hard boundary. Violations yield
   `relative_level_exceeds_package_root` — which is exactly Python's own "beyond top-level
   package" error, reproduced deterministically.
4. **Module candidates**: `<base>/<module.path>.py` and `<base>/<module.path>/__init__.py`.
5. **Ambiguity (A4)**: both candidates valid → status `unresolved` (never an arbitrary pick) with
   `resolution_reason: "ambiguous"` and sorted `resolution_candidates`. Status values stay within
   the v1 set `{resolved, unresolved, not_local}` so downstream code needs no changes; ambiguity is
   carried in additive fields.
6. **Unresolved preservation**: no target → `unresolved` + `resolution_reason: "target_not_found"`.
   The record is kept — never dropped, never fabricated as an external dependency.

Record model (additive over v1 — all v1 fields unchanged): `target` = dots + module/name
(`.actions`, `..config`), `classification: "relative"` (new value, provenance-only downstream),
plus `relative_level`, `module`, `symbols`, `symbol_aliases` (when present), `raw` (observed
statement — all Python records), and on unresolved records `resolution_reason` +
`resolution_candidates`.

## 4. Package-Context Limitations (explicit V2 limits)

- **Bare-name-as-symbol**: `from . import name` where `name` is a variable/class re-exported by
  the package `__init__.py` (not a module file) resolves to nothing → `unresolved/target_not_found`.
  Real case: `projectdock/cli.py` `from . import __version__` (no `__version__.py`; the name lives
  in `__init__.py`). Inspecting `__init__.py` symbols would be a semantic step — deliberately out
  of scope for the collector.
- **Namespace packages (PEP 420)**: directories without `__init__.py` still get level-1 resolution
  against the file's own directory (permissive); level ≥ 2 ascent requires regular packages.
- **`src/` source roots**: resolution is collection-root-relative; `from ..x` beyond the top-level
  package is rejected (correct Python behavior), not guessed.
- **Backslash line continuations** inside import statements are not joined (rare; documented).
- Not a Python import system: no `sys.path` modeling, no installed-package resolution, no dynamic
  (`__import__`) calls.

## 5. Mechanical Relevance Flags

Every inventory file (source, config, other) carries:

```json
"relevance_flags":  { "is_test_like": false, "is_generated_like": false,
                      "is_documentation_like": false, "is_automation_like": false },
"relevance_reasons": { "is_test_like": ["path_segment:tests", "filename_pattern:*.test.ts"] }
```

- One classification function (`getMechanicalFlags` in `src/utils.js`) — no duplicated logic (B3).
- Generic rules only; no repository-specific names (B2). Directory rules match **path segments
  only, never filename stems** — ProjectDock's production `projectdock/tools.py` is verified
  unflagged.
- Rules: test = dir ∈ {test, tests, __tests__, spec, specs, testing} or `test_*` / `*_test` /
  `*.test.*` / `*.spec.*` / `conftest.py`; generated = dir ∈ {dist, build, coverage, out, .next,
  .output, .vercel, .nuxt, .svelte-kit, generated, __generated__} or `*.gen.*` / `*.generated.*` /
  `*.min.*`; docs = ext ∈ {.md, .mdx, .rst} (deliberately **not** `.txt` — `requirements.txt`) or
  dir ∈ {docs, documentation}; automation = dir ∈ {scripts, automation, tools, ci, bin, .github,
  .gitlab, .circleci}.
- Flags are **non-exclusive** (a file may carry several; reasons cite the exact rule).

**Why flags ≠ semantic relevance**: a flag states only a mechanically observable path/type
convention ("path is under `tests/`", "filename matches `*.gen.ts`"). It never says the file is
irrelevant, never excludes it from the inventory (M8: all flagged files remain `included: true`),
and never downweights anything. Whether a flagged file may seed a Feature, join a region, or be
inspected is a decision for the later annotation phase (4C.1B) — which may also reclassify a
flagged file when behavioral evidence contradicts the path convention. Note: `dist/`, `build/`,
`coverage/`, `.output/`, `.next/` were already excluded by pre-existing Phase 3 exclusion rules;
their flag logic is therefore verified at the function level (M3), while non-excluded locations
(`.vercel/`, in-repo generated files) are verified end-to-end.

## 6. Test Results

`npm test`: **96 pass / 34 suites / 0 fail** (pre-4C.1A: 74/32). All 74 pre-existing tests pass
**unmodified** — none weakened, no snapshot rewritten.

New suites:
- `tests/unit/python-relative-imports.test.js` — 13 tests covering R1A–R1J + ambiguity (A4) +
  provenance (raw/level/module on every relative record), fixture `tests/fixtures/python-rel-app`
  (root package, nested packages, `dupe.py`+`dupe/` ambiguity pair, unresolvable/beyond-root cases).
- `tests/unit/relevance-flags.test.js` — 9 tests covering M1–M8 + the `tools.py` false-positive
  guard, fixture `tests/fixtures/flags-app`.

Fixture note: R1C initially asserted a wrong record count (3 statements target `.actions` in
`app.py`: bare, module-form, aliased module-form) — the test expectation was corrected to match
verified-correct collector output. No collector behavior was adjusted to satisfy a test.

## 7. ProjectDock Comparison (Phase 3 v1 → Collector v2)

Repositories were only read; v2 evidence written to
`tests/evidence-cache/projectdock/validation/evidence/`.

| Metric | v0.3.0 baseline | v0.4.0 |
|---|---|---|
| Files collected | 65 | 65 (identical set) |
| Import records | 290 | 345 (+55 = 38 relative + 17 multi-target splits) |
| Relative imports observed | **0** | **38** (all level 1; 10 column-0 + indented statements) |
| Relative imports resolved | — | **37** |
| Unresolved | 0 | 1 (`cli.py .__version__` → target_not_found, preserved — see §4) |
| Potential file→file edges downstream | **0** | **30 distinct pairs** |

`projectdock/app.py`: 11 records → **32 records**. Its one-line `from . import actions, commands,
config, creation, discovery, hyprland, intelligence, search, sessions, state, theme, tools, ui,
workspace` now yields 14 individually resolved records; function-level indented relative imports
(`from . import gitinfo`, …) are captured too. Every relative-import-heavy file verified:
`ui.py` 7/7, `config.py` 2/2, `discovery.py` 2/2 (incl. `from . import cover as _cover` alias →
`cover.py`), `workspace.py` 2/2, `state.py` 1/1, `commands.py` 1/1, `cli.py` 1/2 (the documented
`__version__` limit).

**Unmodified Phase 4A on v2 evidence** (run to `validation/structural/`; Phase 4A code untouched):
structural units **41 → 28**, orphans **39 → 27**, imports edges **290 → 345** — the 37
collector-resolved relative imports became `resolved` IMPORTS edges through 4A's existing
"path 1" (resolved + resolved_path) handling, 89 `resolved_phase4a` normalizations unchanged, and
the `__version__` observation now appears as a proper `unresolved_module` node instead of being
invisible. The production package is connected at the structural layer for the first time.
Per instructions, **no downstream semantic improvement is claimed yet** — 4B.1/4B.2 re-runs are
later phases.

## 8. CinePrint Comparison (Phase 3 v1 → Collector v2)

| Metric | v0.3.0 baseline | v0.4.0 |
|---|---|---|
| Files collected | 398 | 398 |
| Import records | 1128 | 1128 (no Python → 0 relative records; TS relative imports were already collected in v1) |
| Unresolved | 11 | 11 (all pre-existing JS unresolved, unchanged) |

Flag distribution (398 files): `is_test_like` 40 (28 under `tests/` + 12 `automation/*.test.ts`),
`is_generated_like` 146 (145 `.vercel/**` build artifacts + `src/routeTree.gen.ts`),
`is_documentation_like` 28 (`.codeatlas/**.md`, `docs/`, READMEs), `is_automation_like` 43
(40 `automation/**` + 3 `scripts/**`). 12 files carry ≥ 2 flags — non-exclusivity proven on real
data. 245 files flagged, **all remain in the inventory**; 117 source files carry no flags —
application routes, components, lib, and server files are unflagged (spot-checked
`src/routes/index.tsx`, `src/lib/collections-core.ts`, `src/components/PosterCard.tsx`,
`src/server/auth.ts`: all false; `scripts/sync-notion-to-firestore.js`: automation-flagged and
still present).

**Unmodified Phase 4A on v2 evidence**: summary identical to baseline on every field (nodes 382,
edges 1546, units 138, orphans 133) — zero regression for a TypeScript repository.

Inventory-set note: the CinePrint file set differs from the Phase 3 baseline by exactly 29
`.vercel/output/**` hashed-artifact renames (29 removed / 29 added, **zero differences outside
`.vercel/`**). This is the repository owner's parallel rebuild of the gallery app during this
phase (ProjectDock is untouched; `.codeatlas` oracle maps untouched); it is not collector
behavior. The evidence snapshot otherwise reflects the same source tree.

## 9. Backward Compatibility

- **Existing required fields unchanged**; all new record/file fields are additive and optional.
- **`resolution_status` value set unchanged** (`resolved` / `unresolved` / `not_local`) — proven by
  running unmodified Phase 4A against v2 evidence on both repos (§7, §8). `classification` gains
  one provenance-only value (`relative`), passed through untouched by consumers.
- Phase 3 v1 evidence remains readable; no consumer (4A graph, 4B.1, 4B.2) requires modification —
  demonstrated by execution, not inspection alone.
- Manifest version bumped `0.3.0 → 0.4.0`; no test asserted the old version.

## 10. Known Limitations

See §4 for resolution limits. Additional: `dist/`-style generated directories that are excluded by
pre-existing Phase 3 rules never reach the inventory, so their generated-like flags can only be
observed at the function level (M3) — exclusion behavior itself was deliberately not changed.
Flags for `.github` CI configs apply to non-source inventory files as well (they are observations,
not type changes).

## 11. Explicit Non-Goals (not implemented, per contract)

Semantic annotation (4C.1B); UI string classification; semantic relevance decisions or
reclassification; exclusion of any file; changes to 4A/4B.1/4B.2 logic, carving, consolidation, or
canonical resolution; naming changes; VOI inspection; lookup; embeddings; LLM dependencies.
Phase 2 oracle maps untouched. ProjectDock and CinePrint untouched.

## 12. Integrity

- Full suite: 96/96 green (74 pre-existing unmodified + 22 new).
- ProjectDock: checksum-verified unchanged (all repo files).
- CinePrint: the repository owner's parallel development continued during this phase (source edits
  to `src/routes/index.tsx`, `src/routes/-components/home-discovery.tsx`, several
  `src/components/*` files, `public/sitemap.xml`, `src/lib/poster-palettes.json`, plus `.vercel`/
  `.output` rebuild artifacts and `.git/index`). Verified: **zero changes attributable to CodeAtlas
  operations** (agent access to both repos was read-only; `ProjectDock` is byte-identical), and
  the **`.codeatlas` oracle maps are byte-identical**. The v2 evidence snapshot is a consistent
  point-in-time capture; the owner's post-snapshot source edits do not affect the collector
  comparison results.
- CodeAtlas changes limited to: `src/utils.js`, `src/collectors/files.js`, `src/collectors/imports.js`,
  `src/collect.js` (version), `SKILL.md` (§5b evidence contract), `progress.md`, this report, two
  new test suites, two new fixtures, and validation outputs under
  `tests/evidence-cache/<repo>/validation/{evidence,structural}/`.
