// Syntax highlighting for the Files tab's Code view (SkillExplorer).
// Loaded with a dynamic import after the island mounts, so it never runs during SSR
// and never weighs on the component page's first load. highlight.js through lowlight
// returns a hast tree (no HTML strings), which is split here into one token list per
// line so the viewer keeps its line-number table.
import { createLowlight } from 'lowlight';
import type { Root, RootContent } from 'hast';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import diff from 'highlight.js/lib/languages/diff';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import go from 'highlight.js/lib/languages/go';
import ini from 'highlight.js/lib/languages/ini';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import latex from 'highlight.js/lib/languages/latex';
import markdown from 'highlight.js/lib/languages/markdown';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import sql from 'highlight.js/lib/languages/sql';
import swift from 'highlight.js/lib/languages/swift';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import { languageForFile } from './code-language.ts';

export { languageForFile };

export interface CodeToken {
  text: string;
  /** The innermost highlight.js scope's classes ("hljs-keyword", "hljs-title function_"), or "" for plain text. */
  cls: string;
}

/** Files above this size stay plain: tokenizing them would stall the main thread. */
export const MAX_HIGHLIGHT_CHARS = 200_000;

const lowlight = createLowlight({
  bash, css, diff, dockerfile, go, ini, javascript, json, latex, markdown,
  python, rust, sql, swift, typescript, xml, yaml,
});

// Each token carries only its innermost scope, so one class rule colors it: an
// attribute inside a tag is "hljs-attr", not "hljs-tag hljs-attr".
function walk(nodes: RootContent[], cls: string, lines: CodeToken[][]): void {
  for (const node of nodes) {
    if (node.type === 'text') {
      const parts = node.value.split('\n');
      parts.forEach((part, i) => {
        if (i > 0) lines.push([]);
        if (!part) return;
        const line = lines[lines.length - 1];
        const last = line[line.length - 1];
        if (last && last.cls === cls) last.text += part;
        else line.push({ text: part, cls });
      });
    } else if (node.type === 'element') {
      const own = node.properties?.className;
      const added = Array.isArray(own) ? own.map(String) : [];
      walk(node.children as RootContent[], added.length ? added.join(' ') : cls, lines);
    }
  }
}

/**
 * Tokens per line for `code` in `language` (a name from languageForFile), or null when
 * the language is unknown or the file is too large. The result has exactly
 * `code.split('\n').length` lines.
 */
export function highlightLines(code: string, language: string | null): CodeToken[][] | null {
  if (!language || !lowlight.registered(language) || code.length > MAX_HIGHLIGHT_CHARS) return null;
  let tree: Root;
  try {
    tree = lowlight.highlight(language, code);
  } catch {
    return null;
  }
  const lines: CodeToken[][] = [[]];
  walk(tree.children, '', lines);
  return lines;
}
