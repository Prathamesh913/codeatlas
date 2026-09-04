// CodeAtlas Phase 4C.3 — Type Review Rules (workstream A.5)
//
// Conservative feature/system review over consolidated entities. The rules
// target exactly the failure classes named in the 4C.3 contract and never
// force uncertain entities into a type:
//
//   T1 — a technical implementation cluster must not be a user-facing
//        feature merely because of its filename: a feature with NO
//        capability-class string AND NO user-action vocabulary AND
//        infrastructure-dominated behavior is corrected to system.
//   T2 — a user-facing capability must not become a system merely because
//        it spans multiple files: file count alone is never a system signal.
//   T3 — a cross-cutting system must not be forced into a feature merely
//        because it has UI strings: a system with >=2 external consumers
//        stays a system even when it carries capability-class text.
//
// Every correction is recorded with its evidence; ties keep the recorded
// type and raise the recorded uncertainty instead.

import { tokenize } from '../semantic/tokens.js';

const INFRA_MARKERS = new Set([
  'firestore', 'firebase', 'subprocess', 'middleware', 'migration', 'admin',
  'config', 'cache', 'persist', 'database', 'db', 'server', 'sync', 'daemon',
]);

export function reviewType(model, ctx) {
  const capabilityCount = model.strings?.capability?.length || 0;
  const contextTokens = new Set([...(model.contextTokens || [])]);
  const hasUserVerbs =
    [...(model.capabilityTokens || [])].some((t) => ctx.USER_VERBS.has(t)) ||
    [...contextTokens].some((t) => ctx.USER_VERBS.has(t));
  const externalConsumers = ctx.externalConsumers.get(model.originalId) || 0;
  const behTerms = new Set([
    ...[...(model.vocab || [])],
    ...((model.voBehaviorTerms || [])),
  ]);
  const infraHits = [...behTerms].filter((t) => INFRA_MARKERS.has(t));
  // A UI-shaped file (route/page/component) is user-surface evidence that
  // overrides infrastructure heuristics.
  const UI_TOKENS = new Set(['page', 'pages', 'route', 'routes', 'screen', 'modal', 'dialog', 'view', 'layout', 'card', 'form', 'menu', 'bar', 'button', 'component', 'ui']);
  const ownsUiFile = (model.appFiles || []).some((f) => {
    const base = f.split('/').pop().replace(/\.[A-Za-z0-9]+$/, '');
    const segs = f.split('/').slice(0, -1);
    return tokenize(base).some((t) => UI_TOKENS.has(t)) || segs.some((s) => UI_TOKENS.has(s) || s === 'components' || s === 'routes');
  });

  // T1 — filename-only "feature" with infrastructure behavior and no
  // user-surface file.
  if (model.kind === 'feature' && capabilityCount === 0 && !hasUserVerbs && infraHits.length >= 2 && !ownsUiFile) {
    return {
      corrected: true,
      type: 'system',
      confidence: 'low',
      rule: 'T1_infrastructure_not_user_capability',
      reason: `No capability-class string, no user-action vocabulary, no user-surface file, while behavior vocabulary is infrastructure-shaped (${infraHits.slice(0, 3).join(', ')}) — a filename-derived user-facing type is not supported.`,
    };
  }

  // T3 — cross-cutting system with UI strings stays a system.
  if (model.kind === 'system' && capabilityCount > 0 && externalConsumers >= 2) {
    return {
      corrected: false,
      type: 'system',
      confidence: model.confidence,
      rule: 'T3_shared_system_with_ui_text',
      reason: `Carries capability-class text but is consumed by ${externalConsumers} entities outside its own group — the shared-system type stands.`,
    };
  }

  return { corrected: false, type: model.kind, confidence: model.confidence, rule: 'unchanged', reason: 'No decisive type evidence; the recorded type stands.' };
}
