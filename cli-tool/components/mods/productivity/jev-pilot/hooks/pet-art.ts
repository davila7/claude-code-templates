/**
 * jev-pilot — the pet: Claude Code's character as a pilot, drawn in
 * half-block characters at the bottom right, and what it says.
 *
 * Pure: the sprite as rows of cells, the speech texts, and the one shared
 * speech state the hooks update and the pet's render hook reads (the modules
 * run in the plugin's one worker, so this state is shared between them).
 */

/** How the pet feels about the last thing it did: sets the bubble's color. */
export type Mood = 'ready' | 'calm' | 'focused' | 'boost' | 'alert'

export const MOOD_COLOR: Record<Mood, string> = {
  ready: '#8b949e',
  calm: '#7cf0c4',
  focused: '#c9d2ea',
  boost: '#d4ff4f',
  alert: '#ff8f8f',
}

export interface Speech {
  text: string
  mood: Mood
}

let speech: Speech = { text: 'ready', mood: 'ready' }

export function say(text: string, mood: Mood): void {
  speech = { text, mood }
}

export function currentSpeech(): Speech {
  return speech
}

/** The mood an effort level reads as. */
export function moodOf(effort: string | null): Mood {
  if (effort === 'low' || effort === 'medium') return 'calm'
  if (effort === 'high') return 'focused'
  if (effort === 'xhigh' || effort === 'max') return 'boost'
  return 'ready'
}

/** How sure the decision model was of the effort, as people read it: `89% sure`. */
export function sure(confidence: number): string {
  return `${Math.round(confidence * 100)}% sure`
}

/**
 * What the pet says when a turn starts:
 *   low · no skill · 89% sure
 *   xhigh · /systematic-debugging · parallel · 88% sure
 *   high kept · wanted low · 42% sure
 */
export function turnSpeech(facts: {
  answered: boolean
  applied: string | null
  current: string | null
  wanted: string | null
  confidence: number | null
  skill: string | null | undefined
  advised: string | null
}): Speech {
  if (!facts.answered) return { text: 'no answer in time · left as is', mood: 'alert' }
  const parts: string[] = []
  const effort = facts.applied ?? facts.current
  if (facts.applied) parts.push(facts.applied)
  else if (facts.wanted && facts.current && facts.wanted !== facts.current) parts.push(`${facts.current} kept`, `wanted ${facts.wanted}`)
  else parts.push(facts.current ?? 'effort as set')
  if (facts.skill !== undefined) parts.push(facts.skill ? `/${facts.skill}` : 'no skill')
  if (facts.advised) parts.push(facts.advised)
  if (facts.confidence !== null) parts.push(sure(facts.confidence))
  return { text: parts.join(' · '), mood: moodOf(effort) }
}

// ---- the sprite -------------------------------------------------------------

/** One character of the sprite: a glyph and its colors. */
export interface Cell {
  ch: string
  fg?: string
  bg?: string
}

const CORAL = '#D97757'
export const PALETTE: Record<string, string> = {
  C: CORAL, // the pilot's body
  E: '#0b1020', // eyes
  L: '#d4ff4f', // goggle lenses
  W: '#ffffff', // the lenses' glint
  G: '#2b3a67', // goggle strap
  S: '#7cf0c4', // scarf
  F: '#ffd166', // flame
  f: '#ff7a59', // flame, outer
  R: '#e6edf3', // jump rope, thought dots, cursor
  s: '#3b4a6b', // speed streaks
  B: '#5b8def', // book cover
  P: '#f5f0e1', // book pages
  M: '#56607d', // magnifier rim
  H: '#a06a3f', // magnifier handle, pencil wood
  r: '#ff5f57', // terminal: close
  y: '#febc2e', // terminal: minimise
  g: '#28c840', // terminal: zoom
  l: '#9fe7ff', // magnifier lens
  K: '#8b949e', // laptop
  k: '#0b1020', // laptop screen
}

/**
 * The pilot: Claude Code's character from its official 24x24 shape at 1.5 units per
 * pixel (the same pilot as the README banner and the demo video): goggles
 * pushed up on the forehead (pulled down over the eyes to fly), their lenses
 * glinting, eyes, arms, a teal scarf with its loose end, legs, and the
 * jet flames under them when flying.
 */
const CLAWD = [
  '..GWLLGGGGWLLG..',
  '..CCCCCCCCCCCC..',
  '..CCECCCCCCECC..',
  '..CCECCCCCCECC..',
  'CCCCCCCCCCCCCCCC',
  'CCCCCCCCCCCCCCCC',
  '..SSSSSSSSSSSSSS',
  '..CCCCCCCCCCCC..',
  '...C.C....C.C...',
  '...C.C....C.C...',
]
const FLAMES = ['...F.f....F.f...', '...f.F....f.F...']

