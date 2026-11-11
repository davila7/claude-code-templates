/**
 * turn-inspector: the session's model requests ("turns") as plain data.
 *
 * A turn is one request to the model, as in Anthropic's context-window
 * diagram: its input is everything sent (system prompt and tools, every
 * earlier turn, and what is new since the last one: the user's message or
 * the tool results), its output the blocks the model answered with (thinking,
 * text, tool use). Every token total here is the API's own `usage`; only the
 * split of a total across its blocks is estimated (about 4 characters a
 * token), and every such figure is flagged `isEstimate`.
 */

export type BlockKind =
  | 'system'
  | 'history'
  | 'user'
  | 'tool_result'
  | 'thinking'
  | 'text'
  | 'tool_use'
  | 'truncated'

export type Block = {
  kind: BlockKind
  label: string
  tokens: number
  isEstimate: boolean
  isError?: boolean
  /** Characters seen, the basis of an estimate. */
  chars: number
  /** The response's content block it streamed in, for output blocks. */
  index?: number
}

export type TurnStatus = 'streaming' | 'done' | 'failed'

export type Turn = {
  /** 1-based, across the session. */
  n: number
  turnId: string
  /** The request's position inside its prompt's turn, from 0. */
  step: number
  /** The user prompt the request answers ('' for a continuation). */
  prompt: string
  model?: string
  status: TurnStatus
  stopReason?: string | null
  /** Input tokens in all: uncached + cache read + cache write. */
  input?: number
  cacheRead?: number
  cacheWrite?: number
  output?: number
  /** What was new in this request's input (user message, tool results). */
  added: Block[]
  /** The response's blocks, by stream index. */
  answer: Block[]
  /** The input shrank against the turn before: a compaction ran between. */
  isCompacted: boolean
  /** The request carried no conversation before its new input. */
  isFirst: boolean
}

export type Usage = {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
  model?: string
}

export type Ledger = {
  turns: Turn[]
  /** Blocks that arrived since the last request; the next request carries them. */
  pending: Block[]
  /** The prompt of the turn in progress. */
  prompt: string
  turnId?: string
  /** Context window in tokens, when the engine has said. */
  window?: number
  /** System prompt + tools + memory etc., from the /context breakdown (an estimate). */
  system?: number
  /**
   * The same, measured: the input of a request that carried nothing but the
   * first user message, less that message. Preferred over `system`.
   */
  baseline?: number
  /** The session started with an empty conversation (not resumed). */
  isFresh: boolean
  nextN: number
}

export const CHARS_PER_TOKEN = 4

export function createLedger(): Ledger {
  return { turns: [], pending: [], prompt: '', nextN: 1, isFresh: false }
}

export function estimate(chars: number): number {
  return chars <= 0 ? 0 : Math.max(1, Math.round(chars / CHARS_PER_TOKEN))
}

export function inputTotal(u: Usage): number {
  return u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens
}

function block(kind: BlockKind, label: string, chars: number, isError?: boolean): Block {
  return { kind, label, chars, tokens: estimate(chars), isEstimate: true, ...(isError ? { isError } : {}) }
}

/** A prompt was submitted: its text is the next request's new input. */
export function promptStarted(l: Ledger, turnId: string, text: string): void {
  l.turnId = turnId
  l.prompt = text
  if (text) l.pending.push(block('user', 'User message', text.length))
}

/** A tool answered: its result goes back to the model with the next request. */
export function toolAnswered(l: Ledger, tool: string, chars: number, isError: boolean): void {
  l.pending.push(block('tool_result', `Tool result · ${tool}`, chars, isError))
}

/** A request is about to be sent. */
export function stepStarted(l: Ledger, turnId: string, step: number, model: string, keep: number): Turn {
  if (l.turnId !== turnId) {
    l.turnId = turnId
    if (step === 0) l.prompt = ''
  }
  const turn: Turn = {
    n: l.nextN,
    turnId,
    step,
    prompt: l.prompt,
    model,
    status: 'streaming',
    added: l.pending,
    answer: [],
    isCompacted: false,
    isFirst: l.isFresh && l.nextN === 1 && step === 0 && l.pending.length === 1 && l.pending[0]!.kind === 'user',
  }
  l.nextN += 1
  l.pending = []
  l.turns.push(turn)
  if (l.turns.length > keep) l.turns.splice(0, l.turns.length - keep)
  return turn
}

