/**
 * session-chats: the conversations as a graph. Each session is a node; each
 * conversation is one link, its arrow from the session that wrote first, drawn
 * dashed while the other one has not answered. No `$` here.
 *
 * The layout is layered: a session that only starts conversations sits on
 * top, the sessions it wrote to below it. The same layout is drawn twice: as
 * cells for the terminal, and as an SVG for the surfaces that have `Svg`.
 */
import { clean, fit, label, sideKey } from './chats.ts'
import type { Conversation, Side } from './chats.ts'

export type Node = {
  key: string
  side: Side
  isSelf: boolean
  isRunning: boolean
  /** The folder's last part, drawn under the name. */
  sub: string
  layer: number
  order: number
}

export type Edge = {
  from: string
  to: string
  /** The other side answered at least once. */
  isAnswered: boolean
  count: number
  lastAt: number
  conv: Conversation
}

export type Graph = { nodes: Node[]; edges: Edge[] }

/** The graph of every conversation; `isActive` keeps the running sessions and the links between them. */
export function buildGraph(convs: readonly Conversation[], running: ReadonlySet<string>, selfId: string | undefined, isActive: boolean): Graph {
  const nodes = new Map<string, Node>()
  const edges: Edge[] = []
  const add = (s: Side) => {
    const key = sideKey(s)
    const old = nodes.get(key)
    // conversations come newest first: the first seen name is the current one
    const side = old ? { ...defined(s), ...defined(old.side) } : s
    const isSelf = !!selfId && side.id === selfId
    nodes.set(key, {
      key,
      side,
      isSelf,
      isRunning: isSelf || (!!side.id && running.has(side.id)),
      sub: isSelf ? 'this session' : clean(folder(side.cwd)),
      layer: 0,
      order: 0,
    })
    return key
  }
  for (const c of convs) {
    if (c.lines.length === 0) continue
    const ka = add(c.a)
    const kb = add(c.b)
    const firstByA = c.lines[0]!.by === 'a'
    edges.push({
      from: firstByA ? ka : kb,
      to: firstByA ? kb : ka,
      isAnswered: c.lines.some(l => l.by !== c.lines[0]!.by),
      count: c.lines.length,
      lastAt: c.lastAt,
      conv: c,
    })
  }
  if (!isActive) return { nodes: [...nodes.values()], edges }
  const keep = new Set([...nodes.values()].filter(n => n.isRunning).map(n => n.key))
  return { nodes: [...nodes.values()].filter(n => keep.has(n.key)), edges: edges.filter(e => keep.has(e.from) && keep.has(e.to)) }
}

const defined = (s: Side): Side => Object.fromEntries(Object.entries(s).filter(([, v]) => v !== undefined)) as Side

function folder(path: string | undefined): string {
  return path ? path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || path : ''
}

/**
 * Sets each node's `layer` and `order`: a link always points down a layer or
 * more (a link closing a cycle is laid out reversed and drawn with its arrow
 * up), and each layer is ordered under the nodes that point at it.
 */
export function layout(g: Graph): Node[][] {
  const out = new Map<string, string[]>()
  for (const n of g.nodes) out.set(n.key, [])
  // drop the links that close a cycle, depth first from the oldest senders
  const state = new Map<string, 0 | 1 | 2>()
  const forward: [string, string][] = []
  const firstAt = new Map<string, number>()
  for (const e of g.edges) firstAt.set(e.from, Math.min(firstAt.get(e.from) ?? Infinity, e.conv.firstAt))
  const roots = [...g.nodes].sort((x, y) => (firstAt.get(x.key) ?? Infinity) - (firstAt.get(y.key) ?? Infinity))
  const visit = (k: string) => {
    state.set(k, 1)
    for (const e of g.edges) {
      if (e.from !== k) continue
      const s = state.get(e.to) ?? 0
      if (s === 1) continue
      forward.push([e.from, e.to])
      if (s === 0) visit(e.to)
    }
    state.set(k, 2)
  }
  for (const r of roots) if (!state.get(r.key)) visit(r.key)
  for (const [a, b] of forward) out.get(a)!.push(b)

  // longest path from a source
  const layer = new Map<string, number>()
  const depth = (k: string, seen: Set<string>): number => {
    const known = layer.get(k)
    if (known !== undefined) return known
    let d = 0
    for (const [a, b] of forward) if (b === k && !seen.has(a)) d = Math.max(d, depth(a, new Set([...seen, k])) + 1)
    layer.set(k, d)
    return d
  }
  for (const n of g.nodes) n.layer = depth(n.key, new Set())

  const layers: Node[][] = []
  for (const n of g.nodes) (layers[n.layer] ??= []).push(n)
  for (let i = 0; i < layers.length; i++) {
    const row = (layers[i] ??= [])
    if (i === 0) {
      row.sort((x, y) => (firstAt.get(x.key) ?? Infinity) - (firstAt.get(y.key) ?? Infinity))
    } else {
      // under the mean position of the nodes that point at it
      const pos = new Map(layers.slice(0, i).flat().map(n => [n.key, n.order / Math.max(1, layers[n.layer]!.length - 1 || 1)]))
      const bary = (n: Node) => {
        const ps = forward.filter(([, b]) => b === n.key).map(([a]) => pos.get(a)).filter((x): x is number => x !== undefined)
        return ps.length ? ps.reduce((s, x) => s + x, 0) / ps.length : 0.5
      }
      row.sort((x, y) => bary(x) - bary(y))
    }
    row.forEach((n, j) => (n.order = j))
  }
  return layers.filter(r => r.length > 0)
}

