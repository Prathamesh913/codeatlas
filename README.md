# CodeAtlas — Agent-First Codebase Intelligence

CodeAtlas is a **semantic codebase navigation system** that translates human language into focused code investigation.

Instead of forcing an AI agent (or a new developer) to rediscover an entire repository, CodeAtlas maintains a **persistent semantic map**:

```
User Language
      ↓
Semantic Map (Features / Systems / Files / Relationships / Flows)
      ↓
Evidence-supported interpretation
      ↓
Focused Investigation
```

CodeAtlas is designed for **both** AI coding agents and human developers.

---

## The Problem

A user reports:

> "The saved artwork collection is missing items after reload."

The codebase may store that concept in:
- `SavedPosterList.tsx`
- `PosterCacheService.ts`
- `useSyncedCollection.ts`

A plain file index may find the words, but it cannot explain:
- which user-visible feature the user is talking about
- which shared system explains the missing behavior
- which files and flows are actually relevant

---

## Traditional Code Index vs. CodeAtlas

| Traditional Code Index | CodeAtlas Semantic Map |
|---|---|
| Finds names | Interprets meaning |
| Matches tokens | Matches concepts |
| Returns files | Returns features, systems, files, flows, and evidence |
| Assumes one label fits all uses | Separates user-visible features from cross-cutting systems |

---

## Core Conceptual Model

```
Evidence (optional)
    ↓
Features ─────┐
Systems ──────┼── Relationships ── Files
Flows ────────┘
```

### Feature
A user-visible or user-meaningful capability.

Example:
- Saved Poster List
- Featured Projects Carousel

### System
A cross-cutting architectural capability that supports one or more features.

Example:
- Authentication system
- Offline caching system

### File
An implementation unit.

### Relationship
A directed edge connecting entities.

### Flow
A behavioral sequence describing what happens when a user acts or a system event occurs.

### Evidence (optional)
Structured provenance explaining why the map believes a relationship or classification exists.

---

## How Lookup Works

A request such as:

> "The saved artwork collection is missing items after reload."

should resolve to candidates such as:

- **Saved Poster List** (high) — visible collection behavior
- **Poster Cache Sync** (medium) — possible backend/cache behavior

If no strong match exists, CodeAtlas returns:
- explicit uncertainty
- closest relevant entities
- clarification guidance

This avoids false confidence and reduces blind code searching.

---

## Current Status

**Phase 2C — Semantic Model Revision — complete.**

What exists:

- `SKILL.md` — mode definitions and behavioral rules
- `schemas/*.schema.json` — revised JSON Schema contracts, including `system.schema.json`
- `templates/*.template.md` — human-readable projection templates
- `examples/sample-output/` — revised JSON and rendered Markdown demonstrating features, systems, files, relationships, flows, aliases, keywords, and evidence
- `progress.md` — full decision history and validation record

What does **not** exist:

- Scanner
- CLI
- AST parser
- Static analysis engine
- Embeddings
- Vector search
- NLP pipeline
- Sync implementation

This is intentional.

---

## Project Structure

```
CodeAtlas/
├── SKILL.md
├── README.md
├── progress.md
├── schemas/
│   ├── feature.schema.json
│   ├── system.schema.json
│   ├── file.schema.json
│   ├── relationship.schema.json
│   └── flow.schema.json
├── templates/
│   ├── FEATURE_MAP.template.md
│   ├── SYSTEMS.template.md
│   ├── FILE_INDEX.template.md
│   ├── ARCHITECTURE.template.md
│   └── FLOW.template.md
├── examples/
│   └── sample-output/
│       ├── features.json
│       ├── systems.json
│       ├── files.json
│       ├── relationships.json
│       ├── flows.json
│       ├── FEATURE_MAP.md
│       ├── SYSTEMS.md
│       └── ARCHITECTURE.md
└── tests/
    └── README.md
```

---

## Data Principle

**JSON is canonical.**  
Markdown is generated or optional projection.

---

## Development Approach

CodeAtlas is developed incrementally.  
See `progress.md` for decisions, validation history, and the current phase before making changes.

> **Continuation rule:** Before starting Phase 3, read `progress.md`, inspect the current project state, and update `progress.md` with new decisions and validation.

---

## License

TBD.
