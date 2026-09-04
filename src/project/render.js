// CodeAtlas Phase 4C.3 — Markdown Projection (workstream C)
//
// Renders the canonical JSON (4C.3 output) into Markdown. Markdown is a
// PROJECTION (D-006): every statement derives from canonical JSON + recorded
// evidence; nothing is manually authored here. Deterministic: sorted
// iteration, no timestamps, byte-identical re-renders.
//
// Output layout under <outputDir>/markdown/:
//   INDEX.md              — query index (features, systems, aliases,
//                           technical->canonical map, files, unresolved)
//   features/<id>.md      — one page per canonical feature
//   systems/<id>.md       — one page per canonical system
//   unresolved.md         — ambiguous / unresolved / demoted / reclassified
//   ARCHITECTURE.md       — systems overview + relationships

import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const TOOL = 'codeatlas-projector';
const VERSION = '0.1.0';

function md(p, content) {
  writeFileSync(p, content, 'utf-8');
}

function bullets(items, fmt = (x) => `- ${x}`) {
  return items.map(fmt).join('\n') || '_None recorded._';
}

function relSection(entity, relationships) {
  const rels = relationships.filter((r) => r.source === entity.id || r.target === entity.id);
  if (!rels.length) return '_No canonical relationships recorded._\n';
  return rels
    .map((r) => {
      const other = r.source === entity.id ? r.target : r.source;
      const dir = r.source === entity.id ? '→' : '←';
      return `- ${dir} \`${other}\` — **${r.relationship_type}** (${r.confidence}): ${r.description}`;
    })
    .join('\n') + '\n';
}

function evidenceSection(entity) {
  const ev = entity.evidence || [];
  if (!ev.length) return '_No evidence entries recorded._\n';
  return ev
    .slice(0, 10)
    .map((e) => `- [${e.source || e.evidence_type || 'evidence'}] ${e.observed || e.description || ''}`)
    .join('\n') + '\n';
}

function featurePage(f, relationships) {
  return `# Feature — ${f.name}

**Id:** \`${f.id}\` · **Type:** feature · **Confidence:** \`${f.confidence}\`

## Description

${f.description}

**User-visible purpose:** ${f.user_visible_purpose || '_Not recorded._'}

## User interactions

${bullets(f.user_interactions || [])}

## Aliases

${bullets(f.aliases || [])}

## Keywords

${bullets(f.keywords || [])}

## Files

**Primary:**

${bullets(f.primary_files || [], (x) => `- \`${x}\``)}

**Supporting:**

${bullets(f.supporting_files || [], (x) => `- \`${x}\``)}

${(f.non_application_files || []).length ? `**Non-application (recorded, not anchors):**\n\n${bullets(f.non_application_files, (n) => `- \`${n.file}\` (${n.relevance_class})`)}` : ''}

## Relationships

${relSection(f, relationships)}

## Naming provenance

- **Basis:** ${f.provenance?.naming_evidence?.basis || 'n/a'} (tier ${f.provenance?.naming_evidence?.tier ?? '?'})
- **Previous name:** ${f.provenance?.naming_evidence?.previous_name || '_unchanged_'}
- **Implementation terms:** ${bullets(f.provenance?.implementation_terms || [], (x) => `- \`${x}\``)}

## Evidence

${evidenceSection(f)}

## Notes

${bullets(f.notes || [])}
`;
}

function systemPage(s, relationships) {
  return `# System — ${s.name}

**Id:** \`${s.id}\` · **Type:** system · **Confidence:** \`${s.confidence}\`

## Description

${s.description}

**Technical role:** ${s.technical_role || '_Not recorded._'}

**Semantic role:** ${s.semantic_role || '_Not recorded._'}

**Supports features:** ${bullets(s.supported_features || [], (x) => `- \`${x}\``)}

## Aliases

${bullets(s.aliases || [])}

## Keywords

${bullets(s.keywords || [])}

## Files

**Primary:**

${bullets(s.primary_files || [], (x) => `- \`${x}\``)}

**Supporting:**

${bullets(s.supporting_files || [], (x) => `- \`${x}\``)}

${(s.non_application_files || []).length ? `**Non-application (recorded, not anchors):**\n\n${bullets(s.non_application_files, (n) => `- \`${n.file}\` (${n.relevance_class})`)}` : ''}

## Relationships

${relSection(s, relationships)}

## Naming provenance

- **Basis:** ${s.provenance?.naming_evidence?.basis || 'n/a'} (tier ${s.provenance?.naming_evidence?.tier ?? '?'})
- **Previous name:** ${s.provenance?.naming_evidence?.previous_name || '_unchanged_'}
- **Implementation terms:** ${bullets(s.provenance?.implementation_terms || [], (x) => `- \`${x}\``)}

## Evidence

${evidenceSection(s)}

## Notes

${bullets(s.notes || [])}
`;
}

function unresolvedPage(entities) {
  const sections = entities.map((e) => `### ${e.id}

