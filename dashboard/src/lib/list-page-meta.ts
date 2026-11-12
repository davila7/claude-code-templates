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
