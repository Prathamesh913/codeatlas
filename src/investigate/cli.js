// CodeAtlas Phase 4B.1 — CLI (guarded)

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { runInvestigation } from './index.js';

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.error('Usage: node src/investigate/cli.js <evidence-dir> <structural-dir> <repo-root> [output-dir]');
    console.error('  evidence-dir    Phase 3 evidence');
    console.error('  structural-dir  Phase 4A structural output (graph/units/analysis)');
    console.error('  repo-root       Source root for targeted file reads');
    console.error('  output-dir      Where to write investigation/ (default: <structural-dir>/.. )');
    process.exit(1);
  }
  const evidenceDir = resolve(args[0]);
  const structuralDir = resolve(args[1]);
  const repoRoot = resolve(args[2]);
  const outputDir = args[3] ? resolve(args[3]) : resolve(structuralDir, '..');
  for (const p of [evidenceDir, structuralDir, repoRoot]) {
    if (!existsSync(p)) { console.error(`Not found: ${p}`); process.exit(1); }
  }
  const res = runInvestigation({ evidenceDir, structuralDir, repoRoot, outputDir });
  const s = res.manifest.summary;
  console.log(`CodeAtlas Semantic Investigator v${res.manifest.version}`);
  console.log(`Output: ${res.outputDir}`);
  console.log(`Candidates: ${s.candidates} (feature ${s.feature_candidates}, system ${s.system_candidates}, ambiguous ${s.ambiguous}, insufficient ${s.insufficient})`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
