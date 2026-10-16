import { atom, read, update } from 'claude-code'
import type { AgentInfo, CommandRunResult, EngineInterface, Register, SessionReceiveOrigin, SessionSendResult, TraceEntry } from 'claude-code'

import type { HighCommandEntry, HighCommandLane, HighCommandThread } from '../types'
import { agentSenderOf, isAgentMessage, parseDelivery, spawnerOf, UNNAMED, type NewEntry, type PeerReport } from './envelope'
import {
  appendEntries,
  coreEvidence,
  applyReports,
  fitLanes,
  hideLanes,
  isNewerView,
  keepsThread,
  lanesSeen,
  lanesUnread,
  markOf,
  markRead,
  newestInboundSeq,
  newestSeq,
  newestUnreadableSeq,
  outboundEntry,
  recipientOf,
  rosterOf,
  threadOf,
  unreadTotal,
  type RosterRow,
} from './inbox'
import { parseListing, parseStructuredListing } from './listing'
import { summaryText } from './summary'
import { count, sanitize, peerKey, peerLabels, unreadText } from './text'
import { bandTree, compactBandTree, fitsBounds, paneTree, type BandActions, type PaneActions } from './views'

const DESCRIPTION = 'High Command: messages from teammates and other sessions (/highcommand open shows the pane)'
const PANE = { id: 'high-command', title: 'High Command', focus: true } as const
const USAGE = 'Usage: /highcommand shows the inbox summary. /highcommand open opens the High Command pane.'
const NO_PANES =
  'command.run: this session draws no panes (claude -p or an SDK host). Use /highcommand for the summary.'

/** The origin kinds whose deliveries can hold messages from peers; `unclassified` counts only with a frame. */
const MESSAGE_ORIGINS: ReadonlySet<string> = new Set(['peer', 'coordinator', 'peer-send-message', 'unclassified'])

const ENTRIES = { plugin: 'high-command', key: 'entries' } as const
const READ_THROUGH = { plugin: 'high-command', key: 'readThrough' } as const
const STATUS_FROM = { plugin: 'high-command', key: 'statusFrom' } as const
const LANES = { plugin: 'high-command', key: 'lanes' } as const

const entries = atom(ENTRIES, [])
const peers = atom({ plugin: 'high-command', key: 'peers' } as const, {})
const readThrough = atom(READ_THROUGH, {})
const openThread = atom({ plugin: 'high-command', key: 'openThread' } as const, null)
const hiddenThrough = atom({ plugin: 'high-command', key: 'hiddenThrough' } as const, 0)
const inboundThrough = atom({ plugin: 'high-command', key: 'inboundThrough' } as const, 0)

const lanes = atom(LANES, {})
const hiddenLanes = atom({ plugin: 'high-command', key: 'hiddenLanes' } as const, {})
const selectedLane = atom({ plugin: 'high-command', key: 'selectedLane' } as const, null)
const lanePage = atom({ plugin: 'high-command', key: 'lanePage' } as const, 0)
const rosterPage = atom({ plugin: 'high-command', key: 'rosterPage' } as const, 0)
const agents = atom({ plugin: 'high-command', key: 'agents' } as const, {})
const capture = atom({ plugin: 'high-command', key: 'capture' } as const, null)

function emptyLane(): HighCommandLane {
  return { entries: [], peers: {}, readThrough: {}, openThread: null }
}

async function readLane($: EngineInterface, id: string): Promise<HighCommandLane> {
  const all = await read($, lanes)
  return Object.hasOwn(all, id) ? all[id]! : emptyLane()
}

/** Changes one agent lane; fitLanes keeps all lanes within the space of one saved value. */
async function changeLane($: EngineInterface, id: string, change: (lane: HighCommandLane) => HighCommandLane): Promise<void> {
  await update($, lanes, known => {
    const next = new Map(Object.entries(known))
    next.set(id, change(next.get(id) ?? emptyLane()))
    return fitLanes(Object.fromEntries(next), id)
  })
}

/** Changes every agent lane at once. */
async function changeLanes($: EngineInterface, change: (lane: HighCommandLane) => HighCommandLane): Promise<void> {
  await update($, lanes, known => fitLanes(Object.fromEntries(Object.entries(known).map(([id, lane]) => [id, change(lane)]))))
}

