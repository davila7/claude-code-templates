import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine, MockClock } from 'claude-code/testing'
import type { ModelForkResult, On } from 'claude-code'
import { advise } from '../hooks/cache.ts'
import type { Sample } from '../hooks/cache.ts'
import {
  COMPOSE_MIN_ROOM,
  COMPOSE_TEXT_SHORT,
  COMPOSE_WITHOUT_FIELD,
  FIELD_HINT,
  FIELD_HINT_MIN_ROOM,
  FIELD_HINT_SHORT,
  FIELD_SUBMIT,
  FORK_PROMPT,
  HANDOFF_ACT_FRAME,
  HANDOFF_FRAME,
  PHASE_TEXT,
  briefCost,
  clearVariant,
  extractBrief,
  fieldHint,
  followUpText,
  forkFailure,
  handoffBlock,
  handoffMessage,
  isBriefWhole,
  logParts,
  phaseLine,
  promptSource,
  turnBlock,
} from '../hooks/handoff.ts'
import type { ForkFailure, HandoffGate } from '../hooks/handoff.ts'

const PLUGIN = 'prompt-cache-control'
const START = { cwd: '/repo', surface: 'terminal', isInteractive: true } as never
const BAND = { hasSurvey: false, isWorking: false, bodyColumns: 115 } as never
const PANE = { title: 'cache', isFocused: true, bodyColumns: 80, placement: 'dock' } as never
const USAGE = { input_tokens: 845, output_tokens: 1_346, cache_read_input_tokens: 81_000, cache_creation_input_tokens: 15_090 }
const BRIEF = '## Goal\nShip the clear cache button.\n\n## Next steps\n1. Run the tests.\n\n## Chat-only material\nNone'
const OTHER_BRIEF = BRIEF.replace('Ship the clear cache button.', 'Fix the band layout.')
const CUT_BRIEF = '## Goal\nShip it.\n\n## Next steps\n1. Test it.\n\n## Key facts\nThe band'
const AS_USER = { kind: 'plugin', name: PLUGIN, asUser: true }
const MESSAGE = handoffMessage({ brief: BRIEF, sessionId: 's1', contextTokens: '151k' })
const FULL_FLOW = ['model.fork', 'command.run', 'session.end', 'prompt.submit']
const SUCCESS = 'clear cache: cleared and handed off (the brief: read 81k, wrote 15.1k, new 845)'
const RUNNING = 'clear cache: a turn is running: let it finish, then clear'
const CUT = 'clear cache: the last turn ended without its final reply (interrupted, failed or stopped by a hook), so the brief would leave it out: send a message, let it finish, then clear'
const CANCELLED = 'clear cache: handoff cancelled, nothing was cleared'
const COMPOSE_CANCELLED = 'clear cache: cancelled, nothing was cleared'
const FIELD_OPEN = 'clear cache: the message field is already open: type a message and press Enter, or cancel'
const COMPOSING = PHASE_TEXT.composing
const ARMED = 'clear cache: still starting the brief, press cancel again to stop it'
const STALE = 'clear cache: a turn started while /clear was pending, so the brief may not cover it; the handoff brief is in the prompt box, read it before you send it; /resume returns to the previous conversation'
const FENCE = '`'.repeat(3)
const FIELD = 'handoff-note'
const BAND_ID = 'band-1'
const TASK = 'run the tests and list what fails'
const WITH_TASK = handoffMessage({ brief: BRIEF, sessionId: 's1', contextTokens: '151k', followUp: TASK })
const SUCCESS_WITH = 'clear cache: cleared and handed off with your message (the brief: read 81k, wrote 15.1k, new 845)'
const NOT_SENT = 'prompt-cache-control: clear cache: your message was not sent:'
const SURFACES = ['terminal', 'desktop'] as const
type Surface = (typeof SURFACES)[number]
const ON_SURFACE: Record<Surface, { canFill: boolean; canCopy: boolean }> = { terminal: { canFill: true, canCopy: true }, desktop: { canFill: false, canCopy: false } }
const GIVEN_BACK: Record<Surface, string> = { terminal: 'your message is back in the prompt box', desktop: 'your message is in the transcript' }

const answered = (text: string): ModelForkResult => ({ isAnswered: true, text, usage: USAGE })
const failed = (reason: 'empty-reply' | 'aborted'): ModelForkResult => ({ isAnswered: false, reason, usage: USAGE })
const OVERLOADED: ModelForkResult = { isAnswered: false, reason: 'api-error', status: 529, error: 'overloaded', usage: { ...USAGE, output_tokens: 0 } }
const NOTHING: ModelForkResult = { isAnswered: false, reason: 'nothing-to-fork' }

type ForkPlan = { answer?: ModelForkResult; isDenied?: true; delayMs: number }

type World = {
  calls: unknown[][]
  toasts: string[]
  toastTimeouts: unknown[]
  logs: string[]
  copySurfaces: unknown[]
  transcript: string[]
  invalidations: number
  bandDraws: number
  statusLines: number
  sessionId: string
  isIdDenied: boolean
  stepStop: string
  fork: ModelForkResult
  forkDelayMs: number
  forks: ForkPlan[]
  clear: 'ends' | 'ignored' | 'throws'
  clearWaitMs: number
  turnBeforeClear: boolean
  promptBeforeClear: boolean
  promptAfterClear: boolean
  submit: 'enters' | 'drops' | 'throws'
  submitWaitMs: number
  draft: string
  canFill: boolean
  canCopy: boolean
  copyWaitMs: number
}

const world = (over: Partial<World> = {}): World => ({
  calls: [],
  toasts: [],
  toastTimeouts: [],
  logs: [],
  copySurfaces: [],
  transcript: [],
  invalidations: 0,
  bandDraws: 0,
  statusLines: 0,
  sessionId: 's1',
  isIdDenied: false,
  stepStop: 'end_turn',
  fork: answered(BRIEF),
  forkDelayMs: 0,
  forks: [],
  clear: 'ends',
  clearWaitMs: 0,
  turnBeforeClear: false,
  promptBeforeClear: false,
  promptAfterClear: false,
  submit: 'enters',
  submitWaitMs: 0,
  draft: '',
  canFill: true,
  canCopy: true,
  copyWaitMs: 0,
  ...over,
})

function fakeEngine($: Engine, on: On, w: World): MockClock {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.env(on, {})
  on('session.usage', () => ({ value: { startedAt: 0, context: {}, rateLimits: [] } }) as never)
  on('session.start', async (_, e) => ({ cwd: e.cwd }) as never)
  on('session.end', (_, e) => {
    w.calls.push(['session.end', e.reason, e.sessionId])
    return { sessionId: e.sessionId }
  })
  on('session.id', () => (w.isIdDenied ? { deny: 'session id withheld' } : { value: w.sessionId }) as never)
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: undefined }) as never)
  on('ui.close', () => ({ value: undefined }))
  on('ui.status', () => {
    w.statusLines += 1
    return { value: undefined }
  })
  on('ui.toast', (_, e) => {
    w.toasts.push(e.text)
    w.toastTimeouts.push((e as { timeoutMs?: number }).timeoutMs)
    return { value: undefined }
  })
  on('ui.log', (_, e) => {
    w.logs.push(e.text)
    if (e.to !== 'debug') w.transcript.push(e.text)
    return { value: undefined }
  })
  on('ui.render', (own, e) => {
    if (e.component === 'AbovePrompt') w.bandDraws += 1
    const { Text } = own.ui.resolve(e)
    return <Text>beneath</Text>
  })
  on('ui.invalidate', (_, e, next) => {
    w.invalidations += 1
    return next(e)
  })
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('turn.step', async function* (_, e) {
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '',
      toolUses: [],
      stopReason: w.stepStop,
      usage: { model: 'claude-sonnet-5-5', input_tokens: 300, output_tokens: 50, cache_read_input_tokens: 150_000, cache_creation_input_tokens: 1_000 },
    } as never
  })
  on('model.fork', async (_, e) => {
    w.calls.push(['model.fork', e.prompt])
    const plan = w.forks.shift() ?? { answer: w.fork, delayMs: w.forkDelayMs }
    if (plan.delayMs > 0) await clock.sleep(plan.delayMs)
    if (plan.isDenied) return { deny: 'fork refused by a policy plugin' } as never
    return { value: plan.answer ?? w.fork }
  })
  on('command.run', async (_, e) => {
    w.calls.push(['command.run', e.command, e.args])
    if (w.clear === 'throws') throw new Error('clear refused')
    if (w.clear === 'ignored') return { text: 'not now' }
    if (w.turnBeforeClear) {
      await $.turn.start({ text: 'typed meanwhile', turnId: 't-mid' })
      await endTurn($, 't-mid')
    }
    if (w.promptBeforeClear) await $.prompt.submit({ text: 'typed meanwhile' } as never)
    await $.session.end({ reason: 'clear', sessionId: w.sessionId, resume: { id: w.sessionId } })
    w.sessionId = `s${Number(w.sessionId.slice(1)) + 1}`
    if (w.promptAfterClear) await $.prompt.submit({ text: 'typed into the fresh conversation' } as never)
    if (w.clearWaitMs > 0) await clock.sleep(w.clearWaitMs)
    return {}
  })
  on('prompt.submit', async (_, e) => {
    w.calls.push(['prompt.submit', e.text, e.origin])
    if (w.submit === 'throws') throw new Error('submit failed')
    if (w.submit === 'drops') return { drop: 'blocked by a policy hook' }
    if (w.submitWaitMs > 0) await clock.sleep(w.submitWaitMs)
    if ((e.origin as { name?: string } | undefined)?.name === PLUGIN) await $.turn.start({ text: e.text, turnId: 'brief-turn' })
    return { text: e.text }
  })
  on('prompt.read', () => ({ value: { text: w.draft, cursor: w.draft.length } }))
  on('prompt.fill', (_, e) => {
    w.calls.push(['prompt.fill', e.text, e.mode])
    return { isFilled: w.canFill }
  })
  on('ui.copy', async (_, e) => {
    w.calls.push(['ui.copy', e.text])
    w.copySurfaces.push(e.surface)
    if (w.copyWaitMs > 0) await clock.sleep(w.copyWaitMs)
    return { value: w.canCopy ? { isCopied: true } : { isCopied: false, reason: 'no-clipboard' } }
  })
  return clock
}

async function step($: Engine, turnId = 't1') {
  const stream = $.turn.step({ turnId, index: 0, model: 'claude-sonnet-5-5', messageCount: 3 } as never)
  for (;;) {
    const n = await stream.next()
    if (n.done) return n.value
  }
}

const endTurn = ($: Engine, turnId: string, reason: 'answer' | 'aborted' | 'error' = 'answer') =>
  $.turn.complete({ answer: '', durationMs: 5, isAborted: reason === 'aborted', turnId, reason } as never)

async function turn($: Engine, turnId: string) {
  await step($, turnId)
  await endTurn($, turnId)
}

async function ready($: Engine, on: On, over: Partial<World> = {}) {
  const w = world(over)
  const clock = fakeEngine($, on, w)
  await $.session.start(START)
  await turn($, 't1')
  return { w, clock }
}

const band = ($: Engine, props = BAND, columns = 120) =>
  $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props, viewport: { columns, rows: 40 } })
const desktopBand = ($: Engine) =>
  $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: BAND, viewport: { columns: 120, rows: 40 } })
const pane = ($: Engine, surface: 'terminal' | 'desktop' = 'terminal') =>
  $.ui.mount({ plugin: PLUGIN, surface, component: 'Pane', requestId: 'cache', props: PANE })
const events = (w: World) => w.calls.map(c => c[0])
const sent = (w: World) => String(w.calls.find(c => c[0] === 'prompt.submit')?.[1])
const texts = async (ui: { findAll: (q: { type: string }) => Promise<{ text: string }[]> }) => (await ui.findAll({ type: 'Text' })).map(t => t.text)
const keyOf = (child: unknown) => (child as { props?: { key?: unknown } } | undefined)?.props?.key
const buttons = async (ui: { findAll: (q: { type: string }) => Promise<{ key: string | undefined }[]> }) => (await ui.findAll({ type: 'Button' })).map(b => b.key)
const narrowBand = (bodyColumns: number) => ({ hasSurvey: false, isWorking: false, bodyColumns }) as never
const surfaceBand = ($: Engine, surface: Surface, props = BAND, columns = 120) =>
  $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', requestId: BAND_ID, props, viewport: { columns, rows: 40 } })
