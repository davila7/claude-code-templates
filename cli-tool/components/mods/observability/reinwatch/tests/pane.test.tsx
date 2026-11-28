import { expect, test } from 'claude-code/testing'
import { ASK_TO_STOP } from '../hooks/actions'
import { dayOf, localTime } from '../hooks/history'
import type { Summary } from '../types'
import { buttonBoxes, columnBoxes, drawnTexts, mountBand, mountPane, readAgents, readState, seedStore, spawn, standIns, start, step, tool, turn, type Mounted } from './helpers'

const SEC = 1000
const MIN = 60_000
const usage = (u: Partial<Record<'input_tokens' | 'output_tokens' | 'cache_read_input_tokens' | 'cache_creation_input_tokens', number>>) =>
  ({ input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'm1', ...u })
const fakeKey = 'gh' + 'p_' + 'A'.repeat(36)
const info = (id: string, extra: Record<string, unknown> = {}) =>
  ({ id, description: 'Fix tests', type: 'general-purpose', status: 'running', ...extra }) as never

// Every Text the pane draws, in order (a Text takes no key, so it is found by its words).
const texts = async (ui: Mounted): Promise<string[]> => (await ui.findAll({ type: 'Text' })).map(t => t.text)
// The agent rows: the Texts that start with a status.
const rows = async (ui: Mounted): Promise<string[]> => (await texts(ui)).filter(t => /^(running|idle|done|failed|stopping|stopped)\b/.test(t))
const keys = async (ui: Mounted): Promise<string[]> => (await ui.findAll({ type: 'Button' })).map(b => b.key ?? '')

test('/reinwatch opens the pane', async ($, on) => {
  const { seen } = standIns(on)
  await start($)
  const out = await $.command.run({
    command: 'reinwatch', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 },
  } as never)
  expect(out).toEqual({ text: 'Opened the reinwatch pane.' })
  expect(seen.opened).toContain('reinwatch')
})

test('rows show the numbers on every surface', async ($, on) => {
  const { clock, setUsage } = standIns(on)
  await start($)
  await spawn($, 'a1')
  await turn($, 'a1', 'start')
  setUsage(usage({ input_tokens: 1_000_000, cache_read_input_tokens: 200_000 }))
  await step($, 'a1')
  await clock.advance(2 * SEC)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await mountPane($, surface)
    const row = await ui.find({ type: 'Text', text: /Fix tests/ })
    expect(row?.text).toContain('1M tok')
    expect(row?.text).toBe('running · Fix tests · 1M tok · 0s active · general-purpose · m1 · 1 turn · from main')
    await ui.unmount()
  }
})

test('the status line and pane rows show new tokens', async ($, on) => {
  const { clock, seen, setUsage } = standIns(on)
  await start($)
  await spawn($, 'a1')
  await turn($, 'a1', 'start')
  setUsage(usage({ input_tokens: 1000, cache_creation_input_tokens: 200, output_tokens: 100, cache_read_input_tokens: 90_000 }))
  await step($, 'a1')
  await clock.advance(2 * SEC)
  expect(seen.statuses.at(-1)).toBe('agents 1 running · 1.3k tok · 0s active')
  const ui = await mountPane($, 'terminal')
  expect((await rows(ui))[0]).toContain(' · 1.3k tok · ')
  expect(await texts(ui)).toContain('1 running · 1 agent · 1.3k tok this session')
  await ui.unmount()
})

test('the heading counts agents and tokens, and an empty pane says so', async ($, on) => {
  const { clock, setUsage } = standIns(on)
  await start($)
  let ui = await mountPane($, 'terminal')
  expect(await texts(ui)).toContain('No agents yet in this session.')
  await ui.unmount()
  await spawn($, 'a1')
  await turn($, 'a1', 'start')
  setUsage(usage({ input_tokens: 1500 }))
  await step($, 'a1')
  await clock.advance(2 * SEC)
  ui = await mountPane($, 'terminal')
  expect(await texts(ui)).toContain('1 running · 1 agent · 1.5k tok this session')
  await ui.unmount()
})

test('running agents come first, longest first', { timeoutMs: 30_000 }, async ($, on) => {
  const { clock } = standIns(on)
  await start($)
  for (const id of ['a1', 'a2', 'a3']) await spawn($, id, { description: `job ${id}` })
  await turn($, 'a1', 'start')
  await turn($, 'a2', 'start')
  await turn($, 'a3', 'start')
  const r1 = tool($, 'a1', 'sleep 600000')
  await clock.advance(10 * MIN)
  await r1
  await turn($, 'a1', 'end')
  const r3 = tool($, 'a3', 'sleep 300000')
  const r2 = tool($, 'a2', 'sleep 120000')
  await clock.advance(2 * MIN)
  await r2
  await clock.advance(3 * MIN)
  await r3
  await clock.advance(SEC)
  const ui = await mountPane($, 'terminal')
  const list = await rows(ui)
  expect(list.map(r => r.split(' · ')[1])).toEqual(['job a3', 'job a2', 'job a1'])
  expect(list.map(r => r.split(' · ')[0])).toEqual(['running', 'running', 'done'])
  await ui.unmount()
})

