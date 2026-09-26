/**
 * PNG decoder: bytes in, RGBA out. Handles every non-interlaced PNG a person is likely to have:
 * grayscale, RGB, palette, gray+alpha and RGBA, at 1/2/4/8/16 bits, with tRNS transparency.
 * Interlaced (Adam7) PNGs throw, and the loader falls back to the OS image tool for those.
 */
import { inflateZlib } from './inflate'

export interface Rgba { width: number; height: number; data: Uint8Array }

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]

export function isPng(b: Uint8Array): boolean {
  return b.length > 8 && SIGNATURE.every((v, i) => b[i] === v)
}

const u32 = (b: Uint8Array, o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

export function decodePng(bytes: Uint8Array): Rgba {
  if (!isPng(bytes)) throw new Error('not a PNG')
  let width = 0, height = 0, depth = 0, colorType = 0, interlace = 0
  let palette: Uint8Array | null = null
  let trns: Uint8Array | null = null
  const idat: Uint8Array[] = []
  for (let o = 8; o + 8 <= bytes.length;) {
    const len = u32(bytes, o)
    const type = String.fromCharCode(bytes[o + 4], bytes[o + 5], bytes[o + 6], bytes[o + 7])
    const body = bytes.subarray(o + 8, o + 8 + len)
    if (type === 'IHDR') {
      width = u32(body, 0); height = u32(body, 4); depth = body[8]; colorType = body[9]; interlace = body[12]
    } else if (type === 'PLTE') palette = body
    else if (type === 'tRNS') trns = body
    else if (type === 'IDAT') idat.push(body)
    else if (type === 'IEND') break
    o += 12 + len
  }
  if (!width || !height) throw new Error('PNG has no image header')
  if (interlace) throw new Error('interlaced PNGs are not supported')
  const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[colorType]
  if (!channels) throw new Error(`unsupported PNG color type ${colorType}`)
  if (colorType === 3 && !palette) throw new Error('palette PNG without a palette')

  const total = idat.reduce((n, c) => n + c.length, 0)
  const joined = new Uint8Array(total)
  let at = 0
  for (const c of idat) { joined.set(c, at); at += c.length }
  const rowBytes = Math.ceil((width * channels * depth) / 8)
  const raw = inflateZlib(joined, height * (rowBytes + 1))
  if (raw.length < height * (rowBytes + 1)) throw new Error('PNG image data is truncated')

  // Undo the per-row filters in place, into `rows`.
  const bpp = Math.max(1, Math.ceil((channels * depth) / 8))
  const rows = new Uint8Array(height * rowBytes)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (rowBytes + 1)]
    const src = y * (rowBytes + 1) + 1
    const dst = y * rowBytes
    for (let x = 0; x < rowBytes; x++) {
      const v = raw[src + x]
      const a = x >= bpp ? rows[dst + x - bpp] : 0
      const b = y > 0 ? rows[dst - rowBytes + x] : 0
      const c = x >= bpp && y > 0 ? rows[dst - rowBytes + x - bpp] : 0
      let out: number
      switch (filter) {
        case 0: out = v; break
        case 1: out = v + a; break
        case 2: out = v + b; break
        case 3: out = v + ((a + b) >> 1); break
        case 4: out = v + paeth(a, b, c); break
        default: throw new Error(`bad PNG filter ${filter}`)
      }
      rows[dst + x] = out & 255
    }
  }

  // Read sample i of row y, scaled to 0..255 whatever the bit depth.
  const sample = (y: number, i: number): number => {
    const base = y * rowBytes
    if (depth === 8) return rows[base + i]
    if (depth === 16) return rows[base + i * 2]
    const perByte = 8 / depth
    const byte = rows[base + Math.floor(i / perByte)]
    const shift = 8 - depth * ((i % perByte) + 1)
    const v = (byte >> shift) & ((1 << depth) - 1)
    return colorType === 3 ? v : Math.round((v * 255) / ((1 << depth) - 1))
  }
  const rawSample = (y: number, i: number): number => { // unscaled, for tRNS comparisons
    const base = y * rowBytes
    if (depth === 16) return (rows[base + i * 2] << 8) | rows[base + i * 2 + 1]
    if (depth === 8) return rows[base + i]
    const perByte = 8 / depth
    return (rows[base + Math.floor(i / perByte)] >> (8 - depth * ((i % perByte) + 1))) & ((1 << depth) - 1)
  }
  const trnsGray = trns && colorType === 0 ? (trns[0] << 8) | trns[1] : -1
  const trnsRgb = trns && colorType === 2 ? [(trns[0] << 8) | trns[1], (trns[2] << 8) | trns[3], (trns[4] << 8) | trns[5]] : null

  const data = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4
      if (colorType === 0) {
        const g = sample(y, x)
        data[o] = data[o + 1] = data[o + 2] = g
        data[o + 3] = rawSample(y, x) === trnsGray ? 0 : 255
      } else if (colorType === 2) {
        data[o] = sample(y, x * 3); data[o + 1] = sample(y, x * 3 + 1); data[o + 2] = sample(y, x * 3 + 2)
        const hit = trnsRgb && rawSample(y, x * 3) === trnsRgb[0] && rawSample(y, x * 3 + 1) === trnsRgb[1] && rawSample(y, x * 3 + 2) === trnsRgb[2]
        data[o + 3] = hit ? 0 : 255
      } else if (colorType === 3) {
        const idx = sample(y, x)
        data[o] = palette![idx * 3]; data[o + 1] = palette![idx * 3 + 1]; data[o + 2] = palette![idx * 3 + 2]
        data[o + 3] = trns && idx < trns.length ? trns[idx] : 255
      } else if (colorType === 4) {
        const g = sample(y, x * 2)
        data[o] = data[o + 1] = data[o + 2] = g
        data[o + 3] = sample(y, x * 2 + 1)
      } else {
        data[o] = sample(y, x * 4); data[o + 1] = sample(y, x * 4 + 1); data[o + 2] = sample(y, x * 4 + 2)
        data[o + 3] = sample(y, x * 4 + 3)
      }
    }
  }
  return { width, height, data }
}
