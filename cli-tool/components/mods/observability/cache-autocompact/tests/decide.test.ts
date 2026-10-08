import { describe, expect, test } from 'claude-code/testing'
import { fallbackDeadline, fmtWait, isHeadlessRefusal, isSkippedPath, nextTtl, normalizePath, parsePaths, shouldCompact, splitPaths, statusLine } from '../hooks/decide.ts'
import type { Inputs } from '../hooks/decide.ts'
import type { Sample } from '../hooks/cache.ts'

const T0 = 1_000_000_000_000
const HOUR = 3_600_000

const sample = (over: Partial<Sample> = {}): Sample => ({
  turnId: 't1',
  index: 0,
  model: 'claude-opus-5-5',
  startedAt: T0,
  read: 140_000,
  write: 2_000,
  fresh: 500,
  output: 300,
  ...over,
})

const inputs = (over: Partial<Inputs> = {}): Inputs => ({
  last: sample(),
  ttl: '1h',
  now: T0 + HOUR - 90_000, // 1:30 left on a 1-hour cache
  minTokens: 100_000,
  windowMs: 120_000,
  firedFor: 0,
  busy: false,
  skipped: false,
  disabled: false,
  ...over,
})

describe('fires', () => {
  test('big chat, 1:30 left on a 1-hour cache', () => {
    const v = shouldCompact(inputs())
    expect(v.go).toBe(true)
    if (v.go) {
      expect(v.leftMs).toBe(90_000)
      expect(v.tokens).toBe(142_500)
    }
  })

  test('exactly at the window edge', () => {
    expect(shouldCompact(inputs({ now: T0 + HOUR - 120_000 })).go).toBe(true)
  })

  test('one second before the cache lapses', () => {
    expect(shouldCompact(inputs({ now: T0 + HOUR - 1_000 })).go).toBe(true)
  })

  test('a 5-minute cache, inside its window', () => {
    expect(shouldCompact(inputs({ ttl: '5m', now: T0 + 300_000 - 60_000 })).go).toBe(true)
  })

  test('exactly at minTokens', () => {
    expect(shouldCompact(inputs({ last: sample({ read: 99_500, write: 0, fresh: 500 }) })).go).toBe(true)
  })
})

describe('holds', () => {
  const why = (over: Partial<Inputs>) => {
    const v = shouldCompact(inputs(over))
    return v.go ? 'went' : v.why
  }

  test('cache still has plenty of time', () => {
    expect(why({ now: T0 + 10 * 60_000 })).toBe('cache still has time')
  })

  test('one millisecond outside the window', () => {
    expect(why({ now: T0 + HOUR - 120_001 })).toBe('cache still has time')
  })

  test('cache already lapsed: compacting now pays the full reread', () => {
    expect(why({ now: T0 + HOUR })).toBe('cache already lapsed')
    expect(why({ now: T0 + 2 * HOUR })).toBe('cache already lapsed')
  })

  test('small chat', () => {
    expect(why({ last: sample({ read: 40_000 }) })).toBe('chat is small')
  })

  test('one token under minTokens', () => {
    expect(why({ last: sample({ read: 99_499, write: 0, fresh: 500 }) })).toBe('chat is small')
  })

  test('no request yet', () => {
    expect(why({ last: undefined })).toBe('no request yet')
  })

  test('already compacted for this cache: never twice', () => {
    expect(why({ firedFor: T0 })).toBe('already compacted for this cache')
  })

  test('a newer request after a compact is a new cache and may fire', () => {
    const later = T0 + 30 * 60_000
    expect(shouldCompact(inputs({ firedFor: T0, last: sample({ startedAt: later }), now: later + HOUR - 60_000 })).go).toBe(true)
  })

  test('one try already made for this cache, whatever came of it: never a second', () => {
    expect(why({ triedFor: T0 })).toBe('already tried for this cache')
    const later = T0 + 30 * 60_000
    expect(shouldCompact(inputs({ triedFor: T0, last: sample({ startedAt: later }), now: later + HOUR - 60_000 })).go).toBe(true)
  })

  test('a compact already running', () => {
    expect(why({ busy: true })).toBe('a compact is already running')
  })

  test('skip-listed folder, even at the perfect moment', () => {
    expect(why({ skipped: true })).toBe('folder is on the skip list')
  })

  test('caching switched off', () => {
    expect(why({ disabled: true })).toBe('prompt caching is off')
  })

  test('a request that touched no cache has nothing to count down', () => {
    expect(why({ last: sample({ read: 0, write: 0, fresh: 150_000 }) })).toBe('cache already lapsed')
  })

  test('a 5-minute cache read as 1 hour would fire late, never early', () => {
    // 4 minutes in: inside a 5m window, nowhere near a 1h one
    expect(why({ ttl: '1h', now: T0 + 240_000 })).toBe('cache still has time')
  })
})

