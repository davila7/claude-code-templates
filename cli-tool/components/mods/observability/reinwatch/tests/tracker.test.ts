import { expect, test } from 'claude-code/testing'
import { fingerprint } from '../hooks/fingerprint'
import { NESTED_TOOLS, activeMs, adoptReadBack, allowResume, endListed, foldReadBack, endMainTurn, listDue, markStopped, newTracker, noteSpawn,
  newTokens, stepEnded, stepStarted, toolEnded, toolRunning, toolStarted, turnEnded, turnStarted, type Tracker } from '../hooks/tracker'
import type { AgentRow } from '../types'

const MIN = 60_000
const spawn = (t: Tracker, id: string, now = 0, extra = {}) =>
  noteSpawn(t, { agentId: id, description: 'Fix tests', type: 'general-purpose', model: 'm1', isTeammate: false, isResume: false, ...extra }, now)
const use = (u: Partial<Record<'input_tokens' | 'output_tokens' | 'cache_read_input_tokens' | 'cache_creation_input_tokens', number>>) =>
  ({ input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'm2', ...u })
// A call that is made but does not run yet (it waits on a permission check).
const callWaiting = (t: Tracker, id: string, c: string, at: number, tool = 'Bash', key = 'k') => toolStarted(t, { agentId: id, toolUseId: c, tool, key }, at)
// A call that runs as soon as it is made.
const call = (t: Tracker, id: string, c: string, at: number, tool = 'Bash', key = 'k') => {
  const count = callWaiting(t, id, c, at, tool, key)
  toolRunning(t, c, at)
  return count
}
// The row as the tracker holds it right now. Read it again after each event instead of keeping an old reference.
const rowOf = (t: Tracker, id: string): AgentRow => {
  const row = t.agents[id]
  if (row === undefined) throw new Error(`the tracker has no row for ${id}`)
  return row
}

test('a spawn makes a running row', () => {
  const t = newTracker()
  expect(spawn(t, 'a1')).toBe(rowOf(t, 'a1'))
  expect(rowOf(t, 'a1').status).toBe('running')
  expect(rowOf(t, 'a1').description).toBe('Fix tests')
  expect(rowOf(t, 'a1').turns).toBe(0)
  expect(rowOf(t, 'a1').tokens).toEqual({ input: 0, cacheWrite: 0, cacheRead: 0, output: 0 })
})

test('steps add tokens per field and time', () => {
  const t = newTracker()
  spawn(t, 'a1')
  stepStarted(t, 'a1', 0)
  stepEnded(t, 'a1', use({ input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 300, cache_creation_input_tokens: 40 }), 5000)
  expect(rowOf(t, 'a1').tokens).toEqual({ input: 10, cacheWrite: 40, cacheRead: 300, output: 20 })
  expect(activeMs(rowOf(t, 'a1'), 5000)).toBe(5000)
  expect(rowOf(t, 'a1').model).toBe('m2')
})

test('overlapping tool calls count wall time once', () => {
  const t = newTracker()
  spawn(t, 'a1')
  call(t, 'a1', 'c1', 0)
  call(t, 'a1', 'c2', 1000)
  toolEnded(t, 'c1', 'ok', 3000)
  toolEnded(t, 'c2', 'ok', 4000)
  expect(activeMs(rowOf(t, 'a1'), 4000)).toBe(4000)
})

test('idle time between turns is not counted', () => {
  const t = newTracker()
  spawn(t, 'a1')
  stepStarted(t, 'a1', 0)
  stepEnded(t, 'a1', null, MIN)
  turnEnded(t, 'a1', 'answer', MIN)
  turnStarted(t, 'a1', 531 * MIN)
  stepStarted(t, 'a1', 531 * MIN)
  stepEnded(t, 'a1', null, 532 * MIN)
  expect(activeMs(rowOf(t, 'a1'), 600 * MIN)).toBe(2 * MIN)
})

test('a call counts only from when it runs', () => {
  const t = newTracker()
  spawn(t, 'a1')
  callWaiting(t, 'a1', 'c1', 0)
  expect(activeMs(rowOf(t, 'a1'), 600_000)).toBe(0)
  toolRunning(t, 'c1', 600_000)
  toolEnded(t, 'c1', 'ok', 660_000)
  expect(activeMs(rowOf(t, 'a1'), 3_600_000)).toBe(60_000)
})

test("Agent and Workflow calls are not the parent's time", () => {
  const t = newTracker()
  spawn(t, 'a1')
  expect(call(t, 'a1', 'c1', 0, 'Agent')).toBe(1)
  expect(call(t, 'a1', 'c2', MIN, 'Workflow', 'k2')).toBe(1)
  toolEnded(t, 'c2', 'ok', 5 * MIN)
  toolEnded(t, 'c1', 'ok', 10 * MIN)
  expect(activeMs(rowOf(t, 'a1'), 10 * MIN)).toBe(0)
})

