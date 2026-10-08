// The whole mod through the engine: session start, model requests, the timer, compaction.
// The test's hooks stand for the engine beneath the mod; the clock is mocked so an hour passes in a call.
import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const T0 = 1_000_000_000_000
const MIN = 60_000
const HOUR = 60 * MIN
const ALLOWED = '/work/App'
const PRIVATE = '/work/Private'
const LINK = '/links/ledger'
// the shipped skipPaths is empty, so the skip-folder tests name their folder
const SKIP = { options: { skipPaths: PRIVATE } }
const CHAT = { role: 'user' as const, text: 'the long chat', toolUses: [] }
const SUMMARY = { role: 'user' as const, text: 'the summary', toolUses: [] }

type World = {
  cwd: string | 'reject'
  compacts: number
  links?: Record<string, string>
  settings?: Record<string, unknown>
  rateLimits?: { kind: string; percentUsed: number }[]
  read?: number
  toasts?: number
  statted?: string[]
  gate?: Promise<void>
  // called when a model request reaches the engine, i.e. the mod's turn.step hook is already under way
  entered?: () => void
  // paths, spelled as `key` spells them, whose real location cannot be established, or whose stat fails
  unresolved?: string[]
  statRejects?: string[]
  // a gate on the folder check the mod makes right before compacting, and a call when it is reached
  statGate?: Promise<void>
  statEntered?: () => void
  settingsRejects?: boolean
  // a gate on the next compact's completion, and a call when it is reached
  compactGate?: Promise<void>
  compactEntered?: () => void
  statuses?: (string | undefined)[]
  // the engine refuses every compact the mod asks for, as it does while a turn runs
  compactRefuses?: boolean
  // a hook beneath the mod vetoes every compact the mod asks for
  vetoes?: string
  // compacts the mod asked for, whatever became of them
  asked?: number
  commands?: string[]
}

// The tests name rooted folders ("/work/Private"), rooted on Linux and Windows alike. The engine hands
// a hook the path it resolved: as written on Linux, "C:\work\Private" on Windows (the current drive).
// The world is keyed by the path without the drive and with forward slashes, so both find the same entry.
const key = (path: string) => path.split('\\').join('/').replace(/^[A-Za-z]:/, '')

// a promise the test resolves by hand, and a second that resolves when the gated work reaches it
function hold() {
  let release = () => {}
  let reached = () => {}
  const gate = new Promise<void>(r => (release = r))
  const arrived = new Promise<void>(r => (reached = r))
  return { gate, release, arrived, reached }
}

