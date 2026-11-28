import { expect, test } from 'claude-code/testing'
import { label } from '../hooks/format'
import { STOP_DENY, STOP_REPLY } from '../hooks/stop'
import type { Summary } from '../types'
import { mountPane, readAgents, readAlerts, readState, seedStore, spawn, standIns, start, stateVersion, step, tool, turn } from './helpers'

const SEC = 1000
const MIN = 60_000
const usage = (u: Partial<Record<'input_tokens' | 'output_tokens' | 'cache_read_input_tokens' | 'cache_creation_input_tokens', number>>) =>
  ({ input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'm1', ...u })
const fakeKey = 'gh' + 'p_' + 'A'.repeat(36)

test("a subagent's work shows in the status line", async ($, on) => {
  const { seen, clock, setUsage } = standIns(on)
  await start($)
  await spawn($, 'a1')
  await turn($, 'a1', 'start')
  setUsage(usage({ input_tokens: 1_000_000, cache_read_input_tokens: 800_000 }))
  await step($, 'a1')
  const run = tool($, 'a1', 'sleep 60000')
  await clock.advance(MIN)
  await run
  await clock.advance(SEC)
  expect(seen.statuses.at(-1)).toBe('agents 1 running · 1M tok · 1m active')
})

test('the main conversation is not tracked', async ($, on) => {
  const { seen, clock, setUsage } = standIns(on)
  on('tool.check', () => ({ decision: 'ask' }))
  await start($)
  await spawn($, 'a1')
  await turn($, 'a1', 'start')
  setUsage(usage({ input_tokens: 9_000_000 }))
  await turn($, undefined, 'start')
  await step($, undefined)
  await tool($, undefined, 'ls')
  await $.tool.check({ tool: 'Bash', input: {}, tool_use_id: 'm1', approver: 'person' })
  await turn($, undefined, 'end')
  setUsage(usage({ input_tokens: 1000 }))
  await step($, 'a1')
  await clock.advance(2 * SEC)
  const agents = await readAgents($)
  expect(Object.keys(agents)).toEqual(['a1'])
  expect(agents['a1']?.tokens.input).toBe(1000)
  expect(seen.statuses.at(-1)).toBe('agents 1 running · 1k tok · 0s active')
})

test('an agent first seen mid-run gets a row', async ($, on) => {
  const { clock } = standIns(on)
  await start($)
  await step($, 'zzz')
  await clock.advance(SEC)
  const agents = await readAgents($)
  expect(Object.keys(agents)).toEqual(['zzz'])
  expect(agents['zzz']?.id).toBe('zzz')
  expect(agents['zzz']?.description).toBe('')
  expect(label(agents['zzz']!)).toBe('agent zzz')
})

test('descriptions are masked at intake', async ($, on) => {
  const { clock } = standIns(on)
  await start($)
  await spawn($, 'a1', { description: 'deploy ' + fakeKey })
  await clock.advance(SEC)
  expect((await readAgents($))['a1']?.description).toBe('deploy [redacted]')
})

test('options can turn masking off', { options: { redact: false } }, async ($, on) => {
  const { clock } = standIns(on)
  await start($)
  await spawn($, 'a1', { description: 'deploy ' + fakeKey })
  await clock.advance(SEC)
  expect((await readAgents($))['a1']?.description).toBe('deploy ' + fakeKey)
})

test('the status line clears when the last agent ends', async ($, on) => {
  const { seen, clock } = standIns(on)
  await start($)
  await spawn($, 'a1')
  await turn($, 'a1', 'start')
  await clock.advance(SEC)
  expect(seen.statuses.at(-1)).toBe('agents 1 running · 0 tok · 0s active')
  await turn($, 'a1', 'end')
  await clock.advance(SEC)
  expect(seen.statuses.at(-1)).toBe(undefined)
  expect(seen.statuses.length).toBeGreaterThan(1)
})

test('a long tool call raises the long warning while it runs', { options: { activeMinutes: 1 }, timeoutMs: 30_000 }, async ($, on) => {
  const { clock } = standIns(on)
  await start($)
  await spawn($, 'a1')
  await turn($, 'a1', 'start')
  const run = tool($, 'a1', 'sleep 300000')
  await clock.advance(62 * SEC)
  expect((await readAlerts($)).map(a => a.key)).toContain('long:a1')
  await clock.advance(300 * SEC)
  await run
})

