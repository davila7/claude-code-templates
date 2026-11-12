// Formatting for the component page's file list, About column and language bar.
// Pure functions over the `meta` block written by scripts/generate_components_json.py.

import type { PluginContents } from './types';

export interface MetaFile {
  path: string;
  bytes: number;
  lines: number | null;
}

export interface FileEntry {
  name: string;
  kind: 'dir' | 'file';
  files: number;
  lines: number;
  bytes: number;
  /** The file to open in the explorer when the row is picked. */
  firstFile: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** "Oct 30, 2026", read from the date the commit carries (the author's day, not the server's). */
export function formatDate(iso: string | undefined): string {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}

export function initials(name: string): string {
  const words = name.replace(/\[bot\]$/, '').split(/[\s._-]+/).filter(Boolean);
  return words.slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';
}

/** Commit subject without the trailing "(#1234)" GitHub adds on squash merges. */
export function commitTitle(subject: string): string {
  return subject.replace(/\s*\(#\d+\)\s*$/, '');
}

export function formatCount(n: number, one: string, many: string): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
}

// What a catalog plugin ships (Component.contains), in display order. The keys
// are the ones scripts/external_skills.py plugin_inventory() writes; the summary
// below and the component page both read this one list.
export const PLUGIN_KINDS: { key: keyof PluginContents; label: string; one: string; many: string }[] = [
  { key: 'skills', label: 'Skills', one: 'skill', many: 'skills' },
  { key: 'commands', label: 'Commands', one: 'command', many: 'commands' },
  { key: 'agents', label: 'Agents', one: 'agent', many: 'agents' },
  { key: 'hooks', label: 'Hooks', one: 'hook event', many: 'hook events' },
  { key: 'mcpServers', label: 'MCP servers', one: 'MCP server', many: 'MCP servers' },
  { key: 'lspServers', label: 'LSP servers', one: 'LSP server', many: 'LSP servers' },
  { key: 'outputStyles', label: 'Output styles', one: 'output style', many: 'output styles' },
  { key: 'themes', label: 'Themes', one: 'theme', many: 'themes' },
  { key: 'monitors', label: 'Monitors', one: 'monitor', many: 'monitors' },
  { key: 'bin', label: 'Executables', one: 'executable', many: 'executables' },
];

/** "7 skills, 1 agent" from a plugin's contains map; kinds with nothing are left out. */
export function pluginContentsSummary(contains: PluginContents | undefined): string {
  return PLUGIN_KINDS
    .filter(({ key }) => (contains?.[key]?.length ?? 0) > 0)
    .map(({ key, one, many }) => formatCount(contains![key]!.length, one, many))
    .join(', ');
}

export function totals(files: MetaFile[]): { files: number; lines: number; bytes: number } {
  return files.reduce(
    (t, f) => ({ files: t.files + 1, lines: t.lines + (f.lines ?? 0), bytes: t.bytes + f.bytes }),
    { files: 0, lines: 0, bytes: 0 },
  );
}

/** Top-level rows like a GitHub tree: folders first, then files, each alphabetical. */
export function topLevelEntries(files: MetaFile[]): FileEntry[] {
  const byName = new Map<string, FileEntry>();
  for (const f of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    const slash = f.path.indexOf('/');
    const name = slash === -1 ? f.path : f.path.slice(0, slash);
    const kind = slash === -1 ? 'file' : 'dir';
    const entry = byName.get(name) ?? { name, kind, files: 0, lines: 0, bytes: 0, firstFile: f.path };
    entry.files += 1;
    entry.lines += f.lines ?? 0;
    entry.bytes += f.bytes;
    byName.set(name, entry);
  }
  const cmp = (a: FileEntry, b: FileEntry) => a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  const all = [...byName.values()];
  return [...all.filter((e) => e.kind === 'dir').sort(cmp), ...all.filter((e) => e.kind === 'file').sort(cmp)];
}

/** Language shares in percent with one decimal, largest first; the tail past `max` becomes "Other". */
export function languageShares(languages: { name: string; bytes: number }[], max = 4): { name: string; pct: number }[] {
  const total = languages.reduce((s, l) => s + l.bytes, 0);
  if (!total) return [];
  const sorted = [...languages].sort((a, b) => b.bytes - a.bytes);
  const head = sorted.slice(0, max);
  const tail = sorted.slice(max).reduce((s, l) => s + l.bytes, 0);
  const rows = head.map((l) => ({ name: l.name, bytes: l.bytes }));
  if (tail) {
    const other = rows.find((r) => r.name === 'Other');
    if (other) other.bytes += tail;
    else rows.push({ name: 'Other', bytes: tail });
  }
  return rows.map((r) => ({ name: r.name, pct: Math.round((r.bytes / total) * 1000) / 10 }));
}

// Words a title-cased slug gets wrong ("Mcp", "Github"): the page H1 spells them this way.
const WORD_SPELLING: Record<string, string> = {
  ai: 'AI', api: 'API', cc: 'CC', apis: 'APIs', aws: 'AWS', ci: 'CI', cd: 'CD', cli: 'CLI', cms: 'CMS', css: 'CSS',
  db: 'DB', dns: 'DNS', e2e: 'E2E', gcp: 'GCP', gpu: 'GPU', graphql: 'GraphQL', github: 'GitHub',
  gitlab: 'GitLab', html: 'HTML', http: 'HTTP', https: 'HTTPS', ios: 'iOS', javascript: 'JavaScript',
  jwt: 'JWT', k8s: 'K8s', llm: 'LLM', llms: 'LLMs', macos: 'macOS', mcp: 'MCP', ml: 'ML', mysql: 'MySQL',
  nextjs: 'Next.js', nodejs: 'Node.js', npm: 'npm', oauth: 'OAuth', openai: 'OpenAI', pdf: 'PDF',
  php: 'PHP', postgresql: 'PostgreSQL', pr: 'PR', prs: 'PRs', qa: 'QA', rag: 'RAG', rest: 'REST',
  sdk: 'SDK', seo: 'SEO', sql: 'SQL', ssh: 'SSH', svg: 'SVG', tdd: 'TDD', typescript: 'TypeScript',
  ui: 'UI', url: 'URL', ux: 'UX', vscode: 'VS Code', xml: 'XML', yaml: 'YAML',
};

/** The H1 of a component page: "react-best-practices" → "React Best Practices", "mcp-builder" → "MCP Builder". */
export function displayName(name: string): string {
  return (name ?? '')
    .replace(/\.(md|json)$/, '')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => WORD_SPELLING[w.toLowerCase()] ?? w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export interface NextStepItem<T> {
  component: T;
  /** Value of data-related on the link (read by the analytics script). */
  block: 'loop' | 'same_category';
}

interface Linkable { name: string; path?: string; category?: string }

const key = (c: Linkable) => (c.path ?? c.name).replace(/\.(md|json)$/, '');

/**
 * The "Next step" block: the loops that install this component, then other components of
 * its category in alphabetical order, starting after this one and wrapping around, so the
 * pages of a category link to each other instead of all to the first names. Never by
 * downloads, never sponsored.
 */
export function nextStepItems<T extends Linkable>(current: T, siblings: T[], loops: T[], max = 6): NextStepItem<T>[] {
  const items: NextStepItem<T>[] = loops.slice(0, max).map((component) => ({ component, block: 'loop' }));
  const sameCategory = siblings
    .filter((c) => (c.category ?? '') === (current.category ?? '') && key(c) !== key(current))
    .sort((a, b) => a.name.localeCompare(b.name, 'en') || key(a).localeCompare(key(b), 'en'));
  const start = sameCategory.findIndex((c) => c.name.localeCompare(current.name, 'en') > 0);
  const rotated = start <= 0 ? sameCategory : [...sameCategory.slice(start), ...sameCategory.slice(0, start)];
  for (const component of rotated) {
    if (items.length >= max) break;
    items.push({ component, block: 'same_category' });
  }
  return items;
}
