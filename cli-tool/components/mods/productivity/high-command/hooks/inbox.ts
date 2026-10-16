import type { AgentInfo, SessionSendResult, TraceEntry } from 'claude-code'

import type { HighCommandEntry, HighCommandLane, HighCommandPeer, HighCommandState, HighCommandThread, HighCommandTrust } from '../types'
import type { NewEntry, PeerReport } from './envelope'
import { LIMITS } from './limits'
import { capBody, lineOf, peerKey, sanitize, summaryOf } from './text'

type Peers = Record<string, HighCommandPeer>

/** Per peer, the highest inbound seq marked read. */
type ReadMarks = Record<string, number>

/** The trust levels, the weakest first. */
const LEVELS: readonly HighCommandTrust[] = ['unverified', 'local', 'verified']

/** The six hexadecimal characters appended to a recipient name in ListAgents output. */
const RECIPIENT_REF = / \[[0-9a-f]{6}\]$/i

/**
 * A peer with entries: its unread count, its newest entry, its last reported state, and the trust level and
 * suspicious mark its row shows (no trust level when it only received sends).
 */
export type RosterRow = {
  peer: string
  unread: number
  last: HighCommandEntry
  state?: HighCommandState
  trust?: HighCommandTrust
  isSuspicious: boolean
}

/** The open thread as the pane draws it: the newest entries first, the count of older ones, and the count of new ones. */
export type Thread = { row: RosterRow; since: number; shown: HighCommandEntry[]; hidden: number; fresh: number; page: number; pages: number; identityPage?: number; reasonSeq?: number }

/** The seq of the newest entry, or 0 for an empty list. The window never drops its newest entry. */
export function newestSeq(list: readonly HighCommandEntry[]): number {
  return list.at(-1)?.seq ?? 0
}

/** The seq of the newest inbound entry, or 0 without one. */
export function newestInboundSeq(list: readonly HighCommandEntry[]): number {
  return list.findLast(entry => entry.direction === 'in')?.seq ?? 0
}

/**
 * Numbers and stamps fresh entries; keeps each peer's newest LIMITS.peerEntries entries and the newest
 * LIMITS.entries in all, so a busy peer drops its own oldest entries first.
 */
export function appendEntries(list: readonly HighCommandEntry[], fresh: readonly NewEntry[], at: number): HighCommandEntry[] {
  const newest = newestSeq(list)
  const all = [...list, ...fresh.map((entry, index) => ({ ...entry, seq: newest + index + 1, at }))]
  const held = new Map<string, number>()
  const kept = all.reverse().filter(entry => {
    const count = held.get(entry.peer) ?? 0
    held.set(entry.peer, count + 1)
    return count < LIMITS.peerEntries
  })
  const result = kept.slice(0, LIMITS.entries).reverse()
  const last = result.at(-1)
  if (last !== undefined) result[result.length - 1] = {
    ...last, evictedTotal: (list.at(-1)?.evictedTotal ?? 0) + all.length - result.length,
  }
  return result
}

/**
 * A record's own value under a peer name. Names come from senders, so `constructor` must not read
 * Object.prototype; records are written through Map and Object.fromEntries, so `__proto__` is a plain key.
 */
function own<T>(record: Readonly<Record<string, T>>, peer: string): T | undefined {
  return Object.hasOwn(record, peer) ? record[peer] : undefined
}

/** The peer's read mark: the highest inbound seq marked read, or 0 before any. */
export function markOf(marks: Readonly<ReadMarks>, peer: string): number {
  return own(marks, peer) ?? 0
}

/** String addresses can survive a hot reload; seenAt is their only saved timestamp. */
function addressOf(peer: HighCommandPeer): HighCommandPeer['address'] {
  return typeof peer.address === 'string' ? { value: peer.address, at: peer.seenAt } : peer.address
}

