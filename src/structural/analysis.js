// CodeAtlas Phase 4A — Structural Analysis
//
// Deterministic, explainable graph signals. No machine learning, embeddings,
// or opaque scoring. Every result is traceable back to graph edges (and thus
// to Phase 3 evidence via edge.provenance).

// Minimum undirected file-degree for a node to be considered a local hub.
const HUB_MIN_DEGREE = 2;

/**
 * Compute structural signals over a normalized graph.
 *
 * @param {{nodes:Array, edges:Array}} graph
 */
export function analyze(graph) {
  const { nodes, edges } = graph;
  const fileNodes = nodes.filter((n) => n.kind === 'file');
  const fileIdSet = new Set(fileNodes.map((n) => n.id));

  // Undirected file<->file adjacency from IMPORTS (file->file) + REFERENCES.
  const adj = new Map();
  for (const id of fileIdSet) adj.set(id, new Set());
  const fileImportEdges = edges.filter(
    (e) => e.type === 'IMPORTS' && fileIdSet.has(e.from) && fileIdSet.has(e.to)
  );
  const referenceEdges = edges.filter(
    (e) => e.type === 'REFERENCES' && fileIdSet.has(e.from) && fileIdSet.has(e.to)
  );
  for (const e of [...fileImportEdges, ...referenceEdges]) {
    adj.get(e.from).add(e.to);
    adj.get(e.to).add(e.from);
  }

  const degree = new Map();
  for (const id of fileIdSet) degree.set(id, adj.get(id).size);

  // --- Connected components (undirected) ---
  const visited = new Set();
  const components = [];
  for (const id of fileIdSet) {
    if (visited.has(id)) continue;
    const stack = [id];
    const comp = [];
    visited.add(id);
    while (stack.length) {
      const cur = stack.pop();
      comp.push(cur);
      for (const nb of adj.get(cur)) {
        if (!visited.has(nb)) {
          visited.add(nb);
          stack.push(nb);
        }
      }
    }
    comp.sort();
    components.push(comp);
  }
  components.sort((a, b) => b.length - a.length || (a[0] < b[0] ? -1 : 1));

  // --- Orphans: size-1 components with degree 0 ---
  const orphans = components
    .filter((c) => c.length === 1 && degree.get(c[0]) === 0)
    .map((c) => c[0]);

  // --- Hubs: highest-degree node in each component (size >= 2), degree >= HUB_MIN ---
  const hubs = [];
  for (const comp of components) {
    if (comp.length < 2) continue;
    let best = null;
    for (const id of comp) {
      const d = degree.get(id);
      if (
        d >= HUB_MIN_DEGREE &&
        (!best || d > degree.get(best) || (d === degree.get(best) && id < best))
      ) {
        best = id;
      }
    }
    if (best) hubs.push({ file: best, degree: degree.get(best), component_size: comp.length });
  }
  hubs.sort((a, b) => b.degree - a.degree || (a.file < b.file ? -1 : 1));

  // --- Bridges (Tarjan bridge-finding on undirected adjacency) ---
  const bridges = findBridges(adj, fileIdSet);

  // --- Cycles (directed SCCs of size > 1 on file->file IMPORTS) ---
  const cycles = findCycles(fileImportEdges, fileIdSet);

  // --- Shared dependencies (imported by >= 2 distinct files) ---
  const inCount = new Map();
  for (const e of fileImportEdges) {
    inCount.set(e.to, (inCount.get(e.to) || 0) + 1);
  }
  const sharedDependencies = [...inCount.entries()]
    .filter(([, c]) => c >= 2)
    .map(([id, c]) => ({ file: id, importers: c }))
    .sort((a, b) => b.importers - a.importers || (a.file < b.file ? -1 : 1));

  // --- Entry-point reachability (BFS over undirected file graph) ---
  const entrypointReachability = [];
  const entryEdges = edges.filter((e) => e.type === 'ENTRYPOINT_FOR' && fileIdSet.has(e.to));
  for (const e of entryEdges) {
    const start = e.to;
    const reach = bfs(adj, start);
    entrypointReachability.push({
      entry: e.provenance.entry,
      entry_file: start,
      reachable_files: reach,
      reachable_count: reach.length,
    });
  }
  entrypointReachability.sort((a, b) => (a.entry_file < b.entry_file ? -1 : 1));

  return {
    connectivity: {
      components: components.map((c) => ({ members: c, size: c.length })),
      component_count: components.length,
      orphans,
      orphan_count: orphans.length,
    },
    hubs,
    bridges: bridges.map((b) => ({ from: b[0], to: b[1] })),
    cycles,
    shared_dependencies: sharedDependencies,
    entrypoint_reachability: entrypointReachability,
    degree: Object.fromEntries(degree),
  };
}

function findBridges(adj, fileIdSet) {
  const disc = new Map();
  const low = new Map();
  const bridges = [];
  let timer = 0;

  const dfs = (u, parent) => {
    disc.set(u, timer);
    low.set(u, timer);
    timer++;
    for (const v of adj.get(u)) {
      if (v === parent) continue;
      if (!disc.has(v)) {
        dfs(v, u);
        low.set(u, Math.min(low.get(u), low.get(v)));
        if (low.get(v) > disc.get(u)) bridges.push([u, v].sort());
      } else {
        low.set(u, Math.min(low.get(u), disc.get(v)));
      }
    }
  };

  for (const id of fileIdSet) if (!disc.has(id)) dfs(id, null);

  const seen = new Set();
  const out = [];
  for (const b of bridges) {
    const k = b.join('|');
    if (!seen.has(k)) {
      seen.add(k);
      out.push(b);
    }
  }
  out.sort((a, b) => (a[0] + a[1] < b[0] + b[1] ? -1 : 1));
  return out;
}

function findCycles(edges, fileIdSet) {
  const g = new Map();
  for (const id of fileIdSet) g.set(id, []);
  for (const e of edges) {
    if (fileIdSet.has(e.from) && fileIdSet.has(e.to)) g.get(e.from).push(e.to);
  }

  let index = 0;
  const idx = new Map();
  const low = new Map();
  const onStack = new Set();
  const stack = [];
  const sccs = [];

  const strongconnect = (v) => {
    idx.set(v, index);
    low.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);
    for (const w of g.get(v)) {
      if (!idx.has(w)) {
        strongconnect(w);
        low.set(v, Math.min(low.get(v), low.get(w)));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v), idx.get(w)));
      }
    }
    if (low.get(v) === idx.get(v)) {
      const comp = [];
      let w;
      do {
        w = stack.pop();
        onStack.delete(w);
        comp.push(w);
      } while (w !== v);
      if (comp.length > 1) sccs.push(comp.slice().sort());
    }
  };

  for (const id of fileIdSet) if (!idx.has(id)) strongconnect(id);
  sccs.sort((a, b) => b.length - a.length || (a[0] < b[0] ? -1 : 1));
  return sccs;
}

function bfs(adj, start) {
  const seen = new Set([start]);
  const q = [start];
  while (q.length) {
    const c = q.shift();
    for (const n of adj.get(c) || []) {
      if (!seen.has(n)) {
        seen.add(n);
        q.push(n);
      }
    }
  }
  return [...seen].sort();
}