test('repeats count the same call in a row, per agent; a different call starts over', () => {
  const t = newTracker()
  spawn(t, 'a1')
  spawn(t, 'a2')
  expect(call(t, 'a1', 'c1', 0)).toBe(1)
  expect(call(t, 'a1', 'c2', 0)).toBe(2)
  expect(call(t, 'a2', 'c3', 0)).toBe(1)     // another agent has its own run
  expect(call(t, 'a1', 'c4', 0, 'Bash', 'k2')).toBe(1)   // a different call ends a1's run
  expect(call(t, 'a1', 'c5', 0, 'Bash', 'k2')).toBe(2)
  expect(call(t, 'a1', 'c6', 0)).toBe(1)     // back to the first call: a new run
})

test('failure streak: errors add, success resets, denials leave it', () => {
  const t = newTracker()
  spawn(t, 'a1')
  const finish = (id: string, outcome: 'ok' | 'error' | 'denied') => {
    call(t, 'a1', id, 0)
    toolEnded(t, id, outcome, 0)
    return rowOf(t, 'a1').failStreak
  }
  expect(finish('c1', 'error')).toBe(1)
  expect(finish('c2', 'error')).toBe(2)
  expect(finish('c3', 'denied')).toBe(2)
  expect(finish('c4', 'error')).toBe(3)
  expect(finish('c5', 'ok')).toBe(0)
})

test('turn end closes open time and drops open calls', () => {
  const t = newTracker()
  spawn(t, 'a1')
  stepStarted(t, 'a1', 0)
  call(t, 'a1', 'c1', 0)
  turnEnded(t, 'a1', 'answer', 10_000)
  expect(activeMs(rowOf(t, 'a1'), 99_999)).toBe(10_000)
  expect(rowOf(t, 'a1').busy).toBe(0)
  expect(rowOf(t, 'a1').openTools).toBe(0)
  expect(rowOf(t, 'a1').status).toBe('done')
  expect(t.calls).toEqual({})
  spawn(t, 'tm', 0, { isTeammate: true })
  turnEnded(t, 'tm', 'answer', 10_000)
  expect(rowOf(t, 'tm').status).toBe('idle')
  spawn(t, 'bad')
  turnEnded(t, 'bad', 'error', 10_000)
  expect(rowOf(t, 'bad').status).toBe('failed')
})

test('stop waits for a running tool; resume restores the status', () => {
  const t = newTracker()
  spawn(t, 'a1')
  call(t, 'a1', 'c1', 0)
  markStopped(t, 'a1', 1)
  expect(rowOf(t, 'a1').status).toBe('stopping')
  expect(rowOf(t, 'a1').isStopped).toBe(true)
  toolEnded(t, 'c1', 'ok', 2)
  expect(rowOf(t, 'a1').status).toBe('stopped')
  allowResume(t, 'a1', 3)
  expect(rowOf(t, 'a1').status).toBe('running')
  expect(rowOf(t, 'a1').isStopped).toBe(false)
  markStopped(t, 'a1', 4)
  turnEnded(t, 'a1', 'answer', 5)
  expect(rowOf(t, 'a1').status).toBe('stopped')
  allowResume(t, 'a1', 6)
  expect(rowOf(t, 'a1').status).toBe('done')
})

test('an id first seen without a spawn gets a placeholder row', () => {
  const t = newTracker()
  stepStarted(t, 'zzz', 5)
  expect(t.agents.zzz).toMatchObject({ id: 'zzz', description: '', type: '', model: '', isTeammate: false, status: 'running', inTurn: true,
    firstSeenAt: 5, lastActiveAt: 5 })
})

test('each summary counts what changed since the last one', () => {
  const t = newTracker()
  spawn(t, 'a1')
  stepStarted(t, 'a1', 0)
  stepEnded(t, 'a1', use({ input_tokens: 1000 }), 1000)
  expect(endMainTurn(t, 2000)).toEqual({ agents: 1, newAgents: 1, tokens: 1000, activeMs: 1000, longest: { id: 'a1', activeMs: 1000 }, rows: [{ id: 'a1', tokens: 1000, activeMs: 1000, totalTokens: 1000, totalActiveMs: 1000 }] })
  stepStarted(t, 'a1', 3000)
  stepEnded(t, 'a1', use({ output_tokens: 500 }), 5000)
  spawn(t, 'a2', 6000)
  stepStarted(t, 'a2', 6000)
  stepEnded(t, 'a2', use({ input_tokens: 300 }), 7000)
  // The rows hold only this turn's difference (a1 was reported before), longest first.
  expect(endMainTurn(t, 8000)).toEqual({ agents: 2, newAgents: 1, tokens: 800, activeMs: 3000, longest: { id: 'a1', activeMs: 2000 },
    rows: [{ id: 'a1', tokens: 500, activeMs: 2000, totalTokens: 1500, totalActiveMs: 3000 }, { id: 'a2', tokens: 300, activeMs: 1000, totalTokens: 300, totalActiveMs: 1000 }] })
  expect(endMainTurn(t, 9000)).toBeNull()
  expect(endMainTurn(t, 11_000)).toBeNull()
})

