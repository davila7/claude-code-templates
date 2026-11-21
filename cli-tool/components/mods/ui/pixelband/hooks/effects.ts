/**
 * The band's moods. Each is a pure function of the pixel art and the time since the mood started,
 * so frames are reproducible (and testable) and a timer just asks for the next one.
 *
 *   intro    the art dissolves in, pixel by pixel, after /pixelband set
 *   working  a band of light sweeps across while Claude is working
 *   done     a bright flash with a few sparkles when a turn finishes
 *   error    a glitch: rows jump, colour channels split, a red tint that fades out
 */
import { TRANSPARENT, type Art } from './pixelate'

export type Mood = 'idle' | 'intro' | 'working' | 'done' | 'error'

/** How long the one-shot moods last before the band settles, in ms. */
export const DURATION: Record<'intro' | 'done' | 'error', number> = { intro: 700, done: 900, error: 1400 }

/** The frame interval the animation runs at while a mood is playing. */
export const FRAME_MS = 80

const WHITE = 0xffffff
const RED = 0xff2a4a

/** Deterministic pseudo-random in [0, 1) from integers (a small integer hash). */
export function hash(a: number, b: number, c: number): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const R = (c: number) => (c >> 16) & 255
const G = (c: number) => (c >> 8) & 255
const B = (c: number) => c & 255
const rgb = (r: number, g: number, b: number) => ((r << 16) | (g << 8) | b) >>> 0

/** Blend `c` toward `to` by `k` (0..1), leaving transparent pixels alone. */
export function mix(c: number, to: number, k: number): number {
  if (c === TRANSPARENT || k <= 0) return c
  const m = (a: number, b: number) => Math.round(a + (b - a) * Math.min(1, k))
  return rgb(m(R(c), R(to)), m(G(c), G(to)), m(B(c), B(to)))
}

/** Whether a mood plays once and then settles back. */
export function isOneShot(m: Mood): m is 'intro' | 'done' | 'error' {
  return m === 'intro' || m === 'done' || m === 'error'
}

/** The frame for `mood`, `t` ms after it started. */
export function frame(art: Art, mood: Mood, t: number): Uint32Array {
  const { w, h, px } = art
  const out = new Uint32Array(px)
  if (mood === 'idle') return out

  if (mood === 'intro') {
    const p = Math.min(1, t / DURATION.intro)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x
        const at = hash(x, y, 7)
        if (at > p) out[i] = TRANSPARENT                 // not revealed yet
        else if (p - at < 0.1) out[i] = mix(px[i], WHITE, 0.7) // just revealed: a brief glint
      }
    }
    return out
  }

  if (mood === 'working') {
    // A diagonal band of light, one sweep every 1.1 s, looping while Claude works.
    const period = w + h + 6
    const pos = ((t / 1100) % 1) * period - 3
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const d = Math.abs(x + y - pos)
        if (d < 2.5) out[y * w + x] = mix(px[y * w + x], WHITE, (1 - d / 2.5) * 0.55)
      }
    }
    return out
  }

  if (mood === 'done') {
    const p = Math.min(1, t / DURATION.done)
    const flash = 0.85 * (1 - p) ** 2
    const tick = Math.floor(t / FRAME_MS)
    for (let i = 0; i < out.length; i++) {
      if (px[i] === TRANSPARENT) continue
      out[i] = hash(i, tick, 11) < 0.06 * (1 - p) ? WHITE : mix(px[i], WHITE, flash)
    }
    return out
  }

  // error: glitch
  const p = Math.min(1, t / DURATION.error)
  const k = 1 - p
  const tick = Math.floor(t / FRAME_MS)
  for (let y = 0; y < h; y++) {
    const jump = hash(y, tick, 3) < 0.35 * k ? Math.round((hash(y, tick, 5) - 0.5) * 6 * k) : 0
    const dim = y % 2 === tick % 2 ? 0.15 * k : 0
    for (let x = 0; x < w; x++) {
      const at = (dx: number) => px[y * w + Math.min(w - 1, Math.max(0, x - jump + dx))]
      const mid = at(0)
      if (mid === TRANSPARENT) { out[y * w + x] = TRANSPARENT; continue }
      // channel split: red from the right neighbour, blue from the left
      const rs = at(1), bs = at(-1)
      const split = rgb(rs === TRANSPARENT ? R(mid) : R(rs), G(mid), bs === TRANSPARENT ? B(mid) : B(bs))
      let c = mix(mid, split, k) // the split fades out with the glitch, so the art settles back exactly
      c = mix(c, RED, 0.35 * k)
      if (dim) c = mix(c, 0x000000, dim)
      out[y * w + x] = c
    }
  }
  return out
}
