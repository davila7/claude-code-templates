import { atom, read, update } from 'claude-code'
import type { AgentInfo, Register, Timer } from 'claude-code'
import type { AgentRow, Alert, Settings, StopRecord, Summary, Totals } from '../types'
import type { ListCache, WatchActions } from './actions'
import { checkAgent, checkAll, checkSpawn, pruneDismissed } from './alerts'
import { clean } from './clean'
import { fingerprint } from './fingerprint'
import { cut, label, limitLine, statusLine, summaryLine } from './format'
import { addTurn, HISTORY_KEY, localTime, parseDays, totals } from './history'
import { registerBand } from './band'
import { PANE_ID, PANE_TITLE, registerPane } from './pane'
import { redact } from './redact'
import { readSettings } from './settings'
import { isStopped, isStoppedIn, STOP_DENY, stoppedStep } from './stop'
import {
  activeMs, adoptReadBack, allowResume, endListed, endMainTurn, listDue, markStopped, newTokens, newTracker, noteSpawn, stepEnded, stepStarted, toolEnded, toolRunning, toolStarted, turnEnded, turnStarted,
  type Tracker,
} from './tracker'

// The wiring only: what the hooks do with the events, the state the module keeps, the tick and the flush.
const KEEP_ALERTS = 50
const KEEP_STOPS = 50
// Rows are copied and written on every flush, and a label shows 60 characters, so a row keeps no more than this of a text.
const KEPT_TEXT = 200
const KEPT_NAME = 100
// The engine refuses atoms imported from another file, so the atoms are declared here. Any other file that reads or writes
// them must declare identical twins (same ref, initial value and shape tag).
const agentsAtom = atom({ plugin: 'reinwatch', key: 'agents' } as const, {} as Record<string, AgentRow>, { shape: 'agents-1' })
const alertsAtom = atom({ plugin: 'reinwatch', key: 'alerts' } as const, [] as Alert[], { shape: 'alerts-1' })
const dismissedAtom = atom({ plugin: 'reinwatch', key: 'dismissed' } as const, [] as string[])
const stopsAtom = atom({ plugin: 'reinwatch', key: 'stops' } as const, [] as StopRecord[], { shape: 'stops-1' })
const summaryAtom = atom({ plugin: 'reinwatch', key: 'summary' } as const, null as Summary | null, { shape: 'summary-2' })
const historyAtom = atom({ plugin: 'reinwatch', key: 'history' } as const, { agents: 0, tokens: 0, activeMs: 0, maxTokens: 0, maxActiveMs: 0 } as Totals, { shape: 'history-1' })
// The pane's own, declared again here (an atom cannot be imported from another file): the agent whose Stop awaits a yes.
const confirmAtom = atom({ plugin: 'reinwatch', key: 'confirm' } as const, null as string | null)
type Stored = { rows: Record<string, AgentRow>; alerts: Alert[]; dismissed: string[]; stops: StopRecord[] }
// The engine itself cannot be kept (a module may only spell `$.noun.event(...)`), so what the tick needs is kept as
// small closures made inside the hook that has `$`.
type Live = {
  now: () => Promise<number>
  status: (text: string | undefined) => void
  write: (rows: Record<string, AgentRow>, alerts: Alert[], dismissed: string[], stops: StopRecord[]) => Promise<void>
  redraw: () => void
  notify: (text: string) => Promise<void>
  open: () => Promise<void>
  agents: () => Promise<AgentInfo[]>
  stored: () => Promise<Stored>   // what the atoms hold now; the rows as a copy that may be changed
}
// The engine's agent list is asked for this often (on the tick).
const LIST_EVERY_MS = 10_000

