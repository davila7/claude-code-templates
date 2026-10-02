/**
 * Pure helpers for session-time-machine: no `$`, no I/O, so the tests run them
 * on plain strings. A Claude Code transcript is a JSONL file of rows chained by
 * `parentUuid`; the live conversation is the chain that ends at the last row
 * written. A fork keeps a prefix of that chain, which is why a "point in time"
 * here is just a count of chain rows to keep.
 */

export type Row = Record<string, any>

export type PointKind = 'prompt' | 'tool' | 'turn'

export type Point = {
  /** 1-based, as `/timemachine fork <n>` names it */
  n: number
  kind: PointKind
  /** 1-based number of the user prompt this point belongs to (0 before the first) */
  turn: number
  label: string
  /** the tool's name on a tool point, what colors its glyph */
  tool?: string
  /** the label without its kind: the prompt's text, the call's argument, the turn's last reply */
  detail: string
  /** how many rows of the chain a fork from here keeps (before closing tool pairs) */
  keep: number
}

const CHAIN_TYPES = new Set(['user', 'assistant', 'system', 'attachment'])

export function parseRows(text: string): Row[] {
  const rows: Row[] = []
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    try {
      const row = JSON.parse(line)
      if (row && typeof row === 'object') rows.push(row)
    } catch {
      // a half-written last line while a turn streams
    }
  }
  return rows
}

/** The live conversation: the parentUuid chain back from the last row written, oldest first. */
export function mainChain(rows: readonly Row[]): Row[] {
  const byUuid = new Map<string, Row>()
  let leaf: Row | undefined
  for (const row of rows) {
    if (typeof row.uuid !== 'string' || !CHAIN_TYPES.has(row.type) || row.isSidechain === true) continue
    byUuid.set(row.uuid, row)
    leaf = row
  }
  const chain: Row[] = []
  const seen = new Set<string>()
  for (let row = leaf; row && !seen.has(row.uuid); row = byUuid.get(row.parentUuid)) {
    seen.add(row.uuid)
    chain.push(row)
  }
  return chain.reverse()
}

const blocks = (row: Row): any[] => (Array.isArray(row.message?.content) ? row.message.content : [])

/** The text a person typed, or undefined for a tool result, a meta row or an injected reminder. */
export function promptText(row: Row): string | undefined {
  if (row.type !== 'user' || row.isMeta === true) return undefined
  const content = row.message?.content
  let text: string
  if (typeof content === 'string') text = content
  else if (Array.isArray(content)) {
    if (content.some((b: any) => b?.type === 'tool_result')) return undefined
    text = content.filter((b: any) => b?.type === 'text').map((b: any) => String(b.text ?? '')).join('\n')
  } else return undefined
  text = text.trim()
  if (!text || /^<(system-reminder|local-command|command-name|command-message|task-notification)/.test(text)) return undefined
  return text
}