test('workflow agents are grouped by run and offer no View or Ask', async ($, on) => {
  const { clock } = standIns(on, [])
  await start($)
  await spawn($, 'w1', { workflow: { runId: 'wf_1' } } as never)
  await spawn($, 'w2', { workflow: { runId: 'wf_1' } } as never)
  await turn($, 'w1', 'start')
  await turn($, 'w2', 'start')
  await clock.advance(2 * SEC)
  const ui = await mountPane($, 'terminal')
  expect(await texts(ui)).toContain('workflow wf_1 · 2 agents · 2 running')
  expect(await keys(ui)).not.toContain('w1/view')
  expect(await keys(ui)).not.toContain('w1/ask')
  expect(await keys(ui)).toContain('w1/stop')
  expect((await rows(ui))[0]?.endsWith('from workflow')).toBe(true)
  await ui.unmount()
})

test('View and Ask are offered only for listed agents', async ($, on) => {
  const { seen, clock } = standIns(on, [info('a1')])
  await start($)
  await spawn($, 'a1')
  await spawn($, 'a2')
  await turn($, 'a1', 'start')
  await turn($, 'a2', 'start')
  await clock.advance(2 * SEC)
  const ui = await mountPane($, 'terminal')
  expect(await keys(ui)).not.toContain('a2/view')
  expect(await keys(ui)).not.toContain('a2/ask')
  expect(await keys(ui)).toContain('a1/view')
  await ui.press({ key: 'a1/view' })
  expect(seen.views).toEqual([{ agentId: 'a1' }])
  await ui.press({ key: 'a1/ask' })
  expect(seen.sent).toHaveLength(1)
  expect(seen.sent[0]?.text).toBe(ASK_TO_STOP)
  expect(JSON.stringify(seen.sent[0]?.to)).toContain('a1')
  expect(seen.toasts).toEqual(['Asked the agent to stop.'])
  await ui.unmount()
})

test('a refused View or a failed Ask says why', async ($, on) => {
  const { seen, clock } = standIns(on, [info('a1')], { view: { deny: 'moved' }, send: { isDelivered: false, reason: 'gone' } })
  await start($)
  await spawn($, 'a1')
  await turn($, 'a1', 'start')
  await clock.advance(2 * SEC)
  const ui = await mountPane($, 'terminal')
  await ui.press({ key: 'a1/view' })
  await ui.press({ key: 'a1/ask' })
  expect(seen.toasts).toEqual(['Cannot show this agent: moved', 'Could not message this agent: gone'])
  await ui.unmount()
})

test('Stop asks first; Cancel keeps the agent running', async ($, on) => {
  const { clock } = standIns(on)
  await start($)
  await spawn($, 'a1')
  await turn($, 'a1', 'start')
  await clock.advance(2 * SEC)
  const ui = await mountPane($, 'terminal')
  await ui.press({ key: 'a1/stop' })
  expect(await texts(ui)).toContain('Stop "Fix tests"? Running tools finish first.')
  expect(await keys(ui)).not.toContain('a1/stop')
  expect(await keys(ui)).toContain('a1/confirm')
  expect((await ui.find({ key: 'a1/confirm' }))?.text).toBe('Yes, stop')
  await ui.press({ key: 'a1/cancel' })
  expect((await rows(ui))[0]?.startsWith('running')).toBe(true)
  expect(await keys(ui)).toContain('a1/stop')
  expect((await readAgents($))['a1']?.isStopped).toBe(false)
  await ui.unmount()
})

test('Yes, stop marks the agent; Allow resume clears it', async ($, on) => {
  const { clock } = standIns(on)
  await start($)
  await spawn($, 'a1')
  await turn($, 'a1', 'start')
  await clock.advance(2 * SEC)
  const ui = await mountPane($, 'terminal')
  await ui.press({ key: 'a1/stop' })
  await ui.press({ key: 'a1/confirm' })
  expect((await rows(ui))[0]?.startsWith('stopped')).toBe(true)
  expect(await keys(ui)).toContain('a1/resume')
  expect(await keys(ui)).not.toContain('a1/stop')
  expect(await keys(ui)).not.toContain('a1/confirm')
  expect((await readAgents($))['a1']?.isStopped).toBe(true)
  await ui.press({ key: 'a1/resume' })
  expect((await rows(ui))[0]?.startsWith('running')).toBe(true)
  expect(await keys(ui)).not.toContain('a1/resume')
  expect((await readAgents($))['a1']?.isStopped).toBe(false)
  await ui.unmount()
})

