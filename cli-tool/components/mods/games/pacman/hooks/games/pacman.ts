// Pac-Man's rules, pure and testable: a maze of pellets, a player who turns at the next opening,
// four ghosts that chase, scatter or flee, power pellets, lives and levels. No drawing here; the
// board in ../boards/pacman.tsx renders a PacmanGame and feeds it keys.

export type Dir = 'up' | 'down' | 'left' | 'right'
export type Pt = readonly [x: number, y: number]
export type Ghost = { pos: Pt; dir: Dir; color: string; home: Pt; eaten: boolean }
export type PacmanGame = {
  readonly w: number
  readonly h: number
  /** walls, as `y*w+x` keys */
  readonly walls: ReadonlySet<number>
  pellets: Set<number>
  power: Set<number>
  pac: Pt
  dir: Dir
  wanted: Dir
  ghosts: Ghost[]
  /** ticks of fright left; ghosts are edible while > 0 */
  fright: number
  /** ticks until the ghosts switch between chase and scatter */
  modeClock: number
  chasing: boolean
  score: number
  lives: number
  level: number
  /** ghosts eaten during one power pellet: 200, 400, 800, 1600 */
  combo: number
  over: boolean
  won: boolean
  tick: number
}

// `#` wall, `.` pellet, `o` power pellet, ` ` open floor, `P` the player's start, `G` a ghost's
// start, `-` the pen door (floor the player never enters). Row 7 is open at both ends: a tunnel.
export const MAZE: readonly string[] = [
  '###################',
  '#........#........#',
  '#o##.###.#.###.##o#',
  '#.................#',
  '#.##.#.#####.#.##.#',
  '#....#.......#....#',
  '####.#.##-##.#.####',
  '    ...#GGG#...    ',
  '####.#.#####.#.####',
  '#........#........#',
  '#.##.###.#.###.##.#',
  '#o.#.....P.....#.o#',
  '##.#.#.#####.#.#.##',
  '#....#...#...#....#',
  '###################',
]

export const GHOST_COLORS = ['red', 'magenta', 'cyan', 'green'] as const
const DIRS: readonly Dir[] = ['up', 'down', 'left', 'right']
const DELTA: Record<Dir, Pt> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }
const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' }
const FRIGHT_TICKS = 45
const CHASE_TICKS = 140
const SCATTER_TICKS = 50

const key = (w: number, [x, y]: Pt) => y * w + x
const same = (a: Pt, b: Pt) => a[0] === b[0] && a[1] === b[1]
const dist = (a: Pt, b: Pt) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])

export function newPacman(level = 1, score = 0, lives = 3): PacmanGame {
  const h = MAZE.length
  const w = MAZE[0]!.length
  const walls = new Set<number>()
  const pellets = new Set<number>()
  const power = new Set<number>()
  const ghosts: Ghost[] = []
  let pac: Pt = [1, 1]
  let door: Pt = [9, 6]
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = MAZE[y]![x]
      const k = y * w + x
      if (c === '#') walls.add(k)
      else if (c === '.') pellets.add(k)
      else if (c === 'o') power.add(k)
      else if (c === 'P') pac = [x, y]
      else if (c === '-') door = [x, y]
      else if (c === 'G') ghosts.push({ pos: [x, y], dir: 'up', color: GHOST_COLORS[ghosts.length % GHOST_COLORS.length]!, home: [x, y], eaten: false })
    }
  }
  // the fourth ghost starts on the door, already out
  ghosts.push({ pos: door, dir: 'left', color: GHOST_COLORS[3]!, home: door, eaten: false })
  return {
    w, h, walls, pellets, power, pac, dir: 'left', wanted: 'left', ghosts,
    fright: 0, modeClock: CHASE_TICKS, chasing: true, score, lives, level, combo: 0, over: false, won: false, tick: 0,
  }
}

/** The cell one step from `p` in `d`, wrapping through the tunnel row. */
function ahead(g: PacmanGame, p: Pt, d: Dir): Pt {
  const [dx, dy] = DELTA[d]
  return [(p[0] + dx + g.w) % g.w, (p[1] + dy + g.h) % g.h]
}

function open(g: PacmanGame, p: Pt): boolean {
  return !g.walls.has(key(g.w, p))
}

// the player cannot walk into the pen: its door is floor only for ghosts
function openForPac(g: PacmanGame, p: Pt): boolean {
  return open(g, p) && MAZE[p[1]]![p[0]] !== '-' && MAZE[p[1]]![p[0]] !== 'G'
}

export function turn(g: PacmanGame, k: string): PacmanGame {
  const d: Dir | undefined =
    k === 'up' || k === 'w' ? 'up' : k === 'down' || k === 's' ? 'down' : k === 'left' || k === 'a' ? 'left' : k === 'right' || k === 'd' ? 'right' : undefined
  return d ? { ...g, wanted: d } : g
}