type Field = { input: (target: { key: string; text: string; kind?: 'change' | 'submit' }) => Promise<unknown> }
const typeInto = (ui: Field, text: string) => ui.input({ key: FIELD, text, kind: 'change' })
const enter = (ui: Field, text: string) => ui.input({ key: FIELD, text })
type Site = Field & { press: (target: { key: string }) => Promise<unknown> }
const clearCache = async (ui: Site, text = '') => {
  await ui.press({ key: 'clear-cache' })
  await enter(ui, text)
}
const focusAsked = (w: World, site: string) => w.logs.includes(`prompt-cache-control: clear cache: focus asked for the message field ${FIELD} in ${site}`)
const nbsp = (text: string) => text.replace(/ /g, String.fromCharCode(0xa0))
const shown = (surface: Surface, text: string) => (surface === 'terminal' ? text : nbsp(text))
const openPane = ($: Engine) => $.command.run({ command: 'cache', args: '' })
const givenBack = (w: World, surface: Surface) =>
  surface === 'terminal' ? w.calls.some(c => c[0] === 'prompt.fill' && c[1] === TASK) : w.transcript.join('\n').includes(`${NOT_SENT}\n${TASK}`)

describe('the clear cache button in the band', () => {
  test('appears after the first request on the terminal and the desktop, and shortens on a narrow band', async ($, on) => {
    const w = world()
    fakeEngine($, on, w)
    await $.session.start(START)
    const before = await band($)
    expect(await before.find({ key: 'clear-cache' })).toBeUndefined()
    await before.unmount()
    await turn($, 't1')
    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: BAND, viewport: { columns: 120, rows: 40 } })
      expect(await ui.find({ key: 'clear-cache' })).toMatchObject({ type: 'Button', text: 'clear cache', props: { variant: 'secondary', dimColor: false } })
      await ui.unmount()
    }
    const narrow = await band($, narrowBand(65), 70)
    expect(await narrow.find({ key: 'clear-cache' })).toMatchObject({ text: 'clear' })
    expect(await narrow.find({ type: 'Text', text: /tok$/ })).toBeDefined()
    await narrow.unmount()
    const tight = await band($, narrowBand(40), 45)
    expect(await tight.find({ key: 'clear-cache' })).toMatchObject({ text: 'clear' })
    expect(await tight.find({ type: 'Text', text: /tok$|█|░/ })).toBeUndefined()
    await tight.unmount()
  })

  test('the label follows the band body, not the viewport: clear cache from 100 body columns', async ($, on) => {
    await ready($, on)
    for (const [bodyColumns, label] of [
      [99, 'clear'],
      [100, 'clear cache'],
    ] as const) {
      const ui = await band($, narrowBand(bodyColumns), 120)
      expect(await ui.find({ key: 'clear-cache' })).toMatchObject({ text: label })
      await ui.unmount()
    }
  })

  test('the bar and the token count give way below 64 body columns', async ($, on) => {
    await ready($, on)
    const roomy = await band($, narrowBand(64), 70)
    expect(await roomy.find({ type: 'Text', text: /tok$/ })).toBeDefined()
    await roomy.unmount()
    const tight = await band($, narrowBand(63), 70)
    expect(await tight.find({ type: 'Text', text: /tok$/ })).toBeUndefined()
    await tight.unmount()
  })

  test('the read, wrote and new fields share one row, and only the advice text gives way', async ($, on) => {
    await ready($, on)
    const ui = await band($)
    const boxes = await ui.findAll({ type: 'Box' })
    const fields = boxes.filter(
      b => b.children.length === 3 && b.children.every(c => (c as { type?: string }).type === 'Text') && b.text.includes('read 150k') && b.text.includes('new 300'),
    )
    expect(fields).toHaveLength(1)
    expect(fields[0]?.props.flexDirection).toBe('row')
    const row = boxes.find(b => b.children.length === 3 && b.text.includes('clear cache') && b.text.includes('warm'))
    expect(row?.children).toMatchObject([{ props: { flexShrink: 0 } }, { props: { flexShrink: 1, minWidth: 0 } }, { props: { flexShrink: 0 } }])
    await ui.unmount()
  })

  test('a press only opens the message field; an empty Enter then writes the brief, runs /clear and sends the framed brief as the user', async ($, on) => {
    const { w } = await ready($, on)
    const ui = await band($)
    expect(await ui.press({ key: 'clear-cache' })).toEqual({ element: 'clear-cache' })
    expect(w.calls).toEqual([])
    expect(await ui.find({ key: FIELD })).toBeDefined()
    await enter(ui, '')
    expect(w.calls).toEqual([
      ['model.fork', FORK_PROMPT],
      ['command.run', 'clear', ''],
      ['session.end', 'clear', 's1'],
      ['prompt.submit', MESSAGE, AS_USER],
    ])
    expect(w.toasts).toEqual([SUCCESS])
    expect(w.transcript.filter(l => l.includes('clear cache'))).toEqual([])
    expect(await texts(ui)).toEqual(['beneath'])
    await ui.unmount()
  })

  test('the message names the cleared session and its size, and carries the brief', async ($, on) => {
    const { w } = await ready($, on)
    const ui = await band($)
    await clearCache(ui)
    expect(sent(w)).toContain('session s1, about 151k tokens of context')
    expect(sent(w)).toContain(`<handoff_brief>\n${BRIEF}\n</handoff_brief>`)
    expect(sent(w)).toContain('s1.jsonl')
    expect(sent(w)).not.toContain('{{')
    await ui.unmount()
  })

  test('while the model works the button is dim and a press is refused', async ($, on) => {
    const { w } = await ready($, on)
    const ui = await band($, { hasSurvey: false, isWorking: true, bodyColumns: 115 } as never)
    expect(await ui.find({ key: 'clear-cache' })).toMatchObject({ props: { dimColor: true } })
    await ui.press({ key: 'clear-cache' })
    expect(w.calls).toEqual([])
    expect(w.toasts).toEqual([RUNNING])
    await ui.unmount()
  })
})

describe('a brief that fails never clears', () => {
  for (const fork of [OVERLOADED, failed('empty-reply'), failed('aborted'), NOTHING]) {
    test(`a fork that ends in ${(fork as ForkFailure).reason} clears nothing and says why`, async ($, on) => {
      const { w } = await ready($, on, { fork })
      const ui = await band($)
      await clearCache(ui)
      expect(events(w)).toEqual(['model.fork'])
      const note = `clear cache: ${forkFailure(fork as ForkFailure)}, nothing was cleared`
      expect(w.toasts).toEqual([note])
      expect(w.toastTimeouts).toEqual([10_000])
      expect(w.logs).toContain(`prompt-cache-control: ${note}`)
      expect(await ui.find({ key: 'clear-cache' })).toBeDefined()
      await ui.unmount()
    })
  }

  test('a fork another plugin refuses clears nothing', async ($, on) => {
    const { w } = await ready($, on, { forks: [{ isDenied: true, delayMs: 0 }] })
    const ui = await band($)
    await clearCache(ui)
    expect(events(w)).toEqual(['model.fork'])
    expect(w.toasts).toHaveLength(1)
    expect(w.toasts[0]).toStartWith('clear cache: the brief could not be requested (')
    expect(w.toasts[0]).toEndWith('), nothing was cleared')
    expect(await ui.find({ key: 'clear-cache' })).toBeDefined()
    await ui.unmount()
  })

  test('a reply that is not a brief clears nothing; its opening goes to the transcript and the whole of it to the debug log', async ($, on) => {
    const reply = 'Let me read the files before I write anything.'
    const { w } = await ready($, on, { fork: answered(reply) })
    const ui = await band($)
    await clearCache(ui)
    expect(events(w)).toEqual(['model.fork'])
    expect(w.toasts).toEqual(['clear cache: the reply was not a handoff brief (no ## Goal and ## Next steps headings), nothing was cleared'])
    expect(w.logs).toContain(`prompt-cache-control: clear cache: the reply began: ${reply}`)
    expect(w.logs).toContain(`prompt-cache-control: clear cache: the whole rejected reply:\n${reply}`)
    await ui.unmount()
  })

  test('a brief cut off before its last section goes to the clipboard and nothing is cleared', async ($, on) => {
    const { w } = await ready($, on, { fork: answered(CUT_BRIEF) })
    const ui = await band($)
    await clearCache(ui)
    expect(w.calls).toEqual([
      ['model.fork', FORK_PROMPT],
      ['ui.copy', handoffMessage({ brief: CUT_BRIEF, sessionId: 's1', contextTokens: '151k' })],
    ])
    expect(w.toasts).toEqual(['clear cache: the brief looks cut off (it has no Chat-only material section), nothing was cleared; the handoff brief is on the clipboard'])
    await ui.unmount()
  })

  test('text before the Goal heading and a fence around the brief are left out of what is sent', async ($, on) => {
    const { w } = await ready($, on, { fork: answered(`Sure, here is the brief.\n\n${FENCE}markdown\n${BRIEF}\n${FENCE}`) })
    const ui = await band($)
    await clearCache(ui)
    expect(w.calls.at(-1)).toEqual(['prompt.submit', MESSAGE, AS_USER])
    await ui.unmount()
  })

  test('after a problem toast the expiry countdown stays quiet, so it does not take the problem toast away', { options: { warnSeconds: 1000 } }, async ($, on) => {
    const { w, clock } = await ready($, on, { fork: OVERLOADED })
    const ui = await band($)
    await clearCache(ui)
    await clock.advance(1_000)
    expect(w.toasts).toHaveLength(1)
    expect(w.toasts[0]).toEndWith(', nothing was cleared')
    await ui.unmount()
  })
})