// everything the mod asks the engine for, answered from `w`, which a test may change mid-run
function engine(on: On, w: World) {
  const clock = mock.clock(on, { now: T0 })
  mock.env(on, {})
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.end', ($, e) => ({ sessionId: e.sessionId }))
  // calls on a noun are answered as { value } (or { deny }), the shape the engine's own answers take
  on('session.cwd', () => (w.cwd === 'reject' ? { deny: 'no cwd' } : { value: w.cwd }) as never)
  on('fs.stat', async ($, e) => {
    const path = (e as { path: string }).path
    w.statted = [...(w.statted ?? []), path]
    if (w.statGate) {
      w.statEntered?.()
      await w.statGate
    }
    if (w.statRejects?.includes(key(path))) return { deny: 'ENOENT' } as never
    const real = w.links?.[key(path)]
    const lands = w.unresolved?.includes(key(path)) ? undefined : (real ?? path)
    return { value: { kind: 'dir', size: 0, mtimeMs: 0, isLink: real !== undefined, realPath: lands } } as never
  })
  on('settings.read', () => (w.settingsRejects ? { deny: 'unreadable' } : { value: w.settings ?? {} }) as never)
  on('session.usage', () => ({ value: { startedAt: T0, context: {}, rateLimits: w.rateLimits ?? [{ kind: 'five_hour', percentUsed: 10 }] } }) as never)
  on('ui.log', () => ({ value: undefined }) as never)
  on('ui.status', ($, e) => {
    w.statuses = [...(w.statuses ?? []), (e as { text: string | undefined }).text]
    return { value: undefined } as never
  })
  on('ui.toast', () => {
    w.toasts = (w.toasts ?? 0) + 1
    return { value: undefined } as never
  })
  on('session.messages', () => ({ value: [CHAT] }) as never)
  on('classic.CwdChanged', () => ({}) as never)
  on('command.run', ($, e) => {
    w.commands = [...(w.commands ?? []), (e as { command: string }).command]
    return { value: { text: 'Compacted' } } as never
  })
  on('session.compact', async ($, e) => {
    // Only the mod's own call is refused or vetoed (it reaches the test as an event with no trigger);
    // a test's manual compact runs. A refusal is a rejection. The test kit skips a hook that throws
    // and rejects the call with its own text, so the mod sees a rejection but never these words:
    // the desktop app's headless refusal, which turns into /compact, cannot be staged here.
    if ((e as { trigger?: string }).trigger !== 'manual') {
      w.asked = (w.asked ?? 0) + 1
      if (w.compactRefuses) throw new Error('a turn is running')
      if (w.vetoes) return { skip: w.vetoes }
    }
    w.compacts += 1
    const gate = w.compactGate
    if (gate) {
      w.compactGate = undefined
      w.compactEntered?.()
      await gate
    }
    return { messages: [SUMMARY], tokensBefore: 142_500, tokensAfter: 20_000 }
  })
  on('turn.step', async function* ($, e) {
    w.entered?.()
    if (w.gate) await w.gate
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '',
      toolUses: [],
      stopReason: 'end_turn',
      usage: { model: e.model, input_tokens: 500, output_tokens: 300, cache_read_input_tokens: w.read ?? 140_000, cache_creation_input_tokens: 2_000 },
    } as never
  })
  return clock
}

async function start($: Engine, cwd: string) {
  await $.session.start({ cwd, surface: null, isInteractive: true })
}

// one main-loop request of a 142,500-token chat
async function request($: Engine, n = 1) {
  const s = $.turn.step({ turnId: `t${n}`, index: 0, model: 'claude-opus-5-5', messageCount: 10 })
  for await (const _ of s) {
    // drain the stream
  }
  await s.result
}

describe('fires', () => {
  test('a big idle chat compacts once, inside the last five minutes of a 1-hour cache', async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0 }
    const clock = engine(on, w)
    await start($, ALLOWED)
    await request($)
    await clock.advance(HOUR - 6 * MIN)
    expect(w.compacts).toBe(0)
    await clock.advance(2 * MIN)
    expect(w.compacts).toBe(1)
    expect(w.toasts).toBe(1)
    // never twice for the same cache, all the way past expiry
    await clock.advance(5 * MIN)
    expect(w.compacts).toBe(1)
    expect(w.toasts).toBe(1)
  })
})

