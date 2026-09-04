// CodeAtlas Phase 5A — documentation consistency tests.
// Phase 5A2 — GitHub publication: repository file checks, local-link resolution,
// npm-availability honesty, uninstall accuracy, and template sanity.
// Documentation must agree with the implementation: no stale promises,
// no missing contract references, version metadata in agreement.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf-8');

// Honest-absence phrasings: lines that state flows.json is NOT generated are
// permitted; any other flows.json mention is treated as a promise.
const ABSENCE = /not currently generated|no call-chain|rather than fabricat|does not generate|not generate|not generated|not extracted|never generated|part of the model|promises|removed|not.*currently generated/i;
const stripAbsence = (text) =>
  text.split('\n').filter((line) => !ABSENCE.test(line)).join('\n');

describe('docs — README honesty', () => {
  const readme = read('README.md');
  it('does not promise flows.json as a generated artifact', () => {
    const withoutAbsence = stripAbsence(readme);
    assert.ok(!/flows\.json/.test(withoutAbsence), 'README must not promise flows.json');
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
  it('states that npm availability does not exist and must not be claimed', () => {
    assert.match(readme, /Not published on npm/);
    assert.match(readme, /do not work/);
  });
  it('marks the license provisional and release blocked', () => {
    assert.match(readme, /provisional/i);
    assert.match(readme, /owner confirmation|blocked/i);
  });
  it('contains no badges or images (no fake badges)', () => {
    assert.ok(!/!\[/.test(readme), 'README must not embed badge images');
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

describe('docs — flows honesty across all guides', () => {
  const files = [
    'README.md', 'CHANGELOG.md', 'CONTRIBUTING.md',
    'docs/installation.md', 'docs/uninstallation.md', 'docs/usage.md',
    'docs/private-beta.md', 'docs/release-readiness.md',
  ];
  for (const file of files) {
    it(`${file}: every flows.json mention is an absence statement`, () => {
      const text = read(file);
      if (!/flows\.json/.test(text)) return; // no mention at all is fine
      const withoutAbsence = stripAbsence(text);
      assert.ok(!/flows\.json/.test(withoutAbsence), `${file} must not promise flows.json`);
    });
  }
});

describe('docs — local markdown links resolve', () => {
  const LINK = /\]\(([^)#\s]+)(#[^)\s]*)?\)/g;
  const DOC_FILES = [
    'README.md', 'CONTRIBUTING.md', 'SECURITY.md', 'CHANGELOG.md', 'CODE_OF_CONDUCT.md',
    'docs/installation.md', 'docs/uninstallation.md', 'docs/usage.md',
    'docs/private-beta.md', 'docs/release-readiness.md',
    '.github/pull_request_template.md',
    'examples/README.md', 'examples/minimal/README.md',
  ];
  for (const file of DOC_FILES) {
    it(`${file}: local link targets exist`, () => {
      const dir = dirname(join(ROOT, file));
      for (const m of read(file).matchAll(LINK)) {
        const target = m[1];
        if (/^(https?:|mailto:|node:)/i.test(target)) continue;
        const resolved = join(dir, decodeURI(target));
        assert.ok(existsSync(resolved), `${file} -> (${target}) resolves to an existing file`);
      }
    });
  }
});

describe('docs — GitHub project files present', () => {
  for (const file of [
    'CONTRIBUTING.md', 'SECURITY.md', 'CHANGELOG.md', 'CODE_OF_CONDUCT.md',
    '.github/pull_request_template.md', '.github/workflows/ci.yml',
    '.github/ISSUE_TEMPLATE/bug_report.yml',
    '.github/ISSUE_TEMPLATE/feature_request.yml',
    '.github/ISSUE_TEMPLATE/private_beta_feedback.yml',
    '.github/ISSUE_TEMPLATE/documentation.yml',
    'docs/installation.md', 'docs/uninstallation.md', 'docs/usage.md',
    'docs/private-beta.md', 'docs/release-readiness.md',
  ]) {
    it(`${file} exists and is non-empty`, () => {
      assert.ok(existsSync(join(ROOT, file)), `${file} present`);
      assert.ok(read(file).trim().length > 0, `${file} non-empty`);
    });
  }
});

describe('docs — issue templates sanity', () => {
  const TPL = '.github/ISSUE_TEMPLATE';
  it('issue templates are YAML forms (name, description, body; no tabs)', () => {
    for (const file of ['bug_report.yml', 'feature_request.yml', 'private_beta_feedback.yml', 'documentation.yml']) {
      const text = read(join(TPL, file));
      assert.match(text, /^name:/m, `${file} has a name`);
      assert.match(text, /^description:/m, `${file} has a description`);
      assert.match(text, /^body:/m, `${file} has a body`);
      assert.ok(!/\t/.test(text), `${file} contains no tab characters (YAML-safe)`);
    }
  });
  it('bug template asks the required reproduction context', () => {
    const text = read(join(TPL, 'bug_report.yml'));
    for (const field of ['CodeAtlas version', 'Node.js version', 'Operating system', 'Exact command used', 'Expected behavior', 'Actual behavior', 'reproducible', 'redacted']) {
      assert.ok(new RegExp(field, 'i').test(text), `bug template asks: ${field}`);
    }
  });
  it('feature template distinguishes semantic-model/output-schema impact', () => {
    const text = read(join(TPL, 'feature_request.yml'));
    assert.match(text, /Semantic model or output schema impact/);
    assert.match(text, /Current workaround/);
  });
  it('private-beta template forbids private submissions and asks anonymized permission', () => {
    const text = read(join(TPL, 'private_beta_feedback.yml'));
    for (const field of ['private source code', 'private repository URLs', 'permission to quote', 'Most valuable result', 'Biggest limitation']) {
      assert.ok(new RegExp(field, 'i').test(text), `private-beta template covers: ${field}`);
    }
  });
  it('documentation template reports location and problem', () => {
    const text = read(join(TPL, 'documentation.yml'));
    assert.match(text, /Documentation location/);
    assert.match(text, /unclear, stale, or missing/);
  });
});

describe('docs — installation/uninstallation accuracy', () => {
  const pkg = JSON.parse(read('package.json'));
  const install = read('docs/installation.md');
  const uninstall = read('docs/uninstallation.md');
  it('installation states the engines requirement', () => {
    const major = pkg.engines.node.match(/(\d+)/)[1];
    assert.match(install, new RegExp(`Node\\.js [>=≥]* ?${major}`));
  });
  it('installation never claims npm registry availability', () => {
    assert.match(install, /not published on npm/i);
    assert.match(install, /do not work|not available/i);
  });
  it('installation tarball version references agree with package.json', () => {
    for (const m of install.matchAll(/codeatlas-([0-9.]+)\.tgz/g)) {
      assert.equal(m[1], pkg.version, `tarball version ${m[1]} matches package.json ${pkg.version}`);
    }
  });
  it('installation documents verification steps', () => {
    assert.match(install, /--version/);
    assert.match(install, /--help/);
    assert.match(install, /smoke run/i);
  });
  it('uninstallation does not claim shell-config modification by the tool', () => {
    assert.match(uninstall, /never touches shell configuration|never edits those files/i);
  });
  it('uninstallation does not claim global npm install support', () => {
    assert.match(uninstall, /not applicable today/i);
    assert.match(uninstall, /package is not on npm/i);
  });
  it('uninstallation documents that generated output is deleted explicitly', () => {
    assert.match(uninstall, /remove generated maps|stays until you delete it explicitly/i);
    assert.match(uninstall, /rm -rf/);
  });
});

describe('docs — changelog accuracy', () => {
  const pkg = JSON.parse(read('package.json'));
  const changelog = read('CHANGELOG.md');
  it('documents the current package version', () => {
    assert.match(changelog, new RegExp(`## ${pkg.version.replace('.', '\\.')} — `));
  });
  it('states the private-beta status and license-confirmation blocker', () => {
    assert.match(changelog, /private beta/i);
    assert.match(changelog, /provisional/i);
    assert.match(changelog, /owner confirmation/i);
  });
  it('does not describe unreleased work as completed', () => {
    assert.match(changelog, /Planned \(not started, not completed\)/);
  });
});

describe('docs — security accuracy', () => {
  const pkg = JSON.parse(read('package.json'));
  const security = read('SECURITY.md');
  it('documents read/write surfaces and source safety', () => {
    assert.match(security, /What CodeAtlas reads/);
    assert.match(security, /What CodeAtlas writes/);
    assert.match(security, /never modified/);
    assert.match(security, /--output/);
  });
  it('states no telemetry/network/external-model only for this zero-dependency package', () => {
    assert.deepEqual(pkg.dependencies, undefined, 'no runtime dependencies declared');
    assert.match(security, /No network access/);
    assert.match(security, /No telemetry/);
    assert.match(security, /No external model/);
  });
  it('does not invent a security contact address', () => {
    assert.ok(!/[\w.+-]+@[\w-]+\.[\w.]+/.test(security), 'SECURITY.md must not contain an invented email');
    assert.match(security, /No private vulnerability-reporting channel is currently configured/);
  });
});

describe('docs — CI workflow sanity', () => {
  const ci = read('.github/workflows/ci.yml');
  it('runs the test suite on the engines floor without publishing', () => {
    const pkg = JSON.parse(read('package.json'));
    const major = pkg.engines.node.match(/(\d+)/)[1];
    assert.match(ci, new RegExp(`node-version: ["']${major}`));
    assert.match(ci, /npm test/);
    assert.ok(!/npm publish/.test(ci), 'CI must not publish');
    assert.ok(!/secrets\.|GITHUB_TOKEN.*publish/.test(ci), 'CI must not use publish tokens');
  });
  it('verifies the CLI and the files whitelist', () => {
    assert.match(ci, /--help/);
    assert.match(ci, /--version/);
    assert.match(ci, /npm pack --dry-run/);
  });
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

describe('docs — canonical repository URL consistency', () => {
  const pkg = JSON.parse(read('package.json'));
  const CANON = 'github.com/Prathamesh913/codeatlas';
  const CANON_RE = new RegExp(CANON.replace('.', '\\.'));
  it('package metadata uses the canonical repository URL', () => {
    assert.match(pkg.repository.url, CANON_RE, 'repository.url is the real GitHub repository');
    assert.match(pkg.bugs.url, CANON_RE, 'bugs.url points at the real issues page');
  });
  it('README, CONTRIBUTING, and installation docs use the same canonical URL', () => {
    for (const file of ['README.md', 'CONTRIBUTING.md', 'docs/installation.md']) {
      assert.ok(read(file).includes(CANON), `${file} references the canonical repository URL`);
    }
  });
  it('no stale clone placeholders remain', () => {
    for (const file of ['README.md', 'CONTRIBUTING.md', 'docs/installation.md']) {
      assert.ok(!/<repository-url>/.test(read(file)), `${file} has no clone placeholder`);
    }
  });
});

describe('docs — test-script discovery validity (CI regression guard)', () => {
  const pkg = JSON.parse(read('package.json'));
  // CI failure on 315811d: an unmatched `tests/<dir>/*.test.js` glob made Node's
  // test runner exit 1 ("Could not find ..."). Guard: every glob in the `test`
  // script must match at least one test file, and every test file on disk under
  // a tests/<category> directory must be referenced by the script.
  it('every tests/<dir>/*.test.js glob in the test script matches real test files', () => {
    const globs = pkg.scripts.test.match(/tests\/[\w-]+\/\*\.test\.js/g) || [];
    assert.ok(globs.length >= 9, `all category globs present (found ${globs.length})`);
    for (const g of globs) {
      const dir = join(ROOT, g.replace('/*.test.js', ''));
      assert.ok(existsSync(dir), `${g} directory exists`);
      const files = readdirSync(dir).filter((f) => f.endsWith('.test.js'));
      assert.ok(files.length > 0, `${g} matches at least one test file`);
    }
  });
  it('no test file on disk is left unreferenced (no silently skipped category)', () => {
    const globs = new Set(pkg.scripts.test.match(/tests\/[\w-]+\/\*\.test\.js/g) || []);
    const dirs = readdirSync(join(ROOT, 'tests'), { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name !== 'evidence-cache')
      .map((e) => `tests/${e.name}`);
    for (const d of dirs) {
      const entries = readdirSync(join(ROOT, d));
      if (entries.some((f) => f.endsWith('.test.js'))) {
        assert.ok(globs.has(`${d}/*.test.js`), `${d}/*.test.js must be referenced by the test script`);
      }
    }
  });
  it('.gitignore never ignores the structural test suite or its fixtures again', () => {
    const gitignore = read('.gitignore');
    assert.ok(!/^tests\/\*\*\/structural\//m.test(gitignore), 'tests/**/structural/ must not return (it ignored the test suite and fixtures)');
    assert.ok(existsSync(join(ROOT, 'tests', 'structural', 'structural.test.js')), 'structural test file present');
    assert.ok(existsSync(join(ROOT, 'tests', 'fixtures', 'structural')), 'structural fixtures present');
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
