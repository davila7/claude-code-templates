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

## Narrowing a search (form elicitation)

`search_components` can ask the user for a type and/or category before answering (`src/narrow.ts`). It asks
only when all of these hold: the request is on protocol revision 2026-07-28 and its client capabilities
declare form elicitation (`elicitation.form`, or a bare `elicitation: {}`); `type` or `category` was left out;
the search matches more components than `limit`; and the matches span more than one value of a missing
field. The form lists those values with their match counts (at most 15 categories, most matches first).

The worker is stateless, so it uses the 2026-07-28 multi-round-trip flow: the tool returns
`inputRequired({ inputRequests: { narrow_search: inputRequired.elicit(...) } })`, the client shows the form
and retries the same `tools/call` with `inputResponses`. A retry carries the `narrow_search` key, so the
server never asks twice. The answer only adds filters; the order stays text match, then id. Decline, cancel,
an empty or invalid answer all search as asked. The push-style `elicitInput` is not used: on 2026-07-28 it
throws, and `createMcpHandler`'s legacy lane refuses server-to-client requests. Clients on 2025-11-25 and
older, or without form elicitation, get the results directly, exactly as before. The smoke test covers
each case. Note the SDK answers `-32021` if a handler returns an input request the client did not declare,
which is why `canElicitForm` checks first.

## Skills (Skills over MCP)

Clients on protocol revision 2026-07-28 also get two skills through the MCP Skills extension
(`io.modelcontextprotocol/skills`). In Claude Code 2.1.331 or later (interactive terminal, VS Code,
Desktop local sessions) `/mcp` shows `2 skills` and `/skills` lists:

| Skill | What it does |
| --- | --- |
| `aitmpl:component-review` | Reviews a Claude Code component before sharing it (supporting file: `references/checklist.md`) |
| `aitmpl:skill-over-mcp` | Shows how to build an MCP server that serves skills (supporting file: `references/server.md`) |

The skills are the Markdown files in `skills/`, bundled as text by wrangler (`[[rules]] type = "Text"`)
and loaded once in `src/skills.ts` with `SkillsExtension.load(memorySkillFiles(...), { strict: true })`
(`@modelcontextprotocol/server/ext/skills`), which computes each file's sha256 digest and checks every
`SKILL.md`. `createServer` calls `attach(server)`. Older clients connect as before and see only the tools.
The catalog entry's `mcpSkills` key (`cli-tool/components/mcps/devtools/aitmpl.json`) lists them for the
component page's diagram: keep it in sync with `skills/`. MCP skills do not load in `claude -p`, the
Agent SDK or cloud sessions, nor in a `claude` started from a shell with Claude Desktop's
`CLAUDE_CODE_ENTRYPOINT`.

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
npx wrangler dev         # http://localhost:8787/mcp
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
