# Minimal servers

## stdio (Node.js)

```js
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { SkillsExtension } from '@modelcontextprotocol/server/ext/skills';
import { nodeSkillFiles } from '@modelcontextprotocol/server/ext/skills/node';
import { fileURLToPath } from 'node:url';

const skills = await SkillsExtension.load(nodeSkillFiles(fileURLToPath(new URL('./skills/', import.meta.url))));

serveStdio(() => {
  const server = new McpServer({ name: 'my-server', version: '1.0.0' });
  // server.registerTool(...) as usual
  skills.attach(server);
  return server;
});
```

## Streamable HTTP (Cloudflare Workers)

Workers have no file system, so the files are bundled and read from memory. Dependencies: `@modelcontextprotocol/server` and `agents` (for `createMcpHandler`). wrangler bundles `.md` files as text with this rule in `wrangler.toml`:

```toml
[[rules]]
type = "Text"
globs = ["**/*.md"]
fallthrough = true
```

and TypeScript needs `declare module '*.md' { const text: string; export default text; }` in a `.d.ts` file.


```ts
import { McpServer } from '@modelcontextprotocol/server';
import { SkillsExtension, memorySkillFiles } from '@modelcontextprotocol/server/ext/skills';
import { createMcpHandler } from 'agents/mcp/server';
import reviewSkill from '../skills/review/SKILL.md'; // wrangler [[rules]] type = "Text"

const skills = await SkillsExtension.load(memorySkillFiles({ 'review/SKILL.md': reviewSkill }));
const handler = createMcpHandler(() => {
  const server = new McpServer({ name: 'my-server', version: '1.0.0' });
  skills.attach(server);
  return server;
}, { route: '/mcp' });

export default { fetch: (req, env, ctx) => handler(req, env, ctx) };
```

## What the client sees

`skills/list`:

```json
{
  "skills": [{
    "uri": "skill://review/SKILL.md",
    "frontmatter": { "name": "review", "description": "..." },
    "resources": [{ "uri": "skill://review/SKILL.md", "digest": "sha256:...", "size": 412 }]
  }]
}
```
