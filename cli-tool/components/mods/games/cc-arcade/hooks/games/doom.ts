// Doom: a raycaster corridor shooter, drawn by the Doom board in ../boards/doom.tsx.
// One map cell is one square unit, the player is a point with a radius, angles are radians and
// grow clockwise on screen (+x east, +y south). One tick is one 50 ms frame.
//
// One key press is one step. A terminal sends presses and nothing else — no release, and it repeats
// only the key held last — so anything that keeps moving you after a press has to guess when you
// stopped, and guessing wrong feels worse than a short step. Hold a key and the terminal's own
// repeat walks you; spam the keys and you go exactly as far as you pressed.
//
// A floor is a block of text: walls are 1 (brown), 2 (grey), 3 (green), D a locked door and X the
// exit switch. Everything else stands on the floor and is lifted out when the level is parsed —
// S the spawn, i d z the monsters, + a b g c k the pickups.

export type Kind = 'imp' | 'demon' | 'zombie'
// bite counts down to the next time this one can claw you; hurt is the white flash of being shot
type Enemy = { kind: Kind; x: number; y: number; hp: number; hurt: number; bite?: number }
export type ItemKind = 'health' | 'shells' | 'bullets' | 'shotgun' | 'chaingun' | 'key'
type Item = { kind: ItemKind; x: number; y: number }
export type Weapon = 'pistol' | 'shotgun' | 'chaingun'
type Ball = { x: number; y: number; dx: number; dy: number }
type Ray = { dist: number; side: 0 | 1; kind: string }
type Pt = readonly [number, number]
export type DoomGame = {
  level: number
  map: string[]
  exits: Pt[]
  px: number; py: number; dir: number
  enemies: Enemy[]; balls: Ball[]; items: Item[]
  health: number; bullets: number; shells: number
  weapon: Weapon; owned: Weapon[]; key: boolean
  // frames until the weapon can fire again, frames left on the muzzle flash and on the pain flash
  cool: number; flash: number; pain: number
  kills: number; ticks: number; over: boolean
  // what just happened, and the tick it happened on, for the status line
  said: string; saidAt: number
}

const MONSTER: Record<Kind, { hp: number; speed: number; melee: number; reach: number; shot: number }> = {
  // an imp throws fireballs, a demon only bites but is fast and takes a beating, a zombie shoots
  // Speeds are cells a frame. A key press moves you 0.3 and you can press several times a frame by
  // holding the key, so these sit well under that: a monster that keeps pace with someone spamming
  // keys is a monster you can never get away from. Measured against a bot playing at 7, 10 and 20
  // presses a second; the slowest of those has to be able to finish a floor.
  imp: { hp: 60, speed: 0.038, melee: 7, reach: 0, shot: 0 },
  demon: { hp: 110, speed: 0.07, melee: 12, reach: 0, shot: 0 },
  zombie: { hp: 30, speed: 0.03, melee: 4, reach: 10, shot: 5 },
}
export const WEAPON: Record<Weapon, { damage: number; pellets: number; spread?: number; cool: number; ammo: 'bullets' | 'shells' }> = {
  pistol: { damage: 18, pellets: 1, cool: 6, ammo: 'bullets' },
  shotgun: { damage: 22, pellets: 3, spread: 0.09, cool: 12, ammo: 'shells' },
  chaingun: { damage: 12, pellets: 1, cool: 2, ammo: 'bullets' },
}
const PICKUP: Record<string, ItemKind> = { '+': 'health', a: 'shells', b: 'bullets', g: 'shotgun', c: 'chaingun', k: 'key' }
const SPAWNS: Record<string, Kind> = { i: 'imp', d: 'demon', z: 'zombie' }

const RADIUS = 0.28
const BALL_SPEED = 0.11
const BALL_HIT = 9
const THROW_CHANCE = 0.0075
const SHOOT_CHANCE = 0.01
const REACH = 1.1
// a second between one monster's claws, counted per monster
const BITE_EVERY = 20
// how far one press takes you, and how far one turns you
export const STEP = 0.3
export const SWING = 0.17
const GRAB = 0.6

