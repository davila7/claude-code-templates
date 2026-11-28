import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { Summary } from '../types'
import { buttonBoxes, columnBoxes, drawnTexts, mountBand, readAlerts, readState, spawn, standIns, start, tool, turn, step, type Mounted } from './helpers'

const SEC = 1000
const fakeKey = 'gh' + 'p_' + 'A'.repeat(36)
const info = (id: string) => ({ id, description: 'Fix tests', type: 'general-purpose', status: 'running' }) as never
const REPEAT = '! "Fix tests" made the same Bash call 2 times in a row'
const opts = { options: { repeatCount: 2 } }

const texts = async (ui: Mounted): Promise<string[]> => (await ui.findAll({ type: 'Text' })).map(t => t.text)
const keys = async (ui: Mounted): Promise<string[]> => (await ui.findAll({ type: 'Button' })).map(b => b.key ?? '')

// One agent that repeats the same Bash call, then a tick that raises the warning.
async function repeat($: Engine, clock: { advance(ms: number): Promise<void> }, id = 'a1', extra = {}) {
  await spawn($, id, extra)
  await turn($, id, 'start')
  await tool($, id, 'ls')
  await tool($, id, 'ls')
  await clock.advance(2 * SEC)
}

test('a warning shows in the band with its buttons', opts, async ($, on) => {
  const { clock } = standIns(on, [info('a1')])
  await start($)
  await repeat($, clock)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await mountBand($, surface)
    expect(await texts(ui)).toContain(REPEAT)
    const ks = await keys(ui)
    expect(ks).toContain('repeat:a1/stop')
    expect(ks).toContain('repeat:a1/dismiss')
    expect(ks).toContain('repeat:a1/ask')
    // View exists only in the terminal, the one surface with a main view a mod can switch.
    if (surface === 'terminal') expect(ks).toContain('repeat:a1/view')
    else expect(ks.filter(k => k.endsWith('/view'))).toEqual([])
    await ui.unmount()
  }
})

test('the rows that hold buttons have a gap and wrap', opts, async ($, on) => {
  const { clock, setUsage } = standIns(on, [info('a1')])
  await start($)
  await turn($, undefined, 'start')
  await repeat($, clock)
  setUsage({ input_tokens: 1500, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'm1' })
  await step($, 'a1')
  await turn($, undefined, 'end')
  await clock.advance(2 * SEC)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await mountBand($, surface)
    expect(await keys(ui)).toContain('summary/dismiss')
    const boxes = await buttonBoxes(ui)
    expect(boxes.length).toBeGreaterThanOrEqual(2)
    for (const box of boxes) {
      expect(box.props).toMatchObject({ gap: 'sm', flexWrap: 'wrap' })
      expect(box.props).not.toHaveProperty('columnGap')
    }
    const columns = await columnBoxes(ui)
    expect(columns.length).toBeGreaterThanOrEqual(2)
    for (const box of columns) expect(box.props).toMatchObject({ gap: 'sm' })
    await ui.unmount()
  }
})

test('Dismiss hides it and the status line drops the count', opts, async ($, on) => {
  const { clock, seen } = standIns(on, [info('a1')])
  await start($)
  await repeat($, clock)
  expect(seen.statuses.at(-1)).toContain('warning')
  const ui = await mountBand($, 'terminal')
  await ui.press({ key: 'repeat:a1/dismiss' })
  await ui.unmount()
  await clock.advance(2 * SEC)
  const again = await mountBand($, 'terminal')
  expect(await texts(again)).not.toContain(REPEAT)
  await again.unmount()
  expect(seen.statuses.at(-1) ?? '').not.toContain('warning')
})

