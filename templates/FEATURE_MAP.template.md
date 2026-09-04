# Feature Map — {{project_name}}

> Generated from `.codeatlas/features.json` — do not edit manually. Regenerate via `codeatlas sync` or `codeatlas scan`.
> Last generated: {{generated_at}}

This document maps user-visible features to implementation files and supporting systems.

## Summary

| # | Feature | Location | Confidence | Primary File |
|---|---------|----------|------------|--------------|
| 1 | {{feature.name}} | {{feature.location_context}} | {{feature.confidence}} | `{{feature.primary_files[0]}}` |

---

## Feature Details

### {{feature.id}} — {{feature.name}}
**Confidence:** `{{feature.confidence}}` | **Location:** {{feature.location_context}}

**Description:**
> {{feature.description}}

**User-visible purpose:**
> {{feature.user_visible_purpose}}

**User interactions:**
{{#each feature.user_interactions}}
- {{this}}
{{/each}}

**Primary implementation:**
{{#each feature.primary_files}}
- `{{this}}`
{{/each}}

**Supporting files:**
{{#each feature.supporting_files}}
- `{{this}}`
{{/each}}

**Aliases:**
{{#each feature.aliases}}
- {{this}}
{{/each}}

**Keywords:**
{{#each feature.keywords}}
- {{this}}
{{/each}}

**Data dependencies:**
{{#each feature.data_dependencies}}
- {{this}}
{{/each}}

**State dependencies:**
{{#each feature.state_dependencies}}
- {{this}}
{{/each}}

**Related features:**
{{#each feature.related_features}}
- `{{this}}`
{{/each}}

**Evidence:**
{{#each feature.evidence}}
- `{{this.type}}` — {{this.description}} (file: `{{this.file}}`, symbol: {{this.symbol}})
{{/each}}

**Notes:**
{{#each feature.notes}}
- {{this}}
{{/each}}

---

## How to Use This File

- **For agents (lookup mode):** Match the user's natural-language request against `Feature.name`, `description`, `aliases`, and `keywords` before following file references.
- **For humans:** Browse by `location_context` to find where a UI element lives and which files to edit.
- **Confidence:** `low` / `unknown` means the mapping is inferred and should be verified before making changes.

## Generation Notes

- Source of truth: `.codeatlas/features.json` validated against `schemas/feature.schema.json`
- Relationships are documented in `.codeatlas/relationships.json` and summarized per-feature above.