test('a summary row also carries the agent whole reported total', () => {
  const t = newTracker()
  spawn(t, 'a1')
  stepStarted(t, 'a1', 0)
  stepEnded(t, 'a1', use({ input_tokens: 10 }), 1000)
  endMainTurn(t, 1000)
  stepStarted(t, 'a1', 2000)
  stepEnded(t, 'a1', use({ input_tokens: 20 }), 4000)
  expect(endMainTurn(t, 4000)?.rows[0]).toEqual({ id: 'a1', tokens: 20, activeMs: 2000, totalTokens: 30, totalActiveMs: 3000 })
})

test('a fold keeps the last tool of the copy when this row has none', () => {
  const t = newTracker()
  spawn(t, 'a1')
  const copy = { ...t.agents['a1']!, lastTool: 'Bash' }
  foldReadBack(t, t.agents['a1']!, copy)
  expect(t.agents['a1']?.lastTool).toBe('Bash')
  foldReadBack(t, t.agents['a1']!, { ...copy, lastTool: 'Read' })
  expect(t.agents['a1']?.lastTool).toBe('Bash')
})

test('work done between two summaries is in the next one, whenever it was done', () => {
  const t = newTracker()
  spawn(t, 'a1')
  stepStarted(t, 'a1', 0)
  stepEnded(t, 'a1', use({ input_tokens: 1000 }), 1000)
  expect(endMainTurn(t, 1000)).toMatchObject({ tokens: 1000 })
  // A background agent works long after that summary, while the main conversation is idle.
  spawn(t, 'bg', 50_000, { isTeammate: true })
  stepStarted(t, 'bg', 50_000)
  stepEnded(t, 'bg', use({ output_tokens: 5000 }), 60_000)
  turnEnded(t, 'bg', 'answer', 60_000)
  expect(endMainTurn(t, 900_000)).toEqual({ agents: 1, newAgents: 1, tokens: 5000, activeMs: 10_000, longest: { id: 'bg', activeMs: 10_000 }, rows: [{ id: 'bg', tokens: 5000, activeMs: 10_000, totalTokens: 5000, totalActiveMs: 10_000 }] })
  expect(endMainTurn(t, 901_000)).toBeNull()
})

test('fingerprint ignores call ids and key order', () => {
  expect(fingerprint('Bash', { command: 'ls', tool_use_id: '1', agentId: 'a' })).toBe(fingerprint('Bash', { agentId: 'b', tool_use_id: '2', command: 'ls' }))
  expect(fingerprint('Bash', { command: 'ls' })).not.toBe(fingerprint('Bash', { command: 'ls -a' }))
  expect(fingerprint('Bash', { command: 'ls' })).not.toBe(fingerprint('Read', { command: 'ls' }))
  expect(fingerprint('X', { a: { x: 1, y: 2 } })).toBe(fingerprint('X', { a: { y: 2, x: 1 } }))
})

// Rules the tests above do not reach.

test('starts are kept for the burst and run counts; a resume is not a start', () => {
  const t = newTracker()
  spawn(t, 'a1', 100, { runId: 'wf_1' })
  spawn(t, 'a2', 200, { runId: 'wf_1' })
  spawn(t, 'a3', 300)
  expect(t.spawns).toEqual([100, 200, 300])
  expect(t.runs).toEqual({ wf_1: 2 })
  turnEnded(t, 'a1', 'answer', 350)
  expect(rowOf(t, 'a1').status).toBe('done')
  spawn(t, 'a1', 400, { runId: 'wf_1', isResume: true })
  expect(t.spawns).toEqual([100, 200, 300])
  expect(t.runs).toEqual({ wf_1: 2 })
  expect(rowOf(t, 'a1').status).toBe('running')
})

test('a spawn fills in the row an earlier event made and keeps what it counted', () => {
  const t = newTracker()
  stepStarted(t, 'a1', 0)
  stepEnded(t, 'a1', use({ output_tokens: 7 }), 500)
  spawn(t, 'a1', 600, { parentId: 'p1', runId: 'wf_1', isTeammate: true })
  expect(rowOf(t, 'a1')).toMatchObject({ description: 'Fix tests', type: 'general-purpose', parentId: 'p1', runId: 'wf_1',
    isTeammate: true, status: 'running', firstSeenAt: 0, lastActiveAt: 600 })
  expect(rowOf(t, 'a1').tokens.output).toBe(7)
  expect(activeMs(rowOf(t, 'a1'), 600)).toBe(500)
})

