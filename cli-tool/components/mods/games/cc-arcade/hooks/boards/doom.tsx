/* @jsx h */
import type { ClientSurface } from 'claude-code'
import { base, claudeDone, grid, statusLine, type Base, type Paint, type Props } from './common.tsx'
import { cast, fire, move, newDoom, select, STEP, SWING, tick, turn, wrap, WEAPON, type DoomGame, type ItemKind, type Kind, type Weapon } from '../games/doom.ts'

// The view is a pixel buffer twice as tall as the band: each cell is drawn as an upper half block,
// so its foreground is the top pixel and its background the bottom one. Columns are cast one ray
// each; monsters, pickups and fireballs are billboards tested against the wall depth of their
// column. Every sprite is an 8 × 8 mask, sampled at whatever size the distance calls for.

type Rgb = readonly [number, number, number]
type State = Base & { game?: DoomGame }
type Sprite = { art: string[]; rgb: Rgb; scale: number; float?: boolean }

const FOV = (70 * Math.PI) / 180
export const WALL: Record<string, Rgb> = {
  '1': [165, 95, 45], '2': [130, 132, 145], '3': [70, 150, 85],
  D: [175, 55, 55], X: [60, 220, 110],
}
// Colour-blind mode. Red and green carry meaning all over this game — a red door against a green
// exit switch is the textbook case — so the mode swaps in colours that stay apart on the axes
// dichromats keep, spreads them by brightness too, and gives the two wall markers a pattern each,
// because no palette is a substitute for a cue that is not colour at all.
// the walls go dark, because they are the background: everything that matters stands in front of
// them, and a dichromat reads a bright thing on a dark wall whatever the two hues do
const SAFE_WALL: Record<string, Rgb> = {
  '1': [78, 78, 78], '2': [96, 102, 108], '3': [52, 66, 82],
  D: [230, 159, 0], X: [86, 180, 233],
}
// spread along brightness as well as hue: hue alone is what a dichromat is short of
const SAFE_TINT: Record<Drawn, Rgb> = {
  imp: [255, 109, 31], demon: [170, 90, 200], zombie: [130, 205, 245],
  health: [255, 255, 255], key: [240, 228, 66], shells: [230, 159, 0],
  bullets: [48, 150, 224], shotgun: [0, 158, 115], chaingun: [154, 160, 166],
  ball: [255, 225, 90],
}
// What a player has to tell apart in a hurry, and what it costs to get wrong. Three kinds of colour
// blindness leave about one hue axis and brightness between them, which is not room for nine
// separate colours, so the promise is made where a mix-up costs something:
//   the door from the exit    — walk into the wrong one and you are lost, and both are flat wall
//   one monster from another  — how fast it closes and how much it takes decides what you do
//   anything from the wall    — seeing that something is there at all
// Pickups are not on the list against each other. You walk over what you step on; there is no
// choice to get wrong, and their shapes differ anyway. Where colour runs out, pattern takes over.
export const CRITICAL: [string, string][] = [
  ['wall:D', 'wall:X'],
  ['imp', 'demon'], ['imp', 'zombie'], ['demon', 'zombie'],
  ['imp', 'wall:2'], ['demon', 'wall:2'], ['zombie', 'wall:2'],
  ['health', 'wall:2'], ['key', 'wall:2'], ['shells', 'wall:2'], ['bullets', 'wall:2'],
]
export const safeRgb = (name: string): Rgb =>
  name.startsWith('wall:') ? SAFE_WALL[name.slice(5)] : SAFE_TINT[name as Drawn]

const CEILING: Rgb = [46, 46, 58]
const GROUND: Rgb = [78, 62, 48]
const METAL: Rgb = [96, 98, 108]
const BARREL: Rgb = [168, 150, 112]