test('Ask to stop is offered only while the agent is live: not once it finished or was stopped', opts, async ($, on) => {
  const { clock } = standIns(on, [info('a1'), info('a2')])
  await start($)
  await repeat($, clock, 'a1')
  await repeat($, clock, 'a2')
  // a1 ends its turn: a message could wake it again.
  await turn($, 'a1', 'end')
  await clock.advance(2 * SEC)
  let ui = await mountBand($, 'terminal')
  let ks = await keys(ui)
  expect(ks).toContain('repeat:a1/view')
  expect(ks).not.toContain('repeat:a1/ask')
  expect(ks).not.toContain('repeat:a1/stop')
  expect(ks).toContain('repeat:a2/ask')
  await ui.press({ key: 'repeat:a2/stop' })
  await ui.unmount()
  ui = await mountBand($, 'terminal')
  await ui.press({ key: 'repeat:a2/confirm' })
  await ui.unmount()
  ui = await mountBand($, 'terminal')
  ks = await keys(ui)
  expect(ks).toContain('repeat:a2/view')
  expect(ks).not.toContain('repeat:a2/ask')
  await ui.unmount()
})

test('Stop from the band asks first, then stops', opts, async ($, on) => {
  const { clock } = standIns(on, [info('a1')])
  await start($)
  await repeat($, clock)
  let ui = await mountBand($, 'terminal')
  await ui.press({ key: 'repeat:a1/stop' })
  await ui.unmount()
  ui = await mountBand($, 'terminal')
  expect(await texts(ui)).toContain('Stop "Fix tests"? Running tools finish first.')
  expect(await keys(ui)).toContain('repeat:a1/cancel')
  expect((await tool($, 'a1', 'ls')).deny).toBeUndefined()
  await ui.press({ key: 'repeat:a1/confirm' })
  expect((await tool($, 'a1', 'pwd')).deny).toBeDefined()
  await ui.unmount()
})

test('the band yields to a survey and draws nothing when quiet', opts, async ($, on) => {
  const { clock } = standIns(on, [info('a1')])
  await start($)
  let ui = await mountBand($, 'terminal')
  expect(await texts(ui)).toEqual([])
  await ui.unmount()
  await repeat($, clock)
  ui = await mountBand($, 'terminal', { hasSurvey: true })
  expect(await texts(ui)).toEqual([])
  expect(await keys(ui)).toEqual([])
})

test('the summary shows after a main turn and goes at the next one', async ($, on) => {
  const { clock, setUsage } = standIns(on, [info('a1')])
  await start($)
  await turn($, undefined, 'start')
  await spawn($, 'a1')
  await turn($, 'a1', 'start')
  // A summary needs some new tokens or time: an agent that did nothing is left out of it.
  setUsage({ input_tokens: 10, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'm1' })
  await step($, 'a1')
  await turn($, 'a1', 'end')
  await turn($, undefined, 'end')
  await clock.advance(2 * SEC)
  const summary = await readState($, 'summary') as Summary
  expect(summary.text.length).toBeGreaterThan(0)
  let ui = await mountBand($, 'terminal')
  expect(await texts(ui)).toContain(summary.text)
  expect(await keys(ui)).toContain('summary/dismiss')
  await ui.unmount()
  await turn($, undefined, 'start')
  ui = await mountBand($, 'terminal')
  expect(await texts(ui)).not.toContain(summary.text)
  await ui.unmount()
})

test("the summary's Details button lists each agent's share, longest first, with the label masked", async ($, on) => {
  const { clock, setUsage } = standIns(on, [info('a1'), info('a2')])
  await start($)
  await turn($, undefined, 'start')
  await spawn($, 'a1', { description: 'job a1' })
  await spawn($, 'a2', { description: 'deploy ' + fakeKey })
  await turn($, 'a1', 'start')
  await turn($, 'a2', 'start')
  setUsage({ input_tokens: 1000, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'm1' })
  await step($, 'a1')
  setUsage({ input_tokens: 500, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'm1' })
  await step($, 'a2')
  const r1 = tool($, 'a2', 'sleep 3000')
  await clock.advance(3 * SEC)
  await r1
  const r2 = tool($, 'a1', 'sleep 2000')
  await clock.advance(2 * SEC)
  await r2
  await turn($, 'a1', 'end')
  await turn($, 'a2', 'end')
  await turn($, undefined, 'end')
  await clock.advance(SEC)
  const ui = await mountBand($, 'terminal')
  expect(await keys(ui)).toContain('summary/details')
  expect(await keys(ui)).toContain('summary/dismiss')
  expect((await ui.find({ key: 'summary/details' }))?.text).toBe('Details')
  const lineOf = (all: string[]) => all.filter(t => / tok · .* active$/.test(t) && t.startsWith('"'))
  expect(lineOf(await texts(ui))).toEqual([])
  await ui.press({ key: 'summary/details' })
  expect(lineOf(await texts(ui))).toEqual(['"deploy [redacted]" · 500 tok · 3s active', '"job a1" · 1k tok · 2s active'])
  expect((await ui.find({ key: 'summary/details' }))?.text).toBe('Hide details')
  expect(JSON.stringify(await ui.drawn())).not.toContain(fakeKey)
  await ui.press({ key: 'summary/details' })
  expect(lineOf(await texts(ui))).toEqual([])
  await ui.unmount()
})

