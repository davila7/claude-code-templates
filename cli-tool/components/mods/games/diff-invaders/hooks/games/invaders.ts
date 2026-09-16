// Diff Invaders' rules, pure and testable. A wave is the code Claude just added: every added line
// becomes a row of the formation and every two characters of it one alien, so you shoot your own
// diff. The formation steps sideways, drops a row at the edge and rains bombs; you have a ship,
// one shot in the air at a time, and three lives. A cleared wave waits for the next Edit.

export type Pt = readonly [x: number, y: number]
export type Alien = { pos: Pt; glyph: string; alive: boolean }
export type InvadersGame = {
  readonly w: number
  readonly h: number
  aliens: Alien[]
  /** what this wave was made of, for the status line */
  file: string
  dir: 1 | -1
  /** ticks between formation steps: fewer aliens, faster */
  pace: number
  clock: number
  ship: number
  shot?: Pt
  bombs: Pt[]
  lives: number
  score: number
  waves: number
  over: boolean
  cleared: boolean
  tick: number
}

export const W = 30
export const H = 14
const MAX_ROWS = 6
const MAX_COLS = 12

export function newInvaders(score = 0, lives = 3, waves = 0): InvadersGame {
  return { w: W, h: H, aliens: [], file: '', dir: 1, pace: 6, clock: 0, ship: Math.floor(W / 2), bombs: [], lives, score, waves, over: false, cleared: true, tick: 0 }
}

/** Two characters of code per alien; spaces at the edges are trimmed, a run of spaces inside stays a gap. */
export function formation(lines: readonly string[]): Alien[] {
  const rows = lines.map(l => l.replace(/\t/g, '  ').trim()).filter(l => l.length > 0).slice(0, MAX_ROWS)
  const aliens: Alien[] = []
  rows.forEach((line, y) => {
    for (let i = 0, x = 0; i < line.length && x < MAX_COLS; i += 2, x++) {
      const glyph = line.slice(i, i + 2).padEnd(2)
      if (glyph.trim() === '') continue
      aliens.push({ pos: [x + 1, y + 1], glyph, alive: true })
    }
  })
  return aliens
}

/** Start a wave from added lines. Returns the game unchanged when the lines hold no code. */
export function wave(g: InvadersGame, lines: readonly string[], file: string): InvadersGame {
  const aliens = formation(lines)
  if (aliens.length === 0) return g
  return { ...g, aliens, file, dir: 1, pace: Math.max(2, 8 - Math.floor(g.waves / 2)), clock: 0, shot: undefined, bombs: [], cleared: false, waves: g.waves + 1 }
}

export function move(g: InvadersGame, dx: -1 | 1): InvadersGame {
  if (g.over) return g
  return { ...g, ship: Math.max(0, Math.min(W - 1, g.ship + dx)) }
}

export function fire(g: InvadersGame): InvadersGame {
  if (g.over || g.shot) return g
  return { ...g, shot: [g.ship, H - 2] }
}

export function step(g: InvadersGame, rnd: () => number = Math.random): InvadersGame {
  if (g.over) return g
  let out: InvadersGame = { ...g, tick: g.tick + 1 }

  // the shot climbs two rows a tick and takes the first alien it meets
  if (out.shot) {
    const [sx, sy] = out.shot
    let shot: Pt | undefined = [sx, sy - 2]
    let aliens = out.aliens
    let score = out.score
    for (const y of [sy - 1, sy - 2]) {
      const i = aliens.findIndex(a => a.alive && a.pos[0] === sx && a.pos[1] === y)
      if (i !== -1) {
        aliens = aliens.map((a, j) => (j === i ? { ...a, alive: false } : a))
        score += 10
        shot = undefined
        break
      }
    }
    if (shot && shot[1] < 0) shot = undefined
    out = { ...out, shot, aliens, score }
  }

  const alive = out.aliens.filter(a => a.alive)
  if (!out.cleared && alive.length === 0) {
    return { ...out, cleared: true, bombs: [], score: out.score + 50 }
  }

  // the formation steps on its own clock; faster as it thins out
  const pace = Math.max(1, out.pace - Math.floor((out.aliens.length - alive.length) / 8))
  if (alive.length > 0 && out.tick % pace === 0) {
    const xs = alive.map(a => a.pos[0])
    const atEdge = out.dir === 1 ? Math.max(...xs) >= W - 1 : Math.min(...xs) <= 0
    const aliens = out.aliens.map(a => (a.alive ? { ...a, pos: atEdge ? [a.pos[0], a.pos[1] + 1] as Pt : [a.pos[0] + out.dir, a.pos[1]] as Pt } : a))
    out = { ...out, aliens, dir: atEdge ? (out.dir === 1 ? -1 : 1) : out.dir }
    // a landed formation ends the game
    if (aliens.some(a => a.alive && a.pos[1] >= H - 2)) return { ...out, over: true }
    // the lowest alien of a random column drops a bomb, from where the formation now stands
    const moved = aliens.filter(a => a.alive)
    if (rnd() < 0.35 && moved.length > 0) {
      const col = moved[Math.floor(rnd() * moved.length)]!.pos[0]
      const lowest = moved.filter(a => a.pos[0] === col).sort((a, b) => b.pos[1] - a.pos[1])[0]!
      out = { ...out, bombs: [...out.bombs, [lowest.pos[0], lowest.pos[1] + 1]] }
    }
  }

  // bombs fall one row a tick; one on the ship costs a life
  if (out.tick % 2 === 0) {
    const bombs: Pt[] = []
    let lives = out.lives
    for (const [bx, by] of out.bombs) {
      const ny = by + 1
      if (ny >= H - 1 && bx === out.ship) lives--
      else if (ny < H - 1) bombs.push([bx, ny])
    }
    out = { ...out, bombs, lives }
    if (lives <= 0) return { ...out, lives: 0, over: true }
  }
  return out
}