test('every event marks its agent active at that moment', () => {
  const t = newTracker()
  spawn(t, 'a1', 1)
  expect(rowOf(t, 'a1').lastActiveAt).toBe(1)
  const events: [number, () => unknown][] = [
    [5, () => spawn(t, 'a1', 5, { isResume: true })],
    [10, () => turnStarted(t, 'a1', 10)],
    [20, () => stepStarted(t, 'a1', 20)],
    [30, () => callWaiting(t, 'a1', 'c1', 30)],
    [40, () => toolRunning(t, 'c1', 40)],
    [50, () => stepEnded(t, 'a1', null, 50)],
    [60, () => toolEnded(t, 'c1', 'ok', 60)],
    [70, () => markStopped(t, 'a1', 70)],
    [80, () => allowResume(t, 'a1', 80)],
    [90, () => turnEnded(t, 'a1', 'answer', 90)],
  ]
  for (const [at, run] of events) {
    run()
    expect(rowOf(t, 'a1').lastActiveAt).toBe(at)
  }
})

test('an ended agent rests as done, a teammate as idle, and only an error makes it failed', () => {
  const t = newTracker()
  const restedAs = (id: string, reason: 'answer' | 'aborted' | 'refusal' | 'error', extra = {}) => {
    spawn(t, id, 0, extra)
    turnEnded(t, id, reason, 1)
    return rowOf(t, id).status
  }
  expect([restedAs('a', 'answer'), restedAs('b', 'aborted'), restedAs('c', 'refusal'), restedAs('d', 'error'),
    restedAs('e', 'aborted', { isTeammate: true }), restedAs('f', 'error', { isTeammate: true })])
    .toEqual(['done', 'done', 'done', 'failed', 'idle', 'failed'])
  markStopped(t, 'e', 2)
  allowResume(t, 'e', 3)
  expect(rowOf(t, 'e').status).toBe('idle')
})

test('a tool end never takes openTools below 0', () => {
  const t = newTracker()
  spawn(t, 'a1')
  call(t, 'a1', 'c1', 0)
  // As a row read back after a reload has it: no open tools, though this call began in this instance.
  rowOf(t, 'a1').openTools = 0
  markStopped(t, 'a1', 5)
  toolEnded(t, 'c1', 'ok', 10)
  expect(rowOf(t, 'a1').openTools).toBe(0)
  expect(rowOf(t, 'a1').status).toBe('stopped')
})

test('stopping lasts until the last running tool ends', () => {
  const t = newTracker()
  spawn(t, 'a1')
  call(t, 'a1', 'c1', 0)
  call(t, 'a1', 'c2', 0, 'Bash', 'k2')
  markStopped(t, 'a1', 1)
  toolEnded(t, 'c1', 'ok', 2)
  expect(rowOf(t, 'a1').status).toBe('stopping')
  toolEnded(t, 'c2', 'ok', 3)
  expect(rowOf(t, 'a1').status).toBe('stopped')
})

test('a new turn is counted, and a stopped agent stays stopped through it', () => {
  const t = newTracker()
  spawn(t, 'a1')
  turnStarted(t, 'a1', 1)
  expect(rowOf(t, 'a1')).toMatchObject({ turns: 1, inTurn: true, status: 'running' })
  turnEnded(t, 'a1', 'answer', 2)
  expect(rowOf(t, 'a1')).toMatchObject({ turns: 1, inTurn: false, status: 'done' })
  turnStarted(t, 'a1', 3)
  expect(rowOf(t, 'a1')).toMatchObject({ turns: 2, inTurn: true, status: 'running' })
  markStopped(t, 'a1', 4)
  turnEnded(t, 'a1', 'answer', 5)
  turnStarted(t, 'a1', 6)
  expect(rowOf(t, 'a1').status).toBe('stopped')
  call(t, 'a1', 'c1', 7)
  turnStarted(t, 'a1', 8)
  expect(rowOf(t, 'a1').status).toBe('stopping')
})

test('a call that never runs is open but adds no time; unknown ids change nothing', () => {
  const t = newTracker()
  spawn(t, 'a1')
  callWaiting(t, 'a1', 'c1', 0)
  expect(rowOf(t, 'a1')).toMatchObject({ openTools: 1, busy: 0, busySince: null })
  toolEnded(t, 'c1', 'denied', 3_600_000)
  expect(rowOf(t, 'a1')).toMatchObject({ openTools: 0, busy: 0, status: 'running' })
  expect(activeMs(rowOf(t, 'a1'), 3_600_000)).toBe(0)
  expect(t.calls).toEqual({})
  const before = JSON.stringify(t)
  toolRunning(t, 'nope', 5)
  toolEnded(t, 'nope', 'error', 5)
  expect(JSON.stringify(t)).toBe(before)
})

test("a call that waits leaves another call's time running", () => {
  const t = newTracker()
  spawn(t, 'a1')
  call(t, 'a1', 'c2', 0, 'Bash', 'k2')
  callWaiting(t, 'a1', 'c1', 0)
  toolEnded(t, 'c1', 'denied', 1500)
  toolEnded(t, 'c2', 'ok', 3000)
  expect(activeMs(rowOf(t, 'a1'), 3000)).toBe(3000)
})

