import type { FeaturedItem } from './types';

export const COMPONENTS_JSON_URL =
  import.meta.env.PUBLIC_COMPONENTS_JSON_URL ?? '/components.json';

export const ITEMS_PER_PAGE = 24;

export const FEATURED_ITEMS: FeaturedItem[] = [
  {
    name: 'Bright Data',
    description: 'Complete Web Data Template',
    logo: 'https://avatars.githubusercontent.com/u/213028976?v=4',
    url: '/featured/brightdata',
    tag: 'Web Data',
    tagColor: '#2563eb',
    category: 'Infrastructure',
    ctaLabel: 'Try Bright Data Free',
    ctaUrl: 'https://get.brightdata.com/lcqorc6nzp9w',
    websiteUrl: 'https://get.brightdata.com/lcqorc6nzp9w',
    installCommand:
      'npx claude-code-templates@latest --skill web-data/search,web-data/scrape,web-data/data-feeds,web-data/bright-data-mcp,web-data/bright-data-best-practices,development/brightdata-local-search --mcp web-data/brightdata --yes',
    metadata: {
      Components: '8',
      Tools: '60+',
      Integration: 'MCP, Skills, CLI',
    },
    links: [
      { label: 'Skills Repository', url: 'https://github.com/brightdata/skills' },
      { label: 'MCP Server', url: 'https://github.com/brightdata/brightdata-mcp' },
      { label: 'API Documentation', url: 'https://docs.brightdata.com' },
      { label: 'brightdata.com', url: 'https://get.brightdata.com/lcqorc6nzp9w' },
    ],
  },
  // TinyFish hidden temporarily
  // {
  //   name: 'TinyFish',
  //   description: 'AI Web Agent Platform',
  //   logo: '/tinyfish-logo.png',
  //   url: '/featured/tinyfish',
  //   tag: 'Web Agents',
  //   tagColor: '#0891b2',
  //   category: 'Infrastructure',
  //   ctaLabel: 'Try TinyFish',
  //   ctaUrl: 'https://www.tinyfish.ai/?utm_source=partner&utm_medium=cpc&utm_campaign=aitmpl-mcp-developer-2026q2',
  //   websiteUrl: 'https://www.tinyfish.ai/?utm_source=partner&utm_medium=cpc&utm_campaign=aitmpl-mcp-developer-2026q2',
  //   installCommand: 'npx claude-code-templates@latest --mcp web/tinyfish --yes',
  //   metadata: {
  //     Components: '1',
  //     Tools: '4',
  //     Integration: 'MCP',
  //   },
  //   links: [
  //     { label: 'Documentation', url: 'https://docs.tinyfish.ai' },
  //     { label: 'MCP Integration', url: 'https://docs.tinyfish.ai/mcp-integration' },
  //     { label: 'tinyfish.ai', url: 'https://www.tinyfish.ai/?utm_source=partner&utm_medium=cpc&utm_campaign=aitmpl-mcp-developer-2026q2' },
  //   ],
  // },
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
];

export const NAV_LINKS = {
  github: 'https://github.com/davila7/claude-code-templates',
  docs: 'https://docs.aitmpl.com/',
  blog: 'https://aitmpl.com/blog/',
  trending: 'https://aitmpl.com/trending.html',
};
