// Clawd's stage: a width x H grid of cells. Every scene draws Clawd plus props for one frame,
// then the whole frame wanders left and right across the stage.
// Pure functions only, so the frames can be checked without the engine.

export const W = 40 // default stage width; the band passes its own
export const H = 4
export const ORANGE = '#D77757'
const SHADE = '#B35A3E' // the side turned away, as the official animation shades it
const INK = '#1E1E1E' // eye colour where an eye is drawn on top of the body
const PURPLE = '#A374F5'

export type Cell = { ch: string; color?: string; bg?: string }
export type Grid = Cell[][]

// One empty cell shared by the whole grid: it is only ever replaced, never changed
const SPACE: Cell = { ch: ' ' }
const blank = (width: number): Grid => Array.from({ length: H }, () => Array(width).fill(SPACE))

/** Paints `s` at (x, y), moved along by the wander; spaces are transparent so props can overlap Clawd's gaps. */
const put = (g: Grid, x: number, y: number, s: string, color?: string, bg?: string) => {
  if (y < 0 || y >= H) return
  ;[...s].forEach((ch, i) => {
    const cx = x + stride.dx + i
    if (ch !== ' ' && cx >= 0 && cx < g[y].length) g[y][cx] = bg ? { ch, color, bg } : { ch, color }
  })
}
/** Recolours what is already drawn at (x, y), keeping the glyph. */
const tint = (g: Grid, x: number, y: number, color: string) => {
  const c = g[y]?.[x + stride.dx]
  if (c && c.ch !== ' ') c.color = color
}

// Clawd, 9 columns x 3 rows, as the welcome banner draws it.
// smile is drawn as blink with two ^ eyes laid over it (see clawd()).
const TOP = { open: ' ▐▛███▜▌ ', blink: ' ▐█████▌ ', smile: ' ▐█████▌ ', left: ' ▐▜███▜▌ ', right: ' ▐▛███▛▌ ' }
const MID = { down: '▝▜█████▛▘', up: '▗▟█████▙▖', left: '▗▟█████▛▘', right: '▝▜█████▙▖', flat: '▟███████▙' }
const LEGS = { stand: '  ▘▘ ▝▝  ', a: '  ▘ ▘▝ ▝ ', b: ' ▘ ▘ ▝ ▝ ', curl: '  ▘▝ ▘▝  ', tuck: '         ' }

type Pose = {
  x?: number
  /** 1 hops a row up, -1 squashes a row down (legs out of sight, body spread) */
  lift?: -1 | 0 | 1
  eyes?: keyof typeof TOP
  arms?: keyof typeof MID
  legs?: keyof typeof LEGS
  /** which side has turned away from us; the body sways between them on its own */
  shade?: 'left' | 'right' | 'none'
  color?: string
}

// What the wander is doing this frame, `dx` columns along; scenes read it through clawd() and put() so every pose walks along
const STILL = { dx: 0, moving: false, hop: false, squash: false, dir: 1 }
const stride = { ...STILL, width: W }

/**
 * The face when a scene leaves it alone: mostly content ^ ^ eyes, a look around,
 * a blink or a double blink; while travelling it looks the way it goes.
 */
const face = (t: number): keyof typeof TOP => {
  if (stride.moving) return t % 20 === 0 ? 'blink' : stride.dir > 0 ? 'right' : 'left'
  const p = t % 56
  if (p < 14) return p === 7 ? 'blink' : 'open'
  if (p < 36) return 'smile'
  if (p < 40) return 'left'
  if (p < 44) return 'right'
  return p === 49 || p === 51 ? 'blink' : 'open'
}
/** A slow sway: turn one way, face front, turn the other way. */
const sway = (t: number): NonNullable<Pose['shade']> => {
  if (stride.moving) return stride.dir > 0 ? 'left' : 'right'
  const p = t % 16
  return p < 6 ? 'left' : p < 8 ? 'none' : p < 14 ? 'right' : 'none'
}
/** Columns a travelling scene may roam: the stage less Clawd and its trailing props. */
const roam = (extra: number) => Math.max(4, stride.width - 11 - extra)

