// Tool Defense's rules, pure and testable. Enemies walk a fixed path across a grid toward your base;
// you place and upgrade towers on the cells beside it. Every enemy is one of Claude's real tool calls,
// shaped by the tool: Bash runs fast, an Edit or Write is slow and tough, a web call flies straight
// over the towers, an Agent is a boss. Between Claude's calls a quiet trickle keeps the game alive.

export type Pt = readonly [x: number, y: number]
export type Kind = 'runner' | 'tank' | 'flyer' | 'boss' | 'scout'
export type Enemy = {
  id: number
  kind: Kind
  /** the tool that spawned it, for the status line */
  tool: string
  /** index along PATH (walkers) or x position (flyers), in cells; fractional between cells */
  at: number
  hp: number
  maxHp: number
  speed: number
  reward: number
}
export type Tower = { pos: Pt; level: 1 | 2 | 3; cooldown: number }
export type Shot = { from: Pt; to: Pt; ttl: number }
export type DefenseGame = {
  readonly w: number
  readonly h: number
  towers: Tower[]
  enemies: Enemy[]
  shots: Shot[]
  gold: number
  lives: number
  score: number
  kills: number
  /** id of the next enemy */
  nextId: number
  /** ticks since the last spawn of any kind, for the idle trickle */
  quiet: number
  over: boolean
  tick: number
}

export const W = 26
export const H = 10
export const TOWER_COST = 25
export const UPGRADE_COST = [0, 30, 50, 0] as const
const RANGE = [0, 2.5, 3.2, 4] as const
const DAMAGE = [0, 1, 2, 4] as const
const FIRE_EVERY = [0, 5, 4, 3] as const
const TRICKLE_EVERY = 45

/** The road, cell by cell: a serpentine from the left edge to the base on the right edge. */
export const PATH: readonly Pt[] = (() => {
  const out: Pt[] = []
  const rows = [1, 4, 7]
  for (let x = 0; x < W - 1; x++) out.push([x, rows[0]!])
  for (let y = rows[0]! + 1; y <= rows[1]!; y++) out.push([W - 2, y])
  for (let x = W - 3; x >= 1; x--) out.push([x, rows[1]!])
  for (let y = rows[1]! + 1; y <= rows[2]!; y++) out.push([1, y])
  for (let x = 2; x < W; x++) out.push([x, rows[2]!])
  return out
})()
const PATH_KEYS = new Set(PATH.map(([x, y]) => y * W + x))
export const BASE: Pt = PATH[PATH.length - 1]!
export const FLY_ROW = 7

export const KINDS: Record<Kind, { hp: number; speed: number; reward: number; glyph: string; color: string }> = {
  scout: { hp: 2, speed: 0.35, reward: 3, glyph: '▪▪', color: 'white' },
  runner: { hp: 3, speed: 0.6, reward: 5, glyph: '▶▶', color: 'greenBright' },
  tank: { hp: 9, speed: 0.22, reward: 9, glyph: '██', color: 'magenta' },
  flyer: { hp: 4, speed: 0.5, reward: 7, glyph: '◢◣', color: 'cyan' },
  boss: { hp: 30, speed: 0.18, reward: 40, glyph: '▓▓', color: 'red' },
}

/** Which enemy a tool call becomes. */
export function kindOf(tool: string): Kind {
  if (tool === 'Bash' || tool === 'PowerShell') return 'runner'
  if (tool === 'Edit' || tool === 'Write' || tool === 'NotebookEdit') return 'tank'
  if (tool === 'WebFetch' || tool === 'WebSearch' || tool.startsWith('mcp__')) return 'flyer'
  if (tool === 'Agent' || tool === 'Workflow') return 'boss'
  return 'scout'
}

export function newDefense(): DefenseGame {
  return { w: W, h: H, towers: [], enemies: [], shots: [], gold: 60, lives: 10, score: 0, kills: 0, nextId: 1, quiet: 0, over: false, tick: 0 }
}

export const isPath = (p: Pt) => PATH_KEYS.has(p[1] * W + p[0])
export const towerAt = (g: DefenseGame, p: Pt) => g.towers.find(t => t.pos[0] === p[0] && t.pos[1] === p[1])

