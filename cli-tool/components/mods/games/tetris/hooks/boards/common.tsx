/* @jsx h */
import type { ClientElements, ClientSurface } from 'claude-code'

// Shared by every board. A board is a surface module: it runs on the drawing thread with its own
// frame clock, keys (after a click gives it focus; Esc gives the prompt back) and mouse.
//
// Never name a local `h` in a board file: every JSX tag compiles to a call of `h`.

export type Props = { best?: number; done?: number; safe?: boolean } | undefined
export type Base = { playing: boolean; banner: boolean; seenDone: number }
export type Paint = readonly [glyph: string, color?: string, bg?: string]
type TextTag = ClientElements['Text']

export const base = (props: Props): Base => ({ playing: false, banner: false, seenDone: props?.done ?? 0 })

// the hooks module bumps props.done when Claude finishes a turn: pause and say so, once per turn
export function claudeDone<S extends Base>(props: Props, surface: ClientSurface<S>) {
  const s = surface.state
  const done = props?.done ?? 0
  if (s && done !== s.seenDone) surface.setState({ ...s, seenDone: done, banner: true, playing: false })
}

export function statusLine(Text: TextTag, banner: boolean, text: string) {
  return banner
    ? <Text color="yellow" bold wrap="truncate-end">{`● Claude is done · ${text}`}</Text>
    : <Text dimColor wrap="truncate-end">{text}</Text>
}

export type Run = [text: string, color?: string, bg?: string]

// one run per stretch of cells sharing both colors. A drawing the engine cannot fit in its node
// budget is worse than a coarser one, so maxRuns folds neighbours together, pair by pair, until
// the row fits: a merged pair keeps the left one's colors and every glyph.
export function runs(cols: number, y: number, at: (x: number, y: number) => Paint, maxRuns = Infinity): Run[] {
  let out: Run[] = []
  for (let x = 0; x < cols; x++) {
    const [glyph, color, bg] = at(x, y)
    const last = out[out.length - 1]
    if (last && last[1] === color && last[2] === bg) last[0] += glyph
    else out.push([glyph, color, bg])
  }
  while (out.length > Math.max(1, maxRuns)) {
    const folded: Run[] = []
    for (let i = 0; i < out.length; i += 2) {
      const [t, c, b] = out[i]
      const next = out[i + 1]
      folded.push(next ? [t + next[0], c, b] : [t, c, b])
    }
    out = folded
  }
  return out
}

// a board as rows of two-character cells (a terminal cell is about twice as tall as wide, so two
// make a square), one styled span per run of the same colors
export function grid(Text: TextTag, cols: number, rowCount: number, at: (x: number, y: number) => Paint, maxRuns = Infinity) {
  return Array.from({ length: Math.max(0, rowCount) }, (_, y) => (
    <Text>{runs(cols, y, at, maxRuns).map(([t, c, b]) => (b ? <Text color={c} backgroundColor={b}>{t}</Text> : <Text color={c}>{t}</Text>))}</Text>
  ))
}
