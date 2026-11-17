// End-to-end check of a running aitmpl MCP server with the official MCP client.
//   node test/smoke.mjs [url]   (default http://localhost:8787/mcp)
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

const url = new URL(process.argv[2] || 'http://localhost:8787/mcp');
const client = new Client({ name: 'aitmpl-smoke', version: '1.0.0' });
await client.connect(new StreamableHTTPClientTransport(url));

let failures = 0;
const check = (ok, label, extra = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${extra ? ` — ${extra}` : ''}`);
  if (!ok) failures++;
};

const info = client.getServerVersion();
check(info?.name === 'aitmpl', 'server info', JSON.stringify(info));

const { tools } = await client.listTools();
check(tools.length === 4, 'four tools', tools.map((t) => t.name).join(', '));
for (const t of tools) {
  check(Boolean(t.annotations?.title) && t.annotations?.readOnlyHint === true && t.annotations?.destructiveHint === false,
    `annotations on ${t.name}`);
  check(t.name.length <= 64 && Boolean(t.outputSchema), `name length + outputSchema on ${t.name}`);
}

const call = (name, args) => client.callTool({ name, arguments: args });

const s = await call('search_components', { query: 'code review', limit: 5 });
check(!s.isError && s.structuredContent.results.length > 0, 'search_components "code review"',
  s.structuredContent?.results.map((r) => r.id).join(', '));

const typed = await call('search_components', { query: 'postgres', type: 'mcps', limit: 3 });
check(!typed.isError && typed.structuredContent.results.every((r) => r.type === 'mcps'), 'search filtered by type',
  typed.structuredContent?.results.map((r) => r.id).join(', '));

const part = await call('search_components', { query: 'code review zzzqqqxxx', limit: 3 });
check(!part.isError && part.structuredContent.match === 'partial' && part.structuredContent.results.length > 0,
  'search_components falls back to partial matches', part.structuredContent?.match);

const none = await call('search_components', { query: 'zzzqqqxxx' });
check(!none.isError && none.structuredContent.total === 0, 'search with no matches');

const firstId = s.structuredContent.results[0].id;
const g = await call('get_component', { id: firstId });
check(!g.isError && typeof g.structuredContent.component.content === 'string', `get_component ${firstId}`,
  `${g.structuredContent?.component.content?.length} chars`);

const hookSearch = await call('search_components', { query: 'notification', type: 'hooks', limit: 1 });
const hookId = hookSearch.structuredContent.results[0]?.id;
const h = await call('get_component', { id: hookId });
check(!h.isError && h.structuredContent.component.runsCode === true, `get_component hook ${hookId} runsCode`);

const plugin = await call('search_components', { query: 'champion', type: 'plugins', limit: 1 });
const pluginId = plugin.structuredContent.results[0]?.id;
check(Boolean(pluginId), 'plugins are searchable', pluginId);

const bad = await call('get_component', { id: 'agents/nope/does-not-exist' });
check(bad.isError === true && /No component/.test(bad.content[0].text), 'get_component unknown id is an actionable error');

const ic = await call('get_install_command', { ids: [firstId, hookId, pluginId].filter(Boolean) });
check(!ic.isError && ic.structuredContent.command.startsWith('npx claude-code-templates@latest'), 'get_install_command',
  ic.structuredContent?.command);
check(ic.structuredContent?.pluginCommands.length === 2, 'plugin /plugin commands');

const invalid = await call('search_components', { query: '' }).catch((e) => ({ isError: true, content: [{ text: String(e) }] }));
check(invalid.isError === true, 'empty query rejected', invalid.content?.[0]?.text?.slice(0, 120));

const cats = await call('list_categories', { type: 'agents' });
check(!cats.isError && cats.structuredContent.categories.length > 5, 'list_categories agents',
  `${cats.structuredContent?.categories.length} categories`);

await client.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
