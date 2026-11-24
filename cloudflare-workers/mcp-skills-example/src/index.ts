// Example MCP server that serves skills (Skills over MCP, SEP-2640).
// Endpoint /mcp, Streamable HTTP, protocol revision 2026-07-28 (older clients
// still connect and see no skills). Read-only, no sign-in, no tools: its only
// job is to show how a server ships skills to Claude Code.
import { McpServer } from '@modelcontextprotocol/server';
import { SkillsExtension, memorySkillFiles } from '@modelcontextprotocol/server/ext/skills';
import { createMcpHandler, type StatelessMcpHandler } from 'agents/mcp/server';
import componentReview from '../skills/component-review/SKILL.md';
import componentChecklist from '../skills/component-review/references/checklist.md';
import skillOverMcp from '../skills/skill-over-mcp/SKILL.md';
import skillServer from '../skills/skill-over-mcp/references/server.md';

interface Env {
  /** Comma-separated hostnames the endpoint answers on (Host/Origin checks). */
  ALLOWED_HOSTNAMES?: string;
}

export const SERVER = { name: 'aitmpl-skills-example', version: '1.0.0' };

// Paths are relative to the skills root; the SDK computes the digests and checks the frontmatter.
const FILES: Record<string, string> = {
  'component-review/SKILL.md': componentReview,
  'component-review/references/checklist.md': componentChecklist,
  'skill-over-mcp/SKILL.md': skillOverMcp,
  'skill-over-mcp/references/server.md': skillServer,
};

let skills: Promise<SkillsExtension> | null = null;
let handler: { key: string; fn: StatelessMcpHandler } | null = null;

function loadSkills() {
  // strict: a bad frontmatter or a name that differs from its folder fails the request instead of serving less.
  skills ??= SkillsExtension.load(memorySkillFiles(FILES), {
    strict: true,
    cacheHint: { ttlMs: 300_000, cacheScope: 'public' },
  });
  return skills;
}

function mcpHandler(env: Env, ext: SkillsExtension): StatelessMcpHandler {
  const key = env.ALLOWED_HOSTNAMES || '';
  if (handler?.key === key) return handler.fn;
  const hosts = key.split(',').map((h) => h.trim()).filter(Boolean);
  const fn = createMcpHandler(() => {
    const server = new McpServer(
      { ...SERVER, title: 'aitmpl skills example', websiteUrl: 'https://www.aitmpl.com/component/mcps/devtools/aitmpl-skills-example' },
      { instructions: 'Example server for Skills over MCP: it serves two skills (component-review, skill-over-mcp) and no tools.' },
    );
    ext.attach(server);
    return server;
  }, {
    route: '/mcp',
    ...(hosts.length ? { allowedHostnames: hosts, allowedOriginHostnames: hosts } : {}),
    corsOptions: { origin: '*', methods: 'GET, POST, OPTIONS', headers: 'Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID', exposeHeaders: 'Mcp-Session-Id', maxAge: 86400 },
    onerror: (error) => console.error(JSON.stringify({ event: 'mcp_error', message: error.message })),
  });
  handler = { key, fn };
  return fn;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/mcp') return mcpHandler(env, await loadSkills())(request, env, ctx);
    if (url.pathname === '/' && (request.method === 'GET' || request.method === 'HEAD')) {
      return Response.json({
        ...SERVER,
        description: 'Example MCP server that serves skills (Skills over MCP). Needs Claude Code 2.1.331 or later.',
        endpoint: '/mcp',
        skills: Object.keys(FILES).filter((p) => p.endsWith('/SKILL.md')).map((p) => p.split('/')[0]),
        install: 'claude mcp add --transport http aitmpl-skills https://skills-example.aitmpl.com/mcp',
      }, { headers: { 'cache-control': 'public, max-age=300' } });
    }
    return Response.json({ error: 'not_found', hint: 'The MCP endpoint is /mcp.' }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
