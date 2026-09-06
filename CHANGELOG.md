# Changelog

All notable changes to CodeAtlas are documented here.
Format: Keep a Changelog style; versioning is SemVer-inclined while 0.x.
The project is in **private beta** — nothing below is published to npm or
GitHub releases yet.

## Unreleased

Planned (not started, not completed):

- Private-beta participant recruitment and friction capture
  ([docs/private-beta.md](docs/private-beta.md)).
- Owner confirmation of the provisional MIT license — **blocks public release**.
- Broader unfamiliar-repository validation.

Documentation and repository preparation (this phase, unreleased):

- GitHub project documentation: README expansion, install/uninstall/usage guides,
  private-beta kit, contributing/security/conduct/changelog files, issue + PR
  templates, offline CI.
- Documentation tests extended 21 → 80 (repository file checks, link resolution,
  npm-availability honesty, template sanity); suite now 287 tests / 74 suites.
- Decisions D-031 (GitHub documentation set), D-032 (CI).
- Real repository URL added: `package.json` `repository`/`bugs` metadata,
  clone commands in README/CONTRIBUTING/installation.
- README redesigned into a concise product landing page (775 words vs ~1,970):
  problem, output, one real example, quick start, investigation workflow, honest
  status, documentation navigation. Detailed content relocated to new
  `docs/concepts.md` (concepts, trust model) and `docs/output-format.md`
  (artifacts, pipeline stages); troubleshooting rows moved to the installation
  guide; roadmap moved to `docs/release-readiness.md`. Landing-page conciseness
  pinned by a docs test.
- README rewritten for a general technical audience: plain-language opening
  ("creates a map of what the project does, where that behavior lives, and how the
  important parts connect"), realistic bug-investigation example, honest output-tree
  description, simple glossary; internal terminology (semantic/canonical/structural)
  moved behind the practical explanation, with a docs test guarding the opening.

## 0.5.0 — 2026-09-04### Added

- **Unified CLI** (`bin/codeatlas.js`, package `bin: codeatlas`):
  `codeatlas <repository-path> [--output <directory>]`, plus `--help` and
  `--version`. Orchestrates all eight validated stages without duplicating
  pipeline logic; concise per-stage progress, summary line, exit 0/1 discipline;
  default output `<repo>/.codeatlas`; the analyzed repository is never modified.
- **CLI test suite** (`tests/cli/`, 10 tests): help/version agreement, failure
  exit codes, fixture execution, `--output` redirection, source immutability,
  byte-identical reruns.
- **Documentation consistency suite** (`tests/docs/`, 21 tests): README honesty
  (no `flows.json` promises, no universal-language claims), SKILL.md pipeline
  coverage, example shapes, package-metadata agreement.
- **Package metadata**: version aligned to `0.5.0`; `bin`; keywords; `engines`
  (Node ≥ 18); explicit `files` whitelist (`src/`, `schemas/`, `templates/`,
  `bin/`, `README.md`, `SKILL.md`, `LICENSE`) — the tarball carries no tests,
  fixtures, or generated evidence.
- **MIT license** (`LICENSE`), added **provisionally** — see Known limitations.
- **Decision record** (`DECISIONS.md`): D-001…D-023 migrated verbatim from
  `progress.md`; new decisions D-024…D-030 (Git baseline, CLI contract, version,
  license, whitelist, docs contract, record home).
- **Git repository**: initialized with `.gitignore` (evidence caches, package
  artifacts, `.codeatlas/`, logs, editor files); verified baseline commit
  (`20c33a9`, tag `v0.4.0-core-verified`).
- **README** rewritten for private-beta developers; `SKILL.md` gained the scan/
  CLI section; examples regenerated from the real pipeline
  (`examples/sample-output/`, `examples/minimal/` walkthrough; stale
  `flows.json` removed).

### Validated (semantic core, unchanged in 0.5.0)

- Pipeline: Collector v2 → Annotation → Structural graph → Investigation →
  Semantic resolution → Consolidation → Canonical JSON → Markdown projections.
- Deterministic, evidence-based, ambiguity-preserving; decisions and demotions
  recorded; source repositories read-only; zero runtime dependencies.
- Real-repository validation on **ProjectDock** and **CinePrint** (Phase 4C.3;
  re-validated via the unified CLI in Phase 5A with byte-identical canonical
  artifacts).
- Test suite at 0.5.0: **225 tests / 65 suites / 0 failures**.

### Known limitations

- **License is provisional**: MIT requires owner confirmation before public
  release ([docs/release-readiness.md](docs/release-readiness.md)).
- **Not published on npm** — `npm install codeatlas` / `npx codeatlas` do not
  work; install from a checkout or tarball
  ([docs/installation.md](docs/installation.md)).
- `flows.json` is not generated (behavioral call-chain evidence is not extracted).
- Language coverage: strongest on JavaScript/TypeScript and Python; maps on other
  repositories can be sparse or empty.
- No CI, templates, or GitHub project documentation before 0.5.0 — see
  Unreleased.