/**
 * The canvas every scene draws on: fixed, so the band never changes size.
 * The pilot's own part is the left BODY_W columns; to its right, what it holds.
 */
export const BODY_W = 18
export const CANVAS_W = 30
export const CANVAS_H = 12

/**
 * What the pet is doing. While a turn runs, what Claude is doing:
 *   think   thinking: eyes up, thought dots rising
 *   read    reading files or pages: a book, its pages turning
 *   search  searching: a magnifier sweeping, the eyes following it
 *   write   editing files: typing code on a laptop
 *   run     running commands: a terminal prompt, the cursor blinking
 *   fly     anything else (subagents, other tools): flying up
 * Idle:
 *   rest    hovering, the scarf flapping, blinking now and then
 *   rope    play: jumping rope
 *   wave    play: waving
 *   look    play: looking around
 */
export type Act = 'think' | 'read' | 'search' | 'write' | 'run' | 'fly' | 'rest' | 'rope' | 'wave' | 'look'

/** The acts a turn shows, by what Claude is doing. */
export const WORK_ACTS = ['think', 'read', 'search', 'write', 'run', 'fly'] as const

/** What the bubble says Claude is doing, for each working act. */
export const ACT_LABEL: Record<(typeof WORK_ACTS)[number], string> = {
  think: 'thinking',
  read: 'reading',
  search: 'searching',
  write: 'writing',
  run: 'running',
  fly: 'working',
}

/** The act a tool call shows: what the tool does, by its name. */
export function actOfTool(tool: string): Act {
  if (/^(Read|NotebookRead|WebFetch|ReadMcpResource)/.test(tool)) return 'read'
  if (/^(Grep|Glob|LS|WebSearch|ToolSearch)$/.test(tool)) return 'search'
  if (/^(Edit|MultiEdit|Write|NotebookEdit)$/.test(tool)) return 'write'
  if (/^(Bash|PowerShell|Monitor)$/.test(tool)) return 'run'
  return 'fly'
}

/** The idle plays, in the order they take turns. */
export const PLAYS = ['rope', 'wave', 'look'] as const
export type Play = (typeof PLAYS)[number]

/** How many frames one loop of each idle play has. */
export const PLAY_FRAMES: Record<Play, number> = { rope: 4, wave: 2, look: 4 }

type Grid = string[][]

function blank(): Grid {
  return Array.from({ length: CANVAS_H }, () => Array.from({ length: CANVAS_W }, () => '.'))
}

function paste(grid: Grid, rows: readonly string[], ox: number, oy: number): void {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x] as string
      if (ch !== '.') dot(grid, ox + x, oy + y, ch)
    }
  })
}

function dot(grid: Grid, x: number, y: number, ch: string): void {
  if (y >= 0 && y < CANVAS_H && x >= 0 && x < CANVAS_W) (grid[y] as string[])[x] = ch
}

function setAt(row: string, x: number, ch: string): string {
  return row.slice(0, x) + ch + row.slice(x + 1)
}

/** The pilot for one frame of one act, before it is placed. */
function clawdFor(act: Act, frame: number, blink: boolean): string[] {
  let rows = [...CLAWD]
  if (act === 'look' && !blink) {
    // The eyes glance left, back, right, back.
    const shift = [-1, 0, 1, 0][frame % 4] as number
    rows = rows.map((row, y) => {
      if (y !== 2 && y !== 3) return row
      return setAt(setAt(row.replace(/E/g, 'C'), 4 + shift, 'E'), 11 + shift, 'E')
    })
  }
  if (act === 'think') rows[3] = (rows[3] as string).replace(/E/g, 'C') // eyes up
  if (act === 'read' || act === 'search' || act === 'write' || act === 'run') {
    // The eyes turn to what the pilot holds at its side (down, for the page).
    rows = rows.map((row, y) => (y === 2 || y === 3 ? setAt(setAt(row.replace(/E/g, 'C'), 5, 'E'), 12, 'E') : row))
    if (act !== 'search') rows[2] = (rows[2] as string).replace(/E/g, 'C')
  }
  if (blink) rows = rows.map((row) => row.replace(/E/g, 'C'))
  if (act === 'wave' && frame % 2 === 0) {
    // The right arm up beside the head.
    for (const y of [4, 5]) rows[y] = (rows[y] as string).slice(0, 14) + '..'
    for (const y of [2, 3]) rows[y] = (rows[y] as string).slice(0, 14) + 'CC'
  }
  if (act === 'fly') {
    // Flying: goggles down over the eyes, the strap round the head.
    rows[0] = '..CCCCCCCCCCCC..'
    rows[1] = '..CCCCCCCCCCCC..'
    rows[2] = '.GGWLGGGGGGWLGG.'
    rows[3] = '..CLLCCCCCCLLC..'
    // The flames flicker long and short, their colors steady.
    rows.push(...(frame % 2 === 1 ? [FLAMES[0] as string] : FLAMES))
  } else if (act !== 'rope') {
    // Hovering: the flames on, steady. (Jumping rope, the feet do the work.)
    rows.push(...FLAMES)
  }
  return rows
}

