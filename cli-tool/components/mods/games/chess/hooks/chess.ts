/**
 * The rules of chess, pure and dependency-free: positions as FEN, every legal
 * move (castling, en passant, promotion), check, mate, stalemate, the
 * fifty-move rule, threefold repetition, insufficient material, and SAN.
 *
 * Squares are 0..63, a1 = 0, h1 = 7, a8 = 56. Pieces are FEN letters:
 * uppercase white, lowercase black, '' an empty square.
 */

export type Color = 'w' | 'b'
export type Piece = '' | 'P' | 'N' | 'B' | 'R' | 'Q' | 'K' | 'p' | 'n' | 'b' | 'r' | 'q' | 'k'

export type Position = {
  board: Piece[]
  turn: Color
  /** Castling rights still held, as FEN spells them ('KQkq', '' for none). */
  castling: string
  /** The square a pawn may capture onto en passant, or -1. */
  ep: number
  /** Half-moves since the last capture or pawn move (the fifty-move rule). */
  half: number
  /** The full-move number, from 1, raised after Black moves. */
  full: number
}

export type Move = {
  from: number
  to: number
  piece: Piece
  captured?: Piece
  promotion?: 'q' | 'r' | 'b' | 'n'
  /** 'k' / 'q' king- or queen-side castling, 'e' en passant, 'd' a double pawn step. */
  flag?: 'k' | 'q' | 'e' | 'd'
}

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

const FILES = 'abcdefgh'
export const fileOf = (sq: number) => sq & 7
export const rankOf = (sq: number) => sq >> 3
export const squareName = (sq: number) => `${FILES[fileOf(sq)]}${rankOf(sq) + 1}`
export function squareIndex(name: string): number {
  const f = FILES.indexOf(name[0] ?? '')
  const r = Number(name[1]) - 1
  return f < 0 || !(r >= 0 && r < 8) || name.length !== 2 ? -1 : r * 8 + f
}

export const colorOf = (p: Piece): Color | undefined => (p === '' ? undefined : p === p.toUpperCase() ? 'w' : 'b')
const other = (c: Color): Color => (c === 'w' ? 'b' : 'w')
const kind = (p: Piece) => p.toLowerCase()

export function parseFen(fen: string): Position {
  const [placement = '', turn = 'w', castling = '-', ep = '-', half = '0', full = '1'] = fen.trim().split(/\s+/)
  const board: Piece[] = new Array(64).fill('')
  const rows = placement.split('/')
  if (rows.length !== 8) throw new Error(`bad FEN: ${fen}`)
  rows.forEach((row, i) => {
    const rank = 7 - i
    let file = 0
    for (const ch of row) {
      if (/[1-8]/.test(ch)) file += Number(ch)
      else if (/[pnbrqkPNBRQK]/.test(ch) && file < 8) board[rank * 8 + file++] = ch as Piece
      else throw new Error(`bad FEN: ${fen}`)
    }
    if (file !== 8) throw new Error(`bad FEN: ${fen}`)
  })
  return {
    board,
    turn: turn === 'b' ? 'b' : 'w',
    castling: castling === '-' ? '' : castling,
    ep: ep === '-' ? -1 : squareIndex(ep),
    half: Number(half) || 0,
    full: Number(full) || 1,
  }
}

/** The position's placement, side, castling and en-passant fields: what repetition compares. */
export function positionKey(pos: Position): string {
  const rows: string[] = []
  for (let rank = 7; rank >= 0; rank--) {
    let row = ''
    let empty = 0
    for (let file = 0; file < 8; file++) {
      const p = pos.board[rank * 8 + file]
      if (p === '') empty++
      else {
        if (empty) row += empty
        empty = 0
        row += p
      }
    }
    rows.push(empty ? row + empty : row)
  }
  return `${rows.join('/')} ${pos.turn} ${pos.castling || '-'} ${pos.ep < 0 ? '-' : squareName(pos.ep)}`
}

export const toFen = (pos: Position) => `${positionKey(pos)} ${pos.half} ${pos.full}`

const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]
const KING = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]
const ROOK_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]]
const BISHOP_DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]]

function step(sq: number, df: number, dr: number): number {
  const f = fileOf(sq) + df
  const r = rankOf(sq) + dr
  return f < 0 || f > 7 || r < 0 || r > 7 ? -1 : r * 8 + f
}

