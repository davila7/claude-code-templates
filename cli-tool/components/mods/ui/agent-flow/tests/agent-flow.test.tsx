// Run with: CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test ui/agent-flow
import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'
import {
  MAIN,
  announcedRunning,
  bar,
  clearsOnAutoOpen,
  completed,
  counts,
  createFlow,
  excerpt,
  fmtTokens,
  hideFinished,
  idleCloseMs,
  opensOnSpawn,
  rows,
  showAll,
  spawned,
  stepped,
  synced,
  toolLabel,
  toolRan,
  trimmed,
} from '../hooks/flow.ts'

const usage = (input: number, cached = 0, output = 10) => ({
  input_tokens: input,
  output_tokens: output,
  cache_read_input_tokens: cached,
  cache_creation_input_tokens: 0,
})

const spawn = (agentId: string, parentAgentId?: string, extra = {}) => ({
  agentId,
  parentAgentId,
  description: `task ${agentId}`,
  subagentType: 'Explore',
  prompt: 'Find where auth tokens are refreshed.\nReport file paths.',
  fork: false,
  background: false,
  ...extra,
})

describe('flow.ts', () => {
  test('spawns build a tree in spawn order, nested by parent', () => {
    const flow = createFlow()
    spawned(flow, spawn('a'), 1)
    spawned(flow, spawn('b', 'a'), 2)
    spawned(flow, spawn('c'), 3)
    spawned(flow, spawn('d', 'unknown-parent'), 4)
    const r = rows(flow)
    expect(r.map(x => x.node.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(r.map(x => x.prefix)).toEqual(['├─', '│ └─', '├─', '└─'])
    expect(flow.nodes.get('d')?.parentId).toBe(MAIN)
  })

  test('steps, tools and completion fill in what each loop did', () => {
    const flow = createFlow()
    spawned(flow, spawn('a'), 1)
    stepped(flow, 'a', usage(1000, 4000, 50), 2)
    stepped(flow, 'a', usage(500, 2000, 30), 3)
    for (let i = 0; i < 10; i++) toolRan(flow, 'a', { tool: 'Read', label: `f${i}.ts` }, 4)
    completed(flow, 'a', { answer: 'Found it in src/auth.ts', reason: 'answer', durationMs: 3200 }, 5)
    const a = flow.nodes.get('a')!
    expect(a.steps).toBe(2)
    expect(a.contextTokens).toBe(2500)
    expect(a.peakContext).toBe(5000)
    expect(a.outputTokens).toBe(80)
    expect(a.toolCount).toBe(10)
    expect(a.tools.length).toBe(8)
    expect(a.tools.at(-1)?.label).toBe('f9.ts')
    expect(a.status).toBe('done')
    expect(counts(flow)).toEqual({ running: 0, done: 1, failed: 0 })
  })

  test('a loop no spawn announced is still drawn, marked unlisted', () => {
    const flow = createFlow()
    stepped(flow, 'wf-1', usage(10), 1)
    expect(flow.nodes.get('wf-1')?.unlisted).toBe(true)
    stepped(flow, undefined, usage(20_000), 2)
    expect(flow.nodes.get(MAIN)?.contextTokens).toBe(20_000)
  })

  test('trim drops finished branches only, never one with a running agent', () => {
    const flow = createFlow()
    spawned(flow, spawn('a'), 1)
    spawned(flow, spawn('a1', 'a'), 1)
    spawned(flow, spawn('b'), 2)
    completed(flow, 'b', { answer: '', reason: 'answer', durationMs: 1 }, 3)
    completed(flow, 'a', { answer: '', reason: 'answer', durationMs: 1 }, 3)
    trimmed(flow, 0)
    expect([...flow.nodes.keys()].sort()).toEqual(['a', 'a1', 'main'])
  })

  test('small helpers', () => {
    expect(fmtTokens(950)).toBe('950')
    expect(fmtTokens(12_345)).toBe('12.3k')
    expect(fmtTokens(250_000)).toBe('250k')
    expect(bar(50, 10)).toBe('█████░░░░░')
    expect(toolLabel('Bash', { command: 'git   status' })).toBe('git status')
    expect(toolLabel('Agent', { description: 'scan', prompt: 'long prompt' })).toBe('scan')
    expect(excerpt('a\n\nb\nc\nd', 2, 20)).toEqual(['a', 'b', '… 2 more lines'])
  })

  test('the spawn options: openOnSpawn off unless true, clearOnAutoOpen on unless false, 15s idle', () => {
    expect(opensOnSpawn(undefined)).toBe(false)
    expect(opensOnSpawn('true')).toBe(false)
    expect(opensOnSpawn(true)).toBe(true)
    expect(clearsOnAutoOpen(undefined)).toBe(true)
    expect(clearsOnAutoOpen(false)).toBe(false)
    expect(idleCloseMs(undefined)).toBe(15_000)
    expect(idleCloseMs(0)).toBe(0)
    expect(idleCloseMs(-5)).toBe(0)
    expect(idleCloseMs(30_000)).toBe(30_000)
    expect(idleCloseMs('15000')).toBe(15_000)
  })

  test('hideFinished takes finished agents off the pane; a parent returns with a visible child; showAll brings them back', () => {
    const flow = createFlow(0)
    spawned(flow, spawn('a1'), 1)
    completed(flow, 'a1', { answer: 'ok', reason: 'answer', durationMs: 1 }, 2)
    spawned(flow, spawn('a2'), 3)
    hideFinished(flow)
    expect(rows(flow).map(r => r.node.id)).toEqual(['a2'])
    expect(counts(flow)).toEqual({ running: 1, done: 0, failed: 0 })
    spawned(flow, spawn('a1-kid', 'a1'), 4)
    expect(rows(flow).map(r => r.node.id)).toEqual(['a1', 'a1-kid', 'a2'])
    showAll(flow)
    completed(flow, 'a1-kid', { answer: 'ok', reason: 'answer', durationMs: 1 }, 5)
    expect(counts(flow)).toEqual({ running: 1, done: 2, failed: 0 })
  })

  test('a hidden agent that runs again (resumed) is back in the round, and stays after it finishes', () => {
    const flow = createFlow(0)
    spawned(flow, spawn('a1'), 1)
    completed(flow, 'a1', { answer: 'ok', reason: 'answer', durationMs: 1 }, 2)
    hideFinished(flow)
    expect(rows(flow)).toEqual([])
    stepped(flow, 'a1', usage(10), 3)
    expect(rows(flow).map(r => r.node.id)).toEqual(['a1'])
    expect(counts(flow).running).toBe(1)
    completed(flow, 'a1', { answer: 'ok', reason: 'answer', durationMs: 1 }, 4)
    expect(rows(flow).map(r => r.node.id)).toEqual(['a1'])
  })

  test('a loop no spawn announced does not count as a running subagent until agent.list knows it', () => {
    const flow = createFlow(0)
    spawned(flow, spawn('a1'), 1)
    toolRan(flow, 'fork-1', { tool: 'Read', label: 'MEMORY.md' } as never, 2)
    expect(announcedRunning(flow)).toBe(1)
    synced(flow, [{ id: 'fork-1', status: 'running', type: 'general-purpose', description: 'x' }])
    expect(announcedRunning(flow)).toBe(2)
  })
})

// The engine beneath the plugin: every event the flow listens to, answered plainly.
function fakeEngine(
  on: On,
  config: Record<string, boolean | number> = {},
  opens: string[] = [],
  closes: string[] = [],
  lateConfig?: { clock: { sleep: (ms: number) => Promise<void> }; ms: number },
  keyPrefix = 'agent-flow@skills-dir',
) {
  on('agent.spawn', async ($, e) => ({
    model: 'claude-haiku-4-5',
    agentId: e.description === 'nested' ? 'sub-2' : e.description.startsWith('sub-') ? e.description : 'sub-1',
  }))
  on('turn.step', async function* ($, e) {
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '',
      toolUses: [],
      stopReason: 'end_turn' as const,
      usage: { ...usage(e.agentId ? 3000 : 1000, e.agentId ? 9000 : 40_000), model: 'm' },
    }
  })
  on('tool.call', async () => ({ result: 'ok', text: 'ok' }) as never)
  on('turn.start', async ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', async ($, e) => ({ text: e.answer }))
  on('agent.list', () => ({ value: [] }))
  on('session.start', async ($, e) => ({ cwd: e.cwd }) as never)
  on('command.register', () => ({ value: undefined }))
  on('config.list', async () => {
    if (lateConfig) await lateConfig.clock.sleep(lateConfig.ms)
    return { value: Object.entries(config).map(([field, value]) => ({
      key: `${keyPrefix}.${field}`,
      label: field,
      kind: typeof value === 'boolean' ? 'toggle' : 'number',
      value,
      provider: { plugin: 'agent-flow', tier: 'user' },
      isLocked: false,
    })) } as never
  })
  on('session.usage', () => ({
    value: {
      context: {
        window: 200_000,
        breakdown: { categories: [{ name: 'Messages', tokens: 30_000, color: 'x', isDeferred: false, kind: 'used' }] },
      },
      rateLimits: [],
    },
  }) as never)
  on('ui.open', ($, e) => {
    opens.push(e.id)
    return { value: undefined }
  })
  on('ui.close', ($, e) => {
    closes.push(e.id)
    return { value: undefined }
  })
  on('ui.status', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.log', () => ({ value: undefined }))
}

const PANE_PROPS = {
  title: 'agents',
  isFocused: true,
  bodyColumns: 60,
  placement: 'dock' as const,
  scroll: { offset: 0, bodyRows: 60 },
  view: {},
}

async function drain($: Engine, agentId?: string) {
  const s = $.turn.step({ turnId: 't1', index: 0, model: 'm', messageCount: 3, ...(agentId ? { agentId } : {}) })
  for await (const _ of s) {
    // no chunks from the fake
  }
  return s.result
}

describe('the pane', () => {
  test('draws main, a subagent and a nested one, with context in and out', async ($, on) => {
    fakeEngine(on)
    const opened = await $.command.run({
      command: 'agent-flow',
      args: '',
      origin: { kind: 'composer' },
      presentation: { isFullscreen: true, columns: 200 },
    })
    expect(opened.text).toContain('agents so far')

    await $.turn.start({ text: 'refactor the auth module', turnId: 't1' })
    await drain($)
    const first = await $.agent.spawn({ prompt: 'Map the auth module.\nList every file.', description: 'map auth', subagentType: 'Explore' })
    expect(first.agentId).toBe('sub-1')
    await drain($, 'sub-1')
    await $.tool.call({ tool: 'Read', file_path: 'src/auth.ts', agentId: 'sub-1' } as never)
    await $.agent.spawn({ prompt: 'Check tests.', description: 'nested', subagentType: 'general-purpose', parentAgentId: 'sub-1' } as never)
    await $.turn.complete({ answer: 'auth lives in src/auth.ts and src/session.ts', durationMs: 4200, isAborted: false, turnId: 't1', agentId: 'sub-1', reason: 'answer' })

    const ui = await $.ui.mount({ plugin: 'agent-flow', surface: 'terminal', component: 'Pane', requestId: 'agent-flow', props: PANE_PROPS })
    expect(await ui.find({ key: 'ag:main' })).toBeDefined()
    expect((await ui.find({ key: 'ag:sub-1' }))?.text).toContain('map auth')
    expect((await ui.find({ key: 'ag:sub-2' }))?.text).toContain('nested')
    expect(await ui.find({ type: 'Text', text: /1 running · 1 done/ })).toBeDefined()

    await ui.press({ key: 'ag:sub-1' })
    await ui.redraw()
    expect(await ui.find({ type: 'Text', text: /↓ in from main: prompt/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Map the auth module/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Read src\/auth\.ts/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /↑ out to main: answer/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /12\.0k/ })).toBeDefined()

    await ui.press({ key: 'ag:main' })
    await ui.redraw()
    expect(await ui.find({ type: 'Text', text: /2 subagents|1 subagents/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Messages/ })).toBeDefined()
    await ui.unmount()
  })
})

describe('openOnSpawn', () => {
  const run = ($: Engine, args: string) =>
    $.command.run({ command: 'agent-flow', args, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 200 } })
  const finish = ($: Engine, agentId: string) =>
    $.turn.complete({ answer: 'ok', durationMs: 10, isAborted: false, turnId: 't1', agentId, reason: 'answer' })
  const spawnAgent = ($: Engine, description = 'd') => $.agent.spawn({ prompt: 'p', description, subagentType: 'Explore' })
  // the pane's state is the module's, shared across tests: each starts from a closed pane and a new session
  const fresh = async ($: Engine) => {
    await run($, 'stop')
    await $.session.start({ source: 'startup', cwd: '/tmp' } as never)
  }
  const pressClose = async ($: Engine) => {
    const ui = await $.ui.mount({ plugin: 'agent-flow', surface: 'terminal', component: 'Pane', requestId: 'agent-flow', props: PANE_PROPS })
    await ui.press({ key: 'close' })
    await ui.unmount()
  }

  test('off by default: a spawn leaves the pane closed', async ($, on) => {
    const opens: string[] = []
    fakeEngine(on, {}, opens)
    await fresh($)
    await spawnAgent($)
    expect(opens).toEqual([])
  })

  test('on: a spawn opens the pane; closing it by hand keeps it closed until /agent-flow or a new session', async ($, on) => {
    const opens: string[] = []
    fakeEngine(on, { openOnSpawn: true }, opens)
    await fresh($)
    await spawnAgent($)
    expect(opens).toEqual(['agent-flow'])

    await pressClose($)
    await spawnAgent($)
    expect(opens).toEqual(['agent-flow'])

    await run($, '')
    await run($, 'stop')
    await spawnAgent($)
    expect(opens).toHaveLength(2)

    await $.session.start({ source: 'startup', cwd: '/tmp' } as never)
    await spawnAgent($)
    expect(opens).toHaveLength(3)
  })

  test('a pane a spawn opened closes after closeAfterIdleMs with no subagent running', async ($, on) => {
    const clock = mock.clock(on)
    const opens: string[] = []
    const closes: string[] = []
    fakeEngine(on, { openOnSpawn: true }, opens, closes)
    await fresh($)
    closes.length = 0

    await spawnAgent($)
    await finish($, 'sub-1')
    await clock.advance(10_000)
    expect(closes).toEqual([])

    // a spawn inside the window cancels the close, and the wait restarts when it finishes:
    // nothing closes at the old deadline, 15s after sub-1
    await spawnAgent($, 'nested')
    await clock.advance(2_000)
    await finish($, 'sub-2')
    await clock.advance(3_000)
    expect(closes).toEqual([])
    await clock.advance(11_999)
    expect(closes).toEqual([])
    await clock.advance(1)
    expect(closes).toEqual(['agent-flow'])

    // an idle close is not a close by hand: the next spawn reopens
    await spawnAgent($)
    expect(opens).toHaveLength(2)

    // /agent-flow while the timer is pending adopts the pane: it no longer closes on its own
    await finish($, 'sub-1')
    await clock.advance(10_000)
    await run($, '')
    await clock.advance(20_000)
    expect(closes).toEqual(['agent-flow'])
    // and a subagent finishing under a pane opened by hand does not start the timer either
    await spawnAgent($)
    await finish($, 'sub-1')
    await clock.advance(60_000)
    expect(closes).toEqual(['agent-flow'])
  })

  test('closeAfterIdleMs 0 keeps the pane open', async ($, on) => {
    const clock = mock.clock(on)
    const closes: string[] = []
    fakeEngine(on, { openOnSpawn: true, closeAfterIdleMs: 0 }, [], closes)
    await fresh($)
    closes.length = 0
    await spawnAgent($)
    await finish($, 'sub-1')
    await clock.advance(60_000)
    expect(closes).toEqual([])
  })

  test('a loop no spawn announced, that never completes, does not hold the pane open', async ($, on) => {
    const clock = mock.clock(on)
    const closes: string[] = []
    fakeEngine(on, { openOnSpawn: true }, [], closes)
    await fresh($)
    closes.length = 0
    await spawnAgent($)
    await $.tool.call({ tool: 'Read', file_path: 'MEMORY.md', agentId: 'fork-1' } as never)
    await finish($, 'sub-1')
    await clock.advance(15_000)
    expect(closes).toEqual(['agent-flow'])
  })

  test('a reopen shows only the new round, /agent-flow shows them all, clearOnAutoOpen false keeps them', async ($, on) => {
    const clock = mock.clock(on)
    const config: Record<string, boolean | number> = { openOnSpawn: true }
    fakeEngine(on, config)
    const drawn = async () => {
      const ui = await $.ui.mount({ plugin: 'agent-flow', surface: 'terminal', component: 'Pane', requestId: 'agent-flow', props: PANE_PROPS })
      const out: string[] = []
      for (const id of ['sub-r1', 'sub-r2', 'sub-r3']) if (await ui.find({ key: `ag:${id}` })) out.push(id)
      await ui.unmount()
      return out
    }
    await fresh($)
    await spawnAgent($, 'sub-r1')
    await finish($, 'sub-r1')
    await clock.advance(15_000)

    await spawnAgent($, 'sub-r2')
    expect(await drawn()).toEqual(['sub-r2'])
    await run($, '')
    expect(await drawn()).toEqual(['sub-r1', 'sub-r2'])

    // read from /config at the spawn, so the change applies without a restart
    config.clearOnAutoOpen = false
    await finish($, 'sub-r2')
    await run($, 'stop')
    await $.session.start({ source: 'startup', cwd: '/tmp' } as never)
    await spawnAgent($, 'sub-r1')
    await finish($, 'sub-r1')
    await clock.advance(15_000)
    await spawnAgent($, 'sub-r3')
    expect(await drawn()).toEqual(['sub-r1', 'sub-r3'])
  })

  test('a /config read that answers late neither opens the pane twice nor arms the timer under a new spawn', async ($, on) => {
    const clock = mock.clock(on)
    const opens: string[] = []
    const closes: string[] = []
    fakeEngine(on, { openOnSpawn: true }, opens, closes, { clock, ms: 100 })
    await fresh($)
    closes.length = 0

    // two spawns in parallel both start while the pane is closed
    const first = spawnAgent($)
    const second = spawnAgent($, 'nested')
    await clock.advance(1_000)
    await Promise.all([first, second])
    expect(opens).toEqual(['agent-flow'])

    // sub-1 finishes, sub-2 is the only one left; the idle read is pending when sub-2 finishes
    await finish($, 'sub-1')
    const done = finish($, 'sub-2')
    await clock.settle()
    // a new spawn lands while that read is still out
    const third = spawnAgent($, 'sub-3')
    await clock.advance(1_000)
    await Promise.all([done, third])
    // no timer from that read: sub-3 finishing later gets its full 15s
    await clock.advance(5_000)
    const last = finish($, 'sub-3')
    await clock.advance(100)
    await last
    await clock.advance(10_000)
    expect(closes).toEqual([])
    await clock.advance(5_000)
    expect(closes).toEqual(['agent-flow'])
  })

  test('a subagent resumed while the timer runs keeps the pane open until it finishes', async ($, on) => {
    const clock = mock.clock(on)
    const closes: string[] = []
    fakeEngine(on, { openOnSpawn: true }, [], closes)
    await fresh($)
    closes.length = 0
    await spawnAgent($)
    await finish($, 'sub-1')
    await clock.advance(5_000)
    await drain($, 'sub-1')
    await clock.advance(20_000)
    expect(closes).toEqual([])
    await finish($, 'sub-1')
    await clock.advance(15_000)
    expect(closes).toEqual(['agent-flow'])
  })

  test('[ close ] reaches the ui.close hook: no timer is left to close it again, no spawn reopens it', async ($, on) => {
    const clock = mock.clock(on)
    const opens: string[] = []
    const closes: string[] = []
    fakeEngine(on, { openOnSpawn: true }, opens, closes)
    await fresh($)
    closes.length = 0
    await spawnAgent($)
    await finish($, 'sub-1')
    await pressClose($)
    expect(closes).toEqual(['agent-flow'])
    await clock.advance(20_000)
    expect(closes).toEqual(['agent-flow'])
    await spawnAgent($, 'nested')
    expect(opens).toEqual(['agent-flow'])
  })

  test('the /config row is read under the bare plugin name as well as the full id', async ($, on) => {
    const opens: string[] = []
    fakeEngine(on, { openOnSpawn: true }, opens, [], undefined, 'agent-flow')
    await fresh($)
    await spawnAgent($)
    expect(opens).toEqual(['agent-flow'])
  })

  test('a pane a spawn opened still closes when idle after /clear starts a new session', async ($, on) => {
    const clock = mock.clock(on)
    const closes: string[] = []
    fakeEngine(on, { openOnSpawn: true }, [], closes)
    await fresh($)
    closes.length = 0
    await spawnAgent($)
    await $.session.start({ source: 'clear', cwd: '/tmp' } as never)
    await spawnAgent($)
    await finish($, 'sub-1')
    await clock.advance(15_000)
    expect(closes).toEqual(['agent-flow'])
  })
})
