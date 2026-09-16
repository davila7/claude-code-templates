import { expect, test } from 'bun:test'
import {
  at, blocked, cast, fire, LEVELS, move, newDoom, parseLevel, select, solid, STEP, SWING, tick,
  turn, wrap, type DoomGame,
} from '../hooks/games/doom.ts'

const ROOM = [
  '2222222',
  '2.....2',
  '2.....2',
  '2..S..2',
  '2.....2',
  '2.....2',
  '2222222',
]
const HALL = ['22222222222', '2.S.......2', '22222222222']
const half = () => 0.5
// a game standing in a test floor instead of E1M1
const on = (src: string[]): DoomGame => ({ ...newDoom(), ...parseLevel(src), dir: 0 })
const room = () => on(ROOM)
const imp = (x: number, y = 3.5) => ({ kind: 'imp' as const, x, y, hp: 60, hurt: 0 })

test('doom: casting', () => {
  const g = room()
  expect([g.px, g.py, g.dir]).toEqual([3.5, 3.5, 0])
  // the walls of the room, straight down each axis
  expect(cast(ROOM, 3.5, 3.5, 0)).toEqual({ dist: 2.5, side: 0, kind: '2' })
  expect(cast(ROOM, 3.5, 3.5, Math.PI)).toEqual({ dist: 2.5, side: 0, kind: '2' })
  expect(cast(ROOM, 3.5, 3.5, -Math.PI / 2)).toEqual({ dist: 2.5, side: 1, kind: '2' })
  // a corner: the ray is longer than either axis, and the view's cosine brings it back
  const corner = cast(ROOM, 3.5, 3.5, Math.PI / 4)
  expect(corner.dist).toBeCloseTo(2.5 * Math.SQRT2)
  expect(corner.dist * Math.cos(Math.PI / 4 - 0)).toBeCloseTo(2.5)
  // the wall's own kind comes back, so a view can colour it: doors and the exit are walls too
  expect(cast(['1.2'], 1.5, 0.5, 0).kind).toBe('2')
  expect(cast(['D.X'], 1.5, 0.5, 0).kind).toBe('X')
  expect(cast(['D.X'], 1.5, 0.5, Math.PI).kind).toBe('D')
  // off the map is wall, not an endless ray
  expect(cast(['...'], 1.5, 0.5, -Math.PI / 2).dist).toBeCloseTo(0.5)
  expect(wrap(Math.PI * 3)).toBeCloseTo(Math.PI)
})

test('doom: moving', () => {
  const g = room()
  // the player has width: the box touches the wall before its centre does
  expect(blocked(ROOM, 5.5, 3.5)).toBe(false)
  expect(blocked(ROOM, 5.9, 3.5)).toBe(true)
  // walking into a wall keeps you off it, and the free axis still moves: you slide along it
  const into = move({ ...g, px: 5.5 }, 1, 1)
  expect(into.px).toBe(5.5)
  expect(into.py).toBeCloseTo(4.5)
  // a step in the open is a step
  expect(move(g, 0.5).px).toBeCloseTo(4)
  // strafe is a right angle to the way you look, and turning changes what forward means
  expect(move(g, 0, 0.5).py).toBeCloseTo(4)
  expect(move(turn(g, Math.PI / 2), 0.5).py).toBeCloseTo(4)
  // nothing moves once you are dead
  const dead: DoomGame = { ...g, over: true }
  expect(move(dead, 1)).toBe(dead)
  expect(turn(dead, 1)).toBe(dead)
})

test('doom: the weapons', () => {
  const g: DoomGame = { ...room(), enemies: [imp(5.4)] }
  // the pistol: one bullet, one hole, and a wait before the next one
  const shot = fire(g)
  expect(shot.bullets).toBe(49)
  expect(shot.enemies[0]).toMatchObject({ hp: 42, hurt: 2 })
  expect(shot.flash).toBe(4)
  expect(fire(shot)).toBe(shot)
  // raising a new gun takes a moment, and then the shotgun throws three pellets, which all catch
  // an imp this close: dead in one
  const raised = select({ ...g, owned: ['pistol', 'shotgun'], shells: 8 }, 'shotgun')
  expect(raised).toMatchObject({ weapon: 'shotgun', cool: 4 })
  expect(fire(raised)).toBe(raised)
  const boom = fire({ ...raised, cool: 0 })
  expect(boom.enemies).toEqual([])
  expect(boom.kills).toBe(1)
  expect(boom.shells).toBe(7)
  // a weapon you have not picked up is not a weapon you can hold
  expect(select(g, 'chaingun')).toBe(g)
  // an empty gun says so instead of firing
  const empty = fire({ ...g, bullets: 0 })
  expect(empty).toMatchObject({ said: 'out of bullets', bullets: 0 })
  expect(empty.enemies[0].hp).toBe(60)
  // an imp out of the crosshair, and one behind a wall, are both missed
  expect(fire({ ...g, dir: 1 }).enemies[0].hp).toBe(60)
  expect(fire({ ...g, enemies: [imp(8.5)] }).enemies[0].hp).toBe(60)
})

