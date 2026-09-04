# File Index — {{project_name}}

> Generated from `.codeatlas/files.json` — do not edit manually. Regenerate via `codeatlas sync` or `codeatlas scan`.
> Last generated: {{generated_at}}

This document provides a semantic index of relevant files. Each file is described by both its technical role and its human-facing purpose.

## Summary Table

| Path | Type | Semantic Role | Features | Confidence |
|------|------|---------------|----------|------------|
| `{{file.path}}` | {{file.type}} | {{file.semantic_role}} | {{file.features}} | {{file.confidence}} |

---

## File Details

### `{{file.path}}`
**Type:** `{{file.type}}`

**Technical role:**
> {{file.technical_role}}

**Semantic role (what the user experiences):**
> {{file.semantic_role}}

**Features implemented / supported:**
{{#each file.features}}
- `{{this}}`
{{/each}}

**Imports:**
{{#each file.imports}}
- `{{this}}`
{{/each}}

**Imported by:**
{{#each file.imported_by}}
- `{{this}}`
{{/each}}

**External dependencies:**
{{#each file.dependencies}}
- `{{this}}`
{{/each}}

**Notes:**
{{#each file.notes}}
- {{this}}
{{/each}}

---

## How to Use This File

- **For agents (impact mode):** Given a file path (e.g., `src/hooks/useCarousel.ts`), find its entry here, check `features` and `imported_by` to determine blast radius.
- **For humans:** Search by file path or by feature to understand why a file exists and what breaks if it changes.
- **Types** are generic: `component`, `page`, `hook`, `store`, `service`, `utility`, `style`, `config`, `data`. New types can be added without schema changes.

## Generation Notes

- Source of truth: `.codeatlas/files.json` validated against `schemas/file.schema.json`
- This index covers only files relevant to user-visible features; build tooling and generated files are intentionally excluded.