const clawd = (g: Grid, t: number, pose: Pose = {}) => {
  const x = pose.x ?? 2
  const lift = pose.lift ?? (stride.hop ? 1 : stride.squash ? -1 : 0)
  const y = 1 - lift
  const eyes = pose.eyes ?? face(t)
  const swing = t % 2 === 0 ? 'left' : 'right'
  const color = pose.color ?? ORANGE
  const shade = pose.shade ?? sway(t)
  put(g, x, y, TOP[eyes], color)
  if (eyes === 'smile') {
    // the happy closed eyes: dark arcs sitting on the body
    put(g, x + 2, y, '^', INK, color)
    put(g, x + 6, y, '^', INK, color)
  }
  put(g, x, y + 1, MID[lift < 0 ? 'flat' : pose.arms ?? (stride.moving ? swing : 'down')], color)
  const legs = pose.legs ?? (stride.moving ? walkLegs(t) : shade === 'none' ? 'curl' : 'stand')
  put(g, x, y + 2, LEGS[legs], color)
  // turned a little: the far edge of the body falls into shadow
  if (color === ORANGE && shade !== 'none') {
    const [top, mid] = shade === 'left' ? [x + 1, x] : [x + 7, x + 8]
    tint(g, top, y, SHADE)
    tint(g, mid, y + 1, SHADE)
    tint(g, shade === 'left' ? x + 1 : x + 7, y + 1, SHADE)
  }
}

// A little Clawd, 5 columns x 2 rows, standing on the ground (or a row up when it hops)
const MINI_TOP = { open: '▗▛█▜▖', blink: '▗███▖', left: '▗▜█▜▖', right: '▗▛█▛▖' }
// second row: the top halves close under the eyes, the bottom halves are the legs (out, or tucked in mid-step)
const MINI_LEGS = { a: '▝▛▀▜▘', b: '▝▜▀▛▘' }
const MINI_COLORS = ['#6FA8DC', '#E8C547', '#7BC67E', '#E88AB5'] // blue, yellow, green, pink
const mini = (g: Grid, x: number, color: string, { lift = 0, eyes = 'open', legs = 'a' }: { lift?: number; eyes?: keyof typeof MINI_TOP; legs?: keyof typeof MINI_LEGS } = {}) => {
  put(g, x, 2 - lift, MINI_TOP[eyes], color)
  put(g, x, 3 - lift, MINI_LEGS[legs], color)
}

/** Back-and-forth position over `span` columns. */
const pingPong = (t: number, span: number) => {
  const p = t % (span * 2)
  return p < span ? p : span * 2 - p
}
const walkLegs = (t: number): keyof typeof LEGS => (t % 2 === 0 ? 'a' : 'b')
/** Which way a pingPong(t, span) is heading. */
const goingRight = (t: number, span: number) => t % (span * 2) < span
/** Looks and turns toward `right`, with a blink now and then. */
const facing = (t: number, right: boolean): Pose => ({
  eyes: t % 20 === 0 ? 'blink' : right ? 'right' : 'left',
  shade: right ? 'left' : 'right',
})
const pick = <T,>(xs: readonly T[], t: number) => xs[t % xs.length]

type Scene = (g: Grid, t: number) => void

