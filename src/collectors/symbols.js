// CodeAtlas Phase 3 — Symbol Collector

import { safeReadFile } from '../utils.js';
import { join } from 'node:path';

/**
 * Patterns for TypeScript/JavaScript exports.
 */
const JS_EXPORT_PATTERNS = [
  // export function name(...)
  /export\s+(?:async\s+)?function\s+(\w+)/g,
  // export class Name
  /export\s+(?:default\s+)?class\s+(\w+)/g,
  // export const/let/var name
  /export\s+(?:const|let|var)\s+(\w+)/g,
  // export default function/class/const
  /export\s+default\s+(?:function|class|const|let|var)\s+(\w+)/g,
  // export { name, name2 }
  /export\s+\{([^}]+)\}/g,
  // export type/interface Name
  /export\s+(?:type|interface)\s+(\w+)/g,
  // export enum Name
  /export\s+enum\s+(\w+)/g,
  // export default (anonymous)
  /export\s+default\s+/g,
];

/**
 * Patterns for Python top-level definitions.
 */
const PYTHON_SYMBOL_PATTERNS = [
  // def function_name(
  /^def\s+(\w+)\s*\(/gm,
  // class ClassName
  /^class\s+(\w+)\s*[:(]/gm,
];

/**
 * Detect if a function definition looks like a React component.
 * This is evidence only — we do NOT conclude it IS a component.
 */
function isReactComponentEvidence(content, symbolName, lineContent) {
  // Named like a component (PascalCase)
  if (/^[A-Z]/.test(symbolName)) {
    // Contains JSX return or React patterns
    if (content.includes('jsx') || content.includes('createElement') ||
        lineContent.includes('React.FC') || lineContent.includes('React.Component')) {
      return { evidence: true, reason: 'PascalCase name with JSX/React patterns' };
    }
    return { evidence: true, reason: 'PascalCase name may indicate component' };
  }
  return { evidence: false };
}

/**
 * Extract exported symbols from a TypeScript/JavaScript file.
 */
function collectJsTsSymbols(filePath, content) {
  const symbols = [];
  const seen = new Set();

  for (const pattern of JS_EXPORT_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(content)) !== null) {
      const name = match[1];

      // Handle export { name1, name2 }
      if (match[0].includes('{')) {
        const namedExports = match[1]
          .split(',')
          .map(s => s.trim().split(/\s+as\s+/)[0].trim())
          .filter(Boolean);

        for (const n of namedExports) {
          if (!seen.has(n)) {
            seen.add(n);
            symbols.push({
              file: filePath,
              name: n,
              symbol_kind: 'named_export',
              confidence: 'high',
            });
          }
        }
        continue;
      }

      // Export default (anonymous)
      if (!name && match[0].includes('default')) {
        if (!seen.has('default')) {
          seen.add('default');
          symbols.push({
            file: filePath,
            name: 'default',
            symbol_kind: 'default_export',
            confidence: 'high',
          });
        }
        continue;
      }

      if (name && !seen.has(name)) {
        seen.add(name);

        let symbolKind = 'export';
        if (match[0].includes('function')) symbolKind = 'exported_function';
        else if (match[0].includes('class')) symbolKind = 'exported_class';
        else if (match[0].includes('const') || match[0].includes('let') || match[0].includes('var')) {
          symbolKind = 'exported_variable';
        }
        else if (match[0].includes('type') || match[0].includes('interface')) {
          symbolKind = 'exported_type';
        }
        else if (match[0].includes('enum')) symbolKind = 'exported_enum';

        // Check for React component evidence
        const lineContent = content.split('\n').find(l => l.includes(name)) || '';
        const reactEvidence = isReactComponentEvidence(content, name, lineContent);

        const symbol = {
          file: filePath,
          name,
          symbol_kind: symbolKind,
          confidence: 'high',
        };

        if (reactEvidence.evidence) {
          symbol.component_evidence = reactEvidence.reason;
        }

        symbols.push(symbol);
      }
    }
  }

  return symbols;
}

/**
 * Extract top-level symbols from a Python file.
 */
function collectPythonSymbols(filePath, content) {
  const symbols = [];
  const seen = new Set();
  const lines = content.split('\n');

  let indentLevel = 0;
  let inTopLevel = true;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Detect top-level definitions (no leading whitespace)
    const leadingSpaces = line.length - line.trimStart().length;

    // def function_name(
    const defMatch = trimmed.match(/^def\s+(\w+)\s*\(/);
    if (defMatch && leadingSpaces === 0) {
      const name = defMatch[1];
      if (!seen.has(name)) {
        seen.add(name);
        symbols.push({
          file: filePath,
          name,
          symbol_kind: 'function',
          confidence: 'high',
        });
      }
    }

    // class ClassName
    const classMatch = trimmed.match(/^class\s+(\w+)/);
    if (classMatch && leadingSpaces === 0) {
      const name = classMatch[1];
      if (!seen.has(name)) {
        seen.add(name);
        symbols.push({
          file: filePath,
          name,
          symbol_kind: 'class',
          confidence: 'high',
        });
      }
    }
  }

  // Check for __main__ execution clue
  if (content.includes('if __name__')) {
    symbols.push({
      file: filePath,
      name: '__main__',
      symbol_kind: 'entry_clue',
      confidence: 'high',
    });
  }

  return symbols;
}

/**
 * Collect symbols from all source files.
 */
export function collectSymbols(classifiedFiles, root) {
  const allSymbols = [];
  const errors = [];

  for (const file of classifiedFiles.source) {
    const content = safeReadFile(join(root, file.path));
    if (content === null) {
      errors.push({
        file: file.path,
        error: 'could not read file',
        confidence: 'low',
      });
      continue;
    }

    try {
      let fileSymbols;
      if (file.language === 'Python') {
        fileSymbols = collectPythonSymbols(file.path, content);
      } else {
        fileSymbols = collectJsTsSymbols(file.path, content);
      }
      allSymbols.push(...fileSymbols);
    } catch (err) {
      errors.push({
        file: file.path,
        error: `symbol extraction error: ${err.message}`,
        confidence: 'low',
      });
    }
  }

  return { symbols: allSymbols, errors };
}
