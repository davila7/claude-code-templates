/* @jsx h */
import type { ClientElements, ClientSurface } from 'claude-code'

// Shared by the aitmpl game boards. A board is a surface module: it runs on the drawing thread
// with its own frame clock (surface.every), keys once a click gives it focus (Esc gives the
// prompt back) and the mouse. Never name a local `h` here: every JSX tag compiles to a call of `h`.

/** What the hooks module hands every board: the best score, and a counter bumped per finished turn. */
export type Props = { best?: number; done?: number } | undefined
export type Base = { playing: boolean; banner: boolean; seenDone: number }
/** A cell as drawn: two characters, a colour, an optional background. */
export type Paint = readonly [glyph: string, color?: string, bg?: string]
type TextTag = ClientElements['Text']

export const base = (props: Props): Base => ({ playing: false, banner: false, seenDone: props?.done ?? 0 })

/** Claude finished a turn (props.done moved): show the banner and pause, once per turn. */
export function claudeDone<S extends Base>(props: Props, surface: ClientSurface<S>, pause = true) {
  const s = surface.state
  const done = props?.done ?? 0
  if (s && done !== s.seenDone) surface.setState({ ...s, seenDone: done, banner: true, playing: pause ? false : s.playing })
}

export function statusLine(Text: TextTag, banner: boolean, text: string) {
  return banner
    ? <Text color="yellow" bold wrap="truncate-end">{`● Claude is done · ${text}`}</Text>
    : <Text dimColor wrap="truncate-end">{text}</Text>
}

type Run = [text: string, color?: string, bg?: string]

/** One row of cells as runs of equal colour, so a row costs a handful of nodes rather than one per cell. */
function runs(cols: number, y: number, at: (x: number, y: number) => Paint): Run[] {
  const out: Run[] = []
  for (let x = 0; x < cols; x++) {
    const [glyph, color, bg] = at(x, y)
    const last = out[out.length - 1]
    if (last && last[1] === color && last[2] === bg) last[0] += glyph
    else out.push([glyph, color, bg])
  }
  return out
}

/** A board of two-character cells (a terminal cell is about twice as tall as wide, so two make a square). */
export function grid(Text: TextTag, cols: number, rowCount: number, at: (x: number, y: number) => Paint) {
  return Array.from({ length: Math.max(0, rowCount) }, (_, y) => (
    <Text>{runs(cols, y, at).map(([t, c, b]) => (b ? <Text color={c} backgroundColor={b}>{t}</Text> : <Text color={c}>{t}</Text>))}</Text>
  ))
}

/** The space bar arrives as the character or by name, depending on the terminal. */
export const isSpace = (key: string) => key === ' ' || key === 'space'
