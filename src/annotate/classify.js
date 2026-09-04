// CodeAtlas Phase 4C.1B — UI String Classification (single authority, D-016)
//
// Deterministic classification of user-visible strings into exactly four
// classes: capability / context / state / incidental. This module is the ONLY
// place raw strings are interpreted; downstream stages must consume these
// classifications and must not re-read raw text for scoring (4C.0 B6).
//
// Precedence (first match wins, documented in PHASE_4C1B_VALIDATION.md):
//   1. state lexicon            — measured requirement: "No posters found"
//                                 arrived as a `title=` prop and MUST be
//                                 state even though prop context is weaker
//                                 (prevents feature-found / feature-preview).
//   2. error construction       — throw/new Error("…") is always state.
//   3. console diagnostics      — console.error/warn is state; log/info is
//                                 incidental (diagnostics, not UI).
//   4. non-text literal kinds   — URLs, style classes, font values,
//                                 documentation content → incidental.
//   5. prose length             — long text is marketing/manifesto prose
//                                 (prevents feature-artist-2).
//   6. interactive context      — verb-first phrase on an interactive control
//                                 → capability; noun-phrase control text names
//                                 a destination/object → context (prevents
//                                 navigation-chrome seeding).
//   7. headings/labels/props    — context.
//   8. unpositioned literals    — incidental (safe default: zero weight).

// --- State lexicon (ordered; case-insensitive) -------------------------------
const STATE_LEXICON = [
  [/\bno\s+[\w-]+(?:\s+[\w-]+){0,3}\s+(?:found|matches|matching|results|available|yet)\b/i, 'empty_result'],
  [/\bnot\s+found\b/i, 'empty_result'],
  [/\bno\s+(?:matches|results|posters|projects|items|saved|data|auth|token|connection|network)\b/i, 'empty_result'],
  [/\bretr(?:y|ies|ying)\b|\btry\s+again\b/i, 'retry'],
  [/\b(?:failed|failure|error|oops|something\s+went\s+wrong|didn'?t\s+load|could\s+not|unable\s+to|unauthorized|forbidden|invalid)\b/i, 'error'],
  [/\bloading\b|\bplease\s+wait\b/i, 'loading'],
  [/\b(?:saved|created|deleted|removed|updated|copied)\s+successfully\b|\bare\s+you\s+sure\b/i, 'confirmation'],
];

// --- Action verbs (exact first word; conservative, bounded) ------------------
const ACTION_VERBS = new Set([
  'save', 'create', 'add', 'remove', 'delete', 'edit', 'update', 'search',
  'filter', 'sort', 'open', 'close', 'cancel', 'submit', 'sign', 'log',
  'retry', 'try', 'explore', 'share', 'download', 'upload', 'import',
  'export', 'copy', 'select', 'choose', 'confirm', 'send', 'start', 'stop',
  'play', 'pause', 'view', 'preview', 'generate', 'refresh', 'reload',
  'toggle', 'pin', 'unpin', 'like', 'clear', 'reset', 'apply', 'dismiss',
  'rename', 'duplicate', 'move', 'scan', 'rescan', 'run', 'enable',
  'disable', 'show', 'hide', 'expand', 'collapse', 'skip', 'browse', 'manage',
]);

const INTERACTIVE_ELEMENT_RE = /(?:^(?:button|a|input|select|textarea|summary)$)|(?:^[A-Z]?\w*(?:Button|Link|Tab|Menu|NavItem|NavLink|Anchor|Action|CTA|Toggle|Dropdown)$)/;
const HEADING_ELEMENTS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'title', 'label', 'th', 'legend',
  'Heading', 'Title', 'Label', 'Legend', 'Gtk.Label',
]);

const POLICY = {
  capability:  { can_seed_entity: true,  can_name_entity: true,  alias_eligible: true,  support_only: false },
  context:     { can_seed_entity: false, can_name_entity: true,  alias_eligible: true,  support_only: false },
  state:       { can_seed_entity: false, can_name_entity: false, alias_eligible: false, support_only: true },
  incidental:  { can_seed_entity: false, can_name_entity: false, alias_eligible: false, support_only: false },
};

