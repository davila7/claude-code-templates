/**
 * Client helpers for sponsored ads (CCT Ads). Active ads come from the
 * dynamic /api/ads/active endpoint (never from the static catalog files).
 * Failures always degrade to "no ads" so search and grids keep working.
 */

export interface ActiveAd {
  // Contract with the (private) ads writer service: component_type is stored
  // PLURAL ('agents', 'commands', ...) — unlike other tables in this repo,
  // which store it singular. matchesAd() below relies on this.
  component_type: string;
  component_path: string;
  component_name: string;
  ends_at: string;
}

const ADS_URL = '/api/ads/active';
const CACHE_TTL = 5 * 60 * 1000;
const STALE_MAX_MS = 15 * 60 * 1000;

// Feature flag: sponsored placements are inert unless PUBLIC_ADS_ENABLED=true
// is set at build time (dashboard/wrangler.toml [vars]). While off, no request
// is made and search/grid behave exactly as before.
const ADS_ENABLED = import.meta.env.PUBLIC_ADS_ENABLED === 'true';

let adsCache: { data: ActiveAd[]; ts: number } | null = null;

/** Drop ads already past ends_at — edge/client caches can serve stale lists. */
function stillLive(ads: ActiveAd[]): ActiveAd[] {
  const now = Date.now();
  return ads.filter((ad) => {
    const end = Date.parse(ad.ends_at);
    return Number.isNaN(end) || end > now;
  });
}

export async function fetchActiveAds(): Promise<ActiveAd[]> {
  if (!ADS_ENABLED) return [];

  const now = Date.now();
  if (adsCache && now - adsCache.ts < CACHE_TTL) {
    return stillLive(adsCache.data);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(ADS_URL, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json().catch(() => null);
    const data: ActiveAd[] = Array.isArray(payload?.ads) ? payload.ads : [];
    adsCache = { data, ts: now };
    return stillLive(data);
  } catch {
    clearTimeout(timeoutId);
    // Serve last-known-good during short outages, but never indefinitely:
    // past STALE_MAX_MS a deactivated placement must stop showing.
    if (adsCache && now - adsCache.ts < STALE_MAX_MS) {
      return stillLive(adsCache.data);
    }
    return [];
  }
}

function pluralType(type: string): string {
  return type.endsWith('s') ? type : type + 's';
}

/** True when a component (any type form) matches an ad. */
export function matchesAd(ad: ActiveAd, type: string, path: string): boolean {
  return ad.component_type === pluralType(type) && ad.component_path === path;
}

/**
 * First active ad (endpoint order = earliest buyer first) whose component is
 * present in the given list. Returns the matching list index, or -1.
 */
export function findSponsoredIndex<T extends { type: string; path: string }>(
  ads: ActiveAd[],
  items: T[]
): number {
  for (const ad of ads) {
    const idx = items.findIndex((item) => matchesAd(ad, item.type, item.path));
    if (idx !== -1) return idx;
  }
  return -1;
}
