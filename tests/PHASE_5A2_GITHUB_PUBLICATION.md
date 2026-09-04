# Phase 5A2 — GitHub Publication Preparation

**Date:** 2026-09-04
**Goal:** a complete GitHub project a new developer can understand, install, uninstall,
contribute to, and report against — with honest private-beta status and zero semantic
changes. Nothing was published (no npm, no GitHub release, no push).

---

## 1. Executive summary

The repository was already productized (Phase 5A: unified CLI, package 0.5.0, honest
README) but was not a GitHub project: no templates, no CI, no contribution/security/
conduct/changelog files, no docs tree — and the README still implied `npx codeatlas`
works, which it does not (nothing is published). This phase turned the repository into a
discoverable GitHub project: README expanded to the full GitHub entry-point role,
five docs guides, contribution + security + conduct + changelog files, four issue
templates, a PR template, an offline CI workflow, and a docs test suite extended from 21
to **80 tests** pinning the honesty contract (npm unavailability, flows absence,
uninstall accuracy, link integrity, template sanity). Suite: **284 tests / 73 suites /
0 failures**. Decisions D-031/D-032 recorded. Release remains **blocked pending owner
license confirmation**; the workflow is now fully prepared for the owner to open the
public repository and recruit the private-beta cohort.

## 2. Audit findings (Phase 1, before edits)

- Git clean at `dcac375` (Phase 5A), tag `v0.4.0-core-verified`; **no remote**, no
  `.github/`, no `docs/`.
- `README.md`: `npx codeatlas ./my-app` implied npm availability (false); maturity said
  "194-test" suite (stale, now 284); no uninstall/troubleshooting/contribution/security/
  roadmap sections.
- CLI verified: `--version` 0.5.0; `--help` correct; bad path/file/option/output → exit 1
  with clear messages; `--output` to an existing *file* → `EEXIST`, exit 1.
- Artifacts verified against a real run: canonical six, markdown five, plus
  `evidence/manifest.json` (collector's repository manifest — this is the "manifest.json"
  of the model; no top-level manifest exists), `investigation/manifest.json`,
  `structural/manifest.json`. INDEX.md is the query index (name/alias lookup,
  technical→canonical mapping, file navigation, unresolved, relationships).
- No network usage in `src/`/`bin/` (only regex patterns used to classify analyzed text)
  — the "no network/telemetry/external model" claim is verified, then stated.
- `flows` absent from generated artifacts but present in `schemas/flow.schema.json` +
  `templates/FLOW.template.md` — "part of the model, not generated" is accurate.
- DECISIONS.md at D-030 → next IDs D-031/D-032 used.

## 3. Files created

- `docs/installation.md` — checkout + tarball install; npm-registry explicitly
  unavailable; verification, smoke run, failure table, permissions, clean-install.
- `docs/uninstallation.md` — global (npm link) / local tarball / checkout removal;
  output cleanup; "never touches shell configuration"; verification.
- `docs/usage.md` — invocation, custom output, reading the map, features/systems/
  relationships/query index, ambiguity, evidence/provenance, agent workflow, the
  bug-report walkthrough, question lists (reliable vs not-yet).
- `docs/private-beta.md` — beta rationale, participant profile, tasks, feedback
  questions, redaction rules, anonymization, submission workflow (Issues; private
  channel honestly stated as not configured), copyable checklist, sample report.
- `docs/release-readiness.md` — completed / verified / pending owner decisions /
  pending beta feedback / blocked-from-public-release tables.
- `CONTRIBUTING.md` — philosophy, contribution areas, setup, test/smoke/CLI validation,
  safety rules, fixture/test/docs workflows, determinism, zero-deps, ambiguity
  preservation, progress/decisions updates, commit style (existing Conventional Commits),
  PR/review expectations, do-not-change-without-discussion list; branch naming
  recommended (not enforced).
- `SECURITY.md` — read/write surfaces, secret caveat (analyzed secrets land in local
  output), no network/telemetry/external model (verified), vulnerability reporting with
  **no invented channel** ("none configured" stated), accidental-exposure process.
- `CODE_OF_CONDUCT.md` — Contributor Covenant 2.1; enforcement contact honestly absent.
- `CHANGELOG.md` — Unreleased (planned-only) + 0.5.0 (added/validated/limitations);
  no unreleased work described as completed.
