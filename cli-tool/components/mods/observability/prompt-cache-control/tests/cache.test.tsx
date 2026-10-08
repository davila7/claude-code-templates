// Run with: claude plugin test observability/prompt-cache-control
import { describe, expect, test } from 'claude-code/testing'
import {
  advise,
  lifeColor,
  segments,
  observeTtl,
  decideTtl,
  accountOf,
  nextToastMark,
  bar,
  byTurn,
  fmtClock,
  fmtTokens,
  hitRatio,
  isCachingDisabled,
  missReason,
  remainingMs,
  resolveTtl,
} from '../hooks/cache.ts'
import type { Policy, Sample } from '../hooks/cache.ts'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const T0 = 1_000_000_000_000
const policy: Policy = { ttl: '5m', warnMs: 60_000, compactAtTokens: 100_000 }

const sample = (over: Partial<Sample> = {}): Sample => ({
  turnId: 't1',
  index: 0,
  model: 'claude-sonnet-5-5',
  startedAt: T0,
  read: 80_000,
  write: 1_000,
  fresh: 500,
  output: 300,
  ...over,
})

describe('ttl and switches', () => {
  test('auto follows the environment; the option wins; FORCE_5M beats ENABLE_1H', () => {
    expect(resolveTtl('auto', {})).toBe('5m')
    expect(resolveTtl('auto', { enable1h: '1' })).toBe('1h')
    expect(resolveTtl('auto', { enable1h: '1', force5m: '1' })).toBe('5m')
    expect(resolveTtl('1h', { force5m: '1' })).toBe('1h')
    expect(resolveTtl(undefined, { enable1h: 'true' })).toBe('1h')
  })

  test('DISABLE_PROMPT_CACHING variants are per model family', () => {
    expect(isCachingDisabled('claude-opus-5-5', { disableAll: '1' })).toBe(true)
    expect(isCachingDisabled('claude-opus-5-5', { disableSonnet: '1' })).toBe(false)
    expect(isCachingDisabled('claude-sonnet-5-5', { disableSonnet: '1' })).toBe(true)
    expect(isCachingDisabled('claude-haiku-4-5', { disableHaiku: '1' })).toBe(true)
  })
})

describe('the countdown counts from the start of the request', () => {
  test('remaining time and expiry', () => {
    const s = sample()
    expect(remainingMs(s, '5m', T0 + 100_000)).toBe(200_000)
    expect(remainingMs(s, '1h', T0 + 100_000)).toBe(3_500_000)
    expect(remainingMs(s, '5m', T0 + 400_000)).toBe(0)
  })

  test('a request that touched no cache has no countdown', () => {
    expect(remainingMs(sample({ read: 0, write: 0 }), '5m', T0 + 1000)).toBe(0)
  })

  test('formatting', () => {
    expect(fmtClock(200_000)).toBe('3:20')
    expect(fmtClock(3_500_000)).toBe('58:20')
    expect(fmtClock(3_600_000)).toBe('1:00:00')
    expect(fmtClock(1)).toBe('0:01')
    expect(fmtTokens(950)).toBe('950')
    expect(fmtTokens(84_200)).toBe('84.2k')
    expect(fmtTokens(182_000)).toBe('182k')
    expect(fmtTokens(1_200_000)).toBe('1.2M')
    expect(bar(0.5, 10)).toBe('█████░░░░░')
    expect(Math.round(hitRatio(sample()) * 1000)).toBe(982)
  })
})

describe('advice', () => {
  test('warm, then soon, then expired', () => {
    const s = sample()
    expect(advise(s, undefined, policy, T0 + 10_000, false).kind).toBe('warm')
    expect(advise(s, undefined, policy, T0 + 250_000, false).kind).toBe('soon')
    expect(advise(s, undefined, policy, T0 + 300_000, false).kind).toBe('expired')
  })

  test('an expired large context suggests /compact, a small one says keep going', () => {
    const big = advise(sample({ read: 150_000 }), undefined, policy, T0 + 400_000, false)
    expect(big.text).toContain('/compact')
    const small = advise(sample({ read: 5_000, write: 100, fresh: 50 }), undefined, policy, T0 + 400_000, false)
    expect(small.text).toContain('keep going')
    expect(small.text).not.toContain('/compact')
  })

  test('the 1h cache stays warm where the 5m one has lapsed', () => {
    const s = sample()
    expect(advise(s, undefined, { ...policy, ttl: '1h' }, T0 + 1_000_000, false).kind).toBe('warm')
  })

  test('off, cold and uncached', () => {
    expect(advise(sample(), undefined, policy, T0, true).kind).toBe('off')
    expect(advise(undefined, undefined, policy, T0, false).kind).toBe('cold')
    expect(advise(sample({ read: 0, write: 0, fresh: 900 }), undefined, policy, T0, false).kind).toBe('uncached')
  })
})