const art = (...rows: string[]) => rows
type Drawn = Kind | ItemKind | 'ball'
export const SPRITE: Record<Drawn, Sprite> = {
  imp: { rgb: [200, 72, 40], scale: 0.8, art: art(
    '..#..#..', '.#.##.#.', '.######.', '.#.##.#.', '..####..', '.##..##.', '.#.##.#.', '##....##') },
  demon: { rgb: [225, 120, 140], scale: 0.95, art: art(
    '#......#', '#.#..#.#', '.######.', '.#.##.#.', '.######.', '.##..##.', '.#....#.', '##....##') },
  zombie: { rgb: [150, 145, 110], scale: 0.75, art: art(
    '...##...', '...##...', '..####..', '.#####..', '..###.##', '..####..', '..#..#..', '..#..#..') },
  health: { rgb: [60, 200, 90], scale: 0.34, art: art(
    '........', '...##...', '...##...', '.######.', '.######.', '...##...', '...##...', '........') },
  shells: { rgb: [215, 180, 40], scale: 0.3, art: art(
    '........', '........', '.######.', '.#.##.#.', '.#.##.#.', '.######.', '........', '........') },
  bullets: { rgb: [190, 140, 60], scale: 0.26, art: art(
    '........', '........', '..####..', '..#..#..', '..#..#..', '..####..', '........', '........') },
  shotgun: { rgb: [175, 140, 95], scale: 0.34, art: art(
    '........', '........', '..#####.', '.######.', '.##.....', '........', '........', '........') },
  chaingun: { rgb: [150, 150, 165], scale: 0.36, art: art(
    '........', '..####..', '.#####..', '.####...', '.###....', '.##.....', '........', '........') },
  key: { rgb: [230, 50, 50], scale: 0.3, art: art(
    '..###...', '..#.#...', '..###...', '...#....', '...#....', '...##...', '...#....', '...##...') },
  ball: { rgb: [255, 190, 60], scale: 0.22, float: true, art: art(
    '..####..', '.######.', '########', '########', '########', '########', '.######.', '..####..') },
}
// the weapon in your hands, bottom centre of the view
const HANDS: Record<Weapon, string[]> = {
  pistol: art('...##...', '...##...', '..####..', '..####..', '.######.', '########'),
  shotgun: art('....##..', '...####.', '..#====#', '.##====#', '######==', '########'),
  chaingun: art('..#..#..', '.##==##.', '.##==##.', '.######.', '########', '########'),
}

// the engine counts the nodes in a frame, and every change of colour along a row is one more span,
// so the shades are quantised: neighbouring columns of the same wall come out equal and merge
export const SHADES = 24
const hex = (rgb: Rgb, k: number) =>
  `#${rgb.map(c => Math.max(0, Math.min(255, Math.round((c * k) / SHADES) * SHADES)).toString(16).padStart(2, '0')).join('')}`
// further is darker, and never quite black
const fog = (d: number) => Math.max(0.16, 1 / (1 + d * 0.14))
// a still frame of a corridor looks exactly like a running one, so a stopped game is dimmed: it is
// the only way to see at a glance that this view is not playing
const dimmed = new Map<string, string>()
const dim = (color: string) => {
  // paused is when the person is reading Claude's answer, and it is the frame that dims every
  // pixel. The palette is quantised, so the colours coming through here are a small fixed set.
  const known = dimmed.get(color)
  if (known !== undefined) return known
  const out = `#${[1, 3, 5].map(i => Math.round(parseInt(color.slice(i, i + 2), 16) * 0.42).toString(16).padStart(2, '0')).join('')}`
  dimmed.set(color, out)
  return out
}