describe('skip list', () => {
  const priv = parsePaths('C:/Users/me/work/Private')

  test('the folder itself', () => {
    expect(isSkippedPath(['C:\\Users\\me\\work\\Private'], priv)).toBe(true)
  })

  test('a folder below it, any slash or case', () => {
    expect(isSkippedPath(['c:\\users\\me\\work\\private\\reports'], priv)).toBe(true)
    expect(isSkippedPath(['C:/Users/me/work/Private/'], priv)).toBe(true)
  })

  test('a sibling that only shares the prefix', () => {
    expect(isSkippedPath(['C:/Users/me/work/Private2'], priv)).toBe(false)
    expect(isSkippedPath(['C:/Users/me/work/PrivateOld/x'], priv)).toBe(false)
  })

  test('another lane and the root', () => {
    expect(isSkippedPath(['C:/Users/me/work/App'], priv)).toBe(false)
    expect(isSkippedPath(['C:/Users/me/work'], priv)).toBe(false)
  })

  test('no cwd known counts as skipped: an unknown folder is never permission to compact', () => {
    expect(isSkippedPath([undefined], priv)).toBe(true)
    expect(isSkippedPath([], priv)).toBe(true)
    expect(isSkippedPath([''], priv)).toBe(true)
  })

  test('any one spelling inside the skip folder is enough (a junction resolving into Private)', () => {
    expect(isSkippedPath(['C:/Links/Ledger', 'C:/Users/me/work/Private/ledger'], priv)).toBe(true)
    expect(isSkippedPath(['C:/Links/Ledger', 'C:/Elsewhere/ledger'], priv)).toBe(false)
  })

  test('dot segments, doubled slashes and the extended-length prefix', () => {
    const odd = parsePaths('C:/Users/me/work/./Private')
    expect(isSkippedPath(['C:/Users/me/work/Private'], odd)).toBe(true)
    expect(isSkippedPath(['C://Users//me/work/Private/x'], priv)).toBe(true)
    expect(isSkippedPath(['\\\\?\\C:\\Users\\me\\work\\Private'], priv)).toBe(true)
    expect(isSkippedPath(['C:/Users/me/work/App/../Private'], priv)).toBe(true)
  })

  test('several folders, blanks and trailing separators', () => {
    const list = parsePaths(' C:/a/Private , ,C:\\b\\App\\ ')
    expect(list).toEqual(['c:/a/private', 'c:/b/app'])
    expect(isSkippedPath(['C:/b/App/x'], list)).toBe(true)
  })

  test('a missing or wrong-typed option skips nothing', () => {
    expect(parsePaths(undefined)).toEqual([])
    expect(parsePaths(42)).toEqual([])
    expect(isSkippedPath(['C:/Users/me/work/Private'], [])).toBe(false)
  })

  test('normalizePath', () => {
    expect(normalizePath('C:\\X\\Y\\\\')).toBe('c:/x/y')
  })
})

