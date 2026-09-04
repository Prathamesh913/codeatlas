# Phase 5A — Productization Foundation

**Date:** 2026-09-04
**Goal:** a clean, reproducible, private-beta-ready product foundation — no semantic
core changes. All prior stages ran unchanged; only packaging, CLI, docs, and examples
were added or rewritten.

---

## 1. Initial Repository State

- **Not a git repository** (no history, no tags, no release state).
- `.gitignore` covered only `tests/evidence-cache/`, `tests/**/structural/`,
  `node_modules/`.
- `package.json`: version `0.3.0` (stale vs module versions 0.4.x/0.1.x), `license:
  "TBD"`, **no `bin`**, no `files` whitelist, test glob missing `tests/cli` and
  `tests/docs`.
- `README.md`: frozen at Phase 2C — stated the CLI/scanner "do not exist", documented
  no installation or usage, examples promised `flows.json` (never generated).
- **No unified CLI**: 7 separate `node src/<stage>/cli.js` invocations with ordered
  directory arguments.
- `examples/sample-output/`: pre-4B.2 content (`flows.json`, `FEATURE_MAP.md`,
  `SYSTEMS.md`) inconsistent with current output.
- `DECISIONS.md` absent (decisions D-001…D-023 lived in `progress.md`).
- Verified state otherwise: 194 tests / 0 failures, clean integrity manifest, zero
  runtime dependencies.

## 2. Git Initialization and Baseline Commit

- `git init` (existing user identity used as-is; nothing invented).
- `.gitignore` extended (evidence caches, package artifacts, `.codeatlas/`, logs,
  editor/OS files, temp dirs) **before** the baseline commit.
- Baseline commit `20c33a9` — `chore: establish verified Phase 4C.3 baseline` — 207
  files, **0 evidence-cache files staged** (verified), no user-owned repos, no
  rewritten or fabricated history.

## 3. Baseline Tag

- `v0.4.0-core-verified` (no prior tagging convention existed; the 4C-review
  suggestion was adopted verbatim).

## 4. Unified CLI Architecture

- `bin/codeatlas.js` (executable, `#!/usr/bin/env node`) — a thin orchestration layer
  calling the existing exported stage functions (`collect → annotate → runPhase4A →
  runInvestigation → runResolution → runConsolidation → runCanonical → render`).
  No pipeline logic duplicated; all stage CLIs and programmatic APIs unchanged.
- Real defect found and fixed during validation: the ESM `import.meta.url === argv[1]`
  guard silently no-ops through npm's symlinked `bin` (symlink vs real path), so the
  first installed-package run exited 0 with no output. Fixed with a `realpathSync`
  comparison. Stage CLIs keep their direct-invocation guards (unchanged behavior).

## 5. CLI Commands and Behavior

- `codeatlas <repository-path> [--output <directory>]` — full run; `--help`/`-h`,
  `--version`/`-V` (`--version` reads `package.json` at runtime, so binary, metadata,
  and docs cannot drift).
- Validates the path (missing → "does not exist"; file → "not a directory"), prints
  concise per-stage progress plus a summary line (`N features, M systems, …`), reports
  the output directory. Exit 0 on success, 1 with a `codeatlas: error: …` message on
  failure (verified for usage, bad-path, and bad-directory cases).
