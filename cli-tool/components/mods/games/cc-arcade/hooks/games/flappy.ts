// Flappy: pure game logic, drawn by the Flappy module in ../surface.tsx.
// Units are board cells; one tick is one 100 ms frame.

export type Pipe = { x: number; gap: number }
export type FlappyGame = { w: number; h: number; y: number; vy: number; pipes: Pipe[]; score: number; over: boolean }

export const BIRD_X = 4
// tuned so a flap every second or so holds height; the first try (0.3 / -1.1 / 1.2) hit the floor
// about a second after the first flap
const GRAVITY = 0.15
const FLAP = -0.9
const MAX_FALL = 0.8
const SPACING = 12

// the opening is a third of the board, at least three rows
export const gapSize = (h: number) => Math.max(3, Math.floor(h / 3))
const randomGap = (h: number, rand: () => number) => 1 + Math.floor(rand() * Math.max(1, h - gapSize(h) - 1))

export function newFlappy(w: number, h: number, rand = Math.random): FlappyGame {
  return { w, h, y: h / 2, vy: 0, pipes: [{ x: w - 1, gap: randomGap(h, rand) }], score: 0, over: false }
}

export const flap = (g: FlappyGame): FlappyGame => (g.over ? g : { ...g, vy: FLAP })

// the bird's row, as drawn and as collisions see it
export const birdRow = (g: FlappyGame) => Math.round(g.y)

// one tick: gravity, the pipes move a column left, a pipe passing the bird scores, and the round
// ends on the floor or a pipe; the ceiling stops the bird instead of ending the round
export function tick(g: FlappyGame, rand = Math.random): FlappyGame {
  if (g.over) return g
  let vy = Math.min(MAX_FALL, g.vy + GRAVITY)
  let y = g.y + vy
  if (y < 0) {
    y = 0
    vy = 0
  }
  let pipes = g.pipes.map(p => ({ ...p, x: p.x - 1 })).filter(p => p.x >= 0)
  const last = pipes[pipes.length - 1]
  if (!last || last.x <= g.w - 1 - SPACING) pipes = [...pipes, { x: g.w - 1, gap: randomGap(g.h, rand) }]
  const score = g.score + pipes.filter(p => p.x === BIRD_X - 1).length
  const row = Math.round(y)
  const hit = row < 0 || row >= g.h || pipes.some(p => p.x === BIRD_X && (row < p.gap || row >= p.gap + gapSize(g.h)))
  return { ...g, y, vy, pipes, score, over: hit }
}
