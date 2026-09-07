#!/usr/bin/env node
// CodeAtlas — portable post-fix evaluation workflow.
//
// Runs the full validated pipeline against a repository (read-only) and adds
// a deterministic evaluation layer on top:
//
//   node bin/codeatlas-evaluate.js <repository-path> --output <directory> [--rerun]
//
// Output layout (all under <directory>):
//   canonical/ markdown/ evidence/ ...   the standard CodeAtlas map
//   evaluation/evaluation-summary.json   machine-readable summary
//   evaluation/evaluation-report.md      human-readable report
//
// Exit codes: 0 = evaluation complete, all integrity checks pass;
// 2 = evaluation complete but integrity/validation failures were found;
// 1 = usage or runtime error. No network, no model runtime, no timestamps.

import { statSync, mkdirSync, readFileSync, writeFileSync, readdirSync, mkdtempSync, rmSync, realpathSync } from 'node:fs';
import { resolve, join, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import { collect } from '../src/collect.js';
import { annotate } from '../src/annotate/index.js';
import { runPhase4A } from '../src/structural/index.js';
import { runInvestigation } from '../src/investigate/index.js';
import { runResolution } from '../src/semantic/index.js';
import { runConsolidation } from '../src/consolidate/index.js';
import { runCanonical, buildReverseFileIndex } from '../src/canonical/index.js';
import { render } from '../src/project/render.js';
import { summarizeMap, renderReport, TOOL, VERSION } from '../src/evaluate/summarize.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(HERE, '..', 'package.json'));
const PKG = require(join(HERE, '..', 'package.json'));

const HELP = `codeatlas-evaluate ${VERSION} (CodeAtlas ${PKG.version}) — portable post-fix evaluation
Runs the CodeAtlas map plus deterministic evaluation reports. The analyzed
repository is never modified.

Usage:
  node bin/codeatlas-evaluate.js <repository-path> --output <directory> [--rerun]
  node bin/codeatlas-evaluate.js --help
  node bin/codeatlas-evaluate.js --version

  --output <directory>  where to write the map and evaluation/ reports (required)
  --rerun               run the pipeline twice and byte-compare canonical artifacts
  --help, -h            show this message
  --version, -V         show the version

Exit codes:
  0  evaluation complete, all integrity checks pass
  2  evaluation complete, but integrity/validation failures were found
  1  usage or runtime error

Examples:
  node bin/codeatlas-evaluate.js ./my-app --output ./eval-my-app
  node bin/codeatlas-evaluate.js ./my-app --output ./eval-my-app --rerun

Share back: evaluation/evaluation-summary.json and evaluation-report.md
(optionally the whole output directory).
`;

function fail(message, code = 1) {
  process.stderr.write(`codeatlas-evaluate: error: ${message}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const out = { repo: null, output: null, rerun: false, help: false, version: false };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--version' || a === '-V') out.version = true;
    else if (a === '--output') {
      const v = argv[++i];
      if (!v) fail('--output requires a directory argument');
      out.output = v;
    } else if (a === '--rerun') out.rerun = true;
    else if (a.startsWith('-')) fail(`unknown option '${a}'. See --help.`);
    else rest.push(a);
  }
  if (rest.length > 1) fail('expected at most one <repository-path>. See --help.');
  if (rest.length === 1) out.repo = rest[0];
  return out;
}

function snapshotTree(dir) {
  const out = {};
  const walk = (d, prefix = '') => {
    for (const ent of readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
      if (ent.isDirectory()) walk(join(d, ent.name), rel);
      else out[rel] = readFileSync(join(d, ent.name), 'utf-8').length;
    }
  };
  walk(dir);
  return out;
}

async function runPipeline(repoPath, outputDir, quiet) {
  const step = (label) => { if (!quiet) process.stdout.write(`codeatlas-evaluate: ${label}...\n`); };
  const evidenceDir = join(outputDir, 'evidence', 'evidence');
  step('collecting evidence');
  await collect(repoPath, join(outputDir, 'evidence'));
  step('classifying text and relevance');
  annotate(evidenceDir, repoPath, outputDir);
  step('building structure');
  await runPhase4A(evidenceDir, outputDir);
  step('investigating units');
  await runInvestigation({ evidenceDir, structuralDir: join(outputDir, 'structural'), repoRoot: repoPath, outputDir });
  step('resolving semantics');
  await runResolution({ evidenceDir, structuralDir: join(outputDir, 'structural'), investigationDir: join(outputDir, 'investigation'), repoRoot: repoPath, outputDir });
  step('consolidating');
  runConsolidation({
    evidenceDir, annotationDir: join(outputDir, 'annotation'), structuralDir: join(outputDir, 'structural'),
    investigationDir: join(outputDir, 'investigation'), semanticDir: join(outputDir, 'semantic'), outputDir,
  });
  step('resolving names and inspecting');
  runCanonical({
    evidenceDir, annotationDir: join(outputDir, 'annotation'), structuralDir: join(outputDir, 'structural'),
    investigationDir: join(outputDir, 'investigation'), semanticDir: join(outputDir, 'semantic'),
    consolidationDir: join(outputDir, 'consolidation'), repoRoot: repoPath, outputDir,
  });
  step('rendering docs');
  render({ canonicalDir: join(outputDir, 'canonical'), outputDir });
}

const read = (dir, name) => JSON.parse(readFileSync(join(dir, 'canonical', name), 'utf-8'));

// Canonical artifacts compared by the --rerun determinism check.
// canonical-report.json is excluded: it embeds input/output paths, the only
// provenance line that differs between runs.
const COMPARE_FILES = ['features.json', 'systems.json', 'unresolved.json', 'relationships.json', 'files.json'];

export async function evaluate({ repoPath, outputDir, rerun = false, quiet = false }) {
  let stat;
  try {
    stat = statSync(repoPath);
  } catch {
    throw new Error(`repository path '${repoPath}' does not exist.`);
  }
  if (!stat.isDirectory()) throw new Error(`repository path '${repoPath}' is not a directory.`);
  mkdirSync(outputDir, { recursive: true });

  const before = snapshotTree(repoPath);
  await runPipeline(repoPath, outputDir, quiet);
  const after = snapshotTree(repoPath);
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    throw new Error('analyzed repository was modified during the run; aborting evaluation.');
  }

  const canonical = {
    features: read(outputDir, 'features.json').features || [],
    systems: read(outputDir, 'systems.json').systems || [],
    unresolved: read(outputDir, 'unresolved.json').entities || [],
    relationships: read(outputDir, 'relationships.json').relationships || [],
    files: read(outputDir, 'files.json').files || [],
  };

  // Determinism check 1: rebuild the reverse index from entity membership
  // and compare with the files.json written by the pipeline.
  const relevanceByFile = new Map(canonical.files.map((f) => [f.path, f]));
  const rebuilt = buildReverseFileIndex({
    features: canonical.features,
    systems: canonical.systems,
    inventoryPaths: canonical.files.map((f) => f.path),
    relevanceByFile,
  });
  const stripRoles = (list) => list.map((f) => ({ path: f.path, features: f.features, systems: f.systems }));
  const rebuild_identical = JSON.stringify(stripRoles(rebuilt)) === JSON.stringify(stripRoles(canonical.files));

  // Determinism check 2 (opt-in): full pipeline rerun + byte comparison.
  let rerun_performed = false;
  let rerun_identical = null;
  if (rerun) {
    rerun_performed = true;
    const second = mkdtempSync(join(tmpdir(), 'codeatlas-eval-rerun-'));
    try {
      await runPipeline(repoPath, second, true);
      rerun_identical = COMPARE_FILES.every((n) =>
        readFileSync(join(outputDir, 'canonical', n), 'utf-8') === readFileSync(join(second, 'canonical', n), 'utf-8'));
    } finally {
      rmSync(second, { recursive: true, force: true });
    }
  }

  const summary = summarizeMap({
    canonical,
    meta: {
      codeatlas_version: PKG.version,
      repo_label: repoPath,
      output_label: outputDir,
      determinism: { rebuild_identical, rerun_performed, rerun_identical },
    },
  });

  const evalDir = join(outputDir, 'evaluation');
  mkdirSync(evalDir, { recursive: true });
  writeFileSync(join(evalDir, 'evaluation-summary.json'), JSON.stringify(summary, null, 2) + '\n', 'utf-8');
  writeFileSync(join(evalDir, 'evaluation-report.md'), renderReport(summary), 'utf-8');
  return summary;
}

export function exitCodeFor(summary) {
  if (!summary) return 1;
  return summary.reverse_index_integrity.ok && summary.canonical_integrity.ok ? 0 : 2;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(HELP);
    return;
  }
  if (args.version) {
    process.stdout.write(`${VERSION} (CodeAtlas ${PKG.version})\n`);
    return;
  }
  if (!args.repo) fail('missing <repository-path>. See --help.');
  if (!args.output) fail('missing --output <directory>. See --help.');
  const repoPath = resolve(args.repo);
  const outputDir = resolve(args.output);
  const summary = await evaluate({ repoPath, outputDir, rerun: args.rerun });
  const c = summary.counts;
  process.stdout.write(
    `codeatlas-evaluate: done — ${c.features} features, ${c.systems} systems, ` +
    `${c.unresolved_total} unresolved, ${c.relationships_total} relationships, ` +
    `${c.files_with_empty_associations} empty-association files\n` +
    `codeatlas-evaluate: reverse index ${summary.reverse_index_integrity.ok ? 'OK' : 'FAILED'}; ` +
    `canonical integrity ${summary.canonical_integrity.ok ? 'OK' : 'FAILED'}\n` +
    `codeatlas-evaluate: reports written to ${join(outputDir, 'evaluation')}\n`
  );
  if (!summary.reverse_index_integrity.ok || !summary.canonical_integrity.ok) process.exitCode = exitCodeFor(summary);
}

const invokedAsScript = (() => {
  try {
    // realpathSync: npm installs bin entries as symlinks; argv[1] may be the
    // symlink path while import.meta.url is the real path.
    return !!process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
})();
if (invokedAsScript) {
  main().catch((err) => fail(err && err.message ? err.message : String(err)));
}

export { TOOL, VERSION };
