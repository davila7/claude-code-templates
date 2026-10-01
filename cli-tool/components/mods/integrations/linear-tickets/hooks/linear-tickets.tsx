/**
 * linear-tickets — Claude Mod (EARLY ACCESS)
 *
 * Your Linear tickets in a pane, with their status and how you are progressing:
 *
 *   - a status bar of the tickets you hold (in progress, todo, backlog, done)
 *   - a bar chart of tickets closed per day over the last `days` days
 *   - the burn-up of the cycle your tickets sit in (scope against completed)
 *   - the tickets themselves, grouped by state; a row opens its detail, with
 *     the ticket's URL one button away from your clipboard
 *
 * Read-only: it reads issues and one cycle through Linear's GraphQL API and
 * never writes. `$.clock.every(5000)` decides when to read, every
 * `pollSeconds`, and only while the pane is open or the status line is on.
 * The key is sent only to api.linear.app, in the Authorization header, and is
 * never logged or drawn. Never hardcode it in this file.
 *
 * Needs CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 (Claude Code >= 2.1.259) and a
 * Linear API key in the plugin's options.
 *
 * Options (pluginConfigs["linear-tickets@skills-dir"].options):
 *   linearApiKey: string        required; without it the mod does nothing
 *   assignee: "me" | "anyone"   whose tickets (default me)
 *   teamKey: string             only this team (the CLA of CLA-143)
 *   project: string             only projects whose name contains this
 *   days: number                history shown, 7-60 (default 14)
 *   pollSeconds: number         refresh interval, 30-3600 (default 120)
 *   status: boolean             status line summary, keeps polling with the pane closed (default false)
 *   openOnStart: boolean        open the pane at session start (default false)
 */
import type { Register } from 'claude-code'
import {
  BUCKET_COLOR,
  BUCKET_GLYPH,
  BUCKET_LABEL,
  barChart,
  clampInt,
  count,
  currentCycleId,
  cycleElapsed,
  doneByDay,
  fit,
  getCycle,
  listTickets,
  sortTickets,
  spark,
  stacked,
  summaryText,
} from './linear-api.ts'
import type { Bucket, Counts, Cycle, Fetch, Ticket } from './linear-api.ts'

const PANE = 'linear'
const COMMAND = 'linear'
const TICK_MS = 5000
const DAY = 86_400_000
const CAPS: Record<Bucket, number> = { started: 10, todo: 8, backlog: 0, done: 5 }

let tickets: Ticket[] = []
let cycle: Cycle | undefined
let error: string | undefined
let isOpen = false
let isBusy = false
let lastReadAt = 0
let selected: string | undefined
let showBacklog = false
let timer: { cancel: () => void } | undefined

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

