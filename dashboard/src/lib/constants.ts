import type { FeaturedItem } from './types';

export const COMPONENTS_JSON_URL =
  import.meta.env.PUBLIC_COMPONENTS_JSON_URL ?? '/components.json';

export const ITEMS_PER_PAGE = 24;

export const FEATURED_ITEMS: FeaturedItem[] = [
  {
    name: 'Neon',
    description: 'Complete Postgres Template',
    logo: 'https://neon.tech/brand/neon-logo-dark-color.svg',
    url: '/featured/neon-instagres',
    tag: 'Database',
    tagColor: '#059669',
    category: 'Infrastructure',
    ctaLabel: 'Try Neon Free',
    ctaUrl: 'https://get.neon.com/4eCjZDz',
    websiteUrl: 'https://neon.tech',
    installCommand: 'npx claude-code-templates@latest --skill database/neon-instagres,database/using-neon --yes',
    metadata: {
      Components: '10',
      Integration: 'MCP, CLI',
    },
    links: [
      { label: 'Instagres Docs', url: 'https://neon.tech/docs/guides/instagres' },
      { label: 'Platform Overview', url: 'https://neon.tech/docs/introduction' },
      { label: 'neon.tech', url: 'https://neon.tech' },
    ],
  },
  {
    name: 'ClaudeKit',
    description: 'AI Agents & Skills',
    logo: 'https://docs.claudekit.cc/logo-horizontal.png',
    url: '/featured/claudekit',
    tag: 'Toolkit',
    tagColor: '#d97706',
    category: 'AI Engineering',
    ctaLabel: 'Get ClaudeKit',
    ctaUrl: 'https://claudekit.cc',
    websiteUrl: 'https://claudekit.cc',
    metadata: {
      Users: '4,000+',
      Countries: '109',
    },
    links: [
      { label: 'Documentation', url: 'https://docs.claudekit.cc' },
      { label: 'claudekit.cc', url: 'https://claudekit.cc' },
    ],
  },
  {
    name: 'Bright Data',
    description: 'Complete Web Data Template',
    logo: 'https://avatars.githubusercontent.com/u/213028976?v=4',
    url: '/featured/brightdata',
    tag: 'Web Data',
    tagColor: '#2563eb',
    category: 'Infrastructure',
    ctaLabel: 'Try Bright Data Free',
    ctaUrl: 'https://brightdata.com/cp',
    websiteUrl: 'https://brightdata.com',
    installCommand:
      'npx claude-code-templates@latest --skill web-data/search,web-data/scrape,web-data/data-feeds,web-data/bright-data-mcp,web-data/bright-data-best-practices --mcp web-data/brightdata --yes',
    metadata: {
      Components: '7',
      Tools: '60+',
      Integration: 'MCP, Skills, CLI',
    },
    links: [
      { label: 'Skills Repository', url: 'https://github.com/brightdata/skills' },
      { label: 'MCP Server', url: 'https://github.com/brightdata/brightdata-mcp' },
      { label: 'API Documentation', url: 'https://docs.brightdata.com' },
      { label: 'brightdata.com', url: 'https://brightdata.com' },
    ],
  },
];

export const NAV_LINKS = {
  github: 'https://github.com/davila7/claude-code-templates',
  docs: 'https://docs.aitmpl.com/',
  blog: 'https://aitmpl.com/blog/',
  trending: 'https://aitmpl.com/trending.html',
};
