// CodeAtlas Collector v2 (Phase 4C.1A) — Regression Tests: Mechanical Relevance Flags
//
// Covers M1–M8 from the Phase 4C.1A contract. Flags are deterministic,
// path/type-based observations (D-017) — they never exclude a file and never
// decide semantic relevance.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getMechanicalFlags } from '../../src/utils.js';
import { discoverFiles } from '../../src/collectors/files.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '..', 'fixtures');

describe('Collector v2 — mechanical relevance flags (M)', () => {
  it('M1 — flags test-like path and test filename convention', () => {
    const { flags, reasons } = getMechanicalFlags('tests/example.test.ts');
    assert.equal(flags.is_test_like, true);
    assert.ok(reasons.is_test_like.includes('path_segment:tests'));
    assert.ok(
      reasons.is_test_like.some(r => r.startsWith('filename_pattern:*.test')),
      `expected a *.test reason, got ${JSON.stringify(reasons.is_test_like)}`
    );
    assert.equal(flags.is_generated_like, false);
    assert.equal(flags.is_documentation_like, false);
    assert.equal(flags.is_automation_like, false);
  });

  it('M2 — Python test naming convention (test_*.py)', () => {
    const { flags, reasons } = getMechanicalFlags('src/test_feature.py');
    assert.equal(flags.is_test_like, true);
    assert.ok(reasons.is_test_like.includes('filename_pattern:test_*'));
  });

  it('M3 — generated/build paths and generated filename conventions', () => {
    const dist = getMechanicalFlags('dist/generated.js');
    assert.equal(dist.flags.is_generated_like, true);
    assert.ok(dist.reasons.is_generated_like.includes('path_segment:dist'));

    const genName = getMechanicalFlags('src/routeTree.gen.ts');
    assert.equal(genName.flags.is_generated_like, true);
    assert.ok(
      genName.reasons.is_generated_like.some(r => r.startsWith('filename_pattern:*.gen')),
      `expected a *.gen reason, got ${JSON.stringify(genName.reasons.is_generated_like)}`
    );
  });

  it('M4 — documentation by extension and by docs/ path', () => {
    const byExt = getMechanicalFlags('README.md');
    assert.equal(byExt.flags.is_documentation_like, true);
    assert.ok(byExt.reasons.is_documentation_like.includes('extension:.md'));

    const byPath = getMechanicalFlags('docs/notes.txt');
    assert.equal(byPath.flags.is_documentation_like, true);
    assert.ok(byPath.reasons.is_documentation_like.includes('path_segment:docs'));
    // .txt is deliberately NOT a documentation extension (requirements.txt)
  });

  it('M5 — automation/script directories', () => {
    const { flags, reasons } = getMechanicalFlags('scripts/build-release.js');
    assert.equal(flags.is_automation_like, true);
    assert.ok(reasons.is_automation_like.includes('path_segment:scripts'));
  });

  it('M6 — flags are independent; a file may carry several', () => {
    const { flags, reasons } = getMechanicalFlags('scripts/run-tests.test.js');
    assert.equal(flags.is_test_like, true);
    assert.equal(flags.is_automation_like, true);
    assert.equal(flags.is_generated_like, false);
    assert.equal(flags.is_documentation_like, false);
    assert.ok(reasons.is_test_like.length >= 1 && reasons.is_automation_like.length >= 1);
  });

  it('M7 — normal application source carries no flags', () => {
    const { flags, reasons } = getMechanicalFlags('src/components/Search.tsx');
    assert.deepEqual(flags, {
      is_test_like: false,
      is_generated_like: false,
      is_documentation_like: false,
      is_automation_like: false,
    });
    assert.deepEqual(reasons, {});
  });

  it('B2 guard — directory rules match segments only, never filename stems', () => {
    // Real ProjectDock shape: a production module named tools.py must NOT be
    // flagged as automation.
    const tools = getMechanicalFlags('projectdock/tools.py');
    assert.equal(tools.flags.is_automation_like, false);
    assert.equal(tools.flags.is_test_like, false);
    assert.equal(tools.flags.is_generated_like, false);
    assert.equal(tools.flags.is_documentation_like, false);
  });

  it('M8 — flagged files remain in the inventory, fully included (no exclusion)', () => {
    const root = join(FIXTURES, 'flags-app');
    const { files } = discoverFiles(root);

    const expected = [
      ['tests/example.test.ts', 'is_test_like'],
      ['test_feature.py', 'is_test_like'],
      ['docs/architecture.md', 'is_documentation_like'],
      ['scripts/build-release.js', 'is_automation_like'],
      ['scripts/run-tests.test.js', 'is_automation_like'],
      ['src/routeTree.gen.ts', 'is_generated_like'],
      ['src/components/Search.tsx', null],
    ];

    for (const [path, flagName] of expected) {
      const entry = files.find(f => f.path === path);
      assert.ok(entry, `${path} must appear in the inventory`);
      assert.equal(entry.included, true, `${path} must remain included`);
      assert.ok(entry.relevance_flags, `${path} must carry relevance_flags`);
      if (flagName) {
        assert.equal(entry.relevance_flags[flagName], true, `${path} should be flagged ${flagName}`);
      } else {
        assert.deepEqual(
          entry.relevance_flags,
          { is_test_like: false, is_generated_like: false, is_documentation_like: false, is_automation_like: false }
        );
      }
    }

    // The double-flagged file keeps both independent observations end-to-end.
    const both = files.find(f => f.path === 'scripts/run-tests.test.js');
    assert.equal(both.relevance_flags.is_test_like, true);
    assert.equal(both.relevance_flags.is_automation_like, true);
    assert.ok(both.relevance_reasons.is_test_like.length >= 1);
    assert.ok(both.relevance_reasons.is_automation_like.length >= 1);
  });
});
