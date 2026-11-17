import { createMcpHandler, type StatelessMcpHandler } from 'agents/mcp/server';
import { defaultFetch, SITE } from './catalog';
import { createServer, SERVER_VERSION } from './server';

interface Env {
  /** Comma-separated hostnames the MCP endpoint answers on (custom domain + workers.dev). */
  ALLOWED_HOSTNAMES?: string;
}

let handler: { key: string; fn: StatelessMcpHandler } | null = null;

function mcpHandler(env: Env): StatelessMcpHandler {
  const key = env.ALLOWED_HOSTNAMES || '';
  if (handler?.key === key) return handler.fn;
  const hosts = key.split(',').map((h) => h.trim()).filter(Boolean);
  const fn = createMcpHandler(() => createServer(defaultFetch), {
    route: '/mcp',
    ...(hosts.length ? { allowedHostnames: hosts, allowedOriginHostnames: hosts } : {}),
    // No cookies or credentials are involved: the server is public and read-only.
    corsOptions: { origin: '*', methods: 'GET, POST, OPTIONS', headers: 'Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID', exposeHeaders: 'Mcp-Session-Id', maxAge: 86400 },
    onerror: (error) => console.error(JSON.stringify({ event: 'mcp_error', message: error.message })),
  });
  handler = { key, fn };
  return fn;
}

const INFO = {
  name: 'aitmpl',
  version: SERVER_VERSION,
  description: 'Remote MCP server for the aitmpl.com catalog of Claude Code components: search, read and get install commands. Read-only, no sign-in.',
  endpoint: '/mcp',
  transport: 'streamable-http',
  docs: 'https://docs.aitmpl.com/developers/mcp-server',
  privacy: `${SITE}/privacy`,
  install: {
    claudeCode: 'claude mcp add --transport http aitmpl https://mcp.aitmpl.com/mcp',
    claudeAi: 'Settings > Connectors > Add custom connector > https://mcp.aitmpl.com/mcp',
  },
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/mcp') return mcpHandler(env)(request, env, ctx);
    if (url.pathname === '/' && (request.method === 'GET' || request.method === 'HEAD')) {
      return new Response(JSON.stringify(INFO, null, 2), {
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=300' },
      });
    }
    if (url.pathname === '/health') return new Response('ok', { headers: { 'cache-control': 'no-store' } });
    return new Response(JSON.stringify({ error: 'not_found', hint: 'The MCP endpoint is /mcp.' }), {
      status: 404, headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  },
} satisfies ExportedHandler<Env>;