const GRAY = 'gray'
const BOARD = '#2E4A3B'
const WOOD = '#8B5A2B'
// What Clawd works out on the blackboard, two lines a go (8 columns each)
const LESSONS: [string, string][] = [['a+b=c', 'x^2+1=y'], ['f(x)=?', '  = 42'], ['1+1=2', 'Q.E.D.'], ['if (ok)', '  ship!']]
const scenes: Record<string, Scene> = {
  idle: (g, t) => {
    // a little hop, then it lands with a squash and settles
    const p = t % 24
    clawd(g, t, { lift: p === 10 ? 1 : p === 11 || p === 12 ? -1 : 0, eyes: p >= 9 && p <= 16 ? 'smile' : undefined })
    // a little one copies the hop a beat late
    mini(g, 12, MINI_COLORS[0], { lift: p === 12 ? 1 : 0, eyes: p % 12 === 5 ? 'blink' : 'left' })
  },

  think: (g, t) => {
    clawd(g, t, { arms: t % 16 < 8 ? 'down' : 'right' })
    const bubble = ['·', '· ∘', '· ∘ ○', '· ∘ ○ ?', '· ∘ ○ !'][Math.floor(t / 3) % 5]
    put(g, 11, 0, bubble, GRAY)
  },

  cook: (g, t) => {
    clawd(g, t, { arms: t % 4 < 2 ? 'left' : 'right' }) // stirring
    put(g, 12, 1, pick(['  ~  ', ' ~ ≈ ', '≈ ~ ≈', ' ≈ ~ '], t), GRAY)
    put(g, 12, 2, '▄▄▄▄▄', 'white')
    put(g, 12, 3, '▀███▀', 'white')
    put(g, 11, 2, t % 4 < 2 ? '\\' : '|', 'yellow') // spoon
  },

  bake: (g, t) => {
    clawd(g, t, { arms: t % 10 < 5 ? 'right' : 'down' })
    put(g, 12, 1, '┌────┐', 'white')
    put(g, 12, 2, '│    │', 'white')
    put(g, 13, 2, pick(['▒░▒░', '░▒░▒'], t), 'red')
    put(g, 12, 3, '└────┘', 'white')
    put(g, 14, 0, pick(['~', ' ~', '~ ~'], Math.floor(t / 2)), GRAY)
  },

  brew: (g, t) => {
    clawd(g, t, { arms: 'right' })
    put(g, 12, 1, pick([' ≈ ', '≈  ', '  ≈'], Math.floor(t / 2)), GRAY)
    put(g, 12, 2, '╭─╮╮', 'white')
    put(g, 12, 3, '╰─╯ ', 'white')
    put(g, 13, 2, '▀', 'yellow')
  },

  walk: (g, t) => {
    // two little ones in a row behind it; at the end they all about-face, so the little ones lead the way back
    const right = goingRight(t, roam(12))
    const x = 13 + pingPong(t, roam(12))
    clawd(g, t, { x, legs: walkLegs(t), arms: t % 2 ? 'left' : 'right', ...facing(t, right) })
    const eyes = right ? 'right' : 'left'
    mini(g, x - 6, MINI_COLORS[1], { eyes, legs: t % 2 ? 'a' : 'b' })
    mini(g, x - 12, MINI_COLORS[2], { eyes, legs: t % 2 ? 'b' : 'a' })
  },

  run: (g, t) => {
    const x = 1 + pingPong(t * 2, roam(0))
    const right = goingRight(t * 2, roam(0))
    clawd(g, t, { x, legs: walkLegs(t), lift: t % 4 === 0 ? 1 : 0, arms: t % 2 ? 'left' : 'right', ...facing(t, right) })
    put(g, right ? x - 2 : x + 10, 2, '≡', GRAY) // speed lines, behind
  },

  moonwalk: (g, t) => {
    const x = 1 + roam(3) - pingPong(t, roam(3))
    // gliding backwards: it faces the other way from where it goes
    clawd(g, t, { x, legs: walkLegs(t), arms: 'right', ...facing(t, goingRight(t, roam(3))) })
    put(g, x + 10, 0, pick(['♪', ' ♫', '♪ ♫'], t), 'cyan')
  },

  herd: (g, t) => {
    const x = 1 + pingPong(t, roam(7))
    clawd(g, t, { x, legs: walkLegs(t), arms: 'up', ...facing(t, goingRight(t, roam(7))) })
    put(g, x + (goingRight(t, roam(7)) ? 11 : -6), 3, pick(['o o o', ' o o o', 'o  o o'], t), 'white') // the flock
  },

  spin: (g, t) => {
    clawd(g, t, { x: 2 + (t % 2), arms: pick(['left', 'up', 'right', 'down'] as const, t) })
    put(g, 12, 0, t % 2 ? '↻' : '↺', 'cyan')
    put(g, 0, 2, pick(['(', ' ', ')', ' '], t), GRAY)
  },

  magic: (g, t) => {
    clawd(g, t, { arms: 'up', lift: t % 8 < 4 ? 1 : 0 })
    const sparks = ['✦', '✧', '⋆', '✶', '·']
    for (let i = 0; i < 5; i++) put(g, 11 + ((i * 3 + t) % 9), (i + t) % 3, pick(sparks, t + i), pick(['magenta', 'cyan', 'yellow'], i + t))
  },

  levitate: (g, t) => {
    clawd(g, t, { lift: 1, legs: 'tuck', arms: 'up' })
    put(g, 3, 3, pick(['· ✧ ·', '✧ · ✧'], t), 'cyan')
  },

  hatch: (g, t) => {
    // the egg wobbles and cracks, bursts, and a baby Clawd stands in the shell, then hops out beside it
    const p = t % 48
    const baby = MINI_COLORS[Math.floor(t / 48) % MINI_COLORS.length]
    const hatched = p >= 26
    clawd(g, t, { arms: 'right', lift: p === 27 ? 1 : 0, eyes: hatched ? 'smile' : t % 12 === 0 ? 'blink' : 'right', shade: 'left' })
    if (!hatched) {
      const wobble = p >= 6 && p < 24 ? [0, 1, 0, -1][t % 4] : 0
      put(g, 13 + wobble, 2, p < 12 ? '▗▄▖' : p < 18 ? '▗╱▖' : p < 24 ? '▗╳▖' : '✧ ✧', 'white')
      put(g, 13 + wobble, 3, '▝▀▘', 'white')
      if (p >= 24) put(g, 12, 1, '✦   ✦', 'yellow')
      return
    }
    put(g, 13, 3, '▝▀▘', 'white') // the bottom half of the shell stays behind
    const eyes = p % 7 === 0 ? 'blink' : 'left' // looking up at the big one
    if (p < 34) mini(g, 12, baby, { lift: 1, eyes })
    else if (p === 34) mini(g, 14, baby, { lift: 2, eyes })
    else mini(g, 17, baby, { eyes, lift: p === 40 || p === 42 ? 1 : 0 })
  },

  grow: (g, t) => {
    clawd(g, t, { arms: 'right' })
    const h = Math.floor(t / 4) % 4
    for (let i = 0; i < h; i++) put(g, 13, 3 - i, i === h - 1 ? '❀' : '│', i === h - 1 ? 'magenta' : 'green')
    put(g, 12, 3, '▁▁▁', 'yellow')
  },

  forge: (g, t) => {
    const hit = t % 4 === 0
    clawd(g, t, { arms: hit ? 'right' : 'up' })
    put(g, 11, hit ? 2 : 0, hit ? '╾' : '╤', 'white') // hammer
    put(g, 12, 3, '▀▀█▀▀', 'white')
    if (hit) put(g, 12, 1, pick(['* ✶', '✶ *'], t), 'yellow')
  },

  compute: (g, t) => {
    clawd(g, t, { arms: t % 2 ? 'left' : 'right' })
    for (let row = 1; row <= 3; row++) {
      const bits = Array.from({ length: 8 }, (_, i) => (((i + 1) * 7 + t * (row + 2)) % 3 === 0 ? '1' : '0')).join('')
      put(g, 12, row, bits, 'green')
    }
  },

  type: (g, t) => {
    clawd(g, t, { arms: t % 2 ? 'left' : 'right' })
    const keys = '▤▤▤▤▤▤'
    put(g, 12, 3, keys, GRAY)
    put(g, 12 + (t % keys.length), 3, '▣', 'white')
  },

  talk: (g, t) => {
    clawd(g, t, { arms: t % 6 < 3 ? 'right' : 'down' })
    put(g, 12, 1, pick(['‹ .   ›', '‹ ..  ›', '‹ ... ›'], t), 'white')
  },

  dance: (g, t) => {
    clawd(g, t, { lift: t % 2 ? 1 : 0, arms: t % 4 < 2 ? 'left' : 'right', legs: walkLegs(t), eyes: t % 16 < 10 ? 'smile' : 'open', shade: t % 4 < 2 ? 'left' : 'right' })
    put(g, 12, 0, pick(['♪', '♪ ♫', ' ♫ ♪', '♫'], t), 'cyan')
    // two backup dancers, bouncing on the off-beat
    mini(g, 12, MINI_COLORS[3], { lift: t % 2 ? 0 : 1, eyes: 'right', legs: t % 4 < 2 ? 'a' : 'b' })
    mini(g, 18, MINI_COLORS[0], { lift: t % 2 ? 0 : 1, eyes: 'left', legs: t % 4 < 2 ? 'b' : 'a' })
  },

  disco: (g, t) => {
    // under a spinning mirror ball: the floor flashes, beams glint around the ball, Clawd and a little one dance
    const lights = ['magenta', 'cyan', 'yellow', '#7BC67E']
    for (let i = 0; i < 13; i++) put(g, i * 2, 3, '▁▁', pick(lights, i + Math.floor(t / 2)))
    const beat = t % 4 < 2
    clawd(g, t, { lift: beat ? 1 : 0, arms: pick(['up', 'right', 'up', 'left'] as const, Math.floor(t / 2)), eyes: t % 16 < 12 ? 'smile' : 'open', shade: beat ? 'left' : 'right' })
    mini(g, 20, MINI_COLORS[3], { lift: beat ? 0 : 1, eyes: 'left', legs: beat ? 'a' : 'b' })
    put(g, 15, 0, pick(['◐', '◓', '◑', '◒'], t), 'white') // the ball
    // glints, all right of column 11 so none lands on Clawd
    const glints: [number, number][] = [[13, 0], [17, 0], [12, 1], [18, 1], [14, 2], [16, 1], [12, 2], [18, 2]]
    for (let k = 0; k < 3; k++) {
      const [x, y] = glints[(t + k * 3) % glints.length]
      put(g, x, y, pick(['✦', '✧', '·'], t + k), pick(lights, t + k))
    }
  },

  juggle: (g, t) => {
    clawd(g, t, { arms: t % 2 ? 'left' : 'right', lift: 0 }) // no hop: the balls on row 0 would land on its face
    // left hand → over the head → right hand and back; row 1 only beside the body
    const arc: [number, number][] = [[-1, 1], [1, 0], [4, 0], [7, 0], [9, 1], [7, 0], [4, 0], [1, 0]]
    for (let b = 0; b < 3; b++) {
      const [dx, y] = arc[(t + b * 3) % arc.length]
      put(g, 2 + dx, y, 'o', pick(['red', 'yellow', 'cyan'], b))
    }
  },

  honk: (g, t) => {
    clawd(g, t, { arms: 'up', lift: t % 6 < 2 ? 1 : 0 })
    if (t % 6 < 4) put(g, 12, 1, '< HONK! >', 'yellow')
  },

  sketch: (g, t) => {
    clawd(g, t, { arms: t % 2 ? 'right' : 'down' })
    put(g, 12, 1, '┌──────┐', 'white')
    put(g, 12, 2, `│${'╱╲'.repeat(3).slice(0, (t % 7))}`.padEnd(7) + '│', 'white')
    put(g, 12, 3, '└──────┘', 'white')
  },

  chalk: (g, t) => {
    // the board stays put; Clawd writes, walks back to admire it, walks up again and wipes it
    const BX = 16 // board columns 16-25, Clawd writes from 10 columns to its left
    const p = t % 48
    const [l1, l2] = pick(LESSONS, Math.floor(t / 48))
    const wipe = (from: number, to: number) => {
      for (let y = from; y < 3; y++) for (let x = BX; x < Math.min(to, g[y].length); x++) g[y][x] = { ch: ' ', color: 'white', bg: BOARD }
    }
    wipe(0, BX + 10)
    put(g, BX, 3, '▀▀▀▀▀▀▀▀▀▀', WOOD) // chalk tray
    const n = p < 24 ? p : l1.length + l2.length
    put(g, BX + 1, 1, l1.slice(0, n), 'white', BOARD)
    put(g, BX + 1, 2, l2.slice(0, Math.max(0, n - l1.length)), 'white', BOARD)
    const home = BX - 10
    if (p < 24) {
      // scribbling: the hand bobs, chalk taps the board
      clawd(g, t, { x: home, eyes: t % 12 === 0 ? 'blink' : 'right', arms: t % 2 ? 'right' : 'down', shade: 'left' })
      put(g, BX - 1, 1 + (t % 2), '·', 'white')
    } else if (p < 28) {
      // backs away, still looking at the board
      clawd(g, t, { x: home - (p - 23), eyes: 'right', legs: walkLegs(t), shade: 'left' })
    } else if (p < 36) {
      // admires the work
      clawd(g, t, { x: home - 4, eyes: p === 28 ? 'open' : 'smile', arms: 'down', lift: p === 31 ? 1 : 0, shade: 'none' })
    } else if (p < 40) {
      clawd(g, t, { x: home - 3 + (p - 36), legs: walkLegs(t), ...facing(t, true) })
    } else {
      // wipes left to right
      const ex = BX + (p - 40) * 2
      wipe(1, Math.min(ex, BX + 10))
      put(g, Math.min(ex, BX + 8), 1, '▆▆', WOOD, BOARD)
      clawd(g, t, { x: home, eyes: 'right', arms: t % 2 ? 'right' : 'down', shade: 'left' })
    }
  },

  weather: (g, t) => {
    clawd(g, t, { eyes: 'open', arms: 'up' })
    // the cloud hangs beside it, so the rain never falls on its face
    put(g, 12, 0, '☁☁☁', 'white')
    for (let y = 1; y < H; y++) put(g, 12 + ((t + y) % 3), y, '╵', 'cyan')
  },

  thunder: (g, t) => {
    clawd(g, t, { arms: t % 4 === 0 ? 'up' : 'down', lift: t % 4 === 0 ? 1 : 0 })
    put(g, 12, 0, '☁☁', GRAY)
    if (t % 4 === 0) put(g, 13, 1, 'ϟ', 'yellow')
  },

  dig: (g, t) => {
    // tunnels along the ground at a third of walking pace, dirt flying out behind
    const x = 1 + pingPong(Math.floor(t / 3), roam(2))
    const soil = '▒▓▒░▓▒▒░▓▒▓░'
    put(g, 0, 3, Array.from({ length: stride.width }, (_, i) => soil[i % soil.length]).join(''), 'yellow')
    clawd(g, t, { x, lift: 0, arms: t % 2 ? 'left' : 'right', legs: 'tuck' })
    put(g, x - 2, 2, pick(['· ', ' ∙', '∙·'], t), 'yellow')
  },

  kick: (g, t) => {
    const p = t % 14 // 0-3 wind up, 3 kick, 4-7 ball flies, 7+ celebrate
    const kicking = p === 3
    clawd(g, t, { arms: p >= 7 ? 'up' : kicking ? 'right' : 'down', legs: kicking ? 'b' : undefined, lift: p >= 7 && p % 2 ? 1 : 0 })
    put(g, 18, 1, '┌─', 'white') // goal
    put(g, 18, 2, '│#', 'white')
    put(g, 18, 3, '│#', 'white')
    const bx = p < 4 ? 11 : Math.min(19, 11 + (p - 3) * 2)
    put(g, bx, p >= 4 && p <= 6 ? 2 : 3, '●', 'white')
    if (p >= 7) put(g, 12, 0, 'GOAL!', 'yellow')
  },

  skate: (g, t) => {
    // glides across the ice on one blade then the other, arms out for balance, frost trailing behind
    const span = roam(2)
    const x = 1 + pingPong(t, span)
    const right = goingRight(t, span)
    put(g, 0, 3, '─'.repeat(stride.width), 'cyan') // the rink
    const legs = Math.floor(t / 2) % 2 ? 'a' : 'b'
    clawd(g, t, { x, lift: 1, arms: t % 8 < 4 ? 'up' : right ? 'right' : 'left', legs, ...facing(t, right) })
    // a solid blade right under each foot, so it reads apart from the thin ice line
    put(g, x + 1, 3, '▀▀▀', 'white')
    put(g, x + 5, 3, '▀▀▀', 'white')
    put(g, right ? x - 3 : x + 10, 2, pick(['·  ', ' · ', '  ·'], t), 'white')
  },

  campfire: (g, t) => {
    // two Clawds sit still on either side of the fire, gazing in: a slow blink now and then,
    // a hand held out to the warmth; only the fire and the eyes move.
    // With room to spare a little one sits on each outer side, blinking out of step with the big ones.
    const o = stride.width >= 37 ? 4 : 0
    const warm = t % 20 < 12
    // eyes close happily while the hands are warm
    const eyes = t % 30 < 2 ? 'blink' : warm ? 'smile' : 'open'
    clawd(g, t, { x: 2 + o, eyes, arms: warm ? 'right' : 'down' })
    clawd(g, t, { x: 18 + o, eyes, arms: warm ? 'left' : 'down', color: PURPLE })
    if (o) {
      mini(g, 0, MINI_COLORS[1], { eyes: t % 30 === 11 || t % 30 === 13 ? 'blink' : 'right' })
      mini(g, 32, MINI_COLORS[3], { eyes: t % 30 >= 20 && t % 30 < 22 ? 'blink' : 'left' })
    }
    put(g, 13 + o, 0, pick(['  ·', ' ˙ ', '·  ', '   ', ' · '], Math.floor(t / 2)), 'yellow') // sparks
    put(g, 13 + o, 1, pick([' ▲ ', '▴▲ ', ' ▲▴', ' ▴ '], t), 'yellow')
    put(g, 13 + o, 2, pick(['▟█▙', '▟▙▙', '▟█▟', '▙█▙'], t), 'red')
    put(g, 14 + o, 2, '▒', 'yellow') // the hot core
    put(g, 12 + o, 3, '═╳═╳═', '#8B5A2B') // logs
  },

  flow: (g, t) => {
    clawd(g, t, { lift: t % 6 < 3 ? 1 : 0 })
    const wave = '∿~'
    put(g, 0, 3, Array.from({ length: 16 }, (_, i) => wave[(i + t) % 2]).join(''), 'cyan')
  },
}

