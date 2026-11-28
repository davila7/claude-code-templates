import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseMcpCapabilities } from '../src/lib/mcp-capabilities.ts';

const doc = (o: unknown) => JSON.stringify(o);

test('reads tools, skills and events of a server', () => {
  const [c] = parseMcpCapabilities(doc({
    mcpServers: { docs: { type: 'http', url: 'https://x/mcp' } },
    mcpTools: { docs: [{ name: 'search', title: ' Search ', description: ' Find pages. ', readOnly: true }, { name: 'write_page', readOnly: false }, { name: 'plain' }] },
    mcpSkills: { docs: [{ name: 'pdf', description: 'Read PDFs.' }] },
    mcpEvents: { docs: [{ name: 'page.updated', description: 'A page changed.', delivery: ['webhook', 'poll', 'carrier-pigeon'] }] },
  }));
  assert.equal(c.server, 'docs');
  assert.deepEqual(c.tools, [
    { name: 'search', title: 'Search', description: 'Find pages.', readOnly: true },
    { name: 'write_page', title: '', description: '', readOnly: false },
    { name: 'plain', title: '', description: '', readOnly: null },
  ]);
  assert.deepEqual(c.skills.map((s) => s.command), ['/docs:pdf']);
  // Delivery keeps the spec's order and drops unknown modes.
  assert.deepEqual(c.events, [{ name: 'page.updated', description: 'A page changed.', delivery: ['poll', 'webhook'] }]);
});

test('drops invalid names, duplicates, events without delivery and unknown servers', () => {
  const [c] = parseMcpCapabilities(doc({
    mcpServers: { a: {} },
    mcpTools: { a: [{ name: 'has space' }, { name: 'ok' }, { name: 'ok' }, 'x', null, { name: 'x'.repeat(129) }], ghost: [{ name: 'nope' }] },
    mcpEvents: { a: [{ name: 'no.delivery' }, { name: 'empty', delivery: [] }, { name: 'bad', delivery: ['sms'] }] },
  }));
  assert.deepEqual(c.tools.map((t) => t.name), ['ok']);
  assert.deepEqual(c.events, []);
});

test('leaves out servers that declare nothing and handles bad input', () => {
  assert.deepEqual(parseMcpCapabilities(doc({ mcpServers: { a: {}, b: {} }, mcpTools: { b: [{ name: 't' }] } })).map((c) => c.server), ['b']);
  assert.deepEqual(parseMcpCapabilities(doc({ mcpServers: { a: {} } })), []);
  assert.deepEqual(parseMcpCapabilities('not json'), []);
  assert.deepEqual(parseMcpCapabilities(null), []);
  assert.deepEqual(parseMcpCapabilities(doc({ mcpTools: { a: [{ name: 't' }] } })), []);
});

test('the aitmpl catalog component declares its tools and skills', () => {
  const content = readFileSync(new URL('../../cli-tool/components/mcps/devtools/aitmpl.json', import.meta.url), 'utf8');
  const [c] = parseMcpCapabilities(content);
  assert.equal(c.server, 'aitmpl');
  assert.deepEqual(c.tools.map((t) => t.name), ['search_components', 'get_component', 'get_install_command', 'list_categories']);
  assert.ok(c.tools.every((t) => t.readOnly === true && t.description));
  assert.deepEqual(c.skills.map((s) => s.name), ['component-review', 'skill-over-mcp']);
  assert.deepEqual(c.events, []);
});
