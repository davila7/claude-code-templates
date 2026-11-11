import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  commitTitle,
  formatBytes,
  formatDate,
  initials,
  languageShares,
  pluginContentsSummary,
  topLevelEntries,
  totals,
} from '../src/lib/component-page.ts';

test('pluginContentsSummary counts each kind in a fixed order, singular for one', () => {
  assert.equal(pluginContentsSummary({ agents: ['repo-scout'], skills: ['climb', 'faq'] }), '2 skills, 1 agent');
  assert.equal(pluginContentsSummary({ mcpServers: ['db'], hooks: ['PostToolUse', 'Stop'], skills: [] }), '2 hook events, 1 MCP server');
  assert.equal(pluginContentsSummary(undefined), '');
});

const REX = [
  { path: 'SKILL.md', bytes: 8491, lines: 84 },
  { path: 'scripts/rex-claude.sh', bytes: 8630, lines: 238 },
];

test('formatBytes', () => {
  assert.equal(formatBytes(900), '900 B');
  assert.equal(formatBytes(17121), '16.7 KB');
  assert.equal(formatBytes(3 * 1024 * 1024), '3.0 MB');
});

test('formatDate keeps the commit author day', () => {
  assert.equal(formatDate('2026-10-30T23:21:18-04:00'), 'Oct 30, 2026');
  assert.equal(formatDate(undefined), '');
  assert.equal(formatDate('garbage'), '');
});

test('initials', () => {
  assert.equal(initials('Daniel Avila'), 'DA');
  assert.equal(initials('Dani'), 'D');
  assert.equal(initials('claude[bot]'), 'C');
  assert.equal(initials(''), '?');
});

test('commitTitle drops the squash PR number', () => {
  assert.equal(commitTitle('feat(skills): add rex-claude skill (#1321)'), 'feat(skills): add rex-claude skill');
  assert.equal(commitTitle('fix typo'), 'fix typo');
});

test('totals', () => {
  assert.deepEqual(totals(REX), { files: 2, lines: 322, bytes: 17121 });
  assert.deepEqual(totals([{ path: 'a.png', bytes: 10, lines: null }]), { files: 1, lines: 0, bytes: 10 });
});

test('topLevelEntries lists folders first, then files', () => {
  const rows = topLevelEntries([
    { path: 'README.md', bytes: 10, lines: 1 },
    { path: 'hooks/b.ts', bytes: 5, lines: 2 },
    { path: 'hooks/a.ts', bytes: 5, lines: 3 },
    { path: '.claude-plugin/plugin.json', bytes: 7, lines: 4 },
  ]);
  assert.deepEqual(rows.map((r) => [r.name, r.kind, r.files, r.lines]), [
    ['.claude-plugin', 'dir', 1, 4],
    ['hooks', 'dir', 2, 5],
    ['README.md', 'file', 1, 1],
  ]);
  assert.equal(rows[1]!.firstFile, 'hooks/a.ts');
});

test('languageShares', () => {
  assert.deepEqual(languageShares([{ name: 'Markdown', bytes: 8491 }, { name: 'Shell', bytes: 8630 }]), [
    { name: 'Shell', pct: 50.4 },
    { name: 'Markdown', pct: 49.6 },
  ]);
  assert.deepEqual(languageShares([]), []);
  const many = languageShares(
    [{ name: 'A', bytes: 50 }, { name: 'B', bytes: 20 }, { name: 'C', bytes: 15 }, { name: 'D', bytes: 10 }, { name: 'E', bytes: 5 }],
    3,
  );
  assert.deepEqual(many.map((l) => l.name), ['A', 'B', 'C', 'Other']);
  assert.equal(many[3]!.pct, 15);
});

test('displayName title-cases a slug and spells acronyms', async () => {
  const { displayName } = await import('../src/lib/component-page.ts');
  assert.equal(displayName('react-best-practices'), 'React Best Practices');
  assert.equal(displayName('mcp-builder'), 'MCP Builder');
  assert.equal(displayName('github_actions-ci.md'), 'GitHub Actions CI');
  assert.equal(displayName('angular-app'), 'Angular App');
  assert.equal(displayName(''), '');
});

test('nextStepItems: loops first, then the category alphabetically from the current one, never itself', async () => {
  const { nextStepItems } = await import('../src/lib/component-page.ts');
  const c = (name: string, category = 'dev', downloads = 0) => ({ name, path: `${category}/${name}.md`, category, downloads });
  const siblings = [c('zeta', 'dev', 999), c('alpha'), c('mid'), c('beta'), c('other', 'ops', 5000), c('gamma')];
  const items = nextStepItems(c('delta'), siblings, [c('fix-loop', 'engineering')], 4);
  assert.deepEqual(items.map((i) => [i.block, i.component.name]), [
    ['loop', 'fix-loop'], ['same_category', 'gamma'], ['same_category', 'mid'], ['same_category', 'zeta'],
  ]);
  // Wraps around to the start of the alphabet; downloads never change the order.
  const all = nextStepItems(c('mid'), siblings, [], 6).map((i) => i.component.name);
  assert.deepEqual(all, ['zeta', 'alpha', 'beta', 'gamma']);
  assert.equal(nextStepItems(c('zeta'), siblings, [], 6)[0].component.name, 'alpha');
});