- `.github/ISSUE_TEMPLATE/bug_report.yml` (version/Node/OS/install/stack/size/command/
  expected/actual/logs/artifact-or-stage/reproducible/redaction),
  `feature_request.yml` (problem/workaround/proposal/why/affected/alternatives/
  semantic-model-schema-impact), `private_beta_feedback.yml` (anonymized repo,
  install/CLI/runtime/features/systems/relationships/docs/names/gaps/agent/confusing/
  valuable/limitation/recommendation/quote-permission), `documentation.yml`.
- `.github/pull_request_template.md` — area/implementation/tests/docs/generated-output/
  determinism/source-safety/schema/ambiguity checklists + final checklist.
- `.github/workflows/ci.yml` — offline CI (see §13).

## 4. Files modified

- `README.md` — expanded (see §5); `npx` availability claim removed.
- `DECISIONS.md` — D-031 (GitHub documentation set), D-032 (CI) appended.
- `progress.md` — Phase 5A2 section, Completed entry, Next Step rewritten.
- `tests/docs/docs.test.js` — 21 → 80 tests (existing tests kept; flows filter
  generalized to an honest-absence filter reused repo-wide).

## 5. README improvements

New/rewritten sections: What it is (with the five example requests); Why it exists; For
humans and agents; **What it generates** (full artifact tree incl. `evidence/manifest.json`
+ per-artifact meanings + flows.json status + INDEX.md as query index + per-entity pages);
**Concepts** (features/systems/files/structural units/relationships/flows/evidence, with
the differences stated); **How it works** (8 stages in plain language); **Design principles
and trust model** (deterministic/transparent/ambiguity-preserving/source-safe/no external
model); **What CodeAtlas does not claim to do**; **Current maturity** (private beta,
ProjectDock/CinePrint validation, 225→284-suite reality, unfamiliar-repo gap, license
blocker); Installation (checkout/tarball; npm-unavailable stated prominently); Usage;
Uninstallation; Source safety; Troubleshooting (verified error messages); Limitations;
Supported/tested repositories (ProjectDock, CinePrint — no invented URLs); Contributing;
Issue reporting; Private-beta feedback; Security and privacy; Roadmap; Citing;
Further reading; License (provisional, release blocked). The stale "194-test" claim was
corrected. No badges, no images.

## 6. Installation / uninstallation documentation

- Installation states Node ≥ 18 (matches `engines`), zero runtime deps, no OS/network
  requirements; two real paths (checkout incl. `npm link` option; `npm pack` tarball);
  **npm registry explicitly not available** with the exact failure modes; verification
  steps (`--version`, `--help`, smoke run); `.codeatlas/` explanation; failure table
  (verified messages incl. `EEXIST` for a file-as-output); permissions; clean-install.
- Uninstallation: `npm link` removal, tarball `npm uninstall`, checkout deletion, output
  deletion (`rm -rf .codeatlas`), safety statements (never writes sources, never edits
  shell config), `.gitignore` guidance for analyzed repos (not automatic), verification
  commands, and the explicit note that uninstalling does not delete generated docs.

## 7. Contribution workflow

CONTRIBUTING.md covers all requested areas (validation, CLI UX, docs, tests, semantic
accuracy, naming, ambiguity, performance, DX, generated-doc quality), dev setup, full +
focused + smoke + CLI validation commands, artifact inspection, repo-safety rules,
test/fixture/doc contribution guides, determinism rules, zero-dependency rule,
ambiguity-preservation rule, progress/decision-record updates, the repository's actual
commit style (Conventional Commits, scope omitted — two real examples quoted), PR and
review expectations, and the seven do-not-change-without-discussion items. Branch naming
is labeled **recommended**, not enforced.

## 8. Issue templates

Four YAML forms under `.github/ISSUE_TEMPLATE/` (bug/feature/private-beta/doc) covering
every required field; redaction checkboxes in bug + private-beta templates; the feature
template asks explicitly whether the semantic model or public output schema changes.

## 9. Pull-request template

`.github/pull_request_template.md`: summary, motivation, affected area, implementation,
tests run, docs changes, generated-output changes, determinism, source safety, schema
impact, ambiguity/evidence behavior, sample output, and the final checklist (tests pass,
no secrets, no evidence caches, docs updated, no unrelated files, public behavior
explained).

## 10. Private-beta feedback workflow

docs/private-beta.md: rationale, participant profile, what to test (install → run →
inspect), 8 suggested tasks (locate feature/system, trace relationship, investigate a
bug, suspicious file, race vs normal search, agent test, unresolved review), the full
feedback-question list, must-not-submit list (private/proprietary code, credentials,
env files, customer/personal data, private URLs, unredacted logs), anonymization
guidance, submission via GitHub Issues with the private channel **explicitly not
configured**, a compact copyable checklist, and a sample anonymized report. Participant
recruitment itself is left to the owner (Phase 5B), as instructed.

