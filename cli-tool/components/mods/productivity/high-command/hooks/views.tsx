import type { BoxProps, ButtonProps, ElementConstructor, RenderElement, TextProps } from 'claude-code'

import type { HighCommandEntry, HighCommandAgent, HighCommandCapture } from '../types'
import { isNewer, labelOf, unreadTotal, type RosterRow, type Thread } from './inbox'
import { LIMITS } from './limits'
import { captureLabel, identityPart, clockLabel, count, peerLabel, peerLabels, stateLabel, trustLabel } from './text'

/** The elements High Command draws with; every surface's table has them. */
type HighCommandElements = {
  Box: ElementConstructor<BoxProps>
  Text: ElementConstructor<TextProps>
  Button: ElementConstructor<ButtonProps>
}

/** What the pane draws: the roster, or the open thread. */
type PaneModel = {
  rows: RosterRow[]; now: number; thread: Thread | undefined
  evicted?: number; capture?: HighCommandCapture | null
  rosterPage?: number; laneId?: string; laneIds?: string[]; lanePage?: number; agents?: HighCommandAgent[]
  /** Each agent lane's unread count, by agent id. */
  laneUnread?: ReadonlyMap<string, number>
}

/**
 * Each action returns its work, and each Button's onPress returns the action's promise: a press stays the
 * person's own input only while that work runs.
 */
export type PaneActions = {
  openThread: (peer: string) => Promise<void>
  back: () => Promise<void>
  markRead: (peer: string) => Promise<void>
  readAll: () => Promise<void>
  page: (page: number) => Promise<void>
  identity: (page: number | undefined) => Promise<void>
  reason: (seq: number) => Promise<void>
  lane: (id: string) => Promise<void>
  lanePage: (page: number) => Promise<void>
  rosterPage: (page: number) => Promise<void>
}

export type BandActions = { open: () => Promise<void>; readAll: () => Promise<void>; hide: () => Promise<void> }

/** The defined parts, joined with ` · `. */
function joined(parts: readonly (string | undefined)[]): string {
  return parts.filter(part => part !== undefined).join(' · ')
}

/** Labels send attempts and inbound results or failures before their summary. */
function kindPrefix(entry: HighCommandEntry): string {
  if (entry.direction === 'out') return 'send attempted: '
  const { word } = labelOf(entry)
  return word !== 'message' ? `${word}: ` : ''
}

/** The sender label and the suspicious mark come before the long state, so a narrow pane cuts the state first. */
function rowText(row: RosterRow, now: number): string {
  const { arrow } = labelOf(row.last)
  return joined([
    row.unread > 0 ? `${row.unread} new` : undefined,
    trustLabel(row.trust),
    row.isSuspicious ? 'suspicious' : undefined,
    clockLabel(row.last.at, now),
    stateLabel(row.state, now),
    `${arrow} ${kindPrefix(row.last)}${row.last.summary}${row.last.delivery?.isDelivered === false ? ' (not delivered)' : ''}`,
  ])
}

function entryHeader(entry: HighCommandEntry, isFresh: boolean, now: number): string {
  const delivery =
    entry.delivery === undefined ? '' : entry.delivery.isDelivered ? ' · reported send result: queued' : ` · reported send result: not delivered: ${entry.delivery.reason}`
  const marks = joined([trustLabel(entry.trust), entry.isSuspicious === true ? 'suspicious' : undefined])
  return `${labelOf(entry).arrow} ${clockLabel(entry.at, now)} ${kindPrefix(entry)}${entry.summary}${delivery}${marks === '' ? '' : ` · ${marks}`}${isFresh ? ' · new' : ''}`
}

function rosterView({ Box, Text, Button }: HighCommandElements, model: PaneModel, actions: PaneActions, labels: Map<string, string>): RenderElement {
  const unread = unreadTotal(model.rows)
  const pages = Math.max(1, Math.ceil(model.rows.length / LIMITS.rosterRows))
  const page = Math.max(0, Math.min(model.rosterPage ?? 0, pages - 1))
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" columnGap={1}>
        <Text bold>High Command</Text>
        <Text dimColor>{`· ${unread} unread (retained) · ${count(model.rows.length, 'peer')}`}</Text>
        {unread > 0 && <Button key="pane:read-all" label="Read all" hotkey="r" onPress={actions.readAll} />}
      </Box>
      {model.rows.length === 0 && <Text dimColor>No messages from teammates or other sessions in this capture window.</Text>}
      {model.rows.slice(page * LIMITS.rosterRows, (page + 1) * LIMITS.rosterRows).map((row, index) => (
        <Box flexDirection="row" columnGap={1}>
          <Button
            key={`open:${row.last.seq}`}
            label={labels.get(row.peer)!}
            plain
            {...(index < LIMITS.hotkeys ? { hotkey: String(index + 1) } : {})}
            onPress={() => actions.openThread(row.peer)}
          />
          <Text bold={row.unread > 0} wrap="truncate-end">
            {rowText(row, model.now)}
          </Text>
        </Box>
      ))}
      {pages > 1 && <Text dimColor>{`Peer page ${page + 1} of ${pages}`}</Text>}
      {page > 0 && <Button key="roster:previous" label="Previous peers" onPress={() => actions.rosterPage(page - 1)} />}
      {page + 1 < pages && <Button key="roster:next" label="More peers" onPress={() => actions.rosterPage(page + 1)} />}
    </Box>
  )
}

