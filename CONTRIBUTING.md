# Contributing

Welcome. CodeAtlas is a deterministic, evidence-based codebase-mapping tool in
private beta. This guide explains how the repository works, how to test your work,
and what should not change without discussion.

## Project philosophy

- **Features are user-visible capabilities**; systems are cross-cutting
  architectural responsibilities. Files are implementation units — evidence, never
  entities on their own.
- **Ambiguity is preserved, never hallucinated.** Undecidable areas stay
  `unresolved`/`ambiguous` with recorded reasons; demotions are recorded, never
  silently deleted.
- **Naming is weaker evidence than behavior.**
- **Structural units are not automatically features or systems.**
- **Source repositories are read-only.**
- **Deterministic and reproducible** — same input, same output.
- **No external model runtime** — zero runtime dependencies, no LLM SDK, no network,
  no telemetry.

See [README.md](README.md), [SKILL.md](SKILL.md), and
[DECISIONS.md](DECISIONS.md) for the full model and decision record.

## Kinds of contributions that are useful

| Area | Examples |
|---|---|
| Unfamiliar-repository validation | run CodeAtlas on a repo of yours, report what's wrong |
| CLI usability | help text, error messages, progress output, exit codes |
| Documentation | clarity, accuracy, examples, usage guides |
| Test coverage | new fixtures, edge cases, determinism, immutability |
| Semantic accuracy | misnamed/misplaced entities, bad groupings |
| Naming quality | name candidates, alias coverage, technical-name handling |
| Ambiguity handling | resolution evidence, better unresolved reasons |
| Performance | scan time on large repositories (evidence-collector, graph build) |
| Developer experience | setup friction, scripts |
| Generated documentation quality | Markdown projections, INDEX.md query index |

## Development environment

```bash
git clone <repository-url> && cd codeatlas
node --version      # must be >= 18
npm test            # full suite; zero dependencies — no npm install needed
```

There is no build step.

## Running tests

```bash
npm test                          # full suite (unit, fixtures, stages, cli, docs)
npm run test:unit                 # focused: collectors/utils
npm run test:fixtures             # focused: end-to-end fixture runs
npm run test:projection           # focused: Markdown projections
npm run test:cli                  # focused: unified CLI (spawns the real executable)
npm run test:docs                 # focused: documentation consistency
```

Smoke tests:

```bash
rm -rf /tmp/atlas-smoke && cp -r tests/fixtures/smoke-react-app /tmp/atlas-smoke
node bin/codeatlas.js /tmp/atlas-smoke --output /tmp/atlas-smoke-map
# expect: "done — 2 features, 0 systems, ..." + output line
rm -rf /tmp/atlas-smoke /tmp/atlas-smoke-map
```

CLI validation:

```bash
node bin/codeatlas.js --help
node bin/codeatlas.js --version       # must equal package.json version
node bin/codeatlas.js /does/not/exist # expect exit 1, clear error
npm pack --dry-run                    # 54 files; no tests/fixtures/evidence
```

Inspecting generated artifacts: run against a fixture copy under `/tmp` (never the
fixture in-tree), then read `canonical/*.json` and `markdown/`.

## Repository safety rules while developing

- **Never modify target repositories.** Run against copies under `/tmp`, or use
  `--output` outside the analyzed repo.
- **Keep evidence-cache outputs isolated.** `tests/evidence-cache/` is gitignored —
  never commit it, never write into a tracked path.
- Generated output belongs in `gitignored` or temporary locations only.

## Adding tests

- Style: `node:test` + `node:assert/strict`, ESM imports, `describe/it`.
- Where: `tests/unit/` (collectors/utils), `tests/fixtures/` (end-to-end runs),
  stage directories (matching `src/`), `tests/cli/`, `tests/docs/`.
- Requirements: deterministic, no network, no external fixtures, source
  immutability asserted where relevant.

## Adding fixtures

- Small, hand-written, JavaScript/TypeScript or Python; tracked in `tests/fixtures/`.
- Name the directory after what it exercises (e.g. `smoke-react-app`).
- A fixture must include a matching end-to-end test asserting its expected
  canonical summary.

## Updating documentation

- README claims are pinned by `tests/docs/docs.test.js` — update both together.
- No `flows.json` promises, no npm-availability claims, no invented URLs, no
  universal-language or perfect-understanding claims.
- Examples under `examples/` must be regenerated from the real pipeline, never
  hand-edited.

## Making deterministic changes

Same input → same output. Avoid: iteration over `Set` without sorting, `Date.now()`
or random values in artifact content, timestamps in deterministic JSON (the
evidence manifest's `collected_at`/`duration_ms` are the only time-dependent
records and live outside canonical artifacts). Rerun the determinism check:
run twice on a fixture copy, diff `canonical/*.json` byte-for-byte.

## Avoiding external runtime dependencies

Zero-dependency is a design decision (D-011): use Node.js built-ins only. A new
`dependencies` entry requires discussion and a written justification in the PR.

## Preserving ambiguity instead of adding guesses

If your change makes an `unresolved`/`ambiguous` entry resolve, the resolution must
be **evidence-backed** (recorded in `unresolved.json` reasons, decision logs, or
VOI inspection) — not a threshold tweak to make counts look better. Tests pin that
unresolved areas are never silently omitted.

## Updating progress and decision records

- `progress.md` — the phase log; add a dated entry for your change under Completed.
- `DECISIONS.md` — record any change to architecture, schemas, CLI contract, or
  output contracts with the next available decision ID.
- `SKILL.md` — update when the agent-facing consumption contract changes.

## Commit message style

The repository uses **Conventional Commits** (scope omitted), e.g.:

```text
chore: establish verified Phase 4C.3 baseline
feat: private-beta productization foundation (Phase 5A)
docs: prepare GitHub project documentation
test: validate repository documentation and metadata
```

Use `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`. Subject ≤ 72 chars;
body only when the "why" isn't obvious.

## Pull requests and review

- Keep PRs focused; unrelated changes belong in separate PRs.
- All tests must pass (`npm test`), and documentation consistency tests must
  reflect your changes.
- Review covers: correctness, determinism, evidence/ambiguity behavior, source
  safety, schema impact, and documentation accuracy.
- Sample generated output (fixture scale) is more useful than screenshots.

Use the PR template (`.github/pull_request_template.md`). A lightweight branch
naming is **recommended** (no convention is enforced): `docs/<topic>`, `feat/<topic>`,
`fix/<topic>`.

## What should not change without discussion

- **Architecture rewrite** of the pipeline stages (validated core).
- **Adding an LLM/external model dependency** (D-011).
- **Silent schema changes** (`schemas/`, canonical JSON shapes) — data contracts
  are pinned by tests and examples.
- **Alter source repositories** under analysis, or the read-only guarantee.
- **Weakening integrity protections** or evidence isolation.
- **Removing unresolved/ambiguous entities** merely to make output look cleaner.
- **Publishing packages or releases** (npm/GitHub) — maintainer-only.