test('a nested call that ends inside a model call leaves that call counting', () => {
  const t = newTracker()
  spawn(t, 'a1')
  stepStarted(t, 'a1', 0)
  call(t, 'a1', 'c1', 1000, 'Agent')
  toolEnded(t, 'c1', 'ok', 2000)
  stepEnded(t, 'a1', null, 5000)
  expect(activeMs(rowOf(t, 'a1'), 5000)).toBe(5000)
})

test("a nested call stays open without being busy, and a turn end drops only its own agent's calls", () => {
  expect([...NESTED_TOOLS].sort()).toEqual(['Agent', 'Workflow'])
  const t = newTracker()
  spawn(t, 'a1')
  spawn(t, 'a2')
  call(t, 'a1', 'c1', 0, 'Agent')
  call(t, 'a2', 'c2', 0)
  expect(rowOf(t, 'a1')).toMatchObject({ openTools: 1, busy: 0 })
  expect(rowOf(t, 'a2')).toMatchObject({ openTools: 1, busy: 1 })
  turnEnded(t, 'a1', 'answer', 10)
  expect(Object.keys(t.calls)).toEqual(['c2'])
  expect(rowOf(t, 'a2')).toMatchObject({ openTools: 1, busy: 1 })
  toolEnded(t, 'c1', 'error', 20)
  expect(rowOf(t, 'a1').failStreak).toBe(0)
})

test('tokens add up over steps; no usage adds nothing; an empty model keeps the known one', () => {
  const t = newTracker()
  spawn(t, 'a1')
  stepStarted(t, 'a1', 0)
  stepEnded(t, 'a1', null, 100)
  expect(rowOf(t, 'a1').tokens).toEqual({ input: 0, cacheWrite: 0, cacheRead: 0, output: 0 })
  expect(rowOf(t, 'a1').model).toBe('m1')
  stepStarted(t, 'a1', 200)
  stepEnded(t, 'a1', { ...use({ input_tokens: 5, output_tokens: 1, cache_read_input_tokens: 30, cache_creation_input_tokens: 4 }), model: '' }, 300)
  expect(rowOf(t, 'a1').model).toBe('m1')
  stepStarted(t, 'a1', 400)
  stepEnded(t, 'a1', use({ input_tokens: 7, output_tokens: 2, cache_read_input_tokens: 300, cache_creation_input_tokens: 40 }), 500)
  expect(rowOf(t, 'a1').tokens).toEqual({ input: 12, cacheWrite: 44, cacheRead: 330, output: 3 })
  expect(rowOf(t, 'a1').model).toBe('m2')
})

test('a step end that arrives after the turn closed does not break the busy count', () => {
  const t = newTracker()
  spawn(t, 'a1')
  stepStarted(t, 'a1', 0)
  turnEnded(t, 'a1', 'aborted', 10)
  stepEnded(t, 'a1', null, 20)
  expect(rowOf(t, 'a1').busy).toBe(0)
  stepStarted(t, 'a1', 30)
  stepEnded(t, 'a1', null, 40)
  expect(activeMs(rowOf(t, 'a1'), 99)).toBe(20)
})

test('an open interval counts up to now, and never backwards', () => {
  const t = newTracker()
  spawn(t, 'a1')
  stepStarted(t, 'a1', 1000)
  expect(activeMs(rowOf(t, 'a1'), 4000)).toBe(3000)
  call(t, 'a1', 'c1', 2000)
  stepEnded(t, 'a1', null, 5000)
  expect(activeMs(rowOf(t, 'a1'), 6000)).toBe(5000)
  toolEnded(t, 'c1', 'ok', 7000)
  expect(activeMs(rowOf(t, 'a1'), 9000)).toBe(6000)
  stepStarted(t, 'a1', 10_000)
  expect(activeMs(rowOf(t, 'a1'), 9500)).toBe(6000)
  stepEnded(t, 'a1', null, 9000)
  expect(activeMs(rowOf(t, 'a1'), 9500)).toBe(6000)
})

test('an interval still open at a summary counts up to it, and the rest goes to the next one', () => {
  const t = newTracker()
  spawn(t, 'a1')
  spawn(t, 'a2')
  stepStarted(t, 'a1', 1000)
  expect(endMainTurn(t, 2000)).toEqual({ agents: 1, newAgents: 1, tokens: 0, activeMs: 1000, longest: { id: 'a1', activeMs: 1000 }, rows: [{ id: 'a1', tokens: 0, activeMs: 1000, totalTokens: 0, totalActiveMs: 1000 }] })
  stepEnded(t, 'a1', use({ output_tokens: 10 }), 5000)
  stepStarted(t, 'a2', 2500)
  stepEnded(t, 'a2', use({ input_tokens: 20 }), 7500)
  expect(endMainTurn(t, 8000)).toEqual({ agents: 2, newAgents: 1, tokens: 30, activeMs: 8000, longest: { id: 'a2', activeMs: 5000 },
    rows: [{ id: 'a2', tokens: 20, activeMs: 5000, totalTokens: 20, totalActiveMs: 5000 }, { id: 'a1', tokens: 10, activeMs: 3000, totalTokens: 10, totalActiveMs: 4000 }] })
  expect(activeMs(rowOf(t, 'a1'), 8000)).toBe(4000)
})