test('doom: the monsters', () => {
  const g = room()
  const near = (e: DoomGame['enemies'][number]): DoomGame => ({ ...g, ticks: 19, enemies: [e] })
  // reaching you costs a wind-up, and then it bites once a second, on its own clock rather than a
  // frame phase shared with every other monster
  expect(tick(near(imp(3.9)), half).health).toBe(100)
  expect(tick(near({ ...imp(3.9), bite: 0 }), half).health).toBe(93)
  expect(tick(near({ kind: 'demon', x: 3.9, y: 3.5, hp: 110, hurt: 0, bite: 0 }), half).health).toBe(88)
  // two of them on you do not land together just because the frame counter came round
  const pair = tick({ ...g, ticks: 19, enemies: [{ ...imp(3.9), bite: 0 }, { ...imp(3.1), bite: 9 }] }, half)
  expect(pair.health).toBe(93)
  expect(pair.enemies.map(e => e.bite)).toEqual([20, 8])
  // the last of the health ends the round, at zero, not below it
  const dying = tick({ ...near({ ...imp(3.9), bite: 0 }), health: 5 }, half)
  expect(dying).toMatchObject({ over: true, health: 0, said: 'you died' })
  expect(tick(dying, half)).toBe(dying)
  // out of contact they come at you, the demon fastest
  expect(tick(near(imp(5.5)), half).enemies[0].x).toBeLessThan(5.5)
  const charge = tick(near({ kind: 'demon', x: 5.5, y: 3.5, hp: 110, hurt: 0 }), half)
  expect(5.5 - charge.enemies[0].x).toBeGreaterThan(5.5 - tick(near(imp(5.5)), half).enemies[0].x)
  // a zombie shoots from where it stands
  const shot = tick({ ...on(HALL), enemies: [{ kind: 'zombie', x: 6.5, y: 1.5, hp: 30, hurt: 0 }] }, () => 0.001)
  expect(shot.health).toBe(95)
  // an imp throws fireballs, which cost health where they land and die against a wall
  const thrown = tick({ ...on(HALL), enemies: [imp(6.5, 1.5)] }, () => 0.001)
  expect(thrown.balls).toHaveLength(1)
  expect(thrown.balls[0].dx).toBeLessThan(0)
  expect(tick({ ...g, balls: [{ x: 3.7, y: 3.5, dx: -0.22, dy: 0 }] }, half).health).toBe(91)
  expect(tick({ ...g, balls: [{ x: 5.9, y: 3.5, dx: 0.22, dy: 0 }] }, half).balls).toEqual([])
})

test('doom: the floor plan', () => {
  // a floor is text: the spawn, the monsters and the pickups are lifted off it, the walls stay
  const l = parseLevel(['2222222', '2S.i.+2', '2..k.X2', '2222222'])
  expect([l.px, l.py]).toEqual([1.5, 1.5])
  expect(l.enemies).toEqual([{ kind: 'imp', x: 3.5, y: 1.5, hp: 60, hurt: 0 }])
  expect(l.items).toEqual([{ kind: 'health', x: 5.5, y: 1.5 }, { kind: 'key', x: 3.5, y: 2.5 }])
  expect(l.exits).toEqual([[5, 2]])
  // what stood on the floor leaves floor behind; the exit switch stays solid
  expect(l.map[1]).toBe('2.....2')
  expect(solid(at(l.map, 5, 2))).toBe(true)

  // what you walk over you pick up
  const picked = tick({ ...on(ROOM), health: 50, items: [{ kind: 'health', x: 3.9, y: 3.5 }] }, half)
  expect(picked).toMatchObject({ health: 75, said: 'health' })
  expect(picked.items).toEqual([])
  // a gun you pick up is the gun you are holding, with shells for it
  const armed = tick({ ...on(ROOM), items: [{ kind: 'shotgun', x: 3.9, y: 3.5 }] }, half)
  expect(armed).toMatchObject({ weapon: 'shotgun', owned: ['pistol', 'shotgun'], shells: 8 })
  // a door opens only with the key, and stays open
  const shut = { ...on(['22222', '2S.D2', '22222']), px: 2.5 }
  expect(tick(shut, half).map[1]).toBe('2..D2')
  const opened = tick({ ...shut, key: true }, half)
  expect(opened.map[1]).toBe('2...2')
  expect(opened.said).toBe('the door opens')
})