test('the wait before a call runs is not counted, and its run is', { timeoutMs: 30_000 }, async ($, on) => {
  const { clock } = standIns(on)
  // The permission check settles ten minutes after the call is made.
  on('tool.check', async () => { await clock.sleep(600_000); return { decision: 'allow' } })
  await start($)
  await spawn($, 'a1')
  await turn($, 'a1', 'start')
  const run = tool($, 'a1', 'sleep 60000')
  await clock.advance(660_000)
  await run
  await clock.advance(SEC)
  expect((await readAgents($))['a1']?.activeMs).toBe(60_000)
})

test('a call approved at a prompt counts from when it runs', { timeoutMs: 30_000 }, async ($, on) => {
  const { clock } = standIns(on)
  on('tool.check', () => ({ decision: 'ask' }))
  // The answer to the prompt, a yes, comes ten minutes after the call is made.
  on('classic.PermissionRequest', async () => { await clock.sleep(600_000); return { decision: { behavior: 'allow' } } })
  await start($)
  await spawn($, 'a1')
  await turn($, 'a1', 'start')
  const run = tool($, 'a1', 'sleep 60000')
  await clock.advance(660_000)
  await run
  await clock.advance(SEC)
  expect((await readAgents($))['a1']?.activeMs).toBe(60_000)
})

test('a Bash call repeated with a reworded description trips the repeat warning at the count', { options: { repeatCount: 3 } }, async ($, on) => {
  const { clock } = standIns(on)
  await start($)
  await spawn($, 'a1')
  await turn($, 'a1', 'start')
  const run = (description: string) => $.tool.call({ tool: 'Bash', command: 'npm test', description, agentId: 'a1' })
  await run('Run tests')
  await run('Re-run tests')
  await clock.advance(SEC)
  expect((await readAlerts($)).map(a => a.key)).not.toContain('repeat:a1')
  await run('Run the tests once more')
  await clock.advance(SEC)
  expect((await readAlerts($)).find(a => a.key === 'repeat:a1')?.text).toBe('"Fix tests" made the same Bash call 3 times in a row')
})

test('a different call in between starts the repeat count over', { options: { repeatCount: 3 } }, async ($, on) => {
  const { clock } = standIns(on)
  await start($)
  await spawn($, 'a1')
  await turn($, 'a1', 'start')
  await tool($, 'a1', 'npm test')
  await tool($, 'a1', 'npm test')
  await tool($, 'a1', 'ls')
  await tool($, 'a1', 'npm test')
  await tool($, 'a1', 'npm test')
  await clock.advance(SEC)
  expect((await readAlerts($)).map(a => a.key)).not.toContain('repeat:a1')
  await tool($, 'a1', 'npm test')
  await clock.advance(SEC)
  expect((await readAlerts($)).map(a => a.key)).toContain('repeat:a1')
})

test('the 30-day totals are read even when the command cannot be registered', async ($, on) => {
  standIns(on, [], { now: Date.UTC(2026, 10, 15, 12), commandFails: true })
  seedStore('days-v2', [{ day: '2026-11-15', agents: 2, tokens: 3000, activeMs: 4000 }])
  await start($)
  expect(((await readState($, 'history')) as { agents: number } | undefined)?.agents).toBe(2)
})

test('many events in one tick write the agents value once', async ($, on) => {
  const { clock } = standIns(on)
  await start($)
  await spawn($, 'a1')
  await clock.advance(SEC)
  const v0 = stateVersion('agents')
  for (let i = 0; i < 50; i++) await tool($, 'a1', 'ls')
  await clock.advance(SEC)
  expect(stateVersion('agents')).toBe(v0 + 1)
})

