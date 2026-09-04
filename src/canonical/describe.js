// CodeAtlas Phase 4C.3 — Evidence-Grounded Description Templates (workstream A.4/C.3)
//
// Separate strategies per entity kind. Every sentence is derived from
// recorded evidence (annotation string classes, clue index, consolidation
// provenance); nothing is invented. Where evidence is insufficient the
// template says exactly that instead of manufacturing a capability.

import { tokenize, USER_VERBS } from '../semantic/tokens.js';
import { GENERIC_TERMS, PLUMBING_VERBS, VENDOR_TERMS } from '../consolidate/rules.js';

const EXCLUDED = new Set([...GENERIC_TERMS, ...PLUMBING_VERBS, ...VENDOR_TERMS]);

function joinAnd(arr) {
  if (!arr.length) return '';
  if (arr.length === 1) return arr[0];
  return arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1];
}

function capabilityMaterial(model) {
  const verbs = new Set();
  const nouns = new Set();
  const labels = [];
  for (const s of model.strings?.capability || []) {
    labels.push(s.value);
    const toks = tokenize(s.value);
    for (const t of toks) {
      if (USER_VERBS.has(t)) verbs.add(t);
      else if (!EXCLUDED.has(t) && t.length >= 3) nouns.add(t);
    }
  }
  return { verbs: [...verbs], nouns: [...nouns], labels };
}

function behaviorVerbs(model, clueIndex) {
  const verbs = new Set();
  for (const f of model.appFiles || []) {
    for (const c of clueIndex.get(f) || []) {
      if (c.type === 'behavioral' && c.evidence_type !== 'comment') {
        for (const t of tokenize(c.raw || c.observed || '')) if (USER_VERBS.has(t)) verbs.add(t);
      }
    }
  }
  return [...verbs];
}

function fileWhy(model) {
  const n = (model.primary_files || []).length;
  if (n === 0) return '';
  if (n === 1) return ` Its implementation lives in \`${model.primary_files[0]}\`.`;
  return ` Its implementation spans ${n} files that share its evidence (${model.primary_files.slice(0, 3).map((f) => `\`${f}\``).join(', ')}${n > 3 ? ', …' : ''}).`;
}

export function describeFeature(model, ctx) {
  const { verbs, nouns, labels } = capabilityMaterial(model);
  const behVerbs = behaviorVerbs(model, ctx.clueIndex);
  const allVerbs = [...new Set([...verbs, ...behVerbs])].slice(0, 3);
  const objects = (nouns.length ? nouns : [...(model.vocab || [])].filter((t) => !EXCLUDED.has(t) && !USER_VERBS.has(t))).slice(0, 2);
  let description;
  if (allVerbs.length && objects.length) {
    description = `Lets users ${joinAnd(allVerbs)} ${objects.join(' and ')}.`;
  } else if (objects.length) {
    description = `Covers the ${objects.join(' and ')} part of the interface.`;
  } else if (labels.length) {
    description = `Covers the interface area behind the "${labels[0]}" control.`;
  } else {
    description = 'User-facing area with insufficient capability text for a grounded description; see the recorded evidence.';
  }
  if (labels.length) {
    const label = labels.find((l) => l.length >= 4 && !description.toLowerCase().includes(l.toLowerCase()));
    if (label) description += ` The interface labels it "${label}".`;
  }
  description += fileWhy(model);
  return { description, user_visible_purpose: description.replace(/^Lets users /, 'Let users '), user_interactions: labels.slice(0, 4) };
}

export function describeSystem(model, ctx) {
  const consumers = model.externalConsumers || (model.imported_by_regions || []).length || 0;
  const domain = [...(model.vocab || [])].filter((t) => !EXCLUDED.has(t) && !USER_VERBS.has(t) && t.length >= 3).slice(0, 2);
  let description;
  if (domain.length) {
    description = `Shared ${domain.join(' and ')} responsibility for ${consumers || 'several'} other capability areas: it centralizes the shared behavior so features do not re-implement it. Architectural support rather than a user-visible action.`;
  } else {
    description = `Shared infrastructure responsibility for ${consumers || 'several'} other capability areas. Architectural support rather than a user-visible action.`;
  }
  description += fileWhy(model);
  return { description };
}

export function describeUnresolved(entry) {
  if (entry.status === 'ambiguous') {
    const competing = (entry.competing_interpretations || []).map((c) => c.interpretation).filter(Boolean);
    return {
      description: competing.length
        ? `Evidence supports competing interpretations (${competing.join(' vs ')}) of comparable strength; no canonical type is forced.`
        : 'Evidence does not decide an interpretation; the area is preserved as ambiguous.',
    };
  }
  if (entry.status === 'demoted_false_positive') {
    return {
      description: `Recorded as a false positive rather than deleted: ${entry.reason || 'its identity rested on non-seedable text'}. Its files and evidence remain available.`,
    };
  }
  if (entry.status === 'reclassified_shell_context') {
    return {
      description: 'Reclassified by value-of-information inspection as route-shell context rather than a user capability; the inspection record explains the decision.',
    };
  }
  return {
    description: `Insufficient evidence to resolve this area: ${entry.reason || 'no canonical interpretation crossed the evidence threshold'}.`,
  };
}