async function changeThread($: EngineInterface, id: string | undefined, change: (thread: HighCommandThread | null) => HighCommandThread | null): Promise<void> {
  if (id === undefined) await update($, openThread, change)
  else await changeLane($, id, lane => ({ ...lane, openThread: change(lane.openThread) }))
}

async function ensureCapture($: EngineInterface, at: number, reset = false): Promise<void> {
  if (await read($, capture) !== null) return
  await update($, capture, known => known ?? { at, reset })
}

/** Reads status without treating a repeated split-pane roster word as liveness evidence. */
async function refreshAgents($: EngineInterface, event: string): Promise<void> {
  try {
    const at = await $.clock.now()
    const list = await $.agent.list()
    await update($, agents, known => {
      const next = new Map(Object.entries(known).filter(([, value]) => value.at > at))
      for (const agent of list) if (!next.has(agent.id)) next.set(agent.id, {
        id: agent.id, name: agent.name === undefined ? undefined : peerKey(agent.name),
        status: agent.status, at, source: 'roster snapshot',
        lastEvent: Object.hasOwn(known, agent.id) ? known[agent.id]?.lastEvent : undefined,
      })
      return Object.fromEntries(next)
    })
  } catch (error) {
    diagnose($, `high-command: ${event}: could not refresh local agents: ${causeOf(error)}`)
  }
}

/** Transcript diagnostics already written since this module loaded. */
const logged = new Set<string>()

function causeOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Writes a diagnostic to the transcript once per module load; a repeat goes to the debug log alone. */
function diagnose($: EngineInterface, line: string): void {
  if (logged.has(line)) {
    $.ui.log(line.replace(/^high-command: /, ''), { to: 'debug' })
    return
  }
  logged.add(line)
  $.ui.log(line.replace(/^high-command: /, ''))
}

/**
 * Pins the unread count as this plugin's status line, which no other mod's band can hide, or clears the
 * line at zero. It runs after every change of the count; a failure is diagnosed under `event`. `withLanes`
 * (agentLanesInBand) adds the unread count of all agent lanes, and the version of `lanes` to the view.
 *
 * Refreshes overlap, and a dispatch reads state as it stood at its own last write, so a refresh pins its
 * count only for a view newer than the one behind the line (STATUS_FROM, written with ifVersion). The refresh
 * after the last write of either value reads both final values; a refresh with an older view loses the
 * ifVersion race, and its next reads show what stands. A pin can still show after a newer one when its
 * answer comes late, so each refresh then writes its pin again with ifVersion: a miss means a newer pin
 * landed, and the refresh shows that one. `isForced` pins the first view whatever the line shows: a reload
 * may drop the line.
 */
async function syncStatus($: EngineInterface, event: string, isForced = false, withLanes = false): Promise<void> {
  try {
    for (let isFirst = true; ; isFirst = false) {
      const list = await $.state.get(ENTRIES)
      const marks = await $.state.get(READ_THROUGH)
      const all = withLanes ? await $.state.get(LANES) : undefined
      const pinned = await $.state.get(STATUS_FROM)
      const view = { entries: list.version, marks: marks.version, ...(all === undefined ? {} : { lanes: all.version }) }
      if (!isNewerView(view, isForced && isFirst ? undefined : pinned.value)) return
      let pin: { entries: number; marks: number; unread: number; lanes?: number; laneUnread?: number } = {
        ...view, unread: unreadTotal(rosterOf(list.value ?? [], {}, marks.value ?? {})),
        ...(all === undefined ? {} : { laneUnread: lanesUnread(all.value ?? {}) }),
      }
      const written = await $.state.set(STATUS_FROM, pin, { ifVersion: pinned.version })
      if (!written.isSet) continue
      for (let version = written.version; ; ) {
        $.ui.status(unreadText(pin.unread, pin.laneUnread) || undefined)
        if ((await $.state.set(STATUS_FROM, pin, { ifVersion: version })).isSet) return
        const newer = await $.state.get(STATUS_FROM)
        if (newer.value === undefined) return
        pin = newer.value
        version = newer.version
      }
    }
  } catch (error) {
    diagnose($, `high-command: ${event}: could not update the status line: ${causeOf(error)}`)
  }
}

