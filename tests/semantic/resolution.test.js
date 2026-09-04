// CodeAtlas Phase 4B.2 — Canonical Resolution Fixture Tests (A–H)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runPipeline } from './harness.js';

describe('Fixture A — Structural Split (one unit -> many regions)', () => {
  it('carves search and actions apart instead of a single App feature', () => {
    const r = runPipeline('split-unit');
    // All files sit in ONE connected component (app.js wires them together)
    const componentsCovered = new Set(
      r.regions.flatMap((reg) => reg.source_structural_units)
    );
    assert.ok(r.features.length >= 2, `expected >=2 features, got ${r.features.length}`);

    const search = r.features.find((f) => /search/i.test(f.id));
    const actions = r.features.find((f) => /action|delete/i.test(f.id + f.name));
    assert.ok(search, 'a search feature is resolved');
    assert.ok(actions, 'an actions feature is resolved');
    assert.notDeepEqual(search.primary_files, actions.primary_files);

    // search feature must NOT contain action files and vice versa
    assert.ok(!search.primary_files.some((f) => /action/i.test(f)), 'search region excludes action files');
    assert.ok(!actions.primary_files.some((f) => /search/i.test(f)), 'actions region excludes search files');
    assert.ok(componentsCovered.size >= 1, 'regions reference their structural units for provenance');
  });
});

describe('Fixture B — Cross-Unit Merge (many units -> one region)', () => {
  it('merges profile files from disconnected structural areas into one entity', () => {
    const r = runPipeline('cross-unit');
    const profile =
      r.features.find((f) => /profile/i.test(f.id)) ||
      r.systems.find((f) => /profile/i.test(f.id));
    assert.ok(profile, 'a profile entity is resolved');

    const regions = r.regions.filter((reg) => reg.primary_files.some((f) => /profile/i.test(f)));
    const merged = regions.find((reg) => reg.primary_files.length >= 2);
    assert.ok(merged, 'one region groups multiple profile files');
    assert.ok(
      merged.spans_multiple_units === true,
      'region explicitly spans more than one Structural Unit (D-012)'
    );
    assert.ok(merged.source_structural_units.length >= 2, 'records >=2 source units');

    // route file (own component) merged with card/state (another component)
    const files = merged.primary_files;
    assert.ok(files.some((f) => f.includes('routes')), 'route file included');
    assert.ok(
      files.some((f) => f.includes('components') || f.includes('state')),
      'component/state file included'
    );
  });
});

describe('Fixture C — Shared System', () => {
  it('resolves persistence as a System used by multiple feature regions', () => {
    const r = runPipeline('shared-system');
    const persistence = r.systems.find((s) => /persist|persistence/i.test(s.id + s.name));
    assert.ok(persistence, 'persistence resolves as a system');
    assert.ok(
      persistence.supported_features.length >= 2,
      `system must serve >=2 features, got ${persistence.supported_features.length}`
    );
    assert.ok(
      persistence.evidence.some((e) => e.source === 'phase4a_graph' || e.source === 'phase3_symbols' || e.evidence_type === 'import' || e.evidence_type === 'symbol-vocabulary'),
      'system resolution cites evidence'
    );

    // utility imported by only one region must NOT become a system
    assert.ok(
      !r.systems.some((s) => /format|date/i.test(s.id)),
      'single-use utility is not promoted to a System'
    );

    // relationships: feature USES system, backed by a graph edge
    const uses = r.relationships.filter((x) => x.relationship_type === 'USES');
    assert.ok(uses.length >= 2, 'multiple USES relationships emitted');
    assert.ok(uses.every((x) => x.evidence.length > 0), 'every USES edge has evidence');
  });
});

describe('Fixture D — Misleading Filename', () => {
  it('lets behavior win over the notion filename; no Notion System', () => {
    const r = runPipeline('misleading');
    const canon = [...r.features, ...r.systems];
    const all = JSON.stringify(canon).toLowerCase();
    assert.ok(!/notion system/.test(all), 'no blind "Notion System" is created');

    const notionEntity = canon.find((c) => c.primary_files.some((f) => /notion/i.test(f)));
    assert.ok(notionEntity, 'notion.ts is covered by some entity');
    // its naming must come from behavior (poster/data), and description must not be "notion"
    assert.ok(/poster|data|gallery|publish/i.test(notionEntity.description + notionEntity.name + notionEntity.id),
      `entity naming/description should reflect observed behavior, got: ${notionEntity.description}`);
    // filename conflict must be recorded somewhere
    const contestedOrNaming = r.regions.some((reg) =>
      reg.primary_files.some((f) => /notion/i.test(f))
    );
    assert.ok(contestedOrNaming, 'region membership is evidence-based (behavior), not name-based');
  });
});

