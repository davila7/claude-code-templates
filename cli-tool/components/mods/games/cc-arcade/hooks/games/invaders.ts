// Space Invaders: pure game logic, drawn by the Invaders board in ../boards/invaders.tsx.
// Units are board cells; one tick is one 100 ms frame. The ship sits on the bottom row.

export type Pt = readonly [number, number]
export type InvadersGame = {
  w: number; h: number
  ship: number
  shots: Pt[]; bombs: Pt[]; aliens: Pt[]
  dir: 1 | -1
  ticks: number; score: number; lives: number; wave: number; over: boolean
}

const COLS = 8
const ROWS = 3
const BOMB_CHANCE = 0.12
const same = (a: Pt, b: Pt) => a[0] === b[0] && a[1] === b[1]

// a formation of COLS × ROWS aliens two cells apart, centred; each wave starts a row lower (at most 3)
export function formation(w: number, wave: number): Pt[] {
  const left = Math.max(0, Math.floor((w - COLS * 2) / 2))
  const top = 1 + Math.min(wave - 1, 3)
  const out: Pt[] = []
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) out.push([left + c * 2, top + r])
  return out
}

export const newInvaders = (w: number, h: number): InvadersGame => ({
  w, h, ship: Math.floor(w / 2), shots: [], bombs: [], aliens: formation(w, 1), dir: 1, ticks: 0, score: 0, lives: 3, wave: 1, over: false,
})

// ticks between formation steps: fewer aliens and later waves step faster
export const stepEvery = (g: InvadersGame) => Math.max(1, Math.round(g.aliens.length / 3) - (g.wave - 1))

export const shift = (g: InvadersGame, dx: number): InvadersGame =>
  g.over ? g : { ...g, ship: Math.max(0, Math.min(g.w - 1, g.ship + dx)) }

// one shot on screen at a time, as in the original
export const fire = (g: InvadersGame): InvadersGame => (g.over || g.shots.length ? g : { ...g, shots: [[g.ship, g.h - 2]] })

// a shot and an alien in the same cell remove each other, ten points each
function hits(g: InvadersGame): InvadersGame {
  const shots = g.shots.filter(s => !g.aliens.some(a => same(a, s)))
  const aliens = g.aliens.filter(a => !g.shots.some(s => same(a, s)))
  return { ...g, shots, aliens, score: g.score + (g.aliens.length - aliens.length) * 10 }
}

export function tick(g: InvadersGame, rand = Math.random): InvadersGame {
  if (g.over) return g
  let next: InvadersGame = { ...g, ticks: g.ticks + 1, shots: g.shots.map(([x, y]): Pt => [x, y - 1]).filter(([, y]) => y >= 0) }
  next = hits(next)

  // the formation steps sideways, or down and back at an edge
  if (next.aliens.length && next.ticks % stepEvery(next) === 0) {
    const dir = next.dir
    const edge = next.aliens.some(([x]) => x + dir < 0 || x + dir >= next.w)
    next = edge
      ? { ...next, dir: dir === 1 ? -1 : 1, aliens: next.aliens.map(([x, y]): Pt => [x, y + 1]) }
      : { ...next, aliens: next.aliens.map(([x, y]): Pt => [x + dir, y]) }
    next = hits(next)
  }

  // bombs fall; now and then the lowest alien of a random column drops a new one
  let bombs = next.bombs.map(([x, y]): Pt => [x, y + 1]).filter(([, y]) => y < next.h)
  if (next.aliens.length && rand() < BOMB_CHANCE) {
    const picked = next.aliens[Math.floor(rand() * next.aliens.length)]
    const lowest = next.aliens.filter(a => a[0] === picked[0]).reduce((m, a) => (a[1] > m[1] ? a : m))
    bombs = [...bombs, [lowest[0], lowest[1] + 1]]
  }
  const hit = bombs.some(([x, y]) => y === next.h - 1 && x === next.ship)
  const lives = next.lives - (hit ? 1 : 0)
  const landed = next.aliens.some(([, y]) => y >= next.h - 1)
  next = { ...next, bombs: hit ? [] : bombs, lives, over: lives <= 0 || landed }

  // a cleared wave brings the next, a row lower and faster
  if (!next.over && !next.aliens.length) {
    next = { ...next, wave: next.wave + 1, aliens: formation(next.w, next.wave + 1), shots: [], bombs: [], dir: 1 }
  }
  return next
}