// ---------------------------------------------------------------------------
// the terminal: a grid of cells

export type Paint = 'node' | 'nodeSel' | 'name' | 'nameSel' | 'sub' | 'dotOn' | 'dotOff' | 'edge' | 'edgeSel' | 'edgeDim' | 'blank'
export type Run = { text: string; paint: Paint }

const NODE_H = 4
const GAP_H = 3

type Box = { x: number; y: number; w: number; h: number }

/** Where each node's box goes on a grid `width` cells wide; undefined when the widest layer does not fit. */
export function place(layers: Node[][], width: number): { boxes: Map<string, Box>; height: number } | undefined {
  const widest = Math.max(1, ...layers.map(r => r.length))
  const slot = Math.floor(width / widest)
  if (slot < 12) return undefined
  const names = layers.flat().map(n => Math.max(Array.from(label(n.side)).length + 4, Array.from(n.sub).length + 2))
  const w = Math.min(slot - 2, Math.max(12, Math.min(26, Math.max(...names) + 2)))
  const boxes = new Map<string, Box>()
  layers.forEach((row, i) => {
    const step = width / row.length
    row.forEach((n, j) => {
      const cx = Math.floor(step * (j + 0.5))
      boxes.set(n.key, { x: Math.max(0, Math.min(width - w, cx - Math.floor(w / 2))), y: i * (NODE_H + GAP_H), w, h: NODE_H })
    })
  })
  return { boxes, height: layers.length * NODE_H + (layers.length - 1) * GAP_H }
}

const UP = 1
const DOWN = 2
const LEFT = 4
const RIGHT = 8
const SOLID: Record<number, string> = {
  [UP | DOWN]: '│',
  [LEFT | RIGHT]: '─',
  [DOWN | RIGHT]: '╭',
  [DOWN | LEFT]: '╮',
  [UP | RIGHT]: '╰',
  [UP | LEFT]: '╯',
  [UP | DOWN | RIGHT]: '├',
  [UP | DOWN | LEFT]: '┤',
  [LEFT | RIGHT | DOWN]: '┬',
  [LEFT | RIGHT | UP]: '┴',
  [UP | DOWN | LEFT | RIGHT]: '┼',
  [UP]: '│',
  [DOWN]: '│',
  [LEFT]: '─',
  [RIGHT]: '─',
}

