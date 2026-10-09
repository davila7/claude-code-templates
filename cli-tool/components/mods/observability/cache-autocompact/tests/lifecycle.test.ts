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
  // the /compact command the mod runs in the desktop app throws
  commandFails?: string
  // turn.start fails for this turn id
  turnStartFails?: string
  // a gate the engine's refusal waits on before it rejects, and a call when it is reached
  refuseGate?: Promise<void>
  refuseEntered?: () => void
  // a gate the /compact command waits on, and a call when it is reached
  commandGate?: Promise<void>
  // with commandGate: hold only the first command it catches
  commandGateOnce?: boolean
  commandEntered?: () => void
  // with statGate: hold only the stat of this path (as `key` spells it), not every stat
  statGateFor?: string
  // the next request reports no usage (an aborted or failed request): it ran, but records nothing
  noUsage?: boolean
  // with statGate: hold only the first stat it catches
  statGateOnce?: boolean
  // a second, one-shot gate on the stat of one path, to hold two lookups at once
  stat2Gate?: Promise<void>
  stat2For?: string
  // what the mod wrote to the transcript
  logs?: string[]
  // the environment the mod reads
  env?: Record<string, string>
  // a hook beneath the mod vetoes every compact the mod asks for
  vetoes?: string
  // compacts the mod asked for, whatever became of them
  asked?: number
  commands?: string[]
  // milliseconds a request (by turn id) stays suspended inside the engine, on the mocked clock
  naps?: Record<string, number>
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
  // the environment answered live from w.env, so a test can change a variable mid-session
  on('env.get', ($, e) => ({ value: w.env?.[(e as { name: string }).name] }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.end', ($, e) => ({ sessionId: e.sessionId }))
  // calls on a noun are answered as { value } (or { deny }), the shape the engine's own answers take
  on('session.cwd', () => (w.cwd === 'reject' ? { deny: 'no cwd' } : { value: w.cwd }) as never)
  on('fs.stat', async ($, e) => {
    const path = (e as { path: string }).path
    w.statted = [...(w.statted ?? []), path]
    const second = w.stat2Gate
    if (second && w.stat2For === key(path)) {
      w.stat2Gate = undefined
      await second
    }
    const held = w.statGate
    if (held && (w.statGateFor === undefined || w.statGateFor === key(path))) {
      if (w.statGateOnce) w.statGate = undefined
      w.statEntered?.()
      await held
    }
    if (w.statRejects?.includes(key(path))) return { deny: 'ENOENT' } as never
    const real = w.links?.[key(path)]
    const lands = w.unresolved?.includes(key(path)) ? undefined : (real ?? path)
    return { value: { kind: 'dir', size: 0, mtimeMs: 0, isLink: real !== undefined, realPath: lands } } as never
  })
  on('settings.read', () => (w.settingsRejects ? { deny: 'unreadable' } : { value: w.settings ?? {} }) as never)
  on('session.usage', () => ({ value: { startedAt: T0, context: {}, rateLimits: w.rateLimits ?? [{ kind: 'five_hour', percentUsed: 10 }] } }) as never)
  on('ui.log', ($, e) => {
    w.logs = [...(w.logs ?? []), JSON.stringify(e)]
    return { value: undefined } as never
  })
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
  on('turn.start', ($, e) => {
    const id = (e as { turnId: string }).turnId
    if (w.turnStartFails === id) throw new Error('the turn did not start')
    return { turnId: id } as never
  })
  on('turn.complete', () => ({ text: '' }) as never)
  on('command.run', async ($, e) => {
    w.commands = [...(w.commands ?? []), (e as { command: string }).command]
    const heldCommand = w.commandGate
    if (heldCommand) {
      if (w.commandGateOnce) w.commandGate = undefined
      w.commandEntered?.()
      await heldCommand
    }
    if (w.commandFails) throw new Error(w.commandFails)
    return { value: { text: 'Compacted' } } as never
  })
  on('session.compact', async ($, e) => {
    // Only the mod's own call is refused or vetoed (it reaches the test as an event with no trigger);
    // a test's manual compact runs. A refusal is a rejection. The test kit skips a hook that throws
    // and rejects the call with its own text, so the mod sees a rejection but never these words:
    // the desktop app's headless refusal, which turns into /compact, cannot be staged here.
    if ((e as { trigger?: string }).trigger !== 'manual') {
      w.asked = (w.asked ?? 0) + 1
      if (w.compactRefuses) {
        if (w.refuseGate) {
          w.refuseEntered?.()
          await w.refuseGate
        }
        // neutral words: the kit drops a hook that throws, and the mod sees the engine's next() check (KIT_STAND_IN_REFUSAL)
        throw new Error('refused by the test engine')
      }
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
    // a step asleep on the mocked clock stays suspended without holding up the test
    const nap = w.naps?.[e.turnId]
    if (nap) await clock.sleep(nap)
    if (w.gate) await w.gate
    if (w.noUsage) {
      w.noUsage = false
      return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn' } as never
    }
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

// isInteractive false is a -p run or the SDK, which is how the desktop app runs Claude Code
async function start($: Engine, cwd: string, isInteractive = true) {
  await $.session.start({ cwd, surface: null, isInteractive })
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
    await ticking
    // six more ticks come due while the first check is still held
    await clock.advance(30_000)
    // a check still under way is not a compact
    expect(w.statuses?.includes('Auto-compacting now')).toBe(false)
    w.statGate = undefined
    h.release()
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
  test('a skip folder that cannot be resolved is named on the status line', SKIP, async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0, unresolved: [PRIVATE] }
    const clock = engine(on, w)
    await start($, ALLOWED)
    await request($)
    await clock.advance(10_000)
    expect(latest(w)).toBe(`Auto-compact off: can't find skip folder ${PRIVATE}`)
  })
  test('a skip folder that turns up later is found again, and auto-compact comes back on', SKIP, async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0, unresolved: [PRIVATE] }
    const clock = engine(on, w)
    await start($, ALLOWED)
    await request($)
    await clock.advance(10_000)
    w.unresolved = []
    await clock.advance(HOUR - 30_000)
    expect(w.compacts).toBe(1)
  })
  test('a move to a skip folder on another drive turns the line off before any compact check', { options: { skipPaths: 'D:/work' } }, async ($, on) => {
    const w: World = { cwd: 'C:/work/App', compacts: 0 }
    const clock = engine(on, w)
    await start($, 'C:/work/App')
    await request($)
    await clock.advance(5_000)
    expect(latest(w)).toBe('Auto-compact armed: fires in 55m')
    w.cwd = 'D:/work'
    await $.classic.CwdChanged({ old_cwd: 'C:/work/App', new_cwd: 'D:/work' } as never)
    await clock.advance(5_000)
    expect(latest(w)).toBe('Auto-compact off in this folder')
    await clock.advance(HOUR - 30_000)
    expect(w.compacts).toBe(0)
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

describe('a request still running', () => {
  test('holds the compact of the cache before it, which that request is about to refresh', async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0 }
    const clock = engine(on, w)
    await start($, ALLOWED)
    await request($, 1)
    await clock.advance(HOUR - 6 * MIN)
    const h = hold()
    w.gate = h.gate
    w.entered = h.reached
    const running = request($, 2)
    await h.arrived
    // the first request's cache is inside its window while the second is still under way
    await clock.advance(2 * MIN)
    expect(w.compacts).toBe(0)
    w.gate = undefined
    h.release()
    await running
    await clock.advance(5_000)
    // the second request started a fresh hour
    expect(w.compacts).toBe(0)
    // and once it is done it no longer counts as running: its own window compacts
    await clock.advance(HOUR - 4 * MIN)
    expect(w.compacts).toBe(1)
  })

  test('a step from before a /clear that is still suspended does not hold the new conversation', async ($, on) => {
    // a 5-minute cache, so the new chat's window opens at minute 3; the old chat's request stays
    // suspended for 10 minutes, through that whole window
    const w: World = { cwd: ALLOWED, compacts: 0, settings: { promptCacheTtl: '5m' }, naps: { t1: 10 * MIN } }
    const clock = engine(on, w)
    await start($, ALLOWED)
    const old = request($, 1)
    await clock.advance(0)
    await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } } as never)
    await request($, 2)
    await clock.advance(4 * MIN)
    expect(w.compacts).toBe(1)
    await clock.advance(10 * MIN)
    await old
    // the old step has ended: the new conversation's count is untouched, so a request in flight
    // still holds the next cache's compact
    await request($, 3)
    const h = hold()
    w.gate = h.gate
    w.entered = h.reached
    const running = request($, 4)
    await h.arrived
    await clock.advance(4 * MIN)
    expect(w.compacts).toBe(1)
    w.gate = undefined
    h.release()
    await running
  })
})

