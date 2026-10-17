/**
 * zlib inflate (RFC 1950 / 1951) in plain TypeScript.
 *
 * Mods run in a sandbox with no DecompressionStream, no Blob and no WebAssembly, so PNG decoding
 * needs its own decompressor. This follows the structure of Mark Adler's puff.c: canonical Huffman
 * tables built from code lengths, decoded one bit at a time. Slow by native standards, but we only
 * ever inflate small images, once, when someone runs /pixelband set.
 */

const LEN_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258]
const LEN_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0]
const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073,
  4097, 6145, 8193, 12289, 16385, 24577]
const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13]
const CL_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]

interface Huffman { count: Uint16Array; symbol: Uint16Array }

/** Canonical Huffman table from a list of code lengths (0 = symbol unused). */
function build(lengths: ArrayLike<number>): Huffman {
  const count = new Uint16Array(16)
  for (let i = 0; i < lengths.length; i++) count[lengths[i]]++
  count[0] = 0
  const offs = new Uint16Array(16)
  for (let len = 1; len < 16; len++) offs[len] = offs[len - 1] + count[len - 1]
  const symbol = new Uint16Array(lengths.length)
  for (let i = 0; i < lengths.length; i++) if (lengths[i]) symbol[offs[lengths[i]]++] = i
  return { count, symbol }
}

const FIXED_LIT = build(Array.from({ length: 288 }, (_, i) => (i < 144 ? 8 : i < 256 ? 9 : i < 280 ? 7 : 8)))
const FIXED_DIST = build(new Array(30).fill(5))

/**
 * Growable output buffer (we don't always know the inflated size up front), with a ceiling: a tiny
 * compressed stream can claim to expand to gigabytes, and a decoder must not believe it.
 */
class Out {
  buf: Uint8Array
  len = 0
  constructor(hint: number, private limit: number) { this.buf = new Uint8Array(Math.max(Math.min(hint, limit), 1024)) }
  ensure(n: number) {
    if (this.len + n > this.limit) throw new Error('inflate: output is larger than expected')
    if (this.len + n <= this.buf.length) return
    let size = this.buf.length * 2
    while (size < this.len + n) size *= 2
    const next = new Uint8Array(size)
    next.set(this.buf.subarray(0, this.len))
    this.buf = next
  }
  push(b: number) { this.ensure(1); this.buf[this.len++] = b }
}

class Bits {
  pos: number
  bitBuf = 0
  bitCnt = 0
  constructor(private data: Uint8Array, start: number) { this.pos = start }
  need(n: number): number {
    let v = this.bitBuf
    while (this.bitCnt < n) {
      if (this.pos >= this.data.length) throw new Error('inflate: ran out of input')
      v |= this.data[this.pos++] << this.bitCnt
      this.bitCnt += 8
    }
    this.bitBuf = v >>> n
    this.bitCnt -= n
    return v & ((1 << n) - 1)
  }
  /** Drop leftover bits so the next read starts on a byte boundary (stored blocks). */
  align() { this.bitBuf = 0; this.bitCnt = 0 }
  decode(h: Huffman): number {
    let code = 0, first = 0, index = 0
    for (let len = 1; len < 16; len++) {
      code |= this.need(1)
      const count = h.count[len]
      if (code - count < first) return h.symbol[index + (code - first)]
      index += count
      first = (first + count) << 1
      code <<= 1
    }
    throw new Error('inflate: bad Huffman code')
  }
}

function codes(bits: Bits, out: Out, lit: Huffman, dist: Huffman) {
  for (;;) {
    let sym = bits.decode(lit)
    if (sym < 256) { out.push(sym); continue }
    if (sym === 256) return
    sym -= 257
    if (sym >= 29) throw new Error('inflate: bad length symbol')
    const len = LEN_BASE[sym] + bits.need(LEN_EXTRA[sym])
    const ds = bits.decode(dist)
    if (ds >= 30) throw new Error('inflate: bad distance symbol')
    const d = DIST_BASE[ds] + bits.need(DIST_EXTRA[ds])
    if (d > out.len) throw new Error('inflate: distance too far back')
    out.ensure(len)
    for (let i = 0; i < len; i++) { out.buf[out.len] = out.buf[out.len - d]; out.len++ }
  }
}

function dynamic(bits: Bits): [Huffman, Huffman] {
  const nlen = bits.need(5) + 257, ndist = bits.need(5) + 1, ncode = bits.need(4) + 4
  if (nlen > 286 || ndist > 30) throw new Error('inflate: bad dynamic block counts')
  const cl = new Uint8Array(19)
  for (let i = 0; i < ncode; i++) cl[CL_ORDER[i]] = bits.need(3)
  const clHuff = build(cl)
  const lengths = new Uint8Array(nlen + ndist)
  for (let i = 0; i < nlen + ndist;) {
    const sym = bits.decode(clHuff)
    if (sym < 16) { lengths[i++] = sym; continue }
    let rep = 0, val = 0
    if (sym === 16) {
      if (i === 0) throw new Error('inflate: repeat with no previous length')
      val = lengths[i - 1]; rep = 3 + bits.need(2)
    } else if (sym === 17) rep = 3 + bits.need(3)
    else rep = 11 + bits.need(7)
    if (i + rep > nlen + ndist) throw new Error('inflate: too many lengths')
    while (rep--) lengths[i++] = val
  }
  return [build(lengths.subarray(0, nlen)), build(lengths.subarray(nlen))]
}

/** Inflate a raw DEFLATE stream starting at `start`, refusing to produce more than `limit` bytes. */
export function inflateRaw(data: Uint8Array, start = 0, sizeHint = 0, limit = 256 * 1024 * 1024): Uint8Array {
  const bits = new Bits(data, start)
  const out = new Out(sizeHint || data.length * 4, limit)
  let last = 0
  while (!last) {
    last = bits.need(1)
    const type = bits.need(2)
    if (type === 0) {
      bits.align()
      if (bits.pos + 4 > data.length) throw new Error('inflate: truncated stored block')
      const len = data[bits.pos] | (data[bits.pos + 1] << 8)
      const nlen = data[bits.pos + 2] | (data[bits.pos + 3] << 8)
      if ((len ^ 0xffff) !== nlen) throw new Error('inflate: stored block length mismatch')
      bits.pos += 4
      if (bits.pos + len > data.length) throw new Error('inflate: truncated stored block')
      out.ensure(len)
      out.buf.set(data.subarray(bits.pos, bits.pos + len), out.len)
      out.len += len
      bits.pos += len
    } else if (type === 1) codes(bits, out, FIXED_LIT, FIXED_DIST)
    else if (type === 2) { const [l, d] = dynamic(bits); codes(bits, out, l, d) }
    else throw new Error('inflate: invalid block type')
  }
  return out.buf.slice(0, out.len)
}

/** Inflate a zlib-wrapped stream (what PNG's IDAT chunks hold). */
export function inflateZlib(data: Uint8Array, sizeHint = 0, limit?: number): Uint8Array {
  if (data.length < 2) throw new Error('zlib: too short')
  const cmf = data[0], flg = data[1]
  if ((cmf & 0x0f) !== 8 || ((cmf << 8) | flg) % 31 !== 0) throw new Error('zlib: bad header')
  if (flg & 0x20) throw new Error('zlib: preset dictionaries are not supported')
  return inflateRaw(data, 2, sizeHint, limit)
}
