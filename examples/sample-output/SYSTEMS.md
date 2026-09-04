# Systems — Sample Project

> Generated from `.codeatlas/systems.json` — do not edit manually.
> Last generated: 2026-05-28

This document describes cross-cutting architectural systems that support one or more user-visible features.

## Summary

| # | System | Confidence | Primary File |
|---|--------|------------|--------------|
| 1 | Poster Persistence System | high | `src/systems/poster-sync/PosterSyncEngine.ts` |
| 2 | User Authentication | high | `src/systems/auth/AuthClient.ts` |

---

## System Details

### poster-persistence-system — Poster Persistence System
**Confidence:** `high`

**Description:**
> Cross-cutting system that stores, retrieves, and reconciles saved poster state across reloads and devices.

**Technical role:**
> Manages local persistence, cache rehydration, and sync reconciliation for saved poster metadata.

**Semantic role:**
> Keeps saved artwork reliably available when the user expects it.

**Primary files:**
- `src/systems/poster-sync/PosterSyncEngine.ts`
- `src/systems/poster-sync/posterStore.ts`

**Supporting files:**
- `src/features/saved-posters/useSavedPosters.ts`

**Supported features:**
- `saved-posters-list`
- `poster-detail-availability`

**Related systems:**
- `user-authentication`

**External dependencies:**
- local persistence
- sync queue

**Aliases:**
- offline caching
- saved poster cache
- synced persistence

**Keywords:**
- saved
- poster
- cache
- sync

**Evidence:**
- `import` — List UI depends on the sync-aware hook owned by this system. (file: `src/features/saved-posters/SavedPosterList.tsx`, symbol: useSavedPosters)
- `manual_observation` — Multiple features rely on the same persistence and rehydration logic, justifying a system boundary. (file: `src/systems/poster-sync/PosterSyncEngine.ts`, symbol: PosterSyncEngine)

**Notes:**
- This system was added in Phase 2C because a shared capability explains behavior across features better than component-level file grouping.

---

### user-authentication — User Authentication
**Confidence:** `high`

**Description:**
> Cross-cutting system for login, session handling, and authenticated requests.

**Technical role:**
> Manages credentials, token refresh, and authenticated API transport.

**Semantic role:**
> Lets recognized users access personalized content reliably.

**Primary files:**
- `src/systems/auth/AuthClient.ts`
- `src/store/authStore.ts`

**Supporting files:**
- `src/hooks/useAuth.ts`

**Supported features:**
- `saved-posters-list`

**Related systems:**
- `poster-persistence-system`

**External dependencies:**
- auth provider
- refresh endpoint

**Aliases:**
- login system
- session management

**Keywords:**
- auth
- session
- login

**Evidence:**
- `api_usage` — Poster persistence often runs within an authenticated context. (file: `src/systems/auth/AuthClient.ts`, symbol: refreshSession)

---

## How to Use This File

- **For agents (impact mode):** When a file belongs to a system, trace impact across all features that system supports.
- **For humans:** Use system boundaries to understand why a single file change may affect multiple screens.
- **Confidence:** Verify low-confidence systems before using them as the primary explanation for a cross-feature symptom.

## Generation Notes

- Source of truth: `.codeatlas/systems.json` validated against `schemas/system.schema.json`
- Systems are intentionally kept separate from features to preserve a clear semantic boundary between user-visible behavior and shared infrastructure.