describe('when the handoff may start, and what stops it', () => {
  test('a press while a main-loop turn runs does nothing; a subagent turn ending does not count', async ($, on) => {
    const { w } = await ready($, on)
    await $.turn.start({ text: 'go on', turnId: 't2' })
    const ui = await band($)
    await ui.press({ key: 'clear-cache' })
    expect(w.calls).toEqual([])
    expect(w.toasts).toEqual([RUNNING])
    await $.turn.complete({ answer: 'sub', durationMs: 5, isAborted: false, turnId: 'sub-1', reason: 'answer', agentId: 'agent-1' } as never)
    await ui.press({ key: 'clear-cache' })
    expect(w.calls).toEqual([])
    await endTurn($, 't2')
    await clearCache(ui)
    expect(events(w)).toEqual(FULL_FLOW)
    await ui.unmount()
  })

  test('a main-loop request with no turn.start seen (a reload mid-turn) counts as a running turn in the pane', async ($, on) => {
    const { w } = await ready($, on)
    await step($, 't2')
    const side = await pane($)
    expect(await side.find({ key: 'clear-cache' })).toMatchObject({ props: { dimColor: true } })
    await side.press({ key: 'clear-cache' })
    expect(w.calls).toEqual([])
    expect(w.toasts).toEqual([RUNNING])
    await endTurn($, 't2')
    await clearCache(side)
    expect(events(w)).toEqual(FULL_FLOW)
    await side.unmount()
  })

  for (const reason of ['aborted', 'error'] as const) {
    test(`after a turn that ended as ${reason} a press waits until a turn ends normally`, async ($, on) => {
      const { w } = await ready($, on)
      await $.turn.start({ text: 'stop, revert it instead', turnId: 't2' })
      await endTurn($, 't2', reason)
      const ui = await band($)
      await ui.press({ key: 'clear-cache' })
      expect(w.calls).toEqual([])
      expect(w.toasts).toEqual([CUT])
      await $.turn.start({ text: 'go on', turnId: 't3' })
      await turn($, 't3')
      await clearCache(ui)
      expect(events(w)).toEqual(FULL_FLOW)
      await ui.unmount()
    })
  }

  test('a turn that a hook stopped right after a tool call counts as cut; one that answered after its tools does not', async ($, on) => {
    const { w } = await ready($, on)
    await $.turn.start({ text: 'run the migration', turnId: 't2' })
    w.stepStop = 'tool_use'
    await step($, 't2')
    await endTurn($, 't2')
    const ui = await band($)
    await ui.press({ key: 'clear-cache' })
    expect(w.calls).toEqual([])
    expect(w.toasts).toEqual([CUT])
    await $.turn.start({ text: 'go on', turnId: 't3' })
    await step($, 't3')
    w.stepStop = 'end_turn'
    await step($, 't3')
    await endTurn($, 't3')
    await clearCache(ui)
    expect(events(w)).toEqual(FULL_FLOW)
    await ui.unmount()
  })

  test('a subagent turn that ends normally does not lift the cut of an aborted main-loop turn', async ($, on) => {
    const { w } = await ready($, on)
    await $.turn.start({ text: 'stop', turnId: 't2' })
    await endTurn($, 't2', 'aborted')
    await $.turn.complete({ answer: 'sub', durationMs: 5, isAborted: false, turnId: 'sub-1', reason: 'answer', agentId: 'agent-1' } as never)
    const ui = await band($)
    await ui.press({ key: 'clear-cache' })
    expect(w.calls).toEqual([])
    expect(w.toasts).toEqual([CUT])
    await ui.unmount()
  })

  test('the brief turn in the fresh conversation counts as running until it completes', async ($, on) => {
    const { w } = await ready($, on)
    const ui = await band($)
    await clearCache(ui)
    expect(w.toasts).toEqual([SUCCESS])
    await step($, 'brief-turn')
    await ui.press({ key: 'clear-cache' })
    expect(w.toasts.at(-1)).toBe(RUNNING)
    expect(events(w)).toEqual(FULL_FLOW)
    await endTurn($, 'brief-turn')
    await clearCache(ui)
    expect(events(w)).toEqual([...FULL_FLOW, ...FULL_FLOW])
    await ui.unmount()
  })

  test('two presses in the same tick open one field and the second is refused with a reason that says the field is open, not that a handoff runs, so one brief is written', async ($, on) => {
    const { w, clock } = await ready($, on, { forkDelayMs: 30_000 })
    const ui = await band($)
    await Promise.all([ui.press({ key: 'clear-cache' }), ui.press({ key: 'clear-cache' })])
    expect(w.calls).toEqual([])
    expect(w.toasts).toEqual([FIELD_OPEN])
    await enter(ui, '')
    expect(w.calls).toEqual([['model.fork', FORK_PROMPT]])
    await clock.advance(30_000)
    expect(events(w)).toEqual(FULL_FLOW)
    expect(w.toasts.at(-1)).toBe(SUCCESS)
    await ui.unmount()
  })

  test('while the brief is written the band shows the phase and cancel; cancel keeps the conversation', async ($, on) => {
    const { w, clock } = await ready($, on, { forkDelayMs: 30_000 })
    const ui = await band($)
    await clearCache(ui)
    expect(await ui.find({ type: 'Text', text: 'writing the handoff brief…' })).toBeDefined()
    expect(await buttons(ui)).toEqual(['cancel-handoff'])
    await clock.advance(1_000)
    expect(await ui.press({ key: 'cancel-handoff' })).toEqual({ element: 'cancel-handoff' })
    expect(w.toasts).toEqual([CANCELLED])
    expect(await ui.find({ key: 'clear-cache' })).toBeDefined()
    await clock.advance(29_000)
    expect(w.calls).toEqual([['model.fork', FORK_PROMPT]])
    expect(w.toasts).toHaveLength(1)
    await ui.unmount()
  })

  test('the phase row keeps its label whole and lets the phase text give way', async ($, on) => {
    const { clock } = await ready($, on, { forkDelayMs: 30_000 })
    const ui = await band($)
    await clearCache(ui)
    const row = (await ui.findAll({ type: 'Box' })).find(b => b.children.length === 3 && b.text.includes('writing the handoff brief'))
    expect(row?.children).toMatchObject([{ props: { flexShrink: 0 } }, { props: { flexShrink: 1, minWidth: 0 } }, { props: { flexShrink: 0 } }])
    await clock.advance(30_000)
    await ui.unmount()
  })

  test('a second Enter right after the brief starts only arms cancel, so the brief goes on', async ($, on) => {
    const { w, clock } = await ready($, on, { forkDelayMs: 30_000 })
    const ui = await band($)
    await clearCache(ui)
    await ui.press({ key: 'cancel-handoff' })
    expect(w.toasts).toEqual([ARMED])
    await clock.advance(30_000)
    expect(events(w)).toEqual(FULL_FLOW)
    expect(w.toasts.at(-1)).toBe(SUCCESS)
    await ui.unmount()
  })

  test('an armed cancel does not carry over: the next handoff asks for a second press again', async ($, on) => {
    const { w, clock } = await ready($, on, { forkDelayMs: 30_000 })
    const ui = await band($)
    await clearCache(ui)
    await ui.press({ key: 'cancel-handoff' })
    await clock.advance(30_000)
    expect(w.toasts).toEqual([ARMED, SUCCESS])
    await endTurn($, 'brief-turn')
    await turn($, 't5')
    await clearCache(ui)
    await ui.press({ key: 'cancel-handoff' })
    expect(w.toasts).toEqual([ARMED, SUCCESS, ARMED])
    await clock.advance(30_000)
    expect(w.toasts.at(-1)).toBe(SUCCESS)
    await ui.unmount()
  })

  test('a cancel pressed twice at once stops the handoff', async ($, on) => {
    const { w, clock } = await ready($, on, { forkDelayMs: 30_000 })
    const ui = await band($)
    await clearCache(ui)
    await ui.press({ key: 'cancel-handoff' })
    await ui.press({ key: 'cancel-handoff' })
    expect(w.toasts).toEqual([ARMED, CANCELLED])
    await clock.advance(30_000)
    expect(events(w)).toEqual(['model.fork'])
    await ui.unmount()
  })

  test('a press after cancel, while the cancelled fork is still out, sends only the new brief', async ($, on) => {
    const { w, clock } = await ready($, on, {
      forks: [
        { answer: answered(BRIEF), delayMs: 30_000 },
        { answer: answered(OTHER_BRIEF), delayMs: 30_000 },
      ],
    })
    const ui = await band($)
    await clearCache(ui)
    await clock.advance(1_000)
    await ui.press({ key: 'cancel-handoff' })
    await clock.advance(10_000)
    await clearCache(ui)
    await clock.advance(19_000)
    expect(events(w)).toEqual(['model.fork', 'model.fork'])
    await clock.advance(11_000)
    expect(events(w)).toEqual(['model.fork', ...FULL_FLOW])
    expect(sent(w)).toContain('Fix the band layout.')
    expect(sent(w)).not.toContain('Ship the clear cache button.')
    await ui.unmount()
  })

  test('a late refusal of a cancelled fork does not end the next handoff', async ($, on) => {
    const { w, clock } = await ready($, on, {
      forks: [
        { isDenied: true, delayMs: 20_000 },
        { answer: answered(BRIEF), delayMs: 30_000 },
      ],
    })
    const ui = await band($)
    await clearCache(ui)
    await clock.advance(1_000)
    await ui.press({ key: 'cancel-handoff' })
    await clearCache(ui)
    await clock.advance(19_000)
    expect(w.toasts).toEqual([CANCELLED])
    await clock.advance(11_000)
    expect(events(w)).toEqual(['model.fork', ...FULL_FLOW])
    expect(w.toasts.at(-1)).toBe(SUCCESS)
    await ui.unmount()
  })

  test('a copy that a cancel overtakes still says the clipboard holds the brief, and the next handoff runs', async ($, on) => {
    const { w, clock } = await ready($, on, {
      copyWaitMs: 5_000,
      forks: [
        { answer: answered(CUT_BRIEF), delayMs: 0 },
        { answer: answered(BRIEF), delayMs: 10_000 },
      ],
    })
    const ui = await band($)
    await clearCache(ui)
    await clock.advance(1_000)
    await ui.press({ key: 'cancel-handoff' })
    await clearCache(ui)
    await clock.advance(4_000)
    expect(w.logs).toContain('prompt-cache-control: clear cache: the handoff brief is on the clipboard')
    await clock.advance(10_000)
    expect(events(w)).toEqual(['model.fork', 'ui.copy', 'model.fork', 'command.run', 'session.end', 'prompt.submit'])
    expect(w.toasts).toEqual([CANCELLED, SUCCESS])
    await ui.unmount()
  })

  test('a turn that starts while the brief is written stops the handoff', async ($, on) => {
    const { w, clock } = await ready($, on, { forkDelayMs: 30_000 })
    const ui = await band($)
    await clearCache(ui)
    await $.turn.start({ text: 'a task notification', turnId: 't2' })
    const note = 'clear cache: a turn started while the brief was being written, nothing was cleared'
    expect(w.toasts).toEqual([note])
    expect(w.logs).toContain(`prompt-cache-control: ${note}`)
    await clock.advance(30_000)
    expect(events(w)).toEqual(['model.fork'])
    await ui.unmount()
  })

  test('a prompt sent while the brief is written stops the handoff at once', async ($, on) => {
    const { w, clock } = await ready($, on, { forkDelayMs: 30_000 })
    const ui = await band($)
    await clearCache(ui)
    await $.prompt.submit({ text: 'one more thing' } as never)
    const note = 'clear cache: a prompt was sent while the brief was being written, nothing was cleared'
    expect(w.toasts).toEqual([note])
    expect(w.toastTimeouts).toEqual([10_000])
    expect(w.logs).toContain(`prompt-cache-control: ${note}`)
    await clock.advance(30_000)
    expect(events(w)).toEqual(['model.fork', 'prompt.submit'])
    await ui.unmount()
  })

  test('a /clear of the person while the brief is written stops the handoff', async ($, on) => {
    const { w, clock } = await ready($, on, { forkDelayMs: 30_000 })
    const ui = await band($)
    await clearCache(ui)
    await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } })
    expect(w.toasts).toEqual(['clear cache: the conversation changed while the brief was being written, nothing was sent'])
    await clock.advance(30_000)
    expect(events(w)).toEqual(['model.fork', 'session.end'])
    await ui.unmount()
  })

  test('a turn that starts while /clear is pending puts the brief in the prompt box instead of sending it', async ($, on) => {
    const { w } = await ready($, on, { turnBeforeClear: true })
    const ui = await band($)
    await clearCache(ui)
    expect(events(w)).toEqual(['model.fork', 'command.run', 'session.end', 'prompt.fill'])
    expect(w.toasts).toEqual([STALE])
    await ui.unmount()
  })

  test('a prompt sent while /clear is pending also holds the brief back', async ($, on) => {
    const { w } = await ready($, on, { promptBeforeClear: true })
    const ui = await band($)
    await clearCache(ui)
    expect(events(w)).toEqual(['model.fork', 'command.run', 'prompt.submit', 'session.end', 'prompt.fill'])
    expect(w.toasts).toEqual([STALE])
    await ui.unmount()
  })

  test('a prompt that reaches the fresh conversation before the brief keeps the brief in the prompt box', async ($, on) => {
    const { w } = await ready($, on, { promptAfterClear: true })
    const ui = await band($)
    await clearCache(ui)
    expect(events(w)).toEqual(['model.fork', 'command.run', 'session.end', 'prompt.submit', 'prompt.fill'])
    expect(w.toasts).toEqual(['clear cache: a prompt reached the fresh conversation first; the handoff brief is in the prompt box, send it when that turn ends'])
    await ui.unmount()
  })

  test('the stale route does not stick: the next handoff is sent as usual', async ($, on) => {
    const { w } = await ready($, on, { turnBeforeClear: true })
    const ui = await band($)
    await clearCache(ui)
    expect(w.toasts).toEqual([STALE])
    w.turnBeforeClear = false
    await turn($, 't5')
    await clearCache(ui)
    expect(events(w).slice(-4)).toEqual(FULL_FLOW)
    expect(w.toasts.at(-1)).toBe(SUCCESS)
    await ui.unmount()
  })

  test('the fresh-conversation route does not stick either', async ($, on) => {
    const { w } = await ready($, on, { promptAfterClear: true })
    const ui = await band($)
    await clearCache(ui)
    expect(w.toasts.at(-1)).toStartWith('clear cache: a prompt reached the fresh conversation first;')
    w.promptAfterClear = false
    await turn($, 't5')
    await clearCache(ui)
    expect(events(w).slice(-4)).toEqual(FULL_FLOW)
    expect(w.toasts.at(-1)).toBe(SUCCESS)
    await ui.unmount()
  })

  test('a background task reporting back while the brief is written is named as the reason', async ($, on) => {
    const { w, clock } = await ready($, on, { forkDelayMs: 30_000 })
    const ui = await band($)
    await clearCache(ui)
    await $.prompt.submit({ text: 'task done', origin: { kind: 'task-notification' } } as never)
    expect(w.toasts).toEqual(['clear cache: a background task reported back while the brief was being written, nothing was cleared'])
    await clock.advance(30_000)
    await ui.unmount()
  })

  test('a turn that starts afresh forgets how the previous one stopped', async ($, on) => {
    const { w } = await ready($, on)
    await $.turn.start({ text: 'run it', turnId: 't2' })
    w.stepStop = 'tool_use'
    await step($, 't2')
    await endTurn($, 't2')
    w.stepStop = 'end_turn'
    await $.turn.start({ text: 'answered by a hook', turnId: 't3' })
    await endTurn($, 't3')
    const ui = await band($)
    await clearCache(ui)
    expect(events(w)).toEqual(FULL_FLOW)
    await ui.unmount()
  })

  test('the band shows clearing, then sending, with no button to press', async ($, on) => {
    const { w, clock } = await ready($, on, { clearWaitMs: 4_000, submitWaitMs: 4_000 })
    const ui = await band($)
    await clearCache(ui)
    expect(events(w)).toEqual(['model.fork', 'command.run', 'session.end'])
    expect(await ui.find({ type: 'Text', text: 'clearing the conversation…' })).toBeDefined()
    expect(await buttons(ui)).toEqual([])
    await clock.advance(4_000)
    expect(events(w)).toEqual(FULL_FLOW)
    expect(await ui.find({ type: 'Text', text: 'sending the brief to the fresh conversation…' })).toBeDefined()
    expect(await buttons(ui)).toEqual([])
    await clock.advance(4_000)
    expect(w.toasts).toEqual([SUCCESS])
    await ui.unmount()
  })

  test('no expiry countdown toast while the brief is written', { options: { warnSeconds: 1000 } }, async ($, on) => {
    const { w, clock } = await ready($, on, { forkDelayMs: 30_000 })
    const ui = await band($)
    await clearCache(ui)
    await clock.advance(1_000)
    expect(w.toasts).toEqual([])
    await ui.press({ key: 'cancel-handoff' })
    await clock.advance(1_000)
    expect(w.toasts).toHaveLength(2)
    expect(w.toasts[1]).toStartWith('cache expires in ')
    await ui.unmount()
  })
})

