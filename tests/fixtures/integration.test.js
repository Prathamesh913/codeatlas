// CodeAtlas Phase 3 — Integration Test: Full Pipeline

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { collect } from '../../src/collect.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '..', 'fixtures');

describe('Full Pipeline — TypeScript App', () => {
  const outputDir = join(tmpdir(), 'codeatlas-test-ts');

  after(() => {
    if (existsSync(outputDir)) rmSync(outputDir, { recursive: true });
  });

  it('produces all evidence files', async () => {
    const manifest = await collect(join(FIXTURES, 'ts-app'), outputDir);

    assert.equal(manifest.tool, 'codeatlas-evidence-collector');
    assert.ok(manifest.summary.files_discovered > 0, 'should discover files');
    assert.ok(manifest.summary.imports_captured > 0, 'should capture imports');
    assert.ok(manifest.summary.symbols_captured > 0, 'should capture symbols');

    // Verify all evidence files exist
    const evidenceDir = join(outputDir, 'evidence');
    assert.ok(existsSync(join(evidenceDir, 'manifest.json')), 'manifest.json exists');
    assert.ok(existsSync(join(evidenceDir, 'repository.json')), 'repository.json exists');
    assert.ok(existsSync(join(evidenceDir, 'files.json')), 'files.json exists');
    assert.ok(existsSync(join(evidenceDir, 'imports.json')), 'imports.json exists');
    assert.ok(existsSync(join(evidenceDir, 'symbols.json')), 'symbols.json exists');
    assert.ok(existsSync(join(evidenceDir, 'entrypoints.json')), 'entrypoints.json exists');
    assert.ok(existsSync(join(evidenceDir, 'config.json')), 'config.json exists');
  });

  it('produces valid JSON in all evidence files', async () => {
    const evidenceDir = join(outputDir, 'evidence');
    const files = ['manifest.json', 'repository.json', 'files.json', 'imports.json', 'symbols.json', 'entrypoints.json', 'config.json'];

    for (const f of files) {
      const content = readFileSync(join(evidenceDir, f), 'utf-8');
      assert.doesNotThrow(() => JSON.parse(content), `${f} should be valid JSON`);
    }
  });

  it('detects framework clues', async () => {
    const evidenceDir = join(outputDir, 'evidence');
    const repository = JSON.parse(readFileSync(join(evidenceDir, 'repository.json'), 'utf-8'));

    const reactClue = repository.framework_clues.find(c => c.framework === 'React');
    assert.ok(reactClue, 'should detect React framework clue');

    const viteClue = repository.framework_clues.find(c => c.framework === 'Vite');
    assert.ok(viteClue, 'should detect Vite framework clue');
  });

  it('discovers npm scripts as entry points', async () => {
    const evidenceDir = join(outputDir, 'evidence');
    const entrypoints = JSON.parse(readFileSync(join(evidenceDir, 'entrypoints.json'), 'utf-8'));

    const startScript = entrypoints.find(e => e.description.includes('"start"'));
    assert.ok(startScript, 'should find start script');

    const devScript = entrypoints.find(e => e.description.includes('"dev"'));
    assert.ok(devScript, 'should find dev script');
  });

  it('captures npm dependencies', async () => {
    const evidenceDir = join(outputDir, 'evidence');
    const config = JSON.parse(readFileSync(join(evidenceDir, 'config.json'), 'utf-8'));

    assert.ok(config.dependencies.length > 0, 'should have dependencies');
    const reactDep = config.dependencies.find(d => d.name === 'react');
    assert.ok(reactDep, 'should find react dependency');
    assert.equal(reactDep.type, 'npm');
    assert.equal(reactDep.category, 'runtime');
  });

  it('captures environment variable names', async () => {
    const evidenceDir = join(outputDir, 'evidence');
    const config = JSON.parse(readFileSync(join(evidenceDir, 'config.json'), 'utf-8'));

    assert.ok(config.env_vars.length > 0, 'should find env vars');
    const apiEnvVar = config.env_vars.find(e => e.name === 'REACT_APP_API_URL');
    assert.ok(apiEnvVar, 'should find REACT_APP_API_URL');
  });
});

