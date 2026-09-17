import { expect, test } from 'bun:test'
import {
  TYPES,
  cleanDescription,
  filterItems,
  installArgv,
  installCommandFor,
  pageOf,
  parseCounts,
  parseItems,
  parseTrending,
  sortByDownloads,
  truncate,
  typeByKey,
  webUrlFor,
} from '../hooks/catalog.ts'

const agents = TYPES[0]!

test('the eight browsable types have distinct digit hotkeys; templates are retired', () => {
  expect(TYPES.length).toBe(8)
  expect(new Set(TYPES.map(t => t.hotkey)).size).toBe(8)
  expect(typeByKey('templates')).toBeUndefined()
  expect(typeByKey('mods')?.flag).toBe('--mod')
  expect(typeByKey('MCPs'.toLowerCase())?.key).toBe('mcps')
  expect(typeByKey('sandbox')).toBeUndefined()
})

test('a quoted frontmatter description is unescaped and cut before its examples', () => {
  const raw = '"Use this agent for audits.\\n\\n<example>\\nContext: something\\n</example>"'
  expect(cleanDescription(raw)).toBe('Use this agent for audits.')
  expect(cleanDescription('plain \\"quoted\\" text')).toBe('plain "quoted" text')
  expect(cleanDescription('Builds apps across React and Vue. Specifically:\\n<example>x</example>')).toBe('Builds apps across React and Vue.')
  expect(cleanDescription('Use when:')).toBe('Use when')
  expect(cleanDescription(42)).toBe('')
})

test('parseItems keeps the fields the browser draws and skips bad rows', () => {
  const items = parseItems(
    JSON.stringify([
      { name: 'a', path: 'cat/a.md', category: 'cat', description: 'first', downloads: 3 },
      { name: '', path: 'x' },
      'junk',
      { name: 'tpl', installCommand: 'npx claude-code-templates@latest --template x', downloads: 1 },
    ]),
  )
  expect(items.map(i => i.name)).toEqual(['a', 'tpl'])
  expect(items[1]!.category).toBe('')
  expect(() => parseItems('not json')).toThrow()
  expect(parseCounts('{"agents": 2, "x": "no"}')).toEqual({ agents: 2 })
})

test('filtering needs every word, in name, category or description', () => {
  const items = parseItems(
    JSON.stringify([
      { name: 'react-expert', category: 'frontend', description: 'React components', downloads: 5 },
      { name: 'db-admin', category: 'database', description: 'Postgres tuning', downloads: 9 },
    ]),
  )
  expect(filterItems(items, '').length).toBe(2)
  expect(filterItems(items, 'react front').map(i => i.name)).toEqual(['react-expert'])
  expect(filterItems(items, 'postgres react')).toEqual([])
  expect(sortByDownloads(items).map(i => i.name)).toEqual(['db-admin', 'react-expert'])
})

test('pages clamp to the range', () => {
  const list = [1, 2, 3, 4, 5]
  expect(pageOf(list, 0, 2)).toEqual({ slice: [1, 2], page: 0, pages: 3 })
  expect(pageOf(list, 9, 2)).toEqual({ slice: [5], page: 2, pages: 3 })
  expect(pageOf([], 0, 2)).toEqual({ slice: [], page: 0, pages: 1 })
})

test('install command and URL drop the file extension; the argv adds --yes once', () => {
  const item = parseItems(JSON.stringify([{ name: 'x', path: 'cat/x.md', downloads: 0 }]))[0]!
  expect(installCommandFor(item, agents)).toBe('npx claude-code-templates@latest --agent cat/x')
  expect(installArgv(item, agents)).toEqual(['npx', 'claude-code-templates@latest', '--agent', 'cat/x', '--yes'])
  expect(webUrlFor('https://www.aitmpl.com/', item, agents)).toBe('https://www.aitmpl.com/component/agents/cat/x')
  const own = parseItems(JSON.stringify([{ name: 't', installCommand: 'npx claude-code-templates@latest --agent t --yes' }]))[0]!
  expect(installArgv(own, agents).filter(a => a === '--yes').length).toBe(1)
})

test('trending rows resolve their type from the id prefix and skip retired types', () => {
  const { rows, stats } = parseTrending(
    JSON.stringify({
      globalStats: { totalComponents: 2019, totalDownloads: 1340064, weeklyDownloads: 152849, totalCountries: 190, junk: 'x' },
      trending: {
        all: [
          { id: 'skill-frontend-design', name: 'frontend-design', category: 'creative-design', downloadsWeek: 4697 },
          { id: 'template-angular-app', name: 'angular-app', downloadsWeek: 9 },
          { id: 'mcp-web-data/brightdata', name: 'web-data/brightdata', category: 'web-data', downloadsWeek: 12 },
          'junk',
        ],
      },
    }),
    6,
  )
  expect(rows.map(r => `${r.type.key}:${r.name}`)).toEqual(['skills:frontend-design', 'mcps:web-data/brightdata'])
  expect(stats).toEqual({ totalComponents: 2019, totalDownloads: 1340064, weeklyDownloads: 152849, totalCountries: 190 })
  expect(parseTrending('{}').rows).toEqual([])
})

test('truncate keeps the width', () => {
  expect(truncate('abcdef', 4)).toBe('abc…')
  expect(truncate('abc', 4)).toBe('abc')
  expect(truncate('abc', 0)).toBe('')
})
