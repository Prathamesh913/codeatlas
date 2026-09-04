# Security and Privacy

What CodeAtlas reads, what it writes, and how to report problems.

---

## What CodeAtlas reads

- The analyzed repository's files, as observed by the read-only evidence collector:
  source text, imports, symbols, strings, entry points, and configuration files
  (subject to the collector's exclusions).
- Nothing else. CodeAtlas does not read environment files beyond what the collector's
  exclusion rules list, and it makes no attempt to interpret secret values.

**Implication:** because the collector observes the whole repository, *secrets stored
in analyzed files end up in the generated output* (the `evidence/strings.json` capture
and downstream artifacts). Do not run CodeAtlas on repositories containing secrets you
would not want in a local `.codeatlas/` directory, and never share generated output
that contains them.

## What CodeAtlas writes

- Only the output directory: `<repository>/.codeatlas/` by default, or the
  `--output <directory>` path you chose.
- The analyzed repository's source files are **never modified** — the pipeline is
  read-only (asserted by tests, and the CLI's default output location is a dedicated
  directory).
- No global state, no shell configuration, no files outside the output directory.

## No network, no telemetry, no external model

Verified against the implementation (zero runtime dependencies; no `http`/`https`
client usage in `src/` or `bin/`):

- **No network access** at runtime.
- **No telemetry** — nothing is sent anywhere, ever.
- **No external model or LLM runtime** — investigation is deterministic and local
  (decision D-011).

The only strings in the codebase that look like URLs are regex *patterns used to
classify text inside analyzed repositories* — they are not endpoints the tool calls.

## Do not submit secrets or private source code in public issues

When reporting bugs or feedback, describe repositories by language/framework and size —
never by name or URL — and never paste private source code, credentials, API keys,
environment files, or unredacted logs. See [docs/private-beta.md](docs/private-beta.md)
for anonymization guidance.

## Reporting a security vulnerability

**No private vulnerability-reporting channel is currently configured.** The maintainer
must set one up (a monitored contact address or a private form) **before public
release**; until then this section will say so explicitly here.

Interim process for private-beta reports:

1. Do **not** open a public issue with exploit details or secrets.
2. Redact any secrets immediately — do not reproduce the secret itself in the report
   (describe its type and location, e.g. "an API key committed in `config/[file]`").
3. Contact the repository owner through the channel that brought you into the private
   beta.
4. If a secret was exposed in a generated issue/report, the maintainer will remove or
   redact the content and rotate the affected credential.

## If you committed a secret and ran CodeAtlas

The generated `.codeatlas/` output may contain the secret string. Rotate the
credential first, then delete the output directory:

```bash
rm -rf ./.codeatlas    # regenerable by rerunning codeatlas
```

Deleting the output does not undo the credential exposure — rotate the credential.

## Reporting accidental secret exposure

If a secret reached a public issue, PR, or generated artifact you shared:

1. Rotate/revoke the credential immediately.
2. Ask the maintainer to redact the exposed content (provide the issue/PR number,
   not the secret).
