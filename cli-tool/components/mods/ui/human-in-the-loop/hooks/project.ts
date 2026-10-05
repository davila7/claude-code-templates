import type { Task } from '../types'
import { isShown } from './tasks'

/** How often a live session says so in the project's store. */
export const HEARTBEAT_MS = 60_000

/** A session not heard from for this long is gone: its tasks are free to adopt. */
export const STALE_MS = 3 * 60_000

/** One session's part of a project: its tasks, and when it was last alive. */
export type Slot = {
  tasks: Task[]
  seenMs: number
  /** Set when the session ended: its tasks wait for the next session here. */
  endedMs?: number
}

/**
 * What a project keeps in the store: the next task number, shared by every
 * session there, and each session's own tasks. A session writes its own slot
 * only, so two sessions in one project never write over each other's tasks.
 */
export type Stored = { nextId: number; sessions: Record<string, Slot> }

/** Reads what the store holds, the first layout (one list for the project) included. */
export function storedOf(raw: unknown): Stored {
  const value = (raw ?? {}) as { nextId?: unknown; sessions?: unknown; tasks?: unknown }
  const nextId = typeof value.nextId === 'number' ? value.nextId : 1

  if (value.sessions !== null && typeof value.sessions === 'object') {
    return { nextId, sessions: value.sessions as Record<string, Slot> }
  }

  // The first layout kept one list per project: its tasks belong to sessions
  // that have ended.
  const sessions: Record<string, Slot> = {}

  for (const task of Array.isArray(value.tasks) ? (value.tasks as Task[]) : []) {
    const slot = (sessions[task.sessionId] ??= { tasks: [], seenMs: 0, endedMs: 0 })
    slot.tasks.push(task)
  }

  return { nextId, sessions }
}

/** Whether a session's tasks are free for another to take on: it ended, or went quiet. */
export function isGone(slot: Slot, nowMs: number): boolean {
  return slot.endedMs !== undefined || nowMs - slot.seenMs > STALE_MS
}

/**
 * Takes on, for `sessionId`, its own slot (a resumed session) and every slot
 * of a session that is gone; their slots leave the store. Live sessions keep
 * theirs.
 */
export function adopt(stored: Stored, sessionId: string, nowMs: number): { adopted: Task[]; stored: Stored } {
  const adopted: Task[] = []
  const sessions: Record<string, Slot> = {}

  for (const [id, slot] of Object.entries(stored.sessions)) {
    if (id === sessionId || isGone(slot, nowMs)) {
      adopted.push(...slot.tasks.filter(isShown))
    } else {
      sessions[id] = slot
    }
  }

  adopted.sort((a, b) => a.id - b.id)

  return { adopted, stored: { ...stored, sessions } }
}

/** `sessionId`'s slot set to `tasks`, alive now; a session with nothing left has no slot. */
export function withSlot(stored: Stored, sessionId: string, tasks: readonly Task[], nowMs: number): Stored {
  const sessions = { ...stored.sessions }
  const shown = tasks.filter(isShown)

  if (shown.length === 0) {
    delete sessions[sessionId]
  } else {
    sessions[sessionId] = { tasks: shown, seenMs: nowMs }
  }

  return { ...stored, sessions }
}

/** `sessionId`'s slot marked ended, so the next session in the project takes its tasks on. */
export function endSlot(stored: Stored, sessionId: string, nowMs: number): Stored {
  const slot = stored.sessions[sessionId]

  return slot === undefined ? stored : { ...stored, sessions: { ...stored.sessions, [sessionId]: { ...slot, endedMs: nowMs } } }
}

/** How many tasks wait in the project's other live sessions. */
export function elsewhereIn(stored: Stored, sessionId: string, nowMs: number): number {
  return Object.entries(stored.sessions)
    .filter(([id, slot]) => id !== sessionId && !isGone(slot, nowMs))
    .reduce((sum, [, slot]) => sum + slot.tasks.filter(isShown).length, 0)
}
