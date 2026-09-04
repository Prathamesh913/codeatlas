// CodeAtlas Phase 3 — Unit Tests: File Discovery

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { discoverFiles, classifyFiles } from '../../src/collectors/files.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '..', 'fixtures');

describe('discoverFiles', () => {
  it('discovers source files in a TypeScript project', () => {
    const root = join(FIXTURES, 'ts-app');
    const { files, exclusions } = discoverFiles(root);

    assert.ok(files.length > 0, 'should discover files');

    const tsFiles = files.filter(f => f.language);
    assert.ok(tsFiles.length > 0, 'should find TypeScript/JavaScript source files');

    // Check a known file exists
    const loginBtn = files.find(f => f.path.includes('LoginButton'));
    assert.ok(loginBtn, 'should find LoginButton.tsx');
    assert.equal(loginBtn.language, 'TypeScript JSX');
    assert.equal(loginBtn.included, true);
  });

  it('discovers source files in a Python project', () => {
    const root = join(FIXTURES, 'python-app');
    const { files } = discoverFiles(root);

    assert.ok(files.length > 0, 'should discover files');

    const pyFiles = files.filter(f => f.language === 'Python');
    assert.ok(pyFiles.length >= 4, 'should find Python source files');

    const mainPy = files.find(f => f.path === 'main.py');
    assert.ok(mainPy, 'should find main.py');
  });

  it('excludes node_modules, dist, and __pycache__', () => {
    const root = join(FIXTURES, 'exclusion-app');
    const { files, exclusions } = discoverFiles(root);

    // Should not include files from excluded directories
    const nodeModulesFiles = files.filter(f => f.path.startsWith('node_modules'));
    const distFiles = files.filter(f => f.path.startsWith('dist'));
    const pycacheFiles = files.filter(f => f.path.startsWith('__pycache__'));

    assert.equal(nodeModulesFiles.length, 0, 'should exclude node_modules');
    assert.equal(distFiles.length, 0, 'should exclude dist');
    assert.equal(pycacheFiles.length, 0, 'should exclude __pycache__');

    // Should have recorded exclusions
    assert.ok(exclusions.length > 0, 'should record exclusions');
  });

  it('records exclusion reasons', () => {
    const root = join(FIXTURES, 'exclusion-app');
    const { exclusions } = discoverFiles(root);

    const nodeModulesExcl = exclusions.find(e => e.path === 'node_modules');
    assert.ok(nodeModulesExcl, 'should record node_modules exclusion');
    assert.ok(nodeModulesExcl.reason.includes('node_modules'), 'should mention node_modules in reason');
  });
});

describe('classifyFiles', () => {
  it('classifies source and config files', () => {
    const root = join(FIXTURES, 'ts-app');
    const { files } = discoverFiles(root);
    const classified = classifyFiles(files);

    assert.ok(classified.source.length > 0, 'should have source files');
    // package.json should be in config
    const pkgJson = classified.config.find(f => f.path === 'package.json');
    assert.ok(pkgJson, 'package.json should be classified as config');
  });
});
