/**
 * Title, meta description and H1 of the catalog list pages, with the figures
 * read from public/counts.json at build time (so they never go stale).
 * Pure functions so node --test can cover them.
 *
 * Initiative 3 of the traction plan rewrites one list page at a time:
 * /skills/ changed on 2026-11-08.
 */

export interface ListPageMeta {
  title: string;
  description: string;
  h1: string;
}

function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}

export function skillsPageMeta(count: number | undefined): ListPageMeta {
  if (!count || !Number.isFinite(count) || count <= 0) {
    return {
      title: 'Claude Skills: Open-Source Skills for Claude Code',
      description:
        'Browse open-source Claude skills (SKILL.md folders) for Claude Code: development, document processing, security, marketing and more. See every file of a skill and install it with one npx command.',
      h1: 'Claude Skills',
    };
  }
  const n = formatCount(count);
  return {
    title: `Claude Skills: ${n} Open-Source Skills for Claude Code`,
    description: `Browse ${n} open-source Claude skills (SKILL.md folders) for Claude Code: development, document processing, security, marketing and more. See every file of a skill and install it with one npx command.`,
    h1: `${n} Claude Skills`,
  };
}

export interface HomePageMeta {
  title: string;
  description: string;
  /** SoftwareApplication JSON-LD description. */
  schemaDescription: string;
}

/**
 * Home page title/description with the catalog total (sum of the component
 * types in counts.json, see totalComponents). Rounded down to the ten so the
 * title does not change on every added component.
 */
export function homePageMeta(total: number | undefined): HomePageMeta {
  if (!total || !Number.isFinite(total) || total < 10) {
    return {
      title: 'Claude Code Templates: Agents, Commands, Skills & MCP Integrations',
      description:
        'Browse and install pre-built components for Claude Code: AI agents, slash commands, skills, MCP integrations, hooks, and settings. Free, open-source CLI tool.',
      schemaDescription:
        'CLI tool and catalog of Claude Code components: agents, commands, skills, settings, hooks, and MCP integrations.',
    };
  }
  const n = `${formatCount(Math.floor(total / 10) * 10)}+`;
  return {
    title: `Claude Code Templates: ${n} Agents, Commands, Skills & MCP Integrations`,
    description: `Browse and install ${n} pre-built components for Claude Code: AI agents, slash commands, skills, MCP integrations, hooks, and settings. Free, open-source CLI tool.`,
    schemaDescription: `CLI tool and catalog of Claude Code components. Over ${n.slice(0, -1)} agents, commands, skills, settings, hooks, and MCP integrations.`,
  };
}
