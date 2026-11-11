/* @jsx h */
import type { ClientSurface } from 'claude-code'
import { base, claudeDone, grid, statusLine, type Base, type Props } from './common.tsx'
import { newPong, nudge, place, tick, WIN, type PongGame } from '../games/pong.ts'

type State = Base & { game?: PongGame }

export default function Pong(props: Props, surface: ClientSurface<State>) {
  const { Box, Text } = surface.elements
  const size = () => ({
    bw: Math.max(16, Math.min(40, Math.floor((surface.columns - 2) / 2))),
    bh: Math.max(8, Math.min(15, surface.rows - 3)),
  })
  // the first key or click of a round starts it
  const ensure = (s: State): State => {
    if (s.game && !s.game.over) return s
    const { bw, bh } = size()
    return { ...s, game: newPong(bw, bh) }
  }

  if (surface.state === undefined) {
    surface.setState(base(props))
    surface.every(100, () => {
      const s = surface.state
      if (!s?.game || !s.playing || s.game.over) return
      const game = tick(s.game)
      // best is the winning margin
      if (game.over) surface.post({ game: 'pong', score: game.scoreYou - game.scoreCpu })
      surface.setState({ ...s, game })
    })
    surface.onKey(({ key }) => {
      const s = surface.state
      if (!s) return
      // the space bar may arrive as the character or by name
      const k = key === 'space' ? ' ' : key.toLowerCase()
      if (k === 'p' || k === ' ') {
        if (s.game && !s.game.over) surface.setState({ ...s, banner: false, playing: !s.playing })
        return
      }
      if (k === 'r') {
        const { bw, bh } = size()
        surface.setState({ ...s, banner: false, playing: true, game: newPong(bw, bh) })
        return
      }
      const rows = k === 'up' || k === 'w' ? -2 : k === 'down' || k === 's' ? 2 : 0
      if (!rows) return
      const next = ensure(s)
      surface.setState({ ...next, banner: false, playing: true, game: nudge(next.game!, rows) })
    })
    // the paddle follows the pointer over the board (the border takes the first row)
    surface.onPointer(ev => {
      const s = surface.state
      if (!s || (ev.type !== 'move' && ev.type !== 'down')) return
      if (ev.type === 'move' && (!s.game || s.game.over || !s.playing)) return
      const next = ensure(s)
      surface.setState({ ...next, banner: false, playing: true, game: place(next.game!, ev.y - 1) })
    })
  }
  claudeDone(props, surface)

  const s = surface.state
  const g = s?.game
  const { bw, bh } = g ? { bw: g.w, bh: g.h } : size()
  const rows = grid(Text, bw, bh, (x, y) => {
    if (!g) return x === Math.floor(bw / 2) && y % 2 === 0 ? [' ·', 'gray'] : ['  ']
    if (x === 0 && y >= g.you && y < g.you + g.pad) return ['██', 'cyan']
    const cpu = Math.round(g.cpu)
    if (x === bw - 1 && y >= cpu && y < cpu + g.pad) return ['██', 'magenta']
    if (x === g.ball.x && y === Math.round(g.ball.y)) return ['██', 'whiteBright']
    return x === Math.floor(bw / 2) && y % 2 === 0 ? [' ·', 'gray'] : ['  ']
  })
  const text = !g ? `pong · click here, then ↑↓ or move the mouse · first to ${WIN}`
    : g.over ? `pong · ${g.scoreYou > g.scoreCpu ? 'you win' : 'cpu wins'} ${g.scoreYou}:${g.scoreCpu} · r plays again`
    : !s?.playing ? `pong · paused · you ${g.scoreYou} : ${g.scoreCpu} cpu · space resumes`
    : `pong · you ${g.scoreYou} : ${g.scoreCpu} cpu · first to ${WIN} · ↑↓ or the mouse`
  return (
    <Box flexDirection="column">
      <Box flexDirection="column" borderStyle="round" borderColor={g?.over ? (g.scoreYou > g.scoreCpu ? 'green' : 'red') : 'white'} width={bw * 2 + 2}>{rows}</Box>
      {statusLine(Text, !!s?.banner, `${text} · best margin ${props?.best ?? 0}`)}
    </Box>
  )
}
