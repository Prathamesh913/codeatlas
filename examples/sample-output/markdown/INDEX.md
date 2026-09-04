# CodeAtlas Map Index

> Query index over the canonical JSON. Markdown is a projection — the JSON is
> the source of truth.

## Features (lookup by name)

| Name | Id | Confidence | Aliases |
|---|---|---|---|
| **Board** | `feature-board` | `low` | idea board |
| **Form** | `feature-form` | `medium` | add idea, add form, add forms |

## Systems (lookup by name)

| Name | Id | Confidence | Aliases |
|---|---|---|---|
| _None_ | | | |

## Technical name → canonical name

- `idea` → feature-board ("Board"))}
- `idea` → feature-form ("Form"))}
- `add` → feature-form ("Form"))}
- `click` → feature-form ("Form"))}
- `component` → feature-form ("Form"))}

## Files (navigation index)

| File | Relevance | Entities |
|---|---|---|
| `src/App.tsx` | application | feature-board |
| `src/components/IdeaForm.tsx` | application | feature-form |
| `src/lib/ideas.ts` | application | feature-board |
| `src/lib/storage.ts` | application | — |
| `tests/ideas.test.ts` | test | — |

## Unresolved / ambiguous / demoted

_None recorded._

## Relationships

- `feature-board` → `feature-form` (DEPENDS_ON)

## Flows

_No canonical flows exist; see ARCHITECTURE.md._