describe('the brief is kept when a later step fails', () => {
  test('a /clear that leaves the conversation in place puts the brief on the clipboard and sends nothing', async ($, on) => {
    const { w } = await ready($, on, { clear: 'ignored' })
    const ui = await band($)
    await clearCache(ui)
    expect(w.calls).toEqual([
      ['model.fork', FORK_PROMPT],
      ['command.run', 'clear', ''],
      ['ui.copy', MESSAGE],
    ])
    expect(w.toasts).toEqual(['clear cache: /clear did not start a new conversation, nothing was cleared; the handoff brief is on the clipboard'])
    await ui.unmount()
  })

  test('a /clear that fails puts the brief on the clipboard', async ($, on) => {
    const { w } = await ready($, on, { clear: 'throws' })
    const ui = await band($)
    await clearCache(ui)
    expect(events(w)).toEqual(['model.fork', 'command.run', 'ui.copy'])
    expect(w.toasts[0]).toStartWith('clear cache: /clear did not run (')
    expect(w.toasts[0]).toEndWith(', nothing was cleared; the handoff brief is on the clipboard')
    await ui.unmount()
  })

  test('a dropped brief waits in the empty prompt box, ready to send', async ($, on) => {
    const { w } = await ready($, on, { submit: 'drops' })
    const ui = await band($)
    await clearCache(ui)
    expect(events(w)).toEqual([...FULL_FLOW, 'prompt.fill'])
    expect(w.calls.at(-1)).toEqual(['prompt.fill', MESSAGE, 'replace'])
    expect(w.toasts).toEqual(['clear cache: the brief was not sent (blocked by a policy hook); the handoff brief is in the prompt box, press Enter to send it'])
    await ui.unmount()
  })

  test('a draft in the prompt box is kept: the brief goes after it', async ($, on) => {
    const { w } = await ready($, on, { submit: 'throws', draft: 'my own note' })
    const ui = await band($)
    await clearCache(ui)
    expect(events(w)).toEqual([...FULL_FLOW, 'prompt.fill'])
    expect(w.calls.at(-1)).toEqual(['prompt.fill', `\n\n${MESSAGE}`, 'append'])
    await ui.unmount()
  })

  test('when the box refuses the clipboard takes the brief; when both refuse the brief goes whole to the transcript', async ($, on) => {
    const { w } = await ready($, on, { submit: 'drops', canFill: false })
    const ui = await band($)
    await clearCache(ui)
    expect(events(w)).toEqual([...FULL_FLOW, 'prompt.fill', 'ui.copy'])
    expect(w.toasts.at(-1)).toBe('clear cache: the brief was not sent (blocked by a policy hook); the handoff brief is on the clipboard')
    w.canCopy = false
    await turn($, 't3')
    const again = await desktopBand($)
    await clearCache(again)
    const problem = 'clear cache: the brief was not sent (blocked by a policy hook); the handoff brief is in the transcript, copy it into the prompt box to send it; /resume returns to the previous conversation'
    expect(w.toasts.at(-1)).toBe(problem)
    expect(w.transcript.slice(-3)).toEqual([
      'prompt-cache-control: clear cache: the handoff brief, to copy into the prompt box and send:',
      handoffMessage({ brief: BRIEF, sessionId: 's2', contextTokens: '151k' }),
      `prompt-cache-control: ${problem}`,
    ])
    await again.unmount()
    await ui.unmount()
  })

  test('without session ids the mod relies on seeing its own /clear end the session', async ($, on) => {
    const { w } = await ready($, on, { isIdDenied: true })
    const ui = await band($)
    await clearCache(ui)
    expect(events(w)).toEqual(FULL_FLOW)
    expect(sent(w)).toContain('session unknown,')
    expect(w.toasts).toEqual([SUCCESS])
    await ui.unmount()
  })

  test('without session ids, a /clear another plugin answered in place is not taken for a clear', async ($, on) => {
    const { w } = await ready($, on, { isIdDenied: true, clear: 'ignored' })
    const ui = await band($)
    await clearCache(ui)
    expect(events(w)).toEqual(['model.fork', 'command.run', 'ui.copy'])
    expect(w.toasts).toEqual(['clear cache: /clear did not start a new conversation, nothing was cleared; the handoff brief is on the clipboard'])
    await ui.unmount()
  })

  test('without session ids, an earlier clear is not remembered for the next handoff', async ($, on) => {
    const { w } = await ready($, on, { isIdDenied: true })
    const ui = await band($)
    await clearCache(ui)
    expect(w.toasts).toEqual([SUCCESS])
    await endTurn($, 'brief-turn')
    await turn($, 't9')
    w.clear = 'ignored'
    await clearCache(ui)
    expect(events(w).slice(-3)).toEqual(['model.fork', 'command.run', 'ui.copy'])
    expect(w.toasts.at(-1)).toBe('clear cache: /clear did not start a new conversation, nothing was cleared; the handoff brief is on the clipboard')
    await ui.unmount()
  })

  test('every clipboard copy goes to the surface the press came from', async ($, on) => {
    const cases: Partial<World>[] = [
      { clear: 'ignored' },
      { fork: answered(CUT_BRIEF) },
      { turnBeforeClear: true, canFill: false },
      { submit: 'drops', canFill: false },
    ]
    const w = world()
    fakeEngine($, on, w)
    await $.session.start(START)
    let n = 1
    for (const over of cases) {
      Object.assign(w, world({ ...over, sessionId: w.sessionId }), { calls: [], copySurfaces: [] })
      n += 1
      await turn($, `t${n}`)
      const ui = await desktopBand($)
      await clearCache(ui)
      expect(w.copySurfaces).toEqual(['desktop'])
      await ui.unmount()
      if (events(w).includes('prompt.submit')) await endTurn($, 'brief-turn')
    }
    Object.assign(w, world({ clear: 'ignored', sessionId: w.sessionId }), { calls: [], copySurfaces: [] })
    await turn($, 't-pane')
    const side = await pane($, 'desktop')
    await clearCache(side)
    expect(w.copySurfaces).toEqual(['desktop'])
    await side.unmount()
  })
})

describe('the clear cache button in the /cache pane', () => {
  test('sits after close, opens the same message field, and Enter runs the same handoff', async ($, on) => {
    const { w } = await ready($, on)
    const ui = await pane($)
    expect(await buttons(ui)).toEqual(['close', 'clear-cache'])
    expect(await ui.find({ key: 'clear-cache' })).toMatchObject({ props: { dimColor: false } })
    expect(await ui.press({ key: 'clear-cache' })).toEqual({ element: 'clear-cache' })
    expect(events(w)).toEqual([])
    expect(await buttons(ui)).toEqual(['cancel-handoff', 'close'])
    await enter(ui, '')
    expect(events(w)).toEqual(FULL_FLOW)
    expect(await ui.find({ type: 'Text', text: /no requests yet/ })).toBeDefined()
    expect(await ui.find({ key: 'clear-cache' })).toBeUndefined()
    await ui.unmount()
  })

  test('shows the phase and cancel while the brief is written', async ($, on) => {
    const { w, clock } = await ready($, on, { forkDelayMs: 30_000 })
    const ui = await pane($)
    await clearCache(ui)
    expect(await ui.find({ type: 'Text', text: /writing the handoff brief…/ })).toBeDefined()
    expect(await buttons(ui)).toEqual(['close', 'cancel-handoff'])
    await clock.advance(1_000)
    await ui.press({ key: 'cancel-handoff' })
    await clock.advance(29_000)
    expect(events(w)).toEqual(['model.fork'])
    await ui.unmount()
  })
})