describe('misses', () => {
  const prev = sample({ read: 50_000, write: 1_000, fresh: 200 })

  test('names the cause', () => {
    const wrote = { read: 0, write: 52_000, fresh: 300 }
    expect(missReason(prev, sample({ ...wrote, model: 'claude-opus-5-5', startedAt: T0 + 20_000 }), '5m')).toContain('model changed')
    expect(missReason(prev, sample({ ...wrote, startedAt: T0 + 400_000 }), '5m')).toContain('had lapsed')
    expect(missReason(prev, sample({ ...wrote, startedAt: T0 + 20_000 }), '5m')).toContain('prefix changed')
  })

  test('a hit, a first request and a /compact are not misses', () => {
    expect(missReason(prev, sample({ read: 51_000, write: 400, fresh: 100 }), '5m')).toBeUndefined()
    expect(missReason(undefined, sample(), '5m')).toBeUndefined()
    expect(missReason(prev, sample({ read: 0, write: 8_000, fresh: 100 }), '5m')).toBeUndefined()
  })

  test('advise reports a miss while the entry is still live', () => {
    const cur = sample({ read: 0, write: 52_000, fresh: 300, startedAt: T0 + 20_000 })
    const a = advise(cur, prev, policy, T0 + 30_000, false)
    expect(a.kind).toBe('miss')
    expect(a.text).toContain('prefix changed')
  })
})

describe('per-turn rows', () => {
  test('requests of one turn are summed', () => {
    const rows = byTurn([
      sample({ turnId: 'a', index: 0, read: 10, write: 5, fresh: 1 }),
      sample({ turnId: 'a', index: 1, read: 15, write: 0, fresh: 2 }),
      sample({ turnId: 'b', index: 0, read: 20, write: 0, fresh: 3 }),
    ])
    expect(rows.length).toBe(2)
    expect(rows[0]).toEqual(expect.objectContaining({ turnId: 'a', steps: 2, read: 25, write: 5, fresh: 3 }))
    expect(rows[1].steps).toBe(1)
  })
})

// The module end to end: a main-loop request feeds the band, a subagent's does not.
type Calls = { status: (string | undefined)[]; logs: string[] }

function fakeEngine(on: On, env: Record<string, string>, calls: Calls, cache = { read: 80_000, write: 1_000 }, limits: { kind: string; percentUsed: number }[] = []) {
  on('session.usage', () => ({ value: { startedAt: 0, context: {}, rateLimits: limits } }) as never)
  on('session.start', async ($, e) => ({ cwd: e.cwd }) as never)
  on('session.end', async () => ({ sessionId: 's1' }) as never)
  on('env.get', ($, e) => ({ value: env[e.name] }))
  on('command.register', () => ({ value: undefined }) as never)
  on('clock.every', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: undefined }) as never)
  on('ui.close', () => ({ value: undefined }) as never)
  on('ui.invalidate', () => ({ value: undefined }) as never)
  on('ui.toast', () => ({ value: undefined }))
  // what the plugins beneath draw above the prompt (another mod's band)
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>beneath</Text>
  })
  on('ui.log', ($, e) => {
    calls.logs.push(String((e as { text: unknown }).text))
    return { value: undefined }
  })
  on('ui.status', ($, e) => {
    calls.status.push((e as { text?: string }).text)
    return { value: undefined }
  })
  on('turn.step', async function* ($, e) {
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '',
      toolUses: [],
      stopReason: 'end_turn',
      usage: { model: 'claude-sonnet-5-5', input_tokens: 300, output_tokens: 50, cache_read_input_tokens: cache.read, cache_creation_input_tokens: cache.write },
    } as never
  })
}

async function step($: Engine, over: { turnId?: string; index?: number; agentId?: string } = {}) {
  const stream = $.turn.step({ turnId: 't1', index: 0, model: 'claude-sonnet-5-5', messageCount: 3, ...over } as never)
  for (;;) {
    const n = await stream.next()
    if (n.done) return n.value
  }
}

const BAND = { hasSurvey: false } as never
const band = ($: Engine) => $.ui.mount({ plugin: 'prompt-cache-control', surface: 'terminal', component: 'AbovePrompt', props: BAND })

