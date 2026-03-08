interface Change {
  type: string;
  description: string;
  category: string | null;
  raw: string;
}

interface ParsedVersion {
  version: string;
  content: string | null;
  changes: Change[];
  changeCount?: number;
  error?: string;
}

interface Summary {
  total: number;
  byType: Record<string, number>;
  byCategory: Record<string, number>;
  highlights: Change[];
}

interface FormattedChanges {
  features: string;
  fixes: string;
  improvements: string;
  breaking: string;
  other: string;
}

export function parseVersionChangelog(changelog: string, version: string): ParsedVersion {
  const cleanVersion = version.replace(/^v/, '');
  const versionRegex = new RegExp(`^##\\s+(?:v)?${cleanVersion.replace(/\./g, '\\.')}`, 'm');
  const match = changelog.match(versionRegex);

  if (!match) {
    return { version: cleanVersion, content: null, changes: [], error: 'Version not found in changelog' };
  }

  const startIndex = match.index!;
  const nextVersionRegex = /^##\s+(?:v)?\d+\.\d+\.\d+/m;
  const remainingChangelog = changelog.substring(startIndex + match[0].length);
  const nextMatch = remainingChangelog.match(nextVersionRegex);
  const endIndex = nextMatch ? startIndex + match[0].length + nextMatch.index! : changelog.length;
  const versionContent = changelog.substring(startIndex, endIndex).trim();
  const changes = parseChanges(versionContent);

  return { version: cleanVersion, content: versionContent, changes, changeCount: changes.length };
}

function parseChanges(content: string): Change[] {
  const changes: Change[] = [];
  const lines = content.split('\n');
  let currentCategory: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('##')) continue;
    if (trimmed.startsWith('###')) {
      currentCategory = trimmed.replace(/^###\s*/, '').trim();
      continue;
    }
    if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
      const description = trimmed.replace(/^[-*]\s*/, '').trim();
      if (!description) continue;
      changes.push({
        type: classifyChange(description),
        description,
        category: currentCategory || detectCategory(description),
        raw: line,
      });
    }
  }
  return changes;
}

function classifyChange(description: string): string {
  const lower = description.toLowerCase();
  if (lower.includes('breaking') || lower.includes('removed') || lower.includes('deprecated')) return 'breaking';
  if (lower.includes('add') || lower.includes('new') || lower.includes('introduce') || lower.includes('support for')) return 'feature';
  if (lower.includes('fix') || lower.includes('resolve') || lower.includes('correct') || lower.includes('patch')) return 'fix';
  if (lower.includes('improve') || lower.includes('enhance') || lower.includes('optimize') || lower.includes('better') || lower.includes('refactor')) return 'improvement';
  if (lower.includes('deprecate')) return 'deprecation';
  if (lower.includes('performance') || lower.includes('speed') || lower.includes('faster')) return 'performance';
  if (lower.includes('docs') || lower.includes('documentation')) return 'documentation';
  return 'other';
}

function detectCategory(description: string): string | null {
  const lower = description.toLowerCase();
  const categories: Record<string, string[]> = {
    'Plugin System': ['plugin', 'plugins', 'marketplace'],
    CLI: ['cli', 'command', 'terminal', 'bash'],
    Performance: ['performance', 'speed', 'faster', 'optimize', 'cache'],
    'UI/UX': ['ui', 'ux', 'interface', 'display', 'output'],
    API: ['api', 'endpoint', 'rest', 'graphql'],
    Models: ['model', 'sonnet', 'opus', 'haiku', 'claude'],
    MCP: ['mcp', 'model context protocol'],
    Agents: ['agent', 'subagent', 'explore'],
    Settings: ['setting', 'config', 'configuration'],
    Hooks: ['hook', 'trigger', 'event'],
    Security: ['security', 'auth', 'authentication', 'permission'],
    Documentation: ['docs', 'documentation', 'readme'],
    Windows: ['windows', 'win32'],
    macOS: ['macos', 'darwin', 'mac'],
    Linux: ['linux', 'unix'],
  };

  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some((keyword) => lower.includes(keyword))) return category;
  }
  return null;
}

export function generateSummary(changes: Change[]): Summary {
  const summary: Summary = { total: changes.length, byType: {}, byCategory: {}, highlights: [] };
  for (const change of changes) {
    summary.byType[change.type] = (summary.byType[change.type] || 0) + 1;
    if (change.category) {
      summary.byCategory[change.category] = (summary.byCategory[change.category] || 0) + 1;
    }
    if (change.type === 'breaking' || change.type === 'feature') {
      summary.highlights.push(change);
    }
  }
  return summary;
}

export function formatForDiscord(changes: Change[], maxLength = 1024): FormattedChanges {
  const grouped: Record<string, string[]> = { features: [], fixes: [], improvements: [], breaking: [], other: [] };

  for (const change of changes) {
    switch (change.type) {
      case 'feature': grouped.features.push(change.description); break;
      case 'fix': grouped.fixes.push(change.description); break;
      case 'improvement': case 'performance': grouped.improvements.push(change.description); break;
      case 'breaking': case 'deprecation': grouped.breaking.push(change.description); break;
      default: grouped.other.push(change.description);
    }
  }

  const truncate = (items: string[], max: number) => {
    const text = items.map((item) => `\u2022 ${item}`).join('\n');
    if (text.length > max) {
      const truncated = text.substring(0, max - 20);
      const lastNewline = truncated.lastIndexOf('\n');
      return truncated.substring(0, lastNewline) + '\n... [Read more in changelog]';
    }
    return text;
  };

  return {
    features: truncate(grouped.features, maxLength),
    fixes: truncate(grouped.fixes, maxLength),
    improvements: truncate(grouped.improvements, maxLength),
    breaking: truncate(grouped.breaking, maxLength),
    other: truncate(grouped.other, maxLength),
  };
}