// Reactions to /clawd: played over the show for a few seconds, never part of the rotation
const reactions: Record<string, Scene> = {
  pet: (g, t) => {
    // purrs under the hand: happy eyes, a little bounce, hearts floating up
    clawd(g, t, { eyes: 'smile', arms: t % 6 < 3 ? 'up' : 'down', lift: t % 8 === 0 ? 1 : 0, shade: 'none' })
    for (let k = 0; k < 2; k++) {
      const p = (t + k * 3) % 6
      put(g, 11 + k * 3 + (p % 2), 2 - Math.floor(p / 2), '♥', pick(['red', 'magenta'], k))
    }
  },

  feed: (g, t) => {
    // a cookie rolls in, gets munched, crumbs fall
    const p = t % 16
    const eating = p >= 6
    clawd(g, t, { eyes: eating ? 'smile' : 'right', arms: eating ? (t % 2 ? 'left' : 'right') : 'down', shade: eating ? 'none' : 'left' })
    if (!eating) put(g, 21 - p * 2, 2, '●', 'yellow')
    else {
      put(g, 11, 2 + (p % 2), pick(['·', '∙'], t), 'yellow') // crumbs
      if (p < 12) put(g, 12, 1, pick(['nom', 'nom nom'], Math.floor(t / 2)), 'white')
    }
  },

  // chatting: it stands still under its speech bubble, thinking, then talking with its hands
  ponder: scenes.think,
  say: (g, t) => clawd(g, t, { arms: pick(['down', 'right', 'down', 'left'] as const, Math.floor(t / 3)), eyes: t % 18 === 0 ? 'blink' : 'open', shade: 'none' }),

  wave: (g, t) => {
    // waves hello with both arms
    clawd(g, t, { eyes: t % 12 < 9 ? 'smile' : 'open', arms: t % 4 < 2 ? 'up' : 'down', shade: 'none' })
    put(g, 11, 1, pick([')', ' )', '  )'], t), 'white')
    put(g, 12, 0, 'hi!', 'yellow')
  },
}
export const REACTION_NAMES = Object.keys(reactions)