describe('a skip folder that resolves to a name ending in a space', () => {
  test('a session below it is skipped: the space is part of the name', { options: { skipPaths: '/safe' } }, async ($, on) => {
    const w: World = { cwd: '/data/private /child', compacts: 0, links: { '/safe': '/data/private ' } }
    const clock = engine(on, w)
    await start($, '/data/private /child')
    await request($)
    await clock.advance(HOUR - 30_000)
    expect(w.compacts).toBe(0)
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

describe('review round 4', () => {
  const latest = (w: World) => w.statuses?.[w.statuses.length - 1]

  test('a manual /compact under way holds the mod: one compaction, not two', async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0, settings: { promptCacheTtl: '5m' } }
    const clock = engine(on, w)
    await start($, ALLOWED)
    await request($)
    const h = hold()
    w.compactGate = h.gate
    w.compactEntered = h.reached
    const manual = $.session.compact({ trigger: 'manual', messages: [CHAT] } as never)
    await h.arrived
    // the window opens at minute 3 while the manual compaction is still running
    await clock.advance(4 * MIN)
    expect(w.asked ?? 0).toBe(0)
    h.release()
    await manual
    await clock.advance(MIN)
    expect(w.compacts).toBe(1)
    expect(w.asked ?? 0).toBe(0)
  })

  test('a turn still under way between its requests holds the compact', async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0, settings: { promptCacheTtl: '5m' } }
    const clock = engine(on, w)
    await start($, ALLOWED)
    await $.turn.start({ text: 'go', turnId: 't1' } as never)
    await request($)
    // a tool runs: no request in flight, but the turn goes on
    await clock.advance(4 * MIN)
    expect(w.compacts).toBe(0)
    expect(latest(w)).toBe('Auto-compact due, waiting for the turn to end (a reply, a tool, or your answer)')
    await $.turn.complete({ turnId: 't1', reason: 'answer' } as never)
    await clock.advance(5_000)
    expect(w.compacts).toBe(1)
  })

  test('a manual /compact after an earlier auto-compact is not shown as the mod\'s', async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0 }
    const clock = engine(on, w)
    await start($, ALLOWED)
    await request($, 1)
    await clock.advance(HOUR - 4 * MIN)
    expect(w.compacts).toBe(1)
    await request($, 2)
    w.compactRefuses = true
    await clock.advance(HOUR - 4 * MIN)
    await $.session.compact({ trigger: 'manual', messages: [CHAT] } as never)
    await clock.advance(5_000)
    expect(latest(w)).toBe('Auto-compact waiting for a reply')
  })

  test('a session end the process outlives does not stop the timer', async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0 }
    const clock = engine(on, w)
    await start($, ALLOWED)
    await $.session.end({ reason: 'other', sessionId: 's1', resume: { id: 's1' } } as never)
    await request($)
    await clock.advance(HOUR - 30_000)
    expect(w.compacts).toBe(1)
  })
})