/** Whether `by` attacks `sq` in `board`. */
export function attacked(board: readonly Piece[], sq: number, by: Color): boolean {
  const own = (p: Piece, k: string) => p !== '' && colorOf(p) === by && kind(p) === k
  const pawnDr = by === 'w' ? -1 : 1
  for (const df of [-1, 1]) {
    const s = step(sq, df, pawnDr)
    if (s >= 0 && own(board[s], 'p')) return true
  }
  for (const [df, dr] of KNIGHT) {
    const s = step(sq, df, dr)
    if (s >= 0 && own(board[s], 'n')) return true
  }
  for (const [df, dr] of KING) {
    const s = step(sq, df, dr)
    if (s >= 0 && own(board[s], 'k')) return true
  }
  for (const [dirs, sliders] of [[ROOK_DIRS, 'rq'], [BISHOP_DIRS, 'bq']] as const) {
    for (const [df, dr] of dirs) {
      let s = step(sq, df, dr)
      while (s >= 0) {
        const p = board[s]
        if (p !== '') {
          if (colorOf(p) === by && sliders.includes(kind(p))) return true
          break
        }
        s = step(s, df, dr)
      }
    }
  }
  return false
}

export function inCheck(pos: Position, color: Color = pos.turn): boolean {
  const king = pos.board.indexOf(color === 'w' ? 'K' : 'k')
  return king >= 0 && attacked(pos.board, king, other(color))
}

function pseudoMoves(pos: Position): Move[] {
  const moves: Move[] = []
  const { board, turn } = pos
  const push = (from: number, to: number, extra: Partial<Move> = {}) => {
    const captured = board[to] || undefined
    moves.push({ from, to, piece: board[from], ...(captured ? { captured } : {}), ...extra })
  }
  for (let from = 0; from < 64; from++) {
    const p = board[from]
    if (p === '' || colorOf(p) !== turn) continue
    const k = kind(p)
    if (k === 'p') {
      const dr = turn === 'w' ? 1 : -1
      const startRank = turn === 'w' ? 1 : 6
      const lastRank = turn === 'w' ? 7 : 0
      const pawnTo = (to: number, extra: Partial<Move> = {}) => {
        if (rankOf(to) === lastRank) for (const promotion of ['q', 'r', 'b', 'n'] as const) push(from, to, { ...extra, promotion })
        else push(from, to, extra)
      }
      const one = step(from, 0, dr)
      if (one >= 0 && board[one] === '') {
        pawnTo(one)
        const two = step(from, 0, 2 * dr)
        if (rankOf(from) === startRank && board[two] === '') push(from, two, { flag: 'd' })
      }
      for (const df of [-1, 1]) {
        const to = step(from, df, dr)
        if (to < 0) continue
        if (board[to] !== '' && colorOf(board[to]) !== turn) pawnTo(to)
        else if (to === pos.ep) moves.push({ from, to, piece: p, captured: turn === 'w' ? 'p' : 'P', flag: 'e' })
      }
    } else if (k === 'n' || k === 'k') {
      for (const [df, dr] of k === 'n' ? KNIGHT : KING) {
        const to = step(from, df, dr)
        if (to >= 0 && colorOf(board[to]) !== turn) push(from, to)
      }
    } else {
      const dirs = k === 'r' ? ROOK_DIRS : k === 'b' ? BISHOP_DIRS : [...ROOK_DIRS, ...BISHOP_DIRS]
      for (const [df, dr] of dirs) {
        let to = step(from, df, dr)
        while (to >= 0) {
          if (board[to] === '') push(from, to)
          else {
            if (colorOf(board[to]) !== turn) push(from, to)
            break
          }
          to = step(to, df, dr)
        }
      }
    }
  }
  // castling: rights held, squares between empty, king not in, through or into check
  const home = turn === 'w' ? 0 : 56
  const them = other(turn)
  const king = turn === 'w' ? 'K' : 'k'
  const rook = turn === 'w' ? 'R' : 'r'
  if (board[home + 4] === king && !attacked(board, home + 4, them)) {
    const [kRight, qRight] = turn === 'w' ? ['K', 'Q'] : ['k', 'q']
    if (
      pos.castling.includes(kRight) &&
      board[home + 7] === rook &&
      board[home + 5] === '' &&
      board[home + 6] === '' &&
      !attacked(board, home + 5, them) &&
      !attacked(board, home + 6, them)
    )
      moves.push({ from: home + 4, to: home + 6, piece: king, flag: 'k' })
    if (
      pos.castling.includes(qRight) &&
      board[home] === rook &&
      board[home + 1] === '' &&
      board[home + 2] === '' &&
      board[home + 3] === '' &&
      !attacked(board, home + 3, them) &&
      !attacked(board, home + 2, them)
    )
      moves.push({ from: home + 4, to: home + 2, piece: king, flag: 'q' })
  }
  return moves
}

