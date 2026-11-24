# aitmpl skills example (Skills over MCP)

Example MCP server that serves **skills** instead of tools, with the MCP Skills extension
(`io.modelcontextprotocol/skills`, SEP-2640). Endpoint: **`https://skills-example.aitmpl.com/mcp`**
(Streamable HTTP, protocol revision 2026-07-28, no sign-in, read-only).

```bash
claude mcp add --transport http aitmpl-skills https://skills-example.aitmpl.com/mcp
# or: npx claude-code-templates@latest --mcp devtools/aitmpl-skills-example
```

In Claude Code 2.1.331 or later (interactive terminal, VS Code, Desktop local sessions), `/mcp` shows
`Protocol: 2026-07-28` and `2 skills`, and `/skills` lists:

| Skill | What it does |
| --- | --- |
| `aitmpl-skills:component-review` | Reviews a Claude Code component before sharing it (supporting file: `references/checklist.md`) |
| `aitmpl-skills:skill-over-mcp` | Shows how to build an MCP server that serves skills (supporting file: `references/server.md`) |

MCP skills do not load in `claude -p`, the Agent SDK or cloud sessions, nor in a `claude` started from a
shell that inherited Claude Desktop's environment (`CLAUDE_CODE_ENTRYPOINT=claude-desktop`): unset the
`CLAUDE*` variables or use a normal terminal. Older clients still connect and see no skills.

## How it works

- The skills are the Markdown files in `skills/`, bundled as text by wrangler (`[[rules]] type = "Text"`),
  so the served bytes are exactly those files.
- `SkillsExtension.load(memorySkillFiles(...), { strict: true })` from `@modelcontextprotocol/server/ext/skills`
  computes the sha256 digest and size of every file and checks each `SKILL.md` (frontmatter `name` equal to
  its folder). `attach(server)` registers `skills/list`, `skills/get`, `resources/read` and
  `resources/directory/read` and declares the capability.
- `createMcpHandler` (`agents/mcp/server`) builds a server per request, as in `cloudflare-workers/mcp/`.
- No tools, no data, no secrets. Changing a skill changes its digest; Claude Code asks again for a version a
  user allowed only in manual mode.

The catalog entry is `cli-tool/components/mcps/devtools/aitmpl-skills-example.json`. Its `mcpSkills` key
lists the skills (keep it in sync with `skills/`), and the component page draws the flow from it.

## Develop

```bash
npm ci
npm run type-check
npx wrangler dev                 # http://localhost:8787/mcp
node test/smoke.mjs              # official MCP client, pinned to 2026-07-28: 11 checks
```

## Deploy

No CI deploys this worker. Deploy by hand, then run the smoke test against production:

```bash
npx wrangler deploy
node test/smoke.mjs https://skills-example.aitmpl.com/mcp
```

`wrangler.toml` attaches the custom domain `skills-example.aitmpl.com` (Cloudflare creates the DNS record)
and turns `workers_dev` off. `ALLOWED_HOSTNAMES` guards Host/Origin against DNS rebinding.
