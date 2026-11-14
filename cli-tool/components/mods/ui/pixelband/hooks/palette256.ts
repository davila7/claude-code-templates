/**
 * For terminals that only show 256 colours (macOS Terminal before macOS 26 is the big one).
 *
 * Claude Code rounds full colours down for these itself, by plain nearest colour, which sends dark
 * saturated colours to grey: a Game Boy's dark green comes out charcoal. So in 256-colour mode
 * pixelband picks from the terminal's palette first: the 6x6x6 colour cube and the 24 greys (the
 * first 16 are left out, since every theme redefines them), comparing colours in OKLab with extra
 * weight on hue, so greens stay green and oranges stay orange. The exact palette colours we hand
 * over pass through Claude Code unchanged.
 *
 * Dithering between palette colours was tried and dropped: at band resolution it reads as speckle,
 * not as a blend.
 */
import { TRANSPARENT } from './pixelate'

const LEVELS = [0, 95, 135, 175, 215, 255]

/** The 240 palette colours we use: cube (16-231), then greys (232-255). */
export const XTERM: number[] = []
for (const r of LEVELS) for (const g of LEVELS) for (const b of LEVELS) XTERM.push((r << 16) | (g << 8) | b)
for (let k = 0; k < 24; k++) { const v = 8 + 10 * k; XTERM.push((v << 16) | (v << 8) | v) }

/** Weight on OKLab's a/b (hue and saturation) relative to lightness. */
const CHROMA_WEIGHT = 3

const lin = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }

function oklab(r: number, g: number, b: number): [number, number, number] {
  const R = lin(r), G = lin(g), B = lin(b)
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B)
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B)
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

const PAL_LAB = XTERM.map((c) => oklab((c >> 16) & 255, (c >> 8) & 255, c & 255))

/** The palette colour closest to (r, g, b) the way it looks, keeping hue where it can. */
export function nearest256(r: number, g: number, b: number): number {
  const [L, A, B] = oklab(r, g, b)
  let best = 0, bestD = Infinity
  for (let i = 0; i < PAL_LAB.length; i++) {
    const [l, a, bb] = PAL_LAB[i]
    const d = (L - l) ** 2 + CHROMA_WEIGHT * ((A - a) ** 2 + (B - bb) ** 2)
    if (d < bestD) { bestD = d; best = i }
  }
  return XTERM[best]
}

/** Answers remembered per colour: a frame only has a few hundred. */
const memo = new Map<number, number>()

/** Map a frame onto the 256-colour palette; see-through pixels stay see-through. */
export function to256(px: Uint32Array): Uint32Array {
  const out = new Uint32Array(px.length)
  for (let i = 0; i < px.length; i++) {
    const c = px[i]
    if (c === TRANSPARENT) { out[i] = c; continue }
    let m = memo.get(c)
    if (m === undefined) {
      m = nearest256((c >> 16) & 255, (c >> 8) & 255, c & 255)
      if (memo.size > 50_000) memo.clear()
      memo.set(c, m)
    }
    out[i] = m
  }
  return out
}
