/**
 * The game around the rules: the moves played, who played them, what each of
 * Claude's cost, the prompt Claude answers, and how its reply is read.
 * Pure: no `$`, so the tests drive it directly.
 */
import type { ModelForkUsage } from 'claude-code'
import {
  START_FEN,
  ending,
  findMove,
  legalMoves,
  makeMove,
  parseFen,
  positionKey,
  san,
  toFen,
  uci,
} from './chess.ts'
import type { Color, Ending, Move, Position } from './chess.ts'

export type Played = {
  san: string
  uci: string
  by: 'you' | 'claude'
  /** What Claude's move cost as the API reported it; null when the call reported none. */
  usage?: ModelForkUsage | null
  /** How the move was got when not plainly (a retry, a fallback, a random move). */
  note?: string
}

export type Game = {
  pos: Position
  you: Color
  played: Played[]
  /** positionKey of every position reached, the start included: threefold repetition. */
  keys: string[]
  /** The starting position's move number and side, for numbering the move list. */
  start: { full: number; turn: Color }
  over?: Ending
  /** Set by `resign`: the side that gave up. */
  resigned?: Color
}

export function newGame(you: Color, fen = START_FEN): Game {
  const pos = parseFen(fen)
  return { pos, you, played: [], keys: [positionKey(pos)], start: { full: pos.full, turn: pos.turn } }
}

export const claudeColor = (g: Game): Color => (g.you === 'w' ? 'b' : 'w')
export const isClaudeTurn = (g: Game) => !g.over && !g.resigned && g.pos.turn === claudeColor(g)
export const isYourTurn = (g: Game) => !g.over && !g.resigned && g.pos.turn === g.you

/** Plays `move` (legal in `g.pos`) and records it; returns the new game. */
export function play(g: Game, move: Move, entry: Omit<Played, 'san' | 'uci'>): Game {
  const text = san(g.pos, move)
  const pos = makeMove(g.pos, move)
  const keys = [...g.keys, positionKey(pos)]
  return { ...g, pos, keys, played: [...g.played, { ...entry, san: text, uci: uci(move) }], over: ending(pos, keys) }
}

/** "1. e4 e5 2. Nf3" from the moves played. */
export function moveList(g: Game): string {
  const out: string[] = []
  const offset = g.start.turn === 'b' ? 1 : 0
  g.played.forEach((m, i) => {
    const ply = i + offset
    if (ply % 2 === 0) out.push(`${g.start.full + ply / 2}.`)
    else if (i === 0) out.push(`${g.start.full}...`)
    out.push(m.san)
  })
  return out.join(' ')
}

export const colorName = (c: Color) => (c === 'w' ? 'White' : 'Black')

/**
 * What Claude is asked each move. It goes to `$.model.fork`, appended to the
 * session's own transcript, so it first sets the work aside.
 */
export function movePrompt(g: Game, retry?: string): string {
  const legal = legalMoves(g.pos)
  const lines = [
    'Side game, unrelated to the work above: you are playing chess against the user in a side panel.',
    'Answer only this message; do not continue, mention or act on the task above.',
    '',
    `You play ${colorName(claudeColor(g))}. Position (FEN): ${toFen(g.pos)}`,
    `Moves so far: ${moveList(g) || '(none, you move first)'}`,
    `Your legal moves: ${legal.map(m => san(g.pos, m, legal)).join(' ')}`,
  ]
  if (retry) lines.push('', `Your last reply, "${retry.slice(0, 40)}", is not one of those moves.`)
  lines.push('', 'Reply with exactly one move from that list, in SAN, and nothing else.')
  return lines.join('\n')
}

/** The first legal move Claude's reply names, reading word by word. */
export function readReply(pos: Position, reply: string): Move | undefined {
  const legal = legalMoves(pos)
  const whole = findMove(pos, reply.trim(), legal)
  if (whole) return whole
  for (const word of reply.split(/[\s,;:()"'`*]+/)) {
    const m = findMove(pos, word.replace(/^\d+\.+/, '').replace(/\.$/, ''), legal)
    if (m) return m
  }
  return undefined
}

export const zeroUsage = (): ModelForkUsage => ({
  input_tokens: 0,
  output_tokens: 0,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
})

export function addUsage(a: ModelForkUsage, b: ModelForkUsage): ModelForkUsage {
  return {
    input_tokens: a.input_tokens + b.input_tokens,
    output_tokens: a.output_tokens + b.output_tokens,
    cache_read_input_tokens: a.cache_read_input_tokens + b.cache_read_input_tokens,
    cache_creation_input_tokens: a.cache_creation_input_tokens + b.cache_creation_input_tokens,
  }
}

export const totalTokens = (u: ModelForkUsage) =>
  u.input_tokens + u.output_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens

/** Claude's moves' usage summed, and how many moves reported none. */
export function gameUsage(g: Game): { usage: ModelForkUsage; moves: number; unreported: number } {
  let usage = zeroUsage()
  let moves = 0
  let unreported = 0
  for (const m of g.played) {
    if (m.by !== 'claude') continue
    moves++
    if (m.usage) usage = addUsage(usage, m.usage)
    else unreported++
  }
  return { usage, moves, unreported }
}

/** 950, 12.3k, 1.20M */
export function fmt(n: number): string {
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`
  return `${(n / 1_000_000).toFixed(2)}M`
}

/** "in 12 · out 4 · cache r 45k w 210" */
export const usageLine = (u: ModelForkUsage) =>
  `in ${fmt(u.input_tokens)} · out ${fmt(u.output_tokens)} · cache r ${fmt(u.cache_read_input_tokens)} w ${fmt(u.cache_creation_input_tokens)}`

export function resultText(g: Game): string | undefined {
  if (g.resigned) return `${g.resigned === g.you ? 'You resigned' : 'Claude resigned'}: ${colorName(g.resigned === 'w' ? 'b' : 'w')} wins`
  if (!g.over) return undefined
  if (g.over === 'checkmate') {
    const winner = g.pos.turn === 'w' ? 'b' : 'w'
    return `Checkmate: ${winner === g.you ? 'you win' : 'Claude wins'}`
  }
  return `Draw by ${g.over}`
}
