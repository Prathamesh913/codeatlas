// CodeAtlas Phase 3 — Repository Metadata Collector

import { existsSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { readPackageJson, detectFrameworkClues } from '../utils.js';

/**
 * Collect repository-level metadata.
 *
 * @param {string} root - Repository root
 * @param {Array} [files] - Discovered file inventory (used for language detection)
 */
export function collectRepositoryMetadata(root, files = []) {
  const metadata = {
    root,
    name: basename(root),
    detected_languages: [],
    package_files: [],
    config_files: [],
    framework_clues: [],
    git_initialized: existsSync(join(root, '.git')),
  };

  // Detect package/build files
  const packageFileChecks = [
    'package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lock',
    'pyproject.toml', 'setup.py', 'setup.cfg', 'requirements.txt', 'Pipfile', 'poetry.lock',
    'Cargo.toml', 'go.mod', 'Gemfile', 'composer.json',
    'Makefile', 'CMakeLists.txt', 'build.gradle', 'pom.xml',
    'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
    '.github/workflows',
  ];

  for (const pf of packageFileChecks) {
    if (existsSync(join(root, pf))) {
      metadata.package_files.push(pf);
    }
  }

  // Detect config files
  const configFileChecks = [
    'tsconfig.json', '.eslintrc.js', '.eslintrc.json', 'eslint.config.js',
    '.prettierrc', 'prettier.config.js',
    'vercel.json', 'netlify.toml', 'firebase.json', 'firestore.rules',
    '.env', '.env.example', '.env.local',
    'jest.config.js', 'jest.config.ts', 'vitest.config.ts', 'vitest.config.js',
    'webpack.config.js', 'vite.config.ts', 'vite.config.js',
    'tailwind.config.js', 'tailwind.config.ts',
    'next.config.js', 'next.config.mjs', 'next.config.ts',
    'nuxt.config.ts', 'nuxt.config.js',
    'svelte.config.js',
    'angular.json',
    '.babelrc', 'babel.config.js',
  ];

  for (const cf of configFileChecks) {
    if (existsSync(join(root, cf))) {
      metadata.config_files.push(cf);
    }
  }

  // Detect framework clues from package.json
  const pkg = readPackageJson(root);
  if (pkg) {
    metadata.framework_clues = detectFrameworkClues(pkg);
  }

  // Detect languages from file extensions present
  // (This is a basic detection — the file inventory provides full detail)
  const languageHints = new Set();
  for (const f of files) {
    if (f.language) languageHints.add(f.language);
  }
  if (metadata.package_files.some(f => f.startsWith('package'))) languageHints.add('JavaScript/TypeScript');
  if (metadata.package_files.some(f => f.startsWith('pyproject') || f.startsWith('setup') || f === 'requirements.txt')) {
    languageHints.add('Python');
  }
  if (metadata.package_files.some(f => f === 'Cargo.toml')) languageHints.add('Rust');
  if (metadata.package_files.some(f => f === 'go.mod')) languageHints.add('Go');
  if (metadata.package_files.some(f => f === 'Gemfile')) languageHints.add('Ruby');
  if (metadata.package_files.some(f => f === 'composer.json')) languageHints.add('PHP');

  metadata.detected_languages = [...languageHints];

  return metadata;
}
