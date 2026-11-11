// @ts-nocheck: written for the Claude Code 2.1.296 types; this folder has the 2.1.283 declarations.
import type {
  SubagentTunerChoice as Choice,
  SubagentTunerMode as Mode,
  SubagentTunerPending as Pending,
  SubagentTunerQueue as Queue,
} from '../types'
import { EFFORTS, MODELS } from './recommend'

// Pure parsers and reducers. The module that hooks events holds every call on
// `$` and declares the atoms: the plugin loader follows `$`, and reads an
// atom's reference, only within one file.

export const DEFAULT_MODE: Mode = 'manual'
export const STORE_MODE = 'mode'
export const STORE_SAVED = 'saved'

export type Field = 'model' | 'effort'

export const parseMode = (value: unknown, fallback: Mode): Mode =>
  value === 'manual' || value === 'auto' ? value : fallback

const isOneOf = (list: readonly string[], value: unknown): boolean =>
  value === null || (typeof value === 'string' && list.includes(value))

/** A stored value that is not a choice over the known names counts as unset. */
export function parseChoice(value: unknown): Choice | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const { model, effort } = value as Record<string, unknown>

  if (!isOneOf(MODELS, model) || !isOneOf(EFFORTS, effort)) {
    return null
  }

  return { model: model as string | null, effort: effort as string | null }
}

/** A choice with neither field set is no default at all. */
export const asDefault = (choice: Choice | null): Choice | null =>
  choice !== null && (choice.model !== null || choice.effort !== null) ? choice : null

/** The next value of a field in its cycle: none, then each name in turn. */
export function cycled(current: string | null, names: readonly string[]): string | null {
  const at = current === null ? -1 : names.indexOf(current)

  return names[at + 1] ?? null
}

export function cycleField(saved: Choice | null, field: Field): Choice | null {
  const base = saved ?? { model: null, effort: null }

  return asDefault({ ...base, [field]: cycled(base[field], field === 'model' ? MODELS : EFFORTS) })
}

export const withPending = (q: Queue, item: Pending): Queue => ({ items: [...q.items, item] })

export const patched = (q: Queue, id: string, patch: Partial<Pending>): Queue => ({
  items: q.items.map(one => (one.id === id ? { ...one, ...patch } : one)),
})

export const without = (q: Queue, id: string): Queue => ({ items: q.items.filter(one => one.id !== id) })