export const clip = (text: string, max: number): string => {
  const one = text.replace(/[`\s]+/g, ' ').trim()
  return one.length > max ? `${one.slice(0, Math.max(1, max - 1))}…` : one
}

function toolLabel(block: any): string {
  const input = block.input ?? {}
  const arg = input.command ?? input.file_path ?? input.pattern ?? input.path ?? input.url ?? input.description ?? input.prompt
  return typeof arg === 'string' ? `${block.name} ${clip(arg, 60)}` : String(block.name)
}

/** Prompts, tool calls and turn ends of the chain, in order, each with the prefix a fork keeps. */
export function buildTimeline(chain: readonly Row[]): Point[] {
  const points: Point[] = []
  const add = (kind: PointKind, turn: number, label: string, keep: number, detail = label, tool?: string) =>
    points.push({ n: points.length + 1, kind, turn, label, keep, detail, tool })

  const resultAt = new Map<string, number>()
  chain.forEach((row, i) => {
    if (row.type !== 'user') return
    for (const b of blocks(row)) if (b?.type === 'tool_result' && typeof b.tool_use_id === 'string') resultAt.set(b.tool_use_id, i)
  })

  let turn = 0
  let lastText = ''
  const endTurn = (end: number) => {
    if (turn > 0) add('turn', turn, lastText ? `turn ${turn} ended: ${clip(lastText, 60)}` : `turn ${turn} ended`, end, clip(lastText, 90) || `turn ${turn} ended`)
  }
  chain.forEach((row, i) => {
    const text = promptText(row)
    if (text !== undefined) {
      endTurn(i)
      turn += 1
      lastText = ''
      add('prompt', turn, `before: ${clip(text, 70)}`, i, clip(text, 90))
      return
    }
    if (row.type !== 'assistant') return
    for (const b of blocks(row)) {
      if (b?.type === 'text' && String(b.text ?? '').trim()) lastText = String(b.text)
      else if (b?.type === 'tool_use') {
        const at = resultAt.get(b.id)
        if (at !== undefined) add('tool', turn, toolLabel(b), at + 1, toolLabel(b).slice(String(b.name).length).trim(), String(b.name))
      }
    }
  })
  endTurn(chain.length)
  return points
}

/**
 * The prefix a fork keeps: grown until every tool_use in it that is answered
 * later in the chain has its tool_result, so the API accepts it. A call the
 * original never answered (an interrupted turn) stays as it was; Claude Code
 * closes those itself on resume.
 */
export function closePrefix(chain: readonly Row[], keep: number): number {
  const answeredAt = new Map<string, number>()
  chain.forEach((row, i) => {
    for (const b of blocks(row)) if (b?.type === 'tool_result') answeredAt.set(b.tool_use_id, i)
  })
  let n = Math.max(0, Math.min(keep, chain.length))
  // each row pulled in may itself hold a call answered further on
  for (let seen = 0; seen < n; seen++) {
    for (const b of blocks(chain[seen]!)) {
      if (b?.type !== 'tool_use') continue
      const at = answeredAt.get(b.id)
      if (at !== undefined) n = Math.max(n, at + 1)
    }
  }
  return n
}

/** The JSONL of a fork: the first `keep` chain rows, under `newId`, with their uuids and parents intact. */
export function forkTranscript(chain: readonly Row[], keep: number, newId: string): string {
  const n = closePrefix(chain, keep)
  return chain.slice(0, n).map(row => JSON.stringify({ ...row, sessionId: newId })).join('\n') + (n > 0 ? '\n' : '')
}

/** `/` and every other non-alphanumeric of the directory become `-`, as Claude Code names a project folder. */
export const projectSlug = (cwd: string): string => cwd.replace(/[^a-zA-Z0-9]/g, '-')

export const transcriptPath = (configDir: string, cwd: string, sessionId: string): string =>
  `${configDir.replace(/\/+$/, '')}/projects/${projectSlug(cwd)}/${sessionId}.jsonl`

export const shellQuote = (text: string): string => `'${text.replace(/'/g, `'\\''`)}'`

export function resumeCommand(cwd: string, newId: string, instruction: string): string {
  return `cd ${shellQuote(cwd)} && claude --resume ${newId} ${shellQuote(instruction)}`
}

/** A random v4 uuid; the module has no crypto, so Math.random does (an id, not a secret). */
export function newSessionId(random: () => number = Math.random): string {
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(random() * 16).toString(16)).join('')
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${'89ab'[Math.floor(random() * 4)]}${hex(3)}-${hex(12)}`
}

export type ForkArgs = { kind: 'open' } | { kind: 'list' } | { kind: 'fork'; n: number; instruction: string } | { kind: 'error'; text: string }

export function parseArgs(args: string): ForkArgs {
  const text = args.trim()
  if (!text) return { kind: 'open' }
  if (text === 'list') return { kind: 'list' }
  const m = /^fork\s+(\d+)\s+([\s\S]+)$/.exec(text)
  if (m) return { kind: 'fork', n: Number(m[1]), instruction: m[2]!.trim() }
  return { kind: 'error', text: 'usage: /timemachine · /timemachine list · /timemachine fork <n> <new instruction>' }
}
