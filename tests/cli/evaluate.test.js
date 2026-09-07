// CodeAtlas — portable post-fix evaluator tests.
// Covers: CLI behavior, a normal repository, a root-router / weak-token /
// compound-name repository, missing or empty memberships, reverse-index and
// canonical-integrity failures, and deterministic repeated execution.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, cpSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluate } from '../../bin/codeatlas-evaluate.js';
import { exitCodeFor } from '../../bin/codeatlas-evaluate.js';
import { summarizeMap, checkCanonicalIntegrity, detectSuspicious } from '../../src/evaluate/summarize.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const EVAL = join(HERE, '..', '..', 'bin', 'codeatlas-evaluate.js');
const NORMAL = join(HERE, '..', 'fixtures', 'smoke-react-app');
const ROUTER = join(HERE, '..', 'canonical', 'router-config-app');

const run = (args, opts = {}) => execFileSync('node', [EVAL, ...args], { encoding: 'utf-8', timeout: 300000, ...opts });

function snapshotTree(dir) {
  const out = {};
  const walk = (d, prefix = '') => {
    for (const ent of readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
      if (ent.isDirectory()) walk(join(d, ent.name), rel);
      else out[rel] = readFileSync(join(d, ent.name), 'utf-8');
    }
  };
  walk(dir);
  return out;
}

describe('evaluator CLI — help, version, and failure behavior', () => {
  it('--help exits 0 and documents usage, --output, and --rerun', () => {
    const out = run(['--help']);
    assert.match(out, /Usage:/);
    assert.match(out, /<repository-path>/);
    assert.match(out, /--output/);
    assert.match(out, /--rerun/);
  });
  it('--version reports the evaluator version', () => {
    assert.match(run(['--version']), /0\.1\.0/);
  });
  it('invalid repository path exits non-zero with a clear message', () => {
    assert.throws(() => run(['/does/not/exist-xyz', '--output', join(tmpdir(), 'eval-nope')]), /does not exist/);
  });
  it('missing --output exits non-zero', () => {
    assert.throws(() => run([NORMAL]), /missing --output/);
  });
  it('missing repository path exits non-zero', () => {
    assert.throws(() => run(['--output', join(tmpdir(), 'eval-nope')]), /missing <repository-path>/);
  });
});

describe('evaluator — normal repository end to end', () => {
  const work = mkdtempSync(join(tmpdir(), 'codeatlas-eval-'));
  const repo = join(work, 'repo');
  cpSync(NORMAL, repo, { recursive: true });
  const before = snapshotTree(repo);
  const outDir = join(work, 'eval-out');
  const out = run([repo, '--output', outDir, '--rerun']);

  it('reports counts and integrity on stdout and exits 0', () => {
    assert.match(out, /features, \d+ systems/);
    assert.match(out, /reverse index OK/);
    assert.match(out, /reports written to/);
  });
  it('writes the map, the machine-readable summary, and the human-readable report', () => {
    for (const n of ['features.json', 'systems.json', 'unresolved.json', 'relationships.json', 'files.json']) {
      assert.ok(existsSync(join(outDir, 'canonical', n)), n);
    }
    assert.ok(existsSync(join(outDir, 'evaluation', 'evaluation-summary.json')));
    assert.ok(existsSync(join(outDir, 'evaluation', 'evaluation-report.md')));
  });
  it('summary contains every required field', () => {
    const s = JSON.parse(readFileSync(join(outDir, 'evaluation', 'evaluation-summary.json'), 'utf-8'));
    for (const k of ['counts', 'reverse_index_integrity', 'canonical_integrity', 'router_handling', 'entities', 'unresolved', 'validation_failures', 'warnings', 'determinism', 'limitations']) {
      assert.ok(k in s, `summary has ${k}`);
    }
    assert.ok(Number.isInteger(s.counts.tracked_files) && s.counts.tracked_files > 0);
    assert.ok('features' in s.counts && 'systems' in s.counts && 'unresolved_total' in s.counts);
    assert.ok(typeof s.counts.relationships_by_type === 'object');
    assert.ok(Number.isInteger(s.counts.files_with_empty_associations));
    for (const e of s.entities) {
      assert.ok(e.id && e.kind && Array.isArray(e.files), 'entity carries id, kind, and files');
    }
    assert.equal(s.determinism.rerun_performed, true);
    assert.equal(s.determinism.rerun_identical, true);
    assert.equal(s.determinism.rebuild_identical, true);
  });
  it('report covers all required sections', () => {
    const md = readFileSync(join(outDir, 'evaluation', 'evaluation-report.md'), 'utf-8');
    for (const section of ['Repository metadata', 'Canonical entity summary', 'Feature/system classification',
      'Reverse file-to-entity coverage', 'Relationship summary', 'Router handling',
      'Unresolved items', 'Integrity checks', 'Potentially misleading or suspicious patterns',
      'Determinism check', 'Limitations']) {
      assert.ok(md.includes(`## ${section}`), `report has ${section}`);
    }
  });
  it('does not modify the analyzed repository', () => {
    assert.deepEqual(snapshotTree(repo), before);
  });
});

describe('evaluator — root router, weak tokens, compound names', () => {
  const work = mkdtempSync(join(tmpdir(), 'codeatlas-eval-router-'));
  const outDir = join(work, 'eval-out');

  it('runs cleanly and reports router handling with no false ownership', async () => {
    const s = await evaluate({ repoPath: ROUTER, outputDir: outDir, quiet: true });
    assert.ok('topology_edges' in s.router_handling);
    assert.deepEqual(s.router_handling.supports_from_aggregation, [], 'no semantic ownership out of aggregation files');
    assert.deepEqual(s.suspicious_patterns.weak_named_entities, [], 'no weak generic-only entity names');
    assert.equal(s.reverse_index_integrity.ok, true);
    assert.equal(s.canonical_integrity.ok, true);
  });
});