test('doom: the exit', () => {
  // the switch hands you the next floor, keeping what you carry and what you have killed
  const g: DoomGame = { ...on(['22222', '2S.X2', '22222']), px: 2.4, kills: 4, owned: ['pistol', 'chaingun'], weapon: 'chaingun', key: true }
  const out = tick(g, half)
  expect(out).toMatchObject({ level: 2, kills: 4, weapon: 'chaingun', bullets: 60, key: false, said: 'floor 2' })
  expect(out.map).not.toEqual(g.map)
  expect(out.enemies.length).toBeGreaterThan(0)
  // the floors come round again, so there is always a next one
  expect(newDoom(LEVELS.length + 1).map).toEqual(newDoom(1).map)
  // a message is stamped with the tick it was said on, so the view can let it fade
  expect(out.saidAt).toBe(out.ticks)
})

test('doom: every floor is playable', () => {
  // flood fill from the spawn, first with the doors shut, then with them open
  const reach = (map: string[], from: [number, number], doorsOpen: boolean) => {
    const seen = new Set<string>()
    const queue = [from]
    while (queue.length) {
      const [x, y] = queue.pop()!
      const key = `${x},${y}`
      const cell = at(map, x, y)
      if (seen.has(key) || (solid(cell) && !(doorsOpen && cell === 'D'))) continue
      seen.add(key)
      queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
    }
    return seen
  }
  for (const src of LEVELS) {
    const l = parseLevel(src)
    expect(new Set(src.map(r => r.length))).toEqual(new Set([24]))
    expect(src).toHaveLength(20)
    const shut = reach(l.map, [Math.floor(l.px), Math.floor(l.py)], false)
    const open = reach(l.map, [Math.floor(l.px), Math.floor(l.py)], true)
    const here = (seen: Set<string>, x: number, y: number) => seen.has(`${Math.floor(x)},${Math.floor(y)}`)
    // a floor has a way out, and every monster and pickup on it can be reached
    expect(l.exits.length).toBeGreaterThan(0)
    for (const [x, y] of l.exits) {
      expect([[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].some(([ax, ay]) => open.has(`${ax},${ay}`))).toBe(true)
    }
    for (const e of l.enemies) expect(here(open, e.x, e.y)).toBe(true)
    for (const i of l.items) expect(here(open, i.x, i.y)).toBe(true)
    // a locked door needs a key you can reach without going through it
    const keys = l.items.filter(i => i.kind === 'key')
    if (src.join('').includes('D')) expect(keys.length).toBeGreaterThan(0)
    for (const k of keys) expect(here(shut, k.x, k.y)).toBe(true)
  }
})

test('doom: the node budget', async () => {
  // the engine counts the spans in a frame, so a row folds neighbours together until it fits
  const { runs } = await import('../hooks/boards/common.tsx')
  const stripes = (x: number) => ['▀', `c${x % 4}`, undefined] as const
  expect(runs(8, 0, () => ['▀', 'red', 'blue'])).toEqual([['▀▀▀▀▀▀▀▀', 'red', 'blue']])
  expect(runs(8, 0, stripes)).toHaveLength(8)
  const folded = runs(8, 0, stripes, 3)
  expect(folded.length).toBeLessThanOrEqual(3)
  // every cell is still drawn, in its place, with the left colour of the pair it joined
  expect(folded.map(r => r[0]).join('')).toBe('▀'.repeat(8))
  // folding halves the row each pass, so a cap of 3 lands on 2
  expect(folded).toEqual([['▀▀▀▀', 'c0', undefined], ['▀▀▀▀', 'c0', undefined]])
  expect(runs(8, 0, stripes, 0)).toHaveLength(1)
})

// How a colour reaches an eye missing one kind of cone (Machado et al. 2009, full severity). The
// matrices are defined over linear-light RGB, so the sRGB bytes are linearised going in and
// re-encoded coming out — applied straight to sRGB the numbers do not mean what they claim.
const BLIND = {
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
}
const linear = (c: number) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4)
const encode = (l: number) =>
  Math.max(0, Math.min(255, (l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055) * 255))
