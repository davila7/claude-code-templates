import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import {
  CatalogUnavailable, FLAG, SITE, TYPES, WRITES, findComponent, installCommand, loadCatalog, oneLine, search,
  type Catalog, type Component, type ComponentType,
} from './catalog';

export const SERVER_VERSION = '1.0.0';

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
const MAX_CONTENT_CHARS = 12_000;

type Fetcher = (url: string) => Promise<Response>;

const typeSchema = z.enum(TYPES).describe(
  'Component type: agents, commands, skills, hooks, mcps, settings, loops, mods or plugins.',
);

const scanSchema = z.object({
  tool: z.string(),
  toolVersion: z.string().nullable(),
  score: z.number().nullable().describe('SkillSpector risk score, 0-100 (0-20 low, 21-50 medium, 51-80 high, 81-100 critical).'),
  severity: z.string().nullable(),
  scannedAt: z.string().nullable(),
}).nullable();

const summarySchema = z.object({
  id: z.string().describe('Catalog id, {type}/{category}/{name}. Pass it to get_component or get_install_command.'),
  type: z.string(),
  name: z.string(),
  category: z.string(),
  description: z.string(),
  page: z.string(),
  installCommand: z.string(),
  runsCode: z.boolean().describe('True when installing it lets code run on the machine (hooks, MCP servers, settings with scripts, mods, plugins).'),
  downloads: z.number(),
  scan: scanSchema,
});

function summary(c: Component) {
  return {
    id: c.id, type: c.type, name: c.name, category: c.category,
    description: oneLine(c.description),
    page: c.page,
    installCommand: installCommand([c]),
    runsCode: WRITES[c.type].runsCode,
    downloads: c.downloads,
    scan: c.scan ? { tool: c.scan.tool, toolVersion: c.scan.toolVersion, score: c.scan.score, severity: c.scan.severity, scannedAt: c.scan.scannedAt } : null,
  };
}

function ok<T extends Record<string, unknown>>(data: T, text: string) {
  return { structuredContent: data, content: [{ type: 'text' as const, text }] };
}

function fail(text: string) {
  return { isError: true, content: [{ type: 'text' as const, text }] };
}

function unavailable(err: unknown) {
  const detail = err instanceof Error ? err.message : String(err);
  return fail(`The aitmpl.com catalog could not be loaded (${detail}). It is served from ${SITE}/api/v1/catalog.json; try again in a minute.`);
}

async function withCatalog<R>(fetcher: Fetcher, fn: (catalog: Catalog) => Promise<R> | R) {
  let catalog: Catalog;
  try {
    catalog = await loadCatalog(fetcher);
  } catch (err) {
    if (err instanceof CatalogUnavailable || err instanceof Error) return unavailable(err);
    throw err;
  }
  return fn(catalog);
}

function notFound(input: string, candidates: Component[]) {
  const list = candidates.map((c) => `- ${c.id}: ${oneLine(c.description, 120)}`).join('\n');
  return fail(candidates.length
    ? `No component with id "${input}". Ids look like {type}/{category}/{name}. Closest matches:\n${list}`
    : `No component with id "${input}". Ids look like {type}/{category}/{name}; use search_components to find one.`);
}

function resultText(results: ReturnType<typeof summary>[], total: number, query: string) {
  if (results.length === 0) return `No components match "${query}".`;
  const lines = results.map((r, i) =>
    `${i + 1}. ${r.id}${r.runsCode ? ' (runs code)' : ''}\n   ${r.description}\n   ${r.installCommand}\n   ${r.page}`);
  return `${total} component(s) match "${query}", best text match first:\n\n${lines.join('\n\n')}`;
}