## 11. Security / privacy guidance

SECURITY.md documents what is read (whole analyzed repo, read-only), what is written
(output dir only), the honest caveat that secrets inside an analyzed repo end up in the
local generated output (with rotation-then-delete guidance), verified no-network/
telemetry/external-model claims, vulnerability reporting with the private channel
declared **not configured** (no invented address), and accidental-exposure handling.

## 12. License status

MIT confirmed as the package license; copyright unchanged ("CodeAtlas contributors",
2026); **provisional status documented in README, CHANGELOG, release-readiness, and
pinned by tests**. Public release is blocked pending owner confirmation; ownership was
not altered.

## 13. GitHub metadata and CI status

- Templates + PR template + workflow added under `.github/`; no funding/other files.
- **CI** (`.github/workflows/ci.yml`): Node 18 (engines floor), offline: full `npm test`;
  CLI contract (`--help`, `--version` == package.json, bad-path exit non-zero);
  `npm pack --dry-run` whitelist guard (no tests/fixtures/evidence in tarball);
  fixture smoke run asserting the summary line, byte-identical rerun determinism, and
  no `.codeatlas` inside the analyzed copy. **No publish step, no secrets.**
- Badges: none (no fake badges). No release links, no npm links.

## 14. Tests run and results

- Full suite: **284 tests / 73 suites / 0 failures** (225 at Phase 5A end + 59 new
  repository-check tests; pre-existing tests unmodified except the generalized
  flows-absence filter in the README test).
- New coverage: GitHub files present; YAML form sanity (name/description/body, no tabs);
  required field checks per template; local markdown-link resolution across 13 docs
  files; flows honesty across 8 docs; npm-unavailability in README + installation;
  uninstall accuracy (no shell-config claims, no global-npm claim); installation vs
  `package.json` (engines, tarball versions == pkg version); changelog accuracy;
  security accuracy (incl. no email regex hit); CI sanity (engines floor, no publish).
- No test was weakened; no protected artifact touched.

## 15. CLI smoke results

`--version` → `0.5.0`; `--help` correct; failure paths exit 1 with clear messages;
smoke runs on fixture copies: smoke-react-app → `done — 2 features, 0 systems, 0
ambiguous, 0 unresolved/demoted`; smoke-python-cli → honest `0 features, 0 systems, …
1 unresolved/demoted`; analyzed fixture copies unchanged.

## 16. npm pack results

`codeatlas-0.5.0.tgz`: 54 files / 111.9 kB package — **0 test/fixture/evidence files**
(checked programmatically).

## 17. Determinism results

Fixture-scale reruns byte-identical (`diff -r canonical` clean on both fixtures); the
CI workflow codifies the same check. Protected 4C.x artifacts untouched.

## 18. Repository integrity results

Working tree contained only intentional changes before commit; `tests/evidence-cache/`
untouched and gitignored; no package tarballs committed; no target repositories touched;
existing tags/commits preserved (no history rewrite).

## 19. Remaining blockers before public GitHub release

1. **Owner confirms/replaces the provisional MIT license** (D-027) — hard blocker.
2. **Repository URL** — create the public repository, then add `package.json` `repository`
   + real changelog links (deliberately absent until a real URL exists).
3. **Private channels** — configure a monitored security-reporting channel (and, if
   desired, a private feedback channel); both are honestly declared absent.
4. **Private beta not yet run** — semantic claims rest on two validated repositories.
5. npm publication / GitHub release — maintainer-only, after 1–4.

## 20. Recommended next steps

1. Owner: confirm or replace the MIT license (`LICENSE` + `license` field only).
2. Owner: create the public GitHub repository; add the real URL (`repository` metadata,
   changelog links, README clone example); configure the security channel; push.
3. Owner: recruit the 3–5 developer cohort using `docs/private-beta.md` +
   `.github/ISSUE_TEMPLATE/private_beta_feedback.yml` (Phase 5B — not started here).
4. Collect feedback; only then decide semantic priorities.

## Separation of concerns

- **Completed:** documentation set, templates, CI, tests, decision/progress records.
- **Verified:** test suite (284/0), npm pack contents, determinism, source safety,
  link integrity, claim honesty.
- **Owner decisions required:** license, repository URL, private channels, release timing.
- **Future private-beta work:** cohort recruitment, friction capture, feedback triage.
- **Intentionally not done:** npm publish, GitHub release, push, semantic changes,
  LLM dependency, invented URLs/badges/contacts/benchmarks.

STOP after Phase 5A2.