test('Details shows the token breakdown', async ($, on) => {
  const { clock, setUsage } = standIns(on)
  await start($)
  await spawn($, 'a1')
  await turn($, 'a1', 'start')
  setUsage(usage({ input_tokens: 1_000_000, cache_read_input_tokens: 200_000 }))
  await step($, 'a1')
  await clock.advance(2 * SEC)
  const ui = await mountPane($, 'terminal')
  expect((await ui.find({ key: 'a1/details' }))?.text).toBe('Details')
  await ui.press({ key: 'a1/details' })
  expect(await texts(ui)).toContain('in 1M · cache write 0 · cache read 200k · out 0')
  expect((await ui.find({ key: 'a1/details' }))?.text).toBe('Hide details')
  await ui.press({ key: 'a1/details' })
  expect(await texts(ui)).not.toContain('in 1M · cache write 0 · cache read 200k · out 0')
  await ui.unmount()
})

test('labels filled from the agent list are masked', async ($, on) => {
  const { clock } = standIns(on, [info('zzz', { description: 'deploy ' + fakeKey, type: 'Explore' })])
  await start($)
  await step($, 'zzz')
  await clock.advance(2 * SEC)
  const ui = await mountPane($, 'terminal')
  const all = (await texts(ui)).join('\n')
  expect(all).toContain('deploy [redacted]')
  expect(all).not.toContain(fakeKey)
  await ui.unmount()
})

test("an open pane keeps an agent's time moving while its tool runs", { timeoutMs: 30_000 }, async ($, on) => {
  const { clock } = standIns(on)
  await start($)
  await spawn($, 'a1')
  await turn($, 'a1', 'start')
  const run = tool($, 'a1', 'sleep 120000')
  await clock.advance(2 * SEC)
  const ui = await mountPane($, 'terminal')
  expect((await rows(ui))[0]).toContain(' · 2s active · ')
  // Nothing is written while the tool runs; the pane still draws the time as it goes.
  await clock.advance(63 * SEC)
  expect((await rows(ui))[0]).toContain(' · 1m active · ')
  await clock.advance(55 * SEC)
  await run
  await ui.unmount()
})

test('the pane lists the open warnings, newest first; Dismiss takes one off the pane and the status line', { options: { repeatCount: 2 } }, async ($, on) => {
  const { clock, seen } = standIns(on, [info('a1')])
  await start($)
  for (const id of ['a1', 'a2']) {
    await spawn($, id, { description: `job ${id}` })
    await turn($, id, 'start')
    await tool($, id, 'ls')
    await tool($, id, 'ls')
    await clock.advance(2 * SEC)
  }
  expect(seen.statuses.at(-1)).toBe('agents 2 running · 0 tok · 0s active · 2 warnings')
  const ui = await mountPane($, 'terminal')
  const all = await texts(ui)
  expect(all.filter(t => t.startsWith('! '))).toEqual(['! "job a2" made the same Bash call 2 times in a row', '! "job a1" made the same Bash call 2 times in a row'])
  // The warnings come under the heading and before the agents.
  expect(all.indexOf('! "job a1" made the same Bash call 2 times in a row')).toBeLessThan(all.findIndex(t => t.startsWith('running · ')))
  // View, Ask to stop and Stop stay on the agent rows: a warning line offers Dismiss only.
  expect((await keys(ui)).filter(k => k.startsWith('repeat:'))).toEqual(['repeat:a2/dismiss', 'repeat:a1/dismiss'])
  expect((await ui.find({ key: 'repeat:a2/dismiss' }))?.text).toBe('Dismiss')
  await ui.press({ key: 'repeat:a2/dismiss' })
  expect((await texts(ui)).filter(t => t.startsWith('! '))).toEqual(['! "job a1" made the same Bash call 2 times in a row'])
  expect(seen.statuses.at(-1)).toBe('agents 2 running · 0 tok · 0s active · 1 warning')
  await ui.unmount()
})

test('the latest summary shows in the pane until it is dismissed', async ($, on) => {
  const { clock, setUsage } = standIns(on)
  await start($)
  await turn($, undefined, 'start')
  await spawn($, 'a1')
  await turn($, 'a1', 'start')
  setUsage(usage({ input_tokens: 1500 }))
  await step($, 'a1')
  await turn($, 'a1', 'end')
  await turn($, undefined, 'end')
  await clock.advance(2 * SEC)
  const text = '1 agent · 1.5k tok · 0s active combined · longest: "Fix tests" 0s active'
  expect((await readState($, 'summary') as Summary | null)?.text).toBe(text)
  const ui = await mountPane($, 'terminal')
  const all = await texts(ui)
  expect(all).toContain(text)
  expect(all.indexOf(text)).toBeLessThan(all.findIndex(t => t.startsWith('done · ')))
  expect((await ui.find({ key: 'summary/dismiss' }))?.text).toBe('Dismiss')
  await ui.press({ key: 'summary/dismiss' })
  expect(await texts(ui)).not.toContain(text)
  expect(await keys(ui)).not.toContain('summary/dismiss')
  await ui.unmount()
})

