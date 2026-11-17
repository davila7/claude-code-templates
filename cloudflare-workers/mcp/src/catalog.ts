// Catalog access for the aitmpl MCP server.
//
// The only data source is what www.aitmpl.com already publishes:
//   /api/v1/catalog.json     Catalog API v1 (the public contract; 8 types)
//   /api/v1/version.json     sha256 of the catalog, for cheap freshness checks
//   /components/plugins.json plugins (not in v1 yet), a bare array
//   /component-content/...   one component's full text, read on demand
//
// Search ranks by text match only, then by id: the same scoring as the CLI's
// `--search` (cli-tool/src/catalog-lookup.js). Downloads and sponsored
// placements never change the order; this module does not read ads data at all.

export const SITE = 'https://www.aitmpl.com';
export const CLI = 'npx claude-code-templates@latest';

export const TYPES = ['agents', 'commands', 'skills', 'hooks', 'mcps', 'settings', 'loops', 'mods', 'plugins'] as const;
export type ComponentType = (typeof TYPES)[number];

export const FLAG: Record<ComponentType, string> = {
  agents: 'agent', commands: 'command', skills: 'skill', hooks: 'hook', mcps: 'mcp',
  settings: 'setting', loops: 'loop', mods: 'mod', plugins: 'plugin',
};

// What each type writes and whether it runs code on the user's machine.
export const WRITES: Record<ComponentType, { where: string; runsCode: boolean }> = {
  agents: { where: '.claude/agents/<name>.md', runsCode: false },
  commands: { where: '.claude/commands/<name>.md', runsCode: false },
  skills: { where: '.claude/skills/<name>/', runsCode: false },
  hooks: { where: '.claude/settings.json (hooks), plus any script under .claude/hooks/', runsCode: true },
  mcps: { where: '.mcp.json (an MCP server Claude Code starts locally or connects to)', runsCode: true },
  settings: { where: '.claude/settings.json (merged), plus any script under .claude/scripts/', runsCode: true },
  loops: { where: 'the loop file plus every component it references', runsCode: true },
  mods: { where: '.claude/skills/<name>/ (a Claude Code plugin with a hooks module)', runsCode: true },
  plugins: { where: "Claude Code's plugin cache, enabled in .claude/settings.json (via the aitmpl marketplace)", runsCode: true },
};

export interface Scan {
  tool: string;
  toolVersion: string | null;
  score: number | null;
  severity: string | null;
  scannedAt: string | null;
  findings?: Array<{ severity: string; title: string; file?: string; line?: number }>;
}

export interface Component {
  id: string; // {type}/{category}/{name}
  type: ComponentType;
  name: string;
  category: string;
  installPath: string; // what --<flag> takes
  description: string;
  keywords: string[];
  downloads: number;
  author: string | null;
  license: string | null;
  page: string;
  sourceUrl: string | null;
  contentUrl: string;
  scan: Scan | null;
  upstream: { repo: string; commit: string } | null;
}

export interface Catalog {
  version: string;
  generatedAt: string | null;
  components: Component[];
  byId: Map<string, Component>;
}

// ---------- loading ----------

type Fetcher = (url: string) => Promise<Response>;

const CACHE_SECONDS = 300;

export const defaultFetch: Fetcher = (url) =>
  // The Cloudflare cache keeps the 3 MB catalog close to the Worker between isolates.
  fetch(url, { cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true } } as RequestInit);

async function getJson<T>(fetcher: Fetcher, url: string): Promise<T> {
  const res = await fetcher(url);
  if (!res.ok) throw new CatalogUnavailable(`${url} answered ${res.status}`);
  return (await res.json()) as T;
}

export class CatalogUnavailable extends Error {}

interface V1Component {
  id: string; type: string; name: string; category: string; path: string; description: string;
  author: string | null; license: string | null; keywords: string[] | null; downloads: number | null;
  install: { command: string; args: string[] } | null;
  urls: { page: string; source: string | null; content: string };
  scan: { tool: string; toolVersion: string; severity: string; score: number; scannedAt: string } | null;
  source: { repo: string; path: string; commit: string } | null;
}

interface LegacyPlugin {
  name: string; path: string; category: string; description: string; author: string | null; license: string | null;
  keywords?: string[]; downloads?: number; repo?: string;
  source?: { repo: string; commit: string; url?: string };
  skillspector?: { score: number; severity: string; version: string; scannedAt: string; findings?: Array<{ severity: string; title: string; file?: string; line?: number }> };
}

