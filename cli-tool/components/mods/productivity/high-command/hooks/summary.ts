import type { HighCommandAgent, HighCommandCapture, HighCommandLane } from '../types'
import { labelOf, rosterOf, unreadTotal, type RosterRow } from './inbox'
import { captureLabel, clockLabel, count, peerLabel, peerLabels, stateLabel, trustLabel } from './text'

/** Names remain literal, including backticks and link-shaped text. */
function literal(name: string): string {
  const longest = Math.max(0, ...Array.from(name.matchAll(/`+/g), run => run[0].length))
  const fence = '`'.repeat(longest + 1)
  const pad = name.startsWith('`') || name.endsWith('`') ? ' ' : ''
  return `${fence}${pad}${name}${pad}${fence}`
}

type SummaryContext = { evicted?: number; capture?: HighCommandCapture | null; agents?: readonly HighCommandAgent[]; lanes?: Record<string, HighCommandLane> }

/** Counts cover retained messages only. Message bodies never enter command output. */
export function summaryText(rows: readonly RosterRow[], entryCount: number, now: number, context: SummaryContext = {}): string {
  const labels = peerLabels(rows.map(row => row.peer))
  const useList = Array.from(labels.values()).some(name => {
    let oddBackslashes = false
    for (const char of name) {
      if (char === '|' && oddBackslashes) return true
      oddBackslashes = char === '\\' && !oddBackslashes
    }
    return false
  })
  const lines = rows.map(row => {
    const label = trustLabel(row.trust)
    const name = literal(labels.get(row.peer)!)
    const peer = `${name}${label === undefined ? '' : ` (${label})`}`
    const { arrow, word } = labelOf(row.last)
    const fields = [String(row.unread), clockLabel(row.last.at, now), stateLabel(row.state, now) ?? '—', `${arrow} ${word}`]
    if (useList) return `- ${peer}: ${fields[0]} new; last ${fields[1]}; state ${fields[2]}; latest ${fields[3]}`
    const escaped = peer.replace(/\|/g, '\\|')
    return `| ${escaped} | ${fields.join(' | ')} |`
  })
  const header = rows.length === 0 ? 'No messages from teammates or other sessions in this capture window.' :
    `${unreadTotal(rows)} unread · ${count(rows.length, 'peer')} · ${count(entryCount, 'retained message')}`
  const agents = context.agents ?? []
  const lanes = Object.entries(context.lanes ?? {})
  return [
    ...(context.capture ? [captureLabel(context.capture, now)] : []),
    header,
    'Order: observation time; read marks and retention use recording sequence.',
    ...((context.evicted ?? 0) > 0 ? [`History trimmed: ${count(context.evicted!, 'message')} permanently evicted; totals cover retained messages.`] : []),
    ...(rows.length === 0 ? [] : ['', ...(useList ? [] : ['| Peer | New | Last | State | Latest |', '| --- | --- | --- | --- | --- |']), ...lines]),
    ...(lanes.length === 0 ? [] : ['', 'Agent observations (separate counts; split-pane traffic unavailable):',
      ...lanes.map(([id, lane]) => `- ${literal(peerLabel(id))}: ${unreadTotal(rosterOf(lane.entries, lane.peers, lane.readThrough))} unread; ${count(lane.entries.length, 'retained message')}; ${lane.entries.at(-1)?.evictedTotal ?? 0} permanently evicted`),
    ]),
    ...(agents.length === 0 ? [] : ['', 'Local agents (separate from peer names; split-pane liveness is unconfirmed):',
      ...agents.slice(0, 100).map(agent => `- ${literal(peerLabel(agent.name ?? agent.id))} (${literal(peerLabel(agent.id))}): ${agent.status}; ${agent.source} at ${clockLabel(agent.at, now)}${agent.lastEvent ? `; lifecycle observation: ${agent.lastEvent.word} at ${clockLabel(agent.lastEvent.at, now)}` : ''}`),
      ...(agents.length > 100 ? [`${agents.length - 100} more local agents; open the pane to page through them.`] : []),
    ]),
  ].join('\n')
}