test('a row with no new tokens or time is left out: a spawn alone, Stop, Allow resume', () => {
  const t = newTracker()
  spawn(t, 'a1', 2000)
  expect(endMainTurn(t, 2500)).toBeNull()
  stepStarted(t, 'a1', 3000)
  stepEnded(t, 'a1', use({ input_tokens: 5 }), 4000)
  // Its first work makes it a new agent, though it started before the last summary.
  expect(endMainTurn(t, 4000)).toEqual({ agents: 1, newAgents: 1, tokens: 5, activeMs: 1000, longest: { id: 'a1', activeMs: 1000 }, rows: [{ id: 'a1', tokens: 5, activeMs: 1000, totalTokens: 5, totalActiveMs: 1000 }] })
  markStopped(t, 'a1', 5000)
  allowResume(t, 'a1', 6000)
  expect(endMainTurn(t, 7000)).toBeNull()
})

test('a summary never takes back time a stale clock read closed short, and never counts it twice', () => {
  const t = newTracker()
  spawn(t, 'a1')
  stepStarted(t, 'a1', 1000)
  expect(endMainTurn(t, 5000)).toMatchObject({ activeMs: 4000 })
  // The step's end was read before the summary's time: the row now holds less than was reported.
  stepEnded(t, 'a1', use({ output_tokens: 7 }), 4000)
  expect(endMainTurn(t, 6000)).toEqual({ agents: 1, newAgents: 0, tokens: 7, activeMs: 0, longest: { id: 'a1', activeMs: 0 }, rows: [{ id: 'a1', tokens: 7, activeMs: 0, totalTokens: 7, totalActiveMs: 4000 }] })
  stepStarted(t, 'a1', 10_000)
  stepEnded(t, 'a1', null, 12_000)
  expect(endMainTurn(t, 13_000)).toEqual({ agents: 1, newAgents: 0, tokens: 0, activeMs: 1000, longest: { id: 'a1', activeMs: 1000 }, rows: [{ id: 'a1', tokens: 0, activeMs: 1000, totalTokens: 7, totalActiveMs: 5000 }] })
})

test('new tokens leave cache reads out', () => {
  expect(newTokens({ input: 10, cacheWrite: 20, cacheRead: 1000, output: 5 })).toBe(35)
})

test('fingerprint is FNV-1a over the tool, a NUL and the sorted JSON, as 8 hex digits', () => {
  // Reference values from a separate byte-wise FNV-1a over the same text.
  expect(fingerprint('Bash', { command: 'ls' })).toBe('451dfa5d')
  expect(fingerprint('X', {})).toBe('46fc3bc5')
  expect(fingerprint('Read', { n: 201 })).toBe('0dc1e9bc')
  expect(fingerprint('Read', { n: 10 })).toBe('8c76d2ac')
})

test("fingerprint leaves out a call's free-text description and the person's consent, at the top level only", () => {
  expect(fingerprint('Bash', { command: 'npm test', description: 'Run tests' }))
    .toBe(fingerprint('Bash', { command: 'npm test', description: 'Re-run tests' }))
  expect(fingerprint('PowerShell', { command: 'ls', description: 'List files', consent: 'The user pressed "1: Yes"' }))
    .toBe(fingerprint('PowerShell', { command: 'ls' }))
  expect(fingerprint('Bash', { command: 'npm test', description: 'Run tests' }))
    .not.toBe(fingerprint('Bash', { command: 'npm run build', description: 'Run tests' }))
  expect(fingerprint('X', { args: { description: 'a' } })).not.toBe(fingerprint('X', { args: { description: 'b' } }))
})

test('fingerprint leaves out the tool and requestMeta keys and keeps array order', () => {
  expect(fingerprint('Bash', { command: 'ls', tool: 'Bash', requestMeta: { id: 1 } })).toBe(fingerprint('Bash', { command: 'ls' }))
  expect(fingerprint('X', { list: [{ b: 1, a: 2 }] })).toBe(fingerprint('X', { list: [{ a: 2, b: 1 }] }))
  expect(fingerprint('X', { list: [1, 2] })).not.toBe(fingerprint('X', { list: [2, 1] }))
})

test('running a nested call, or the same call twice, adds no extra time', () => {
  const t = newTracker()
  spawn(t, 'a1')
  callWaiting(t, 'a1', 'n1', 0, 'Agent')
  toolRunning(t, 'n1', 0)
  expect(rowOf(t, 'a1').busy).toBe(0)
  callWaiting(t, 'a1', 'c1', 2000)
  toolRunning(t, 'c1', 3000)
  toolRunning(t, 'c1', 4000)
  expect(rowOf(t, 'a1').busy).toBe(1)
  toolEnded(t, 'c1', 'ok', 9000)
  expect(activeMs(rowOf(t, 'a1'), 9000)).toBe(6000)
})

