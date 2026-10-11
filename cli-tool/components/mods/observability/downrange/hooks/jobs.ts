import type { AgentInfo, ClassicEventOf } from 'claude-code'

import type { AgentJob, Job, JobsState, JobState, MonitorJob, ShellJob, Wakeup, WorkflowJob } from '../types'
import {
  ACTIVITY_MAX,
  LARGE_FILE_BYTES,
  LARGE_READ_EVERY_MS,
  LINE_MAX,
  MAX_FINISHED,
  NOTE_MAX,
  NOTICE_ROWS_MAX,
  PROGRESS_LINES,
  READ_EVERY_MS,
  RECENT_MS,
  SNAPSHOT_SLACK_MS,
  STATUS_WORD_MAX,
  TITLE_MAX,
  TRIGGER_EARLY_MS,
  WAKEUP_STALE_MS,
} from './limits'
import type { Notice } from './notices'
import { anchorOf, clip, displayLinesOf, isOutputFileOf, oneLine, progressOf } from './output'

/** The launch note of a command that its synchronous subagent ends when it answers. */
const ENDS_WITH_AGENT = 'ends with its agent'
/** The note of a job that left the engine's list with no notification. */
const GONE_NOTE = 'ended without a report'
/** The same, for a command that ended with its synchronous subagent. */
const AGENT_GONE_NOTE = 'ended with its agent'
/** Snapshot notes, which a later notification replaces. */
const GONE_NOTES: ReadonlySet<string> = new Set([GONE_NOTE, AGENT_GONE_NOTE])

/** Whether the job still runs. */
export const isRunning = (job: Job): boolean => job.state === 'running'

const titled = (text: string): string => clip(oneLine(text), TITLE_MAX)

/** Keeps every running job and the MAX_FINISHED newest ended jobs, in their order. */
export function trimmed(jobs: readonly Job[]): Job[] {
  const kept = new Set(
    jobs
      .filter(job => !isRunning(job))
      .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))
      .slice(0, MAX_FINISHED)
      .map(job => job.id),
  )
  return jobs.filter(job => isRunning(job) || kept.has(job.id))
}

/** Whether an end is at least as recent as the job's latest running observation and end. */
function canEnd(job: Job, now: number): boolean {
  return now >= Math.max(job.lastRunningAt ?? job.startedAt, job.lastEndedAt ?? job.startedAt)
}

/** A current end preserves the first end time, advances the latest, replaces snapshot notes, and asks for a final shell read. */
function endedJob<T extends Job>(job: T, state: JobState, now: number, detail: { exitCode?: number; note?: string }): T {
  if (!canEnd(job, now)) return job
  return {
    ...job,
    state,
    omittedAt: undefined,
    endedAt: job.endedAt ?? now,
    lastEndedAt: now,
    exitCode: detail.exitCode ?? job.exitCode,
    note: detail.note ?? (job.note !== undefined && GONE_NOTES.has(job.note) ? undefined : job.note),
    ...(job.kind === 'shell' ? { finalReadAskedAt: now } : {}),
  }
}

/** The list with this job added, or replacing the one with its id. */
function withJob(jobs: readonly Job[], job: Job): Job[] {
  return [...jobs.filter(one => one.id !== job.id), job]
}

/** Refines an inferred shell without carrying shell-only metadata into the Monitor. */
function asMonitor(job: ShellJob): MonitorJob {
  const { kind, outputFile, outputBytes, failedReadBytes, lastReadAt, successfulReadAt, finalReadAskedAt, usualMs, historyKey, ownerAgentId, endsWithAgent, ...details } = job
  return { ...details, kind: 'monitor', eventCount: 0, note: job.note === 'no output file' || READ_NOTES.has(job.note ?? '') ? undefined : job.note }
}

/** A launch's job laid over a job of its kind that a notification, a Monitor event, or a snapshot brought first: the launch adds what only it knows, and what the mod learned since stays. */
function withLaunch(known: Job, launch: Job): Job {
  if (known.kind === 'shell' && launch.kind === 'monitor') known = { ...launch, ...asMonitor(known) }
  if (known.kind === 'task' && launch.kind !== 'task') {
    const { kind, taskType, ...details } = known
    known = { ...launch, ...details }
    if (known.kind === 'shell' && !isRunning(known)) known.finalReadAskedAt = known.lastEndedAt ?? known.endedAt
  }
  const identity = { title: launch.title, startedAt: launch.startedAt, isStartSeen: true, omittedAt: undefined, note: known.note ?? launch.note }
  if (known.kind === 'shell' && launch.kind === 'shell') return { ...known, ...identity, outputFile: launch.outputFile ?? known.outputFile,
    ownerAgentId: launch.ownerAgentId ?? known.ownerAgentId, endsWithAgent: launch.endsWithAgent ?? known.endsWithAgent }
  return known.kind === 'monitor' && launch.kind === 'monitor' ? { ...known, ...identity, deadline: launch.deadline } : { ...known, ...identity }
}