// E1M1 through E1M4, in the sense that there are four of them and the first one is a hangar
export const LEVELS = [
  [
    '222222222222222222222222',
    '2....S.2.......b.......2',
    '2......2....3333333....2',
    '2......2....3..a..3....2',
    '2..+...1....3..i..3....2',
    '2222.222....3.....3....2',
    '2...........33...33....2',
    '2....1111.......z......2',
    '2....1..1....2222222...2',
    '2..i...g1....2..X..2...2',
    '2....1..1....2..i..D...2',
    '2....1111....2.....2...2',
    '2............2.2.222...2',
    '2.......k..............2',
    '2..33333333333...3333..2',
    '2..3....z....a...3..b..2',
    '2..3.........i...3.....2',
    '2..3333333.3333333.....2',
    '2......+...........i...2',
    '222222222222222222222222',
  ],
  [
    '111111111111111111111111',
    '1....1S.....i.....b....1',
    '1....1..1111111111.....1',
    '1....1..1........1..z..1',
    '1....D..1..a..d..1.....1',
    '1....1..1........1.....1',
    '1.b..1..1.111111.1..1111',
    '1....1..1.1....1.1.....1',
    '11.111..1.1.k..1.1111..1',
    '1.......1.1....1....1..1',
    '1..zzz..1.1.1111....1..1',
    '1.......1.1.1..i....1..1',
    '111.11111.1.1..111111..1',
    '1.........1.1.......d..1',
    '1..c......1.1..1111111.1',
    '1.........1.1..1XXX.1..1',
    '1111111.111.1..1...1...1',
    '1......+....1..1.i.D..a1',
    '1...i.......1..11111...1',
    '111111111111111111111111',
  ],
  [
    '333333333333333333333333',
    '3.................b....3',
    '3.....2..2..2..2.......3',
    '3..+..2..2..2..2....d..3',
    '3S....................a3',
    '3..2..111111111111..2..3',
    '3..2..1...i....z.1..2..3',
    '3..2..1..........1..2..3',
    '3.....1..2222.2..1.....3',
    '3..i..1..2..X.2..1..i..3',
    '3..+..1..2....2..1.....3',
    '3..2..1..22.222..1..2..3',
    '3..2..1..........1..2..3',
    '3..2..1..z....i..1..2..3',
    '3.....1111111D1111.....3',
    '3..a...................3',
    '3.....2..2..k..2..2....3',
    '3..b..2..2..2..2..2..+.3',
    '3.z.......d.........i..3',
    '333333333333333333333333',
  ],
  [
    '222222222222222222222222',
    '2...b..2S......2....a..2',
    '2......2...d...2.......2',
    '2......2.......2...i...2',
    '2.11.112.22.222D2222.222',
    '2.1....2....a....2.....2',
    '2.1.z..D....k....2..d..2',
    '2.1....2.........2.....2',
    '2.111112.2222222.2.....2',
    '2...+....2.....2.2222.22',
    '2..i..d..2..i..2.......2',
    '2........2.....2...zz..2',
    '22.2222.22..a..2.......2',
    '2...b...2.......2222.222',
    '2...c...2..111111..D...2',
    '2.......2..1XXX.1..1.d.2',
    '2.222.222..1...11..1...2',
    '2.....+....1.i.....1.b.2',
    '2..z.......111111111...2',
    '222222222222222222222222',
  ],
]

export const at = (map: string[], x: number, y: number): string => map[y]?.[x] ?? '2'
export const solid = (cell: string) => cell !== '.' && cell !== 'S'
const put = (map: string[], x: number, y: number, ch: string): string[] =>
  map.map((row, ry) => (ry === y ? row.slice(0, x) + ch + row.slice(x + 1) : row))