/**
 * Applies peer reports and keeps the LIMITS.peers peers reported most recently. Deliveries can finish
 * recording out of order, so a state or an address older than the stored one leaves it, and `seenAt` never
 * moves back. Address observations retain their application order to break timestamp ties.
 */
export function applyReports(peers: Readonly<Peers>, reports: readonly PeerReport[], at: number): Peers {
  const isCurrent = (stored: { at: number } | undefined): boolean => stored === undefined || stored.at <= at
  const next = new Map(Object.entries(peers).map(([name, peer]) => [
    name, typeof peer.address === 'string' ? { ...peer, address: addressOf(peer) } : peer,
  ]))
  let order = 0
  for (const peer of next.values()) order = Math.max(order, peer.address?.order ?? 0)
  for (const { peer, state, address, source } of reports) {
    const known = next.get(peer)
    next.set(peer, {
      ...known,
      seenAt: Math.max(known?.seenAt ?? at, at),
      ...(state !== undefined && isCurrent(known?.state) ? { state: { word: state, at, source: source ?? 'peer notice' } } : {}),
      ...(address !== undefined && isCurrent(known?.address) ? { address: { value: address, at, order: ++order } } : {}),
    })
  }
  const all = [...next]
  return Object.fromEntries(all.length <= LIMITS.peers ? all : all.sort(([, a], [, b]) => b.seenAt - a.seenAt).slice(0, LIMITS.peers))
}

/**
 * The key a send to a listed agent files under: its name, so the send joins that agent's messages to the main
 * conversation, or its name and ID when the name is empty after peerKey, another listed agent has that name, or a
 * peer of that name has an address (another session).
 */
function agentRecipient(agent: AgentInfo, agents: readonly AgentInfo[], peers: Readonly<Peers>): string {
  if (agent.name === undefined) return ''
  const name = peerKey(agent.name)
  const isShared = name === '' || own(peers, name)?.address !== undefined ||
    agents.some(other => other.id !== agent.id && peerKey(other.name ?? '') === name)
  return isShared ? peerKey(`${agent.name} [${agent.id}]`) : name
}

/**
 * The peer a send goes to: the peer whose newest address report matches `to`, else this session's agent whose
 * id is `to` (agentRecipient), else the name `to` gives; undefined when that is no name.
 * Equal address timestamps use observation order. Known names keep their brackets; an unknown recipient
 * can carry one trailing listing reference.
 */
export function recipientOf(to: string, peers: Readonly<Peers>, agents: readonly AgentInfo[], entries: readonly HighCommandEntry[] = []): string | undefined {
  let addressed: { name: string; at: number; order: number } | undefined
  for (const [name, peer] of Object.entries(peers)) {
    const address = addressOf(peer)
    if (address?.value === to && (addressed === undefined || address.at > addressed.at ||
      (address.at === addressed.at && (address.order ?? 0) > addressed.order))) {
      addressed = { name, at: address.at, order: address.order ?? 0 }
    }
  }
  if (addressed !== undefined) return addressed.name
  const agent = agents.find(candidate => candidate.id === to)
  let name = agent === undefined ? peerKey(to) : agentRecipient(agent, agents, peers)
  const isKnown = Object.hasOwn(peers, name) || entries.some(entry => entry.peer === name) ||
    agents.some(candidate => peerKey(candidate.name ?? '') === name)
  if (agent === undefined && !isKnown) {
    name = name.replace(RECIPIENT_REF, '')
  }
  return name === '' ? undefined : name
}

/** The observed send attempt, its reported outcome, and a bounded detailed refusal. */
export function outboundEntry(peer: string, text: string, sent: SessionSendResult): NewEntry {
  const body = sanitize(text)
  return {
    peer,
    direction: 'out',
    kind: 'message',
    summary: summaryOf(undefined, body),
    ...capBody(body),
    ...(!sent.isDelivered ? { refusal: capBody(sanitize(sent.reason)) } : {}),
    delivery: sent.isDelivered ? { isDelivered: true } : { isDelivered: false, reason: lineOf(sanitize(sent.reason)) },
  }
}

