import type { PluginOptions } from 'claude-code'
import type { AlertKind, Settings } from '../types'
import { clean } from './clean'

// These defaults must match the ones in .claude-plugin/plugin.json.
const DEFAULTS: Settings = {
  activeMs: 1_800_000, tokenLimit: 1_000_000, repeatCount: 5, failStreak: 5,
  burstCount: 10, burstWindowMs: 120_000,
  notify: true, openPaneOnWarning: false, redact: true, muted: new Set(), price: null,
}

// A number counts only when it is finite and above 0; anything else falls back to the default.
const positive = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined

// A scaled result that is not finite or not above 0 falls back too. The person types minutes or millions; reinwatch works in milliseconds and tokens.
const scaled = (v: unknown, unit: number, fallback: number): number => {
  const n = positive(v)
  if (n === undefined) return fallback
  // A value too small (rounds to 0) or too large (not finite) once scaled counts as unset.
  const result = Math.round(n * unit)
  return Number.isFinite(result) && result > 0 ? result : fallback
}

// Counts are whole numbers and at least 2.
const count = (v: unknown, fallback: number): number => {
  const n = positive(v)
  return n === undefined ? fallback : Math.max(2, Math.floor(n))
}

const flag = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback)

const KINDS: readonly AlertKind[] = ['long', 'tokens', 'repeat', 'failures', 'burst', 'run']

// A comma-separated list of warning kinds; case and spaces do not matter, and a word that is no kind is ignored.
const kinds = (v: unknown): ReadonlySet<AlertKind> => {
  if (typeof v !== 'string') return new Set()
  const words = v.split(',').map(w => w.trim().toLowerCase())
  return new Set(KINDS.filter(k => words.includes(k)))
}

// Prices per million tokens count only when both are numbers above 0; the currency is any non-empty text, else $.
const priceOf = (raw: PluginOptions): Settings['price'] => {
  const input = positive(raw.priceInput)
  const output = positive(raw.priceOutput)
  if (input === undefined || output === undefined) return null
  const cleaned = typeof raw.currency === 'string' ? clean(raw.currency) : ''
  const currency = cleaned !== '' ? cleaned : '$'
  return { input, output, currency }
}

export function readSettings(raw: PluginOptions): Settings {
  return {
    activeMs: scaled(raw.activeMinutes, 60_000, DEFAULTS.activeMs),
    tokenLimit: scaled(raw.tokenMillions, 1_000_000, DEFAULTS.tokenLimit),
    repeatCount: count(raw.repeatCount, DEFAULTS.repeatCount),
    failStreak: count(raw.failStreak, DEFAULTS.failStreak),
    burstCount: count(raw.burstCount, DEFAULTS.burstCount),
    burstWindowMs: scaled(raw.burstMinutes, 60_000, DEFAULTS.burstWindowMs),
    notify: flag(raw.notify, DEFAULTS.notify),
    openPaneOnWarning: flag(raw.openPaneOnWarning, DEFAULTS.openPaneOnWarning),
    redact: flag(raw.redact, DEFAULTS.redact),
    muted: kinds(raw.mute),
    price: priceOf(raw),
  }
}