// the player's box, not its centre, so you cannot clip a corner
export const blocked = (map: string[], x: number, y: number): boolean => {
  for (const dx of [-RADIUS, RADIUS]) for (const dy of [-RADIUS, RADIUS]) {
    if (solid(at(map, Math.floor(x + dx), Math.floor(y + dy)))) return true
  }
  return false
}

// DDA: step to the next grid line on whichever axis is nearer until a wall. The distance is the
// Euclidean ray length; a view multiplies it by cos(angle - dir) to undo the fisheye.
export function cast(map: string[], x: number, y: number, angle: number, max = 40): Ray {
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  const ddx = dx === 0 ? Infinity : Math.abs(1 / dx)
  const ddy = dy === 0 ? Infinity : Math.abs(1 / dy)
  let mx = Math.floor(x)
  let my = Math.floor(y)
  let sdx = dx < 0 ? (x - mx) * ddx : (mx + 1 - x) * ddx
  let sdy = dy < 0 ? (y - my) * ddy : (my + 1 - y) * ddy
  let side: 0 | 1 = 0
  for (let steps = 0; steps < 256; steps++) {
    if (sdx < sdy) { sdx += ddx; mx += dx < 0 ? -1 : 1; side = 0 }
    else { sdy += ddy; my += dy < 0 ? -1 : 1; side = 1 }
    const dist = side === 0 ? sdx - ddx : sdy - ddy
    if (dist > max) break
    const cell = at(map, mx, my)
    if (solid(cell)) return { dist: Math.max(1e-4, dist), side, kind: cell }
  }
  return { dist: max, side: 0, kind: '2' }
}

// is b in plain sight from a, and how far
const sight = (map: string[], ax: number, ay: number, bx: number, by: number) => {
  const d = Math.hypot(bx - ax, by - ay)
  return { d, clear: cast(map, ax, ay, Math.atan2(by - ay, bx - ax), d + 1).dist >= d }
}

// to -PI..PI, so a difference of angles reads as left or right
export const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

type Level = { map: string[]; exits: Pt[]; px: number; py: number; enemies: Enemy[]; items: Item[] }

// the text of a floor, with everything that stands on it lifted out and the cell left as floor
export function parseLevel(src: string[]): Level {
  const enemies: Enemy[] = []
  const items: Item[] = []
  const exits: Pt[] = []
  let px = 1.5
  let py = 1.5
  const map = src.map((row, y) =>
    [...row].map((cell, x) => {
      if (cell === 'X') { exits.push([x, y]); return cell }
      if (cell === 'S') { px = x + 0.5; py = y + 0.5; return '.' }
      const monster = SPAWNS[cell]
      if (monster) { enemies.push({ kind: monster, x: x + 0.5, y: y + 0.5, hp: MONSTER[monster].hp, hurt: 0 }); return '.' }
      const item = PICKUP[cell]
      if (item) { items.push({ kind: item, x: x + 0.5, y: y + 0.5 }); return '.' }
      return cell
    }).join(''),
  )
  return { map, exits, px, py, enemies, items }
}

const levelAt = (level: number) => LEVELS[(level - 1) % LEVELS.length]

// Which way to look when a floor starts. Pointing straight at the door is not enough — on most
// floors a wall stands between you and it, so the bearing lands on masonry. Walk the route to the
// door instead and look as far along it as you can actually see: the way out, from the first frame.
function route(map: string[], from: Pt, to: Pt): Pt[] {
  const came = new Map<string, Pt | null>([[`${from[0]},${from[1]}`, null]])
  const queue: Pt[] = [from]
  while (queue.length) {
    const cur = queue.shift()!
    if (cur[0] === to[0] && cur[1] === to[1]) {
      const path: Pt[] = []
      for (let at: Pt | null = cur; at; at = came.get(`${at[0]},${at[1]}`) ?? null) path.unshift(at)
      return path
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const next: Pt = [cur[0] + dx, cur[1] + dy]
      const cell = at(map, next[0], next[1])
      // a locked door is on the way to itself, so it counts as walkable here
      if (came.has(`${next[0]},${next[1]}`) || (solid(cell) && cell !== 'D')) continue
      came.set(`${next[0]},${next[1]}`, cur)
      queue.push(next)
    }
  }
  return []
}