describe('composing the message before the handoff', () => {
  for (const surface of SURFACES) {
    test(`on the ${surface} a press opens the message field and runs nothing until Enter, however long it waits, and asks for the field's focus`, async ($, on) => {
      const { w, clock } = await ready($, on, { forkDelayMs: 30_000, ...ON_SURFACE[surface] })
      const ui = await surfaceBand($, surface)
      expect(await ui.find({ key: FIELD })).toBeUndefined()
      await ui.press({ key: 'clear-cache' })
      expect(events(w)).toEqual([])
      const field = await ui.find({ key: FIELD })
      expect(field).toMatchObject({ type: 'Input', props: { label: 'message', placeholder: FIELD_HINT, submitLabel: FIELD_SUBMIT, autoFocus: true } })
      expect(field?.props).not.toHaveProperty('value')
      expect(await ui.find({ type: 'Text', text: COMPOSING })).toBeDefined()
      expect(await buttons(ui)).toEqual(['cancel-handoff'])
      expect(focusAsked(w, BAND_ID)).toBe(true)
      expect(w.transcript.filter(l => l.includes('took no focus'))).toEqual([])
      await clock.advance(600_000)
      expect(events(w)).toEqual([])
      expect(w.toasts).toEqual([])
      expect(await ui.find({ key: FIELD })).toBeDefined()
      await enter(ui, '')
      expect(events(w)).toEqual(['model.fork'])
      expect(await ui.find({ key: FIELD })).toBeUndefined()
      await clock.advance(30_000)
      expect(events(w)).toEqual(FULL_FLOW)
      expect(sent(w)).toBe(MESSAGE)
      await ui.unmount()
    })

    test(`on the ${surface} the field sits one row under the phase row, and cancel follows the field with a gap, never above or below its submit`, async ($, on) => {
      await ready($, on, ON_SURFACE[surface])
      const ui = await surfaceBand($, surface)
      await ui.press({ key: 'clear-cache' })
      const column = (await ui.findAll({ type: 'Box' })).find(b => b.props.flexDirection === 'column' && keyOf(b.children[1]) === 'message-row')
      const [phaseRow, fieldRow] = column?.children ?? []
      expect(phaseRow).toMatchObject({ type: 'Box', props: { flexDirection: 'row' } })
      expect(JSON.stringify(phaseRow)).toContain(COMPOSING)
      expect(JSON.stringify(phaseRow)).not.toContain('cancel-handoff')
      expect(fieldRow).toMatchObject({
        type: 'Box',
        props: { flexDirection: 'row', marginTop: 1 },
        children: [
          { type: 'Box', props: { flexGrow: 1, flexShrink: 1, minWidth: 0 }, children: [{ type: 'Input', props: { key: FIELD } }] },
          { type: 'Box', props: { flexShrink: 0, marginLeft: 3 }, children: [{ type: 'Button', props: { key: 'cancel-handoff' } }] },
        ],
      })
      expect(column?.children).toHaveLength(2)
      await ui.unmount()
    })
  }

  for (const [bodyColumns, hint] of [
    [80, FIELD_HINT_SHORT],
    [FIELD_HINT_MIN_ROOM - 1, FIELD_HINT_SHORT],
    [FIELD_HINT_MIN_ROOM, FIELD_HINT],
  ] as const) {
    test(`at ${bodyColumns} body columns the field gets the ${hint === FIELD_HINT ? 'long' : 'short'} placeholder, so the submit label and cancel keep their room`, async ($, on) => {
      await ready($, on)
      const ui = await band($, narrowBand(bodyColumns), bodyColumns + 5)
      await ui.press({ key: 'clear-cache' })
      expect(await ui.find({ key: FIELD })).toMatchObject({ props: { placeholder: hint } })
      await ui.unmount()
    })
  }

  test('a band too narrow for the whole phase text shows the short one, which still says the field may stay empty', async ($, on) => {
    await ready($, on)
    const narrow = await band($, narrowBand(COMPOSE_MIN_ROOM - 1), COMPOSE_MIN_ROOM + 4)
    await narrow.press({ key: 'clear-cache' })
    expect(await narrow.find({ type: 'Text', text: COMPOSE_TEXT_SHORT })).toBeDefined()
    await narrow.unmount()
    const wide = await band($, narrowBand(COMPOSE_MIN_ROOM), COMPOSE_MIN_ROOM + 5)
    expect(await wide.find({ type: 'Text', text: COMPOSING })).toBeDefined()
    await wide.unmount()
  })

  for (const surface of SURFACES) {
    test(`on the ${surface} Enter with a message starts the handoff with it as the last block, and the fork never sees it`, async ($, on) => {
      const { w, clock } = await ready($, on, { forkDelayMs: 30_000, ...ON_SURFACE[surface] })
      const ui = await surfaceBand($, surface)
      await ui.press({ key: 'clear-cache' })
      await typeInto(ui, 'run the')
      await typeInto(ui, TASK)
      expect(events(w)).toEqual([])
      await enter(ui, `  ${TASK}  `)
      expect(await ui.find({ type: 'Text', text: 'writing the handoff brief, your message goes with it…' })).toBeDefined()
      expect(await ui.find({ key: FIELD })).toBeUndefined()
      expect(await buttons(ui)).toEqual(['cancel-handoff'])
      await clock.advance(30_000)
      expect(w.calls).toEqual([
        ['model.fork', FORK_PROMPT],
        ['command.run', 'clear', ''],
        ['session.end', 'clear', 's1'],
        ['prompt.submit', WITH_TASK, AS_USER],
      ])
      expect(sent(w)).toEndWith(`<my_message>\n${TASK}\n</my_message>`)
      expect(w.toasts).toEqual([SUCCESS_WITH])
      await ui.unmount()
    })

    test(`on the ${surface} an empty Enter, even after typing that was erased, sends the plain clear text byte for byte`, async ($, on) => {
      const { w, clock } = await ready($, on, { forkDelayMs: 30_000, ...ON_SURFACE[surface] })
      const ui = await surfaceBand($, surface)
      await ui.press({ key: 'clear-cache' })
      await typeInto(ui, TASK)
      await typeInto(ui, '')
      await enter(ui, '   ')
      expect(await ui.find({ type: 'Text', text: 'writing the handoff brief…' })).toBeDefined()
      await clock.advance(30_000)
      expect(events(w)).toEqual(FULL_FLOW)
      expect(sent(w)).toBe(MESSAGE)
      expect(w.toasts).toEqual([SUCCESS])
      await ui.unmount()
    })
  }

  test('the sending row says the message goes with the brief', async ($, on) => {
    const { w, clock } = await ready($, on, { forkDelayMs: 1_000, submitWaitMs: 4_000 })
    const ui = await band($)
    await clearCache(ui, TASK)
    await clock.advance(1_000)
    expect(await ui.find({ type: 'Text', text: 'sending the brief and your message to the fresh conversation…' })).toBeDefined()
    expect(await ui.find({ key: FIELD })).toBeUndefined()
    await clock.advance(4_000)
    expect(w.toasts).toEqual([SUCCESS_WITH])
    await ui.unmount()
  })

  test('a field that empties itself after Enter still sends the message it submitted', async ($, on) => {
    const { w, clock } = await ready($, on, { forkDelayMs: 30_000 })
    const ui = await band($)
    await clearCache(ui, TASK)
    await typeInto(ui, '').catch(() => undefined)
    await clock.advance(30_000)
    expect(sent(w)).toBe(WITH_TASK)
    await ui.unmount()
  })

  test('cancel while the field is open is quiet and immediate: a plain toast, no transcript line, nothing run', async ($, on) => {
    const { w } = await ready($, on)
    const ui = await band($)
    await ui.press({ key: 'clear-cache' })
    await ui.press({ key: 'cancel-handoff' })
    expect(w.toasts).toEqual([COMPOSE_CANCELLED])
    expect(w.toastTimeouts).toEqual([undefined])
    expect(w.transcript).toEqual([])
    expect(events(w)).toEqual([])
    expect(await ui.find({ key: FIELD })).toBeUndefined()
    expect(await ui.find({ key: 'clear-cache' })).toBeDefined()
    await ui.unmount()
  })

  test('no expiry countdown toast while the message field is open', { options: { warnSeconds: 1000 } }, async ($, on) => {
    const { w, clock } = await ready($, on)
    const ui = await band($)
    await ui.press({ key: 'clear-cache' })
    await clock.advance(1_000)
    expect(w.toasts).toEqual([])
    await ui.press({ key: 'cancel-handoff' })
    await clock.advance(1_000)
    expect(w.toasts).toHaveLength(2)
    expect(w.toasts[0]).toBe(COMPOSE_CANCELLED)
    expect(w.toasts[1]).toStartWith('cache expires in ')
    await ui.unmount()
  })

  type Stop = ($: Engine, ui: { press: (target: { key: string }) => Promise<unknown> }) => Promise<unknown>
  const STOPS: { name: string; isComposing: boolean; note: string; stop: Stop }[] = [
    { name: 'cancel while the field is open', isComposing: true, note: COMPOSE_CANCELLED, stop: ($, ui) => ui.press({ key: 'cancel-handoff' }) },
    { name: 'a turn while the field is open', isComposing: true, note: 'clear cache: a turn started while the message field was open, nothing was cleared', stop: $ => $.turn.start({ text: 'a task notification', turnId: 't2' }) },
    { name: 'a prompt while the field is open', isComposing: true, note: 'clear cache: a prompt was sent while the message field was open, nothing was cleared', stop: $ => $.prompt.submit({ text: 'one more thing' } as never) },
    { name: 'a /clear of the person while the field is open', isComposing: true, note: 'clear cache: the conversation changed while the message field was open, nothing was sent', stop: $ => $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } }) },
    { name: 'cancel while the brief is written', isComposing: false, note: CANCELLED, stop: ($, ui) => ui.press({ key: 'cancel-handoff' }) },
    { name: 'a prompt while the brief is written', isComposing: false, note: 'clear cache: a prompt was sent while the brief was being written, nothing was cleared', stop: $ => $.prompt.submit({ text: 'one more thing' } as never) },
  ]
  for (const surface of SURFACES) {
    for (const { name, isComposing, note, stop } of STOPS) {
      test(`on the ${surface} ${name} clears nothing and gives the message back`, async ($, on) => {
        const { w, clock } = await ready($, on, { forkDelayMs: 30_000, ...ON_SURFACE[surface] })
        const ui = await surfaceBand($, surface)
        await ui.press({ key: 'clear-cache' })
        await typeInto(ui, TASK)
        if (!isComposing) {
          await enter(ui, TASK)
          await clock.advance(1_000)
        }
        await stop($, ui)
        expect(w.toasts).toEqual([`${note}; ${GIVEN_BACK[surface]}`])
        expect(givenBack(w, surface)).toBe(true)
        expect(events(w)).not.toContain('command.run')
        if (isComposing) expect(events(w)).not.toContain('model.fork')
        expect(await ui.find({ key: FIELD })).toBeUndefined()
        await clock.advance(30_000)
        expect(events(w)).not.toContain('command.run')
        expect(w.toasts).toHaveLength(1)
        await ui.unmount()
      })
    }
  }

  for (const surface of SURFACES) {
    for (const reason of ['prompt_input_exit', 'logout', 'other'] as const) {
      test(`on the ${surface} an exit (${reason}) while the brief is written puts the message in the transcript, not in the prompt box of a process that is ending`, async ($, on) => {
        const { w, clock } = await ready($, on, { forkDelayMs: 30_000, ...ON_SURFACE[surface] })
        const ui = await surfaceBand($, surface)
        await clearCache(ui, TASK)
        await $.session.end({ reason, sessionId: 's1', resume: { id: 's1' } })
        const note = 'clear cache: the conversation changed while the brief was being written, nothing was sent; your message is in the transcript'
        expect(events(w)).toEqual(['model.fork', 'session.end'])
        expect(w.toasts).toEqual([note])
        expect(w.transcript).toEqual([NOT_SENT, TASK, `prompt-cache-control: ${note}`])
        await clock.advance(30_000)
        expect(events(w)).toEqual(['model.fork', 'session.end'])
        await ui.unmount()
      })
    }
  }

  test('an exit while the field is open puts the text typed there in the transcript', async ($, on) => {
    const { w } = await ready($, on)
    const ui = await band($)
    await ui.press({ key: 'clear-cache' })
    await typeInto(ui, TASK)
    await $.session.end({ reason: 'prompt_input_exit', sessionId: 's1', resume: { id: 's1' } })
    expect(events(w)).toEqual(['session.end'])
    expect(w.transcript.slice(0, 2)).toEqual([NOT_SENT, TASK])
    expect(w.toasts).toEqual(['clear cache: the conversation changed while the message field was open, nothing was sent; your message is in the transcript'])
    await ui.unmount()
  })

  test('an exit while the brief is written with no message gives no give-back', async ($, on) => {
    const { w, clock } = await ready($, on, { forkDelayMs: 30_000 })
    const ui = await band($)
    await clearCache(ui)
    await $.session.end({ reason: 'other', sessionId: 's1', resume: { id: 's1' } })
    expect(w.toasts).toEqual(['clear cache: the conversation changed while the brief was being written, nothing was sent'])
    expect(w.transcript).toEqual(['prompt-cache-control: clear cache: the conversation changed while the brief was being written, nothing was sent'])
    await clock.advance(30_000)
    expect(events(w)).toEqual(['model.fork', 'session.end'])
    await ui.unmount()
  })

  test('an Enter after the model started working runs nothing: the field closes with the reason and the text comes back', async ($, on) => {
    const { w } = await ready($, on)
    const ui = await band($)
    await ui.press({ key: 'clear-cache' })
    await ui.redraw({ hasSurvey: false, isWorking: true, bodyColumns: 115 } as never)
    await enter(ui, TASK)
    expect(w.calls).toEqual([['prompt.fill', TASK, 'replace']])
    expect(w.toasts).toEqual([`${RUNNING}; your message is back in the prompt box`])
    expect(await ui.find({ key: FIELD })).toBeUndefined()
    await ui.unmount()
  })

  test('an Enter in the pane after a main-loop request with no turn start seen (a reload mid-turn) is refused the same way', async ($, on) => {
    const { w } = await ready($, on)
    const side = await pane($)
    await side.press({ key: 'clear-cache' })
    await step($, 't2')
    await enter(side, TASK)
    expect(events(w)).toEqual(['prompt.fill'])
    expect(w.toasts).toEqual([`${RUNNING}; your message is back in the prompt box`])
    expect(await side.find({ key: FIELD })).toBeUndefined()
    await side.unmount()
  })

  for (const surface of SURFACES) {
    test(`on the ${surface} a brief that fails gives the message back`, async ($, on) => {
      const { w, clock } = await ready($, on, { forks: [{ answer: OVERLOADED, delayMs: 30_000 }], ...ON_SURFACE[surface] })
      const ui = await surfaceBand($, surface)
      await clearCache(ui, TASK)
      await clock.advance(30_000)
      expect(w.toasts).toEqual([`clear cache: the API answered with an error (529, overloaded), nothing was cleared; ${GIVEN_BACK[surface]}`])
      expect(givenBack(w, surface)).toBe(true)
      await ui.unmount()
    })
  }

  test('a message from a stopped handoff does not ride with the next one', async ($, on) => {
    const { w, clock } = await ready($, on, { forkDelayMs: 30_000 })
    const ui = await band($)
    await clearCache(ui, TASK)
    await clock.advance(1_000)
    await ui.press({ key: 'cancel-handoff' })
    await ui.press({ key: 'clear-cache' })
    expect(await ui.find({ type: 'Text', text: /message: / })).toBeUndefined()
    await enter(ui, '')
    expect(await ui.find({ type: 'Text', text: 'writing the handoff brief…' })).toBeDefined()
    await clock.advance(30_000)
    expect(w.calls.at(-1)).toEqual(['prompt.submit', MESSAGE, AS_USER])
    expect(w.toasts.at(-1)).toBe(SUCCESS)
    await ui.unmount()
  })

  test('while the field is open or the brief is written, the clock, the status line and typing never redraw the band; the press and Enter redraw it once each', { options: { status: true } }, async ($, on) => {
    const { w, clock } = await ready($, on, { forkDelayMs: 30_000 })
    const ui = await band($)
    let drawn = { invalidations: 0, statusLines: 0, bandDraws: 0 }
    const mark = () => {
      drawn = { invalidations: w.invalidations, statusLines: w.statusLines, bandDraws: w.bandDraws }
    }
    const since = () => ({ invalidations: w.invalidations - drawn.invalidations, statusLines: w.statusLines - drawn.statusLines, bandDraws: w.bandDraws - drawn.bandDraws })
    const none = { invalidations: 0, statusLines: 0, bandDraws: 0 }
    mark()
    await clock.advance(1_000)
    expect(since()).toEqual({ invalidations: 1, statusLines: 1, bandDraws: 1 })
    mark()
    await ui.press({ key: 'clear-cache' })
    expect(since()).toEqual({ invalidations: 1, statusLines: 0, bandDraws: 1 })
    mark()
    await clock.advance(5_000)
    await typeInto(ui, 'run')
    await typeInto(ui, TASK)
    await clock.advance(5_000)
    expect(since()).toEqual(none)
    await enter(ui, TASK)
    expect(since()).toEqual({ invalidations: 1, statusLines: 0, bandDraws: 1 })
    mark()
    await clock.advance(20_000)
    expect(since()).toEqual(none)
    await ui.press({ key: 'cancel-handoff' })
    mark()
    await clock.advance(1_000)
    expect(since()).toEqual({ invalidations: 1, statusLines: 1, bandDraws: 1 })
    await ui.unmount()
  })

  test('the pane countdown pauses while the field is open and while the brief is written', async ($, on) => {
    const { w, clock } = await ready($, on, { forkDelayMs: 30_000 })
    const side = await pane($)
    await side.press({ key: 'clear-cache' })
    let before = w.invalidations
    await clock.advance(10_000)
    expect(w.invalidations).toBe(before)
    await enter(side, '')
    before = w.invalidations
    await clock.advance(10_000)
    expect(w.invalidations).toBe(before)
    await clock.advance(20_000)
    expect(events(w)).toEqual(FULL_FLOW)
    await side.unmount()
  })

  test('a brief kept after the clear carries the message in its text', async ($, on) => {
    const { w, clock } = await ready($, on, { forkDelayMs: 30_000, turnBeforeClear: true })
    const ui = await band($)
    await clearCache(ui, TASK)
    await clock.advance(30_000)
    expect(events(w)).toEqual(['model.fork', 'command.run', 'session.end', 'prompt.fill'])
    expect(w.calls.at(-1)).toEqual(['prompt.fill', WITH_TASK, 'replace'])
    expect(w.toasts).toEqual([
      'clear cache: a turn started while /clear was pending, so the brief may not cover it; the handoff brief with your message is in the prompt box, read it before you send it; /resume returns to the previous conversation',
    ])
    await ui.unmount()
  })

  test('on the desktop a dropped brief with a message goes whole to the transcript', async ($, on) => {
    const { w, clock } = await ready($, on, { forkDelayMs: 30_000, submit: 'drops', ...ON_SURFACE.desktop })
    const ui = await surfaceBand($, 'desktop')
    await clearCache(ui, TASK)
    await clock.advance(30_000)
    const problem = 'clear cache: the brief was not sent (blocked by a policy hook); the handoff brief with your message is in the transcript, copy it into the prompt box to send it; /resume returns to the previous conversation'
    expect(w.toasts).toEqual([problem])
    expect(w.transcript).toEqual(['prompt-cache-control: clear cache: the handoff brief, to copy into the prompt box and send:', WITH_TASK, `prompt-cache-control: ${problem}`])
    await ui.unmount()
  })

  const NOT_CLEARED = [
    { name: 'a cut-off brief', over: { fork: answered(CUT_BRIEF) }, brief: CUT_BRIEF, why: 'the brief looks cut off (it has no Chat-only material section)', head: ['model.fork'] },
    { name: 'a /clear that does not run', over: { clear: 'ignored' as const }, brief: BRIEF, why: '/clear did not start a new conversation', head: ['model.fork', 'command.run'] },
  ]
  for (const { name, over, brief, why, head } of NOT_CLEARED) {
    test(`${name} keeps the brief with the message on the clipboard and gives the message back to the prompt box`, async ($, on) => {
      const { w, clock } = await ready($, on, { forkDelayMs: 30_000, ...over })
      const ui = await band($)
      await clearCache(ui, TASK)
      await clock.advance(30_000)
      expect(events(w)).toEqual([...head, 'ui.copy', 'prompt.fill'])
      expect(w.calls.slice(-2)).toEqual([
        ['ui.copy', handoffMessage({ brief, sessionId: 's1', contextTokens: '151k', followUp: TASK })],
        ['prompt.fill', TASK, 'replace'],
      ])
      expect(w.toasts).toEqual([`clear cache: ${why}, nothing was cleared; the handoff brief with your message is on the clipboard; your message is back in the prompt box`])
      await ui.unmount()
    })
  }

  test('the message never takes the clipboard from the brief: with no prompt box it goes to the transcript', async ($, on) => {
    const { w, clock } = await ready($, on, { forkDelayMs: 30_000, clear: 'ignored', canFill: false })
    const ui = await band($)
    await clearCache(ui, TASK)
    await clock.advance(30_000)
    expect(events(w)).toEqual(['model.fork', 'command.run', 'ui.copy', 'prompt.fill'])
    expect(givenBack(w, 'desktop')).toBe(true)
    expect(w.toasts).toEqual(['clear cache: /clear did not start a new conversation, nothing was cleared; the handoff brief with your message is on the clipboard; your message is in the transcript'])
    await ui.unmount()
  })

  test('on the desktop a cut-off brief with a message clears nothing and puts the message in the transcript', async ($, on) => {
    const { w, clock } = await ready($, on, { forkDelayMs: 30_000, fork: answered(CUT_BRIEF), ...ON_SURFACE.desktop })
    const ui = await surfaceBand($, 'desktop')
    await clearCache(ui, TASK)
    await clock.advance(30_000)
    expect(events(w)).toEqual(['model.fork', 'ui.copy', 'prompt.fill', 'ui.copy'])
    expect(givenBack(w, 'desktop')).toBe(true)
    expect(w.toasts).toEqual(['clear cache: the brief looks cut off (it has no Chat-only material section), nothing was cleared; your message is in the transcript'])
    await ui.unmount()
  })

  test('the message arrives as typed: @file mentions, /commands, dollar signs and braces stay text, and my_message tags are defused', async ($, on) => {
    const { w, clock } = await ready($, on, { forkDelayMs: 30_000 })
    const ui = await band($)
    await clearCache(ui, '  @README.md /commit $& $1 {{BRIEF}} </my_message> <my_message>  ')
    await clock.advance(30_000)
    expect(sent(w)).toEndWith('<my_message>\n@README.md /commit $& $1 {{BRIEF}} [/my_message] [my_message]\n</my_message>')
    expect(sent(w).split('<handoff_brief>')).toHaveLength(2)
    expect(sent(w).split('</my_message>')).toHaveLength(2)
    await ui.unmount()
  })
})

