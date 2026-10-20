// Tetris: pure game logic, drawn by the Tetris module in ../surface.tsx.

export type Cell = readonly [number, number]
export type Piece = { kind: number; rot: number; x: number; y: number }
export type TetrisGame = { w: number; h: number; board: number[][]; piece: Piece; next: number; score: number; lines: number; over: boolean }

// the seven pieces in spawn rotation, each inside an n×n box it rotates within
const SHAPES: { n: number; cells: Cell[] }[] = [
  { n: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]] }, // I
  { n: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] }, // O
  { n: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] }, // T
  { n: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] }, // S
  { n: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] }, // Z
  { n: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] }, // J
  { n: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] }, // L
]
export const NAMES = 'IOTSZJL'
const LINE_SCORES = [0, 100, 300, 500, 800]

// the board cells a piece covers: its shape turned clockwise `rot` times inside its box
export function cells(p: Piece): Cell[] {
  const { n, cells: shape } = SHAPES[p.kind]
  const turns = ((p.rot % 4) + 4) % 4
  return shape.map(([x, y]) => {
    let cx = x
    let cy = y
    for (let i = 0; i < turns; i++) [cx, cy] = [n - 1 - cy, cx]
    return [p.x + cx, p.y + cy] as const
  })
}

export function collides(g: Pick<TetrisGame, 'w' | 'h' | 'board'>, p: Piece): boolean {
  return cells(p).some(([x, y]) => x < 0 || x >= g.w || y >= g.h || (y >= 0 && g.board[y][x] !== 0))
}

const spawn = (w: number, kind: number): Piece => ({ kind, rot: 0, x: Math.floor((w - SHAPES[kind].n) / 2), y: 0 })
const randomKind = (rand: () => number) => Math.floor(rand() * SHAPES.length)

export function newTetris(w: number, h: number, rand = Math.random): TetrisGame {
  const board = Array.from({ length: h }, () => Array<number>(w).fill(0))
  return { w, h, board, piece: spawn(w, randomKind(rand)), next: randomKind(rand), score: 0, lines: 0, over: false }
}

// fix the piece into the board, clear full rows, score them and bring in the next piece;
// the round ends when that piece has no room
function lock(g: TetrisGame, rand: () => number, bonus = 0): TetrisGame {
  const board = g.board.map(row => [...row])
  for (const [x, y] of cells(g.piece)) if (y >= 0) board[y][x] = g.piece.kind + 1
  const kept = board.filter(row => row.some(c => c === 0))
  const cleared = g.h - kept.length
  const next: TetrisGame = {
    ...g,
    board: [...Array.from({ length: cleared }, () => Array<number>(g.w).fill(0)), ...kept],
    piece: spawn(g.w, g.next),
    next: randomKind(rand),
    lines: g.lines + cleared,
    score: g.score + bonus + LINE_SCORES[cleared],
  }
  return collides(next, next.piece) ? { ...next, over: true } : next
}

export function shift(g: TetrisGame, dx: number): TetrisGame {
  const piece = { ...g.piece, x: g.piece.x + dx }
  return g.over || collides(g, piece) ? g : { ...g, piece }
}

// clockwise, nudged sideways off a wall or a block when it would not fit in place
export function rotate(g: TetrisGame): TetrisGame {
  if (g.over) return g
  for (const dx of [0, -1, 1, -2, 2]) {
    const piece = { ...g.piece, rot: (g.piece.rot + 1) % 4, x: g.piece.x + dx }
    if (!collides(g, piece)) return { ...g, piece }
  }
  return g
}

// gravity and soft drop: one row down, or lock when it cannot fall
export function fall(g: TetrisGame, rand = Math.random): TetrisGame {
  if (g.over) return g
  const piece = { ...g.piece, y: g.piece.y + 1 }
  return collides(g, piece) ? lock(g, rand) : { ...g, piece }
}

// hard drop: straight to the bottom, two points per row dropped
export function drop(g: TetrisGame, rand = Math.random): TetrisGame {
  if (g.over) return g
  let piece = g.piece
  let rows = 0
  while (!collides(g, { ...piece, y: piece.y + 1 })) {
    piece = { ...piece, y: piece.y + 1 }
    rows++
  }
  return lock({ ...g, piece }, rand, rows * 2)
}

// frame ticks (100 ms each) between gravity steps: 600 ms, one tick faster every 10 lines
export const dropEvery = (lines: number) => Math.max(1, 6 - Math.floor(lines / 10))
