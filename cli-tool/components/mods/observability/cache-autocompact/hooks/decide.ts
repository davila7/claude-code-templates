/**
 * decide.ts — the pure half of cache-autocompact: no `$`, no engine.
 *
 * One question, answered from plain values so it can be tested to the edge:
 * should the chat be compacted right now, before its prompt cache lapses?
 */
import { fmtTokens, observeTtl, promptTokens, remainingMs } from './cache.ts'
import type { Sample, Ttl } from './cache.ts'

export type Verdict = { go: true; leftMs: number; tokens: number } | { go: false; why: string }

export type Inputs = {
  last: Sample | undefined
  ttl: Ttl
  now: number
  minTokens: number
  windowMs: number
  // startedAt of the request whose cache was already compacted for; 0 for none
  firedFor: number
  // a compact this mod started is still running
  busy: boolean
  // the session runs in a folder the person asked to leave alone
  skipped: boolean
  // caching is switched off for the model, so there is nothing to save
  disabled: boolean
}

// A 5-minute cache gets at most 2 minutes, so it fires at minute 3. A window as long as the cache
// would fire straight after every reply.
export const FIVE_MINUTE_CAP = 120_000
export function windowFor(ttl: Ttl, windowMs: number): number {
  return ttl === '5m' ? Math.min(windowMs, FIVE_MINUTE_CAP) : windowMs
}

export function shouldCompact(i: Inputs): Verdict {
  if (i.skipped) return { go: false, why: 'folder is on the skip list' }
  if (i.disabled) return { go: false, why: 'prompt caching is off' }
  if (i.busy) return { go: false, why: 'a compact is already running' }
  if (!i.last) return { go: false, why: 'no request yet' }
  if (i.firedFor === i.last.startedAt) return { go: false, why: 'already compacted for this cache' }
  const tokens = promptTokens(i.last)
  if (tokens < i.minTokens) return { go: false, why: 'chat is small' }
  const leftMs = remainingMs(i.last, i.ttl, i.now)
  // lapsed already: compacting now pays the full reread it was meant to avoid
  if (leftMs <= 0) return { go: false, why: 'cache already lapsed' }
  if (leftMs > windowFor(i.ttl, i.windowMs)) return { go: false, why: 'cache still has time' }
  return { go: true, leftMs, tokens }
}

// The refusal a headless session (the desktop app, the SDK, -p) gives a plugin's own compact, the only
// refusal /compact can stand in for. A turn still running is another refusal, and waits for the next tick.
export function isHeadlessRefusal(err: unknown): boolean {
  return (err instanceof Error ? err.message : String(err)).includes('not available in a headless')
}

// When a /compact the mod handed off counts as failed if no compaction has turned up: 90 seconds
// after it fired (a live compaction took 49), so most of the window is left to run it by hand:
// the window is the person's time to react. A shorter window
// waits half of it.
export function fallbackDeadline(at: number, leftMs: number): number {
  return at + Math.min(90_000, leftMs / 2)
}

// where the session runs, as last checked: allowed, on the skip list, or not established
export type Folder = 'on' | 'skip' | 'unknown'

// minutes while there are minutes, so the line changes once a minute until the last one
export function fmtWait(ms: number): string {
  return ms >= 60_000 ? `${Math.ceil(ms / 60_000)}m` : `${Math.ceil(ms / 1000)}s`
}

// The status line: what the mod will do and, when it will not, why. Same order of checks as shouldCompact.
export function statusLine(i: Omit<Inputs, 'skipped'> & { folder: Folder; refused?: string }): string {
  if (i.folder === 'skip') return 'Auto-compact off in this folder'
  if (i.folder === 'unknown') return "Auto-compact off: can't confirm the folder"
  if (i.disabled) return 'Auto-compact off: caching is off'
  if (i.busy) return 'Auto-compacting now'
  // the mod's own compact clears the recorded request, so firedFor is what remembers it ran
  if (!i.last) return i.firedFor ? 'Auto-compacted, waiting for the next reply' : 'Auto-compact waiting for a reply'
  if (i.firedFor === i.last.startedAt) return 'Auto-compacted, waiting for the next reply'
  const tokens = promptTokens(i.last)
  if (tokens < i.minTokens) return `Auto-compact waits for ${fmtTokens(i.minTokens)} (chat is ${fmtTokens(tokens)})`
  const leftMs = remainingMs(i.last, i.ttl, i.now)
  const why = i.refused ? ` (refused: ${i.refused.slice(0, 80)})` : ''
  if (leftMs <= 0) return `Auto-compact missed: the cache ran out${why}`
  const until = leftMs - windowFor(i.ttl, i.windowMs)
  if (until <= 0) return i.refused ? `Auto-compact retrying${why}` : 'Auto-compact due now'
  return `Auto-compact armed: fires in ${fmtWait(until)}`
}

// "C:\\Users\\X\\", "c:/users/./x", "\\\\?\\C:\\Users\\X" and "c://users/x" name the same folder on Windows.
// Spelling only: a junction or symlink is resolved by the caller ($.fs.stat realPath) before this runs.
export function normalizePath(p: string): string {
  const parts: string[] = []
  const flat = p.trim().replace(/\\/g, '/').replace(/^\/\/\?\//, '')
  for (const part of flat.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }
  return parts.join('/').toLowerCase()
}

export type TtlTrack = { observed: Ttl | undefined; under: Ttl; model: string }

// What the traffic proved about the lifetime only holds under the policy and model it was seen with:
// a subscription that runs out of plan usage, or a model switch, starts the evidence over,
// so an old 1-hour hit never stretches a newer 5-minute cache.
export function nextTtl(track: TtlTrack | undefined, base: Ttl, prev: Sample | undefined, cur: Sample): { track: TtlTrack; ttl: Ttl } {
  const same = track !== undefined && track.under === base && track.model === cur.model
  const observed = observeTtl(same ? prev : undefined, cur, same ? track.observed : undefined)
  return { track: { observed, under: base, model: cur.model }, ttl: observed ?? base }
}

export function parsePaths(option: unknown): string[] {
  if (typeof option !== 'string') return []
  return option.split(',').map(normalizePath).filter(Boolean)
}

// The folder itself or anything below it, never a sibling that only shares a prefix (private2).
// Every spelling the caller has for where the session runs (as given, as resolved) is checked;
// one inside a skipped folder is enough. No spelling at all means the folder is unknown: skipped.
export function isSkippedPath(cwds: readonly (string | undefined)[], skip: readonly string[]): boolean {
  const known = cwds.filter((c): c is string => typeof c === 'string' && c.trim() !== '')
  if (known.length === 0) return true
  return known.some(c => {
    const here = normalizePath(c)
    return skip.some(s => here === s || here.startsWith(`${s}/`))
  })
}