/** How many wind steps a scarf flap takes: still for all but the last. */
export const SCARF_CYCLE = 5

/**
 * The scarf's loose end in the wind: still most of the time, dipping for one
 * step in `SCARF_CYCLE`. `sx, sy` is where the end sits when still.
 */
function flapScarf(grid: Grid, sx: number, sy: number, wind: number): void {
  if (wind % SCARF_CYCLE !== SCARF_CYCLE - 1) return
  dot(grid, sx, sy, '.')
  dot(grid, sx, sy + 1, 'S')
}

/**
 * The pixel canvas for one frame of one act. `wind` flaps the scarf's end
 * (by default in step with the frames; resting, the pet passes its own).
 */
export function scenePixels(act: Act, frame = 0, blink = false, wind = frame): string[] {
  const grid = blank()
  const clawd = clawdFor(act, frame, blink)
  const X = 1
  const scarf = (top: number) => flapScarf(grid, X + 15, top + 6, wind)
  if (act === 'fly') {
    // Flying up: a bob (down a pixel on the short flame), and streaks
    // sliding down past both sides.
    paste(grid, clawd, X, frame % 2)
    scarf(frame % 2)
    for (const x of [0, BODY_W - 1]) {
      const y = (frame * 2 + (x === 0 ? 0 : 6)) % CANVAS_H
      dot(grid, x, y, 's')
      dot(grid, x, (y + 1) % CANVAS_H, 's')
    }
  } else if (act === 'rope') {
    // Four beats: the rope overhead, coming down in front, under the feet
    // (the pilot up in the air), coming round behind.
    const beat = frame % 4
    const lift = beat === 2 ? 2 : beat === 1 ? 1 : 0
    const top = CANVAS_H - clawd.length - lift
    paste(grid, clawd, X, top)
    scarf(top)
    const hands = top + 4
    const right = BODY_W - 1
    if (beat === 0) {
      for (let x = 1; x < right; x++) dot(grid, x, 0, 'R')
      for (let y = 1; y < hands; y++) dot(grid, 0, y, 'R'), dot(grid, right, y, 'R')
    } else if (beat === 2) {
      for (let x = 1; x < right; x++) dot(grid, x, CANVAS_H - 1, 'R')
      for (let y = hands + 1; y < CANVAS_H - 1; y++) dot(grid, 0, y, 'R'), dot(grid, right, y, 'R')
    } else if (beat === 1) {
      for (let y = hands; y < CANVAS_H; y++) dot(grid, 0, y, 'R'), dot(grid, right, y, 'R')
    } else {
      for (let y = 0; y <= hands; y++) dot(grid, 0, y, 'R'), dot(grid, right, y, 'R')
    }
  } else {
    paste(grid, clawd, X, CANVAS_H - clawd.length)
    scarf(CANVAS_H - clawd.length)
    drawProp(grid, act, frame)
  }
  return grid.map((row) => row.join(''))
}

/** Pixel art for what the pilot holds, each drawn to read as the thing at a glance. */
const CLOUD = ['..RRR.RRR...', '.RRRRRRRRRR.', 'RRRRRRRRRRRR', 'RRRRRRRRRRRR', '.RRRRRRRRRR.', '...RRR.RR...']
const BOOK = [
  '.PPPPP.PPPPP.',
  'BPkkkPMPkkkPB',
  'BPPPPPMPPPPPB',
  'BPkkkPMPkkPPB',
  'BPPPPPMPPPPPB',
  'BPkkPPMPkkkPB',
  'BBBBBBBBBBBBB',
]
const LENS = ['..MMMM..', '.MllllM.', 'MlRRlllM', 'MlRllllM', 'MllllllM', 'MllllllM', '.MllllM.', '..MMMM..']
const PAPER = ['PPPPPPP.', 'PPPPPPPP', 'PPPPPPPP', 'PPPPPPPP', 'PPPPPPPP', 'PPPPPPPP', 'PPPPPPPP', 'PPPPPPPP', 'PPPPPPPP', 'PPPPPPPP']
const TERMINAL = [
  'KKKKKKKKKKKK',
  'KrKyKgKKKKKK',
  'KkkkkkkkkkkK',
  'KkkkkkkkkkkK',
  'KkkkkkkkkkkK',
  'KkkkkkkkkkkK',
  'KkkkkkkkkkkK',
  'KkkkkkkkkkkK',
  'KKKKKKKKKKKK',
]

