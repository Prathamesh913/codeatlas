# CodeAtlas

**CodeAtlas builds a semantic map of a codebase — features, systems, files, and relationships — from source code, deterministically, with recorded evidence.**

Private beta / experimental. Version 0.5.0. Not yet published on npm.

## What it is

A developer or coding agent facing an unfamiliar repository asks: *what can users do here,
what supports it, and which files matter?* CodeAtlas answers by scanning the repository
once and writing a persistent, evidence-backed map: user-visible **features**, cross-cutting
**systems**, the **files** that implement them, the **relationships** between them, and the
**unresolved or ambiguous** areas it could not decide — plus human-readable Markdown docs
rendered from that map.

Typical natural-language requests it helps answer:

- "The carousel is broken." → which feature, and which files implement it?
- "Where is authentication handled?"
- "Which files implement saved posters?"
- "What code is involved in project creation?"
- "What depends on this component?"

## Why it exists

`grep` finds text. Symbol search finds names. Dependency graphs find imports. None of them
explains *which user-visible capability a file serves* or *which shared system explains a
behavior*. In a larger codebase, blind text search turns every bug report into a
rediscovery project. CodeAtlas produces that interpretation layer — with confidence levels
and provenance, so agents and developers can navigate without re-deriving the whole
repository on every task.

## For humans and coding agents

- **Humans** browse `markdown/INDEX.md`: features by name and alias, systems, a
  file→entity navigation index, and an explicit list of unresolved areas.
- **Agents** consume `canonical/*.json` (machine-readable, stable ids) and `SKILL.md`
  (behavioral rules for interpreting the map). Uncertainty is first-class: `low`/`unknown`
  confidence and `unresolved.md` mean "verify before acting".

## What it generates

In the output directory (default `<repository>/.codeatlas`):

```
.codeatlas/
├── evidence/          observed facts (evidence/files.json, imports.json, symbols.json,
│                      strings.json, entrypoints.json, config.json, repository.json,
│                      manifest.json — the collector's per-run repository manifest)
├── annotation/        text classification + file relevance classes
├── structural/        implementation graph + structural units
├── investigation/     per-unit hypotheses with evidence
├── semantic/          carved regions + first-pass entities
├── consolidation/     merges, splits, demotions — all recorded
├── canonical/         features.json, systems.json, unresolved.json,
│                      relationships.json, files.json, canonical-report.json
└── markdown/          INDEX.md (query index), features/*.md, systems/*.md,
                       unresolved.md, ARCHITECTURE.md
```

Markdown is a projection: JSON is the source of truth.

Artifact meanings:

- `canonical/features.json` — resolved user-visible capabilities with names, aliases,
  descriptions, confidence, primary files, and evidence.
- `canonical/systems.json` — cross-cutting architectural responsibilities shared by
  multiple regions.
- `canonical/files.json` — the file → entity navigation index with relevance classes
  (application / test / generated / config).
- `canonical/relationships.json` — directed semantic edges (`USES`, `DEPENDS_ON`,
  `SUPPORTS`), each backed by an observed import or structural edge.
- `canonical/unresolved.json` — ambiguous or undecidable areas with the reason, the
  evidence consulted, and what would resolve them.
- `canonical/canonical-report.json` — per-run counts and provenance summary.
- `evidence/manifest.json` — the collector's repository manifest (files
  discovered/included/excluded, exclusions, errors).
- `markdown/INDEX.md` — the query index: lookup by feature/system name, technical-name →
  canonical-name mapping, file navigation, unresolved list, relationships.
- `markdown/features/<id>.md`, `markdown/systems/<id>.md` — per-entity documentation
  rendered from the canonical data.
- `flows.json` — **part of the model, but not currently generated.** Behavioral
  call-chain flows exist in the schema (`schemas/flow.schema.json`) and template, but the
  pipeline has no call-chain evidence yet; projections state this explicitly rather than
  fabricating flows.

## Concepts (and how they differ)

- **Feature** — a user-visible capability ("Search Artist", "Submit Poster"). Each has a
  description, aliases, files, and evidence.
- **System** — a cross-cutting architectural responsibility ("Auth", "Poster") shared by
  multiple regions. Not a feature; features can *depend on* systems.
- **File** — an implementation unit, linked to the features/systems it serves, with a
  relevance class. A file is evidence, never an entity on its own.
- **Structural unit** — a connected component of the implementation graph. Structural
  units are *not* automatically features or systems; they are the neutral starting points
  that investigation and consolidation interpret.
- **Relationship** — a directed semantic edge between entities, backed by an observed
  import or structural edge. Never invented from co-location.
- **Flow** — a behavioral call-chain across layers. Part of the data model; **not
  currently generated** (see above).