/** The list after a launch; observed state stays and kinds can be refined. */
export function launched(jobs: readonly Job[], launch: Job): Job[] {
  const known = jobs.find(job => job.id === launch.id)
  if (known === undefined) return withJob(jobs, launch)
  const refinesShell = known.kind === 'shell' && !known.isStartSeen && launch.kind === 'monitor'
  return known.kind === launch.kind || known.kind === 'task' || refinesShell ? withJob(jobs, withLaunch(known, launch)) : [...jobs]
}

/** A background shell command, as its launch result describes it. */
export function shellJob(launch: { id: string; command: string; description?: string; outputFile?: string; note?: string; ownerAgentId?: string; endsWithAgent?: boolean }, now: number): ShellJob {
  return {
    kind: 'shell',
    id: launch.id,
    title: titled(launch.description || launch.command),
    state: 'running',
    startedAt: now,
    isStartSeen: true,
    outputFile: launch.outputFile,
    ownerAgentId: launch.ownerAgentId,
    endsWithAgent: launch.endsWithAgent,
    note: launch.note,
  }
}

/** The list with a launch's history key and usual duration on the shell job that holds its id; a job the list no longer holds is not added back. */
export function historyAdded(jobs: readonly Job[], id: string, history: { historyKey: string; usualMs?: number }): Job[] {
  return jobs.map(job => (job.kind === 'shell' && job.id === id ? { ...job, historyKey: history.historyKey, usualMs: history.usualMs } : job))
}

/** The note a shell launch shows: a missing output file first, then an end tied to a subagent, then how the command went to the background. */
export function shellLaunchNote(
  result: { timedOutAfterMs?: number; backgroundedByUser?: boolean; backgroundEndsWithFinalResponse?: boolean },
  hasOutputFile: boolean,
): string | undefined {
  if (!hasOutputFile) return 'no output file'
  if (result.backgroundEndsWithFinalResponse === true) return ENDS_WITH_AGENT
  if (result.timedOutAfterMs !== undefined) return 'moved after timeout'
  return result.backgroundedByUser === true ? 'backgrounded by you' : undefined
}

/** A Monitor watch; a non-persistent one ends at its deadline. */
export function monitorJob(launch: { id: string; description: string; timeoutMs: number; isPersistent: boolean }, now: number): MonitorJob {
  return {
    kind: 'monitor',
    id: launch.id,
    title: titled(launch.description),
    state: 'running',
    startedAt: now,
    isStartSeen: true,
    eventCount: 0,
    deadline: launch.timeoutMs > 0 && !launch.isPersistent ? now + launch.timeoutMs : undefined,
  }
}

/** A background or remote subagent. */
export function agentJob(launch: { id: string; description: string; note?: string }, now: number): AgentJob {
  return {
    kind: 'agent',
    id: launch.id,
    title: titled(launch.description),
    state: 'running',
    startedAt: now,
    isStartSeen: true,
    toolCount: 0,
    inFlight: 0,
    errorStreak: 0,
    note: launch.note,
  }
}

/** A background workflow run. */
export function workflowJob(launch: { id: string; name?: string }, now: number): WorkflowJob {
  return { kind: 'workflow', id: launch.id, title: titled(launch.name || 'workflow'), state: 'running', startedAt: now, isStartSeen: true }
}

/** The pending wakeup of a dynamic /loop, set at `now`. */
export function wakeupOf(dueAt: number, reason: string | undefined, now: number): Wakeup {
  return { dueAt, reason: clip(oneLine(reason || 'wakeup'), NOTE_MAX), setAt: now }
}

/** The list after TaskStop stopped the job with this id; an ended job stays as it is. */
export function stoppedJob(jobs: readonly Job[], id: string, now: number): Job[] {
  return jobs.map(job => (job.id === id && isRunning(job) ? endedJob(job, 'stopped', now, {}) : job))
}

