# aitmpl MCP server

Remote MCP server for the [aitmpl.com](https://www.aitmpl.com) catalog of Claude Code components.
Endpoint: **`https://mcp.aitmpl.com/mcp`** (Streamable HTTP, no sign-in, read-only).

```bash
claude mcp add --transport http aitmpl https://mcp.aitmpl.com/mcp
```

In claude.ai or Claude Desktop: Settings > Connectors > Add custom connector, URL `https://mcp.aitmpl.com/mcp`.

## Tools

All four are read-only (`readOnlyHint: true`), declare `title`, `inputSchema` and `outputSchema`, and return `structuredContent`.

| Tool | What it returns |
| --- | --- |
| `search_components` | Components matching a text query (optional `type`, `category`, `limit` ≤ 25): id, description, page, install command, whether it runs code, SkillSpector scan |
| `get_component` | One component by id: full content (cut at 12,000 characters), files, what it writes, license, upstream pin, scan and top findings |
| `get_install_command` | One `npx claude-code-templates@latest … --yes` command for up to 20 ids, what each writes, and the `/plugin` pair for plugins |
| `list_categories` | Types and categories with counts |

**The server installs nothing.** A remote server cannot write to the user's machine: Claude runs the
returned command in a terminal (Claude Code), or the user copies it (claude.ai, Desktop, other clients
without a shell). The CLI then tracks the install like any other, with the agent signal (CLI ≥ 1.32).

**Ranking:** text match only, then id, the same scoring as the CLI's `--search`. With no match for every word, it falls back to the components matching the most words (`match: "partial"`)
(`cli-tool/src/catalog-lookup.js`). Downloads and sponsored placements never change the order, and the
server does not read any ads data.

## Data

Only what www.aitmpl.com already publishes: `/api/v1/version.json` and `/api/v1/catalog.json`
(Catalog API v1), `/components/plugins.json` (plugins are not in v1 yet) and
`/component-content/…` for `get_component`. The catalog is kept in the isolate and re-checked
against `version.json` at most once a minute; fetches go through the Cloudflare cache (300 s).
Retired templates are not in v1, so they never appear.

## Develop

```bash
npm ci
npm test                 # unit tests (vitest)
npm run type-check
npx wrangler dev --var ALLOWED_HOSTNAMES:   # http://localhost:8787/mcp (empty allowlist = localhost)
npm run smoke            # end-to-end with the official MCP client against localhost
node test/smoke.mjs https://mcp.aitmpl.com/mcp   # same checks against production
npx @modelcontextprotocol/inspector             # manual testing
```

Built on Cloudflare's stateless `createMcpHandler` (`agents/mcp/server`) with MCP SDK v2
(`@modelcontextprotocol/server`); `agents` pins the exact SDK version it needs, so bump them together.
`ALLOWED_HOSTNAMES` (in `wrangler.toml`) is the Host/Origin allowlist against DNS rebinding;
a browser Origin outside it gets 403.

## Deploy

No GitHub Action deploys this worker. From this folder:

```bash
npx wrangler deploy
node test/smoke.mjs https://mcp.aitmpl.com/mcp
```

`mcp.aitmpl.com` is a Workers Custom Domain on the `aitmpl.com` zone (`routes` in `wrangler.toml`).
Logs: Workers observability (`npx wrangler tail aitmpl-mcp`). No secrets.

## Privacy

The server stores nothing. Tool arguments (search words, component ids) are used to answer the call
and are not logged or kept; Cloudflare processes request metadata to serve and protect the endpoint.
Policy: https://www.aitmpl.com/privacy#mcp-server
