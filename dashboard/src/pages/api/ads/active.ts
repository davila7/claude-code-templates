import type { APIRoute } from 'astro';
import { corsHeaders, corsResponse, jsonResponse } from '../../../lib/api/cors';
import { getNeonClient } from '../../../lib/api/neon';
import { captureApiError } from '../../../lib/api/error-tracking';

export const prerender = false;

export const OPTIONS: APIRoute = async () => corsResponse();

/**
 * Public list of currently active sponsored ads, ordered by activation date
 * (earliest buyer wins the slot). Exposes no user or payment data.
 */
export const GET: APIRoute = async () => {
  try {
    const sql = getNeonClient();
    const ads = await sql`
      SELECT id, component_type, component_path, component_name, ends_at
      FROM sponsored_ads
      WHERE status = 'active' AND ends_at > now()
      ORDER BY starts_at ASC
    `;

    return new Response(JSON.stringify({ ads }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60, s-maxage=300',
        ...corsHeaders,
      },
    });
  } catch (error) {
    await captureApiError(error, { route: '/api/ads/active' });
    // Fail open with an empty list so search/grids never break on an ads outage
    return jsonResponse({ ads: [] });
  }
};
