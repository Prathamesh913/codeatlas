// CodeAtlas Phase 4C.3 — guarded CLI
//
// Usage:
//   node src/canonical/cli.js <annotation-dir> <structural-dir> <investigation-dir> \
//        <semantic-dir> <consolidation-dir> <repo-root> [output-dir]
//
// Writes <output-dir>/canonical/*. Reads repositories only for bounded,
// question-driven VOI inspection.

import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { runCanonical } from './index.js';

function main() {
  const args = process.argv.slice(2);
  if (args.length < 6) {
    console.error('Usage: node src/canonical/cli.js <annotation-dir> <structural-dir> <investigation-dir> <semantic-dir> <consolidation-dir> <repo-root> [output-dir]');
    process.exit(1);
  }
  const [annotationDir, structuralDir, investigationDir, semanticDir, consolidationDir, repoRoot] = args.slice(0, 6).map((a) => resolve(a));
  const outputDir = args[6] ? resolve(args[6]) : process.cwd();
  const result = runCanonical({
    annotationDir, structuralDir, investigationDir, semanticDir, consolidationDir, repoRoot, outputDir,
  }, {});
  console.log(JSON.stringify(result.report.counts, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
