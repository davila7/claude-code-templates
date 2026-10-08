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
  // startedAt of the request whose cache already had its one try, whatever came of it (a /compact
  // handed off, a veto); 0 or absent for none. It stops a second try and is never read as success.
  triedFor?: number
  // a main-loop request, or a turn between its requests, has started and not finished: it is about to
  // refresh the cache being counted
  requestRunning?: boolean
  // a compaction of the conversation started elsewhere (/compact, another plugin) is under way
  compacting?: boolean
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
  if (i.requestRunning) return { go: false, why: 'a request is running' }
  if (i.compacting) return { go: false, why: 'a compaction is running' }
  if (!i.last) return { go: false, why: 'no request yet' }
  if (i.firedFor === i.last.startedAt) return { go: false, why: 'already compacted for this cache' }
  if (i.triedFor === i.last.startedAt) return { go: false, why: 'already tried for this cache' }
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

// where the session runs, as last checked: allowed, on the skip list, or not established
export type Folder = 'on' | 'skip' | 'unknown'

// minutes while there are minutes, so the line changes once a minute until the last one
export function fmtWait(ms: number): string {
  return ms >= 60_000 ? `${Math.ceil(ms / 60_000)}m` : `${Math.ceil(ms / 1000)}s`
}

// The status line: what the mod will do and, when it will not, why. It covers every reason
// shouldCompact has, in its order, with two shown first: a failure for the current cache (`failed`),
// then the mod's own compact running (`busy`, set only once the folder check passed). A cache it
// already tried is shown as tried, never as compacted: in the desktop app the mod hands /compact off
// and does not learn how it ended. A running turn or compaction only matters once it is due, so it is
// said there. `unresolved` names a skip folder that cannot be found, which turns the mod off.
export function statusLine(
  i: Omit<Inputs, 'skipped'> & { folder: Folder; refused?: string; failed?: string; unresolved?: string },
): string {
  if (i.folder === 'skip') return 'Auto-compact off in this folder'
  if (i.folder === 'unknown') return i.unresolved !== undefined ? `Auto-compact off: can't find skip folder ${i.unresolved.slice(0, 80)}` : "Auto-compact off: can't confirm the folder"
  if (i.disabled) return 'Auto-compact off: caching is off'
  if (i.failed !== undefined) {
    const why = i.failed.slice(0, 80)
    const lapsed = i.last !== undefined && remainingMs(i.last, i.ttl, i.now) <= 0
    return lapsed ? `Auto-compact missed: the cache ran out (failed: ${why})` : `Auto-compact failed (${why}). Run /compact yourself`
  }
  if (i.busy) return 'Auto-compacting now'
  // the mod's own compact clears the recorded request, so firedFor is what remembers it ran
  if (!i.last) return i.firedFor ? 'Auto-compacted, waiting for the next reply' : 'Auto-compact waiting for a reply'
  if (i.firedFor === i.last.startedAt) return 'Auto-compacted, waiting for the next reply'
  if (i.triedFor === i.last.startedAt) return 'Auto-compact ran /compact for this cache'
  const tokens = promptTokens(i.last)
  if (tokens < i.minTokens) return `Auto-compact waits for ${fmtTokens(i.minTokens)} (chat is ${fmtTokens(tokens)})`
  const leftMs = remainingMs(i.last, i.ttl, i.now)
  const why = i.refused ? ` (refused: ${i.refused.slice(0, 80)})` : ''
  if (leftMs <= 0) return `Auto-compact missed: the cache ran out${why}`
  const until = leftMs - windowFor(i.ttl, i.windowMs)
  if (until <= 0) {
    if (i.compacting) return 'Auto-compact due, waiting for the compaction under way'
    if (i.requestRunning) return 'Auto-compact due, waiting for the turn to end (a reply, a tool, or your answer)'
    return i.refused ? `Auto-compact retrying${why}` : 'Auto-compact due now'
  }
  return `Auto-compact armed: fires in ${fmtWait(until)}`
}

// "C:\\Users\\X\\", "c:/users/./x", "\\\\?\\C:\\Users\\X" and "c://users/x" name the same folder on Windows.
// Spelling only: a junction or symlink is resolved by the caller ($.fs.stat realPath) before this runs.
// Every path is folded to lower case. Windows and macOS (APFS by default) compare names without case,
// and a link's realPath can keep the alias's spelling, so a case-kept comparison would let a session
// in /Users/me/Finance through a skip folder written /users/me/finance. On Linux it skips Finance with
// finance: one folder too many, never one too few. A rooted path keeps its leading slash, so "/" stays the root rather than vanishing. A backslash is a separator
// only in a Windows spelling (a drive, or a leading "\\"): on Linux "/work/a\b" names one folder, not two.
export function normalizePath(p: string): string {
  const parts: string[] = []
  // no trim: a trailing space is part of a Linux folder name; splitPaths trims the option itself
  const raw = p
  const windows = /^[a-z]:/i.test(raw) || raw.startsWith('\\\\')
  let flat = windows ? raw.replace(/\\/g, '/') : raw
  // the extended-length prefix: \\?\C:\x is C:\x, and \\?\UNC\server\share is \\server\share
  if (/^\/\/\?\/unc\//i.test(flat)) flat = `//${flat.slice(8)}`
  else if (flat.startsWith('//?/')) flat = flat.slice(4)
  const unc = flat.startsWith('//')
  const rooted = flat.startsWith('/')
  for (const part of flat.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }
  const body = parts.join('/').toLowerCase()
  if (unc) return `//${body}`
  return rooted ? `/${body}` : body
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

// The folders as the person wrote them, for the file system: a lookup must see "/home/me/finance",
// never a normalized spelling that it would resolve against the working directory.
export function splitPaths(option: unknown): string[] {
  if (typeof option !== 'string') return []
  return option
    .split(',')
    .map(p => p.trim())
    .filter(Boolean)
}

// the same folders, spelled for comparison only
export function parsePaths(option: unknown): string[] {
  return splitPaths(option).map(normalizePath).filter(Boolean)
}

// The folder itself or anything below it, never a sibling that only shares a prefix (private2).
// Every spelling the caller has for where the session runs (as given, as resolved) is checked;
// one inside a skipped folder is enough. No spelling at all means the folder is unknown: skipped.
export function isSkippedPath(cwds: readonly (string | undefined)[], skip: readonly string[]): boolean {
  const known = cwds.filter((c): c is string => typeof c === 'string' && c.trim() !== '')
  if (known.length === 0) return true
  return known.some(c => {
    const here = normalizePath(c)
    // the root "/" holds every absolute folder: rooted, on any drive (D:\ is not below C:\), or on a share
    const absolute = here.startsWith('/') || /^[a-z]:/.test(here)
    return skip.some(s => (s === '/' ? absolute : here === s || here.startsWith(`${s}/`)))
  })
}
