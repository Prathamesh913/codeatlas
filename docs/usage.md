# Usage

How to run CodeAtlas and actually use the map it generates — during a bug report, a
navigation question, or an AI coding task.

> The map is an **aid to investigation, not a substitute for reading source code**.
> Confidence and unresolved entries exist precisely so you know when to go verify.

---

## 1. Basic invocation

```bash
node bin/codeatlas.js <repository-path>          # output -> <repository-path>/.codeatlas
node bin/codeatlas.js <repository-path> --output ./map
```

From an installed package, the same thing is `codeatlas <repo>`. The run prints
per-stage progress and ends with a summary:

```text
codeatlas: done — 2 features, 0 systems, 0 ambiguous, 0 unresolved/demoted
codeatlas: output written to /path/to/map
```

Exit code 0 on success, 1 on failure. The analyzed repository is only read.

## 2. Custom output directory

`--output ./map` writes everything there instead of inside the analyzed repository.
Useful when the target repo is read-only for you, when you want the map out of version
control, or when comparing maps across runs/branches:

```bash
node bin/codeatlas.js ./my-app --output /tmp/maps/my-app
node bin/codeatlas.js ./my-app --output /tmp/maps/my-app-b    # another branch state
```

## 3. Reading the generated map

Start with `markdown/INDEX.md` — the query index. Real content (from the
`smoke-react-app` fixture):

```markdown
## Features (lookup by name)
| Name | Id | Confidence | Aliases |
|---|---|---|---|
| **Board** | `feature-board` | `low` | idea board |
| **Form** | `feature-form` | `medium` | add idea, add form, add forms |

## Files (navigation index)
| File | Relevance | Entities |
|---|---|---|
| `src/App.tsx` | application | feature-board |
| `src/components/IdeaForm.tsx` | application | feature-form |
| `tests/ideas.test.ts` | test | — |
```

- **Features (lookup by name)** — find the feature behind a UI name or alias.
- **Technical name → canonical name** — map a technical/UI term found in code
  (`idea`, `add`, `click`) to the canonical entity that owns it.
- **Files (navigation index)** — every file with its relevance class and the
  entities it serves. Test/generated files are listed but never anchor entities.
- **Unresolved / ambiguous / demoted** — what the pipeline could not decide; never
  silently omitted.
- **Relationships** — the semantic edges with their evidence.

`ARCHITECTURE.md` gives a whole-map overview; `features/<id>.md` and
`systems/<id>.md` give per-entity detail; `unresolved.md` lists every undecidable
area with the reason and what would resolve it.

The JSON under `canonical/` is the source of truth (stable ids for agents):
`features.json`, `systems.json`, `files.json`, `relationships.json`,
`unresolved.json`, `canonical-report.json`. Markdown is a projection of it.

## 4. Finding a feature

By name/alias, in `INDEX.md` or `canonical/features.json`:

```bash
grep -o '"name": "[^"]*"' .codeatlas/canonical/features.json
node -e 'const f=require("./.codeatlas/canonical/features.json").features;
console.log(f.map(x => `${x.id} "${x.name}" (${x.confidence}) -> ${x.primary_files.join(", ")}`).join("\n"))'
```

Each feature page (`markdown/features/<id>.md`) shows its description, aliases,
files, and the evidence trail behind the name.

## 5. Finding a system

Systems are cross-cutting responsibilities shared by multiple regions
(`canonical/systems.json`, `markdown/systems/<id>.md`). A micro-repo may have zero —
an empty `systems.json` (`[]`) is a valid, honest answer, not a failure.

## 6. Following relationships

`canonical/relationships.json` holds directed edges, each backed by an observed
import/structural edge:

```json
{ "source": "feature-board", "target": "feature-form", "relationship_type": "DEPENDS_ON",
  "confidence": "low",
  "evidence": [{ "edge": "e7", "file_from": "src/App.tsx", "file_to": "src/components/IdeaForm.tsx",
                 "observed": "file 'src/App.tsx' imports 'src/components/IdeaForm.tsx'" }] }
```