test('events before the read-back keep their rows and warnings, and nothing is raised twice', { options: { repeatCount: 2 } }, async ($, on) => {
  const { clock } = standIns(on)
  const old = {
    id: 'old', description: 'Old job', type: '', model: '', isTeammate: false, status: 'done', isStopped: false, inTurn: false,
    firstSeenAt: 0, lastActiveAt: 0, activeMs: 1000, busySince: null, busy: 0, openTools: 0,
    tokens: { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 }, turns: 1, failStreak: 0,
  }
  const stale = { ...old, id: 'a1', description: 'Stale copy', activeMs: 99_000 }
  const oldAlert = { key: 'long:old', kind: 'long', agentId: 'old', at: 0, text: '"Old job" has worked 31m (limit 30m)' }
  let release = () => {}
  const gate = new Promise<void>(resolve => { release = resolve })
  // Only the read-back gets the old values; the mod's later writes read the real ones, so they go through.
  const firstRead = new Set<string>()
  on('state.get', async (_, e, next) => {
    const isFirst = !firstRead.has(e.key)
    firstRead.add(e.key)
    if (e.key === 'agents' && isFirst) {
      await gate
      return { value: { value: { shape: 'agents-1', value: { old, a1: stale } }, version: 0 } }
    }
    if (e.key === 'alerts' && isFirst) return { value: { value: { shape: 'alerts-1', value: [oldAlert] }, version: 0 } }
    return next(e)
  })
  const starting = start($)
  // These reach the mod while it still waits for the read-back.
  await spawn($, 'a1')
  await turn($, 'a1', 'start')
  await tool($, 'a1', 'ls')
  await tool($, 'a1', 'ls')
  release()
  await starting
  await clock.advance(SEC)
  const rows = await readAgents($)
  expect(Object.keys(rows).sort()).toEqual(['a1', 'old'])
  expect(rows['a1']?.description).toBe('Fix tests')
  expect(rows['old']?.activeMs).toBe(1000)
  expect((await readAlerts($)).map(a => a.key)).toEqual(['long:old', 'repeat:a1'])
  // The same call once more: repeat:a1 was raised before the read-back and is not raised again.
  await tool($, 'a1', 'ls')
  await clock.advance(SEC)
  expect((await readAlerts($)).map(a => a.key)).toEqual(['long:old', 'repeat:a1'])
})

test('a Stop from before a reload holds while the read-back still waits, and after it', async ($, on) => {
  const { seen } = standIns(on)
  const stopped = {
    id: 'tm', description: 'Teammate', type: '', model: '', isTeammate: true, status: 'stopped', isStopped: true, inTurn: false,
    firstSeenAt: 0, lastActiveAt: 0, activeMs: 1000, busySince: null, busy: 0, openTools: 0,
    tokens: { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 }, turns: 1, failStreak: 0,
  }
  let release = () => {}
  const gate = new Promise<void>(resolve => { release = resolve })
  let reached = () => {}
  const waiting = new Promise<void>(resolve => { reached = resolve })
  let isReadBack = true
  // Until the mod writes its rows, every read of them finds what the instance before the reload stored. The first read
  // is the read-back's, and it waits at the gate.
  on('state.get', async (_, e, next) => {
    if (e.key !== 'agents' || stateVersion('agents') > 0) return next(e)
    if (isReadBack) {
      isReadBack = false
      reached()
      await gate
    }
    return { value: { value: { shape: 'agents-1', value: { tm: stopped } }, version: 0 } }
  })
  const starting = start($)
  await waiting
  // The teammate is woken while the mod still waits for the read-back: the stored Stop already holds.
  await turn($, 'tm', 'start')
  expect((await tool($, 'tm', 'ls')).deny).toBe(STOP_DENY)
  expect((await step($, 'tm')).result.answer).toBe(STOP_REPLY)
  expect([seen.toolRuns, seen.modelCalls]).toEqual([0, 0])
  release()
  await starting
  expect((await tool($, 'tm', 'pwd')).deny).toBe(STOP_DENY)
  expect((await step($, 'tm')).result.answer).toBe(STOP_REPLY)
  expect([seen.toolRuns, seen.modelCalls]).toEqual([0, 0])
})

test('a read-back that fails is tried again on the tick, and nothing is written over the stored rows meanwhile', async ($, on) => {
  const { clock } = standIns(on)
  const old = {
    id: 'old', description: 'Old job', type: '', model: '', isTeammate: false, status: 'stopped', isStopped: true, inTurn: false,
    firstSeenAt: 0, lastActiveAt: 0, activeMs: 1000, busySince: null, busy: 0, openTools: 0,
    tokens: { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 }, turns: 1, failStreak: 0,
  }
  const oldAlert = { key: 'long:old', kind: 'long', agentId: 'old', at: 0, text: '"Old job" has worked 31m (limit 30m)' }
  let failures = 1
  on('state.get', (_, e, next) => {
    if (stateVersion('agents') > 0) return next(e)
    if (e.key === 'agents') {
      if (failures > 0) {
        failures -= 1
        // An answer with no value: the read fails. (A hook that throws is skipped by the engine, and the read goes on.)
        return { value: undefined } as never
      }
      return { value: { value: { shape: 'agents-1', value: { old } }, version: 0 } }
    }
    if (e.key === 'alerts') return { value: { value: { shape: 'alerts-1', value: [oldAlert] }, version: 0 } }
    return next(e)
  })
  await start($)
  await spawn($, 'a1')
  // The read-back failed: nothing is written, and the Stop hooks ask the stored rows themselves.
  expect(stateVersion('agents')).toBe(0)
  expect((await tool($, 'old', 'ls')).deny).toBe(STOP_DENY)
  await clock.advance(SEC)   // this tick reads back
  await clock.advance(SEC)   // and the next one writes
  const rows = await readAgents($)
  expect(Object.keys(rows).sort()).toEqual(['a1', 'old'])
  expect(rows['old']?.isStopped).toBe(true)
  expect((await readAlerts($)).map(a => a.key)).toEqual(['long:old'])
  expect((await tool($, 'old', 'pwd')).deny).toBe(STOP_DENY)
})