describe('never in a skip folder', () => {
  test('a session in Private', SKIP, async ($, on) => {
    const w: World = { cwd: PRIVATE, compacts: 0 }
    const clock = engine(on, w)
    await start($, PRIVATE)
    await request($)
    await clock.advance(HOUR - 30_000)
    expect(w.compacts).toBe(0)
  })

  test('a folder below Private', SKIP, async ($, on) => {
    const w: World = { cwd: `${PRIVATE}/reports`, compacts: 0 }
    const clock = engine(on, w)
    await start($, `${PRIVATE}/reports`)
    await request($)
    await clock.advance(HOUR - 30_000)
    expect(w.compacts).toBe(0)
  })

  test('the folder lookup failing counts as Private, not as permission', SKIP, async ($, on) => {
    const w: World = { cwd: 'reject', compacts: 0 }
    const clock = engine(on, w)
    await start($, PRIVATE)
    await request($)
    await clock.advance(HOUR - 30_000)
    expect(w.compacts).toBe(0)
  })

  test('a session that moves into Private after it started', SKIP, async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0 }
    const clock = engine(on, w)
    await start($, ALLOWED)
    await request($)
    w.cwd = PRIVATE
    await clock.advance(HOUR - 30_000)
    expect(w.compacts).toBe(0)
  })

  test('a link whose real folder is in Private', SKIP, async ($, on) => {
    const w: World = { cwd: LINK, compacts: 0, links: { [LINK]: `${PRIVATE}/ledger` } }
    const clock = engine(on, w)
    await start($, LINK)
    await request($)
    await clock.advance(HOUR - 30_000)
    expect(w.compacts).toBe(0)
  })

  test('the control: a sibling folder named Private2 still compacts', SKIP, async ($, on) => {
    const w: World = { cwd: `${PRIVATE}2`, compacts: 0 }
    const clock = engine(on, w)
    await start($, `${PRIVATE}2`)
    await request($)
    await clock.advance(HOUR - 30_000)
    expect(w.compacts).toBe(1)
  })

  test('a comma-separated list skips the second folder too', { options: { skipPaths: `/elsewhere, ${PRIVATE}` } }, async ($, on) => {
    const w: World = { cwd: PRIVATE, compacts: 0 }
    const clock = engine(on, w)
    await start($, PRIVATE)
    await request($)
    await clock.advance(HOUR - 30_000)
    expect(w.compacts).toBe(0)
  })

  test('an absolute skip folder is looked up as written, never relative to the working folder', { options: { skipPaths: '/home/me/Finance' } }, async ($, on) => {
    const w: World = { cwd: '/home/me/Finance/2026', compacts: 0 }
    const clock = engine(on, w)
    await start($, '/home/me/Finance/2026')
    // the lookup keeps the leading slash and the capital F
    expect(w.statted?.map(key)).toContain('/home/me/Finance')
    await request($)
    await clock.advance(HOUR - 30_000)
    expect(w.compacts).toBe(0)
  })

  test('an absolute skip folder that exists leaves auto-compact on everywhere else', { options: { skipPaths: '/home/me/finance' } }, async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0 }
    const clock = engine(on, w)
    await start($, ALLOWED)
    await request($)
    await clock.advance(HOUR - 30_000)
    expect(w.compacts).toBe(1)
  })

  test('the root "/" skips every folder', { options: { skipPaths: '/' } }, async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0 }
    const clock = engine(on, w)
    await start($, ALLOWED)
    await request($)
    await clock.advance(HOUR - 30_000)
    expect(w.compacts).toBe(0)
  })

  test('the shipped default skips nothing: the same folder compacts', async ($, on) => {
    const w: World = { cwd: PRIVATE, compacts: 0 }
    const clock = engine(on, w)
    await start($, PRIVATE)
    await request($)
    await clock.advance(HOUR - 30_000)
    expect(w.compacts).toBe(1)
  })
})

describe('never after the cache lapsed', () => {
  test('a 5-minute setting beats the subscription default', async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0, settings: { promptCacheTtl: '5m' } }
    const clock = engine(on, w)
    await start($, ALLOWED)
    await request($)
    await clock.advance(4 * MIN)
    expect(w.compacts).toBe(1)
  })

  test('usage credits mean a 5-minute cache: it fires inside minutes 3 to 5, not near the hour', async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0, rateLimits: [{ kind: 'five_hour', percentUsed: 100 }] }
    const clock = engine(on, w)
    await start($, ALLOWED)
    await request($)
    await clock.advance(2 * MIN + 55_000)
    expect(w.compacts).toBe(0)
    await clock.advance(2 * MIN)
    expect(w.compacts).toBe(1)
  })

  test('an old 1-hour proof does not stretch a 5-minute cache after plan usage runs out', async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0, read: 60_000 }
    const clock = engine(on, w)
    await start($, ALLOWED)
    // two small requests 10 minutes apart, the second a hit: proof of the 1-hour cache
    await request($, 1)
    await clock.advance(10 * MIN)
    await request($, 2)
    // plan usage runs out, the chat grows past the threshold
    w.rateLimits = [{ kind: 'five_hour', percentUsed: 100 }]
    w.read = 140_000
    await request($, 3)
    await clock.advance(5 * MIN)
    expect(w.compacts).toBe(1)
  })
})