describe('the band', () => {
  test('shows nothing before the first request, then the hit rate and the countdown', { options: { status: true } }, async ($, on) => {
    const calls: Calls = { status: [], logs: [] }
    fakeEngine(on, {}, calls)
    await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true } as never)

    expect(calls.status).toEqual([])
    await step($)
    const ui = await band($)
    expect(await ui.find({ type: 'Text', text: /98%/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /read 80k/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /wrote 1k/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /new 300/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /5m · warm/ })).toBeDefined()
    // ours first, what the plugins beneath drew under it
    const texts = (await ui.findAll({ type: 'Text', text: /98%|beneath/ })).map(t => t.text)
    expect(texts.at(-1)).toBe('beneath')
    expect(texts.slice(0, -1).some(t => /98%/.test(t))).toBe(true)
    await ui.unmount()
    expect(calls.status.at(-1)).toMatch(/^cache 98% · [45]:\d\d$/)
  })

  test('a subagent request is not the main loop and leaves the meter alone', { options: { status: true } }, async ($, on) => {
    const calls: Calls = { status: [], logs: [] }
    fakeEngine(on, {}, calls)
    await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
    await step($, { agentId: 'agent-1' })
    expect(calls.status.filter(t => t?.includes('%'))).toEqual([])
    await step($)
    expect(calls.status.filter(t => t?.includes('%')).length).toBe(1)
  })

  test('ENABLE_PROMPT_CACHING_1H makes the lifetime an hour; the option beats the environment', async ($, on) => {
    const calls: Calls = { status: [], logs: [] }
    fakeEngine(on, { ENABLE_PROMPT_CACHING_1H: '1' }, calls)
    await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
    expect(calls.logs.join('\n')).toContain('1h cache (ENABLE_PROMPT_CACHING_1H)')
    await step($)
    const ui = await band($)
    expect(await ui.find({ type: 'Text', text: /1h · warm/ })).toBeDefined()
    await ui.unmount()
  })

  test('a Claude subscription defaults to an hour, usage credits to five minutes', async ($, on) => {
    const calls: Calls = { status: [], logs: [] }
    fakeEngine(on, {}, calls, undefined, [{ kind: 'five_hour', percentUsed: 12 }])
    await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
    expect(calls.logs.join('\n')).toContain('1h cache (Claude subscription default)')
  })

  test('CLAUDE_CODE_PROMPT_CACHE_TTL beats the subscription default', async ($, on) => {
    const calls: Calls = { status: [], logs: [] }
    fakeEngine(on, { CLAUDE_CODE_PROMPT_CACHE_TTL: '5m' }, calls, undefined, [{ kind: 'five_hour', percentUsed: 12 }])
    await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
    expect(calls.logs.join('\n')).toContain('5m cache (CLAUDE_CODE_PROMPT_CACHE_TTL)')
  })

  test('the ttl option beats the environment', { options: { ttl: '5m' } }, async ($, on) => {
    const calls: Calls = { status: [], logs: [] }
    fakeEngine(on, { ENABLE_PROMPT_CACHING_1H: '1' }, calls)
    await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
    expect(calls.logs.join('\n')).toContain('5m cache (the ttl option)')
  })

  test('a request that touched no cache shows no countdown', async ($, on) => {
    const calls: Calls = { status: [], logs: [] }
    fakeEngine(on, {}, calls, { read: 0, write: 0 })
    await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
    await step($)
    const ui = await band($)
    expect(await ui.find({ type: 'Text', text: /not cached/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /⏱/ })).toBeUndefined()
    await ui.unmount()
  })

  test('DISABLE_PROMPT_CACHING says so instead of a countdown', async ($, on) => {
    const calls: Calls = { status: [], logs: [] }
    fakeEngine(on, { DISABLE_PROMPT_CACHING: '1' }, calls)
    await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
    const ui = await band($)
    expect(await ui.find({ type: 'Text', text: /prompt caching is off/ })).toBeDefined()
    await ui.unmount()

    // after a request the band still shows no countdown
    await step($)
    const after = await band($)
    expect(await after.find({ type: 'Text', text: /⏱/ })).toBeUndefined()
    await after.unmount()
  })
})

describe('pane helpers', () => {
  test('the countdown is green, then yellow below 40%, then red from the warning threshold', () => {
    expect(lifeColor(250_000, '5m', 60_000)).toBe('green')
    expect(lifeColor(110_000, '5m', 60_000)).toBe('yellow')
    expect(lifeColor(60_000, '5m', 60_000)).toBe('red')
    expect(lifeColor(5_000, '1h', 60_000)).toBe('red')
    expect(lifeColor(1_800_000, '1h', 60_000)).toBe('green')
  })
  test('segments sum to the width and keep small parts visible', () => {
    const s = segments(113_000, 4_000, 2, 48)
    expect(s[0] + s[1] + s[2]).toBe(48)
    expect(s[2]).toBeGreaterThanOrEqual(1)
    expect(segments(0, 0, 0, 48)).toEqual([0, 0, 0])
  })
})

