// Draws a blobatar SVG into RGBA pixels for the terminal's Image element. Blobatar uses only
// what this reads: <path d> with M, C and Z, <circle>, <g fill> and <g transform="translate(x y)">,
// a fill on each shape or inherited from its group. Anything else is skipped. Pure: no engine.

type Rgb = [number, number, number]
type Point = [number, number]
type Shape = { points: Point[]; fill: Rgb }

const CURVE_STEPS = 12
const CIRCLE_STEPS = 48
const SUPERSAMPLE = 2

export type Raster = { rgba: string; width: number; height: number }

function colorOf(hex: string | undefined): Rgb | null {
  if (hex === undefined) return null
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  let h = m[1]!
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag)
  return m ? m[1] : undefined
}

function cubic(p0: Point, p1: Point, p2: Point, p3: Point, into: Point[]): void {
  for (let i = 1; i <= CURVE_STEPS; i++) {
    const t = i / CURVE_STEPS, u = 1 - t
    into.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ])
  }
}

// One path's `d` (M, C, L, Z) as closed polygons, in user units.
export function polygonsOfPath(d: string): Point[][] {
  const tokens = d.match(/[MCLZmclz]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? []
  const polys: Point[][] = []
  let cur: Point[] = []
  let pos: Point = [0, 0]
  let i = 0
  let cmd = ''
  const num = () => Number(tokens[i++])
  while (i < tokens.length) {
    const t = tokens[i]!
    if (/[MCLZmclz]/.test(t)) { cmd = t; i++; if (cmd === 'Z' || cmd === 'z') { if (cur.length) polys.push(cur); cur = [] } continue }
    if (cmd === 'M' || cmd === 'm') {
      const x = num(), y = num()
      pos = cmd === 'm' ? [pos[0] + x, pos[1] + y] : [x, y]
      if (cur.length) polys.push(cur)
      cur = [pos]
      cmd = cmd === 'm' ? 'l' : 'L'
    } else if (cmd === 'L' || cmd === 'l') {
      const x = num(), y = num()
      pos = cmd === 'l' ? [pos[0] + x, pos[1] + y] : [x, y]
      cur.push(pos)
    } else if (cmd === 'C' || cmd === 'c') {
      const rel = cmd === 'c'
      const o: Point = rel ? pos : [0, 0]
      const p1: Point = [o[0] + num(), o[1] + num()]
      const p2: Point = [o[0] + num(), o[1] + num()]
      const p3: Point = [o[0] + num(), o[1] + num()]
      cubic(pos, p1, p2, p3, cur)
      pos = p3
    } else { i++ }
  }
  if (cur.length) polys.push(cur)
  return polys
}

// The SVG's filled shapes in drawing order, translated by their groups, with the viewBox size.
export function shapesOf(svg: string): { shapes: Shape[]; size: number } {
  const vb = /viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/.exec(svg)
  const size = vb ? Math.max(Number(vb[1]), Number(vb[2])) : 100
  const shapes: Shape[] = []
  const groups: { fill: Rgb | null; dx: number; dy: number }[] = [{ fill: null, dx: 0, dy: 0 }]
  const top = () => groups[groups.length - 1]!
  for (const tag of svg.match(/<\/?[a-z]+[^>]*>/g) ?? []) {
    if (tag.startsWith('</g')) { if (groups.length > 1) groups.pop(); continue }
    if (tag.startsWith('<g')) {
      const t = /translate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)\s*\)/.exec(attr(tag, 'transform') ?? '')
      groups.push({ fill: colorOf(attr(tag, 'fill')) ?? top().fill, dx: top().dx + (t ? Number(t[1]) : 0), dy: top().dy + (t ? Number(t[2]) : 0) })
      continue
    }
    const fill = colorOf(attr(tag, 'fill')) ?? top().fill
    if (!fill) continue
    const { dx, dy } = top()
    if (tag.startsWith('<path')) {
      for (const poly of polygonsOfPath(attr(tag, 'd') ?? '')) shapes.push({ points: poly.map(([x, y]) => [x + dx, y + dy]), fill })
    } else if (tag.startsWith('<circle')) {
      const cx = Number(attr(tag, 'cx')) + dx, cy = Number(attr(tag, 'cy')) + dy, r = Number(attr(tag, 'r'))
      const points: Point[] = []
      for (let k = 0; k < CIRCLE_STEPS; k++) { const a = (k / CIRCLE_STEPS) * Math.PI * 2; points.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]) }
      shapes.push({ points, fill })
    }
  }
  return { shapes, size }
}

function fillPolygon(buf: Uint8Array, w: number, h: number, points: Point[], scale: number, fill: Rgb): void {
  const n = points.length
  if (n < 3) return
  const xs: number[] = []
  for (let y = 0; y < h; y++) {
    const sy = (y + 0.5) / scale
    xs.length = 0
    for (let a = 0; a < n; a++) {
      const [x0, y0] = points[a]!, [x1, y1] = points[(a + 1) % n]!
      if ((y0 <= sy) !== (y1 <= sy)) xs.push(x0 + ((sy - y0) * (x1 - x0)) / (y1 - y0))
    }
    xs.sort((p, q) => p - q)
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const from = Math.max(0, Math.round(xs[k]! * scale)), to = Math.min(w, Math.round(xs[k + 1]! * scale))
      for (let x = from; x < to; x++) { const o = (y * w + x) * 4; buf[o] = fill[0]; buf[o + 1] = fill[1]; buf[o + 2] = fill[2]; buf[o + 3] = 255 }
    }
  }
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export function base64Of(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!, b = bytes[i + 1], c = bytes[i + 2]
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0)
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + (b === undefined ? '=' : B64[(n >> 6) & 63]!) + (c === undefined ? '=' : B64[n & 63]!)
  }
  return out
}

// The SVG drawn `px` pixels square: transparent where nothing is filled, supersampled twice.
export function rasterOf(svg: string, px: number): Raster {
  const { shapes, size } = shapesOf(svg)
  const big = px * SUPERSAMPLE
  const buf = new Uint8Array(big * big * 4)
  for (const s of shapes) fillPolygon(buf, big, big, s.points, big / size, s.fill)
  const out = new Uint8Array(px * px * 4)
  for (let y = 0; y < px; y++) for (let x = 0; x < px; x++) {
    let r = 0, g = 0, b = 0, a = 0
    for (let sy = 0; sy < SUPERSAMPLE; sy++) for (let sx = 0; sx < SUPERSAMPLE; sx++) {
      const o = ((y * SUPERSAMPLE + sy) * big + x * SUPERSAMPLE + sx) * 4
      r += buf[o]!; g += buf[o + 1]!; b += buf[o + 2]!; a += buf[o + 3]!
    }
    const k = SUPERSAMPLE * SUPERSAMPLE, o = (y * px + x) * 4
    out[o] = Math.round(r / k); out[o + 1] = Math.round(g / k); out[o + 2] = Math.round(b / k); out[o + 3] = Math.round(a / k)
  }
  return { rgba: base64Of(out), width: px, height: px }
}
