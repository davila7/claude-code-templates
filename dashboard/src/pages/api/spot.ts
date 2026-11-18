import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { captureApiError } from '../../lib/api/error-tracking';
import { getCountry } from '../../lib/api/geo';
import { FEATURED_ITEMS } from '../../lib/constants';
import { featuredPlacement, isBotUserAgent, parsePlacement, parseSpotEvent } from '../../lib/placements';

export const prerender = false;

/**
 * Placement events for sponsor reports (lib/placements.ts). Adds one to a daily
 * counter in Supabase (migration 006). Stores no IP, user agent or id.
 *
 * Always answers 204 so the browser has nothing to retry or show; dropped
 * events (bots, cross-site posts, unknown placements) are simply not counted.
 */

const FEATURED_KEYS = new Set(
  FEATURED_ITEMS.map((f) => featuredPlacement(f.url)).filter((p): p is string => p !== null),
);
// CCT Ads rows are UUIDs (aitmpl-ads sponsored_ads.id).
const SPONSORED_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const MAX_BODY = 512;

function knownPlacement(placement: string): boolean {
  const parsed = parsePlacement(placement);
  if (!parsed) return false;
  if (parsed.kind === 'featured') return FEATURED_KEYS.has(placement);
  return SPONSORED_KEY.test(parsed.key);
}

// cf-ipcountry can also be 'T1' (Tor) or 'XX'; the table takes ISO codes or '--'.
function countryCode(request: Request): string {
  const c = getCountry(request);
  return c && /^[A-Z]{2}$/.test(c) ? c : '--';
}

const noContent = () => new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });

// PostgREST "function not found": migration 006 not run yet. Not worth a
// Sentry event per page view.
let missingFunctionLogged = false;

export const POST: APIRoute = async ({ request }) => {
  // Browsers send Sec-Fetch-Site on every POST; only our own pages may count.
  const site = request.headers.get('sec-fetch-site');
  if (site !== null && site !== 'same-origin') return noContent();
  if (isBotUserAgent(request.headers.get('user-agent'))) return noContent();

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return noContent();
    body = JSON.parse(text);
  } catch {
    return noContent();
  }

  const evt = parseSpotEvent(body);
  if (!evt || !knownPlacement(evt.placement)) return noContent();

  const url = import.meta.env.SUPABASE_URL || process.env.SUPABASE_URL;
  const key = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return noContent();

  try {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { error } = await supabase.rpc('record_placement_event', {
      p_placement: evt.placement,
      p_surface: evt.surface,
      p_event: evt.event,
      p_country: countryCode(request),
    });
    if (error) {
      if (error.code === 'PGRST202') {
        if (!missingFunctionLogged) {
          missingFunctionLogged = true;
          console.warn('record_placement_event missing: run database/migrations/006');
        }
      } else {
        throw new Error(`record_placement_event: ${error.message}`);
      }
    }
  } catch (error) {
    await captureApiError(error, { route: '/api/spot' });
  }
  return noContent();
};