/** The stored entries and the roster built from them, as `/highcommand` and the pane read them. */
async function readRoster($: EngineInterface, laneId?: string): Promise<{ list: HighCommandEntry[]; rows: RosterRow[] }> {
  if (laneId !== undefined) {
    const lane = await readLane($, laneId)
    return { list: lane.entries, rows: rosterOf(lane.entries, lane.peers, lane.readThrough) }
  }
  const list = await read($, entries)
  return { list, rows: rosterOf(list, await read($, peers), await read($, readThrough)) }
}

/**
 * Appends fresh entries. The open thread closes when this append drops its peer from the window, so the pane
 * shows the roster and stays there when that peer writes again. The check runs inside update, so it judges
 * the thread open now, and keepsThread keeps a thread opened after this append. `inboundThrough`, and a lane's
 * own `inboundThrough`, keep the newest inbound seq after its entry leaves the window, so a Hide that it outdates
 * stays ended.
 */
async function append($: EngineInterface, fresh: readonly NewEntry[], at: number, laneId?: string): Promise<void> {
  if (laneId !== undefined) {
    await changeLane($, laneId, lane => {
      const list = appendEntries(lane.entries, fresh, at)
      return {
        ...lane, entries: list, inboundThrough: Math.max(lane.inboundThrough ?? 0, newestUnreadableSeq(list)),
        openThread: lane.openThread === null || keepsThread(lane.openThread, lane.entries, list) ? lane.openThread : null,
      }
    })
    return
  }
  let before: readonly HighCommandEntry[] = []
  const list = await update($, entries, known => {
    before = known
    return appendEntries(known, fresh, at)
  })
  await update($, openThread, open => (open === null || keepsThread(open, before, list) ? open : null))
  await update($, inboundThrough, seq => Math.max(seq, newestInboundSeq(list)))
}

async function saveReports($: EngineInterface, reports: readonly PeerReport[], at: number, laneId?: string): Promise<void> {
  if (laneId === undefined) await update($, peers, known => applyReports(known, reports, at))
  else await changeLane($, laneId, lane => ({ ...lane, peers: applyReports(lane.peers, reports, at) }))
}

/**
 * Records the entries and peer states of one queued delivery, and says in the debug log when it names no
 * sender. `event` is the hook that saw it: session.receive, or prompt.submit for a local agent's message.
 * `sender`, when given, files all of the delivery under that name, whatever names its text claims.
 */
async function recordDelivery($: EngineInterface, event: string, text: string, origin: SessionReceiveOrigin, at: number, laneId?: string, sender?: string): Promise<void> {
  const parsed = parseDelivery(text, origin, sender)
  if (parsed.incomplete) diagnose($, `high-command: ${event}: incomplete frame parsing; consult the transcript for original framing`)
  if ([...parsed.entries, ...parsed.reports].some(item => item.peer === UNNAMED)) {
    $.ui.log(`${event}: a ${origin.kind} delivery named no sender; it shows as "${UNNAMED}"`, { to: 'debug' })
  }
  if (parsed.entries.length === 0 && parsed.reports.length === 0) return
  // In an agent lane, a coordinator delivery is the main conversation's own message to that agent: never unread.
  const fresh = laneId !== undefined && origin.kind === 'coordinator' ? parsed.entries.map(entry => ({ ...entry, fromMain: true as const })) : parsed.entries
  if (fresh.length > 0) await append($, fresh, at, laneId)
  if (parsed.reports.length > 0) await saveReports($, parsed.reports, at, laneId)
}

/** The local agents for a subagent message's sender label; a failure keeps the label and goes to the debug log. */
async function agentsForLabel($: EngineInterface): Promise<readonly AgentInfo[]> {
  try {
    return await $.agent.list()
  } catch (error) {
    $.ui.log(`prompt.submit: could not read local agents: ${causeOf(error)}; the message keeps the local sender label`, { to: 'debug' })
    return []
  }
}