test('a warning raised before the read-back is not kept or notified a second time when it was already stored', { options: { repeatCount: 2 } }, async ($, on) => {
  const { clock, seen } = standIns(on)
  const stored = { key: 'repeat:a1', kind: 'repeat', agentId: 'a1', at: 5, text: '"Fix tests" made the same Bash call 2 times' }
  let release = () => {}
  const gate = new Promise<void>(resolve => { release = resolve })
  let reached = () => {}
  const waiting = new Promise<void>(resolve => { reached = resolve })
  let isReadBack = true
  let isAlertsRead = false
  on('state.get', async (_, e, next) => {
    if (e.key === 'agents' && isReadBack) {
      isReadBack = false
      reached()
      await gate
      return next(e)
    }
    if (e.key === 'alerts' && !isAlertsRead) {
      isAlertsRead = true
      return { value: { value: { shape: 'alerts-1', value: [stored] }, version: 0 } }
    }
    return next(e)
  })
  const starting = start($)
  await waiting
  // The same two calls raise repeat:a1 in this instance, which has not read the stored one yet.
  await spawn($, 'a1')
  await turn($, 'a1', 'start')
  await tool($, 'a1', 'ls')
  await tool($, 'a1', 'ls')
  release()
  await starting
  await clock.advance(SEC)
  expect(await readAlerts($)).toEqual([stored])
  expect(seen.notices).toEqual([])
})

test('when the stored rows cannot be read, agents are not held up', async ($, on) => {
  const { seen } = standIns(on)
  on('state.get', (_, e, next) => {
    // An answer with no value: the read fails. (A hook that throws is skipped by the engine, and the read goes on.)
    if (e.key === 'agents') return { value: undefined } as never
    return next(e)
  })
  await start($)
  await turn($, 'a1', 'start')
  expect((await tool($, 'a1', 'ls')).deny).toBeUndefined()
  expect((await step($, 'a1')).result.answer).toBe('ok')
  expect([seen.toolRuns, seen.modelCalls]).toEqual([1, 1])
})

test('a notification that takes its time holds up neither the warning nor the status line', { options: { repeatCount: 2 }, timeoutMs: 30_000 }, async ($, on) => {
  const { clock, seen } = standIns(on, [], { notifyMs: 60_000 })
  await start($)
  await spawn($, 'a1')
  await turn($, 'a1', 'start')
  await tool($, 'a1', 'ls')
  await tool($, 'a1', 'ls')
  await clock.advance(SEC)
  // The notification is under way and not yet answered; the warning is already written and counted.
  expect(seen.notices.map(n => n.text)).toEqual(['"Fix tests" made the same Bash call 2 times in a row'])
  expect((await readAlerts($)).map(a => a.key)).toEqual(['repeat:a1'])
  expect(seen.statuses.at(-1)).toBe('agents 1 running · 0 tok · 0s active · 1 warning')
  await clock.advance(60 * SEC)
})

test('rows read back after a reload start idle, with their open time folded in', { options: { activeMinutes: 1 }, timeoutMs: 30_000 }, async ($, on) => {
  const { clock } = standIns(on)
  const stored = {
    id: 'old', description: '', type: '', model: '', isTeammate: false, status: 'running', isStopped: false, inTurn: true,
    firstSeenAt: 0, lastActiveAt: 5000, activeMs: 1000, busySince: 2000, busy: 1, openTools: 1,
    tokens: { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 }, turns: 1, failStreak: 0,
  }
  on('state.get', (_, e, next) =>
    e.key === 'agents' ? { value: { value: { shape: 'agents-1', value: { old: stored } }, version: 0 } } : next(e))
  await start($)
  await spawn($, 'a1') // any event makes the next tick write the rows out
  await clock.advance(61 * SEC)
  expect((await readAlerts($)).map(a => a.key)).not.toContain('long:old')
  const old = (await readAgents($))['old']
  expect(old?.activeMs).toBe(4000)
  expect([old?.busy, old?.busySince, old?.openTools]).toEqual([0, null, 0])
  expect(old?.status).toBe('running')
})