export default function Doom(props: Props, surface: ClientSurface<State>) {
  const { Box, Text } = surface.elements
  const ensure = (s: State): DoomGame => (s.game && !s.game.over ? s.game : newDoom())
  // the view, in pixels: one per column, two per row
  const view = () => ({ w: Math.max(8, surface.columns - 2), ph: Math.max(6, (surface.rows - 3) * 2) })

  const act = (fn: (g: DoomGame) => DoomGame) => {
    const s = surface.state
    if (!s) return
    surface.setState({ ...s, banner: false, playing: true, game: fn(ensure(s)) })
  }

  if (surface.state === undefined) {
    // the floor is there from the first frame; nothing moves until you press or click
    surface.setState({ ...base(props), game: newDoom() })
    // 20 frames a second: the movement is driven by the frame, not by how fast a key repeats
    surface.every(50, () => {
      const s = surface.state
      if (!s?.game || !s.playing || s.game.over) return
      const game = tick(s.game)
      if (game.over) surface.post({ game: 'doom', score: game.kills })
      surface.setState({ ...s, game })
    })
    surface.onKey(({ key }) => {
      const s = surface.state
      if (!s) return
      const k = key === 'space' ? ' ' : key.toLowerCase()
      if (k === 'p') {
        if (s.game && !s.game.over) surface.setState({ ...s, banner: false, playing: !s.playing })
        return
      }
      if (k === 'r') {
        surface.setState({ ...s, banner: false, playing: true, game: newDoom() })
        return
      }
      const weapon: Weapon | undefined = k === '1' ? 'pistol' : k === '2' ? 'shotgun' : k === '3' ? 'chaingun' : undefined
      // one press, one step: what the terminal repeats while you hold a key is what walks you
      const step =
        weapon ? (g: DoomGame) => select(g, weapon)
        : k === 'w' || k === 'up' ? (g: DoomGame) => move(g, STEP)
        : k === 's' || k === 'down' ? (g: DoomGame) => move(g, -STEP)
        : k === 'a' ? (g: DoomGame) => move(g, 0, -STEP)
        : k === 'd' ? (g: DoomGame) => move(g, 0, STEP)
        : k === 'left' || k === 'q' ? (g: DoomGame) => turn(g, -SWING)
        : k === 'right' || k === 'e' ? (g: DoomGame) => turn(g, SWING)
        : k === ' ' || k === 'return' ? fire
        : undefined
      if (step) act(step)
    })
    // the pointer aims: moving over the view turns toward it, a click fires
    surface.onPointer(ev => {
      const s = surface.state
      if (!s) return
      if (ev.type !== 'move' && ev.type !== 'down') return
      if (ev.type === 'move' && (!s.playing || s.game?.over)) return
      const w = view().w
      const dpp = w / 2 / Math.tan(FOV / 2)
      const aim = (g: DoomGame) => turn(g, Math.atan2(ev.x - 1 - w / 2, dpp) * 0.5)
      act(ev.type === 'down' ? g => fire(aim(g)) : aim)
    })
  }
  claudeDone(props, surface)

  const s = surface.state
  const g = s?.game
  const { w, ph } = view()
  const rows = ph / 2
  const dpp = w / 2 / Math.tan(FOV / 2)
  // one colour per pixel, filled by the wall pass and overdrawn by the sprites and the weapon
  const buf: string[] = Array.from({ length: w * ph })
  const depth = new Float64Array(w)

  const safe = props?.safe ?? false
  const walls = safe ? SAFE_WALL : WALL
  const tint = (name: Drawn, fallback: Rgb) => (safe ? SAFE_TINT[name] : fallback)

  if (g) {
    // one colour per row for the floor and the ceiling: they fade with the row's own distance and
    // nothing else, so building them per pixel rebuilt the same string tens of thousands of times.
    // Every column then shares the identical string, which makes the run merge in grid() a pointer
    // compare rather than a character one.
    const sky = Array.from({ length: ph }, (_, y) =>
      hex(y < ph / 2 ? CEILING : GROUND, fog(ph / 2 / Math.max(0.5, Math.abs(y - ph / 2)))))

    // Wide bars, not every other column: a door filling a wide view would otherwise emit one run
    // per two columns, and the run cap in grid() folds pairs by keeping the left one's colour —
    // which collapses an alternating pattern back to a single flat colour. A dozen bands across
    // the view stays well under the cap at any width, so the cue survives on a big terminal.
    const barW = Math.max(2, Math.round(w / 12))

    for (let x = 0; x < w; x++) {
      const angle = g.dir + Math.atan2(x - w / 2 + 0.5, dpp)
      const ray = cast(g.map, g.px, g.py, angle)
      // the cosine takes the fisheye out: what matters is the distance to the wall's plane
      const d = Math.max(0.05, ray.dist * Math.cos(angle - g.dir))
      depth[x] = d
      const h = dpp / d
      const top = Math.round(ph / 2 - h / 2)
      const bottom = Math.round(ph / 2 + h / 2)
      // the two faces of a corner catch the light differently, which is what makes corners read
      const lit = fog(d) * (ray.side === 1 ? 0.68 : 1)
      const base = walls[ray.kind] ?? walls['2']
      // in colour-blind mode the door is barred the short way and the exit switch the long way, so
      // the two of them read apart with the colour taken away entirely
      const bars = safe && ray.kind === 'D' ? (Math.floor(x / barW) & 1 ? 1.35 : 0.6) : 1
      const wall = hex(base, lit * bars)
      const banded = safe && ray.kind === 'X'
      for (let y = 0; y < ph; y++) {
        buf[y * w + x] = y >= top && y < bottom
          ? (banded ? hex(base, lit * ((y >> 1) & 1 ? 1.35 : 0.6)) : wall)
          : sky[y]
      }
    }

    // billboards, furthest first so a near one covers what stands behind it
    const billboard = (name: Drawn, x: number, y: number, hurt = false) =>
      ({ x, y, art: SPRITE[name].art, scale: SPRITE[name].scale, float: SPRITE[name].float, rgb: tint(name, SPRITE[name].rgb), hurt })
    const board = [
      ...g.enemies.map(e => billboard(e.kind, e.x, e.y, e.hurt > 0)),
      ...g.items.map(i => billboard(i.kind, i.x, i.y)),
      ...g.balls.map(b => billboard('ball', b.x, b.y)),
    ]
      .map(sp => ({ ...sp, d: Math.hypot(sp.x - g.px, sp.y - g.py) }))
      .sort((a, b) => b.d - a.d)
    for (const sp of board) {
      const a = wrap(Math.atan2(sp.y - g.py, sp.x - g.px) - g.dir)
      if (Math.abs(a) > FOV) continue
      // the depth buffer holds perpendicular distances, so the sprite has to be measured the same
      // way or it is culled by a wall it stands in front of, and drawn at a different scale from
      // the walls beside it. Shading still wants the true distance: fog is about how far away it is.
      const perp = Math.max(0.1, sp.d * Math.cos(a))
      const full = dpp / perp
      const size = Math.max(1, Math.round(full * sp.scale))
      const left = w / 2 + Math.tan(a) * dpp - size / 2
      // a monster or a pickup stands on the floor; a fireball flies at eye level
      const top = sp.float ? ph / 2 - size / 2 : ph / 2 + full / 2 - size
      const color = hex(sp.rgb, sp.hurt ? 1.6 : Math.max(0.5, fog(sp.d) * 1.4))
      // walk the part of the screen the sprite covers, not the sprite: something almost in your
      // face is scaled by 1/distance and would otherwise be a loop the size of the square of it
      for (let x = Math.max(0, Math.ceil(left)); x < Math.min(w, left + size); x++) {
        if (depth[x] <= perp) continue
        const col = Math.floor(((x - left) / size) * 8)
        for (let y = Math.max(0, Math.ceil(top)); y < Math.min(ph, top + size); y++) {
          if (sp.art[Math.floor(((y - top) / size) * 8)][col] === '.') continue
          buf[y * w + x] = color
        }
      }
    }

    // the crosshair, then the weapon across the bottom, then the muzzle flash over both
    const cx = Math.floor(w / 2)
    const cy = Math.floor(ph / 2)
    for (const [dx, dy] of [[0, -2], [0, 2], [-2, 0], [2, 0]] as const) {
      const x = cx + dx
      const y = cy + dy
      if (x >= 0 && x < w && y >= 0 && y < ph) buf[y * w + x] = '#d8d8d8'
    }
    const hands = HANDS[g.weapon]
    const gh = Math.max(4, Math.round(ph * 0.3))
    const gw = gh * 2
    for (let iy = 0; iy < gh; iy++) for (let ix = 0; ix < gw; ix++) {
      const mark = hands[Math.floor((iy / gh) * hands.length)][Math.floor((ix / gw) * hands[0].length)]
      if (mark === '.') continue
      const x = Math.round(cx - gw / 2 + ix)
      const y = ph - gh + iy
      if (x < 0 || x >= w || y < 0 || y >= ph) continue
      buf[y * w + x] = hex(mark === '=' ? BARREL : METAL, g.flash > 0 ? 1.5 : 1)
    }
    if (g.flash > 0) {
      const blast = Math.max(2, Math.round(gh * 0.7))
      for (let iy = -blast; iy <= blast; iy++) for (let ix = -blast; ix <= blast; ix++) {
        if (Math.hypot(ix, iy) > blast) continue
        const x = cx + ix
        const y = ph - gh + iy
        if (x < 0 || x >= w || y < 0 || y >= ph) continue
        buf[y * w + x] = Math.hypot(ix, iy) > blast * 0.6 ? '#ffb020' : '#fff0c0'
      }
    }
  }

  const stopped = !s?.playing || !!g?.over
  const shade = (color: string) => (stopped ? dim(color) : color)
  const paint = (x: number, y: number): Paint =>
    ['▀', shade(buf[y * 2 * w + x] ?? '#101014'), shade(buf[(y * 2 + 1) * w + x] ?? '#101014')]
  // what is left of the engine's node budget for this frame, shared out over the rows
  const maxRuns = Math.max(6, Math.floor(1500 / Math.max(1, rows)) - 1)
  const border = g?.over ? 'red' : (g?.pain ?? 0) > 0 ? 'redBright' : g?.flash ? 'yellow' : 'gray'
  // a pickup, a door or a new floor says so for a couple of seconds
  const said = g && g.said && g.ticks - g.saidAt < 50 ? ` · ${g.said}` : ''
  // once a floor is under way the line keeps showing it, paused or not: what you want to read when
  // you come back is your health, not the controls again
  const text = g?.over ? `doom · you died on E1M${g.level} · ${g.kills} killed · r starts again`
    : (g?.ticks ?? 0) === 0 && !s?.playing && !s?.banner ? 'doom · click the view, then WASD moves · ←→ turn · space fires · 1 2 3 weapons'
    : `doom · E1M${g?.level ?? 1} · health ${g?.health ?? 0} · ${g?.weapon ?? 'pistol'} ${g?.[WEAPON[g?.weapon ?? 'pistol'].ammo] ?? 0} · killed ${g?.kills ?? 0}${g?.key ? ' · red key' : ''}${said}`
  // a stopped game says so across the middle of the view, where the click has to land anyway: the
  // keyboard goes to the prompt until a click gives it to the board, and a status line is easy to miss
  const label = !stopped ? undefined
    : g?.over ? 'you died · press r to start again'
    : s?.banner ? '● Claude is done · click here or press a key to carry on'
    : (g?.ticks ?? 0) === 0 ? 'CLICK HERE TO PLAY · then WASD moves, space fires'
    : 'paused · click here or press p'
  const view3d = grid(Text, w, rows, paint, maxRuns)
  if (label) {
    const pad = Math.max(0, Math.floor((w - label.length) / 2))
    const line = (' '.repeat(pad) + label).padEnd(w).slice(0, w)
    view3d[Math.floor(rows / 2)] = <Text backgroundColor="#101014" color={s?.banner ? '#ffd24a' : '#ffffff'} bold>{line}</Text>
  }
  return (
    <Box flexDirection="column">
      <Box flexDirection="column" borderStyle="round" borderColor={border} width={w + 2}>
        {view3d}
      </Box>
      {statusLine(Text, !!s?.banner, `${text} · best ${props?.best ?? 0}`)}
    </Box>
  )
}