export const register: Register = (on, options) => {
  const key = text(options.linearApiKey)
  const assignee = options.assignee === 'anyone' ? 'anyone' : 'me'
  const teamKey = text(options.teamKey)
  const project = text(options.project)
  const days = clampInt(options.days, 14, 7, 60)
  const pollMs = clampInt(options.pollSeconds, 120, 30, 3600) * 1000
  const showStatus = options.status === true
  const openOnStart = options.openOnStart === true
  const scope = { assignee, teamKey, project } as const

  const statusText = () => (key && tickets.length > 0 ? summaryText(count(tickets), days) : undefined)

  async function read(f: Fetch): Promise<void> {
    isBusy = true
    try {
      const since = new Date(Date.now() - days * DAY).toISOString()
      tickets = sortTickets(await listTickets(f, key, scope, since))
      const id = currentCycleId(tickets, Date.now())
      cycle = id ? await getCycle(f, key, id).catch(() => undefined) : undefined
      error = undefined
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    } finally {
      lastReadAt = Date.now()
      isBusy = false
    }
  }

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    await $.command
      .register({
        name: COMMAND,
        description: 'Your Linear tickets by status, with a progress chart (stop closes)',
        argumentHint: '[stop]',
        immediate: true,
      })
      .catch(err => $.ui.log(`linear-tickets: /${COMMAND} not registered: ${err}`))
    if (!key) {
      $.ui.log('linear-tickets: set linearApiKey in the plugin options to list your tickets', { to: 'debug' })
      return r
    }

    timer?.cancel()
    timer = $.clock.every(TICK_MS, () => {
      if (isBusy || (!isOpen && !showStatus)) return
      if (Date.now() - lastReadAt < pollMs - TICK_MS / 2) return
      void read((url, init) => $.http.fetch(url, init)).then(() => {
        $.ui.status(showStatus ? statusText() : undefined)
        $.ui.invalidate('ui.render')
      })
    })

    if (openOnStart) {
      await read((url, init) => $.http.fetch(url, init))
      isOpen = true
      await $.ui.open({ id: PANE, title: 'linear' }).catch(() => {
        isOpen = false
      })
      $.ui.status(showStatus ? statusText() : undefined)
    }
    return r
  })

  on('session.end', async ($, e, next) => {
    timer?.cancel()
    timer = undefined
    return next(e)
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    if (!key) return { text: 'linear: set linearApiKey in the plugin options' }
    if (['stop', 'close'].includes(e.args.trim().toLowerCase())) {
      await $.ui.close({ id: PANE }).catch(() => undefined)
      isOpen = false
      return { text: 'linear closed' }
    }
    await read((url, init) => $.http.fetch(url, init))
    isOpen = true
    await $.ui.open({ id: PANE, title: 'linear', focus: true })
    $.ui.status(showStatus ? statusText() : undefined)
    $.ui.invalidate('ui.render')
    if (error) return { text: `linear: ${error}` }
    return { text: `${summaryText(count(tickets), days)} · /${COMMAND} stop closes` }
  })

  on('ui.close', async ($, e, next) => {
    if (e.id !== PANE) return next(e)
    isOpen = false
    return next(e)
  })

  on('ui.press', async ($, e, next) => {
    if (e.plugin !== $.plugin.name || e.requestId !== PANE) return next(e)
    const r = await next(e)
    const target = e.element
    if (target === 'close') {
      await $.ui.close({ id: PANE }).catch(() => undefined)
      return r
    }
    if (target === 'refresh') {
      if (!isBusy) await read((url, init) => $.http.fetch(url, init))
    } else if (target === 'backlog') {
      showBacklog = !showBacklog
    } else if (target.startsWith('t:')) {
      const id = tickets[Number(target.slice(2))]?.id
      selected = id === selected ? undefined : id
    } else if (target === 'copy') {
      const url = tickets.find(t => t.id === selected)?.url
      if (url) {
        await $.ui.copy({ text: url, surface: e.surface }).catch(() => undefined)
        $.ui.toast(`linear: copied ${url}`)
      }
    }
    $.ui.status(showStatus ? statusText() : undefined)
    $.ui.invalidate('ui.render')
    return r
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const width = Math.max(30, e.props.bodyColumns - 1)
    const now = Date.now()
    const noop = () => {}
    const counts: Counts = count(tickets)
    const perDay = doneByDay(tickets, now, days)
    const chart = barChart(perDay.slice(-Math.min(days, width - 2)), 4)
    const bar = stacked(
      [
        { n: counts.started, glyph: 'started' },
        { n: counts.todo, glyph: 'todo' },
        { n: counts.backlog, glyph: 'backlog' },
        { n: counts.done, glyph: 'done' },
      ],
      width,
    )
    const chosen = selected ? tickets.find(t => t.id === selected) : undefined
    const indexOf = new Map(tickets.map((t, i) => [t.id, i] as const))
    const groups: Bucket[] = ['started', 'todo', 'done']

    return (
      <Box flexDirection="column">
        <Text bold>{fit(summaryText(counts, days), width)}</Text>
        {error ? <Text color="red">{fit(error, width)}</Text> : null}

        <Box key="bar" flexDirection="row">
          {bar.map((part, i) => (
            <Text key={`bar:${i}`} color={BUCKET_COLOR[part.glyph as Bucket]} dimColor={part.glyph === 'backlog'}>
              {(part.glyph === 'backlog' ? '░' : '█').repeat(part.cells)}
            </Text>
          ))}
        </Box>

        <Box key="chart" flexDirection="column" marginTop={1}>
          <Text dimColor>{fit(`closed per day · ${perDay.reduce((a, b) => a + b, 0)} in ${days}d · max ${Math.max(0, ...perDay)}/day`, width)}</Text>
          {chart.map((row, i) => (
            <Text key={`c:${i}`} color="green">{row}</Text>
          ))}
          <Text dimColor>{fit(`${days}d ago${' '.repeat(Math.max(1, Math.min(days, width - 2) - `${days}d ago`.length - 5))}today`, width)}</Text>
        </Box>

        {cycle ? (
          <Box key="cycle" flexDirection="column" marginTop={1}>
            <Text>
              <Text bold>{`cycle ${cycle.number}${cycle.name ? ` ${cycle.name}` : ''} `}</Text>
              <Text color="green">{`${Math.round(cycle.progress * 100)}% done`}</Text>
              <Text dimColor>{` · ${Math.round(cycleElapsed(cycle, now) * 100)}% of time`}</Text>
            </Text>
            {cycle.scope.length > 1 ? <Text dimColor>{fit(`scope ${spark(cycle.scope)}`, width)}</Text> : null}
            {cycle.completed.length > 1 ? <Text color="green">{fit(`done  ${spark(cycle.completed)}`, width)}</Text> : null}
          </Box>
        ) : null}

        {groups.map(bucket => {
          const rows = tickets.filter(t => t.bucket === bucket)
          if (rows.length === 0) return null
          return (
            <Box key={`g:${bucket}`} flexDirection="column" marginTop={1}>
              <Text bold color="cyan">{`${BUCKET_LABEL[bucket]} (${rows.length})`}</Text>
              {rows.slice(0, CAPS[bucket]).map(t => (
                <Box key={`row:${t.id}`} flexDirection="row">
                  <Text color={BUCKET_COLOR[bucket]}>{`${BUCKET_GLYPH[bucket]} `}</Text>
                  <Button
                    key={`t:${indexOf.get(t.id)}`}
                    plain
                    dimColor={selected !== t.id && bucket === 'done'}
                    label={fit(`${t.identifier}${t.priority > 0 && t.priority < 3 ? ` ${t.priorityLabel ?? ''}` : ''}  ${t.title}`, width - 2)}
                    onPress={noop}
                  />
                </Box>
              ))}
              {rows.length > CAPS[bucket] ? <Text dimColor>{`  +${rows.length - CAPS[bucket]} more`}</Text> : null}
            </Box>
          )
        })}

        {counts.backlog > 0 ? (
          <Box key="backlog-box" flexDirection="column" marginTop={1}>
            <Button key="backlog" plain label={`${showBacklog ? '▾' : '▸'} Backlog (${counts.backlog})`} onPress={noop} />
            {showBacklog
              ? tickets
                  .filter(t => t.bucket === 'backlog')
                  .slice(0, 12)
                  .map(t => (
                    <Box key={`bl:${t.id}`} flexDirection="row">
                      <Text dimColor>{'· '}</Text>
                      <Button key={`t:${indexOf.get(t.id)}`} plain dimColor label={fit(`${t.identifier}  ${t.title}`, width - 2)} onPress={noop} />
                    </Box>
                  ))
              : null}
          </Box>
        ) : null}

        {chosen ? (
          <Box key="detail" flexDirection="column" marginTop={1} borderStyle="round" borderDimColor paddingX={1}>
            <Text bold>{fit(`${chosen.identifier} ${chosen.title}`, width - 4)}</Text>
            <Text dimColor>
              {fit(
                [chosen.stateName, chosen.priorityLabel, chosen.estimate !== undefined ? `${chosen.estimate} pts` : '', chosen.project, chosen.dueDate ? `due ${chosen.dueDate}` : '']
                  .filter(Boolean)
                  .join(' · '),
                width - 4,
              )}
            </Text>
            {chosen.url ? <Button key="copy" label="copy url" hotkey="c" onPress={noop} /> : null}
          </Box>
        ) : null}

        <Box key="foot" marginTop={1} flexDirection="column">
          <Box flexDirection="row" columnGap={1}>
            <Button key="refresh" label="refresh" hotkey="r" onPress={noop} />
            <Button key="close" label="close" onPress={noop} />
          </Box>
          <Text dimColor>{fit('read-only · status, charts and cycle from Linear', width)}</Text>
        </Box>
      </Box>
    )
  })
}