describe('skip list on Linux and macOS', () => {
  test('a rooted path keeps its leading slash, so a lookup never reads it as relative', () => {
    expect(normalizePath('/home/me/finance')).toBe('/home/me/finance')
    expect(normalizePath('/home/me/finance/')).toBe('/home/me/finance')
    expect(normalizePath('/home//me/./x/../finance')).toBe('/home/me/finance')
    expect(parsePaths('/home/me/finance')).toEqual(['/home/me/finance'])
  })

  test('the option as written is what the file system sees: slash and case kept', () => {
    expect(splitPaths(' /home/me/Finance , , C:/Users/Me/Private ')).toEqual(['/home/me/Finance', 'C:/Users/Me/Private'])
    expect(splitPaths(undefined)).toEqual([])
  })

  test('case counts outside Windows: Finance and finance are two folders', () => {
    const fin = parsePaths('/home/me/finance')
    expect(isSkippedPath(['/home/me/finance/2026'], fin)).toBe(true)
    expect(isSkippedPath(['/home/me/Finance'], fin)).toBe(false)
    expect(isSkippedPath(['/home/me/finance'], parsePaths('/home/me/Finance'))).toBe(false)
    expect(normalizePath('/home/Me/X')).toBe('/home/Me/X')
  })

  test('a drive path and a UNC share still fold case, as Windows compares them', () => {
    expect(normalizePath('C:/Users/Me')).toBe('c:/users/me')
    expect(normalizePath('\\\\Server\\Share\\Dir')).toBe('//server/share/dir')
    expect(normalizePath('\\\\?\\UNC\\Server\\Share')).toBe('//server/share')
    expect(isSkippedPath(['//SERVER/share/dir/x'], parsePaths('\\\\server\\Share\\Dir'))).toBe(true)
  })

  test('the root "/" skips every rooted folder, and is not dropped', () => {
    const root = parsePaths('/')
    expect(root).toEqual(['/'])
    expect(isSkippedPath(['/'], root)).toBe(true)
    expect(isSkippedPath(['/home/me/anything'], root)).toBe(true)
    expect(isSkippedPath(['relative/dir'], root)).toBe(false)
  })

  test('a rooted path and a relative one with the same words are different folders', () => {
    expect(isSkippedPath(['home/me/finance'], parsePaths('/home/me/finance'))).toBe(false)
  })
})

describe('cache lifetime tracking', () => {
  const MIN = 60_000
  // a hit 10 minutes after the request before it: proof of the 1-hour lifetime
  const proveHour = () => {
    const a = sample({ startedAt: T0 })
    const b = sample({ startedAt: T0 + 10 * MIN, read: 140_000, write: 1_000 })
    const first = nextTtl(undefined, '5m', undefined, a)
    return { b, after: nextTtl(first.track, '5m', a, b) }
  }

  test('a hit after more than 5 minutes proves 1 hour', () => {
    expect(proveHour().after.ttl).toBe('1h')
  })

  test('the proof holds while policy and model stay the same', () => {
    const { b, after } = proveHour()
    const c = sample({ startedAt: T0 + 11 * MIN })
    expect(nextTtl(after.track, '5m', b, c).ttl).toBe('1h')
  })

  test('running out of plan usage (policy 1h to 5m) drops the old proof', () => {
    const sub = nextTtl(undefined, '1h', undefined, sample())
    const b = sample({ startedAt: T0 + 10 * MIN })
    const proved = nextTtl(sub.track, '1h', sample(), b)
    const c = sample({ startedAt: T0 + 11 * MIN })
    expect(nextTtl(proved.track, '5m', b, c).ttl).toBe('5m')
  })

  test('a model switch drops the old proof', () => {
    const { b, after } = proveHour()
    const c = sample({ startedAt: T0 + 11 * MIN, model: 'claude-sonnet-5-5' })
    expect(nextTtl(after.track, '5m', b, c).ttl).toBe('5m')
  })

  test('with no evidence the policy decides', () => {
    expect(nextTtl(undefined, '1h', undefined, sample()).ttl).toBe('1h')
    expect(nextTtl(undefined, '5m', undefined, sample()).ttl).toBe('5m')
  })
})

