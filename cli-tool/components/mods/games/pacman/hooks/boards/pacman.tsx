/* @jsx h */
import type { ClientSurface } from 'claude-code'
import { base, claudeDone, grid, isSpace, statusLine, type Base, type Props } from './common.tsx'
import { MAZE, newPacman, nextLevel, step, turn, type PacmanGame } from '../games/pacman.ts'

type State = Base & { game?: PacmanGame }

const TICK_MS = 160

export default function Pacman(props: Props, surface: ClientSurface<State>) {
  const { Box, Text } = surface.elements

  if (surface.state === undefined) {
    surface.setState(base(props))
    surface.every(TICK_MS, () => {
      const s = surface.state
      if (!s?.game || !s.playing || s.game.over) return
      let game = step(s.game)
      if (game.won) {
        surface.post({ game: 'pacman', score: game.score })
        game = nextLevel(game)
      }
      if (game.over) surface.post({ game: 'pacman', score: game.score })
      surface.setState({ ...s, game })
    })
    surface.onKey(({ key }) => {
      const s = surface.state
      if (!s) return
      const k = key.toLowerCase()
      if (isSpace(k) || k === 'p') {
        if (s.game && !s.game.over) surface.setState({ ...s, banner: false, playing: !s.playing })
        return
      }
      // no round yet, or the last one ended: an arrow (or r) starts a new one
      if (!s.game || s.game.over || k === 'r') {
        surface.setState({ ...s, banner: false, playing: true, game: turn(newPacman(), k) })
        return
      }
      surface.setState({ ...s, banner: false, playing: true, game: turn(s.game, k) })
    })
  }
  claudeDone(props, surface)

  const s = surface.state
  const g = s?.game
  const w = MAZE[0]!.length
  // never `h`: that is the JSX factory in a surface module
  const mazeH = MAZE.length
  const ghostAt = new Map<number, { color: string; eaten: boolean }>()
  for (const ghost of g?.ghosts ?? []) ghostAt.set(ghost.pos[1] * w + ghost.pos[0], { color: ghost.color, eaten: ghost.eaten })
  const rows = grid(Text, w, mazeH, (x, y) => {
    const k = y * w + x
    if (g?.walls.has(k) ?? MAZE[y]![x] === '#') return ['██', 'blue']
    if (g && g.pac[0] === x && g.pac[1] === y) return [g.over ? '××' : g.dir === 'left' ? '◖█' : g.dir === 'right' ? '█◗' : '██', 'yellow']
    const ghost = ghostAt.get(k)
    if (ghost) return ghost.eaten ? ['ᵒᵒ', 'white'] : g && g.fright > 0 ? [g.fright < 12 && g.tick % 2 === 0 ? '▒▒' : '▓▓', 'blueBright'] : ['▛▜', ghost.color]
    if (g ? g.power.has(k) : MAZE[y]![x] === 'o') return [' ●', 'yellowBright']
    if (g ? g.pellets.has(k) : MAZE[y]![x] === '.') return [' ·', 'yellow']
    return ['  ']
  })
  const lives = g ? '♥'.repeat(Math.max(0, g.lives)) : '♥♥♥'
  const text = !g ? 'pac-man · click here, then an arrow key · wasd works too'
    : g.over ? `pac-man · game over · score ${g.score} · an arrow or r plays again`
    : !s?.playing ? `pac-man · paused · score ${g.score} · space resumes`
    : `pac-man · score ${g.score} · level ${g.level} · ${lives}${g.fright > 0 ? ' · eat them!' : ''} · space pauses`
  return (
    <Box flexDirection="column">
      <Box flexDirection="column" borderStyle="round" borderColor={g?.over ? 'red' : g && g.fright > 0 ? 'blueBright' : 'yellow'} width={w * 2 + 2}>{rows}</Box>
      {statusLine(Text, !!s?.banner, `${text} · best ${props?.best ?? 0}`)}
    </Box>
  )
}
