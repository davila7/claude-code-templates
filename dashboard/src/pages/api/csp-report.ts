import type { APIRoute } from 'astro';
import { captureApiError } from '../../lib/api/error-tracking';
import { parseCspReports } from '../../lib/security-headers';

// Browsers POST here when a page breaks the Report-Only policy (src/lib/security-headers.ts).
// Each distinct directive + blocked origin goes to Sentry once per 6 h per
// Cloudflare colo, so a popular page cannot use up the Sentry quota. They go
// as warnings, one issue per directive + origin: most come from browser
// extensions or in-browser translation injecting into the page, and at the
// default 'error' level each new origin became a high-priority issue that the
// Sentry alert rule emailed.
const MAX_BODY_BYTES = 16 * 1024;
const DEDUPE_SECONDS = 6 * 60 * 60;

async function firstSighting(key: string): Promise<boolean> {
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  if (!cache) return true;
  const url = `https://csp-report.aitmpl.internal/${encodeURIComponent(key)}`;
  if (await cache.match(url)) return false;
  await cache.put(url, new Response('1', { headers: { 'Cache-Control': `max-age=${DEDUPE_SECONDS}` } }));
  return true;
}

export const POST: APIRoute = async ({ request }) => {
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) return new Response(null, { status: 413 });

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response(null, { status: 400 });
  }

  for (const v of parseCspReports(payload).slice(0, 10)) {
    const key = `${v.directive} ${v.blocked}`;
    if (!(await firstSighting(key))) continue;
    await captureApiError(`CSP report-only: ${v.directive} blocked ${v.blocked || '(empty)'}`, {
      route: '/api/csp-report',
      page: v.page,
      source: v.source,
    }, { level: 'warning', fingerprint: ['csp-report', v.directive, v.blocked || '(empty)'] });
  }

  return new Response(null, { status: 204 });
};