test('a reload folds the read-back copy into a row made earlier', async ($, on) => {
  const { clock, setUsage } = standIns(on)
  const copy = {
    id: 'tm', description: 'Fix tests', type: 'general-purpose', model: 'm0', isTeammate: true, permissionMode: 'bypassPermissions',
    status: 'idle', isStopped: false, inTurn: false, firstSeenAt: 0, lastActiveAt: 3000, activeMs: 3000, busySince: null, busy: 0, openTools: 0,
    tokens: { input: 5000, cacheWrite: 0, cacheRead: 0, output: 0 }, turns: 2, failStreak: 0,
  }
  let release = () => {}
  const gate = new Promise<void>(resolve => { release = resolve })
  let isReadBack = true
  on('state.get', async (_, e, next) => {
    if (e.key !== 'agents' || !isReadBack) return next(e)
    isReadBack = false
    await gate
    return { value: { value: { shape: 'agents-1', value: { tm: copy } }, version: 0 } }
  })
  const starting = start($)
  // The teammate wakes, works and rests before the read-back is done: this instance made a bare row for it.
  setUsage(usage({ input_tokens: 10 }))
  await turn($, 'tm', 'start')
  await step($, 'tm')
  await turn($, 'tm', 'end')
  release()
  await starting
  await clock.advance(SEC)
  const row = (await readAgents($))['tm']!
  expect(label(row)).toBe('Fix tests')
  expect(row.isTeammate).toBe(true)
  expect(row.status).toBe('idle')
  expect(row.tokens.input).toBe(5010)
  expect(row.activeMs).toBeGreaterThanOrEqual(3000)
  expect(row.turns).toBe(3)
  // What the copy held was reported before the reload: only the 10 tokens are new, and the agent is not new.
  await turn($, undefined, 'start')
  await turn($, undefined, 'end')
  expect((await readState($, 'summary') as Summary | null)?.text).toStartWith('1 agent · 10 tok')
  expect((await readState($, 'summary') as Summary | null)?.text).not.toContain('new')
})

test('notifications run one at a time', { options: { repeatCount: 2 }, timeoutMs: 30_000 }, async ($, on) => {
  const { clock, seen } = standIns(on, [], { notifyMs: 60_000 })
  await start($)
  for (const id of ['a1', 'a2']) {
    await spawn($, id)
    await turn($, id, 'start')
    await tool($, id, 'ls')
    await tool($, id, 'ls')
  }
  await clock.advance(SEC)
  // Both warnings were delivered in one flush, which is over (the status line shows them); only the first notification runs.
  expect(seen.statuses.at(-1)).toContain('2 warnings')
  expect(seen.notices.length).toBe(1)
  await clock.advance(30 * SEC)
  expect(seen.notices.length).toBe(1)
  await clock.advance(30 * SEC)
  expect(seen.notices.length).toBe(2)
  await clock.advance(60 * SEC)
})

test('ticks during a held write start no second flush', { timeoutMs: 30_000 }, async ($, on) => {
  const { clock, holdWrites, writes } = standIns(on)
  await start($)
  await spawn($, 'a1')
  await turn($, 'a1', 'start')
  const run = tool($, 'a1', 'sleep 12000')
  await clock.advance(SEC)
  holdWrites(5 * SEC)
  const before = writes.total
  // The agent is busy, so every tick would ask for a flush; the first one is held for 5 s per write.
  await tool($, 'a1', 'ls')
  await clock.advance(10 * SEC)
  expect(writes.total).toBeGreaterThan(before)
  expect(writes.max).toBe(1)
  await clock.advance(30 * SEC)
  await run
  expect(writes.max).toBe(1)
})

test('the agent list ends rows the engine reports ended', { timeoutMs: 30_000 }, async ($, on) => {
  const listed: unknown[] = []
  const { clock, seen } = standIns(on, listed as never)
  await start($)
  await spawn($, 'a1')
  await clock.advance(2 * SEC)
  expect(seen.statuses.at(-1)).toBe('agents 1 running · 0 tok · 0s active')
  // The engine now reports the agent completed, though no turn.complete came for it.
  listed.push({ id: 'a1', status: 'completed' })
  await clock.advance(10 * SEC)
  expect((await readAgents($))['a1']?.status).toBe('done')
  expect(seen.statuses.at(-1)).toBe(undefined)
})

