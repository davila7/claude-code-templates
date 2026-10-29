// Minimal QR encoder after Nayuki's reference: byte mode, ECC M, versions 1-10.
// Derived from QR Code generator library, Copyright (c) Project Nayuki, MIT License:
// https://www.nayuki.io/page/qr-code-generator-library
// shortcut: fixed mask 0 with no penalty scoring, valid but not always the easiest scan; port mask selection if phones struggle.

const ECC_PER_BLOCK = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26]
const NUM_BLOCKS = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5]
const MAX_VERSION = 10

const bit = (x: number, i: number) => ((x >>> i) & 1) !== 0

function rawModules(ver: number) {
  let n = (16 * ver + 128) * ver + 64
  if (ver >= 2) {
    const align = Math.floor(ver / 7) + 2
    n -= (25 * align - 10) * align - 55
    if (ver >= 7) n -= 36
  }
  return n
}

const dataCodewords = (ver: number) =>
  Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[ver] * NUM_BLOCKS[ver]

function gfMul(x: number, y: number) {
  let z = 0
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    z ^= ((y >>> i) & 1) * x
  }
  return z
}

function rsDivisor(degree: number) {
  const out = new Array<number>(degree).fill(0)
  out[degree - 1] = 1
  let root = 1
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      out[j] = gfMul(out[j], root)
      if (j + 1 < degree) out[j] ^= out[j + 1]
    }
    root = gfMul(root, 0x02)
  }
  return out
}

function rsRemainder(data: number[], divisor: number[]) {
  const out = new Array<number>(divisor.length).fill(0)
  for (const b of data) {
    const factor = b ^ (out.shift() as number)
    out.push(0)
    divisor.forEach((d, i) => (out[i] ^= gfMul(d, factor)))
  }
  return out
}

function interleave(data: number[], ver: number) {
  const numBlocks = NUM_BLOCKS[ver]
  const eccLen = ECC_PER_BLOCK[ver]
  const raw = Math.floor(rawModules(ver) / 8)
  const numShort = numBlocks - (raw % numBlocks)
  const shortLen = Math.floor(raw / numBlocks)
  const div = rsDivisor(eccLen)
  const blocks: number[][] = []
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1))
    k += dat.length
    const ecc = rsRemainder(dat, div)
    if (i < numShort) dat.push(0)
    blocks.push(dat.concat(ecc))
  }
  const out: number[] = []
  for (let i = 0; i < blocks[0].length; i++)
    blocks.forEach((b, j) => {
      if (i !== shortLen - eccLen || j >= numShort) out.push(b[i])
    })
  return out
}

/** The QR matrix (true = dark) for `text`, or null when it does not fit version 10. */
export function qrMatrix(text: string): boolean[][] | null {
  const bytes = Array.from(new TextEncoder().encode(text))
  const countBits = (v: number) => (v <= 9 ? 8 : 16)
  let ver = 1
  while (ver <= MAX_VERSION && 4 + countBits(ver) + bytes.length * 8 > dataCodewords(ver) * 8) ver++
  if (ver > MAX_VERSION) return null

  const bits: number[] = []
  const put = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1)
  }
  put(0b0100, 4)
  put(bytes.length, countBits(ver))
  bytes.forEach(b => put(b, 8))
  const cap = dataCodewords(ver) * 8
  put(0, Math.min(4, cap - bits.length))
  put(0, (8 - (bits.length % 8)) % 8)
  for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) put(pad, 8)
  const data: number[] = []
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2))

  const size = ver * 4 + 17
  const mod = Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
  const fn = Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
  const setF = (x: number, y: number, dark: boolean) => {
    mod[y][x] = dark
    fn[y][x] = true
  }

  for (let i = 0; i < size; i++) {
    setF(6, i, i % 2 === 0)
    setF(i, 6, i % 2 === 0)
  }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]])
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy))
        const x = cx + dx
        const y = cy + dy
        if (x >= 0 && x < size && y >= 0 && y < size) setF(x, y, d !== 2 && d !== 4)
      }

  const align: number[] = []
  if (ver > 1) {
    const n = Math.floor(ver / 7) + 2
    const step = Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2
    align.push(6)
    for (let pos = size - 7; align.length < n; pos -= step) align.splice(1, 0, pos)
  }
  const last = align.length - 1
  align.forEach((ax, i) =>
    align.forEach((ay, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) setF(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
    }),
  )

  // ECC level M has format bits 00, so the 5 data bits are just the mask.
  const drawFormat = (mask: number) => {
    let rem = mask
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
    const b = ((mask << 10) | rem) ^ 0x5412
    for (let i = 0; i <= 5; i++) setF(8, i, bit(b, i))
    setF(8, 7, bit(b, 6))
    setF(8, 8, bit(b, 7))
    setF(7, 8, bit(b, 8))
    for (let i = 9; i < 15; i++) setF(14 - i, 8, bit(b, i))
    for (let i = 0; i < 8; i++) setF(size - 1 - i, 8, bit(b, i))
    for (let i = 8; i < 15; i++) setF(8, size - 15 + i, bit(b, i))
    setF(8, size - 8, true)
  }
  drawFormat(0)

  if (ver >= 7) {
    let rem = ver
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
    const b = (ver << 12) | rem
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3)
      const c = Math.floor(i / 3)
      setF(a, c, bit(b, i))
      setF(c, a, bit(b, i))
    }
  }

  const codewords = interleave(data, ver)
  let i = 0
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vert = 0; vert < size; vert++)
      for (let j = 0; j < 2; j++) {
        const x = right - j
        const y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert
        if (!fn[y][x] && i < codewords.length * 8) {
          mod[y][x] = bit(codewords[i >>> 3], 7 - (i & 7))
          i++
        }
      }
  }

  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) if (!fn[y][x] && (x + y) % 2 === 0) mod[y][x] = !mod[y][x]

  return mod
}

