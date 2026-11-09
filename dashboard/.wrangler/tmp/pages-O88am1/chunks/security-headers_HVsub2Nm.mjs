globalThis.process ??= {}; globalThis.process.env ??= {};
const CSP_HEADER = "Content-Security-Policy-Report-Only";
const CSP_REPORT_PATH = "/api/csp-report";
const DIRECTIVES = {
  "default-src": ["'self'"],
  "script-src": [
    "'self'",
    "'unsafe-inline'",
    "https://www.googletagmanager.com",
    "https://clerk.aitmpl.com",
    "https://challenges.cloudflare.com",
    "https://*.hotjar.com",
    "https://cdn.jsdelivr.net"
  ],
  "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://*.hotjar.com"],
  "font-src": ["'self'", "data:", "https://fonts.gstatic.com", "https://*.hotjar.com"],
  "img-src": ["'self'", "data:", "blob:", "https:"],
  "connect-src": [
    "'self'",
    "https://api.github.com",
    "https://clerk.aitmpl.com",
    "https://www.googletagmanager.com",
    "https://*.google-analytics.com",
    "https://*.analytics.google.com",
    "https://www.google.com",
    "https://*.hotjar.com",
    "https://*.hotjar.io",
    "wss://*.hotjar.com",
    "https://cdn.jsdelivr.net"
  ],
  "frame-src": ["https://challenges.cloudflare.com", "https://*.hotjar.com"],
  "worker-src": ["'self'", "blob:"],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'none'"],
  "report-uri": [CSP_REPORT_PATH]
};
const CSP_POLICY = Object.entries(DIRECTIVES).map(([name, values]) => `${name} ${values.join(" ")}`).join("; ");
const SECURITY_HEADERS = {
  [CSP_HEADER]: CSP_POLICY,
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
};
function isHtml(contentType) {
  return /^text\/html/i.test(contentType ?? "");
}
function origin(value) {
  if (typeof value !== "string" || !value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "data:" || url.protocol === "blob:" ? url.protocol.slice(0, -1) : url.origin;
  } catch {
    return value.slice(0, 40);
  }
}
function path(value) {
  if (typeof value !== "string") return "";
  try {
    return new URL(value).pathname.slice(0, 200);
  } catch {
    return "";
  }
}
function parseCspReports(payload) {
  const raw = [];
  if (Array.isArray(payload)) {
    for (const r of payload) {
      if (r && typeof r === "object" && r.type === "csp-violation") {
        const body = r.body;
        if (body && typeof body === "object") raw.push(body);
      }
    }
  } else if (payload && typeof payload === "object") {
    const body = payload["csp-report"];
    if (body && typeof body === "object") raw.push(body);
  }
  const extension = /^(chrome|moz|safari(-web)?|ms-browser)-extension:/i;
  return raw.map((r) => ({
    directive: String(r["effective-directive"] ?? r.effectiveDirective ?? r["violated-directive"] ?? "").split(" ")[0].slice(0, 40),
    blocked: r["blocked-uri"] ?? r.blockedURL,
    page: path(r["document-uri"] ?? r.documentURL),
    source: r["source-file"] ?? r.sourceFile
  })).filter((v) => v.directive && !extension.test(String(v.blocked ?? "")) && !extension.test(String(v.source ?? ""))).map((v) => ({ ...v, blocked: origin(v.blocked), source: origin(v.source) }));
}

export { SECURITY_HEADERS as S, isHtml as i, parseCspReports as p };