// Spinner word → scene, by stem; the first match wins
const VERBS: [RegExp, string][] = [
  [/moonwalk/, 'moonwalk'],
  [/campfir|bonfir|kindl|smolder|smoulder|stok|crackl|flicker|glow|fire/, 'campfire'],
  [/skat|glid|slid|skid|coast/, 'skate'],
  [/kick|dribbl|scor|punt|volley|soccer|footbal/, 'kick'],
  [/levitat|hyperspac/, 'levitate'],
  [/thunder/, 'thunder'],
  [/honk|boop|hullaballoo|shenanigan|tomfool|razzle/, 'honk'],
  [/juggl/, 'juggle'],
  [/sketch|doodl|draw/, 'sketch'],
  [/deciph|elucidat|philosoph|pontificat|deliberat|determin|reason|theoriz|theoris|hypothes|deduc|formulat|scribbl|jott|lectur|teach|explain/, 'chalk'],
  [/bak|proof|leaven|knead|frost|roast/, 'bake'],
  [/brew|percolat|ferment|steep/, 'brew'],
  [/cook|simmer|stew|saut|marinat|flamb|julienn|season|garnish|zest|blanch|carameli|drizzl|whisk|concoct|infus|temper|boil|fry/, 'cook'],
  [/herd|wrangl|muster/, 'herd'],
  [/scamper|scurr|skedaddl|gallop|hustl|catapult|swoop|pounc|zoom|dash/, 'run'],
  [/mosey|schlep|putter|wander|meander|perambul|gallivant|stroll|waddl|lollygag|dilly|zigzag|scuttl/, 'walk'],
  [/spin|churn|whirr|swirl|whirlpool|twist|reticulat|orbit|cascad|topsy|wibbl|combobul|coalesc|smoosh/, 'spin'],
  [/conjur|manifest|transmut|transfigur|enchant|prestidig|metamorph|quantum|warp|sublimat|ioniz|crystalli|channel|alchem/, 'magic'],
  [/hatch|incubat|nest|roost/, 'hatch'],
  [/germinat|sprout|pollinat|photosynth|cultivat|propagat|unfurl|symbiot|bloom|nucleat/, 'grow'],
  [/disco|funk|boogi|groov|fiesta|shindig|soiree/, 'disco'],
  [/vib|jitterbug|shimm|sock|bebop|frolic|choreograph|harmoni|orchestrat|compos|improvis|jam/, 'dance'],
  [/calculat|comput|crunch|process|infer|synthesi|analy|hash|gitif|quantif/, 'compute'],
  [/forg|craft|build|construct|tinker|form|creat|generat|actualiz|accomplish|action|effect|embellish|bootstrap|doing|work/, 'forge'],
  [/mist|nebuli|evaporat|billow|gust|precipitat|cloud/, 'weather'],
  [/burrow|spelunk|slither|dig/, 'dig'],
  [/flow|ebb|osmos|undulat|wav/, 'flow'],
  [/ponder|mus|mull|ruminat|cogitat|cerebrat|consider|contemplat|think|puzzl|envision|imagin|ideat|perus|bloviat|befuddl|flummox|noodl|claud/, 'think'],
]

