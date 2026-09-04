# CodeAtlas

**Semantic maps of your codebase — so humans and AI coding agents find the right code faster.**

Private beta · v0.5.0 · not yet on npm

CodeAtlas scans a repository once and builds a persistent, evidence-backed map:
user-visible **features**, cross-cutting **systems**, the **files** that implement
them, the **relationships** between them, and readable Markdown documentation — while
preserving ambiguity instead of inventing answers.

## The problem

`grep` finds text. Symbol search finds names. Dependency graphs find imports. None of
them answers the questions you actually ask:

- "Where is the carousel implemented?"
- "Which files handle authentication?"
- "What depends on saved posters?"
- "Where should I investigate this bug?"
- "Which files implement project creation?"

In an unfamiliar codebase, answering any of these means re-deriving the map by hand —
every time. CodeAtlas derives it once, records its evidence, and admits what it could
not decide.

## What it produces

A run writes to `<repository>/.codeatlas` (or `--output <directory>`) and never
modifies your sources:

- **`features.json`** — user-visible capabilities, with names, aliases, files, and evidence
- **`systems.json`** — cross-cutting responsibilities shared by multiple regions
- **`files.json`** — the file → entity navigation index
- **`relationships.json`** — directed edges, each backed by an observed import (never co-location)
- **`unresolved.json`** — what CodeAtlas could not decide, why, and what would resolve it
- **`markdown/`** — `INDEX.md` query index, per-feature and per-system pages, `ARCHITECTURE.md`

Full artifact reference: [docs/output-format.md](docs/output-format.md).
Concepts and trust model: [docs/concepts.md](docs/concepts.md).

## Example (real output)

From the bundled `smoke-react-app` fixture ([examples/](examples/)):

```json
{
  "id": "feature-board",
  "name": "Board",
  "description": "Covers the idea and board part of the interface.",
  "confidence": "low",
  "aliases": ["idea board"],
  "primary_files": ["src/App.tsx"]
}
```

```json
{ "source": "feature-board", "target": "feature-form",
  "relationship_type": "DEPENDS_ON", "confidence": "low" }
```

`feature-board` depends on `feature-form`, backed by an observed import from
`src/App.tsx` to `src/components/IdeaForm.tsx`. The `low` confidence is deliberate:
the map states its uncertainty instead of hiding it. A micro-repo resolves zero
systems — `[]` is a valid, honest answer.

## Quick start

Node.js ≥ 18. Zero runtime dependencies. **Not published on npm** —
`npm install codeatlas` / `npx codeatlas` **do not work yet**; install from a checkout:

```bash
git clone https://github.com/Prathamesh913/codeatlas.git
cd codeatlas
node bin/codeatlas.js ./my-app              # writes ./my-app/.codeatlas
# or redirect everything: node bin/codeatlas.js ./my-app --output ./map
```

Open `my-app/.codeatlas/markdown/INDEX.md` to start browsing. The CLI contract is
`codeatlas <repository-path> [--output <directory>]` plus `--help` and `--version`
(the bare `codeatlas` command comes from a tarball install; from a checkout use
`node bin/codeatlas.js`).

Details: [installation](docs/installation.md) · [usage](docs/usage.md) ·
[uninstallation](docs/uninstallation.md)

## How it helps during an investigation

1. A user reports: "the add-idea form doesn't submit."
2. Search the map — the technical term `add` maps to `feature-form ("Form")`.
3. `features.json` gives the primary files (e.g. `src/components/IdeaForm.tsx`).
4. `relationships.json` shows `feature-board` DEPENDS_ON `feature-form`, with the
   cited import edge.
5. Read those two files — not the whole repository.
6. Fix and validate.

AI agents do the same: resolve entities by id, follow relationships to their cited
import edges, treat `unresolved` as "verify in source", then edit code. See
[docs/usage.md](docs/usage.md) and [SKILL.md](SKILL.md).

## Status and limitations

- **Private beta.** Validated on two real repositories (ProjectDock, CinePrint);
  unfamiliar-repository validation is still in progress.
- Results are evidence-backed but not perfect — check `confidence` and
  `unresolved.md` before acting. Ambiguous and unresolved entities are preserved on
  purpose, not hidden.
- `flows.json` is part of the model but not currently generated (no call-chain
  evidence yet).
- Strongest on JavaScript/TypeScript and Python; other languages produce sparse maps.
- The analyzed repository is **never modified**; reruns are deterministic.
- MIT license is provisional pending owner confirmation — public release is blocked
  until then. Not on npm; no GitHub release yet.
- Full status: [docs/release-readiness.md](docs/release-readiness.md).

## Documentation

| | |
|---|---|
| [docs/installation.md](docs/installation.md) | install, verify, troubleshooting |
| [docs/usage.md](docs/usage.md) | reading the map, relationships, agent workflow |
| [docs/uninstallation.md](docs/uninstallation.md) | removing CodeAtlas and generated output |
| [docs/concepts.md](docs/concepts.md) | features, systems, evidence, trust model |
| [docs/output-format.md](docs/output-format.md) | artifacts and pipeline stages |
| [docs/private-beta.md](docs/private-beta.md) | testing CodeAtlas and giving feedback |
| [docs/release-readiness.md](docs/release-readiness.md) | completed vs pending vs blocked |
| [CONTRIBUTING.md](CONTRIBUTING.md) · [SECURITY.md](SECURITY.md) | contributing · reporting a vulnerability |
| [CHANGELOG.md](CHANGELOG.md) · [DECISIONS.md](DECISIONS.md) | version history · decision record |
| [examples/](examples/) | real generated sample + minimal walkthrough |

## Contributing and feedback

- Bug reports and feature requests: the
  [issue templates](.github/ISSUE_TEMPLATE/bug_report.yml).
- Private-beta testers: [docs/private-beta.md](docs/private-beta.md) and the
  [feedback template](.github/ISSUE_TEMPLATE/private_beta_feedback.yml).
- Please do not submit private source code, secrets, or unredacted logs — see
  [SECURITY.md](SECURITY.md).

## License

MIT — see [LICENSE](LICENSE). The license choice is **provisional** and requires
owner confirmation before public release. Until then, reference the project as
"CodeAtlas 0.5.0 (private beta)".