// Index = 2x4 cell bitmask, bit n = dot n+1 numbered left to right, top to
// bottom (Unicode 16 octants, with the older block glyphs for the patterns
// they already covered).
const OCTANTS = Array.from(
  ' 𜺨𜺫🮂𜴀▘𜴁𜴂𜴃𜴄▝𜴅𜴆𜴇𜴈▀𜴉𜴊𜴋𜴌🯦𜴍𜴎𜴏𜴐𜴑𜴒𜴓𜴔𜴕𜴖𜴗𜴘𜴙𜴚𜴛𜴜𜴝𜴞𜴟🯧𜴠𜴡𜴢𜴣𜴤𜴥𜴦𜴧𜴨𜴩𜴪𜴫𜴬𜴭𜴮𜴯𜴰𜴱𜴲𜴳𜴴𜴵🮅𜺣𜴶𜴷𜴸𜴹𜴺𜴻𜴼𜴽𜴾𜴿𜵀𜵁𜵂𜵃𜵄▖𜵅𜵆𜵇𜵈▌𜵉𜵊𜵋𜵌▞𜵍𜵎𜵏𜵐▛𜵑𜵒𜵓𜵔𜵕𜵖𜵗𜵘𜵙𜵚𜵛𜵜𜵝𜵞𜵟𜵠𜵡𜵢𜵣𜵤𜵥𜵦𜵧𜵨𜵩𜵪𜵫𜵬𜵭𜵮𜵯𜵰𜺠𜵱𜵲𜵳𜵴𜵵𜵶𜵷𜵸𜵹𜵺𜵻𜵼𜵽𜵾𜵿𜶀𜶁𜶂𜶃𜶄𜶅𜶆𜶇𜶈𜶉𜶊𜶋𜶌𜶍𜶎𜶏▗𜶐𜶑𜶒𜶓▚𜶔𜶕𜶖𜶗▐𜶘𜶙𜶚𜶛▜𜶜𜶝𜶞𜶟𜶠𜶡𜶢𜶣𜶤𜶥𜶦𜶧𜶨𜶩𜶪𜶫▂𜶬𜶭𜶮𜶯𜶰𜶱𜶲𜶳𜶴𜶵𜶶𜶷𜶸𜶹𜶺𜶻𜶼𜶽𜶾𜶿𜷀𜷁𜷂𜷃𜷄𜷅𜷆𜷇𜷈𜷉𜷊𜷋𜷌𜷍𜷎𜷏𜷐𜷑𜷒𜷓𜷔𜷕𜷖𜷗𜷘𜷙𜷚▄𜷛𜷜𜷝𜷞▙𜷟𜷠𜷡𜷢▟𜷣▆𜷤𜷥█',
)

/**
 * `text` as a QR Code in octant characters, 2x4 modules per cell, which keeps
 * modules square on a 1:2 terminal cell. Light modules are drawn as the
 * foreground, so draw it light on dark.
 */
export function qrText(text: string, quiet = 2): string | null {
  const m = qrMatrix(text)
  if (!m) return null
  const size = m.length + quiet * 2
  const light = (x: number, y: number) => {
    const mx = x - quiet
    const my = y - quiet
    return x < size && y < size && !(mx >= 0 && my >= 0 && mx < m.length && my < m.length && m[my][mx])
  }
  const lines: string[] = []
  for (let y = 0; y < size; y += 4) {
    let line = ''
    for (let x = 0; x < size; x += 2) {
      let mask = 0
      for (let dy = 0; dy < 4; dy++)
        for (let dx = 0; dx < 2; dx++) if (light(x + dx, y + dy)) mask |= 1 << (dy * 2 + dx)
      line += OCTANTS[mask]
    }
    lines.push(line)
  }
  return lines.join('\n')
}