/** The position after `move`, which must be one of `legalMoves(pos)`. */
export function makeMove(pos: Position, move: Move): Position {
  const board = pos.board.slice()
  const { from, to, piece, flag } = move
  board[to] = move.promotion ? ((pos.turn === 'w' ? move.promotion.toUpperCase() : move.promotion) as Piece) : piece
  board[from] = ''
  if (flag === 'e') board[to + (pos.turn === 'w' ? -8 : 8)] = ''
  if (flag === 'k') {
    board[to - 1] = board[to + 1]
    board[to + 1] = ''
  }
  if (flag === 'q') {
    board[to + 1] = board[to - 2]
    board[to - 2] = ''
  }
  // a right goes when its king or rook moves, or its rook is captured at home
  const lost: Record<number, string> = { 0: 'Q', 4: 'KQ', 7: 'K', 56: 'q', 60: 'kq', 63: 'k' }
  let castling = pos.castling
  for (const sq of [from, to]) for (const right of lost[sq] ?? '') castling = castling.replace(right, '')
  return {
    board,
    turn: other(pos.turn),
    castling,
    ep: flag === 'd' ? (from + to) / 2 : -1,
    half: kind(piece) === 'p' || move.captured ? 0 : pos.half + 1,
    full: pos.turn === 'b' ? pos.full + 1 : pos.full,
  }
}

export function legalMoves(pos: Position): Move[] {
  return pseudoMoves(pos).filter(m => !inCheck(makeMove(pos, m), pos.turn))
}

export const uci = (m: Move) => `${squareName(m.from)}${squareName(m.to)}${m.promotion ?? ''}`

/** Standard algebraic notation for `move` in `pos`, with + or #. */
export function san(pos: Position, move: Move, legal: readonly Move[] = legalMoves(pos)): string {
  let text: string
  if (move.flag === 'k') text = 'O-O'
  else if (move.flag === 'q') text = 'O-O-O'
  else {
    const k = kind(move.piece)
    const capture = move.captured ? 'x' : ''
    if (k === 'p') {
      text = `${capture ? FILES[fileOf(move.from)] + 'x' : ''}${squareName(move.to)}`
      if (move.promotion) text += `=${move.promotion.toUpperCase()}`
    } else {
      const rivals = legal.filter(m => m.piece === move.piece && m.to === move.to && m.from !== move.from)
      let from = ''
      if (rivals.length) {
        if (!rivals.some(m => fileOf(m.from) === fileOf(move.from))) from = FILES[fileOf(move.from)]
        else if (!rivals.some(m => rankOf(m.from) === rankOf(move.from))) from = String(rankOf(move.from) + 1)
        else from = squareName(move.from)
      }
      text = `${k.toUpperCase()}${from}${capture}${squareName(move.to)}`
    }
  }
  const after = makeMove(pos, move)
  if (inCheck(after)) text += legalMoves(after).length ? '+' : '#'
  return text
}

const bare = (s: string) => s.replace(/[+#!?\s]/g, '').replace(/0/g, 'O').replace('=', '')

/**
 * The legal move `text` names, in SAN (`Nf3`, `exd5`, `O-O`, `e8=Q`) or UCI
 * (`g1f3`, `e7e8q`); undefined when it names none.
 */
export function findMove(pos: Position, text: string, legal: readonly Move[] = legalMoves(pos)): Move | undefined {
  const want = bare(text)
  if (!want) return undefined
  const byUci = legal.find(m => uci(m) === want.toLowerCase())
  if (byUci) return byUci
  return legal.find(m => bare(san(pos, m, legal)) === want)
}

/** Why the game is over, or undefined while it goes on. */
export type Ending = 'checkmate' | 'stalemate' | 'fifty-move rule' | 'threefold repetition' | 'insufficient material'

export function ending(pos: Position, history: readonly string[] = []): Ending | undefined {
  if (!legalMoves(pos).length) return inCheck(pos) ? 'checkmate' : 'stalemate'
  if (pos.half >= 100) return 'fifty-move rule'
  const key = positionKey(pos)
  if (history.filter(k => k === key).length >= 3) return 'threefold repetition'
  const rest = pos.board.filter(p => p !== '' && kind(p) !== 'k')
  if (rest.length === 0) return 'insufficient material'
  if (rest.length === 1 && 'nb'.includes(kind(rest[0]))) return 'insufficient material'
  return undefined
}
