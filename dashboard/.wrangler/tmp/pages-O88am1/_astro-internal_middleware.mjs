globalThis.process ??= {}; globalThis.process.env ??= {};
import { e as defineMiddleware, s as sequence } from './chunks/render-context_DtXct7C0.mjs';
import { p as prefersMarkdown, n as notFoundMarkdown, M as MARKDOWN_CONTENT_TYPE } from './chunks/agent-readiness_CxCJBz5C.mjs';
import { i as isHtml, S as SECURITY_HEADERS } from './chunks/security-headers_HVsub2Nm.mjs';
import './chunks/astro-designed-error-pages_f2Gqe-d6.mjs';
import './chunks/astro/server_OwOTC5bf.mjs';

const NOINDEX_HEADER = "noindex, nofollow";
const NOINDEX_BASES = ["/api", "/my-components", "/github-callback"];
function isNoindexPath(pathname) {
  return NOINDEX_BASES.some((base) => pathname === base || pathname.startsWith(`${base}/`));
}

const onRequest$2 = defineMiddleware(async (context, next) => {
  const runtime = context.locals.runtime;
  if (runtime?.env) {
    for (const [key, value] of Object.entries(runtime.env)) {
      if (typeof value === "string" && !process.env[key]) {
        process.env[key] = value;
      }
    }
  }
  const response = await next();
  if (isHtml(response.headers.get("content-type"))) {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      if (!response.headers.has(name)) response.headers.set(name, value);
    }
  }
  if (isNoindexPath(context.url.pathname)) {
    response.headers.set("X-Robots-Tag", NOINDEX_HEADER);
  }
  if (response.status !== 404 || context.url.pathname.startsWith("/api/")) {
    return response;
  }
  if (prefersMarkdown(context.request.headers.get("accept"))) {
    return new Response(notFoundMarkdown(context.url.pathname), {
      status: 404,
      headers: { "Content-Type": MARKDOWN_CONTENT_TYPE, Vary: "Accept" }
    });
  }
  const vary = response.headers.get("Vary") ?? "";
  if (!/(^|,)\s*accept\s*(,|$)/i.test(vary)) response.headers.append("Vary", "Accept");
  return response;
});

const onRequest$1 = (context, next) => {
  if (context.isPrerendered) {
    context.locals.runtime ??= {
      env: process.env
    };
  }
  return next();
};

const onRequest = sequence(
	onRequest$1,
	onRequest$2
	
);

export { onRequest };
