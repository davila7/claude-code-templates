import { atom, read, update } from 'claude-code'
import type { Caught, CommandRunResult, EngineInterface, HookFailure, Register, Timer } from 'claude-code'

import type { Job, JobsState, ShellJob, Wakeup, WakeupState } from '../types'
import { bandTree, failedPaneTree, paneTree } from './drawing'
import { durationsOf, historyKeyOf, recorded, usualOf } from './history'
import type { Durations } from './history'
import {
  activityEnded,
  activityOf,
  activityStarted,
  agentJob,
  agentsSynced,
  finalIdsOf,
  finishedCleared,
  finishedRuns,
  historyAdded,
  isLive,
  isRunning,
  launched,
  monitorJob,
  noticed,
  noticeProblemOf,
  observedJobs,
  readFailed,
  readsDue,
  reconciled,
  reloaded,
  restoredJobs,
  shellJob,
  ownerAnswered,
  shellLaunchNote,
  stoppedJob,
  tailRead,
  wakeupAfterSnapshot,
  wakeupAfterTick,
  wakeupAfterTrigger,
  wakeupOf,
  workflowJob,
} from './jobs'
import type { HistoryRun, JobObservation, SnapshotTask, TailRead } from './jobs'
import { CARRY_ATTEMPTS, STATE_WRITE_ATTEMPTS, FS_READ_MAX, REPEAT_WINDOW_MS, TAIL_TIMEOUT_MS, TICK_MS, TICKER_STALE_MS } from './limits'
import { noticesOf } from './notices'
import { displayLinesOf, isOutputFileOf, jobBytesOf, jobLinesOf, oneLine, outputEndOf, outputFileOf } from './output'
import { jobsStateOf, wakeupStateOf } from './state'
import { isStatusPrompt, normalizePrompt } from './prompt'
import { redirectFileOf, redirectTargetOf } from './redirect'
import { bandOf, isBandHidden, paneModelOf, tableOf } from './view'

/** The slash command, without its slash; declared here so that `claude plugin validate` resolves the matcher. */
const COMMAND = 'downrange'
/** The pane's id, and the requestId its render hook matches. */
const PANE_ID = 'downrange'
/** The pane's tab title. */
const PANE_TITLE = 'Jobs'

const JOBS = atom({ plugin: 'downrange', key: 'jobs' } as const, { items: [], observed: [], removed: [], snapshotAt: null }, { shape: 'v8' })
const WAKEUP = atom({ plugin: 'downrange', key: 'wakeup' } as const, { pending: null, updatedAt: null }, { shape: 'v4' })
const BAND_HIDDEN_AT = atom({ plugin: 'downrange', key: 'bandHiddenAt' } as const, null)
const LAST_ANSWERED = atom({ plugin: 'downrange', key: 'lastAnswered' } as const, null)

/** The buttons of the band and the pane. */
type Control = 'Open' | 'Hide' | 'Clear finished' | 'Close'

/** Running jobs and the wakeup, as the carry across /clear, /resume, and /branch holds them. */
type Carry = { jobs: JobsState; wakeup: WakeupState; destination?: string; attempts: number; restoring: boolean }
type Committed = { jobs: JobsState; wakeup: WakeupState; sessionId?: string; jobsVersion: number; wakeupVersion: number }

/** Keys of diagnostics already shown; a reload re-arms them on purpose. */
const reported = new Set<string>()

/** The ticker's timer; a reload drops it, and session.start starts a new one. */
let ticker: Timer | null = null
/** Guards against overlapping refreshes inside one module instance. */
let isTicking = false
/** When the ticker last ran a period, or started; an old time means a refused period ended it. */
let lastTickAt = 0
/** The newest committed state and versions; session.end saves running rows and ordering barriers. */
let latest: Committed = { jobsVersion: -1, wakeupVersion: -1, jobs: { items: [], observed: [], removed: [], snapshotAt: null }, wakeup: { pending: null, updatedAt: null } }
/** What session.end saved for the next classic.SessionStart. */
let carry: Carry | null = null
/**
 * The last history record; each record waits for it, so two in one session never overwrite each other. Two sessions
 * can still race, because the store has no versioned write; a lost record costs every run it held, a new key's first too.
 */
let historyWrites: Promise<void> = Promise.resolve()
/** The `genericRatios` option, which register sets: any ratio in output counts as progress, not only a known format. */
let isAnyRatio = false