describe('conversation changes', () => {
  test('a manual /compact disarms the old request', async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0 }
    const clock = engine(on, w)
    await start($, ALLOWED)
    await request($)
    await $.session.compact({ trigger: 'manual', messages: [CHAT] } as never)
    expect(w.compacts).toBe(1)
    await clock.advance(HOUR - 30_000)
    expect(w.compacts).toBe(1)
  })

  test('/clear forgets the old chat', async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0 }
    const clock = engine(on, w)
    await start($, ALLOWED)
    await request($)
    await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } } as never)
    await clock.advance(HOUR - 30_000)
    expect(w.compacts).toBe(0)
  })

  test('a reply that started before /clear and lands after it is not recorded', async ($, on) => {
    let release = () => {}
    let reached = () => {}
    const inFlight = new Promise<void>(r => (reached = r))
    const w: World = { cwd: ALLOWED, compacts: 0, gate: new Promise<void>(r => (release = r)), entered: () => reached() }
    const clock = engine(on, w)
    await start($, ALLOWED)
    const pending = request($)
    await inFlight
    await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } } as never)
    release()
    await pending
    await clock.advance(HOUR - 30_000)
    expect(w.compacts).toBe(0)
  })

  test('after a resume the timer still runs for the new chat', async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0 }
    const clock = engine(on, w)
    await start($, ALLOWED)
    await $.session.end({ reason: 'resume', sessionId: 's1', resume: { id: 's1' } } as never)
    await request($, 2)
    await clock.advance(HOUR - 30_000)
    expect(w.compacts).toBe(1)
  })

  test('a small chat is left alone', async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0, read: 30_000 }
    const clock = engine(on, w)
    await start($, ALLOWED)
    await request($)
    await clock.advance(HOUR - 30_000)
    expect(w.compacts).toBe(0)
  })
})

describe('resolution failures fail closed', () => {
  test('a folder whose real location cannot be established', async ($, on) => {
    const w: World = { cwd: LINK, compacts: 0, unresolved: [LINK] }
    const clock = engine(on, w)
    await start($, LINK)
    await request($)
    await clock.advance(HOUR - 30_000)
    expect(w.compacts).toBe(0)
  })

  test('a folder whose stat fails', async ($, on) => {
    const w: World = { cwd: LINK, compacts: 0, statRejects: [LINK] }
    const clock = engine(on, w)
    await start($, LINK)
    await request($)
    await clock.advance(HOUR - 30_000)
    expect(w.compacts).toBe(0)
  })

  test('a skip folder that cannot be resolved turns auto-compact off everywhere', SKIP, async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0, statRejects: [key(PRIVATE)] }
    const clock = engine(on, w)
    await start($, ALLOWED)
    await request($)
    await clock.advance(HOUR - 30_000)
    expect(w.compacts).toBe(0)
  })
})

describe('the cache lifetime follows the settings as they are now', () => {
  test('a setting changed from 1h to 5m mid-session counts for the next request', async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0, settings: { promptCacheTtl: '1h' }, read: 60_000 }
    const clock = engine(on, w)
    await start($, ALLOWED)
    await request($, 1)
    w.settings = { promptCacheTtl: '5m' }
    w.read = 140_000
    await request($, 2)
    await clock.advance(5 * MIN)
    expect(w.compacts).toBe(1)
  })

  test('unreadable settings are taken as 5 minutes, never assumed to be an hour', async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0, settingsRejects: true }
    const clock = engine(on, w)
    await start($, ALLOWED)
    await request($)
    await clock.advance(5 * MIN)
    expect(w.compacts).toBe(1)
  })
})

