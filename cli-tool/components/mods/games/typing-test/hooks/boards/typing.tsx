/* @jsx h */
import type { ClientSurface } from 'claude-code'
import { base, claudeDone, statusLine, type Base, type Props } from './common.tsx'
import { accuracy, newTyping, press, wpm, type TypingGame } from '../games/typing.ts'

type State = Base & { game: TypingGame; ms: number; started: boolean }
type Run = [text: string, color: string, bg?: string]

export default function Typing(props: Props, surface: ClientSurface<State>) {
  const { Box, Text } = surface.elements
  const fresh = (s: State): State => ({ ...s, banner: false, playing: false, started: false, ms: 0, game: newTyping(Math.random, Math.max(20, surface.columns - 4)) })

  if (surface.state === undefined) {
    surface.setState({ ...base(props), game: newTyping(), ms: 0, started: false })
    // the clock runs from the first key to the last correct one, and stops while Claude's banner shows
    surface.every(100, () => {
      const s = surface.state
      if (s?.started && s.playing && !s.game.done) surface.setState({ ...s, ms: s.ms + 100 })
    })
    surface.onKey(({ key, ctrl, meta }) => {
      const s = surface.state
      if (!s || ctrl || meta) return
      // Tab skips to another line; Enter after a finished line starts the next
      if (key === 'tab' || (key === 'return' && s.game.done)) return surface.setState(fresh(s))
      // the space bar may arrive as the character or by name
      const game = press(s.game, key === 'space' ? ' ' : key)
      if (game === s.game) return
      if (game.done) surface.post({ game: 'typing', score: wpm(game.text.length, s.ms) })
      surface.setState({ ...s, banner: false, playing: true, started: true, game })
    })
  }
  claudeDone(props, surface)

  const s = surface.state
  const g = s?.game
  if (!s || !g) return <Text dimColor>typing</Text>

  // typed characters green when right, the expected character on red when wrong, the cursor
  // inverted, the rest dim; one span per run of the same style
  const runs: Run[] = []
  for (let i = 0; i < g.text.length; i++) {
    const style: Run = i < g.typed.length
      ? g.typed[i] === g.text[i] ? [g.text[i], 'green'] : [g.text[i], 'whiteBright', 'red']
      : i === g.typed.length ? [g.text[i], 'black', 'white'] : [g.text[i], 'gray']
    const last = runs[runs.length - 1]
    if (last && last[1] === style[1] && last[2] === style[2]) last[0] += style[0]
    else runs.push(style)
  }
  const seconds = (s.ms / 1000).toFixed(1)
  const text = g.done ? `typing · ${wpm(g.text.length, s.ms)} wpm · ${accuracy(g)}% accuracy · ${seconds}s · Enter for another line`
    : !s.started ? 'typing · click here and type the line · Tab skips to another'
    : `typing · ${wpm(g.typed.length, s.ms)} wpm · ${accuracy(g)}% · ${seconds}s · Tab skips`
  return (
    <Box flexDirection="column">
      <Box borderStyle="round" borderColor={g.done ? 'green' : 'gray'} paddingX={1}>
        <Text>{runs.map(([t, c, b]) => (b ? <Text color={c} backgroundColor={b}>{t}</Text> : <Text color={c}>{t}</Text>))}</Text>
      </Box>
      {statusLine(Text, s.banner, `${text} · best ${props?.best ?? 0} wpm`)}
    </Box>
  )
}
