/**
 * Security headers for www/app.aitmpl.com. Two places send them and must stay
 * identical (tests/security-headers.test.ts checks): src/middleware.ts for SSR
 * pages, which Cloudflare Pages does not give the public/_headers rules, and
 * public/_headers for static files and prerendered pages (the blog included).
 *
 * The Content-Security-Policy is Report-Only while its allowlist is checked
 * against real traffic (reports go to /api/csp-report, then Sentry). Rename
 * the header to Content-Security-Policy to enforce it.
 *
 * Third parties:
 * - Clerk (custom FAPI host clerk.aitmpl.com, Turnstile on sign-in)
 * - Google Analytics (gtag; with Google signals it also sends to www.google.com)
 * - Hotjar: only the blog articles load it (NPS survey)
 * - jsDelivr: mermaid in some blog articles
 * - Google Fonts
 * Images may come from any https host: component markdown embeds them.
 *
 * script-src keeps 'unsafe-inline' because Astro islands, gtag and the blog
 * ship inline scripts; moving to hashes is the step after enforcing.
 */
export const CSP_HEADER = 'Content-Security-Policy-Report-Only';

export const CSP_REPORT_PATH = '/api/csp-report';

const DIRECTIVES: Record<string, string[]> = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    "'unsafe-inline'",
    'https://www.googletagmanager.com',
    'https://clerk.aitmpl.com',
    'https://challenges.cloudflare.com',
    'https://*.hotjar.com',
    'https://cdn.jsdelivr.net',
  ],
  'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://*.hotjar.com'],
  'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com', 'https://*.hotjar.com'],
  'img-src': ["'self'", 'data:', 'blob:', 'https:'],
  'connect-src': [
    "'self'",
    'https://api.github.com',
    'https://clerk.aitmpl.com',
    'https://www.googletagmanager.com',
    'https://*.google-analytics.com',
    'https://*.analytics.google.com',
    'https://www.google.com',
    'https://*.hotjar.com',
    'https://*.hotjar.io',
    'wss://*.hotjar.com',
    'https://cdn.jsdelivr.net',
  ],
  'frame-src': ['https://challenges.cloudflare.com', 'https://*.hotjar.com'],
  'worker-src': ["'self'", 'blob:'],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
  'report-uri': [CSP_REPORT_PATH],
};

export const CSP_POLICY = Object.entries(DIRECTIVES)
  .map(([name, values]) => `${name} ${values.join(' ')}`)
  .join('; ');

export const SECURITY_HEADERS: Record<string, string> = {
  [CSP_HEADER]: CSP_POLICY,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

/** Only HTML documents need them. */
export function isHtml(contentType: string | null): boolean {
  return /^text\/html/i.test(contentType ?? '');
}

export interface CspViolation {
  directive: string;
  blocked: string;
  page: string;
  source: string;
}

// Reduce a URL to its origin; keywords (inline, eval, data) pass through.
function origin(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'data:' || url.protocol === 'blob:' ? url.protocol.slice(0, -1) : url.origin;
  } catch {
    return value.slice(0, 40);
  }
}

function path(value: unknown): string {
  if (typeof value !== 'string') return '';
  try {
    return new URL(value).pathname.slice(0, 200);
  } catch {
    return '';
  }
}

/**
 * Parses a report-uri body ({"csp-report": {...}}) or a Reporting API batch
 * ([{type: "csp-violation", body: {...}}]). Drops reports caused by browser
 * extensions, which the site cannot fix.
 */
export function parseCspReports(payload: unknown): CspViolation[] {
  const raw: Record<string, unknown>[] = [];
  if (Array.isArray(payload)) {
    for (const r of payload) {
      if (r && typeof r === 'object' && (r as { type?: unknown }).type === 'csp-violation') {
        const body = (r as { body?: unknown }).body;
        if (body && typeof body === 'object') raw.push(body as Record<string, unknown>);
      }
    }
  } else if (payload && typeof payload === 'object') {
    const body = (payload as Record<string, unknown>)['csp-report'];
    if (body && typeof body === 'object') raw.push(body as Record<string, unknown>);
  }

  const extension = /^(chrome|moz|safari(-web)?|ms-browser)-extension:/i;
  return raw
    .map((r) => ({
      directive: String(r['effective-directive'] ?? r.effectiveDirective ?? r['violated-directive'] ?? '')
        .split(' ')[0]
        .slice(0, 40),
      blocked: r['blocked-uri'] ?? r.blockedURL,
      page: path(r['document-uri'] ?? r.documentURL),
      source: r['source-file'] ?? r.sourceFile,
    }))
    .filter((v) => v.directive && !extension.test(String(v.blocked ?? '')) && !extension.test(String(v.source ?? '')))
    .map((v) => ({ ...v, blocked: origin(v.blocked), source: origin(v.source) }));
}