/** A piece of the response streamed in: grows the block at `index`. */
export function chunk(turn: Turn, index: number, kind: 'thinking' | 'text' | 'tool_use', piece: string, name?: string): boolean {
  let b = turn.answer.find(x => x.index === index)
  const isNew = !b
  if (!b) {
    const label = kind === 'thinking' ? 'Thinking' : kind === 'text' ? 'Text response' : `Tool use · ${name ?? 'tool'}`
    b = { ...block(kind, label, 0), index }
    turn.answer.push(b)
  }
  b.chars += piece.length
  b.tokens = estimate(b.chars)
  return isNew
}

/**
 * The response is whole: record the API's usage, then split the real totals
 * across the blocks.
 *
 * Output: text and tool use keep their character estimate; thinking takes
 * what is left, since the stream shows a summary of it at most. With no
 * thinking block the estimates are scaled to the real total.
 *
 * Input: what is new since the turn before is the real growth (this input
 * less the last input and output), split across the new blocks by size.
 */
export function stepEnded(l: Ledger, turn: Turn, usage: Usage | null, stopReason: string | null): void {
  turn.stopReason = stopReason
  if (!usage) {
    turn.status = 'failed'
    return
  }
  turn.status = 'done'
  if (usage.model) turn.model = usage.model
  turn.input = inputTotal(usage)
  turn.cacheRead = usage.cache_read_input_tokens
  turn.cacheWrite = usage.cache_creation_input_tokens
  turn.output = usage.output_tokens

  const thinking = turn.answer.filter(b => b.kind === 'thinking')
  const rest = turn.answer.filter(b => b.kind !== 'thinking')
  const restSum = rest.reduce((s, b) => s + b.tokens, 0)
  if (thinking.length && restSum <= usage.output_tokens) {
    split(thinking, usage.output_tokens - restSum)
  } else {
    split(turn.answer, usage.output_tokens)
  }
  if (stopReason === 'max_tokens' || stopReason === 'model_context_window_exceeded') {
    const why = stopReason === 'max_tokens' ? 'Cut off: max output tokens' : 'Cut off: context window full'
    turn.answer.push({ kind: 'truncated', label: why, tokens: 0, chars: 0, isEstimate: false })
  }

  if (turn.isFirst) l.baseline = Math.max(0, turn.input - turn.added[0]!.tokens)

  const prev = previous(l, turn)
  if (prev && prev.input !== undefined && prev.output !== undefined) {
    const grown = turn.input - prev.input - prev.output
    if (turn.input < prev.input) turn.isCompacted = true
    else if (grown >= 0 && turn.added.length) split(turn.added, grown)
  }
}

/**
 * What every request carries before the conversation: the /context
 * breakdown's used rows (system prompt, tools, MCP tools, memory files,
 * skills, agents) less its `Messages` row.
 */
export function systemTokens(categories: readonly { name: string; tokens: number; kind: string }[]): number | undefined {
  const used = categories.filter(c => c.kind === 'used' && c.name !== 'Messages')
  return used.length ? used.reduce((s, c) => s + c.tokens, 0) : undefined
}

/** Spreads `total` over `blocks` by their current weights; exact sum. */
function split(blocks: Block[], total: number): void {
  if (!blocks.length) return
  const weights = blocks.map(b => Math.max(1, b.chars))
  const sum = weights.reduce((s, w) => s + w, 0)
  let left = total
  blocks.forEach((b, i) => {
    const t = i === blocks.length - 1 ? left : Math.round((total * weights[i]!) / sum)
    b.tokens = Math.max(0, t)
    left -= b.tokens
  })
}

export function previous(l: Ledger, turn: Turn): Turn | undefined {
  const i = l.turns.indexOf(turn)
  return i > 0 ? l.turns[i - 1] : undefined
}

