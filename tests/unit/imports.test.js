// CodeAtlas Phase 3 — Unit Tests: Import Collector

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { collectImports } from '../../src/collectors/imports.js';
import { discoverFiles, classifyFiles } from '../../src/collectors/files.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '..', 'fixtures');

describe('collectImports — TypeScript/JavaScript', () => {
  const root = join(FIXTURES, 'ts-app');
  const { files } = discoverFiles(root);
  const classified = classifyFiles(files);
  const { imports, errors } = collectImports(classified, root);

  it('captures ES module imports', () => {
    // LoginButton.tsx imports from react, zustand store, Button, and CSS
    const loginBtnImports = imports.filter(
      i => i.source.includes('LoginButton')
    );
    assert.ok(loginBtnImports.length >= 3, `LoginButton should have at least 3 imports, got ${loginBtnImports.length}`);
  });

  it('identifies local vs external imports', () => {
    const reactImport = imports.find(
      i => i.target === 'react' && i.source.includes('LoginButton')
    );
    assert.ok(reactImport, 'should find react import');
    assert.equal(reactImport.classification, 'package');
  });

  it('identifies local relative imports', () => {
    const storeImport = imports.find(
      i => i.target.includes('authStore') && i.source.includes('LoginButton')
    );
    assert.ok(storeImport, 'should find authStore import');
    assert.equal(storeImport.classification, 'local');
  });

  it('resolves local imports to actual files', () => {
    const storeImport = imports.find(
      i => i.target.includes('authStore') && i.source.includes('LoginButton')
    );
    assert.ok(storeImport, 'should find authStore import');
    // Should resolve to the actual file
    if (storeImport.classification === 'local') {
      assert.equal(storeImport.resolution_status, 'resolved', 'local import should be resolved');
      assert.ok(storeImport.resolved_path, 'should have resolved path');
    }
  });

  it('captures named imports as symbols', () => {
    const storeImport = imports.find(
      i => i.target.includes('authStore') && i.source.includes('LoginButton')
    );
    assert.ok(storeImport, 'should find authStore import');
    assert.ok(storeImport.symbols.includes('useAuthStore'), 'should capture useAuthStore symbol');
  });

  it('detects unresolved imports', () => {
    const brokenImports = imports.filter(
      i => i.source.includes('BrokenComponent') && i.resolution_status === 'unresolved'
    );
    assert.ok(brokenImports.length > 0, 'should detect unresolved import in BrokenComponent');
  });

  it('captures CSS imports', () => {
    const cssImport = imports.find(
      i => i.source.includes('LoginButton') && i.target.includes('.css')
    );
    assert.ok(cssImport, 'should capture CSS import');
  });

  it('captures process.env references in imports collector context', () => {
    // This is tested via config collector, but verify imports don't break on env references
    assert.ok(imports.length > 0, 'imports should be collected despite env var references');
  });
});

describe('collectImports — Python', () => {
  const root = join(FIXTURES, 'python-app');
  const { files } = discoverFiles(root);
  const classified = classifyFiles(files);
  const { imports } = collectImports(classified, root);

  it('captures import statements', () => {
    const mainImports = imports.filter(i => i.source === 'main.py');
    assert.ok(mainImports.length >= 3, `main.py should have at least 3 imports, got ${mainImports.length}`);
  });

  it('captures from...import statements', () => {
    const fromImports = imports.filter(
      i => i.source === 'main.py' && i.type === 'from_import'
    );
    assert.ok(fromImports.length >= 2, 'should capture from...import statements');
  });

  it('identifies imported symbols', () => {
    const userImport = imports.find(
      i => i.source === 'main.py' && i.target === 'models.user'
    );
    assert.ok(userImport, 'should find models.user import');
    assert.ok(userImport.symbols.includes('User'), 'should capture User symbol');
  });
});
