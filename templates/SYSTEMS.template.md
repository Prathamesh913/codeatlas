# Systems — {{project_name}}

> Generated from `.codeatlas/systems.json` — do not edit manually. Regenerate via `codeatlas sync` or `codeatlas scan`.
> Last generated: {{generated_at}}

This document describes cross-cutting architectural systems that support one or more user-visible features.

## Summary

| # | System | Confidence | Primary File |
|---|--------|------------|--------------|
| 1 | {{system.name}} | {{system.confidence}} | `{{system.primary_files[0]}}` |

---

## System Details

### {{system.id}} — {{system.name}}
**Confidence:** `{{system.confidence}}`

**Description:**
> {{system.description}}

**Technical role:**
> {{system.technical_role}}

**Semantic role:**
> {{system.semantic_role}}

**Primary files:**
{{#each system.primary_files}}
- `{{this}}`
{{/each}}

**Supporting files:**
{{#each system.supporting_files}}
- `{{this}}`
{{/each}}

**Supported features:**
{{#each system.supported_features}}
- `{{this}}`
{{/each}}

**Related systems:**
{{#each system.related_systems}}
- `{{this}}`
{{/each}}

**External dependencies:**
{{#each system.external_dependencies}}
- {{this}}
{{/each}}

**Aliases:**
{{#each system.aliases}}
- {{this}}
{{/each}}

**Keywords:**
{{#each system.keywords}}
- {{this}}
{{/each}}

**Evidence:**
{{#each system.evidence}}
- `{{this.type}}` — {{this.description}} (file: `{{this.file}}`, symbol: {{this.symbol}})
{{/each}}

**Notes:**
{{#each system.notes}}
- {{this}}
{{/each}}

---

## How to Use This File

- **For agents (impact mode):** Use system boundaries to understand blast radius across multiple features.
- **For humans:** Distinguish between user-visible features and shared infrastructure that may explain cross-feature behavior.
- **Confidence:** Verify low or ambiguous systems before refactoring shared capabilities.

## Generation Notes

- Source of truth: `.codeatlas/systems.json` validated against `schemas/system.schema.json`
- Systems are intentionally separate from features to prevent user-visible concepts from being diluted by infrastructure.
