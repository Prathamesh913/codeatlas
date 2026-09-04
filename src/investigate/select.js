// CodeAtlas Phase 4B.1 — High-Information File Selection
//
// Deterministic, explainable selection of which files in a Structural Unit
// deserve targeted source inspection. Every selection records WHY.

export function selectHighInformationFiles(unit, graph, analysis) {
  const members = unit.members;
  const memberSet = new Set(members);
  const degree = analysis.degree || {};
  const sharedMap = new Map();
  for (const sd of analysis.shared_dependencies || []) {
    sharedMap.set(sd.file, sd.importers);
  }
  const bridgeFiles = new Set();
  for (const b of unit.bridges || []) {
    bridgeFiles.add(b[0]);
    bridgeFiles.add(b[1]);
  }
  const isHub = new Set(unit.hubs || []);
  const entryFiles = new Set(
    (analysis.entrypoint_reachability || []).flatMap((r) => r.reachable_files || [])
  );

  const candidates = members.map((file) => {
    const reasons = [];
    let score = 0;
    const declares = graph.nodes.find((n) => n.id === file)?.declares?.length || 0;

    if (isHub.has(file)) {
      reasons.push('hub file (high-degree node in unit)');
      score += 10;
    }
    const importers = sharedMap.get(file) || 0;
    if (importers >= 2) {
      reasons.push(`shared dependency (imported by ${importers} distinct files)`);
      score += importers >= 5 ? 8 : 5;
    }
    if (declares > 0) {
      reasons.push(`exports ${declares} public symbol(s)`);
      score += 2;
    }
    if (bridgeFiles.has(file)) {
      reasons.push('bridge endpoint (connects weakly linked areas)');
      score += 2;
    }
    if (entryFiles.has(file)) {
      reasons.push('entry-point reachable');
      score += 3;
    }
    // degree-based fallback (structural importance not captured as hub)
    const d = degree[file] || 0;
    if (d >= 1 && !isHub.has(file)) {
      reasons.push(`structurally connected (degree ${d})`);
      score += 1;
    }
    // weak filename signal only if structural reasons already exist, never alone
    // (prevents notion.ts being selected just for its name)

    return { file, score, reasons, degree: d, importers, declares };
  });

  // Sort deterministically: score desc, degree desc, filename asc
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.degree !== a.degree) return b.degree - a.degree;
    return a.file < b.file ? -1 : 1;
  });

  // Inspection budget: cap at 5, or all if unit small
  const budget = members.length <= 3 ? members.length : members.length <= 10 ? 3 : 5;
  const selected = candidates.slice(0, budget).filter((c) => c.reasons.length > 0);
  // For tiny units or orphans with no structural signal, still inspect the first file
  if (selected.length === 0 && candidates.length > 0) {
    const fallback = candidates[0];
    fallback.reasons = ['sole member of unit (no stronger structural signal)'];
    return [fallback];
  }
  return selected;
}
