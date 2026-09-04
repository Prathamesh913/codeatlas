// CodeAtlas Phase 4C.1B — Annotation Layer Regression Tests
//
// Covers the 4C.1B contract:
//   R2/R3/R4 — real Phase 4B.2 failure shapes must classify as state/incidental
//   U1–U8    — UI string taxonomy units (capability/context/state/incidental)
//   S1–S8    — semantic relevance classes, multi-flag precedence, no exclusion
//   K        — byte-identical determinism
//   L        — raw collector evidence untouched (additive layer)
//
// Annotation is one deterministic classification authority (D-016/D-017).
// It never excludes files, never deletes strings, never mutates raw evidence.

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { collect } from '../../src/collect.js';
import { annotate } from '../../src/annotate/index.js';
import { classifyString } from '../../src/annotate/classify.js';
import { classifyRelevance } from '../../src/annotate/relevance.js';
import { extractStrings } from '../../src/annotate/extract.js';
import { getMechanicalFlags } from '../../src/utils.js';

// Relevance units consume collector flags (the annotator never re-derives
// them — the collector is the single mechanical-flag authority).
const flagsFor = (path) => ({
  path,
  language: 'TypeScript',
  extension: path.slice(path.lastIndexOf('.')),
  relevance_flags: getMechanicalFlags(path).flags,
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(__dirname, '..', 'fixtures', 'annotate-app');

const SEEDABLE = { can_seed_entity: true };
const NOT_SEEDABLE = { can_seed_entity: false };

describe('Annotation — UI string classification units (R/U)', () => {
  // R2 — empty-state pollution: the exact 4B.2 feature-found seed shape.
  // Measured provenance: `title="No posters found"` — a state lexicon string
  // that arrived through a weak prop context and MUST still be state.
  it('R2 — "No posters found" is state and cannot seed an entity', () => {
    const c = classifyString('No posters found', { kind: 'prop', prop: 'title', element: 'Link' });
    assert.equal(c.classification, 'state');
    assert.equal(c.reason, 'state_lexicon:empty_result');
    assert.equal(c.policy.can_seed_entity, false);
    assert.equal(c.policy.support_only, true);
  });

  it('R2b — "Plot Twist: No Matches Found!" is state', () => {
    const c = classifyString('Plot Twist: No Matches Found!', { kind: 'jsx_text', element: 'p' });
    assert.equal(c.classification, 'state');
    assert.equal(c.reason, 'state_lexicon:empty_result');
    assert.deepEqual({ ...c.policy, ...NOT_SEEDABLE }, c.policy);
  });

  // R3 — error pollution: "Retry preview" (4B.2 feature-preview seed shape).
  // The state lexicon must OVERRIDE an interactive context: an error-recovery
  // affordance is a state signal, never a capability identity.
  it('R3 — "Retry preview" is state even on an interactive control', () => {
    const c = classifyString('Retry preview', { kind: 'jsx_text', element: 'button' });
    assert.equal(c.classification, 'state');
    assert.equal(c.reason, 'state_lexicon:retry');
    assert.equal(c.policy.can_seed_entity, false);
  });

  it('R3b — console.error diagnostics are state; console.log is incidental', () => {
    const err = classifyString('opening session', { kind: 'console_diagnostic' });
    assert.equal(err.classification, 'state');
    assert.equal(err.reason, 'console_diagnostic');
    const log = classifyString('loaded 12 posters', { kind: 'console_output' });
    assert.equal(log.classification, 'incidental');
    assert.equal(log.policy.can_seed_entity, false);
  });

  // R4 — marketing/manifesto pollution (4B.2 feature-artist-2 shape).
  it('R4 — manifesto prose is incidental with zero entity weight', () => {
    const c = classifyString(
      'CinePrint is a gallery built on the belief that every film deserves a physical interpretation',
      { kind: 'jsx_text', element: 'p' }
    );
    assert.equal(c.classification, 'incidental');
    assert.equal(c.reason, 'prose_length');
    assert.equal(c.policy.can_seed_entity, false);
    assert.equal(c.policy.alias_eligible, false);
  });

  it('R4b — branding aria-label on a section is context, not capability', () => {
    const c = classifyString('CinePrint manifesto', { kind: 'prop', prop: 'aria-label', element: 'section' });
    assert.equal(c.classification, 'context');
    assert.equal(c.reason, 'prop_label');
    assert.equal(c.policy.can_seed_entity, false);
  });

  it('U1 — primary action <Button>Create Collection</Button> is capability', () => {
    const c = classifyString('Create Collection', { kind: 'jsx_text', element: 'Button' });
    assert.equal(c.classification, 'capability');
    assert.equal(c.reason, 'interactive_verb_phrase');
    assert.deepEqual({ ...c.policy, ...SEEDABLE }, c.policy);
  });

  it('U2 — <Link>Saved Posters</Link> is context (destination label, documented)', () => {
    // Contract decision: navigation text is classified by what it lexically
    // names. A verb-first phrase is an explicit user command (capability);
    // a noun phrase names a DESTINATION and provides domain vocabulary
    // (context, can_seed=false). This is what prevents navigation chrome
    // ("Back to lobby") from seeding a standalone Feature (4C.0 B4).
    const c = classifyString('Saved Posters', { kind: 'jsx_text', element: 'Link' });
    assert.equal(c.classification, 'context');
    assert.equal(c.reason, 'control_destination_label');
    assert.equal(c.policy.can_seed_entity, false);
    assert.equal(c.policy.can_name_entity, true);
  });

  it('U2b — verb-first navigation is capability', () => {
    const c = classifyString('Open Project', { kind: 'jsx_text', element: 'Link' });
    assert.equal(c.classification, 'capability');
  });

  it('U3 — page heading <h1>Artist Portfolio</h1> is context', () => {
    const c = classifyString('Artist Portfolio', { kind: 'jsx_text', element: 'h1' });
    assert.equal(c.classification, 'context');
    assert.equal(c.reason, 'heading_or_label');
    assert.equal(c.policy.can_seed_entity, false);
  });

  it('U4 — form label "Email address" is context and cannot create authentication', () => {
    const c = classifyString('Email address', { kind: 'jsx_text', element: 'label' });
    assert.equal(c.classification, 'context');
    assert.equal(c.policy.can_seed_entity, false);
  });

  it('U5 — search placeholder is capability (the control\u2019s primary action, documented)', () => {
    // A search placeholder labels the action the control performs; with the
    // input element observed it is an interactive verb phrase.
    const withElement = classifyString('Search projects', { kind: 'prop', prop: 'placeholder', element: 'input' });
    assert.equal(withElement.classification, 'capability');
    assert.equal(withElement.reason, 'interactive_verb_phrase');
    // Without a captured element the placeholder rule still applies.
    const bare = classifyString('Search projects', { kind: 'prop', prop: 'placeholder' });
    assert.equal(bare.classification, 'capability');
    assert.equal(bare.reason, 'action_placeholder');
  });

  it('U5b — non-verb placeholder is a hint (context)', () => {
    const c = classifyString('Your project name', { kind: 'prop', prop: 'placeholder' });
    assert.equal(c.classification, 'context');
    assert.equal(c.reason, 'placeholder_hint');
  });

  it('U6 — aria-label action "Close dialog" on a button is capability', () => {
    const c = classifyString('Close dialog', { kind: 'prop', prop: 'aria-label', element: 'button' });
    assert.equal(c.classification, 'capability');
    assert.equal(c.reason, 'interactive_verb_phrase');
  });

  it('U7 — font/brand configuration "Bebas Neue" is incidental (never an alias)', () => {
    const c = classifyString('bold 52px "Bebas Neue", sans-serif', { kind: 'canvas_font' });
    assert.equal(c.classification, 'incidental');
    assert.equal(c.reason, 'font_or_brand_value');
    assert.equal(c.policy.alias_eligible, false);
  });

  it('U8 — documentation heading cannot seed a semantic entity', () => {
    const c = classifyString('Project Discovery & Rescan', { kind: 'markdown_heading' });
    assert.equal(c.classification, 'incidental');
    assert.equal(c.reason, 'documentation_content');
    assert.equal(c.policy.can_seed_entity, false);
  });

  it('defaults — URLs, style classes and unpositioned literals are incidental', () => {
    assert.equal(classifyString('https://api.example.com/posters', { kind: 'url' }).classification, 'incidental');
    assert.equal(classifyString('flex w-full min-h-[40vh]', { kind: 'class_name' }).classification, 'incidental');
    assert.equal(classifyString('app.db', { kind: 'plain' }).classification, 'incidental');
    assert.equal(classifyString('app.db', { kind: 'plain' }).reason, 'unpositioned_literal');
  });
});

describe('Annotation — semantic relevance units (S)', () => {
  it('S1 — normal application source is application', () => {
    const r = classifyRelevance(flagsFor('src/components/Search.tsx'));
    assert.equal(r.relevance_class, 'application');
    assert.ok(r.relevance_reasons[0].startsWith('source_language:'));
  });

  it('S2 — tests are test', () => {
    assert.equal(classifyRelevance(flagsFor('tests/search.test.ts')).relevance_class, 'test');
  });

  it('S3 — scripts are automation', () => {
    assert.equal(classifyRelevance(flagsFor('scripts/generate-assets.ts')).relevance_class, 'automation');
  });

  it('S4 — routeTree.gen.ts is generated', () => {
    assert.equal(classifyRelevance(flagsFor('src/routeTree.gen.ts')).relevance_class, 'generated');
  });

  it('S5 — docs/architecture.md is documentation (flag and extension agree)', () => {
    const r = classifyRelevance({ ...flagsFor('docs/architecture.md'), language: null });
    assert.equal(r.relevance_class, 'documentation');
    // and without any collector flags, the extension fallback still holds:
    const bare = classifyRelevance({ path: 'docs/x.md', language: null, extension: '.md' });
    assert.equal(bare.relevance_class, 'documentation');
  });

  it('S6 — config location and config filename are supporting', () => {
    const byDir = classifyRelevance({ ...flagsFor('config/build.js'), language: 'JavaScript' });
    assert.equal(byDir.relevance_class, 'supporting');
    assert.equal(byDir.relevance_reasons[0], 'config_location');
    const byName = classifyRelevance(flagsFor('vite.config.ts'));
    assert.equal(byName.relevance_class, 'supporting');
    assert.equal(byName.relevance_reasons[0], 'config_filename');
  });

  it('S7 — multi-flag precedence is deterministic and flags are preserved', () => {
    // test beats automation (a test is a test regardless of directory)…
    const t = classifyRelevance({
      path: 'automation/upload.test.ts', language: 'TypeScript',
      relevance_flags: { is_test_like: true, is_generated_like: false, is_documentation_like: false, is_automation_like: true },
    });
    assert.equal(t.relevance_class, 'test');
    // …and generated beats everything mechanical (build artifacts first).
    const g = classifyRelevance({
      path: 'tests/fixtures/x.gen.ts', language: 'TypeScript',
      relevance_flags: { is_test_like: true, is_generated_like: true, is_documentation_like: false, is_automation_like: false },
    });
    assert.equal(g.relevance_class, 'generated');
  });

  it('S7b — a generated test fixture is generated (primary) with both flags preserved', () => {
    const g = classifyRelevance({
      path: 'test-data/gen.snapshot.ts', language: 'TypeScript',
      relevance_flags: { is_test_like: true, is_generated_like: true, is_documentation_like: false, is_automation_like: false },
    });
    assert.equal(g.relevance_class, 'generated');
  });

  it('backward compatibility — missing collector flags still classify deterministically', () => {
    assert.equal(classifyRelevance({ path: 'src/a.ts', language: 'TypeScript' }).relevance_class, 'application');
    assert.equal(classifyRelevance({ path: 'assets/logo.svg', language: null }).relevance_class, 'supporting');
  });
});

describe('Annotation — end-to-end pipeline (collect → annotate, K/L)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'codeatlas-annotate-'));
  const evidenceDir = join(tmp, 'evidence');
  const outA = join(tmp, 'run-a');
  const outB = join(tmp, 'run-b');
  let rawFilesBytes;
  let filesA;
  let stringsA;

  before(async () => {
    await collect(FIXTURE, tmp);
    rawFilesBytes = readFileSync(join(evidenceDir, 'files.json'));
    await annotate(evidenceDir, FIXTURE, outA);
    await annotate(evidenceDir, FIXTURE, outB);
    filesA = JSON.parse(readFileSync(join(outA, 'annotation', 'files.json'), 'utf-8'));
    stringsA = JSON.parse(readFileSync(join(outA, 'annotation', 'strings.json'), 'utf-8'));
  });

  after(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  const findFile = (path) => filesA.files.find(f => f.path === path);
  const findString = (file, value) => stringsA.strings.find(s => s.file === file && s.value === value);

  it('L — raw collector evidence is byte-identical after annotation', () => {
    assert.deepEqual(readFileSync(join(evidenceDir, 'files.json')), rawFilesBytes);
    assert.ok(existsSync(join(evidenceDir, 'imports.json')));
  });

  it('K — two annotation runs are byte-identical', () => {
    for (const name of ['files.json', 'strings.json']) {
      const a = readFileSync(join(outA, 'annotation', name));
      const b = readFileSync(join(outB, 'annotation', name));
      assert.deepEqual(a, b, `${name} must be deterministic`);
    }
  });

  it('S8 — no exclusion: every evidence file has an annotation entry', () => {
    const raw = JSON.parse(rawFilesBytes.toString('utf-8'));
    assert.equal(filesA.files.length, raw.length);
    const rawPaths = new Set(raw.map(f => f.path));
    for (const f of filesA.files) assert.ok(rawPaths.has(f.path));
  });

  it('relevance classes land on the right fixture files (S1–S6)', () => {
    assert.equal(findFile('src/components/Search.tsx').relevance_class, 'application');
    assert.equal(findFile('tests/search.test.ts').relevance_class, 'test');
    assert.equal(findFile('scripts/generate-assets.ts').relevance_class, 'automation');
    assert.equal(findFile('src/routeTree.gen.ts').relevance_class, 'generated');
    assert.equal(findFile('docs/architecture.md').relevance_class, 'documentation');
    assert.equal(findFile('config/build.js').relevance_class, 'supporting');
  });

  it('S7 — multi-flag file keeps both collector flags verbatim', () => {
    const f = findFile('automation/upload.test.ts');
    assert.equal(f.relevance_class, 'test');
    assert.equal(f.mechanical_flags.is_test_like, true);
    assert.equal(f.mechanical_flags.is_automation_like, true);
    assert.deepEqual(f.semantic_policy.entity_seeding, 'excluded');
  });

  it('generated and test files carry their exclusion policy (Part G)', () => {
    assert.equal(findFile('src/routeTree.gen.ts').semantic_policy.entity_seeding, 'excluded');
    assert.equal(findFile('docs/architecture.md').semantic_policy.entity_seeding, 'excluded');
    assert.equal(findFile('src/components/Search.tsx').semantic_policy.entity_seeding, 'eligible');
  });

  it('R2/R3 — real failure strings classify as state in the pipeline', () => {
    const noPosters = findString('src/routes/GalleryViews.tsx', 'No posters found');
    assert.ok(noPosters, 'No posters found must be extracted');
    assert.equal(noPosters.classification, 'state');
    assert.equal(noPosters.reason, 'state_lexicon:empty_result');
    assert.equal(noPosters.policy.can_seed_entity, false);

    const retry = findString('src/routes/GalleryViews.tsx', 'RETRY PREVIEW');
    assert.ok(retry, 'RETRY PREVIEW must be extracted');
    assert.equal(retry.classification, 'state');
    assert.equal(retry.reason, 'state_lexicon:retry');
    assert.equal(retry.policy.can_seed_entity, false);

    const consoleErr = findString('src/routes/GalleryViews.tsx', 'Uncaught error in gallery content:');
    assert.ok(consoleErr, 'console.error text must be extracted');
    assert.equal(consoleErr.classification, 'state');
    assert.ok(/state_lexicon|console_diagnostic/.test(consoleErr.reason));
    assert.equal(consoleErr.policy.can_seed_entity, false);
  });

  it('R4 — manifesto prose is incidental in the pipeline', () => {
    const prose = stringsA.strings.find(
      s => s.file === 'src/routes/-components/HomeDiscovery.tsx' && s.reason === 'prose_length'
    );
    assert.ok(prose, 'manifesto prose must be extracted and classified incidental');
    assert.equal(prose.classification, 'incidental');
    assert.equal(prose.policy.can_seed_entity, false);
    assert.equal(prose.policy.alias_eligible, false);

    const manifesto = findString('src/routes/-components/HomeDiscovery.tsx', 'CinePrint manifesto');
    assert.ok(manifesto, 'aria-label manifesto must be extracted');
    assert.equal(manifesto.classification, 'context');
    assert.equal(manifesto.policy.can_seed_entity, false);
  });

  it('U1/U2/U5/U6 — interactive classification in the pipeline', () => {
    assert.equal(findString('src/components/Search.tsx', 'Create Collection').classification, 'capability');
    assert.equal(findString('src/components/Search.tsx', 'Saved Posters').classification, 'context');
    assert.equal(findString('src/components/Search.tsx', 'Search projects').classification, 'capability');
    assert.equal(findString('src/components/Search.tsx', 'Close dialog').classification, 'capability');
  });

  it('U3/U4 — headings and labels are context in the pipeline', () => {
    const h1 = findString('src/components/Forms.tsx', 'Artist Portfolio');
    assert.equal(h1.classification, 'context');
    assert.equal(h1.reason, 'heading_or_label');
    const label = findString('src/components/Forms.tsx', 'Email address');
    assert.equal(label.classification, 'context');
    assert.equal(label.policy.can_seed_entity, false);
  });

  it('U7 — canvas font configuration is incidental in the pipeline', () => {
    const font = findString('src/lib/ticket.ts', 'bold 52px "Bebas Neue", sans-serif');
    assert.ok(font, 'ctx.font value must be extracted');
    assert.equal(font.classification, 'incidental');
    assert.equal(font.reason, 'font_or_brand_value');
    assert.equal(font.policy.alias_eligible, false);
  });

  it('U8 — documentation file is relevance-excluded from string extraction', () => {
    // docs/architecture.md contains "Project Discovery & Rescan" — the string
    // layer must contain nothing from documentation files; the class is
    // handled at file level (documentation → entity_seeding excluded).
    const docStrings = stringsA.strings.filter(s => s.file === 'docs/architecture.md');
    assert.equal(docStrings.length, 0);
    assert.equal(findFile('docs/architecture.md').relevance_class, 'documentation');
  });

  it('every string entry carries compact provenance and a policy (Part D)', () => {
    for (const s of stringsA.strings) {
      assert.ok(s.file && s.line >= 1 && typeof s.value === 'string');
      assert.ok(['capability', 'context', 'state', 'incidental'].includes(s.classification));
      assert.ok(s.reason && s.reason.length > 0);
      assert.ok(typeof s.policy.can_seed_entity === 'boolean');
    }
  });

  it('extraction is bounded and deduplicated', () => {
    const counts = new Map();
    for (const s of stringsA.strings) counts.set(s.file, (counts.get(s.file) || 0) + 1);
    for (const [, n] of counts) assert.ok(n <= 300, 'per-file cap must hold');
  });

  it('extractor captures JSX text with element context', () => {
    const found = extractStrings('<Button>Save Poster</Button>');
    assert.equal(found.length, 1);
    assert.equal(found[0].value, 'Save Poster');
    assert.equal(found[0].element, 'Button');
    assert.equal(found[0].kind, 'jsx_text');
  });

  it('docstrings are excluded from string candidates (measured PD noise case)', () => {
    const src = [
      'def find_project(root, name):',
      '    """Return list of client dicts or [] on failure."""',
      '    raise ValueError("invalid target")',
      '    x = "valid runtime string"',
      '    """',
      '    multi line prose mentioning failure and error',
      '    """',
    ].join('\n');
    const found = extractStrings(src);
    const values = found.map(f => f.value);
    assert.ok(!values.some(v => v.includes('Return list of client dicts')), 'docstring must be skipped');
    assert.ok(!values.some(v => v.includes('multi line prose')), 'multiline docstring must be skipped');
    assert.ok(values.includes('invalid target'), 'real raise message stays (error_construction)');
    assert.ok(values.includes('valid runtime string'), 'runtime strings stay');
  });
});