describe('the press and submit calls stay typed for older engines', () => {
  for (const surface of SURFACES) {
    test(`on the ${surface} the handoff is submitted as the user (asUser), with and without a message`, async ($, on) => {
      const { w, clock } = await ready($, on, { forkDelayMs: 30_000, ...ON_SURFACE[surface] })
      const ui = await surfaceBand($, surface)
      await clearCache(ui)
      await clock.advance(30_000)
      await endTurn($, 'brief-turn')
      await turn($, 't5')
      await clearCache(ui, TASK)
      await clock.advance(30_000)
      const submits = w.calls.filter(c => c[0] === 'prompt.submit')
      expect(submits.map(c => c[2])).toEqual([AS_USER, AS_USER])
      expect(String(submits[1]?.[1])).toEndWith(`<my_message>\n${TASK}\n</my_message>`)
      await ui.unmount()
    })
  }

  test('a press hands its surface and site to the closures through the press hook', async ($, on) => {
    const { w, clock } = await ready($, on, { forkDelayMs: 30_000, fork: answered(CUT_BRIEF) })
    const top = await surfaceBand($, 'desktop')
    await top.press({ key: 'clear-cache' })
    expect(focusAsked(w, BAND_ID)).toBe(true)
    await enter(top, '')
    await clock.advance(30_000)
    expect(w.copySurfaces).toEqual(['desktop'])
    await top.unmount()
    const side = await pane($, 'terminal')
    await side.press({ key: 'clear-cache' })
    expect(focusAsked(w, 'cache')).toBe(true)
    await enter(side, '')
    await clock.advance(30_000)
    expect(w.copySurfaces).toEqual(['desktop', 'terminal'])
    await side.unmount()
  })
})