export function facing(map: string[], exits: Pt[], px: number, py: number): number {
  const doors: Pt[] = []
  for (let y = 0; y < map.length; y++) for (let x = 0; x < map[y].length; x++) {
    if (at(map, x, y) === 'D') doors.push([x, y])
  }
  const marks = doors.length ? doors : exits
  if (!marks.length) return 0
  const near = (m: Pt) => Math.hypot(m[0] + 0.5 - px, m[1] + 0.5 - py)
  const target = marks.reduce((best, m) => (near(m) < near(best) ? m : best))
  const path = route(map, [Math.floor(px), Math.floor(py)], target)
  const bearing = (m: Pt) => Math.atan2(m[1] + 0.5 - py, m[0] + 0.5 - px)
  if (!path.length) return bearing(target)

  // the furthest step of the route still in plain sight: a corridor mouth, a doorway, the door
  let look = bearing(target)
  for (const step of path) {
    const d = Math.hypot(step[0] + 0.5 - px, step[1] + 0.5 - py)
    if (d < 1) continue
    const angle = bearing(step)
    if (cast(map, px, py, angle, d + 1).dist < d) break
    look = angle
  }
  return look
}

export function newDoom(level = 1): DoomGame {
  const l = parseLevel(levelAt(level))
  return {
    level, map: l.map, exits: l.exits, px: l.px, py: l.py, dir: facing(l.map, l.exits, l.px, l.py),
    enemies: l.enemies, balls: [], items: l.items,
    health: 100, bullets: 50, shells: 0,
    weapon: 'pistol', owned: ['pistol'], key: false,
    cool: 0, flash: 0, pain: 0, kills: 0, ticks: 0, over: false,
    said: '', saidAt: 0,
  }
}

// the exit switch keeps what you are carrying and hands you the next floor
function nextLevel(g: DoomGame): DoomGame {
  const l = parseLevel(levelAt(g.level + 1))
  return {
    ...g,
    level: g.level + 1, map: l.map, exits: l.exits, px: l.px, py: l.py, dir: facing(l.map, l.exits, l.px, l.py),
    enemies: l.enemies, balls: [], items: l.items,
    key: false, cool: 0, flash: 0, pain: 0,
    bullets: g.bullets + 10,
    said: `floor ${g.level + 1}`,
    saidAt: g.ticks,
  }
}

// what just happened, stamped with the frame it happened on so the view can fade it. Stamping at
// the source matters: picking up a second health box says 'health' again, and a message compared
// against the last one would take the repeat for no news at all.
const say = (g: DoomGame, said: string): DoomGame => ({ ...g, said, saidAt: g.ticks })

export const turn = (g: DoomGame, radians: number): DoomGame =>
  g.over ? g : { ...g, dir: wrap(g.dir + radians) }

// swapping weapons takes a moment, so it is not a free dodge out of an empty gun
export const select = (g: DoomGame, weapon: Weapon): DoomGame =>
  g.over || !g.owned.includes(weapon) ? g : say({ ...g, weapon, cool: Math.max(g.cool, 4) }, weapon)

