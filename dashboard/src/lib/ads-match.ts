/**
 * Pure matching helpers for sponsored placements, kept apart from ads.ts
 * (which reads import.meta.env at load) so node --test can import them.
 */
import type { ActiveAd } from './ads';

function pluralType(type: string): string {
  return type.endsWith('s') ? type : type + 's';
}

/** True when a component (any type form) matches an ad. */
export function matchesAd(ad: ActiveAd, type: string, path: string): boolean {
  return ad.component_type === pluralType(type) && ad.component_path === path;
}

/**
 * First active ad (endpoint order = earliest buyer first) whose component is
 * present in the given list. Returns that list item, or null. Callers render
 * it as an extra, labeled slot and never move it within `items`: sponsored
 * placements must not change the order of organic results.
 */
export function findSponsored<T extends { type: string; path: string }>(
  ads: ActiveAd[],
  items: T[]
): T | null {
  for (const ad of ads) {
    const item = items.find((i) => matchesAd(ad, i.type, i.path));
    if (item) return item;
  }
  return null;
}
