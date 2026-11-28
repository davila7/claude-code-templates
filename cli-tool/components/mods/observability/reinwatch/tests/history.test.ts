import type { On } from 'claude-code'
import { expect, test, type Engine } from 'claude-code/testing'
import { addTurn, dayOf, HISTORY_KEY, localTime, parseDays, totals } from '../hooks/history'
import type { Summary, TurnSummary } from '../types'
import { end, mountPane, readState, readStore, seedStore, spawn, standIns, start, step, tool, turn } from './helpers'

const now = Date.UTC(2026, 10, 3, 12)
const DAY = 86_400_000
const SEC = 1000
// The day a clock reading falls on for the person, so no test depends on the machine's time zone.
const localDay = (t: number): string => dayOf(localTime(t))
const s: TurnSummary = { agents: 2, newAgents: 2, tokens: 1500, activeMs: 4000, longest: { id: 'a', activeMs: 3000 }, rows: [] }
const usage = { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'm1' }

test('a turn adds to today', () => {
  expect(HISTORY_KEY).toBe('days-v2')
  expect(dayOf(now)).toBe('2026-11-03')
  const once = addTurn([], s, now)
  expect(once).toEqual([{ day: '2026-11-03', agents: 2, tokens: 1500, activeMs: 4000, maxTokens: 0, maxActiveMs: 0 }])
  expect(addTurn(once, s, now)).toEqual([{ day: '2026-11-03', agents: 4, tokens: 3000, activeMs: 8000, maxTokens: 0, maxActiveMs: 0 }])
})

test('days older than 30 days are dropped', () => {
  const old = { day: '2026-10-03', agents: 1, tokens: 1, activeMs: 1, maxTokens: 0, maxActiveMs: 0 }
  const kept = { day: '2026-10-06', agents: 1, tokens: 1, activeMs: 1, maxTokens: 0, maxActiveMs: 0 }
  const out = addTurn([old, kept], s, now)
  expect(out.map(d => d.day)).toEqual(['2026-10-06', '2026-11-03'])
  expect(Object.keys(out[0]!).sort()).toEqual(['activeMs', 'agents', 'day', 'maxActiveMs', 'maxTokens', 'tokens'])
  expect(totals([old, kept], now)).toEqual({ agents: 1, tokens: 1, activeMs: 1, maxTokens: 0, maxActiveMs: 0 })
  expect(now - 29 * DAY).toBe(Date.UTC(2026, 9, 5, 12))
})

test('garbage in the store reads as empty', () => {
  for (const raw of [null, 'x', [{ day: 'bad', agents: 1, tokens: 1, activeMs: 1 }], [{ day: '2026-11-01', agents: '3', tokens: 1, activeMs: 1 }]])
    expect(parseDays(raw)).toEqual([])
  expect(parseDays([{ day: '2026-11-01', agents: -1, tokens: 1, activeMs: 1 }, { day: '2026-11-02', agents: 1, tokens: 1, activeMs: 1 }]).length).toBe(1)
})

test('totals add up the kept days', () => {
  const days = [{ day: '2026-11-01', agents: 1, tokens: 10, activeMs: 100, maxTokens: 0, maxActiveMs: 0 }, { day: '2026-11-02', agents: 2, tokens: 20, activeMs: 200, maxTokens: 0, maxActiveMs: 0 }]
  expect(totals(days, now)).toEqual({ agents: 3, tokens: 30, activeMs: 300, maxTokens: 0, maxActiveMs: 0 })
})

test('a main turn that ran agents leaves a summary and stores numbers only', { timeoutMs: 30_000 }, async ($, on) => {
  const { clock, setUsage } = standIns(on, [], { now: Date.UTC(2026, 10, 5, 12) })
  await start($)
  await turn($, undefined, 'start')
  await spawn($, 'a1', { description: 'Secret project Zephyr' })
  setUsage(usage)
  await turn($, 'a1', 'start')
  await step($, 'a1')
  const run = tool($, 'a1', 'sleep 2000')
  await clock.advance(2 * SEC)
  await run
  await turn($, 'a1', 'end')
  await turn($, undefined, 'end')
  const summary = await readState($, 'summary') as { text: string; at: number }
  expect(summary.text.startsWith('1 agent · ')).toBe(true)
  expect(summary.text).toContain('"Secret project Zephyr"')
  const stored = await readStore($, 'days-v2') as Record<string, unknown>[]
  expect(JSON.stringify(stored)).not.toContain('Zephyr')
  expect(stored.length).toBe(1)
  for (const d of stored) expect(Object.keys(d).sort()).toEqual(['activeMs', 'agents', 'day', 'maxActiveMs', 'maxTokens', 'tokens'])
  expect(stored[0]).toEqual({ day: localDay(Date.UTC(2026, 10, 5, 12)), agents: 1, tokens: 1200, activeMs: 2000, maxTokens: 1200, maxActiveMs: 2000 })
  expect(await readState($, 'history')).toEqual({ agents: 1, tokens: 1200, activeMs: 2000, maxTokens: 1200, maxActiveMs: 2000 })
})

