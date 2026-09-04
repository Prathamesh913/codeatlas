// CodeAtlas Phase 3 — Evidence Collection Utilities

import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative, dirname, extname, resolve, basename } from 'node:path';

/**
 * Known exclusion directory patterns.
 */
export const EXCLUSION_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage',
  '__pycache__', '.next', '.cache', 'vendor', '.venv', 'venv',
  '.turbo', '.parcel-cache', 'out', '.output', '.nuxt',
]);

/**
 * Source file extensions mapped to language types.
 */
export const SOURCE_EXTENSIONS = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript JSX',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript JSX',
  '.mjs': 'JavaScript (ESM)',
  '.cjs': 'JavaScript (CJS)',
  '.py': 'Python',
  '.mts': 'TypeScript (ESM)',
  '.cts': 'TypeScript (CJS)',
};

export const CONFIG_EXTENSIONS = new Set([
  '.json', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf',
]);

export const MARKDOWN_EXTENSIONS = new Set(['.md', '.mdx', '.rst', '.txt']);

/**
 * Check if a directory name should be excluded.
 */
export function shouldExclude(dirName) {
  return EXCLUSION_DIRS.has(dirName);
}

/**
 * Get the language for a file based on extension.
 */
export function getLanguage(filePath) {
  return SOURCE_EXTENSIONS[extname(filePath)] || null;
}

/**
 * Get the file type category based on extension and context.
 */
export function getFileType(filePath, context) {
  const ext = extname(filePath);
  const name = basename(filePath);

  // Config files by name
  if (name === 'package.json') return 'package manifest';
  if (name === 'tsconfig.json') return 'TypeScript config';
  if (name === 'pyproject.toml') return 'Python project config';
  if (name === 'setup.py' || name === 'setup.cfg') return 'Python setup';
  if (name === 'requirements.txt' || name.startsWith('requirements-')) return 'Python requirements';
  if (name === 'Makefile') return 'build file';
  if (name === 'Dockerfile') return 'container config';
  if (name === '.env' || name.startsWith('.env.')) return 'environment config';
  if (name === 'vercel.json' || name === 'netlify.toml') return 'deployment config';
  if (name === 'firebase.json') return 'Firebase config';
  if (name === 'eslint.config.js' || name === '.eslintrc.js' || name === '.eslintrc.json') return 'linting config';
  if (name === 'prettier.config.js' || name === '.prettierrc') return 'formatting config';

  // By extension
  if (ext === '.json') return 'JSON';
  if (ext === '.yaml' || ext === '.yml') return 'YAML';
  if (ext === '.toml') return 'TOML';
  if (ext === '.md' || ext === '.mdx') return 'Markdown';
  if (ext === '.css' || ext === '.scss' || ext === '.less') return 'style';
  if (ext === '.svg' || ext === '.png' || ext === '.jpg') return 'asset';

  return SOURCE_EXTENSIONS[ext] || 'other';
}

/**
 * Read a file safely, returning null on error.
 */
