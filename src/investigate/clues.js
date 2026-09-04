// CodeAtlas Phase 4B.1 — Semantic Clue Extraction
//
// Deterministic, regex-based extraction of semantic clues from source content.
// No AST, no embeddings. Every clue preserves provenance.

export function extractClues(content, filePath, fileNode) {
  const clues = [];
  if (!content || typeof content !== 'string') return clues;
  const lines = content.split('\n');

  // --- Naming evidence (filename + directory + declared symbols) ---
  const base = filePath.split('/').pop() || filePath;
  clues.push({
    type: 'naming',
    evidence_type: 'filename',
    file: filePath,
    observed: `filename suggests '${base}'`,
    confidence: 'low',
    raw: base,
  });
  if (fileNode?.declares?.length) {
    for (const sym of fileNode.declares.slice(0, 5)) {
      clues.push({
        type: 'naming',
        evidence_type: 'symbol',
        file: filePath,
        symbol: sym,
        observed: `declares symbol '${sym}'`,
        confidence: 'low',
        raw: sym,
      });
    }
  }

  // --- Dependency evidence is supplied via graph external nodes, not source ---

  // --- UI evidence: quoted strings that look like user-visible text ---
  // 1) aria/placeholder/title/alt/label props
  const propRe = /(aria-label|placeholder|title|alt|label)\s*=\s*["']([^"']{2,60})["']/gi;
  let m;
  while ((m = propRe.exec(content)) !== null) {
    const val = m[2].trim();
    if (val.length >= 2 && !isCodeLike(val)) {
      clues.push({
        type: 'ui',
        evidence_type: 'prop_label',
        file: filePath,
        observed: `UI prop ${m[1]}="${val}"`,
        confidence: 'medium',
        raw: val,
      });
    }
  }
  // 2) JSX text nodes: >Some Text<
  const jsxRe = />\s*([A-Z][A-Za-z0-9 _\/\-']{2,60})\s*</g;
  while ((m = jsxRe.exec(content)) !== null) {
    const val = m[1].trim();
    if (val.length >= 3 && !isCodeLike(val) && val.split(/\s+/).length >= 2) {
      clues.push({
        type: 'ui',
        evidence_type: 'jsx_text',
        file: filePath,
        observed: `visible text "${val}"`,
        confidence: 'high',
        raw: val,
      });
    }
  }
  // 3) Generic quoted strings that look like UI phrases (capitalized, spaced, 3-40 chars)
  const quotedRe = /"([^"]{4,60})"/g;
  while ((m = quotedRe.exec(content)) !== null) {
    const val = m[1].trim();
    if (isUiLike(val)) {
      // avoid double-counting if already captured via propRe (propRe already consumed; this is okay)
      clues.push({
        type: 'ui',
        evidence_type: 'string_literal',
        file: filePath,
        observed: `string literal "${val}" suggests user-facing text`,
        confidence: 'low',
        raw: val,
      });
    }
  }

  // --- Behavioral evidence: function defs, API calls, handlers ---
  const funcRe = /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(|def\s+(\w+)\s*\()/g;
  while ((m = funcRe.exec(content)) !== null) {
    const name = m[1] || m[2] || m[3];
    if (name && name.length >= 2 && !isCommonNoise(name)) {
      clues.push({
        type: 'behavioral',
        evidence_type: 'function',
        file: filePath,
        symbol: name,
        observed: `defines behavior '${name}'`,
        confidence: 'low',
        raw: name,
      });
    }
  }
  const apiPatterns = [
    { re: /createServerFn\s*\(/g, desc: 'server function (TanStack Start)' },
    { re: /getDocs|setDoc|collection\(|doc\(|getAdminDb|getFirestore/g, desc: 'Firestore/persistence operation' },
    { re: /fetchNotionPosters|loadPublishedPosters|submitPosterToNotion/g, desc: 'poster data-fetch (naming) operation' },
    { re: /fetch\s*\(|axios\./g, desc: 'HTTP fetch' },
    { re: /Popen|subprocess\.|shutil\.which|launch_tool|open_in_editor/g, desc: 'desktop integration / subprocess' },
    { re: /useState|useReducer|useEffect|onClick|onSubmit|handle.*\(|navigate\(|createRoute/g, desc: 'UI state/handler' },
  ];
  for (const { re, desc } of apiPatterns) {
    re.lastIndex = 0;
    let found = false;
    while ((m = re.exec(content)) !== null && !found) {
      // cap at 1 per pattern per file to avoid spam
      clues.push({
        type: 'behavioral',
        evidence_type: 'api',
        file: filePath,
        observed: `${desc} observed`,
        confidence: 'medium',
        raw: m[0],
      });
      found = true;
    }
  }

  // --- Comments (first 3 meaningful) ---
  for (let i = 0; i < lines.length && clues.filter((c) => c.evidence_type === 'comment').length < 3; i++) {
    const line = lines[i].trim();
    if (line.startsWith('//') || line.startsWith('#') || line.startsWith('/*') || line.startsWith('*')) {
      const text = line.replace(/^\/\/\s?|^#\s?|^\/\*\s?|^\*\s?|\*\/$/g, '').trim();
      if (text.length >= 10 && text.length <= 120 && !text.startsWith('eslint') && !text.startsWith('prettier')) {
        clues.push({
          type: 'behavioral',
          evidence_type: 'comment',
          file: filePath,
          observed: `comment: "${text}"`,
          confidence: 'low',
          raw: text,
        });
      }
    }
  }

  return clues;
}

function isCodeLike(s) {
  return /[\/\{\};=<>]|import\s|function\s|const\s|return\s|=>/.test(s) || s.includes('://');
}
function isUiLike(s) {
  if (s.length < 4 || s.length > 60) return false;
  if (isCodeLike(s)) return false;
  if (!/[A-Za-z]/.test(s)) return false;
  if (!/\s/.test(s)) return false; // at least 2 words
  // capitalized phrase or common UI verbs
  const uiVerbs = /^(Save|Search|Add|Create|Sign|Change|Log|Open|Submit|Load|Poster|Collection|Project|Profile|Ticket|Notion)/i;
  if (uiVerbs.test(s)) return true;
  if (/^[A-Z][a-z]+(\s+[A-Za-z]+){1,3}$/.test(s)) return true;
  return false;
}
function isCommonNoise(name) {
  return new Set(['if', 'for', 'while', 'return', 'import', 'export', 'default', 'test', 'it', 'describe']).has(name);
}