const seen = (rgb: readonly number[], m: number[][]) => {
  const lit = rgb.map(linear)
  return m.map(row => encode(Math.max(0, row[0] * lit[0] + row[1] * lit[1] + row[2] * lit[2])))
}
// 0 is the same colour, 1 is the whole of the cube away. The board quantises every colour it draws,
// so the comparison is of what reaches the screen, not of the palette it came from.
const apart = (a: readonly number[], b: readonly number[], step: number) => {
  const [qa, qb] = [a, b].map(c => c.map(v => Math.max(0, Math.min(255, Math.round(v / step) * step))))
  return Math.min(...Object.values(BLIND).map(m => {
    const [x, y] = [seen(qa, m), seen(qb, m)]
    return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) / 255
  }))
}
const TELLS_APART = 0.28

test('doom: colour-blind mode', async () => {
  const { CRITICAL, SHADES, safeRgb, SPRITE, WALL } = await import('../hooks/boards/doom.tsx')
  const normal = (name: string) => (name.startsWith('wall:') ? WALL[name.slice(5)] : SPRITE[name as never].rgb)
  const gap = (f: (n: string) => readonly number[]) => ([a, b]: [string, string]) => apart(f(a), f(b), SHADES)
  // every pair that costs something to mix up stays apart for all three kinds of colour blindness
  for (const pair of CRITICAL) {
    expect(`${pair.join('/')} ${gap(safeRgb)(pair).toFixed(2)}`)
      .toBe(`${pair.join('/')} ${Math.max(TELLS_APART, gap(safeRgb)(pair)).toFixed(2)}`)
  }
  // and the mode earns its keep: the normal palette loses several of those pairs
  const lost = CRITICAL.filter(pair => gap(normal)(pair) < TELLS_APART)
  // the README says four: pin it, or the number goes stale the first time a colour moves
  expect(lost.length).toBe(4)
  for (const pair of lost) expect(gap(safeRgb)(pair)).toBeGreaterThanOrEqual(TELLS_APART)
  // the red door against the green exit is the pair the mode exists for
  expect(gap(normal)(['wall:D', 'wall:X'])).toBeLessThan(gap(safeRgb)(['wall:D', 'wall:X']))
})

test('doom: colour-blind mode marks the door and the exit with a pattern', async () => {
  ;(globalThis as any).h = (tag: string, props: unknown, ...kids: unknown[]) =>
    ({ tag, props: props ?? {}, kids: kids.flat(Infinity).filter(k => k !== null && k !== undefined && k !== false) })
  const Doom = (await import('../hooks/boards/doom.tsx')).default
  // both a small band and a wide one: the run cap in grid() tightens as the view grows, and a
  // pattern fine enough to be folded away disappears exactly where it is needed most
  const at = (columns: number, rows: number) => ({
    columns, rows, elements: { Box: 'Box', Text: 'Text' }, state: undefined,
    setState(s: unknown) { (this as { state: unknown }).state = s },
    every: () => {}, onKey: () => {}, onPointer: () => {}, post: () => {},
  })
  let surface: any = at(42, 11)
  // one wall of the kind asked for, filling the view, and the colours it is drawn in
  const shades = (kind: 'D' | 'X', safe: boolean) => {
    Doom({ safe } as never, surface)
    const map = ['222222', `2..${kind}.2`, '222222']
    surface.state = { ...surface.state, playing: true, game: { ...newDoom(), map, exits: [], px: 1.5, py: 1.5, dir: 0, enemies: [], items: [], balls: [] } }
    const tree = Doom({ safe } as never, surface)
    const rows: string[][] = []
    const walk = (node: any) => {
      if (node.tag === 'Box') return node.kids.forEach(walk)
      if (node.tag === 'Text' && node.kids.every((k: any) => typeof k !== 'string')) {
        rows.push(node.kids.flatMap((run: any) => [...String(run.kids[0] ?? '')].map(() => run.props.color as string)))
      }
    }
    walk(tree)
    return rows
  }
  // how many shades the wall is drawn in, looking across the middle of it or down the middle
  const across = (rows: string[][]) => new Set(rows[Math.floor(rows.length / 2)]).size
  const down = (rows: string[][]) => new Set(rows.map(r => r[Math.floor(r.length / 2)])).size
  // in colour-blind mode the door gains bars across it and the exit switch bands down it, each on
  // its own axis: that is what tells the two apart once the colour is taken away
  expect(across(shades('D', true))).toBeGreaterThan(across(shades('D', false)))
  expect(down(shades('D', true))).toBe(down(shades('D', false)))
  expect(down(shades('X', true))).toBeGreaterThan(down(shades('X', false)))
  expect(across(shades('X', true))).toBe(across(shades('X', false)))

  // and again on a terminal four times as wide, where the cap folds hardest
  surface = at(200, 60)
  expect(across(shades('D', true))).toBeGreaterThan(across(shades('D', false)))
  expect(down(shades('X', true))).toBeGreaterThan(down(shades('X', false)))
})

