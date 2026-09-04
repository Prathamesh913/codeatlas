# Installation

CodeAtlas is **not published on npm**. `npm install codeatlas` and `npx codeatlas`
**do not work yet**. Two installation paths are supported today:

1. **From a local checkout** of this repository (recommended for private-beta testers).
2. **From the package tarball** (`npm pack` output).

---

## Requirements

- **Node.js ≥ 18** (from `package.json` `engines`). Check with `node --version`.
- **npm** (ships with Node.js). Used only for `npm pack`/`npm install` in the tarball
  path; the tool itself has zero runtime dependencies.
- **No OS assumptions**: pure Node.js; works on Linux/macOS/Windows. Path handling is
  POSIX-style in examples; Windows users should use forward slashes or quote paths.
- **No network access required** at runtime, and none used.

## 1. Installation from a local checkout

```bash
git clone https://github.com/Prathamesh913/codeatlas.git codeatlas
cd codeatlas
node --version                          # must be >= 18
```

No build step and no `npm install` are required (zero dependencies). Run the CLI
directly:

```bash
node bin/codeatlas.js <repository-path> [--output <directory>]
```

Optional — put `codeatlas` on your PATH for the session:

```bash
npm link          # or: alias codeatlas='node /path/to/codeatlas/bin/codeatlas.js'
codeatlas --version
npm unlink --global   # removes the link later (see docs/uninstallation.md)
```

## 2. Installation from the package tarball

```bash
cd codeatlas            # the checkout
npm pack                # produces codeatlas-0.5.0.tgz (runtime + docs only)
npm install ./codeatlas-0.5.0.tgz   # in your own project; installs the bin
codeatlas --version     # 0.5.0
```

The tarball contains only `src/`, `schemas/`, `templates/`, `bin/`, `README.md`,
`SKILL.md`, `LICENSE` — no tests, fixtures, or generated evidence.

## 3. npm registry installation — **not available**

CodeAtlas is not on the npm registry. Until it is published:

- `npm install codeatlas` will fail (or install an unrelated name if one ever
  appears — do not trust it).
- `npx codeatlas` will fail to find the package.

This document will be updated when publication actually happens. Do not rely on
registry commands today.

## 4. Running the CLI

```bash
codeatlas <repository-path> [--output <directory>]
node bin/codeatlas.js <repository-path> [--output <directory>]
```

- `<repository-path>` must be an existing **directory**.
- `--output <directory>`: where the map is written. Default:
  `<repository-path>/.codeatlas`. The directory is created if missing. If the path
  exists as a *file*, the run fails with `EEXIST` — choose a directory path.
- The analyzed repository is only read.

### Smoke run

Run it against the repository's own smoke fixture (harmless, ~seconds):

```bash
rm -rf /tmp/atlas-smoke && cp -r tests/fixtures/smoke-react-app /tmp/atlas-smoke
node bin/codeatlas.js /tmp/atlas-smoke --output /tmp/atlas-smoke-map
# expected final lines:
#   codeatlas: done — 2 features, 0 systems, 0 ambiguous, 0 unresolved/demoted
#   codeatlas: output written to /tmp/atlas-smoke-map
rm -rf /tmp/atlas-smoke /tmp/atlas-smoke-map
```

## 5. Understanding the generated `.codeatlas/` directory

```
<repo>/.codeatlas/
├── evidence/        raw observed facts + manifest.json (per-run repository manifest)
├── annotation/      text classification + file relevance
├── structural/      import graph + structural units
├── investigation/   per-unit hypotheses
├── semantic/        carved regions + first-pass entities
├── consolidation/   recorded merges/splits/demotions
├── canonical/       the six canonical JSON artifacts (source of truth)
└── markdown/        INDEX.md, features/, systems/, unresolved.md, ARCHITECTURE.md
```

`canonical/` and `markdown/` are the artifacts to consume; earlier stages are recorded
provenance. See [usage.md](usage.md) for how to read them.

## 6. Verifying installation

```bash
codeatlas --version    # 0.5.0 (must match package.json)
codeatlas --help       # usage, options, examples
codeatlas <repo-path>  # a real run (see smoke run above)
```

`--version` reads `package.json` at runtime, so the binary and the metadata cannot
drift.

## 7. Common installation failures

| Symptom | Cause | Fix |
|---|---|---|
| `node: command not found` | Node.js not installed / not on PATH | Install Node.js ≥ 18 |
| `node --version` < 18 | old Node | upgrade Node |
| `npm install codeatlas` fails | not published on npm | use checkout/tarball (above) |
| `codeatlas: error: repository path 'X' does not exist.` | bad path / typo | check the path |
| `codeatlas: error: repository path 'X' is not a directory.` | a file was passed | pass a directory |
| `codeatlas: error: EEXIST ... mkdir 'X'` | `--output` path exists as a file | choose a directory path |
| `codeatlas: error: --output requires a directory argument` | no path after `--output` | pass the directory after `--output` |
| `codeatlas: error: unknown option '--X'. See codeatlas --help.` | unsupported flag | check `codeatlas --help` |
| `EACCES`/`EPERM` while writing | no write permission for output dir | pick a writable `--output` |
| `EACCES` while reading the repo | no read permission | fix permissions or copy the repo |

## 8. Permissions and path issues

- Read access to the analyzed repository is required; write access to the output
  directory. Nothing else.
- Relative paths are resolved against the current working directory; prefer absolute
  paths in scripts.
- The CLI creates missing output directories (`recursive`); it never deletes existing
  content — reruns overwrite artifacts in place deterministically.

## 9. Clean-install verification

```bash
npm pack                                    # from the checkout
npm install ./codeatlas-0.5.0.tgz           # in a throwaway project
./node_modules/.bin/codeatlas --version     # 0.5.0
./node_modules/.bin/codeatlas <some-repo>   # real run
npm uninstall codeatlas                     # cleanup (see docs/uninstallation.md)
```

The CI workflow runs the equivalent checks on Node 18 (see
`.github/workflows/ci.yml`).
