import { defineMiddleware } from 'astro:middleware';

/**
 * Injects Cloudflare Pages runtime env bindings into process.env so that
 * API routes and libs can use `import.meta.env.X || process.env.X` as a
 * unified pattern that works on both Vercel (Node.js) and Cloudflare Pages.
 *
 * On Cloudflare Pages, secrets set via `wrangler pages secret put` are
 * available only through `context.locals.runtime.env`, not process.env.
 * This middleware bridges that gap.
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

  return next();
});
