/**
 * Animations (from GIFs): the frames, their timing, and how they're kept in the store.
 *
 * The store holds 4 MiB across everything, so frames are kept as one shared palette of up to 255
 * colours plus a byte per pixel, rather than RGBA: a 120-frame loop fits in about 1.6 MB.
 */
import { medianCut, nearest } from './pixelate'
import type { Rgba } from './png'

export interface Anim { frames: Rgba[]; delays: number[]; total: number }

/** An animation as the store keeps it. Index 0 is see-through when `see` is set. */
export interface StoredAnim { palette: string; see: boolean; frames: string; delays: number[] }

type Rgb = [number, number, number]

export function makeAnim(frames: Rgba[], delays: number[]): Anim {
  return { frames, delays, total: delays.reduce((a, b) => a + b, 0) || 1 }
}

/** Which frame shows `t` ms into the loop. */
export function frameAt(anim: Anim, t: number): number {
  let x = ((t % anim.total) + anim.total) % anim.total
  for (let i = 0; i < anim.delays.length; i++) {
    if (x < anim.delays[i]) return i
    x -= anim.delays[i]
  }
  return anim.delays.length - 1
}

export function encodeAnim(frames: Rgba[], delays: number[]): StoredAnim {
  let see = false
  const sample: Rgb[] = []
  const total = frames.reduce((n, f) => n + f.width * f.height, 0)
  const every = Math.max(1, Math.floor(total / 60_000))
  let k = 0
  for (const f of frames) {
    for (let i = 0; i < f.width * f.height; i++) {
      if (f.data[i * 4 + 3] < 128) { see = true; continue }
      if (k++ % every === 0) sample.push([f.data[i * 4], f.data[i * 4 + 1], f.data[i * 4 + 2]])
    }
  }
  const colors = medianCut(sample, see ? 255 : 256)
  const offset = see ? 1 : 0
  const palette = new Uint8Array((colors.length + offset) * 3)
  colors.forEach((c, i) => palette.set(c, (i + offset) * 3))
  // Nearest palette entry per colour, remembered at 5 bits a channel: frames share most colours.
  const memo = new Map<number, number>()
  const indexOf = (r: number, g: number, b: number) => {
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)
    let v = memo.get(key)
    if (v === undefined) {
      const c = nearest([r, g, b], colors)
      v = colors.indexOf(c) + offset
      memo.set(key, v)
    }
    return v
  }
  const out = new Uint8Array(total)
  let o = 0
  for (const f of frames) {
    for (let i = 0; i < f.width * f.height; i++) {
      out[o++] = f.data[i * 4 + 3] < 128 ? 0 : indexOf(f.data[i * 4], f.data[i * 4 + 1], f.data[i * 4 + 2])
    }
  }
  return { palette: palette.toBase64(), see, frames: out.toBase64(), delays }
}

export function decodeAnim(w: number, h: number, s: StoredAnim): Anim {
  const pal = Uint8Array.fromBase64(s.palette), idx = Uint8Array.fromBase64(s.frames)
  const frames: Rgba[] = []
  for (let f = 0; f < s.delays.length; f++) {
    const data = new Uint8Array(w * h * 4)
    for (let i = 0; i < w * h; i++) {
      const v = idx[f * w * h + i]
      if (s.see && v === 0) continue
      data[i * 4] = pal[v * 3]; data[i * 4 + 1] = pal[v * 3 + 1]; data[i * 4 + 2] = pal[v * 3 + 2]; data[i * 4 + 3] = 255
    }
    frames.push({ width: w, height: h, data })
  }
  return makeAnim(frames, s.delays)
}

/** Frames of one width stacked into one tall image: a sample for a palette every frame shares. */
export function stack(frames: Rgba[]): Rgba {
  const w = frames[0].width
  const h = frames.reduce((n, f) => n + f.height, 0)
  const data = new Uint8Array(w * h * 4)
  let o = 0
  for (const f of frames) { data.set(f.data, o); o += f.data.length }
  return { width: w, height: h, data }
}

/** Up to `n` frames spread evenly through the loop. */
export function spread<T>(items: T[], n: number): T[] {
  if (items.length <= n) return items
  return Array.from({ length: n }, (_, i) => items[Math.floor((i * items.length) / n)])
}