test("the summary's Details button lists each agent's share, longest first, with the label masked", async ($, on) => {
  const { clock, setUsage } = standIns(on)
  await start($)
  await turn($, undefined, 'start')
  await spawn($, 'a1', { description: 'job a1' })
  await spawn($, 'a2', { description: 'deploy ' + fakeKey })
  await turn($, 'a1', 'start')
  await turn($, 'a2', 'start')
  setUsage(usage({ input_tokens: 1000 }))
  await step($, 'a1')
  setUsage(usage({ input_tokens: 500 }))
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
  const ui = await mountPane($, 'terminal')
  expect(await keys(ui)).toContain('summary/details')
  expect((await ui.find({ key: 'summary/details' }))?.text).toBe('Details')
  expect(await keys(ui)).toContain('summary/dismiss')
  const lineOf = (all: string[]) => all.filter(t => / tok · .* active$/.test(t) && t.startsWith('"'))
  expect(lineOf(await texts(ui))).toEqual([])
  await ui.press({ key: 'summary/details' })
  expect(lineOf(await texts(ui))).toEqual(['"deploy [redacted]" · 500 tok · 3s active', '"job a1" · 1k tok · 2s active'])
  expect((await ui.find({ key: 'summary/details' }))?.text).toBe('Hide details')
  expect(JSON.stringify(await ui.drawn())).not.toContain(fakeKey)
  await ui.press({ key: 'summary/details' })
  expect(lineOf(await texts(ui))).toEqual([])
  expect((await ui.find({ key: 'summary/details' }))?.text).toBe('Details')
  await ui.unmount()
})

test('a summary stored by the released version is dropped, not drawn', async ($, on) => {
  standIns(on)
  on('state.get', (_, e, next) =>
    e.key === 'summary' ? { value: { value: { shape: 'summary-1', value: { text: '1 agent · 5 tok', at: 7 } }, version: 0 } } : next(e))
  await start($)
  const pane = await mountPane($, 'terminal')
  expect(await texts(pane)).not.toContain('1 agent · 5 tok')
  expect(await keys(pane)).not.toContain('summary/details')
  await pane.unmount()
  const band = await mountBand($, 'terminal')
  expect(await texts(band)).not.toContain('1 agent · 5 tok')
  await band.unmount()
})

// What the engine hands back as the saved copy of the pane's values (the test `$` has no state noun).
const savedRow = (id: string, extra: Record<string, unknown> = {}) => ({
  id, description: '', type: '', model: '', isTeammate: false, status: 'idle', isStopped: false, inTurn: false,
  firstSeenAt: 0, lastActiveAt: 0, activeMs: 0, busySince: null, busy: 0, openTools: 0,
  tokens: { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 }, turns: 0, failStreak: 0, ...extra,
})
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

test('a pane draws every agent row up to 200', { timeoutMs: 30_000 }, async ($, on) => {
  const { clock } = standIns(on)
  await start($)
  for (let i = 0; i < 40; i++) {
    await spawn($, `n${i}`)
    await turn($, `n${i}`, 'start')
  }
  await clock.advance(2 * SEC)
  let ui = await mountPane($, 'terminal', 20)
  let lines = await texts(ui)
  expect((await rows(ui)).length).toBe(40)
  expect(lines.some(l => /^\+\d+ more$/.test(l))).toBe(false)
  // 40 starts at once raise the burst warning, which stays on top.
  expect(lines.indexOf('! 10 agents started within 2m')).toBeLessThan(lines.findIndex(l => /^running\b/.test(l)))
  await ui.unmount()
  for (let i = 40; i < 250; i++) {
    await spawn($, `n${i}`)
    await turn($, `n${i}`, 'start')
  }
  await clock.advance(2 * SEC)
  ui = await mountPane($, 'terminal', 20)
  lines = await texts(ui)
  expect((await rows(ui)).length).toBe(200)
  expect(lines).toContain('+50 more')
  await ui.unmount()
})

test('+k more counts hidden agents only, and a heading with no drawn row is not drawn', { timeoutMs: 30_000 }, async ($, on) => {
  const { clock } = standIns(on)
  await start($)
  for (let i = 0; i < 198; i++) await spawn($, `p${i}`)
  for (let i = 0; i < 4; i++) await spawn($, `w${i}`, { workflow: { runId: 'wf_1' } } as never)
  await spawn($, 'x1', { workflow: { runId: 'wf_2' } } as never)
  await clock.advance(2 * SEC)
  const ui = await mountPane($, 'terminal')
  const lines = await texts(ui)
  expect((await rows(ui)).length).toBe(200)
  expect(lines).toContain('workflow wf_1 · 4 agents · 4 running')
  expect(lines.filter(l => l.startsWith('workflow wf_2'))).toEqual([])
  expect(lines).toContain('+3 more')
  await ui.unmount()
})

