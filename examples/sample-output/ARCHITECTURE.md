# Architecture Overview — Sample Project

> Generated from `.codeatlas/features.json`, `systems.json`, `files.json`, `relationships.json`, and `flows.json`.
> Last generated: 2026-05-28

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

Sample Project is a poster discovery and personalization app where users browse featured content, manage saved posters, and depend on consistent persistence behavior across reloads and devices.

---

## 3. Distinctions

| Concept | Meaning | Example |
|---|---|---|
| Feature | User-visible or user-meaningful capability | Saved Poster List |
| System | Shared architectural capability supporting features | Poster Persistence System |
| Supporting File | Implementation detail without its own user-visible concept | `PosterCard.tsx` |

> Features describe what the user experiences. Systems describe what the architecture enables.

---

## 4. Key Systems

| System | Confidence | Primary File | Supported Features |
|---|---|---|---|
| Poster Persistence System | high | `src/systems/poster-sync/PosterSyncEngine.ts` | `saved-posters-list`, `poster-detail-availability` |
| User Authentication | high | `src/systems/auth/AuthClient.ts` | `saved-posters-list` |

See `SYSTEMS.md` and `.codeatlas/systems.json` for full details.

---

## 5. Feature Map Summary

| Feature | Location | Confidence | Primary File |
|---|---|---|---|
| Saved Poster List | Saved tab within the main application layout | high | `src/features/saved-posters/SavedPosterList.tsx` |
| Poster Detail Availability | Poster detail screen | medium | `src/features/poster-detail/PosterDetailView.tsx` |
| Browse Home Feed | Home tab | high | `src/features/home/HomeFeed.tsx` |

---

## 6. Key Relationships

| Source | Relationship | Target | Description | Confidence |
|--------|--------------|--------|-------------|------------|
| saved-posters-list | DEPENDS_ON | poster-persistence-system | The visible list depends on the persistence system for saved state correctness | high |
| poster-detail-availability | DEPENDS_ON | poster-persistence-system | Poster detail availability depends on the persistence system for reload behavior | medium |
| poster-persistence-system | DEPENDS_ON | user-authentication | Poster persistence often runs in an authenticated context | medium |
| src/features/saved-posters/useSavedPosters.ts | SUPPORTS | saved-posters-list | Hook supports UI consumption of the persistence system | high |
| src/components/poster/PosterCard.tsx | SUPPORTS | browse-home-feed | Shared PosterCard supports the home feed feature | high |
| browse-saved-posters | DEPENDS_ON | poster-persistence-system | Flow correctness depends on the persistence system | high |

> Canonical relationship graph: `.codeatlas/relationships.json`

---

## 7. Cross-Layer Navigation

- **Lookup** uses features, aliases, and keywords to locate the most relevant concept first.
- **Impact** traverses relationships across features, systems, and files.
- **Flow** explains behavior across UI components and shared infrastructure.

---

## 8. Flows Overview

| Flow | Trigger | Systems | Files | Confidence |
|------|---------|---------|-------|------------|
| Browse Saved Posters (`browse-saved-posters`) | User taps Saved tab | `poster-persistence-system`, `user-authentication` | `SavedPosterList.tsx`, `useSavedPosters.ts`, `PosterSyncEngine.ts` | high |

See `.codeatlas/flows.json` for preconditions, outcomes, branches, and evidence.

---

## 9. Confidence and Evidence

- Confidence markings indicate interpretation strength.
- `evidence` fields show why an entity or relationship exists.
- Use evidence when verifying ambiguous systems, flows, or features before editing.

---

## 10. Lookup Example

**User says:** "The saved artwork collection is missing items after reload."

**Map resolution:**
- Saved Poster List (high)
- Poster Detail Availability (medium)
- Poster Persistence System (high)

This points investigation beyond a single UI file and into shared persistence behavior.

---

## Generation Notes

- Canonical source of truth is `.codeatlas/*.json`.
- This Markdown is a human-readable projection, not a second source of truth.
