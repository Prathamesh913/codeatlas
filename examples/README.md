# Examples

## `sample-output/` — regenerated reference output

Regenerated from the current pipeline on 2026-09-04:

```bash
codeatlas tests/fixtures/smoke-react-app --output <dir>
```

then copied from `<dir>/canonical/*.json` and `<dir>/markdown/`.
`systems.json` is `[]` and `unresolved.json` is `[]` here — the honest result for a
micro-repo (see `minimal/`). The obsolete pre-4B.2 sample (with `flows.json`,
`FEATURE_MAP.md`, `SYSTEMS.md`) was removed: the pipeline does not generate flows,
and projection filenames are `INDEX.md`, `features/<id>.md`, `systems/<id>.md`,
`unresolved.md`, `ARCHITECTURE.md`.

## `minimal/` — the five-minute walkthrough

Command invocation, output directories, one feature, one relationship, one
uncertainty example, and one evidence example — all quoted verbatim from real
pipeline output. Start there.
