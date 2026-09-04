# Feature Map — Sample Project

> Generated from `.codeatlas/features.json` — do not edit manually.
> Last generated: 2026-05-28

This document maps user-visible features to implementation files, supporting systems, aliases, keywords, and evidence.

## Summary

| # | Feature | Location | Confidence | Primary File |
|---|---------|----------|------------|--------------|
| 1 | Saved Poster List | Saved tab within the main application layout | high | `src/features/saved-posters/SavedPosterList.tsx` |
| 2 | Poster Detail Availability | Poster detail screen | medium | `src/features/poster-detail/PosterDetailView.tsx` |
| 3 | Browse Home Feed | Home tab | high | `src/features/home/HomeFeed.tsx` |

---

## Feature Details

### saved-posters-list — Saved Poster List
**Confidence:** `high` | **Location:** Saved tab within the main application layout

**Description:**
> Visible collection where users browse and manage posters they have saved.

**User-visible purpose:**
> Let users quickly find and manage their saved posters.

**User interactions:**
- Open saved tab
- Scroll saved posters
- Open saved poster detail
- Remove saved poster

**Aliases:**
- saved artwork
- my posters
- poster collection

**Keywords:**
- saved
- poster
- collection

**Primary implementation:**
- `src/features/saved-posters/SavedPosterList.tsx`
- `src/features/saved-posters/useSavedPosters.ts`

**Supporting files:**
- `src/components/poster/PosterCard.tsx`
- `src/systems/poster-sync/PosterSyncEngine.ts`

**Related systems:**
- Poster Persistence System

**Evidence:**
- `route` — Application router maps the saved tab to SavedPosterList. (file: `src/app/router.tsx`, symbol: savedTabRoute)
- `import` — List consumes sync-aware saved-poster hook. (file: `src/features/saved-posters/SavedPosterList.tsx`, symbol: useSavedPosters)

**Notes:**
- User-visible feature; alias mapping improves natural-language lookup for non-technical requests.

---

### poster-detail-availability — Poster Detail Availability
**Confidence:** `medium` | **Location:** Poster detail screen

**Description:**
> Poster detail view that remains usable when data availability or sync state changes.

**User-visible purpose:**
> Let users continue viewing or restoring poster details even when availability is uncertain.

**User interactions:**
- Open poster detail
- See loading or degraded state if sync is pending
- Retry availability action

**Aliases:**
- poster availability
- missing poster details
- poster reload

**Keywords:**
- poster
- detail
- availability

**Primary implementation:**
- `src/features/poster-detail/PosterDetailView.tsx`

**Supporting files:**
- `src/systems/poster-sync/PosterSyncEngine.ts`

**Related systems:**
- Poster Persistence System

**Evidence:**
- `manual_observation` — During validation, the most plausible explanation for 'missing items after reload' involved availability logic rather than list UI alone. (file: `src/features/poster-detail/PosterDetailView.tsx`, symbol: PosterDetailView)

**Notes:**
- Confidence is medium because missing-item symptoms can originate from either UI filtering or sync behavior.

---

### browse-home-feed — Browse Home Feed
**Confidence:** `high` | **Location:** Home tab

**Description:**
> Scrollable home feed that surfaces featured posters and discovery content.

**User-visible purpose:**
> Let users discover new or featured posters without leaving the home experience.

**User interactions:**
- Open home tab
- Scroll feed
- Open poster from feed

**Aliases:**
- home screen
- homepage feed
- featured posters

**Keywords:**
- home
- feed
- featured

**Primary implementation:**
- `src/features/home/HomeFeed.tsx`

**Supporting files:**
- `src/components/poster/PosterCard.tsx`

**Evidence:**
- `route` — Router exposes the home feed as a top-level tab. (file: `src/app/router.tsx`, symbol: homeRoute)

---

## How to Use This File

- **For agents (lookup mode):** Match against `name`, `description`, `aliases`, and `keywords` first, then follow primary/supporting files and attached systems.
- **For humans:** Start with feature name or alias, then check evidence and confidence before changing implementation files.
- **For ambiguous cases:** Compare candidate features side-by-side using interactions and evidence instead of relying on filenames.

## Generation Notes

- Canonical source of truth: `.codeatlas/features.json`
- Relationships are documented in `.codeatlas/relationships.json` and summarized per-feature above.
