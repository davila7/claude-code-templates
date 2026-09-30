/* @jsx h */
import type { ClientSurface } from 'claude-code'
import { base, claudeDone, grid, statusLine, type Base, type Props } from './common.tsx'
import { fire, newInvaders, shift, tick, type InvadersGame, type Pt } from '../games/invaders.ts'

const ROW_COLORS = ['magentaBright', 'cyan', 'green', 'yellow']
type State = Base & { game?: InvadersGame }

export default function Invaders(props: Props, surface: ClientSurface<State>) {
  const { Box, Text } = surface.elements
  const size = () => ({
    bw: Math.max(20, Math.min(30, Math.floor((surface.columns - 2) / 2))),
    bh: Math.max(10, Math.min(16, surface.rows - 3)),
  })
  // the running round, or a new one when there is none or the last one ended
  const ensure = (s: State): InvadersGame => (s.game && !s.game.over ? s.game : newInvaders(size().bw, size().bh))

  if (surface.state === undefined) {
    surface.setState(base(props))
    surface.every(100, () => {
      const s = surface.state
      if (!s?.game || !s.playing || s.game.over) return
      const game = tick(s.game)
      if (game.over) surface.post({ game: 'invaders', score: game.score })
      surface.setState({ ...s, game })
    })
    surface.onKey(({ key }) => {
      const s = surface.state
      if (!s) return
      // the space bar may arrive as the character or by name
      const k = key === 'space' ? ' ' : key.toLowerCase()
      if (k === 'p') {
        if (s.game && !s.game.over) surface.setState({ ...s, banner: false, playing: !s.playing })
        return
      }
      if (k === 'r') {
        surface.setState({ ...s, banner: false, playing: true, game: newInvaders(size().bw, size().bh) })
        return
      }
      const g = ensure(s)
      const game = k === 'left' || k === 'a' ? shift(g, -1)
        : k === 'right' || k === 'd' ? shift(g, 1)
        : k === ' ' || k === 'up' || k === 'w' ? fire(g)
        : undefined
      if (game) surface.setState({ ...s, banner: false, playing: true, game })
    })
    // the ship follows the pointer over the board and a click fires (the border takes the first column)
    surface.onPointer(ev => {
      const s = surface.state
      if (!s || (ev.type !== 'move' && ev.type !== 'down')) return
      if (ev.type === 'move' && (!s.game || s.game.over || !s.playing)) return
      const g = ensure(s)
      const moved = { ...g, ship: Math.max(0, Math.min(g.w - 1, Math.floor((ev.x - 1) / 2))) }
      surface.setState({ ...s, banner: false, playing: true, game: ev.type === 'down' ? fire(moved) : moved })
    })
  }
  claudeDone(props, surface)

  const s = surface.state
  const g = s?.game
  const { bw, bh } = g ? { bw: g.w, bh: g.h } : size()
  const top = g ? Math.min(...g.aliens.map(a => a[1])) : 0
  const flap = (g?.ticks ?? 0) % 10 < 5
  const has = (list: Pt[] | undefined, x: number, y: number) => !!list?.some(p => p[0] === x && p[1] === y)
  const rows = grid(Text, bw, bh, (x, y) => {
    if (!g) return ['  ']
    if (y === g.h - 1 && x === g.ship) return ['▟▙', 'greenBright']
    if (has(g.aliens, x, y)) return [flap ? '▚▞' : '▞▚', ROW_COLORS[(y - top) % ROW_COLORS.length]]
    if (has(g.shots, x, y)) return [' |', 'yellowBright']
    if (has(g.bombs, x, y)) return [' :', 'red']
    return ['  ']
  })
  const text = !g ? 'invaders · click here, then ←→ move · space fires · or the mouse'
    : g.over ? `invaders · game over · score ${g.score} · wave ${g.wave} · r plays again`
    : !s?.playing ? `invaders · paused · score ${g.score} · p resumes`
    : `invaders · score ${g.score} · wave ${g.wave} · lives ${'▲'.repeat(g.lives)} · space fires · p pause`
  return (
    <Box flexDirection="column">
      <Box flexDirection="column" borderStyle="round" borderColor={g?.over ? 'red' : 'magenta'} width={bw * 2 + 2}>{rows}</Box>
      {statusLine(Text, !!s?.banner, `${text} · best ${props?.best ?? 0}`)}
    </Box>
  )
}