**Status:** \`${e.status}\` · **Confidence:** \`${e.confidence}\`

${e.description || e.reason || ''}

${e.competing_interpretations?.length ? `**Competing interpretations:**\n\n${bullets(e.competing_interpretations.map((c) => `\`${c.interpretation || c.hypothesis}\` — ${c.reason || ''}`))}` : ''}
${e.misleading_strings?.length ? `**Misleading strings that seeded it (recorded):**\n\n${bullets(e.misleading_strings, (s) => `- "${s.value}" (${s.classification}, \`${s.file}\`)`)}` : ''}
${e.primary_files?.length ? `**Files:**\n\n${bullets(e.primary_files, (x) => `- \`${x}\``)}` : ''}
${e.would_resolve_with ? `**Would resolve with:** ${e.would_resolve_with}` : ''}
`);
  return `# Unresolved, Ambiguous, and Demoted Areas

> These areas were **not** forced into a canonical interpretation. Each entry
> records why, what evidence was consulted, and what would resolve it.

${sections.join('\n')}
`;
}

function architecturePage(features, systems, relationships) {
  return `# Architecture Overview

> Generated from canonical JSON. Systems are cross-cutting responsibilities;
> features are user-visible capabilities.

## Systems

| System | Id | Confidence |
|---|---|---|
${(systems.map((s) => `| ${s.name} | \`${s.id}\` | \`${s.confidence}\` |`).join('\n')) || '| _None resolved_ | | |'}

## Features

| Feature | Id | Confidence |
|---|---|---|
${(features.map((f) => `| ${f.name} | \`${f.id}\` | \`${f.confidence}\` |`).join('\n')) || '| _None resolved_ | | |'}

## Relationships

${bullets(relationships, (r) => `- \`${r.source}\` —**${r.relationship_type}**→ \`${r.target}\` (${r.confidence})`)}

## Flows

_No flows are recorded in the canonical model: flow extraction requires call-chain
evidence that the current pipeline does not produce. This section is intentionally
empty rather than fabricated._
`;
}

function indexPage({ features, systems, unresolved, files, relationships }) {
  const technicalMap = [...features, ...systems].flatMap((e) =>
    (e.provenance?.implementation_terms || []).map((t) => ({ term: t, entity: `${e.id} ("${e.name}")` })));
  return `# CodeAtlas Map Index

> Query index over the canonical JSON. Markdown is a projection — the JSON is
> the source of truth.

## Features (lookup by name)

| Name | Id | Confidence | Aliases |
|---|---|---|---|
${features.map((f) => `| **${f.name}** | \`${f.id}\` | \`${f.confidence}\` | ${(f.aliases || []).join(', ') || '—'} |`).join('\n') || '| _None_ | | | |'}

## Systems (lookup by name)

| Name | Id | Confidence | Aliases |
|---|---|---|---|
${systems.map((s) => `| **${s.name}** | \`${s.id}\` | \`${s.confidence}\` | ${(s.aliases || []).join(', ') || '—'} |`).join('\n') || '| _None_ | | | |'}

## Technical name → canonical name

${bullets(technicalMap, (m) => `- \`${m.term}\` → ${m.entity})}`)}

## Files (navigation index)

| File | Relevance | Entities |
|---|---|---|
${files.map((f) => `| \`${f.path}\` | ${f.relevance_class} | ${[...f.features, ...f.systems].join(', ') || '—'} |`).join('\n')}

## Unresolved / ambiguous / demoted

${bullets(unresolved, (u) => `- \`${u.id}\` (${u.status})`)}

## Relationships

${bullets(relationships, (r) => `- \`${r.source}\` → \`${r.target}\` (${r.relationship_type})`)}

## Flows

_No canonical flows exist; see ARCHITECTURE.md._
`;
}

/**
 * Render canonical JSON into Markdown. Returns the list of written paths.
 */
export function render({ canonicalDir, outputDir }) {
  const read = (n) => JSON.parse(readFileSync(join(canonicalDir, n), 'utf-8'));
  const features = read('features.json').features || [];
  const systems = read('systems.json').systems || [];
  const unresolved = read('unresolved.json').entities || [];
  const relationships = read('relationships.json').relationships || [];
  const files = read('files.json').files || [];

  const base = join(outputDir, 'markdown');
  mkdirSync(join(base, 'features'), { recursive: true });
  mkdirSync(join(base, 'systems'), { recursive: true });

  const written = [];
  const write = (rel, content) => { md(join(base, rel), content); written.push(rel); };

  for (const f of features) write(`features/${f.id}.md`, featurePage(f, relationships));
  for (const s of systems) write(`systems/${s.id}.md`, systemPage(s, relationships));
  write('unresolved.md', unresolvedPage(unresolved));
  write('ARCHITECTURE.md', architecturePage(features, systems, relationships));
  write('INDEX.md', indexPage({ features, systems, unresolved, files, relationships }));

  return { tool: TOOL, version: VERSION, written: written.sort(), base };
}
