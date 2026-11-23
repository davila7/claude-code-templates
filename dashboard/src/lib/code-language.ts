// File name → highlight.js language for the Files tab's Code view. Kept apart from
// code-highlight.ts so the explorer can decide whether to load the highlighter at all
// without pulling the grammars into the page bundle.

const BY_EXTENSION: Record<string, string> = {
  md: 'markdown', markdown: 'markdown', mdx: 'markdown',
  py: 'python', pyi: 'python',
  patch: 'diff', diff: 'diff',
  html: 'xml', htm: 'xml', xhtml: 'xml', xml: 'xml', xsd: 'xml', xsl: 'xml', svg: 'xml', plist: 'xml',
  json: 'json', jsonc: 'json', jsonl: 'json',
  ts: 'typescript', tsx: 'typescript', mts: 'typescript', cts: 'typescript',
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  sh: 'bash', bash: 'bash', zsh: 'bash',
  yaml: 'yaml', yml: 'yaml',
  tex: 'latex', sty: 'latex', cls: 'latex',
  css: 'css',
  toml: 'ini', ini: 'ini', cfg: 'ini', conf: 'ini',
  swift: 'swift',
  sql: 'sql',
  go: 'go',
  rs: 'rust',
};

const BY_NAME: Record<string, string> = {
  dockerfile: 'dockerfile',
  '.bashrc': 'bash', '.zshrc': 'bash', '.env.example': 'bash',
  '.gitignore': 'bash',
};

/** The highlight.js language for a path, or null to show it as plain text. */
export function languageForFile(path: string): string | null {
  const name = (path.split('/').pop() || '').toLowerCase();
  if (BY_NAME[name]) return BY_NAME[name];
  if (name.startsWith('dockerfile')) return 'dockerfile';
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return null;
  return BY_EXTENSION[name.slice(dot + 1)] ?? null;
}