// each axis on its own, so a wall you walk into slides you along it instead of stopping you dead
export function move(g: DoomGame, forward: number, strafe = 0): DoomGame {
  if (g.over) return g
  const dx = Math.cos(g.dir) * forward - Math.sin(g.dir) * strafe
  const dy = Math.sin(g.dir) * forward + Math.cos(g.dir) * strafe
  const px = blocked(g.map, g.px + dx, g.py) ? g.px : g.px + dx
  const py = blocked(g.map, g.px, g.py + dy) ? g.py : g.py + dy
  if (px !== g.px || py !== g.py) return { ...g, px, py }

  // Nothing moved: the corner of your shoulder is on the corner of a wall, which is the one place
  // walking forward does nothing at all and feels broken. Step a little to whichever side opens the
  // way — and only if it does, so walking into a flat wall still just stops.
  const len = Math.hypot(dx, dy)
  if (!len) return g
  for (const side of [1, -1]) {
    const ox = (-dy / len) * RADIUS * side
    const oy = (dx / len) * RADIUS * side
    if (blocked(g.map, g.px + ox, g.py + oy)) continue
    if (blocked(g.map, g.px + ox + dx, g.py + oy + dy)) continue
    return { ...g, px: g.px + ox, py: g.py + oy }
  }
  return g
}

// one pellet: the nearest monster inside its cone and in front of the wall takes the damage
function pellet(g: DoomGame, enemies: Enemy[], angle: number, damage: number): { enemies: Enemy[]; killed: number } {
  const wall = cast(g.map, g.px, g.py, angle).dist
  let best: { i: number; d: number } | undefined
  enemies.forEach((e, i) => {
    const d = Math.hypot(e.x - g.px, e.y - g.py)
    if (d > wall) return
    // a monster is about half a cell wide, so it covers less of the view the further away it is
    if (Math.abs(wrap(Math.atan2(e.y - g.py, e.x - g.px) - angle)) > Math.atan2(0.45, d)) return
    if (!best || d < best.d) best = { i, d }
  })
  if (!best) return { enemies, killed: 0 }
  const hit = enemies.map((e, i) => (i === best?.i ? { ...e, hp: e.hp - damage, hurt: 2 } : e))
  const alive = hit.filter(e => e.hp > 0)
  return { enemies: alive, killed: hit.length - alive.length }
}

// what to reach for when the gun in your hands clicks empty: the heaviest thing with ammo in it,
// derived from the table so a weapon added there is never quietly left out of the fallback
const FALLBACK = (Object.keys(WEAPON) as Weapon[])
  .sort((a, b) => WEAPON[b].damage * WEAPON[b].pellets - WEAPON[a].damage * WEAPON[a].pellets)

export function fire(g: DoomGame): DoomGame {
  if (g.over || g.cool > 0) return g
  const spec = WEAPON[g.weapon]
  if (g[spec.ammo] <= 0) {
    // an empty gun switches itself rather than doing nothing while something walks into you
    const next = FALLBACK.find(w => w !== g.weapon && g.owned.includes(w) && g[WEAPON[w].ammo] > 0)
    return next
      ? say(select(g, next), `out of ${spec.ammo} · ${next}`)
      : say({ ...g, cool: 8 }, `out of ${spec.ammo}`)
  }
  let enemies = g.enemies
  let kills = g.kills
  for (let p = 0; p < spec.pellets; p++) {
    // the pellets of a shell spread either side of where you aimed
    const angle = g.dir + (spec.pellets === 1 ? 0 : (p - (spec.pellets - 1) / 2) * (spec.spread ?? 0))
    const shot = pellet(g, enemies, angle, spec.damage)
    enemies = shot.enemies
    kills += shot.killed
  }
  return { ...g, enemies, kills, cool: spec.cool, flash: 4, [spec.ammo]: g[spec.ammo] - 1 }
}

const take = (g: DoomGame, item: Item): DoomGame => {
  switch (item.kind) {
    case 'health': return say({ ...g, health: Math.min(100, g.health + 25) }, 'health')
    case 'shells': return say({ ...g, shells: g.shells + 8 }, 'shells')
    case 'bullets': return say({ ...g, bullets: g.bullets + 20 }, 'bullets')
    case 'key': return say({ ...g, key: true }, 'red key')
    case 'shotgun':
    case 'chaingun': return say({
      ...g,
      owned: g.owned.includes(item.kind) ? g.owned : [...g.owned, item.kind],
      weapon: item.kind,
      shells: item.kind === 'shotgun' ? g.shells + 8 : g.shells,
      bullets: item.kind === 'chaingun' ? g.bullets + 20 : g.bullets,
    }, item.kind)
  }
}

