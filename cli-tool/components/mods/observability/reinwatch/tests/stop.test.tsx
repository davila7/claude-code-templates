import { expect, test } from 'claude-code/testing'
import { isStoppedIn, STOP_DENY, STOP_REPLY } from '../hooks/stop'
import { mountPane, readAgents, spawn, standIns, start, step, tool, turn, type Mounted } from './helpers'

const stopVia = async (ui: Mounted, id: string): Promise<void> => {
  await ui.press({ key: `${id}/stop` })
  await ui.press({ key: `${id}/confirm` })
}

test("after Stop, the agent's tool calls are denied and never run", async ($, on) => {
  const { seen, clock } = standIns(on)
  await start($)
  await spawn($, 'a1')
  await turn($, 'a1', 'start')
  await clock.advance(2000)
  expect((await tool($, 'a1', 'ls')).deny).toBeUndefined()
  const ui = await mountPane($, 'terminal')
  await stopVia(ui, 'a1')
  const before = seen.toolRuns
  const r = await tool($, 'a1', 'ls')
  expect(r.deny).toBe(STOP_DENY)
  expect(seen.toolRuns).toBe(before)
  await ui.unmount()
})

test('after Stop, the next step makes no model request and answers the stopped reply', async ($, on) => {
  const { seen, clock } = standIns(on)
  await start($)
  await spawn($, 'a1')
  await turn($, 'a1', 'start')
  await clock.advance(2000)
  const ui = await mountPane($, 'terminal')
  await stopVia(ui, 'a1')
  const before = seen.modelCalls
  const row = (await readAgents($))['a1']!
  const counted = { busy: row.busy, activeMs: row.activeMs, tokens: { ...row.tokens } }
  const s = await step($, 'a1')
  expect(s.kinds).toEqual(['text', 'stop'])
  expect(s.result.answer).toBe(STOP_REPLY)
  expect(seen.modelCalls).toBe(before)
  await clock.advance(2000)
  const after = (await readAgents($))['a1']!
  expect({ busy: after.busy, activeMs: after.activeMs, tokens: after.tokens }).toEqual(counted)
  await ui.unmount()
})

test('Allow resume lets tools and steps through again', async ($, on) => {
  const { seen, clock } = standIns(on)
  await start($)
  await spawn($, 'a1')
  await turn($, 'a1', 'start')
  await clock.advance(2000)
  const ui = await mountPane($, 'terminal')
  await stopVia(ui, 'a1')
  expect((await tool($, 'a1', 'ls')).deny).toBe(STOP_DENY)
  await ui.press({ key: 'a1/resume' })
  const runs = seen.toolRuns
  expect((await tool($, 'a1', 'ls')).deny).toBeUndefined()
  expect(seen.toolRuns).toBe(runs + 1)
  const calls = seen.modelCalls
  const s = await step($, 'a1')
  expect(s.result.answer).toBe('ok')
  expect(seen.modelCalls).toBe(calls + 1)
  await ui.unmount()
})

test('a tool already running finishes; the row reads stopping, then stopped', { timeoutMs: 30_000 }, async ($, on) => {
  const { clock } = standIns(on)
  await start($)
  await spawn($, 'a1')
  await turn($, 'a1', 'start')
  const running = tool($, 'a1', 'sleep 60000')
  await clock.advance(1000)
  const ui = await mountPane($, 'terminal')
  await stopVia(ui, 'a1')
  expect((await readAgents($))['a1']?.status).toBe('stopping')
  const rowText = async () => (await ui.findAll({ type: 'Text' })).map(t => t.text).filter(t => /^(running|stopping|stopped)\b/.test(t))[0]
  expect(await rowText()).toMatch(/^stopping \(a tool is still running\)/)
  await clock.advance(60_000)
  expect((await running).deny).toBeUndefined()
  await clock.advance(1000)
  expect(await rowText()).toMatch(/^stopped/)
  expect((await readAgents($))['a1']?.status).toBe('stopped')
  await ui.unmount()
})

test('stopping one agent leaves the main conversation and other agents alone', async ($, on) => {
  const { seen, clock } = standIns(on)
  await start($)
  await spawn($, 'a1')
  await spawn($, 'a2')
  await turn($, 'a1', 'start')
  await turn($, 'a2', 'start')
  await clock.advance(2000)
  const ui = await mountPane($, 'terminal')
  await stopVia(ui, 'a1')
  let runs = seen.toolRuns
  expect((await tool($, undefined, 'ls')).deny).toBeUndefined()
  expect((await tool($, 'a2', 'ls')).deny).toBeUndefined()
  expect(seen.toolRuns).toBe(runs + 2)
  const calls = seen.modelCalls
  expect((await step($, undefined)).result.answer).toBe('ok')
  expect((await step($, 'a2')).result.answer).toBe('ok')
  expect(seen.modelCalls).toBe(calls + 2)
  runs = seen.toolRuns
  expect((await tool($, 'a1', 'ls')).deny).toBe(STOP_DENY)
  expect(seen.toolRuns).toBe(runs)
  await ui.unmount()
})

test('one workflow agent can be stopped while the rest of its run goes on', async ($, on) => {
  const { seen, clock } = standIns(on)
  await start($)
  await spawn($, 'w1', { workflow: { runId: 'wf_1' } } as never)
  await spawn($, 'w2', { workflow: { runId: 'wf_1' } } as never)
  await turn($, 'w1', 'start')
  await turn($, 'w2', 'start')
  await clock.advance(2000)
  const ui = await mountPane($, 'terminal')
  await stopVia(ui, 'w1')
  expect((await readAgents($))['w2']?.runId).toBe('wf_1')
  const runs = seen.toolRuns
  expect((await tool($, 'w1', 'ls')).deny).toBe(STOP_DENY)
  expect(seen.toolRuns).toBe(runs)
  expect((await tool($, 'w2', 'ls')).deny).toBeUndefined()
  expect(seen.toolRuns).toBe(runs + 1)
  await ui.unmount()
})

test('isStoppedIn reads a Stop from rows, and nothing from no rows', () => {
  const rows = { a: { isStopped: true }, b: { isStopped: false } }
  expect([isStoppedIn(rows, 'a'), isStoppedIn(rows, 'b'), isStoppedIn(rows, 'c'), isStoppedIn(rows, undefined), isStoppedIn(null, 'a'), isStoppedIn(undefined, 'a')])
    .toEqual([true, false, false, false, false, false])
})
