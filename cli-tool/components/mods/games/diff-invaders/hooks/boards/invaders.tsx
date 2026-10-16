/* @jsx h */
import type { ClientSurface } from 'claude-code'
import { base, claudeDone, grid, isSpace, statusLine, type Base, type Props } from './common.tsx'
import { fire, H, move, newInvaders, step, W, wave, type InvadersGame } from '../games/invaders.ts'

// Waves arrive as props: the hooks module keeps the last few diffs with a running number, and the
// board starts the next one it has not seen once the current wave is cleared.
type Diff = { seq: number; file: string; lines: string[] }
type InvadersProps = (Props & { diffs?: Diff[] }) | undefined
type State = Base & { game: InvadersGame; seenSeq: number; queue: Diff[] }

const TICK_MS = 110
// a wave to shoot while Claude has not written anything yet
const DEMO: Diff = { seq: 0, file: 'demo.ts', lines: ['export function invaders() {', '  const wave = diff.added', '  return shoot(wave)', '}'] }

export default function Invaders(props: InvadersProps, surface: ClientSurface<State>) {
  const { Box, Text } = surface.elements

  if (surface.state === undefined) {
    surface.setState({ ...base(props), playing: true, game: newInvaders(), seenSeq: props?.diffs?.at(-1)?.seq ?? 0, queue: [] })
    surface.every(TICK_MS, () => {
      const s = surface.state
      if (!s || !s.playing || s.game.over) return
      let game = step(s.game)
      let queue = s.queue
      if (game.cleared && queue.length > 0) {
        const [next, ...rest] = queue
        game = wave(game, next!.lines, next!.file)
        queue = rest
      }
      if (game.over) surface.post({ game: 'diff-invaders', score: game.score })
      surface.setState({ ...s, game, queue })
    })
    surface.onPointer(ev => {
      const s = surface.state
      if (!s || ev.type !== 'down') return
      surface.setState({ ...s, game: fire(s.game), banner: false })
    })
    surface.onKey(({ key }) => {
      const s = surface.state
      if (!s) return
      const k = key.toLowerCase()
      if (k === 'r') surface.setState({ ...s, game: wave(newInvaders(), DEMO.lines, DEMO.file), queue: [], playing: true, banner: false })
      else if (k === 'left' || k === 'a') surface.setState({ ...s, game: move(s.game, -1), banner: false })
      else if (k === 'right' || k === 'd') surface.setState({ ...s, game: move(s.game, 1), banner: false })
      else if (isSpace(k) || k === 'up' || k === 'w') surface.setState({ ...s, game: fire(s.game), banner: false })
      else if (k === 'p') surface.setState({ ...s, playing: !s.playing, banner: false })
    })
  }
  claudeDone(props, surface, false)

  // queue the diffs that arrived since the last draw
  const s0 = surface.state
  if (s0) {
    const fresh = (props?.diffs ?? []).filter(d => d.seq > s0.seenSeq)
    if (fresh.length > 0) surface.setState({ ...s0, queue: [...s0.queue, ...fresh], seenSeq: fresh[fresh.length - 1]!.seq })
  }

  const s = surface.state
  const g = s?.game ?? newInvaders()
  const aliens = new Map<number, string>()
  for (const a of g.aliens) if (a.alive) aliens.set(a.pos[1] * W + a.pos[0], a.glyph)
  const bombs = new Set(g.bombs.map(([x, y]) => y * W + x))
  const rows = grid(Text, W, H, (x, y) => {
    const k = y * W + x
    const glyph = aliens.get(k)
    if (glyph) return [glyph, y % 2 ? 'greenBright' : 'green']
    if (g.shot && g.shot[0] === x && g.shot[1] === y) return ['│ ', 'yellowBright']
    if (bombs.has(k)) return ['▾ ', 'red']
    if (y === H - 1 && x === g.ship) return [g.over ? '××' : '▟▙', 'cyan']
    return ['  ']
  })
  const pending = s?.queue.length ?? 0
  const text = g.over ? `diff invaders · game over · score ${g.score} · r plays a demo wave`
    : !s?.playing ? 'diff invaders · paused · p resumes'
    : g.cleared ? (pending > 0 ? 'diff invaders · next wave loading' : `diff invaders · score ${g.score} · waiting for Claude to write code · r shoots a demo wave`)
    : `diff invaders · ${g.file} · ← → move, space fires · ♥${g.lives} · score ${g.score}${pending ? ` · +${pending} waves queued` : ''}`
  return (
    <Box flexDirection="column">
      <Box flexDirection="column" borderStyle="round" borderColor={g.over ? 'red' : g.cleared ? 'gray' : 'green'} width={W * 2 + 2}>{rows}</Box>
      {statusLine(Text, !!s?.banner, `${text} · best ${props?.best ?? 0}`)}
    </Box>
  )
}
