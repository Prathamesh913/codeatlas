// CodeAtlas Phase 4C.1B — Bounded Deterministic String Extraction (Part C)
//
// Extracts user-visible-string CANDIDATES together with their syntactic
// context so classifyString() can classify them (D-016). This is deliberately
// NOT a full AST: bounded, dependency-free regex passes with explicit span
// claiming so later passes never duplicate a string already captured by a
// richer (element-aware) pass.
//
// Extraction passes (fixed order; each claims character ranges that later
// passes must not overlap):
//   1. JSX/HTML tags      — element-aware capture of aria-label/title/alt/
//                           placeholder/label props and plain element text
//                           (`<Button>Save Poster</Button>`).
//   2. GTK labels         — Gtk.Label(label="…") / Gtk.Button(new_with_label…)
//                           so ProjectDock's Python UI is classified.
//   3. Error construction — throw new Error("…") / raise ValueError("…").
//   4. Console calls      — console.error/warn (diagnostic) vs log/info/debug.
//   5. Font values        — ctx.font / fontFamily (brand/font configuration).
//   6. URLs               — any http(s) literal.
//   7. Style classes      — className=/class= attributes.
//   8. Route titles       — `title: "…"` object form (route head metadata).
//   9. Generic props      — aria-label/title/alt/placeholder/label without a
//                           captured element (fallback).
//  10. Plain literals     — remaining plain quoted strings (safe default).
//
// Known bounded limitations (documented, deterministic): template-literal
// interpolation boundaries stop matches; strings inside comments or inside
// larger JS strings may be captured; max 300 candidates per file.

