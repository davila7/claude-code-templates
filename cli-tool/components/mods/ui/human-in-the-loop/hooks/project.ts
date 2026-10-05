import type { Task } from '../types'
import { isShown } from './tasks'

/** How often a live session says so in the project's store. */
export const HEARTBEAT_MS = 60_000

/** A session not heard from for this long is gone: its tasks are free to adopt. */
export const STALE_MS = 3 * 60_000

/** How long a note of tasks taken from a quiet session waits for it to come back. */
export const TAKEN_MS = 30 * 24 * 60 * 60_000

/** One session's part of a project: its tasks, and when it was last alive. */
export type Slot = {
  tasks: Task[]
  seenMs: number
  /** Set when the session ended: its tasks wait for the next session here. */
  endedMs?: number
}

/**
 * The tasks another session took on from a session that went quiet (a laptop
 * asleep, say), by that session's numbers: if it comes back, it lets them go.
 */
export type Taken = { ids: number[]; atMs: number }

/**
 * What a project keeps in the store: the next task number, shared by every
 * session there, each session's own tasks, and the tasks taken from sessions
 * that went quiet. A session writes its own slot only, so two sessions in one
 * project never write over each other's tasks.
 */
export type Stored = { nextId: number; sessions: Record<string, Slot>; taken: Record<string, Taken> }

/** Reads what the store holds, the first layout (one list for the project) included. */
export function storedOf(raw: unknown): Stored {
  const value = (raw ?? {}) as { nextId?: unknown; sessions?: unknown; tasks?: unknown; taken?: unknown }
  const nextId = typeof value.nextId === 'number' ? value.nextId : 1
  const taken = value.taken !== null && typeof value.taken === 'object' ? (value.taken as Record<string, Taken>) : {}

  if (value.sessions !== null && typeof value.sessions === 'object') {
    return { nextId, sessions: value.sessions as Record<string, Slot>, taken }
  }

  // The first layout kept one list per project: its tasks belong to sessions
  // that have ended.
  const sessions: Record<string, Slot> = {}

  for (const task of Array.isArray(value.tasks) ? (value.tasks as Task[]) : []) {
    const slot = (sessions[task.sessionId] ??= { tasks: [], seenMs: 0, endedMs: 0 })
    slot.tasks.push(task)
  }

  return { nextId, sessions, taken: {} }
}

/** Whether a session's tasks are free for another to take on: it ended, or went quiet. */
export function isGone(slot: Slot, nowMs: number): boolean {
  return slot.endedMs !== undefined || nowMs - slot.seenMs > STALE_MS
}

/**
 * Takes on, for `sessionId`, its own slot (a resumed session) and every slot
 * of a session that is gone; their slots leave the store. Live sessions keep
 * theirs. A session that went quiet without ending is noted with the tasks
 * taken from it, in case it comes back.
 *
 * Two sessions assigning at the same moment can draw one number (the store
 * has no way to reserve one): where their tasks meet here, the session's own
 * keep theirs, the numbers its Claude knows, and a later one gets a new one.
 */
export function adopt(stored: Stored, sessionId: string, nowMs: number): { adopted: Task[]; stored: Stored } {
  const adopted: Task[] = []
  const sessions: Record<string, Slot> = {}
  const taken: Record<string, Taken> = {}
  const slots = Object.entries(stored.sessions).sort(([a], [b]) => Number(b === sessionId) - Number(a === sessionId))
  const numbers = slots.flatMap(([, slot]) => slot.tasks.map(task => task.id))
  let nextId = Math.max(stored.nextId, ...numbers.map(id => id + 1))

  for (const [id, note] of Object.entries(stored.taken)) {
    if (id !== sessionId && nowMs - note.atMs < TAKEN_MS) {
      taken[id] = note
    }
  }

  for (const [id, slot] of slots) {
    if (id !== sessionId && !isGone(slot, nowMs)) {
      sessions[id] = slot
      continue
    }

    const shown = slot.tasks.filter(isShown)

    if (id !== sessionId && slot.endedMs === undefined && shown.length > 0) {
      taken[id] = { ids: [...(taken[id]?.ids ?? []), ...shown.map(task => task.id)], atMs: nowMs }
    }

    for (const task of shown) {
      adopted.push(adopted.some(one => one.id === task.id) ? { ...task, id: nextId++ } : task)
    }
  }

  adopted.sort((a, b) => a.id - b.id)

  return { adopted, stored: { nextId, sessions, taken } }
}

/**
 * The numbers of `sessionId`'s tasks another session took on while it was
 * quiet, and the store with that note read; none when nothing was taken.
 */
export function takenFrom(stored: Stored, sessionId: string): { ids: readonly number[]; stored: Stored } {
  const note = stored.taken[sessionId]

  if (note === undefined) {
    return { ids: [], stored }
  }

  const taken = { ...stored.taken }
  delete taken[sessionId]

  return { ids: note.ids, stored: { ...stored, taken } }
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
