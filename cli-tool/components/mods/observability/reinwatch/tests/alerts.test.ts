import { expect, test } from 'claude-code/testing'
import { checkAgent, checkAll, checkSpawn, pruneDismissed } from '../hooks/alerts'
import { readSettings } from '../hooks/settings'
import { newTokens, newTracker, noteSpawn, stepEnded, stepStarted, toolEnded, toolStarted, turnEnded, turnStarted, type Tracker } from '../hooks/tracker'

const MIN = 60_000
const SEC = 1000
const s = readSettings({})
const spawn = (t: Tracker, id: string, now = 0, extra = {}) =>
  noteSpawn(t, { agentId: id, description: 'Fix tests', type: 'general-purpose', model: 'm1', isTeammate: false, isResume: false, ...extra }, now)
const use = (u: Partial<Record<'input_tokens' | 'output_tokens' | 'cache_read_input_tokens' | 'cache_creation_input_tokens', number>>) =>
  ({ input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'm2', ...u })

test('long fires once when active time passes the limit', () => {
  const t = newTracker()
  spawn(t, 'a1')
  stepStarted(t, 'a1', 0)
  expect(checkAgent(t, 'a1', s, 29 * MIN)).toEqual([])
  const fired = checkAgent(t, 'a1', s, 31 * MIN)
  expect(fired.length).toBe(1)
  expect(fired[0]?.key).toBe('long:a1')
  expect(fired[0]?.kind).toBe('long')
  expect(fired[0]?.agentId).toBe('a1')
  expect(fired[0]?.at).toBe(31 * MIN)
  expect(fired[0]?.text).toBe('"Fix tests" has worked 31m (limit 30m)')
  expect(checkAgent(t, 'a1', s, 40 * MIN)).toEqual([])
})

test('a long gap with little work never fires long', () => {
  const t = newTracker()
  spawn(t, 'a1')
  stepStarted(t, 'a1', 0)
  stepEnded(t, 'a1', null, MIN)
  turnEnded(t, 'a1', 'answer', MIN)
  turnStarted(t, 'a1', 531 * MIN)
  stepStarted(t, 'a1', 531 * MIN)
  stepEnded(t, 'a1', null, 532 * MIN)
  expect(checkAll(t, s, 600 * MIN)).toEqual([])
  expect(checkAgent(t, 'a1', s, 600 * MIN)).toEqual([])
})

test('tokens fire above the limit', () => {
  const t = newTracker()
  spawn(t, 'a1')
  stepStarted(t, 'a1', 0)
  stepEnded(t, 'a1', use({ input_tokens: 900_000 }), 1000)
  expect(checkAgent(t, 'a1', s, 1000)).toEqual([])
  stepStarted(t, 'a1', 1000)
  stepEnded(t, 'a1', use({ output_tokens: 200_000 }), 2000)
  const fired = checkAgent(t, 'a1', s, 2000)
  expect(fired.length).toBe(1)
  expect(fired[0]?.key).toBe('tokens:a1')
  expect(fired[0]?.kind).toBe('tokens')
  expect(fired[0]?.text).toBe('"Fix tests" has used 1.1M tokens (limit 1M)')
  expect(checkAgent(t, 'a1', s, 3000)).toEqual([])
})

test('the token warning counts new tokens, not cache reads', () => {
  const cached = newTracker()
  spawn(cached, 'a1')
  for (let i = 0; i < 4; i++) {
    stepStarted(cached, 'a1', i * 1000)
    stepEnded(cached, 'a1', use({ cache_read_input_tokens: 500_000, input_tokens: 100_000, output_tokens: 25_000 }), i * 1000 + 500)
  }
  expect(cached.agents['a1']?.tokens.cacheRead).toBe(2_000_000)
  expect(newTokens(cached.agents['a1']!.tokens)).toBe(500_000)
  expect(checkAgent(cached, 'a1', s, 5000)).toEqual([])
  const fresh = newTracker()
  spawn(fresh, 'a1')
  stepStarted(fresh, 'a1', 0)
  stepEnded(fresh, 'a1', use({ input_tokens: 700_000, cache_creation_input_tokens: 400_000, output_tokens: 100_000 }), 1000)
  const fired = checkAgent(fresh, 'a1', s, 1000)
  expect(fired.map(f => f.text)).toEqual(['"Fix tests" has used 1.2M tokens (limit 1M)'])
})