const runtime: {
  tracker: Tracker; settings: Settings; live: Live | null
  alerts: Alert[]; dismissed: string[]; stops: StopRecord[]; fresh: Alert[]; dirty: boolean; lastStatus: string | undefined; ticker: Timer | null
  flushing: Promise<void> | null; again: boolean; adopted: boolean; adopting: Promise<void> | null; listedAt: number | null
  list: { at: number; list: AgentInfo[] } | null
  limitAtTurnStart: number | null   // the 5-hour limit's percent used when the main turn began; null when not reported
} = {
  tracker: newTracker(), settings: readSettings({}), live: null,
  alerts: [], dismissed: [], stops: [], fresh: [], dirty: false, lastStatus: undefined, ticker: null,
  flushing: null, again: false, adopted: false, adopting: null, listedAt: null, list: null, limitAtTurnStart: null,
}

// The plan's 5-hour usage limit, in percent used, as the last model response reported it. Null off a subscription
// (no limits are reported) and when the reading failed.
const fiveHourUsed = (usage: { rateLimits: readonly { kind: string; percentUsed: number }[] } | null): number | null =>
  usage?.rateLimits.find(l => l.kind === 'five_hour')?.percentUsed ?? null

// Joins what the atoms hold into this instance, once. A reload keeps the atoms, so the rows, the warnings already
// raised and the dismissals carry on; rows this instance made meanwhile are newer and stay (adoptReadBack folds the
// copy into them). Until this has succeeded nothing is delivered or written (writeOut) and the Stop hooks ask the
// stored rows themselves. A failed read changes nothing here and is tried again on the next tick. One run at a time:
// a second caller gets the run under way.
function adopt(live: Live): Promise<void> {
  if (runtime.adopted) return Promise.resolve()
  if (runtime.adopting !== null) return runtime.adopting
  const run = (async () => {
    try {
      const stored = await live.stored()
      // The flags come first, in this one synchronous block: if joining a row throws, a second try would fold the rows
      // already joined a second time, so a row that cannot be joined is given up, not tried again.
      runtime.adopted = true
      runtime.dirty = true
      // Every stored warning counts as raised, so none is raised again; one raised here meanwhile waits in `fresh`,
      // and deliver drops it if its key is among these.
      runtime.alerts = stored.alerts.slice(-KEEP_ALERTS)
      for (const a of stored.alerts) runtime.tracker.fired[a.key] = true
      const dismissed = stored.dismissed
      for (const key of runtime.dismissed) if (!dismissed.includes(key)) dismissed.push(key)
      runtime.dismissed = dismissed
      // The records of earlier Stops come first; one this instance made meanwhile is the same record only if `at` and `id` match.
      const stops = [...stored.stops]
      for (const s of runtime.stops) if (!stops.some(o => o.at === s.at && o.id === s.id)) stops.push(s)
      runtime.stops = stops.slice(-KEEP_STOPS)
      adoptReadBack(runtime.tracker, stored.rows)
    } finally {
      runtime.adopting = null
    }
  })()
  runtime.adopting = run
  return run
}

// The engine's agent list as the last reader fetched it, used by the next draw within a second, so the pane, the band
// and the tick share one fetch. No `$` here: whoever finds nothing asks `$.agent.list()` itself and puts the answer.
const LIST_KEPT_MS = 1000
const listCache: ListCache = {
  get: now => (runtime.list !== null && now >= runtime.list.at && now - runtime.list.at < LIST_KEPT_MS ? runtime.list.list : null),
  put: (now, list) => { runtime.list = { at: now, list } },
}

// Notifications go one at a time: each starts after the previous one settled (a person's Notification hook can take
// seconds). Nothing waits on the chain, and a rejection never breaks it.
let notifying: Promise<void> = Promise.resolve()
function queueNotify(send: () => Promise<void>): void {
  notifying = notifying.then(send).catch(() => undefined)
}