describe('review round 5', () => {
  const latest = (w: World) => w.statuses?.[w.statuses.length - 1]
  // the test kit replaces the words of any refusal, so the desktop's headless refusal cannot be staged;
  // a session that is not interactive (-p, the SDK, the desktop app) hands off on a refusal all the same

  test('desktop: a refused compact runs /compact once for the cache, with one notice', async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0, compactRefuses: true }
    const clock = engine(on, w)
    await start($, ALLOWED, false)
    await request($)
    await clock.advance(HOUR - 4 * MIN)
    expect(w.commands).toEqual(['compact'])
    expect(w.asked).toBe(1)
    expect(w.toasts).toBe(1)
    expect(latest(w)).toBe('Auto-compact started /compact for this cache')
    // no second try on the same cache
    await clock.advance(2 * MIN)
    expect(w.asked).toBe(1)
    expect(w.commands).toEqual(['compact'])
    expect(w.toasts).toBe(1)
  })

  test('desktop: a /compact that throws pops up once, and the next cache tries again', async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0, compactRefuses: true, commandFails: 'prompt is too long' }
    const clock = engine(on, w)
    await start($, ALLOWED, false)
    await request($, 1)
    await clock.advance(HOUR - 4 * MIN)
    expect(w.commands).toEqual(['compact'])
    expect(w.toasts).toBe(2)
    expect(latest(w)?.startsWith('Auto-compact failed (')).toBe(true)
    await clock.advance(2 * MIN)
    expect(w.commands).toEqual(['compact'])
    expect(w.toasts).toBe(2)
    await request($, 2)
    await clock.advance(HOUR - 4 * MIN)
    expect(w.commands).toEqual(['compact', 'compact'])
  })

  test('desktop: a manual /compact after the handoff is never credited to the mod', async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0, compactRefuses: true }
    const clock = engine(on, w)
    await start($, ALLOWED, false)
    await request($)
    await clock.advance(HOUR - 4 * MIN)
    await $.session.compact({ trigger: 'manual', messages: [CHAT] } as never)
    await clock.advance(5_000)
    expect(latest(w)).toBe('Auto-compact waiting for a reply')
    expect(w.statuses?.some(t => t?.startsWith('Auto-compacted'))).toBe(false)
  })

  test('a turn whose turn.complete never comes is cleared by the next turn', async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0, settings: { promptCacheTtl: '5m' } }
    const clock = engine(on, w)
    await start($, ALLOWED)
    await $.turn.start({ text: 'go', turnId: 'lost' } as never)
    // a request of another turn: the lost one is over
    await request($, 2)
    await clock.advance(4 * MIN)
    expect(w.compacts).toBe(1)
  })

  test('a turn that failed to start is not counted as open', async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0, settings: { promptCacheTtl: '5m' }, turnStartFails: 't1' }
    const clock = engine(on, w)
    await start($, ALLOWED)
    await $.turn.start({ text: 'go', turnId: 't1' } as never).catch(() => undefined)
    await request($, 1)
    await clock.advance(4 * MIN)
    expect(w.compacts).toBe(1)
  })

  test('in a skip folder the ticks do not look the folders up, and never say compacting', SKIP, async ($, on) => {
    const w: World = { cwd: PRIVATE, compacts: 0 }
    const clock = engine(on, w)
    await start($, PRIVATE)
    await request($)
    await clock.advance(HOUR - 6 * MIN)
    const looked = w.statted?.length ?? 0
    // two minutes inside the window: 24 ticks
    await clock.advance(4 * MIN)
    expect(w.statted?.length ?? 0).toBe(looked)
    expect(w.compacts).toBe(0)
    expect(w.statuses?.includes('Auto-compacting now')).toBe(false)
  })
})

