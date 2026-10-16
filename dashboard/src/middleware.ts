import { defineMiddleware } from 'astro:middleware';
import { MARKDOWN_CONTENT_TYPE, notFoundMarkdown, prefersMarkdown } from './lib/agent-readiness';

/**
 * Injects Cloudflare Pages runtime env bindings into process.env so that
 * API routes and libs can use `import.meta.env.X || process.env.X` as a
 * unified pattern that works on both Vercel (Node.js) and Cloudflare Pages.
 *
 * On Cloudflare Pages, secrets set via `wrangler pages secret put` are
 * available only through `context.locals.runtime.env`, not process.env.
 * This middleware bridges that gap.
 *
 * It also gives page 404s (unknown paths, unknown component slugs) a
 * Markdown body when the client asks for text/markdown, and `Vary: Accept`
 * either way so caches keep the two variants apart. /api/* 404s are JSON
 * (src/pages/api/[...path].ts) and are left alone.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const runtime = (context.locals as { runtime?: { env?: Record<string, string> } }).runtime;

  if (runtime?.env) {
    for (const [key, value] of Object.entries(runtime.env)) {
      if (typeof value === 'string' && !process.env[key]) {
        process.env[key] = value;
      }
    }
  }

  const response = await next();

  if (response.status !== 404 || context.url.pathname.startsWith('/api/')) {
    return response;
  }

  if (prefersMarkdown(context.request.headers.get('accept'))) {
    return new Response(notFoundMarkdown(context.url.pathname), {
      status: 404,
      headers: { 'Content-Type': MARKDOWN_CONTENT_TYPE, Vary: 'Accept' },
    });
  }

  const vary = response.headers.get('Vary') ?? '';
  if (!/(^|,)\s*accept\s*(,|$)/i.test(vary)) response.headers.append('Vary', 'Accept');
  return response;
});