// Hands the new warnings on, once each: keeps them (newest last), then notifies the person's own channel and opens the
// pane as the settings say. None of these is waited on, and the notifications run one at a time (a person's Notification
// hook can take seconds), and a failing one never stops the others or the flush.
function deliver(fresh: Alert[]): void {
  // A warning whose key is already kept was raised before, by the instance before a reload: it is neither kept nor
  // notified again.
  const news = fresh.filter(a => !runtime.alerts.some(b => b.key === a.key))
  runtime.alerts = [...runtime.alerts, ...news].slice(-KEEP_ALERTS)
  const live = runtime.live
  if (live === null) return
  const s = runtime.settings
  for (const alert of news) {
    const text = clean(s.redact ? redact(alert.text) : alert.text)
    if (s.notify) queueNotify(() => live.notify(text))
  }
  if (s.openPaneOnWarning && news.length > 0) void live.open().catch(() => undefined)
}

// One flush at a time. A flush asked for while one runs (a button's) makes that one go round once more and settles
// with it, so once the read-back is done what the button changed is written by the time its press settles. The tick
// does not ask: it skips.
// Before the read-back (adopt) nothing is written (writeOut returns early), so a button's change then goes out with the
// first flush after it: session.start's, or the tick after the one that read back.
function flush(): Promise<void> {
  if (runtime.flushing !== null) {
    runtime.again = true
    return runtime.flushing
  }
  const run = (async () => {
    try {
      do {
        runtime.again = false
        await writeOut()
      } while (runtime.again)
    } finally {
      runtime.flushing = null
    }
  })()
  runtime.flushing = run
  return run
}

// Mirrors the runtime into the atoms and the status line. The atoms are written only when something changed,
// so many events inside one tick make one write.
async function writeOut(): Promise<void> {
  const live = runtime.live
  // Before the read-back nothing is delivered or written: a write would replace the stored rows, warnings and
  // dismissals still to be read, and a warning already stored would be raised a second time. `fresh` and `dirty` stay,
  // and the flush after the read-back takes them up.
  if (live === null || !runtime.adopted) return
  if (runtime.fresh.length > 0) {
    const fresh = runtime.fresh
    runtime.fresh = []
    deliver(fresh)
    runtime.dirty = true
  }
  if (runtime.dirty) {
    runtime.dirty = false
    runtime.dismissed = pruneDismissed(runtime.dismissed, runtime.alerts)
    const rows = JSON.parse(JSON.stringify(runtime.tracker.agents))
    const alerts = [...runtime.alerts]
    const dismissed = [...runtime.dismissed]
    const stops = [...runtime.stops]
    try {
      await live.write(rows, alerts, dismissed, stops)
    } catch (error) {
      // Nothing was stored: the next flush writes it again.
      runtime.dirty = true
      throw error
    }
  }
  const now = await live.now()
  const open = runtime.alerts.filter(a => !runtime.dismissed.includes(a.key)).length
  const line = statusLine(Object.values(runtime.tracker.agents), open, now)
  if (line !== runtime.lastStatus) {
    runtime.lastStatus = line
    live.status(line)
  }
}

async function tick(): Promise<void> {
  const live = runtime.live
  // While a flush still runs this second is skipped; the next tick takes up whatever changed meanwhile.
  if (live === null || runtime.flushing !== null) return
  // No read-back yet: try it, and leave the rest to the next tick.
  if (!runtime.adopted) {
    await adopt(live).catch(() => undefined)
    return
  }
  const now = await live.now()
  if (listDue(runtime.listedAt, now, LIST_EVERY_MS)) {
    runtime.listedAt = now
    await reconcile(live, now)
  }
  runtime.fresh.push(...checkAll(runtime.tracker, runtime.settings, now))
  const isBusy = Object.values(runtime.tracker.agents).some(row => row.busy > 0)
  if (runtime.dirty || runtime.fresh.length > 0 || isBusy) await flush()
  // An open pane draws again only when a value it read is written, and nothing is written while a tool or a model call
  // simply runs on: so while an agent works the pane is drawn again each second, for its times to move. The engine's
  // invalidate takes the event only, so the band is drawn again too (three reads when it has nothing to show).
  if (isBusy) live.redraw()
}