describe('the desktop handoff, checked again after the refusal', () => {
  const latest = (w: World) => w.statuses?.[w.statuses.length - 1]
  // runs a big chat into its window in a desktop session and holds the engine's refusal
  async function heldAtTheRefusal($: Engine, on: On, w: World) {
    const clock = engine(on, w)
    await start($, ALLOWED, false)
    await request($)
    await clock.advance(HOUR - 6 * MIN)
    const h = hold()
    w.refuseGate = h.gate
    w.refuseEntered = h.reached
    const ticking = clock.advance(2 * MIN)
    await h.arrived
    return { clock, h, ticking }
  }

  test('an interactive session never turns a refusal into /compact', async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0, compactRefuses: true }
    const clock = engine(on, w)
    await start($, ALLOWED)
    await request($)
    await clock.advance(HOUR - 4 * MIN)
    expect(w.commands ?? []).toEqual([])
  })

  test('a /clear while the refusal comes back: no /compact', async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0, compactRefuses: true }
    const { clock, h, ticking } = await heldAtTheRefusal($, on, w)
    await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } } as never)
    w.refuseGate = undefined
    h.release()
    await ticking
    await clock.advance(0)
    expect(w.commands ?? []).toEqual([])
  })

  test('a new request while the refusal comes back: no /compact for the old cache', async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0, compactRefuses: true }
    const { clock, h, ticking } = await heldAtTheRefusal($, on, w)
    await request($, 2)
    w.refuseGate = undefined
    h.release()
    await ticking
    await clock.advance(0)
    expect(w.commands ?? []).toEqual([])
  })

  test('a move into a skip folder while the refusal comes back: no /compact', SKIP, async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0, compactRefuses: true }
    const { clock, h, ticking } = await heldAtTheRefusal($, on, w)
    w.cwd = PRIVATE
    await $.classic.CwdChanged({ old_cwd: ALLOWED, new_cwd: PRIVATE } as never)
    w.refuseGate = undefined
    h.release()
    await ticking
    await clock.advance(0)
    expect(w.commands ?? []).toEqual([])
  })

  test('a manual /compact while the refusal comes back: no /compact for the cache it replaced', async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0, compactRefuses: true }
    const { clock, h, ticking } = await heldAtTheRefusal($, on, w)
    await $.session.compact({ trigger: 'manual', messages: [CHAT] } as never)
    w.refuseGate = undefined
    h.release()
    await ticking
    await clock.advance(0)
    expect(w.commands ?? []).toEqual([])
  })

  test('a request that records nothing while the refusal comes back: no /compact from that check', async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0, compactRefuses: true, settings: { promptCacheTtl: '5m' } }
    const clock = engine(on, w)
    await start($, ALLOWED, false)
    await request($)
    // the window opens at minute 3: the tick at exactly 3:00 is the last one this advance makes
    await clock.advance(2 * MIN)
    const h = hold()
    w.refuseGate = h.gate
    w.refuseEntered = h.reached
    const ticking = clock.advance(MIN)
    await h.arrived
    w.noUsage = true
    await request($, 2)
    w.refuseGate = undefined
    h.release()
    await ticking
    await clock.advance(0)
    expect(w.commands ?? []).toEqual([])
  })

  test('the cache runs out while the refusal comes back: no /compact', async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0, compactRefuses: true }
    const { clock, h, ticking } = await heldAtTheRefusal($, on, w)
    await ticking
    await clock.advance(5 * MIN)
    w.refuseGate = undefined
    h.release()
    await clock.advance(0)
    expect(w.commands ?? []).toEqual([])
  })

  test('the control: released in time, the handoff goes ahead', async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0, compactRefuses: true }
    const { clock, h, ticking } = await heldAtTheRefusal($, on, w)
    w.refuseGate = undefined
    h.release()
    await ticking
    await clock.advance(0)
    expect(w.commands).toEqual(['compact'])
  })

  test('a /compact that never returns neither locks the mod nor reads as compacting', async ($, on) => {
    // a 5-minute cache, so each window opens at minute 3
    const w: World = { cwd: ALLOWED, compacts: 0, compactRefuses: true, settings: { promptCacheTtl: '5m' } }
    const clock = engine(on, w)
    await start($, ALLOWED, false)
    await request($, 1)
    const h = hold()
    w.commandGate = h.gate
    w.commandEntered = h.reached
    const ticking = clock.advance(4 * MIN)
    await h.arrived
    await ticking
    await clock.advance(10_000)
    expect(latest(w)).toBe('Auto-compact started /compact for this cache')
    // nothing compacted and the cache ran out: missed, not still started
    await clock.advance(MIN)
    expect(latest(w)).toBe('Auto-compact missed: the cache ran out')
    // the next reply's cache gets its own try while the first command is still out
    await request($, 2)
    await clock.advance(4 * MIN)
    expect(w.commands).toEqual(['compact', 'compact'])
    w.commandGate = undefined
    h.release()
    await clock.advance(0)
  })
})

