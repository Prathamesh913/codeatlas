<!-- Thank you for contributing to CodeAtlas. Keep PRs focused; use this
     template so review can cover determinism, evidence behavior, and source
     safety — the things the test suite cannot fully check for you. -->

## Summary

<!-- One or two sentences: what does this PR do? -->

## Motivation

<!-- Why is this change needed? Link the issue if one exists. -->

## Affected area

<!-- Check all that apply: -->
- [ ] CLI (`bin/codeatlas.js`)
- [ ] Pipeline stage (evidence / annotation / structural / investigation / semantic / consolidation / canonical)
- [ ] Markdown projections (`src/project/`, `templates/`)
- [ ] Schemas / data contracts (`schemas/`)
- [ ] Tests
- [ ] Documentation (`README.md`, `docs/`, `SKILL.md`, examples)
- [ ] Repo meta (`.github/`, CI, packaging)

## Implementation details

<!-- How does it work? Include design-relevant details, not just the diff. -->

## Tests run

<!-- Paste the npm test summary (tests/suites/pass/fail) and any focused runs. -->

```text
(node --test summary here)
```

## Documentation changes

<!-- Docs updated together with behavior? README claims are pinned by tests/docs. -->

- [ ] README/docs updated
- [ ] SKILL.md updated (if the agent-facing contract changed)
- [ ] DECISIONS.md updated (if architecture/schema/CLI contract changed — next ID)
- [ ] progress.md updated (dated Completed entry)

## Generated-output changes

<!-- Does output differ? If yes: regenerate examples/ from the real pipeline and
     describe the expected diff. Fixture-scale sample below is worth more than
     screenshots. -->

- [ ] No output change
- [ ] Output changes intentionally (sample pasted below)

```text
(canonical sample / diff here, fixture scale)
```

## Determinism considerations

<!-- Same input, same output? No iteration-order, timestamp, or random data in
     deterministic artifacts? -->

- [ ] Deterministic (no new order/timestamp/random dependence in artifacts)
- [ ] N/A (no artifact-producing code changed)

## Source-repository safety

<!-- The analyzed repository is read-only — verified? -->

- [ ] No writes outside the output directory
- [ ] N/A (no runtime code changed)

## Schema or compatibility impact

<!-- Canonical JSON shapes, artifact names, exit codes, CLI options. -->

- [ ] None
- [ ] Intentional change (described above + DECISIONS.md entry)

## Ambiguity / evidence behavior

<!-- Unresolved/ambiguous entities and evidence trails must not be silently
     weakened. Resolutions must be evidence-backed, not threshold tweaks. -->

- [ ] Unchanged
- [ ] Changed intentionally (evidence-backed; described above)

## Checklist

- [ ] `npm test` passes (full suite, 0 failures)
- [ ] No secrets or private source code included
- [ ] No generated evidence caches included (`tests/evidence-cache/` is gitignored)
- [ ] Documentation is updated (README claims pinned by tests/docs)
- [ ] No unrelated files changed
- [ ] Public behavior is explained (this template, docs, and commit message)
