import { MAX_KEYS, MAX_RUNS } from './limits'

/** Past run durations by history key, as the store keeps them. */
export type Durations = Record<string, { runs: number[]; at: number }>

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

const isEntry = (value: unknown): boolean =>
  isRecord(value) && typeof value.at === 'number' && Array.isArray(value.runs) && value.runs.every(run => typeof run === 'number')

const isDurations = (value: unknown): value is Durations => isRecord(value) && Object.values(value).every(isEntry)

/** The NUL character that separates folder and command in a history key, built from its code so that no string literal holds a control character. */
const NUL = String.fromCharCode(0)

/** The first 16 hex characters of SHA-256 over folder, NUL, and command: no command text is kept. */
export async function historyKeyOf(cwd: string, command: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${cwd}${NUL}${command}`)))
  return [...digest.slice(0, 8)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

/** The stored durations: {} when nothing is stored, undefined for a value of the wrong shape. */
export function durationsOf(value: unknown): Durations | undefined {
  if (value === undefined) return {}
  return isDurations(value) ? value : undefined
}

/** The median of a key's runs, or undefined when it has none. */
export function usualOf(durations: Durations, key: string): number | undefined {
  const runs = [...(durations[key]?.runs ?? [])].sort((a, b) => a - b)
  if (runs.length === 0) return undefined
  const middle = runs.slice(Math.floor((runs.length - 1) / 2), Math.floor(runs.length / 2) + 1)
  return middle.reduce((sum, run) => sum + run, 0) / middle.length
}

/** The durations with one more run for key: MAX_RUNS runs per key, the MAX_KEYS most recent keys. */
export function recorded(durations: Durations, key: string, durationMs: number, now: number): Durations {
  const runs = [...(durations[key]?.runs ?? []), durationMs].slice(-MAX_RUNS)
  const entries = Object.entries({ ...durations, [key]: { runs, at: now } })
  return Object.fromEntries(entries.sort(([, a], [, b]) => b.at - a.at).slice(0, MAX_KEYS))
}