/** An inbound entry newer than `mark`. Outbound entries and lane copies of the main conversation's sends are never new. */
export function isNewer(entry: HighCommandEntry, mark: number): boolean {
  return entry.direction === 'in' && entry.fromMain !== true && entry.seq > mark
}

/** The unread count of all rows. */
export function unreadTotal(rows: readonly RosterRow[]): number {
  return rows.reduce((sum, row) => sum + row.unread, 0)
}

/**
 * One row per peer with entries: peers with unread entries first, then the newest activity first. While a peer
 * has unread entries, its row shows the weakest trust level and any suspicious mark among them, so a newer
 * message cannot hide a warning on one the person has not read; else it shows those of its newest inbound entry.
 */
export function rosterOf(entries: readonly HighCommandEntry[], peers: Readonly<Peers>, marks: Readonly<ReadMarks>): RosterRow[] {
  const rows = new Map<string, RosterRow>()
  for (const entry of entries) {
    const row = rows.get(entry.peer) ?? { peer: entry.peer, unread: 0, last: entry, state: own(peers, entry.peer)?.state, isSuspicious: false }
    if (entry.at > row.last.at || (entry.at === row.last.at && entry.seq > row.last.seq)) row.last = entry
    if (entry.direction === 'in') {
      const isUnread = isNewer(entry, markOf(marks, entry.peer))
      // A peer's read entries come before its unread ones, so its first unread entry starts the fold. A lane copy of
      // the main conversation's send is never unread and can follow unread entries; it leaves their fold alone.
      if (isUnread || row.unread === 0) {
        const isFolded = isUnread && row.unread > 0
        row.trust = isFolded ? LEVELS.find(level => level === row.trust || level === entry.trust) : entry.trust
        row.isSuspicious = (isFolded && row.isSuspicious) || entry.isSuspicious === true
      }
      if (isUnread) row.unread += 1
    }
    rows.set(entry.peer, row)
  }
  return [...rows.values()].sort((a, b) => Number(b.unread > 0) - Number(a.unread > 0) || b.last.at - a.last.at || b.last.seq - a.last.seq)
}

/** The unread count of all agent lanes. */
export function lanesUnread(lanes: Readonly<Record<string, HighCommandLane>>): number {
  return Object.values(lanes).reduce((sum, lane) => sum + unreadTotal(rosterOf(lane.entries, {}, lane.readThrough)), 0)
}

/** Per lane, the newest seq a press of Hide saw in `lanes`. A mark never moves back. */
export function hideLanes(hidden: Readonly<Record<string, number>>, lanes: Readonly<Record<string, HighCommandLane>>): Record<string, number> {
  const next = new Map(Object.entries(hidden))
  for (const [id, lane] of Object.entries(lanes)) next.set(id, Math.max(next.get(id) ?? 0, newestSeq(lane.entries)))
  return Object.fromEntries(next)
}

/** The seq of the newest lane entry that can be unread (isNewer), or 0 without one. */
export function newestUnreadableSeq(list: readonly HighCommandEntry[]): number {
  return list.findLast(entry => isNewer(entry, 0))?.seq ?? 0
}

/**
 * Whether a Hide saw every lane's newest entry that can be unread, also one that left its lane since: the lane's
 * `inboundThrough` keeps its seq, so an eviction cannot bring back a Hide that the entry ended.
 */
export function lanesSeen(lanes: Readonly<Record<string, HighCommandLane>>, hidden: Readonly<Record<string, number>>): boolean {
  return Object.entries(lanes).every(([id, lane]) => Math.max(lane.inboundThrough ?? 0, newestUnreadableSeq(lane.entries)) <= markOf(hidden, id))
}

/**
 * The versions of `entries` and `readThrough` that a status line count comes from, and the version of `lanes` when
 * the line also counts agent lanes.
 */
type StatusView = { entries: number; marks: number; lanes?: number }

