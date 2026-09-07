// CodeAtlas — post-fix evaluation summary (portable, offline, deterministic).
//
// Reads a generated canonical map (canonical/*.json) and produces:
//   - a machine-readable summary object (evaluation-summary.json)
//   - a human-readable Markdown report (evaluation-report.md)
//
// No repository access, no network, no model runtime. All iteration is
// sorted; no timestamps. Pure functions so tests can exercise them on
// synthetic canonical JSON without running the pipeline.

import { validateCanonicalIntegrity } from '../canonical/index.js';
import { isWeakToken } from '../semantic/merge-policy.js';
import { isAggregationShaped } from '../semantic/router-policy.js';

export const TOOL = 'codeatlas-evaluator';
export const VERSION = '0.1.0';

// Relationship types the pipeline may emit. Anything outside this set is
// reported as unexpected (a failure), never silently accepted.
const KNOWN_RELATIONSHIP_TYPES = new Set(['USES', 'DEPENDS_ON', 'SUPPORTS', 'ROUTES_TO']);

const sortStrings = (arr) => [...new Set(arr)].sort();
const byId = (a, b) => (a.id < b.id ? -1 : 1);

function entityFiles(e) {
  return sortStrings([...(e.primary_files || []), ...(e.supporting_files || [])]);
}

/**
 * Canonical-level integrity: unique ids, valid relationship endpoints and
 * types. Distinct from the file<->entity reverse-index check.
 */
export function checkCanonicalIntegrity({ features, systems, unresolved, relationships }) {
  const failures = [];
  const warnings = [];
  const seen = new Map();
  for (const [kind, list] of [['feature', features], ['system', systems], ['unresolved', unresolved]]) {
    for (const e of list) {
      if (seen.has(e.id)) {
        failures.push(`duplicate entity id '${e.id}' (${seen.get(e.id)} and ${kind})`);
      } else {
        seen.set(e.id, kind);
      }
      if (kind !== 'unresolved' && entityFiles(e).length === 0) {
        warnings.push(`entity '${e.id}' (${kind}) has no associated files`);
      }
      if (!e.name) warnings.push(`entity '${e.id}' (${kind}) has no name`);
      if (!Array.isArray(e.evidence) || e.evidence.length === 0) {
        warnings.push(`entity '${e.id}' (${kind}) carries no evidence entries`);
      }
    }
  }
  const byType = {};
  for (const r of relationships) {
    byType[r.relationship_type] = (byType[r.relationship_type] || 0) + 1;
    if (!KNOWN_RELATIONSHIP_TYPES.has(r.relationship_type)) {
      failures.push(`relationship '${r.source} -> ${r.target}' has unexpected type '${r.relationship_type}'`);
    }
    if (!seen.has(r.source)) failures.push(`relationship source '${r.source}' does not match any known entity`);
    if (!seen.has(r.target)) failures.push(`relationship target '${r.target}' does not match any known entity`);
    if (r.source === r.target) failures.push(`relationship '${r.source}' is self-referential`);
    if (!Array.isArray(r.evidence) || r.evidence.length === 0) {
      warnings.push(`relationship '${r.source} -> ${r.target}' (${r.relationship_type}) carries no evidence entries`);
    }
  }
  return { ok: failures.length === 0, failures: failures.slice().sort(), warnings: warnings.slice().sort(), relationships_by_type: byType };
}

/**
 * Suspicious / potentially misleading patterns. Reporting only: these reuse
 * the existing merge/router policy modules and introduce no new semantic
 * heuristics.
 */
export function detectSuspicious({ features, systems, files, relationships }) {
  const entities = [...features, ...systems];
  const filesByEntity = new Map(entities.map((e) => [e.id, new Set(entityFiles(e))]));

  // Entity names whose slug is only weak generic tokens (e.g. system-config).
  const weak_named_entities = entities
    .filter((e) => {
      const slug = String(e.id).replace(/^(feature|system)-/, '').replace(/-\d+$/, '');
      const tokens = slug.split(/[^a-z0-9]+/).filter(Boolean);
      return tokens.length > 0 && tokens.every((t) => isWeakToken(t));
    })
    .map((e) => e.id)
    .sort();

  // Semantic ownership edges out of router-aggregation-shaped files.
  const entityOfFile = new Map();
  for (const e of entities) for (const f of filesByEntity.get(e.id)) {
    if (!entityOfFile.has(f)) entityOfFile.set(f, e.id);
  }
  const supports_from_aggregation = [];
  for (const r of relationships) {
    if (r.relationship_type !== 'SUPPORTS' && r.relationship_type !== 'USES') continue;
    const src = entities.find((e) => e.id === r.source);
    if (!src) continue;
    const aggFiles = entityFiles(src).filter((f) => isAggregationShaped(f));
    if (aggFiles.length) {
      supports_from_aggregation.push({ relationship: `${r.source} -> ${r.target} (${r.relationship_type})`, aggregation_files: aggFiles.slice().sort() });
    }
  }
  supports_from_aggregation.sort((a, b) => (a.relationship < b.relationship ? -1 : 1));

  // Files with no entity association at all.
  const empty_association_files = files
    .filter((f) => (f.features || []).length === 0 && (f.systems || []).length === 0)
    .map((f) => f.path)
    .sort();

  return { weak_named_entities, supports_from_aggregation, empty_association_files };
}