test('the summary Details lists at most three agents and counts the rest', async ($, on) => {
  const ids = ['a1', 'a2', 'a3', 'a4']
  const { clock, setUsage } = standIns(on, ids.map(id => info(id)))
  await start($)
  await turn($, undefined, 'start')
  for (const id of ids) {
    await spawn($, id, { description: 'job ' + id })
    await turn($, id, 'start')
  }
  for (const id of ids) {
    setUsage({ input_tokens: 100, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'm1' })
    await step($, id)
  }
  for (const id of ids) await turn($, id, 'end')
  await turn($, undefined, 'end')
  await clock.advance(SEC)
  const ui = await mountBand($, 'terminal')
  await ui.press({ key: 'summary/details' })
  const all = await texts(ui)
  expect(all.filter(t => / tok · .* active$/.test(t) && t.startsWith('"'))).toHaveLength(3)
  expect(all).toContain('+1 more in /reinwatch')

  await ui.unmount()
})

test('a new summary starts with its Details closed', async ($, on) => {
  const { clock, setUsage } = standIns(on, [info('a1')])
  await start($)
  await turn($, undefined, 'start')
  await spawn($, 'a1', { description: 'job a1' })
  await turn($, 'a1', 'start')
  setUsage({ input_tokens: 100, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'm1' })
  await step($, 'a1')
  await turn($, undefined, 'end')
  await clock.advance(SEC)
  const ui = await mountBand($, 'terminal')
  await ui.press({ key: 'summary/details' })
  expect((await ui.find({ key: 'summary/details' }))?.text).toBe('Hide details')
  await ui.unmount()
  await turn($, undefined, 'start')
  setUsage({ input_tokens: 200, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'm1' })
  await step($, 'a1')
  await turn($, undefined, 'end')
  await clock.advance(SEC)
  const again = await mountBand($, 'terminal')
  expect((await again.find({ key: 'summary/details' }))?.text).toBe('Details')
  await again.unmount()
})

test('each warning is notified once with the mod\'s title', opts, async ($, on) => {
  const { clock, seen } = standIns(on, [info('a1')])
  await start($)
  await repeat($, clock)
  await clock.advance(2 * SEC)
  await tool($, 'a1', 'ls')
  await clock.advance(2 * SEC)
  expect(seen.notices).toHaveLength(1)
  expect(seen.notices[0]?.title).toBe('reinwatch')
  expect(seen.notices[0]?.text).toBe(REPEAT.slice(2))
})

test('notify off sends nothing', { options: { repeatCount: 2, notify: false } }, async ($, on) => {
  const { clock, seen } = standIns(on, [info('a1')])
  await start($)
  await repeat($, clock)
  // Control: the warning was raised, so the empty notices are not just silence.
  expect((await readAlerts($)).map(a => a.key)).toContain('repeat:a1')
  expect(seen.notices).toEqual([])
})

test('the pane opens on a warning only when asked', { options: { repeatCount: 2, openPaneOnWarning: true } }, async ($, on) => {
  const { clock, seen } = standIns(on, [info('a1')])
  await start($)
  await repeat($, clock)
  expect(seen.opened).toContain('reinwatch')
})

