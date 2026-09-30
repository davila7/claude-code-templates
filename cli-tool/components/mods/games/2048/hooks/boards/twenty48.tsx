/* @jsx h */
import type { ClientSurface } from 'claude-code'
import { base, claudeDone, statusLine, type Base, type Props } from './common.tsx'
import { move, new2048, SIZE, type G2048 } from '../games/twenty48.ts'

const TILE_COLORS: Record<number, string> = { 2: 'white', 4: 'whiteBright', 8: 'yellow', 16: 'yellowBright', 32: '#ff8800', 64: 'red', 128: 'magenta', 256: 'magentaBright', 512: 'blue', 1024: 'cyan', 2048: 'green' }
const SLIDE_KEYS: Record<string, string> = { left: 'left', right: 'right', up: 'up', down: 'down', a: 'left', d: 'right', w: 'up', s: 'down' }
type State = Base & { game: G2048 }

export default function Twenty48(props: Props, surface: ClientSurface<State>) {
  const { Box, Text } = surface.elements

  if (surface.state === undefined) {
    surface.setState({ ...base(props), game: new2048() })
    surface.onKey(({ key }) => {
      const s = surface.state
      if (!s) return
      const k = key.toLowerCase()
      if (k === 'r') {
        surface.setState({ ...s, banner: false, game: new2048() })
        return
      }
      if (!Object.hasOwn(SLIDE_KEYS, k)) {
        if (s.banner) surface.setState({ ...s, banner: false })
        return
      }
      const game = move(s.game, SLIDE_KEYS[k])
      if (game.over && !s.game.over) surface.post({ game: '2048', score: game.score })
      surface.setState({ ...s, banner: false, game })
    })
  }
  claudeDone(props, surface)

  const s = surface.state
  const g = s?.game
  const rows = Array.from({ length: SIZE }, (_, y) => (
    <Text>
      {Array.from({ length: SIZE }, (_, x) => {
        const v = g?.cells[y * SIZE + x] ?? 0
        const label = `${v ? String(v) : '·'}`.padStart(5) + ' '
        return v >= 128
          ? <Text color={TILE_COLORS[v] ?? 'greenBright'} bold>{label}</Text>
          : <Text color={v ? TILE_COLORS[v] : 'gray'}>{label}</Text>
      })}
    </Text>
  ))
  const text = !g ? '2048'
    : g.over ? `2048 · no moves left · score ${g.score} · r plays again`
    : `2048 · score ${g.score}${g.won ? ' · 2048 reached, keep going' : ''} · click here, then arrows or wasd · r restarts`
  return (
    <Box flexDirection="column">
      <Box flexDirection="column" borderStyle="round" borderColor={g?.over ? 'red' : 'yellow'} width={SIZE * 6 + 3}>{rows}</Box>
      {statusLine(Text, !!s?.banner, `${text} · best ${props?.best ?? 0}`)}
    </Box>
  )
}
