#!/usr/bin/env node
// CodeAtlas — unified private-beta CLI.
//
// One command runs the full validated pipeline by calling the existing
// stage modules (no duplicated logic):
//
//   codeatlas <repository-path> [--output <directory>]
//
// Output defaults to <repository>/.codeatlas (D-002: CodeAtlas's own data
// directory). Source files in the analyzed repository are never modified.

import { statSync, mkdirSync, readFileSync, existsSync, realpathSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import { collect } from '../src/collect.js';
import { annotate } from '../src/annotate/index.js';
import { runPhase4A } from '../src/structural/index.js';
import { runInvestigation } from '../src/investigate/index.js';
import { runResolution } from '../src/semantic/index.js';
import { runConsolidation } from '../src/consolidate/index.js';
import { runCanonical } from '../src/canonical/index.js';
import { render } from '../src/project/render.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(HERE, '..', 'package.json'));
const PKG = require(join(HERE, '..', 'package.json'));

const HELP = `codeatlas ${PKG.version} — semantic codebase navigation map

Usage:
  codeatlas <repository-path> [--output <directory>]
  codeatlas --help
  codeatlas --version

Generates a semantic map (features, systems, files, relationships) plus
human-readable Markdown docs for the repository at <repository-path>.

  --output <directory>  where to write the map (default: <repository>/.codeatlas)
  --help, -h            show this message
  --version, -V         show the version

Examples:
  codeatlas ./my-app
  codeatlas ./my-app --output ./map-output

The analyzed repository is never modified: all output goes to the output
directory. Markdown is a projection of canonical JSON in the same directory.
`;

function fail(message, code = 1) {
  process.stderr.write(`codeatlas: error: ${message}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const out = { repo: null, output: null, help: false, version: false };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--version' || a === '-V') out.version = true;
    else if (a === '--output') {
      const v = argv[++i];
      if (!v) fail('--output requires a directory argument');
      out.output = v;
    } else if (a.startsWith('-')) {
      fail(`unknown option '${a}'. See codeatlas --help.`);
    } else rest.push(a);
  }
  if (rest.length > 1) fail('expected at most one <repository-path>. See codeatlas --help.');
  if (rest.length === 1) out.repo = rest[0];
  return out;
}

async function run(repoPath, outputDir) {
  let stat;
  try {
    stat = statSync(repoPath);
  } catch {
    fail(`repository path '${repoPath}' does not exist.`);
  }
  if (!stat.isDirectory()) fail(`repository path '${repoPath}' is not a directory.`);
  mkdirSync(outputDir, { recursive: true });

  const step = (label) => process.stdout.write(`codeatlas: ${label}...\n`);
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
  const canonical = runCanonical({
    evidenceDir, annotationDir: join(outputDir, 'annotation'), structuralDir: join(outputDir, 'structural'),
    investigationDir: join(outputDir, 'investigation'), semanticDir: join(outputDir, 'semantic'),
    consolidationDir: join(outputDir, 'consolidation'), repoRoot: repoPath, outputDir,
  });
  step('rendering docs');
  render({ canonicalDir: join(outputDir, 'canonical'), outputDir });

  const c = canonical.report.counts;
  process.stdout.write(
    `codeatlas: done — ${c.features_out} features, ${c.systems_out} systems, ` +
    `${c.ambiguous_out} ambiguous, ${c.unresolved_out + c.demoted_out + c.reclassified_out} unresolved/demoted\n` +
    `codeatlas: output written to ${outputDir}\n`
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(HELP);
    return;
  }
  if (args.version) {
    process.stdout.write(`${PKG.version}\n`);
    return;
  }
  if (!args.repo) fail('missing <repository-path>. See codeatlas --help.');
  const repoPath = resolve(args.repo);
  const outputDir = args.output ? resolve(args.output) : join(repoPath, '.codeatlas');
  await run(repoPath, outputDir);
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