describe('the message field in the /cache pane', () => {
  for (const surface of ['terminal', 'desktop', 'vscode'] as const) {
    test(`on ${surface} the pane composes the same way: the phase line, then the field with cancel after it, and only Enter starts the handoff`, async ($, on) => {
      const { w, clock } = await ready($, on, { forkDelayMs: 30_000 })
      const sp = (text: string) => (surface === 'terminal' ? text : nbsp(text))
      const side = await $.ui.mount({ plugin: PLUGIN, surface, component: 'Pane', requestId: 'cache', props: PANE })
      await side.press({ key: 'clear-cache' })
      expect(events(w)).toEqual([])
      expect(await side.find({ type: 'Text', text: sp(`✎ ${COMPOSE_TEXT_SHORT}`) })).toBeDefined()
      expect(await side.find({ key: FIELD })).toMatchObject({ type: 'Input', props: { label: 'message', placeholder: FIELD_HINT_SHORT, submitLabel: FIELD_SUBMIT } })
      expect(await side.find({ key: 'message-row' })).toMatchObject({
        props: { flexDirection: 'row', marginTop: 1 },
        children: [{ children: [{ type: 'Input', props: { key: FIELD } }] }, { props: { marginLeft: 3 }, children: [{ type: 'Button', props: { key: 'cancel-handoff' } }] }],
      })
      expect(await buttons(side)).toEqual(['cancel-handoff', 'close'])
      expect(focusAsked(w, 'cache')).toBe(true)
      await typeInto(side, TASK)
      await clock.advance(60_000)
      expect(events(w)).toEqual([])
      await enter(side, TASK)
      expect(await side.find({ type: 'Text', text: sp('✎ writing the handoff brief, your message goes with it…') })).toBeDefined()
      expect(await buttons(side)).toEqual(['close', 'cancel-handoff'])
      await clock.advance(30_000)
      expect(sent(w)).toBe(WITH_TASK)
      expect(w.toasts).toEqual([SUCCESS_WITH])
      await side.unmount()
    })
  }

  for (const surface of SURFACES) {
    test(`on the ${surface} text left in the band field shows under the pane field, and an empty Enter there sends it`, async ($, on) => {
      const { w, clock } = await ready($, on, { forkDelayMs: 30_000, ...ON_SURFACE[surface] })
      const top = await surfaceBand($, surface)
      await top.press({ key: 'clear-cache' })
      await typeInto(top, TASK)
      await openPane($)
      const side = await pane($, surface)
      expect(await side.find({ key: FIELD })).toBeDefined()
      expect(await side.find({ type: 'Text', text: shown(surface, `message: ${TASK}`) })).toBeDefined()
      expect(events(w)).toEqual([])
      await enter(side, '')
      expect(await side.find({ type: 'Text', text: /message: / })).toBeUndefined()
      await clock.advance(30_000)
      expect(sent(w)).toBe(WITH_TASK)
      expect(w.toasts).toEqual([SUCCESS_WITH])
      await side.unmount()
      await top.unmount()
    })

    test(`on the ${surface} text left in the pane field shows under the band field once the pane closes, and an empty Enter in the band sends it`, async ($, on) => {
      const { w, clock } = await ready($, on, { forkDelayMs: 30_000, ...ON_SURFACE[surface] })
      const top = await surfaceBand($, surface)
      await openPane($)
      expect(await buttons(top)).toEqual([])
      const side = await pane($, surface)
      await side.press({ key: 'clear-cache' })
      await typeInto(side, TASK)
      await side.press({ key: 'close' })
      expect(await top.find({ key: FIELD })).toBeDefined()
      expect(await top.find({ type: 'Text', text: COMPOSING })).toBeDefined()
      expect(await top.find({ type: 'Text', text: `message: ${TASK}` })).toBeDefined()
      expect(await buttons(top)).toEqual(['cancel-handoff'])
      expect(events(w)).toEqual([])
      await enter(top, '')
      await clock.advance(30_000)
      expect(sent(w)).toBe(WITH_TASK)
      expect(w.toasts).toEqual([SUCCESS_WITH])
      await side.unmount()
      await top.unmount()
    })

    for (const origin of ['band', 'pane'] as const) {
      test(`on the ${surface} text left in the ${origin} field shows as a held line when that field comes back empty after the pane opens or closes`, async ($, on) => {
        const { w, clock } = await ready($, on, { forkDelayMs: 30_000, ...ON_SURFACE[surface] })
        const top = await surfaceBand($, surface)
        const side = await pane($, surface)
        if (origin === 'band') {
          await top.press({ key: 'clear-cache' })
          await typeInto(top, TASK)
          await openPane($)
          await $.command.run({ command: 'cache', args: 'stop' })
        } else {
          await openPane($)
          await side.press({ key: 'clear-cache' })
          await typeInto(side, TASK)
          await side.press({ key: 'close' })
          await openPane($)
        }
        const site = origin === 'band' ? top : side
        const held = origin === 'band' ? `message: ${TASK}` : shown(surface, `message: ${TASK}`)
        expect(await site.find({ key: FIELD })).toBeDefined()
        expect(await site.find({ type: 'Text', text: held })).toBeDefined()
        expect(events(w)).toEqual([])
        await enter(site, '')
        await clock.advance(30_000)
        expect(sent(w)).toBe(WITH_TASK)
        await side.unmount()
        await top.unmount()
      })
    }

    test(`on the ${surface} text typed into a field that shows a held line replaces it`, async ($, on) => {
      const { w, clock } = await ready($, on, { forkDelayMs: 30_000, ...ON_SURFACE[surface] })
      const top = await surfaceBand($, surface)
      await top.press({ key: 'clear-cache' })
      await typeInto(top, 'old words')
      await openPane($)
      const side = await pane($, surface)
      expect(await side.find({ type: 'Text', text: shown(surface, 'message: old words') })).toBeDefined()
      await typeInto(side, TASK)
      await enter(side, TASK)
      expect(await side.find({ type: 'Text', text: /message: / })).toBeUndefined()
      expect(await side.find({ type: 'Text', text: shown(surface, '✎ writing the handoff brief, your message goes with it…') })).toBeDefined()
      await clock.advance(30_000)
      expect(sent(w)).toBe(WITH_TASK)
      await side.unmount()
      await top.unmount()
    })

    test(`on the ${surface} text held from the band survives typing in the pane field that is erased again, so an empty Enter there still sends it`, async ($, on) => {
      const { w, clock } = await ready($, on, { forkDelayMs: 30_000, ...ON_SURFACE[surface] })
      const top = await surfaceBand($, surface)
      await top.press({ key: 'clear-cache' })
      await typeInto(top, TASK)
      await openPane($)
      const side = await pane($, surface)
      expect(await side.find({ type: 'Text', text: shown(surface, `message: ${TASK}`) })).toBeDefined()
      await typeInto(side, 'x')
      await typeInto(side, '')
      await side.redraw(PANE)
      expect(await side.find({ type: 'Text', text: shown(surface, `message: ${TASK}`) })).toBeDefined()
      await enter(side, '')
      await clock.advance(30_000)
      expect(sent(w)).toBe(WITH_TASK)
      expect(w.toasts).toEqual([SUCCESS_WITH])
      await side.unmount()
      await top.unmount()
    })

    test(`on the ${surface} text held from the band survives typing in the pane field that is erased again, so cancel there gives it back`, async ($, on) => {
      const { w } = await ready($, on, ON_SURFACE[surface])
      const top = await surfaceBand($, surface)
      await top.press({ key: 'clear-cache' })
      await typeInto(top, TASK)
      await openPane($)
      const side = await pane($, surface)
      await typeInto(side, 'x')
      await typeInto(side, '')
      await side.press({ key: 'cancel-handoff' })
      expect(w.toasts).toEqual([`${COMPOSE_CANCELLED}; ${GIVEN_BACK[surface]}`])
      expect(givenBack(w, surface)).toBe(true)
      expect(events(w)).not.toContain('model.fork')
      expect(events(w)).not.toContain('command.run')
      await side.unmount()
      await top.unmount()
    })

    test(`on the ${surface} a survey that hides the band detaches the text from its field, so the band shows it as a held line after`, async ($, on) => {
      const { w, clock } = await ready($, on, { forkDelayMs: 30_000, ...ON_SURFACE[surface] })
      const top = await surfaceBand($, surface)
      await top.press({ key: 'clear-cache' })
      await typeInto(top, TASK)
      expect(await top.find({ type: 'Text', text: `message: ${TASK}` })).toBeUndefined()
      await top.redraw({ hasSurvey: true, isWorking: false, bodyColumns: 115 } as never)
      expect(await top.find({ key: FIELD })).toBeUndefined()
      await top.redraw(BAND)
      expect(await top.find({ key: FIELD })).toBeDefined()
      expect(await top.find({ type: 'Text', text: `message: ${TASK}` })).toBeDefined()
      await enter(top, '')
      await clock.advance(30_000)
      expect(sent(w)).toBe(WITH_TASK)
      await top.unmount()
    })
  }

  test('on mobile the pane has no field: a field open elsewhere shows as waiting, with its text held and cancel, and cancel there gives the text back', async ($, on) => {
    const { w } = await ready($, on, ON_SURFACE.desktop)
    const top = await surfaceBand($, 'desktop')
    await top.press({ key: 'clear-cache' })
    await typeInto(top, TASK)
    const phone = await $.ui.mount({ plugin: PLUGIN, surface: 'mobile', component: 'Pane', requestId: 'cache', props: PANE })
    expect(await phone.find({ type: 'Input' })).toBeUndefined()
    expect(await phone.find({ type: 'Text', text: nbsp(`✎ ${COMPOSE_WITHOUT_FIELD}`) })).toBeDefined()
    expect(await phone.find({ type: 'Text', text: nbsp(`message: ${TASK}`) })).toBeDefined()
    expect(await buttons(phone)).toEqual(['close', 'cancel-handoff'])
    await phone.press({ key: 'cancel-handoff' })
    expect(w.toasts).toEqual([`${COMPOSE_CANCELLED}; your message is in the transcript`])
    expect(events(w)).toEqual(['prompt.fill', 'ui.copy'])
    expect(w.copySurfaces).toEqual(['desktop'])
    await phone.unmount()
    await top.unmount()
  })

  test('on mobile a press from the pane starts the plain clear at once and asks no focus', async ($, on) => {
    const { w } = await ready($, on)
    const phone = await $.ui.mount({ plugin: PLUGIN, surface: 'mobile', component: 'Pane', requestId: 'cache', props: PANE })
    await phone.press({ key: 'clear-cache' })
    expect(events(w)).toEqual(FULL_FLOW)
    expect(sent(w)).toBe(MESSAGE)
    expect(w.logs.some(l => l.includes('took no focus'))).toBe(false)
    expect(w.logs.some(l => l.includes('focus asked'))).toBe(false)
    await phone.unmount()
  })
})

describe('the band option', () => {
  type Close = { name: string; close: ($: Engine, side: { press: (target: { key: string }) => Promise<unknown> }) => Promise<unknown> }
  const CLOSES: Close[] = [
    { name: 'the close button', close: (_, side) => side.press({ key: 'close' }) },
    { name: '/cache stop', close: $ => $.command.run({ command: 'cache', args: 'stop' }) },
  ]
  for (const surface of SURFACES) {
    for (const { name, close } of CLOSES) {
      test(`false on the ${surface}: closing the pane with ${name} while its field is open cancels quietly and gives the text back, since no band can show the field and the expiry toasts would stay paused`, { options: { band: false, warnSeconds: 1000 } }, async ($, on) => {
        const { w, clock } = await ready($, on, ON_SURFACE[surface])
        const top = await surfaceBand($, surface)
        await openPane($)
        const side = await pane($, surface)
        await side.press({ key: 'clear-cache' })
        await typeInto(side, TASK)
        await close($, side)
        expect(w.toasts).toEqual([`${COMPOSE_CANCELLED}; ${GIVEN_BACK[surface]}`])
        expect(givenBack(w, surface)).toBe(true)
        expect(events(w)).not.toContain('model.fork')
        expect(await top.find({ key: FIELD })).toBeUndefined()
        expect(await top.find({ key: 'cancel-handoff' })).toBeUndefined()
        expect(await side.find({ key: FIELD })).toBeUndefined()
        expect(await buttons(side)).toEqual(['close', 'clear-cache'])
        await clock.advance(1_000)
        expect(w.toasts).toHaveLength(2)
        expect(w.toasts[1]).toStartWith('cache expires in ')
        await side.unmount()
        await top.unmount()
      })
    }
  }
})

describe('the clearButton option', () => {
  test('false draws no clear cache button in the band or the pane', { options: { clearButton: false } }, async ($, on) => {
    await ready($, on)
    const top = await band($)
    expect(await top.find({ type: 'Text', text: /9\d%/ })).toBeDefined()
    expect(await top.find({ key: 'clear-cache' })).toBeUndefined()
    await top.unmount()
    const side = await pane($)
    expect(await buttons(side)).toEqual(['close'])
    await side.unmount()
  })
})

describe('the clearMessage option', () => {
  for (const surface of SURFACES) {
    test(`false on the ${surface}: a press in the band starts the handoff at once, with no field at any point`, { options: { clearMessage: false } }, async ($, on) => {
      const { w, clock } = await ready($, on, { forkDelayMs: 30_000, ...ON_SURFACE[surface] })
      const ui = await surfaceBand($, surface)
      await ui.press({ key: 'clear-cache' })
      expect(events(w)).toEqual(['model.fork'])
      expect(await ui.find({ key: FIELD })).toBeUndefined()
      expect(await ui.find({ type: 'Text', text: 'writing the handoff brief…' })).toBeDefined()
      expect(await buttons(ui)).toEqual(['cancel-handoff'])
      expect(w.logs.some(l => l.includes('focus asked'))).toBe(false)
      await clock.advance(30_000)
      expect(events(w)).toEqual(FULL_FLOW)
      expect(sent(w)).toBe(MESSAGE)
      expect(w.toasts).toEqual([SUCCESS])
      await ui.unmount()
    })
  }

  test('false: a press in the /cache pane starts the handoff at once too, and no field is drawn', { options: { clearMessage: false } }, async ($, on) => {
    const { w, clock } = await ready($, on, { forkDelayMs: 30_000 })
    const side = await pane($)
    await side.press({ key: 'clear-cache' })
    expect(events(w)).toEqual(['model.fork'])
    expect(await side.find({ key: FIELD })).toBeUndefined()
    expect(await buttons(side)).toEqual(['close', 'cancel-handoff'])
    await clock.advance(30_000)
    expect(events(w)).toEqual(FULL_FLOW)
    await side.unmount()
  })
})

const PINNED_FRAME = `[Clear cache handoff, sent by my cache control mod on my behalf]

I pressed clear cache, so our previous conversation (session {{SESSION_ID}}, about {{CONTEXT_TOKENS}} tokens of context) was cleared to start a fresh prompt cache. The work itself has not changed. Just before the clear, the previous instance of you wrote the brief below from that conversation alone, without tools. It is all you know of that work; your CLAUDE.md files and memory are loaded as usual. In the brief, the user means me.

<handoff_brief>
{{BRIEF}}
</handoff_brief>

The instructions the brief records from me still apply. The rest is a condensed account that may be incomplete or out of date: where it disagrees with what you find, trust what you find and tell me, and where I correct it, my correction wins.

What to do now:
1. Do not use tools or continue the work yet, even if the brief says I want you to work without stopping.
2. Reply in a few short lines, without restating the brief: anything urgent or half-done, the goal and where it stands, the exact next step you would take, each question waiting on me (so I can answer it here), and anything unclear, contradictory or at odds with your CLAUDE.md files or memory. If the brief is missing, empty, cut off or not a brief at all, say so and ask how to proceed.
3. Then wait for my go-ahead. Once I give it, first check what the next step depends on, above all anything marked unverified or unknown (for example with git status or by reading the files the brief names), then follow its Next steps. Do not redo finished work or re-explore what the brief already establishes.

If you need a detail the brief lacks, ask me rather than guess, or search the old transcript, {{SESSION_ID}}.jsonl (normally under ~/.claude/projects), for one specific term at a time, printing only a short window around each match. Never read it whole: that would refill the context I just cleared. I can also reopen the old conversation with /resume.`

