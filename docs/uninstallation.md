# Uninstallation and Cleanup

CodeAtlas never writes outside its output directory, never modifies the analyzed
repository's source files, and never touches shell configuration. Removal is therefore
simple and completely reversible.

---

## 1. Global installation — removal

A global *npm* install (`npm install -g codeatlas`) is not applicable today (the
package is not on npm). If you made the CLI available with `npm link` from a checkout:

```bash
npm unlink --global      # run from the checkout; removes the global symlink
command -v codeatlas || echo "removed"
```

If you added a manual alias instead, remove it from the file where you defined it
(e.g. `~/.bashrc`, `~/.zshrc`) — CodeAtlas itself never edits those files.

## 2. Local project installation — removal

For a tarball install inside your own project:

```bash
npm uninstall codeatlas       # removes the package + node_modules/.bin/codeatlas
codeatlas --version; echo "exit=$?"   # expect: not found (exit 127)
```

Verify `package.json` no longer lists `codeatlas` under `dependencies`.

## 3. Local checkout — removal

A checkout has no build artifacts to clean (zero dependencies; no `node_modules`
required). To remove it entirely:

```bash
rm -rf /path/to/codeatlas    # also removes any tarballs produced there (*.tgz)
```

## 4. Removing generated CodeAtlas output from a target repository

All generated output lives in one directory tree — `<repository>/.codeatlas/` by
default, or the `--output <directory>` path you chose:

```bash
rm -rf ./my-app/.codeatlas
# or, for a custom output directory:
rm -rf ./map-output
```

**Generated files can safely be deleted**: everything under `.codeatlas/` is
regenerable by rerunning `codeatlas <repo>`. Deleting it loses nothing but the
generated docs (and the collector's per-run manifest).

## 5. What CodeAtlas should not have modified

- **Source files of the analyzed repository** — never written (read-only pipeline).
- **Shell configuration** (`~/.bashrc`, `~/.zshrc`, …) — never edited by the tool.
- **Anything outside the output directory** — no global state, no caches outside
  `.codeatlas/`.

If you find a modified source file after a run, that is a bug — please report it (see
[.github/ISSUE_TEMPLATE/bug_report.yml](../.github/ISSUE_TEMPLATE/bug_report.yml)).
Re-run and compare against version control to confirm.

## 6. Is `.codeatlas/` ignored by default?

- In **this** repository: yes — `.gitignore` includes `.codeatlas/`.
- In **your** analyzed repository: not automatically. CodeAtlas does not edit your
  `.gitignore` (it is read-only). Add `.codeatlas/` to your analyzed repository's
  `.gitignore` yourself if you use the default output location.

## 7. Verifying CodeAtlas is fully removed

```bash
command -v codeatlas; echo "exit=$?"              # expect not found (127)
npm ls codeatlas 2>&1 | head -2                    # empty / not in dependencies
ls -d /path/to/analyzed-repo/.codeatlas 2>&1      # expect: No such file or directory
```

## 8. Uninstalling does not delete generated documentation

Removing the CodeAtlas package does **not** remove generated maps. The `.codeatlas/`
directory (or your custom `--output` directory) stays until you delete it explicitly
(§4). If you used a custom output directory, remember its location is printed at the
end of every run (`codeatlas: output written to <path>`).