test('doom: stops when Claude answers, and says so in the view', async () => {
  ;(globalThis as any).h = (tag: string, props: unknown, ...kids: unknown[]) =>
    ({ tag, props: props ?? {}, kids: kids.flat(Infinity).filter(k => k !== null && k !== undefined && k !== false) })
  const Doom = (await import('../hooks/boards/doom.tsx')).default
  let frame: (() => void) | undefined
  let press: ((e: { key: string }) => void) | undefined
  const surface: any = {
    columns: 60, rows: 12, elements: { Box: 'Box', Text: 'Text' }, state: undefined,
    setState(s: unknown) { this.state = s },
    every: (_ms: number, f: () => void) => { frame = f }, onKey: (f: never) => { press = f },
    onPointer: () => {}, post: () => {},
  }
  const lines = (tree: any, out: string[] = []): string[] => {
    if (tree.tag === 'Box') { tree.kids.forEach((k: any) => lines(k, out)); return out }
    if (tree.tag === 'Text') out.push(tree.kids.map((k: any) => (typeof k === 'string' ? k : String(k.kids[0] ?? ''))).join(''))
    return out
  }
  Doom({ best: 0, done: 0 } as never, surface)
  // before anything is touched the view says where the click has to land
  expect(lines(Doom({ best: 0, done: 0 } as never, surface)).join('\n')).toContain('CLICK HERE TO PLAY')

  press!({ key: 'w' })
  Doom({ best: 0, done: 0 } as never, surface)
  expect(surface.state.playing).toBe(true)

  // the module bumps done when the turn finishes: the game stops, and the frame clock stops with it
  Doom({ best: 0, done: 1 } as never, surface)
  expect(surface.state).toMatchObject({ playing: false, banner: true })
  const still = JSON.stringify(surface.state.game)
  frame!()
  expect(JSON.stringify(surface.state.game)).toBe(still)
  // and it says so across the view, not only in the status line underneath
  const drawn = lines(Doom({ best: 0, done: 1 } as never, surface))
  expect(drawn.join('\n')).toContain('Claude is done')
  expect(drawn[drawn.length - 1]).toContain('health 100')

  // a key gets you going again
  press!({ key: 'w' })
  expect(surface.state).toMatchObject({ playing: true, banner: false })
})

