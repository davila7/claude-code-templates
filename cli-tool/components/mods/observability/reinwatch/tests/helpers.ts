import type { AgentInfo, AgentSpawnInput, On, ToolCallResult, TurnCompleteReason, TurnStepChunk, TurnStepResult, TurnUsage } from 'claude-code'
import { mock, type Engine, type MockClock } from 'claude-code/testing'
import type { AgentRow, Alert } from '../types'

// The engine's side of a test: every hook here stands for something beneath the plugin.
const BENEATH = 'beneath'
const held = new Map<string, { value: unknown; version: number }>()
const stored = new Map<string, unknown>()

export type Seen = {
  opened: string[]
  statuses: (string | undefined)[]
  toasts: string[]
  notices: { text: string; title: string | undefined }[]
  views: unknown[]
  sent: { to: string; text: string }[]
  toolRuns: number
  modelCalls: number
}

// `answers.notifyMs` holds each notification that long on the mock clock, as a person's slow Notification hook would.
// `answers.now` is the mock clock's start (default 0). `holdWrites(ms)` holds each write of an atom that long from then
// on (call it after start), `holdList()` holds the answer of agent.list until `releaseList()`, `writes` counts the writes in flight and the most there ever were at once, and `lists.calls` counts the asks of agent.list.
export function standIns(on: On, listed: AgentInfo[] = [], answers: { view?: { deny?: string }; send?: { isDelivered: false; reason: string }; notifyMs?: number; now?: number; commandFails?: boolean } = {}): {
  seen: Seen; clock: MockClock; setUsage(u: TurnUsage | null): void
  holdWrites(ms: number): void; holdList(): void; releaseList(): void; writes: { inFlight: number; max: number; total: number }
  lists: { calls: number }
} {
  const seen: Seen = { opened: [], statuses: [], toasts: [], notices: [], views: [], sent: [], toolRuns: 0, modelCalls: 0 }
  const clock = mock.clock(on, { now: answers.now ?? 0 })
  held.clear()
  stored.clear()
  let usage: TurnUsage | null = null
  let holdMs = 0
  let listGate: Promise<void> | null = null
  let releaseGate = () => {}
  const writes = { inFlight: 0, max: 0, total: 0 }
  const lists = { calls: 0 }

  // The test's `$` has no `state` noun, so the values the plugin writes are read back from the writes that pass here.
  on('state.set', async (_, e, next) => {
    writes.inFlight += 1
    writes.total += 1
        writes.max = Math.max(writes.max, writes.inFlight)
    if (holdMs > 0) await clock.sleep(holdMs)
    let r: Awaited<ReturnType<typeof next>>
    try { r = await next(e) } finally { writes.inFlight -= 1 }
    const set = (r as { value?: { isSet?: boolean; version?: number } }).value
    // A value with a shape tag is written as { shape, value }; one without is written as itself.
    const written = (e as { value?: unknown }).value
    const plain = typeof written === 'object' && written !== null && !Array.isArray(written) && 'shape' in written && 'value' in written ? (written as { value: unknown }).value : written
    if (set?.isSet === true) held.set(e.key, { value: plain, version: set.version ?? 0 })
    return r
  })
  // mock.store would register store.set itself, so $.store is stood in for here, keeping what the plugin writes.
  on('store.get', (_, e) => ({ value: stored.get(e.key) }))
  on('store.set', (_, e) => { stored.set(e.key, e.value === undefined ? undefined : JSON.parse(JSON.stringify(e.value))); return { value: undefined } })
  on('store.delete', (_, e) => { stored.delete(e.key); return { value: undefined } })
  on('store.keys', () => ({ value: [...stored.keys()] }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('command.register', (_, e) => {
    if (answers.commandFails === true) throw new Error('no commands here')
    return { value: { command: e.name } }
  })
  on('ui.open', (_, e) => { seen.opened.push(e.id); return { value: { isPlaced: true } } })
  on('ui.status', (_, e) => { seen.statuses.push(e.text); return { value: undefined } })
  on('ui.toast', (_, e) => { seen.toasts.push(e.text); return { value: undefined } })
  on('ui.notify', async (_, e) => {
    seen.notices.push({ text: e.text, title: e.title })
    if (answers.notifyMs !== undefined) await clock.sleep(answers.notifyMs)
    return { value: { isSent: true, channel: 'test' as never } }
  })
  on('ui.view', (_, e) => { seen.views.push(e); return { value: answers.view ?? {} } })
  // Beneath the plugins nothing draws: a band that yields (next) reaches here and draws nothing. Its empty Box is keyed
  // so that columnBoxes can tell the engine's own column (which stacks a band over what is beneath) from the plugin's.
  on('ui.render', ($, e) => { const { Box } = $.ui.resolve(e); return Box({ key: BENEATH }) as never })
  on('agent.list', async () => { lists.calls += 1; if (listGate !== null) await listGate; return { value: listed } })
  on('session.send', (_, e) => { seen.sent.push({ to: e.to, text: e.text }); return answers.send ?? { isDelivered: true as const } })
  on('agent.spawn', (_, e) => ({ model: e.model ?? 'test-model', agentId: e.resume?.agentId ?? e.name }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('tool.call', async (_, e) => {
    seen.toolRuns += 1
    const command = 'command' in e && typeof e.command === 'string' ? e.command : ''
    const sleep = /^sleep (\d+)$/.exec(command)
    if (sleep) await clock.sleep(Number(sleep[1]))
    if (command === 'throw') throw new Error('the tool crashed')
    return command === 'fail' ? { isError: true, result: 'failed' } : { result: 'ok' }
  })
  on('turn.step', async function* (_, e) {
    seen.modelCalls += 1
    yield { kind: 'text', index: 0, text: 'ok' } as TurnStepChunk
    return { turnId: e.turnId, index: e.index, answer: 'ok', toolUses: [], stopReason: 'end_turn', usage } as TurnStepResult
  })
  return { seen, clock, setUsage: u => { usage = u }, holdWrites: ms => { holdMs = ms },
    holdList: () => { listGate = new Promise<void>(r => { releaseGate = r }) }, releaseList: () => { listGate = null; releaseGate() }, writes, lists }
}

export const start: ($: Engine, surface?: 'terminal' | 'desktop') => Promise<unknown> =
  ($, surface = 'terminal') => $.session.start({ cwd: '/', surface, isInteractive: true })

export const end: ($: Engine) => Promise<unknown> =
  $ => $.session.end({ reason: 'prompt_input_exit', sessionId: 'test-session', resume: { id: 'test-session' } })

export const spawn: ($: Engine, id: string, extra?: Partial<AgentSpawnInput>) => Promise<unknown> =
  ($, id, extra = {}) => $.agent.spawn({
    tool_use_id: `s-${id}`, prompt: 'work', description: 'Fix tests', subagentType: 'general-purpose',
    provider: { plugin: 'engine', tier: 'core' }, parentModel: 'test-model', name: id, ...extra,
  } as AgentSpawnInput)

export async function step($: Engine, agentId: string | undefined): Promise<{ kinds: string[]; result: TurnStepResult }> {
  const s = $.turn.step({ turnId: `t-${agentId ?? 'main'}`, index: 0, model: 'test-model', messageCount: 1, ...(agentId === undefined ? {} : { agentId }) })
  const kinds: string[] = []
  for (;;) {
    const n = await s.next()
    if (n.done) return { kinds, result: n.value }
    kinds.push(n.value.kind)
  }
}

export const tool: ($: Engine, agentId: string | undefined, command: string) => Promise<ToolCallResult> =
  ($, agentId, command) => $.tool.call({ tool: 'Bash', command, ...(agentId === undefined ? {} : { agentId }) })

export const turn: ($: Engine, agentId: string | undefined, phase: 'start' | 'end', reason?: TurnCompleteReason) => Promise<unknown> =
  ($, agentId, phase, reason = 'answer') => {
    const turnId = `t-${agentId ?? 'main'}`
    const who = agentId === undefined ? {} : { agentId }
    return phase === 'start'
      ? $.turn.start({ text: 'go', turnId, ...who })
      : $.turn.complete({ turnId, answer: 'done', reason, ...who } as Parameters<Engine['turn']['complete']>[0])
  }

// What the plugin last wrote to one of its values, and how many writes that value has had (0 before the first).
export const stateVersion = (key: string): number => held.get(key)?.version ?? 0
export const readAgents = async (_$: Engine): Promise<Record<string, AgentRow>> => (held.get('agents')?.value ?? {}) as Record<string, AgentRow>
export const readAlerts = async (_$: Engine): Promise<Alert[]> => (held.get('alerts')?.value ?? []) as Alert[]

// What the plugin last wrote with $.store.set(key, …) (undefined before any write), and any of its atoms by key.
export const readStore = async (_$: Engine, key: string): Promise<unknown> => stored.get(key)
export const readState = async (_$: Engine, key: string): Promise<unknown> => held.get(key)?.value

// Puts a value in the stand-in $.store; call it after standIns() and before the first `$` call.
export const seedStore = (key: string, value: unknown): void => { stored.set(key, value === undefined ? undefined : JSON.parse(JSON.stringify(value))) }

export type Mounted = Awaited<ReturnType<Engine['ui']['mount']>>

// Draws the reinwatch pane as a surface does, on one of the surfaces; rows is the surface height in cells.
export const mountPane = ($: Engine, surface: 'terminal' | 'desktop', rows?: number): Promise<Mounted> =>
  $.ui.mount({
    plugin: 'reinwatch',
    surface,
    component: 'Pane',
    requestId: 'reinwatch',
    props: {
      title: 'reinwatch', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {},
    },
    ...(rows === undefined ? {} : { viewport: { columns: 120, rows } }),
  } as Parameters<Engine['ui']['mount']>[0])

// Draws the band above the prompt as a surface does; props not given are those of an idle terminal.
export const mountBand = ($: Engine, surface: 'terminal' | 'desktop', props: { hasSurvey?: boolean } = {}): Promise<Mounted> =>
  $.ui.mount({
    plugin: 'reinwatch',
    surface,
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 100, scroll: { offset: 0, bodyRows: 19 }, view: {}, ...props },
  } as Parameters<Engine['ui']['mount']>[0])

type Drawn = { type: string; props?: Record<string, unknown>; children?: unknown[] }
const isDrawn = (x: unknown): x is Drawn => typeof x === 'object' && x !== null && 'type' in x

// Every Box in a drawing that has a Button among its children: the rows that lay out buttons.
export const buttonBoxes = async (ui: Mounted): Promise<Drawn[]> => {
  const out: Drawn[] = []
  const walk = (node: unknown): void => {
    if (!isDrawn(node)) return
    const kids = node.children ?? []
    if (node.type === 'Box' && kids.some(k => isDrawn(k) && k.type === 'Button')) out.push(node)
    kids.forEach(walk)
  }
  walk(await ui.drawn())
  return out
}

// Every string drawn in a drawing: the string children of its elements, in order.
export const drawnTexts = async (ui: Mounted): Promise<string[]> => {
  const out: string[] = []
  const walk = (node: unknown): void => {
    if (typeof node === 'string') out.push(node)
    else if (isDrawn(node)) (node.children ?? []).forEach(walk)
  }
  walk(await ui.drawn())
  return out
}

// Every Box in the plugin's drawing that stacks its children in a column: the rows that must be spaced by step. The
// engine's own column, which stacks a band over what is drawn beneath it (Claude Code 2.1.331), is not the plugin's.
export const columnBoxes = async (ui: Mounted): Promise<Drawn[]> => {
  const out: Drawn[] = []
  const walk = (node: unknown): void => {
    if (!isDrawn(node)) return
    const kids = node.children ?? []
    const isEngineStack = kids.some(k => isDrawn(k) && k.props?.key === BENEATH)
    if (node.type === 'Box' && node.props?.flexDirection === 'column' && !isEngineStack) out.push(node)
    kids.forEach(walk)
  }
  walk(await ui.drawn())
  return out
}
