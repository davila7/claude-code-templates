// Run with: CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test productivity/aitmpl
import { describe, expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'
import {
  TYPES,
  catalogItemFor,
  dedupeInstalled,
  filterInstalled,
  isInstalled,
  itemKey,
  nbsp,
  searchEntries,
  type Installed,
  type Item,
} from '../hooks/catalog.ts'

const item = (name: string, downloads: number, extra: Partial<Item> = {}): Item => ({
  name,
  category: 'cat',
  description: `${name} description`,
  downloads,
  ...extra,
})

describe('helpers', () => {
  test('itemKey is the last path segment; installed matching uses it', () => {
    const it = item('Frontend Developer', 5, { path: 'dev-team/frontend-developer.md' })
    expect(itemKey(it)).toBe('frontend-developer')
    const rows: Installed[] = [{ type: 'agents', name: 'frontend-developer', scope: 'project' }]
    expect(isInstalled(rows, TYPES[0]!, it)).toBe(true)
    expect(isInstalled(rows, TYPES[1]!, it)).toBe(false)
    expect(catalogItemFor([it], rows[0]!)).toBe(it)
  })

  test('dedupe keeps the project copy over the user copy and sorts by name', () => {
    const rows = dedupeInstalled([
      { type: 'agents', name: 'b', scope: 'user' },
      { type: 'agents', name: 'b', scope: 'project' },
      { type: 'skills', name: 'a', scope: 'user' },
    ])
    expect(rows.map(r => `${r.name}:${r.scope}`)).toEqual(['a:user', 'b:project'])
  })

  test('installed rows follow the type filter and the query', () => {
    const rows: Installed[] = [
      { type: 'agents', name: 'react-expert', scope: 'project' },
      { type: 'skills', name: 'react-testing', scope: 'user' },
      { type: 'skills', name: 'docs', scope: 'user' },
    ]
    expect(filterInstalled(rows, 'all', '').length).toBe(3)
    expect(filterInstalled(rows, 'skills', '').length).toBe(2)
    expect(filterInstalled(rows, 'all', 'react').length).toBe(2)
    expect(filterInstalled(rows, 'skills', 'react').map(r => r.name)).toEqual(['react-testing'])
  })

  test('search spans the loaded types, most downloaded first', () => {
    const byType = new Map([
      ['agents' as const, [item('react-a', 10), item('vue-a', 99)]],
      ['skills' as const, [item('react-s', 50)]],
    ])
    expect(searchEntries(byType, TYPES, 'react').map(e => e.item.name)).toEqual(['react-s', 'react-a'])
    expect(searchEntries(byType, [TYPES[0]!], '').map(e => e.item.name)).toEqual(['vue-a', 'react-a'])
  })

  test('no-break spaces off the terminal only', () => {
    expect(nbsp('a b', 'terminal')).toBe('a b')
    expect(nbsp('a b', 'desktop')).toBe('a b')
  })
})

const PANE_PROPS = {
  title: 'aitmpl.com',
  isFocused: true,
  bodyColumns: 48,
  placement: 'dock' as const,
  scroll: { offset: 0, bodyRows: 40 },
  view: {},
}

const AGENTS = JSON.stringify([
  { name: 'react-expert', path: 'dev/react-expert.md', category: 'dev', description: 'React help', downloads: 1500 },
  { name: 'sql-guru', path: 'data/sql-guru.md', category: 'data', description: 'SQL help', downloads: 40 },
])
const SKILLS = JSON.stringify([{ name: 'docs-writer', path: 'writing/docs-writer', category: 'writing', description: 'Docs', downloads: 900 }])

function fakeHost(on: On, calls: { opened: unknown[]; urls: string[]; ran: string[][] }) {
  on('ui.open', (_$, e) => {
    calls.opened.push(e)
    return { value: { isPlaced: true as const } }
  })
  on('ui.close', () => ({ value: undefined }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.log', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('env.get', (_$, e) => ({ value: e.name === 'HOME' ? '/home/u' : undefined }))
  on('fs.list', (_$, e) => {
    const dirs: Record<string, { name: string; kind: 'file' | 'dir'; size: number; mtimeMs: number; isLink: boolean }[]> = {
      '.claude/agents': [{ name: 'react-expert.md', kind: 'file', size: 1, mtimeMs: 0, isLink: false }],
      '.claude/skills': [
        { name: 'docs-writer', kind: 'dir', size: 0, mtimeMs: 0, isLink: false },
        { name: 'my-mod', kind: 'dir', size: 0, mtimeMs: 0, isLink: false },
      ],
    }
    // the engine resolves a relative path against the working directory
    const key = Object.keys(dirs).find(k => e.path.endsWith(`/${k}`))
    return { value: (key && !e.path.startsWith('/home/u') ? dirs[key] : undefined) ?? [] }
  })
  on('fs.exists', (_$, e) => ({ value: e.path.endsWith('/.claude/skills/my-mod/.claude-plugin/plugin.json') }))
  on('http.fetch', (_$, e) => {
    calls.urls.push(e.url)
    const body = e.url.endsWith('components/agents.json') ? AGENTS : e.url.endsWith('components/skills.json') ? SKILLS : e.url.endsWith('counts.json') ? '{"agents":2,"skills":1}' : e.url.endsWith('trending-data.json') ? '{"globalStats":{"totalComponents":2000,"totalDownloads":1300000}}' : '[]'
    return { value: { status: 200, ok: true, headers: {}, text: body } }
  })
  on('process.run', (_$, e) => {
    calls.ran.push([...e.argv])
    return { value: { exitCode: 0, stdout: '', stderr: '' } }
  })
}

async function openPane($: Engine, args = '') {
  return $.command.run({ command: 'aitmpl', args, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 200 } })
}

describe('the sidebar is flat', () => {
  test('no colour, no bold, no border and no icon glyph anywhere in the tree', async ($, on) => {
    const calls = { opened: [] as unknown[], urls: [] as string[], ran: [] as string[][] }
    fakeHost(on, calls)
    await openPane($)
    const ui = await $.ui.mount({ plugin: 'aitmpl', surface: 'terminal', component: 'Pane', requestId: 'aitmpl', props: PANE_PROPS })
    await ui.redraw()
    await ui.redraw()
    const all = await ui.findAll({})
    expect(all.length).toBeGreaterThan(30)
    for (const el of all) {
      for (const prop of ['color', 'dimColor', 'bold', 'inverse', 'borderStyle', 'backgroundColor']) expect(el.props[prop]).toBeUndefined()
      expect(/[\u2190-\u21ff\u2500-\u27bf]/.test(String(el.props.label ?? el.text ?? ''))).toBe(false)
    }
    await ui.unmount()
  })
})

describe('the sidebar', () => {
  for (const surface of ['terminal', 'desktop'] as const) {
    test(`${surface}: opens docked, lists installed with downloads, filters by type and search`, async ($, on) => {
      const calls = { opened: [] as unknown[], urls: [] as string[], ran: [] as string[][] }
      fakeHost(on, calls)
      await openPane($)
      expect((calls.opened[0] as { id: string }).id).toBe('aitmpl')
      const ui = await $.ui.mount({ plugin: 'aitmpl', surface, component: 'Pane', requestId: 'aitmpl', props: PANE_PROPS })
      await ui.redraw()
      await ui.redraw()

      // the search box and a menu line per type (plus All), with the live counts
      expect(await ui.find({ key: 'aitmpl:search' })).toBeDefined()
      for (const t of TYPES) expect(await ui.find({ key: `aitmpl:chip:${t.key}` })).toBeDefined()
      expect(await ui.find({ key: 'aitmpl:chip:all' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /^2$/ })).toBeDefined()

      // installed: the agent and the skill by name; the mod directory is a mod, not a skill
      expect(await ui.find({ key: 'aitmpl:open:inst:agents:react-expert' })).toBeDefined()
      expect(await ui.find({ key: 'aitmpl:open:inst:skills:docs-writer' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /1\.5k downloads/ })).toBeDefined()
      expect((await ui.findAll({ type: 'Box' })).some(b => b.key === 'row:inst:mods:my-mod')).toBe(true)
      expect((await ui.findAll({ type: 'Box' })).some(b => b.key === 'row:inst:skills:my-mod')).toBe(false)

      // the catalog rows carry a view button; a component not installed carries install
      expect(await ui.find({ key: 'aitmpl:view:list:agents:sql-guru' })).toBeDefined()
      expect(await ui.find({ key: 'aitmpl:install:list:agents:sql-guru' })).toBeDefined()
      expect(await ui.find({ key: 'aitmpl:install:list:agents:react-expert' })).toBeUndefined()

      // filter to skills: no agents left in the list
      await ui.press({ key: 'aitmpl:chip:skills' })
      await ui.redraw()
      expect(await ui.find({ key: 'aitmpl:install:list:agents:sql-guru' })).toBeUndefined()

      // search narrows the list
      await ui.press({ key: 'aitmpl:chip:all' })
      await ui.input({ key: 'aitmpl:search', text: 'sql' })
      await ui.redraw()
      expect(await ui.find({ key: 'aitmpl:view:list:agents:sql-guru' })).toBeDefined()
      expect(await ui.find({ key: 'aitmpl:view:list:agents:react-expert' })).toBeUndefined()
      await ui.unmount()
    })
  }

  test('a row name opens its detail; install runs the fixed CLI argv', async ($, on) => {
    const calls = { opened: [] as unknown[], urls: [] as string[], ran: [] as string[][] }
    fakeHost(on, calls)
    await openPane($, 'agents')
    const ui = await $.ui.mount({ plugin: 'aitmpl', surface: 'terminal', component: 'Pane', requestId: 'aitmpl', props: PANE_PROPS })
    await ui.redraw()
    await ui.press({ key: 'aitmpl:open:list:agents:sql-guru' })
    await ui.redraw()
    await ui.press({ key: 'aitmpl:install' })
    await ui.redraw()
    expect(calls.ran[0]).toEqual(['npx', 'claude-code-templates@latest', '--agent', 'data/sql-guru', '--yes'])
    await ui.unmount()
  })

  test('every row is built from fixed-width cells on the desktop', async ($, on) => {
    const calls = { opened: [] as unknown[], urls: [] as string[], ran: [] as string[][] }
    fakeHost(on, calls)
    await openPane($)
    const ui = await $.ui.mount({ plugin: 'aitmpl', surface: 'desktop', component: 'Pane', requestId: 'aitmpl', props: PANE_PROPS })
    await ui.redraw()
    const boxes = await ui.findAll({ type: 'Box' })
    const rows = boxes.filter(b => b.key?.startsWith('row:'))
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) expect(r.props.width).toBe(47)
    // the type tag cell is a fixed 9 wide so names and tags line up row to row
    const tags = boxes.filter(b => b.key === 'type')
    expect(tags.length).toBeGreaterThan(0)
    for (const t of tags) expect(t.props.width).toBe(9)
    await ui.unmount()
  })
})