export type Mode = 'requesting' | 'responding' | 'thinking' | 'tool-input' | 'tool-use'

/** Which scene a spinner word acts out; an unknown word falls back to what the turn is doing. */
export const sceneFor = (word: string, mode: Mode) => {
  const w = word.toLowerCase().replace(/[^a-z]/g, '')
  const hit = VERBS.find(([re]) => re.test(w))
  if (hit) return hit[1]
  return mode === 'tool-use' || mode === 'tool-input' ? 'type' : mode === 'responding' ? 'talk' : mode === 'thinking' ? 'think' : 'idle'
}

// Only scenes whose extras belong to Clawd (a bubble, notes, sparks) wander; the rest travel on their own
// or stand by a pot, a board, an anvil… that must stay put while Clawd works at it
export const WANDERS = new Set(['idle', 'think', 'talk', 'dance', 'juggle', 'honk', 'levitate', 'magic', 'spin'])
const PROPS_WIDTH = 23 // the widest scene's Clawd plus props, from column 0 (dance with its backup dancers)
const PAUSE = 10 // frames spent standing at each end

/** Where the wander puts the frame: stroll right, pause, stroll left, pause; a hop at each turn. */
export const wander = (t: number, width: number) => {
  const span = Math.max(0, Math.min(width - PROPS_WIDTH, 30))
  if (span === 0) return STILL
  const period = 2 * (span + PAUSE)
  const p = t % period
  // each end: hop, land with a squash for two frames, then stand
  const atEnd = (q: number) => ({ moving: false, hop: q === 0, squash: q === 1 || q === 2 })
  if (p < span) return { dx: p, moving: true, hop: false, squash: false, dir: 1 }
  if (p < span + PAUSE) return { dx: span, ...atEnd(p - span), dir: 1 }
  if (p < 2 * span + PAUSE) return { dx: 2 * span + PAUSE - p, moving: true, hop: false, squash: false, dir: -1 }
  return { dx: 0, ...atEnd(p - 2 * span - PAUSE), dir: -1 }
}

