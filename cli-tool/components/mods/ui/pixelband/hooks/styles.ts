/**
 * Looks. Every style takes the already-resized image and decides the final colours:
 *
 *   original   the image's own colours, cut to a small palette (the default)
 *   gameboy    four greens, dithered, like a 1989 handheld
 *   pico8      the PICO-8 fantasy console's 16 colours, lightly dithered
 *   mono       four greys, dithered
 *   sepia      warm browns, like an old photo
 *
 * Fixed retro palettes make any picture look deliberate, which helps with busy or dull images.
 */
import { medianCut, nearest, punch, TRANSPARENT, type Art } from './pixelate'
import type { Rgba } from './png'

export const STYLES = ['original', 'gameboy', 'pico8', 'mono', 'sepia'] as const
export type Style = (typeof STYLES)[number]

type Rgb = [number, number, number]

const PALETTES: Record<'gameboy' | 'pico8' | 'mono', Rgb[]> = {
  gameboy: [[15, 56, 15], [48, 98, 48], [139, 172, 15], [155, 188, 15]],
  pico8: [[0, 0, 0], [29, 43, 83], [126, 37, 83], [0, 135, 81], [171, 82, 54], [95, 87, 79], [194, 195, 199],
    [255, 241, 232], [255, 0, 77], [255, 163, 0], [255, 236, 39], [0, 228, 54], [41, 173, 255], [131, 118, 156],
    [255, 119, 168], [255, 204, 170]],
  mono: [[20, 20, 22], [90, 90, 96], [168, 168, 172], [240, 240, 236]],
}

/** How strongly each palette style dithers (0 = flat colour). */
const DITHER: Record<'gameboy' | 'pico8' | 'mono', number> = { gameboy: 0.5, pico8: 0.3, mono: 0.5 }

/** 4x4 ordered (Bayer) dither thresholds, centred on zero. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16 - 0.5)

const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v)
const pack = ([r, g, b]: Rgb) => ((r << 16) | (g << 8) | b) >>> 0

/**
 * A gentle auto-levels on brightness: stretch the darkest and brightest 1% out to the full range,
 * at half strength. Lifts flat, grey images without blowing out ones that were fine.
 */
function levels(src: Rgba): (c: Rgb) => Rgb {
  const lum: number[] = []
  for (let i = 0; i < src.data.length; i += 4) {
    if (src.data[i + 3] >= 128) lum.push(0.299 * src.data[i] + 0.587 * src.data[i + 1] + 0.114 * src.data[i + 2])
  }
  if (lum.length < 4) return (c) => c
  lum.sort((a, b) => a - b)
  const lo = lum[Math.floor(lum.length * 0.01)], hi = lum[Math.floor(lum.length * 0.99)]
  if (hi - lo < 8) return (c) => c
  const scale = 255 / (hi - lo)
  return ([r, g, b]) => {
    const s = (v: number) => clamp(v + ((v - lo) * scale - v) * 0.5)
    return [s(r), s(g), s(b)]
  }
}

/**
 * Turn a resized image into pixel art in `style`. `colors` is the palette size for original/sepia.
 * `from` is what the brightness levels and palette are taken from: the image itself by default, or
 * a sample of an animation's frames, so every frame shares one palette and colours don't flicker.
 */
export function stylize(small: Rgba, style: Style, colors: number, from: Rgba = small): Art {
  const { width: w, height: h, data } = small
  const px = new Uint32Array(w * h)
  const lift = levels(from)
  const opaque = (i: number) => data[i * 4 + 3] >= 128
  const rgbAt = (i: number): Rgb => lift([data[i * 4], data[i * 4 + 1], data[i * 4 + 2]])
  const tone = (c: Rgb): Rgb => {
    if (style !== 'sepia') return punch(c[0], c[1], c[2])
    const l = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
    return [clamp(l * 1.07 + 20), clamp(l * 0.9 + 8), clamp(l * 0.66)]
  }

  if (style === 'original' || style === 'sepia') {
    const toned: (Rgb | null)[] = []
    for (let i = 0; i < w * h; i++) toned.push(opaque(i) ? tone(rgbAt(i)) : null)
    let sample = toned.filter((c): c is Rgb => !!c)
    if (from !== small) {
      sample = []
      for (let i = 0; i < from.width * from.height; i++) {
        if (from.data[i * 4 + 3] >= 128) sample.push(tone(lift([from.data[i * 4], from.data[i * 4 + 1], from.data[i * 4 + 2]])))
      }
    }
    const palette = medianCut(sample, style === 'sepia' ? Math.min(colors, 8) : Math.max(2, colors))
    for (let i = 0; i < w * h; i++) {
      const c = toned[i]
      px[i] = c ? pack(nearest(c, palette)) : TRANSPARENT
    }
    return { w, h, px }
  }

  const palette = PALETTES[style]
  const amount = DITHER[style] * 64
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (!opaque(i)) { px[i] = TRANSPARENT; continue }
      const d = BAYER[(y & 3) * 4 + (x & 3)] * amount
      const [r, g, b] = rgbAt(i)
      px[i] = pack(nearest([clamp(r + d), clamp(g + d), clamp(b + d)], palette))
    }
  }
  return { w, h, px }
}
