# Release Readiness

Honest status of what is completed, verified, pending, and blocked — so nobody mistakes
private-beta state for public-release state.

---

## Status

**Private beta.** The semantic core is validated; the product foundation is in place;
GitHub project documentation is complete. **A public release is not claimed and is
blocked** on owner decisions and beta feedback.

## Completed

- Semantic pipeline (Phase 4C.0–4C.3): Collector v2 → Annotation → Structural graph →
  Investigation → Semantic resolution → Consolidation → Canonical JSON → Markdown
  projections. Deterministic, evidence-based, ambiguity-preserving, read-only on
  analyzed repositories, zero runtime dependencies.
- Real-repository validation on **ProjectDock** and **CinePrint**; byte-identical
  canonical artifacts across reruns.
- Git baseline (`20c33a9`, tag `v0.4.0-core-verified`) and Phase 5A productization
  (`dcac375`): unified CLI, package metadata (0.5.0), `files` whitelist, README/SKILL/
  examples regeneration, DECISIONS.md (D-001…D-030).
- GitHub project documentation (this phase): README expansion, install/uninstall/usage
  guides, private-beta kit, contributing workflow, issue/PR templates, SECURITY.md,
  Code of Conduct, CI workflow, changelog.

## Verified

- **287 tests / 74 suites / 0 failures** (semantic core + CLI + docs, incl.
  3 canonical-repository-URL consistency tests).
- CLI contract: `--help`, `--version` (matches `package.json`), exit 0/1, bad-path and
  bad-output failures with clear messages.
- `npm pack --dry-run`: 54 files, **no tests/fixtures/evidence-cache content**.
- Determinism: fixture-scale and real-repo reruns byte-identical.
- Source safety: analyzed fixtures/repositories unchanged (asserted by tests and
  validation runs).

## Pending owner decisions

1. **License confirmation** — MIT was chosen provisionally (D-027). The owner must
   confirm or replace it; public release is blocked until then.
2. **Private reporting channels** — no private security/vulnerability channel is
   configured (SECURITY.md says so explicitly); none exists for private feedback either.
   The owner must configure monitored channels before public release.
3. **Public release timing** — after 1–2, and after private-beta feedback names (or
   clears) concrete problems.

Resolved since this document was drafted: the public repository now exists
(`https://github.com/Prathamesh913/codeatlas`) and the real URL is wired into
`package.json` (`repository`, `bugs`), the README, CONTRIBUTING, and installation docs.

## Pending private-beta feedback

- Install/CLI friction on participant machines.
- Actionability of maps on unfamiliar repositories (JS/TS, Python, and beyond).
- Naming quality, groupings, ambiguity handling.
- Whether the output helps AI coding agents in real tasks.
- Anything that misleads — the highest-priority feedback class.

## Blocked from public release

| Blocker | Why | Unblocks |
|---|---|---|
| License confirmation | owner decision (D-027) | owner confirms/replaces MIT |
| No private security channel | SECURITY.md interim process | monitored channel configured |
| Private beta not run | semantic claims rest on 2 validated repos | feedback collected, acted on |
| npm publication | maintainer-only, after blockers | not before license + beta |

## Explicitly not done (intentional)

- No npm publication, GitHub release, or push to GitHub (explicitly out of scope).
- No semantic architecture changes (deferred until beta feedback names a problem).
- No flows extraction, no natural-language lookup (deferred by decision).
- No invented URLs, badges, benchmarks, testimonials, or contact addresses.