/** The graph as rows of painted runs, `width` cells wide; undefined when it does not fit. */
export function drawCells(g: Graph, layers: Node[][], width: number, selected: string | undefined): Run[][] | undefined {
  const placed = place(layers, width)
  if (!placed) return undefined
  const { boxes, height } = placed
  const H = height
  const glyph: string[][] = Array.from({ length: H }, () => Array(width).fill(' '))
  const paint: Paint[][] = Array.from({ length: H }, () => Array(width).fill('blank'))
  const mask: number[][] = Array.from({ length: H }, () => Array(width).fill(0))
  const rank: number[][] = Array.from({ length: H }, () => Array(width).fill(0))
  const dashed: boolean[][] = Array.from({ length: H }, () => Array(width).fill(true))
  const inBox = (x: number, y: number) => [...boxes.values()].some(b => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h)
  const byKey = new Map(g.nodes.map(n => [n.key, n]))

  const mark = (x: number, y: number, bits: number, level: number, isDashed: boolean) => {
    if (y < 0 || y >= H || x < 0 || x >= width || inBox(x, y)) return
    mask[y]![x]! |= bits
    rank[y]![x] = Math.max(rank[y]![x]!, level)
    if (!isDashed) dashed[y]![x] = false
  }
  const arrows: [number, number, string, number][] = []
  const bits = (dx: number, dy: number) => (dx > 0 ? RIGHT : dx < 0 ? LEFT : dy > 0 ? DOWN : UP)
  /** Marks the cells of an axis-aligned polyline, joined to the box above its start and below its end. */
  const trace = (pts: [number, number][], level: number, isDashed: boolean) => {
    const cells: [number, number][] = [pts[0]!]
    for (let i = 1; i < pts.length; i++) {
      const [px, py] = cells[cells.length - 1]!
      const [qx, qy] = pts[i]!
      const n = Math.max(Math.abs(qx - px), Math.abs(qy - py))
      for (let k = 1; k <= n; k++) cells.push([px + Math.sign(qx - px) * k, py + Math.sign(qy - py) * k])
    }
    cells.forEach(([x, y], i) => {
      const [ax, ay] = i > 0 ? cells[i - 1]! : [x, y - 1]
      const [bx, by] = i < cells.length - 1 ? cells[i + 1]! : [x, y + 1]
      mark(x, y, bits(ax - x, ay - y) | bits(bx - x, by - y), level, isDashed)
    })
  }

  // each link gets its own port on the boxes, spread under (or over) them in the order of the other end
  const ends = g.edges
    .map(e => ({ e, a: byKey.get(e.from), b: byKey.get(e.to) }))
    .filter((x): x is { e: Edge; a: Node; b: Node } => !!x.a && !!x.b)
    .map(({ e, a, b }) => {
      const isDown = a.layer < b.layer
      return { e, isDown, top: isDown ? a : b, low: isDown ? b : a }
    })
  // a link past a layer goes down the lane on the right: its ports are the rightmost
  const along = (x: { top: Node; low: Node }, other: Node) => {
    if (x.low.layer - x.top.layer > 1) return Infinity
    const b = boxes.get(other.key)!
    return b.x + b.w / 2
  }
  const port = (n: Node, side: 'out' | 'in', e: Edge) => {
    const b = boxes.get(n.key)!
    const mine = ends
      .filter(x => (side === 'out' ? x.top : x.low).key === n.key)
      .sort((x, y) => along(x, side === 'out' ? x.low : x.top) - along(y, side === 'out' ? y.low : y.top))
    const i = mine.findIndex(x => x.e === e)
    return b.x + Math.round((b.w * (i + 1)) / (mine.length + 1))
  }
  const inPorts = new Map<string, number[]>()
  for (const x of ends) inPorts.set(x.low.key, [...(inPorts.get(x.low.key) ?? []), port(x.low, 'in', x.e)])
  let right = 0
  let left = 0
  for (const { e, isDown, top, low } of ends) {
    const bt = boxes.get(top.key)!
    const bl = boxes.get(low.key)!
    const x1 = port(top, 'out', e)
    let x2 = port(low, 'in', e)
    // straight down when the port above is over the box and no other link comes in there
    if (low.layer - top.layer === 1 && x1 > bl.x && x1 < bl.x + bl.w - 1 && !inPorts.get(low.key)!.includes(x1)) {
      const taken = inPorts.get(low.key)!
      taken[taken.indexOf(x2)] = x1
      x2 = x1
    }
    const y1 = bt.y + bt.h // first gap row under the upper box
    const y2 = bl.y - 1 // the row over the lower box
    const level = selected && (e.from === selected || e.to === selected) ? 3 : e.isAnswered ? 2 : 1
    const isDashed = !e.isAnswered
    if (low.layer - top.layer === 1) {
      const mid = y1 + 1
      trace([[x1, y1], [x1, mid], [x2, mid], [x2, y2]], level, isDashed)
    } else {
      // past the layers in between: down a lane beside them
      const between = [...boxes.entries()].filter(([k]) => {
        const l = byKey.get(k)?.layer ?? -1
        return l > top.layer && l < low.layer
      }).map(([, b]) => b)
      let lane = Math.max(...between.map(b => b.x + b.w)) + 1 + 2 * right
      if (lane < width) right++
      else {
        lane = Math.min(...between.map(b => b.x)) - 2 - 2 * left
        if (lane >= 0) left++
        else lane = x1
      }
      trace([[x1, y1], [x1, y1 + 1], [lane, y1 + 1], [lane, y2 - 1], [x2, y2 - 1], [x2, y2]], level, isDashed)
    }
    if (isDown) arrows.push([x2, y2, '▼', level])
    else arrows.push([x1, y1, '▲', level])
  }

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < width; x++) {
      const m = mask[y]![x]!
      if (!m) continue
      let ch = SOLID[m] ?? '┼'
      if (dashed[y]![x]) ch = ch === '│' ? '┆' : ch === '─' ? '┄' : ch
      glyph[y]![x] = ch
      paint[y]![x] = rank[y]![x] === 3 ? 'edgeSel' : rank[y]![x] === 2 ? 'edge' : 'edgeDim'
    }
  }
  for (const [x, y, ch, level] of arrows) {
    if (y < 0 || y >= H) continue
    glyph[y]![x] = ch
    paint[y]![x] = level === 3 ? 'edgeSel' : level === 2 ? 'edge' : 'edgeDim'
  }

  for (const n of g.nodes) {
    const b = boxes.get(n.key)!
    const isSel = n.key === selected
    const border: Paint = isSel ? 'nodeSel' : 'node'
    const put = (x: number, y: number, ch: string, p: Paint) => {
      if (x >= 0 && x < width && y >= 0 && y < H) {
        glyph[y]![x] = ch
        paint[y]![x] = p
      }
    }
    put(b.x, b.y, '╭', border)
    put(b.x + b.w - 1, b.y, '╮', border)
    put(b.x, b.y + b.h - 1, '╰', border)
    put(b.x + b.w - 1, b.y + b.h - 1, '╯', border)
    for (let x = b.x + 1; x < b.x + b.w - 1; x++) {
      put(x, b.y, '─', border)
      put(x, b.y + b.h - 1, '─', border)
    }
    for (let y = b.y + 1; y < b.y + b.h - 1; y++) {
      put(b.x, y, '│', border)
      put(b.x + b.w - 1, y, '│', border)
      for (let x = b.x + 1; x < b.x + b.w - 1; x++) put(x, y, ' ', 'blank')
    }
    put(b.x + 2, b.y + 1, n.isRunning ? '●' : '○', n.isRunning ? 'dotOn' : 'dotOff')
    const name = Array.from(fit(label(n.side), b.w - 6))
    name.forEach((ch, i) => put(b.x + 4 + i, b.y + 1, ch, isSel ? 'nameSel' : 'name'))
    const sub = Array.from(fit(n.sub, b.w - 4))
    sub.forEach((ch, i) => put(b.x + 2 + i, b.y + 2, ch, 'sub'))
  }

  // runs of one paint per row
  return glyph.map((row, y) => {
    const runs: Run[] = []
    row.forEach((ch, x) => {
      const p = paint[y]![x]!
      const last = runs[runs.length - 1]
      if (last && last.paint === p) last.text += ch
      else runs.push({ text: ch, paint: p })
    })
    return runs
  })
}

