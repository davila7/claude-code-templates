/* @jsx h */
import type { ClientSurface } from 'claude-code'
import { base, claudeDone, grid, statusLine, type Base, type Props } from './common.tsx'
import { BIRD_X, birdRow, flap, gapSize, newFlappy, tick, type FlappyGame } from '../games/flappy.ts'

type State = Base & { game?: FlappyGame }

export default function Flappy(props: Props, surface: ClientSurface<State>) {
  const { Box, Text } = surface.elements
  const size = () => ({
    bw: Math.max(12, Math.min(40, Math.floor((surface.columns - 2) / 2))),
    bh: Math.max(6, Math.min(16, surface.rows - 3)),
  })
  const start = () => {
    const s = surface.state
    if (!s) return
    const { bw, bh } = size()
    surface.setState({ ...s, banner: false, playing: true, game: flap(newFlappy(bw, bh)) })
  }
  // space, up, Enter or a click: flap, or start a new round when there is none
  const press = () => {
    const s = surface.state
    if (!s) return
    if (!s.game || s.game.over) return start()
    surface.setState({ ...s, banner: false, playing: true, game: flap(s.game) })
  }

  if (surface.state === undefined) {
    surface.setState(base(props))
    surface.every(100, () => {
      const s = surface.state
      if (!s?.game || !s.playing || s.game.over) return
      const game = tick(s.game)
      if (game.over) surface.post({ game: 'flappy', score: game.score })
      surface.setState({ ...s, game })
    })
    surface.onKey(({ key }) => {
      const s = surface.state
      if (!s) return
      // the space bar may arrive as the character or by name
      const k = key === 'space' ? ' ' : key.toLowerCase()
      if (k === 'p') {
        if (s.game && !s.game.over) surface.setState({ ...s, banner: false, playing: !s.playing })
      } else if (k === 'r') {
        start()
      } else if (k === ' ' || k === 'up' || k === 'w' || k === 'return') {
        press()
      }
    })
    surface.onPointer(ev => { if (ev.type === 'down') press() })
  }
  claudeDone(props, surface)

  const s = surface.state
  const g = s?.game
  const { bw, bh } = g ? { bw: g.w, bh: g.h } : size()
  const row = g ? birdRow(g) : Math.floor(bh / 2)
  const opening = gapSize(bh)
  const rows = grid(Text, bw, bh, (x, y) => {
    if (x === BIRD_X && y === row) return ['▓▓', g?.over ? 'red' : 'yellowBright']
    const pipe = g?.pipes.find(p => p.x === x)
    if (pipe && (y < pipe.gap || y >= pipe.gap + opening)) return ['██', 'green']
    return ['  ']
  })
  const text = !g ? 'flappy · click here, then space or click to flap · p pause'
    : g.over ? `flappy · crashed · score ${g.score} · space or click flies again`
    : !s?.playing ? `flappy · paused · score ${g.score} · p resumes`
    : `flappy · score ${g.score} · space or click flaps`
  return (
    <Box flexDirection="column">
      <Box flexDirection="column" borderStyle="round" borderColor={g?.over ? 'red' : 'blue'} width={bw * 2 + 2}>{rows}</Box>
      {statusLine(Text, !!s?.banner, `${text} · best ${props?.best ?? 0}`)}
    </Box>
  )
}
