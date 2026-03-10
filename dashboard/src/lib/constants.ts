import type { FeaturedItem } from './types';

export const COMPONENTS_JSON_URL =
  import.meta.env.PUBLIC_COMPONENTS_JSON_URL ?? 'https://www.aitmpl.com/components.json';

export const ITEMS_PER_PAGE = 24;

export const FEATURED_ITEMS: FeaturedItem[] = [
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
  docs: 'https://docs.aitmpl.com/',
  blog: 'https://aitmpl.com/blog/',
  trending: 'https://aitmpl.com/trending.html',
};