describe('countdown toasts', () => {
  test('fires at the threshold, then 10, 3, 2 and 1 seconds, once each', () => {
    let level = Infinity
    const fired: number[] = []
    for (let secs = 70; secs >= 1; secs--) {
      const m = nextToastMark(secs, 60, level)
      if (m !== undefined) {
        fired.push(secs)
        level = m
      }
    }
    expect(fired).toEqual([60, 10, 3, 2, 1])
  })
  test('a stalled clock skips to the newest mark; a short warning drops the early ones', () => {
    expect(nextToastMark(2, 60, Infinity)).toBe(2)
    expect(nextToastMark(2, 60, 2)).toBeUndefined()
    expect(nextToastMark(5, 5, Infinity)).toBe(5)
    expect(nextToastMark(30, 5, Infinity)).toBeUndefined()
  })
})

describe('observed lifetime', () => {
  const prev = sample({ startedAt: T0 })
  const MIN = 60_000
  test('a hit more than 5 minutes later proves the 1-hour lifetime and sticks', () => {
    const hit = sample({ startedAt: T0 + 20 * MIN, read: 80_000, write: 500 })
    expect(observeTtl(prev, hit, undefined)).toBe('1h')
    const miss = sample({ startedAt: T0 + 40 * MIN, read: 0, write: 81_000 })
    expect(observeTtl(hit, miss, '1h')).toBe('1h')
  })
  test('a miss 5 minutes to an hour later says 5 minutes; a later hit overrules it', () => {
    const miss = sample({ startedAt: T0 + 7 * MIN, read: 0, write: 81_000 })
    expect(observeTtl(prev, miss, undefined)).toBe('5m')
    const hit = sample({ startedAt: T0 + 20 * MIN, read: 80_000, write: 500 })
    expect(observeTtl(miss, hit, '5m')).toBe('1h')
  })
  test('says nothing inside 5 minutes, across a model change, after /compact, or when nothing was cached', () => {
    expect(observeTtl(prev, sample({ startedAt: T0 + 2 * MIN, read: 0, write: 81_000 }), undefined)).toBeUndefined()
    expect(observeTtl(prev, sample({ startedAt: T0 + 20 * MIN, model: 'claude-opus-5-5', read: 0, write: 81_000 }), undefined)).toBeUndefined()
    expect(observeTtl(prev, sample({ startedAt: T0 + 20 * MIN, read: 0, write: 5_000, fresh: 100 }), undefined)).toBeUndefined()
    expect(observeTtl(sample({ read: 0, write: 0 }), sample({ startedAt: T0 + 20 * MIN }), undefined)).toBeUndefined()
    expect(observeTtl(prev, sample({ startedAt: T0 + 2 * MIN, read: 80_000 }), undefined)).toBeUndefined()
  })
})

describe('which lifetime Claude Code asks for', () => {
  test('follows the documented order: force 5m, CLAUDE_CODE_PROMPT_CACHE_TTL, setting, ENABLE_1H, account', () => {
    expect(decideTtl('auto', { force5m: '1', ttlVar: '1h' }, '1h', 'subscription').ttl).toBe('5m')
    expect(decideTtl('auto', { ttlVar: '5m', enable1h: '1' }, '1h', 'subscription')).toEqual({ ttl: '5m', source: 'CLAUDE_CODE_PROMPT_CACHE_TTL' })
    expect(decideTtl('auto', { enable1h: '1' }, '5m', 'other')).toEqual({ ttl: '5m', source: 'the promptCacheTtl setting' })
    expect(decideTtl('auto', { enable1h: '1' }, undefined, 'other').ttl).toBe('1h')
    expect(decideTtl('auto', {}, 'junk', 'subscription')).toEqual({ ttl: '1h', source: 'Claude subscription default' })
    expect(decideTtl('auto', {}, undefined, 'credits').ttl).toBe('5m')
    expect(decideTtl('auto', {}, undefined, 'other').ttl).toBe('5m')
    expect(decideTtl('1h', { force5m: '1' }, '5m', 'other').ttl).toBe('1h')
  })
  test('the account comes from the plan windows the last response reported', () => {
    expect(accountOf([])).toBe('other')
    expect(accountOf([{ kind: 'spend_limit', percentUsed: 10 }])).toBe('other')
    expect(accountOf([{ kind: 'five_hour', percentUsed: 20 }, { kind: 'seven_day', percentUsed: 5 }])).toBe('subscription')
    expect(accountOf([{ kind: 'five_hour', percentUsed: 100 }])).toBe('credits')
  })
})
