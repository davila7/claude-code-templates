// Pong against the computer: pure game logic, drawn by the Pong module in ../surface.tsx.
// Your paddle is the left column, the computer's the right; first to WIN points wins.

export type Ball = { x: number; y: number; dx: number; dy: number }
export type PongGame = { w: number; h: number; ball: Ball; you: number; cpu: number; pad: number; scoreYou: number; scoreCpu: number; over: boolean }

export const WIN = 5
// the computer tracks the ball at under a row per tick, so a steep ball gets past it
const CPU_SPEED = 0.6

const serve = (w: number, h: number, towardYou: boolean, rand: () => number): Ball =>
  ({ x: Math.floor(w / 2), y: h / 2, dx: towardYou ? -1 : 1, dy: rand() < 0.5 ? -0.5 : 0.5 })

export function newPong(w: number, h: number, rand = Math.random): PongGame {
  const pad = Math.max(3, Math.floor(h / 4))
  const mid = Math.floor((h - pad) / 2)
  return { w, h, ball: serve(w, h, false, rand), you: mid, cpu: mid, pad, scoreYou: 0, scoreCpu: 0, over: false }
}

const clampPad = (g: PongGame, top: number) => Math.max(0, Math.min(g.h - g.pad, top))

// move your paddle by rows, or to a row (a pointer over the board), keeping it on the board
export const nudge = (g: PongGame, rows: number): PongGame => (g.over ? g : { ...g, you: clampPad(g, g.you + rows) })
export const place = (g: PongGame, row: number): PongGame => (g.over ? g : { ...g, you: clampPad(g, Math.round(row - g.pad / 2)) })

// a paddle at `top` covers the ball's row: send it back, steeper the further from the centre it hits
function returned(g: PongGame, top: number, ball: Ball, dx: number): Ball | undefined {
  const row = Math.round(ball.y)
  if (row < top || row >= top + g.pad) return undefined
  const offset = (row - (top + (g.pad - 1) / 2)) / g.pad
  return { ...ball, dx, dy: Math.max(-1, Math.min(1, ball.dy + offset)) }
}

export function tick(g: PongGame, rand = Math.random): PongGame {
  if (g.over) return g
  let ball: Ball = { ...g.ball, x: g.ball.x + g.ball.dx, y: g.ball.y + g.ball.dy }
  // top and bottom walls
  if (ball.y < 0) ball = { ...ball, y: -ball.y, dy: -ball.dy }
  if (ball.y > g.h - 1) ball = { ...ball, y: 2 * (g.h - 1) - ball.y, dy: -ball.dy }
  // the computer follows the ball while it comes toward it
  const target = ball.y - (g.pad - 1) / 2
  const cpu = ball.dx > 0 ? clampPad(g, g.cpu + Math.max(-CPU_SPEED, Math.min(CPU_SPEED, target - g.cpu))) : g.cpu
  let { scoreYou, scoreCpu } = g
  if (ball.x <= 0) {
    const back = returned(g, g.you, ball, 1)
    if (back) ball = { ...back, x: 1 }
    else { scoreCpu++; ball = serve(g.w, g.h, false, rand) }
  } else if (ball.x >= g.w - 1) {
    const back = returned(g, Math.round(cpu), ball, -1)
    if (back) ball = { ...back, x: g.w - 2 }
    else { scoreYou++; ball = serve(g.w, g.h, true, rand) }
  }
  return { ...g, ball, cpu, scoreYou, scoreCpu, over: scoreYou >= WIN || scoreCpu >= WIN }
}