test("a resume that leaves out parent and run keeps the row's own", () => {
  const t = newTracker()
  spawn(t, 'a1', 0, { parentId: 'p1', runId: 'wf_1' })
  spawn(t, 'a1', 5, { isResume: true })
  expect(rowOf(t, 'a1')).toMatchObject({ parentId: 'p1', runId: 'wf_1' })
})

test('a second start of the same call is ignored', () => {
  const t = newTracker()
  spawn(t, 'a1')
  expect(call(t, 'a1', 'c1', 0)).toBe(1)
  expect(call(t, 'a1', 'c1', 1000)).toBe(1)
  expect(t.repeats['a1']).toEqual({ key: 'k', count: 1 })
  expect(rowOf(t, 'a1').openTools).toBe(1)
  expect(rowOf(t, 'a1').busy).toBe(1)
  toolEnded(t, 'c1', 'ok', 3000)
  expect(rowOf(t, 'a1').openTools).toBe(0)
  expect(activeMs(rowOf(t, 'a1'), 3000)).toBe(3000)
})

test('the agent list is due at first, after the interval, and at once when the clock was set back', () => {
  expect(listDue(null, 5000, 10_000)).toBe(true)
  expect(listDue(5000, 14_999, 10_000)).toBe(false)
  expect(listDue(5000, 15_000, 10_000)).toBe(true)
  expect(listDue(5000, 4999, 10_000)).toBe(true)
})

test('a run of the same call survives a turn boundary', () => {
  const t = newTracker()
  spawn(t, 'a1')
  expect(call(t, 'a1', 'c1', 0)).toBe(1)
  turnEnded(t, 'a1', 'answer', 0)
  turnStarted(t, 'a1', 0)
  expect(call(t, 'a1', 'c2', 0)).toBe(2)
})

test('Allow resume pressed before the read-back is not undone by the stored Stop', () => {
  const t = newTracker()
  spawn(t, 'a1')
  markStopped(t, 'a1', 0)
  allowResume(t, 'a1', 0)
  const copy = { ...t.agents['a1']!, isStopped: true, status: 'stopped' as const, tokens: { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 } }
  foldReadBack(t, t.agents['a1']!, copy)
  expect(t.agents['a1']?.isStopped).toBe(false)
  // A Stop pressed after the resume holds again.
  markStopped(t, 'a1', 0)
  allowResume(t, 'a1', 0)
  markStopped(t, 'a1', 0)
  foldReadBack(t, t.agents['a1']!, { ...copy, isStopped: false })
  expect(t.agents['a1']?.isStopped).toBe(true)
})

test('resuming a stopped agent keeps it stopped', () => {
  const t = newTracker()
  spawn(t, 'a1')
  call(t, 'a1', 'c1', 0)
  markStopped(t, 'a1', 1)
  expect(rowOf(t, 'a1').status).toBe('stopping')
  spawn(t, 'a1', 2, { isResume: true })
  expect(rowOf(t, 'a1').status).toBe('stopping')
  toolEnded(t, 'c1', 'ok', 3)
  spawn(t, 'a1', 4, { isResume: true })
  expect(rowOf(t, 'a1').status).toBe('stopped')
})

test('a free-text description is left out for Bash and PowerShell only', () => {
  expect(fingerprint('mcp__x__create_issue', { title: 't', description: 'one' })).not.toBe(fingerprint('mcp__x__create_issue', { title: 't', description: 'two' }))
  expect(fingerprint('Bash', { command: 'ls', description: 'one' })).toBe(fingerprint('Bash', { command: 'ls', description: 'two' }))
  expect(fingerprint('mcp__x__create_issue', { title: 't', consent: 'a' })).toBe(fingerprint('mcp__x__create_issue', { title: 't' }))
})

// A row as reinwatch stored it before a reload.
const stored = (id: string, extra: Partial<AgentRow> = {}): AgentRow => ({
  id, description: '', type: '', model: '', isTeammate: false, status: 'done', isStopped: false, inTurn: false,
  firstSeenAt: 0, lastActiveAt: 4000, activeMs: 3000, busySince: null, busy: 0, openTools: 0,
  tokens: { input: 100, cacheWrite: 0, cacheRead: 0, output: 50 }, turns: 2, failStreak: 0, ...extra,
})

test('adoptReadBack adopts a row this instance lacks, closes its open interval at its last event and marks it reported', () => {
  const t = newTracker()
  adoptReadBack(t, { r1: stored('r1', { status: 'running', inTurn: true, busy: 2, busySince: 1000, openTools: 1, lastActiveAt: 3500 }) })
  const row = rowOf(t, 'r1')
  expect(row.activeMs).toBe(5500)
  expect([row.busy, row.busySince, row.openTools]).toEqual([0, null, 0])
  expect([row.status, row.inTurn]).toEqual(['running', true])
  expect(t.reported['r1']).toEqual({ tokens: 150, activeMs: 5500 })
})

