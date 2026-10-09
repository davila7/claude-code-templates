import { describe, expect, test } from 'claude-code/testing'
import { fmtWait, handsOff, isEngineOn, isHeadlessRefusal, isSwitchedOffRefusal, isSkippedPath, nextTtl, normalizePath, shouldCompact, splitPaths, statusLine, toRoots, windowFor } from '../hooks/decide.ts'
import type { Inputs } from '../hooks/decide.ts'
import type { Sample } from '../hooks/cache.ts'

// the skip roots for an option, built the way the mod builds them (toRoots); an entry that names no
// folder fails the test rather than being dropped
const roots = (option: unknown): string[] => {
  const r = toRoots(splitPaths(option))
  if (!r) throw new Error(`an entry in ${String(option)} names no folder`)
  return r
}

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
  const priv = roots('C:/Users/me/work/Private')

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
    const odd = roots('C:/Users/me/work/./Private')
    expect(isSkippedPath(['C:/Users/me/work/Private'], odd)).toBe(true)
    expect(isSkippedPath(['C://Users//me/work/Private/x'], priv)).toBe(true)
    expect(isSkippedPath(['\\\\?\\C:\\Users\\me\\work\\Private'], priv)).toBe(true)
    expect(isSkippedPath(['C:/Users/me/work/App/../Private'], priv)).toBe(true)
  })

  test('several folders, blanks and trailing separators', () => {
    const list = roots(' C:/a/Private , ,C:\\b\\App\\ ')
    expect(list).toEqual(['c:/a/private', 'c:/b/app'])
    expect(isSkippedPath(['C:/b/App/x'], list)).toBe(true)
  })

  test('a missing or wrong-typed option skips nothing', () => {
    expect(roots(undefined)).toEqual([])
    expect(roots(42)).toEqual([])
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
    expect(roots('/home/me/finance')).toEqual(['/home/me/finance'])
  })

  test('the option as written is what the file system sees: slash and case kept', () => {
    expect(splitPaths(' /home/me/Finance , , C:/Users/Me/Private ')).toEqual(['/home/me/Finance', 'C:/Users/Me/Private'])
    expect(splitPaths(undefined)).toEqual([])
  })

  test('case never separates folders: macOS matches Finance and finance, and Linux over-skips, the safe way', () => {
    const fin = roots('/home/me/finance')
    expect(isSkippedPath(['/home/me/finance/2026'], fin)).toBe(true)
    expect(isSkippedPath(['/home/me/Finance'], fin)).toBe(true)
    expect(isSkippedPath(['/Users/me/Finance/2026'], roots('/users/me/finance'))).toBe(true)
    expect(normalizePath('/home/Me/X')).toBe('/home/me/x')
  })

  test('a drive path and a UNC share still fold case, as Windows compares them', () => {
    expect(normalizePath('C:/Users/Me')).toBe('c:/users/me')
    expect(normalizePath('\\\\Server\\Share\\Dir')).toBe('//server/share/dir')
    expect(normalizePath('\\\\?\\UNC\\Server\\Share')).toBe('//server/share')
    expect(isSkippedPath(['//SERVER/share/dir/x'], roots('\\\\server\\Share\\Dir'))).toBe(true)
  })

  test('the root "/" skips every rooted folder, and is not dropped', () => {
    const root = roots('/')
    expect(root).toEqual(['/'])
    expect(isSkippedPath(['/'], root)).toBe(true)
    expect(isSkippedPath(['/home/me/anything'], root)).toBe(true)
    expect(isSkippedPath(['relative/dir'], root)).toBe(false)
  })

  test('a rooted path and a relative one with the same words are different folders', () => {
    expect(isSkippedPath(['home/me/finance'], roots('/home/me/finance'))).toBe(false)
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
  test('a cache it already ran /compact for says so, and claims nothing about the outcome', () => {
    const { skipped: _, ...rest } = inputs({ triedFor: T0 })
    expect(statusLine({ ...rest, folder: 'on' })).toBe('Auto-compact started /compact for this cache')
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

describe('review round 1', () => {
  const line = (over: Partial<Inputs>, extra: { failed?: string }) => {
    const { skipped: _, ...rest } = inputs(over)
    return statusLine({ ...rest, folder: 'on', ...extra })
  }

  test('a recorded failure wins over a compact call in flight', () => {
    expect(line({ busy: true }, { failed: 'prompt is too long' })).toBe('Auto-compact failed (prompt is too long). Run /compact yourself')
  })

  test('a backslash in a rooted Linux path is part of a name, not a separator', () => {
    expect(normalizePath('/work/a\\b')).toBe('/work/a\\b')
    expect(isSkippedPath(['/work/a/b'], roots('/work/a\\b'))).toBe(false)
    expect(isSkippedPath(['/work/a\\b/x'], roots('/work/a\\b'))).toBe(true)
    // Windows spellings still translate
    expect(normalizePath('C:\\work\\a')).toBe('c:/work/a')
    expect(normalizePath('\\\\server\\share')).toBe('//server/share')
  })

  test('the root "/" skips every absolute folder, on any drive or share', () => {
    const root = roots('/')
    expect(isSkippedPath(['D:\\work'], root)).toBe(true)
    expect(isSkippedPath(['c:'], root)).toBe(true)
    expect(isSkippedPath(['\\\\server\\share\\x'], root)).toBe(true)
    expect(isSkippedPath(['work/x'], root)).toBe(false)
  })
})

describe('review round 2', () => {
  test('a main request still running holds the compact: it is about to refresh the cache', () => {
    const v = shouldCompact(inputs({ requestRunning: true }))
    expect(v.go ? 'went' : v.why).toBe('a request is running')
  })
})

describe('review round 3', () => {
  test('a resolved path keeps a trailing space: it is part of a Linux folder name', () => {
    expect(normalizePath('/data/private ')).toBe('/data/private ')
    expect(isSkippedPath(['/data/private /child'], ['/data/private '].map(normalizePath))).toBe(true)
    expect(isSkippedPath(['/data/private/child'], ['/data/private '].map(normalizePath))).toBe(false)
    // the option's own blanks around commas are still trimmed, by splitPaths
    expect(roots(' /a , /b ')).toEqual(['/a', '/b'])
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

describe('review round 4', () => {
  const MIN = 60_000
  const line = (over: Partial<Inputs>, extra: Record<string, unknown> = {}) => {
    const { skipped: _, ...rest } = inputs(over)
    return statusLine({ ...rest, folder: 'on', ...extra })
  }

  test('a compaction already under way holds the mod', () => {
    const v = shouldCompact(inputs({ compacting: true }))
    expect(v.go ? 'went' : v.why).toBe('a compaction is running')
  })

  test('the status line says why a due compact waits, as shouldCompact does', () => {
    expect(line({ requestRunning: true })).toBe('Auto-compact due, waiting for the turn to end (a reply, a tool, or your answer)')
    expect(line({ compacting: true })).toBe('Auto-compact due, waiting for the compaction under way')
    // nothing to say while it is not due
    expect(line({ requestRunning: true, now: T0 + 60_000 })).toBe('Auto-compact armed: fires in 57m')
  })

  test('a single leading backslash is drive-relative on Windows: its resolved spelling covers it', () => {
    // as written it is not read as Windows, so on its own it would match nothing below C:
    expect(isSkippedPath(['C:\\work\\x\\y'], roots('\\work\\x'))).toBe(false)
    // the mod also keeps the stat's realPath for every skip folder, and that is drive-qualified
    expect(isSkippedPath(['C:\\work\\x\\y'], [normalizePath('\\work\\x'), normalizePath('C:\\work\\x')])).toBe(true)
  })

  test('a skip folder that cannot be found is named on the status line', () => {
    const { skipped: _, ...rest } = inputs()
    expect(statusLine({ ...rest, folder: 'unknown', unresolved: '/c/work/x' })).toBe("Auto-compact off: can't find skip folder /c/work/x")
  })
})

describe('review round 5', () => {
  test('a lapsed cache says missed and gives no advice to run /compact', () => {
    const { skipped: _, ...rest } = inputs({ triedFor: T0, now: T0 + HOUR + 1 })
    const text = statusLine({ ...rest, folder: 'on', failed: 'prompt is too long' })
    expect(text).toBe('Auto-compact missed: the cache ran out (failed: prompt is too long)')
    expect(text.includes('Run /compact')).toBe(false)
  })

  test('a skip folder is held off by the cheap check too', () => {
    const v = shouldCompact(inputs({ skipped: true }))
    expect(v.go ? 'went' : v.why).toBe('folder is on the skip list')
  })
})

describe('which refusals hand off to /compact', () => {
  const LIVE = 'cache-autocompact: $.session.compact: not available in a headless (-p / SDK) session yet'
  const TURN = 'cache-autocompact: $.session.compact: a turn is running (t1); the conversation compacts between turns'
  const OFF = 'cache-autocompact: $.session.compact: compaction is switched off in this session (DISABLE_COMPACT)'
  test('the headless refusal hands off in any session', () => {
    expect(handsOff(new Error(LIVE), true)).toBe(true)
    expect(handsOff(new Error(LIVE), false)).toBe(true)
  })
  test('an interactive session hands off on nothing else', () => {
    expect(handsOff(new Error(TURN), true)).toBe(false)
    expect(handsOff(new Error('no implementation for session.compact'), true)).toBe(false)
  })
  test('a real refusal other than the headless one never hands off, whatever the session', () => {
    expect(handsOff(new Error(TURN), false)).toBe(false)
    expect(handsOff(new Error(OFF), false)).toBe(false)
    expect(handsOff(new Error('cache-autocompact: $.session.compact: no session is bound'), false)).toBe(false)
    expect(handsOff(new Error('no implementation for session.compact'), false)).toBe(false)
  })
  test("the test kit's own refusal stands in for the headless one, outside an interactive session only", () => {
    const KIT = 'test: next() passed an argument with messages that are not a list'
    expect(handsOff(new Error(KIT), false)).toBe(true)
    expect(handsOff(new Error(KIT), true)).toBe(false)
  })
  test('compaction switched off is recognized, so the mod stops asking', () => {
    expect(isSwitchedOffRefusal(new Error(OFF))).toBe(true)
    expect(isSwitchedOffRefusal(new Error(TURN))).toBe(false)
  })
})

describe('review round 7', () => {
  test('an empty root never matches: it is not a folder', () => {
    expect(isSkippedPath(['/srv/other'], ['', '/home/me/proj'])).toBe(false)
    expect(isSkippedPath(['C:\\work'], [''])).toBe(false)
    expect(isSkippedPath(['/home/me/proj/x'], ['', '/home/me/proj'])).toBe(true)
  })

  test('compaction switched off holds the mod, and the line says so', () => {
    const v = shouldCompact(inputs({ compactOff: true }))
    expect(v.go ? 'went' : v.why).toBe('compaction is switched off')
    const { skipped: _, ...rest } = inputs({ compactOff: true })
    expect(statusLine({ ...rest, folder: 'on' })).toBe('Auto-compact off: compaction is switched off')
  })
})

describe('review round 8', () => {
  const MIN = 60_000
  test('".." never climbs above a drive or a share root', () => {
    expect(normalizePath('C:\\..')).toBe('c:')
    expect(normalizePath('C:\\work\\..\\..')).toBe('c:')
    expect(normalizePath('\\\\srv\\share\\..')).toBe('//srv/share')
    expect(normalizePath('/..')).toBe('/')
    const c = roots('C:\\..')
    expect(isSkippedPath(['C:\\work'], c)).toBe(true)
    expect(isSkippedPath(['D:\\work'], c)).toBe(false)
  })

  test('the roots are built one way: an entry that names no folder leaves them unresolved', () => {
    expect(toRoots(['.'])).toBe(undefined)
    expect(toRoots(['/a', 'x/..'])).toBe(undefined)
    expect(toRoots(['/A', 'C:/B'])).toEqual(['/a', 'c:/b'])
    expect(toRoots([])).toEqual([])
  })

  test("only the test kit's own stand-in, under the kit's own plugin name, stands in", () => {
    const KIT = 'test: next() passed an argument with messages that are not a list'
    expect(handsOff(new Error(KIT), false)).toBe(true)
    expect(handsOff(new Error('other-plugin: next() passed an argument with messages that are not a list'), false)).toBe(false)
  })

  test('the engine reads DISABLE_COMPACT as 1, true, yes or on, any case, trimmed', () => {
    for (const v of ['1', 'true', 'yes', 'on', ' On ', 'TRUE']) expect(isEngineOn(v)).toBe(true)
    for (const v of [undefined, '', '0', 'false', 'no', 'off']) expect(isEngineOn(v)).toBe(false)
  })

  test('a cache tried and then run out says missed, not started', () => {
    const { skipped: _, ...rest } = inputs({ triedFor: T0, now: T0 + HOUR + 1 })
    expect(statusLine({ ...rest, folder: 'on' })).toBe('Auto-compact missed: the cache ran out')
    const { skipped: __, ...early } = inputs({ triedFor: T0, now: T0 + 10 * MIN })
    expect(statusLine({ ...early, folder: 'on' })).toBe('Auto-compact started /compact for this cache')
  })
})

describe('review round 9', () => {
  test('a drive is a drive only at the start of a Windows spelling, never inside a rooted path', () => {
    expect(normalizePath('/c:/../private')).toBe('/private')
    expect(isSkippedPath(['/c:/private'], roots('/c:/../private'))).toBe(false)
    expect(isSkippedPath(['/private/x'], roots('/c:/../private'))).toBe(true)
    // and a real drive still keeps its floor
    expect(normalizePath('C:/..')).toBe('c:')
    expect(normalizePath('\\\\?\\C:\\..')).toBe('c:')
  })

  test("the stand-in is the whole message under the test's name: another plugin's name never matches", () => {
    expect(handsOff(new Error('contest: next() passed an argument with messages that are not a list'), false)).toBe(false)
    expect(handsOff(new Error('test: next() passed an argument with messages that are not a list, and more'), false)).toBe(false)
    expect(handsOff(new Error('test: next() passed an argument with messages that are not a list'), false)).toBe(true)
  })
})

describe('a minute of quiet after the reply', () => {
  const MIN = 60_000
  const why = (over: Partial<Inputs>) => {
    const v = shouldCompact(inputs(over))
    return v.go ? 'went' : v.why
  }
  const line = (over: Partial<Inputs>) => {
    const { skipped: _, ...rest } = inputs(over)
    return statusLine({ ...rest, folder: 'on' })
  }

  test('a 30-second reply on a 5-minute cache fires at minute 3, more than a minute after it ended', () => {
    expect(why({ ttl: '5m', now: T0 + 3 * MIN, idleSince: T0 + 30_000 })).toBe('went')
  })

  test('a reply that ended under a minute ago waits, on either cache', () => {
    expect(why({ ttl: '5m', now: T0 + 3.5 * MIN, idleSince: T0 + 3.5 * MIN - 59_999 })).toBe('the reply ended under a minute ago')
    expect(why({ ttl: '5m', now: T0 + 3.5 * MIN, idleSince: T0 + 2.5 * MIN })).toBe('went')
    expect(why({ now: T0 + HOUR - 90_000, idleSince: T0 + HOUR - 120_000 })).toBe('the reply ended under a minute ago')
    expect(why({ now: T0 + HOUR - 90_000, idleSince: T0 + HOUR - 150_000 })).toBe('went')
  })

  test('a wait that would carry past the lapse never fires: it is missed', () => {
    // a reply that ends at 4:10 on a 5-minute cache: a minute later the cache is gone
    expect(why({ ttl: '5m', now: T0 + 4 * MIN + 15_000, idleSince: T0 + 4 * MIN + 10_000 })).toBe('the cache lapses before the reply is a minute old')
    // the wait ends exactly as the cache lapses: missed too
    expect(why({ ttl: '5m', now: T0 + 4 * MIN, idleSince: T0 + 4 * MIN })).toBe('the cache lapses before the reply is a minute old')
    // one millisecond to spare: it waits
    expect(why({ ttl: '5m', now: T0 + 4 * MIN, idleSince: T0 + 4 * MIN - 1 })).toBe('the reply ended under a minute ago')
  })

  test('the status line says it waits for the minute, or that the cache will be missed', () => {
    expect(line({ ttl: '5m', now: T0 + 3.5 * MIN, idleSince: T0 + 3.5 * MIN })).toBe('Auto-compact due, waiting until the reply is a minute old')
    expect(line({ ttl: '5m', now: T0 + 4.5 * MIN, idleSince: T0 + 4.5 * MIN })).toBe('Auto-compact missed: the cache runs out within a minute of the reply')
  })

  test('armed counts down to the later of the window and the minute', () => {
    // the window opens in 30 seconds, but the reply ended 10 seconds ago: 50 seconds to go
    expect(line({ now: T0 + HOUR - 150_000, idleSince: T0 + HOUR - 160_000 })).toBe('Auto-compact armed: fires in 50s')
  })
})

describe('the window is at most half the cache', () => {
  test('a 1-hour window on a 1-hour cache waits until minute 30', () => {
    const v = (now: number) => shouldCompact(inputs({ windowMs: 3_600_000, now }))
    expect(v(T0 + 5_000).go).toBe(false)
    expect(v(T0 + HOUR / 2 - 1).go).toBe(false)
    expect(v(T0 + HOUR / 2).go).toBe(true)
  })
  test('a window under half the cache is kept as set', () => {
    expect(windowFor('1h', 1_799_999)).toBe(1_799_999)
    expect(windowFor('1h', 3_600_000)).toBe(1_800_000)
    expect(windowFor('5m', 300_000)).toBe(120_000)
    expect(windowFor('5m', 60_000)).toBe(60_000)
  })
})