test('the stored day holds new tokens, not cache reads', async ($, on) => {
  const { setUsage } = standIns(on, [], { now: Date.UTC(2026, 10, 5, 12) })
  await start($)
  await turn($, undefined, 'start')
  await spawn($, 'a1')
  setUsage({ ...usage, cache_read_input_tokens: 500_000, cache_creation_input_tokens: 30 })
  await turn($, 'a1', 'start')
  await step($, 'a1')
  await turn($, 'a1', 'end')
  await turn($, undefined, 'end')
  expect(await readStore($, 'days-v2')).toEqual([{ day: localDay(Date.UTC(2026, 10, 5, 12)), agents: 1, tokens: 1230, activeMs: 0, maxTokens: 1230, maxActiveMs: 0 }])
})

test('no summary when no agent ran', async ($, on) => {
  standIns(on)
  await start($)
  await turn($, undefined, 'start')
  await turn($, undefined, 'end')
  expect(await readState($, 'summary')).toBeNull()
  expect(await readStore($, 'days-v2')).toBeUndefined()
})

test('the stored days become the totals when the session starts', async ($, on) => {
  standIns(on)
  seedStore('days-v2', [{ day: localDay(0), agents: 3, tokens: 4500, activeMs: 6000 }])
  await start($)
  expect(await readState($, 'history')).toEqual({ agents: 3, tokens: 4500, activeMs: 6000, maxTokens: 0, maxActiveMs: 0 })
})

test('work done between main turns is counted once: in the next summary and in the store', async ($, on) => {
  const { clock, setUsage } = standIns(on)
  await start($)
  await turn($, undefined, 'start')
  await turn($, undefined, 'end')
  // A background agent works while the main conversation is idle.
  await clock.advance(SEC)
  await spawn($, 'bg', { description: 'Background job' })
  setUsage(usage)
  await turn($, 'bg', 'start')
  await step($, 'bg')
  await turn($, 'bg', 'end')
  await clock.advance(SEC)
  await turn($, undefined, 'start')
  await turn($, undefined, 'end')
  const summary = await readState($, 'summary') as Summary | null
  expect(summary?.text).toBe('1 agent · 1.2k tok · 0s active combined · longest: "Background job" 0s active')
  const once = [{ day: localDay(0), agents: 1, tokens: 1200, activeMs: 0, maxTokens: 1200, maxActiveMs: 0 }]
  expect(await readStore($, 'days-v2')).toEqual(once)
  await clock.advance(SEC)
  await turn($, undefined, 'start')
  await turn($, undefined, 'end')
  expect(await readState($, 'summary')).toBeNull()
  expect(await readStore($, 'days-v2')).toEqual(once)
})

test('Stop and Allow resume alone add nothing to the next summary', async ($, on) => {
  const { clock, setUsage } = standIns(on)
  await start($)
  await turn($, undefined, 'start')
  await spawn($, 'a1')
  setUsage(usage)
  await turn($, 'a1', 'start')
  await step($, 'a1')
  await turn($, undefined, 'end')
  expect((await readState($, 'summary') as Summary | null)?.text).toStartWith('1 agent · 1.2k tok')
  await clock.advance(SEC)
  await turn($, undefined, 'start')
  await clock.advance(SEC)
  const ui = await mountPane($, 'terminal')
  await ui.press({ key: 'a1/stop' })
  await ui.press({ key: 'a1/confirm' })
  await ui.press({ key: 'a1/resume' })
  await ui.unmount()
  await turn($, undefined, 'end')
  expect(await readState($, 'summary')).toBeNull()
  expect(await readStore($, 'days-v2')).toEqual([{ day: localDay(0), agents: 1, tokens: 1200, activeMs: 0, maxTokens: 1200, maxActiveMs: 0 }])
})

