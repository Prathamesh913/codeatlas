# Minimal end-to-end example

Everything below is real output from the current pipeline — command invocation
included, so you can regenerate it any time with:

```bash
codeatlas tests/fixtures/smoke-react-app --output /tmp/idea-map
```

A 3-source-file React fixture (`App.tsx`, `components/IdeaForm.tsx`, `lib/ideas.ts`;
13 files total with tests) resolves to **2 features, 1 relationship, and no systems** —
which is the honest answer for a micro-repo: there is no shared cross-cutting
responsibility to report, and the map says so instead of inventing one.

## Generated output directory

```
idea-map/
├── canonical/
│   ├── features.json        # 2 canonical features
│   ├── systems.json         # [] — see "Where are the systems?" below
│   ├── unresolved.json      # [] for this fixture (see Uncertainty)
│   ├── relationships.json   # 1 relationship
│   ├── files.json           # file → entity index
│   └── canonical-report.json
└── markdown/
    ├── INDEX.md             # start here
    ├── features/feature-board.md
    ├── features/feature-form.md
    ├── unresolved.md
    └── ARCHITECTURE.md
```

## One feature: `feature-board` ("Board")

From `canonical/features.json` (abridged):

```json
{
  "id": "feature-board",
  "name": "Board",
  "description": "Covers the idea and board part of the interface. Its implementation lives in `src/App.tsx`.",
  "confidence": "low",
  "aliases": ["idea board"],
  "primary_files": ["src/App.tsx"],
  "evidence": [
    { "source": "phase4b1_clue", "evidence_type": "ui", "file": "src/App.tsx",
      "observed": "visible text \"Idea Board\"", "confidence": "high" }
  ]
}
```

Note the `low` confidence: the map states its uncertainty instead of hiding it.

## One relationship: Board DEPENDS_ON Form

From `canonical/relationships.json`:

```json
{
  "source": "feature-board",
  "target": "feature-form",
  "relationship_type": "DEPENDS_ON",
  "confidence": "low",
  "evidence": [{ "edge": "e7", "file_from": "src/App.tsx",
    "file_to": "src/components/IdeaForm.tsx",
    "observed": "file 'src/App.tsx' imports 'src/components/IdeaForm.tsx'" }]
}
```

The semantic edge is backed by an observed import edge — relationships are never
invented from co-location.

## Where are the systems?

This fixture resolves **zero systems**: nothing is shared by multiple regions, and a
system requires shared cross-cutting responsibility. On larger repositories the same
pipeline emits systems (e.g. a shared persistence or auth layer) into
`canonical/systems.json`, rendered as `markdown/systems/<id>.md`. An empty
`systems.json` (`[]`) is a valid, honest answer.

## Uncertainty example (from the `consolidate-app` fixture)

```bash
codeatlas tests/fixtures/consolidate-app --output /tmp/draft-map
```

resolves an area it cannot decide as `unresolved` rather than forcing it — from
`canonical/unresolved.json`:

```json
{
  "id": "unresolved-parser",
  "status": "unresolved",
  "confidence": "unknown",
  "reason": "Neither feature (0) nor system (0) evidence crossed the resolution threshold.",
  "primary_files": ["src/parser.ts", "src/tools/parser.ts"]
}
```

It also appears in `markdown/unresolved.md` and in `INDEX.md` under
"Unresolved / ambiguous / demoted" — unresolved areas are never silently omitted.

## Evidence example

Every entity carries its evidence trail. From `feature-form`:

```json
"evidence": [
  { "source": "phase4b1_clue", "evidence_type": "ui",
    "file": "src/components/IdeaForm.tsx",
    "observed": "visible text \"Add Idea\"", "confidence": "high" }
]
```

`sources` distinguish observed facts (`phase4a_graph`) from interpretations
(`phase4b1_clue`, `phase4c2_consolidation`, `phase4c3_voi`), so a reader can always
tell what the map *saw* from what it *decided*.