test('adoptReadBack folds a row this instance has: facts filled in, counters added', () => {
  const t = newTracker()
  noteSpawn(t, { agentId: 'r1', description: '', type: '', model: '', isTeammate: false, isResume: false }, 0)
  adoptReadBack(t, { r1: stored('r1', { description: 'Old job', type: 'general-purpose', model: 'm0', parentId: 'p1', turns: 2 }) })
  const row = rowOf(t, 'r1')
  expect([row.description, row.type, row.model, row.parentId]).toEqual(['Old job', 'general-purpose', 'm0', 'p1'])
  expect(row.tokens).toEqual({ input: 100, cacheWrite: 0, cacheRead: 0, output: 50 })
  expect(row.activeMs).toBe(3000)
  expect(row.turns).toBe(2)
  expect(t.reported['r1']).toEqual({ tokens: 150, activeMs: 3000 })
})

const turnsOf = (t: Tracker): Map<string, number> => new Map(Object.entries(t.agents).map(([id, row]) => [id, row.turns]))

test('endListed ends an in-turn row the list reports completed or failed, and says so', () => {
  const t = newTracker()
  spawn(t, 'a1')
  turnStarted(t, 'a1', 0)
  spawn(t, 'a2')
  turnStarted(t, 'a2', 0)
  expect(endListed(t, [{ id: 'a1', status: 'completed' }, { id: 'a2', status: 'failed' }], turnsOf(t), 5)).toBe(true)
  expect([rowOf(t, 'a1').status, rowOf(t, 'a1').inTurn]).toEqual(['done', false])
  expect(rowOf(t, 'a2').status).toBe('failed')
})

test('endListed skips a row at rest, a row with open work and a row whose turns changed, and returns false when nothing ended', () => {
  const t = newTracker()
  // At rest: an idle teammate whose turn is over.
  spawn(t, 'rest', 0, { isTeammate: true })
  turnStarted(t, 'rest', 0)
  turnEnded(t, 'rest', 'answer', 1)
  const restBefore = JSON.stringify(rowOf(t, 'rest'))
  // Open work.
  spawn(t, 'busy')
  turnStarted(t, 'busy', 0)
  call(t, 'busy', 'c1', 1)
  // Began another turn while the list was awaited.
  spawn(t, 'moved')
  turnStarted(t, 'moved', 0)
  const before = turnsOf(t)
  turnStarted(t, 'moved', 2)
  const listed = ['rest', 'busy', 'moved', 'unknown'].map(id => ({ id, status: 'completed' as const }))
  expect(endListed(t, listed, before, 9)).toBe(false)
  expect(JSON.stringify(rowOf(t, 'rest'))).toBe(restBefore)
  expect(rowOf(t, 'rest').status).toBe('idle')
  expect(rowOf(t, 'busy').status).toBe('running')
  expect(rowOf(t, 'moved').status).toBe('running')
  expect(endListed(t, [{ id: 'busy', status: 'running' }], turnsOf(t), 9)).toBe(false)
})

test('an aborted tool call leaves the failure streak as it was', () => {
  const t = newTracker()
  spawn(t, 'a1')
  call(t, 'a1', 'c1', 0)
  toolEnded(t, 'c1', 'error', 1)
  call(t, 'a1', 'c2', 2)
  toolEnded(t, 'c2', 'aborted', 3)
  expect(rowOf(t, 'a1').failStreak).toBe(1)
  expect(rowOf(t, 'a1').openTools).toBe(0)
  call(t, 'a1', 'c3', 4)
  toolEnded(t, 'c3', 'ok', 5)
  expect(rowOf(t, 'a1').failStreak).toBe(0)
})

test('endListed leaves a resumed row alone until its turn starts (a row whose turn never starts stays running: accepted)', () => {
  const t = newTracker()
  spawn(t, 'tm', 0, { isTeammate: true })
  turnStarted(t, 'tm', 0)
  turnEnded(t, 'tm', 'answer', 1)
  spawn(t, 'tm', 2, { isTeammate: true, isResume: true })
  expect([rowOf(t, 'tm').status, rowOf(t, 'tm').inTurn]).toEqual(['running', false])
  expect(endListed(t, [{ id: 'tm', status: 'completed' }], turnsOf(t), 9)).toBe(false)
  expect(rowOf(t, 'tm').status).toBe('running')
  turnStarted(t, 'tm', 10)
  expect(endListed(t, [{ id: 'tm', status: 'completed' }], turnsOf(t), 11)).toBe(true)
})

test('a tool start records the tool as the last one, cleaned', () => {
  const t = newTracker()
  spawn(t, 'a1')
  expect(rowOf(t, 'a1').lastTool).toBeUndefined()
  call(t, 'a1', 'c1', 0, 'Bash')
  expect(rowOf(t, 'a1').lastTool).toBe('Bash')
  call(t, 'a1', 'c2', 1, ' Read\n‮ ')
  expect(rowOf(t, 'a1').lastTool).toBe('Read')
})