describe('a move while the folder check is under way', () => {
  const latest = (w: World) => w.statuses?.[w.statuses.length - 1]
  test('the check of the old folder counts for nothing: no compact, and the line follows the move', SKIP, async ($, on) => {
    // hold only the stat of the session's folder, after the skip folders were looked up
    const w: World = { cwd: ALLOWED, compacts: 0, statGateFor: ALLOWED }
    const clock = engine(on, w)
    await start($, ALLOWED)
    await request($)
    await clock.advance(HOUR - 6 * MIN)
    const h = hold()
    w.statGate = h.gate
    w.statEntered = h.reached
    // the window opens at 55:00, the last tick this advance makes
    const ticking = clock.advance(MIN)
    await h.arrived
    w.cwd = PRIVATE
    await $.classic.CwdChanged({ old_cwd: ALLOWED, new_cwd: PRIVATE } as never)
    w.statGate = undefined
    h.release()
    await ticking
    await clock.advance(0)
    // the next tick draws the line from the folder as the move left it, not as the stale check saw it
    await clock.advance(5_000)
    expect(w.compacts).toBe(0)
    expect(latest(w)).toBe('Auto-compact off in this folder')
  })

  test('a request that records nothing during the check: that check stands down, the next one compacts', async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0, statGateFor: ALLOWED, settings: { promptCacheTtl: '5m' } }
    const clock = engine(on, w)
    await start($, ALLOWED)
    await request($)
    await clock.advance(2 * MIN)
    const h = hold()
    w.statGate = h.gate
    w.statEntered = h.reached
    const ticking = clock.advance(MIN)
    await h.arrived
    w.noUsage = true
    await request($, 2)
    w.statGate = undefined
    h.release()
    await ticking
    await clock.advance(0)
    expect(w.compacts).toBe(0)
    await clock.advance(5_000)
    expect(w.compacts).toBe(1)
  })
})

