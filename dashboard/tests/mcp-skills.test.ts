import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseMcpSkills, skillCommandPrefix } from '../src/lib/mcp-skills.ts';

const doc = (o: unknown) => JSON.stringify(o);

test('reads the skills of each declared server', () => {
  const out = parseMcpSkills(doc({
    mcpServers: { docs: { type: 'http', url: 'https://x/mcp' } },
    mcpSkills: { docs: [{ name: 'pdf', description: ' Read PDFs. ' }, { name: 'changelog' }] },
  }));
  assert.deepEqual(out, [{ server: 'docs', skills: [
    { name: 'pdf', description: 'Read PDFs.', command: '/docs:pdf' },
    { name: 'changelog', description: '', command: '/docs:changelog' },
  ] }]);
});

test('ignores servers missing from mcpServers, bad names and duplicates', () => {
  const out = parseMcpSkills(doc({
    mcpServers: { docs: {} },
    mcpSkills: { other: [{ name: 'a' }], docs: [{ name: 'Bad Name' }, { name: 'ok' }, { name: 'ok' }, 'x', null] },
  }));
  assert.deepEqual(out, [{ server: 'docs', skills: [{ name: 'ok', description: '', command: '/docs:ok' }] }]);
});

test('returns [] without skills or for invalid JSON', () => {
  assert.deepEqual(parseMcpSkills(doc({ mcpServers: { a: {} } })), []);
  assert.deepEqual(parseMcpSkills('{'), []);
  assert.deepEqual(parseMcpSkills(undefined), []);
  assert.deepEqual(parseMcpSkills(doc({ mcpServers: { a: {} }, mcpSkills: { a: [] } })), []);
});

test('caps a server at 100 skills', () => {
  const many = Array.from({ length: 120 }, (_, i) => ({ name: `s${i}` }));
  assert.equal(parseMcpSkills(doc({ mcpServers: { a: {} }, mcpSkills: { a: many } }))[0].skills.length, 100);
});

test('skillCommandPrefix keeps letters, digits and dashes', () => {
  assert.equal(skillCommandPrefix('aitmpl-skills'), 'aitmpl-skills');
  assert.equal(skillCommandPrefix('my docs.v2'), 'my_docs_v2');
});

test('the aitmpl component declares the skills its server serves', () => {
  const root = new URL('../../', import.meta.url);
  const component = readFileSync(new URL('cli-tool/components/mcps/devtools/aitmpl.json', root), 'utf8');
  const [declared] = parseMcpSkills(component);
  assert.equal(declared.server, 'aitmpl');
  for (const s of declared.skills) {
    const skill = readFileSync(new URL(`cloudflare-workers/mcp/skills/${s.name}/SKILL.md`, root), 'utf8');
    const description = skill.match(/^description: (.+)$/m)?.[1] ?? '';
    assert.ok(description.startsWith(s.description.replace(/\.$/, '')), `${s.name}: catalog description matches SKILL.md`);
  }
  assert.equal(declared.skills.length, 2);
});