export function fromV1(c: V1Component): Component | null {
  if (!(TYPES as readonly string[]).includes(c.type) || c.type === 'plugins') return null;
  const type = c.type as ComponentType;
  const args = c.install?.args;
  const installPath = Array.isArray(args) && typeof args[1] === 'string' ? args[1] : c.path.replace(/\.(md|json)$/, '');
  return {
    id: c.id, type, name: c.name, category: c.category, installPath,
    description: String(c.description || ''), keywords: c.keywords || [], downloads: c.downloads || 0,
    author: c.author, license: c.license, page: c.urls.page, sourceUrl: c.urls.source, contentUrl: c.urls.content,
    scan: c.scan ? { tool: c.scan.tool, toolVersion: c.scan.toolVersion, score: c.scan.score, severity: c.scan.severity, scannedAt: c.scan.scannedAt } : null,
    upstream: c.source ? { repo: c.source.repo, commit: c.source.commit } : null,
  };
}

export function fromPlugin(p: LegacyPlugin): Component {
  const path = p.path.replace(/^\/+|\/+$/g, '');
  const s = p.skillspector;
  return {
    id: `plugins/${path}`, type: 'plugins', name: p.name, category: p.category, installPath: path,
    description: String(p.description || ''), keywords: p.keywords || [], downloads: p.downloads || 0,
    author: p.author, license: p.license,
    page: `${SITE}/component/plugins/${path}`,
    sourceUrl: p.source?.url || p.repo || null,
    contentUrl: `${SITE}/component-content/plugins/${path}.json`,
    scan: s ? { tool: 'skillspector', toolVersion: s.version, score: s.score, severity: s.severity, scannedAt: s.scannedAt, findings: s.findings } : null,
    upstream: p.source ? { repo: p.source.repo, commit: p.source.commit } : null,
  };
}

export function buildCatalog(version: string, generatedAt: string | null, v1: V1Component[], plugins: LegacyPlugin[]): Catalog {
  const components = [
    ...v1.map(fromV1).filter((c): c is Component => c !== null),
    ...plugins.map(fromPlugin),
  ].sort((a, b) => a.id.localeCompare(b.id));
  return { version, generatedAt, components, byId: new Map(components.map((c) => [c.id, c])) };
}

let cached: { catalog: Catalog; checkedAt: number } | null = null;
const RECHECK_MS = 60_000;

/** The catalog, kept in the isolate and re-checked against version.json at most once a minute. */
export async function loadCatalog(fetcher: Fetcher = defaultFetch, now = Date.now()): Promise<Catalog> {
  if (cached && now - cached.checkedAt < RECHECK_MS) return cached.catalog;
  const { sha256 } = await getJson<{ sha256: string }>(fetcher, `${SITE}/api/v1/version.json`);
  if (cached && cached.catalog.version === sha256) {
    cached.checkedAt = now;
    return cached.catalog;
  }
  const [v1, plugins] = await Promise.all([
    getJson<{ generatedAt: string; components: V1Component[] }>(fetcher, `${SITE}/api/v1/catalog.json?v=${sha256.slice(0, 12)}`),
    getJson<LegacyPlugin[]>(fetcher, `${SITE}/components/plugins.json?v=${sha256.slice(0, 12)}`).catch(() => [] as LegacyPlugin[]),
  ]);
  const catalog = buildCatalog(sha256, v1.generatedAt ?? null, v1.components, Array.isArray(plugins) ? plugins : []);
  cached = { catalog, checkedAt: now };
  return catalog;
}

export function resetCache() {
  cached = null;
}

// ---------- search (same scoring as the CLI's --search) ----------

