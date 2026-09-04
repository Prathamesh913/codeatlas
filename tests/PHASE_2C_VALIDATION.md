# Phase 2C Model Revision Validation

## Evidence Used

### Phase 2A — ProjectDock Validation
- Semantic mapping successfully narrowed natural-language investigation.
- User-first feature descriptions were critical for matching real requests.
- Feature/file dual navigation worked well.
- Flows helped trace multi-file behavior.
- Evidence/provenance was missing.
- Aliases/keywords were missing.
- Ambiguity and no-match were handled only by convention.
- Failure modes and degraded behavior needed richer representation.

### Phase 2B — CinePrint Validation
- Semantic mapping generalized beyond the first codebase.
- Feature boundaries sometimes needed to stay separate from UI components.
- Shared/cross-cutting systems emerged as meaningful architectural concepts.
- One system could support multiple features.
- Misleading filenames could be corrected through semantic interpretation.
- UI implementation noise could be excluded from feature focus.
- Complex state/data/service relationships needed explicit representation.
- The model needed a formal distinction between systems and user-visible features.

---

## Changes Made

### 1. Added first-class System entity

**Problem:**  
Some important concepts were neither user-visible features nor individual files.

**Evidence:**  
CinePrint identified shared systems; ProjectDock implied shared capabilities without a formal entity.

**Model change:**  
Added `schemas/system.schema.json` and `systems.json` as a canonical entity type.

**Backward compatibility impact:**  
Additive only. Existing feature/file/relationship/flow data remains valid without systems.

---

### 2. Extended Feature schema with aliases and keywords

**Problem:**  
User language did not reliably match feature names or implementation terminology.

**Evidence:**  
Both ProjectDock and CinePrint showed natural-language mismatches.

**Model change:**  
Added optional `aliases` and `keywords` to `feature.schema.json` (and optionally to systems/flows).

**Backward compatibility impact:**  
None. New fields are optional.

---

### 3. Added optional inline evidence/provenance

**Problem:**  
The map had no structured way to explain why a relationship or classification existed.

**Evidence:**  
Both validation runs requested explicit provenance.

**Model change:**  
Added optional `evidence` arrays to features, systems, relationships, and flow steps.

**Backward compatibility impact:**  
None. Evidence is optional and inline.

---

### 4. Updated relationship conventions to cover system edges

**Problem:**  
Relationships needed to connect features, systems, files, and flows without creating separate schemas.

**Evidence:**  
CinePrint showed system-to-feature and system-to-file edges; ProjectDock showed feature/file edges.

**Model change:**  
Kept the generic `source/target/relationship_type` model and clarified usage in `SKILL.md`.

**Backward compatibility impact:**  
None. Existing relationships remain valid; new edges are now explicitly allowed.

---

### 5. Added flow-step enrichment for branches and preconditions

**Problem:**  
Flows sometimes needed degraded paths, failure branches, and explicit preconditions/outcomes.

**Evidence:**  
Both validation runs surfaced silent exclusions, retry behavior, and availability edge cases.

**Model change:**  
Added optional `preconditions`, `outcomes`, `branches`, and `evidence` to `flow.schema.json` steps.

**Backward compatibility impact:**  
None. All additions are optional.

---

### 6. Clarified feature/system/supporting-file boundaries in SKILL.md

**Problem:**  
Feature creation risked becoming a component naming exercise rather than a semantic one.

**Evidence:**  
CinePrint showed that UI components should not automatically become features.

**Model change:**  
Updated `SKILL.md` with explicit boundary rules and examples.

**Backward compatibility impact:**  
None. This is a behavioral/documentation update.

---

### 7. Formalized lookup resolution states

**Problem:**  
Lookup behavior for ambiguous and no-match cases was undefined.

**Evidence:**  
ProjectDock showed the need for explicit ambiguity handling.

**Model change:**  
Updated `SKILL.md` to define `exact_match`, `likely_match`, `ambiguous_match`, and `no_match`.

**Backward compatibility impact:**  
None.

---

## ProjectDock Compatibility

Revised model can represent ProjectDock findings:

- Existing features → valid with or without new optional fields.
- Files and relationships → unchanged.
- Flows → still valid; branches and evidence can be added later if desired.
- Aliases/keywords → optional enrichment for lookup.
- Evidence → optional provenance without invalidating existing maps.

Conclusion: **compatible**.

---

## CinePrint Compatibility

Revised model can represent CinePrint findings:

- Multiple features → still supported.
- Shared systems → now representable via `systems.json`.
- Cross-cutting auth/data/state relationships → representable via systems and relationship edges.
- Misleading filenames → clarified via semantic roles, aliases, evidence, and explicit system ownership.
- 72 indexed files → remain valid in `files.json`.

Conclusion: **compatible**.

---

## Schema Validation

Confirmed:

- All schemas remain valid JSON and valid JSON Schema draft-07.
- Examples conform to revised schemas.
- Required references resolve.
- Entity relationships are valid.
- New fields remain optional.
- Canonical JSON remains source of truth; Markdown remains projection.

---

## Explicitly Deferred Ideas

The following ideas were intentionally **not** implemented in Phase 2C:

- Scanner implementation
- CLI implementation
- AST parsing
- Static analysis engine
- Synchronization implementation
- Embeddings
- Vector search
- NLP pipeline
- Mandatory line-level evidence
- Full failure/error graph modeling
- External services inventory file
- Markdown as a second source of truth

---

## Decision

Is the semantic model now ready for Phase 3 — Minimal Automated Evidence Collection?

**YES**

Reasons:

- The model now includes systems, aliases/keywords, and optional evidence without breaking Phase 1/2 compatibility.
- Lookup behavior is formally defined for match, ambiguity, and no-match.
- Flows can now represent branches/preconditions/outcomes when evidence supports them.
- The model remains simple, flat-file friendly, and inspectable.
