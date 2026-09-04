// CodeAtlas Phase 5A — documentation consistency tests.
// Documentation must agree with the implementation: no stale promises,
// no missing contract references, version metadata in agreement.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf-8');

describe('docs — README honesty', () => {
  const readme = read('README.md');
  it('does not promise flows.json as a generated artifact', () => {
    const withoutLimitation = readme
      .split('\n')
      .filter((line) => !/not currently generated|no call-chain|rather than fabricat/i.test(line))
      .join('\n');
    assert.ok(!/flows\.json/.test(withoutLimitation), 'README must not promise flows.json');
  });
  it('documents the real CLI invocation and output option', () => {
    assert.match(readme, /codeatlas <repository-path>/);
    assert.match(readme, /--output/);
    assert.match(readme, /--help/);
  });
  it('states the maturity honestly', () => {
    assert.match(readme, /[Pp]rivate beta|[Ee]xperimental/);
  });
  it('does not claim universal language support or perfect understanding', () => {
    assert.ok(!/understands (any|all|every)|perfect(ly)? understands|supports all languages|any programming language/i.test(readme));
  });
  it('states that source repositories are never modified', () => {
    assert.match(readme, /never modified/i);
  });
});

describe('docs — SKILL.md pipeline coverage', () => {
  const skill = read('SKILL.md');
  for (const stage of ['Collector', 'Annotation', '4A', '4B.1', '4B.2', 'Consolidat', 'Canonical', 'project']) {
    it(`covers ${stage}`, () => {
      assert.ok(skill.includes(stage), `SKILL.md must document ${stage}`);
    });
  }
});

describe('docs — examples consistency', () => {
  it('sample-output contains no flows.json and matches current artifact names', () => {
    assert.ok(!existsSync(join(ROOT, 'examples', 'sample-output', 'flows.json')));
    assert.ok(!existsSync(join(ROOT, 'examples', 'sample-output', 'FEATURE_MAP.md')));
    for (const name of ['features.json', 'systems.json', 'unresolved.json', 'relationships.json', 'files.json']) {
      assert.ok(existsSync(join(ROOT, 'examples', 'sample-output', name)), `${name} present`);
    }
  });
  it('sample-output JSON parses and has the canonical shapes', () => {
    const dir = join(ROOT, 'examples', 'sample-output');
    const features = JSON.parse(readFileSync(join(dir, 'features.json'), 'utf-8')).features;
    const systems = JSON.parse(readFileSync(join(dir, 'systems.json'), 'utf-8')).systems;
    assert.ok(Array.isArray(features) && Array.isArray(systems));
  });
  it('minimal walkthrough exists with the required sections', () => {
    const doc = read('examples/minimal/README.md');
    for (const section of ['command invocation', 'feature', 'relationship', 'system', 'uncertainty', 'evidence']) {
      assert.ok(doc.toLowerCase().includes(section), `minimal README covers ${section}`);
    }
  });
});

describe('docs — package metadata agreement', () => {
  const pkg = JSON.parse(read('package.json'));
  it('version is a 0.5.x beta version', () => {
    assert.match(pkg.version, /^0\.5\./);
  });
  it('bin entry exists and the executable file is present', () => {
    assert.ok(pkg.bin && pkg.bin.codeatlas, 'bin.codeatlas declared');
    assert.ok(existsSync(join(ROOT, pkg.bin.codeatlas)), 'bin file exists');
  });
  it('license is explicit (not TBD)', () => {
    assert.ok(pkg.license && pkg.license !== 'TBD');
    assert.ok(existsSync(join(ROOT, 'LICENSE')), 'LICENSE file present');
  });
  it('files whitelist excludes tests, fixtures, and evidence caches', () => {
    assert.ok(Array.isArray(pkg.files), 'files whitelist present');
    const joined = pkg.files.join(' ');
    assert.ok(!/tests|fixtures|evidence-cache/.test(joined), 'no test/fixture/evidence paths whitelisted');
  });
  it('no repository URL is invented', () => {
    assert.ok(!pkg.repository || !/placeholder|example\.com|todo/i.test(JSON.stringify(pkg.repository)));
  });
});
