globalThis.process ??= {}; globalThis.process.env ??= {};
const COMPONENTS_JSON_URL = "/components.json";
const ITEMS_PER_PAGE = 24;
const AITMPL_MARKETPLACE = {
  name: "aitmpl",
  url: "https://www.aitmpl.com/marketplace.json",
  // Oldest Claude Code that installs from it reliably: MIN_CLAUDE_VERSION in cli-tool/src/plugin-install.js.
  minClaudeCode: "2.1.288"
};
const FEATURED_ITEMS = [
  {
    name: "Bright Data",
    description: "Complete Web Data Template",
    logo: "https://avatars.githubusercontent.com/u/213028976?v=4",
    url: "/featured/brightdata",
    tag: "Web Data",
    tagColor: "#2563eb",
    category: "Infrastructure",
    ctaLabel: "Try Bright Data Free",
    ctaUrl: "https://get.brightdata.com/lcqorc6nzp9w",
    websiteUrl: "https://get.brightdata.com/lcqorc6nzp9w",
    installCommand: "npx claude-code-templates@latest --skill web-data/search,web-data/scrape,web-data/data-feeds,web-data/bright-data-mcp,web-data/bright-data-best-practices,development/brightdata-local-search --mcp web-data/brightdata --yes",
    metadata: {
      Components: "8",
      Tools: "60+",
      Integration: "MCP, Skills, CLI"
    },
    links: [
      { label: "Skills Repository", url: "https://github.com/brightdata/skills" },
      { label: "MCP Server", url: "https://github.com/brightdata/brightdata-mcp" },
      { label: "API Documentation", url: "https://docs.brightdata.com" },
      { label: "brightdata.com", url: "https://get.brightdata.com/lcqorc6nzp9w" }
    ]
  },
  {
    name: "ClaudeKit",
    description: "AI Agents & Skills",
    logo: "https://docs.claudekit.cc/logo-horizontal.png",
    url: "/featured/claudekit",
    tag: "Toolkit",
    tagColor: "#d97706",
    category: "AI Engineering",
    ctaLabel: "Get ClaudeKit",
    ctaUrl: "https://claudekit.cc",
    websiteUrl: "https://claudekit.cc",
    metadata: {
      Users: "4,000+",
      Countries: "109"
    },
    links: [
      { label: "Documentation", url: "https://docs.claudekit.cc" },
      { label: "claudekit.cc", url: "https://claudekit.cc" }
    ]
  },
  {
    name: "BrainGrid",
    description: "Plan. Build. Verify. Repeat.",
    logo: "/braingrid-logo.webp",
    url: "/featured/braingrid",
    tag: "Planning",
    tagColor: "#c5e063",
    category: "Product Planning",
    ctaLabel: "Try BrainGrid",
    ctaUrl: "https://www.braingrid.ai?utm_source=aitmpl&utm_medium=featured&utm_campaign=partner",
    websiteUrl: "https://www.braingrid.ai",
    metadata: {
      Integration: "MCP, CLI",
      Stage: "Battle-tested"
    },
    links: [
      { label: "braingrid.ai", url: "https://www.braingrid.ai" }
    ]
  }
];
const NAV_LINKS = {
  github: "https://github.com/davila7/claude-code-templates",
  docs: "https://docs.aitmpl.com/",
  blog: "https://aitmpl.com/blog/"};

export { AITMPL_MARKETPLACE as A, COMPONENTS_JSON_URL as C, FEATURED_ITEMS as F, ITEMS_PER_PAGE as I, NAV_LINKS as N };