function threadView({ Box, Text, Button }: HighCommandElements, now: number, thread: Thread, actions: PaneActions, label: string): RenderElement {
  const { row, since, shown, hidden, fresh } = thread
  const details = joined([
    stateLabel(row.state, now),
    trustLabel(row.trust),
    count(shown.length + hidden, 'retained message'),
    fresh > 0 ? `${fresh} new` : undefined,
  ])
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" columnGap={1}>
        <Button key="pane:back" label="Back" hotkey="b" onPress={actions.back} />
        <Text bold>{label}</Text>
        <Button key="pane:identity" label="Identity" onPress={() => actions.identity(thread.identityPage === undefined ? 0 : undefined)} />
        <Text dimColor>{`· ${details}`}</Text>
        {row.unread > 0 && <Button key="pane:mark-read" label="Mark read" hotkey="r" onPress={() => actions.markRead(row.peer)} />}
      </Box>
      {thread.identityPage !== undefined && <Box flexDirection="column">
        <Text>{`Identity part ${thread.identityPage + 1} of ${Math.ceil(row.peer.length / 1000)} (${row.peer.length} characters):`}</Text>
        <Text>{identityPart(row.peer, thread.identityPage)}</Text>
        {thread.identityPage > 0 && <Button key="identity:previous" label="Previous identity part" onPress={() => actions.identity(thread.identityPage! - 1)} />}
        {(thread.identityPage + 1) * 1000 < row.peer.length && <Button key="identity:next" label="Next identity part" onPress={() => actions.identity(thread.identityPage! + 1)} />}
      </Box>}
      {shown.some(entry => entry.direction === 'out') && (
        <Text dimColor>Send attempts show observed text. Reported success is not a receipt for that text. Core evidence covers only the latest traced call, never reading or every send.</Text>
      )}
      {shown.map(entry => {
        const isFresh = isNewer(entry, since)
        return (
          <Box flexDirection="column" marginTop={1}>
            <Text bold={isFresh}>{entryHeader(entry, isFresh, now)}</Text>
            <Text wrap="wrap">{entry.body}</Text>
            {(entry.refusal !== undefined || entry.core !== undefined) && <Button key={`reason:${entry.seq}`} label="Send details" onPress={() => actions.reason(entry.seq)} />}
            {thread.reasonSeq === entry.seq && entry.refusal !== undefined && <Box flexDirection="column">
              <Text>{entry.refusal.body}</Text>
              {entry.refusal.fullChars > entry.refusal.body.length && <Text dimColor>{`Refusal truncated: ${entry.refusal.fullChars} characters originally; ${entry.refusal.body.length} retained.`}</Text>}
            </Box>}
            {thread.reasonSeq === entry.seq && entry.core !== undefined && <Box flexDirection="column">
              <Text>{`Latest traced core recipient (bounded): ${entry.core.to}`}</Text>
              <Text>{`Core queue outcome: ${entry.core.isDelivered ? 'accepted, not read' : `refused: ${entry.core.reason}`}`}</Text>
              <Text>{entry.core.body}</Text>
              {entry.core.fullChars > entry.core.body.length && <Text>{`Core text truncated: ${entry.core.fullChars} characters originally.`}</Text>}
            </Box>}
            {entry.fullChars > entry.body.length && (
              <Text dimColor>{`(${count(entry.fullChars - entry.body.length, 'more character')} in the transcript.)`}</Text>
            )}
          </Box>
        )
      })}
      {thread.page > 0 && <Button key="pane:newer" label="Newer" onPress={() => actions.page(thread.page - 1)} />}
      {thread.page + 1 < thread.pages && <Button key="pane:older" label="Older" onPress={() => actions.page(thread.page + 1)} />}
      {hidden > 0 && (
        <Box marginTop={1}>
          <Text dimColor>{`Page ${thread.page + 1} of ${thread.pages}; ${count(hidden, 'retained message')} on other pages.`}</Text>
        </Box>
      )}
    </Box>
  )
}