/** Records the observed send attempt and its result; an attempt to an agent with no name is left out. */
async function recordSend($: EngineInterface, to: string, text: string, sent: SessionSendResult, trace: readonly TraceEntry<'session.send'>[], at: number, laneId?: string): Promise<void> {
  const lane = laneId === undefined ? undefined : await readLane($, laneId)
  const peer = recipientOf(to, lane?.peers ?? await read($, peers), await $.agent.list(), lane?.entries ?? await read($, entries))
  if (peer === undefined) return
  await append($, [{ ...outboundEntry(peer, text, sent), core: coreEvidence(trace) }], at, laneId)
}

/** Records the peer states a ListAgents listing names, or says in the debug log that no row gave one. */
async function recordListing($: EngineInterface, { reports, rowCount }: ReturnType<typeof parseListing>, laneId?: string): Promise<void> {
  reports.forEach(report => { report.source ??= 'formatted listing' })
  if (reports.length > 0) {
    const at = await $.clock.now()
    await saveReports($, reports, at, laneId)
  } else if (rowCount > 0) {
    $.ui.log(
      `tool.call ListAgents: no listing row gave a peer state (${count(rowCount, 'row')} read); peer states are unchanged`,
      { to: 'debug' },
    )
  }
}

/** Opens the main inbox roster; answers why the pane is not drawn, or undefined when it is. */
async function openPane($: EngineInterface): Promise<string | undefined> {
  await refreshAgents($, 'ui.open')
  try { await ensureCapture($, await $.clock.now()) } catch (error) { diagnose($, `high-command: ui.open: could not set capture window: ${causeOf(error)}`) }
  await update($, selectedLane, () => '')
  await update($, rosterPage, () => 0)
  await update($, openThread, () => null)
  const opened = await $.ui.open(PANE)
  return opened.isPlaced ? undefined : `the pane waits to be drawn: ${opened.reason}`
}

/** `/highcommand open`: the pane, or the reason there is none. */
async function openFromCommand($: EngineInterface): Promise<CommandRunResult> {
  try {
    if ((await $.session.surfaces()).length === 0) return { text: NO_PANES }
    const problem = await openPane($)
    return problem === undefined ? {} : { text: `command.run: ${problem}` }
  } catch (error) {
    return { text: `command.run: the pane did not open: ${causeOf(error)}` }
  }
}

/**
 * Runs a button's work; a failure becomes a toast that names the action. The press counts as the person's
 * own input only while its onPress work runs, so each handler returns this promise: a `$.ui.open` after
 * awaits is then asked, and the pane is placed at any width.
 */
function press($: EngineInterface, action: string, work: () => Promise<unknown>): Promise<void> {
  return work().then(() => undefined, (error: unknown) => $.ui.toast(`ui.press: ${action}: ${causeOf(error)}`))
}

/**
 * Marks `peer`, or every peer when none is given, read through its newest inbound entry, and refreshes the status
 * line: for an agent lane only when the line counts agent lanes (`withLanes`).
 */
async function markPeersRead($: EngineInterface, peer?: string, laneId?: string, withLanes = false): Promise<void> {
  if (laneId !== undefined) {
    await changeLane($, laneId, lane => ({ ...lane, readThrough: markRead(lane.readThrough, lane.entries, peer) }))
    if (withLanes) await syncStatus($, 'ui.press', false, true)
    return
  }
  const list = await read($, entries)
  await update($, readThrough, marks => markRead(marks, list, peer))
  await syncStatus($, 'ui.press', false, withLanes)
}

/** `Read all` in the band; with agentLanesInBand (`withLanes`), it also marks every agent lane read. */
function readAll($: EngineInterface, withLanes: boolean): Promise<void> {
  return press($, 'read all', async () => {
    if (withLanes) await changeLanes($, lane => ({ ...lane, readThrough: markRead(lane.readThrough, lane.entries) }))
    await markPeersRead($, undefined, undefined, withLanes)
  })
}

