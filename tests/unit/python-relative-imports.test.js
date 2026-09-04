// CodeAtlas Collector v2 (Phase 4C.1A) — Regression Tests: Python Relative Imports
//
// Covers R1A–R1J from the Phase 4C.1A contract using tests/fixtures/python-rel-app.
// Invariant: relative imports resolve ONLY against the discovered inventory;
// unresolved/ambiguous observations are preserved, never dropped or fabricated.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { collectImports } from '../../src/collectors/imports.js';
import { discoverFiles, classifyFiles } from '../../src/collectors/files.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '..', 'fixtures');

describe('Collector v2 — Python relative imports (R1)', () => {
  const root = join(FIXTURES, 'python-rel-app');
  const { files } = discoverFiles(root);
  const classified = classifyFiles(files);
  const { imports, errors } = collectImports(classified, root);

  const rel = (source, target) =>
    imports.find(i => i.source === source && i.target === target && i.classification === 'relative');

  it('collects no parse errors', () => {
    assert.equal(errors.length, 0, `expected no errors, got ${JSON.stringify(errors)}`);
  });

  it('R1A — same-package bare import resolves to the sibling module', () => {
    const rec = rel('app.py', '.actions');
    assert.ok(rec, 'should capture `from . import actions`');
    assert.equal(rec.type, 'from_import');
    assert.equal(rec.relative_level, 1);
    assert.equal(rec.module, 'actions');
    assert.equal(rec.resolution_status, 'resolved');
    assert.equal(rec.resolved_path, 'actions.py');
    assert.equal(rec.confidence, 'high');
  });

  it('R1B — multi-name bare import produces one resolved record per name', () => {
    const discovery = rel('app.py', '.discovery');
    const search = rel('app.py', '.search');
    assert.ok(discovery && search, 'both names from `from . import discovery, search` must be represented');
    assert.equal(discovery.resolved_path, 'discovery.py');
    assert.equal(search.resolved_path, 'search.py');
    assert.deepEqual(discovery.symbols, ['discovery']);
    assert.deepEqual(search.symbols, ['search']);
  });

  it('R1C — relative module import resolves the module and preserves symbols', () => {
    const moduleForm = imports.filter(
      i => i.source === 'app.py' && i.target === '.actions' && i.symbols.includes('run_action')
    );
    assert.equal(moduleForm.length, 2, 'module form appears twice: plain + aliased');
    const plain = moduleForm.find(i => !i.symbol_aliases);
    assert.ok(plain, '`from .actions import run_action` should be captured');
    assert.equal(plain.module, 'actions');
    assert.deepEqual(plain.symbols, ['run_action']);
    assert.equal(plain.resolution_status, 'resolved');
    assert.equal(plain.resolved_path, 'actions.py');
    const bare = imports.find(
      i => i.source === 'app.py' && i.target === '.actions' && i.module === 'actions' && !i.symbols.includes('run_action')
    );
    assert.ok(bare, 'the bare `from . import actions` record is distinct');
    assert.deepEqual(bare.symbols, ['actions']);
  });

  it('R1D — parent-package import resolves through the package hierarchy', () => {
    const rec = rel('sub/module.py', '..config');
    assert.ok(rec, 'should capture `from ..config import Config`');
    assert.equal(rec.relative_level, 2);
    assert.equal(rec.module, 'config');
    assert.deepEqual(rec.symbols, ['Config']);
    assert.equal(rec.resolution_status, 'resolved');
    assert.equal(rec.resolved_path, 'config.py');
  });

  it('R1E — multi-level relative import preserves level and resolves only valid targets', () => {
    const rec = rel('deep/inner/leaf.py', '...package.module');
    assert.ok(rec, 'should capture `from ...package.module import thing`');
    assert.equal(rec.relative_level, 3);
    assert.equal(rec.module, 'package.module');
    assert.deepEqual(rec.symbols, ['thing']);
    assert.equal(rec.resolution_status, 'resolved');
    assert.equal(rec.resolved_path, 'package/module.py');
  });

  it('R1F — parenthesized imports preserve module and all symbols', () => {
    const modForm = imports.find(
      i => i.source === 'paren.py' && i.target === '.search' && i.symbols.includes('search_all')
    );
    assert.ok(modForm, 'parenthesized from-module import should be captured');
    assert.deepEqual(modForm.symbols, ['search_all', 'rank']);
    assert.equal(modForm.resolution_status, 'resolved');
    assert.equal(modForm.resolved_path, 'search.py');

    const bareActions = rel('paren.py', '.actions');
    const bareDiscovery = rel('paren.py', '.discovery');
    assert.ok(bareActions && bareDiscovery, 'parenthesized bare import yields one record per name');
    assert.equal(bareActions.resolved_path, 'actions.py');
    assert.equal(bareDiscovery.resolved_path, 'discovery.py');
  });

  it('R1G — aliases are preserved when present', () => {
    const moduleAlias = imports.find(
      i => i.source === 'app.py' && i.target === '.actions' && i.symbol_aliases
    );
    assert.ok(moduleAlias, '`from .actions import run_action as action_runner` should keep the alias');
    assert.deepEqual(moduleAlias.symbols, ['run_action']);
    assert.deepEqual(moduleAlias.symbol_aliases, { run_action: 'action_runner' });
    assert.equal(moduleAlias.resolved_path, 'actions.py');

    const bareAlias = rel('app.py', '.config');
    assert.ok(bareAlias, '`from . import config as cfg` should be captured');
    assert.deepEqual(bareAlias.symbols, ['config']);
    assert.deepEqual(bareAlias.symbol_aliases, { config: 'cfg' });
    assert.equal(bareAlias.resolved_path, 'config.py');
  });

  it('R1H — package targets resolve to __init__.py', () => {
    const rec = rel('usepkg.py', '.subpackage');
    assert.ok(rec, 'should capture `from .subpackage import Thing`');
    assert.equal(rec.resolution_status, 'resolved');
    assert.equal(rec.resolved_path, 'subpackage/__init__.py');
    assert.deepEqual(rec.symbols, ['Thing']);
  });

  it('R1I — unresolved relative imports are preserved, not fabricated or dropped', () => {
    const missing = rel('unres.py', '.missing');
    assert.ok(missing, 'observation must be preserved');
    assert.equal(missing.resolution_status, 'unresolved');
    assert.equal(missing.resolved_path, null);
    assert.equal(missing.resolution_reason, 'target_not_found');
    assert.equal(missing.module, 'missing');

    const missingName = rel('unres.py', '.nonexistent_module');
    assert.ok(missingName, '`from . import nonexistent_module` must be preserved');
    assert.equal(missingName.resolution_status, 'unresolved');
    assert.equal(missingName.resolution_reason, 'target_not_found');

    const beyond = rel('unres.py', '..config');
    assert.ok(beyond, 'level beyond package root must still be observed');
    assert.equal(beyond.relative_level, 2);
    assert.equal(beyond.resolution_status, 'unresolved');
    assert.equal(beyond.resolution_reason, 'relative_level_exceeds_package_root');
  });

  it('A4 — ambiguous targets preserve both deterministic candidates', () => {
    const rec = rel('ambig.py', '.dupe');
    assert.ok(rec, '`from . import dupe` with dupe.py AND dupe/__init__.py present');
    assert.equal(rec.resolution_status, 'unresolved');
    assert.equal(rec.resolution_reason, 'ambiguous');
    assert.deepEqual(rec.resolution_candidates, ['dupe.py', 'dupe/__init__.py']);
  });

  it('R1J — absolute import behavior is unchanged', () => {
    const os = imports.find(i => i.source === 'app.py' && i.target === 'os');
    assert.ok(os, 'plain absolute import captured as before');
    assert.equal(os.classification, 'local');
    assert.equal(os.resolution_status, 'not_local');
    assert.equal(os.type, 'import');

    const abslib = imports.find(i => i.source === 'app.py' && i.target === 'abslib.util');
    assert.ok(abslib, 'absolute package-style from-import captured as before');
    assert.equal(abslib.classification, 'package');
    assert.equal(abslib.resolution_status, 'not_local');
    assert.deepEqual(abslib.symbols, ['load']);
  });

  it('every relative record carries provenance (raw statement + level)', () => {
    const relativeRecords = imports.filter(i => i.classification === 'relative');
    assert.ok(relativeRecords.length >= 12, `expected >= 12 relative records, got ${relativeRecords.length}`);
    for (const rec of relativeRecords) {
      assert.equal(typeof rec.raw, 'string', 'raw statement preserved');
      assert.ok(rec.raw.startsWith('from '), `raw should be the observed statement, got ${rec.raw}`);
      assert.ok(Number.isInteger(rec.relative_level) && rec.relative_level >= 1);
      assert.equal(typeof rec.module, 'string');
    }
  });
});