describe('things that change while the mod is mid-check', () => {
  // runs a big chat up to the window, then holds the mod inside its last folder check
  async function heldAtTheCheck($: Engine, on: On, w: World) {
    const clock = engine(on, w)
    await start($, ALLOWED)
    await request($)
    await clock.advance(HOUR - 6 * MIN)
    const h = hold()
    w.statGate = h.gate
    w.statEntered = h.reached
    const ticking = clock.advance(2 * MIN)
    await h.arrived
    return { clock, h, ticking }
  }

  test('a /clear and a new small chat during the check: the old request is not compacted', async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0 }
    const { clock, h, ticking } = await heldAtTheCheck($, on, w)
    await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } } as never)
    w.read = 30_000
    w.statGate = undefined
    await request($, 2)
    h.release()
    await ticking
    // let the released check run to its end before looking
    await clock.advance(0)
    expect(w.compacts).toBe(0)
  })

  test('a manual /compact during the check: one compact, not two', async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0 }
    const { clock, h, ticking } = await heldAtTheCheck($, on, w)
    await $.session.compact({ trigger: 'manual', messages: [CHAT] } as never)
    h.release()
    await ticking
    await clock.advance(0)
    expect(w.compacts).toBe(1)
  })

  test('the session moves into Private during the check', SKIP, async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0 }
    const { clock, h, ticking } = await heldAtTheCheck($, on, w)
    w.cwd = PRIVATE
    await $.classic.CwdChanged({ old_cwd: ALLOWED, new_cwd: PRIVATE } as never)
    h.release()
    await ticking
    await clock.advance(0)
    expect(w.compacts).toBe(0)
  })

  test('ticks that pile up behind a slow check still compact once', async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0 }
    const { clock, h, ticking } = await heldAtTheCheck($, on, w)
    w.statGate = undefined
    h.release()
    await ticking
    await clock.advance(0)
    expect(w.compacts).toBe(1)
  })

  test('the cache lapses while the check is held: nothing fires after the lapse', async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0 }
    const { clock, h, ticking } = await heldAtTheCheck($, on, w)
    await ticking
    await clock.advance(5 * MIN)
    w.statGate = undefined
    h.release()
    await clock.advance(5_000)
    expect(w.compacts).toBe(0)
  })

  test('an auto-compact that finishes after a /clear is not announced', async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0 }
    const clock = engine(on, w)
    await start($, ALLOWED)
    await request($)
    const h = hold()
    w.compactGate = h.gate
    w.compactEntered = h.reached
    const ticking = clock.advance(HOUR - 90_000)
    await h.arrived
    await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } } as never)
    h.release()
    await ticking
    await clock.advance(5_000)
    expect(w.compacts).toBe(1)
    expect(w.toasts ?? 0).toBe(0)
  })

  test('a manual compact that finishes after a /clear leaves the new chat armed', async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0 }
    const clock = engine(on, w)
    await start($, ALLOWED)
    await request($, 1)
    const h = hold()
    w.compactGate = h.gate
    w.compactEntered = h.reached
    const manual = $.session.compact({ trigger: 'manual', messages: [CHAT] } as never)
    await h.arrived
    await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } } as never)
    await request($, 2)
    h.release()
    await manual
    await clock.advance(HOUR - 30_000)
    // the manual one, then the new chat's own
    expect(w.compacts).toBe(2)
  })
})

