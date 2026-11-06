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
  /** Provider-neutral area shown as a filter, e.g. Development, Architecture, Business. */
  category?: string;
  level?: string;
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

export const LEVEL_ORDER: Record<string, number> = { Foundations: 0, Professional: 1, Advanced: 2 };

export function isHttpUrl(url: unknown): url is string {
  return typeof url === 'string' && /^https:\/\/[^\s]+$/i.test(url);
}

export function formatPrice(price: LearningItem['price']): string {
  if (!price || price.amount === 0) return 'Free';
  const symbol = price.currency === 'USD' ? '$' : `${price.currency} `;
  return `${symbol}${price.amount}`;
}

/** Category order follows the first appearance in the file; inside a category, Foundations before Professional. */
export function sortItems(items: LearningItem[]): LearningItem[] {
  const categoryIndex = new Map<string, number>();
  items.forEach((i) => {
    const c = i.category ?? '';
    if (!categoryIndex.has(c)) categoryIndex.set(c, categoryIndex.size);
  });
  return [...items].sort(
    (a, b) =>
      (a.kind === b.kind ? 0 : a.kind === 'certification' ? -1 : 1) ||
      categoryIndex.get(a.category ?? '')! - categoryIndex.get(b.category ?? '')! ||
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
  if (item.eligibility !== 'public' && item.eligibility !== 'partners') errors.push('eligibility must be public or partners');
  if (!Array.isArray(item.topics)) errors.push('topics must be an array');
  if (item.price && (typeof item.price.amount !== 'number' || !item.price.currency)) errors.push('price needs amount and currency');
  for (const f of ['addedAt', 'verifiedAt'] as const) {
    if (!item[f] || !/^\d{4}-\d{2}-\d{2}$/.test(item[f]!)) errors.push(`${f} must be YYYY-MM-DD`);
  }
  return errors;
}
