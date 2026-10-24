/**
 * Pixel art -> the cells of a `Raster` element.
 *
 * Each terminal cell shows two stacked pixels with the half-block trick: '▀' painted in the top
 * pixel's colour over a background of the bottom pixel's colour. Transparent pixels fall back to
 * the terminal's own default colours, so a logo with a see-through background blends in.
 */
import { TRANSPARENT, type Art } from './pixelate'

const UPPER = 0x2580 // ▀
const LOWER = 0x2584 // ▄
const SPACE = 0x20
/** The terminal's default colour, in the Raster cell encoding. */
export const DEFAULT = 0x01000000

export function rowsFor(h: number): number {
  return Math.ceil(h / 2)
}

/** Encode `px` (w x h pixels) as base64 Raster cells, `w` columns by `rowsFor(h)` rows. */
export function cellsFor(art: Art, px: Uint32Array = art.px): string {
  const { w, h } = art
  const rows = rowsFor(h)
  const words = new Uint32Array(w * rows * 3)
  for (let r = 0; r < rows; r++) {
    for (let x = 0; x < w; x++) {
      const top = px[2 * r * w + x]
      const bottom = 2 * r + 1 < h ? px[(2 * r + 1) * w + x] : TRANSPARENT
      const i = (r * w + x) * 3
      if (top === TRANSPARENT && bottom === TRANSPARENT) {
        words[i] = SPACE; words[i + 1] = DEFAULT; words[i + 2] = DEFAULT
      } else if (top === TRANSPARENT) {
        words[i] = LOWER; words[i + 1] = bottom; words[i + 2] = DEFAULT
      } else if (bottom === TRANSPARENT) {
        words[i] = UPPER; words[i + 1] = top; words[i + 2] = DEFAULT
      } else {
        words[i] = UPPER; words[i + 1] = top; words[i + 2] = bottom
      }
    }
  }
  return new Uint8Array(words.buffer).toBase64()
}

/** Quadrant glyphs by which corners are painted in the foreground: TL=1, TR=2, BL=4, BR=8. */
const QUAD = [SPACE, 0x2598, 0x259d, 0x2580, 0x2596, 0x258c, 0x259e, 0x259b, 0x2597, 0x259a, 0x2590, 0x259c, 0x2584, 0x2599, 0x259f, 0x2588]

const dist = (a: number, b: number) => {
  const dr = ((a >> 16) & 255) - ((b >> 16) & 255), dg = ((a >> 8) & 255) - ((b >> 8) & 255), db = (a & 255) - (b & 255)
  return 2 * dr * dr + 4 * dg * dg + 3 * db * db
}

/** Of `colors`, the one closest to all the others: a cell's colours stay ones the art really has. */
function medoid(colors: number[]): number {
  let best = colors[0], bestD = Infinity
  for (const c of colors) {
    let d = 0
    for (const o of colors) d += dist(c, o)
    if (d < bestD) { bestD = d; best = c }
  }
  return best
}

/**
 * Encode `px` (w x h pixels) as quadrant cells: four pixels per cell, `ceil(w/2)` columns by
 * `rowsFor(h)` rows. For terminals whose cells are nearly square (a font with tight line spacing),
 * where half-block pixels come out twice as wide as they are tall.
 *
 * A cell still has only two colours, so each cell splits its four pixels into the two groups that
 * lose the least. See-through pixels always go to the background, which shows the terminal's own.
 */
export function quadCellsFor(art: Art, px: Uint32Array = art.px): string {
  const { w, h } = art
  const cols = Math.ceil(w / 2), rows = rowsFor(h)
  const words = new Uint32Array(cols * rows * 3)
  const at = (x: number, y: number) => (x < w && y < h ? px[y * w + x] : TRANSPARENT)
  const quad = [0, 0, 0, 0]
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      quad[0] = at(2 * c, 2 * r); quad[1] = at(2 * c + 1, 2 * r)
      quad[2] = at(2 * c, 2 * r + 1); quad[3] = at(2 * c + 1, 2 * r + 1)
      const i = (r * cols + c) * 3
      let mask = 0, fg = DEFAULT, bg = DEFAULT
      const solid = quad.filter((p) => p !== TRANSPARENT)
      if (solid.length === 0) {
        // all see-through: leave the terminal showing
      } else if (solid.length < 4) {
        for (let k = 0; k < 4; k++) if (quad[k] !== TRANSPARENT) mask |= 1 << k
        fg = medoid(solid)
      } else if (quad[0] === quad[1] && quad[1] === quad[2] && quad[2] === quad[3]) {
        mask = 15; fg = bg = quad[0]
      } else {
        // The seven ways to split four pixels in two (the group holding the top-left is the mask).
        let bestErr = Infinity
        for (const m of [1, 3, 5, 7, 9, 11, 13]) {
          const a: number[] = [], b: number[] = []
          for (let k = 0; k < 4; k++) ((m >> k) & 1 ? a : b).push(quad[k])
          const ca = medoid(a), cb = medoid(b)
          let err = 0
          for (const p of a) err += dist(p, ca)
          for (const p of b) err += dist(p, cb)
          if (err < bestErr) { bestErr = err; mask = m; fg = ca; bg = cb }
        }
      }
      words[i] = QUAD[mask]; words[i + 1] = fg; words[i + 2] = bg
    }
  }
  return new Uint8Array(words.buffer).toBase64()
}
