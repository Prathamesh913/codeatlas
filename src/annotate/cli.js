#!/usr/bin/env node
// CodeAtlas Phase 4C.1B — Annotation CLI (guarded entry).
//
// Usage:
//   node src/annotate/cli.js <evidence-dir> [output-dir] [repo-root]
//
//   evidence-dir  directory containing the collector's files.json
//   output-dir    destination root; writes <output-dir>/annotation/  (default:
//                 sibling "annotation" of the evidence directory's parent)
//   repo-root     repository root; defaults to the evidence manifest's
//                 target_root

import { dirname, join, resolve } from 'node:path';
import { annotate, ANNOTATOR_NAME, ANNOTATOR_VERSION } from './index.js';

const args = process.argv.slice(2);

if (args.length < 1 || args[0] === '--help' || args[0] === '-h') {
  console.log(`Usage: node src/annotate/cli.js <evidence-dir> [output-dir] [repo-root]`);
  process.exit(args.length < 1 ? 1 : 0);
}

const evidenceDir = resolve(args[0]);
const outputDir = args[1] ? resolve(args[1]) : join(dirname(dirname(evidenceDir)), 'annotation');
const repoRoot = args[2] ? resolve(args[2]) : null;

console.log(`${ANNOTATOR_NAME} v${ANNOTATOR_VERSION}`);
console.log(`  evidence: ${evidenceDir}`);
const result = annotate(evidenceDir, repoRoot, outputDir);
console.log(`  output:   ${join(outputDir, 'annotation')}`);
const { summary } = result.files;
console.log(`  files:    ${summary.total_files} (${Object.entries(summary.by_relevance_class).map(([k, v]) => `${k}=${v}`).join(', ')})`);
const s = result.strings.summary;
console.log(`  strings:  ${s.total_strings} (${Object.entries(s.by_classification).map(([k, v]) => `${k}=${v}`).join(', ')})`);