describe('review round 7', () => {
  const latest = (w: World) => w.statuses?.[w.statuses.length - 1]
  for (const entry of ['.', 'x/..']) {
    test(`a skip entry that names no folder (${entry}) is named, not taken as every folder`, { options: { skipPaths: entry } }, async ($, on) => {
      const w: World = { cwd: ALLOWED, compacts: 0 }
      const clock = engine(on, w)
      await start($, ALLOWED)
      await request($)
      await clock.advance(10_000)
      expect(latest(w)).toBe(`Auto-compact off: can't find skip folder ${entry}`)
      await clock.advance(HOUR - 30_000)
      expect(w.compacts).toBe(0)
    })
  }

  test('with compaction switched off it never asks, never pops up, and says why', async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0, env: { DISABLE_COMPACT: '1' } }
    const clock = engine(on, w)
    await start($, ALLOWED)
    await request($)
    await clock.advance(HOUR - 4 * MIN)
    expect(w.asked ?? 0).toBe(0)
    expect(w.toasts ?? 0).toBe(0)
    expect(latest(w)).toBe('Auto-compact off: compaction is switched off')
  })
})

describe('review round 8', () => {
  const latest = (w: World) => w.statuses?.[w.statuses.length - 1]

  test('a folder lookup from before a resume never decides the new conversation', SKIP, async ($, on) => {
    const SUB = `${PRIVATE}/sub`
    const w: World = { cwd: ALLOWED, compacts: 0, statGateFor: SUB }
    const clock = engine(on, w)
    await start($, ALLOWED)
    // a move into the skip folder whose lookup is held at the stat of the new folder
    const h = hold()
    w.statGate = h.gate
    w.statEntered = h.reached
    w.cwd = SUB
    await $.classic.CwdChanged({ old_cwd: ALLOWED, new_cwd: SUB } as never)
    await h.arrived
    // the session is resumed in an allowed folder before that lookup finishes
    await $.session.end({ reason: 'resume', sessionId: 's1', resume: { id: 's1' } } as never)
    w.cwd = ALLOWED
    await start($, ALLOWED)
    w.statGate = undefined
    h.release()
    await clock.advance(0)
    await request($)
    await clock.advance(HOUR - 30_000)
    expect(w.compacts).toBe(1)
  })

  test('a refusal that comes back after a newer request is not that request\'s', async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0, compactRefuses: true, settings: { promptCacheTtl: '5m' } }
    const clock = engine(on, w)
    await start($, ALLOWED)
    await request($, 1)
    await clock.advance(2 * MIN)
    const h = hold()
    w.refuseGate = h.gate
    w.refuseEntered = h.reached
    const ticking = clock.advance(MIN)
    await h.arrived
    await request($, 2)
    w.refuseGate = undefined
    h.release()
    await ticking
    await clock.advance(0)
    // the old refusal is dropped: no pop-up, and the new request's line is its own
    expect(w.toasts ?? 0).toBe(0)
    expect(latest(w)?.includes('refused')).toBe(false)
    // the new request's own refusal, when its window opens, gets its pop-up
    await clock.advance(3 * MIN)
    expect(w.toasts).toBe(1)
  })

  test('a refusal that comes back after a move into a skip folder says nothing', SKIP, async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0, compactRefuses: true, settings: { promptCacheTtl: '5m' } }
    const clock = engine(on, w)
    await start($, ALLOWED)
    await request($, 1)
    await clock.advance(2 * MIN)
    const h = hold()
    w.refuseGate = h.gate
    w.refuseEntered = h.reached
    const ticking = clock.advance(MIN)
    await h.arrived
    w.cwd = PRIVATE
    await $.classic.CwdChanged({ old_cwd: ALLOWED, new_cwd: PRIVATE } as never)
    w.refuseGate = undefined
    h.release()
    await ticking
    await clock.advance(5_000)
    expect(w.toasts ?? 0).toBe(0)
    expect(latest(w)).toBe('Auto-compact off in this folder')
  })

  test('DISABLE_COMPACT=yes counts, as the engine reads it', async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0, env: { DISABLE_COMPACT: 'yes' } }
    const clock = engine(on, w)
    await start($, ALLOWED)
    await request($)
    await clock.advance(10_000)
    expect(latest(w)).toBe('Auto-compact off: compaction is switched off')
    await clock.advance(HOUR - 4 * MIN)
    expect(w.asked ?? 0).toBe(0)
  })
})

