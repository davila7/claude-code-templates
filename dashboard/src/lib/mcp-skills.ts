// Skills over MCP (Claude Code 2.1.331+, extension io.modelcontextprotocol/skills):
// an MCP component may declare the skills its server serves under a top-level
// `mcpSkills` key, keyed by server name. The CLI strips that key before writing
// .mcp.json; the component page draws it.
//
//   { "mcpServers": { "docs": { ... } },
//     "mcpSkills": { "docs": [{ "name": "pdf", "description": "..." }] } }

export interface McpSkill { name: string; description: string; command: string }
export interface McpServerSkills { server: string; skills: McpSkill[] }

/** Claude Code turns spaces and punctuation other than `-` into `_` in the `<server>` part of `<server>:<skill>`. */
export function skillCommandPrefix(server: string): string {
  return server.replace(/[^A-Za-z0-9-]/g, '_');
}

const NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;
/** Claude Code shows up to 100 skills per server. */
export const MAX_SKILLS_PER_SERVER = 100;

/** The declared skills of each server in an MCP component's JSON; [] when there are none or the JSON is invalid. */
export function parseMcpSkills(content: string | null | undefined): McpServerSkills[] {
  if (!content) return [];
  let json: unknown;
  try { json = JSON.parse(content); } catch { return []; }
  if (!json || typeof json !== 'object') return [];
  const { mcpServers, mcpSkills } = json as { mcpServers?: unknown; mcpSkills?: unknown };
  if (!mcpServers || typeof mcpServers !== 'object' || !mcpSkills || typeof mcpSkills !== 'object') return [];
  const out: McpServerSkills[] = [];
  for (const [server, list] of Object.entries(mcpSkills as Record<string, unknown>)) {
    if (!(server in (mcpServers as object)) || !Array.isArray(list)) continue;
    const seen = new Set<string>();
    const skills: McpSkill[] = [];
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const { name, description } = item as { name?: unknown; description?: unknown };
      if (typeof name !== 'string' || !NAME.test(name) || seen.has(name)) continue;
      seen.add(name);
      skills.push({
        name,
        description: typeof description === 'string' ? description.trim() : '',
        command: `/${skillCommandPrefix(server)}:${name}`,
      });
      if (skills.length === MAX_SKILLS_PER_SERVER) break;
    }
    if (skills.length) out.push({ server, skills });
  }
  return out;
}