/**
 * What the pilot holds at its side while working, right of its body, by the
 * right hand (the arm ends at column 16, rows 4 and 5).
 */
function drawProp(grid: Grid, act: Act, frame: number): void {
  const art = (x: number, y: number, rows: readonly string[]) => paste(grid, rows, x, y)
  const line = (x: number, y: number, pixels: string) => paste(grid, [pixels], x, y)
  const X = BODY_W // the first column right of the pilot
  if (act === 'think') {
    // Thought bubbles rising from the head into a cloud, "..." filling in.
    art(X + 1, 0, CLOUD)
    dot(grid, 16, 3, 'R')
    dot(grid, X, 5, 'R')
    const dots = Math.floor(frame / 2) % 4
    for (let i = 0; i < dots; i++) line(X + 3 + i * 3, 2, 'kk')
  } else if (act === 'read') {
    // An open book: two pages of text, the fold between them; the line
    // being read lights up, down the left page, then the right.
    art(X - 1, 2, BOOK)
    const lines: [number, number, number][] = [[X + 1, 3, 3], [X + 1, 5, 3], [X + 1, 7, 2], [X + 7, 3, 3], [X + 7, 5, 2], [X + 7, 7, 3]]
    const [lx, ly, len] = lines[frame % lines.length] as [number, number, number]
    line(lx, ly, 'S'.repeat(len))
  } else if (act === 'search') {
    // A magnifying glass held out by its handle, from the hand to the rim,
    // sweeping in and out, the lens glinting.
    const dx = [0, 1, 2, 1][frame % 4] as number
    art(X + 3 + dx, 1, LENS)
    for (let x = X - 1; x < X + 3 + dx; x++) dot(grid, x, 5, 'H')
    if (frame % 4 === 1) dot(grid, X + 5 + dx, 2, 'R')
  } else if (act === 'write') {
    // A sheet of paper, its corner turned; lines of writing appear as a
    // pencil moves along them.
    art(X + 1, 1, PAPER)
    dot(grid, X + 8, 1, '.')
    dot(grid, X + 7, 1, 'M')
    const done = frame % 12
    for (let i = 0; i < done; i++) dot(grid, X + 2 + (i % 4) + (i % 4 > 1 ? 1 : 0), 3 + Math.floor(i / 4) * 2, 'k')
    const px = X + 2 + (done % 4) + (done % 4 > 1 ? 1 : 0)
    const py = 3 + Math.floor(done / 4) * 2
    // The pencil: point, wood, yellow body, eraser, leaning up and right.
    dot(grid, px, py, 'G')
    dot(grid, px + 1, py - 1, 'H')
    dot(grid, px + 2, py - 2, 'F')
    dot(grid, px + 3, py - 3, 'F')
    dot(grid, px + 4, py - 4, 'f')
  } else if (act === 'run') {
    // A terminal window: its three buttons, output scrolling, a > prompt
    // and a blinking cursor.
    art(X, 1, TERMINAL)
    const outputs = ['LLL.LLLL', 'LL.LLL..', 'LLLLL.LL', 'L.LLLL..', 'LLL.LL.L']
    for (let i = 0; i < 2; i++) line(X + 2, 3 + i, outputs[(frame + i) % outputs.length] as string)
    dot(grid, X + 2, 6, 'S')
    dot(grid, X + 3, 7, 'S')
    dot(grid, X + 2, 8, 'S')
    if (frame % 2 === 0) line(X + 5, 7, 'RR')
  }
}

/** The canvas as terminal lines of cells, two pixel rows per line. */
export function sceneRows(act: Act, frame = 0, blink = false, wind = frame): Cell[][] {
  const pixels = scenePixels(act, frame, blink, wind)
  const rows: Cell[][] = []
  for (let y = 0; y < pixels.length; y += 2) {
    const top = pixels[y] as string
    const bottom = pixels[y + 1] ?? ''
    const row: Cell[] = []
    for (let x = 0; x < top.length; x++) {
      const up = PALETTE[top[x] as string]
      const down = PALETTE[bottom[x] ?? '.']
      if (up && down) row.push({ ch: '▀', fg: up, bg: down })
      else if (up) row.push({ ch: '▀', fg: up })
      else if (down) row.push({ ch: '▄', fg: down })
      else row.push({ ch: ' ' })
    }
    rows.push(row)
  }
  return rows
}
