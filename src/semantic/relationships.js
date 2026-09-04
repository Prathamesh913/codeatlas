// CodeAtlas Phase 4B.2 — Semantic Relationships
//
// Emits edges ONLY where a concrete Phase 4A graph edge (with provenance)
// crosses two resolved regions. File co-location never creates a relationship.

export function buildRelationships(entities, regions, graph) {
  const byRegion = new Map();
  for (const e of entities) byRegion.set(e.region_id, e);

  const rels = new Map(); // key -> relationship
  const add = (r) => {
    const k = `${r.source}|${r.target}|${r.relationship_type}`;
    if (!rels.has(k)) rels.set(k, r);
    else rels.get(k).evidence.push(...r.evidence);
  };

  for (const region of regions) {
    const src = byRegion.get(region.id);
    if (!src || src.status === 'ambiguous' || src.status === 'unresolved') continue;
    for (const ie of region.imported_edges) {
      const tgt = byRegion.get(ie.to_region);
      if (!tgt || tgt.status === 'ambiguous' || tgt.status === 'unresolved') continue;
      if (tgt.region_id === src.region_id) continue;

      const evidence = [{ edge: ie.edge, file_from: ie.file_from, file_to: ie.file_to, source: 'phase4a_graph', observed: `file '${ie.file_from}' imports '${ie.file_to}'` }];

      if (src.status === 'feature' && tgt.status === 'system') {
        add({
          source: src.id,
          target: tgt.id,
          relationship_type: 'USES',
          description: `${src.name} relies on ${tgt.name} as a shared capability.`,
          confidence: region.imported_by_regions.length >= 2 ? 'medium' : 'low',
          evidence,
        });
      } else if (src.status === 'feature' && tgt.status === 'feature') {
        add({
          source: src.id,
          target: tgt.id,
          relationship_type: 'DEPENDS_ON',
          description: `${src.name} depends on ${tgt.name} (direct module import observed).`,
          confidence: 'low',
          evidence,
        });
      } else if (src.status === 'system' && tgt.status === 'feature') {
        add({
          source: src.id,
          target: tgt.id,
          relationship_type: 'SUPPORTS',
          description: `${src.name} supports ${tgt.name}.`,
          confidence: 'low',
          evidence,
        });
      }
    }
  }

  const out = [...rels.values()].sort((a, b) => {
    const ka = a.source + a.target + a.relationship_type;
    const kb = b.source + b.target + b.relationship_type;
    return ka < kb ? -1 : 1;
  });
  return out;
}
