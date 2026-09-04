// CodeAtlas Phase 3 — Entry Points Collector

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { safeReadFile, readPackageJson, readPyprojectToml } from '../utils.js';

/**
 * Collect entry point evidence from package.json.
 */
function collectPackageEntryPoints(root) {
  const entries = [];
  const pkg = readPackageJson(root);

  if (!pkg) return entries;

  // "main" field
  if (pkg.main) {
    entries.push({
      type: 'package_main',
      file: pkg.main,
      description: `package.json "main" field`,
      confidence: 'high',
    });
  }

  // "module" field
  if (pkg.module) {
    entries.push({
      type: 'package_module',
      file: pkg.module,
      description: `package.json "module" field`,
      confidence: 'high',
    });
  }

  // "bin" field
  if (pkg.bin) {
    const bins = typeof pkg.bin === 'string'
      ? { [pkg.name || 'bin']: pkg.bin }
      : pkg.bin;

    for (const [name, path] of Object.entries(bins)) {
      entries.push({
        type: 'bin_script',
        file: path,
        description: `package.json "bin" entry: ${name}`,
        confidence: 'high',
      });
    }
  }

  // "scripts" field — collect notable scripts
  if (pkg.scripts) {
    const notableScripts = ['start', 'dev', 'build', 'serve', 'main'];
    for (const script of notableScripts) {
      if (pkg.scripts[script]) {
        entries.push({
          type: 'npm_script',
          file: null,
          description: `package.json script "${script}": ${pkg.scripts[script]}`,
          confidence: 'medium',
        });
      }
    }
  }

  return entries;
}

/**
 * Collect entry point evidence from Python project config.
 */
function collectPythonEntryPoints(root) {
  const entries = [];

  // Check for __main__.py
  const mainPaths = [
    '__main__.py',
    'main.py',
    'app.py',
    'manage.py',
    'wsgi.py',
    'asgi.py',
  ];

  for (const p of mainPaths) {
    if (existsSync(join(root, p))) {
      entries.push({
        type: 'python_entry',
        file: p,
        description: `Common Python entry point file: ${p}`,
        confidence: 'medium',
      });
    }
  }

  // Check for pyproject.toml scripts/entry points
  const tomlContent = readPyprojectToml(root);
  if (tomlContent) {
    // Look for [project.scripts] section
    if (tomlContent.includes('[project.scripts]') || tomlContent.includes('[tool.poetry.scripts]')) {
      entries.push({
        type: 'python_entry',
        file: 'pyproject.toml',
        description: 'pyproject.toml defines project scripts/entry points',
        confidence: 'medium',
      });
    }
  }

  return entries;
}

/**
 * Collect all entry point evidence.
 */
export function collectEntryPoints(root) {
  return [
    ...collectPackageEntryPoints(root),
    ...collectPythonEntryPoints(root),
  ];
}