export function safeReadFile(filePath) {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Read package.json safely.
 */
export function readPackageJson(root) {
  const pkgPath = join(root, 'package.json');
  if (!existsSync(pkgPath)) return null;
  try {
    return JSON.parse(readFileSync(pkgPath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Read pyproject.toml as raw text (we won't parse TOML without deps).
 */
export function readPyprojectToml(root) {
  const tomlPath = join(root, 'pyproject.toml');
  if (!existsSync(tomlPath)) return null;
  return safeReadFile(tomlPath);
}

/**
 * Detect framework clues from package.json dependencies.
 */
export function detectFrameworkClues(pkg) {
  if (!pkg) return [];
  const clues = [];
  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.peerDependencies,
  };

  const frameworkMap = {
    'react': 'React',
    'react-dom': 'React',
    'next': 'Next.js',
    'vue': 'Vue',
    'nuxt': 'Nuxt',
    'angular': 'Angular',
    'svelte': 'Svelte',
    'express': 'Express',
    'fastify': 'Fastify',
    'hono': 'Hono',
    'nestjs': 'NestJS',
    '@nestjs/core': 'NestJS',
    'electron': 'Electron',
    'tauri': 'Tauri',
    'graphql': 'GraphQL',
    'prisma': 'Prisma',
    'drizzle-orm': 'Drizzle',
    'typeorm': 'TypeORM',
    'mongoose': 'Mongoose',
    'firebase': 'Firebase',
    'firebase-admin': 'Firebase Admin',
    '@supabase/supabase-js': 'Supabase',
    'zustand': 'Zustand',
    'redux': 'Redux',
    'jotai': 'Jotai',
    'recoil': 'Recoil',
    'tailwindcss': 'Tailwind CSS',
    'styled-components': 'Styled Components',
    '@emotion/react': 'Emotion',
    'vite': 'Vite',
    'webpack': 'Webpack',
    'esbuild': 'ESBuild',
    'rollup': 'Rollup',
    'vitest': 'Vitest',
    'jest': 'Jest',
    'mocha': 'Mocha',
    'playwright': 'Playwright',
    'cypress': 'Cypress',
  };

  for (const [dep, framework] of Object.entries(frameworkMap)) {
    if (allDeps[dep]) {
      clues.push({ dependency: dep, framework, confidence: 'high' });
    }
  }

  return clues;
}

/**
 * Extract environment variable names from file content.
 * Only captures NAME, never values.
 */
export function extractEnvVarNames(content) {
  const envVars = new Set();

  // process.env.VAR_NAME
  const processEnv = content.matchAll(/process\.env\.([A-Z_][A-Z0-9_]*)/g);
  for (const m of processEnv) envVars.add(m[1]);

  // import.meta.env.VITE_VAR
  const importMetaEnv = content.matchAll(/import\.meta\.env\.([A-Z_][A-Z0-9_]*)/g);
  for (const m of importMetaEnv) envVars.add(m[1]);

  // os.environ["VAR"] or os.environ.get("VAR"[, default])
  const osEnv = content.matchAll(/os\.environ(?:\[["']([A-Z_][A-Z0-9_]*)["']\]|\.get\(["']([A-Z_][A-Z0-9_]*)["'](?:,\s*[^)]*)?\))/g);
  for (const m of osEnv) envVars.add(m[1] || m[2]);

  // os.getenv("VAR"[, default])
  const osGetenv = content.matchAll(/os\.getenv\(["']([A-Z_][A-Z0-9_]*)["'](?:,\s*[^)]*)?\)/g);
  for (const m of osGetenv) envVars.add(m[1]);

  // Env["VAR"] in C#
  const csharpEnv = content.matchAll(/Env\["([A-Z_][A-Z0-9_]*)"\]/g);
  for (const m of csharpEnv) envVars.add(m[1]);

  return [...envVars];
}

/**
 * Extract URLs from content (external API references).
 */
export function extractUrls(content) {
  const urls = new Set();
  const urlPattern = /["'`](https?:\/\/[a-zA-Z0-9._/~:@!$&'()*+,;=%?-]+)["'`]/g;
  let m;
  while ((m = urlPattern.exec(content)) !== null) {
    // Skip common non-API URLs
    const url = m[1];
    if (!url.includes('example.com') && !url.includes('localhost')) {
      urls.add(url);
    }
  }
  return [...urls];
}

/**
 * Compute file size in bytes safely.
 */
export function getFileSize(filePath) {
  try {
    return statSync(filePath).size;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Phase 4C.1A (Collector v2) — Mechanical relevance flags
// ---------------------------------------------------------------------------

/**
 * Mechanically observable path conventions per flag. These are OBSERVATIONS,
 * not semantic relevance decisions (D-017): flagged files remain fully in the
 * inventory and no interpretation is attached. Directory rules match path
 * SEGMENTS only — never filename stems — so a production module such as
 * `tools.py` is not flagged as automation.
 */
const TEST_DIR_SEGMENTS = new Set([
  'test', 'tests', '__tests__', 'spec', 'specs', 'testing',
]);
const GENERATED_DIR_SEGMENTS = new Set([
  'dist', 'build', 'coverage', 'out', '.next', '.output', '.vercel',
  '.nuxt', '.svelte-kit', 'generated', '__generated__',
]);
const AUTOMATION_DIR_SEGMENTS = new Set([
  'scripts', 'automation', 'tools', 'ci', 'bin', '.github', '.gitlab', '.circleci',
]);
const DOCS_DIR_SEGMENTS = new Set(['docs', 'documentation']);
const DOC_EXTENSIONS = new Set(['.md', '.mdx', '.rst']);

/**
 * Single classification function for mechanical relevance flags (B3: no
 * duplicated logic across collectors). Deterministic, path/type-based only.
 *
 * @param {string} relPath Repository-relative path with '/' separators.
 * @returns {{ flags: {is_test_like: boolean, is_generated_like: boolean,
 *   is_documentation_like: boolean, is_automation_like: boolean},
 *   reasons: Record<string, string[]> }} Reasons exist only for true flags,
 *   in compact `kind:value` form (e.g. `path_segment:tests`,
 *   `filename_pattern:*.test`, `extension:.md`).
 */
export function getMechanicalFlags(relPath) {
  const flags = {
    is_test_like: false,
    is_generated_like: false,
    is_documentation_like: false,
    is_automation_like: false,
  };
  const reasons = {};

  const normalized = relPath.split('\\').join('/');
  const segments = normalized.split('/');
  const dirs = segments.slice(0, -1);
  const filename = segments[segments.length - 1] || '';
  const ext = filename.includes('.') ? '.' + filename.split('.').pop() : '';

  const flag = (name, reason) => {
    flags[name] = true;
    (reasons[name] = reasons[name] || []).push(reason);
  };

  for (const seg of dirs) {
    if (TEST_DIR_SEGMENTS.has(seg)) flag('is_test_like', `path_segment:${seg}`);
    if (GENERATED_DIR_SEGMENTS.has(seg)) flag('is_generated_like', `path_segment:${seg}`);
    if (DOCS_DIR_SEGMENTS.has(seg)) flag('is_documentation_like', `path_segment:${seg}`);
    if (AUTOMATION_DIR_SEGMENTS.has(seg)) flag('is_automation_like', `path_segment:${seg}`);
  }

  if (/^test_.+\.(py|js|ts|tsx|jsx|mjs|cjs)$/.test(filename)) {
    flag('is_test_like', 'filename_pattern:test_*');
  }
  if (/.+_test\.(py|js|ts|go|rs|mjs|cjs)$/.test(filename)) {
    flag('is_test_like', 'filename_pattern:*_test');
  }
  if (/\.(test|spec)\.(js|jsx|ts|tsx|mjs|cjs)$/.test(filename)) {
    flag('is_test_like', `filename_pattern:*.${filename.split('.').slice(-2).join('.')}`);
  }
  if (filename === 'conftest.py') {
    flag('is_test_like', 'filename:conftest.py');
  }

  if (/\.(gen|generated)\.(js|jsx|ts|tsx|mjs|cjs)$/.test(filename)) {
    flag('is_generated_like', `filename_pattern:*.${filename.split('.').slice(-2).join('.')}`);
  }
  if (/\.min\.(js|css)$/.test(filename)) {
    flag('is_generated_like', 'filename_pattern:*.min');
  }

  if (DOC_EXTENSIONS.has(ext)) {
    flag('is_documentation_like', `extension:${ext}`);
  }

  return { flags, reasons };
}
