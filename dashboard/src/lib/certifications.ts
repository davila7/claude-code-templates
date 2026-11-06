// Data contract for /certifications (dashboard/public/claude-certifications.json).
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
  track?: string;
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
  topics: string[];
  source: string;
  addedAt: string;
  verifiedAt: string;
}

export interface CertificationsData {
  schemaVersion: number;
  lastUpdated: string;
  sources: string[];
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

/** Track order follows the first appearance in the file; inside a track, Foundations before Professional. */
export function sortItems(items: LearningItem[]): LearningItem[] {
  const trackIndex = new Map<string, number>();
  items.forEach((i) => {
    const t = i.track ?? '';
    if (!trackIndex.has(t)) trackIndex.set(t, trackIndex.size);
  });
  return [...items].sort(
    (a, b) =>
      (a.kind === b.kind ? 0 : a.kind === 'certification' ? -1 : 1) ||
      trackIndex.get(a.track ?? '')! - trackIndex.get(b.track ?? '')! ||
      (LEVEL_ORDER[a.level ?? ''] ?? 9) - (LEVEL_ORDER[b.level ?? ''] ?? 9) ||
      a.title.localeCompare(b.title),
  );
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
