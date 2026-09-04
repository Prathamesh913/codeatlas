// CodeAtlas Phase 4B.1 — Semantic Hypothesis Generation
//
// Deterministic, heuristic interpretation. No LLM, no embeddings.
// Every hypothesis is explainable via counted evidence.

export function hypothesize(unit, inspected, graph, analysis) {
  // Doc/config-only units: insufficient — avoids Markdown false positives (e.g., .codeatlas docs)
  const hasSourceMember = unit.members.some((m) => {
    const n = graph.nodes.find((x) => x.id === m);
    if (n && n.language) return true;
    // fallback for test fixtures / extension-based check
    return /\.(ts|tsx|js|jsx|mjs|cjs|py|mts|cts)$/.test(m);
  });
  if (!hasSourceMember) {
    return {
      candidate_type: 'insufficient_evidence',
      hypothesis: 'There is insufficient evidence to classify this implementation area semantically.',
      confidence: 'unknown',
      confidence_reason: 'Unit contains no source files; Markdown/config artifacts provide no behavioral/UI evidence.',
      evidence: { supporting: [], weakening: [] },
      competing_hypotheses: [],
      ambiguity_notes: 'No source files in unit.',
    };
  }

  const allClues = inspected.flatMap((r) => r.clues);
  const uiClues = allClues.filter((c) => c.type === 'ui');
  const behavioralClues = allClues.filter((c) => c.type === 'behavioral');
  const namingClues = allClues.filter((c) => c.type === 'naming');

  // Count signals
  const uiCount = uiClues.length;
  const behavioralCount = behavioralClues.filter((c) => c.evidence_type !== 'comment').length;
  const hasFirestore = allClues.some((c) => c.observed.includes('Firestore'));
  const hasSubprocess = allClues.some((c) => c.observed.includes('subprocess') || c.observed.includes('desktop'));
  const hasReact = graph.edges.some((e) => e.to === 'ext:react' && unit.members.includes(e.from));
  const isShared = (analysis.shared_dependencies || []).some((sd) => unit.members.includes(sd.file) && sd.importers >= 3);
  const hubDegree = Math.max(0, ...unit.members.map((f) => analysis.degree?.[f] || 0));
  const hasUiLikeFilename = (unit.members || []).some((f) => /component|modal|page|route|button/i.test(f));

  // --- Evidence buckets (supporting/weakening) ---
  const supporting = [];
  const weakening = [];
  const competing = [];

  for (const c of uiClues) supporting.push({ clue: c.observed, file: c.file, type: 'ui', confidence: c.confidence });
  for (const c of behavioralClues) supporting.push({ clue: c.observed, file: c.file, type: 'behavioral', confidence: c.confidence });
  // naming as supporting but flagged low where misleading
  for (const c of namingClues) {
    // Weakening: notion filename vs firebase behavior
    if (/notion/i.test(c.observed) && hasFirestore) {
      weakening.push({ clue: c.observed, file: c.file, type: 'naming-conflict', note: 'filename suggests Notion but dependency/behavior indicates Firebase/posters' });
    } else {
      supporting.push({ clue: c.observed, file: c.file, type: 'naming', confidence: 'low' });
    }
  }

  // --- Determine candidate type + hypothesis + confidence ---
  let candidate_type = 'insufficient_evidence';
  let hypothesis = 'There is insufficient evidence to classify this implementation area semantically.';
  let confidence = 'unknown';
  let confidence_reason = 'No substantive UI or behavioral evidence survived targeted inspection.';

  const strongUi = uiCount >= 2;
  const singleUi = uiCount === 1;
  const hasBehavioral = behavioralCount >= 1;
  const ambiguousUi = uiClues.length >= 2 && new Set(uiClues.map((c) => c.raw.toLowerCase().split(/\s+/)[0])).size >= 2 && uiClues.some((c) => /Search/i.test(c.observed)) && uiClues.some((c) => /Filter|Sort|Add|Save/i.test(c.observed));
  const namingVsUiConflict = (unit.members.some((f) => /userManager/i.test(f)) && uiClues.some((c) => /Sign out|Change Password|Profile/i.test(c.observed))) ||
    (unit.members.some((f) => /notion/i.test(f)) && hasFirestore && !uiClues.some((c) => /Notion/i.test(c.observed)));

  if (ambiguousUi || namingVsUiConflict) {
    candidate_type = 'ambiguous';
    confidence = 'low';
    if (namingVsUiConflict) {
      hypothesis = 'This Structural Unit shows conflicting evidence between filename-implied purpose and observed UI/behavioral clues. Classification remains ambiguous pending broader inspection.';
      competing.push({ hypothesis: 'Filename-implied purpose (e.g., Notion integration / user manager)', reason: 'supported by naming evidence alone' });
      competing.push({ hypothesis: 'UI/behavior-implied purpose (e.g., poster collections, auth/profile)', reason: `supported by ${uiCount} UI clue(s) and Firestore/behavioral evidence` });
      confidence_reason = 'Filename and behavioral evidence conflict; UI evidence is stronger but file naming introduces doubt.';
    } else {
      hypothesis = 'This Structural Unit contains UI evidence supporting multiple plausible user-facing purposes. It is ambiguous between them.';
      const themes = [...new Set(uiClues.map((c) => c.raw))].slice(0, 3).join(', ');
      competing.push({ hypothesis: `Theme A derived from "${uiClues[0]?.raw}"`, reason: 'UI evidence' });
      competing.push({ hypothesis: `Theme B derived from "${uiClues[1]?.raw}"`, reason: 'UI evidence' });
      confidence_reason = `Multiple distinct UI labels present (${themes}) — at least two interpretations remain plausible.`;
    }
  } else if (strongUi && hasBehavioral) {
    candidate_type = 'feature_candidate';
    const labels = [...new Set(uiClues.map((c) => c.raw))].slice(0, 3).join(', ');
    hypothesis = `This Structural Unit may provide a user-visible capability suggested by UI labels "${labels}" with supporting behavioral evidence.`;
    confidence = uiCount >= 3 ? 'high' : 'medium';
    confidence_reason = `Multiple UI labels plus behavioral signals align on the same interpretation.`;
  } else if (singleUi && hasBehavioral) {
    candidate_type = 'feature_candidate';
    hypothesis = `This Structural Unit may provide a user-visible capability around "${uiClues[0]?.raw}" with supporting behavioral evidence.`;
    confidence = 'medium';
    confidence_reason = 'One UI label plus behavioral support — plausible but limited.';
  } else if (isShared || hubDegree >= 8 || hasFirestore || hasSubprocess) {
    candidate_type = 'system_candidate';
    const infra = hasSubprocess ? 'desktop integration / launcher' : hasFirestore ? 'persistence / Firestore' : 'shared infrastructure';
    hypothesis = `This Structural Unit may provide ${infra} shared across multiple implementation areas (imported by ${memberImporterMax(unit, analysis) || 'multiple'} files, hub degree ${hubDegree}).`;
    confidence = hubDegree >= 8 || hasBehavioral ? 'medium' : 'low';
    confidence_reason = isShared ? 'Structural sharing plus behavioral evidence supports infrastructure interpretation.' : 'Structural hub suggests shared infrastructure but behavioral support is limited.';
  } else if (uiCount === 1 && !hasBehavioral) {
    candidate_type = 'feature_candidate';
    hypothesis = `This Structural Unit weakly suggests a user-visible capability around "${uiClues[0]?.raw}" — primarily naming/UI evidence.`;
    confidence = 'low';
    confidence_reason = 'Single UI label without behavioral corroboration.';
  }

  // insufficient remains if none of above triggered

  const evidence = { supporting, weakening };
  const ambiguity_notes = candidate_type === 'ambiguous' ? confidence_reason : candidate_type === 'insufficient_evidence' ? 'Targeted inspection found no decisive UI or behavioral clues.' : '';

  return {
    candidate_type,
    hypothesis,
    confidence,
    confidence_reason,
    evidence,
    competing_hypotheses: competing,
    ambiguity_notes,
  };
}

function memberImporterMax(unit, analysis) {
  let max = 0;
  for (const sd of analysis.shared_dependencies || []) {
    if (unit.members.includes(sd.file)) max = Math.max(max, sd.importers);
  }
  return max || null;
}