test('the type column is the row type, else the agent list type, else ?', async ($, on) => {
  const { clock } = standIns(on, [info('zzz', { description: 'Look around', type: 'Explore' })])
  await start($)
  await step($, 'zzz')
  await spawn($, 'a1', { subagentType: '' })
  await clock.advance(2 * SEC)
  const ui = await mountPane($, 'terminal')
  const all = await rows(ui)
  expect(all.find(r => r.includes('Look around'))).toContain(' · Explore · ')
  expect(all.find(r => r.includes('Fix tests'))).toContain(' · ? · ')
  await ui.unmount()
})

test('the pane shows the 30-day totals line', async ($, on) => {
  standIns(on)
  seedStore('days-v2', [{ day: dayOf(localTime(0)), agents: 3, tokens: 4500, activeMs: 6000 }])
  await start($)
  const ui = await mountPane($, 'terminal')
  expect((await texts(ui)).some(t => /^Last 30 days: 3 agents · 4\.5k tok · 6s active$/.test(t))).toBe(true)
  await ui.unmount()
})

test('from names the parent: its label, agent <id8> when unknown, main', async ($, on) => {
  const { clock } = standIns(on)
  await start($)
  await spawn($, 'boss', { description: 'Lead job' })
  await spawn($, 'kid', { description: 'Child job', parentAgentId: 'boss' } as never)
  await spawn($, 'orph', { description: 'Orphan job', parentAgentId: 'ghost-agent-1234' } as never)
  await clock.advance(2 * SEC)
  const ui = await mountPane($, 'terminal')
  const all = await rows(ui)
  expect(all.find(r => r.includes('Child job'))).toMatch(/from Lead job$/)
  expect(all.find(r => r.includes('Orphan job'))).toMatch(/from agent ghost-ag$/)
  expect(all.find(r => r.includes('Lead job') && !r.includes('Child'))).toMatch(/from main$/)
  await ui.unmount()
})

test('with masking off the pane shows the raw description', { options: { redact: false } }, async ($, on) => {
  const { clock } = standIns(on)
  await start($)
  await spawn($, 'a1', { description: 'deploy ' + fakeKey })
  await clock.advance(2 * SEC)
  const ui = await mountPane($, 'terminal')
  expect((await texts(ui)).join('\n')).toContain('deploy ' + fakeKey)
  await ui.unmount()
})

test('labels are masked at draw time', async ($, on) => {
  const { clock } = standIns(on)
  // Recorded while masking was off: the read-back holds the raw text.
  readBack(on, {
    agents: { old: savedRow('old', { description: 'deploy ' + fakeKey }) },
    alerts: [{ key: 'repeat:old', kind: 'repeat', agentId: 'old', at: 1, text: `"deploy ${fakeKey}" made the same Bash call 2 times` }],
  })
  await start($)
  await spawn($, 'a1')
  await clock.advance(2 * SEC)
  const ui = await mountPane($, 'terminal')
  const all = (await texts(ui)).join('\n')
  expect(all).toContain('deploy [redacted]')
  expect(all).toContain('"deploy [redacted]" made')
  expect(all).not.toContain(fakeKey)
  await ui.unmount()
})

test('a confirm for an agent that is no longer live is not drawn', async ($, on) => {
  const { clock } = standIns(on)
  await start($)
  await spawn($, 'a1')
  await turn($, 'a1', 'start')
  await clock.advance(2 * SEC)
  const ui = await mountPane($, 'terminal')
  await ui.press({ key: 'a1/stop' })
  expect(await texts(ui)).toContain('Stop "Fix tests"? Running tools finish first.')
  await turn($, 'a1', 'end')
  await clock.advance(2 * SEC)
  const ks = await keys(ui)
  expect((await texts(ui)).some(t => t.startsWith('Stop "'))).toBe(false)
  expect(ks).not.toContain('a1/confirm')
  expect(ks).not.toContain('a1/cancel')
  await ui.unmount()
})

test('mapped lines carry stable keys', async ($, on) => {
  const { clock } = standIns(on)
  await start($)
  await spawn($, 'w1', { workflow: { runId: 'wf_1' } } as never)
  await spawn($, 'a1')
  await clock.advance(2 * SEC)
  const ui = await mountPane($, 'terminal')
  const boxKeys = (await ui.findAll({ type: 'Box' })).map(b => b.key)
  expect(boxKeys).toContain('row:a1')
  expect(boxKeys).toContain('row:w1')
  expect(boxKeys).toContain('head:wf_1')
  await ui.unmount()
})

test('a stopped agent and a row with a pending confirm stay drawn past the 200-row cap', { timeoutMs: 30_000 }, async ($, on) => {
  const { clock } = standIns(on)
  await start($)
  await spawn($, 'victim')
  await turn($, 'victim', 'start')
  await clock.advance(2 * SEC)
  let ui = await mountPane($, 'terminal')
  await ui.press({ key: 'victim/stop' })
  await ui.press({ key: 'victim/confirm' })
  await ui.unmount()
  expect((await readAgents($))['victim']?.isStopped).toBe(true)
  for (let i = 0; i < 200; i++) {
    await spawn($, `w${i}`)
    await turn($, `w${i}`, 'start')
  }
  await clock.advance(2 * SEC)
  ui = await mountPane($, 'terminal')
  expect(await keys(ui)).toContain('victim/resume')
  const lines = await texts(ui)
  expect((await rows(ui)).length).toBe(201)
  expect(lines.some(l => /^\+\d+ more$/.test(l))).toBe(false)
  await ui.unmount()
})

