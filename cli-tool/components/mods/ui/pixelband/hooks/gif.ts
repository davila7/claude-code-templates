/**
 * GIF decoding, animation included. The sandbox has no image decoders, and macOS's sips only ever
 * returns a GIF's first frame, so this reads them itself: the block structure, LZW, local and
 * global colour tables, transparency, interlacing and the three disposal methods.
 *
 * Frames are composited onto a full canvas the way browsers do, then handed to `onFrame` one at a
 * time, so a caller can shrink each one straight away instead of holding every full-size frame.
 */
import type { Rgba } from './png'

export function isGif(b: Uint8Array): boolean {
  return b.length > 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 // "GIF8"
}

const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8)

/** Skip a run of data sub-blocks starting at `p`; returns the offset after the terminator. */
function skipBlocks(b: Uint8Array, p: number): number {
  while (p < b.length && b[p] !== 0) p += b[p] + 1
  return p + 1
}

/** How many frames a GIF has, without decoding any pixels. */
export function countGifFrames(b: Uint8Array): number {
  let p = 13
  if (b[10] & 0x80) p += 3 * (1 << ((b[10] & 7) + 1))
  let n = 0
  while (p < b.length) {
    const t = b[p++]
    if (t === 0x3b) break
    if (t === 0x21) { p = skipBlocks(b, p + 1); continue }
    if (t !== 0x2c) break
    n++
    const packed = b[p + 8]
    p += 9
    if (packed & 0x80) p += 3 * (1 << ((packed & 7) + 1))
    p = skipBlocks(b, p + 1)
  }
  return n
}

/** Decode one image's LZW data (sub-blocks from `p`) into `count` palette indices. */
function lzw(b: Uint8Array, p: number, minSize: number, count: number): Uint8Array {
  // Gather the sub-blocks into one run of bytes.
  let len = 0
  for (let q = p; q < b.length && b[q] !== 0; q += b[q] + 1) len += b[q]
  const data = new Uint8Array(len)
  for (let q = p, o = 0; q < b.length && b[q] !== 0; q += b[q] + 1) { data.set(b.subarray(q + 1, q + 1 + b[q]), o); o += b[q] }

  const out = new Uint8Array(count)
  const clear = 1 << minSize, end = clear + 1
  const prefix = new Int16Array(4096), suffix = new Uint8Array(4096), stack = new Uint8Array(4097)
  for (let i = 0; i < clear; i++) suffix[i] = i
  let size = minSize + 1, next = end + 1, old = -1, first = 0
  let bits = 0, acc = 0, bytePos = 0, o = 0
  while (o < count) {
    while (bits < size && bytePos < data.length) { acc |= data[bytePos++] << bits; bits += 8 }
    if (bits < size) break
    const code = acc & ((1 << size) - 1)
    acc >>>= size; bits -= size
    if (code === clear) { size = minSize + 1; next = end + 1; old = -1; continue }
    if (code === end) break
    if (old === -1) { out[o++] = suffix[code]; old = first = code; continue }
    let c = code, sp = 0
    if (code >= next) { stack[sp++] = first; c = old } // the KwKwK case
    while (c >= clear) { stack[sp++] = suffix[c]; c = prefix[c] }
    first = suffix[c]
    stack[sp++] = first
    while (sp > 0 && o < count) out[o++] = stack[--sp]
    if (next < 4096) {
      prefix[next] = old; suffix[next] = first; next++
      if (next === 1 << size && size < 12) size++
    }
    old = code
  }
  return out
}

/** Rows in the order an interlaced image stores them. */
function interlacedRows(h: number): number[] {
  const rows: number[] = []
  for (const [start, step] of [[0, 8], [4, 8], [2, 4], [1, 2]]) for (let y = start; y < h; y += step) rows.push(y)
  return rows
}

export interface GifInfo { width: number; height: number; frames: number }

/**
 * Decode every frame. `onFrame(canvas, delayMs, index)` gets the composited canvas, which is reused:
 * copy or shrink it before returning. Delays of 0 or 10 ms play at 100 ms, as browsers do.
 */
export function decodeGif(b: Uint8Array, onFrame: (canvas: Rgba, delayMs: number, index: number) => void): GifInfo {
  if (!isGif(b)) throw new Error('not a GIF')
  const width = u16(b, 6), height = u16(b, 8)
  if (!width || !height || width * height > 4096 * 4096) throw new Error(`unsupported GIF size ${width}x${height}`)
  let p = 13
  let globalTable: Uint8Array | null = null
  if (b[10] & 0x80) { const n = 3 * (1 << ((b[10] & 7) + 1)); globalTable = b.subarray(p, p + n); p += n }

  const canvas: Rgba = { width, height, data: new Uint8Array(width * height * 4) }
  let saved: Uint8Array | null = null
  let delay = 100, transparent = -1, disposal = 0
  let frames = 0

  while (p < b.length) {
    const t = b[p++]
    if (t === 0x3b) break
    if (t === 0x21) {
      const label = b[p++]
      if (label === 0xf9 && b[p] >= 4) {
        const packed = b[p + 1]
        disposal = (packed >> 2) & 7
        const cs = u16(b, p + 2)
        delay = cs <= 1 ? 100 : cs * 10
        transparent = packed & 1 ? b[p + 4] : -1
      }
      p = skipBlocks(b, p)
      continue
    }
    if (t !== 0x2c) break // anything else: stop at what we have

    const left = u16(b, p), top = u16(b, p + 2), fw = u16(b, p + 4), fh = u16(b, p + 6), packed = b[p + 8]
    p += 9
    let table = globalTable
    if (packed & 0x80) { const n = 3 * (1 << ((packed & 7) + 1)); table = b.subarray(p, p + n); p += n }
    const minSize = b[p++]
    if (!table || minSize < 2 || minSize > 11) throw new Error('broken GIF frame')
    const indices = lzw(b, p, minSize, fw * fh)
    p = skipBlocks(b, p)

    if (disposal === 3) saved = canvas.data.slice()
    const rows = packed & 0x40 ? interlacedRows(fh) : null
    for (let row = 0; row < fh; row++) {
      const y = top + (rows ? rows[row] : row)
      if (y >= height) continue
      for (let x = 0; x < fw; x++) {
        const cx = left + x
        if (cx >= width) continue
        const idx = indices[row * fw + x]
        if (idx === transparent || idx * 3 + 2 >= table.length) continue
        const o = (y * width + cx) * 4
        canvas.data[o] = table[idx * 3]; canvas.data[o + 1] = table[idx * 3 + 1]; canvas.data[o + 2] = table[idx * 3 + 2]; canvas.data[o + 3] = 255
      }
    }
    onFrame(canvas, delay, frames++)

    // What this frame leaves behind for the next one.
    if (disposal === 2) {
      for (let y = top; y < Math.min(height, top + fh); y++) canvas.data.fill(0, (y * width + left) * 4, (y * width + Math.min(width, left + fw)) * 4)
    } else if (disposal === 3 && saved) {
      canvas.data.set(saved)
    }
    delay = 100; transparent = -1; disposal = 0
  }
  if (!frames) throw new Error('GIF has no frames')
  return { width, height, frames }
}