/** Where an enemy is drawn. */
export function enemyPos(e: Enemy): Pt {
  if (e.kind === 'flyer') return [Math.min(W - 1, Math.floor(e.at)), FLY_ROW]
  const i = Math.min(PATH.length - 1, Math.floor(e.at))
  return PATH[i]!
}

export function spawn(g: DefenseGame, tool: string, kind = kindOf(tool)): DefenseGame {
  if (g.over) return g
  const k = KINDS[kind]
  // later waves are tougher: +10% hp per 10 kills
  const hp = Math.ceil(k.hp * (1 + g.kills / 100))
  const enemy: Enemy = { id: g.nextId, kind, tool, at: 0, hp, maxHp: hp, speed: k.speed, reward: k.reward }
  return { ...g, enemies: [...g.enemies, enemy], nextId: g.nextId + 1, quiet: 0 }
}

/** Click on a free cell: build (level 1). Click on a tower: upgrade. Returns the game and what happened. */
export function build(g: DefenseGame, p: Pt): { game: DefenseGame; note?: string } {
  if (g.over) return { game: g }
  if (p[0] < 0 || p[1] < 0 || p[0] >= W || p[1] >= H) return { game: g }
  const existing = towerAt(g, p)
  if (existing) {
    if (existing.level >= 3) return { game: g, note: 'that tower is maxed' }
    const cost = UPGRADE_COST[existing.level]!
    if (g.gold < cost) return { game: g, note: `upgrade costs ${cost} gold` }
    const towers = g.towers.map(t => (t === existing ? { ...t, level: (t.level + 1) as 2 | 3 } : t))
    return { game: { ...g, towers, gold: g.gold - cost }, note: `upgraded to level ${existing.level + 1}` }
  }
  if (isPath(p)) return { game: g, note: 'not on the road' }
  if (g.gold < TOWER_COST) return { game: g, note: `a tower costs ${TOWER_COST} gold` }
  return { game: { ...g, towers: [...g.towers, { pos: p, level: 1, cooldown: 0 }], gold: g.gold - TOWER_COST }, note: 'tower built' }
}

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], (a[1] - b[1]) * 1.0)

/** One step of the clock (about 8 a second). */
export function step(g: DefenseGame, rnd: () => number = Math.random): DefenseGame {
  if (g.over) return g
  let out: DefenseGame = { ...g, tick: g.tick + 1, quiet: g.quiet + 1 }

  // the idle trickle: a scout now and then, so there is always something to shoot
  if (out.quiet >= TRICKLE_EVERY && rnd() < 0.5) out = spawn(out, 'idle', 'scout')

  // enemies advance; one that reaches the base costs a life
  let lives = out.lives
  const enemies: Enemy[] = []
  for (const e of out.enemies) {
    const at = e.at + e.speed
    const end = e.kind === 'flyer' ? W - 1 : PATH.length - 1
    if (at >= end) lives--
    else enemies.push({ ...e, at })
  }
  out = { ...out, enemies, lives }
  if (lives <= 0) return { ...out, lives: 0, over: true }

  // towers fire at the nearest enemy in range
  const shots: Shot[] = out.shots.map(s => ({ ...s, ttl: s.ttl - 1 })).filter(s => s.ttl > 0)
  let gold = out.gold
  let score = out.score
  let kills = out.kills
  let alive = out.enemies
  const towers = out.towers.map(t => {
    if (t.cooldown > 0) return { ...t, cooldown: t.cooldown - 1 }
    const range = RANGE[t.level]!
    let target: Enemy | undefined
    let bestD = Infinity
    for (const e of alive) {
      const d = dist(t.pos, enemyPos(e))
      if (d <= range && d < bestD) { bestD = d; target = e }
    }
    if (!target) return t
    const hp = target.hp - DAMAGE[t.level]!
    shots.push({ from: t.pos, to: enemyPos(target), ttl: 2 })
    if (hp <= 0) {
      alive = alive.filter(e => e.id !== target!.id)
      gold += target.reward
      score += target.reward * 10
      kills++
    } else {
      alive = alive.map(e => (e.id === target!.id ? { ...e, hp } : e))
    }
    return { ...t, cooldown: FIRE_EVERY[t.level]! }
  })
  return { ...out, towers, enemies: alive, shots, gold, score, kills }
}