// ---------------------------------------------------------------------------
// the remote surfaces: one SVG

export type SvgColors = { bg: string; node: string; nodeSel: string; fill: string; name: string; sub: string; on: string; off: string; edge: string; edgeSel: string; edgeDim: string }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** The graph as an SVG document `w` pixels wide. */
export function drawSvg(g: Graph, layers: Node[][], selected: string | undefined, c: SvgColors, w = 640): { source: string; height: number } {
  const NW = 168
  const NH = 58
  const GAP = 64
  const PAD = 20
  const widest = Math.max(1, ...layers.map(r => r.length))
  const width = Math.max(w, widest * (NW + 24) + PAD * 2)
  const height = PAD * 2 + layers.length * NH + (layers.length - 1) * GAP
  const pos = new Map<string, { x: number; y: number }>()
  layers.forEach((row, i) => {
    const step = (width - PAD * 2) / row.length
    row.forEach((n, j) => pos.set(n.key, { x: Math.round(PAD + step * (j + 0.5) - NW / 2), y: PAD + i * (NH + GAP) }))
  })
  const byKey = new Map(g.nodes.map(n => [n.key, n]))
  const parts: string[] = []
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">`)
  parts.push(`<defs>${(['edge', 'edgeSel', 'edgeDim'] as const).map(k => `<marker id="a-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${c[k]}"/></marker>`).join('')}</defs>`)
  parts.push(`<rect x="0" y="0" width="${width}" height="${height}" rx="12" fill="${c.bg}"/>`)
  // each link gets its own port; a link past a layer takes the rightmost ones and a lane beside the layers in between
  const ends = g.edges
    .map(e => ({ e, a: byKey.get(e.from), b: byKey.get(e.to) }))
    .filter((x): x is { e: Edge; a: Node; b: Node } => !!x.a && !!x.b)
    .map(({ e, a, b }) => ({ e, isDown: a.layer < b.layer, top: a.layer < b.layer ? a : b, low: a.layer < b.layer ? b : a }))
  const along = (x: { top: Node; low: Node }, other: Node) => (x.low.layer - x.top.layer > 1 ? Infinity : pos.get(other.key)!.x)
  const port = (n: Node, side: 'out' | 'in', e: Edge) => {
    const mine = ends.filter(x => (side === 'out' ? x.top : x.low).key === n.key).sort((x, y) => along(x, side === 'out' ? x.low : x.top) - along(y, side === 'out' ? y.low : y.top))
    return pos.get(n.key)!.x + Math.round((NW * (mine.findIndex(x => x.e === e) + 1)) / (mine.length + 1))
  }
  let lanes = 0
  const isSelEdge = (e: Edge) => !!selected && (e.from === selected || e.to === selected)
  // links under the nodes, the selected ones last
  for (const { e, isDown, top, low } of [...ends].sort((x, y) => Number(isSelEdge(x.e)) - Number(isSelEdge(y.e)))) {
    const x1 = port(top, 'out', e)
    const y1 = pos.get(top.key)!.y + NH
    const x2 = port(low, 'in', e)
    const y2 = pos.get(low.key)!.y
    const k = isSelEdge(e) ? 'edgeSel' : e.isAnswered ? 'edge' : 'edgeDim'
    let d: string
    if (low.layer - top.layer === 1) {
      const my = (y1 + y2) / 2
      d = `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2 - 2}`
    } else {
      const between = g.nodes.filter(n => n.layer > top.layer && n.layer < low.layer).map(n => pos.get(n.key)!.x + NW)
      const lane = Math.min(width - 10, Math.max(...between) + 22 + 14 * lanes++)
      const r = GAP / 2
      d = `M${x1},${y1} C${x1},${y1 + r} ${lane},${y1 + r * 0.4} ${lane},${y1 + r * 1.4} L${lane},${y2 - r * 1.4} C${lane},${y2 - r * 0.4} ${x2},${y2 - r} ${x2},${y2 - 2}`
    }
    const marker = isDown ? `marker-end="url(#a-${k})"` : `marker-start="url(#a-${k})"`
    parts.push(`<path d="${d}" fill="none" stroke="${c[k]}" stroke-width="${k === 'edgeSel' ? 2.5 : 2}"${e.isAnswered ? '' : ' stroke-dasharray="6 5"'} ${marker}/>`)
  }
  for (const n of g.nodes) {
    const p = pos.get(n.key)!
    const isSel = n.key === selected
    parts.push(`<rect x="${p.x}" y="${p.y}" width="${NW}" height="${NH}" rx="10" fill="${c.fill}" stroke="${isSel ? c.nodeSel : c.node}" stroke-width="${isSel ? 2.5 : 1.5}"/>`)
    parts.push(`<circle cx="${p.x + 18}" cy="${p.y + 21}" r="5" fill="${n.isRunning ? c.on : 'none'}" stroke="${n.isRunning ? c.on : c.off}" stroke-width="1.5"/>`)
    parts.push(`<text x="${p.x + 32}" y="${p.y + 26}" font-size="15" font-weight="600" fill="${c.name}">${esc(fit(label(n.side), 16))}</text>`)
    parts.push(`<text x="${p.x + 14}" y="${p.y + 46}" font-size="12" fill="${c.sub}">${esc(fit(n.sub, 20))}</text>`)
  }
  parts.push('</svg>')
  return { source: parts.join(''), height }
}
