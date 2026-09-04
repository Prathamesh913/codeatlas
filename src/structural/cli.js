// CodeAtlas Phase 4A — CLI entry point (guarded so it does not run on import).

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { runPhase4A } from './index.js';

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: node src/structural/cli.js <evidence-dir> [output-dir]');
    console.error('');
    console.error('  evidence-dir  Directory with Phase 3 evidence JSON (files.json, imports.json, ...)');
    console.error('  output-dir    Directory under which `structural/` is written (default: <evidence-dir>/..)');
    process.exit(1);
  }

  const evidenceDir = resolve(args[0]);
  const outputDir = args[1] ? resolve(args[1]) : resolve(evidenceDir, '..');

  if (!existsSync(evidenceDir)) {
    console.error(`Error: evidence dir does not exist: ${evidenceDir}`);
    process.exit(1);
  }

  const res = runPhase4A(evidenceDir, outputDir);
  const s = res.manifest.summary;
  const a = res.analysis;

  console.log(`CodeAtlas Structural Graph Builder v${res.manifest.version}`);
  console.log(`Evidence: ${evidenceDir}`);
  console.log(`Output:   ${res.outputDir}`);
  console.log('');
  console.log(`Nodes:    ${s.nodes} (files ${s.file_nodes}, external ${s.external_nodes}, unresolved ${s.unresolved_nodes}, entry ${s.entry_nodes})`);
  console.log(`Edges:    ${s.edges} (imports ${s.imports_edges}, references ${s.references_edges}, declares ${s.declares_edges}, entrypoint ${s.entrypoint_edges})`);
  console.log(`Units:    ${res.units.length}`);
  console.log(`Components: ${s.components} | Orphans: ${s.orphans} | Hubs: ${s.hubs} | Cycles: ${s.cycles} | Bridges: ${s.bridges}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