function ghostTarget(g: PacmanGame, i: number): Pt {
  if (!g.chasing) {
    // scatter: each ghost heads for its own corner
    return ([[g.w - 2, 1], [1, 1], [g.w - 2, g.h - 2], [1, g.h - 2]] as const)[i % 4] as Pt
  }
  const [px, py] = g.pac
  const [dx, dy] = DELTA[g.dir]
  switch (i % 4) {
    case 0: return g.pac // Blinky: straight at the player
    case 1: return [px + dx * 4, py + dy * 4] // Pinky: four cells ahead
    case 2: { // Inky: the mirror of Blinky's position through a point two cells ahead
      const b = g.ghosts[0]?.pos ?? g.pac
      return [2 * (px + dx * 2) - b[0], 2 * (py + dy * 2) - b[1]]
    }
    default: { // Clyde: chases while far, runs to its corner while near
      const c = g.ghosts[3]?.pos ?? g.pac
      return dist(c, g.pac) > 6 ? g.pac : [1, g.h - 2]
    }
  }
}

function moveGhost(g: PacmanGame, ghost: Ghost, i: number, rnd: () => number): Ghost {
  if (ghost.eaten) {
    // eyes only: fly home, then come back out
    if (same(ghost.pos, ghost.home)) return { ...ghost, eaten: false, dir: 'up' }
    const options = DIRS.filter(d => open(g, ahead(g, ghost.pos, d)))
    const best = options.sort((a, b) => dist(ahead(g, ghost.pos, a), ghost.home) - dist(ahead(g, ghost.pos, b), ghost.home))[0] ?? ghost.dir
    return { ...ghost, dir: best, pos: ahead(g, ghost.pos, best) }
  }
  const frightened = g.fright > 0
  // a ghost never reverses on its own, unless the corridor is a dead end
  let options = DIRS.filter(d => d !== OPPOSITE[ghost.dir] && open(g, ahead(g, ghost.pos, d)))
  if (options.length === 0) options = [OPPOSITE[ghost.dir]]
  let dir: Dir
  if (frightened) dir = options[Math.floor(rnd() * options.length)]!
  else {
    const target = ghostTarget(g, i)
    // a little noise keeps four ghosts from stacking on one path
    dir = options.sort((a, b) => dist(ahead(g, ghost.pos, a), target) - dist(ahead(g, ghost.pos, b), target))[rnd() < 0.15 && options.length > 1 ? 1 : 0]!
  }
  return { ...ghost, dir, pos: ahead(g, ghost.pos, dir) }
}

function collide(g: PacmanGame): PacmanGame {
  let out = g
  for (let i = 0; i < out.ghosts.length; i++) {
    const ghost = out.ghosts[i]!
    if (ghost.eaten || !same(ghost.pos, out.pac)) continue
    if (out.fright > 0) {
      const points = 200 * 2 ** out.combo
      const ghosts = out.ghosts.map((x, j) => (j === i ? { ...x, eaten: true } : x))
      out = { ...out, ghosts, score: out.score + points, combo: out.combo + 1 }
    } else {
      const lives = out.lives - 1
      const fresh = newPacman(out.level, out.score, lives)
      return { ...fresh, pellets: out.pellets, power: out.power, over: lives <= 0, tick: out.tick }
    }
  }
  return out
}

/** One step of the clock. Ghosts move every tick; on early levels they skip one tick in four. */
export function step(g: PacmanGame, rnd: () => number = Math.random): PacmanGame {
  if (g.over || g.won) return g
  let out: PacmanGame = { ...g, tick: g.tick + 1 }

  // the player: take the wanted turn when its cell is open, else keep going, else stop at the wall
  const turnCell = ahead(out, out.pac, out.wanted)
  if (openForPac(out, turnCell)) out = { ...out, dir: out.wanted, pac: turnCell }
  else {
    const straight = ahead(out, out.pac, out.dir)
    if (openForPac(out, straight)) out = { ...out, pac: straight }
  }

  // eat
  const k = key(out.w, out.pac)
  if (out.pellets.has(k)) {
    const pellets = new Set(out.pellets); pellets.delete(k)
    out = { ...out, pellets, score: out.score + 10 }
  } else if (out.power.has(k)) {
    const power = new Set(out.power); power.delete(k)
    out = { ...out, power, score: out.score + 50, fright: FRIGHT_TICKS, combo: 0 }
  }
  if (out.pellets.size === 0 && out.power.size === 0) return { ...out, won: true }

  out = collide(out)
  if (out.over) return out

  // ghosts: slower than the player on low levels, as slow as fear makes them
  const ghostsMove = out.fright > 0 ? out.tick % 2 === 0 : out.level < 3 ? out.tick % 4 !== 0 : true
  if (ghostsMove) {
    const ghosts = out.ghosts.map((ghost, i) => moveGhost(out, ghost, i, rnd))
    out = { ...out, ghosts }
    out = collide(out)
    if (out.over) return out
  }

  // clocks
  const fright = Math.max(0, out.fright - 1)
  let { modeClock, chasing } = out
  if (fright === 0) {
    modeClock--
    if (modeClock <= 0) {
      chasing = !chasing
      modeClock = chasing ? CHASE_TICKS : SCATTER_TICKS
    }
  }
  return { ...out, fright, modeClock, chasing }
}

/** The next level: the same maze, full again, faster ghosts. */
export function nextLevel(g: PacmanGame): PacmanGame {
  return newPacman(g.level + 1, g.score, g.lives)
}