test('repeat fires at the configured count', () => {
  const t = newTracker()
  spawn(t, 'a1')
  expect(checkAgent(t, 'a1', s, 0, { tool: 'Bash', count: 4 })).toEqual([])
  const fired = checkAgent(t, 'a1', s, 0, { tool: 'Bash', count: 5 })
  expect(fired.length).toBe(1)
  expect(fired[0]?.key).toBe('repeat:a1')
  expect(fired[0]?.kind).toBe('repeat')
  expect(fired[0]?.text).toBe('"Fix tests" made the same Bash call 5 times in a row')
  expect(checkAgent(t, 'a1', s, 0, { tool: 'Bash', count: 6 })).toEqual([])
})

test('failures fire at the streak', () => {
  const t = newTracker()
  spawn(t, 'a1')
  for (let i = 0; i < 5; i++) {
    toolStarted(t, { agentId: 'a1', toolUseId: `c${i}`, tool: 'Bash', key: `k${i}` }, i * SEC)
    toolEnded(t, `c${i}`, 'error', i * SEC + 100)
    if (i < 4) expect(checkAgent(t, 'a1', s, i * SEC + 100)).toEqual([])
  }
  const fired = checkAgent(t, 'a1', s, 5 * SEC)
  expect(fired.length).toBe(1)
  expect(fired[0]?.key).toBe('failures:a1')
  expect(fired[0]?.kind).toBe('failures')
  expect(fired[0]?.text).toBe('"Fix tests" had 5 tool failures in a row')
  expect(checkAgent(t, 'a1', s, 6 * SEC)).toEqual([])
})

test('burst fires once, and again only after the count in the window fell below the limit', () => {
  const t = newTracker()
  const counts: number[] = []
  for (let i = 0; i < 10; i++) {
    spawn(t, `a${i}`, i * SEC)
    counts.push(checkSpawn(t, undefined, s, i * SEC).length)
  }
  expect(counts).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 1])
  expect(t.burstActive).toBe(true)
  spawn(t, 'a10', 10 * SEC)
  expect(checkSpawn(t, undefined, s, 10 * SEC)).toEqual([])
  let again: ReturnType<typeof checkSpawn> = []
  for (let i = 0; i < 10; i++) {
    spawn(t, `b${i}`, 200 * SEC + i * SEC)
    again = checkSpawn(t, undefined, s, 200 * SEC + i * SEC)
    if (i < 9) expect(again).toEqual([])
  }
  expect(again.length).toBe(1)
  expect(again[0]?.kind).toBe('burst')
  expect(again[0]?.key).toBe(`burst:${209 * SEC}`)
  expect(again[0]?.agentId).toBeUndefined()
  expect(again[0]?.text).toBe('10 agents started within 2m')
})

test('a steady 8 starts a minute for 30 minutes raises one burst warning', () => {
  const t = newTracker()
  const all = []
  for (let i = 0; i < 240; i++) {
    const at = i * 7500
    spawn(t, `a${i}`, at)
    all.push(...checkSpawn(t, undefined, s, at))
  }
  expect(all.map(a => a.kind)).toEqual(['burst'])
  expect(all[0]?.key).toBe(`burst:${9 * 7500}`)
  expect(t.burstActive).toBe(true)
})