describe('compaction switched off while the session runs', () => {
  test('DISABLE_COMPACT set after the session started is read when a compact is due', async ($, on) => {
    const env: Record<string, string> = {}
    const w: World = { cwd: ALLOWED, compacts: 0, env }
    const clock = engine(on, w)
    await start($, ALLOWED)
    await request($)
    env.DISABLE_COMPACT = 'on'
    await clock.advance(HOUR - 4 * MIN)
    expect(w.asked ?? 0).toBe(0)
    expect(w.compacts).toBe(0)
  })
})

describe('overlapping skip lookups', () => {
  test('an older lookup that finishes last is dropped', SKIP, async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0, statGateFor: PRIVATE, statGateOnce: true }
    const clock = engine(on, w)
    await start($, ALLOWED)
    const h = hold()
    w.statGate = h.gate
    w.statEntered = h.reached
    // move A: its lookup of the skip folder is held
    w.cwd = '/work/Other'
    await $.classic.CwdChanged({ old_cwd: ALLOWED, new_cwd: '/work/Other' } as never)
    await h.arrived
    // move B: its lookup finishes first, with the skip folder found
    w.cwd = '/work/Third'
    await $.classic.CwdChanged({ old_cwd: '/work/Other', new_cwd: '/work/Third' } as never)
    await clock.advance(0)
    // the skip folder goes missing, and only then does A's older lookup finish
    w.unresolved = [PRIVATE]
    h.release()
    await clock.advance(0)
    expect(w.logs?.some(l => l.includes('off until it can find'))).toBe(false)
  })
})

describe('review round 9', () => {
  const latest = (w: World) => w.statuses?.[w.statuses.length - 1]

  test('a folder lookup from before a link was retargeted never overrides a newer one', { options: { skipPaths: '/safe' } }, async ($, on) => {
    const w: World = { cwd: '/work/Home', compacts: 0, links: { '/safe': '/work/A' }, statGateFor: '/work/A', statGateOnce: true }
    const clock = engine(on, w)
    await start($, '/work/Home')
    await request($, 1)
    await clock.advance(HOUR - 6 * MIN)
    // a move into /work/A, which the link makes a skip folder; its lookup is held at the folder's stat
    const h = hold()
    w.statGate = h.gate
    w.statEntered = h.reached
    w.cwd = '/work/A'
    await $.classic.CwdChanged({ old_cwd: '/work/Home', new_cwd: '/work/A' } as never)
    await h.arrived
    // the link is retargeted: /work/A is allowed now, and the compact due next finds so and runs
    w.links = { '/safe': '/work/B' }
    await clock.advance(2 * MIN)
    expect(w.compacts).toBe(1)
    // the older lookup finishes last, with the old answer: it must not turn the mod off
    h.release()
    await clock.advance(0)
    await request($, 2)
    await clock.advance(HOUR - 4 * MIN)
    expect(w.compacts).toBe(2)
  })

  test("an older /compact that fails late never overwrites a newer cache's failure", async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0, compactRefuses: true, commandFails: 'cannot compact', settings: { promptCacheTtl: '5m' } }
    const clock = engine(on, w)
    await start($, ALLOWED, false)
    await request($, 1)
    // A's /compact is held; B's is not
    const h = hold()
    w.commandGate = h.gate
    w.commandGateOnce = true
    w.commandEntered = h.reached
    const ticking = clock.advance(4 * MIN)
    await h.arrived
    await ticking
    await request($, 2)
    await clock.advance(4 * MIN)
    expect(w.commands).toEqual(['compact', 'compact'])
    const shown = w.toasts
    expect(latest(w)?.startsWith('Auto-compact failed (')).toBe(true)
    // A fails now, late: no pop-up for it, and B's failure stays on the line
    h.release()
    await clock.advance(0)
    await clock.advance(5_000)
    expect(w.toasts).toBe(shown)
    expect(latest(w)?.startsWith('Auto-compact failed (')).toBe(true)
  })

  test('a /compact that fails after a move into a skip folder says nothing', SKIP, async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0, compactRefuses: true, commandFails: 'cannot compact', settings: { promptCacheTtl: '5m' } }
    const clock = engine(on, w)
    await start($, ALLOWED, false)
    await request($, 1)
    const h = hold()
    w.commandGate = h.gate
    w.commandEntered = h.reached
    const ticking = clock.advance(4 * MIN)
    await h.arrived
    await ticking
    const shown = w.toasts
    w.cwd = PRIVATE
    await $.classic.CwdChanged({ old_cwd: ALLOWED, new_cwd: PRIVATE } as never)
    w.commandGate = undefined
    h.release()
    await clock.advance(5_000)
    expect(w.toasts).toBe(shown)
    expect(latest(w)).toBe('Auto-compact off in this folder')
  })
})