// A bot that plays a floor: fetch what it needs, take the key, open the door, shoot what stands in
// the crosshair, touch the exit switch. It is a poor player — it never strafes, never backs off, and
// walks the shortest path through open ground — so it is a floor and a difficulty yardstick, not a
// claim about what a person would do.
const walk = (level: number, seed0: number, immortal = false) => {
  // one key press every other frame: ten a second, the rate of someone spamming the keys rather
  // than holding one down. Holding is faster and easier, so this is the case that has to survive.
  const PRESS_EVERY = 2
  let seed = seed0
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
  const open = (g: DoomGame, x: number, y: number) => {
    const cell = at(g.map, x, y)
    return !solid(cell) || (cell === 'D' && g.key)
  }
  // breadth first over cells, so the walk follows the map rather than the crow
  const route = (g: DoomGame, to: [number, number]): [number, number][] => {
    const start: [number, number] = [Math.floor(g.px), Math.floor(g.py)]
    const came = new Map<string, [number, number] | null>([[`${start[0]},${start[1]}`, null]])
    const queue: [number, number][] = [start]
    while (queue.length) {
      const cur = queue.shift()!
      if (cur[0] === to[0] && cur[1] === to[1]) {
        const path: [number, number][] = []
        for (let node: [number, number] | null = cur; node; node = came.get(`${node[0]},${node[1]}`) ?? null) path.unshift(node)
        return path
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const next: [number, number] = [cur[0] + dx, cur[1] + dy]
        if (came.has(`${next[0]},${next[1]}`) || !open(g, next[0], next[1])) continue
        came.set(`${next[0]},${next[1]}`, cur)
        queue.push(next)
      }
    }
    return []
  }

  let g = newDoom(level)
  // a frame is 50 ms, so this is a little over six minutes of play before a run is called stuck
  let frames = 0
  while (g.level === level && !g.over && frames++ < 8000) {
    if (frames % PRESS_EVERY) {
      g = tick(g, rand)
      if (immortal) g = { ...g, health: 100, over: false }
      continue
    }
    const shot = g.enemies
      .map(e => ({ d: Math.hypot(e.x - g.px, e.y - g.py), a: wrap(Math.atan2(e.y - g.py, e.x - g.px) - g.dir) }))
      // in front of you, inside the same cone the game uses, and not behind a wall
      .filter(t => t.d < 8 && Math.abs(t.a) < Math.atan2(0.45, t.d) && cast(g.map, g.px, g.py, g.dir).dist > t.d)
    const loaded = g.owned.some(w => (w === 'shotgun' ? g.shells : g.bullets) > 0)
    if (shot.length && loaded) {
      g = fire(g)
    } else {
      const medkit = g.health < 55 ? g.items.find(i => i.kind === 'health') : undefined
      const ammo = g.bullets + g.shells < 6 ? g.items.find(i => i.kind === 'shells' || i.kind === 'bullets') : undefined
      const gun = g.owned.length < 2 ? g.items.find(i => i.kind === 'shotgun' || i.kind === 'chaingun') : undefined
      const supply = medkit ?? ammo ?? gun
      const key = g.items.find(i => i.kind === 'key')
      // the switch is a wall, so the goal is the floor beside it
      const beside = g.exits
        .flatMap(([x, y]) => [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as [number, number][])
        .find(([x, y]) => open(g, x, y))
      const want = supply ?? (key && !g.key ? key : undefined)
      const goal = want ? ([Math.floor(want.x), Math.floor(want.y)] as [number, number]) : beside
      if (!goal) return { out: false, why: 'nowhere to go', frames, g }
      // two cells ahead, not one: a step is a good fraction of a cell, so aiming at the very next
      // cell centre means stepping past it and turning back for ever
      const path = route(g, goal)
      const next = path[2] ?? path[1] ?? goal
      const off = wrap(Math.atan2(next[1] + 0.5 - g.py, next[0] + 0.5 - g.px) - g.dir)
      // one press, one step, the same as a key: turn until it is lined up, then walk
      g = Math.abs(off) > SWING ? turn(g, Math.max(-SWING, Math.min(SWING, off))) : move(g, STEP)
    }
    g = tick(g, rand)
    if (immortal) g = { ...g, health: 100, over: false }
  }
  return { out: g.level > level, why: g.over ? 'died' : 'ran out of frames', frames, g }
}

test('doom: every floor can be played through to the exit', () => {
  // with the damage taken out, so this is about the floor and not about how well the bot fights:
  // the key is reachable, the door it opens is the right one, and the switch ends the floor
  for (let level = 1; level <= LEVELS.length; level++) {
    const run = walk(level, 20260914, true)
    expect(`E1M${level} ${run.out ? 'reached the exit' : run.why}`).toBe(`E1M${level} reached the exit`)
    expect(run.frames).toBeLessThan(8000)
    expect(run.g.level).toBe(level + 1)
  }
})

test('doom: the floors are survivable', () => {
  // the same bot with the damage back on, over five runs of each floor. It plays badly on purpose,
  // so the bar is low: a floor no one could finish is the bug this is here to catch.
  for (let level = 1; level <= LEVELS.length; level++) {
    const runs = [1234567, 99, 424242, 7, 2026].map(seed => walk(level, seed))
    const alive = runs.filter(r => r.out).length
    expect(`E1M${level} finished ${alive >= 2 ? 'enough' : `only ${alive}`} of 5`).toBe(`E1M${level} finished enough of 5`)
  }
})

test('doom: a corner does not glue you to it', () => {
  // the shoulder of the player's box overlapping the corner cell of a wall: walking forward is
  // blocked on both axes at once, so without help nothing moves at all and the game looks broken
  const corner = ['2222', '22.2', '2..2', '2222']
  const g: DoomGame = { ...newDoom(), ...parseLevel(corner), px: 2.05, py: 2.3, dir: -Math.PI / 2 }
  expect(blocked(corner, g.px, g.py)).toBe(false)
  expect(blocked(corner, g.px, g.py - STEP)).toBe(true)
  // it steps aside, off the corner and into the gap, instead of standing there
  const slid = move(g, STEP)
  expect(slid.px).toBeGreaterThan(g.px)
  expect(blocked(corner, slid.px, slid.py - STEP)).toBe(false)
  // and it only helps where it helps: walking straight at a flat wall still stops dead
  const flat = ['22222', '2...2', '22222']
  const wall: DoomGame = { ...newDoom(), ...parseLevel(flat), px: 2.5, py: 1.3, dir: -Math.PI / 2 }
  expect(move(wall, STEP)).toMatchObject({ px: 2.5, py: 1.3 })
})


test('doom: the same news twice is said twice', () => {
  // a message carries the frame it was said on. Comparing a message against the last one instead
  // would swallow the repeat: two health boxes on one floor, and the second says nothing.
  const g: DoomGame = { ...room(), health: 40, ticks: 100, items: [{ kind: 'health', x: 3.9, y: 3.5 }] }
  const first = tick(g, half)
  expect(first).toMatchObject({ said: 'health', saidAt: 101 })
  // the same message again, forty frames later, is fresh news and stamped as such
  const later: DoomGame = { ...first, ticks: 140, items: [{ kind: 'health', x: 3.9, y: 3.5 }] }
  const second = tick(later, half)
  expect(second).toMatchObject({ said: 'health', saidAt: 141 })
})

test('doom: no floor drops you on top of its own exit', () => {
  // the exit fires within 1.2 cells of the switch, so a spawn any closer would skip the floor
  // before the first frame is drawn — and take the one after it too
  for (const src of LEVELS) {
    const l = parseLevel(src)
    for (const [x, y] of l.exits) {
      expect(Math.hypot(x + 0.5 - l.px, y + 0.5 - l.py)).toBeGreaterThan(1.2)
    }
  }
})

// renders the board headlessly and returns every colour it drew, cell by cell
const painted = async (game: Partial<DoomGame>, columns = 80, rows = 14, props: { safe?: boolean } = {}) => {
  ;(globalThis as never as { h: unknown }).h = (tag: string, p: unknown, ...kids: unknown[]) =>
    ({ tag, props: p ?? {}, kids: kids.flat(Infinity).filter(k => k !== null && k !== undefined && k !== false) })
  const Doom = (await import('../hooks/boards/doom.tsx')).default
  const surface: any = {
    columns, rows, elements: { Box: 'Box', Text: 'Text' }, state: undefined,
    setState(next: unknown) { this.state = next },
    every: () => {}, onKey: () => {}, onPointer: () => {}, post: () => {},
  }
  Doom(props as never, surface)
  surface.state = { ...surface.state, playing: true, game: { ...newDoom(), ...game } }
  const rowsOut: string[][] = []
  const walk = (node: any) => {
    if (node.tag === 'Box') return node.kids.forEach(walk)
    if (node.tag === 'Text' && node.kids.every((k: any) => typeof k !== 'string')) {
      rowsOut.push(node.kids.flatMap((run: any) => [...String(run.kids[0] ?? '')].map(() => run.props.color as string)))
    }
  }
  walk(Doom(props as never, surface))
  return rowsOut
}

test('doom: a monster in front of a wall is drawn, wherever it stands on screen', async () => {
  // the depth buffer holds perpendicular distances; a sprite measured by its own true distance
  // looks further off than the wall it stands in front of, and vanishes — worst at the view edge
  const imp = (px: number, py: number, angle: number, d: number) =>
    ({ kind: 'imp' as const, x: px + Math.cos(angle) * d, y: py + Math.sin(angle) * d, hp: 60, hurt: 0 })
  // how many cells a monster changes, against the same frame drawn without it
  const shows = async (map: string[], px: number, py: number, angle: number, d: number) => {
    const floor = { ...parseLevel(map), px, py, dir: 0, items: [], balls: [] }
    const [without, withIt] = [await painted({ ...floor, enemies: [] }), await painted({ ...floor, enemies: [imp(px, py, angle, d)] })]
    const flat = without.flat()
    return withIt.flat().filter((c, i) => c !== flat[i]).length
  }

  // a narrow room: the east wall is 4.5 away straight on, but 5.2 along a ray 30 degrees off it,
  // so a monster 4.6 away at that angle is in front of the wall while nearer than its perpendicular
  const narrow = ['2222222', ...Array.from({ length: 10 }, () => '2.....2'), '2222222']
  expect(await shows(narrow, 1.5, 4.5, Math.PI / 6, 4.6)).toBeGreaterThan(0)
  // and one genuinely behind a wall stays hidden
  expect(await shows(['22222', '2.2.2', '2.2.2', '22222'], 1.5, 1.5, 0, 2)).toBe(0)

  // in the open, the same monster at the same distance is drawn at the same size wherever it
  // stands in the view: scale comes from the perpendicular too, or the edges shrink
  const wide = ['222222222222', ...Array.from({ length: 12 }, () => '2..........2'), '222222222222']
  const middle = await shows(wide, 1.5, 6.5, 0, 4.6)
  const off = await shows(wide, 1.5, 6.5, Math.PI / 6, 4.6)
  expect(middle).toBeGreaterThan(0)
  expect(off / middle).toBeGreaterThan(0.75)
})

test('doom: a floor may only use characters the parser knows', () => {
  // solid() treats anything that is not floor as a wall, so a typo — 'I' for 'i', or a character a
  // fifth map invents — becomes an invisible grey block rather than the monster it was meant to be.
  // parseLevel is just as quiet about a missing spawn: it drops you in the top-left corner.
  const legend = new Set([...'.123DSX', ...'idz', ...'+abgck'])
  for (const [n, src] of LEVELS.entries()) {
    for (const cell of src.join('')) {
      expect(`E1M${n + 1} uses ${legend.has(cell) ? cell : `an unknown ${JSON.stringify(cell)}`}`).toBe(`E1M${n + 1} uses ${cell}`)
    }
    expect(src.join('').split('S')).toHaveLength(2)
    // and the spawn is somewhere you can stand
    const l = parseLevel(src)
    expect(blocked(l.map, l.px, l.py)).toBe(false)
  }
})

test('doom: a floor starts looking at its door', () => {
  // facing a fixed direction put E1M2's spawn nose-first into a wall two cells away; the first
  // frame of a floor should show you where you are going instead
  for (const [n, src] of LEVELS.entries()) {
    const g = newDoom(n + 1)
    const doors: [number, number][] = []
    g.map.forEach((row, y) => [...row].forEach((cell, x) => { if (cell === 'D') doors.push([x, y]) }))
    const marks = doors.length ? doors : g.exits.map(([x, y]) => [x, y] as [number, number])
    const near = (m: [number, number]) => Math.hypot(m[0] + 0.5 - g.px, m[1] + 0.5 - g.py)
    const target = marks.reduce((best, m) => (near(m) < near(best) ? m : best))
    // pointing at the nearest door, or as near to it as an angle with room to walk allows
    const off = Math.abs(wrap(Math.atan2(target[1] + 0.5 - g.py, target[0] + 0.5 - g.px) - g.dir))
    const ahead = cast(g.map, g.px, g.py, g.dir).dist
    // pointing at the door, and never straight into a wall
    expect(`E1M${n + 1}: ${(off * 180 / Math.PI).toFixed(0)}deg off, ${ahead.toFixed(1)} cells clear`)
      .toBe(`E1M${n + 1}: ${off < Math.PI / 2 ? (off * 180 / Math.PI).toFixed(0) : 'too far'}deg off, ${ahead > 2 ? ahead.toFixed(1) : 'not enough'} cells clear`)
    void src
  }
})