test('past the cap a row with a pending Stop confirm is drawn and not counted as hidden', { timeoutMs: 30_000 }, async ($, on) => {
  const { clock } = standIns(on)
  await start($)
  await spawn($, 'c0', { isTeammate: true } as never)
  await turn($, 'c0', 'start')
  await turn($, 'c0', 'end')
  await clock.advance(1 * SEC)
  let ui = await mountPane($, 'terminal')
  await ui.press({ key: 'c0/stop' })
  await ui.unmount()
  // c0 rests (idle) while 201 others work, so c0 falls below the cap.
  for (let i = 0; i < 201; i++) {
    await spawn($, `w${i}`)
    await turn($, `w${i}`, 'start')
  }
  await clock.advance(5 * SEC)
  ui = await mountPane($, 'terminal')
  expect(await keys(ui)).toContain('c0/confirm')
  expect(await texts(ui)).toContain('Stop "Fix tests"? Running tools finish first.')
  expect((await rows(ui)).length).toBe(201)
  expect(await texts(ui)).toContain('+1 more')
  await ui.unmount()
})

test('the rows that hold buttons have a gap and wrap, on the terminal and the desktop', { options: { repeatCount: 2 } }, async ($, on) => {
  const { clock, setUsage } = standIns(on, [info('a1')])
  await start($)
  await turn($, undefined, 'start')
  await spawn($, 'a1')
  await turn($, 'a1', 'start')
  setUsage(usage({ input_tokens: 1500 }))
  await step($, 'a1')
  await tool($, 'a1', 'ls')
  await tool($, 'a1', 'ls')
  await turn($, undefined, 'end')
  await clock.advance(2 * SEC)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await mountPane($, surface)
    await ui.press({ key: 'a1/stop' })
    const boxes = await buttonBoxes(ui)
    // The warning row, the summary row, and the agent's button row.
    expect(boxes.length).toBeGreaterThanOrEqual(3)
    expect(await keys(ui)).toContain('summary/dismiss')
    for (const box of boxes) {
      expect(box.props).toMatchObject({ gap: 'sm', flexWrap: 'wrap' })
      expect(box.props).not.toHaveProperty('columnGap')
    }
    const columns = await columnBoxes(ui)
    expect(columns.length).toBeGreaterThanOrEqual(2)
    for (const box of columns) expect(box.props).toMatchObject({ gap: 'sm' })
    await ui.press({ key: 'a1/cancel' })
    await ui.unmount()
  }
})

test('View is drawn on the terminal only', async ($, on) => {
  const { clock } = standIns(on, [info('a1')])
  await start($)
  await spawn($, 'a1')
  await turn($, 'a1', 'start')
  await clock.advance(2 * SEC)
  const desktop = await mountPane($, 'desktop')
  expect((await keys(desktop)).filter(k => k.endsWith('/view'))).toEqual([])
  expect(await keys(desktop)).toContain('a1/ask')
  await desktop.unmount()
  const ui = await mountPane($, 'terminal')
  expect(await keys(ui)).toContain('a1/view')
  await ui.unmount()
})

test('the pane and the band drawn in the same second ask the engine for the agent list once', { options: { repeatCount: 2 } }, async ($, on) => {
  const { clock, lists } = standIns(on, [info('a1')])
  await start($)
  await spawn($, 'a1')
  await turn($, 'a1', 'start')
  await tool($, 'a1', 'ls')
  await tool($, 'a1', 'ls')
  // The tick lists the agents every 10 s; five seconds on, that answer is too old for a draw to use.
  await clock.advance(6 * SEC)
  const before = lists.calls
  const pane = await mountPane($, 'terminal')
  const band = await mountBand($, 'terminal')
  expect(lists.calls - before).toBe(1)
  expect((await pane.findAll({ type: 'Button' })).map(b => b.key)).toContain('a1/view')
  expect((await band.findAll({ type: 'Button' })).map(b => b.key)).toContain('repeat:a1/view')
  await pane.unmount()
  await band.unmount()
  // A second later the answer is old again.
  await clock.advance(SEC)
  const again = await mountPane($, 'terminal')
  const bandAgain = await mountBand($, 'terminal')
  expect(lists.calls - before).toBe(2)
  await again.unmount()
  await bandAgain.unmount()
})