/**
 * Whether a status refresh may pin its count: its view is older in no value than the view behind the line and
 * newer in one, the line has no view yet, or the line counts agent lanes and the refresh does not, or the reverse.
 */
export function isNewerView(view: StatusView, shown: StatusView | undefined): boolean {
  if (shown === undefined || (view.lanes === undefined) !== (shown.lanes === undefined)) return true
  const isOlder = view.entries < shown.entries || view.marks < shown.marks || (view.lanes ?? 0) < (shown.lanes ?? 0)
  return !isOlder && (view.entries > shown.entries || view.marks > shown.marks || (view.lanes ?? 0) > (shown.lanes ?? 0))
}

/**
 * Whether an append keeps the open thread: the person opened it after the append, or its peer
 * has entries before and after it. So the thread on a peer the append drops closes, and so does a thread
 * opened from an older view on a peer already gone, when that peer writes again.
 */
export function keepsThread(open: HighCommandThread, before: readonly HighCommandEntry[], after: readonly HighCommandEntry[]): boolean {
  const has = (list: readonly HighCommandEntry[]): boolean => list.some(entry => entry.peer === open.peer)
  return open.from >= newestSeq(after) || (has(before) && has(after))
}

/** The characters of `value` as JSON text: the measure that Claude Code holds a saved value to. */
function jsonChars(value: unknown): number {
  return JSON.stringify(value).length
}

/**
 * The lane without its `drop` oldest entries, where `drop` is less than its entry count. Its newest entry stays and
 * counts them as evicted, and the open thread closes as an append that dropped them would close it.
 */
function dropOldest(lane: HighCommandLane, drop: number): HighCommandLane {
  if (drop <= 0) return lane
  const kept = lane.entries.slice(drop)
  const last = kept.at(-1)!
  kept[kept.length - 1] = { ...last, evictedTotal: (last.evictedTotal ?? 0) + drop }
  const open = lane.openThread
  return { ...lane, entries: kept, openThread: open === null || keepsThread(open, lane.entries, kept) ? open : null }
}

/** Drops the lane's oldest entries while its entries pass LIMITS.laneChars; it keeps its newest entry. */
function capLane(lane: HighCommandLane): HighCommandLane {
  let size = jsonChars(lane.entries)
  if (size <= LIMITS.laneChars) return lane
  let drop = 0
  while (size > LIMITS.laneChars && drop < lane.entries.length - 1) {
    size -= jsonChars(lane.entries[drop]) + 1
    drop += 1
  }
  const next = dropOldest(lane, drop)
  // The evicted count on the newest entry adds a few characters.
  return drop > 0 && jsonChars(next.entries) > LIMITS.laneChars ? capLane(next) : next
}

/**
 * Fits the agent lanes in the space of one saved value. The lane `id`, the one that changed, first drops its own
 * oldest entries past LIMITS.laneChars. Then, while all lanes pass LIMITS.lanesChars, the entries observed first
 * drop from every lane. An entry drops only with the older entries of its lane, so it ranks by the latest observation
 * among them. Each lane keeps its newest entry, so its seq numbers and read marks stay in step.
 */
export function fitLanes(lanes: Readonly<Record<string, HighCommandLane>>, id?: string): Record<string, HighCommandLane> {
  const all = new Map(Object.entries(lanes))
  const changed = id === undefined ? undefined : all.get(id)
  if (changed !== undefined) all.set(id!, capLane(changed))
  let over = jsonChars(Object.fromEntries(all)) - LIMITS.lanesChars
  while (over > 0) {
    const ranked: { lane: string; index: number; at: number; size: number }[] = []
    for (const [name, lane] of all) {
      let at = -Infinity
      lane.entries.slice(0, -1).forEach((entry, index) => {
        at = Math.max(at, entry.at)
        ranked.push({ lane: name, index, at, size: jsonChars(entry) + 1 })
      })
    }
    if (ranked.length === 0) break
    ranked.sort((a, b) => a.at - b.at || a.index - b.index || (a.lane < b.lane ? -1 : a.lane > b.lane ? 1 : 0))
    const drops = new Map<string, number>()
    for (const { lane, index, size } of ranked) {
      if (over <= 0) break
      drops.set(lane, index + 1)
      over -= size
    }
    for (const [name, drop] of drops) all.set(name, dropOldest(all.get(name)!, drop))
    over = jsonChars(Object.fromEntries(all)) - LIMITS.lanesChars
  }
  return Object.fromEntries(all)
}

