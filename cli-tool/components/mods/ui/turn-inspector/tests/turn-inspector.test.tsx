// Run with: claude plugin test ui/turn-inspector
import { describe, expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'
import {
  barCells,
  cell,
  chunk,
  contextAfter,
  createLedger,
  gist,
  inputStack,
  promptStarted,
  stepEnded,
  stepStarted,
  systemTokens,
  toolAnswered,
} from '../hooks/turns.ts'

const usage = (input: number, cached: number, output: number) => ({
  input_tokens: input,
  output_tokens: output,
  cache_read_input_tokens: cached,
  cache_creation_input_tokens: 0,
  model: 'claude-opus-5-5',
})

describe('turns.ts', () => {
  test('a prompt, a tool round trip and an answer make two turns with real totals', () => {
    const l = createLedger()
    l.system = 9000
    promptStarted(l, 't1', 'find the auth bug')
    const one = stepStarted(l, 't1', 0, 'm', 100)
    expect(one.added.map(b => b.kind)).toEqual(['user'])
    chunk(one, 0, 'thinking', 'x'.repeat(40))
    chunk(one, 1, 'text', 'Let me look.')
    chunk(one, 2, 'tool_use', 'Read', 'Read')
    chunk(one, 2, 'tool_use', '{"file_path":"src/auth.ts"}')
    stepEnded(l, one, usage(200, 9000, 300), 'tool_use')
    expect(one.input).toBe(9200)
    expect(one.output).toBe(300)
    // thinking takes what text and tool use do not account for
    const sum = one.answer.reduce((s, b) => s + b.tokens, 0)
    expect(sum).toBe(300)
    expect(one.answer.find(b => b.kind === 'thinking')!.tokens).toBeGreaterThan(250)
    expect(gist(one)).toBe('1× Read')

    toolAnswered(l, 'Read', 4000, false)
    const two = stepStarted(l, 't1', 1, 'm', 100)
    expect(two.prompt).toBe('find the auth bug')
    expect(two.added.map(b => b.kind)).toEqual(['tool_result'])
    chunk(two, 0, 'text', 'Found it.')
    stepEnded(l, two, usage(1100, 9400, 20), 'end_turn')
    // new input is the real growth: 10500 - 9200 - 300
    expect(two.added[0]!.tokens).toBe(1000)
    const stack = inputStack(l, two)
    expect(stack.map(b => b.kind)).toEqual(['system', 'history', 'tool_result'])
    expect(stack.reduce((s, b) => s + b.tokens, 0)).toBe(10_500)
    expect(stack[1]!.label).toBe('Earlier turns (1)')
    expect(contextAfter(two)).toBe(10_520)
    expect(gist(two)).toBe('answer')
  })

  test('truncation, failure and compaction are said, not hidden', () => {
    const l = createLedger()
    promptStarted(l, 't1', 'go')
    const a = stepStarted(l, 't1', 0, 'm', 100)
    chunk(a, 0, 'thinking', 'hmm')
    stepEnded(l, a, usage(100, 50_000, 8000), 'max_tokens')
    expect(a.answer.at(-1)!.kind).toBe('truncated')
    expect(gist(a)).toBe('cut off')
    const b = stepStarted(l, 't1', 1, 'm', 100)
    stepEnded(l, b, null, null)
    expect(b.status).toBe('failed')
    expect(gist(b)).toBe('no response')
    const c = stepStarted(l, 't2', 0, 'm', 100)
    stepEnded(l, c, usage(500, 4000, 10), 'end_turn')
    const d = stepStarted(l, 't2', 1, 'm', 100)
    stepEnded(l, d, usage(100, 1000, 10), 'end_turn')
    expect(d.isCompacted).toBe(true)
  })

  test('the ledger keeps only maxTurns, and helpers size cells exactly', () => {
    const l = createLedger()
    for (let i = 0; i < 15; i++) stepStarted(l, `t${i}`, 0, 'm', 10)
    expect(l.turns.length).toBe(10)
    expect(l.turns[0]!.n).toBe(6)
    expect(barCells([10_000, 50_000, 1000, 500], 200_000, 20)).toEqual([1, 5, 1, 1])
    expect(barCells([300_000, 0, 0, 0], 200_000, 10)).toEqual([10, 0, 0, 0])
    expect(cell('abc', 5)).toBe('abc  ')
    expect(cell('abcdef', 4)).toBe('abc…')
    expect(cell('7', 3, 'right')).toBe('  7')
    expect(
      systemTokens([
        { name: 'System prompt', tokens: 3000, kind: 'used' },
        { name: 'System tools', tokens: 12_000, kind: 'used' },
        { name: 'Messages', tokens: 40_000, kind: 'used' },
        { name: 'Free space', tokens: 100_000, kind: 'free' },
      ]),
    ).toBe(15_000)
  })
})

// The engine beneath the plugin: a model that thinks, calls Read, then answers.
function fakeEngine(on: On) {
  on('turn.step', async function* ($, e) {
    if (e.index === 0) {
      yield { kind: 'thinking' as const, index: 0, text: 'The bug is probably in the token refresh.' }
      yield { kind: 'tool' as const, index: 1, id: 'tu_1', name: 'Read' }
      yield { kind: 'input' as const, index: 1, json: '{"file_path":"src/auth.ts"}' }
      return {
        turnId: e.turnId,
        index: e.index,
        answer: '',
        toolUses: [{ name: 'Read', input: { file_path: 'src/auth.ts' } }],
        stopReason: 'tool_use' as const,
        usage: usage(300, 14_000, 120),
      }
    }
    yield { kind: 'text' as const, index: 0, text: 'The refresh timer never resets.' }
    return {
      turnId: e.turnId,
      index: e.index,
      answer: 'The refresh timer never resets.',
      toolUses: [],
      stopReason: 'end_turn' as const,
      usage: usage(2300, 14_300, 40),
    }
  })
  on('tool.call', async () => ({ result: 'x'.repeat(8000), text: 'x'.repeat(8000) }) as never)
  on('turn.start', async ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', async ($, e) => ({ text: e.answer }))
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: {
        window: 200_000,
        breakdown: {
          categories: [
            { name: 'System prompt', tokens: 3000, color: 'x', isDeferred: false, kind: 'used' },
            { name: 'System tools', tokens: 11_000, color: 'x', isDeferred: false, kind: 'used' },
            { name: 'Messages', tokens: 300, color: 'x', isDeferred: false, kind: 'used' },
          ],
        },
      },
      rateLimits: [],
    },
  }) as never)
  on('ui.open', () => ({ value: undefined }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.log', () => ({ value: undefined }))
}

const PANE_PROPS = {
  title: 'turns',
  isFocused: true,
  bodyColumns: 60,
  placement: 'dock' as const,
  scroll: { offset: 0, bodyRows: 60 },
  view: {},
}

async function step($: Engine, index: number, turnId = 't1') {
  const s = $.turn.step({ turnId, index, model: 'claude-opus-5-5', messageCount: 1 + index * 2 })
  for (;;) {
    const x = await s.next()
    if (x.done) return x.value
  }
}

describe('the pane', () => {
  for (const surface of ['terminal', 'desktop'] as const) {
    test(`draws each request as a turn and expands its blocks (${surface})`, async ($, on) => {
      fakeEngine(on)
      const opened = await $.command.run({
        command: 'turns',
        args: '',
        origin: { kind: 'composer' },
        presentation: { isFullscreen: true, columns: 200 },
      })
      expect(opened.text).toContain('0 turns so far')

      await $.turn.start({ text: 'why does auth log me out?', turnId: 't1' })
      const first = await step($, 0)
      expect(first?.stopReason).toBe('tool_use')
      await $.tool.call({ tool: 'Read', file_path: 'src/auth.ts' } as never)
      await step($, 1)
      await $.turn.complete({ answer: 'The refresh timer never resets.', durationMs: 4200, isAborted: false, turnId: 't1', reason: 'answer' })

      const ui = await $.ui.mount({ plugin: 'turn-inspector', surface, component: 'Pane', requestId: 'turn-inspector', props: PANE_PROPS })
      const nb = (s: string) => (surface === 'terminal' ? s : s.replace(/ /g, ' '))
      expect((await ui.find({ key: 'turn:1' }))?.text).toContain(nb('#1 1× Read'))
      expect((await ui.find({ key: 'turn:2' }))?.text).toContain(nb('#2 answer'))
      expect(await ui.find({ type: 'Text', text: /why does auth log me out/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /8%/ })).toBeDefined()

      // following: the newest turn is open, with the diagram's stack
      expect(await ui.find({ type: 'Text', text: /INPUT {2}16\.6k · 14\.3k cached/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: new RegExp(nb('System, tools & memory')) })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: new RegExp(nb('Earlier turns \\(1\\)')) })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: new RegExp(nb('Tool result · Read')) })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: new RegExp(nb('Text response')) })).toBeDefined()

      await ui.press({ key: 'turn:1' })
      await ui.redraw()
      expect(await ui.find({ type: 'Text', text: new RegExp(nb('User message')) })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: new RegExp(nb('Thinking')) })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: new RegExp(nb('Tool use · Read')) })).toBeDefined()

      await ui.press({ key: 'collapse' })
      await ui.redraw()
      expect(await ui.find({ type: 'Text', text: /INPUT/ })).toBeUndefined()
      await ui.unmount()
    })
  }
})