function wordCount(value) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function isInteractive(element) {
  return Boolean(element) && INTERACTIVE_ELEMENT_RE.test(element);
}

function isHeading(element) {
  return Boolean(element) && HEADING_ELEMENTS.has(element);
}

function verbFirst(value) {
  const first = value.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^\w]/g, '') || '';
  return ACTION_VERBS.has(first);
}

/**
 * Classify one user-visible string. `hint` carries bounded syntactic context:
 * { kind, element?, prop? } — see extract.js for the produced kinds.
 *
 * @returns {{ classification: string, reason: string, policy: object }}
 */
export function classifyString(value, hint = {}) {
  const kind = hint.kind || 'plain';
  const element = hint.element || null;
  const prop = hint.prop || null;
  const v = String(value).trim();

  // 1. State lexicon — overrides every other signal (measured 4B.2 failures).
  for (const [re, kind_] of STATE_LEXICON) {
    if (re.test(v)) return { classification: 'state', reason: `state_lexicon:${kind_}`, policy: POLICY.state };
  }
  // 2-3. Error construction / console diagnostics.
  if (kind === 'error_construction') return { classification: 'state', reason: 'error_construction', policy: POLICY.state };
  if (kind === 'console_diagnostic') return { classification: 'state', reason: 'console_diagnostic', policy: POLICY.state };
  if (kind === 'console_output') return { classification: 'incidental', reason: 'console_output', policy: POLICY.incidental };
  // 4. Non-text literal kinds.
  if (kind === 'url') return { classification: 'incidental', reason: 'url_literal', policy: POLICY.incidental };
  if (kind === 'class_name') return { classification: 'incidental', reason: 'style_class', policy: POLICY.incidental };
  if (kind === 'canvas_font' || kind === 'font_config') return { classification: 'incidental', reason: 'font_or_brand_value', policy: POLICY.incidental };
  if (kind === 'markdown_heading') return { classification: 'incidental', reason: 'documentation_content', policy: POLICY.incidental };
  // 5. Prose length — marketing/manifesto text.
  if (wordCount(v) >= 10) return { classification: 'incidental', reason: 'prose_length', policy: POLICY.incidental };
  // 6. Interactive controls: verb-first = action; noun phrase = destination label.
  if (isInteractive(element)) {
    if (verbFirst(v)) return { classification: 'capability', reason: 'interactive_verb_phrase', policy: POLICY.capability };
    return { classification: 'context', reason: 'control_destination_label', policy: POLICY.context };
  }
  if (element === 'Gtk.Button') {
    if (verbFirst(v)) return { classification: 'capability', reason: 'interactive_verb_phrase', policy: POLICY.capability };
    return { classification: 'context', reason: 'control_destination_label', policy: POLICY.context };
  }
  // Search placeholders describe the control's primary action (U5).
  if (prop === 'placeholder') {
    if (verbFirst(v)) return { classification: 'capability', reason: 'action_placeholder', policy: POLICY.capability };
    return { classification: 'context', reason: 'placeholder_hint', policy: POLICY.context };
  }
  // 7. Headings, form labels, document titles, non-interactive props.
  if (isHeading(element)) return { classification: 'context', reason: 'heading_or_label', policy: POLICY.context };
  if (kind === 'doc_title') return { classification: 'context', reason: 'document_heading', policy: POLICY.context };
  if (kind === 'prop') return { classification: 'context', reason: 'prop_label', policy: POLICY.context };
  if (kind === 'jsx_text' && element) return { classification: 'context', reason: 'visible_text', policy: POLICY.context };
  // 8. Safe default: anything unpositioned carries zero semantic weight.
  return { classification: 'incidental', reason: 'unpositioned_literal', policy: POLICY.incidental };
}
