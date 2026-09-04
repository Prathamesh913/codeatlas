# Private Beta Guide

How to test CodeAtlas on a real repository and give the feedback that decides what
happens next.

---

## Why the private beta exists

The semantic core is validated (two real repositories, 287-test suite, deterministic
reruns) — but *validated* is not the same as *useful everywhere*. The private beta
exists to learn, before any public release:

- whether the maps are actually **actionable** on repositories we have never seen;
- where the tool **misleads** (wrong names, bad groupings, forced ambiguity);
- what **friction** exists in install, CLI, and output reading;
- whether the output genuinely **helps AI coding agents** and humans.

Beta feedback names the concrete problems; semantic improvements are deferred until it
does.

## Who should test

Recommended participant profile:

- developers working in **unfamiliar codebases** (new job, inherited project, large
  monorepo corner);
- **AI coding-agent users** who navigate repositories through an agent;
- maintainers of **small-to-medium repositories** (roughly 50–5,000 files);
- developers using **Python, JavaScript, or TypeScript** (the best-covered
  languages today).

## What to test

1. Install CodeAtlas ([docs/installation.md](installation.md)) — from a checkout.
2. Run it against a repository of yours:
   ```bash
   node bin/codeatlas.js ./your-repo            # or --output ./map
   ```
   ⚠️ The analyzed repository is only read. If you spot any modification to it,
   that is a bug — report it immediately.
3. Inspect the output:
   - `markdown/INDEX.md` — query index (features by name, technical-name mapping,
     file navigation, unresolved list);
   - `markdown/features/<id>.md`, `markdown/systems/<id>.md` — per-entity docs;
   - `markdown/unresolved.md` — what could not be decided, and why;
   - `canonical/canonical-report.json` — per-run counts;
   - `canonical/features.json` etc. — source-of-truth JSON.

## Suggested tasks

Attempt these, and note where the map helped, hurt, or was absent:

1. **Locate a user-facing feature** you know exists ("the search page") — find it in
   `INDEX.md` by name or alias.
2. **Locate an authentication or data system** — `systems.json`/`systems/` pages.
3. **Trace a relationship** — pick an edge in `relationships.json`, verify it
   against the cited import in source.
4. **Investigate a bug report** — take a real recent bug ("X is broken"), find the
   feature/files through the map, compare with how you'd normally find them.
5. **Check a suspicious file** — is a file you don't recognize claimed by a feature?
   Is that grouping right?
6. **Compare with normal search** — for the same question, race the map against
   `grep`/IDE symbol search. Which was faster? Which was more trustworthy?
7. **Ask your AI agent** — give the agent `INDEX.md` + `SKILL.md` and a navigation
   question; did it avoid blind exploration?
8. **Read `unresolved.md`** — do the unresolved areas match your own uncertainty
   about those parts of the code, or did you expect them to resolve?

## What we are trying to learn

The feedback questions (mirrored in the
[private-beta issue template](../.github/ISSUE_TEMPLATE/private_beta_feedback.yml)):

- Installation friction; CLI discoverability; clarity of output.
- Runtime and performance.
- Accuracy of feature identification; accuracy of system identification.
- Quality of names and descriptions.
- Relationship usefulness.
- Handling of ambiguity; handling of unresolved entities.
- False positives; missing features.
- Over-grouping (unrelated files grouped); under-grouping (one capability split).
- Helpfulness for AI coding agents; helpfulness for human developers.
- Whether generated documentation is actionable.
- Whether the output builds trust.
- Whether evidence/provenance is understandable.
- What would make you use CodeAtlas again.

## What you must NOT submit

- private source code; proprietary code;
- credentials, API keys, environment files;
- customer data; personal data;
- private repository URLs;
- unredacted logs containing sensitive paths, names, or secrets.

Describe your repository by **language/framework and size**, never by name or URL.

## How to anonymize logs and screenshots

- Redact paths: replace the repository root with `./repo`, home with `~`.
- Replace private entity/file names with `[feature]`, `[file]` where the *name* is
  the sensitive part and the *behavior* is the point.
- For screenshots: crop to the map output only (never include source code side by
  side), and blur names if needed.
- Prefer structured quotes (`id`, `confidence`, `reason`) over pasted logs.

## How to submit feedback

- **GitHub Issues** — the
  [private-beta template](../.github/ISSUE_TEMPLATE/private_beta_feedback.yml)
  (preferred), or the
  [bug template](../.github/ISSUE_TEMPLATE/bug_report.yml) for defects.
- **Private channel** — none is currently configured. If the repository owner sets
  one up (contact address or form), this section will say so explicitly; until
  then, please use GitHub Issues with redaction.

## Compact feedback checklist (copyable)

```markdown
- Repository: <language/framework>, ~<N> files (no name/URL)
- Install: <smooth | minor friction | friction | failed> — <what happened>
- CLI: <clear | mostly clear | confusing>
- Runtime: <seconds | acceptable | too slow> on ~<N> files
- Features: <useful | mixed | not useful> — example: <entity id>
- Systems: <useful | mixed | not useful | none generated>
- Relationships: <useful | mixed | not useful>
- Generated docs: <actionable | mixed | not actionable>
- Names: <understandable | mixed | technical>
- Missing capabilities: <what + entity/file behavior>
- Wrong groupings: <what + entity id>
- Ambiguity/unresolved: <appropriate | inappropriate> — <which entries>
- Confusing output: <what + entity id>
- Most valuable result: <one thing>
- Biggest limitation: <one thing>
- Agent-tested: <yes/slightly/no/not tested> — <what the agent did better>
- Would use again: <yes/with reservations/no>
- Anonymized quote permission: <yes/no>
```

## Sample anonymized feedback report

```markdown
- Repository: TypeScript + React (frontend app), ~350 files
- Install: minor friction — expected `npx codeatlas` to work; docs say checkout/tarball only
- CLI: clear — progress lines and summary were easy to follow
- Runtime: seconds on ~350 files
- Features: useful — `feature-auth` matched the real login page and files
- Systems: mixed — expected a "poster" system on the media tab; got none
- Relationships: useful — followed one DEPENDS_ON edge to its import; was correct
- Generated docs: actionable — `features/[feature].md` pointed at the right files
- Names: mixed — two infrastructure pages kept technical names (aliases helped)
- Missing capabilities: the settings dialog was not on the map
- Wrong groupings: one unrelated test file appeared next to `[feature]` (file index only)
- Ambiguity/unresolved: appropriate — `unresolved-[area]` matched my own uncertainty
- Confusing output: the "technical name" section conflated two aliases to one entity
- Most valuable result: the file navigation index narrowed a search to 3 files
- Biggest limitation: the map missed the settings dialog
- Agent-tested: yes — the agent went straight to the implementing files
- Would use again: with reservations
- Anonymized quote permission: yes
```