/** One in-flight task in a Stop or SubagentStop snapshot. */
export type SnapshotTask = NonNullable<ClassicEventOf['classic.Stop']['background_tasks']>[number]

/** One finished run for the duration history. */
export type HistoryRun = { key: string; durationMs: number }

/** The end states of the engine's task status words; a remote task blocked on input has ended for this session, and the engine marks it failed. */
const NOTICE_STATES: ReadonlyMap<string, JobState> = new Map([
  ['completed', 'completed'],
  ['failed', 'failed'],
  ['blocked', 'failed'],
  ['killed', 'stopped'],
  ['stopped', 'stopped'],
  ['cancelled', 'stopped'],
])
const SNAPSHOT_KINDS: ReadonlyMap<string, Job['kind']> = new Map([
  ['shell', 'shell'],
  ['subagent', 'agent'],
  ['monitor', 'monitor'],
  ['workflow', 'workflow'],
])

/** The state a notification status ends a job in, in any letter case, or undefined for another word or none. */
function endStateOf(status: string | undefined): JobState | undefined {
  return status === undefined ? undefined : NOTICE_STATES.get(status.toLowerCase())
}

/** The quote that closes a description: the engine's own words follow it, as in `"build" completed (exit code 0)` or `"watch" script failed`. */
const DESCRIPTION_END = /" (?:completed|failed|finished|stopped|was|is|script)\b/g

/**
 * A summary split at its quoted description, `<prefix> "<description>" <engine words>`, so the description's
 * words cannot pose as the engine's own. A matching known title decides the boundary. Otherwise a reason matching
 * the notification status starts after the description; without one, the last quote followed by an engine verb closes it.
 */