test('the agent list leaves alone the rows it does not name or reports running', { timeoutMs: 30_000 }, async ($, on) => {
  const { clock } = standIns(on, [{ id: 'a2', status: 'running' }, { id: 'ghost', status: 'killed' }] as never)
  await start($)
  await spawn($, 'a1')
  await spawn($, 'a2')
  await clock.advance(12 * SEC)
  const rows = await readAgents($)
  expect(Object.keys(rows).sort()).toEqual(['a1', 'a2'])
  expect([rows['a1']?.status, rows['a2']?.status]).toEqual(['running', 'running'])
})

test('the agent list leaves a row alone while it has an open tool', { timeoutMs: 30_000 }, async ($, on) => {
  const { clock } = standIns(on, [{ id: 'a1', status: 'failed' }] as never)
  await start($)
  await spawn($, 'a1')
  await turn($, 'a1', 'start')
  const run = tool($, 'a1', 'sleep 20000')
  await clock.advance(12 * SEC)
  expect((await readAgents($))['a1']?.status).toBe('running')
  await clock.advance(10 * SEC)
  await run
  await clock.advance(11 * SEC)
  expect((await readAgents($))['a1']?.status).toBe('failed')
})

test('a row that started a new turn while the agent list was pending is not ended by the old answer', { timeoutMs: 30_000 }, async ($, on) => {
  const { clock, seen, holdList, releaseList } = standIns(on, [{ id: 'a1', status: 'completed' }] as never)
  await start($)
  await spawn($, 'a1')
  await turn($, 'a1', 'start')
  await turn($, 'a1', 'end')
  holdList()
  await clock.advance(2 * SEC) // the tick asks for the list and waits for the answer
  // The agent resumes while the answer, which was true when it was made, is on its way.
  await spawn($, 'a1', { resume: { agentId: 'a1' } } as never)
  await turn($, 'a1', 'start')
  releaseList()
  await clock.advance(2 * SEC)
  const row = (await readAgents($))['a1']
  expect([row?.status, row?.inTurn]).toEqual(['running', true])
  expect(seen.statuses.at(-1)).toBe('agents 1 running · 0 tok · 0s active')
})

test('tool calls that end by a throw leave the failure streak alone and raise no failure warning', { options: { failStreak: 3 } }, async ($, on) => {
  const { clock } = standIns(on)
  await start($)
  await spawn($, 'a1')
  await turn($, 'a1', 'start')
  for (let i = 0; i < 3; i += 1) await tool($, 'a1', 'throw').catch(() => undefined)
  await clock.advance(SEC)
  expect((await readAgents($))['a1']?.failStreak).toBe(0)
  expect((await readAlerts($)).map(a => a.key)).toEqual([])
  // The same three calls that return an error do raise it.
  for (let i = 0; i < 3; i += 1) await tool($, 'a1', 'fail')
  await clock.advance(SEC)
  expect((await readAgents($))['a1']?.failStreak).toBe(3)
  expect((await readAlerts($)).map(a => a.key)).toEqual(['failures:a1'])
})