function paneActions($: EngineInterface, withLanes: boolean, laneId?: string): PaneActions {
  /** Any change of a lane can evict lane messages (fitLanes); with agentLanesInBand, the status line then counts again. */
  const thenSync = (work: () => Promise<unknown>) => async (): Promise<void> => {
    await work()
    if (laneId !== undefined && withLanes) await syncStatus($, 'ui.press', false, true)
  }
  return {
    openThread: peer => press($, 'open thread', async () => {
      const lane = laneId === undefined ? undefined : await readLane($, laneId)
      const marks = lane?.readThrough ?? await read($, readThrough)
      const from = newestSeq(lane?.entries ?? await read($, entries))
      await changeThread($, laneId, () => ({ peer, since: markOf(marks, peer), from }))
      await markPeersRead($, peer, laneId, withLanes)
    }),
    back: () => press($, 'back', thenSync(() => changeThread($, laneId, () => null))),
    markRead: peer => press($, 'mark read', () => markPeersRead($, peer, laneId, withLanes)),
    readAll: () => press($, 'read all', () => markPeersRead($, undefined, laneId, withLanes)),
    page: page => press($, 'page', thenSync(() => changeThread($, laneId, open => open === null ? null : { ...open, page }))),
    identity: identityPage => press($, 'identity', thenSync(() => changeThread($, laneId, open => open === null ? null : { ...open, identityPage }))),
    reason: reasonSeq => press($, 'send details', thenSync(() => changeThread($, laneId, open => open === null ? null : { ...open, reasonSeq: open.reasonSeq === reasonSeq ? undefined : reasonSeq }))),
    lane: id => press($, 'select lane', () => update($, selectedLane, () => id)),
    rosterPage: page => press($, 'peer page', thenSync(async () => {
      if (laneId === undefined) await update($, rosterPage, () => page)
      else await changeLane($, laneId, lane => ({ ...lane, rosterPage: page }))
    })),
    lanePage: page => press($, 'agent page', () => update($, lanePage, () => page)),
  }
}

/** The band's buttons; with agentLanesInBand (`withLanes`), Read all and Hide also cover agent lanes. */
function bandActions($: EngineInterface, withLanes: boolean): BandActions {
  return {
    open: () =>
      press($, 'the pane did not open', async () => {
        const problem = await openPane($)
        if (problem !== undefined) $.ui.toast(`ui.press: ${problem}`)
      }),
    readAll: () => readAll($, withLanes),
    hide: () =>
      press($, 'hide', async () => {
        const through = newestSeq(await read($, entries))
        if (withLanes) {
          const all = await read($, lanes)
          await update($, hiddenLanes, hidden => hideLanes(hidden, all))
        }
        await update($, hiddenThrough, seq => Math.max(seq, through))
      }),
  }
}

