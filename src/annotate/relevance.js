// CodeAtlas Phase 4C.1B — Semantic Relevance Classification (D-017)
//
// Interprets the collector's mechanical flags (Phase 4C.1A) into a file-level
// semantic relevance class. This answers, for every file in the inventory:
// "How should this file be treated when investigating application capabilities?"
//
// Hard boundaries:
//   - No file is excluded, deleted, or down-weighted in raw evidence.
//   - Collector flags are copied verbatim into the annotation output (no loss).
//   - Relevance class is NOT a Feature/System classification and not a
//     judgment of importance — it controls downstream seeding/inspection
//     policy only (contract table in PHASE_4C1B_VALIDATION.md §7).
//
// Precedence (first match wins; chosen so the most semantically restrictive
// mechanically-observable role wins):
//   1. generated    — build artifacts are mechanical output regardless of
//                     anything else (covers the whole .vercel/ tree).
//   2. test         — a test is a test regardless of where it lives
//                     (automation/x.test.ts → test, automation flag preserved).
//   3. automation   — repository/product-operating scripts.
//   4. documentation— docs/markdown supply context only.
//   5. supporting   — configuration/infrastructure content whose semantic
//                     role cannot be inferred mechanically: non-source files
//                     (config data, styles, assets) and source files that are
//                     deterministically configuration by location or filename
//                     (a `config/` segment, a `*.config.js|ts` filename).
//   6. application  — source-language files without disqualifying flags.
//
// Deliberate humility: utilities inside product source trees (src/lib/…)
// remain application — the mechanical evidence cannot honestly distinguish
// them, and flags must never claim more than they observe.

import { MARKDOWN_EXTENSIONS } from '../utils.js';

export const RELEVANCE_CLASSES = [
  'generated',
  'test',
  'automation',
  'documentation',
  'supporting',
  'application',
];

// Per-class downstream policy contract (Part G). Values are DATA for later
// stages — no stage implements the policy until after 4C.1B.
export const RELEVANCE_POLICY = {
  application:   { entity_seeding: 'eligible', naming_support: 'full',          inspection: 'normal', structural_participation: 'preserved' },
  supporting:    { entity_seeding: 'weakened', naming_support: 'support',       inspection: 'low',    structural_participation: 'preserved' },
  test:          { entity_seeding: 'excluded', naming_support: 'none',          inspection: 'low',    structural_participation: 'preserved' },
  automation:    { entity_seeding: 'excluded', naming_support: 'none',          inspection: 'low',    structural_participation: 'preserved' },
  generated:     { entity_seeding: 'excluded', naming_support: 'none',          inspection: 'skip',   structural_participation: 'preserved' },
  documentation: { entity_seeding: 'excluded', naming_support: 'context_only',  inspection: 'skip',   structural_participation: 'preserved' },
};

/**
 * Classify one evidence file entry into a semantic relevance class.
 *
 * @param {{ path: string, language: string|null, relevance_flags?: object }} file
 * @returns {{ relevance_class: string, relevance_reasons: string[] }}
 */
export function classifyRelevance(file) {
  const flags = file.relevance_flags || {};
  const source = file.language != null && file.language !== 'null';

  if (flags.is_generated_like) {
    return { relevance_class: 'generated', relevance_reasons: ['mechanical_flag:is_generated_like'] };
  }
  if (flags.is_test_like) {
    return { relevance_class: 'test', relevance_reasons: ['mechanical_flag:is_test_like'] };
  }
  if (flags.is_automation_like) {
    return { relevance_class: 'automation', relevance_reasons: ['mechanical_flag:is_automation_like'] };
  }
  if (flags.is_documentation_like || MARKDOWN_EXTENSIONS.has(file.extension)) {
    return { relevance_class: 'documentation', relevance_reasons: ['mechanical_flag:is_documentation_like'] };
  }
  if (!source) {
    return { relevance_class: 'supporting', relevance_reasons: ['non_source_content'] };
  }
  const segments = file.path.split('/');
  const dirs = segments.slice(0, -1);
  const filename = segments[segments.length - 1] || '';
  if (dirs.some(d => d === 'config' || d === 'configs')) {
    return { relevance_class: 'supporting', relevance_reasons: ['config_location'] };
  }
  if (/(^|\.)config\.(mjs|cjs|js|jsx|ts|tsx)$/.test(filename)) {
    return { relevance_class: 'supporting', relevance_reasons: ['config_filename'] };
  }
  return { relevance_class: 'application', relevance_reasons: [`source_language:${file.language}`] };
}
