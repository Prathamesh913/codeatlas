// CodeAtlas Phase 5A — unified CLI tests (spawn the real executable).
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, cpSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, '..', '..', 'bin', 'codeatlas.js');
const FIXTURE = join(HERE, '..', 'fixtures', 'smoke-react-app');
const PKG = JSON.parse(readFileSync(join(HERE, '..', '..', 'package.json'), 'utf-8'));

const run = (args, opts = {}) => execFileSync('node', [CLI, ...args], { encoding: 'utf-8', timeout: 120000, ...opts });

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

describe('codeatlas CLI — help and version', () => {
  it('--help exits 0 and documents usage and --output', () => {
    const out = run(['--help']);
    assert.match(out, /Usage:[\s\S]*codeatlas <repository-path>/);
    assert.match(out, /--output/);
    assert.match(out, /--version/);
  });
  it('--version agrees with package.json', () => {
    assert.equal(run(['--version']).trim(), PKG.version);
  });
});

describe('codeatlas CLI — failure behavior', () => {
  it('invalid repository path exits non-zero with a clear message', () => {
    assert.throws(() => run(['/does/not/exist-xyz']), /does not exist/);
  });
  it('a file (not a directory) as repository exits non-zero', () => {
    assert.throws(() => run([join(FIXTURE, 'src', 'App.tsx')]), /not a directory/);
  });
  it('missing repository path exits non-zero', () => {
    assert.throws(() => run([]), /missing <repository-path>/);
  });
});

describe('codeatlas CLI — full run on a fixture copy', () => {
  const work = mkdtempSync(join(tmpdir(), 'codeatlas-cli-'));
  const repo = join(work, 'repo');
  cpSync(FIXTURE, repo, { recursive: true });
  const beforeTree = snapshotTree(repo);
  const out = run([repo]);

  it('reports progress and a summary with the output directory', () => {
    assert.match(out, /codeatlas: done — \d+ features, \d+ systems/);
    assert.match(out, /output written to/);
  });
  it('writes canonical JSON and Markdown projections to .codeatlas by default', () => {
    for (const name of ['features.json', 'systems.json', 'unresolved.json', 'relationships.json', 'files.json']) {
      const doc = JSON.parse(readFileSync(join(repo, '.codeatlas', 'canonical', name), 'utf-8'));
      assert.ok(doc, `${name} parses`);
    }
    assert.ok(existsSync(join(repo, '.codeatlas', 'markdown', 'INDEX.md')));
  });
  it('does not modify the analyzed repository sources', () => {
    const stripCodeatlas = (tree) => Object.fromEntries(Object.entries(tree).filter(([k]) => !k.startsWith('.codeatlas/')));
    assert.deepEqual(stripCodeatlas(snapshotTree(repo)), beforeTree);
  });
  it('--output redirects all output to a custom directory', () => {
    const custom = join(work, 'custom-out');
    run([repo, '--output', custom]);
    assert.ok(existsSync(join(custom, 'canonical', 'features.json')));
    assert.ok(existsSync(join(custom, 'markdown', 'INDEX.md')));
  });
  it('reruns are deterministic (canonical artifacts byte-identical)', () => {
    const out2 = join(work, 'rerun-out');
    run([repo, '--output', out2]);
    for (const name of ['features.json', 'systems.json', 'relationships.json']) {
      const a = readFileSync(join(work, 'custom-out', 'canonical', name), 'utf-8');
      const b = readFileSync(join(out2, 'canonical', name), 'utf-8');
      assert.equal(a, b, `${name} byte-identical across CLI reruns`);
    }
  });
});