/** A `tail` that could not start, timed out, or exited non-zero. */
class TailFailure extends Error {
  constructor(message: string, readonly bytes: number) {
    super(message)
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** A stat, read, or tail of a job's redirect file that failed, with that failure. */
class RedirectFailure extends Error {
  constructor(readonly failure: unknown) {
    super(messageOf(failure))
  }
}

/** A hook failure as one phrase: `hook throw: <message>`. */
function failureText(failure: HookFailure): string {
  return `hook ${failure.kind}: ${failure.message ?? 'no message'}`
}

/** A failed hook, named by its label, goes to the transcript the first time, then to the debug log. */
function reportHook($: EngineInterface, hook: string, failure: HookFailure): void {
  const key = `hook|${hook}`
  const isFirst = !reported.has(key)
  reported.add(key)
  $.ui.log(`${isFirst ? 'downrange: ' : ''}${hook}: ${failureText(failure)}`, { to: isFirst ? 'transcript' : 'debug' })
}

/** What the `.catch` of a hook that only watches does: it reports the failure under the hook's label and passes the event on unchanged. */
function passOn<I, R>($: EngineInterface, label: string, e: I, next: ((e: I) => R) & Caught): R {
  if (next.error.kind !== 're-entry') reportHook($, label, next.error)
  return next(e)
}

/** Logs the event and cause once per key; the debug sink supplies the plugin name. */
function report($: EngineInterface, event: string, cause: string, once: string): void {
  const key = `${event}|${once}`
  if (reported.has(key)) return
  reported.add(key)
  $.ui.log(`${event}: ${cause}`, { to: 'debug' })
}

/** Starts the ticker, or starts it again (and logs once) when no period ran for TICKER_STALE_MS; a tick stops it when nothing is live. */
async function ensureTicker($: EngineInterface): Promise<void> {
  const now = await $.clock.now()
  if (ticker !== null && now - lastTickAt < TICKER_STALE_MS) return
  if (ticker !== null) {
    ticker.cancel()
    report($, 'clock.every', 'the ticker stopped (a period was refused); started it again', 'restart')
  }
  lastTickAt = now
  ticker = $.clock.every(TICK_MS, () => {
    void tick($)
  })
}

/** Writes only to the destination captured before the read and retains committed versions alone. */
async function writeJobs($: EngineInterface, input: JobObservation | JobsState | null, change: (jobs: Job[]) => Job[] = jobs => jobs, destination?: string): Promise<boolean> {
  const sessionId = destination ?? await $.session.id()
  for (let attempt = 0; attempt < STATE_WRITE_ATTEMPTS; attempt++) {
    if (await $.session.id() !== sessionId) throw new Error('jobs destination changed')
    const raw = await $.state.get({ plugin: 'downrange', key: 'jobs' })
    const decoded = jobsStateOf(raw.value)
    if (raw.value !== undefined && decoded === undefined) report($, 'state.get', 'unsupported or invalid jobs state; reset safely', 'jobs-shape')
    const state = decoded ?? { items: [], observed: [], removed: [], snapshotAt: null }
    const changed = input === null ? state : 'items' in input ? restoredJobs(state, input) : observedJobs(state, input, change)
    if (await $.session.id() !== sessionId) throw new Error('jobs destination changed')
    const written = input === null && (raw.value === undefined || (decoded !== undefined && raw.value.shape === 'v8'))
      ? { isSet: true, version: raw.version }
      : await $.state.set({ plugin: 'downrange', key: 'jobs' }, { shape: 'v8', value: changed }, { ifVersion: raw.version })
    if (!written.isSet) continue
    if (await $.session.id() !== sessionId) throw new Error('jobs destination changed')
    if (latest.sessionId !== sessionId) latest = { sessionId, jobs: state, wakeup: { pending: null, updatedAt: null }, jobsVersion: -1, wakeupVersion: -1 }
    if (written.version > latest.jobsVersion) latest = { ...latest, jobs: changed, jobsVersion: written.version }
    await ensureTicker($)
    return changed !== state
  }
  throw new Error('jobs state stayed busy')
}

/** Migrates before replacement and preserves the latest committed wakeup cancellation. */
async function writeWakeup($: EngineInterface, now: number, change: (wakeup: Wakeup | null) => Wakeup | null, isReplacement = false, destination?: string): Promise<void> {
  const sessionId = destination ?? await $.session.id()
  for (let attempt = 0; attempt < STATE_WRITE_ATTEMPTS; attempt++) {
    if (await $.session.id() !== sessionId) throw new Error('wakeup destination changed')
    const raw = await $.state.get({ plugin: 'downrange', key: 'wakeup' })
    const decoded = wakeupStateOf(raw.value)
    if (raw.value !== undefined && decoded === undefined) report($, 'state.get', 'unsupported or invalid wakeup state; reset safely', 'wakeup-shape')
    const state = decoded ?? { pending: null, updatedAt: null }
    const accepts = state.updatedAt === null || now >= state.updatedAt
    const pending = accepts ? change(state.pending) : state.pending
    const changed = accepts && (isReplacement || pending !== state.pending) ? { pending, updatedAt: now } : state
    if (await $.session.id() !== sessionId) throw new Error('wakeup destination changed')
    const written = changed === state && (raw.value === undefined || (decoded !== undefined && raw.value.shape === 'v4'))
      ? { isSet: true, version: raw.version }
      : await $.state.set({ plugin: 'downrange', key: 'wakeup' }, { shape: 'v4', value: changed }, { ifVersion: raw.version })
    if (!written.isSet) continue
    if (await $.session.id() !== sessionId) throw new Error('wakeup destination changed')
    if (latest.sessionId !== sessionId) latest = { sessionId, jobs: { items: [], observed: [], removed: [], snapshotAt: null }, wakeup: state, jobsVersion: -1, wakeupVersion: -1 }
    if (written.version > latest.wakeupVersion) latest = { ...latest, wakeup: changed, wakeupVersion: written.version }
    await ensureTicker($)
    return
  }
  throw new Error('wakeup state stayed busy')
}

/** Keeps running rows and barriers for every terminal row omitted from the handoff. */
function carriedJobs(state: JobsState): JobsState {
  const removed = new Map(state.removed)
  const observed = new Map(state.observed)
  for (const job of state.items) {
    if (!isRunning(job)) removed.set(job.id, Math.max(removed.get(job.id) ?? -Infinity, observed.get(job.id) ?? job.lastEndedAt ?? job.startedAt))
  }
  return { ...state, items: state.items.filter(isRunning), removed: [...removed] }
}

/** Retries a pending handoff only in its assigned destination; both writes must succeed before clearance. */
async function restoreCarry($: EngineInterface): Promise<void> {
  const carried = carry
  if (carried === null || carried.destination === undefined || carried.restoring || carried.attempts >= CARRY_ATTEMPTS) return
  if (await $.session.id() !== carried.destination || carry !== carried) return
  carried.restoring = true
  carried.attempts++
  try {
    await writeJobs($, carried.jobs, jobs => jobs, carried.destination)
    if (carry !== carried || await $.session.id() !== carried.destination) return
    if (carried.wakeup.updatedAt !== null) {
      await writeWakeup($, carried.wakeup.updatedAt, () => carried.wakeup.pending, true, carried.destination)
    }
    if (carry === carried && await $.session.id() === carried.destination) carry = null
  } finally {
    carried.restoring = false
  }
}

/** The stored durations; a value of the wrong shape counts as empty and logs once. */
async function storedDurations($: EngineInterface, event: string): Promise<Durations> {
  const durations = durationsOf(await $.store.get('durations'))
  if (durations !== undefined) return durations
  report($, event, 'duration history had the wrong shape; the next record replaces it', 'history-shape')
  return {}
}

/** The history key and usual duration for a launch; a failure gives neither, logs once, and never stops the launch. */
async function historyFor($: EngineInterface, command: string): Promise<{ historyKey: string; usualMs?: number } | undefined> {
  try {
    const historyKey = await historyKeyOf(await $.session.cwd(), command)
    return { historyKey, usualMs: usualOf(await storedDurations($, 'tool.call'), historyKey) }
  } catch (error) {
    report($, 'tool.call', `duration history unavailable: ${messageOf(error)}`, 'history-get')
    return undefined
  }
}

/**
 * The redirect file of a launch, absolute in the session's folder, or undefined. A subagent's command follows only an
 * absolute path: a subagent can run in a folder of its own. A failure gives none, logs once, and never stops the launch.
 */
async function redirectFor($: EngineInterface, id: string, command: string, agentId: string | undefined): Promise<string | undefined> {
  try {
    const target = redirectTargetOf(command)
    if (target === undefined || (agentId !== undefined && !target.startsWith('/'))) return undefined
    return redirectFileOf(target, await $.session.cwd())
  } catch (error) {
    report($, 'tool.call', `cannot place the redirect file of task ${id}: ${messageOf(error)}`, `redirect|${id}`)
    return undefined
  }
}

/** Appends clean runs to the duration history, one record at a time; a failure costs the record only and logs once. */
async function recordRuns($: EngineInterface, runs: readonly HistoryRun[], now: number, event: 'prompt.submit' | 'session.append'): Promise<void> {
  if (runs.length === 0) return
  const record = historyWrites.then(async () => {
    try {
      const durations = await storedDurations($, event)
      await $.store.set('durations', runs.reduce((all, run) => recorded(all, run.key, run.durationMs, now), durations))
    } catch (error) {
      report($, event, `duration history unavailable: ${messageOf(error)}`, 'history-set')
    }
  })
  historyWrites = record
  await record
}

/** Applies every notification block in a delivered prompt, in order; history judges each block on the list the blocks before it left. */
async function applyNotices($: EngineInterface, text: string, noticeRow?: string, observedAt?: number): Promise<void> {
  const event = noticeRow === undefined ? 'prompt.submit' : 'session.append'
  const notices = noticesOf(text)
  if (notices.length === 0) {
    if (text.includes('<task-notification>')) report($, event, 'a task notification held no complete <task-notification> block; jobs end at the next turn end', 'no-block')
    return
  }
  for (const problem of notices.map(noticeProblemOf)) {
    if (problem !== undefined) report($, event, problem.cause, problem.once)
  }
  const now = observedAt ?? await $.clock.now()
  let runs: HistoryRun[] = []
  const changed = await writeJobs($, { at: now, ids: notices.flatMap(notice => notice.ids), kind: 'notice', finalIds: finalIdsOf(notices), noticeRow }, jobs => {
    runs = finishedRuns(jobs, notices, now)
    return notices.reduce((list, notice) => noticed(list, notice, now, isAnyRatio), jobs)
  })
  if (changed) await recordRuns($, runs, now, event)
}

/**
 * Reconciles with a Stop or SubagentStop snapshot: the wakeup with `session_crons`, the jobs with `background_tasks`;
 * an absent field logs once. The wakeup rule runs again on the wakeup that stands at the write, so a wakeup set
 * meanwhile is judged by its own time.
 */
async function reconcile(
  $: EngineInterface,
  event: string,
  input: { background_tasks?: readonly SnapshotTask[]; session_crons?: readonly { recurring: boolean }[] },
): Promise<void> {
  const now = await $.clock.now()
  const crons = input.session_crons
  if (crons === undefined) {
    report($, event, 'no session_crons in the hook input; a cancelled wakeup waits for its expiry', 'no-crons')
  } else {
    const { pending: wakeup } = await read($, WAKEUP)
    if (wakeupAfterSnapshot(wakeup, crons, now) !== wakeup) await writeWakeup($, now, current => wakeupAfterSnapshot(current, crons, now))
  }
  const tasks = input.background_tasks
  if (tasks === undefined) {
    report($, event, 'no background_tasks in the hook input; reconciliation skipped', 'no-snapshot')
    return
  }
  await writeJobs($, { at: now, kind: 'snapshot', members: tasks.map(task => task.id) }, jobs => reconciled(jobs, tasks, now))
}

/** Runs `tail -c 16384 <path>`: the last TAIL_BYTES bytes, written as text so the command reads in full; only the output file path varies. */
async function tailOf($: EngineInterface, path: string, bytes: number): Promise<string> {
  const ran = await $.process.run(['tail', '-c', '16384', path], { timeoutMs: TAIL_TIMEOUT_MS }).catch((error: unknown) => {
    throw new TailFailure(messageOf(error), bytes)
  })
  if (ran.exitCode !== 0) throw new TailFailure(`exit ${ran.exitCode}: ${oneLine(ran.stderr)}`, bytes)
  return ran.stdout
}

/** A file's end, by `$.fs.read` up to FS_READ_MAX and by `tail` above. */
async function endOf($: EngineInterface, path: string, size: number): Promise<string> {
  const isTail = size > FS_READ_MAX
  return outputEndOf(isTail ? await tailOf($, path, size) : await $.fs.read(path), isTail)
}

/** What a job's output holds now: no new lines while its size stays, else its end. A job with a redirect file also looks at that file (see redirectRead). */
async function readOutput($: EngineInterface, job: ShellJob & { outputFile: string }): Promise<TailRead> {
  const stat = await $.fs.stat(job.outputFile)
  const isAsked = job.failedReadBytes !== undefined || job.finalReadAskedAt !== undefined
  const text = stat.size === job.outputBytes && !isAsked ? undefined : await endOf($, job.outputFile, stat.size)
  const output: TailRead = { bytes: stat.size, mtimeMs: stat.mtimeMs, lines: text === undefined ? [] : displayLinesOf(text) }
  return job.redirectFile === undefined ? output : await redirectRead($, job, job.redirectFile, output, text, isAsked)
}

/**
 * The read of a job with a redirect file, after the read of its output (`text` when that read took its end). The row
 * takes its lines from the file that changed last, by modification time, and from the output file when the two times
 * are equal. The output file counts only while it holds a job line. Its time is its modification time once the job wrote
 * to it since the last read, which the engine's closing line alone is not. Until then it keeps the time of the lines that
 * the row shows from it, and it does not count while the row shows the redirect file. When the redirect file is missing
 * or not a regular file, the output file shows if it holds a job line. The redirect file is read again when its size or
 * its modification time changes. A read of it carries its size and time, which tailRead keeps as redirectBytes and
 * lastOutputAt.
 */
async function redirectRead($: EngineInterface, job: ShellJob & { outputFile: string }, redirectFile: string, output: TailRead, text: string | undefined, isAsked: boolean): Promise<TailRead> {
  const isRedirectShown = job.redirectBytes !== undefined
  const isWritten = text !== undefined && output.bytes !== job.outputBytes && (job.outputBytes === undefined || jobBytesOf(text, output.bytes) > job.outputBytes)
  const outputAt = isWritten ? output.mtimeMs : isRedirectShown ? undefined : job.lastOutputAt
  /** Whether the output file holds a job line: in the lines read now, else in the line that the row shows from it. */
  const hasJobLine = (lines: readonly string[]): boolean => (text === undefined && !isRedirectShown ? job.lastLine !== undefined : jobLinesOf(lines).length > 0)
  let redirect: { size: number; mtimeMs: number }
  try {
    const stat = await $.fs.stat(redirectFile)
    if (stat.kind !== 'file') throw new Error('not a regular file')
    redirect = stat
  } catch (error) {
    // A row that shows the redirect file needs the output file's end to show it instead.
    const lines = text === undefined && isRedirectShown ? displayLinesOf(await endOf($, job.outputFile, output.bytes)) : output.lines
    if (hasJobLine(lines)) return { ...output, lines }
    throw new RedirectFailure(error)
  }
  if (outputAt !== undefined && outputAt >= redirect.mtimeMs && hasJobLine(output.lines)) return output
  try {
    const isSame = isRedirectShown && redirect.size === job.redirectBytes && redirect.mtimeMs === job.lastOutputAt
    const lines = isSame && !isAsked ? [] : displayLinesOf(await endOf($, redirectFile, redirect.size))
    return { bytes: output.bytes, mtimeMs: redirect.mtimeMs, lines, redirectBytes: redirect.size }
  } catch (error) {
    throw new RedirectFailure(error)
  }
}

/** Reads one shell job's output and applies it; only a failed stat, read, or tail sets the job's note and logs once per job and file. */
async function readTail($: EngineInterface, job: ShellJob & { outputFile: string }, now: number): Promise<void> {
  const path = job.outputFile
  if (!isOutputFileOf(path, job.id)) {
    report($, 'clock.every', `refused to read ${path}: it is not the output file of task ${job.id}`, `path|${job.id}`)
    await writeJobs($, { at: now, ids: [job.id] }, jobs => readFailed(jobs, job.id, 'output unavailable', now))
    return
  }
  let found: TailRead
  try {
    found = await readOutput($, job)
  } catch (error) {
    const isRedirect = error instanceof RedirectFailure
    const failure = isRedirect ? error.failure : error
    const bytes = failure instanceof TailFailure ? failure.bytes : undefined
    const verb = bytes === undefined ? 'read' : 'tail'
    report($, 'clock.every', `cannot ${verb} ${isRedirect ? 'the redirect file' : 'the output'} of task ${job.id}: ${messageOf(failure)}`, `${isRedirect ? 'redirect ' : ''}${verb}|${job.id}`)
    await writeJobs($, { at: now, ids: [job.id] }, jobs => readFailed(jobs, job.id, bytes === undefined ? 'output unavailable' : 'tail failed', now, bytes))
    return
  }
  await writeJobs($, { at: now, ids: [job.id] }, jobs => tailRead(jobs, job.id, found, now, isAnyRatio))
}

/** Applies `$.agent.list()` to agent jobs; a failed list logs once. */
async function syncAgents($: EngineInterface, now: number, event = 'clock.every'): Promise<void> {
  const agents = await $.agent.list().catch((error: unknown) => {
    report($, event, `cannot list agents: ${messageOf(error)}`, 'agents')
    return undefined
  })
  if (agents !== undefined) await writeJobs($, { at: now, ids: agents.map(agent => agent.id) }, jobs => agentsSynced(jobs, agents, now))
}

/** One ticker period: it marks the ticker alive, then refreshes unless a refresh still runs; a failure logs once per message. */
async function tick($: EngineInterface): Promise<void> {
  try {
    const now = await $.clock.now()
    lastTickAt = now
    if (isTicking) return
    isTicking = true
    try {
      await restoreCarry($)
      await refresh($, now)
    } finally {
      isTicking = false
    }
  } catch (error) {
    report($, 'clock.every', messageOf(error), `tick|${messageOf(error)}`)
  }
}

/** The work of one tick: expire the wakeup, sync agents, read outputs (a pending final read too), redraw, and stop when nothing is live. */
async function refresh($: EngineInterface, now: number): Promise<void> {
  const seen = latest
  const [{ items: jobs }, { pending: wakeup }] = await Promise.all([read($, JOBS), read($, WAKEUP)])
  if (wakeupAfterTick(wakeup, now) !== wakeup) await writeWakeup($, now, current => wakeupAfterTick(current, now))
  if (jobs.some(job => job.kind === 'agent' && isRunning(job))) await syncAgents($, now)
  for (const job of readsDue(jobs, now)) await readTail($, job, now)
  // Every write replaces `latest`: after a write during this tick, the next tick judges liveness on fresh state.
  if (!isLive(jobs, wakeup, now) && latest === seen && (carry === null || carry.attempts >= CARRY_ATTEMPTS || carry.destination === undefined)) {
    ticker?.cancel()
    ticker = null
  }
  $.ui.invalidate('ui.render')
}

/** Runs a button of the band or the pane; a failure, and an Open whose pane waits unplaced, log to the transcript. */
async function pressed($: EngineInterface, control: Control): Promise<void> {
  try {
    if (control === 'Open') {
      const opened = await $.ui.open({ id: PANE_ID, title: PANE_TITLE })
      if (!opened.isPlaced) $.ui.log(`downrange: ui.press: the Jobs pane waits: ${opened.reason}`)
    } else if (control === 'Hide') {
      const now = await $.clock.now()
      await update($, BAND_HIDDEN_AT, () => now)
    } else if (control === 'Clear finished') {
      await writeJobs($, { at: await $.clock.now() }, finishedCleared)
    } else {
      await $.ui.close({ id: PANE_ID })
    }
  } catch (error) {
    $.ui.log(`downrange: ui.press: ${control} failed: ${messageOf(error)}`)
  }
}

/** The time, and the jobs and the wakeup in state; in a render hook, the reads subscribe the drawing. */
async function stateNow($: EngineInterface): Promise<{ now: number; jobs: Job[]; wakeup: WakeupState }> {
  const [now, { items: jobs }, wakeup] = await Promise.all([$.clock.now(), read($, JOBS), read($, WAKEUP)])
  return { now, jobs, wakeup }
}

/** The /downrange table at the command's width. */
async function tableNow($: EngineInterface, columns: number): Promise<string> {
  const { now, jobs, wakeup: { pending: wakeup } } = await stateNow($)
  return tableOf(jobs, wakeup, now, columns, false)
}

/** `/downrange pane`: close an open pane, else open it; where nothing draws, the pane is not placed, or a pane call fails, the reason and the table print. */
async function togglePane($: EngineInterface, columns: number): Promise<CommandRunResult> {
  try {
    if ((await $.ui.panes()).some(pane => pane.id === PANE_ID)) {
      await $.ui.close({ id: PANE_ID })
      return {}
    }
    const hasSurface = (await $.session.surfaces()).length > 0
    const opened = hasSurface ? await $.ui.open({ id: PANE_ID, title: PANE_TITLE }) : { isPlaced: false as const, reason: 'no surface draws in this session' }
    if (opened.isPlaced) return {}
    if (hasSurface) await $.ui.close({ id: PANE_ID })
    $.ui.log(`command.run: the Jobs pane was not placed: ${opened.reason}`, { to: 'debug' })
    return { text: `The Jobs pane is not shown here: ${opened.reason}.\n\n${await tableNow($, columns)}` }
  } catch (error) {
    $.ui.log(`command.run: the Jobs pane could not be toggled: ${messageOf(error)}`, { to: 'debug' })
    return { text: `The Jobs pane could not be toggled: ${messageOf(error)}.\n\n${await tableNow($, columns)}` }
  }
}

/** The local answer: the drop reason for an exact status prompt while a job runs, or undefined to pass it on. */
async function statusAnswer($: EngineInterface, text: string): Promise<string | undefined> {
  const normalized = normalizePrompt(text)
  if (!isStatusPrompt(normalized)) return undefined
  const [{ now, jobs, wakeup: { pending: wakeup } }, answered] = await Promise.all([stateNow($), read($, LAST_ANSWERED)])
  if (!jobs.some(isRunning)) return undefined
  if (answered !== null && answered.text === normalized && now - answered.at <= REPEAT_WINDOW_MS) {
    await update($, LAST_ANSWERED, () => null)
    return undefined
  }
  await update($, LAST_ANSWERED, () => ({ text: normalized, at: now }))
  const seconds = REPEAT_WINDOW_MS / 1_000
  return `Downrange answered this (not sent to Claude). Send it again within ${seconds} s to ask Claude.\n\n${tableOf(jobs, wakeup, now)}`
}

export const register: Register = (on, options) => {
  isAnyRatio = options.genericRatios === true
  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({
        name: COMMAND,
        description: 'Background tasks of this session (not background sessions): progress, ETA, last output. "/downrange pane" toggles the live pane.',
        argumentHint: '[pane]',
        immediate: true,
      })
    } catch (error) {
      $.ui.log(`downrange: session.start: /downrange was not registered: ${messageOf(error)}`)
    }
    const now = await $.clock.now()
    await writeJobs($, null)
    // After a reload, as a change of genericRatios or an update causes, rows follow the current option; with no row to change, nothing is written.
    const { items } = await read($, JOBS)
    if (reloaded(items, isAnyRatio, now).some((job, index) => job !== items[index])) await writeJobs($, { at: now }, jobs => reloaded(jobs, isAnyRatio, now))
    await writeWakeup($, now, pending => pending)
    return next(e)
  }).catch(($, e, next) => passOn($, 'session.start', e, next))

  on('session.end', ($, e, next) => {
    const current = latest.sessionId === e.sessionId ? latest : undefined
    if (current === undefined && carry?.destination !== e.sessionId) return next(e)
    const jobs = current === undefined ? carry?.jobs : carry === null ? current.jobs : restoredJobs(carry.jobs, current.jobs)
    const wakeup = current === undefined || (carry?.wakeup.updatedAt ?? -Infinity) > (current.wakeup.updatedAt ?? -Infinity) ? carry?.wakeup : current.wakeup
    if (jobs !== undefined && wakeup !== undefined) carry = { jobs: carriedJobs(jobs), wakeup, attempts: 0, restoring: false }
    return next(e)
  }).catch(($, e, next) => passOn($, 'session.end', e, next))

  on('classic.SessionStart', { source: ['clear', 'resume', 'fork'] }, async ($, e, next) => {
    const sessionId = await $.session.id()
    if (e.session_id !== sessionId) return next(e)
    if (carry !== null && carry.destination === undefined) carry.destination = sessionId
    await ensureTicker($)
    await restoreCarry($)
    return next(e)
  }).catch(($, e, next) => passOn($, 'classic.SessionStart{source=clear|resume|fork}', e, next))

  on('command.run', { command: COMMAND }, async ($, e) => {
    const argument = e.args.trim()
    if (argument === '') return { text: await tableNow($, e.presentation.columns) }
    if (argument === 'pane') return togglePane($, e.presentation.columns)
    return { text: 'Usage: /downrange [pane]' }
  }).catch(($, e, next) => {
    if (next.error.kind === 're-entry') return { text: '/downrange is unavailable during a nested call.' }
    reportHook($, 'command.run{command=downrange}', next.error)
    return { text: `/downrange could not run: ${failureText(next.error)}.` }
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined || ran.isError === true) return ran
    const id = ran.result.backgroundTaskId
    if (id === undefined || id === '') return ran
    const now = await $.clock.now()
    const outputFile = outputFileOf(ran.text ?? '', id)
    if (outputFile === undefined) {
      report($, 'tool.call', `no output file in the result of task ${id}; its last line is unavailable`, `path|${id}`)
    }
    const note = shellLaunchNote(ran.result, outputFile !== undefined)
    const redirectFile = await redirectFor($, id, e.command, e.agentId)
    await writeJobs($, { at: now, ids: [id] }, jobs => launched(jobs, shellJob({ id, command: e.command, description: e.description, outputFile, redirectFile, note, ownerAgentId: e.agentId, endsWithAgent: ran.result.backgroundEndsWithFinalResponse === true }, now)))
    // The history read comes after the launch, so an end or a clear that comes meanwhile is never undone.
    const history = await historyFor($, e.command)
    if (history !== undefined) await writeJobs($, { at: now, ids: [id] }, jobs => historyAdded(jobs, id, history))
    return ran
  }).catch(($, e, next) => passOn($, 'tool.call{tool=Bash}', e, next))

  on('tool.call', { tool: 'Monitor' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined || ran.isError === true) return ran
    const now = await $.clock.now()
    const job = monitorJob({ id: ran.result.taskId, description: e.description, timeoutMs: ran.result.timeoutMs, isPersistent: ran.result.persistent === true }, now)
    await writeJobs($, { at: now, ids: [job.id] }, jobs => launched(jobs, job))
    return ran
  }).catch(($, e, next) => passOn($, 'tool.call{tool=Monitor}', e, next))

  on('tool.call', { tool: 'Agent' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined || ran.isError === true) return ran
    // A foreground call answers `completed`, and a plugin's own call an AgentCallRecord (no status) once the agent settled: nothing runs.
    const result = ran.result
    if (!('status' in result) || (result.status !== 'async_launched' && result.status !== 'remote_launched' && result.status !== 'teammate_spawned')) return ran
    const now = await $.clock.now()
    // A teammate in a terminal pane of its own runs no loop here: its id is its address in its team.
    const isOwnPane = result.status === 'teammate_spawned' && (result.agentId ?? result.agent_id) === result.teammate_id
    const job =
      result.status === 'teammate_spawned'
        ? agentJob({ id: result.agentId ?? result.agent_id, description: e.description, ...(isOwnPane ? { note: 'own pane', runsElsewhere: true } : {}) }, now)
        : result.status === 'async_launched'
          ? agentJob({ id: result.agentId, description: result.description }, now)
          : agentJob({ id: result.taskId, description: result.description, note: 'remote', runsElsewhere: true }, now)
    await writeJobs($, { at: now, ids: [job.id] }, jobs => launched(jobs, job))
    return ran
  }).catch(($, e, next) => passOn($, 'tool.call{tool=Agent}', e, next))

  on('tool.call', { tool: 'Workflow' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined || ran.isError === true || ran.result.error !== undefined) return ran
    const now = await $.clock.now()
    const job = workflowJob({ id: ran.result.taskId, name: ran.result.workflowName }, now)
    await writeJobs($, { at: now, ids: [job.id] }, jobs => launched(jobs, job))
    return ran
  }).catch(($, e, next) => passOn($, 'tool.call{tool=Workflow}', e, next))

  on('tool.call', { tool: 'ScheduleWakeup' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined || ran.isError === true) return ran
    const now = await $.clock.now()
    const wakeup = ran.result.stopped === true ? null : wakeupOf(ran.result.scheduledFor, e.reason, now)
    await writeWakeup($, now, () => wakeup, true)
    return ran
  }).catch(($, e, next) => passOn($, 'tool.call{tool=ScheduleWakeup}', e, next))

  on('tool.call', { tool: 'TaskStop' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined || ran.isError === true) return ran
    const now = await $.clock.now()
    const id = ran.result.task_id
    await writeJobs($, { at: now, ids: [id] }, jobs => stoppedJob(jobs, id, now))
    return ran
  }).catch(($, e, next) => passOn($, 'tool.call{tool=TaskStop}', e, next))

  on('tool.call', async ($, e, next) => {
    const agentId = e.agentId
    if (agentId === undefined) return next(e)
    if (!(await read($, JOBS)).items.some(job => job.kind === 'agent' && job.id === agentId)) return next(e)
    const started = await $.clock.now()
    const summary = activityOf(String(e.tool), e)
    await writeJobs($, { at: started, ids: [agentId], kind: 'activity' }, jobs => activityStarted(jobs, agentId, summary, started))
    // A call that rejects counts as failed; the in-flight count drops whatever happens.
    let isFailure = true
    try {
      const ran = await next(e)
      isFailure = ran.deny !== undefined || ran.isError === true
      return ran
    } finally {
      const settled = await $.clock.now()
      await writeJobs($, { at: settled, ids: [agentId], kind: 'activity' }, jobs => activityEnded(jobs, agentId, isFailure, settled))
    }
  }).catch(($, e, next) => passOn($, 'tool.call', e, next))

  on('session.append', async ($, e, next) => {
    if (e.agentId === undefined || e.origin.kind !== 'task-notification') return next(e)
    const now = await $.clock.now()
    const stored = await next(e)
    if (stored.deny !== undefined || stored.uuid !== e.uuid) return stored
    const text = stored.message.content.flatMap(block => block.type === 'text' && 'text' in block && typeof block.text === 'string' ? [block.text] : []).join('\n')
    await applyNotices($, text, JSON.stringify([e.agentId, stored.uuid]), now)
    return stored
  }).catch(($, e, next) => passOn($, 'session.append', e, next))

  on('turn.complete', async ($, e, next) => {
    const now = await $.clock.now()
    const result = await next(e)
    if (e.agentId !== undefined) {
      if (e.reason === 'answer' && !e.isAborted) {
        const agentId = e.agentId
        await writeJobs($, { at: now }, jobs => ownerAnswered(jobs, agentId, now))
      }
      await syncAgents($, await $.clock.now(), 'turn.complete')
    }
    return result
  }).catch(($, e, next) => passOn($, 'turn.complete', e, next))

  on('prompt.submit', async ($, e, next) => {
    if (e.origin.kind === 'task-notification') {
      await applyNotices($, e.text)
    } else if (e.origin.kind === 'scheduled-trigger') {
      const now = await $.clock.now()
      await writeWakeup($, now, wakeup => wakeupAfterTrigger(wakeup, now))
    } else if (options.answerStatusPrompts === true && e.origin.kind === 'composer' && e.turnId === undefined && e.attachments === undefined) {
      const answer = await statusAnswer($, e.text)
      if (answer !== undefined) return { drop: answer }
    }
    return next(e)
  }).catch(($, e, next) => passOn($, 'prompt.submit', e, next))

  on('classic.Stop', async ($, e, next) => {
    await reconcile($, 'classic.Stop', e)
    if ((await read($, JOBS)).items.some(job => job.kind === 'agent')) await syncAgents($, await $.clock.now(), 'classic.Stop')
    return next(e)
  }).catch(($, e, next) => passOn($, 'classic.Stop', e, next))

  on('classic.SubagentStop', async ($, e, next) => {
    await reconcile($, 'classic.SubagentStop', e)
    if ((await read($, JOBS)).items.some(job => job.kind === 'agent')) await syncAgents($, await $.clock.now(), 'classic.SubagentStop')
    return next(e)
  }).catch(($, e, next) => passOn($, 'classic.SubagentStop', e, next))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (options.band === false || e.props.hasSurvey) return next(e)
    const [{ now, jobs, wakeup: { pending: wakeup } }, hiddenAt] = await Promise.all([stateNow($), read($, BAND_HIDDEN_AT)])
    if (!isLive(jobs, wakeup, now) || isBandHidden(jobs, hiddenAt)) return next(e)
    const actions = {
      open: () => {
        void pressed($, 'Open')
      },
      hide: () => {
        void pressed($, 'Hide')
      },
    }
    return bandTree($.ui.resolve(e), bandOf(jobs, wakeup, now, e.props.bodyColumns), actions, await next(e))
  }).catch(($, e, next) => passOn($, 'ui.render{component=AbovePrompt}', e, next))

  on('ui.render', { component: 'Pane', requestId: PANE_ID }, async ($, e) => {
    const { now, jobs, wakeup: { pending: wakeup } } = await stateNow($)
    const actions = {
      clear: () => {
        void pressed($, 'Clear finished')
      },
      close: () => {
        void pressed($, 'Close')
      },
    }
    return paneTree($.ui.resolve(e), paneModelOf(jobs, wakeup, now, e.props.bodyColumns), actions)
  }).catch(($, e, next) => {
    if (next.error.kind === 're-entry') return { type: 'Text', props: {}, children: ['The Jobs pane is unavailable during a nested render.'] }
    reportHook($, 'ui.render{component=Pane, requestId=downrange}', next.error)
    return failedPaneTree($.ui.resolve(e), `The Jobs pane could not draw: ${failureText(next.error)}`)
  })
}