export const register: Register = (on, options) => {
  /** The `agentLanesInBand` option: the band and the status line add the unread count of all agent lanes. */
  const withLanes = options.agentLanesInBand === true

  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({ name: 'highcommand', description: DESCRIPTION, argumentHint: '[open]', immediate: true })
    } catch (error) {
      diagnose($, `high-command: session.start: could not register /highcommand: ${causeOf(error)}`)
    }
    try { await ensureCapture($, await $.clock.now()) } catch (error) { diagnose($, `high-command: session.start: could not set capture window: ${causeOf(error)}`) }
    await syncStatus($, 'session.start', true, withLanes)
    return next(e)
  })

  // /clear, /resume, and /branch reset $.state but leave the status line pinned.
  on('classic.SessionStart', { source: ['clear', 'resume', 'fork'] }, async ($, e, next) => {
    try { await ensureCapture($, await $.clock.now(), true) } catch (error) { diagnose($, `high-command: classic.SessionStart: could not set capture window: ${causeOf(error)}`) }
    await syncStatus($, 'classic.SessionStart', false, withLanes)
    return next(e)
  })

  on('session.receive', async ($, e, next) => {
    if (!MESSAGE_ORIGINS.has(e.origin.kind)) return next(e)
    let at: number | undefined
    try { at = await $.clock.now(); await ensureCapture($, at) } catch (error) { diagnose($, `high-command: session.receive: could not observe delivery time: ${causeOf(error)}`) }
    const queued = await next(e)
    if (queued.consumed !== undefined) return queued
    try {
      if (at !== undefined) {
        await recordDelivery($, 'session.receive', queued.text, e.origin, at, e.agentId)
      }
    } catch (error) {
      diagnose($, `high-command: session.receive: could not record a delivery (${e.origin.kind}): ${causeOf(error)}`)
    }
    if (e.agentId === undefined || withLanes) await syncStatus($, 'session.receive', false, withLanes)
    return queued
  })

  // In Claude Code 2.1.296 a named subagent's SendMessage to the main conversation skips session.receive:
  // Claude Code submits its <agent-message> as a peer prompt, while the session is idle or into a running
  // turn. A message from another session passed session.receive first, so only an agent message counts here.
  // A mod beneath can rewrite it without the frame; the text that entered is then filed under the one sender
  // that the frames named, or under `unnamed peer`, and a name that the rewritten text claims does not count.
  // The prompt's origin does not say whether a mod started the sender, so the local agent list can lower its label;
  // the list is read before the mods beneath run, while an agent that ends meanwhile is still listed.
  on('prompt.submit', { origin: { kind: 'peer' } }, async ($, e, next) => {
    if (!isAgentMessage(e.text)) return next(e)
    let at: number | undefined
    try { at = await $.clock.now(); await ensureCapture($, at) } catch (error) { diagnose($, `high-command: prompt.submit: could not observe delivery time: ${causeOf(error)}`) }
    const named = agentSenderOf(e.text, e.origin)
    const listed = named === undefined ? undefined : agentsForLabel($)
    const entered = await next(e)
    if (entered.drop !== undefined) return entered
    try {
      if (at !== undefined) {
        let sender: string | undefined
        if (!isAgentMessage(entered.text)) {
          sender = named
          const filing = sender === undefined ? `its frames named no single sender, so it is filed under "${UNNAMED}"` : 'it is filed under the sender that the frame named'
          $.ui.log(`prompt.submit: a mod rewrote a subagent message without its <agent-message> frame; ${filing}`, { to: 'debug' })
          sender ??= UNNAMED
        }
        const plugin = named === undefined || listed === undefined ? undefined : spawnerOf(await listed, named)
        const origin = plugin === undefined ? e.origin : { kind: 'peer' as const, plugin }
        await recordDelivery($, 'prompt.submit', entered.text, origin, at, undefined, sender)
      }
    } catch (error) {
      diagnose($, `high-command: prompt.submit: could not record a delivery (${e.origin.kind}): ${causeOf(error)}`)
    }
    await syncStatus($, 'prompt.submit', false, withLanes)
    return entered
  })

  on('session.send', async ($, e, next) => {
    if (e.origin.kind !== 'model') return next(e)
    let at: number | undefined
    try { at = await $.clock.now(); await ensureCapture($, at) } catch (error) { diagnose($, `high-command: session.send: could not observe send time: ${causeOf(error)}`) }
    const sent = await next(e)
    try {
      if (at !== undefined) {
        await recordSend($, e.to, e.text, sent, next.trace, at, e.agentId)
      }
    } catch (error) {
      diagnose($, `high-command: session.send: could not record a message to ${sanitize(e.to)}: ${causeOf(error)}`)
    }
    if (e.agentId === undefined || withLanes) await syncStatus($, 'session.send', false, withLanes)
    return sent
  })

  on('tool.call', { tool: 'ListAgents' }, async ($, e, next) => {
    const out = await next(e)
    const result: unknown = out.isError === true ? undefined : out.result
    const structured = parseStructuredListing(result)
    const listing = typeof result === 'object' && result !== null && 'listing' in result ? result.listing : undefined
    if (structured === undefined && typeof listing !== 'string') return out
    try {
      if (structured !== undefined) {
        await recordListing($, structured, e.agentId)
      } else if (typeof listing === 'string') await recordListing($, parseListing(listing), e.agentId)
    } catch (error) {
      diagnose($, `high-command: tool.call ListAgents: could not record peer states: ${causeOf(error)}`)
    }
    // Peer states make a lane longer, so fitLanes can evict lane messages.
    if (e.agentId !== undefined && withLanes) await syncStatus($, 'tool.call ListAgents', false, true)
    return out
  })

  on('agent.spawn', async ($, e, next) => {
    const result = await next(e)
    await refreshAgents($, 'agent.spawn')
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined) {
      await refreshAgents($, 'turn.complete')
      try {
        const at = await $.clock.now()
        const id = e.agentId
        await update($, agents, known => {
          const observed = new Map(Object.entries(known))
          const agent = observed.get(id)
          const word = e.reason === 'answer' ? 'turn answered' : `turn ${e.reason}`
          if ((agent?.lastEvent?.at ?? -Infinity) <= at) observed.set(id, {
            ...agent, id, status: agent?.status ?? word, at: agent?.at ?? at,
            source: agent?.source ?? 'lifecycle observation', lastEvent: { word, at },
          })
          return Object.fromEntries(observed)
        })
      } catch (error) { diagnose($, `high-command: turn.complete: could not record lifecycle observation: ${causeOf(error)}`) }
    }
    return result
  })

  on('command.run', { command: 'highcommand' }, async ($, e) => {
    const argument = e.args.trim()
    if (argument === 'open') return openFromCommand($)
    if (argument !== '') return { text: USAGE }
    try {
      await refreshAgents($, 'command.run')
      const now = await $.clock.now()
      await ensureCapture($, now)
      const { list, rows } = await readRoster($)
      return { text: summaryText(rows, list.length, now, {
        evicted: list.at(-1)?.evictedTotal, capture: await read($, capture), agents: Object.values(await read($, agents)), lanes: await read($, lanes),
      }) }
    } catch (error) {
      return { text: `command.run: could not build the summary: ${causeOf(error)}` }
    }
  })

  on('ui.render', { component: 'Pane', requestId: 'high-command' }, async ($, e) => {
    const ui = $.ui.resolve(e)
    try {
      const chosen = await read($, selectedLane)
      const laneId = chosen === '' ? undefined : chosen ?? e.props.view.agentId
      const { list, rows } = await readRoster($, laneId)
      const thread = threadOf(list, rows, laneId === undefined ? await read($, openThread) : (await readLane($, laneId)).openThread)
      const now = await $.clock.now()
      const all = await read($, lanes)
      return paneTree(ui, { rows, now, thread, laneId, rosterPage: laneId === undefined ? await read($, rosterPage) : (await readLane($, laneId)).rosterPage, lanePage: await read($, lanePage),
        laneIds: Object.keys(all), agents: Object.values(await read($, agents)),
        laneUnread: new Map(Object.entries(all).map(([id, lane]) => [id, unreadTotal(rosterOf(lane.entries, {}, lane.readThrough))])),
        capture: await read($, capture), evicted: list.at(-1)?.evictedTotal ?? 0,
      }, paneActions($, withLanes, laneId))
    } catch (error) {
      const { Text } = ui
      return <Text color="red">{`high-command: ui.render (Pane): ${causeOf(error)}`}</Text>
    }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const below = await next(e)
    const list = await read($, entries)
    // A Hide holds while the person had seen every inbound entry: those in the window and those recorded before.
    const isHidden = (await read($, hiddenThrough)) >= Math.max(await read($, inboundThrough), newestInboundSeq(list))
    // With agentLanesInBand, it holds only while the person had also seen each agent lane's newest unread entry.
    const all = withLanes ? await read($, lanes) : {}
    if (isHidden && (!withLanes || lanesSeen(all, await read($, hiddenLanes)))) return below
    const rows = rosterOf(list, {}, await read($, readThrough))
    const waiting = rows.filter(row => row.unread > 0)
    const laneUnread = withLanes ? lanesUnread(all) : 0
    if (waiting.length === 0 && laneUnread === 0) return below
    // Other mods draw `below`; when the band would push it past the engine's bounds, it yields.
    const band = bandTree($.ui.resolve(e), waiting, bandActions($, withLanes), below, peerLabels(rows.map(row => row.peer)), laneUnread)
    if (fitsBounds(band)) return band
    const compact = compactBandTree($.ui.resolve(e), waiting, bandActions($, withLanes), below, laneUnread)
    return fitsBounds(compact) ? compact : below
  })
}