describe('a move whose own lookup has not finished', () => {
  test('still stops the compact the earlier check would have allowed', SKIP, async ($, on) => {
    const w: World = { cwd: ALLOWED, compacts: 0, statGateFor: ALLOWED }
    const clock = engine(on, w)
    await start($, ALLOWED)
    await request($)
    await clock.advance(HOUR - 6 * MIN)
    // the due check is held at the stat of the session's folder
    const h = hold()
    w.statGate = h.gate
    w.statEntered = h.reached
    const ticking = clock.advance(MIN)
    await h.arrived
    // the move's own lookup is held at the stat of the skip folder, so it publishes nothing yet
    const h2 = hold()
    w.stat2Gate = h2.gate
    w.stat2For = PRIVATE
    w.cwd = PRIVATE
    await $.classic.CwdChanged({ old_cwd: ALLOWED, new_cwd: PRIVATE } as never)
    w.statGate = undefined
    h.release()
    await ticking
    await clock.advance(0)
    expect(w.compacts).toBe(0)
    h2.release()
    await clock.advance(5_000)
    expect(w.compacts).toBe(0)
  })
})

describe('a /clear while a move is being looked up', () => {
  const latest = (w: World) => w.statuses?.[w.statuses.length - 1]

  test('the new conversation looks the folder up again, and compacts once', SKIP, async ($, on) => {
    const w: World = { cwd: PRIVATE, compacts: 0, statGateFor: ALLOWED, statGateOnce: true }
    const clock = engine(on, w)
    await start($, PRIVATE)
    // a move out of the skip folder, its lookup held at the new folder's stat
    const h = hold()
    w.statGate = h.gate
    w.statEntered = h.reached
    w.cwd = ALLOWED
    await $.classic.CwdChanged({ old_cwd: PRIVATE, new_cwd: ALLOWED } as never)
    await h.arrived
    await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } } as never)
    h.release()
    await clock.advance(5_000)
    // the stale "off in this folder" is gone without waiting for a compact to come due
    expect(latest(w)).toBe('Auto-compact waiting for a reply')
    await request($)
    await clock.advance(HOUR - 30_000)
    expect(w.compacts).toBe(1)
  })

  test('even with the new lookup still out, a due compact checks the folder itself', SKIP, async ($, on) => {
    // a 5-minute cache, so the window opens at minute 3
    const w: World = { cwd: PRIVATE, compacts: 0, statGateFor: ALLOWED, statGateOnce: true, settings: { promptCacheTtl: '5m' } }
    const clock = engine(on, w)
    await start($, PRIVATE)
    const h = hold()
    w.statGate = h.gate
    w.statEntered = h.reached
    w.cwd = ALLOWED
    await $.classic.CwdChanged({ old_cwd: PRIVATE, new_cwd: ALLOWED } as never)
    await h.arrived
    // the lookup the /clear starts is held too
    const h2 = hold()
    w.stat2Gate = h2.gate
    w.stat2For = ALLOWED
    await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } } as never)
    h.release()
    await request($)
    await clock.advance(4 * MIN)
    expect(w.compacts).toBe(1)
    h2.release()
    await clock.advance(0)
  })
})