/** Builds a fresh server per request (createMcpHandler is stateless). */
export function createServer(fetcher: Fetcher) {
  const server = new McpServer(
    {
      name: 'aitmpl',
      title: 'aitmpl.com (Claude Code Templates)',
      version: SERVER_VERSION,
      websiteUrl: 'https://docs.aitmpl.com/developers/mcp-server',
      icons: [{ src: `${SITE}/icon-192.png`, mimeType: 'image/png', sizes: ['192x192'] }],
    },
    {
      instructions:
        'Read-only access to the aitmpl.com catalog of Claude Code components (agents, commands, skills, hooks, MCP servers, settings, loops, mods and plugins). '
        + 'search_components finds components by text, get_component returns one component with its full content and security scan, '
        + 'get_install_command returns the claude-code-templates CLI command that installs one or more components. '
        + 'This server installs nothing itself: the command runs in a terminal on the machine where the components should go. '
        + 'Results are ordered by text match only; downloads and sponsorship never change the order.',
    },
  );

  server.registerTool(
    'search_components',
    {
      title: 'Search aitmpl components',
      description:
        'Search the aitmpl.com catalog of Claude Code components by text. Every word must appear in the name, path, keywords or description; '
        + 'results are ordered by how well the text matches, then by id. If no component matches every word, it returns the ones matching '
        + 'the most words, with match "partial". Each result has its id, a one-line description, its page, '
        + 'the CLI command that installs it, whether it runs code, and its SkillSpector scan.',
      inputSchema: z.object({
        query: z.string().trim().min(1).max(200).describe('Words to look for, e.g. "code review" or "postgres".'),
        type: typeSchema.optional(),
        category: z.string().trim().max(80).optional().describe('Category slug, e.g. "development-team". list_categories lists them.'),
        limit: z.number().int().min(1).max(25).default(10).describe('Maximum results, 1-25.'),
      }),
      outputSchema: z.object({
        query: z.string(),
        total: z.number(),
        match: z.enum(['all', 'partial']).describe('"partial" when no component matched every word and these match only some.'),
        results: z.array(summarySchema),
      }),
      annotations: { title: 'Search aitmpl components', ...READ_ONLY },
    },
    async ({ query, type, category, limit }) => withCatalog(fetcher, (catalog) => {
      const { total, match, results } = search(catalog, { query, type: type as ComponentType | undefined, category, limit });
      const rows = results.map(summary);
      const text = resultText(rows, total, query);
      return ok({ query, total, match, results: rows },
        match === 'partial' ? `No component matches every word of "${query}"; these match some of them.\n${text}` : text);
    }),
  );

  server.registerTool(
    'get_component',
    {
      title: 'Get an aitmpl component',
      description:
        'Return one component from the aitmpl.com catalog by id ({type}/{category}/{name}, as returned by search_components): '
        + 'its full content (the agent or command text, the hook or MCP configuration with the exact commands it runs, a skill\'s SKILL.md), '
        + 'the files it ships, what it writes on install, its license and source, and its SkillSpector scan with top findings. '
        + 'Content longer than 12,000 characters is cut, with a link to the full file.',
      inputSchema: z.object({
        id: z.string().trim().min(1).max(300).describe('Catalog id, e.g. "agents/development-team/frontend-developer".'),
      }),
      outputSchema: z.object({
        component: summarySchema.extend({
          author: z.string().nullable(),
          license: z.string().nullable(),
          sourceUrl: z.string().nullable(),
          upstream: z.object({ repo: z.string(), commit: z.string() }).nullable(),
          writes: z.string(),
          files: z.array(z.object({ path: z.string(), bytes: z.number().optional() })),
          content: z.string().nullable(),
          contentTruncated: z.boolean(),
          contentUrl: z.string(),
          scanFindings: z.array(z.object({ severity: z.string(), title: z.string(), file: z.string().optional(), line: z.number().optional() })),
        }),
      }),
      annotations: { title: 'Get an aitmpl component', ...READ_ONLY },
    },
    async ({ id }) => withCatalog(fetcher, async (catalog) => {
      const found = findComponent(catalog, id);
      if (!('component' in found)) return notFound(id, found.candidates);
      const c = found.component;

      let content: string | null = null;
      let files: Array<{ path: string; bytes?: number }> = [];
      try {
        const res = await fetcher(c.contentUrl);
        if (res.ok) {
          const body = (await res.json()) as { content?: string; files?: Record<string, string>; meta?: { files?: Array<{ path: string; bytes: number }> } };
          content = typeof body.content === 'string' ? body.content : null;
          files = body.meta?.files?.map((f) => ({ path: f.path, bytes: f.bytes }))
            ?? Object.keys(body.files || {}).map((path) => ({ path }));
        }
      } catch {
        // Content is optional; the catalog entry still answers.
      }
      const truncated = content !== null && content.length > MAX_CONTENT_CHARS;
      if (content && truncated) content = content.slice(0, MAX_CONTENT_CHARS);

      const data = {
        component: {
          ...summary(c),
          description: c.description,
          author: c.author, license: c.license, sourceUrl: c.sourceUrl, upstream: c.upstream,
          writes: WRITES[c.type].where,
          files: files.slice(0, 200),
          content, contentTruncated: truncated, contentUrl: c.contentUrl,
          scanFindings: (c.scan?.findings || []).slice(0, 5).map((f) => ({ severity: f.severity, title: f.title, file: f.file, line: f.line })),
        },
      };
      const scan = c.scan ? `${c.scan.tool} ${c.scan.toolVersion ?? ''}: score ${c.scan.score} (${c.scan.severity}), scanned ${c.scan.scannedAt}` : 'not scanned';
      const text = [
        `${c.id}`,
        oneLine(c.description, 600),
        '',
        `Install: ${installCommand([c])}`,
        `Writes: ${WRITES[c.type].where}${WRITES[c.type].runsCode ? ' (lets code run on the machine)' : ''}`,
        `Page: ${c.page}`,
        `Source: ${c.sourceUrl ?? 'n/a'}${c.upstream ? ` (pinned to ${c.upstream.repo}@${c.upstream.commit.slice(0, 12)})` : ''}`,
        `License: ${c.license ?? 'n/a'}`,
        `Security scan: ${scan}`,
        files.length ? `Files: ${files.slice(0, 30).map((f) => f.path).join(', ')}${files.length > 30 ? ', …' : ''}` : '',
        '',
        content ? `--- content${truncated ? ` (first ${MAX_CONTENT_CHARS} characters; full file: ${c.contentUrl})` : ''} ---\n${content}` : `Content: ${c.contentUrl}`,
      ].filter((l) => l !== '').join('\n');
      return ok(data, text);
    }),
  );

  server.registerTool(
    'get_install_command',
    {
      title: 'Get the install command',
      description:
        'Return the single claude-code-templates CLI command that installs the given components (up to 20 ids) into the project in the current directory, '
        + 'with --yes so it does not stop for prompts, '
        + 'plus what each one writes and whether it runs code. The server installs nothing; the command runs in a terminal in that project. '
        + 'Plugins also get the two /plugin commands that install them from inside Claude Code.',
      inputSchema: z.object({
        ids: z.array(z.string().trim().min(1).max(300)).min(1).max(20).describe('Catalog ids from search_components.'),
      }),
      outputSchema: z.object({
        command: z.string(),
        items: z.array(z.object({
          id: z.string(), type: z.string(), flag: z.string(), path: z.string(), writes: z.string(), runsCode: z.boolean(), page: z.string(),
        })),
        pluginCommands: z.array(z.string()),
        requires: z.string(),
      }),
      annotations: { title: 'Get the install command', ...READ_ONLY },
    },
    async ({ ids }) => withCatalog(fetcher, (catalog) => {
      const picked: Component[] = [];
      for (const id of ids) {
        const found = findComponent(catalog, id);
        if (!('component' in found)) return notFound(id, found.candidates);
        if (!picked.includes(found.component)) picked.push(found.component);
      }
      const command = installCommand(picked, { yes: true });
      const plugins = picked.filter((c) => c.type === 'plugins');
      const pluginCommands = plugins.length
        ? [`/plugin marketplace add ${SITE}/marketplace.json`, ...plugins.map((p) => `/plugin install ${p.name}@aitmpl`)]
        : [];
      const items = picked.map((c) => ({
        id: c.id, type: c.type, flag: `--${FLAG[c.type]}`, path: c.installPath,
        writes: WRITES[c.type].where, runsCode: WRITES[c.type].runsCode, page: c.page,
      }));
      const requires = plugins.length
        ? 'Node.js 18+ (npx); plugins also need Claude Code 2.1.288 or later.'
        : 'Node.js 18+ (npx).';
      const runsCode = items.filter((i) => i.runsCode);
      const text = [
        command,
        '',
        ...items.map((i) => `- ${i.id}: writes ${i.writes}${i.runsCode ? ' (lets code run on the machine)' : ''}`),
        runsCode.length ? `\n${runsCode.length} of ${items.length} let code run on the machine; get_component shows exactly what they run.` : '',
        pluginCommands.length ? `\nFrom inside Claude Code instead:\n${pluginCommands.join('\n')}` : '',
        `\nRequires ${requires} Run it from the project's root folder.`,
      ].filter(Boolean).join('\n');
      return ok({ command, items, pluginCommands, requires }, text);
    }),
  );

  server.registerTool(
    'list_categories',
    {
      title: 'List aitmpl categories',
      description:
        'List the component types in the aitmpl.com catalog with their counts, and the categories of one type (or all types) with their counts. '
        + 'The category slugs are the values accepted by the category filter of search_components.',
      inputSchema: z.object({ type: typeSchema.optional() }),
      outputSchema: z.object({
        catalogVersion: z.string(),
        generatedAt: z.string().nullable(),
        types: z.array(z.object({ type: z.string(), count: z.number() })),
        categories: z.array(z.object({ type: z.string(), category: z.string(), count: z.number() })),
      }),
      annotations: { title: 'List aitmpl categories', ...READ_ONLY },
    },
    async ({ type }) => withCatalog(fetcher, (catalog) => {
      const typeCounts = new Map<string, number>();
      const catCounts = new Map<string, number>();
      for (const c of catalog.components) {
        typeCounts.set(c.type, (typeCounts.get(c.type) || 0) + 1);
        if (!type || c.type === type) catCounts.set(`${c.type}\u0000${c.category}`, (catCounts.get(`${c.type}\u0000${c.category}`) || 0) + 1);
      }
      const types = TYPES.filter((t) => typeCounts.has(t)).map((t) => ({ type: t, count: typeCounts.get(t)! }));
      const categories = [...catCounts].map(([k, count]) => {
        const [t, category] = k.split('\u0000');
        return { type: t, category, count };
      }).sort((a, b) => a.type.localeCompare(b.type) || a.category.localeCompare(b.category));
      const text = [
        `aitmpl.com catalog: ${catalog.components.length} components.`,
        types.map((t) => `${t.type}: ${t.count}`).join(', '),
        '',
        ...(type ? [`Categories of ${type}:`] : ['Categories:']),
        ...categories.map((c) => `${type ? '' : `${c.type}/`}${c.category} (${c.count})`),
      ].join('\n');
      return ok({ catalogVersion: catalog.version.slice(0, 12), generatedAt: catalog.generatedAt, types, categories }, text);
    }),
  );

  return server;
}
