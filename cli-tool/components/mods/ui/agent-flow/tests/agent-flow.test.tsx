// Run with: CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test ui/agent-flow
import { describe, expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'
import {
  MAIN,
  bar,
  completed,
  counts,
  createFlow,
  excerpt,
  fmtTokens,
  rows,
  spawned,
  stepped,
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
})

// The engine beneath the plugin: every event the flow listens to, answered plainly.
function fakeEngine(on: On) {
  on('agent.spawn', async ($, e) => ({ model: 'claude-haiku-4-5', agentId: e.description === 'nested' ? 'sub-2' : 'sub-1' }))
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
  on('session.usage', () => ({
    value: {
      context: {
        window: 200_000,
        breakdown: { categories: [{ name: 'Messages', tokens: 30_000, color: 'x', isDeferred: false, kind: 'used' }] },
      },
      rateLimits: [],
    },
  }) as never)
  on('ui.open', () => ({ value: undefined }))
  on('ui.close', () => ({ value: undefined }))
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
