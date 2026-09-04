// CodeAtlas Phase 4C.1B — Annotation Orchestrator
//
// Reads raw Collector v2 evidence (files.json) and produces an ANNOTATED
// evidence artifact — a separate, additive layer:
//
//   annotation/
//   ├── files.json    — per-file semantic relevance class + policy + verbatim
//   │                   copy of the collector's mechanical flags
//   └── strings.json  — per-string UI classification (D-016) with provenance
//
// Hard boundaries:
//   - Raw evidence files are never mutated; this layer only reads them.
//   - No recollection: repository files are read only to classify strings
//     with syntactic context (4C.0 Part C), never to re-observe imports,
//     symbols, or entrypoints.
//   - Deterministic: sorted outputs, no timestamps, no random IDs.
//   - Additive: downstream stages (4A/4B.1/4B.2) are untouched and continue
//     to consume raw evidence until deliberately migrated.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { safeReadFile } from '../utils.js';
import { classifyRelevance, RELEVANCE_POLICY } from './relevance.js';
import { classifyString } from './classify.js';
import { extractStrings } from './extract.js';

export const ANNOTATOR_NAME = 'codeatlas-annotator';
export const ANNOTATOR_VERSION = '0.1.0';

const NO_FLAGS = Object.freeze({
  is_test_like: false,
  is_generated_like: false,
  is_documentation_like: false,
  is_automation_like: false,
});

// Strings are classified only for files whose relevance class allows semantic
// participation. Files of the other classes are policy-handled at file level
// (their whole content is zero-weight by the relevance contract); their text
// remains in raw evidence and in the repositories — nothing is deleted.
const STRING_EXTRACTION_CLASSES = new Set(['application', 'supporting']);

/**
 * Run annotation over raw evidence.
 *
 * @param {string} evidenceDir directory containing the collector's files.json
 * @param {string} repoRoot    repository root the evidence was collected from
 * @param {string} outputDir   directory to write the annotation/ artifact into
 * @returns {object} annotation manifest (same object written to disk)
 */
export function annotate(evidenceDir, repoRoot, outputDir) {
  const filesPath = join(evidenceDir, 'files.json');
  if (!existsSync(filesPath)) {
    throw new Error(`annotate: raw evidence not found at ${filesPath}`);
  }
  const raw = JSON.parse(readFileSync(filesPath, 'utf-8'));
  const list = Array.isArray(raw) ? raw : Array.isArray(raw.files) ? raw.files : [];
  if (!repoRoot) {
    const manifest = safeReadFile(join(evidenceDir, 'manifest.json'));
    repoRoot = manifest ? JSON.parse(manifest).target_root : process.cwd();
  }

  const byClass = {};
  for (const c of Object.keys(RELEVANCE_POLICY)) byClass[c] = 0;
  const byClassification = { capability: 0, context: 0, state: 0, incidental: 0 };

  const fileAnnotations = [];
  const stringAnnotations = [];
  let filesUnreadable = 0;
  let filesSkippedExtraction = 0;

  const sorted = [...list].sort((a, b) => a.path.localeCompare(b.path));
  for (const file of sorted) {
    const { relevance_class, relevance_reasons } = classifyRelevance(file);
    byClass[relevance_class] += 1;

    fileAnnotations.push({
      path: file.path,
      language: file.language ?? null,
      relevance_class,
      relevance_reasons,
      mechanical_flags: { ...NO_FLAGS, ...(file.relevance_flags || {}) },
      mechanical_flag_reasons: file.relevance_reasons || {},
      semantic_policy: RELEVANCE_POLICY[relevance_class],
    });

    if (!STRING_EXTRACTION_CLASSES.has(relevance_class) || !file.language) {
      filesSkippedExtraction += 1;
      continue;
    }
    const content = safeReadFile(join(repoRoot, file.path));
    if (content == null) {
      filesUnreadable += 1;
      continue;
    }
    for (const s of extractStrings(content)) {
      const { classification, reason, policy } = classifyString(s.value, s);
      byClassification[classification] += 1;
      stringAnnotations.push({
        file: file.path,
        line: s.line,
        value: s.value,
        context: s.kind,
        element: s.element || null,
        prop: s.prop || null,
        classification,
        reason,
        policy,
      });
    }
  }

  stringAnnotations.sort(
    (a, b) => a.file.localeCompare(b.file) || a.line - b.line ||
      a.value.localeCompare(b.value) || a.context.localeCompare(b.context)
  );

  const result = {
    files: {
      annotated_by: ANNOTATOR_NAME,
      annotator_version: ANNOTATOR_VERSION,
      files: fileAnnotations,
      summary: {
        total_files: fileAnnotations.length,
        by_relevance_class: byClass,
        strings_extracted: stringAnnotations.length,
        files_unreadable: filesUnreadable,
        files_skipped_string_extraction: filesSkippedExtraction,
      },
    },
    strings: {
      annotated_by: ANNOTATOR_NAME,
      annotator_version: ANNOTATOR_VERSION,
      strings: stringAnnotations,
      summary: {
        total_strings: stringAnnotations.length,
        by_classification: byClassification,
        extraction_scope: 'application+supporting source files (file-level policy covers all other classes)',
      },
    },
  };

  const outDir = join(outputDir, 'annotation');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'files.json'), JSON.stringify(result.files, null, 2) + '\n', 'utf-8');
  writeFileSync(join(outDir, 'strings.json'), JSON.stringify(result.strings, null, 2) + '\n', 'utf-8');
  return result;
}