test('rows read back after a reload are not reported again; their new work is', async ($, on) => {
  const { setUsage } = standIns(on)
  const stored = {
    id: 'old', description: 'Old job', type: '', model: '', isTeammate: false, status: 'done', isStopped: false, inTurn: false,
    firstSeenAt: 0, lastActiveAt: 5000, activeMs: 3000, busySince: null, busy: 0, openTools: 0,
    tokens: { input: 5000, cacheWrite: 0, cacheRead: 0, output: 0 }, turns: 1, failStreak: 0,
  }
  // Only the read-back gets the stored rows; the mod's later writes read the real value, so they go through.
  let isReadBack = true
  on('state.get', (_, e, next) => {
    if (e.key !== 'agents' || !isReadBack) return next(e)
    isReadBack = false
    return { value: { value: { shape: 'agents-1', value: { old: stored } }, version: 0 } }
  })
  await start($)
  await turn($, undefined, 'start')
  await turn($, undefined, 'end')
  expect(await readState($, 'summary')).toBeNull()
  expect(await readStore($, 'days-v2')).toBeUndefined()
  setUsage({ ...usage, input_tokens: 100, output_tokens: 0 })
  await turn($, undefined, 'start')
  await turn($, 'old', 'start')
  await step($, 'old')
  await turn($, 'old', 'end')
  await turn($, undefined, 'end')
  expect((await readState($, 'summary') as Summary | null)?.text).toStartWith('1 agent · 100 tok')
  expect(await readStore($, 'days-v2')).toEqual([{ day: localDay(0), agents: 0, tokens: 100, activeMs: 0, maxTokens: 5100, maxActiveMs: 3000 }])
})

test('a row read back with cache reads is reported by its new tokens, so later work still counts', async ($, on) => {
  const { setUsage } = standIns(on)
  const stored = {
    id: 'old', description: 'Old job', type: '', model: '', isTeammate: false, status: 'done', isStopped: false, inTurn: false,
    firstSeenAt: 0, lastActiveAt: 5000, activeMs: 3000, busySince: null, busy: 0, openTools: 0,
    tokens: { input: 5000, cacheWrite: 0, cacheRead: 90_000, output: 0 }, turns: 1, failStreak: 0,
  }
  let isReadBack = true
  on('state.get', (_, e, next) => {
    if (e.key !== 'agents' || !isReadBack) return next(e)
    isReadBack = false
    return { value: { value: { shape: 'agents-1', value: { old: stored } }, version: 0 } }
  })
  await start($)
  setUsage({ ...usage, input_tokens: 100, output_tokens: 0 })
  await turn($, undefined, 'start')
  await turn($, 'old', 'start')
  await step($, 'old')
  await turn($, 'old', 'end')
  await turn($, undefined, 'end')
  expect((await readState($, 'summary') as Summary | null)?.text).toStartWith('1 agent · 100 tok')
  expect(await readStore($, 'days-v2')).toEqual([{ day: localDay(0), agents: 0, tokens: 100, activeMs: 0, maxTokens: 5100, maxActiveMs: 3000 }])
})

test('the session end stores what no summary reported, and leaves the band alone', async ($, on) => {
  const { setUsage } = standIns(on)
  await start($)
  await spawn($, 'bg')
  setUsage(usage)
  await turn($, 'bg', 'start')
  await step($, 'bg')
  await turn($, 'bg', 'end')
  await end($)
  expect(await readStore($, 'days-v2')).toEqual([{ day: localDay(0), agents: 1, tokens: 1200, activeMs: 0, maxTokens: 1200, maxActiveMs: 0 }])
  expect(await readState($, 'summary')).toBeUndefined()
  // After a /clear the process goes on: what the end stored is not reported again.
  await turn($, undefined, 'start')
  await turn($, undefined, 'end')
  expect(await readState($, 'summary')).toBeNull()
  expect(await readStore($, 'days-v2')).toEqual([{ day: localDay(0), agents: 1, tokens: 1200, activeMs: 0, maxTokens: 1200, maxActiveMs: 0 }])
})

test('parseDays merges entries of the same day by summing', () => {
  expect(parseDays([{ day: '2026-11-01', agents: 1, tokens: 10, activeMs: 100, maxTokens: 4, maxActiveMs: 90 }, { day: '2026-11-02', agents: 5, tokens: 5, activeMs: 5 },
    { day: '2026-11-01', agents: 2, tokens: 20, activeMs: 200, maxTokens: 6, maxActiveMs: 50 }]))
    .toEqual([{ day: '2026-11-01', agents: 3, tokens: 30, activeMs: 300, maxTokens: 6, maxActiveMs: 90 }, { day: '2026-11-02', agents: 5, tokens: 5, activeMs: 5, maxTokens: 0, maxActiveMs: 0 }])
})

