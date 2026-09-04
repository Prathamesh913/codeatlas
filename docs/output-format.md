# CodeAtlas Output Format

What a CodeAtlas run writes, what each artifact means, and the pipeline stages that
produce them. Canonical JSON is the source of truth; Markdown is a projection of it.
Data contracts live in `schemas/`, projection contracts in `templates/`.

---

## Output directory

Default output is `<repository>/.codeatlas`; `--output <directory>` redirects it. The
analyzed repository is only read.

```
<output>/
├── evidence/          observed facts (files.json, imports.json, symbols.json,
│                      strings.json, entrypoints.json, config.json, repository.json,
│                      manifest.json — the collector's per-run repository manifest)
├── annotation/        text classification + file relevance classes
├── structural/        implementation graph + structural units
├── investigation/     per-unit hypotheses with evidence
├── semantic/          carved regions + first-pass entities
├── consolidation/     merges, splits, demotions — all recorded
├── canonical/         features.json, systems.json, unresolved.json,
│                      relationships.json, files.json, canonical-report.json
└── markdown/          INDEX.md (query index), features/<id>.md, systems/<id>.md,
                       unresolved.md, ARCHITECTURE.md
```

`canonical/` and `markdown/` are the artifacts to consume; earlier stages are recorded
provenance.

## Artifact meanings

- `canonical/features.json` — resolved user-visible capabilities with names, aliases,
  descriptions, confidence, primary files, and evidence.
- `canonical/systems.json` — cross-cutting architectural responsibilities shared by
  multiple regions. An empty `[]` is a valid, honest answer for repositories without
  shared cross-cutting structure.
- `canonical/files.json` — the file → entity navigation index with relevance classes
  (application / test / generated / config). Generated/test/automation files can
  connect the structural graph but never anchor canonical entities.
- `canonical/relationships.json` — directed semantic edges (`USES`, `DEPENDS_ON`,
  `SUPPORTS`), each backed by an observed import or structural edge.
- `canonical/unresolved.json` — ambiguous or undecidable areas with the reason, the
  evidence consulted, competing interpretations, and what would resolve them. Never
  silently omitted.
- `canonical/canonical-report.json` — per-run counts and provenance summary. Across
  different output directories this file embeds the input path (`evidenceDir`) — the
  only provenance line that differs between runs.
- `evidence/manifest.json` — the collector's repository manifest (files
  discovered/included/excluded, exclusions, errors).
- `markdown/INDEX.md` — the query index: lookup by feature/system name and alias,
  technical-name → canonical-name mapping, file navigation index, unresolved list,
  relationships.
- `markdown/features/<id>.md`, `markdown/systems/<id>.md` — per-entity documentation
  rendered from the canonical data.
- `markdown/unresolved.md` — every ambiguous/unresolved/demoted area with why, what
  was consulted, and what would resolve it.
- `markdown/ARCHITECTURE.md` — whole-map overview.
- `flows.json` — **part of the model, not currently generated** (see
  [concepts.md](concepts.md)). Projections state this explicitly rather than
  fabricating flows.

## Pipeline stages (in plain language)

1. **Collect evidence** — read-only scan: files, imports, symbols, strings, entry
   points → `evidence/`.
2. **Annotate** — classify observed text (UI vs technical vs generated) and assign
   file relevance classes → `annotation/`.
3. **Structural graph** — import/composition graph and neutral structural units →
   `structural/`.
4. **Investigate** — read a bounded subset of files per unit to form hypotheses with
   evidence (deterministic, no external model) → `investigation/`.
5. **Semantic resolution** — carve regions and form first-pass entities → `semantic/`.
6. **Consolidate** — merge, split, demote; every decision recorded, nothing silently
   deleted → `consolidation/`.
7. **Canonicalize** — resolve names (behavior > naming evidence), types, and
   descriptions; preserve ambiguity → `canonical/`.
8. **Project** — render Markdown from the canonical JSON → `markdown/`.

## Determinism

Re-running on an unchanged repository into the same output directory produces
byte-identical canonical artifacts and Markdown (asserted by tests). Across
*different* output directories, everything is byte-identical except the
input-path provenance line in `canonical-report.json`.
