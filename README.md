# CodeAtlas

**CodeAtlas builds a semantic map of a codebase — features, systems, files, and relationships — from source code, deterministically, with recorded evidence.**

Private beta / experimental. Version 0.5.0.

## What it is

A developer or coding agent facing an unfamiliar repository asks: *what can users do here,
what supports it, and which files matter?* CodeAtlas answers by scanning the repository
once and writing a persistent, evidence-backed map: user-visible **features**, cross-cutting
**systems**, the **files** that implement them, the **relationships** between them, and the
**unresolved or ambiguous** areas it could not decide — plus human-readable Markdown docs
rendered from that map.

## Why it exists

`grep` finds text. Symbol search finds names. Dependency graphs find imports. None of them
explains *which user-visible capability a file serves* or *which shared system explains a
behavior*. CodeAtlas exists to produce that interpretation layer — with confidence levels
and provenance, so agents and developers can navigate without rediscovering the whole
repository.

## For humans and coding agents

- **Humans** browse `markdown/INDEX.md`: features by name, systems, file→entity lookup,
  and an explicit list of unresolved areas.
- **Agents** consume `canonical/*.json` (machine-readable, stable ids) and `SKILL.md`
  (behavioral rules for interpreting the map). Uncertainty is first-class: `low`/`unknown`
  confidence and `unresolved.md` mean "verify before acting".

## What it generates

In the output directory (default `<repository>/.codeatlas`):

```
.codeatlas/
├── evidence/        raw observed facts (files, imports, symbols, …)
├── annotation/      text classification + file relevance classes
├── structural/      implementation graph + structural units
├── investigation/   per-unit hypotheses with evidence
├── semantic/        carved regions + first-pass entities
├── consolidation/   merges, splits, demotions — all recorded
├── canonical/       features.json, systems.json, unresolved.json,
│                    relationships.json, files.json, canonical-report.json
└── markdown/        INDEX.md, features/*.md, systems/*.md,
                     unresolved.md, ARCHITECTURE.md
```

Markdown is a projection: JSON is the source of truth.

## Concepts

- **Feature** — a user-visible capability ("Search Artist", "Submit Poster").
  Each has a description, aliases, files, and evidence.
- **System** — a cross-cutting architectural responsibility ("Auth", "Poster").
- **File** — implementation unit, linked to the features/systems it serves.
- **Relationship** — a directed edge (`USES`, `DEPENDS_ON`, `SUPPORTS`) backed by an
  observed import or structural edge.
- **Flows** — *not currently generated.* The pipeline has no call-chain evidence yet;
  projections state this explicitly rather than fabricating flows.
- **Ambiguity** — first-class. Entities the evidence cannot decide stay `ambiguous` or
  `unresolved` with a recorded reason and what would resolve them. Nothing is forced,
  and demoted false positives are recorded, not silently deleted.

## Installation and execution

Requirements: Node.js ≥ 18. Zero runtime dependencies.

```bash
npx codeatlas ./my-app
# or, from a checkout:
node bin/codeatlas.js ./my-app --output ./map-output
```

A full run on a small repository takes seconds and never modifies the analyzed
repository: all output goes to the output directory (default `<repo>/.codeatlas`).

## CLI options

```
codeatlas <repository-path> [--output <directory>]
codeatlas --help
codeatlas --version
```

`--output <directory>` redirects all output (default: `<repository-path>/.codeatlas`).
Exit code is 0 on success, non-zero with a message on failure.
Exit codes: 1 means usage/input error or a pipeline failure; the message names the cause.

## Example workflow

```bash
$ codeatlas ./ideas-app
codeatlas: collecting evidence...
codeatlas: classifying text and relevance...
codeatlas: building structure...
codeatlas: investigating units...
codeatlas: resolving semantics...
codeatlas: consolidating...
codeatlas: resolving names and inspecting...
codeatlas: rendering docs...
codeatlas: done — 4 features, 1 system, 1 ambiguous, 2 unresolved/demoted
codeatlas: output written to ./ideas-app/.codeatlas

$ ls ./ideas-app/.codeatlas/markdown
ARCHITECTURE.md  INDEX.md  features/  systems/  unresolved.md
```

Open `markdown/INDEX.md` to browse by feature name, alias, file, or uncertainty.

## Source safety

The analyzed repository is **never modified**: the pipeline only reads it. All output
goes to the chosen output directory. Re-running on an unchanged repository produces
byte-identical canonical artifacts and Markdown.

## Limitations and known failure modes (honest)

- **No perfect semantic understanding.** Names and boundaries are heuristic; check
  `confidence` and `unresolved.md` before acting on them.
- **Language coverage:** strongest on JavaScript/TypeScript (incl. JSX/TSX) and Python;
  other languages are observed as files with limited symbol/import evidence.
- **No flows:** behavioral call-chain flows are not extracted (see Concepts).
- **Technical names remain** where no user-facing text exists (e.g. infrastructure
  modules); they are recorded as behavior-derived names with technical provenance, and
  the original terms stay searchable as aliases/`implementation_terms`.
- **Inspection is bounded**, not exhaustive: investigation reads a bounded subset of
  files; unread areas are recorded, not guessed.
- **Generated/test/automation files** can connect the structural graph but never anchor
  canonical entities; they are recorded separately.

## Current maturity

**Private beta / experimental.** The pipeline is deterministic, evidence-backed, and
validated on real repositories with a 194-test regression suite — but semantic maps are
interpretations, not ground truth. Treat low-confidence entries as leads.

## Feedback that helps

When reporting results, include: the repository type (language, framework, rough size),
the `canonical-report.json` counts, any misnamed/misplaced entity with its `id` and why,
and anything in `unresolved.md` you expected to resolve. Open an issue in the
repository hosting CodeAtlas with the `.codeatlas/canonical-report.json` summary.

## Further reading

- `SKILL.md` — behavioral rules for agents consuming the map.
- `progress.md` — decision history (D-001…) and validation record.
- `tests/PHASE_4C3_FINAL.md` — latest validation report.
- `templates/` + `schemas/` — projection and data contracts.
- `examples/` — a minimal regenerated end-to-end sample.

## License

MIT — see `LICENSE`. (License choice is provisional for the private beta and subject to
owner confirmation.)
