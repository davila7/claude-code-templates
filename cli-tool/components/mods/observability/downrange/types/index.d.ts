export type JobState = 'running' | 'completed' | 'failed' | 'stopped' | 'gone'

export type Progress = { percent: number; label: string; at: number }

export type Anchor = { percent: number; at: number }

export type JobBase = {
  id: string
  title: string
  state: JobState
  startedAt: number
  /** When a snapshot or agent list most recently confirmed the job running. */
  lastRunningAt?: number
  /** Snapshot omission protected by the grace period. */
  omittedAt?: number
  isStartSeen: boolean
  /** When the job first ended. */
  endedAt?: number
  /** When its latest end came: a later notification can end a job that already shows ended. */
  lastEndedAt?: number
  exitCode?: number
  note?: string
  lastLine?: string
  lastOutputAt?: number
}

export type ShellJob = JobBase & {
  kind: 'shell'
  ownerAgentId?: string
  endsWithAgent?: boolean
  successfulReadAt?: number
  outputFile?: string
  outputBytes?: number
  /** The size at a failed tail, used for its retry interval without marking that output as read. */
  failedReadBytes?: number
  lastReadAt?: number
  /** When the latest end asked for one more read of the output; a read that began after it clears it. */
  finalReadAskedAt?: number
  progress?: Progress
  anchor?: Anchor
  usualMs?: number
  historyKey?: string
}

export type MonitorJob = JobBase & {
  kind: 'monitor'
  eventCount: number
  deadline?: number
  progress?: Progress
  anchor?: Anchor
}

export type AgentJob = JobBase & {
  kind: 'agent'
  activityStatus?: 'pending' | 'running' | 'waiting' | 'idle'
  toolCount: number
  inFlight: number
  errorStreak: number
  /** When the newest tool call started, independently of completion times. */
  lastToolStartedAt?: number
  /** Failure times in the streak while other tool calls can still settle. */
  concurrentFailureTimes?: number[]
  /** Latest success among those concurrent completions; cleared when no call remains. */
  lastSuccessAt?: number
}

export type WorkflowJob = JobBase & { kind: 'workflow' }

export type TaskJob = JobBase & { kind: 'task'; taskType: string }

export type Job = ShellJob | MonitorJob | AgentJob | WorkflowJob | TaskJob

/** Rows and observation times survive together, including empty snapshots and removed task IDs. */
export type JobsState = {
  items: Job[]
  observed: [id: string, at: number][]
  removed: [id: string, at: number][]
  snapshotAt: number | null
  /** Membership at snapshotAt, used only to reconcile absences. */
  snapshotIds?: string[]
  /** Stored child notification identities already applied. */
  noticeRows?: string[]
}

/** The pending wakeup: when it fires, why, and when ScheduleWakeup set it. */
export type Wakeup = { dueAt: number; reason: string; setAt: number }

/** The latest wakeup change, including cancellation when no wakeup remains. */
export type WakeupState = { pending: Wakeup | null; updatedAt: number | null }

declare module 'claude-code' {
  interface PluginState {
    'downrange': {
      jobs: Shaped<JobsState>
      wakeup: Shaped<WakeupState>
      bandHiddenAt: number | null
      lastAnswered: { text: string; at: number } | null
    }
  }
}
