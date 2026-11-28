// What an MCP server provides, as its catalog component declares it: tools
// (`mcpTools`), events (`mcpEvents`, extension io.modelcontextprotocol/events,
// SEP-3415) and skills (`mcpSkills`, see mcp-skills.ts). Each key is top-level
// in the component JSON and keyed by server name, like `mcpServers`; the CLI
// strips all three before writing .mcp.json. The lists are declared, not probed.
//
//   { "mcpServers": { "docs": { ... } },
//     "mcpTools":  { "docs": [{ "name": "search", "description": "...", "readOnly": true }] },
//     "mcpEvents": { "docs": [{ "name": "page.updated", "description": "...", "delivery": ["poll"] }] } }

import { parseMcpSkills, type McpSkill } from './mcp-skills.ts';

export interface McpTool { name: string; title: string; description: string; readOnly: boolean | null }
export type EventDelivery = 'poll' | 'push' | 'webhook';
export interface McpEvent { name: string; description: string; delivery: EventDelivery[] }
export interface McpCapabilities { server: string; tools: McpTool[]; skills: McpSkill[]; events: McpEvent[] }

/** MCP tool names: 1-128 of A-Z a-z 0-9 _ - . (spec 2025-11-25 onward). Event names follow the same rule. */
const NAME = /^[A-Za-z0-9_.-]{1,128}$/;
const DELIVERY: readonly EventDelivery[] = ['poll', 'push', 'webhook'];
export const MAX_TOOLS_PER_SERVER = 200;
export const MAX_EVENTS_PER_SERVER = 100;

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

function parse(content: string | null | undefined): { servers: object; json: Record<string, unknown> } | null {
  if (!content) return null;
  let json: unknown;
  try { json = JSON.parse(content); } catch { return null; }
  if (!json || typeof json !== 'object') return null;
  const servers = (json as { mcpServers?: unknown }).mcpServers;
  if (!servers || typeof servers !== 'object') return null;
  return { servers, json: json as Record<string, unknown> };
}

/** Valid, de-duplicated entries of one server's list under `key`, capped at `max`. */
function entries<T>(json: Record<string, unknown>, servers: object, key: string, server: string, max: number, read: (o: Record<string, unknown>, name: string) => T | null): T[] {
  const block = json[key];
  if (!block || typeof block !== 'object' || !(server in servers)) return [];
  const list = (block as Record<string, unknown>)[server];
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const name = (item as { name?: unknown }).name;
    if (typeof name !== 'string' || !NAME.test(name) || seen.has(name)) continue;
    const v = read(item as Record<string, unknown>, name);
    if (!v) continue;
    seen.add(name);
    out.push(v);
    if (out.length === max) break;
  }
  return out;
}

const readTool = (o: Record<string, unknown>, name: string): McpTool => ({
  name,
  title: str(o.title),
  description: str(o.description),
  readOnly: typeof o.readOnly === 'boolean' ? o.readOnly : null,
});

const readEvent = (o: Record<string, unknown>, name: string): McpEvent | null => {
  const delivery = Array.isArray(o.delivery)
    ? DELIVERY.filter((d) => (o.delivery as unknown[]).includes(d))
    : [];
  // SEP-3415: every event type advertises a non-empty subset of the three modes.
  if (!delivery.length) return null;
  return { name, description: str(o.description), delivery };
};

/**
 * Tools, skills and events each server of an MCP component declares, in `mcpServers` order.
 * Servers that declare none of the three are left out; [] when nothing is declared or the JSON is invalid.
 */
export function parseMcpCapabilities(content: string | null | undefined): McpCapabilities[] {
  const p = parse(content);
  if (!p) return [];
  const skillsBy = new Map(parseMcpSkills(content).map((s) => [s.server, s.skills]));
  const out: McpCapabilities[] = [];
  for (const server of Object.keys(p.servers)) {
    const tools = entries(p.json, p.servers, 'mcpTools', server, MAX_TOOLS_PER_SERVER, readTool);
    const events = entries(p.json, p.servers, 'mcpEvents', server, MAX_EVENTS_PER_SERVER, readEvent);
    const skills = skillsBy.get(server) ?? [];
    if (tools.length || skills.length || events.length) out.push({ server, tools, skills, events });
  }
  return out;
}