describe('status line', () => {
  const latest = (w: World) => w.statuses?.[w.statuses.length - 1]
  test('says armed with the time to go, then compacted, and only sends a changed line', async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0 }
    const clock = engine(on, w)
    await start($, ALLOWED)
    await clock.advance(5_000)
    expect(latest(w)).toBe('Auto-compact waiting for a reply')
    await request($)
    await clock.advance(5_000)
    expect(latest(w)).toBe('Auto-compact armed: fires in 55m')
    const sent = w.statuses?.length ?? 0
    // ten more ticks inside the same minute: nothing new reaches the engine
    await clock.advance(50_000)
    expect(w.statuses?.length).toBe(sent)
    await clock.advance(HOUR - 60_000)
    expect(w.compacts).toBe(1)
    expect(latest(w)).toBe('Auto-compacted, waiting for the next reply')
  })
  test('in Private it says off, and never armed', SKIP, async ($, on) => {
    const w: World = { cwd: PRIVATE, compacts: 0 }
    const clock = engine(on, w)
    await start($, PRIVATE)
    await request($)
    await clock.advance(10 * MIN)
    expect(latest(w)).toBe('Auto-compact off in this folder')
    expect(w.statuses?.some(t => t?.startsWith('Auto-compact armed'))).toBe(false)
  })
  test('a skip folder that cannot be resolved says it cannot confirm the folder', SKIP, async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0, unresolved: [PRIVATE] }
    const clock = engine(on, w)
    await start($, ALLOWED)
    await request($)
    await clock.advance(10_000)
    expect(latest(w)).toBe("Auto-compact off: can't confirm the folder")
  })
  test('moving into Private turns the line off without waiting for a compact check', SKIP, async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0 }
    const clock = engine(on, w)
    await start($, ALLOWED)
    await request($)
    await clock.advance(5_000)
    expect(latest(w)).toBe('Auto-compact armed: fires in 55m')
    w.cwd = PRIVATE
    await $.classic.CwdChanged({ old_cwd: ALLOWED, new_cwd: PRIVATE } as never)
    await clock.advance(5_000)
    expect(latest(w)).toBe('Auto-compact off in this folder')
  })
  test('a cache that lapses while every compact is refused says missed', async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0, settings: { promptCacheTtl: '5m' }, compactRefuses: true }
    const clock = engine(on, w)
    await start($, ALLOWED)
    await request($)
    await clock.advance(6 * MIN)
    expect(w.compacts).toBe(0)
    // the miss carries the engine's reason, so a live miss says why
    expect(latest(w)?.startsWith('Auto-compact missed: the cache ran out (refused: ')).toBe(true)
    expect(w.statuses?.some(t => t?.startsWith('Auto-compact retrying (refused: '))).toBe(true)
  })
})

describe('refusals', () => {
  test('any other refusal is not turned into /compact', async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0, compactRefuses: true }
    const clock = engine(on, w)
    await start($, ALLOWED)
    await request($)
    await clock.advance(HOUR + MIN)
    expect(w.commands ?? []).toEqual([])
  })
})

describe('failure notices', () => {
  test('a refused compact pops up once for the cache, not on every retry', async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0, compactRefuses: true }
    const clock = engine(on, w)
    await start($, ALLOWED)
    await request($)
    await clock.advance(HOUR - 4 * MIN)
    expect(w.toasts ?? 0).toBe(1)
    await clock.advance(3 * MIN)
    expect(w.toasts).toBe(1)
  })
  test('a new reply after a refusal can pop up again for its own cache', async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0, compactRefuses: true }
    const clock = engine(on, w)
    await start($, ALLOWED)
    await request($)
    await clock.advance(HOUR - 4 * MIN)
    await request($, 2)
    await clock.advance(HOUR - 4 * MIN)
    expect(w.toasts).toBe(2)
  })
  test('the control: a compact that works shows only its own notice', async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0 }
    const clock = engine(on, w)
    await start($, ALLOWED)
    await request($)
    await clock.advance(HOUR - MIN)
    expect(w.compacts).toBe(1)
    expect(w.toasts).toBe(1)
  })
})

describe('a veto', () => {
  const latest = (w: World) => w.statuses?.[w.statuses.length - 1]
  test('is a failure: one pop-up, the reason on the status line, never shown as done, not asked again', async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0, vetoes: 'not now' }
    const clock = engine(on, w)
    await start($, ALLOWED)
    await request($)
    await clock.advance(HOUR - 4 * MIN)
    expect(w.compacts).toBe(0)
    expect(w.asked).toBe(1)
    expect(w.toasts).toBe(1)
    expect(latest(w)).toBe('Auto-compact failed (vetoed: not now). Run /compact yourself')
    await clock.advance(2 * MIN)
    expect(w.asked).toBe(1)
    expect(w.toasts).toBe(1)
    expect(w.statuses?.some(t => t?.startsWith('Auto-compacted'))).toBe(false)
  })
})
