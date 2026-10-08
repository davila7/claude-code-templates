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
  // startedAt of the request whose cache already had its one attempt, whatever came of it (a /compact
  // handed off, a veto); 0 or absent for none. It stops a second try and is never read as success.
  triedFor?: number
  // a /compact the mod handed off has not been settled by a compaction: it may still be queued, so no
  // second one is handed off for any request until it is, or the conversation is left
  handoffOpen?: boolean
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
  if (i.handoffOpen) return { go: false, why: 'a /compact it ran is still open' }
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

// When a /compact that returned counts as failed if no compaction has turned up: 90 seconds after
// it returned (a live compaction took 49), or half the time the cache had left then, whichever is
// sooner, so most of the window is left to run it by hand.
export function fallbackDeadline(at: number, leftMs: number): number {
  return at + Math.min(90_000, leftMs / 2)
}

// A /compact the mod handed off: when, when the cache it was for runs out, and what command.run did
// with it. `pending` until command.run settles (it queues the command until the session is idle, so it
// may be waiting or running); `returned` once it resolved; `rejected` when it threw or a hook vetoed
// the compaction it started.
export type Handoff = { at: number; lapse: number; command: 'pending' | 'returned' | 'rejected'; returnedAt?: number; why?: string }

export type HandoffState = { state: 'queued' } | { state: 'waiting' } | { state: 'failed'; why: string }

// Whether a handed-off /compact has failed. A command still queued or running is never called failed by
// a deadline: only a rejection, a cache that ran out, or one that returned and still no compaction
// turned up within fallbackDeadline of its return.
export function handoffState(h: Handoff, now: number): HandoffState {
  if (h.command === 'rejected') return { state: 'failed', why: h.why ?? 'the /compact command failed' }
  if (now >= h.lapse) return { state: 'failed', why: 'the cache ran out before a compaction turned up' }
  if (h.command === 'pending') return { state: 'queued' }
  const back = h.returnedAt ?? h.at
  return now >= fallbackDeadline(back, h.lapse - back) ? { state: 'failed', why: 'no compaction happened' } : { state: 'waiting' }
}

// What the status line says about an open handoff, whichever reply came after it. A failed one is
// "paused": it still holds off a second /compact until a compaction closes it. The failure itself is
// shown, with its reason, for the request it was for.
export function handoffStatus(h: Handoff | undefined, now: number): 'queued' | 'waiting' | 'paused' | undefined {
  if (!h) return undefined
  const s = handoffState(h, now).state
  return s === 'failed' ? 'paused' : s
}

// where the session runs, as last checked: allowed, on the skip list, or not established
export type Folder = 'on' | 'skip' | 'unknown'

// minutes while there are minutes, so the line changes once a minute until the last one
export function fmtWait(ms: number): string {
  return ms >= 60_000 ? `${Math.ceil(ms / 60_000)}m` : `${Math.ceil(ms / 1000)}s`
}

// The status line: what the mod will do and, when it will not, why. It covers every reason
// shouldCompact has, in its order, with three shown first: a failure for the current cache (`failed`),
// then an open handoff (`handoff`), then the mod's own compact running (`busy`), so an attempt is never
// shown as a compact that happened. A running reply or compaction only matters once it is due, so it is
// said there. `unresolved` names a skip folder that cannot be found, which turns the mod off.
export function statusLine(
  i: Omit<Inputs, 'skipped'> & { folder: Folder; refused?: string; failed?: string; handoff?: 'queued' | 'waiting' | 'paused'; unresolved?: string },
): string {
  if (i.folder === 'skip') return 'Auto-compact off in this folder'
  if (i.folder === 'unknown') return i.unresolved !== undefined ? `Auto-compact off: can't find skip folder ${i.unresolved.slice(0, 80)}` : "Auto-compact off: can't confirm the folder"
  if (i.disabled) return 'Auto-compact off: caching is off'
  if (i.failed !== undefined) {
    const why = i.failed.slice(0, 80)
    const lapsed = i.last !== undefined && remainingMs(i.last, i.ttl, i.now) <= 0
    return lapsed ? `Auto-compact missed: the cache ran out (failed: ${why})` : `Auto-compact failed (${why}). Run /compact yourself`
  }
  if (i.handoff === 'queued') return 'Auto-compact ran /compact: still queued or running'
  if (i.handoff === 'waiting') return 'Auto-compact ran /compact, waiting for it to finish'
  if (i.handoff === 'paused') return 'Auto-compact paused: the /compact it ran never finished. Run /compact yourself'
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
  if (until <= 0) {
    if (i.compacting) return 'Auto-compact due, waiting for the compaction under way'
    if (i.requestRunning) return 'Auto-compact due, waiting for the reply to finish'
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