test('the pane stays shut on a warning by default', opts, async ($, on) => {
  const { clock, seen } = standIns(on, [info('a1')])
  await start($)
  await repeat($, clock)
  // Control: the warning was raised and delivered, so the shut pane is the setting's doing.
  expect((await readAlerts($)).map(a => a.key)).toContain('repeat:a1')
  expect(seen.notices.map(n => n.text)).toEqual([REPEAT.slice(2)])
  expect(seen.opened).not.toContain('reinwatch')
})

test('the notification text carries no key-like strings', opts, async ($, on) => {
  const { clock, seen } = standIns(on, [info('a1')])
  await start($)
  await repeat($, clock, 'a1', { description: 'deploy ' + fakeKey })
  expect(seen.notices[0]?.text).toContain('[redacted]')
  expect(seen.notices[0]?.text).not.toContain(fakeKey)
})

test('the band shows the three newest warnings, newest first, and counts the rest', opts, async ($, on) => {
  const { clock } = standIns(on, [])
  await start($)
  for (const id of ['a1', 'a2', 'a3', 'a4']) await repeat($, clock, id, { description: `job ${id}` })
  const ui = await mountBand($, 'terminal')
  const warnings = (await texts(ui)).filter(t => t.startsWith('! '))
  expect(warnings).toEqual([
    '! "job a4" made the same Bash call 2 times in a row',
    '! "job a3" made the same Bash call 2 times in a row',
    '! "job a2" made the same Bash call 2 times in a row',
  ])
  expect(await texts(ui)).toContain('+1 more warnings in /reinwatch')
  expect(await keys(ui)).not.toContain('repeat:a1/dismiss')
})

test('a burst warning offers Open reinwatch and Dismiss only', { options: { burstCount: 2 } }, async ($, on) => {
  const { clock, seen } = standIns(on, [info('a1'), info('a2')])
  await start($)
  await spawn($, 'a1')
  await spawn($, 'a2')
  await clock.advance(2 * SEC)
  const ui = await mountBand($, 'terminal')
  const ks = await keys(ui)
  const key = ks.find(k => /^burst:\d+\/open$/.test(k))?.replace(/\/open$/, '')
  expect(key).toBeDefined()
  expect(ks).toContain(`${key}/dismiss`)
  for (const k of ks) expect(k).not.toMatch(/\/(view|ask|stop)$/)
  expect(seen.opened).not.toContain('reinwatch')
  await ui.press({ key: `${key}/open` })
  expect(seen.opened).toContain('reinwatch')
})

const savedRow = (id: string, extra: Record<string, unknown> = {}) => ({
  id, description: '', type: '', model: '', isTeammate: false, status: 'idle', isStopped: false, inTurn: false,
  firstSeenAt: 0, lastActiveAt: 0, activeMs: 0, busySince: null, busy: 0, openTools: 0,
  tokens: { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 }, turns: 0, failStreak: 0, ...extra,
})
// The saved copy of the values, as the engine hands it back at the start (the test `$` has no state noun).
function readBack(on: Parameters<typeof standIns>[0], values: { agents: Record<string, unknown>; alerts: unknown[] }): void {
  const given = new Set<string>()
  on('state.get', (_, e, next) => {
    if ((e.key === 'agents' || e.key === 'alerts') && !given.has(e.key)) {
      given.add(e.key)
      return e.key === 'agents'
        ? { value: { value: { shape: 'agents-1', value: values.agents }, version: 0 } }
        : { value: { value: { shape: 'alerts-1', value: values.alerts }, version: 0 } }
    }
    return next(e)
  })
}

