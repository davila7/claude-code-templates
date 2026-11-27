import { test, expect, mock } from 'claude-code/testing'
import { BADGES, EMPTY, earned, onTurn, readGot, readStats, shelf } from '../hooks/badges'

test('turns count per day and in a row; a gap starts the streak over', () => {
  let s = onTurn(EMPTY, '2026-11-13', 10)
  s = onTurn(s, '2026-11-13', 11)
  expect([s.dayTurns, s.streak]).toEqual([2, 1])
  s = onTurn(s, '2026-11-14', 2) // the next day, at 2 a.m.
  expect([s.dayTurns, s.bestDayTurns, s.streak, s.lateTurns]).toEqual([1, 2, 2, 1])
  s = onTurn(s, '2026-11-17', 9)
  expect([s.streak, s.bestStreak]).toEqual([1, 2])
  expect(onTurn(onTurn(EMPTY, '2026-12-31', 9), '2027-01-01', 9).streak).toBe(2) // across a year
})

test('what the store held is read safely', () => {
  expect(readStats(undefined)).toEqual(EMPTY)
  expect(readStats({ pets: 3, feeds: 'lots', notes: -1, day: 7, extra: 1 })).toEqual({ ...EMPTY, pets: 3 })
  expect(readGot({ hello: '2026-11-14', nope: '2026-11-14', scribe: 3 })).toEqual({ hello: '2026-11-14' })
})

test('a badge is earned once, at its goal', () => {
  const s = { ...EMPTY, hellos: 1, pets: 99 }
  expect(earned(s, {}).map(b => b.id)).toEqual(['hello'])
  expect(earned({ ...s, pets: 100 }, { hello: 'x' }).map(b => b.id)).toEqual(['petLover'])
  expect(earned({ ...s, pets: 100 }, { hello: 'x', petLover: 'x' })).toEqual([])
})

test('the shelf shows what is earned and the closest one to go, in either language', () => {
  const s = { ...EMPTY, hellos: 1, notes: 15 }
  expect(shelf(s, { hello: 'x' }, 'en')).toBe(`★ 1/${BADGES.length}: Hello there · Next: Scribe, write 20 notes (15/20)`)
  expect(shelf(EMPTY, {}, 'zh')).toContain(`★ 0/${BADGES.length}: 還沒有`)
})

const BAND = { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 60 } as any
const shown = async (ui: any) => (await ui.findAll({ type: 'Text' })).map((t: any) => t.text).join('\n')

/** A session with an empty store and no notebook; returns the clock, the band, the toasts and the store. */
const start = async ($: any, on: any, stored: Record<string, unknown> = {}) => {
  const toasts: string[] = []
  const clock = mock.clock(on, { now: new Date(2026, 10, 14, 10, 0).getTime() })
  mock.env(on, { HOME: '/home/me' })
  on('session.start', ($: any, e: any) => ({ cwd: e.cwd }))
  on('command.register', ($: any, e: any) => ({ value: { command: e.name } }))
  on('store.get', ($: any, e: any) => ({ value: stored[e.key] }))
  on('store.set', ($: any, e: any) => ((stored[e.key] = e.value), { value: undefined }))
  on('fs.exists', () => ({ value: false }))
  on('ui.toast', ($: any, e: any) => (toasts.push(e.text), { value: undefined }))
  on('turn.start', () => ({ turnId: 't1' }))
  on('turn.complete', () => ({ text: '' }))
  on('ui.render', { component: 'AbovePrompt' }, ($: any, e: any) => {
    const { Text } = $.ui.resolve(e)
    return <Text>below</Text>
  })
  await $.session.start({ cwd: '/tmp', surface: 'terminal' } as any)
  const ui = await $.ui.mount({ plugin: 'clawd-actor', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  return { clock, ui, toasts, stored }
}

test('the first /clawd earns a badge, with a toast and a cheer, and only once', async ($, on) => {
  const { clock, ui, toasts, stored } = await start($, on)
  await $.command.run({ command: 'clawd', args: 'wave' } as any)
  await clock.advance(10)
  expect(toasts).toEqual(['Clawd: Badge unlocked: ★ Hello there'])
  await ui.redraw(BAND)
  expect(await shown(ui)).toContain('Badge unlocked')
  expect(Object.keys(stored.badges as object)).toEqual(['hello'])
  await $.command.run({ command: 'clawd', args: 'wave' } as any)
  await clock.advance(10)
  expect(toasts.length).toBe(1)
})

test('the hundredth pet earns Best friends', async ($, on) => {
  const { clock, toasts } = await start($, on, { stats: { ...EMPTY, hellos: 99, pets: 99 }, badges: { hello: 'x' } })
  await $.command.run({ command: 'clawd', args: 'pet' } as any)
  await clock.advance(10)
  expect(toasts).toEqual(['Clawd: Badge unlocked: ★ Best friends'])
})

test("a turn's length and day are counted", { timeoutMs: 30_000 }, async ($, on) => {
  // a minute only: every frame of a ten-minute turn would run under the mock clock
  const { clock, stored } = await start($, on, { badges: { hello: 'x' } })
  await $.turn.start({ text: 'big job', turnId: 't1' } as any)
  await clock.advance(61_000)
  await $.turn.complete({ reason: 'answered', turnId: 't1' } as any)
  await clock.advance(10)
  expect(stored.stats).toMatchObject({ longestTurnMin: 1, day: '2026-11-14', dayTurns: 1, streak: 1 })
  expect(earned({ ...EMPTY, longestTurnMin: 10 }, {}).map(b => b.id)).toEqual(['marathon'])
})

test('/clawd badges shows the shelf', async ($, on) => {
  const { clock, ui } = await start($, on, { stats: { ...EMPTY, hellos: 4, notes: 3 }, badges: { hello: 'x' } })
  await $.command.run({ command: 'clawd', args: 'badges' } as any)
  await clock.advance(10)
  await ui.redraw(BAND)
  expect(await shown(ui)).toContain(`★ 1/${BADGES.length}`)
})

test("a subagent's turn is not counted", async ($, on) => {
  const { clock, stored } = await start($, on, { badges: { hello: 'x' } })
  await $.turn.start({ text: 'job', turnId: 'a1', agentId: 'agent-1' } as any)
  await clock.advance(10)
  expect(stored.stats).toBeUndefined()
})

test('earning Marathon shows the runner off: Clawd runs in its bib', async ($, on) => {
  const { clock, ui, toasts } = await start($, on, { stats: { ...EMPTY, hellos: 1, longestTurnMin: 10 }, badges: { hello: 'x' } })
  await $.command.run({ command: 'clawd', args: 'wave' } as any) // any count looks the badges over
  await clock.advance(10)
  expect(toasts).toEqual(['Clawd: Badge unlocked: ★ Marathon'])
  await ui.redraw(BAND)
  expect(await shown(ui)).toContain('42')
})

test('a badge earned in an earlier session dresses Clawd from the start', async ($, on) => {
  // no count earns it now: the bib can only come from the badge stored before
  const { clock, ui } = await start($, on, { stats: { ...EMPTY, hellos: 1 }, badges: { hello: 'x', marathon: 'x' } })
  await clock.advance(10) // the perks load on a timer
  await $.ui.mount({ plugin: 'clawd-actor', surface: 'terminal', component: 'Spinner', props: { message: 'Scampering', mode: 'requesting' } as any })
  await $.turn.start({ text: 'go', turnId: 't1' } as any)
  await clock.advance(300)
  await ui.redraw({ ...BAND, isWorking: true })
  expect(await shown(ui)).toContain('42')
})