const TAG_RE = /<([A-Za-z][\w.]*)((?:"[^"]*"|'[^']*'|[^"'>])*)>/g;
const ATTR_PROPS = ['aria-label', 'placeholder', 'title', 'alt', 'label'];
const MAX_PER_FILE = 300;

const GTK_LABEL_RE = /Gtk\.Label\s*\([^)\n]*?label\s*=\s*["']([^"'\n]{2,160})["']/g;
const GTK_BUTTON_RE = /Gtk\.Button(?:\.new_with_label)?\s*\([^)\n]*?["']([^"'\n]{2,160})["']/g;
const ERROR_RE = /(?:throw\s+new\s+[\w.]*Error|new\s+[\w.]*Error|raise\s+[\w.]*(?:Error|Exception))\s*\(\s*["']([^"'\n]{2,160})["']/g;
const CONSOLE_RE = /console\.(error|warn|log|info|debug)\s*\(\s*["']([^"'\n]{2,160})["']/g;
const CANVAS_FONT_RE = /ctx\.font\s*=\s*(?:"([^"\n]{2,160})"|'([^'\n]{2,160})')/g;
const FONT_FAMILY_RE = /font[-_]?[Ff]amily["']?\s*[:=]\s*["']([^"'\n]{2,80})["']/g;
const URL_RE = /https?:\/\/[^\s"'<>\\]{6,200}/g;
const CLASS_RE = /\b(?:className|class)\s*=\s*["']([^"'\n]{2,160})["']/g;
const TITLE_OBJ_RE = /\btitle\s*:\s*["']([^"'\n]{2,160})["']/g;
const PROP_RE = /\b(aria-label|placeholder|title|alt|label)\s*=\s*["']([^"'\n]{2,160})["']/g;
const PLAIN_RE = /["']([^"'\n\\${]{2,120})["']/g;

/** Build an index→line lookup from precomputed line-start offsets. */
function lineLookup(content) {
  const starts = [0];
  for (let i = 0; i < content.length; i++) {
    if (content.charCodeAt(i) === 10) starts.push(i + 1);
  }
  return function lineOf(idx) {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= idx) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
}

/**
 * Mark lines inside triple-quoted blocks (Python docstrings / prose blocks).
 * Docstring text is developer documentation, not a UI string; without this
 * rule, prose like "Return [] on failure." tripped the state lexicon.
 * Deterministic parity scan per quote style.
 */
function docstringLineFlags(content) {
  const lines = content.split('\n');
  const flags = new Array(lines.length).fill(false);
  for (const style of ['"""', "'''"]) {
    let open = false;
    for (let i = 0; i < lines.length; i++) {
      const count = lines[i].split(style).length - 1;
      const inDoc = open;
      const straddles = open ? count % 2 === 1 : count >= 2;
      const opensHere = !open && count % 2 === 1;
      if (count > 0 && (inDoc || straddles || opensHere)) flags[i] = true;
      if (count % 2 === 1) open = !open;
    }
  }
  return flags;
}

function parseAttrs(attrs) {
  const found = [];
  for (const prop of ATTR_PROPS) {
    const re = new RegExp(`(?:^|\\s)${prop}\\s*=\\s*["']([^"']{2,160})["']`);
    const m = attrs.match(re);
    if (m) found.push({ prop, value: m[1] });
  }
  return found;
}

/**
 * Extract string candidates with context hints from one source file.
 *
 * @param {string} content
 * @returns {Array<{ value: string, line: number, kind: string, element?: string, prop?: string }>}
 */
export function extractStrings(content) {
  if (!content) return [];
  const lineOf = lineLookup(content);
  const docLines = docstringLineFlags(content);
  const claimed = [];
  const overlaps = (start, end) => claimed.some(([s, e]) => start < e && end > s);
  const out = [];

  const push = (value, idx, kind, extra = {}) => {
    if (out.length >= MAX_PER_FILE) return false;
    const entry = { value: String(value).trim(), line: lineOf(idx), kind, ...extra };
    out.push(entry);
    return true;
  };
  const claim = (start, end) => claimed.push([start, end]);

  // 1. Tag pass (element-aware) — claims each tag's range.
  TAG_RE.lastIndex = 0;
  let tag;
  while ((tag = TAG_RE.exec(content)) !== null) {
    const [full, element, attrs] = tag;
    const start = tag.index;
    const end = start + full.length;
    claim(start, end);

    const lower = element.toLowerCase();
    for (const { prop, value } of parseAttrs(attrs)) {
      const kind = lower === 'title' || lower === 'head' ? 'doc_title' : 'prop';
      push(value, start, kind, { element, prop });
    }

    // Plain text between this tag and the next tag: JSX/HTML text node.
    const rest = content.slice(end);
    let i = 0;
    while (i < rest.length && /\s/.test(rest[i])) i++;
    if (i < rest.length && rest[i] !== '<') {
      const lt = rest.indexOf('<', i);
      if (lt !== -1) {
        const text = rest.slice(i, lt).trim();
        if (text.length >= 2 && text.length <= 160 && !/[{}]/.test(text)) {
          const textStart = end + i;
          claim(textStart, textStart + text.length);
          const kind = lower === 'title' ? 'doc_title' : 'jsx_text';
          push(text, textStart, kind, { element });
        }
      }
    }
  }

  const run = (re, kind, group = 1, extra = {}, skipDocstring = false) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(content)) !== null) {
      if (skipDocstring && docLines[lineOf(m.index) - 1]) continue;
      if (overlaps(m.index, m.index + m[0].length)) continue;
      claim(m.index, m.index + m[0].length);
      if (!push(m[group], m.index, kind, { ...extra })) return;
    }
  };

  // 2. GTK labels.
  run(GTK_LABEL_RE, 'gtk_label');
  run(GTK_BUTTON_RE, 'gtk_button_label');
  // 3. Error construction (skipping docstring prose that merely mentions it).
  run(ERROR_RE, 'error_construction', 1, {}, true);
  // 4. Console: error/warn are diagnostics; log/info/debug are output.
  CONSOLE_RE.lastIndex = 0;
  let c;
  while ((c = CONSOLE_RE.exec(content)) !== null) {
    if (overlaps(c.index, c.index + c[0].length)) continue;
    claim(c.index, c.index + c[0].length);
    const kind = c[1] === 'error' || c[1] === 'warn' ? 'console_diagnostic' : 'console_output';
    if (!push(c[2], c.index, kind, { prop: `console.${c[1]}` })) break;
  }
  // 5. Font configuration values.
  CANVAS_FONT_RE.lastIndex = 0;
  let cf;
  while ((cf = CANVAS_FONT_RE.exec(content)) !== null) {
    if (overlaps(cf.index, cf.index + cf[0].length)) continue;
    claim(cf.index, cf.index + cf[0].length);
    if (!push(cf[1] || cf[2], cf.index, 'canvas_font')) break;
  }
  run(FONT_FAMILY_RE, 'font_config');
  // 6. URLs.
  run(URL_RE, 'url');
  // 7. Style classes.
  run(CLASS_RE, 'class_name');
  // 8. Route-head title objects.
  run(TITLE_OBJ_RE, 'doc_title', 1, { prop: 'title' });
  // 9. Generic props (element unknown).
  PROP_RE.lastIndex = 0;
  let p;
  while ((p = PROP_RE.exec(content)) !== null) {
    if (overlaps(p.index, p.index + p[0].length)) continue;
    claim(p.index, p.index + p[0].length);
    if (!push(p[2], p.index, 'prop', { prop: p[1] })) break;
  }
  // 10. Remaining plain literals (must contain two letters to skip symbols;
  // docstring lines are developer documentation, not UI strings).
  PLAIN_RE.lastIndex = 0;
  let s;
  while ((s = PLAIN_RE.exec(content)) !== null) {
    if (docLines[lineOf(s.index) - 1]) continue;
    if (overlaps(s.index, s.index + s[0].length)) continue;
    const v = s[1];
    if ((v.match(/[A-Za-z]/g) || []).length < 2) continue;
    claim(s.index, s.index + s[0].length);
    if (!push(v, s.index, 'plain')) break;
  }

  // Deterministic ordering + dedupe.
  const seen = new Set();
  const deduped = [];
  for (const e of out.sort((a, b) => a.line - b.line || a.value.localeCompare(b.value) || a.kind.localeCompare(b.kind))) {
    const key = `${e.line}|${e.value}|${e.kind}|${e.element || ''}|${e.prop || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(e);
  }
  return deduped;
}
