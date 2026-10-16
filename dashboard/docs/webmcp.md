# WebMCP Integration (V1)

Status: **V1 shipped** — read-only catalog tools, behind a build-time flag.

## What it is

[WebMCP](https://github.com/webmachinelearning/webmcp) is a W3C Web Machine
Learning CG proposal that lets a web page expose client-side functionality as
"tools" (name + description + JSON Schema + JS callback) that AI agents can
discover and invoke via `document.modelContext`. Think of it as an in-page MCP
server with no backend: tools reuse the page's own code, session, and data.

aitmpl.com registers a small set of **read-only** tools so browser agents
(Chrome 149+/Edge 150+ origin trials, ChatGPT Desktop, Brave Leo) can search
the component catalog and produce install commands without scraping the UI.

## Architecture

```
DashboardLayout.astro  ── bundled <script> ──►  initWebMCP()  (src/lib/webmcp.ts)
                                                    │
                              feature-detect document.modelContext
                              + PUBLIC_WEBMCP_ENABLED build flag
                                                    │
                                       registerTool() × 4 (read-only)
                                                    │
                          reuses src/lib/data.ts helpers and the static
                          JSON artifacts already served from public/
```

- **`dashboard/src/lib/webmcp.ts`** — the whole feature. Exports a single
  `initWebMCP()` that registers the tools. No new dependencies; minimal local
  typings instead of the `webmcp-types` package.
- **`dashboard/src/layouts/DashboardLayout.astro`** — calls `initWebMCP()`
  from a bundled `<script>`, so the tools are available on every page (all
  pages use this layout; Astro dedupes the script).
- **Data sources** (all existing, same-origin, edge-cached): `search-index.json`,
  `components/{type}.json`, `counts.json`, `trending-data.json`, via
  `fetchSearchIndex()`, `fetchComponentsByType()`, and `getInstallCommand()`
  from `src/lib/data.ts` (shared 5-min in-memory caches with the UI).

## Feature flag

`PUBLIC_WEBMCP_ENABLED` (build-time, same pattern as `PUBLIC_ADS_ENABLED`):

- `dashboard/wrangler.toml` `[vars]` — production value (`"true"`).
- `.github/workflows/deploy.yml` — passed to the CI build step.
- Anything other than the string `"true"` disables the feature entirely
  (`initWebMCP()` returns before touching `document.modelContext`).

Browsers without WebMCP support are unaffected: `initWebMCP()` feature-detects
`document.modelContext.registerTool` and no-ops. Registration failures
(`NotAllowedError` from Permissions Policy, `InvalidStateError` for duplicate
names) are swallowed and never break the page.

## Tools

All tools are read-only (`readOnlyHint: true`). Tools returning
community-authored component descriptions also set `untrustedContentHint: true`
so agents treat that text as data, not instructions (prompt-injection
mitigation).

### `search-components`
Free-text search over the flat search index (name, description, category),
optional `type` filter. Returns `{ total, results[] }` with at most 20 results:
`{ name, type, category, description, url, installCommand }`.

Input: `{ query: string, type?: "agent"|"command"|"mcp"|"setting"|"hook"|"skill"|"loop"|"template" }`

### `get-component-details`
Looks up one component by exact name or catalog path within its type file.
Returns the catalog entry plus `installCommand` and the component page `url`,
or `{ error }` when not found.

Input: `{ name: string, type: <same enum> }`

### `get-install-command`
Returns `{ installCommand }` — the exact
`npx claude-code-templates@latest --<type> <path>` string, built by the same
`getInstallCommand()` helper the UI uses.

Input: `{ name: string, type: <same enum> }`

### `get-catalog-stats`
No input. Returns `{ counts, downloads, lastUpdated }` from `counts.json` and
`trending-data.json` (`globalStats`). Each source degrades to `{}`/`null` on
fetch failure.

## Conventions inside `webmcp.ts`

- Types are normalized: tools accept singular or plural (`"agent"`/`"agents"`);
  URLs and catalog files use plural, install flags use singular.
- Component URLs follow the canonical detail route:
  `https://www.aitmpl.com/component/{type-plural}/{path-without-extension}`.
- All tool results are plain JSON-serializable objects.

## Testing

In a browser with WebMCP enabled (origin-trial build or supported agent),
`getTools()`/`executeTool()` are same-origin callable from DevTools:

```js
const tools = await document.modelContext.getTools();
await document.modelContext.executeTool(
  tools.find(t => t.name === 'search-components'),
  { query: 'react' }
);
```

In a normal browser, stub the API before load to verify registration:

```js
// paste in DevTools, then reload
document.modelContext = { registerTool: t => (console.log('registered', t.name), Promise.resolve()) };
```

## Out of scope for V1 / future work

- **Origin Trial tokens** — Chrome/Edge require registering www.aitmpl.com in
  their WebMCP origin trials and adding the `<meta http-equiv="origin-trial">`
  tag. Not needed for ChatGPT Desktop or Brave Leo.
- Declarative `<form>` tools, `exposedTo` cross-origin iframe exposure,
  service-worker tools.
- Write/consequential tools (cart, PR flow) — would need user-confirmation
  design first.