test('a description holding an escape sequence is drawn as plain text, and the pane keeps its rows and buttons', async ($, on) => {
  const { clock } = standIns(on)
  await start($)
  await spawn($, 'a1', { description: 'Fix\u001b[2J\ntests' })
  await clock.advance(1000)
  const ui = await mountPane($, 'terminal')
  expect(await drawnTexts(ui)).toContain('running · Fix [2J tests · 0 tok · 0s active · general-purpose · test-model · 0 turns · from main')
  expect(JSON.stringify(await ui.drawn())).toContain('"key":"a1/stop"')
  await ui.unmount()
})

test('rows, warnings and a summary stored by an earlier version are drawn on plain lines', async ($, on) => {
  standIns(on)
  const bad = /[\u0000-\u001F\u007F-\u009F\u2028\u2029\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/
  const row = {
    id: 'old', description: 'Old\u001bjob\n! fake', type: 'Ex\u0007plore', model: 'm\u202E1', runId: 'r\u001b1', isTeammate: false,
    status: 'running', isStopped: false, inTurn: true, firstSeenAt: 0, lastActiveAt: 0, activeMs: 0, busySince: null, busy: 0, openTools: 0,
    tokens: { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 }, turns: 1, failStreak: 0,
  }
  const alert = { key: 'long:old', kind: 'long', agentId: 'old', at: 0, text: '"Old\u001bjob" has worked 31m\n(limit 30m)' }
  // What an earlier version stored: every read finds it, whatever this instance writes.
  on('state.get', (_, e, next) => {
    if (e.key === 'agents') return { value: { value: { shape: 'agents-1', value: { old: row } }, version: 0 } }
    if (e.key === 'alerts') return { value: { value: { shape: 'alerts-1', value: [alert] }, version: 0 } }
    if (e.key === 'summary') return { value: { value: { shape: 'summary-2', value: { text: '1 agent\u001b · 5 tok', at: 7, rows: [] } }, version: 0 } }
    return next(e)
  })
  await start($)
  const pane = await mountPane($, 'terminal')
  const texts = await drawnTexts(pane)
  expect(texts.some(text => bad.test(text))).toBe(false)
  expect(texts).toContain('! "Old job" has worked 31m (limit 30m)')
  expect(texts).toContain('1 agent · 5 tok')
  expect(texts).toContain('workflow r 1 · 1 agent · 1 running')
  expect(texts).toContain('running · Old job ! fake · 0 tok · 0s active · Ex plore · m1 · 1 turn · from workflow')
  await pane.unmount()
  const band = await mountBand($, 'terminal')
  const bandTexts = await drawnTexts(band)
  expect(bandTexts.some(text => bad.test(text))).toBe(false)
  expect(bandTexts).toContain('! "Old job" has worked 31m (limit 30m)')
  expect(bandTexts).toContain('1 agent · 5 tok')
  await band.unmount()
})

test('a stored type or model with nothing readable shows as unknown', async ($, on) => {
  standIns(on)
  const row = {
    id: 'old', description: 'Old job', type: '\u0007', model: '\u001b', isTeammate: false, status: 'done', isStopped: false, inTurn: false,
    firstSeenAt: 0, lastActiveAt: 0, activeMs: 0, busySince: null, busy: 0, openTools: 0,
    tokens: { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 }, turns: 1, failStreak: 0,
  }
  on('state.get', (_, e, next) =>
    e.key === 'agents' ? { value: { value: { shape: 'agents-1', value: { old: row } }, version: 0 } } : next(e))
  await start($)
  const ui = await mountPane($, 'terminal')
  expect(await drawnTexts(ui)).toContain('done · Old job · 0 tok · 0s active · ? · ? · 1 turn · from main')
  await ui.unmount()
})

test('a pending Stop confirm is cleared when the agent ends its turn', async ($, on) => {
  const { clock } = standIns(on)
  await start($)
  await spawn($, 'a1')
  await turn($, 'a1', 'start')
  await clock.advance(SEC)
  const ui = await mountPane($, 'terminal')
  await ui.press({ key: 'a1/stop' })
  expect(await readState($, 'confirm')).toBe('a1')
  await turn($, 'a1', 'end')
  expect(await readState($, 'confirm')).toBe(null)
  await ui.unmount()
})

test('dismissed warnings stay listed under a collapsible heading, newest first', { options: { repeatCount: 2 } }, async ($, on) => {
  const { clock } = standIns(on)
  await start($)
  for (const id of ['a1', 'a2']) {
    await spawn($, id, { description: `job ${id}` })
    await turn($, id, 'start')
    await tool($, id, 'ls')
    await tool($, id, 'ls')
    await clock.advance(SEC)
  }
  const ui = await mountPane($, 'terminal')
  expect(await drawnTexts(ui)).not.toContain('Dismissed warnings (0)')
  expect((await keys(ui)).filter(k => k.startsWith('history/'))).toEqual([])
  await ui.press({ key: 'repeat:a1/dismiss' })
  await ui.press({ key: 'repeat:a2/dismiss' })
  let texts = await drawnTexts(ui)
  expect(texts).toContain('Dismissed warnings (2)')
  expect(texts.some(t => t.startsWith('! '))).toBe(false)
  expect((await ui.find({ key: 'history/toggle' }))?.text).toBe('Show')
  expect(texts.some(t => t.includes('ago · "job a1"'))).toBe(false)
  await ui.press({ key: 'history/toggle' })
  texts = await drawnTexts(ui)
  expect((await ui.find({ key: 'history/toggle' }))?.text).toBe('Hide')
  const gone = texts.filter(t => t.includes(' ago · '))
  expect(gone).toEqual(['1s ago · "job a2" made the same Bash call 2 times in a row', '2s ago · "job a1" made the same Bash call 2 times in a row'])
  await ui.press({ key: 'history/toggle' })
  expect((await drawnTexts(ui)).filter(t => t.includes(' ago · '))).toEqual([])
  await ui.unmount()
})

test('a dismissed summary is not a dismissed warning', async ($, on) => {
  const { setUsage } = standIns(on)
  await start($)
  await spawn($, 'a1')
  setUsage({ input_tokens: 100, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'm1' })
  await turn($, 'a1', 'start')
  await step($, 'a1')
  await turn($, undefined, 'end')
  const ui = await mountPane($, 'terminal')
  await ui.press({ key: 'summary/dismiss' })
  expect((await drawnTexts(ui)).some(t => t.startsWith('Dismissed warnings'))).toBe(false)
  await ui.unmount()
})

test('each Stop is kept under a collapsible Stopped heading', async ($, on) => {
  const { clock, setUsage } = standIns(on)
  await start($)
  await spawn($, 'a1', { description: 'job a1' })
  setUsage(usage({ input_tokens: 1000 }))
  await turn($, 'a1', 'start')
  await step($, 'a1')
  await tool($, 'a1', 'ls')
  await clock.advance(2 * SEC)
  const ui = await mountPane($, 'terminal')
  expect((await drawnTexts(ui)).some(t => t.startsWith('Stopped ('))).toBe(false)
  expect((await keys(ui)).filter(k => k.startsWith('stops/'))).toEqual([])
  await ui.press({ key: 'a1/stop' })
  await ui.press({ key: 'a1/confirm' })
  let all = await drawnTexts(ui)
  expect(all).toContain('Stopped (1)')
  expect((await ui.find({ key: 'stops/toggle' }))?.text).toBe('Show')
  expect(all.some(t => t.includes(' ago · "job a1"'))).toBe(false)
  await ui.press({ key: 'stops/toggle' })
  all = await drawnTexts(ui)
  expect((await ui.find({ key: 'stops/toggle' }))?.text).toBe('Hide')
  expect(all.filter(t => t.includes(' ago · '))).toEqual(['0s ago · "job a1" · 1k tok · 0s active · last tool Bash'])
  await ui.press({ key: 'stops/toggle' })
  expect((await drawnTexts(ui)).filter(t => t.includes(' ago · '))).toEqual([])
  await ui.unmount()
})

test('with prices set, each row and the heading carry a cost estimate', { options: { priceInput: 3, priceOutput: 15 } }, async ($, on) => {
  const { clock, setUsage } = standIns(on)
  await start($)
  await spawn($, 'a1')
  await turn($, 'a1', 'start')
  setUsage(usage({ input_tokens: 1_000_000, output_tokens: 100_000 }))
  await step($, 'a1')
  await clock.advance(2 * SEC)
  const ui = await mountPane($, 'terminal')
  const all = await texts(ui)
  expect((await rows(ui))[0]).toMatch(/ · from main · \$4\.50$/)
  expect(all).toContain('1 running · 1 agent · 1.1M tok this session · $4.50')
  await ui.unmount()
})

test('with no prices set, no cost text appears anywhere', async ($, on) => {
  const { clock, setUsage } = standIns(on)
  await start($)
  await spawn($, 'a1')
  await turn($, 'a1', 'start')
  setUsage(usage({ input_tokens: 1_000_000, output_tokens: 100_000 }))
  await step($, 'a1')
  await clock.advance(2 * SEC)
  const ui = await mountPane($, 'terminal')
  expect((await texts(ui)).some(t => t.includes('$'))).toBe(false)
  await ui.unmount()
})

test('the pane shows the 30-day peaks beside the limits, and none when the store is empty', async ($, on) => {
  standIns(on)
  seedStore('days-v2', [{ day: dayOf(localTime(0)), agents: 3, tokens: 4500, activeMs: 6000, maxTokens: 2_100_000, maxActiveMs: 1_560_000 }])
  await start($)
  const ui = await mountPane($, 'terminal')
  expect((await texts(ui)).some(t => t === 'Peaks: 26m active · 2.1M tok per agent (limits 30m · 1M)')).toBe(true)
  await ui.unmount()
})

test('no Peaks line without history', async ($, on) => {
  standIns(on)
  await start($)
  const ui = await mountPane($, 'terminal')
  expect((await texts(ui)).some(t => t.startsWith('Peaks:'))).toBe(false)
  await ui.unmount()
})
