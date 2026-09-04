# CodeAtlas Tests — Phase 1

This directory will hold validation and tests for CodeAtlas.

## Phase 1 (Foundation) — No Automated Test Suite Yet

Phase 1 is definition-only: schemas, templates, and sample data. No scanner or CLI exists to unit-test.

### Validation performed manually in Phase 1

1. **JSON Schema validation** — Each file in `examples/sample-output/*.json` is validated against its schema in `schemas/*.schema.json` using `jsonschema` (draft-07) via a one-off Python script.
   ```bash
   pip install jsonschema
   python3 -c "
   import json, jsonschema, pathlib
   for name in ['feature','file','relationship','flow']:
       schema=json.load(open(f'schemas/{name}.schema.json'))
       # sample files hold arrays — validate each entry
   "
   ```
   See `progress.md` Validation section for results.

2. **Cross-reference checks** — Verified in sample data:
   - Every `feature.primary_files` / `supporting_files` has a matching entry in `files.json`.
   - Every `file.features` references an existing `feature.id`.
   - Every `relationship.source` / `target` references an existing `feature.id` or `file.path`.
   - Every `flow.involved_features` / `involved_files` references existing entities.
   - At least one shared file (`src/hooks/useCarousel.ts`) is used by multiple features.
   - At least one `confidence` is not `high` (`medium` and `low` examples exist).

3. **Template rendering check** — `examples/sample-output/FEATURE_MAP.md` and `ARCHITECTURE.md` were rendered from the JSON following `templates/*.template.md` structure, then reviewed for human readability and agent navigability.

### Future tests (Phase 2+)

When the scanner and CLI are built, this directory will contain:

- `tests/test_schemas.py` — schema validation of generated `.codeatlas/` output.
- `tests/test_cross_references.py` — graph consistency checks.
- `tests/test_lookup.py` — lookup ranking tests against sample queries.
- `tests/test_impact.py` and `tests/test_flow.py` — impact and flow correctness.
- Fixture projects under `tests/fixtures/` (minimal React/Vue/Next apps) to run `scan` against.

No dependencies are required for Phase 1; Phase 2 will add `jsonschema` and a test runner (e.g., `pytest`) as dev dependencies only.
