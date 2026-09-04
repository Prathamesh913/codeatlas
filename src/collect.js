// CodeAtlas Phase 3 — Main Orchestrator

import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverFiles, classifyFiles } from './collectors/files.js';
import { collectImports } from './collectors/imports.js';
import { collectSymbols } from './collectors/symbols.js';
import { collectEntryPoints } from './collectors/entrypoints.js';
import { collectConfig } from './collectors/config.js';
import { collectRepositoryMetadata } from './collectors/metadata.js';

/**
 * Run the full evidence collection pipeline against a target directory.
 *
 * @param {string} targetPath - Absolute path to the repository root
 * @param {string} outputPath - Absolute path where evidence JSON should be written
 * @returns {object} Collection summary
 */
export async function collect(targetPath, outputPath) {
  const root = resolve(targetPath);
  const startTime = Date.now();

  // Ensure output directory exists
  mkdirSync(join(outputPath, 'evidence'), { recursive: true });

  // Step 1: Discover files
  const { files, exclusions } = discoverFiles(root);

  // Step 2: Classify files
  const classified = classifyFiles(files);

  // Step 3: Collect repository metadata
  const repository = collectRepositoryMetadata(root, files);

  // Step 4: Collect imports
  const { imports, errors: importErrors } = collectImports(classified, root);

  // Step 5: Collect symbols
  const { symbols, errors: symbolErrors } = collectSymbols(classified, root);

  // Step 6: Collect entry points
  const entrypoints = collectEntryPoints(root);

  // Step 7: Collect config/dependency evidence
  const config = collectConfig(classified, root);

  // Step 8: Build manifest
  const manifest = {
    tool: 'codeatlas-evidence-collector',
    version: '0.4.0',
    target_root: root,
    collected_at: new Date().toISOString(),
    duration_ms: Date.now() - startTime,
    summary: {
      files_discovered: files.length,
      files_included: files.filter(f => f.included).length,
      files_excluded: exclusions.length,
      source_files: classified.source.length,
      config_files: classified.config.length,
      other_files: classified.other.length,
      imports_captured: imports.length,
      symbols_captured: symbols.length,
      entry_points_found: entrypoints.length,
      env_vars_found: config.env_vars.length,
      urls_found: config.urls.length,
      framework_clues: repository.framework_clues.length,
      errors: importErrors.length + symbolErrors.length,
    },
    exclusions,
    errors: [...importErrors, ...symbolErrors],
  };

  // Step 9: Write evidence JSON files
  writeEvidenceJson(outputPath, 'manifest.json', manifest);
  writeEvidenceJson(outputPath, 'repository.json', repository);
  writeEvidenceJson(outputPath, 'files.json', files);
  writeEvidenceJson(outputPath, 'imports.json', imports);
  writeEvidenceJson(outputPath, 'symbols.json', symbols);
  writeEvidenceJson(outputPath, 'entrypoints.json', entrypoints);
  writeEvidenceJson(outputPath, 'config.json', config);

  return manifest;
}

/**
 * Write a JSON evidence file.
 */
function writeEvidenceJson(outputPath, filename, data) {
  const filePath = join(outputPath, 'evidence', filename);
  writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

/**
 * CLI entry point.
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error('Usage: node src/collect.js <target-path> [output-path]');
    console.error('');
    console.error('Arguments:');
    console.error('  target-path   Path to the repository to analyze');
    console.error('  output-path   Where to write evidence JSON (default: <target-path>/.codeatlas)');
    process.exit(1);
  }

  const targetPath = resolve(args[0]);
  const outputPath = args[1] ? resolve(args[1]) : join(targetPath, '.codeatlas');

  if (!existsSync(targetPath)) {
    console.error(`Error: target path does not exist: ${targetPath}`);
    process.exit(1);
  }

  console.log(`CodeAtlas Evidence Collector v0.4.0`);
  console.log(`Target: ${targetPath}`);
  console.log(`Output: ${outputPath}`);
  console.log('');

  try {
    const manifest = await collect(targetPath, outputPath);
    const s = manifest.summary;

    console.log('Collection complete.');
    console.log('');
    console.log(`Files discovered:     ${s.files_discovered}`);
    console.log(`  Source files:       ${s.source_files}`);
    console.log(`  Config files:       ${s.config_files}`);
    console.log(`  Other files:        ${s.other_files}`);
    console.log(`  Excluded:           ${s.files_excluded}`);
    console.log(`Imports captured:     ${s.imports_captured}`);
    console.log(`Symbols captured:     ${s.symbols_captured}`);
    console.log(`Entry points found:   ${s.entry_points_found}`);
    console.log(`Env vars found:       ${s.env_vars_found}`);
    console.log(`URLs found:           ${s.urls_found}`);
    console.log(`Framework clues:      ${s.framework_clues}`);
    console.log(`Errors:               ${s.errors}`);
    console.log('');
    console.log(`Duration: ${manifest.duration_ms}ms`);
    console.log(`Evidence written to: ${join(outputPath, 'evidence')}`);
  } catch (err) {
    console.error(`Collection failed: ${err.message}`);
    process.exit(1);
  }
}

// Only run the CLI when this module is executed directly (not when imported).
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