// Ends the rows the engine says are over but that never got their turn.complete. A row with work or a tool still open,
// one the list does not name, and one already at rest are left alone. A failed list changes nothing.
async function reconcile(live: Live, now: number): Promise<void> {
  const t = runtime.tracker
  // The answer may be older than events handled while it was awaited: a row that began a turn meanwhile is working again.
  const turnsBefore = new Map(Object.entries(t.agents).map(([id, row]) => [id, row.turns]))
  const listed = await live.agents().catch(() => null)
  if (listed === null) return
  listCache.put(now, listed)
  if (endListed(t, listed, turnsBefore, now)) runtime.dirty = true
}

// What the pane's buttons ask of the tracker. No `$` here: each mutates the runtime and flushes at once.
const actions: WatchActions = {
  stop: async agentId => {
    const now = await runtime.live?.now()
    if (now === undefined) return
    // An agent already stopped (a second press before the pane was drawn again) gets no second record.
    const wasStopped = runtime.tracker.agents[agentId]?.isStopped === true
    const row = markStopped(runtime.tracker, agentId, now)
    if (!wasStopped) {
      runtime.stops = [...runtime.stops, {
        id: agentId, label: label(row), at: now, tokens: newTokens(row.tokens), activeMs: activeMs(row, now), lastTool: row.lastTool ?? '',
      }].slice(-KEEP_STOPS)
    }
    runtime.dirty = true
    await flush()
  },
  resume: async agentId => {
    const now = await runtime.live?.now()
    if (now === undefined) return
    allowResume(runtime.tracker, agentId, now)
    runtime.dirty = true
    await flush()
  },
  dismiss: async key => {
    runtime.dismissed = [...runtime.dismissed, key]
    runtime.dirty = true
    await flush()
  },
}

