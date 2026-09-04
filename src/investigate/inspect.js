// CodeAtlas Phase 4B.1 — Targeted Source Inspection
//
// Reads only high-information files and extracts semantic clues.
// Distinguishes STRUCTURAL evidence from SOURCE-DERIVED semantic evidence.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { extractClues } from './clues.js';

export function inspectFiles(selected, repoRoot, graph) {
  const results = [];
  for (const sel of selected) {
    const file = sel.file;
    const fullPath = join(repoRoot, file);
    let content = null;
    let readOk = false;
    if (existsSync(fullPath)) {
      try {
        content = readFileSync(fullPath, 'utf-8').slice(0, 20000);
        readOk = true;
      } catch {
        content = null;
      }
    }
    const fileNode = graph.nodes.find((n) => n.id === file) || null;
    const clues = readOk ? extractClues(content, file, fileNode) : [];
    results.push({
      file,
      selection_reasons: sel.reasons,
      read_ok: readOk,
      clues,
    });
  }
  return results;
}
