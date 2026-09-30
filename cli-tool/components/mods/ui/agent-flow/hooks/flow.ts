// The agent flow as plain data: the main loop, the subagents it spawned, and
// what context crossed between them. No engine calls here, so the tests drive
// it directly and the pane only reads it.

export const MAIN = 'main'

export type Status = 'running' | 'done' | 'failed' | 'aborted'

export type Usage = {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
}

export type ToolUse = { tool: string; label: string; isError?: boolean }

export type FlowNode = {
  /** the loop's agent id; `main` for the main loop */
  id: string
  /** the loop that spawned it; undefined on main */
  parentId?: string
  /** agent type (`Explore`, `general-purpose`, `fork`, ...) */
  type: string
  /** the Agent call's short description */
  description: string
  model?: string
  status: Status
  /** inherits the parent's whole context instead of starting from a prompt */
  fork: boolean
  background: boolean
  /** context handed down: the prompt it was given */
  prompt: string
  /** context handed back up: its final answer */
  answer?: string
  /** input tokens of its latest request: how full its window is now */
  contextTokens?: number
  peakContext?: number
  outputTokens: number
  steps: number
  toolCount: number
  /** the most recent tool calls, newest last */
  tools: ToolUse[]
  startedAt: number
  durationMs?: number
  /** the main-loop turn it was spawned in (1-based) */
  turn: number
  /** a loop the flow saw work but no spawn for (a workflow's agent, an engine fork) */
  unlisted?: boolean
}

export type Flow = {
  nodes: Map<string, FlowNode>
  /** spawn order, main first */
  order: string[]
  turn: number
  /** the main loop's window, from session.measure */
  window?: number
  percent?: number
}

export const KEEP_TOOLS = 8

export function createFlow(now = 0): Flow {
  const main: FlowNode = {
    id: MAIN,
    type: 'main',
    description: 'main loop',
    status: 'done',
    fork: false,
    background: false,
    prompt: '',
    outputTokens: 0,
    steps: 0,
    toolCount: 0,
    tools: [],
    startedAt: now,
    turn: 0,
  }
  return { nodes: new Map([[MAIN, main]]), order: [MAIN], turn: 0 }
}

export const loopId = (agentId: string | undefined) => agentId ?? MAIN

/** Rough tokens of a text: 4 characters each, as the engine's own estimates count. */
export function estimateTokens(text: string | undefined): number {
  return text ? Math.ceil(text.length / 4) : 0
}

/** What a request was answered over: uncached, cache-written and cache-read input together. */
export function contextOf(usage: Usage): number {
  return usage.input_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens
}

export function mainTurn(flow: Flow, text: string, now: number): void {
  const main = flow.nodes.get(MAIN)!
  flow.turn += 1
  main.turn = flow.turn
  main.status = 'running'
  main.startedAt = now
  main.durationMs = undefined
  // a continuation carries no typed prompt: keep the one before
  if (text) main.prompt = text
}

export type SpawnFacts = {
  agentId: string
  parentAgentId?: string
  description: string
  subagentType: string
  prompt: string
  fork: boolean
  background: boolean
  model?: string
}

export function spawned(flow: Flow, s: SpawnFacts, now: number): FlowNode {
  const parentId = s.parentAgentId && flow.nodes.has(s.parentAgentId) ? s.parentAgentId : MAIN
  const known = flow.nodes.get(s.agentId)
  const node: FlowNode = {
    ...(known ?? {
      outputTokens: 0,
      steps: 0,
      toolCount: 0,
      tools: [],
      startedAt: now,
    }),
    id: s.agentId,
    parentId,
    type: s.subagentType,
    description: s.description,
    model: s.model ?? known?.model,
    status: known?.status ?? 'running',
    fork: s.fork,
    background: s.background,
    prompt: s.prompt,
    turn: flow.turn,
    unlisted: false,
  }
  flow.nodes.set(s.agentId, node)
  if (!known) flow.order.push(s.agentId)
  return node
}

/** The node an event's loop maps to, made on the spot for a loop no spawn announced. */
export function nodeFor(flow: Flow, agentId: string | undefined, now: number): FlowNode {
  const id = loopId(agentId)
  const known = flow.nodes.get(id)
  if (known) return known
  const node: FlowNode = {
    id,
    parentId: MAIN,
    type: 'loop',
    description: `loop ${id.slice(0, 8)}`,
    status: 'running',
    fork: false,
    background: false,
    prompt: '',
    outputTokens: 0,
    steps: 0,
    toolCount: 0,
    tools: [],
    startedAt: now,
    turn: flow.turn,
    unlisted: true,
  }
  flow.nodes.set(id, node)
  flow.order.push(id)
  return node
}

export function stepped(flow: Flow, agentId: string | undefined, usage: Usage | null, now: number): void {
  const node = nodeFor(flow, agentId, now)
  node.steps += 1
  if (node.id !== MAIN && node.status !== 'running') node.status = 'running'
  if (!usage) return
  const ctx = contextOf(usage)
  node.contextTokens = ctx
  node.peakContext = Math.max(node.peakContext ?? 0, ctx)
  node.outputTokens += usage.output_tokens
}

export function toolRan(flow: Flow, agentId: string | undefined, use: ToolUse, now: number): void {
  const node = nodeFor(flow, agentId, now)
  node.toolCount += 1
  node.tools.push(use)
  if (node.tools.length > KEEP_TOOLS) node.tools.splice(0, node.tools.length - KEEP_TOOLS)
}

