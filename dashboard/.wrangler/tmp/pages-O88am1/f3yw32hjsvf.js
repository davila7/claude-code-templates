// <define:__ROUTES__>
var define_ROUTES_default = {
  version: 1,
  include: [
    "/*"
  ],
  exclude: [
    "/",
    "/_astro/*",
    "/#",
    "/function-hooks",
    "/component/function-hook/*",
    "/component/function-hooks/*",
    "/index.html",
    "/404.html",
    "/apple-touch-icon.png",
    "/braingrid-logo.png",
    "/braingrid-logo.webp",
    "/certifications.json",
    "/claude-code-logo.png",
    "/claude-code-logo.webp",
    "/claude-jobs.json",
    "/components.json",
    "/counts.json",
    "/favicon.ico",
    "/favicon.svg",
    "/funding.json",
    "/icon-192.png",
    "/icon-512.png",
    "/logo.png",
    "/logo.webp",
    "/marketplace.json",
    "/openapi.json",
    "/plugins.json",
    "/robots.txt",
    "/search-index.json",
    "/site.webmanifest",
    "/tinyfish-logo.png",
    "/trending-dashboard.html",
    "/trending-data.json",
    "/.well-known/*",
    "/blog/*",
    "/css/*",
    "/components/*",
    "/og/*",
    "/supporters/*",
    "/api/v1/catalog.json",
    "/api/v1/schema.json",
    "/api/v1/version.json",
    "/api/v1/catalog/agents.json",
    "/api/v1/catalog/commands.json",
    "/api/v1/catalog/hooks.json",
    "/api/v1/catalog/loops.json",
    "/api/v1/catalog/mcps.json",
    "/api/v1/catalog/mods.json",
    "/api/v1/catalog/settings.json",
    "/api/v1/catalog/skills.json",
    "/static/*",
    "/component-content/*",
    "/llms-full.txt",
    "/llms.txt",
    "/sitemap.xml",
    "/skills",
    "/agents",
    "/commands",
    "/settings",
    "/hooks",
    "/mcps",
    "/loops",
    "/mods",
    "/about",
    "/certifications",
    "/developers/*",
    "/jobs",
    "/plugins/*",
    "/privacy",
    "/trending"
  ]
};

// node_modules/wrangler/templates/pages-dev-pipeline.ts
import worker from "/home/user/claude-code-templates/dashboard/.wrangler/tmp/pages-O88am1/bundledWorker-0.3381116562925992.mjs";
import { isRoutingRuleMatch } from "/home/user/claude-code-templates/dashboard/node_modules/wrangler/templates/pages-dev-util.ts";
export * from "/home/user/claude-code-templates/dashboard/.wrangler/tmp/pages-O88am1/bundledWorker-0.3381116562925992.mjs";
var routes = define_ROUTES_default;
var pages_dev_pipeline_default = {
  fetch(request, env, context) {
    const { pathname } = new URL(request.url);
    for (const exclude of routes.exclude) {
      if (isRoutingRuleMatch(pathname, exclude)) {
        return env.ASSETS.fetch(request);
      }
    }
    for (const include of routes.include) {
      if (isRoutingRuleMatch(pathname, include)) {
        const workerAsHandler = worker;
        if (workerAsHandler.fetch === void 0) {
          throw new TypeError("Entry point missing `fetch` handler");
        }
        return workerAsHandler.fetch(request, env, context);
      }
    }
    return env.ASSETS.fetch(request);
  }
};
export {
  pages_dev_pipeline_default as default
};
//# sourceMappingURL=f3yw32hjsvf.js.map