describe('status line', () => {
  const line = (over: Partial<Inputs> = {}, folder: 'on' | 'skip' | 'unknown' = 'on') => {
    const { skipped: _, ...rest } = inputs(over)
    return statusLine({ ...rest, folder })
  }
  test('armed shows minutes until it fires', () => {
    // 58 minutes left on the cache, fires at 2: 56 minutes to go
    expect(line({ now: T0 + 2 * 60_000 })).toBe('Auto-compact armed: fires in 56m')
  })
  test('under a minute to go shows seconds', () => {
    expect(line({ now: T0 + HOUR - 150_000 })).toBe('Auto-compact armed: fires in 30s')
  })
  test('inside the window it is due', () => {
    expect(line()).toBe('Auto-compact due now')
  })
  test('a lapsed cache says it was missed', () => {
    expect(line({ now: T0 + HOUR + 1 })).toBe('Auto-compact missed: the cache ran out')
  })
  test('the skip list and an unconfirmed folder each say off, even with a big chat due now', () => {
    expect(line({}, 'skip')).toBe('Auto-compact off in this folder')
    expect(line({}, 'unknown')).toBe("Auto-compact off: can't confirm the folder")
  })
  test('a small chat names both sizes', () => {
    expect(line({ last: sample({ read: 40_000, write: 0, fresh: 0 }) })).toBe('Auto-compact waits for 100k (chat is 40k)')
  })
  test('no reply yet, already compacted, running, caching off', () => {
    expect(line({ last: undefined })).toBe('Auto-compact waiting for a reply')
    expect(line({ last: undefined, firedFor: T0 })).toBe('Auto-compacted, waiting for the next reply')
    expect(line({ firedFor: T0 })).toBe('Auto-compacted, waiting for the next reply')
    expect(line({ busy: true })).toBe('Auto-compacting now')
    expect(line({ disabled: true })).toBe('Auto-compact off: caching is off')
  })
  test('a handed-off /compact is shown as waiting, never as done', () => {
    const { skipped: _, ...rest } = inputs()
    expect(statusLine({ ...rest, folder: 'on', pending: true })).toBe('Auto-compact ran /compact, waiting for it to finish')
  })
  test('a failed try says so and says what to do, even when the guard holds', () => {
    const { skipped: _, ...rest } = inputs({ triedFor: T0 })
    expect(statusLine({ ...rest, folder: 'on', failed: 'no compaction happened' })).toBe('Auto-compact failed (no compaction happened). Run /compact yourself')
    expect(statusLine({ ...rest, now: T0 + HOUR + 1, folder: 'on', failed: 'vetoed: busy' })).toBe('Auto-compact missed: the cache ran out (failed: vetoed: busy)')
  })
  test('fmtWait rounds up, so it never says 0', () => {
    expect(fmtWait(60_000)).toBe('1m')
    expect(fmtWait(60_001)).toBe('2m')
    expect(fmtWait(59_999)).toBe('60s')
    expect(fmtWait(1)).toBe('1s')
  })
})

describe('headless refusal', () => {
  // the engine's words, copied from a live run in the Claude desktop app
  const LIVE =
    'cache-autocompact: $.session.compact: not available in a headless (-p / SDK) session yet: compaction here runs inside a turn (a /compact prompt); catch it and carry on'
  test("the desktop app's refusal is recognized, as an Error or as text", () => {
    expect(isHeadlessRefusal(new Error(LIVE))).toBe(true)
    expect(isHeadlessRefusal(LIVE)).toBe(true)
  })
  test('a turn still running, or anything else, is not', () => {
    expect(isHeadlessRefusal(new Error('a turn is running'))).toBe(false)
    expect(isHeadlessRefusal(new Error('headless'))).toBe(false)
    expect(isHeadlessRefusal(undefined)).toBe(false)
  })
})

describe('the window on a 5-minute cache', () => {
  test('a 5-minute window on a 5-minute cache waits until minute 3, never right after the reply', () => {
    const v = (now: number) => shouldCompact(inputs({ ttl: '5m', windowMs: 300_000, now }))
    expect(v(T0 + 60_000).go).toBe(false)
    expect(v(T0 + 179_000).go).toBe(false)
    expect(v(T0 + 180_000).go).toBe(true)
  })
  test('a 1-hour cache keeps the full 5 minutes', () => {
    expect(shouldCompact(inputs({ windowMs: 300_000, now: T0 + HOUR - 300_000 })).go).toBe(true)
    expect(shouldCompact(inputs({ windowMs: 300_000, now: T0 + HOUR - 300_001 })).go).toBe(false)
  })
})

describe('when a handed-off /compact counts as failed', () => {
  test('5 minutes left: judged after 90 seconds, leaving 3:30 to do it by hand', () => {
    expect(fallbackDeadline(T0, 300_000)).toBe(T0 + 90_000)
  })
  test('a shorter window waits half of it, never past the lapse', () => {
    expect(fallbackDeadline(T0, 120_000)).toBe(T0 + 60_000)
    expect(fallbackDeadline(T0, 30_000)).toBe(T0 + 15_000)
  })
})