export function queryWords(query: string): string[] {
  return String(query || '').toLowerCase().split(/[^a-z0-9.+#-]+/).filter(Boolean);
}

/** Best score of one word against one component: 10 name word, 7 name, 5 path, 4/3 keyword, 1 description, 0 none. */
export function wordScore(c: Component, word: string): number {
  const name = c.name.toLowerCase();
  if (name.split(/[-_.]+/).includes(word)) return 10;
  if (name.includes(word)) return 7;
  if (c.installPath.toLowerCase().includes(word)) return 5;
  const keywords = c.keywords.map((k) => String(k).toLowerCase());
  if (keywords.includes(word)) return 4;
  if (keywords.some((k) => k.includes(word))) return 3;
  if (c.description.toLowerCase().includes(word)) return 1;
  return 0;
}

/** Same scoring as the CLI's --search: every word must match, else 0. */
export function scoreComponent(c: Component, words: string[]): number {
  let score = 0;
  for (const word of words) {
    const best = wordScore(c, word);
    if (best === 0) return 0;
    score += best;
  }
  if (c.name.toLowerCase() === words.join('-')) score += 20;
  return score;
}

export type SearchMatch = 'all' | 'partial';

/**
 * Every word must match (the CLI's --search). When that finds nothing and the
 * query has several words, fall back to components matching some of them,
 * most words matched first, and say so with match: 'partial'.
 */
export function search(catalog: Catalog, opts: { query: string; type?: ComponentType; category?: string; limit: number }):
  { total: number; match: SearchMatch; results: Component[] } {
  const words = queryWords(opts.query);
  const category = opts.category?.toLowerCase();
  const pool = catalog.components.filter((c) => (!opts.type || c.type === opts.type)
    && (!category || c.category.toLowerCase() === category));

  const scored: Array<{ c: Component; score: number }> = [];
  for (const c of pool) {
    const score = scoreComponent(c, words);
    if (score > 0) scored.push({ c, score });
  }
  if (scored.length > 0 || words.length < 2) {
    scored.sort((a, b) => b.score - a.score || a.c.id.localeCompare(b.c.id));
    return { total: scored.length, match: 'all', results: scored.slice(0, opts.limit).map((s) => s.c) };
  }

  const partial: Array<{ c: Component; matched: number; score: number }> = [];
  for (const c of pool) {
    let matched = 0;
    let score = 0;
    for (const word of words) {
      const best = wordScore(c, word);
      if (best > 0) { matched += 1; score += best; }
    }
    if (matched > 0) partial.push({ c, matched, score });
  }
  partial.sort((a, b) => b.matched - a.matched || b.score - a.score || a.c.id.localeCompare(b.c.id));
  return { total: partial.length, match: 'partial', results: partial.slice(0, opts.limit).map((s) => s.c) };
}

// ---------- lookup ----------

export function normalizeId(input: string): string {
  return String(input || '').trim().replace(/^\/+|\/+$/g, '').replace(/\.(md|json)$/, '');
}

/** Find by id ({type}/{category}/{name}); also accepts a type plus install path or bare name. */
export function findComponent(catalog: Catalog, input: string, type?: ComponentType):
  | { component: Component }
  | { candidates: Component[] } {
  const wanted = normalizeId(input);
  const direct = catalog.byId.get(wanted) || catalog.byId.get(`${wanted}.md`) || catalog.byId.get(`${wanted}.json`);
  if (direct) return { component: direct };
  const lower = wanted.toLowerCase();
  const pool = type ? catalog.components.filter((c) => c.type === type) : catalog.components;
  const byPath = pool.filter((c) => c.installPath.toLowerCase() === lower || c.id.toLowerCase() === lower
    || `${c.type}/${c.installPath}`.toLowerCase() === lower);
  if (byPath.length === 1) return { component: byPath[0] };
  const name = lower.split('/').pop() || '';
  const byName = pool.filter((c) => c.name.toLowerCase() === name);
  if (byName.length === 1) return { component: byName[0] };
  if (byName.length > 1) return { candidates: byName.slice(0, 10) };
  return { candidates: search(catalog, { query: name.replace(/[-_]+/g, ' '), type, limit: 5 }).results };
}

export function installCommand(items: Component[], opts: { yes?: boolean } = {}): string {
  const groups = new Map<string, string[]>();
  for (const c of items) {
    const flag = FLAG[c.type];
    groups.set(flag, [...(groups.get(flag) || []), c.installPath]);
  }
  const parts = [...groups].map(([flag, paths]) => `--${flag} ${paths.join(',')}`);
  return `${CLI} ${parts.join(' ')}${opts.yes ? ' --yes' : ''}`;
}

/** Strip HTML-ish tags and collapse whitespace; cut to max characters. */
export function oneLine(text: string, max = 240): string {
  const flat = String(text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
