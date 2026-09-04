// CodeAtlas Phase 3 — Config/Dependency Collector

import { readPackageJson, safeReadFile, extractEnvVarNames, extractUrls, detectFrameworkClues } from '../utils.js';
import { join } from 'node:path';

/**
 * Collect dependency evidence from package.json.
 */
function collectNpmDependencies(root) {
  const pkg = readPackageJson(root);
  if (!pkg) return { dependencies: [], framework_clues: [] };

  const deps = [];

  const sections = [
    { field: 'dependencies', label: 'runtime' },
    { field: 'devDependencies', label: 'dev' },
    { field: 'peerDependencies', label: 'peer' },
    { field: 'optionalDependencies', label: 'optional' },
  ];

  for (const { field, label } of sections) {
    if (pkg[field]) {
      for (const [name, version] of Object.entries(pkg[field])) {
        deps.push({
          name,
          version,
          type: 'npm',
          category: label,
          confidence: 'high',
        });
      }
    }
  }

  const framework_clues = detectFrameworkClues(pkg);

  return { dependencies: deps, framework_clues };
}

/**
 * Collect environment variable and URL evidence from source files.
 */
function collectSourceConfigEvidence(classifiedFiles, root) {
  const envVars = [];
  const urls = [];

  for (const file of classifiedFiles.source) {
    const content = safeReadFile(join(root, file.path));
    if (!content) continue;

    const fileEnvVars = extractEnvVarNames(content);
    for (const name of fileEnvVars) {
      envVars.push({
        name,
        file: file.path,
        confidence: 'high',
      });
    }

    const fileUrls = extractUrls(content);
    for (const url of fileUrls) {
      urls.push({
        url,
        file: file.path,
        confidence: 'high',
      });
    }
  }

  return { env_vars: envVars, urls };
}

/**
 * Collect all config/dependency evidence.
 */
export function collectConfig(classifiedFiles, root) {
  const { dependencies, framework_clues } = collectNpmDependencies(root);
  const { env_vars, urls } = collectSourceConfigEvidence(classifiedFiles, root);

  return {
    dependencies,
    framework_clues,
    env_vars,
    urls,
  };
}
