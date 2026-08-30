/**
 * WebMCP V1 — expose the aitmpl.com component catalog as read-only tools for
 * browser AI agents (https://github.com/webmachinelearning/webmcp).
 *
 * Registered site-wide from DashboardLayout.astro. No-ops when the browser
 * does not implement `document.modelContext` or when the feature flag is off.
 * All tools are read-only and reuse the same static JSON artifacts and
 * helpers (`src/lib/data.ts`) the UI already uses.
 */
import {
  fetchSearchIndex,
  fetchComponentsByType,
  getInstallCommand,
  type SearchIndexEntry,
} from './data';
import type { Component } from './types';

// Feature flag: WebMCP tools are inert unless PUBLIC_WEBMCP_ENABLED=true is
// set at build time (dashboard/wrangler.toml [vars]). Same pattern as ads.ts.
const WEBMCP_ENABLED = import.meta.env.PUBLIC_WEBMCP_ENABLED === 'true';

const SITE_URL = 'https://www.aitmpl.com';
const SEARCH_LIMIT = 20;

// Minimal typings for the (still experimental) WebMCP API. We intentionally
// don't depend on the `webmcp-types` npm package for this small surface.
interface ModelContextToolDef {
  name: string;
  title?: string;
  description: string;
  inputSchema?: object;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute: (input: any, options?: { signal?: AbortSignal }) => any;
}
interface ModelContext {
  registerTool(tool: ModelContextToolDef, options?: object): Promise<void>;
}

const COMPONENT_TYPES = [
  'agent',
  'command',
  'mcp',
  'setting',
  'hook',
  'skill',
  'loop',
  'template',
] as const;

/** "agents" -> "agent" (tolerate both singular and plural inputs). */
function toSingular(type: string): string {
  const t = type.toLowerCase().trim();
  return t.endsWith('s') && t !== 'sandbox' ? t.slice(0, -1) : t;
}

/** "agent" -> "agents" (URL/file segments are plural). */
function toPlural(type: string): string {
  const t = toSingular(type);
  return `${t}s`;
}

function cleanPath(path: string | undefined, name: string): string {
  return path?.replace(/\.(md|json)$/, '') ?? name;
}

function componentUrl(type: string, path: string | undefined, name: string): string {
  return `${SITE_URL}/component/${toPlural(type)}/${cleanPath(path, name)}`;
}

function installCommandFor(entry: { type: string; path?: string; name: string }): string {
  return getInstallCommand({
    ...entry,
    type: toSingular(entry.type),
  } as Component);
}

/** Find a component by exact name or path within a type's catalog file. */
async function findComponent(type: string, name: string): Promise<Component | null> {
  const items = await fetchComponentsByType(toPlural(type));
  const needle = name.toLowerCase().trim();
  return (
    items.find(
      (c) =>
        c.name.toLowerCase() === needle ||
        cleanPath(c.path, c.name).toLowerCase() === needle
    ) ?? null
  );
}

async function fetchJson(path: string): Promise<any | null> {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

const componentTypeSchema = {
  type: 'string',
  enum: [...COMPONENT_TYPES],
  description: 'The component type.',
};

function buildTools(): ModelContextToolDef[] {
  return [
    {
      name: 'search-components',
      title: 'Search components',
      description:
        'Searches the aitmpl.com catalog of Claude Code components (agents, commands, MCPs, settings, hooks, skills, loops, templates) by free-text query. Returns up to 20 matches with name, type, category, description and the npx install command.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Free-text search over component name, description and category.',
          },
          type: { ...componentTypeSchema, description: 'Optional: restrict results to one component type.' },
        },
        required: ['query'],
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      async execute({ query, type }: { query: string; type?: string }) {
        const index = await fetchSearchIndex();
        const q = String(query ?? '').toLowerCase().trim();
        const wantedType = type ? toSingular(type) : null;
        const matches = index.filter((e: SearchIndexEntry) => {
          if (wantedType && toSingular(e.type) !== wantedType) return false;
          if (!q) return true;
          return (
            e.name.toLowerCase().includes(q) ||
            e.description?.toLowerCase().includes(q) ||
            e.category?.toLowerCase().includes(q)
          );
        });
        return {
          total: matches.length,
          results: matches.slice(0, SEARCH_LIMIT).map((e) => ({
            name: e.name,
            type: toSingular(e.type),
            category: e.category,
            description: e.description,
            url: componentUrl(e.type, e.path, e.name),
            installCommand: installCommandFor(e),
          })),
        };
      },
    },
    {
      name: 'get-component-details',
      title: 'Get component details',
      description:
        'Returns the full catalog entry for one component from aitmpl.com, including its description, category, install command and page URL. Requires the component name (as returned by search-components) and its type.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'The component name or catalog path.' },
          type: componentTypeSchema,
        },
        required: ['name', 'type'],
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      async execute({ name, type }: { name: string; type: string }) {
        const component = await findComponent(type, name);
        if (!component) {
          return { error: `Component "${name}" of type "${type}" not found.` };
        }
        return {
          name: component.name,
          type: toSingular(component.type),
          category: component.category,
          description: component.description ?? '',
          path: component.path,
          downloads: component.downloads,
          url: componentUrl(component.type, component.path, component.name),
          installCommand: installCommandFor(component),
        };
      },
    },
    {
      name: 'get-install-command',
      title: 'Get install command',
      description:
        'Returns the exact npx command to install a Claude Code component from aitmpl.com (e.g. "npx claude-code-templates@latest --agent developer-team/frontend-developer").',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'The component name or catalog path.' },
          type: componentTypeSchema,
        },
        required: ['name', 'type'],
      },
      annotations: { readOnlyHint: true },
      async execute({ name, type }: { name: string; type: string }) {
        const component = await findComponent(type, name);
        if (!component) {
          return { error: `Component "${name}" of type "${type}" not found.` };
        }
        return { installCommand: installCommandFor(component) };
      },
    },
    {
      name: 'get-catalog-stats',
      title: 'Get catalog stats',
      description:
        'Returns aggregate statistics for the aitmpl.com catalog: number of components per type and global download totals.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      async execute() {
        const [counts, trending] = await Promise.all([
          fetchJson('/counts.json'),
          fetchJson('/trending-data.json'),
        ]);
        return {
          counts: counts ?? {},
          downloads: trending?.globalStats ?? null,
          lastUpdated: trending?.lastUpdated ?? null,
        };
      },
    },
  ];
}

/**
 * Register the WebMCP tools. Safe to call on every page load: no-ops without
 * browser support or when the flag is off, and never throws.
 */
export function initWebMCP(): void {
  if (!WEBMCP_ENABLED) return;
  const modelContext = (document as any).modelContext as ModelContext | undefined;
  if (!modelContext?.registerTool) return;

  for (const tool of buildTools()) {
    try {
      // registerTool rejects with NotAllowedError (permissions policy) or
      // InvalidStateError (duplicate name); neither should break the page.
      Promise.resolve(modelContext.registerTool(tool)).catch(() => {});
    } catch {
      // Ignore synchronous failures from experimental implementations.
    }
  }
}