- **Evidence** — recorded provenance for every decision: what was observed, in which
  file, at what confidence, from which pipeline stage. Observed facts and interpretations
  are distinguished by `source`.

## How it works (pipeline stages)

1. **Collect evidence** — read-only scan of the repository: files, imports, symbols,
   strings, entry points.
2. **Annotate** — classify observed text (UI vs technical vs generated) and assign
   relevance classes to files.
3. **Structural graph** — build the import/composition graph and neutral structural
   units.
4. **Investigate** — read a bounded subset of files per unit to form hypotheses with
   evidence (no external model).
5. **Semantic resolution** — carve regions and form first-pass entities.
6. **Consolidate** — merge, split, demote — every decision recorded, nothing silently
   deleted.
7. **Canonicalize** — resolve names (behavior > naming evidence), types, and
   descriptions; preserve ambiguity.
8. **Project** — render Markdown docs from the canonical JSON.

## Design principles and trust model

- **Deterministic** — same input, same output; reruns are byte-identical (asserted by
  tests).
- **Transparent** — every entity carries its evidence trail; observed facts and
  interpretations are distinguishable.
- **Ambiguity-preserving** — undecidable areas stay `ambiguous`/`unresolved` with a
  reason; demotions are recorded, never silently deleted.
- **Source-repository-safe** — the analyzed repository is never modified; all output
  goes to the output directory.
- **No external model runtime** — zero runtime dependencies, no LLM SDK, no network
  access, no telemetry. Investigation is deterministic and question-driven.

## What CodeAtlas does not claim to do

- It does **not** claim perfect semantic understanding — names and boundaries are
  heuristic; check `confidence` and `unresolved.md` before acting on them.
- It does not generate `flows.json` (see above).
- It does **not** modify the analyzed repository's source files.
- It does **not** replace reading source code — the map is an aid to investigation.
- It does **not** run an external model, network service, or telemetry.

## Current maturity

