// CodeAtlas Phase 3 — File Discovery Collector

import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  shouldExclude, getLanguage, getFileType, getFileSize,
  getMechanicalFlags, safeReadFile, SOURCE_EXTENSIONS, CONFIG_EXTENSIONS,
} from '../utils.js';

/**
 * Discover all files in a directory tree, respecting exclusion rules.
 * Returns { files, exclusions } where files is an array of file entries
 * and exclusions documents what was skipped and why.
 */
export function discoverFiles(root) {
  const files = [];
  const exclusions = [];

  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        if (shouldExclude(entry.name)) {
          exclusions.push({
            path: relative(root, fullPath),
            reason: `excluded directory: ${entry.name}`,
          });
          continue;
        }
        walk(fullPath);
      } else if (entry.isFile()) {
        const relPath = relative(root, fullPath);
        const language = getLanguage(fullPath);
        const fileType = getFileType(fullPath);
        const size = getFileSize(fullPath);
        // Phase 4C.1A: mechanical relevance flags (observations only — the
        // file remains fully included in the inventory).
        const mechanical = getMechanicalFlags(relPath);

        files.push({
          path: relPath,
          extension: entry.name.includes('.') ? '.' + entry.name.split('.').pop() : '',
          language,
          type: fileType,
          size,
          included: true,
          excluded_reason: null,
          relevance_flags: mechanical.flags,
          relevance_reasons: mechanical.reasons,
        });
      }
    }
  }

  walk(root);
  return { files, exclusions };
}

/**
 * Classify files into source files that can be parsed for imports/symbols,
 * and non-source files (config, assets, etc.).
 */
export function classifyFiles(files) {
  const source = [];
  const config = [];
  const other = [];

  for (const file of files) {
    if (file.language && SOURCE_EXTENSIONS[file.extension]) {
      source.push(file);
    } else if (
      CONFIG_EXTENSIONS.has(file.extension) ||
      file.type.includes('config') ||
      file.type.includes('manifest') ||
      file.type === 'JSON'
    ) {
      config.push(file);
    } else {
      other.push(file);
    }
  }

  return { source, config, other };
}
