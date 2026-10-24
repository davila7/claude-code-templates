/**
 * BMP decoder for uncompressed 24- and 32-bit bitmaps.
 *
 * This isn't for people's own BMPs so much as for the OS image tool's output: for JPEG, HEIC, WebP
 * and friends, the loader asks `sips` (macOS) or ImageMagick to convert and shrink the photo into a
 * BMP, which is trivial to read without a decompressor.
 */
import type { Rgba } from './png'

const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8)
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0
const i32 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)

export function isBmp(b: Uint8Array): boolean {
  return b.length > 54 && b[0] === 0x42 && b[1] === 0x4d
}

/** Shift and scale a channel out of a pixel with a bit mask (BI_BITFIELDS). */
function fromMask(px: number, mask: number): number {
  if (!mask) return 0
  let shift = 0
  while (((mask >>> shift) & 1) === 0) shift++
  const max = mask >>> shift
  return Math.round((((px & mask) >>> shift) * 255) / max)
}

export function decodeBmp(b: Uint8Array): Rgba {
  if (!isBmp(b)) throw new Error('not a BMP')
  const dataOffset = u32(b, 10)
  const headerSize = u32(b, 14)
  const width = i32(b, 18)
  const rawHeight = i32(b, 22)
  const bpp = u16(b, 28)
  const compression = u32(b, 30)
  if (width <= 0 || rawHeight === 0) throw new Error('BMP has no size')
  if (bpp !== 24 && bpp !== 32) throw new Error(`unsupported BMP depth ${bpp}`)
  if (compression !== 0 && compression !== 3) throw new Error('compressed BMPs are not supported')
  const height = Math.abs(rawHeight)
  const topDown = rawHeight < 0

  let masks: [number, number, number, number] | null = null
  if (compression === 3) {
    // Masks follow a 40-byte header, or sit inside V4/V5 headers at the same place.
    const m = 14 + 40
    masks = [u32(b, m), u32(b, m + 4), u32(b, m + 8), headerSize >= 56 ? u32(b, m + 12) : 0]
  }

  const stride = Math.floor((bpp * width + 31) / 32) * 4
  const data = new Uint8Array(width * height * 4)
  let anyAlpha = false
  for (let y = 0; y < height; y++) {
    const row = dataOffset + (topDown ? y : height - 1 - y) * stride
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4
      const p = row + x * (bpp / 8)
      if (masks) {
        const px = u32(b, p)
        data[o] = fromMask(px, masks[0]); data[o + 1] = fromMask(px, masks[1]); data[o + 2] = fromMask(px, masks[2])
        data[o + 3] = masks[3] ? fromMask(px, masks[3]) : 255
      } else {
        data[o] = b[p + 2]; data[o + 1] = b[p + 1]; data[o + 2] = b[p]
        data[o + 3] = bpp === 32 ? b[p + 3] : 255
      }
      if (data[o + 3]) anyAlpha = true
    }
  }
  // Plenty of 32-bit BMPs leave the alpha byte at 0 meaning "unused": treat those as opaque.
  if (bpp === 32 && !anyAlpha) for (let i = 3; i < data.length; i += 4) data[i] = 255
  return { width, height, data }
}
