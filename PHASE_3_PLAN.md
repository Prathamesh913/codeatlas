# Phase 3 — Minimal Automated Evidence Collection

## What Phase 3 Collects

Phase 3 is an **evidence collector**. It observes a codebase and records mechanically verifiable facts.

### Collected evidence:

1. **Repository metadata** — root path, detected languages, package/build files, framework clues, configuration files
2. **File inventory** — relative path, extension, file type, inclusion status
3. **Import/dependency evidence** — direct import relationships with source, target, resolution status
4. **Export/symbol evidence** — exported functions, classes, components, variables
5. **Entry point clues** — package.json scripts, main fields, common bootstrap files
6. **Configuration evidence** — environment variable names, external URLs, API hostnames

### What Phase 3 does NOT infer:

- Feature groupings
- System boundaries
- Semantic relationships
- User-visible behavior
- Architectural roles
- Component purpose from names
- Authentication, persistence, or any domain concept

A file named `auth.ts` is recorded as:
- path: `src/auth.ts`
- type: `TypeScript source`

NOT as:
- "This implements authentication"

## Supported Languages / Formats

| Language | Import extraction | Export/symbol extraction | Confidence |
|----------|-------------------|--------------------------|------------|
| TypeScript / JavaScript | ✅ ES module + CommonJS | ✅ named/default exports | high |
| Python | ✅ import/from | ✅ top-level def/class | high |
| JSON | ✅ package.json analysis | N/A | high |
| YAML/TOML/Config | ✅ metadata only | N/A | medium |

Framework detection is recorded as **evidence**, not conclusion.

## Output Structure

```
.codeatlas/evidence/
├── manifest.json          # Scan metadata, exclusions, summary
├── repository.json        # Repository-level metadata
├── files.json             # File inventory
├── imports.json           # Import relationships
├── symbols.json           # Exported symbols
├── entrypoints.json       # Entry point clues
└── config.json            # Config/dependency evidence
```

## Collection Pipeline

```
1. Validate target path
2. Discover files (respecting exclusion rules)
3. Classify file types
4. Collect repository metadata (package.json, config files)
5. Collect imports for supported source files
6. Collect exports/symbols for supported source files
7. Attempt import resolution for local modules
8. Collect entry point clues
9. Collect config evidence (env vars, URLs)
10. Write structured JSON
11. Validate output
12. Report summary
```

## Exclusion Rules

Excluded directories:
- `node_modules`, `.git`, `dist`, `build`, `coverage`, `__pycache__`, `.next`, `.cache`, `vendor`, `.venv`, `venv`

Every exclusion is recorded in `manifest.json` with reason.

## Failure Handling

- Unresolved imports preserved (not discarded)
- Parse failures logged per-file with confidence `low`
- Missing files referenced in imports marked `unresolved`
- Empty collections produce empty arrays (not null)

## Testing Strategy

### Fixture A — TypeScript/JavaScript
- Local imports (relative)
- External imports
- Named + default exports
- Unresolved import
- package.json with dependencies
- Environment variable reference

### Fixture B — Python
- import / from...import
- Local module relationship
- External dependency
- Top-level function + class
- `__main__` execution clue

### Fixture C — Exclusion Behavior
- node_modules-like directory
- build output
- normal source

## Explicit Non-Goals

- No AST parsing
- No semantic interpretation
- No feature/system/relationship generation
- No flow inference
- No embeddings or vector search
- No CLI framework
- No language server integration
- No tree-sitter
- No custom parser infrastructure