/** The thread of the open peer, or undefined when the pane draws the roster. */
export function threadOf(entries: readonly HighCommandEntry[], rows: readonly RosterRow[], open: HighCommandThread | null): Thread | undefined {
  const row = rows.find(candidate => candidate.peer === open?.peer)
  if (open === null || row === undefined) return undefined
  const all = entries.filter(entry => entry.peer === open.peer).sort((a, b) => b.at - a.at || b.seq - a.seq)
  const groups: HighCommandEntry[][] = [[]]
  let size = 0
  for (const entry of all) {
    const cost = JSON.stringify([entry.body, entry.summary]).length + 2000
    if (groups.at(-1)!.length >= LIMITS.threadEntries || size + cost > 60_000) {
      groups.push([])
      size = 0
    }
    groups.at(-1)!.push(entry)
    size += cost
  }
  const pages = groups.length
  const page = Math.max(0, Math.min(open.page ?? 0, pages - 1))
  const shown = groups[page]!
  const fresh = all.filter(entry => isNewer(entry, open.since)).length
  return { row, since: open.since, shown, hidden: all.length - shown.length, fresh, page, pages, identityPage: open.identityPage, reasonSeq: open.reasonSeq }
}

/**
 * Marks `peer`, or every peer when none is given, read through its newest inbound entry in the window `entries`.
 * A mark never moves back: `update` can apply an entries snapshot older than marks that another press already
 * wrote. A mark below the window's oldest entry goes, so the marks of peers that left the window do not pile up:
 * every entry of its peer, now or later, is newer, so it marked nothing. An older snapshot only drops less.
 */
export function markRead(marks: Readonly<ReadMarks>, entries: readonly HighCommandEntry[], peer?: string): ReadMarks {
  const oldest = entries[0]?.seq ?? 0
  const next = new Map(Object.entries(marks).filter(([, seq]) => seq >= oldest))
  for (const entry of entries) {
    if (entry.direction === 'in' && (peer === undefined || entry.peer === peer)) {
      next.set(entry.peer, Math.max(next.get(entry.peer) ?? 0, entry.seq))
    }
  }
  return Object.fromEntries(next)
}

/** The arrow and label for an inbound message or an observed send attempt. */
export function labelOf(entry: HighCommandEntry): { arrow: '←' | '→'; word: string } {
  if (entry.direction === 'out') return { arrow: '→', word: entry.delivery?.isDelivered === false ? 'send attempted (not delivered)' : 'send attempted' }
  return { arrow: '←', word: entry.kind === 'result' ? 'finished' : entry.kind === 'failure' ? 'failed' : 'message' }
}

/** A settled core call proves only that call's queue outcome. */
export function coreEvidence(trace: readonly TraceEntry<'session.send'>[]): HighCommandEntry['core'] {
  const core = trace.find(item => item.plugin === 'engine' && item.tier === 'core' &&
    (item.outcome === 'returned' || item.outcome === 'passed') && item.returned !== undefined)
  if (core?.returned === undefined) return undefined
  return {
    to: sanitize(core.received.to).slice(0, LIMITS.bodyChars),
    ...capBody(sanitize(core.received.text)),
    isDelivered: core.returned.isDelivered,
    ...(!core.returned.isDelivered ? { reason: lineOf(sanitize(core.returned.reason)) } : {}),
  }
}
