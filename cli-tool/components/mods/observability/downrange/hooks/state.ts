import type { JobsState, WakeupState } from '../types'

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const number = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const optionalNumbers = (value: Record<string, unknown>, keys: readonly string[]): boolean => keys.every(key => value[key] === undefined || number(value[key]))
const optionalStrings = (value: Record<string, unknown>, keys: readonly string[]): boolean => keys.every(key => value[key] === undefined || typeof value[key] === 'string')
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string')
const times = (value: unknown): boolean => Array.isArray(value) && value.every(item => Array.isArray(item) && item.length === 2 && typeof item[0] === 'string' && number(item[1]))
const progress = (value: unknown): boolean => value === undefined || (record(value) && number(value.percent) && number(value.at) && typeof value.label === 'string')
const anchor = (value: unknown): boolean => value === undefined || (record(value) && number(value.percent) && number(value.at))
const states = new Set(['running', 'completed', 'failed', 'stopped', 'gone'])
const activities = new Map([['pending', true], ['running', true], ['waiting', true], ['idle', true]])

function job(value: unknown): boolean {
  if (!record(value) || typeof value.id !== 'string' || typeof value.title !== 'string' || (typeof value.state !== 'string' || !states.has(value.state)) ||
      !number(value.startedAt) || typeof value.isStartSeen !== 'boolean' ||
      !optionalNumbers(value, ['lastRunningAt', 'omittedAt', 'endedAt', 'lastEndedAt', 'exitCode', 'lastOutputAt']) ||
      !optionalStrings(value, ['note', 'lastLine'])) return false
  switch (value.kind) {
    case 'shell':
      return optionalStrings(value, ['outputFile', 'historyKey', 'ownerAgentId']) &&
        (value.endsWithAgent === undefined || typeof value.endsWithAgent === 'boolean') &&
        optionalNumbers(value, ['outputBytes', 'failedReadBytes', 'lastReadAt', 'successfulReadAt', 'finalReadAskedAt', 'usualMs']) && progress(value.progress) && anchor(value.anchor)
    case 'monitor':
      return number(value.eventCount) && optionalNumbers(value, ['deadline']) && progress(value.progress) && anchor(value.anchor)
    case 'agent':
      return number(value.toolCount) && number(value.inFlight) && number(value.errorStreak) &&
        optionalNumbers(value, ['lastToolStartedAt', 'lastSuccessAt']) &&
        (value.activityStatus === undefined || (typeof value.activityStatus === 'string' && activities.has(value.activityStatus))) &&
        (value.concurrentFailureTimes === undefined || (Array.isArray(value.concurrentFailureTimes) && value.concurrentFailureTimes.every(number)))
    case 'workflow': return true
    case 'task': return typeof value.taskType === 'string'
    default: return false
  }
}

/** Reads the supported jobs shapes without discarding their ordering barriers. */
export function jobsStateOf(raw: unknown): JobsState | undefined {
  if (!record(raw) || (raw.shape !== 'v7' && raw.shape !== 'v8') || !record(raw.value)) return undefined
  const value = raw.value
  if (!Array.isArray(value.items) || !value.items.every(job) || !times(value.observed) || !times(value.removed) ||
      (value.snapshotAt !== null && !number(value.snapshotAt)) ||
      (value.snapshotIds !== undefined && !strings(value.snapshotIds)) || (value.noticeRows !== undefined && !strings(value.noticeRows))) return undefined
  const state = value as JobsState
  const observations = new Map(state.observed)
  if (state.items.some(item => !observations.has(item.id))) return undefined
  return state
}

/** Reads the previous wakeup shape, including a cancellation with no pending wakeup. */
export function wakeupStateOf(raw: unknown): WakeupState | undefined {
  if (!record(raw) || (raw.shape !== 'v3' && raw.shape !== 'v4') || !record(raw.value)) return undefined
  const { pending, updatedAt } = raw.value
  if (updatedAt !== null && !number(updatedAt)) return undefined
  if (pending !== null && (!record(pending) || !number(pending.dueAt) || !number(pending.setAt) || typeof pending.reason !== 'string' || !number(updatedAt))) return undefined
  return raw.value as WakeupState
}