describe('Full Pipeline — Python App', () => {
  const outputDir = join(tmpdir(), 'codeatlas-test-py');

  after(() => {
    if (existsSync(outputDir)) rmSync(outputDir, { recursive: true });
  });

  it('produces all evidence files', async () => {
    const manifest = await collect(join(FIXTURES, 'python-app'), outputDir);

    assert.equal(manifest.tool, 'codeatlas-evidence-collector');
    assert.ok(manifest.summary.files_discovered > 0, 'should discover files');
    assert.ok(manifest.summary.imports_captured > 0, 'should capture imports');
    assert.ok(manifest.summary.symbols_captured > 0, 'should capture symbols');

    const evidenceDir = join(outputDir, 'evidence');
    assert.ok(existsSync(join(evidenceDir, 'manifest.json')), 'manifest.json exists');
  });

  it('detects Python language', async () => {
    const evidenceDir = join(outputDir, 'evidence');
    const repository = JSON.parse(readFileSync(join(evidenceDir, 'repository.json'), 'utf-8'));

    assert.ok(repository.detected_languages.includes('Python'), 'should detect Python');
  });

  it('captures Python imports', async () => {
    const evidenceDir = join(outputDir, 'evidence');
    const imports = JSON.parse(readFileSync(join(evidenceDir, 'imports.json'), 'utf-8'));

    const mainImports = imports.filter(i => i.source === 'main.py');
    assert.ok(mainImports.length >= 3, `main.py should have imports, got ${mainImports.length}`);
  });

  it('captures Python symbols including __main__', async () => {
    const evidenceDir = join(outputDir, 'evidence');
    const symbols = JSON.parse(readFileSync(join(evidenceDir, 'symbols.json'), 'utf-8'));

    const mainClue = symbols.find(s => s.name === '__main__');
    assert.ok(mainClue, 'should find __main__ entry clue');

    const createApp = symbols.find(s => s.name === 'create_app');
    assert.ok(createApp, 'should find create_app function');
  });

  it('captures Python env var names', async () => {
    const evidenceDir = join(outputDir, 'evidence');
    const config = JSON.parse(readFileSync(join(evidenceDir, 'config.json'), 'utf-8'));

    assert.ok(config.env_vars.length > 0, 'should find env vars');
    const appApiUrl = config.env_vars.find(e => e.name === 'APP_API_URL');
    assert.ok(appApiUrl, 'should find APP_API_URL');
  });
});

describe('Full Pipeline — Exclusion Behavior', () => {
  const outputDir = join(tmpdir(), 'codeatlas-test-excl');

  after(() => {
    if (existsSync(outputDir)) rmSync(outputDir, { recursive: true });
  });

  it('excludes node_modules, dist, and __pycache__', async () => {
    const manifest = await collect(join(FIXTURES, 'exclusion-app'), outputDir);

    // Verify exclusions were recorded
    assert.ok(manifest.exclusions.length >= 3, `should record at least 3 exclusions, got ${manifest.exclusions.length}`);

    const nodeModulesExcl = manifest.exclusions.find(e => e.path === 'node_modules');
    assert.ok(nodeModulesExcl, 'should record node_modules exclusion');

    const distExcl = manifest.exclusions.find(e => e.path === 'dist');
    assert.ok(distExcl, 'should record dist exclusion');

    const pycacheExcl = manifest.exclusions.find(e => e.path === '__pycache__');
    assert.ok(pycacheExcl, 'should record __pycache__ exclusion');

    // Verify excluded files are not in the file inventory
    const evidenceDir = join(outputDir, 'evidence');
    const files = JSON.parse(readFileSync(join(evidenceDir, 'files.json'), 'utf-8'));

    const excludedFiles = files.filter(f =>
      f.path.startsWith('node_modules') ||
      f.path.startsWith('dist') ||
      f.path.startsWith('__pycache__')
    );
    assert.equal(excludedFiles.length, 0, 'excluded files should not appear in inventory');
  });

  it('preserves normal source files', async () => {
    const evidenceDir = join(outputDir, 'evidence');
    const files = JSON.parse(readFileSync(join(evidenceDir, 'files.json'), 'utf-8'));

    const srcIndex = files.find(f => f.path === 'src/index.ts');
    assert.ok(srcIndex, 'should preserve src/index.ts');
  });
});
