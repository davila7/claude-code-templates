/**
 * Image -> pixel art.
 *
 * A terminal band is tiny (think 40x12 pixels), and a photo shrunk that far just looks blurry. So
 * instead of pretending to be a photo, we lean into pixel art: area-average down to the grid, give
 * the colours a little punch, then cut them down to a small palette so every pixel reads as a
 * deliberate block of colour.
 */
import type { Rgba } from './png'

/** Pixel art: `px` holds 0x00RRGGBB per pixel, or TRANSPARENT where the image was see-through. */
export interface Art { w: number; h: number; px: Uint32Array }

export const TRANSPARENT = 0x01000000

/**
 * Pixel grid for a band `rows` terminal rows tall (two pixels per row), keeping the image's shape
 * and never wider than `maxCols`. Half-block pixels are roughly square, so aspect carries over.
 */
export function fit(srcW: number, srcH: number, rows: number, maxCols: number): { w: number; h: number } {
  let h = Math.max(2, rows * 2)
  let w = Math.max(1, Math.round((h * srcW) / srcH))
  if (w > maxCols) {
    w = Math.max(1, maxCols)
    h = Math.max(2, Math.round((w * srcH) / srcW))
  }
  return { w, h }
}

/** A rectangle of the source image, in source pixels (fractional is fine). */
export interface Rect { x: number; y: number; w: number; h: number }

/** Where the banner looks: the crop's centre as a fraction of the image, and how far it's zoomed in. */
export interface View { focusX: number; focusY: number; zoom: number }

export const DEFAULT_VIEW: View = { focusX: 0.5, focusY: 0.5, zoom: 1 }

/**
 * The part of the image a banner of shape `aspect` (width / height) shows: the biggest rectangle of
 * that shape that fits, shrunk by `zoom`, centred on the focus and kept inside the image.
 */
export function cropRect(srcW: number, srcH: number, aspect: number, view: View): Rect {
  let w = srcW, h = srcW / aspect
  if (h > srcH) { h = srcH; w = srcH * aspect }
  const z = Math.max(1, view.zoom)
  w /= z; h /= z
  const x = Math.min(srcW - w, Math.max(0, view.focusX * srcW - w / 2))
  const y = Math.min(srcH - h, Math.max(0, view.focusY * srcH - h / 2))
  return { x, y, w, h }
}

/** Area-average resize. Colour is weighted by alpha so transparent edges don't turn grey. */
export function downscale(src: Rgba, w: number, h: number): Rgba {
  return downscaleRegion(src, { x: 0, y: 0, w: src.width, h: src.height }, w, h)
}

/** Area-average the `rect` part of `src` down (or up) to `w x h`. */
export function downscaleRegion(src: Rgba, rect: Rect, w: number, h: number): Rgba {
  const out = new Uint8Array(w * h * 4)
  const sx = rect.w / w, sy = rect.h / h
  for (let ty = 0; ty < h; ty++) {
    const y0 = rect.y + ty * sy, y1 = y0 + sy
    for (let tx = 0; tx < w; tx++) {
      const x0 = rect.x + tx * sx, x1 = x0 + sx
      let r = 0, g = 0, b = 0, a = 0, total = 0
      for (let y = Math.max(0, Math.floor(y0)); y < Math.min(src.height, Math.ceil(y1)); y++) {
        const wy = Math.min(y + 1, y1) - Math.max(y, y0)
        for (let x = Math.max(0, Math.floor(x0)); x < Math.min(src.width, Math.ceil(x1)); x++) {
          const wgt = wy * (Math.min(x + 1, x1) - Math.max(x, x0))
          const o = (y * src.width + x) * 4
          const al = src.data[o + 3] * wgt
          r += src.data[o] * al; g += src.data[o + 1] * al; b += src.data[o + 2] * al
          a += al; total += wgt
        }
      }
      const o = (ty * w + tx) * 4
      if (a > 0) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = b / a }
      out[o + 3] = total > 0 ? a / total : 0
    }
  }
  return { width: w, height: h, data: out }
}

