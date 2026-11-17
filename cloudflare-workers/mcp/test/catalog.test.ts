import { describe, expect, it } from 'vitest';
import { buildCatalog, findComponent, installCommand, search } from '../src/catalog';

const v1 = (type: string, category: string, name: string, extra: Record<string, unknown> = {}) => ({
  id: `${type}/${category}/${name}`, type, name, category,
  path: `${category}/${name}${type === 'agents' || type === 'commands' ? '.md' : ''}`,
  description: `${name} description`, author: null, license: null, keywords: [], downloads: 0,
  install: { command: '', args: [`--${type.replace(/s$/, '')}`, `${category}/${name}`] },
  urls: { page: `https://www.aitmpl.com/component/${type}/${category}/${name}`, source: null, content: '' },
  scan: null, source: null, ...extra,
});

const catalog = buildCatalog('sha', null, [
  v1('agents', 'dev', 'code-reviewer', { downloads: 1 }),
  v1('agents', 'dev', 'reviewer-helper', { downloads: 99999, description: 'helps with code review' }),
  v1('commands', 'utilities', 'code-review'),
  v1('hooks', 'git', 'pre-commit-review'),
  v1('templates', 'x', 'old-template'),
] as never, [
  { name: 'champion-kit', path: 'productivity/champion-kit', category: 'productivity', description: 'Champions', author: 'Anthropic', license: 'Apache-2.0' },
]);

describe('search', () => {
  it('orders by text match, never by downloads', () => {
    const ids = search(catalog, { query: 'code review', limit: 10 }).results.map((c) => c.id);
    expect(ids[0]).toBe('commands/utilities/code-review'); // exact name bonus
    expect(ids.indexOf('agents/dev/code-reviewer')).toBeLessThan(ids.indexOf('agents/dev/reviewer-helper'));
  });

  it('filters by type and category', () => {
    expect(search(catalog, { query: 'review', type: 'hooks', limit: 10 }).results.map((c) => c.id)).toEqual(['hooks/git/pre-commit-review']);
    expect(search(catalog, { query: 'review', category: 'dev', limit: 10 }).total).toBe(2);
  });

  it('drops retired templates and includes plugins', () => {
    expect(catalog.components.some((c) => (c.type as string) === 'templates')).toBe(false);
    expect(search(catalog, { query: 'champion', limit: 5 }).results[0].id).toBe('plugins/productivity/champion-kit');
  });

  it('falls back to partial matches, most words first, only when nothing matches every word', () => {
    expect(search(catalog, { query: 'code review', limit: 10 }).match).toBe('all');
    const partial = search(catalog, { query: 'code review helm', limit: 10 });
    expect(partial.match).toBe('partial');
    expect(partial.results[0].id).toBe('commands/utilities/code-review');
    expect(partial.results.map((c) => c.id)).toContain('hooks/git/pre-commit-review');
    expect(search(catalog, { query: 'helm', limit: 10 })).toMatchObject({ total: 0, match: 'all' });
    expect(search(catalog, { query: 'helm lint', limit: 10 })).toMatchObject({ total: 0, match: 'partial' });
  });
});

describe('findComponent', () => {
  it('accepts ids, ids with an extension, install paths and unique names', () => {
    for (const input of ['agents/dev/code-reviewer', 'agents/dev/code-reviewer.md', 'dev/code-reviewer', 'code-reviewer']) {
      const found = findComponent(catalog, input);
      expect('component' in found && found.component.id).toBe('agents/dev/code-reviewer');
    }
  });

  it('suggests candidates for an unknown id', () => {
    const found = findComponent(catalog, 'agents/dev/code-reviewr');
    expect('candidates' in found).toBe(true);
  });
});

describe('installCommand', () => {
  it('groups paths by flag in one command', () => {
    const items = ['agents/dev/code-reviewer', 'agents/dev/reviewer-helper', 'plugins/productivity/champion-kit']
      .map((id) => catalog.byId.get(id)!);
    expect(installCommand(items)).toBe(
      'npx claude-code-templates@latest --agent dev/code-reviewer,dev/reviewer-helper --plugin productivity/champion-kit');
    expect(installCommand(items.slice(0, 1), { yes: true })).toBe('npx claude-code-templates@latest --agent dev/code-reviewer --yes');
  });
});