/** One frame of the stage, as rows of same-colour runs. */
export const frameRows = (word: string, mode: Mode, t: number, width: number = W, scene?: string) => {
  const name = scene ?? sceneFor(word, mode)
  Object.assign(stride, WANDERS.has(name) ? wander(t, width) : STILL, { width })
  const g = blank(width)
  ;(scenes[name] ?? reactions[name] ?? scenes.idle)(g, t)
  return g.map(row => {
    const runs: { text: string; color?: string; bg?: string }[] = []
    for (const c of row) {
      const last = runs[runs.length - 1]
      if (last && last.color === c.color && last.bg === c.bg) last.text += c.ch
      else runs.push({ text: c.ch, color: c.color, bg: c.bg })
    }
    return runs
  })
}

export const SCENE_NAMES = Object.keys(scenes)

// ---- Which scene plays when: a running tool first, else the spinner word's act, then a rotation ----

/** A running tool's scene, by tool name; any other tool hammers away. */
const TOOL_SCENES: [RegExp, string][] = [
  [/^(Bash|PowerShell|Monitor)$/, 'type'],
  [/^(Read|Grep|Glob|LS)$/, 'think'],
  [/^(Edit|Write|MultiEdit|NotebookEdit)$/, 'sketch'],
  [/^(Agent|Task|SendMessage)$/, 'herd'],
  [/^Web/, 'weather'],
  [/^(TodoWrite|Skill|ToolSearch)$/, 'juggle'],
  [/^mcp__/, 'magic'],
]
export const sceneForTool = (tool: string) => TOOL_SCENES.find(([re]) => re.test(tool))?.[1] ?? 'forge'