test('a new burst inside one window of the last warning warns again once the count fell below the limit', () => {
  const t = newTracker()
  const start = (id: string, at: number) => {
    spawn(t, id, at)
    return checkSpawn(t, undefined, s, at)
  }
  for (let i = 0; i < 9; i++) expect(start(`a${i}`, 0)).toEqual([])
  expect(start('a9', 60 * SEC).map(a => a.key)).toEqual([`burst:${60 * SEC}`])
  // The nine starts at 0s leave the window: 2 starts in it, below the limit, so the burst is over.
  expect(start('b0', 121 * SEC)).toEqual([])
  expect(t.burstActive).toBe(false)
  const again = []
  for (let i = 1; i <= 8; i++) again.push(...start(`b${i}`, 122 * SEC))
  expect(again.map(a => a.key)).toEqual([`burst:${122 * SEC}`])
  expect(again[0]?.text).toBe('10 agents started within 2m')
})

test('burst keys stay unique per warning but are not kept in fired', () => {
  const t = newTracker()
  const burst = (prefix: string, at: number) => {
    const out = []
    for (let i = 0; i < 10; i++) {
      spawn(t, `${prefix}${i}`, at + i * SEC)
      out.push(...checkSpawn(t, undefined, s, at + i * SEC))
    }
    return out
  }
  const first = burst('a', 0)
  const second = burst('b', 200 * SEC)
  expect(first.length).toBe(1)
  expect(second.length).toBe(1)
  expect(first[0]?.key).not.toBe(second[0]?.key)
  expect(Object.keys(t.fired).filter(k => k.startsWith('burst:'))).toEqual([])
})

test('a workflow run fires once at the count', () => {
  const t = newTracker()
  // A one-millisecond window keeps the burst alert out of the way.
  const noBurst = readSettings({})
  noBurst.burstWindowMs = 1
  for (let i = 0; i < 9; i++) {
    spawn(t, `a${i}`, i * 10_000, { runId: 'wf_1' })
    expect(checkSpawn(t, 'wf_1', noBurst, i * 10_000)).toEqual([])
  }
  spawn(t, 'a9', 90_000, { runId: 'wf_1' })
  const fired = checkSpawn(t, 'wf_1', noBurst, 90_000)
  expect(fired.length).toBe(1)
  expect(fired[0]?.key).toBe('run:wf_1')
  expect(fired[0]?.kind).toBe('run')
  expect(fired[0]?.text).toBe('Workflow run wf_1 has started 10 agents')
  spawn(t, 'a10', 100_000, { runId: 'wf_1' })
  expect(checkSpawn(t, 'wf_1', noBurst, 100_000)).toEqual([])
})

test('300 workflow spawns in 10 seconds raise one burst and one run alert', () => {
  const t = newTracker()
  const all = []
  for (let i = 0; i < 300; i++) {
    const at = Math.floor((i * 10 * SEC) / 300)
    spawn(t, `a${i}`, at, { runId: 'wf_2' })
    all.push(...checkSpawn(t, 'wf_2', s, at))
  }
  expect(all.filter(a => a.kind === 'burst').length).toBe(1)
  expect(all.filter(a => a.kind === 'run').length).toBe(1)
  expect(all.length).toBe(2)
})

test('settings move the thresholds', () => {
  const tight = readSettings({ activeMinutes: 1 })
  const t = newTracker()
  spawn(t, 'a1')
  stepStarted(t, 'a1', 0)
  expect(checkAgent(t, 'a1', tight, 59 * SEC)).toEqual([])
  const fired = checkAgent(t, 'a1', tight, 61 * SEC)
  expect(fired.length).toBe(1)
  expect(fired[0]?.text).toBe('"Fix tests" has worked 1m (limit 1m)')
  // The same busy time under the defaults is quiet.
  const t2 = newTracker()
  spawn(t2, 'a1')
  stepStarted(t2, 'a1', 0)
  expect(checkAgent(t2, 'a1', s, 61 * SEC)).toEqual([])
})

