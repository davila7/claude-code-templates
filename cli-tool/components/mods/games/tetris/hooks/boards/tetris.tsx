/* @jsx h */
import type { ClientSurface } from 'claude-code'
import { base, claudeDone, grid, statusLine, type Base, type Props } from './common.tsx'
import { cells, drop, dropEvery, fall, NAMES, newTetris, rotate, shift, type TetrisGame } from '../games/tetris.ts'

const COLORS = ['cyan', 'yellow', 'magenta', 'green', 'red', 'blue', '#ff8800']
type State = Base & { game?: TetrisGame }

export default function Tetris(props: Props, surface: ClientSurface<State>) {
  const { Box, Text } = surface.elements
  const boardRows = () => Math.min(20, surface.rows - 3)
  // ten columns wide, less on a terminal too narrow for the board
  const boardCols = () => Math.max(6, Math.min(10, Math.floor((surface.columns - 2) / 2)))

  if (surface.state === undefined) {
    surface.setState(base(props))
    let ticks = 0
    surface.every(100, () => {
      const s = surface.state
      if (!s?.game || !s.playing || s.game.over) return
      if (++ticks < dropEvery(s.game.lines)) return
      ticks = 0
      const game = fall(s.game)
      if (game.over) surface.post({ game: 'tetris', score: game.score })
      surface.setState({ ...s, game })
    })
    surface.onKey(({ key }) => {
      const s = surface.state
      if (!s) return
      // the space bar may arrive as the character or by name
      const k = key === 'space' ? ' ' : key.toLowerCase()
      if (!s.game || s.game.over || k === 'r') {
        if (boardRows() < 6) return
        surface.setState({ ...s, banner: false, playing: true, game: newTetris(boardCols(), boardRows()) })
        return
      }
      if (k === 'p') {
        surface.setState({ ...s, banner: false, playing: !s.playing })
        return
      }
      const g = s.game
      const game = k === 'left' || k === 'a' ? shift(g, -1)
        : k === 'right' || k === 'd' ? shift(g, 1)
        : k === 'up' || k === 'w' || k === 'x' ? rotate(g)
        : k === 'down' || k === 's' ? fall(g)
        : k === ' ' ? drop(g)
        : undefined
      if (!game) return
      if (game.over) surface.post({ game: 'tetris', score: game.score })
      surface.setState({ ...s, banner: false, playing: true, game })
    })
  }
  claudeDone(props, surface)

  const s = surface.state
  const g = s?.game
  const bw = g?.w ?? boardCols()
  const bh = g?.h ?? boardRows()
  const falling = new Map((g && !g.over ? cells(g.piece) : []).map(([x, y]) => [`${x},${y}`, g!.piece.kind]))
  const rows = grid(Text, bw, bh, (x, y) => {
    const kind = falling.get(`${x},${y}`) ?? (g?.board[y]?.[x] ?? 0) - 1
    return kind >= 0 ? ['██', COLORS[kind]] : [' ·', 'gray']
  })
  const text = !g ? 'tetris · click here, then any key · ←→ move · ↑ rotate · ↓ soft drop · space drop · p pause'
    : g.over ? `tetris · game over · score ${g.score} · lines ${g.lines} · r plays again`
    : !s?.playing ? `tetris · paused · score ${g.score} · p resumes`
    : `tetris · score ${g.score} · lines ${g.lines} · next ${NAMES[g.next]} · p pause`
  return (
    <Box flexDirection="column">
      <Box flexDirection="column" borderStyle="round" borderColor={g?.over ? 'red' : 'cyan'} width={bw * 2 + 2}>{rows}</Box>
      {statusLine(Text, !!s?.banner, `${text} · best ${props?.best ?? 0}`)}
    </Box>
  )
}
