// Run with: claude plugin test integrations/linear-tickets
import { describe, expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'
import { barChart, buildFilter, count, currentCycleId, cycleElapsed, dayOf, doneByDay, graphqlData, parseCycle, parseTickets, sortTickets, spark, stacked, summaryText } from '../hooks/linear-api.ts'

const KEY = 'lin_api_test_key'
// 2026-10-01 15:00 UTC; tests run at offset 0 so a "day" is a UTC day
const NOW = Date.UTC(2026, 9, 1, 15, 0, 0)
const iso = (daysAgo: number, hour = 12) => new Date(Date.UTC(2026, 9, 1 - daysAgo, hour)).toISOString()

const issue = (over: Record<string, unknown>) => ({
  id: `id-${over.identifier}`,
  title: `Title of ${over.identifier}`,
  url: `https://linear.app/acme/issue/${over.identifier}`,
  priority: 3,
  priorityLabel: 'Medium',
  updatedAt: iso(0),
  state: { name: 'Todo', type: 'unstarted' },
  ...over,
})
const CYCLE = { id: 'cyc-1', number: 12, name: 'Sprint', startsAt: iso(5, 0), endsAt: iso(-9, 0) }
const NODES = [
  issue({ identifier: 'CLA-149', priority: 2, priorityLabel: 'High', state: { name: 'In Progress', type: 'started' }, cycle: CYCLE }),
  issue({ identifier: 'CLA-150', state: { name: 'Todo', type: 'unstarted' }, cycle: CYCLE }),
  issue({ identifier: 'CLA-151', priority: 0, priorityLabel: 'No priority', state: { name: 'Backlog', type: 'backlog' } }),
  issue({ identifier: 'CLA-143', state: { name: 'Done', type: 'completed' }, completedAt: iso(0, 9), cycle: CYCLE }),
  issue({ identifier: 'CLA-144', state: { name: 'Done', type: 'completed' }, completedAt: iso(0, 10) }),
  issue({ identifier: 'CLA-145', state: { name: 'Done', type: 'completed' }, completedAt: iso(2) }),
  issue({ identifier: 'CLA-146', state: { name: 'Canceled', type: 'canceled' }, completedAt: iso(1) }),
]
const issuesBody = JSON.stringify({ data: { issues: { nodes: NODES } } })
const cycleBody = JSON.stringify({ data: { cycle: { number: 12, name: 'Sprint', progress: 0.4, startsAt: CYCLE.startsAt, endsAt: CYCLE.endsAt, scopeHistory: [5, 5, 6, 6, 7], completedScopeHistory: [0, 1, 1, 2, 3] } } })

describe('parsing', () => {
  test('tickets: buckets, canceled dropped, cycle read', () => {
    const list = parseTickets(issuesBody)
    expect(list.map(t => t.identifier)).toEqual(['CLA-149', 'CLA-150', 'CLA-151', 'CLA-143', 'CLA-144', 'CLA-145'])
    expect(list.map(t => t.bucket)).toEqual(['started', 'todo', 'backlog', 'done', 'done', 'done'])
    expect(list[0]!.cycle).toEqual(expect.objectContaining({ id: 'cyc-1', number: 12 }))
    expect(count(list)).toEqual({ started: 1, todo: 1, backlog: 1, done: 3 })
    expect(summaryText(count(list), 14)).toBe('linear: 1 in progress · 1 todo · 3 done (14d)')
  })

  test('a GraphQL error is surfaced, not swallowed', () => {
    expect(() => graphqlData('{"errors":[{"message":"Authentication required"}]}')).toThrow('Authentication required')
    expect(() => graphqlData('{}')).toThrow('without data')
    expect(parseTickets('{"data":{"issues":{"nodes":[{"x":1},null]}}}')).toEqual([])
  })

  test('the cycle series', () => {
    const c = parseCycle(cycleBody)!
    expect(c.scope).toEqual([5, 5, 6, 6, 7])
    expect(c.completed).toEqual([0, 1, 1, 2, 3])
    expect(Math.round(cycleElapsed(c, NOW) * 100)).toBe(40)
    expect(parseCycle('{"data":{"cycle":null}}')).toBeUndefined()
  })

  test('the cycle running now is the one most tickets sit in', () => {
    expect(currentCycleId(parseTickets(issuesBody), NOW)).toBe('cyc-1')
    expect(currentCycleId(parseTickets(issuesBody), NOW + 30 * 86_400_000)).toBeUndefined()
  })
})

describe('filter', () => {
  test('mine, a team and a project, open or recently closed', () => {
    const f = buildFilter({ assignee: 'me', teamKey: 'CLA', project: 'Ads' }, '2026-09-17T00:00:00Z')
    expect(f).toEqual({
      and: [
        { assignee: { isMe: { eq: true } } },
        { team: { key: { eq: 'CLA' } } },
        { project: { name: { containsIgnoreCase: 'Ads' } } },
        { or: [{ state: { type: { nin: ['completed', 'canceled'] } } }, { completedAt: { gte: '2026-09-17T00:00:00Z' } }] },
      ],
    })
    expect((buildFilter({ assignee: 'anyone', teamKey: '', project: '' }, 'x').and as unknown[]).length).toBe(1)
  })
})

describe('charts', () => {
  test('closed per day, today last', () => {
    const list = parseTickets(issuesBody)
    expect(doneByDay(list, NOW, 5, 0)).toEqual([0, 0, 1, 0, 2])
    // a viewer 3 hours behind UTC still sees the 09:00 and 10:00 UTC closes on the same day
    expect(doneByDay(list, NOW, 3, 180).reduce((a, b) => a + b, 0)).toBe(3)
    expect(dayOf(NOW, 0)).toBe(Math.floor(NOW / 86_400_000))
    expect(doneByDay(list, NOW, 5)).toEqual([0, 0, 1, 0, 2])
  })

  test('each completion uses the offset in force at its own time', () => {
    // 23:30 local the evening before a daylight-saving change: UTC-5 before it, UTC-4 after
    const change = Date.UTC(2026, 2, 8, 7)
    const tz = (ms: number) => (ms < change ? 300 : 240)
    const before = Date.UTC(2026, 2, 8, 4, 30) // 23:30 on Mar 7 at UTC-5
    const after = Date.UTC(2026, 2, 8, 12) // 08:00 on Mar 8 at UTC-4
    expect(dayOf(after, tz) - dayOf(before, tz)).toBe(1)
    // with today's offset applied to both, the earlier close slides into Mar 8
    expect(dayOf(after, 240) - dayOf(before, 240)).toBe(0)
  })

  test('sparkline and bar chart scale to the biggest value', () => {
    expect(spark([0, 1, 4, 8])).toBe(' ▁▄█')
    expect(spark([0, 0])).toBe('  ')
    const rows = barChart([0, 4, 8], 2)
    expect(rows.length).toBe(2)
    expect(rows[0]![2]).toBe('█')
    expect(rows[1]![2]).toBe('█')
    expect(rows[0]![0]).toBe(' ')
    expect(rows[1]![0]).toBe('▁')
    expect(rows[0]![1]).toBe(' ')
    expect(rows[1]![1]).toBe('█')
    expect(barChart([0, 0], 2)).toEqual(['  ', '▁▁'])
  })

  test('the stacked bar fills its width and never hides a state that has tickets', () => {
    const parts = stacked([{ n: 1, glyph: 'a' }, { n: 100, glyph: 'b' }, { n: 0, glyph: 'c' }], 20)
    expect(parts.reduce((s, p) => s + p.cells, 0)).toBe(20)
    expect(parts.map(p => p.glyph)).toEqual(['a', 'b'])
    expect(stacked([{ n: 0, glyph: 'a' }], 10)).toEqual([])
  })

  test('urgent first, none last, done by recency', () => {
    const sorted = sortTickets(parseTickets(issuesBody)).map(t => t.identifier)
    expect(sorted.indexOf('CLA-149')).toBeLessThan(sorted.indexOf('CLA-150'))
    expect(sorted.indexOf('CLA-143')).toBeGreaterThan(-1)
  })
})

type Call = { url: string; auth?: string; body?: { query: string; variables: Record<string, unknown> } }
type World = { calls: Call[]; copied: string[]; toasts: string[]; status: number; body: string }
const world = (): World => ({ calls: [], copied: [], toasts: [], status: 200, body: issuesBody })

function fakeEngine(on: On, w: World) {
  on('session.start', async ($, e) => ({ cwd: e.cwd }) as never)
  on('session.end', async () => ({ sessionId: 's1' }) as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('clock.every', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: undefined }) as never)
  on('ui.close', () => ({ value: undefined }) as never)
  on('ui.invalidate', () => ({ value: undefined }) as never)
  on('ui.log', () => ({ value: undefined }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', ($, e) => {
    w.toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.copy', ($, e) => {
    w.copied.push(e.text)
    return { value: { isCopied: true } } as never
  })
  on('http.fetch', async ($, e) => {
    const init = e.init ?? {}
    const body = init.body ? JSON.parse(init.body) : undefined
    w.calls.push({ url: e.url, auth: init.headers?.authorization, body })
    const reply = (status: number, text: string) => ({ value: { status, ok: status < 300, headers: {}, text } })
    if (w.status !== 200) return reply(w.status, '{}')
    return reply(200, body?.query.includes('cycle(id') ? cycleBody : w.body)
  })
}