test('checkAll looks only at busy rows', () => {
  const t = newTracker()
  spawn(t, 'done1')
  stepStarted(t, 'done1', 0)
  stepEnded(t, 'done1', null, 40 * MIN)
  turnEnded(t, 'done1', 'answer', 40 * MIN)
  expect(checkAll(t, s, 41 * MIN)).toEqual([])
  spawn(t, 'busy1')
  stepStarted(t, 'busy1', 0)
  const fired = checkAll(t, s, 41 * MIN)
  expect(fired.length).toBe(1)
  expect(fired[0]?.key).toBe('long:busy1')
  expect(checkAll(t, s, 42 * MIN)).toEqual([])
})

test('an unknown agent gives no alerts', () => {
  expect(checkAgent(newTracker(), 'nope', s, 0, { tool: 'Bash', count: 99 })).toEqual([])
})

test('a spawn exactly one window old is outside the window', () => {
  const t = newTracker()
  for (let i = 0; i < 9; i++) spawn(t, `a${i}`, 0)
  spawn(t, 'b', s.burstWindowMs)
  expect(checkSpawn(t, undefined, s, s.burstWindowMs)).toEqual([])
  expect(t.spawns.length).toBe(1)
  expect(t.burstActive).toBe(false)
})

const alertOf = (key: string) => ({ key, kind: 'long' as const, agentId: 'a1', at: 0, text: 'x' })

test('pruneDismissed keeps each key once', () => {
  expect(pruneDismissed(['long:a', 'long:b', 'long:a'], [alertOf('long:a'), alertOf('long:b')])).toEqual(['long:a', 'long:b'])
})

test('pruneDismissed drops a key whose alert was trimmed away', () => {
  expect(pruneDismissed(['long:old', 'long:a', 'tokens:gone'], [alertOf('long:a')])).toEqual(['long:a'])
})

test('pruneDismissed keeps only the newest summary key', () => {
  expect(pruneDismissed(['summary:5', 'summary:30', 'summary:9'], [])).toEqual(['summary:30'])
  expect(pruneDismissed(['summary:5'], [])).toEqual(['summary:5'])
})

test('pruneDismissed leaves a dismissed alert that is still kept dismissed', () => {
  const alerts = [alertOf('long:a'), alertOf('repeat:a')]
  expect(pruneDismissed(['repeat:a', 'summary:7', 'long:zz'], alerts)).toEqual(['repeat:a', 'summary:7'])
  expect(pruneDismissed([], alerts)).toEqual([])
})

test("a warning's text is one plain line, whatever the tool or the run is called", () => {
  const t = newTracker()
  spawn(t, 'a1')
  const few = { ...s, repeatCount: 2, burstCount: 2 }
  expect(checkAgent(t, 'a1', few, 0, { tool: 'Ba\nsh\u001b', count: 2 }).map(a => a.text)).toEqual(['"Fix tests" made the same Ba sh call 2 times in a row'])
  t.runs['r\u001b1'] = 2
  const run = checkSpawn(t, 'r\u001b1', few, 0).find(a => a.kind === 'run')
  expect(run?.text).toBe('Workflow run r 1 has started 2 agents')
  expect(run?.key).toBe('run:r\u001b1')   // the key is the id as it came; only the text is cleaned
})

test('a muted kind raises nothing and is not remembered', () => {
  const t = newTracker()
  spawn(t, 'a1')
  const m = { ...s, muted: new Set<'repeat'>(['repeat']) }
  expect(checkAgent(t, 'a1', m, 0, { tool: 'Bash', count: 5 })).toEqual([])
  expect(t.fired['repeat:a1']).toBeUndefined()
})

test('a muted burst and a muted run raise nothing', () => {
  const t = newTracker()
  const m = { ...s, muted: new Set<'burst' | 'run'>(['burst', 'run']), burstCount: 2 }
  for (let i = 0; i < 3; i++) spawn(t, `a${i}`, i * SEC, { runId: 'r1' })
  expect(checkSpawn(t, 'r1', m, 3 * SEC)).toEqual([])
  expect(t.fired['run:r1']).toBeUndefined()
})