/**
 * Build the full machine-readable evaluation summary from canonical JSON
 * documents (already parsed) plus run metadata.
 */
export function summarizeMap({ canonical, meta }) {
  const features = [...(canonical.features || [])].sort(byId);
  const systems = [...(canonical.systems || [])].sort(byId);
  const unresolved = [...(canonical.unresolved || [])].sort(byId);
  const relationships = [...(canonical.relationships || [])].sort((a, b) =>
    (`${a.source}|${a.target}|${a.relationship_type}` < `${b.source}|${b.target}|${b.relationship_type}` ? -1 : 1));
  const files = [...(canonical.files || [])].sort((a, b) => (a.path < b.path ? -1 : 1));

  const reverseIndex = validateCanonicalIntegrity({ features, systems, files });
  const canonicalCheck = checkCanonicalIntegrity({ features, systems, unresolved, relationships });
  const suspicious = detectSuspicious({ features, systems, files, relationships });

  const unresolved_by_status = {};
  for (const u of unresolved) unresolved_by_status[u.status || 'unknown'] = (unresolved_by_status[u.status || 'unknown'] || 0) + 1;

  const entities = [...features.map((e) => ({ ...e, kind: 'feature' })), ...systems.map((e) => ({ ...e, kind: 'system' }))]
    .sort(byId)
    .map((e) => ({
      id: e.id,
      kind: e.kind,
      name: e.name || null,
      confidence: e.confidence || 'unknown',
      files: entityFiles(e),
    }));

  const failures = [...reverseIndex.errors.map((e) => `reverse-index: ${e}`), ...canonicalCheck.failures.map((e) => `canonical: ${e}`)].sort();
  const warnings = [...canonicalCheck.warnings].sort();

  return {
    tool: TOOL,
    version: VERSION,
    codeatlas_version: meta.codeatlas_version,
    repository: { label: meta.repo_label, tracked_files: files.length },
    output_directory: meta.output_label,
    counts: {
      tracked_files: files.length,
      features: features.length,
      systems: systems.length,
      unresolved_total: unresolved.length,
      unresolved_by_status,
      relationships_total: relationships.length,
      relationships_by_type: canonicalCheck.relationships_by_type,
      files_with_empty_associations: suspicious.empty_association_files.length,
      router_topology_edges: canonicalCheck.relationships_by_type.ROUTES_TO || 0,
    },
    reverse_index_integrity: { ok: reverseIndex.ok, error_count: reverseIndex.errors.length, errors: reverseIndex.errors },
    canonical_integrity: {
      ok: canonicalCheck.ok,
      failures: canonicalCheck.failures,
      warnings: canonicalCheck.warnings,
    },
    router_handling: {
      topology_edges: relationships.filter((r) => r.relationship_type === 'ROUTES_TO').map((r) => `${r.source} -> ${r.target}`).sort(),
      supports_from_aggregation: suspicious.supports_from_aggregation,
    },
    entities,
    unresolved: unresolved.map((u) => ({ id: u.id, status: u.status || 'unknown', reason: u.reason || u.description || null })),
    suspicious_patterns: {
      weak_named_entities: suspicious.weak_named_entities,
      empty_association_files: suspicious.empty_association_files,
    },
    validation_failures: failures,
    warnings,
    determinism: meta.determinism,
    limitations: [
      'This summary describes one generated map; it does not prove feature coverage is complete.',
      'Empty/unresolved membership is reported as-is and is preferable to a misleading assignment.',
      'Suspicious-pattern detectors reuse the existing merge/router policy vocabulary; they flag candidates for human review, not verdicts.',
    ],
  };
}