/** Includes JSON structure, escaped strings, and space for serialized button handlers. */
export function fitsBounds(tree: RenderElement): boolean {
  const pending = [{ node: tree as unknown, depth: 1 }]
  let nodes = 0
  while (pending.length > 0) {
    const { node, depth } = pending.pop()!
    if (++nodes > LIMITS.drawingNodes || depth > LIMITS.drawingDepth) return false
    if (typeof node !== 'object' || node === null) continue
    const children: unknown = Reflect.get(node, 'children')
    if (Array.isArray(children)) for (const child of children) pending.push({ node: child, depth: depth + 1 })
  }
  try {
    return JSON.stringify(tree, (_key, value: unknown) => typeof value === 'function' ? 'handler'.padEnd(256, '_') : value).length <= LIMITS.drawingText
  } catch {
    return false
  }
}

/** The pane's tree: the roster, or one peer's thread, newest entry first. */
export function paneTree(ui: HighCommandElements, model: PaneModel, actions: PaneActions): RenderElement {
  const { Box, Text, Button } = ui
  const labels = peerLabels(model.rows.map(row => row.peer))
  const agentMap = new Map((model.agents ?? []).map(agent => [agent.id, agent]))
  const ids = [...new Set([...(model.laneIds ?? []), ...agentMap.keys()])].sort()
  const pages = Math.max(1, Math.ceil(ids.length / 10))
  const page = Math.max(0, Math.min(model.lanePage ?? 0, pages - 1))
  return <Box flexDirection="column">
    {model.capture && <Text dimColor>{captureLabel(model.capture, model.now)}</Text>}
    <Text dimColor>Order: observation time. Counts cover retained messages.</Text>
    {(model.evicted ?? 0) > 0 && <Text>{`History trimmed: ${count(model.evicted!, 'message')} permanently evicted.`}</Text>}
    {ids.length > 0 && <Box flexDirection="column">
      <Text bold>{model.laneId === undefined ? 'Main inbox' : `Agent observations: ${peerLabel(model.laneId)}`}</Text>
      <Text dimColor>Send and receive observations are separate. Split-pane traffic is unavailable; roster snapshots do not confirm liveness.</Text>
      <Button key="lane:main" label="Main inbox" onPress={() => actions.lane('')} />
      {ids.slice(page * 10, page * 10 + 10).map((id, index) => {
        const agent = agentMap.get(id)
        const unread = model.laneUnread?.get(id) ?? 0
        // The status goes on its own line under the button: beside a long button, a narrow dock left it a few columns.
        return <Box flexDirection="column">
          <Button key={`lane:${page * 10 + index}`} label={`${peerLabel(agent?.name ?? id)} (${peerLabel(id)})${unread > 0 ? ` · ${unread} unread` : ''}`} onPress={() => actions.lane(id)} />
          {agent && <Box paddingLeft={2}>
            <Text>{`${agent.status}; ${agent.source} at ${clockLabel(agent.at, model.now)}${agent.lastEvent ? `; lifecycle observation: ${agent.lastEvent.word} at ${clockLabel(agent.lastEvent.at, model.now)}` : ''}`}</Text>
          </Box>}
        </Box>
      })}
      {page > 0 && <Button key="lanes:previous" label="Previous agents" onPress={() => actions.lanePage(page - 1)} />}
      {page + 1 < pages && <Button key="lanes:next" label="More agents" onPress={() => actions.lanePage(page + 1)} />}
    </Box>}
    {model.thread === undefined ? rosterView(ui, model, actions, labels) : threadView(ui, model.now, model.thread, actions, labels.get(model.thread.row.peer)!)}
  </Box>
}

/** The band row above what other mods draw there. `waiting` holds only rows with unread entries. */
export function bandTree(
  { Box, Text, Button }: HighCommandElements,
  waiting: readonly RosterRow[],
  actions: BandActions,
  below: RenderElement,
  labels: Map<string, string>,
): RenderElement {
  const named = waiting.slice(0, LIMITS.bandPeers).map(row => `${labels.get(row.peer)} ${row.unread}`)
  const more = waiting.length > LIMITS.bandPeers ? [`+${waiting.length - LIMITS.bandPeers} more`] : []
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" columnGap={1}>
        <Text wrap="truncate-end">{`High Command · ${unreadTotal(waiting)} unread (retained) — ${[...named, ...more].join(' · ')}`}</Text>
        <Button key="band:open" label="Open" hotkey="o" onPress={actions.open} />
        <Button key="band:read-all" label="Read all" hotkey="r" onPress={actions.readAll} />
        <Button key="band:hide" label="Hide" hotkey="h" onPress={actions.hide} />
      </Box>
      {below}
    </Box>
  )
}

/** Keeps only the count and Open when the full band exceeds the shared budget. */
export function compactBandTree({ Box, Text, Button }: HighCommandElements, waiting: readonly RosterRow[], actions: BandActions, below: RenderElement): RenderElement {
  return <Box flexDirection="column">
    <Box flexDirection="row">
      <Text>{`High Command · ${unreadTotal(waiting)} unread (retained)`}</Text>
      <Button key="band:open" label="Open" hotkey="o" onPress={actions.open} />
    </Box>
    {below}
  </Box>
}
