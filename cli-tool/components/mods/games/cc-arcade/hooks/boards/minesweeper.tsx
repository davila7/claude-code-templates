/* @jsx h */
import type { ClientSurface } from 'claude-code'
import { base, claudeDone, grid, statusLine, type Base, type Props } from './common.tsx'
import { flag, newMines, reveal, type Mines } from '../games/mines.ts'

const NUMBER_COLORS = ['', 'blue', 'green', 'red', 'magenta', 'yellow', 'cyan', 'white', 'gray']
const CURSOR_KEYS: Record<string, readonly [number, number]> = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1], a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1] }
type State = Base & { game?: Mines; cursor: readonly [number, number]; seconds: number }

export default function Minesweeper(props: Props, surface: ClientSurface<State>) {
  const { Box, Text } = surface.elements
  const size = () => {
    const bw = Math.max(4, Math.min(16, Math.floor((surface.columns - 2) / 2)))
    const bh = Math.max(4, Math.min(9, surface.rows - 3))
    return { bw, bh, count: Math.max(1, Math.round(bw * bh * 0.15)) }
  }
  // a click or space reveals, a right-click or f flags; the first action after a finished round
  // only starts a new board, so a stray click cannot open a cell on it
  const act = (x: number, y: number, kind: 'reveal' | 'flag') => {
    const s = surface.state
    if (!s) return
    let g = s.game
    if (!g || g.over || g.won) {
      const { bw, bh, count } = size()
      const fresh = newMines(bw, bh, count)
      if (g) {
        surface.setState({ ...s, banner: false, playing: false, seconds: 0, game: fresh })
        return
      }
      g = fresh
    }
    const game = kind === 'flag' ? flag(g, x, y) : reveal(g, x, y)
    // a board whose first click clears it takes 0 s; count it as 1 s so it cannot lock the best
    if (game.won && !g.won) surface.post({ game: 'minesweeper', score: Math.max(1, s.seconds) })
    const cursor = x >= 0 && y >= 0 && x < game.w && y < game.h ? ([x, y] as const) : s.cursor
    surface.setState({ ...s, banner: false, playing: game.placed && !game.over && !game.won, game, cursor })
  }

  if (surface.state === undefined) {
    surface.setState({ ...base(props), cursor: [0, 0], seconds: 0 })
    surface.every(1000, () => {
      const s = surface.state
      if (s?.game && s.playing && !s.banner) surface.setState({ ...s, seconds: s.seconds + 1 })
    })
    surface.onPointer(ev => {
      if (ev.type !== 'down') return
      // the border takes the first row and column; each cell is two columns wide
      act(Math.floor((ev.x - 1) / 2), ev.y - 1, ev.button === 'right' ? 'flag' : 'reveal')
    })
    surface.onKey(({ key }) => {
      const s = surface.state
      if (!s) return
      // the space bar may arrive as the character or by name
      const k = key === 'space' ? ' ' : key.toLowerCase()
      const bw = s.game?.w ?? size().bw
      const bh = s.game?.h ?? size().bh
      if (Object.hasOwn(CURSOR_KEYS, k)) {
        const [dx, dy] = CURSOR_KEYS[k]
        const [cx, cy] = s.cursor
        surface.setState({ ...s, banner: false, cursor: [Math.max(0, Math.min(bw - 1, cx + dx)), Math.max(0, Math.min(bh - 1, cy + dy))] })
      } else if (k === ' ' || k === 'return') {
        act(s.cursor[0], s.cursor[1], 'reveal')
      } else if (k === 'f') {
        act(s.cursor[0], s.cursor[1], 'flag')
      } else if (k === 'r') {
        const { bw: nw, bh: nh, count } = size()
        surface.setState({ ...s, banner: false, playing: false, seconds: 0, game: newMines(nw, nh, count) })
      }
    })
  }
  claudeDone(props, surface)

  const s = surface.state
  const g = s?.game
  const { bw, bh, count } = g ? { bw: g.w, bh: g.h, count: g.count } : size()
  const [cx, cy] = s?.cursor ?? [0, 0]
  const rows = grid(Text, bw, bh, (x, y) => {
    const t = g?.tiles[y * bw + x]
    const bg = x === cx && y === cy ? 'blue' : undefined
    if (!t || (!t.open && !t.flag)) return ['░░', 'gray', bg]
    if (t.flag && !t.open) return [' F', 'redBright', bg]
    if (t.mine) return [' *', 'red', bg]
    return t.n ? [` ${t.n}`, NUMBER_COLORS[t.n], bg] : ['  ', undefined, bg]
  })
  const flags = g?.tiles.filter(t => t.flag).length ?? 0
  const seconds = s?.seconds ?? 0
  const text = !g ? 'minesweeper · click a cell, or click here then arrows + space · right-click or f flags'
    : g.over ? 'minesweeper · boom · r or a click plays again'
    : g.won ? `minesweeper · cleared in ${seconds}s · r or a click plays again`
    : `minesweeper · ${count - flags} mines left · ${seconds}s · click reveals · right-click or f flags`
  const best = props?.best ? `${props.best}s` : '—'
  return (
    <Box flexDirection="column">
      <Box flexDirection="column" borderStyle="round" borderColor={g?.over ? 'red' : g?.won ? 'green' : 'gray'} width={bw * 2 + 2}>{rows}</Box>
      {statusLine(Text, !!s?.banner, `${text} · best ${best}`)}
    </Box>
  )
}