// a locked door in reach opens once, and stays open, when you carry the key
function openDoors(g: DoomGame): DoomGame {
  if (!g.key) return g
  for (let y = Math.floor(g.py) - 1; y <= Math.floor(g.py) + 1; y++) {
    for (let x = Math.floor(g.px) - 1; x <= Math.floor(g.px) + 1; x++) {
      if (at(g.map, x, y) === 'D') return say({ ...g, map: put(g.map, x, y, '.') }, 'the door opens')
    }
  }
  return g
}

export function tick(g: DoomGame, rand = Math.random): DoomGame {
  if (g.over) return g
  const ticks = g.ticks + 1
  let health = g.health
  const balls: Ball[] = []

  const enemies = g.enemies.map(e => {
    const spec = MONSTER[e.kind]
    const { d, clear } = sight(g.map, e.x, e.y, g.px, g.py)
    const hurt = Math.max(0, e.hurt - 1)
    const bite = e.bite ?? BITE_EVERY
    if (!clear || d > 16) return { ...e, hurt, bite: BITE_EVERY }
    // its own cooldown, not a shared frame phase: on a global phase three monsters reaching you
    // together all land on the same frame, and one arriving just before it comes round bites at
    // once while another waits most of a second. The counter only runs while it is on you, so
    // closing in always costs it the same wind-up.
    if (d < REACH) {
      if (bite > 0) return { ...e, hurt, bite: bite - 1 }
      health -= spec.melee
      return { ...e, hurt, bite: BITE_EVERY }
    }
    if (e.kind === 'imp' && d > 2.5 && rand() < THROW_CHANCE) {
      const a = Math.atan2(g.py - e.y, g.px - e.x)
      balls.push({ x: e.x, y: e.y, dx: Math.cos(a) * BALL_SPEED, dy: Math.sin(a) * BALL_SPEED })
    }
    if (spec.reach && d < spec.reach && rand() < SHOOT_CHANCE) health -= spec.shot
    // toward you, each axis on its own so a monster rounds a corner instead of hugging it
    const sx = e.x + Math.sign(g.px - e.x) * spec.speed
    const sy = e.y + Math.sign(g.py - e.y) * spec.speed
    return {
      ...e,
      hurt,
      bite: BITE_EVERY,
      x: solid(at(g.map, Math.floor(sx), Math.floor(e.y))) ? e.x : sx,
      y: solid(at(g.map, Math.floor(e.x), Math.floor(sy))) ? e.y : sy,
    }
  })

  for (const b of g.balls) {
    const x = b.x + b.dx
    const y = b.y + b.dy
    if (solid(at(g.map, Math.floor(x), Math.floor(y)))) continue
    if (Math.hypot(x - g.px, y - g.py) < 0.5) { health -= BALL_HIT; continue }
    balls.push({ ...b, x, y })
  }

  let next: DoomGame = {
    ...g, ticks, enemies, balls, health,
    pain: health < g.health ? 6 : Math.max(0, g.pain - 1),
    flash: Math.max(0, g.flash - 1),
    cool: Math.max(0, g.cool - 1),
    over: health <= 0,
  }
  if (next.over) return say({ ...next, health: 0 }, 'you died')

  // what you walk over you pick up, what you walk into opens, and the exit switch ends the floor
  for (const item of next.items) {
    if (Math.hypot(item.x - next.px, item.y - next.py) > GRAB) continue
    next = { ...take(next, item), items: next.items.filter(i => i !== item) }
  }
  next = openDoors(next)
  if (next.exits.some(([x, y]) => Math.hypot(x + 0.5 - next.px, y + 0.5 - next.py) < 1.2)) next = nextLevel(next)
  return next
}