const OPTIONS = { linearApiKey: KEY }
const run = async ($: Engine, args = '') => (await $.command.run({ command: 'linear', args, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 200 } } as never)) as { text?: string }
const PANE_PROPS = { title: 'linear', isFocused: true, bodyColumns: 60, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 40 }, view: {} }
const mount = ($: Engine) => $.ui.mount({ plugin: 'linear-tickets', surface: 'terminal', component: 'Pane', requestId: 'linear', props: PANE_PROPS })
const start = ($: Engine) => $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true } as never)

describe('the pane', () => {
  test('/linear reads with the key as given, the filter and the cycle, and draws the groups and the chart', { options: OPTIONS }, async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await start($)
    expect((await run($)).text).toContain('1 in progress · 1 todo · 3 done')

    const first = w.calls[0]!
    expect(first.url).toBe('https://api.linear.app/graphql')
    expect(first.auth).toBe(KEY)
    expect(JSON.stringify(first.body!.variables.filter)).toContain('"isMe":{"eq":true}')
    expect(w.calls.some(c => c.body?.query.includes('cycle(id') && c.body.variables.id === 'cyc-1')).toBe(true)

    const ui = await mount($)
    expect((await ui.find({ key: 't:0' }))?.text).toContain('CLA-149')
    expect(await ui.find({ type: 'Text', text: /In progress \(1\)/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /closed per day/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /cycle 12 Sprint/ })).toBeDefined()
    await ui.unmount()
  })

  test('an OAuth token goes as Bearer', { options: { linearApiKey: 'lin_oauth_abc' } }, async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await start($)
    await run($)
    expect(w.calls[0]!.auth).toBe('Bearer lin_oauth_abc')
  })

  test('a row opens the detail and copies the url; the backlog folds open', { options: OPTIONS }, async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await start($)
    await run($)
    const ui = await mount($)
    await ui.press({ key: 't:0' })
    await ui.redraw()
    expect(await ui.find({ type: 'Text', text: /In Progress · High/ })).toBeDefined()
    await ui.press({ key: 'copy' })
    expect(w.copied).toEqual(['https://linear.app/acme/issue/CLA-149'])
    expect(await ui.find({ text: /CLA-151/ })).toBeUndefined()
    await ui.press({ key: 'backlog' })
    await ui.redraw()
    expect(await ui.find({ key: 't:2' })).toBeDefined()
    await ui.unmount()
  })

  test('a refused key is reported, never echoed', { options: OPTIONS }, async ($, on) => {
    const w = world()
    w.status = 401
    fakeEngine(on, w)
    await start($)
    const out = await run($)
    expect(out.text).toContain('refused the key')
    expect(out.text).not.toContain(KEY)
  })

  test('a GraphQL error comes back as the message', { options: OPTIONS }, async ($, on) => {
    const w = world()
    w.body = '{"errors":[{"message":"Argument Validation Error"}]}'
    fakeEngine(on, w)
    await start($)
    expect((await run($)).text).toContain('Argument Validation Error')
  })

  test('without a key nothing is called', async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await start($)
    expect((await run($)).text).toContain('linearApiKey')
    expect(w.calls).toEqual([])
  })

  test('team, project and anyone reach the filter', { options: { ...OPTIONS, assignee: 'anyone', teamKey: 'CLA', project: 'Ads' } }, async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await start($)
    await run($)
    const filter = JSON.stringify(w.calls[0]!.body!.variables.filter)
    expect(filter).not.toContain('isMe')
    expect(filter).toContain('"key":{"eq":"CLA"}')
    expect(filter).toContain('"containsIgnoreCase":"Ads"')
  })
})
