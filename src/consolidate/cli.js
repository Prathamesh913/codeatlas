// CodeAtlas Phase 4C.2 — guarded CLI
//
// Usage:
//   node src/consolidate/cli.js <evidence-dir> <annotation-dir> <structural-dir> \
//        <investigation-dir> <semantic-dir> [output-dir]
//
// Writes <output-dir>/consolidation/*. Writes nothing else; reads repositories
// never (all inputs are produced artifacts).

import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { runConsolidation } from './index.js';

function main() {
  const args = process.argv.slice(2);
  if (args.length < 5) {
    console.error('Usage: node src/consolidate/cli.js <evidence-dir> <annotation-dir> <structural-dir> <investigation-dir> <semantic-dir> [output-dir]');
    process.exit(1);
  }
  const [evidenceDir, annotationDir, structuralDir, investigationDir, semanticDir] = args.map((a) => resolve(a));
  const outputDir = args[5] ? resolve(args[5]) : process.cwd();
  const result = runConsolidation({ evidenceDir, annotationDir, structuralDir, investigationDir, semanticDir, outputDir });
  console.log(JSON.stringify(result.report.counts, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
