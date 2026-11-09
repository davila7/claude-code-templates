globalThis.process ??= {}; globalThis.process.env ??= {};
import { c as captureApiError } from '../../chunks/error-tracking_CdDsXTS0.mjs';
import { p as parseCspReports } from '../../chunks/security-headers_HVsub2Nm.mjs';
export { r as renderers } from '../../chunks/_@astro-renderers_BvXjVE0w.mjs';

const MAX_BODY_BYTES = 16 * 1024;
const DEDUPE_SECONDS = 6 * 60 * 60;
async function firstSighting(key) {
  const cache = globalThis.caches?.default;
  if (!cache) return true;
  const url = `https://csp-report.aitmpl.internal/${encodeURIComponent(key)}`;
  if (await cache.match(url)) return false;
  await cache.put(url, new Response("1", { headers: { "Cache-Control": `max-age=${DEDUPE_SECONDS}` } }));
  return true;
}
const POST = async ({ request }) => {
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) return new Response(null, { status: 413 });
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response(null, { status: 400 });
  }
  for (const v of parseCspReports(payload).slice(0, 10)) {
    const key = `${v.directive} ${v.blocked}`;
    if (!await firstSighting(key)) continue;
    await captureApiError(`CSP report-only: ${v.directive} blocked ${v.blocked || "(empty)"}`, {
      route: "/api/csp-report",
      page: v.page,
      source: v.source
    }, { level: "warning", fingerprint: ["csp-report", v.directive, v.blocked || "(empty)"] });
  }
  return new Response(null, { status: 204 });
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
