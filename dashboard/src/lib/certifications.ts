// Data contract for /certifications (dashboard/public/certifications.json).
// Entries are curated by hand today (`source: "manual"`). A future pipeline
// (like scripts/generate_claude_jobs.py for /jobs) may add entries with
// another `source`; it must keep manual entries and only refresh its own.

export type LearningKind = 'certification' | 'course';
export type Eligibility = 'public' | 'partners';

export interface LearningItem {
  id: string;
  kind: LearningKind;
  title: string;
  provider: string;
  platform?: string;
  /** Subject areas, each one of CATEGORIES (one or more). Provider-neutral so filters keep working as providers are added. */
  categories: Category[];
  /** Who it is for, one of ROLES. */
  role?: Role;
  /** Normalized difficulty, one of LEVELS. The provider's own tier name stays in the title. */
  level?: Level;
  audience?: string;
  description: string;
  url: string;
  prepUrl?: string;
  prepCourses?: number;
  examGuideUrl?: string;
  /** null or absent = free */
  price?: { amount: number; currency: string } | null;
  format?: string;
  credential?: string;
  eligibility: Eligibility;
  /** Who qualifies when eligibility is not public, in the provider's own terms. */
  eligibilityNote?: string;
  topics: string[];
  source: string;
  addedAt: string;
  verifiedAt: string;
}

/** Keyed by LearningItem.provider. */
export interface ProviderInfo {
  icon?: string;
}

export interface CertificationsData {
  schemaVersion: number;
  lastUpdated: string;
  sources: string[];
  providers: Record<string, ProviderInfo>;
  items: LearningItem[];
}

// Controlled vocabularies. New entries (by hand or from a pipeline) must use
// these values, so the same subject never splits into two filter options
// ("CI/CD" vs "DevOps"). Add a value here when a new area really appears.
export const CATEGORIES = [
  'AI & Agents',
  'Cloud & Infrastructure',
  'DevOps & CI/CD',
  'Security',
  'Frontend',
  'Backend',
  'Mobile',
  'Data & Analytics',
  'Databases',
  'Testing & QA',
  'Business',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const ROLES = ['Developer', 'Architect', 'DevOps', 'Security', 'Data', 'Business'] as const;
export type Role = (typeof ROLES)[number];

export const LEVELS = ['Entry', 'Intermediate', 'Advanced'] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_ORDER: Record<string, number> = Object.fromEntries(LEVELS.map((l, i) => [l, i]));

export type PriceBand = 'free' | 'paid';
export function priceBand(item: LearningItem): PriceBand {
  return !item.price || item.price.amount === 0 ? 'free' : 'paid';
}

/** Facets the page filters on. Each maps an item to the value(s) it matches. */
export const FACETS = {
  category: (i: LearningItem) => i.categories,
  provider: (i: LearningItem) => [i.provider],
  kind: (i: LearningItem) => [i.kind],
  level: (i: LearningItem) => (i.level ? [i.level] : []),
  role: (i: LearningItem) => (i.role ? [i.role] : []),
  price: (i: LearningItem) => [priceBand(i)],
} satisfies Record<string, (i: LearningItem) => string[]>;
export type FacetKey = keyof typeof FACETS;
export type Selection = Partial<Record<FacetKey, string[]>>;

export function matchesQuery(item: LearningItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [item.title, item.provider, ...item.categories, item.role, item.level, ...item.topics]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(q);
}

/** Items matching the query and every selected facet, optionally ignoring one facet (for its own counts). */
export function filterItems(items: LearningItem[], query: string, sel: Selection, ignore?: FacetKey): LearningItem[] {
  return items.filter(
    (i) =>
      matchesQuery(i, query) &&
      (Object.keys(sel) as FacetKey[]).every((k) => {
        const chosen = sel[k];
        if (k === ignore || !chosen || chosen.length === 0) return true;
        return FACETS[k](i).some((v) => chosen.includes(v));
      }),
  );
}

/** Option counts for one facet, given the other active filters, most common first. */
export function facetCounts(items: LearningItem[], query: string, sel: Selection, facet: FacetKey): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const i of items) for (const v of FACETS[facet](i)) counts.set(v, 0);
  for (const i of filterItems(items, query, sel, facet)) for (const v of FACETS[facet](i)) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