describe('handoff texts', () => {
  test('the plain clear frame stays byte for byte what it was before the message field', () => {
    expect(HANDOFF_FRAME).toBe(PINNED_FRAME)
  })

  test('the fork prompt asks for the headings the brief checks use and keeps its own rules out of the brief', () => {
    for (const heading of ['## Goal', '## Next steps', '## Chat-only material']) expect(FORK_PROMPT).toContain(heading)
    expect(FORK_PROMPT).toContain('leave them out of the brief, without mentioning them')
    expect(FORK_PROMPT).toContain('its scratchpad or temporary folders')
    expect(FORK_PROMPT).toContain('a one-off request that is done is not a standing rule')
    expect(HANDOFF_FRAME.split('{{BRIEF}}')).toHaveLength(2)
    const dashes = [String.fromCharCode(0x2013), String.fromCharCode(0x2014)]
    const shown = [FORK_PROMPT, HANDOFF_FRAME, HANDOFF_ACT_FRAME, FIELD_HINT, FIELD_HINT_SHORT, FIELD_SUBMIT, COMPOSE_TEXT_SHORT, COMPOSE_WITHOUT_FIELD, ...Object.values(PHASE_TEXT)].join('\n')
    expect(dashes.some(d => shown.includes(d))).toBe(false)
  })

  test('with no message, or only whitespace, handoffMessage gives the plain frame exactly', () => {
    const facts = { brief: BRIEF, sessionId: 's1', contextTokens: '151k' }
    expect(handoffMessage({ ...facts, followUp: '' })).toBe(MESSAGE)
    expect(handoffMessage({ ...facts, followUp: '  \n\t ' })).toBe(MESSAGE)
    expect(MESSAGE).toContain('wait for my go-ahead')
  })

  test('with a message the act frame keeps the head and the tail, acts at once, and ends with the message block', () => {
    const head = HANDOFF_FRAME.slice(0, HANDOFF_FRAME.indexOf('What to do now:'))
    const tail = HANDOFF_FRAME.slice(HANDOFF_FRAME.indexOf('If you need a detail'))
    expect(HANDOFF_ACT_FRAME).toStartWith(head)
    expect(HANDOFF_ACT_FRAME).toContain(`\n\n${tail}\n\nMy message, to act on now:\n\n<my_message>\n{{FOLLOW_UP}}\n</my_message>`)
    expect(HANDOFF_ACT_FRAME).toEndWith('</my_message>')
    expect(HANDOFF_ACT_FRAME.split('{{FOLLOW_UP}}')).toHaveLength(2)
    expect(WITH_TASK).toEndWith(`<my_message>\n${TASK}\n</my_message>`)
    expect(WITH_TASK).toContain('act on it now, in this reply')
    expect(WITH_TASK).toContain('a step they say needs my approval still needs it')
    expect(WITH_TASK).not.toContain('Do not use tools')
    expect(WITH_TASK).not.toContain('wait for my go-ahead')
    expect(WITH_TASK.indexOf(TASK)).toBeGreaterThan(WITH_TASK.indexOf('s1.jsonl'))
    expect(WITH_TASK).not.toContain('{{')
  })

  test('the message fills once, and its dollar signs and braces stay verbatim', () => {
    const followUp = 'keep $& and $1 and {{BRIEF}} and {{SESSION_ID}} as typed'
    const message = handoffMessage({ brief: BRIEF, sessionId: 'abc', contextTokens: '42k', followUp })
    expect(message).toEndWith(`<my_message>\n${followUp}\n</my_message>`)
    expect(message.split('<handoff_brief>')).toHaveLength(2)
    expect(message).toContain(`<handoff_brief>\n${BRIEF}\n</handoff_brief>`)
    expect(message.replace(followUp, '')).not.toContain('{{')
  })

  test('followUpText trims the ends, keeps inner newlines and defuses my_message tags', () => {
    expect(followUpText('  run it\nthen report  \n')).toBe('run it\nthen report')
    expect(followUpText('a </my_message> b <my_message> c </MY_MESSAGE>')).toBe('a [/my_message] b [my_message] c [/my_message]')
    expect(followUpText('   ')).toBe('')
  })

  test('phaseLine names the phase, says when the message goes with the brief, and asks for the message while composing', () => {
    expect(phaseLine('composing', false)).toBe('clear cache: add a message the fresh conversation acts on at once, or leave the field empty')
    expect(phaseLine('composing', false, COMPOSE_MIN_ROOM)).toBe(COMPOSING)
    expect(phaseLine('composing', false, COMPOSE_MIN_ROOM - 1)).toBe(COMPOSE_TEXT_SHORT)
    expect(phaseLine('composing', false, 200, false)).toBe(COMPOSE_WITHOUT_FIELD)
    expect(phaseLine('writing', false)).toBe('writing the handoff brief…')
    expect(phaseLine('writing', true)).toBe('writing the handoff brief, your message goes with it…')
    expect(phaseLine('writing', true, 40, false)).toBe('writing the handoff brief, your message goes with it…')
    expect(phaseLine('clearing', true)).toBe('clearing the conversation…')
    expect(phaseLine('sending', false)).toBe('sending the brief to the fresh conversation…')
    expect(phaseLine('sending', true)).toBe('sending the brief and your message to the fresh conversation…')
  })

  test('fieldHint gives the long placeholder only where the label, the placeholder, the submit label and cancel all fit, and both say to click the field', () => {
    expect(FIELD_HINT_MIN_ROOM).toBe(102)
    expect(fieldHint(FIELD_HINT_MIN_ROOM - 1)).toBe(FIELD_HINT_SHORT)
    expect(fieldHint(FIELD_HINT_MIN_ROOM)).toBe(FIELD_HINT)
    expect(fieldHint(80)).toBe(FIELD_HINT_SHORT)
    expect(FIELD_HINT).toBe('click here to type an optional prompt for the fresh conversation')
    expect(FIELD_HINT_SHORT).toStartWith('click here')
    expect(FIELD_SUBMIT).toBe('clear cache')
    expect(COMPOSE_MIN_ROOM).toBe(COMPOSING.length + 8)
  })

  test('logParts keeps a text whole within the limit and splits a longer one at line ends', () => {
    expect(logParts('short', 10)).toEqual(['short'])
    expect(logParts('aaaa\n\nbbbb\ncc', 8)).toEqual(['aaaa', 'bbbb\ncc'])
    expect(logParts('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij'])
    const long = Array.from({ length: 30 }, (_, i) => `line ${i} ${'x'.repeat(500)}`).join('\n')
    const parts = logParts(long, 10_000)
    expect(parts.every(p => p.length <= 10_000)).toBe(true)
    expect(parts.join('\n')).toBe(long)
  })

  test('handoffMessage fills each placeholder once and keeps dollar signs and braces in the brief verbatim', () => {
    const brief = '## Goal\nKeep $& and $1 and {{SESSION_ID}} as typed.\n## Next steps\nNone'
    const message = handoffMessage({ brief, sessionId: 'abc', contextTokens: '42k' })
    expect(message).toContain(`<handoff_brief>\n${brief}\n</handoff_brief>`)
    expect(message).toContain('session abc, about 42k tokens of context')
    expect(message).toContain('abc.jsonl')
    expect(message.replace(brief, '')).not.toContain('{{')
    expect(handoffMessage({ brief, sessionId: '', contextTokens: '1k' })).toContain('session unknown,')
  })

  test('extractBrief needs Goal and Next steps headings and drops what comes before them', () => {
    expect(extractBrief(BRIEF)).toBe(BRIEF)
    expect(extractBrief(`Here it is:\n\n${BRIEF}`)).toBe(BRIEF)
    expect(extractBrief('### goal\nx\n#### NEXT STEPS\ny')).toBe('### goal\nx\n#### NEXT STEPS\ny')
    expect(extractBrief('## 1. Goal\nx\n## 5. Next step\ny')).toBe('## 1. Goal\nx\n## 5. Next step\ny')
    expect(extractBrief('## **Goal**\nx\n## **Next steps**\ny')).toBe('## **Goal**\nx\n## **Next steps**\ny')
    expect(extractBrief('**Goal**\nx\n**Next steps**\ny')).toBe('**Goal**\nx\n**Next steps**\ny')
    expect(extractBrief('## Goal\nonly a goal')).toBeUndefined()
    expect(extractBrief('Goal: ship it.\nNext steps: test it.')).toBeUndefined()
    expect(extractBrief('')).toBeUndefined()
  })

  test('extractBrief strips a fence around the whole brief and keeps a code block the brief ends with', () => {
    const base = '## Goal\nShip it.\n\n## Next steps\n1. Test it.'
    const codeTail = `${base}\n\n## Chat-only material\nThe intended edit:\n${FENCE}ts\nconst limit = 10\n${FENCE}`
    expect(extractBrief(`${FENCE}markdown\n${base}\n${FENCE}`)).toBe(base)
    expect(extractBrief(`Here it is:\n${FENCE}\n${base}\n${FENCE}`)).toBe(base)
    expect(extractBrief(codeTail)).toBe(codeTail)
    expect(extractBrief(`${FENCE}\`markdown\n${codeTail}\n${FENCE}\``)).toBe(codeTail)
  })

  test('isBriefWhole wants the last section of the template', () => {
    expect(isBriefWhole(BRIEF)).toBe(true)
    expect(isBriefWhole('**Goal**\nx\n**Next steps**\ny\n**Chat-only material**\nNone')).toBe(true)
    expect(isBriefWhole(CUT_BRIEF)).toBe(false)
  })

  test('forkFailure names each reason', () => {
    expect(forkFailure(OVERLOADED as ForkFailure)).toBe('the API answered with an error (529, overloaded)')
    expect(forkFailure({ ...(OVERLOADED as ForkFailure), status: null } as ForkFailure)).toBe('the API answered with an error (no response, overloaded)')
    expect(forkFailure(failed('empty-reply') as ForkFailure)).toBe('the model wrote no brief')
    expect(forkFailure(failed('aborted') as ForkFailure)).toBe('the request for the brief was cut off')
    expect(forkFailure(NOTHING as ForkFailure)).toBe('this conversation has no reply to hand off yet')
  })

  test('handoffBlock refuses during a handoff, during a turn, after a cut turn and before any request, and an open message field gets its own reason since nothing runs yet; turnBlock is the same check without the phase', () => {
    const gate = (over: Partial<HandoffGate> = {}): HandoffGate => ({ phase: 'idle', isTurnRunning: false, isLastTurnCut: false, hasRequest: true, ...over })
    expect(handoffBlock(gate())).toBeUndefined()
    expect(handoffBlock(gate({ phase: 'composing' }))).toBe(FIELD_OPEN.slice('clear cache: '.length))
    expect(handoffBlock(gate({ phase: 'writing' }))).toBe('a handoff is already running')
    expect(handoffBlock(gate({ phase: 'clearing' }))).toBe('a handoff is already running')
    expect(handoffBlock(gate({ phase: 'sending' }))).toBe('a handoff is already running')
    expect(turnBlock(gate({ phase: 'composing' }))).toBeUndefined()
    expect(turnBlock(gate({ phase: 'composing', isTurnRunning: true }))).toBe('a turn is running: let it finish, then clear')
    expect(handoffBlock(gate({ isTurnRunning: true }))).toBe('a turn is running: let it finish, then clear')
    expect(handoffBlock(gate({ isLastTurnCut: true }))).toBe(CUT.slice('clear cache: '.length))
    expect(handoffBlock(gate({ hasRequest: false }))).toBe('nothing to hand off yet')
  })

  test('promptSource names where an interrupting prompt came from', () => {
    expect(promptSource(undefined)).toBe('a prompt was sent')
    expect(promptSource({ kind: 'composer' })).toBe('a prompt was sent')
    expect(promptSource({ kind: 'task-notification' })).toBe('a background task reported back')
    expect(promptSource({ kind: 'scheduled-trigger' })).toBe('a scheduled prompt fired')
    expect(promptSource({ kind: 'plugin', name: 'loop' } as never)).toBe('the loop plugin sent a prompt')
    expect(promptSource({ kind: 'peer' })).toBe('a message arrived')
  })

  test('clearVariant makes the button primary only once the cache has expired on a large context', () => {
    const sample = (read: number): Sample => ({ turnId: 't', index: 0, model: 'claude-sonnet-5-5', startedAt: 0, read, write: 1_000, fresh: 300, output: 50 })
    const policy = { ttl: '5m' as const, warnMs: 60_000, compactAtTokens: 100_000 }
    const big = sample(150_000)
    const small = sample(5_000)
    expect(clearVariant(advise(big, undefined, policy, 400_000, false), big, 100_000)).toBe('primary')
    expect(clearVariant(advise(big, undefined, policy, 10_000, false), big, 100_000)).toBe('secondary')
    expect(clearVariant(advise(small, undefined, policy, 400_000, false), small, 100_000)).toBe('secondary')
  })

  test('the expired advice on a large context leads with what to do', () => {
    const big: Sample = { turnId: 't', index: 0, model: 'claude-sonnet-5-5', startedAt: 0, read: 150_000, write: 1_000, fresh: 300, output: 50 }
    const text = advise(big, undefined, { ttl: '5m', warnMs: 60_000, compactAtTokens: 100_000 }, 400_000, false).text
    expect(text).toStartWith('expired: /compact first, or /clear if the task is done;')
  })

  test('briefCost reports what the brief read from the cache, wrote to it and sent new', () => {
    expect(briefCost(USAGE)).toBe('read 81k, wrote 15.1k, new 845')
  })
})