test('days dated after today are kept by addTurn and ignored by totals', () => {
  const future = { day: '2026-11-09', agents: 9, tokens: 9, activeMs: 9, maxTokens: 0, maxActiveMs: 0 }
  const past = { day: '2026-11-01', agents: 1, tokens: 1, activeMs: 1, maxTokens: 0, maxActiveMs: 0 }
  expect(addTurn([past, future], s, now).map(d => d.day)).toEqual(['2026-11-01', '2026-11-03', '2026-11-09'])
  expect(totals([past, future], now)).toEqual({ agents: 1, tokens: 1, activeMs: 1, maxTokens: 0, maxActiveMs: 0 })
})

test('localTime moves a clock reading by the zone offset, so a day is the local day', () => {
  const late = Date.UTC(2026, 10, 9, 23, 30)
  expect(dayOf(localTime(late, -540))).toBe('2026-11-10')
  expect(dayOf(localTime(late, 0))).toBe('2026-11-09')
  expect(localTime(late, 60)).toBe(late - 60 * 60_000)
  expect(localTime(late)).toBe(late - new Date(late).getTimezoneOffset() * 60_000)
})

test('the day stored, and the 30 days summed, are the local ones', async ($, on) => {
  // A moment whose local day differs from its UTC day in this zone, east or west of UTC.
  const late = new Date().getTimezoneOffset() > 0 ? Date.UTC(2026, 10, 10, 0, 30) : Date.UTC(2026, 10, 9, 23, 30)
  const { setUsage } = standIns(on, [], { now: late })
  seedStore('days-v2', [{ day: dayOf(localTime(late - 3 * DAY)), agents: 1, tokens: 10, activeMs: 100 }])
  await start($)
  expect(await readState($, 'history')).toEqual({ agents: 1, tokens: 10, activeMs: 100, maxTokens: 0, maxActiveMs: 0 })
  await turn($, undefined, 'start')
  await spawn($, 'a1')
  setUsage(usage)
  await turn($, 'a1', 'start')
  await step($, 'a1')
  await turn($, 'a1', 'end')
  await turn($, undefined, 'end')
  const days = await readStore($, 'days-v2') as { day: string }[]
  expect(days.at(-1)?.day).toBe(dayOf(localTime(late)))
  expect(await readState($, 'history')).toEqual({ agents: 2, tokens: 1210, activeMs: 100, maxTokens: 1200, maxActiveMs: 0 })
  // The session end stores the same day.
  await spawn($, 'bg')
  await turn($, 'bg', 'start')
  await step($, 'bg')
  await turn($, 'bg', 'end')
  await end($)
  expect(((await readStore($, 'days-v2')) as { day: string }[]).map(d => d.day)).toEqual([dayOf(localTime(late - 3 * DAY)), dayOf(localTime(late))])
})

test('an entry stored without the peak fields parses with 0s', () => {
  expect(parseDays([{ day: '2026-11-01', agents: 1, tokens: 10, activeMs: 100 }])).toEqual([{ day: '2026-11-01', agents: 1, tokens: 10, activeMs: 100, maxTokens: 0, maxActiveMs: 0 }])
  expect(parseDays([{ day: '2026-11-01', agents: 1, tokens: 10, activeMs: 100, maxTokens: 'x', maxActiveMs: -5 }])[0]).toMatchObject({ maxTokens: 0, maxActiveMs: 0 })
})

test('addTurn keeps the day maximum of one agent across turns', () => {
  const rows = (tokens: number, activeMs: number): TurnSummary => ({ ...s, rows: [{ id: 'a', tokens, activeMs, totalTokens: tokens, totalActiveMs: activeMs }, { id: 'b', tokens: tokens / 2, activeMs: activeMs * 2, totalTokens: tokens / 2, totalActiveMs: activeMs * 2 }] })
  const first = addTurn([], rows(900, 100), now)
  expect(first[0]).toMatchObject({ maxTokens: 900, maxActiveMs: 200 })
  const second = addTurn(first, rows(400, 50), now)
  expect(second[0]).toMatchObject({ maxTokens: 900, maxActiveMs: 200 })
  const third = addTurn(second, rows(1200, 500), now)
  expect(third[0]).toMatchObject({ maxTokens: 1200, maxActiveMs: 1000 })
  expect(addTurn([], s, now)[0]).toMatchObject({ maxTokens: 0, maxActiveMs: 0 })
})

