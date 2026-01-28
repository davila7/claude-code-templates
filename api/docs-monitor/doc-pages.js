// Lista de todas las páginas de documentación de Claude Code a monitorear
// Actualizar si se agregan nuevas páginas

export const DOC_PAGES = [
  // Getting Started
  { slug: 'overview', title: 'Overview', category: 'Getting Started' },
  { slug: 'quickstart', title: 'Quickstart', category: 'Getting Started' },
  { slug: 'how-claude-code-works', title: 'How Claude Code Works', category: 'Getting Started' },

  // Guides
  { slug: 'best-practices', title: 'Best Practices', category: 'Guides' },
  { slug: 'common-workflows', title: 'Common Workflows', category: 'Guides' },
  { slug: 'memory', title: 'Memory (CLAUDE.md)', category: 'Guides' },
  { slug: 'skills', title: 'Skills', category: 'Guides' },

  // Configuration
  { slug: 'settings', title: 'Settings', category: 'Configuration' },
  { slug: 'mcp', title: 'MCP Servers', category: 'Configuration' },
  { slug: 'hooks', title: 'Hooks Reference', category: 'Configuration' },
  { slug: 'hooks-guide', title: 'Hooks Guide', category: 'Configuration' },

  // Extensions
  { slug: 'plugins', title: 'Create Plugins', category: 'Extensions' },
  { slug: 'plugins-reference', title: 'Plugins Reference', category: 'Extensions' },
  { slug: 'sub-agents', title: 'Custom Subagents', category: 'Extensions' },

  // IDE Integration
  { slug: 'vs-code', title: 'VS Code', category: 'IDE Integration' },
  { slug: 'desktop', title: 'Desktop App', category: 'IDE Integration' },
  { slug: 'chrome', title: 'Chrome Extension', category: 'IDE Integration' },
  { slug: 'claude-code-on-the-web', title: 'Claude Code on the Web', category: 'IDE Integration' },

  // CI/CD
  { slug: 'github-actions', title: 'GitHub Actions', category: 'CI/CD' },
  { slug: 'gitlab-ci-cd', title: 'GitLab CI/CD', category: 'CI/CD' },

  // Reference
  { slug: 'security', title: 'Security', category: 'Reference' },
  { slug: 'troubleshooting', title: 'Troubleshooting', category: 'Reference' },
  { slug: 'changelog', title: 'Changelog', category: 'Reference' },
];

export const BASE_URL = 'https://code.claude.com/docs/en';

export function getDocUrl(slug) {
  return `${BASE_URL}/${slug}`;
}

export function getAllDocUrls() {
  return DOC_PAGES.map(page => ({
    ...page,
    url: getDocUrl(page.slug)
  }));
}
