// Snake: pure game logic, drawn by the Snake module in ../surface.tsx.

export type Pt = readonly [number, number]
export type SnakeGame = { snake: Pt[]; dir: Pt; queued: Pt[]; food: Pt; w: number; h: number; score: number; over: boolean }

const DIRS: Record<string, Pt> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] }
const same = (a: Pt, b: Pt) => a[0] === b[0] && a[1] === b[1]

// a random free cell; [-1, -1] once the snake fills the board
export function placeFood(snake: Pt[], w: number, h: number, rand = Math.random): Pt {
  const taken = new Set(snake.map(p => `${p[0]},${p[1]}`))
  const free: Pt[] = []
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!taken.has(`${x},${y}`)) free.push([x, y])
  return free.length ? free[Math.floor(rand() * free.length)] : [-1, -1]
}

export function newSnake(w: number, h: number, rand = Math.random): SnakeGame {
  const x = Math.floor(w / 4)
  const y = Math.floor(h / 2)
  const snake: Pt[] = [[x, y], [x - 1, y], [x - 2, y]]
  return { snake, dir: [1, 0], queued: [], food: placeFood(snake, w, h, rand), w, h, score: 0, over: false }
}

// a key queues a turn (two at most, so a quick up-then-left lands on consecutive ticks);
// turning back into the neck, or the way it already goes, is ignored
export function turn(g: SnakeGame, key: string): SnakeGame {
  const d = Object.hasOwn(DIRS, key.toLowerCase()) ? DIRS[key.toLowerCase()] : undefined
  const last = g.queued[g.queued.length - 1] ?? g.dir
  if (!d || g.over || same(d, last) || same(d, [-last[0], -last[1]])) return g
  return { ...g, queued: [...g.queued, d].slice(0, 2) }
}

// one tick: move the head, grow on food, end on a wall or the body; the tail cell the snake
// vacates this tick is free to move into
export function step(g: SnakeGame, rand = Math.random): SnakeGame {
  if (g.over) return g
  const [dir = g.dir, ...queued] = g.queued
  const head: Pt = [g.snake[0][0] + dir[0], g.snake[0][1] + dir[1]]
  const eats = same(head, g.food)
  const body = eats ? g.snake : g.snake.slice(0, -1)
  if (head[0] < 0 || head[1] < 0 || head[0] >= g.w || head[1] >= g.h || body.some(p => same(p, head))) return { ...g, dir, queued, over: true }
  const snake = [head, ...body]
  const food = eats ? placeFood(snake, g.w, g.h, rand) : g.food
  return { ...g, snake, dir, queued, food, score: g.score + (eats ? 1 : 0), over: food[0] < 0 }
}
