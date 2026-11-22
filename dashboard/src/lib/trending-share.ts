// Growth metrics and share links for /trending. Pure functions only: the page
// (TrendingView.tsx), the share page (/trending/{type}/{path}) and the OG image
// script (scripts/generate-og-images.mjs, run with type stripping) all use them,
// so the rank a card shows is the rank the page shows.
//
// Data comes from public/trending-data.json (scripts/generate_trending_data.py).
// "Installers" are unique IPv4 addresses or IPv6 /64s per 7 days, after
// dropping IP-days with more than 50 rows (database/migrations/007_...).

export interface TrendingItem {
  id: string;
  name: string;
  category: string;
  path?: string;
  downloadsToday: number;
  downloadsWeek: number;
  downloadsMonth: number;
  downloadsTotal: number;
  installersWeek?: number;
  installersPrevWeek?: number;
}

export interface RisingItem {
  type: string;
  name: string;
  category: string;
  path: string;
  installersWeek: number;
  installersPrevWeek: number;
  downloadsTotal: number;
}

export interface InstallersBlock {
  asOf: string;
  computedAt?: string;
  total: number;
  monthly: { month: string; new: number; cumulative: number }[];
  activeWeek: number;
  activePrevWeek: number;
  returningWeek: number;
  addedThisMonth: number | null;
}

export interface TrendingShareData {
  trending: Record<string, TrendingItem[]>;
  rising?: RisingItem[];
  installers?: InstallersBlock | null;
}

export interface ShareEntry {
  type: string;
  path: string;
  name: string;
  category: string;
  /** e.g. "#1 rising this week" or "#3 skill this week". */
  headline: string;
  installersWeek: number | null;
  installersPrevWeek: number | null;
  downloadsTotal: number;
}

const TYPE_SINGULAR: Record<string, string> = {
  skills: 'skill', agents: 'agent', commands: 'command', settings: 'setting', hooks: 'hook',
  mcps: 'MCP', mods: 'mod', loops: 'loop', plugins: 'plugin', templates: 'template',
};

// Components must clear this many installers before a percentage is shown or
// a row is badged as rising: 2 -> 6 is +200% and means nothing.
export const RISING_MIN_INSTALLERS = 25;
const SAFE_SEGMENT = /^[a-z0-9][a-z0-9._-]*$/i;

export function formatName(name: string): string {
  return name.replace(/[-_]/g, ' ').split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

/** Percentage change, rounded; null when there is no base to compare with. */
export function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** True when the item gained enough installers this week to call it rising. */
export function isRising(item: { installersWeek?: number; installersPrevWeek?: number }): boolean {
  const cur = item.installersWeek ?? 0;
  const prev = item.installersPrevWeek ?? 0;
  if (cur < RISING_MIN_INSTALLERS) return false;
  return prev === 0 || cur >= prev * 1.25;
}

/** Plural type of a trending item, from its id ("agent-foo" -> "agents"). */
export function itemType(item: Pick<TrendingItem, 'id'>): string {
  const t = item.id.split('-')[0];
  return t.endsWith('s') ? t : `${t}s`;
}

/** Only catalog paths made of plain segments become URLs. */
export function safePath(path: string | undefined): string | null {
  if (!path) return null;
  const parts = path.split('/');
  return parts.length > 0 && parts.length <= 4 && parts.every((p) => SAFE_SEGMENT.test(p)) ? path : null;
}

export function sharePath(type: string, path: string): string {
  return `/trending/${type}/${path}`;
}

export function shareImagePath(type: string, path: string): string {
  return `/og/trending/${type}/${path}.png`;
}

export function badgePath(type: string, path: string): string {
  return `/badge/${type}/${path}.svg`;
}

/**
 * One entry per component that can be shared from /trending: the rising list
 * first (its rank wins), then every per-type top 10. Items without a catalog
 * path are skipped.
 */
export function shareEntries(data: TrendingShareData): ShareEntry[] {
  const out = new Map<string, ShareEntry>();
  (data.rising ?? []).forEach((r, i) => {
    const path = safePath(r.path);
    if (!path || !TYPE_SINGULAR[r.type]) return;
    out.set(`${r.type}/${path}`, {
      type: r.type, path, name: r.name, category: r.category,
      headline: `#${i + 1} rising this week`,
      installersWeek: r.installersWeek, installersPrevWeek: r.installersPrevWeek,
      downloadsTotal: r.downloadsTotal,
    });
  });
  for (const [type, items] of Object.entries(data.trending ?? {})) {
    if (type === 'all' || !TYPE_SINGULAR[type]) continue;
    items.forEach((item, i) => {
      const path = safePath(item.path);
      const key = `${type}/${path}`;
      if (!path || out.has(key)) return;
      out.set(key, {
        type, path, name: item.name, category: item.category,
        headline: `#${i + 1} ${TYPE_SINGULAR[type]} this week`,
        installersWeek: item.installersWeek ?? null,
        installersPrevWeek: item.installersPrevWeek ?? null,
        downloadsTotal: item.downloadsTotal,
      });
    });
  }
  return [...out.values()];
}

export function findShareEntry(data: TrendingShareData, type: string, path: string): ShareEntry | null {
  return shareEntries(data).find((e) => e.type === type && e.path === path) ?? null;
}

/** The sentence a share post starts with. */
export function shareText(e: ShareEntry): string {
  const who = formatName(e.name);
  const count = e.installersWeek ? ` ${e.installersWeek.toLocaleString('en-US')} unique installers in the last 7 days.` : '';
  return `${who} is ${e.headline} on Claude Code Templates.${count}`;
}

export function xShareUrl(text: string, url: string): string {
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}

export function linkedInShareUrl(url: string): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
}

export function badgeMarkdown(origin: string, type: string, path: string): string {
  return `[![aitmpl](${origin}${badgePath(type, path)})](${origin}/component/${type}/${path})`;
}