**Private beta / experimental.** The semantic core is validated on two real
repositories — **ProjectDock** and **CinePrint** — with a 284-test regression suite
(73 suites, 0 failures), deterministic reruns, and read-only guarantees. Validation on
*unfamiliar* repositories is still needed; a public release is not claimed. Public
release additionally requires license confirmation (see [License](#license)).

## Installation

Requirements: Node.js ≥ 18. Zero runtime dependencies.

> **Not published on npm.** `npm install codeatlas` / `npx codeatlas` **do not work
> yet** — the package is not on the registry. Install from a checkout or tarball:

```bash
# from a checkout of this repository:
node bin/codeatlas.js ./my-app --output ./map-output

# or from the package tarball (see docs/installation.md):
npm install ./codeatlas-0.5.0.tgz
```

Full details, verification steps, and common failures: **[docs/installation.md](docs/installation.md)**.

## Usage

```bash
$ codeatlas ./ideas-app            # output -> ./ideas-app/.codeatlas
codeatlas: collecting evidence...
...
codeatlas: done — 4 features, 1 system, 1 ambiguous, 2 unresolved/demoted
codeatlas: output written to ./ideas-app/.codeatlas
```

```
codeatlas <repository-path> [--output <directory>]
codeatlas --help
codeatlas --version
```

- `--output <directory>` redirects all output (default: `<repository-path>/.codeatlas`).
- Exit code 0 on success, 1 on failure with a `codeatlas: error: …` message naming the
  cause.
- From a checkout, invoke via `node bin/codeatlas.js` (or `npm run scan --`).

Full walkthrough — reading the map, following relationships, handling ambiguity, and an
agent bug-investigation workflow: **[docs/usage.md](docs/usage.md)**.

## Uninstallation

```bash
# remove generated output from an analyzed repository:
rm -rf ./ideas-app/.codeatlas

# remove a local tarball install:
npm uninstall codeatlas
```

CodeAtlas never writes outside the output directory and does not touch shell
configuration, so removal is simple. Full details: **[docs/uninstallation.md](docs/uninstallation.md)**.

## Source safety

The analyzed repository is **never modified**: the pipeline only reads it. All output
goes to the chosen output directory. Re-running on an unchanged repository produces
byte-identical canonical artifacts and Markdown (asserted by tests).

## Troubleshooting

- `codeatlas: error: repository path 'X' does not exist.` — check the path; the CLI
  expects a directory.
- `codeatlas: error: repository path 'X' is not a directory.` — a file was passed.
- `codeatlas: error: EEXIST: file already exists, mkdir 'X'` — the `--output` path
  exists as a *file*; choose a directory path.
- `codeatlas: error: --output requires a directory argument` — pass the path after
  `--output`.
- Permission errors — the CLI needs read access to the repository and write access to
  the output directory (created if missing).
- Empty or sparse maps on non-JS/TS/Python repositories are expected (see limitations).

See also **[docs/installation.md](docs/installation.md)** for installation failures and
verification.

## Limitations and known failure modes (honest)

- **No perfect semantic understanding.** Names and boundaries are heuristic; check
  `confidence` and `unresolved.md` before acting on them.
- **Language coverage:** strongest on JavaScript/TypeScript (incl. JSX/TSX) and Python;
  other languages are observed as files with limited symbol/import evidence, so maps on
  them can be sparse or empty.
- **No flows:** behavioral call-chain flows are not extracted (see Concepts).
- **Technical names remain** where no user-facing text exists (e.g. infrastructure
  modules); they are recorded as behavior-derived names with technical provenance, and
  the original terms stay searchable as aliases/`implementation_terms`.
- **Inspection is bounded**, not exhaustive: investigation reads a bounded subset of
  files; unread areas are recorded, not guessed.
- **Generated/test/automation files** can connect the structural graph but never anchor
  canonical entities; they are recorded separately.

Questions CodeAtlas may not answer reliably yet: behavioral sequences across layers
(no flows), intent behind generated code, semantics of non-JS/TS/Python repositories.

## Supported and currently tested repositories

- **ProjectDock** — real-repository validation (Phase 4C.3 and Phase 5A).
- **CinePrint** — real-repository validation (Phase 4C.3 and Phase 5A).
- Test fixtures: a small React/TypeScript app and a Python CLI app
  (`tests/fixtures/`).

No public URLs are linked here — these repositories are not public.

## Contributing

Contributions are welcome — especially unfamiliar-repository validation, CLI usability,
documentation, and test coverage. See **[CONTRIBUTING.md](CONTRIBUTING.md)** for setup,
test workflows, review expectations, and what should not change without discussion.

## Issue reporting

- Bug reports: **[.github/ISSUE_TEMPLATE/bug_report.yml](.github/ISSUE_TEMPLATE/bug_report.yml)**
- Feature requests: **[.github/ISSUE_TEMPLATE/feature_request.yml](.github/ISSUE_TEMPLATE/feature_request.yml)**
- Documentation: **[.github/ISSUE_TEMPLATE/documentation.yml](.github/ISSUE_TEMPLATE/documentation.yml)**

Please do not submit private source code, secrets, or unredacted logs (see
[SECURITY.md](SECURITY.md)).

## Private-beta feedback

The private beta exists to learn what works before public release. If you're testing
CodeAtlas on a real repository: **[docs/private-beta.md](docs/private-beta.md)** has the
suggested tasks, the feedback questions, the anonymization guidance, and the submission
workflow (GitHub Issues; a private channel only if the owner configures one).
Private-beta testers: **[.github/ISSUE_TEMPLATE/private_beta_feedback.yml](.github/ISSUE_TEMPLATE/private_beta_feedback.yml)**.

## Security and privacy

What CodeAtlas reads (the analyzed repository, read-only), what it writes (the output
directory only), that there is no network access or telemetry, and how to report
vulnerabilities: **[SECURITY.md](SECURITY.md)**.

## Roadmap / next steps

1. **Private beta** — recruit 3–5 developers, capture friction (see
   [docs/private-beta.md](docs/private-beta.md)).
2. **License confirmation** — owner confirms or replaces the provisional MIT (see
   [License](#license)).
3. **Unfamiliar-repository validation** — broader real-repo testing beyond the two
   validated repositories.
4. **Act on beta feedback** — semantic improvements only when feedback names a concrete
   problem.
5. Deferred by decision (not planned for 0.5.x): flow extraction (needs call-chain
   evidence), natural-language lookup.

Semantic architecture redesign is intentionally deferred; the current pipeline is the
validated baseline.

## Citing / referencing

No formal citation format is set. Reference the project by name and version, e.g.
"CodeAtlas 0.5.0 (private beta)". This document will be updated if the project gains a
DOI or a publication.

## Further reading

- [SKILL.md](SKILL.md) — behavioral rules for agents consuming the map.
- [DECISIONS.md](DECISIONS.md) — architecture decision record (D-001…).
- [progress.md](progress.md) — phase log and validation record.
- [CHANGELOG.md](CHANGELOG.md) — version history.
- [tests/PHASE_4C3_FINAL.md](tests/PHASE_4C3_FINAL.md) — latest semantic-core validation report.
- [docs/release-readiness.md](docs/release-readiness.md) — completed vs pending vs blocked.
- `schemas/` + `templates/` — data and projection contracts.
- [examples/](examples/) — minimal regenerated end-to-end sample.

## License

MIT — see [LICENSE](LICENSE). **The license choice is provisional and still requires
owner confirmation before public release**; until then this project should be treated
as private-beta software, not a fully open-source release. Public release is blocked
pending that confirmation (see [docs/release-readiness.md](docs/release-readiness.md)).