/**
 * The input stack of a turn as the diagram draws it: system & tools, then
 * every earlier turn folded into one block, then what is new.
 */
export function inputStack(l: Ledger, turn: Turn): Block[] {
  const added = turn.added
  const addedSum = added.reduce((s, b) => s + b.tokens, 0)
  if (turn.input === undefined) return added
  const known = l.baseline ?? l.system
  const system = Math.min(known ?? 0, Math.max(0, turn.input - addedSum))
  const history = Math.max(0, turn.input - system - addedSum)
  const earlier = turn.n - (l.turns[0]?.n ?? turn.n)
  const out: Block[] = []
  if (system) {
    out.push({ kind: 'system', label: 'System, tools & memory', tokens: system, chars: 0, isEstimate: l.baseline === undefined })
  }
  if (history) {
    const label = turn.isCompacted
      ? 'Compacted summary & history'
      : known === undefined
        ? 'System, tools & history'
        : earlier > 0
          ? `Earlier turns (${earlier})`
          : 'Earlier context'
    out.push({ kind: 'history', label, tokens: history, chars: 0, isEstimate: l.baseline === undefined && known !== undefined })
  }
  return [...out, ...added]
}

/** Context in use after a turn: what it sent plus what it answered. */
export function contextAfter(turn: Turn): number | undefined {
  if (turn.input === undefined) return undefined
  return turn.input + (turn.output ?? 0)
}

/** A short summary of what the turn answered with, for its row. */
export function gist(turn: Turn): string {
  if (turn.status === 'streaming') return 'streaming…'
  if (turn.status === 'failed') return 'no response'
  const tools = turn.answer.filter(b => b.kind === 'tool_use')
  if (tools.length) {
    const names = [...new Set(tools.map(b => b.label.replace('Tool use · ', '')))]
    return `${tools.length}× ${names.slice(0, 2).join(', ')}${names.length > 2 ? '…' : ''}`
  }
  if (turn.answer.some(b => b.kind === 'truncated')) return 'cut off'
  if (turn.answer.some(b => b.kind === 'text')) return 'answer'
  return turn.answer.some(b => b.kind === 'thinking') ? 'thinking only' : 'empty'
}

export function fmtTokens(n: number | undefined): string {
  if (n === undefined) return '–'
  if (n < 1000) return String(n)
  if (n < 100_000) return `${(n / 1000).toFixed(1)}k`
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`
  return `${(n / 1_000_000).toFixed(1)}M`
}

/** Cuts `text` to `width` cells with an ellipsis. */
export function fit(text: string, width: number): string {
  const w = Math.max(1, Math.floor(width))
  const chars = Array.from(text)
  if (chars.length <= w) return text
  return chars.slice(0, Math.max(0, w - 1)).join('') + '…'
}

/** `text` cut or padded to exactly `width` cells. */
export function cell(text: string, width: number, align: 'left' | 'right' = 'left'): string {
  const t = fit(text, width)
  const pad = ' '.repeat(Math.max(0, width - Array.from(t).length))
  return align === 'left' ? t + pad : pad + t
}

/**
 * The cells of a context bar: `segments` tokens each, against `window`,
 * `width` cells wide. Every segment that has tokens gets at least one cell
 * while room lasts; the rest of the bar is free space.
 */
export function barCells(segments: number[], window: number, width: number): number[] {
  const w = Math.max(1, Math.floor(width))
  const cells = segments.map(t => (t > 0 && window > 0 ? Math.max(1, Math.round((t / window) * w)) : 0))
  let over = cells.reduce((s, c) => s + c, 0) - w
  for (let i = cells.length - 1; over > 0 && i >= 0; i--) {
    const cut = Math.min(over, Math.max(0, cells[i]! - 1))
    cells[i]! -= cut
    over -= cut
  }
  return cells
}

export function paneColumns(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 56
  return Math.min(120, Math.max(36, n))
}

export function maxTurns(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 200
  return Math.min(2000, Math.max(10, n))
}
