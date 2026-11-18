// Impressions and clicks of paid and partner placements (sponsor reporting).
//
// Any element with data-spot="<kind>/<key>" and data-spot-surface="<where>" is
// a placement. lib/placement-tracking.ts watches it in the browser and posts
// events to /api/spot, which adds them to daily counters in Supabase
// (database/migrations/006_supabase_placement_daily.sql). No cookie, no id,
// no IP stored: only day, placement, surface, event and country.
//
// The path and attribute names avoid the words ad blockers match (ad, ads,
// sponsor, track, beacon, analytics, pixel), or the counts would drop for the
// readers most likely to use one.
//
// This file stays free of browser and server APIs so node --test can load it.

export const PLACEMENT_KINDS = ['featured', 'sponsored'] as const;
export type PlacementKind = (typeof PLACEMENT_KINDS)[number];

export const PLACEMENT_SURFACES = ['home', 'featured_page', 'grid', 'search', 'component_page'] as const;
export type PlacementSurface = (typeof PLACEMENT_SURFACES)[number];

export const PLACEMENT_EVENTS = ['impression', 'click', 'cta', 'copy'] as const;
export type PlacementEvent = (typeof PLACEMENT_EVENTS)[number];

export const SPOT_ENDPOINT = '/api/spot';

export interface SpotEvent {
  placement: string;
  surface: PlacementSurface;
  event: PlacementEvent;
}

const PLACEMENT_RE = /^([a-z]+)\/([A-Za-z0-9_-]{1,64})$/;

export function parsePlacement(value: unknown): { kind: PlacementKind; key: string } | null {
  if (typeof value !== 'string') return null;
  const m = value.match(PLACEMENT_RE);
  if (!m || !(PLACEMENT_KINDS as readonly string[]).includes(m[1])) return null;
  return { kind: m[1] as PlacementKind, key: m[2] };
}

export function isSurface(value: unknown): value is PlacementSurface {
  return typeof value === 'string' && (PLACEMENT_SURFACES as readonly string[]).includes(value);
}

export function isPlacementEvent(value: unknown): value is PlacementEvent {
  return typeof value === 'string' && (PLACEMENT_EVENTS as readonly string[]).includes(value);
}

/** A well-formed event, or null. The endpoint also checks the key exists. */
export function parseSpotEvent(body: unknown): SpotEvent | null {
  if (!body || typeof body !== 'object') return null;
  const { placement, surface, event } = body as Record<string, unknown>;
  if (!parsePlacement(placement) || !isSurface(surface) || !isPlacementEvent(event)) return null;
  return { placement: placement as string, surface, event };
}

// '/featured/forte' -> 'featured/forte'. Anything else -> null.
export function featuredPlacement(url: string): string | null {
  const m = String(url || '').match(/^\/featured\/([A-Za-z0-9_-]{1,64})\/?$/);
  return m ? `featured/${m[1]}` : null;
}

// Crawlers, link unfurlers, monitors and headless browsers. Most never run the
// page's script; this catches the ones that do (or that post directly).
const BOT_UA = /bot|crawl|spider|slurp|preview|fetch|monitor|headless|lighthouse|pagespeed|phantom|puppeteer|playwright|selenium|curl|wget|python|go-http|java\/|okhttp|axios|node-fetch|httpclient/i;

export function isBotUserAgent(ua: string | null | undefined): boolean {
  return !ua || BOT_UA.test(ua);
}

// IAB viewability: half the element on screen for one second. An element taller
// than the screen can never be half visible, so for those 30% of the viewport
// counts, as IAB does for large formats.
export const VIEW_MS = 1000;

export function isViewable(ratio: number, visibleHeight: number, viewportHeight: number): boolean {
  if (ratio >= 0.5) return true;
  return viewportHeight > 0 && visibleHeight >= 0.3 * viewportHeight;
}

/** Click inside a placement: a link to another site is the sponsor's 'cta'. */
export function clickEvent(href: string | null, pageOrigin: string): PlacementEvent | null {
  if (!href) return null;
  let url: URL;
  try {
    url = new URL(href, pageOrigin);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  return url.origin === new URL(pageOrigin).origin ? 'click' : 'cta';
}