export type CompleteFacts = {
  answer: string
  reason: 'answer' | 'aborted' | 'refusal' | 'error'
  durationMs: number
  model?: string
}

export function completed(flow: Flow, agentId: string | undefined, c: CompleteFacts, now: number): void {
  const node = nodeFor(flow, agentId, now)
  node.status = c.reason === 'answer' ? 'done' : c.reason === 'aborted' ? 'aborted' : 'failed'
  node.answer = c.answer
  node.durationMs = c.durationMs
  if (c.model) node.model = c.model
}

/** Folds `$.agent.list()` statuses in: a background agent killed outside our view, a name. */
export function synced(flow: Flow, list: readonly { id: string; status: string; type: string; description: string }[]): void {
  for (const info of list) {
    const node = flow.nodes.get(info.id)
    if (!node) continue
    if (node.unlisted) {
      node.unlisted = false
      node.type = info.type
      node.description = info.description
    }
    if (node.status === 'running') {
      if (info.status === 'completed') node.status = 'done'
      else if (info.status === 'failed') node.status = 'failed'
      else if (info.status === 'killed') node.status = 'aborted'
    }
  }
}

/** Drops the oldest finished subagents past `max`, and their subtrees with them. */
export function trimmed(flow: Flow, max: number): void {
  const subs = flow.order.filter(id => id !== MAIN)
  let over = subs.length - max
  for (const id of subs) {
    if (over <= 0) break
    if (!flow.nodes.has(id)) continue
    const branch = subtree(flow, id)
    if (branch.some(x => flow.nodes.get(x)?.status === 'running')) continue
    for (const gone of branch) {
      flow.nodes.delete(gone)
      flow.order = flow.order.filter(x => x !== gone)
      over -= 1
    }
  }
}

export function children(flow: Flow, id: string): FlowNode[] {
  return flow.order.map(x => flow.nodes.get(x)!).filter(n => n && n.parentId === id)
}

export function subtree(flow: Flow, id: string): string[] {
  return [id, ...children(flow, id).flatMap(c => subtree(flow, c.id))]
}

export type Row = { node: FlowNode; depth: number; prefix: string }

/** The tree in spawn order, depth first, with its box-drawing prefix. */
export function rows(flow: Flow): Row[] {
  const out: Row[] = []
  const walk = (id: string, depth: number, lead: string) => {
    const kids = children(flow, id)
    kids.forEach((kid, i) => {
      const last = i === kids.length - 1
      out.push({ node: kid, depth, prefix: `${lead}${last ? '└─' : '├─'}` })
      walk(kid.id, depth + 1, `${lead}${last ? '  ' : '│ '}`)
    })
  }
  walk(MAIN, 1, '')
  return out
}

export function counts(flow: Flow): { running: number; done: number; failed: number } {
  let running = 0
  let done = 0
  let failed = 0
  for (const n of flow.nodes.values()) {
    if (n.id === MAIN) continue
    if (n.status === 'running') running += 1
    else if (n.status === 'done') done += 1
    else failed += 1
  }
  return { running, done, failed }
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')

/** One line saying what a tool call touched: the command, the path, the pattern. */
export function toolLabel(tool: string, input: Record<string, unknown>): string {
  const pick =
    str(input.description) && tool === 'Agent'
      ? str(input.description)
      : str(input.command) ||
        str(input.file_path) ||
        str(input.path) ||
        str(input.pattern) ||
        str(input.url) ||
        str(input.query) ||
        str(input.prompt) ||
        str(input.description)
  return pick.replace(/\s+/g, ' ').trim()
}

export function fmtTokens(n: number | undefined): string {
  if (n === undefined) return '–'
  if (n < 1000) return String(n)
  if (n < 100_000) return `${(n / 1000).toFixed(1)}k`
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`
  return `${(n / 1_000_000).toFixed(1)}M`
}

export function fmtDuration(ms: number | undefined): string {
  if (ms === undefined) return ''
  if (ms < 1000) return `${ms}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  return `${Math.floor(s / 60)}m${String(Math.round(s % 60)).padStart(2, '0')}s`
}

/** `████░░░░` for a percentage, `width` cells. */
export function bar(percent: number | undefined, width: number): string {
  const w = Math.max(1, Math.floor(width))
  const p = Math.min(100, Math.max(0, percent ?? 0))
  const full = Math.round((p / 100) * w)
  return '█'.repeat(full) + '░'.repeat(w - full)
}

/** Cuts `text` to `width` cells with an ellipsis; never below 1. */
export function fit(text: string, width: number): string {
  const w = Math.max(1, Math.floor(width))
  const chars = Array.from(text)
  if (chars.length <= w) return text
  return chars.slice(0, Math.max(0, w - 1)).join('') + '…'
}

/** The first `lines` non-empty lines of `text`, each fitted to `width`; `…` when cut. */
export function excerpt(text: string, lines: number, width: number): string[] {
  const all = text.split('\n').map(l => l.trimEnd()).filter(l => l.trim() !== '')
  const shown = all.slice(0, lines).map(l => fit(l, width))
  if (all.length > lines) shown.push(fit(`… ${all.length - lines} more lines`, width))
  return shown
}

export const STATUS_MARK: Record<Status, string> = { running: '◐', done: '●', failed: '✗', aborted: '○' }

export function paneColumns(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 52
  return Math.min(120, Math.max(32, n))
}

export function maxAgents(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 60
  return Math.min(500, Math.max(1, n))
}
