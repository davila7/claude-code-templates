// End-to-end check of a running skills example server with the official MCP client.
//   node test/smoke.mjs [url]   (default http://localhost:8787/mcp)
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { GetSkillResultSchema, ListSkillsResultSchema } from '@modelcontextprotocol/core/ext/skills';
import { createHash } from 'node:crypto';

const url = new URL(process.argv[2] || 'http://localhost:8787/mcp');
let failures = 0;
const check = (ok, label, extra = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${extra ? ` — ${extra}` : ''}`);
  if (!ok) failures++;
};

// Modern client (2026-07-28): the skills extension is only offered there.
const client = new Client({ name: 'skills-smoke', version: '1.0.0' }, { versionNegotiation: { mode: { pin: '2026-07-28' } } });
await client.connect(new StreamableHTTPClientTransport(url));
check(client.getNegotiatedProtocolVersion?.() === '2026-07-28', 'negotiates 2026-07-28', client.getNegotiatedProtocolVersion?.());
const caps = client.getServerCapabilities();
check(Boolean(caps?.resources) && caps?.extensions?.['io.modelcontextprotocol/skills'] !== undefined, 'declares resources + skills extension', JSON.stringify(caps));

const list = await client.request({ method: 'skills/list', params: {} }, ListSkillsResultSchema);
const names = list.skills.map((s) => s.frontmatter.name).sort();
check(names.join(',') === 'component-review,skill-over-mcp', 'skills/list', names.join(', '));

for (const skill of list.skills) {
  for (const file of skill.resources) {
    const r = await client.readResource({ uri: file.uri });
    const text = r.contents[0]?.text ?? '';
    const digest = `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`;
    check(digest === file.digest && Buffer.byteLength(text) === file.size, `resources/read ${file.uri} matches its digest`);
  }
  const got = await client.request({ method: 'skills/get', params: { uri: skill.uri } }, GetSkillResultSchema);
  check(got.skill.uri === skill.uri, `skills/get ${skill.uri}`);
}

let bad = false;
try { await client.readResource({ uri: 'skill://nope/SKILL.md' }); } catch { bad = true; }
check(bad, 'unknown skill URI is an error');
await client.close();

// A 2025-era client still connects (it just sees no skills).
const legacy = new Client({ name: 'skills-smoke-legacy', version: '1.0.0' });
await legacy.connect(new StreamableHTTPClientTransport(url));
check(Boolean(legacy.getServerVersion()?.name), 'legacy client connects', legacy.getNegotiatedProtocolVersion?.());
await legacy.close();

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
