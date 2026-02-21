import type { FeaturedItem } from './types';

export const COMPONENTS_JSON_URL =
  import.meta.env.PUBLIC_COMPONENTS_JSON_URL ?? 'https://www.aitmpl.com/components.json';

export const ITEMS_PER_PAGE = 24;

export const FEATURED_ITEMS: FeaturedItem[] = [
  {
    name: 'BrainGrid',
    description: 'Product Management Agent',
    logo: 'https://www.braingrid.ai/brand/full-logo-lime-on-transparent.png',
    url: '/featured/braingrid',
    tag: 'Partner',
  },
  {
    name: 'Neon',
    description: 'Complete Postgres Template',
    logo: 'https://neon.tech/brand/neon-logo-dark-color.svg',
    url: '/featured/neon-instagres',
    tag: 'Database',
  },
  {
    name: 'ClaudeKit',
    description: 'AI Agents & Skills',
    logo: 'https://docs.claudekit.cc/logo-horizontal.png',
    url: '/featured/claudekit',
    tag: 'Toolkit',
  },
];

export const NAV_LINKS = {
  github: 'https://github.com/davila7/claude-code-templates',
  docs: 'https://www.cubic.dev/wikis/davila7/claude-code-templates?page=introduction',
  blog: 'https://aitmpl.com/blog/',
  trending: 'https://aitmpl.com/trending.html',
};
