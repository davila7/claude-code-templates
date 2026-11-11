/**
 * Jev as the opponent: TypeSafe's System One decision model picks the move.
 * Pure: no `$` and no I/O; the hooks module does the fetch at its call site.
 *
 * Jev answers typed questions, not free text, so a move is a `choice` whose
 * options are exactly the legal moves: it cannot name an illegal one. The two
 * backends and their wire shapes are the ones jev-model-router speaks:
 *
 *   typesafe  POST {base}/v1/systemone      `{ model, state, questions }`
 *   gateway   POST {base}/evaluation-model  `{ state, questions }`, model in a header
 */
import type { ModelUsage } from 'claude-code'
import { findMove, legalMoves, san, squareName, toFen } from './chess.ts'
import type { Move, Position } from './chess.ts'
import { claudeColor, colorName, moveList } from './game.ts'
import type { Game } from './game.ts'

export type Provider = 'typesafe' | 'gateway'

export const DEFAULT_BASE_URL: Record<Provider, string> = {
  typesafe: 'https://api.typesafe.ai',
  gateway: 'https://ai-gateway.vercel.sh/v4/ai',
}

export const DEFAULT_MODEL: Record<Provider, string> = {
  typesafe: 'jev-latest',
  gateway: 'typesafe-ai/jev',
}

// the Gateway rejects a request that names no protocol version (see jev-model-router)
const AI_GATEWAY_PROTOCOL_VERSION = '0.0.1'

/** Which backend the keys select; null plays Claude. `auto` prefers TypeSafe. */
export function selectProvider(forced: string, typesafeKey: string, gatewayKey: string): Provider | null {
  if (forced === 'claude') return null
  if (forced === 'typesafe') return typesafeKey ? 'typesafe' : null
  if (forced === 'gateway') return gatewayKey ? 'gateway' : null
  if (typesafeKey) return 'typesafe'
  if (gatewayKey) return 'gateway'
  return null
}

export function endpoint(provider: Provider, baseUrl: string): string {
  const root = baseUrl.replace(/\/+$/, '')
  return provider === 'typesafe' ? `${root}/v1/systemone` : `${root}/evaluation-model`
}

export function requestHeaders(provider: Provider, apiKey: string, model: string): Record<string, string> {
  const common = { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` }
  if (provider === 'typesafe') return common
  return {
    ...common,
    'ai-gateway-auth-method': 'api-key',
    'ai-model-id': model,
    'ai-gateway-protocol-version': AI_GATEWAY_PROTOCOL_VERSION,
    'ai-evaluation-model-specification-version': '4',
  }
}

const PIECE_NAME: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }

/** "knight g1-f3, takes pawn, check": what a choice key means, for the model. */
export function describeMove(m: Move, text: string): string {
  if (m.flag === 'k') return 'castle kingside'
  if (m.flag === 'q') return 'castle queenside'
  const parts = [`${PIECE_NAME[m.piece.toLowerCase()]} ${squareName(m.from)}-${squareName(m.to)}`]
  if (m.captured) parts.push(`takes ${PIECE_NAME[m.captured.toLowerCase()]}${m.flag === 'e' ? ' en passant' : ''}`)
  if (m.promotion) parts.push(`promotes to ${PIECE_NAME[m.promotion]}`)
  if (text.endsWith('#')) parts.push('checkmate')
  else if (text.endsWith('+')) parts.push('check')
  return parts.join(', ')
}

/** The request body: the position as state, one choice over the legal moves. */
export function requestBody(provider: Provider, g: Game, model: string): string {
  const legal = legalMoves(g.pos)
  const criteria: Record<string, string> = {}
  for (const m of legal) {
    const text = san(g.pos, m, legal)
    criteria[text] = describeMove(m, text)
  }
  const side = colorName(claudeColor(g))
  const state = {
    game: 'chess',
    you_play: side,
    fen: toFen(g.pos),
    moves_so_far: moveList(g) || '(none)',
  }
  const questions = {
    move: {
      type: 'choice',
      instructions: `You play ${side} in this chess position. Which legal move is strongest?`,
      criteria,
    },
  }
  return JSON.stringify(provider === 'typesafe' ? { model, state, questions } : { state, questions })
}

export type JevAnswer = { san: string; confidence: number | null; usage: ModelUsage | null }

const num = (...values: unknown[]) => values.find((v): v is number => typeof v === 'number')

/**
 * Token usage when the response carries any, in either the Anthropic or the
 * OpenAI spelling; null when it reports none, so the pane says so rather than
 * showing a count it never got.
 */
export function readUsage(parsed: unknown): ModelUsage | null {
  const u = (parsed as { usage?: Record<string, unknown> } | null)?.usage
  if (!u || typeof u !== 'object') return null
  const input = num(u.input_tokens, u.prompt_tokens, u.inputTokens)
  const output = num(u.output_tokens, u.completion_tokens, u.outputTokens)
  if (input === undefined && output === undefined) return null
  return {
    input_tokens: input ?? 0,
    output_tokens: output ?? 0,
    cache_read_input_tokens: num(u.cache_read_input_tokens, u.cachedInputTokens) ?? 0,
    cache_creation_input_tokens: num(u.cache_creation_input_tokens) ?? 0,
  }
}

/** The move Jev chose, or null when the body names none. */
export function readAnswer(responseText: string): JevAnswer | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(responseText)
  } catch {
    return null
  }
  const answer = (parsed as { answers?: Record<string, Record<string, unknown>> } | null)?.answers?.move
  if (!answer || typeof answer.choice !== 'string') return null
  const probabilities = answer.probabilities as Record<string, number> | undefined
  const values = probabilities ? Object.values(probabilities) : []
  const confidence = num(answer.confidence) ?? (values.length ? Math.max(...values) : null)
  return { san: answer.choice, confidence, usage: readUsage(parsed) }
}

/** Jev's HTTP answer, or undefined when it did not come in time. */
export type JevResponse = { ok: boolean; status: number; text: string } | undefined

/**
 * The move a response names, what it cost when reported, and, when there is
 * no legal move in it, why: the caller then plays a random legal move.
 */
export function jevMove(pos: Position, res: JevResponse, provider: string): { move?: Move; usage: ModelUsage | null; why?: string } {
  if (!res) return { usage: null, why: 'no answer in time' }
  if (!res.ok) return { usage: null, why: `${provider} responded ${res.status}` }
  const answer = readAnswer(res.text)
  if (!answer) return { usage: null, why: 'unreadable answer' }
  const move = findMove(pos, answer.san)
  return move ? { move, usage: answer.usage } : { usage: answer.usage, why: `"${answer.san.slice(0, 16)}" was not legal` }
}