test('labels are masked at draw time', async ($, on) => {
  const { clock } = standIns(on, [info('old')])
  readBack(on, {
    agents: { old: savedRow('old', { description: 'deploy ' + fakeKey, status: 'running' }) },
    alerts: [{ key: 'repeat:old', kind: 'repeat', agentId: 'old', at: 1, text: `"deploy ${fakeKey}" made the same Bash call 2 times` }],
  })
  await start($)
  await spawn($, 'a1')
  await clock.advance(2 * SEC)
  let ui = await mountBand($, 'terminal')
  await ui.press({ key: 'repeat:old/stop' })
  await ui.unmount()
  ui = await mountBand($, 'terminal')
  const all = (await texts(ui)).join('\n')
  expect(all).toContain('! "deploy [redacted]" made')
  expect(all).toContain('Stop "deploy [redacted]"?')
  expect(all).not.toContain(fakeKey)
  await ui.unmount()
})

test('with masking off the band shows the raw text', { options: { redact: false } }, async ($, on) => {
  const { clock } = standIns(on, [info('old')])
  readBack(on, {
    agents: { old: savedRow('old', { description: 'deploy ' + fakeKey, status: 'running' }) },
    alerts: [{ key: 'repeat:old', kind: 'repeat', agentId: 'old', at: 1, text: `"deploy ${fakeKey}" made the same Bash call 2 times` }],
  })
  await start($)
  await spawn($, 'a1')
  await clock.advance(2 * SEC)
  const ui = await mountBand($, 'terminal')
  expect((await texts(ui)).join('\n')).toContain(fakeKey)
  await ui.unmount()
})

test('several warnings of one agent show its confirm line once, under the newest', async ($, on) => {
  const { clock } = standIns(on, [info('a1')])
  readBack(on, {
    agents: { a1: savedRow('a1', { description: 'Fix tests', status: 'running' }) },
    alerts: [
      { key: 'long:a1', kind: 'long', agentId: 'a1', at: 1, text: '"Fix tests" has been working a long time' },
      { key: 'repeat:a1', kind: 'repeat', agentId: 'a1', at: 2, text: '"Fix tests" made the same Bash call 2 times' },
    ],
  })
  await start($)
  await spawn($, 'z')
  await clock.advance(2 * SEC)
  let ui = await mountBand($, 'terminal')
  await ui.press({ key: 'repeat:a1/stop' })
  await ui.unmount()
  ui = await mountBand($, 'terminal')
  const ks = await keys(ui)
  expect((await texts(ui)).filter(t => t.startsWith('Stop "'))).toHaveLength(1)
  expect(ks).toContain('repeat:a1/confirm')
  expect(ks).not.toContain('long:a1/confirm')
  expect(ks).not.toContain('long:a1/stop')
  await ui.unmount()
})

test('a confirm for an agent that is no longer live is not drawn in the band', opts, async ($, on) => {
  const { clock } = standIns(on, [info('a1')])
  await start($)
  await repeat($, clock)
  let ui = await mountBand($, 'terminal')
  await ui.press({ key: 'repeat:a1/stop' })
  await turn($, 'a1', 'end')
  await clock.advance(2 * SEC)
  await ui.unmount()
  ui = await mountBand($, 'terminal')
  expect((await texts(ui)).some(t => t.startsWith('Stop "'))).toBe(false)
  expect(await keys(ui)).not.toContain('repeat:a1/confirm')
  await ui.unmount()
})

test('band warnings carry stable keys', opts, async ($, on) => {
  const { clock } = standIns(on, [info('a1')])
  await start($)
  await repeat($, clock)
  const ui = await mountBand($, 'terminal')
  expect((await ui.findAll({ type: 'Box' })).map(b => b.key)).toContain('repeat:a1')
  await ui.unmount()
})

test('a warning about an agent whose description holds an escape is drawn, with its buttons', { options: { repeatCount: 2 } }, async ($, on) => {
  const { clock } = standIns(on)
  await start($)
  await spawn($, 'a1', { description: 'Fix\u001b tests' })
  await turn($, 'a1', 'start')
  await tool($, 'a1', 'ls')
  await tool($, 'a1', 'ls')
  await clock.advance(1000)
  const ui = await mountBand($, 'terminal')
  expect(await drawnTexts(ui)).toContain('! "Fix tests" made the same Bash call 2 times in a row')
  expect(JSON.stringify(await ui.drawn())).toContain('"key":"repeat:a1/stop"')
  await ui.unmount()
})
