import { atom, read, update } from 'claude-code'
import type { On } from 'claude-code'
import type { AgentRow, Alert, Summary } from '../types'
import { ASK_TO_STOP, ASKED_TOAST, cannotMessage, cannotShow, hasMainView, isLive, masker, type ListCache, type WatchActions } from './actions'
import { breakdownLine, label } from './format'
import { PANE_ID, PANE_TITLE } from './pane'

// Twins of the atoms register.tsx and pane.tsx declare (same ref, initial value and shape tag): the engine refuses imported atoms.
const agentsAtom = atom({ plugin: 'reinwatch', key: 'agents' } as const, {} as Record<string, AgentRow>, { shape: 'agents-1' })
const alertsAtom = atom({ plugin: 'reinwatch', key: 'alerts' } as const, [] as Alert[], { shape: 'alerts-1' })
const dismissedAtom = atom({ plugin: 'reinwatch', key: 'dismissed' } as const, [] as string[])
const summaryAtom = atom({ plugin: 'reinwatch', key: 'summary' } as const, null as Summary | null, { shape: 'summary-2' })
const confirmAtom = atom({ plugin: 'reinwatch', key: 'confirm' } as const, null as string | null)
// Twin of the pane's: whether the summary's per-agent lines are drawn.
const summaryOpenAtom = atom({ plugin: 'reinwatch', key: 'summaryOpen' } as const, null as number | null)

const SHOWN = 3

// The engine takes only a function literal as a hook, so the render hook is written here, inside the call that registers it.
export function registerBand(on: On, actions: WatchActions, isMasking: () => boolean, listCache: ListCache): void {
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const alerts = await read($, alertsAtom)
    const dismissed = await read($, dismissedAtom)
    const summary = await read($, summaryAtom)
    const summaryOpen = await read($, summaryOpenAtom)
    const open = alerts.filter(a => !dismissed.includes(a.key)).reverse()
    const summaryKey = summary === null ? '' : `summary:${summary.at}`
    const showSummary = summary !== null && !dismissed.includes(summaryKey)
    const summaryIsOpen = summary !== null && summaryOpen === summary.at
    if (open.length === 0 && !showSummary) return next(e)

    const { Box, Text, Button } = $.ui.resolve(e)
    const hasView = hasMainView(e.surface)
    const agents = await read($, agentsAtom)
    const confirm = await read($, confirmAtom)
    const listed = new Set<string>()
    const now = await $.clock.now()
    let agentList = listCache.get(now)
    if (agentList === null) {
      agentList = await $.agent.list().catch(() => null)
      if (agentList !== null) listCache.put(now, agentList)
    }
    for (const info of agentList ?? []) listed.add(info.id)
    const shown = open.slice(0, SHOWN)
    const more = open.length - shown.length
    const mask = masker(isMasking)
    // One confirm per agent: under the newest of its open warnings (`open` is newest first).
    const newest = new Map<string, string>()
    for (const a of open) if (a.agentId !== undefined && !newest.has(a.agentId)) newest.set(a.agentId, a.key)

    return (
      <Box flexDirection="column" gap="sm">
        {shown.map(alert => {
          const id = alert.agentId
          const row = id === undefined ? undefined : agents[id]
          const name = row === undefined ? '' : label({ id: row.id, type: row.type, description: mask(row.description) })
          const isListed = id !== undefined && listed.has(id)
          // The pane's rule (isLive): Stop and Ask to stop only for a live agent.
          const live = row !== undefined && isLive(row)
          const pending = live && confirm === id
          const asking = pending && newest.get(id) === alert.key
          return (
            <Box key={alert.key} flexDirection="column" gap="sm">
              <Text>{`! ${mask(alert.text)}`}</Text>
              <Box gap="sm" flexWrap="wrap">
                {id === undefined && (
                  <Button key={`${alert.key}/open`} label="Open reinwatch" onPress={async () => { await $.ui.open({ id: PANE_ID, title: PANE_TITLE }) }} />
                )}
                {id !== undefined && isListed && hasView && (
                  <Button key={`${alert.key}/view`} label="View" onPress={async () => {
                    const shownView = await $.ui.view({ agentId: id })
                    if (shownView.deny !== undefined) await $.ui.toast(cannotShow(shownView.deny))
                  }} />
                )}
                {id !== undefined && isListed && live && (
                  <Button key={`${alert.key}/ask`} label="Ask to stop" onPress={async () => {
                    const sent = await $.session.send({ to: { agentId: id }, text: ASK_TO_STOP })
                    await $.ui.toast(sent.isDelivered ? ASKED_TOAST : cannotMessage(sent.reason))
                  }} />
                )}
                {id !== undefined && live && !pending && (
                  <Button key={`${alert.key}/stop`} label="Stop" onPress={async () => { await update($, confirmAtom, () => id) }} />
                )}
                {asking && <Text>{`Stop "${name}"? Running tools finish first.`}</Text>}
                {asking && id !== undefined && (
                  <Button key={`${alert.key}/confirm`} label="Yes, stop" onPress={async () => {
                    await actions.stop(id)
                    await update($, confirmAtom, () => null)
                  }} />
                )}
                {asking && (
                  <Button key={`${alert.key}/cancel`} label="Cancel" onPress={async () => { await update($, confirmAtom, () => null) }} />
                )}
                <Button key={`${alert.key}/dismiss`} label="Dismiss" onPress={async () => { await actions.dismiss(alert.key) }} />
              </Box>
            </Box>
          )
        })}
        {more > 0 && <Text dimColor>{`+${more} more warnings in /reinwatch`}</Text>}
        {showSummary && (
          <Box key={summaryKey} flexDirection="column" gap="sm">
            <Box gap="sm" flexWrap="wrap">
              <Text dimColor>{mask(summary.text)}</Text>
              <Button key="summary/details" label={summaryIsOpen ? 'Hide details' : 'Details'}
                onPress={async () => { await update($, summaryOpenAtom, () => (summaryIsOpen ? null : summary.at)) }} />
              <Button key="summary/dismiss" label="Dismiss" onPress={async () => { await actions.dismiss(summaryKey) }} />
            </Box>
            {summaryIsOpen && summary.rows.slice(0, SHOWN).map((r, i) => <Text key={`summary/row:${i}`} dimColor>{mask(breakdownLine(r))}</Text>)}
            {summaryIsOpen && summary.rows.length > SHOWN && <Text key="summary/more" dimColor>{`+${summary.rows.length - SHOWN} more in /reinwatch`}</Text>}
          </Box>
        )}
      </Box>
    )
  })
}
