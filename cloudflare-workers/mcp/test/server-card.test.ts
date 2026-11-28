import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
// schema.json from modelcontextprotocol/experimental-ext-server-card @ 28db12c (2026-11-19).
import schema from './fixtures/server-card.schema.json';
import { aiCatalog, discoveryResponse, SERVER_CARD_TYPE, serverCard } from '../src/server-card';
import { SERVER_INFO } from '../src/server';
import worker from '../src/index';

const ORIGIN = 'https://mcp.aitmpl.com';
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema(schema, 'sc');
const validate = ajv.compile({ $ref: 'sc#/$defs/ServerCard' });

describe('server card', () => {
  it('validates against the Server Card schema', () => {
    const ok = validate(serverCard(ORIGIN));
    expect(validate.errors ?? []).toEqual([]);
    expect(ok).toBe(true);
  });

  it('matches serverInfo and points at the /mcp endpoint', () => {
    const card = serverCard(ORIGIN);
    expect(card.version).toBe(SERVER_INFO.version);
    expect(card.title).toBe(SERVER_INFO.title);
    expect(card.name.split('/')[1]).toBe(SERVER_INFO.name);
    expect(card.remotes[0].url).toBe(`${ORIGIN}/mcp`);
    expect(card.remotes[0].supportedProtocolVersions[0]).toBe('2026-07-28');
    expect(card.description.length).toBeLessThanOrEqual(100);
  });

  it('lists only identity and transport, never primitives', () => {
    expect(Object.keys(serverCard(ORIGIN)).sort()).toEqual(
      ['$schema', 'description', 'icons', 'name', 'remotes', 'repository', 'title', 'version', 'websiteUrl']);
  });

  it('AI Catalog entry points at the card', () => {
    const { entries } = aiCatalog(ORIGIN);
    expect(entries).toEqual([{ identifier: 'urn:air:aitmpl.com:mcp:aitmpl', type: SERVER_CARD_TYPE, url: `${ORIGIN}/mcp/server-card` }]);
  });
});

describe('discovery responses', () => {
  const get = (headers: Record<string, string> = {}, method = 'GET') =>
    discoveryResponse(new Request(`${ORIGIN}/mcp/server-card`, { method, headers }), serverCard(ORIGIN), SERVER_CARD_TYPE);

  it('sends the media type, CORS, cache and ETag headers', async () => {
    const r = await get();
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toMatch(/^application\/mcp-server-card\+json/);
    expect(r.headers.get('access-control-allow-origin')).toBe('*');
    expect(r.headers.get('access-control-expose-headers')).toBe('ETag');
    expect(r.headers.get('cache-control')).toBe('public, max-age=3600');
    expect(r.headers.get('etag')).toMatch(/^"[0-9a-f]{32}"$/);
  });

  it('answers 304 to a matching If-None-Match', async () => {
    const etag = (await get()).headers.get('etag')!;
    const r = await get({ 'if-none-match': etag });
    expect(r.status).toBe(304);
    expect(await r.text()).toBe('');
    expect((await get({ 'if-none-match': '"other"' })).status).toBe(200);
  });

  it('allows preflight and refuses writes', async () => {
    expect((await get({}, 'OPTIONS')).status).toBe(204);
    expect((await get({}, 'POST')).status).toBe(405);
  });
});

describe('worker routes', () => {
  const env = { ALLOWED_HOSTNAMES: 'mcp.aitmpl.com' };
  const call = (url: string) => worker.fetch(new Request(url), env, {} as ExecutionContext);

  it('serves the card at /mcp/server-card and the catalog at /.well-known/ai-catalog.json', async () => {
    const card = await (await call(`${ORIGIN}/mcp/server-card`)).json() as { name: string };
    expect(card.name).toBe('com.aitmpl/aitmpl');
    const cat = await call(`${ORIGIN}/.well-known/ai-catalog.json`);
    expect(cat.headers.get('content-type')).toMatch(/^application\/ai-catalog\+json/);
  });

  it('never builds URLs from a foreign Host', async () => {
    const card = await (await call('https://evil.example/mcp/server-card')).json() as { remotes: { url: string }[] };
    expect(card.remotes[0].url).toBe(`${ORIGIN}/mcp`);
  });
});