function summaryParts(notice: Notice, title?: string): { description?: string; words: string } {
  const text = notice.summary ?? ''
  const state = endStateOf(notice.status)
  const open = text.indexOf('"')
  const verbs = [...text.matchAll(DESCRIPTION_END)].filter(match => match.index > open)
  const known = title === undefined ? undefined : verbs.find(match => text.slice(open + 1, match.index) === title)
  const reason = verbs.find(match =>
    state === 'failed' && /^" (?:failed|is blocked): /.test(text.slice(match.index)) ||
    state === 'stopped' && /^" was stopped: /.test(text.slice(match.index)))
  const close = (known ?? reason ?? verbs.at(-1))?.index ?? text.lastIndexOf('"')
  return open === -1 || close <= open ? { words: text } : { description: text.slice(open + 1, close), words: text.slice(close + 1) }
}

/** The exit code a summary's engine words state, `exit code N` or `(exit N)`; the last one wins. */
function exitCodeOf(words: string): number | undefined {
  const code = [...words.matchAll(/exit code (\d+)|\(exit (\d+)\)/g)].at(-1)
  return code === undefined ? undefined : Number(code[1] ?? code[2])
}

/**
 * The end detail a notification's summary states: a known end cause or a failure reason. A block's `<note>` is not
 * read: the engine puts its guidance for Claude there, not an end detail.
 */
function endNoteOf(summary: string): string | undefined {
  if (summary.includes('background time limit')) return 'time limit'
  if (summary.includes('low on memory')) return 'low memory'
  if (summary.includes('-turn limit')) return 'turn limit'
  const reason = /(?:failed|was stopped|is blocked): ([\s\S]+)$/.exec(summary)?.[1]
  if (reason !== undefined) return clip(oneLine(reason), NOTE_MAX)
  return summary.includes('previous session') ? 'previous session' : undefined
}

/** A job's kind from the summary's start, as the engine words its notices: a previous session's restored tasks start `Background shell command`, `Background agent`, or `Background workflow`. */
function kindOf(summary: string): Job['kind'] {
  if (/^Background (?:shell )?command/.test(summary)) return 'shell'
  if (/^(?:Background agent|Agent)/.test(summary)) return 'agent'
  if (summary.startsWith('Monitor')) return 'monitor'
  return /^(?:Background workflow|Dynamic workflow|Workflow)/.test(summary) ? 'workflow' : 'task'
}

/** The fields of a job the mod first sees running or ended, with no launch result. */
function unseen(id: string, title: string, now: number) {
  return { id, title: titled(title), state: 'running' as const, startedAt: now, isStartSeen: false }
}

function freshMonitor(id: string, title: string, now: number): MonitorJob {
  return { kind: 'monitor', ...unseen(id, title, now), eventCount: 0 }
}

function freshJob(kind: Job['kind'], id: string, title: string, now: number): Job {
  switch (kind) {
    case 'shell':
      return { kind, ...unseen(id, title, now) }
    case 'monitor':
      return freshMonitor(id, title, now)
    case 'agent':
      return { kind, ...unseen(id, title, now), toolCount: 0, inFlight: 0, errorStreak: 0 }
    case 'workflow':
      return { kind, ...unseen(id, title, now) }
    case 'task':
      return { kind, ...unseen(id, title, now), taskType: 'task' }
  }
}

function ended(jobs: readonly Job[], notice: Notice, state: JobState, now: number): Job[] {
  return notice.ids.reduce<Job[]>((list, id) => {
    let known = list.find(job => job.id === id) ?? freshJob(kindOf(notice.summary ?? ''), id, summaryParts(notice).description || id, now)
    if (known.kind === 'shell' && !known.isStartSeen && kindOf(notice.summary ?? '') === 'monitor') known = asMonitor(known)
    const { words } = summaryParts(notice, known.title)
    const detail = { exitCode: exitCodeOf(words), note: endNoteOf(words) }
    return withJob(list, endedJob(known, state, now, detail))
  }, [...jobs])
}

function monitorEvent(jobs: readonly Job[], notice: Notice, event: string, now: number): Job[] {
  const lines = displayLinesOf(event)
  const progress = progressOf(lines.slice(-PROGRESS_LINES), now)
  const lastLine = lines.at(-1)
  return notice.ids.reduce<Job[]>((list, id) => {
    let known = list.find(job => job.id === id)
    if (known?.kind === 'shell' && !known.isStartSeen) {
      known = asMonitor(known)
    }
    if (known !== undefined && known.kind !== 'monitor') return list
    const current = known ?? freshMonitor(id, summaryParts(notice).description || id, now)
    const monitor = { ...current, eventCount: current.eventCount + 1 }
    return withJob(list, {
      ...monitor,
      omittedAt: undefined,
      lastOutputAt: now,
      lastLine: lastLine === undefined ? monitor.lastLine : clip(lastLine, LINE_MAX),
      progress: progress ?? monitor.progress,
      anchor: progress === undefined ? monitor.anchor : anchorOf(monitor.anchor, progress, monitor.progress),
    })
  }, [...jobs])
}

/** Applies the status and output in a notification. */
export function noticed(jobs: readonly Job[], notice: Notice, now: number): Job[] {
  const state = endStateOf(notice.status)
  const updated = state === undefined ? [...jobs] : ended(jobs, notice, state, now)
  const refined = notice.event === undefined ? updated : monitorEvent(updated, notice, notice.event, now)
  return refined.map(job => {
    if (job.kind !== 'shell' || !notice.ids.includes(job.id) || notice.outputFile === undefined || !isOutputFileOf(notice.outputFile, job.id)) return job
    return { ...job, outputFile: notice.outputFile, note: job.note === 'no output file' ? undefined : job.note,
      finalReadAskedAt: isRunning(job) ? job.finalReadAskedAt : now }
  })
}

/**
 * Why a block that names a task changes no job: a status word the mod does not know. A block with no task id or no
 * status is the engine's other news (an artifact's event, a stalled command, an agent resumed), which changes no job
 * and is no problem.
 */
export function noticeProblemOf(notice: Notice): { cause: string; once: string } | undefined {
  const id = notice.ids[0]
  if (id === undefined || notice.status === undefined || endStateOf(notice.status) !== undefined) return undefined
  const word = clip(oneLine(notice.status), STATUS_WORD_MAX)
  return { cause: `unknown notification status "${word}" for task ${id}`, once: `status|${word}` }
}

/** The runs one block ends cleanly: completed, exit code 0 or none, a shell job still running, seen from launch, with a history key. */
function cleanRunsOf(jobs: readonly Job[], notice: Notice, now: number): HistoryRun[] {
  if (endStateOf(notice.status) !== 'completed') return []
  return jobs.flatMap(job =>
    job.kind === 'shell' && isRunning(job) && canEnd(job, now) && job.isStartSeen && job.historyKey !== undefined && notice.ids.includes(job.id) &&
    (exitCodeOf(summaryParts(notice, job.title).words) ?? 0) === 0
      ? [{ key: job.historyKey, durationMs: now - job.startedAt }]
      : [],
  )
}

/** The runs a prompt's blocks end cleanly; each block meets the list as the blocks before it left it. */
export function finishedRuns(jobs: readonly Job[], notices: readonly Notice[], now: number): HistoryRun[] {
  const runs: HistoryRun[] = []
  let list = jobs
  for (const notice of notices) {
    runs.push(...cleanRunsOf(list, notice, now))
    list = noticed(list, notice, now)
  }
  return runs
}

function discoveredJob(task: SnapshotTask, now: number): Job {
  const job = { ...freshJob(SNAPSHOT_KINDS.get(task.type) ?? 'task', task.id, task.name || task.description || task.command || task.id, now), lastRunningAt: now }
  return job.kind === 'task' ? { ...job, taskType: task.type } : job
}

/** A job that a snapshot marked gone and a later snapshot lists: it runs again, without its end time, and with the launch note its snapshot note replaced. */
function revived(job: Job, now: number): Job {
  return { ...job, state: 'running', lastRunningAt: now, omittedAt: undefined, endedAt: undefined, note: job.note === AGENT_GONE_NOTE ? ENDS_WITH_AGENT : undefined }
}

/** Reconciles running tasks, allowing a grace period before an absence ends a job. */
export function reconciled(jobs: readonly Job[], snapshot: readonly SnapshotTask[], now: number): Job[] {
  const listed = new Set(snapshot.map(task => task.id))
  const known = new Set(jobs.map(job => job.id))
  const updated = jobs.map(job => {
    if (isRunning(job) && !listed.has(job.id) && job.startedAt <= now - SNAPSHOT_SLACK_MS && (job.lastRunningAt === undefined || job.lastRunningAt < now)) {
      return endedJob(job, 'gone', now, { note: job.note === ENDS_WITH_AGENT ? AGENT_GONE_NOTE : GONE_NOTE })
    }
    if (!listed.has(job.id)) return isRunning(job) && now > (job.lastRunningAt ?? job.startedAt) && now >= (job.omittedAt ?? -Infinity) ? { ...job, omittedAt: now } : job
    if (isRunning(job)) return { ...job, omittedAt: undefined, lastRunningAt: Math.max(job.lastRunningAt ?? job.startedAt, now) }
    return job.state === 'gone' && job.lastEndedAt !== undefined && job.lastEndedAt < now ? revived(job, now) : job
  })
  const discovered = snapshot.filter(task => !known.has(task.id)).map(task => discoveredJob(task, now))
  return [...updated, ...discovered]
}

/** What one read of a job's output found. */
export type TailRead = { bytes: number; mtimeMs: number; lines: readonly string[] }

/** Notes a successful read clears. */
const READ_NOTES: ReadonlySet<string> = new Set(['output unavailable', 'tail failed'])

/** The states of the agent list's status words. */
const AGENT_STATES: ReadonlyMap<string, JobState> = new Map([['pending', 'running'], ['running', 'running'], ['waiting', 'running'], ['idle', 'running'], ...NOTICE_STATES])

type Detail = { field: string; shape: 'text' | 'name' | 'host' }

/** The input field each tool's activity summary shows: a file name, a host, or the text itself. */
const DETAILS: ReadonlyMap<string, Detail> = new Map([
  ['Bash', { field: 'command', shape: 'text' }],
  ['Monitor', { field: 'command', shape: 'text' }],
  ['Read', { field: 'file_path', shape: 'name' }],
  ['Edit', { field: 'file_path', shape: 'name' }],
  ['Write', { field: 'file_path', shape: 'name' }],
  ['NotebookEdit', { field: 'notebook_path', shape: 'name' }],
  ['Grep', { field: 'pattern', shape: 'text' }],
  ['Glob', { field: 'pattern', shape: 'text' }],
  ['WebFetch', { field: 'url', shape: 'host' }],
  ['WebSearch', { field: 'query', shape: 'text' }],
  ['Agent', { field: 'description', shape: 'text' }],
])

function detailOf(value: string, shape: Detail['shape']): string {
  if (shape === 'name') return value.split(/[\\/]/).pop() ?? value
  if (shape === 'host') return URL.canParse(value) ? new URL(value).host : value
  return value
}

/**
 * The list after an agent list read in a tick that began at `now`: its status decides each agent job's state. A resumed
 * agent runs again without its end time and end note, but only when its latest end came before the tick: a later end
 * may postdate the list.
 */
export function agentsSynced(jobs: readonly Job[], agents: readonly AgentInfo[], now: number): Job[] {
  return jobs.map(job => {
    if (job.kind !== 'agent') return job
    const status = agents.find(agent => agent.id === job.id)?.status
    const state = status === undefined ? undefined : AGENT_STATES.get(status)
    if (state === undefined) return job
    const activityStatus = status as AgentJob['activityStatus']
    if (state === 'running' && isRunning(job)) return { ...job, activityStatus, omittedAt: undefined, lastRunningAt: Math.max(job.lastRunningAt ?? job.startedAt, now) }
    if (state === job.state || now <= (job.lastRunningAt ?? job.startedAt)) return job
    if (state !== 'running') return endedJob(job, state, now, {})
    return job.lastEndedAt !== undefined && job.lastEndedAt < now ? { ...job, state, activityStatus, lastRunningAt: now, omittedAt: undefined, endedAt: undefined, note: undefined } : job
  })
}

/** `<tool>: <detail>`, or the tool alone, as one line of at most ACTIVITY_MAX characters. */
export function activityOf(tool: string, input: object): string {
  const detail = DETAILS.get(tool)
  const value: unknown = detail === undefined ? undefined : Reflect.get(input, detail.field)
  const text = detail !== undefined && typeof value === 'string' && value.trim() !== '' ? `${tool}: ${detailOf(value, detail.shape)}` : tool
  return clip(oneLine(text), ACTIVITY_MAX)
}

/** The list after a tracked subagent started a tool call. */
export function activityStarted(jobs: readonly Job[], agentId: string, summary: string, now: number): Job[] {
  return jobs.map(job =>
    job.kind === 'agent' && job.id === agentId
      ? {
          ...job,
          toolCount: job.toolCount + 1,
          inFlight: job.inFlight + 1,
          lastLine: now >= (job.lastToolStartedAt ?? -Infinity) ? summary : job.lastLine,
          lastToolStartedAt: Math.max(job.lastToolStartedAt ?? now, now),
          lastOutputAt: Math.max(job.lastOutputAt ?? now, now),
        }
      : job,
  )
}

/** Settled calls count in observation order. Concurrent failures retain their times until a success or no call remains. */
export function activityEnded(jobs: readonly Job[], agentId: string, isFailure: boolean, now: number): Job[] {
  return jobs.map(job => {
    if (job.kind !== 'agent' || job.id !== agentId) return job
    const inFlight = Math.max(0, job.inFlight - 1)
    const previous = job.concurrentFailureTimes ?? []
    const lastSuccessAt = isFailure ? job.lastSuccessAt : Math.max(job.lastSuccessAt ?? now, now)
    const failures = isFailure
      ? now >= (lastSuccessAt ?? -Infinity) ? [...previous, now] : previous
      : previous.filter(at => at > lastSuccessAt!)
    // The unrecorded part precedes these concurrent calls and every success resets it.
    const errorStreak = (isFailure ? job.errorStreak - previous.length : 0) + failures.length
    return {
      ...job,
      inFlight,
      errorStreak,
      concurrentFailureTimes: inFlight === 0 ? undefined : failures,
      lastSuccessAt: inFlight === 0 ? undefined : lastSuccessAt,
      lastOutputAt: Math.max(job.lastOutputAt ?? now, now),
    }
  })
}

/** Shell jobs whose output the ticker reads now: a pending final read, or a running job not read for READ_EVERY_MS (LARGE_READ_EVERY_MS once its output passed LARGE_FILE_BYTES). */
export function readsDue(jobs: readonly Job[], now: number): (ShellJob & { outputFile: string })[] {
  return jobs.filter(
    (job): job is ShellJob & { outputFile: string } =>
      job.kind === 'shell' &&
      job.outputFile !== undefined &&
      (job.finalReadAskedAt !== undefined ||
        (isRunning(job) && now - (job.lastReadAt ?? 0) >= ((job.failedReadBytes ?? job.outputBytes ?? 0) > LARGE_FILE_BYTES ? LARGE_READ_EVERY_MS : READ_EVERY_MS))),
  )
}

/** An end's final-read request that a read beginning at `readAt` leaves open: one made at or after that time. */
const askedSince = (job: ShellJob, readAt: number): number | undefined =>
  job.finalReadAskedAt !== undefined && job.finalReadAskedAt >= readAt ? job.finalReadAskedAt : undefined

/** The list after a read that began at `now`: size, time, last line, and progress; a read-problem note clears, and a later end keeps its final read. */
export function tailRead(jobs: readonly Job[], id: string, read: TailRead, now: number): Job[] {
  return jobs.map(job => {
    if (job.kind !== 'shell' || job.id !== id) return job
    const lines = /^\[exited with code -?\d+\]$/.test(read.lines.at(-1) ?? '') ? read.lines.slice(0, -1) : read.lines
    const progress = progressOf(lines.slice(-PROGRESS_LINES), now)
    const lastLine = lines.at(-1)
    return {
      ...job,
      outputBytes: read.bytes,
      failedReadBytes: undefined,
      lastOutputAt: read.mtimeMs,
      lastReadAt: now,
      successfulReadAt: now,
      finalReadAskedAt: askedSince(job, now),
      note: job.note !== undefined && READ_NOTES.has(job.note) ? undefined : job.note,
      lastLine: lastLine === undefined ? job.lastLine : clip(lastLine, LINE_MAX),
      progress: progress ?? job.progress,
      anchor: progress === undefined ? job.anchor : anchorOf(job.anchor, progress, job.progress),
    }
  })
}

/** The list after a read that began at `now` failed: the next try waits its interval, a failed final read is not tried again unless a later end asked, and a launch or end note wins over a read note. */
export function readFailed(jobs: readonly Job[], id: string, note: 'output unavailable' | 'tail failed', now: number, bytes?: number): Job[] {
  return jobs.map(job =>
    job.kind === 'shell' && job.id === id
      ? {
          ...job,
          lastReadAt: now,
          successfulReadAt: undefined,
          failedReadBytes: bytes ?? job.failedReadBytes,
          finalReadAskedAt: askedSince(job, now),
          note: job.note === undefined || READ_NOTES.has(job.note) ? note : job.note,
        }
      : job,
  )
}

/** The list with every ended job removed. */
export function finishedCleared(jobs: readonly Job[]): Job[] {
  return jobs.filter(isRunning)
}

/** The observation time belongs to the input, before any asynchronous work or state retry. */
export type JobObservation = {
  at: number
  ids?: readonly string[]
  kind?: 'snapshot' | 'restore' | 'activity' | 'remove'
  members?: readonly string[]
  noticeRow?: string
}

/**
 * One ordering rule for job inputs. Removal wins ties; other ties use write order.
 * Snapshots also reject older inputs for absent rows. Activity counts settle every call, with their own field ordering.
 */
export function observedJobs(state: JobsState, input: JobObservation, change: (jobs: Job[]) => Job[]): JobsState {
  if (input.noticeRow !== undefined && state.noticeRows?.includes(input.noticeRow)) return state
  if (input.kind === 'snapshot' && input.at < (state.snapshotAt ?? -Infinity)) return state
  const observed = new Map(state.observed)
  const removed = new Map(state.removed)
  const known = new Set(state.items.map(job => job.id))
  const targets = input.ids === undefined ? undefined : new Set(input.ids)
  const accepts = (id: string): boolean =>
    (targets === undefined || targets.has(id)) &&
    input.at > (removed.get(id) ?? -Infinity) &&
    (input.kind === 'activity' || input.at >= (observed.get(id) ?? -Infinity)) &&
    ((input.kind !== 'restore' && known.has(id)) || input.at >= (state.snapshotAt ?? -Infinity))
  const eligible = state.items.filter(job => accepts(job.id))
  const changed = change(eligible).filter(job => accepts(job.id))
  const replacements = new Map(changed.map(job => [job.id, job]))
  const candidates = [
    ...state.items.flatMap(job => accepts(job.id) ? replacements.get(job.id) ?? [] : job),
    ...changed.filter(job => !known.has(job.id)),
  ]
  const items = trimmed(candidates)
  const kept = new Set(items.map(job => job.id))
  const affected = input.ids ?? [
    ...eligible.filter(job => input.kind === 'snapshot' || replacements.get(job.id) !== job).map(job => job.id),
    ...changed.filter(job => !known.has(job.id)).map(job => job.id),
  ]
  const hadRow = new Set([...eligible, ...changed].map(job => job.id))
  for (const id of new Set(affected)) {
    if (!accepts(id)) continue
    observed.set(id, Math.max(observed.get(id) ?? input.at, input.at))
    if (!kept.has(id) && (input.kind === 'remove' || hadRow.has(id))) removed.set(id, input.at)
  }
  // Retention is a removal too, including a finished row first discovered by this input.
  for (const job of candidates) {
    if (kept.has(job.id)) continue
    const at = Math.max(input.at, observed.get(job.id) ?? input.at)
    observed.set(job.id, at)
    removed.set(job.id, Math.max(removed.get(job.id) ?? at, at))
  }
  return {
    items,
    observed: [...observed],
    removed: [...removed],
    snapshotAt: input.kind === 'snapshot' ? input.at : state.snapshotAt,
    snapshotIds: input.kind === 'snapshot' ? input.members === undefined ? undefined : [...input.members] : state.snapshotIds,
    noticeRows: input.noticeRow === undefined ? state.noticeRows : [...(state.noticeRows ?? []), input.noticeRow].slice(-NOTICE_ROWS_MAX),
  }
}

/** Restores the carry through the same ordering rule, using original observation and removal times. */
export function restoredJobs(state: JobsState, carried: JobsState): JobsState {
  let restored = state
  for (const [id, at] of carried.removed) {
    restored = observedJobs(restored, { at, ids: [id], kind: 'remove' }, () => [])
  }
  const rows = new Map(carried.items.map(job => [job.id, job]))
  for (const [id, at] of carried.observed) {
    const row = rows.get(id)
    restored = observedJobs(restored, { at, ids: [id], kind: 'restore' }, jobs => row === undefined ? jobs : [row])
  }
  const saved = (carried.snapshotAt ?? -Infinity) >= (state.snapshotAt ?? -Infinity) ? carried : state
  if (saved.snapshotAt !== null && saved.snapshotIds !== undefined) {
    const members = new Set(saved.snapshotIds)
    const at = saved.snapshotAt
    restored = observedJobs(restored, { at, ids: restored.items.filter(job => !members.has(job.id)).map(job => job.id) }, jobs => reconciled(jobs, [], at))
  }
  return { ...restored, snapshotAt: saved.snapshotAt, snapshotIds: saved.snapshotIds,
    noticeRows: [...new Set([...(state.noticeRows ?? []), ...(carried.noticeRows ?? [])])].slice(-NOTICE_ROWS_MAX) }
}

/** Live: a job runs, a wakeup is pending, or a job ended less than RECENT_MS ago. */
export function isLive(jobs: readonly Job[], wakeup: Wakeup | null, now: number): boolean {
  return wakeup !== null || jobs.some(job => isRunning(job) || now - (job.endedAt ?? 0) < RECENT_MS)
}

/** The wakeup after a scheduled trigger: cleared from TRIGGER_EARLY_MS before its due time on. */
export function wakeupAfterTrigger(wakeup: Wakeup | null, now: number): Wakeup | null {
  return wakeup !== null && now >= wakeup.dueAt - TRIGGER_EARLY_MS ? null : wakeup
}

/** The wakeup after a tick: dropped once it is more than WAKEUP_STALE_MS past due. */
export function wakeupAfterTick(wakeup: Wakeup | null, now: number): Wakeup | null {
  return wakeup !== null && now > wakeup.dueAt + WAKEUP_STALE_MS ? null : wakeup
}

/**
 * The wakeup after the session crons of a snapshot whose hook began at `now`: a list with no one-shot entry holds no
 * pending wakeup. The engine took the snapshot before the hook began, while hooks above it ran, so a wakeup set from
 * SNAPSHOT_SLACK_MS before then on may be newer than the snapshot, and it stays.
 */
export function wakeupAfterSnapshot(wakeup: Wakeup | null, crons: readonly { recurring: boolean }[], now: number): Wakeup | null {
  return wakeup === null || crons.some(cron => !cron.recurring) || wakeup.setAt > now - SNAPSHOT_SLACK_MS ? wakeup : null
}

/** Ends only commands whose launch tied their lifetime to this agent's final answer. */
export function ownerAnswered(jobs: readonly Job[], agentId: string, now: number): Job[] {
  return jobs.map(job => job.kind === 'shell' && job.ownerAgentId === agentId && job.endsWithAgent === true && isRunning(job)
    ? endedJob(job, 'gone', now, { note: AGENT_GONE_NOTE }) : job)
}
