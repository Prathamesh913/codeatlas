# CodeAtlas Concepts

What each entity in a CodeAtlas map means, how CodeAtlas treats uncertainty, and the
trust model behind the output. For how the map is produced, see
[output-format.md](output-format.md). For how to consume it, see [usage.md](usage.md).

---

## The concepts (and how they differ)

- **Feature** — a user-visible capability ("Search Artist", "Submit Poster"). Each has
  a description, aliases, files, and evidence.
- **System** — a cross-cutting architectural responsibility ("Auth", "Poster") shared
  by multiple regions. Not a feature; features can *depend on* systems.
- **File** — an implementation unit, linked to the features/systems it serves, with a
  relevance class. A file is evidence, never an entity on its own.
- **Structural unit** — a connected component of the implementation graph. Structural
  units are *not* automatically features or systems; they are the neutral starting
  points that investigation and consolidation interpret.
- **Relationship** — a directed semantic edge between entities (`USES`, `DEPENDS_ON`,
  `SUPPORTS`), backed by an observed import or structural edge. Never invented from
  co-location.
- **Flow** — a behavioral call-chain across layers. Part of the data model
  (`schemas/flow.schema.json`), but **not currently generated** — the pipeline has no
  call-chain evidence yet, and projections state this explicitly rather than
  fabricating flows.
- **Evidence** — recorded provenance for every decision: what was observed, in which
  file, at what confidence, from which pipeline stage. Observed facts
  (e.g. `phase4a_graph` import edges) and interpretations (`phase4b1_clue`,
  `phase4c2_consolidation`, `phase4c3_voi`) are distinguishable by `source`.

## Ambiguity is preserved, never hallucinated

Entities the evidence cannot decide stay `ambiguous` or `unresolved` with a recorded
reason, the evidence consulted, competing interpretations, and what would resolve
them. Nothing is forced into an interpretation, and demoted false positives are
recorded, not silently deleted. An empty or sparse answer (`"systems": []`) is a valid,
honest answer — not a failure.

## What CodeAtlas does not claim to do

- It does **not** claim perfect semantic understanding — names and boundaries are
  heuristic; check `confidence` and `unresolved.md` before acting on them.
- It does not generate `flows.json` (see above).
- It does **not** modify the analyzed repository's source files.
- It does **not** replace reading source code — the map is an aid to investigation.
- It does **not** run an external model, network service, or telemetry.

## Design principles and trust model

- **Deterministic** — same input, same output; reruns are byte-identical (asserted by
  tests). Confidence values are enums (`high | medium | low | unknown`), not scores.
- **Transparent** — every entity carries its evidence trail; naming is treated as
  weaker evidence than behavior.
- **Ambiguity-preserving** — undecidable areas stay unresolved with a reason;
  demotions are recorded, never silently deleted.
- **Source-repository-safe** — the analyzed repository is **never modified**: the
  pipeline only reads it, and all output goes to the output directory.
- **No external model runtime** — zero runtime dependencies, no LLM SDK, no network
  access, no telemetry. Investigation is deterministic and question-driven.

## Naming rules in brief

Canonical names come from user-facing and group-shared evidence where it exists;
where no user-facing text exists (e.g. infrastructure modules), behavior-derived
technical names are kept with technical provenance, and the original terms stay
searchable as aliases and `implementation_terms`. Renames, rejected candidates, and
naming evidence are recorded rather than overwritten.

## Current maturity

**Private beta / experimental.** The semantic core is validated on two real
repositories — **ProjectDock** and **CinePrint** — with a deterministic,
evidence-backed regression suite; validation on *unfamiliar* repositories is still
needed. See [release-readiness.md](release-readiness.md) for what is completed,
pending, and blocked.