test('addTurn takes the peak from the whole totals of each agent, not the turn share', () => {
  const t: TurnSummary = { ...s, rows: [{ id: 'a', tokens: 20, activeMs: 2000, totalTokens: 30, totalActiveMs: 3000 }] }
  expect(addTurn([], t, now)[0]).toMatchObject({ maxTokens: 30, maxActiveMs: 3000 })
})

test('totals takes the maximum over the window and sums the rest', () => {
  const days = [
    { day: '2026-10-01', agents: 1, tokens: 1, activeMs: 1, maxTokens: 9999, maxActiveMs: 9999 },
    { day: '2026-11-01', agents: 1, tokens: 10, activeMs: 100, maxTokens: 7, maxActiveMs: 70 },
    { day: '2026-11-02', agents: 2, tokens: 20, activeMs: 200, maxTokens: 12, maxActiveMs: 30 },
    { day: '2026-11-09', agents: 1, tokens: 1, activeMs: 1, maxTokens: 8888, maxActiveMs: 8888 }
  ]
  expect(totals(days, now)).toEqual({ agents: 3, tokens: 30, activeMs: 300, maxTokens: 12, maxActiveMs: 70 })
})

// Stands in for $.session.usage(): each call answers the next 5-hour reading (null: no plan limits reported).
const limitReadings = (percents: (number | null)[]) => {
  let i = 0
  return () => {
    const p = percents[Math.min(i++, percents.length - 1)] ?? null
    const rateLimits = p === null ? [] : [{ kind: 'seven_day', percentUsed: 12 }, { kind: 'five_hour', percentUsed: p }]
    return { value: { startedAt: 0, context: { window: 200_000 }, rateLimits } }
  }
}

// One main turn in which an agent works, the 5-hour limit read as the given readings; the summary's text.
async function summaryWith($: Engine, on: On, readings: (number | null)[]): Promise<string | undefined> {
  const { setUsage } = standIns(on, [], { now: Date.UTC(2026, 10, 5, 12) })
  on('session.usage', limitReadings(readings))
  await start($)
  await turn($, undefined, 'start')
  await spawn($, 'a1', { description: 'Background job' })
  setUsage(usage)
  await turn($, 'a1', 'start')
  await step($, 'a1')
  await turn($, 'a1', 'end')
  await turn($, undefined, 'end')
  return (await readState($, 'summary') as Summary | null)?.text
}

test('the turn summary shows how far the 5-hour limit moved during the turn', async ($, on) => {
  expect(await summaryWith($, on, [34, 41.2])).toBe('1 agent · 1.2k tok · 0s active combined · longest: "Background job" 0s active · 5h limit 34% → 41% this turn')
})

test('no limit text off a subscription', async ($, on) => {
  expect(await summaryWith($, on, [null, null])).toBe('1 agent · 1.2k tok · 0s active combined · longest: "Background job" 0s active')
})

test('no limit text when the 5-hour window started over during the turn', async ($, on) => {
  expect(await summaryWith($, on, [90, 3])).toBe('1 agent · 1.2k tok · 0s active combined · longest: "Background job" 0s active')
})

test("on a session's first turn the 5-hour limit starts from the first reading Claude Code pushes", async ($, on) => {
  const { setUsage } = standIns(on, [], { now: Date.UTC(2026, 10, 5, 12) })
  // Before the session's first model response nothing is reported; the first response then brings the reading.
  on('session.usage', limitReadings([null, 41.2]))
  await start($)
  await turn($, undefined, 'start')
  await $.session.measure({ context: { window: 200_000 }, rateLimits: [{ kind: 'five_hour', percentUsed: 34 }], changed: ['rateLimits'] })
  await spawn($, 'a1', { description: 'Background job' })
  setUsage(usage)
  await turn($, 'a1', 'start')
  await step($, 'a1')
  await turn($, 'a1', 'end')
  await turn($, undefined, 'end')
  expect((await readState($, 'summary') as Summary | null)?.text)
    .toBe('1 agent · 1.2k tok · 0s active combined · longest: "Background job" 0s active · 5h limit 34% → 41% this turn')
})