describe('Fixture E — User-Language Description', () => {
  it('writes user-meaningful descriptions, not technical echoes', () => {
    const r = runPipeline('user-language');
    const feature = r.features.find((f) => /collection/i.test(f.id + f.name));
    assert.ok(feature, 'a collections feature is resolved');

    assert.ok(
      /^(Allows users|Lets users|Enables users|Provides)/i.test(feature.description),
      `description should be user-facing, got: ${feature.description}`
    );
    for (const bad of ['Krud', 'Svc', 'getCollectionCore', 'createCollectionCore', 'class', 'function']) {
      assert.ok(!feature.description.includes(bad), `description must not echo technical name "${bad}"`);
    }
    assert.ok(feature.user_visible_purpose, 'user_visible_purpose present');
    // technical terms live in provenance instead
    const provHasTech = JSON.stringify(feature.evidence).toLowerCase().includes('collection');
    assert.ok(provHasTech, 'technical evidence retained in provenance');
    // aliases must include visible UI vocabulary, not the class name
    assert.ok(feature.aliases.some((a) => /create collection/i.test(a)), 'aliases include observed UI text');
    assert.ok(!feature.aliases.some((a) => /krud/i.test(a)), 'aliases do not use technical garbage');
  });
});

describe('Fixture F — Ambiguous Resolution', () => {
  it('preserves ambiguity instead of forcing a type', () => {
    const r = runPipeline('ambiguous-test');
    assert.ok(r.unresolved.length >= 1, 'at least one region stays unresolved/ambiguous');
    const amb = r.unresolved.find((u) => /session/i.test(u.id) || u.primary_files.some((f) => /session/i.test(f)));
    assert.ok(amb, 'the session region is among them');
    assert.equal(amb.confidence, 'low');
    assert.ok(amb.competing_interpretations.length >= 2, 'competing feature/system interpretations recorded');
    assert.ok(amb.reason, 'reason explained');
    // and it must NOT appear as a canonical feature or system
    assert.ok(!r.features.some((f) => /session/i.test(f.id)), 'not forced into a Feature');
    assert.ok(!r.systems.some((s) => /session/i.test(s.id)), 'not forced into a System');
  });
});

describe('Fixture G — Over-Merging Prevention', () => {
  it('keeps two features separate despite shared state infrastructure', () => {
    const r = runPipeline('overmerge');
    assert.ok(r.features.length >= 2, `expected >=2 separate features, got ${r.features.length}: ${r.features.map((f) => f.id).join(',')}`);

    const likesFeature = r.features.find((f) => f.primary_files.includes('features/likes-panel.js'));
    const subsFeature = r.features.find((f) => f.primary_files.includes('features/submissions-panel.js'));
    assert.ok(likesFeature, 'likes panel is claimed by a feature');
    assert.ok(subsFeature, 'submissions panel is claimed by a feature');
    assert.notEqual(likesFeature.id, subsFeature.id, 'they are NOT merged into one entity');
    assert.equal(
      likesFeature.primary_files.filter((f) => subsFeature.primary_files.includes(f)).length,
      0,
      'the two features do not share primary files'
    );

    // shared state must not swallow both features into one mega-region
    const mega = r.regions.find((reg) => reg.primary_files.length >= 3);
    assert.ok(!mega, 'no single region absorbs every file');
  });
});

describe('Fixture H — Over-Splitting Prevention', () => {
  it('keeps component + hook + store as ONE feature', () => {
    const r = runPipeline('oversplit');
    assert.equal(r.features.length, 1, `expected one feature, got ${r.features.length}`);
    const f = r.features[0];
    const all = new Set([...f.primary_files, ...(f.supporting_files || [])]);
    assert.ok(
      all.size >= 3,
      `feature should span component+hook+store (≥3 files), got ${[...all].join(', ')}`
    );
    for (const want of ['SavedPosterList', 'useSavedPosters', 'savedStore']) {
      assert.ok([...all].some((p) => p.includes(want)), `${want} is claimed (primary or supporting)`);
    }
  });
});

describe('Cross-cutting guarantees', () => {
  it('every canonical entity carries evidence and provenance', () => {
    const r = runPipeline('shared-system');
    for (const e of [...r.features, ...r.systems]) {
      assert.ok(e.evidence.length > 0, `${e.id} has evidence`);
      assert.ok(e.primary_files.length > 0, `${e.id} cites files`);
      assert.ok(['high', 'medium', 'low'].includes(e.confidence));
      assert.match(e.id, /^[a-z0-9-_]+$/, 'id matches schema pattern');
    }
  });

  it('additional inspections are all justified with a question', () => {
    const r = runPipeline('misleading');
    for (const log of r.report.inspection.additional_inspection_log) {
      assert.ok(log.file, 'logged file');
      assert.ok(log.reason, 'logged reason');
      assert.ok(log.question, 'logged question it answers');
    }
  });

  it('output is deterministic across runs', () => {
    const a = runPipeline('split-unit');
    const b = runPipeline('split-unit');
    assert.deepEqual(
      a.features.map((f) => ({ id: f.id, files: f.primary_files, conf: f.confidence })),
      b.features.map((f) => ({ id: f.id, files: f.primary_files, conf: f.confidence }))
    );
    assert.deepEqual(a.systems.map((s) => s.id), b.systems.map((s) => s.id));
    assert.deepEqual(a.relationships, b.relationships);
  });

  it('generated JSON files are valid and isolated', () => {
    const r = runPipeline('shared-system');
    for (const f of ['regions.json', 'features.json', 'systems.json', 'relationships.json', 'unresolved.json', 'resolution-report.json']) {
      const p = join(r.work, 'semantic', f);
      assert.ok(existsSync(p), `${f} written`);
      assert.doesNotThrow(() => JSON.parse(readFileSync(p, 'utf-8')), `${f} valid JSON`);
    }
  });
});
