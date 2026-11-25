// End-to-end check of a running aitmpl MCP server with the official MCP client.
//   node test/smoke.mjs [url]   (default http://localhost:8787/mcp)
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { GetSkillResultSchema, ListSkillsResultSchema } from '@modelcontextprotocol/core/ext/skills';
import { createHash } from 'node:crypto';

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

// Skills over MCP: only offered on protocol revision 2026-07-28, so this client pins it.
const modern = new Client({ name: 'aitmpl-smoke-skills', version: '1.0.0' }, { versionNegotiation: { mode: { pin: '2026-07-28' } } });
await modern.connect(new StreamableHTTPClientTransport(url));
check(modern.getNegotiatedProtocolVersion?.() === '2026-07-28', 'negotiates 2026-07-28', modern.getNegotiatedProtocolVersion?.());
const caps = modern.getServerCapabilities();
check(Boolean(caps?.resources) && caps?.extensions?.['io.modelcontextprotocol/skills'] !== undefined, 'declares resources + skills extension');
check((await modern.listTools()).tools.length === 4, 'tools still listed on 2026-07-28');
const skillList = await modern.request({ method: 'skills/list', params: {} }, ListSkillsResultSchema);
const skillNames = skillList.skills.map((x) => x.frontmatter.name).sort();
check(skillNames.join(',') === 'component-review,skill-over-mcp', 'skills/list', skillNames.join(', '));
for (const skill of skillList.skills) {
  for (const file of skill.resources) {
    const r = await modern.readResource({ uri: file.uri });
    const text = r.contents[0]?.text ?? '';
    const digest = `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`;
    check(digest === file.digest && Buffer.byteLength(text) === file.size, `resources/read ${file.uri} matches its digest`);
  }
  const got = await modern.request({ method: 'skills/get', params: { uri: skill.uri } }, GetSkillResultSchema);
  check(got.skill.uri === skill.uri, `skills/get ${skill.uri}`);
}
let unknownSkill = false;
try { await modern.readResource({ uri: 'skill://nope/SKILL.md' }); } catch { unknownSkill = true; }
check(unknownSkill, 'unknown skill URI is an error');
check(!(await modern.callTool({ name: 'search_components', arguments: { query: 'code review', limit: 3 } })).isError,
  'no elicitation capability: search answers directly on 2026-07-28');
await modern.close();

// Form elicitation (2026-07-28 multi-round-trip): a broad search with no type asks the user to narrow it.
const elicitClient = async (caps, answer) => {
  const asked = [];
  const c = new Client({ name: 'aitmpl-smoke-elicit', version: '1.0.0' },
    { capabilities: caps, versionNegotiation: { mode: { pin: '2026-07-28' } } });
  c.setRequestHandler('elicitation/create', async (req) => { asked.push(req.params); return answer(req.params); });
  await c.connect(new StreamableHTTPClientTransport(url));
  return { c, asked };
};

{
  const { c, asked } = await elicitClient({ elicitation: { form: {}, url: {} } }, () => ({ action: 'accept', content: { type: 'agents' } }));
  const r = await c.callTool({ name: 'search_components', arguments: { query: 'review', limit: 5 } });
  const props = asked[0]?.requestedSchema?.properties || {};
  check(asked.length === 1 && Boolean(props.type) && Boolean(props.category), 'broad search asks for type + category (form)',
    asked[0]?.message);
  check(!r.isError && r.structuredContent.results.length > 0 && r.structuredContent.results.every((x) => x.type === 'agents')
    && /Narrowed by the user to type "agents"/.test(r.content[0].text), 'accepted answer filters the results');
  const plain = await c.callTool({ name: 'search_components', arguments: { query: 'review', type: 'agents', limit: 5 } });
  check(JSON.stringify(plain.structuredContent.results.map((x) => x.id)) === JSON.stringify(r.structuredContent.results.map((x) => x.id)),
    'filtered order equals the plain type filter (text match only)');
  const before = asked.length; // the plain call above asked for a category (answered without one)
  const narrow = await c.callTool({ name: 'search_components', arguments: { query: 'zzzqqqxxx' } });
  check(asked.length === before && narrow.structuredContent?.total === 0, 'no form when the search is not broad');
  await c.close();
}
{
  const { c, asked } = await elicitClient({ elicitation: {} }, () => ({ action: 'decline' }));
  const r = await c.callTool({ name: 'search_components', arguments: { query: 'review', limit: 5 } });
  check(asked.length === 1 && !r.isError && r.structuredContent.results.length === 5
    && new Set(r.structuredContent.results.map((x) => x.type)).size >= 1, 'bare elicitation: {} gets the form; decline searches unfiltered');
  const typed = await c.callTool({ name: 'search_components', arguments: { query: 'review', type: 'agents', limit: 5 } });
  check(asked.length === 2 && Boolean(asked[1]?.requestedSchema?.properties?.category) && !asked[1]?.requestedSchema?.properties?.type
    && !typed.isError, 'with a type given it asks only for the category');
  await c.close();
}
{
  // Earlier revisions: the stateless legacy lane has no server-to-client requests, so never a form.
  const asked = [];
  const c = new Client({ name: 'aitmpl-smoke-legacy-elicit', version: '1.0.0' }, { capabilities: { elicitation: {} } });
  c.setRequestHandler('elicitation/create', async (req) => { asked.push(req.params); return { action: 'decline' }; });
  await c.connect(new StreamableHTTPClientTransport(url));
  const r = await c.callTool({ name: 'search_components', arguments: { query: 'review', limit: 5 } });
  check(c.getNegotiatedProtocolVersion?.() !== '2026-07-28' && asked.length === 0 && !r.isError && r.structuredContent.results.length === 5,
    `legacy revision (${c.getNegotiatedProtocolVersion?.()}) with elicitation: no form, search answers`);
  await c.close();
}
{
  const { c, asked } = await elicitClient({ elicitation: { url: {} } }, () => ({ action: 'accept', content: {} }));
  const r = await c.callTool({ name: 'search_components', arguments: { query: 'review', limit: 5 } });
  check(asked.length === 0 && !r.isError, 'URL-only elicitation capability: no form, search answers');
  await c.close();
}

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