test('a button pressed during the read-back keeps the stored warnings', { options: { repeatCount: 2 } }, async ($, on) => {
  const { clock, setUsage } = standIns(on)
  const stored = { key: 'repeat:a1', kind: 'repeat', agentId: 'a1', at: 12_345, text: '"Fix tests" made the same Bash call 2 times' }
  // Also stored: a row with its warning, and that warning's dismissal.
  const oldRow = {
    id: 'old', description: 'Old job', type: '', model: '', isTeammate: false, status: 'done', isStopped: false, inTurn: false,
    firstSeenAt: 0, lastActiveAt: 0, activeMs: 1000, busySince: null, busy: 0, openTools: 0,
    tokens: { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 }, turns: 1, failStreak: 0,
  }
  const oldAlert = { key: 'long:old', kind: 'long', agentId: 'old', at: 5, text: '"Old job" has worked 31m (limit 30m)' }
  let release = () => {}
  const gate = new Promise<void>(resolve => { release = resolve })
  // The read-back finds what the store holds at the moment it reads: the stored warning, or whatever was written over it.
  // (The pane's own reads of the alerts go through; the mod reads the agents first, so its read of the alerts is the one after the gate.)
  let isGated = true
  let isAlertsRead = false
  let isDismissedRead = false
  on('state.get', async (_, e, next) => {
    if (e.key === 'agents' && isGated) {
      isGated = false
      await gate
      isAlertsRead = true
      return { value: { value: { shape: 'agents-1', value: { old: oldRow } }, version: 0 } }
    }
    if (e.key === 'alerts' && isAlertsRead) {
      isAlertsRead = false
      isDismissedRead = true
      const written = await readState($, 'alerts')
      return { value: { value: { shape: 'alerts-1', value: written ?? [stored, oldAlert] }, version: 0 } }
    }
    if (e.key === 'dismissed' && isDismissedRead) {
      isDismissedRead = false
      const written = await readState($, 'dismissed')
      return { value: { value: written ?? ['long:old'], version: 0 } }
    }
    return next(e)
  })
  const starting = start($)
  // A summary exists while the read-back still waits, and its Dismiss is pressed.
  await spawn($, 'a1')
  setUsage(usage({ input_tokens: 100 }))
  await turn($, 'a1', 'start')
  await step($, 'a1')
  await turn($, undefined, 'end')
  const at = ((await readState($, 'summary')) as Summary).at
  const ui = await mountPane($, 'terminal')
  await ui.press({ key: 'summary/dismiss' })
  await ui.unmount()
  release()
  await starting
  await clock.advance(SEC)
  expect(await readAlerts($)).toEqual([stored, oldAlert])
  expect(await readState($, 'dismissed')).toEqual(['long:old', `summary:${at}`])
  expect((await readAgents($))['old']?.activeMs).toBe(1000)
  // The stored warning counts as raised: the same two calls do not raise it again.
  await tool($, 'a1', 'ls')
  await tool($, 'a1', 'ls')
  await clock.advance(SEC)
  expect(await readAlerts($)).toEqual([stored, oldAlert])
})

test('a dismissed key is dropped once its alert is trimmed away, and a kept alert stays dismissed', { options: { repeatCount: 2, burstCount: 1000 }, timeoutMs: 60_000 }, async ($, on) => {
  const { clock } = standIns(on)
  await start($)
  const warn = async (id: string) => {
    await spawn($, id)
    await turn($, id, 'start')
    await tool($, id, 'ls')
    await tool($, id, 'ls')
  }
  await warn('a0')
  await warn('a1')
  await clock.advance(SEC)
  const ui = await mountPane($, 'terminal')
  await ui.press({ key: 'repeat:a0/dismiss' })
  await ui.press({ key: 'repeat:a1/dismiss' })
  await ui.unmount()
  expect(await readState($, 'dismissed')).toEqual(['repeat:a0', 'repeat:a1'])
  // 49 more warnings: the 51st trims repeat:a0, the oldest of 51.
  for (let i = 2; i < 51; i += 1) await warn(`a${i}`)
  await clock.advance(SEC)
  expect((await readAlerts($)).length).toBe(50)
  expect(await readState($, 'dismissed')).toEqual(['repeat:a1'])
})

test('a description, a type and a model are recorded as one plain line', async ($, on) => {
  const { clock } = standIns(on)
  await start($)
  await spawn($, 'a1', { description: 'Fix\u001b[2J\ntests', subagentType: 'Ex\u0007plore', model: 'm\u001b1' })
  await clock.advance(SEC)
  const row = (await readAgents($))['a1']
  expect([row?.description, row?.type, row?.model]).toEqual(['Fix [2J tests', 'Ex plore', 'm 1'])
})

test('a key split by a direction control is still masked at intake', async ($, on) => {
  const { clock } = standIns(on)
  await start($)
  await spawn($, 'a1', { description: `deploy ${fakeKey.slice(0, 10)}\u202E${fakeKey.slice(10)}` })
  await clock.advance(SEC)
  expect((await readAgents($))['a1']?.description).toBe('deploy [redacted]')
})

test('a notification is one plain line', { options: { repeatCount: 2 } }, async ($, on) => {
  const { clock, seen } = standIns(on)
  await start($)
  await spawn($, 'a1', { description: 'Fix\u001b tests' })
  await turn($, 'a1', 'start')
  await tool($, 'a1', 'ls')
  await tool($, 'a1', 'ls')
  await clock.advance(SEC)
  expect(seen.notices.map(n => n.text)).toEqual(['"Fix tests" made the same Bash call 2 times in a row'])
})