export const register: Register = (on, options) => {
  runtime.settings = readSettings(options)

  on('session.start', async ($, e, next) => {
    runtime.live = {
      now: () => $.clock.now(),
      status: text => { $.ui.status(text) },
      write: async (rows, alerts, dismissed, stops) => {
        await update($, agentsAtom, () => rows)
        await update($, alertsAtom, () => alerts)
        await update($, dismissedAtom, () => dismissed)
        await update($, stopsAtom, () => stops)
      },
      redraw: () => { $.ui.invalidate('ui.render') },
      notify: async text => { await $.ui.notify(text, { title: 'reinwatch' }) },
      open: async () => { await $.ui.open({ id: PANE_ID, title: PANE_TITLE }) },
      agents: () => $.agent.list(),
      stored: async () => ({
        rows: JSON.parse(JSON.stringify(await read($, agentsAtom))),
        alerts: [...await read($, alertsAtom)],
        dismissed: [...await read($, dismissedAtom)],
        stops: [...await read($, stopsAtom)],
      }),
    }
    // A failed read-back is caught: the tick tries it again, and nothing is written before one succeeds.
    await adopt(runtime.live).catch(() => undefined)
    runtime.ticker?.cancel()
    runtime.ticker = $.clock.every(1000, () => { void tick().catch(() => undefined) })
    // What waited for the read-back goes out now. A failed write leaves `dirty` set for the tick.
    await flush().catch(() => undefined)
    // After the ticker, so a failing call here can never leave the load without it.
    // The command is a convenience: the totals and next(e) must not depend on it.
    await $.command.register({ name: 'reinwatch', description: 'Show the agents Claude runs in a pane' }).catch(() => undefined)
    const now = await $.clock.now()
    const days = parseDays(await $.store.get(HISTORY_KEY))
    await update($, historyAtom, () => totals(days, localTime(now)))
    return next(e)
  })

  // What no summary reported yet (work since the last main turn) goes to the 30-day store, not to the band. Best effort
  // within the engine's short bound at exit; a failure is left to reach the engine, which goes on with the end.
  on('session.end', async ($, e, next) => {
    const now = await $.clock.now()
    const s = endMainTurn(runtime.tracker, now)
    if (s !== null) await $.store.set(HISTORY_KEY, addTurn(parseDays(await $.store.get(HISTORY_KEY)), s, localTime(now)))
    return next(e)
  })

  on('command.run', { command: 'reinwatch' }, async $ => {
    await $.ui.open({ id: PANE_ID, title: PANE_TITLE })
    return { text: 'Opened the reinwatch pane.' }
  })

  registerPane(on, actions, () => runtime.settings.redact, listCache, () => runtime.settings)
  registerBand(on, actions, () => runtime.settings.redact, listCache)

  on('agent.spawn', async ($, e, next) => {
    const r = await next(e)
    if (r.deny !== undefined) return r
    if (r.agentId) {
      const now = await $.clock.now()
      const t = runtime.tracker
      noteSpawn(t, {
        agentId: r.agentId,
        description: cut(runtime.settings.redact ? redact(clean(e.description)) : clean(e.description), KEPT_TEXT),
        type: cut(clean(e.subagentType), KEPT_NAME),
        model: cut(clean(r.model), KEPT_NAME),
        ...(e.parentAgentId === undefined ? {} : { parentId: e.parentAgentId }),
        ...(e.workflow?.runId === undefined ? {} : { runId: e.workflow.runId }),
        isTeammate: e.isTeammate === true,
        isResume: e.resume !== undefined,
      }, now)
      runtime.fresh.push(...checkSpawn(t, e.workflow?.runId, runtime.settings, now))
      runtime.dirty = true
    }
    return r
  })

  on('turn.start', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId !== undefined) {
      turnStarted(runtime.tracker, e.agentId, await $.clock.now())
      runtime.dirty = true
    } else {
      await update($, summaryAtom, () => null)
      runtime.limitAtTurnStart = fiveHourUsed(await $.session.usage().catch(() => null))
    }
    return r
  })

  // A session's first turn begins before any model response, so Claude Code has no 5-hour reading yet when it starts:
  // the first one it pushes stands in. Each main turn's start reads the limit again.
  on('session.measure', async ($, e, next) => {
    if (runtime.limitAtTurnStart === null) runtime.limitAtTurnStart = fiveHourUsed(e)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId !== undefined) {
      turnEnded(runtime.tracker, e.agentId, e.reason, await $.clock.now())
      runtime.dirty = true
      // A Stop confirm still open for this agent is dropped, so it does not come back unasked when the agent is live again.
      // Written only when that is the case, and a failed read or write is left alone: the turn has ended either way.
      const pending = await read($, confirmAtom).catch(() => null)
      if (pending === e.agentId) await update($, confirmAtom, current => (current === e.agentId ? null : current)).catch(() => undefined)
    } else {
      // The summary covers what the agents did since the last one, between main turns included.
      const now = await $.clock.now()
      const s = endMainTurn(runtime.tracker, now)
      if (s !== null) {
        const row = runtime.tracker.agents[s.longest.id]
        const longest = row === undefined ? `agent ${s.longest.id.slice(0, 8)}` : label(row)
        // On a subscription, how far the 5-hour limit moved during this main turn (other sessions' use included).
        const from = runtime.limitAtTurnStart
        const to = from === null ? null : fiveHourUsed(await $.session.usage().catch(() => null))
        const limit = from === null || to === null ? null : limitLine(from, to)
        const text = limit === null ? summaryLine(s, longest) : `${summaryLine(s, longest)} · ${limit}`
        const rows = s.rows.map(r => {
          const agent = runtime.tracker.agents[r.id]
          return { label: agent === undefined ? `agent ${r.id.slice(0, 8)}` : label(agent), tokens: r.tokens, activeMs: r.activeMs }
        })
        await update($, summaryAtom, () => ({ text, at: now, rows }))
        const days = addTurn(parseDays(await $.store.get(HISTORY_KEY)), s, localTime(now))
        await $.store.set(HISTORY_KEY, days)
        await update($, historyAtom, () => totals(days, localTime(now)))
      }
    }
    return r
  })

  on('turn.step', async function* ($, e, next) {
    const agentId = e.agentId
    if (agentId === undefined) return yield* next(e)
    // A stopped agent's step is answered here, before any time or tokens are counted and without a model request.
    if (isStopped(runtime.tracker, agentId) || (!runtime.adopted && isStoppedIn(await read($, agentsAtom).catch(() => null), agentId))) return yield* stoppedStep(e)
    stepStarted(runtime.tracker, agentId, await $.clock.now())
    runtime.dirty = true
    let result: Awaited<ReturnType<typeof next>['result']> | undefined
    try {
      result = yield* next(e)
      return result
    } finally {
      // An interrupt can make the clock fail here; the open step is then closed by turnEnded. Only the clock read is guarded.
      const now = await $.clock.now().catch(() => null)
      if (now !== null) {
        stepEnded(runtime.tracker, agentId, result?.usage ?? null, now)
        runtime.fresh.push(...checkAgent(runtime.tracker, agentId, runtime.settings, now))
        runtime.dirty = true
      }
    }
  })

  // Every tool hook here matches subagents' calls only ({ agentId: /./ }). Claude Code's mod docs (for versions after
  // 2.1.331) say a hook that may match a call keeps that call from moving to the background (Ctrl+B) and from
  // streaming its output past the hook, so the main conversation's calls, which carry no agentId, never meet one.

  // The gate: denies every new tool call of an agent the user stopped. If it fails, only a stopped agent is denied.
  // It is registered before the observer below so that it is the outermost: a denied call never reaches the observer
  // and is never counted.
  on('tool.call', { agentId: /./ }, async ($, e, next) => {
    if (isStopped(runtime.tracker, e.agentId)) return { deny: STOP_DENY }
    // Before the read-back the tracker may not hold a Stop pressed before the reload, so the stored rows are asked.
    // A read that fails counts as "not stopped": a broken reinwatch must not hold up every agent.
    if (!runtime.adopted && e.agentId !== undefined && isStoppedIn(await read($, agentsAtom).catch(() => null), e.agentId)) return { deny: STOP_DENY }
    return next(e)
  })
    .catch(($, e, next) => (next.called ? next(e) : isStopped(runtime.tracker, e.agentId) ? { deny: STOP_DENY } : next(e)))

  // Watches only: no .catch, so a failure here never stops the tool. The call's time starts at tool.run below.
  on('tool.call', { agentId: /./ }, async ($, e, next) => {
    const agentId = e.agentId
    if (agentId === undefined) return next(e)
    const t = runtime.tracker
    const startedAt = await $.clock.now()
    const count = toolStarted(t, { agentId, toolUseId: e.tool_use_id, tool: e.tool, key: fingerprint(e.tool, e) }, startedAt)
    runtime.fresh.push(...checkAgent(t, agentId, runtime.settings, startedAt, { tool: e.tool, count }))
    runtime.dirty = true
    // Stays 'aborted' when the call ends by a throw: how the tool went is unknown, so the failure streak is not touched.
    let outcome: 'ok' | 'error' | 'denied' | 'aborted' = 'aborted'
    try {
      const r = await next(e)
      outcome = r.deny !== undefined ? 'denied' : r.isError === true ? 'error' : 'ok'
      return r
    } finally {
      const now = await $.clock.now().catch(() => null)
      if (now !== null) {
        toolEnded(t, e.tool_use_id, outcome, now)
        runtime.fresh.push(...checkAgent(t, agentId, runtime.settings, now))
        runtime.dirty = true
      }
    }
  })

  // An allowed call starts to run: its time counts from here, so the wait for a permission check (a prompt, a classifier,
  // a hook) is left out on every surface. Never raised for a refused call. Watches only, like the observer above.
  // @ts-expect-error - the catalog's bundled claude-code types predate the `tool.run` event
  // (Claude Code 2.1.326+, which this mod requires); the registration itself is unchanged
  // from upstream. Drop this comment once the bundled types gain the event.
  on('tool.run', { agentId: /./ }, async ($, e, next) => {
    toolRunning(runtime.tracker, e.tool_use_id, await $.clock.now())
    runtime.dirty = true
    return next(e)
  })
}