export type SortKey = 'recommended' | 'price-asc' | 'price-desc' | 'newest';
export function sortBy(items: LearningItem[], key: SortKey): LearningItem[] {
  const amount = (i: LearningItem) => i.price?.amount ?? 0;
  if (key === 'price-asc') return [...items].sort((a, b) => amount(a) - amount(b));
  if (key === 'price-desc') return [...items].sort((a, b) => amount(b) - amount(a));
  if (key === 'newest') return [...items].sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  return items;
}

export function isHttpUrl(url: unknown): url is string {
  return typeof url === 'string' && /^https:\/\/[^\s]+$/i.test(url);
}

export function formatPrice(price: LearningItem['price']): string {
  if (!price || price.amount === 0) return 'Free';
  const symbol = price.currency === 'USD' ? '$' : `${price.currency} `;
  return `${symbol}${price.amount}`;
}

/** Default order: certifications before courses, then provider, then level, then title. */
export function sortItems(items: LearningItem[]): LearningItem[] {
  return [...items].sort(
    (a, b) =>
      (a.kind === b.kind ? 0 : a.kind === 'certification' ? -1 : 1) ||
      a.provider.localeCompare(b.provider) ||
      (LEVEL_ORDER[a.level ?? ''] ?? 9) - (LEVEL_ORDER[b.level ?? ''] ?? 9) ||
      a.title.localeCompare(b.title),
  );
}

export async function fetchCertifications(): Promise<CertificationsData> {
  const r = await fetch('/certifications.json');
  const d: CertificationsData = await r.json();
  return { ...d, items: sortItems(d.items.filter((i) => isHttpUrl(i.url))) };
}

/** Returns the problems in one provider entry; an empty list means it is valid. */
export function validateProvider(info: ProviderInfo): string[] {
  const errors: string[] = [];
  if (info.icon !== undefined && !isHttpUrl(info.icon)) errors.push('icon must be https');
  return errors;
}

/** Returns the problems in one entry; an empty list means it is valid. */
export function validateItem(item: Partial<LearningItem>): string[] {
  const errors: string[] = [];
  if (!item.id || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(item.id)) errors.push('id must be kebab-case');
  if (item.kind !== 'certification' && item.kind !== 'course') errors.push('kind must be certification or course');
  for (const f of ['title', 'provider', 'description', 'source'] as const) {
    if (!item[f] || typeof item[f] !== 'string') errors.push(`${f} is required`);
  }
  if (!isHttpUrl(item.url)) errors.push('url must be https');
  for (const f of ['prepUrl', 'examGuideUrl'] as const) {
    if (item[f] !== undefined && !isHttpUrl(item[f])) errors.push(`${f} must be https`);
  }
  if (!Array.isArray(item.categories) || item.categories.length === 0 || item.categories.some((c) => !(CATEGORIES as readonly string[]).includes(c)))
    errors.push('categories must be a non-empty list of CATEGORIES');
  if (item.role !== undefined && !(ROLES as readonly string[]).includes(item.role)) errors.push('role must be one of ROLES');
  if (item.level !== undefined && !(LEVELS as readonly string[]).includes(item.level)) errors.push('level must be one of LEVELS');
  if (item.eligibility !== 'public' && item.eligibility !== 'partners') errors.push('eligibility must be public or partners');
  if (!Array.isArray(item.topics) || item.topics.some((t) => typeof t !== 'string' || !t)) errors.push('topics must be an array of strings');
  if (item.price && (typeof item.price.amount !== 'number' || !item.price.currency)) errors.push('price needs amount and currency');
  for (const f of ['addedAt', 'verifiedAt'] as const) {
    if (!item[f] || !/^\d{4}-\d{2}-\d{2}$/.test(item[f]!)) errors.push(`${f} must be YYYY-MM-DD`);
  }
  return errors;
}
