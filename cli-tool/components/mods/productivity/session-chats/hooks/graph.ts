/**
 * session-chats: the conversations as a graph, drawn as a file tree. Each
 * session is a node; each conversation is one link, its arrow from the session
 * that wrote first. No `$` here.
 *
 * Every group of sessions that talked is one tree, this session's first. A
 * link to a session already in the tree is a one-line reference, not a second
 * copy of its branch, so the tree stays as long as the number of links.
 */
import { clean, sideKey } from './chats.ts'
import type { Conversation, Side } from './chats.ts'

export type Node = {
  key: string
  side: Side
  isSelf: boolean
  isRunning: boolean
  /** The folder's last part, shown after the name. */
  sub: string
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

export type Row = {
  node: Node
  /** `│   ` and `    ` of the ancestors, then `├─` or `└─`; empty for a root. */
  prefix: string
  /** The link to the parent row; none for a root. */
  edge?: Edge
  /** `→` the parent wrote first, `←` this one did; `⇢` `⇠` while unanswered; `↺` a session shown elsewhere. */
  arrow: string
  /** A link to a session that already has its own row. */
  isRef: boolean
}

/** The graph as tree rows: this session's tree first, then each other group from its first sender. */
export function tree(g: Graph): Row[] {
  const touching = new Map<string, Edge[]>()
  for (const n of g.nodes) touching.set(n.key, [])
  for (const e of g.edges) {
    touching.get(e.from)?.push(e)
    touching.get(e.to)?.push(e)
  }
  const firstAt = (k: string) => Math.min(Infinity, ...touching.get(k)!.map(e => e.conv.firstAt))
  const reached = new Set(g.edges.map(e => e.to))
  const isSource = (k: string) => !reached.has(k)
  const roots = [...g.nodes].sort(
    (x, y) => Number(y.isSelf) - Number(x.isSelf) || Number(isSource(y.key)) - Number(isSource(x.key)) || (firstAt(x.key) === firstAt(y.key) ? 0 : firstAt(x.key) < firstAt(y.key) ? -1 : 1),
  )
  const byKey = new Map(g.nodes.map(n => [n.key, n]))
  const seen = new Set<string>()
  const used = new Set<Edge>()
  const rows: Row[] = []
  const visit = (k: string, indent: string) => {
    const mine = touching.get(k)!.filter(e => !used.has(e)).sort((x, y) => y.lastAt - x.lastAt)
    for (const e of mine) used.add(e)
    mine.forEach((e, i) => {
      const other = e.from === k ? e.to : e.from
      const node = byKey.get(other)
      if (!node) return
      const isLast = i === mine.length - 1
      const isRef = seen.has(other)
      const arrow = isRef ? '↺' : e.from === k ? (e.isAnswered ? '→' : '⇢') : e.isAnswered ? '←' : '⇠'
      rows.push({ node, prefix: indent + (isLast ? '└─' : '├─'), edge: e, arrow, isRef })
      if (isRef) return
      seen.add(other)
      visit(other, indent + (isLast ? '    ' : '│   '))
    })
  }
  for (const r of roots) {
    if (seen.has(r.key)) continue
    seen.add(r.key)
    rows.push({ node: r, prefix: '', arrow: '', isRef: false })
    visit(r.key, '')
  }
  return rows
}