- Default output `<repository>/.codeatlas` (D-002's sanctioned location); sources in
  the analyzed repo are never touched (asserted by test).
- 10 CLI tests spawn the real executable (help/version text, failure codes, fixture
  execution, `--output` redirection, source immutability, byte-identical reruns).

## 6. Package Metadata Changes

- `0.3.0 → 0.5.0` (first productization foundation; not a 1.0 contract).
- `bin: { codeatlas: bin/codeatlas.js }`, keywords, `engines: node >= 18` (kept).
- scripts: `scan` added; `test:*` per suite incl. new `test:cli`, `test:docs`.
- `repository` deliberately **omitted** — no URL invented.

## 7. License Decision

- **MIT, provisional** — chosen as the conservative standard permissive license for an
  npm-distributed developer tool (no copyleft obligations on evaluators). Copyright
  line: `Copyright (c) 2026 CodeAtlas contributors`.
- **Flagged for owner confirmation**: the choice is recorded as provisional in D-027,
  in the README ("subject to owner confirmation"), and here. Replacing it later touches
  only `LICENSE` + the `license` field. The phase's stop-condition was not triggered
  because a responsible conservative default exists and is documented as provisional;
  the owner decision is tracked, not assumed.

## 8. npm Files Whitelist

- `files`: `src/`, `schemas/`, `templates/`, `bin/`, `README.md`, `SKILL.md`, `LICENSE`.
- Tests, fixtures, evidence caches, temp outputs, and phase reports are structurally
  excluded (docs tests assert this).

## 9. npm pack --dry-run Results

- `codeatlas-0.5.0.tgz`: **54 files / 107.5 kB package / 381.4 kB unpacked** (was:
  205 files / 883 kB incl. all tests and fixtures). **0 test/fixture/evidence files.**

## 10. Clean npx-Style Execution Results

- Packed the real tarball, `npm install`ed it **offline** into a fresh temp project,
  and ran `./node_modules/.bin/codeatlas <repo> --output map` on both smoke fixtures:
  full runs completed (React fixture: 2 features + 1 relationship; Python fixture:
  honest 0-feature/1-unresolved map), `--version`/`--help` agreed with package.json
  (0.5.0), temp dirs removed afterwards. No reliance on running the source tree.

## 11. README Changes

- Rewritten for private-beta developers across all 15 required topics: what/why,
  human + agent usage, generated artifacts, grep-vs-CodeAtlas, install/execute,
  CLI options, output structure, worked example, concept glossary (flows explicitly
  **not** generated), ambiguity representation, source-safety, honest limitations,
  maturity (private beta / experimental), feedback guidance.
- Claims checked by test: no `flows.json` promise, no universal-language or perfect-
  understanding claims, "never modified" source guarantee stated.

## 12. Example Changes

- `examples/sample-output/` **regenerated from the current pipeline** (smoke-react-app:
  canonical JSONs + `markdown/` tree); obsolete `flows.json`, `FEATURE_MAP.md`,
  `SYSTEMS.md` removed.
- `examples/minimal/README.md`: command invocation, output directory, one feature
  (`feature-board`, verbatim), one relationship (Board→Form with its import edge),
  one uncertainty example (real `unresolved-parser` from the consolidate-app fixture
  run), one evidence trail, and an honest "where are the systems?" section (a micro-
  repo resolves none — the map says so).
- `examples/README.md` records regeneration provenance and the removal rationale.

## 13. Documentation Consistency

- New `tests/docs/` suite (21 tests): README honesty (no flows promise, real CLI docs,
  maturity stated, no universal-language claims, source-safety stated), SKILL.md stage
  coverage (all 8 stages), example shapes, package metadata agreement (0.5.x, bin +
  executable present, license explicit + LICENSE present, whitelist clean, no invented
  repository URL).
- `SKILL.md` gained a "Running a scan" section (unified CLI contract); stage CLIs
  documented as internal.

## 14. Test Results

- **225 tests / 65 suites / 0 failures**: 194 pre-existing (unmodified) + 10 CLI
  (`tests/cli/`) + 21 docs (`tests/docs/`). No existing test was weakened or rewritten
  for this phase.

## 15. Determinism Results

- ProjectDock + CinePrint full unified-CLI runs into `phase-5a/`, each run twice:
  all canonical artifacts (`features/systems/unresolved/relationships/files.json`)
  **byte-identical** across runs (report input-path provenance only).
- Fixture-scale CLI reruns assert byte-identical canonical output in the test suite.

## 16. Source/Artifact Integrity Results

- Protected manifests re-verified (0 non-OK); phase-4c1/4c2/4c3 artifacts untouched;
  oracle maps untouched; repos read-only (CLI immutability test + validation runs).
- PD validation via unified CLI: 3 features / 10 systems (matches 4C.3).
- CP validation via unified CLI: 15 features / 7 systems (matches 4C.3).

## 17. Remaining Blockers

1. **Provisional MIT license awaits owner confirmation** (tracked, non-blocking for
   private beta distribution to a known cohort, blocking for public npm publish).
2. No registry `repository` metadata (deliberately omitted — add with the real URL at
   publish time).
3. Inspection rate and PD technical naming are unchanged by design (semantic scope,
   deferred to beta feedback).

## 18. Private-Beta Readiness Verdict

**Ready for private beta**: one documented command, versioned package with a clean
install footprint, honest docs, regenerated examples, a green suite (**225 tests**),
deterministic reruns, and read-only guarantees — all on the unchanged validated core.
The only pre-distribution action is the owner's license confirmation (§17.1); cohort
friction notes then decide everything after.

## 19. Exact Recommended Next Step

Recruit 3–5 developers, hand them the README + `codeatlas <repo>`, and capture
friction (install, CLI ergonomics, map readability) per
`tests/PHASE_4C3_RELEASE_READINESS.md` §10. Then: confirm/replace MIT → act on notes →
only then consider public beta. No Phase 5B, no semantic work, no npm publish until
then.