/** Shrink so the longest side is at most `max` (what gets stored, so resizing later stays cheap). */
export function shrinkToFit(src: Rgba, max: number): Rgba {
  const scale = Math.min(1, max / Math.max(src.width, src.height))
  if (scale === 1) return src
  return downscale(src, Math.max(1, Math.round(src.width * scale)), Math.max(1, Math.round(src.height * scale)))
}

const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v)

/** A bit more saturation and contrast: shrunk images go muddy, pixel art shouldn't. */
export function punch(r: number, g: number, b: number): [number, number, number] {
  const lum = 0.299 * r + 0.587 * g + 0.114 * b
  const s = (c: number) => clamp(((lum + (c - lum) * 1.12) - 128) * 1.05 + 128)
  return [s(r), s(g), s(b)]
}

/** Median-cut palette: split the colour box with the widest spread until we have `k` boxes. */
export function medianCut(colors: [number, number, number][], k: number): [number, number, number][] {
  if (!colors.length) return []
  let boxes: [number, number, number][][] = [colors]
  const spread = (box: [number, number, number][]) => {
    let best = 0, ch = 0
    for (let c = 0; c < 3; c++) {
      let lo = 255, hi = 0
      for (const p of box) { if (p[c] < lo) lo = p[c]; if (p[c] > hi) hi = p[c] }
      if (hi - lo > best) { best = hi - lo; ch = c }
    }
    return { best, ch }
  }
  while (boxes.length < k) {
    let pick = -1, pickScore = 0, pickCh = 0
    boxes.forEach((box, i) => {
      if (box.length < 2) return
      const { best, ch } = spread(box)
      const score = best * Math.sqrt(box.length)
      if (score > pickScore) { pickScore = score; pick = i; pickCh = ch }
    })
    if (pick < 0) break
    const box = boxes[pick].slice().sort((a, b) => a[pickCh] - b[pickCh])
    const mid = box.length >> 1
    boxes = [...boxes.slice(0, pick), box.slice(0, mid), box.slice(mid), ...boxes.slice(pick + 1)]
  }
  return boxes.map((box) => {
    const s = [0, 0, 0]
    for (const p of box) { s[0] += p[0]; s[1] += p[1]; s[2] += p[2] }
    return [Math.round(s[0] / box.length), Math.round(s[1] / box.length), Math.round(s[2] / box.length)]
  })
}

/** Nearest palette entry, weighted roughly the way eyes weigh red, green and blue. */
export function nearest(p: [number, number, number], palette: [number, number, number][]): [number, number, number] {
  let best = palette[0], bestD = Infinity
  for (const c of palette) {
    const d = 2 * (p[0] - c[0]) ** 2 + 4 * (p[1] - c[1]) ** 2 + 3 * (p[2] - c[2]) ** 2
    if (d < bestD) { bestD = d; best = c }
  }
  return best
}

/** The whole pipeline: resize to `w x h`, punch up the colours, reduce to `colors` colours. */
export function pixelate(src: Rgba, w: number, h: number, colors: number): Art {
  const small = downscale(src, w, h)
  const opaque: [number, number, number][] = []
  const punched: ([number, number, number] | null)[] = []
  for (let i = 0; i < w * h; i++) {
    const o = i * 4
    if (small.data[o + 3] < 128) { punched.push(null); continue }
    const p = punch(small.data[o], small.data[o + 1], small.data[o + 2])
    punched.push(p)
    opaque.push(p)
  }
  const palette = medianCut(opaque, Math.max(2, colors))
  const px = new Uint32Array(w * h)
  for (let i = 0; i < w * h; i++) {
    const p = punched[i]
    if (!p) { px[i] = TRANSPARENT; continue }
    const [r, g, b] = nearest(p, palette)
    px[i] = ((r << 16) | (g << 8) | b) >>> 0
  }
  return { w, h, px }
}

/** Share of pixels that are mostly see-through: logos and sprites have lots, photos have none. */
export function transparency(src: Rgba): number {
  let n = 0
  for (let i = 3; i < src.data.length; i += 4) if (src.data[i] < 128) n++
  return n / (src.width * src.height)
}