Follow `file_from` → `file_to` in source; the semantic edge is never invented from
co-location, but it is an interpretation — verify against the cited import edge.

## 7. Using the query index

`INDEX.md`'s **technical name → canonical name** section answers "I found the string
`add idea` in code — what entity is this?" Look the term up, get
`feature-form ("Form")`, then jump to `markdown/features/feature-form.md` for files
and evidence. Agents can query the same via `files.json`/`features.json` aliases.

## 8. Understanding ambiguity and unresolved entities

`canonical/unresolved.json` and `markdown/unresolved.md` list areas the evidence
could not decide — with the reason, the evidence consulted, competing
interpretations, and what would resolve them. Real example (from the
`consolidate-app` fixture):

```json
{ "id": "unresolved-parser", "status": "unresolved", "confidence": "unknown",
  "reason": "Neither feature (0) nor system (0) evidence crossed the resolution threshold.",
  "primary_files": ["src/parser.ts", "src/tools/parser.ts"] }
```

**Do not force a resolution.** An `unresolved` entry is the pipeline saying "verify
in source"; treat it as a lead, not a defect to grep away.

## 9. Understanding evidence and provenance

Every entity carries an `evidence` trail. `source` distinguishes observed facts from
interpretations:

- observed: `phase4a_graph` (import edges), raw clue captures;
- interpreted: `phase4b1_clue` (investigation), `phase4c2_consolidation` (merge/split
  decisions), `phase4c3_voi` (inspection/naming decisions).

```json
"evidence": [{ "source": "phase4b1_clue", "evidence_type": "ui",
               "file": "src/components/IdeaForm.tsx",
               "observed": "visible text \"Add Idea\"", "confidence": "high" }]
```

Check `confidence` (`high | medium | low | unknown`) before acting on an entity.

## 10. Using the map during an AI coding task

Give your agent:

1. the map location (`<repo>/.codeatlas/canonical/` + `markdown/INDEX.md`),
2. [SKILL.md](../SKILL.md) — the behavioral rules for consuming the map.

The agent should resolve entities by **id**, follow **relationships** to their cited
import edges, treat **unresolved** as "verify in source", and only then edit code.

## 11. Example workflow — user reports a bug

> "The add-idea form does not submit."

1. **Agent searches the map** — `INDEX.md`: the technical term `add` maps to
   `feature-form ("Form")`.
2. **Identifies the feature/system/files** — `features.json`: `feature-form` has
   `primary_files: ["src/components/IdeaForm.tsx"]`, confidence `medium`.
3. **Follows relationships** — `relationships.json`: `feature-board` DEPENDS_ON
   `feature-form`, backed by the import edge `src/App.tsx` →
   `src/components/IdeaForm.tsx`.
4. **Inspects source code** — reads the two files (the map narrowed the search from
   the whole repo to two files).
5. **Makes and validates a change** — edits the form handler, reruns the app/tests.

Without the map, step 1 is blind text search over the repository; with it, the agent
goes straight to the implementing files and the evidence that named them.

## 12. Questions CodeAtlas helps answer

- "Where is authentication handled?" → feature/system lookup.
- "Which files implement saved posters?" → technical-name → canonical lookup.
- "What code is involved in project creation?" → feature files + evidence.
- "What depends on this component?" → relationships (import-backed).
- "I found `submitPosterToNotion` in code — what user capability is this?" →
  technical-name mapping.

## 13. Questions it may not answer reliably yet

- Behavioral sequences across layers ("what happens when the user clicks submit?")
  — flows are part of the model but **not currently generated**.
- Intent behind generated code, or semantics of repositories outside
  JavaScript/TypeScript/Python (maps can be sparse there).
- Anything not grounded in observable source text/imports — CodeAtlas does not run
  the app.