describe('evaluator — missing or empty memberships and integrity failures', () => {
  const meta = { codeatlas_version: 'test', repo_label: 'repo', output_label: 'out', determinism: { rebuild_identical: true, rerun_performed: false, rerun_identical: null } };
  const fileRec = (path, features = [], systems = []) => ({ path, features, systems });

  it('counts files with empty associations and keeps them listed', () => {
    const s = summarizeMap({
      canonical: {
        features: [{ id: 'feature-a', name: 'A', confidence: 'low', primary_files: ['src/a.ts'], supporting_files: [], evidence: [{ observed: 'x' }] }],
        systems: [], unresolved: [], relationships: [],
        files: [fileRec('src/a.ts', ['feature-a']), fileRec('src/lonely.ts')],
      },
      meta,
    });
    assert.equal(s.counts.files_with_empty_associations, 1);
    assert.deepEqual(s.suspicious_patterns.empty_association_files, ['src/lonely.ts']);
    assert.equal(s.reverse_index_integrity.ok, true);
  });

  it('entity references to missing files fail reverse-index integrity', () => {
    const s = summarizeMap({
      canonical: {
        features: [{ id: 'feature-a', name: 'A', confidence: 'low', primary_files: ['src/ghost.ts'], supporting_files: [], evidence: [{ observed: 'x' }] }],
        systems: [], unresolved: [], relationships: [],
        files: [fileRec('src/a.ts')],
      },
      meta,
    });
    assert.equal(s.reverse_index_integrity.ok, false);
    assert.ok(s.reverse_index_integrity.errors.some((e) => /ghost/.test(e)));
    assert.ok(s.validation_failures.length > 0);
  });

  it('file references to missing entities and kind mismatches fail validation', () => {
    const v = checkCanonicalIntegrity({ features: [], systems: [], unresolved: [], relationships: [] });
    assert.equal(v.ok, true);
    const bad = summarizeMap({
      canonical: {
        features: [{ id: 'feature-a', name: 'A', confidence: 'low', primary_files: ['src/a.ts'], supporting_files: [], evidence: [{ observed: 'x' }] }],
        systems: [], unresolved: [], relationships: [],
        files: [fileRec('src/a.ts', [], ['feature-a']), { path: 'src/b.ts', features: ['feature-ghost'], systems: [] }],
      },
      meta,
    });
    assert.equal(bad.reverse_index_integrity.ok, false);
    assert.ok(bad.reverse_index_integrity.errors.some((e) => /mismatch|missing entity/i.test(e)));
  });

  it('dangling relationship endpoints and unknown types fail canonical integrity', () => {
    const v = checkCanonicalIntegrity({
      features: [{ id: 'feature-a', name: 'A', primary_files: ['src/a.ts'], evidence: [{ observed: 'x' }] }],
      systems: [], unresolved: [],
      relationships: [
        { source: 'feature-a', target: 'feature-nowhere', relationship_type: 'USES', evidence: [{ observed: 'e' }] },
        { source: 'feature-a', target: 'feature-a', relationship_type: 'FLOWS_INTO', evidence: [{ observed: 'e' }] },
      ],
    });
    assert.equal(v.ok, false);
    assert.ok(v.failures.some((e) => /feature-nowhere/.test(e)));
    assert.ok(v.failures.some((e) => /FLOWS_INTO/.test(e)));
    assert.ok(v.failures.some((e) => /self-referential/.test(e)));
  });

  it('weak generic-only entity names are flagged; compound names are not', () => {
    const d = detectSuspicious({
      features: [],
      systems: [
        { id: 'system-config', primary_files: ['src/a.ts'] },
        { id: 'system-location-type-config', primary_files: ['src/b.ts'] },
        { id: 'system-scoring-master', primary_files: ['src/c.ts'] },
      ],
      files: [],
      relationships: [],
    });
    assert.deepEqual(d.weak_named_entities, ['system-config']);
  });
});

describe('evaluator — deterministic repeated execution', () => {
  it('two evaluations of the same repository produce identical summaries', async () => {
    const work = mkdtempSync(join(tmpdir(), 'codeatlas-eval-det-'));
    const norm = (s, ...dirs) => {
      let t = JSON.stringify(s);
      for (const d of dirs) t = t.split(d).join('<DIR>');
      return t;
    };
    const a = await evaluate({ repoPath: NORMAL, outputDir: join(work, 'a'), quiet: true });
    const b = await evaluate({ repoPath: NORMAL, outputDir: join(work, 'b'), quiet: true });
    assert.equal(norm(a, join(work, 'a')), norm(b, join(work, 'b')));
  });
  it('exit codes: 0 when integrity passes, 2 when it fails, 1 on no summary', () => {
    assert.equal(exitCodeFor({ reverse_index_integrity: { ok: true }, canonical_integrity: { ok: true } }), 0);
    assert.equal(exitCodeFor({ reverse_index_integrity: { ok: false }, canonical_integrity: { ok: true } }), 2);
    assert.equal(exitCodeFor({ reverse_index_integrity: { ok: true }, canonical_integrity: { ok: false } }), 2);
    assert.equal(exitCodeFor(null), 1);
  });
});
