// MCP Server Card (SEP-2127, extension io.modelcontextprotocol/server-card): the static,
// pre-connection description of this server, served at <streamable-http-url>/server-card,
// plus the AI Catalog that points to it (/.well-known/ai-catalog.json). Wire format:
// github.com/modelcontextprotocol/experimental-ext-server-card (schema.ts, docs/discovery.md).
//
// The card says where and how to connect, never what the server offers: tools and skills
// stay in tools/list and skills/list (the spec leaves primitives out on purpose).
// Keep it consistent with server/discover: title, version, websiteUrl and icons come from
// SERVER_INFO, the same object createServer() hands the SDK.
import { SUPPORTED_PROTOCOL_VERSIONS } from '@modelcontextprotocol/server';
import { SERVER_INFO } from './server';

export const SERVER_CARD_SCHEMA = 'https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json';
export const SERVER_CARD_TYPE = 'application/mcp-server-card+json';
export const AI_CATALOG_TYPE = 'application/ai-catalog+json';
/** Revisions the endpoint answers: 2026-07-28 (server/discover, no initialize) plus the SDK's legacy-handshake list. */
export const CARD_PROTOCOL_VERSIONS = ['2026-07-28', ...SUPPORTED_PROTOCOL_VERSIONS.filter((v) => v !== '2026-07-28')];

/** Card name: reverse DNS of the domain we serve from + the serverInfo name (the card requires `namespace/name`). */
export const CARD_NAME = `com.aitmpl/${SERVER_INFO.name}`;
const CATALOG_ID = `urn:air:aitmpl.com:mcp:${SERVER_INFO.name}`;

export function serverCard(origin: string) {
  return {
    $schema: SERVER_CARD_SCHEMA,
    name: CARD_NAME,
    version: SERVER_INFO.version,
    // At most 100 characters (schema maxLength).
    description: 'Search the aitmpl.com catalog of Claude Code components and get their install commands.',
    title: SERVER_INFO.title,
    websiteUrl: SERVER_INFO.websiteUrl,
    repository: {
      url: 'https://github.com/davila7/claude-code-templates',
      source: 'github',
      subfolder: 'cloudflare-workers/mcp',
      id: '1013480284',
    },
    icons: SERVER_INFO.icons,
    remotes: [
      {
        type: 'streamable-http',
        url: `${origin}/mcp`,
        supportedProtocolVersions: CARD_PROTOCOL_VERSIONS,
      },
    ],
  };
}

export function aiCatalog(origin: string) {
  return {
    specVersion: '1.0',
    entries: [{ identifier: CATALOG_ID, type: SERVER_CARD_TYPE, url: `${origin}/mcp/server-card` }],
  };
}

// discovery.md, "CORS Requirements" and "Caching".
const DISCOVERY_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET',
  'access-control-allow-headers': 'Content-Type, If-None-Match',
  'access-control-expose-headers': 'ETag',
  'cache-control': 'public, max-age=3600',
  vary: 'Accept',
};

async function etagOf(body: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
  return `"${[...new Uint8Array(digest).slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('')}"`;
}

/** GET/HEAD/OPTIONS for a public discovery document, with ETag + If-None-Match → 304. */
export async function discoveryResponse(request: Request, doc: unknown, contentType: string): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...DISCOVERY_HEADERS, 'access-control-max-age': '86400' } });
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(null, { status: 405, headers: { ...DISCOVERY_HEADERS, allow: 'GET, HEAD, OPTIONS' } });
  }
  const body = JSON.stringify(doc, null, 2);
  const etag = await etagOf(body);
  const headers = { ...DISCOVERY_HEADERS, etag, 'content-type': `${contentType}; charset=utf-8` };
  const inm = request.headers.get('if-none-match');
  if (inm && inm.split(',').some((t) => t.trim().replace(/^W\//, '') === etag || t.trim() === '*')) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(request.method === 'HEAD' ? null : body, { headers });
}
