/* @jsx h */
import type { ClientSurface } from 'claude-code'
import { base, claudeDone, grid, statusLine, type Base, type Props } from './common.tsx'
import { newSnake, step, turn, type SnakeGame } from '../games/snake.ts'

type State = Base & { game?: SnakeGame }

export default function Snake(props: Props, surface: ClientSurface<State>) {
  const { Box, Text } = surface.elements
  const size = () => ({ bw: Math.floor((surface.columns - 2) / 2), bh: surface.rows - 3 })

  if (surface.state === undefined) {
    surface.setState(base(props))
    surface.every(100, () => {
      const s = surface.state
      if (!s?.game || !s.playing || s.game.over) return
      const game = step(s.game)
      if (game.over) surface.post({ game: 'snake', score: game.score })
      surface.setState({ ...s, game })
    })
    surface.onKey(({ key }) => {
      const s = surface.state
      if (!s) return
      // the space bar may arrive as the character or by name
      if (key === ' ' || key === 'space' || key === 'p') {
        if (s.game && !s.game.over) surface.setState({ ...s, banner: false, playing: !s.playing })
        return
      }
      // no round yet, or the last one ended: an arrow (or r) starts a new one
      if (!s.game || s.game.over || key === 'r') {
        const { bw, bh } = size()
        if (bw < 4 || bh < 3) return
        surface.setState({ ...s, banner: false, playing: true, game: turn(newSnake(bw, bh), key) })
        return
      }
      surface.setState({ ...s, banner: false, playing: true, game: turn(s.game, key) })
    })
  }
  claudeDone(props, surface)

  const s = surface.state
  const g = s?.game
  const { bw, bh } = g ? { bw: g.w, bh: g.h } : size()
  const head = g?.snake[0]
  const body = new Set(g?.snake.slice(1).map(p => `${p[0]},${p[1]}`))
  const rows = grid(Text, bw, bh, (x, y) =>
    head && head[0] === x && head[1] === y ? ['██', 'greenBright']
    : body.has(`${x},${y}`) ? ['▓▓', 'green']
    : g && g.food[0] === x && g.food[1] === y ? ['██', 'red']
    : ['  '])
  const text = !g ? 'snake · click here, then an arrow key · wasd works too'
    : g.over ? `snake · game over · score ${g.score} · an arrow or r plays again`
    : !s?.playing ? `snake · paused · score ${g.score} · space resumes`
    : `snake · score ${g.score} · space pauses`
  return (
    <Box flexDirection="column">
      <Box flexDirection="column" borderStyle="round" borderColor={g?.over ? 'red' : 'green'} width={Math.max(0, bw) * 2 + 2}>{rows}</Box>
      {statusLine(Text, !!s?.banner, `${text} · best ${props?.best ?? 0}`)}
    </Box>
  )
}