const mountPane = ($: Engine) =>
  $.ui.mount({ plugin: 'turn-inspector', surface: 'terminal', component: 'Pane', requestId: 'turn-inspector', props: PANE_PROPS })

describe('the main loop alone', () => {
  test('a subagent starting its run adds nothing to the next main request', async ($, on) => {
    fakeEngine(on)
    await $.turn.start({ text: 'why does auth log me out?', turnId: 't1' })
    await step($, 0)
    // newer engines raise turn.start for each subagent run, with its agentId
    await $.turn.start({ text: 'Explore the auth module', turnId: 'a1', agentId: 'agent-1' } as never)
    await $.tool.call({ tool: 'Read', file_path: 'src/auth.ts' } as never)
    await step($, 1)
    const ui = await mountPane($)
    expect(await ui.find({ type: 'Text', text: /Explore the auth module/ })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /User message/ })).toBeUndefined()
    await ui.unmount()
  })

  test('a /clear forgets the turns before it', async ($, on) => {
    fakeEngine(on)
    on('session.end', async ($, e) => ({ sessionId: e.sessionId }))
    await $.turn.start({ text: 'why does auth log me out?', turnId: 't1' })
    await step($, 0)
    await step($, 1)
    // a /clear ends the conversation, and no session.start follows it
    await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } })
    await $.turn.start({ text: 'start over', turnId: 't2' })
    await step($, 0, 't2')
    const ui = await mountPane($)
    expect(await ui.find({ type: 'Text', text: /why does auth log me out/ })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /compacted/ })).toBeUndefined()
    await ui.unmount()
  })

  test('an interrupted request is not left streaming', async ($, on) => {
    fakeEngine(on)
    await $.turn.start({ text: 'why does auth log me out?', turnId: 't1' })
    // an interrupt closes the stream before its result
    const s = $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', messageCount: 1 })
    await s.next()
    await s.return(undefined as never)
    const ui = await mountPane($)
    expect((await ui.find({ key: 'turn:1' }))?.text).toContain('no response')
    expect(await ui.find({ type: 'Text', text: /streaming/ })).toBeUndefined()
    await ui.unmount()
  })
})
