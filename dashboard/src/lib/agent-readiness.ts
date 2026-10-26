/**
 * Machine-readable surfaces for AI agents: Markdown 404 bodies, /llms.txt.
 * Pure functions (no Astro imports) so they can be unit-tested with node --test.
 */

export const SITE = 'https://www.aitmpl.com';
export const CLI_COMMAND = 'npx claude-code-templates@latest';

export const MARKDOWN_CONTENT_TYPE = 'text/markdown; charset=utf-8';

/**
 * True when the Accept header asks for Markdown at least as strongly as HTML.
 * Browsers send text/html (and never text/markdown), so they always get HTML.
 */
export function prefersMarkdown(accept: string | null | undefined): boolean {
  if (!accept) return false;
  let markdown = -1;
  let html = -1;
  for (const part of accept.split(',')) {
    const [rawType, ...params] = part.trim().split(';');
    const type = rawType.trim().toLowerCase();
    let q = 1;
    for (const p of params) {
      const [k, v] = p.trim().split('=');
      if (k?.trim().toLowerCase() === 'q') {
        const parsed = Number.parseFloat(v);
        q = Number.isFinite(parsed) ? parsed : 0;
      }
    }
    if (type === 'text/markdown' || type === 'text/x-markdown') markdown = Math.max(markdown, q);
    else if (type === 'text/html') html = Math.max(html, q);
  }
  return markdown > 0 && markdown >= html;
}

export function notFoundMarkdown(pathname: string): string {
  const safePath = pathname.replace(/[\r\n`]/g, '').slice(0, 200);
  return `# 404 Not Found

There is no page at \`${safePath}\` on aitmpl.com (Claude Code Templates).

- Site overview for agents: ${SITE}/llms.txt
- Every page on the site: ${SITE}/sitemap.xml
- Catalog data API (OpenAPI 3.1): ${SITE}/openapi.json
- Component pages live at ${SITE}/component/{type}/{category}/{name}, for example ${SITE}/component/agents/development-team/frontend-developer
- Documentation: https://docs.aitmpl.com
`;
}

export type Counts = Partial<Record<string, number>>;

const COUNTED_TYPES: Array<[key: string, label: string, flag: string]> = [
  ['skills', 'Skills', '--skill'],
  ['agents', 'Agents', '--agent'],
  ['commands', 'Slash commands', '--command'],
  ['mcps', 'MCP server configurations', '--mcp'],
  ['settings', 'Settings', '--setting'],
  ['hooks', 'Hooks', '--hook'],
  ['loops', 'Loops', '--loop'],
  ['mods', 'Mods (function-hooks plugins)', '--mod'],
];

export function totalComponents(counts: Counts): number {
  return COUNTED_TYPES.reduce((sum, [key]) => sum + (counts[key] ?? 0), 0);
}

export function buildLlmsTxt(counts: Counts): string {
  const total = totalComponents(counts);
  const typeLines = COUNTED_TYPES.filter(([key]) => (counts[key] ?? 0) > 0)
    .map(([key, label, flag]) => `- [${label}](${SITE}/${key}): ${counts[key]} components, install with \`${flag}\``)
    .join('\n');

  return `# Claude Code Templates (aitmpl.com)

> Open-source catalog and CLI of ${total}+ ready-to-use components for Claude Code: agents, slash commands, skills, hooks, MCP server configurations, settings, loops and mods. Every component is a plain file with its source on GitHub, and installs into a project with one \`${CLI_COMMAND}\` command.

## When to use this

- The user wants an existing Claude Code subagent, skill, slash command, hook, MCP configuration or settings file instead of writing one from scratch.
- The user asks how to install a Claude Code component, or wants one command that sets up several components in a project.
- You need to look up what a component contains before installing it: its files, description and install command.
- You want to compare available components for a job (for example code review, security auditing, testing, deployment, documentation).

Not a fit: general questions about Claude Code itself (use https://code.claude.com/docs), or calling Claude models (use the Claude API).

## How an agent should use it

1. Search the catalog: GET ${SITE}/api/v1/catalog/{type}.json (one type, e.g. skills) or ${SITE}/api/v1/catalog.json (everything). Each entry has id, name, category, description, downloads, install.command and urls.
2. Read a component's full file before recommending it: GET ${SITE}/component-content/{type}/{category}/{name}.json, where {category}/{name} is \`path\` without its extension and {type} is plural (agents, commands, skills, ...).
3. Install it from the project root: \`${CLI_COMMAND} --agent {category}/{name}\` (use the flag for its type, below). Several flags can be combined in one command.
4. Hooks, MCP servers and mods run code with local permissions: show the user the component's content before installing them.

## Component types

${typeLines}

## API and machine-readable data

- [Catalog API v1](${SITE}/developers/catalog-api): versioned, documented catalog with a JSON Schema and a stability policy. Use this one in code.
- [Catalog v1](${SITE}/api/v1/catalog.json): every component; [one type](${SITE}/api/v1/catalog/agents.json): replace \`agents\` with any plural type.
- [Catalog version](${SITE}/api/v1/version.json): generatedAt, sha256 and counts per type; poll this before downloading the catalog.
- [OpenAPI 3.1 spec](${SITE}/openapi.json): read-only GET endpoints for the catalog JSON files. No authentication, CORS enabled.
- [Trending](${SITE}/trending-data.json): download statistics and trending components.
- [Sitemap](${SITE}/sitemap.xml): every component page.

## CLI

- [npm package claude-code-templates](https://www.npmjs.com/package/claude-code-templates): \`${CLI_COMMAND}\` with --agent, --command, --skill, --hook, --mcp, --setting, --loop or --mod followed by a component path. Run without flags for an interactive picker.
- [Batch installation guide](https://docs.aitmpl.com/guides/batch-installation)

## Docs and source

- [Documentation](https://docs.aitmpl.com)
- [GitHub repository](https://github.com/davila7/claude-code-templates): source of every component, issues and contributions.
- [About](${SITE}/about)
- [Privacy](${SITE}/privacy)

## Optional

- [Plugins and marketplaces](${SITE}/plugins): third-party Claude Code plugin marketplaces indexed by the site.
- [Trending components](${SITE}/trending)
`;
}