export const FRAME_MS = 140
export const ACT_MS = 15_000 // each act runs a quarter of a minute
export const ACT_FRAMES = Math.round(ACT_MS / FRAME_MS)
const ROTATION = SCENE_NAMES.filter(n => n !== 'idle' && n !== 'type' && n !== 'talk')
const STEP = [7, 5, 3, 11, 13].find(k => ROTATION.length % k !== 0) ?? 1 // coprime with the length, so it visits all

/**
 * `played`: rotation acts earlier turns of the session got through, so the rotation picks up where it left off;
 * `prev`: the scene the act before this one showed
 */
export type Cue = { word: string; mode: Mode; tick: number; seed: number; tool?: string; played?: number; prev?: string }

/**
 * The scene for this frame of a turn. Act 0 opens on the running tool, else the spinner word;
 * every later act steps through the rotation in an order the session's seed shuffles
 * (a step coprime with the list's length visits all), whatever tool runs, skipping the opener.
 */
export const sceneAt = ({ word, mode, tick, seed, tool, played = 0, prev }: Cue) => {
  const act = Math.floor(Math.max(0, tick) / ACT_FRAMES)
  if (act === 0) return tool ? sceneForTool(tool) : sceneFor(word, mode)
  const n = ROTATION.length
  const i = seed + (played + act - 1) * STEP
  // the next one along is neither of its neighbours, as the step is not ±1
  return ROTATION[i % n] === prev ? ROTATION[(i + 1) % n] : ROTATION[i % n]
}

export type Shown = { turn: number; act: number; scene: string }

/**
 * The scene on stage: picked at an act's first frame and held for the whole act, whatever the
 * tool, the spinner word or the mode do meanwhile. `turn` tells the turns apart (its first frame).
 */
export const hold = (shown: Shown | undefined, turn: number, cue: Cue): Shown => {
  const act = Math.floor(Math.max(0, cue.tick) / ACT_FRAMES)
  const same = shown?.turn === turn
  if (same && shown.act === act) return shown
  return { turn, act, scene: sceneAt({ ...cue, prev: same ? shown.scene : undefined }) }
}
