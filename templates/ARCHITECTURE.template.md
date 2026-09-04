# Architecture Overview — {{project_name}}

> Generated from `.codeatlas/features.json`, `systems.json`, `files.json`, `relationships.json`, and `flows.json`.
> Last generated: {{generated_at}}

## 1. Conceptual Model

```
Evidence (optional)
    ↓
Features ─────┐
Systems ──────┼── Relationships ── Files
Flows ────────┘
```

- **Features** = user-visible capabilities
- **Systems** = cross-cutting architectural capabilities
- **Files** = implementation units
- **Relationships** = directed semantic edges
- **Flows** = behavioral sequences

---

## 2. Project Purpose

{{project_purpose}}

---

## 3. Distinctions

| Concept | Meaning | Example |
|---|---|---|
| Feature | User-visible or user-meaningful capability | Saved Poster List |
| System | Shared architectural capability supporting features | Offline Persistence System |
| Supporting File | Implementation detail without its own user-visible concept | `PosterGridCell.tsx` |

> Features describe what the user experiences. Systems describe what the architecture enables.

---

## 4. Key Systems

| System | Confidence | Primary File | Supported Features |
|---|---|---|---|
| {{system.name}} | {{system.confidence}} | `{{system.primary_files[0]}}` | {{system.supported_features}} |

See `SYSTEMS.md` and `.codeatlas/systems.json` for full details.

---

## 5. Feature Map Summary

| Feature | Location | Confidence | Primary File |
|---|---|---|---|
| {{feature.name}} | {{feature.location_context}} | {{feature.confidence}} | `{{feature.primary_files[0]}}` |

---

## 6. Key Relationships

| Source | Relationship | Target | Description | Confidence |
|--------|--------------|--------|-------------|------------|
| {{relationship.source}} | {{relationship.relationship_type}} | {{relationship.target}} | {{relationship.description}} | {{relationship.confidence}} |

> Canonical relationship graph: `.codeatlas/relationships.json`

---

## 7. Cross-Layer Navigation

- **Lookup** uses features, aliases, and keywords to locate the most relevant concept first.
- **Impact** traverses relationships across features, systems, and files.
- **Flow** explains behavior across implementation and shared infrastructure.

---

## 8. Flows Overview

| Flow | Trigger | Files | Confidence |
|------|---------|-------|------------|
| {{flow.name}} (`{{flow.id}}`) | {{flow.trigger}} | {{flow.involved_files}} | {{flow.confidence}} |

See `flows/*.md` and `.codeatlas/flows.json` for step-by-step traces.

---

## 9. Confidence and Evidence

- Confidence markings indicate interpretation strength.
- `evidence` fields indicate why an entity or relationship exists.
- Use evidence when verifying ambiguous systems, flows, or features before editing.

---

## 10. Lookup Example

**User says:** "The saved artwork collection is missing items after reload."

**Map resolution:**
- Saved Poster List (high)
- Poster Cache Sync (medium)
- Related systems: Offline Persistence System

This avoids blind code search and points directly to UI + system layers.

---

## Generation Notes

- Canonical source of truth is `.codeatlas/*.json`.
- This Markdown is a human-readable projection, not a second source of truth.