test('a stored row that cannot be joined does not make the read-back run again', async ($, on) => {
  const { clock } = standIns(on)
  const good = {
    id: 'good', description: 'Good job', type: '', model: '', isTeammate: false, status: 'done', isStopped: false, inTurn: false,
    firstSeenAt: 0, lastActiveAt: 0, activeMs: 1000, busySince: null, busy: 0, openTools: 0,
    tokens: { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 }, turns: 1, failStreak: 0,
  }
  const oldAlert = { key: 'long:good', kind: 'long', agentId: 'good', at: 0, text: '"Good job" has worked 31m (limit 30m)' }
  // The second stored row has no token counts: joining it throws.
  on('state.get', (_, e, next) => {
    if (stateVersion('agents') > 0) return next(e)
    if (e.key === 'agents') return { value: { value: { shape: 'agents-1', value: { good, bad: { id: 'bad' } } }, version: 0 } }
    if (e.key === 'alerts') return { value: { value: { shape: 'alerts-1', value: [oldAlert] }, version: 0 } }
    return next(e)
  })
  await start($)
  await clock.advance(3 * SEC)
  expect(stateVersion('agents')).toBeGreaterThan(0)
  expect((await readAgents($))['good']?.activeMs).toBe(1000)
  expect((await readAlerts($)).map(a => a.key)).toEqual(['long:good'])
})

test('a very long description, type or model is kept only as far as it can be shown', async ($, on) => {
  const { clock } = standIns(on)
  await start($)
  await spawn($, 'a1', { description: 'word '.repeat(1000), subagentType: 'y'.repeat(500), model: 'z'.repeat(500) })
  await clock.advance(SEC)
  const row = (await readAgents($))['a1']
  expect(row?.description).toBe('word '.repeat(40))
  expect([row?.type, row?.model]).toEqual(['y'.repeat(100), 'z'.repeat(100)])
})

test('a muted kind raises no alert, no notification and no warning in the status line', { options: { mute: 'repeat', repeatCount: 2 } }, async ($, on) => {
  const { clock, seen } = standIns(on)
  await start($)
  await spawn($, 'a1')
  await turn($, 'a1', 'start')
  await tool($, 'a1', 'ls')
  await tool($, 'a1', 'ls')
  await clock.advance(SEC)
  expect(await readAlerts($)).toEqual([])
  expect(seen.notices).toEqual([])
  expect(seen.statuses.at(-1)).not.toContain('warning')
})

test('a stored Stop record survives a read-back, and a new one joins it', async ($, on) => {
  const { clock } = standIns(on)
  const old = { id: 'old', label: 'Old job', at: 5, tokens: 10, activeMs: 1000, lastTool: 'Read' }
  on('state.get', (_, e, next) =>
    e.key === 'stops' && stateVersion('stops') === 0 ? { value: { value: { shape: 'stops-1', value: [old] }, version: 0 } } : next(e))
  await start($)
  await clock.advance(SEC)
  expect(await readState($, 'stops')).toEqual([old])
  await spawn($, 'a1', { description: 'job a1' })
  await turn($, 'a1', 'start')
  await tool($, 'a1', 'ls')
  await clock.advance(SEC)
  const ui = await mountPane($, 'terminal')
  await ui.press({ key: 'a1/stop' })
  await ui.press({ key: 'a1/confirm' })
  const kept = (await readState($, 'stops')) as { id: string; label: string; lastTool: string }[]
  expect(kept.map(r => r.id)).toEqual(['old', 'a1'])
  expect([kept[1]?.label, kept[1]?.lastTool]).toEqual(['job a1', 'Bash'])
  await ui.unmount()
})

test('a Stop confirmed twice in a row is recorded once', async ($, on) => {
  const { clock } = standIns(on)
  await start($)
  await spawn($, 'a1', { description: 'job a1' })
  await turn($, 'a1', 'start')
  await clock.advance(SEC)
  const ui = await mountPane($, 'terminal')
  await ui.press({ key: 'a1/stop' })
  // Both presses reach the button before the pane is drawn again, as a quick double click would.
  await Promise.all([ui.press({ key: 'a1/confirm' }), ui.press({ key: 'a1/confirm' })])
  await clock.advance(SEC)
  expect(((await readState($, 'stops')) as unknown[]).length).toBe(1)
  await ui.unmount()
})

test('a subagent turn that ends with no Stop confirm open writes no confirm', async ($, on) => {
  const { clock } = standIns(on)
  await start($)
  await spawn($, 'a1')
  await turn($, 'a1', 'start')
  await clock.advance(SEC)
  const before = stateVersion('confirm')
  await turn($, 'a1', 'end')
  await clock.advance(SEC)
  expect(stateVersion('confirm')).toBe(before)
})
