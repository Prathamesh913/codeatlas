# Post-Fix Evaluation Workflow

Portable, offline workflow for checking a CodeAtlas map after the "No
Misleading Canonical Map" hardening. Run it on any machine with Node.js ≥ 18
and a CodeAtlas checkout — no network, no model runtime, no extra
dependencies. The analyzed repository is only read, never modified.

## Commands

```bash
node bin/codeatlas-evaluate.js <repository-path> --output <output-path>
node bin/codeatlas-evaluate.js <repository-path> --output <output-path> --rerun
node bin/codeatlas-evaluate.js --help
node bin/codeatlas-evaluate.js --version
```

`--output` is required. `--rerun` runs the pipeline a second time into a
temporary directory and byte-compares the canonical artifacts (slower, but
proves determinism on that repository).

Exit codes: `0` = evaluation complete, all integrity checks pass; `2` =
evaluation complete but integrity/validation failures were found (reports are
still written); `1` = usage or runtime error with a message on stderr.

## What it writes

All under `<output-path>/`:

```text
<output-path>/
├── canonical/   features.json, systems.json, unresolved.json,
│                relationships.json, files.json, canonical-report.json
├── markdown/    INDEX.md, features/, systems/, unresolved.md, ARCHITECTURE.md
├── evaluation/
│   ├── evaluation-summary.json   machine-readable summary (counts, entities,
│   │                             integrity results, warnings, determinism)
│   └── evaluation-report.md      human-readable report with the same sections
└── …                            recorded working data (evidence/, annotation/,
                                 structural/, investigation/, semantic/,
                                 consolidation/)
```

## Which files to share back

Share `evaluation/evaluation-summary.json` and
`evaluation/evaluation-report.md`. If the map itself needs inspection, share
the whole output directory — but never share private source code, secrets, or
credentials (see SECURITY.md).

## Report sections

Repository metadata · canonical entity summary · feature/system
classification · reverse file-to-entity coverage (including files with empty
associations) · relationship summary by type · router handling (`ROUTES_TO`
topology edges vs semantic ownership out of aggregation-shaped files) ·
unresolved items · integrity checks (reverse-index bidirectionality plus
canonical id/endpoint validity) · suspicious patterns (weak generic-only
entity names, empty associations, validation failures) · determinism check ·
limitations.

## Interpreting results

- Empty associations and unresolved items are honest output, not errors: an
  explicit unknown is preferable to a misleading assignment.
- Any entry under suspicious patterns or validation failures deserves human
  review before trusting that part of the map.
- The summary describes one generated map; it does not prove feature
  coverage is complete.

## Limitations

- The evaluator reports on the map; it does not improve semantic coverage.
- Suspicious-pattern detectors reuse the existing merge/router policy
  vocabulary — they flag candidates for review, not verdicts.
- `canonical-report.json` embeds input paths, so it is excluded from the
  `--rerun` byte comparison (everything else must be identical).
