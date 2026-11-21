// Data for /leaderboard. The page is prerendered: src/pages/leaderboard.astro
// reads dashboard/public/components/{type}.json at build time and hands the
// island one compact list per type. The only ordering key is `downloads`
// (CLI installs, all time, from Supabase via generate_components_json.py).
// Sponsored placements, SkillSpector and Harness Check never reach this file.

export const LEADERBOARD_TYPES = ['skills', 'agents', 'commands', 'mcps', 'settings', 'hooks', 'mods'] as const;
export type LeaderboardType = (typeof LEADERBOARD_TYPES)[number];

/** [path without extension, installs]. The category is the first path segment, the name the last. */
export type CompactEntry = [string, number];
export type LeaderboardLists = Record<LeaderboardType, CompactEntry[]>;

export interface RankedEntry {
  rank: number;
  path: string;
  name: string;
  category: string;
  installs: number;
}

export interface CategoryBlock {
  category: string;
  components: number;
  installs: number;
  top: RankedEntry[];
}

export interface TypeStats {
  components: number;
  installs: number;
  median: number;
  /** Share of all installs that go to the top 10% of components, 0..1. */
  top10Share: number;
}

export const INSTALL_BUCKETS = [
  { label: '0', min: 0, max: 0 },
  { label: '1–99', min: 1, max: 99 },
  { label: '100–999', min: 100, max: 999 },
  { label: '1k–9.9k', min: 1000, max: 9999 },
  { label: '10k+', min: 10000, max: Infinity },
] as const;

interface RawComponent {
  path?: string;
  downloads?: number | null;
}

/** Sorts by installs (desc), then path, so equal counts keep a stable order between builds. */
export function compactList(components: RawComponent[]): CompactEntry[] {
  const out: CompactEntry[] = [];
  const seen = new Set<string>();
  for (const c of components) {
    const path = (c.path ?? '').replace(/\.(md|json)$/, '').replace(/^\/+|\/+$/g, '');
    if (!path || seen.has(path)) continue;
    seen.add(path);
    const n = Number(c.downloads);
    out.push([path, Number.isFinite(n) && n > 0 ? Math.floor(n) : 0]);
  }
  return out.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/**
 * Competition ranking (1, 2, 2, 4): components with the same number of
 * installs share a rank. Expects a list sorted by compactList.
 */
export function rankList(list: CompactEntry[]): RankedEntry[] {
  let rank = 0;
  let prev = -1;
  return list.map(([path, installs], i) => {
    if (installs !== prev) {
      rank = i + 1;
      prev = installs;
    }
    const parts = path.split('/');
    return { rank, path, name: parts[parts.length - 1], category: parts[0], installs };
  });
}

/** Categories ordered by their total installs, each with its top N components. */
export function topByCategory(ranked: RankedEntry[], perCategory = 5): CategoryBlock[] {
  const blocks = new Map<string, CategoryBlock>();
  for (const e of ranked) {
    let b = blocks.get(e.category);
    if (!b) {
      b = { category: e.category, components: 0, installs: 0, top: [] };
      blocks.set(e.category, b);
    }
    b.components += 1;
    b.installs += e.installs;
    if (b.top.length < perCategory && e.installs > 0) b.top.push(e);
  }
  return [...blocks.values()]
    .filter((b) => b.top.length > 0)
    .sort((a, b) => b.installs - a.installs || a.category.localeCompare(b.category));
}

export function typeStats(list: CompactEntry[]): TypeStats {
  const counts = list.map((e) => e[1]).sort((a, b) => b - a);
  const installs = counts.reduce((s, n) => s + n, 0);
  const n = counts.length;
  const median = n === 0 ? 0 : n % 2 ? counts[(n - 1) / 2] : (counts[n / 2 - 1] + counts[n / 2]) / 2;
  const topN = Math.max(1, Math.ceil(n * 0.1));
  const topInstalls = counts.slice(0, topN).reduce((s, v) => s + v, 0);
  return { components: n, installs, median, top10Share: installs ? topInstalls / installs : 0 };
}

export function bucketCounts(lists: CompactEntry[][]): number[] {
  const out = INSTALL_BUCKETS.map(() => 0);
  for (const list of lists) {
    for (const [, n] of list) {
      const i = INSTALL_BUCKETS.findIndex((b) => n >= b.min && n <= b.max);
      if (i >= 0) out[i] += 1;
    }
  }
  return out;
}

export function matchesQuery(e: RankedEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return e.path.toLowerCase().includes(q) || e.name.replace(/-/g, ' ').includes(q);
}

export function isLeaderboardType(v: string): v is LeaderboardType {
  return (LEADERBOARD_TYPES as readonly string[]).includes(v);
}