/** Render the human-readable Markdown report from a summary object. */
export function renderReport(s) {
  const lines = [];
  const h = (t) => lines.push(`## ${t}`, '');
  lines.push(`# CodeAtlas Post-Fix Evaluation Report`, '');
  lines.push(`- Evaluator: \`${s.tool} ${s.version}\` (CodeAtlas ${s.codeatlas_version})`);
  lines.push(`- Repository: \`${s.repository.label}\` (${s.repository.tracked_files} tracked files)`);
  lines.push(`- Output: \`${s.output_directory}\``);
  lines.push('');
  h('Repository metadata');
  lines.push(`- Tracked files in canonical map: **${s.counts.tracked_files}**`);
  lines.push(`- Features: **${s.counts.features}** · Systems: **${s.counts.systems}** · Unresolved items: **${s.counts.unresolved_total}**`);
  lines.push(`- Relationships: **${s.counts.relationships_total}**`);
  lines.push('');
  h('Canonical entity summary');
  if (!s.entities.length) lines.push('_No canonical entities resolved._', '');
  for (const e of s.entities) {
    lines.push(`- \`${e.id}\` (${e.kind}, confidence \`${e.confidence}\`) — ${e.name || '_unnamed_'} — ${e.files.length} file(s)`);
  }
  lines.push('');
  h('Feature/system classification');
  for (const e of s.entities) lines.push(`- \`${e.id}\` → **${e.kind}**`);
  if (!s.entities.length) lines.push('_None._');
  lines.push('');
  h('Reverse file-to-entity coverage');
  lines.push(`- Files with empty entity associations: **${s.counts.files_with_empty_associations}** of ${s.counts.tracked_files}`);
  const empties = s.suspicious_patterns.empty_association_files.slice(0, 20);
  for (const f of empties) lines.push(`  - \`${f}\``);
  if (s.suspicious_patterns.empty_association_files.length > empties.length) {
    lines.push(`  - … and ${s.suspicious_patterns.empty_association_files.length - empties.length} more (see evaluation-summary.json)`);
  }
  lines.push('');
  h('Relationship summary');
  const types = Object.entries(s.counts.relationships_by_type).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  if (!types.length) lines.push('_No relationships recorded._');
  for (const [t, n] of types) lines.push(`- ${t}: **${n}**`);
  lines.push('');
  h('Router handling');
  lines.push(`- Topology (ROUTES_TO) edges: **${s.counts.router_topology_edges}**`);
  for (const t of s.router_handling.topology_edges) lines.push(`  - \`${t}\``);
  lines.push(`- Semantic ownership edges out of aggregation-shaped files: **${s.router_handling.supports_from_aggregation.length}** (expected 0)`);
  for (const r of s.router_handling.supports_from_aggregation) {
    lines.push(`  - \`${r.relationship}\` via ${r.aggregation_files.map((f) => `\`${f}\``).join(', ')}`);
  }
  lines.push('');
  h('Unresolved items');
  if (!s.unresolved.length) lines.push('_None._');
  for (const u of s.unresolved) lines.push(`- \`${u.id}\` (\`${u.status}\`) — ${u.reason || '_no reason recorded_'}`);
  lines.push('');
  h('Integrity checks');
  lines.push(`- Reverse index: **${s.reverse_index_integrity.ok ? 'OK' : 'FAILED'}** (${s.reverse_index_integrity.error_count} error(s))`);
  for (const e of s.reverse_index_integrity.errors) lines.push(`  - ${e}`);
  lines.push(`- Canonical integrity: **${s.canonical_integrity.ok ? 'OK' : 'FAILED'}** (${s.canonical_integrity.failures.length} failure(s), ${s.canonical_integrity.warnings.length} warning(s))`);
  for (const e of s.canonical_integrity.failures) lines.push(`  - ${e}`);
  for (const e of s.canonical_integrity.warnings.slice(0, 20)) lines.push(`  - warning: ${e}`);
  if (s.canonical_integrity.warnings.length > 20) lines.push(`  - … and ${s.canonical_integrity.warnings.length - 20} more warnings (see evaluation-summary.json)`);
  lines.push('');
  h('Potentially misleading or suspicious patterns');
  lines.push(`- Weak/generic-only entity names: **${s.suspicious_patterns.weak_named_entities.length}** (expected 0)`);
  for (const id of s.suspicious_patterns.weak_named_entities) lines.push(`  - \`${id}\``);
  lines.push(`- Validation failures: **${s.validation_failures.length}** · Warnings: **${s.warnings.length}**`);
  for (const e of s.validation_failures) lines.push(`  - ${e}`);
  lines.push('');
  h('Determinism check');
  lines.push(`- Reverse-index rebuild comparison: **${s.determinism.rebuild_identical ? 'identical' : 'MISMATCH'}**`);
  lines.push(`- Full pipeline rerun performed: **${s.determinism.rerun_performed ? 'yes' : 'no'}**${s.determinism.rerun_performed ? ` — canonical artifacts **${s.determinism.rerun_identical ? 'identical' : 'DIFFERENT'}**` : ' (use --rerun to enable)'}`);
  lines.push('');
  h('Limitations');
  for (const l of s.limitations) lines.push(`- ${l}`);
  lines.push('');
  return lines.join('\n');
}
