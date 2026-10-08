/**
 * cache-autocompact — Claude Mod
 *
 * Runs /compact on its own when a big chat's prompt cache is about to lapse.
 * Compacting while the cache is warm rereads the chat at the cache price;
 * coming back after it lapsed rereads the whole chat at full price, every
 * message. Nothing here is silent: a toast and a transcript line say it fired.
 *
 *   - `turn.step` records each main-loop request, the way prompt-cache-control
 *     does, so this countdown and that bar agree
 *   - `session.compact` drops the recorded request when anything else compacts
 *     the main conversation, so a chat already compacted is not compacted again
 *   - `$.clock.every(5000)` asks decide.ts whether now is the moment, then
 *     checks the folder the session runs in right before it acts
 *   - `$.session.compact()` is the same call /compact makes; the engine refuses
 *     it while a turn runs, so a chat waiting on a permission prompt is left as is
 *
 * Every piece of async work carries the conversation's generation: a /clear or
 * a resume bumps it, and work that started under an older one does nothing.
 *
 * Known gap: a hot reload starts with no recorded request, so a reload while
 * idle means no compact until the next message. That fails safe: no compact.
 *
 * Options (pluginConfigs["cache-autocompact@skills-dir"].options):
 *   minTokens: number       smallest prompt worth compacting (default 100000)
 *   windowSeconds: number   seconds left on the cache at which it fires (default 300)
 *   skipPaths: string       comma-separated folders it never fires in (default none)
 */
import type { EngineInterface, Register, SessionCompactResult } from 'claude-code'
import { accountOf, decideTtl, fmtClock, fmtTokens, isCachingDisabled, positive } from './cache.ts'
import type { CacheEnv, Sample, Ttl } from './cache.ts'
import { fallbackDeadline, isHeadlessRefusal, isSkippedPath, nextTtl, normalizePath, shouldCompact, splitPaths, statusLine } from './decide.ts'
import type { Folder, TtlTrack } from './decide.ts'

const KEEP = 20

type Config = { minTokens: number; windowMs: number; skip: string[] }

let gen = 0
// bumped whenever the session's folder changes, so a folder check made before the change does not count
let cwdRev = 0
let samples: Sample[] = []
let ttl: Ttl = '5m'
let track: TtlTrack | undefined
let env: CacheEnv = {}
// the request whose cache was compacted, by the mod or by a /compact it handed off; shown as done
let firedFor = 0
// the request whose cache already had its one try (a /compact handed off, a veto); never shown as done
let triedFor = 0
// the generation whose compact is in flight; -1 for none
let busyGen = -1
let timer: { cancel: () => void } | undefined
// the skip folders as configured and as resolved through junctions and links, spelled for comparison;
// undefined when one could not be resolved, which turns auto-compact off
let skipRoots: string[] | undefined = []
// the folder as last checked, for the status line only; the compact itself always checks afresh
let folder: Folder = 'unknown'
let shown: string | undefined
// why the engine last refused a compact for the current request; cleared by the next request
let refused: string | undefined
// the request whose refusal has already been put on screen as a pop-up
let warnedFor = 0
// A /compact the mod handed off and has not yet seen finish. Settled only by a compaction of this
// same conversation, or by leaving it (/clear, resume, the restart a compaction causes). Past its
// deadline it pops up a failure notice. Not settled when command.run returns: that may be before the
// compaction ends.
let awaiting: { gen: number; startedAt: number; deadline: number; lapse: number; why?: string } | undefined
// why the one try on a request's cache came to nothing (a handed-off /compact past its deadline, a veto)
let failed: { startedAt: number; why: string } | undefined

function resetConversation() {
  gen += 1
  samples = []
  firedFor = 0
  triedFor = 0
  busyGen = -1
  track = undefined
  refused = undefined
  warnedFor = 0
  awaiting = undefined
  failed = undefined
}

// a path as given and where it really lands; undefined when where it lands cannot be established
async function spellings($: EngineInterface, path: string): Promise<string[] | undefined> {
  const stat = await $.fs.stat(path, { resolve: true }).catch(() => undefined)
  return stat?.realPath ? [path, stat.realPath] : undefined
}

// The cache lifetime the engine would ask for now: the merged promptCacheTtl setting, the
// variables and the account. Settings that cannot be read leave the policy unknown, and an
// unknown policy is taken as 5 minutes, so the mod compacts early rather than after a lapse.
async function currentTtlBase($: EngineInterface): Promise<Ttl> {
  const merged = (await $.settings.read().catch(() => undefined)) as Record<string, unknown> | undefined
  if (!merged) return '5m'
  const account = accountOf((await $.session.usage().catch(() => undefined))?.rateLimits ?? [])
  return decideTtl('auto', env, merged.promptCacheTtl, account).ttl
}

// a folder's standing against the skip list; one that cannot be established is 'unknown', which never compacts
function standing(here: string[] | undefined): Folder {
  if (!skipRoots || !here) return 'unknown'
  return isSkippedPath(here, skipRoots) ? 'skip' : 'on'
}

// the folder the session runs in right now
async function folderNow($: EngineInterface): Promise<Folder> {
  if (!skipRoots) return 'unknown'
  const cwd = await $.session.cwd().catch(() => undefined)
  if (!cwd) return 'unknown'
  return standing(await spellings($, cwd))
}

// shows what the mod will do; only a changed line reaches the engine
function show($: EngineInterface, text: string | undefined) {
  if (text === shown) return
  shown = text
  $.ui.status(text)
}

async function tick($: EngineInterface, cfg: Config) {
  const judge = (now: number, last: Sample | undefined, busy: boolean) =>
    shouldCompact({
      last,
      ttl,
      now,
      minTokens: cfg.minTokens,
      windowMs: cfg.windowMs,
      firedFor,
      triedFor,
      busy,
      skipped: false,
      disabled: last ? isCachingDisabled(last.model, env) : false,
    })
  const mine = gen
  const now = await $.clock.now()
  if (gen !== mine) return
  if (awaiting && awaiting.gen === mine && now >= awaiting.deadline) {
    const why = awaiting.why ?? 'no compaction happened'
    const left = awaiting.lapse - now
    failed = { startedAt: awaiting.startedAt, why }
    awaiting = undefined
    $.ui.toast(`Auto-compact failed (${why.slice(0, 80)}). Run /compact yourself: ${left > 0 ? `${fmtClock(left)} left on the cache` : 'the cache already ran out'}`)
    $.ui.log(`cache-autocompact: /compact failed: ${why}`)
  }
  const last0 = samples[samples.length - 1]
  const current = (startedAt: number | undefined) => last0 !== undefined && startedAt === last0.startedAt
  show(
    $,
    statusLine({
      last: last0,
      ttl,
      now,
      minTokens: cfg.minTokens,
      windowMs: cfg.windowMs,
      firedFor,
      busy: busyGen !== -1,
      disabled: last0 ? isCachingDisabled(last0.model, env) : false,
      folder,
      refused,
      pending: awaiting?.gen === mine && current(awaiting.startedAt),
      failed: current(failed?.startedAt) ? failed?.why : undefined,
    }),
  )
  // cheap check first, so an idle session touches no file system every five seconds
  if (gen !== mine || !judge(now, samples[samples.length - 1], busyGen !== -1).go) return
  busyGen = mine
  try {
    const last = samples[samples.length - 1]
    const rev = cwdRev
    const where = await folderNow($)
    const skipped = where !== 'on'
    const at = await $.clock.now()
    if (gen === mine && cwdRev === rev) folder = where
    // Every await is behind us. Nothing below awaits until compact() is called, so what is checked
    // here is what holds when it is called: the same conversation (which also means this tick
    // still holds the lock), the same request, no folder change since the check, and still
    // inside the window.
    if (gen !== mine || cwdRev !== rev || skipped) return
    if (!last || samples[samples.length - 1] !== last) return
    const due = judge(at, last, false)
    if (!due.go) return
    // no toast before the call: a refused compact retries every tick and would toast each time
    let r: SessionCompactResult | undefined
    try {
      r = await $.session.compact()
    } catch (err) {
      // The desktop app runs Claude Code headless, where a plugin cannot compact directly
      // (found in a live test). There /compact runs as a command, queued until the session is idle.
      if (!isHeadlessRefusal(err)) throw err
      // Notice first: the compact restarts the session, which bumps gen, so anything after the
      // await never runs (seen live: /compact ran and no toast showed). Tried first too, so a
      // /compact that fails is never retried into a second notice. Not marked done: only a
      // compaction that turns up does that (the session.compact hook).
      triedFor = last.startedAt
      refused = undefined
      $.ui.toast(`Auto-compact is running /compact on a ${fmtTokens(due.tokens)}-token chat with ${fmtClock(due.leftMs)} left on the cache`)
      $.ui.log('cache-autocompact: ran /compact before the cache lapsed')
      // Whether it worked is judged later, by the tick, against a deadline: see `awaiting`.
      const pending = { gen: mine, startedAt: last.startedAt, deadline: fallbackDeadline(at, due.leftMs), lapse: at + due.leftMs } as NonNullable<typeof awaiting>
      awaiting = pending
      try {
        await $.command.run({ command: 'compact' })
      } catch (e) {
        // a throw is only the reason shown if no compaction turns up by the deadline
        pending.why = e instanceof Error ? e.message : String(e)
      }
      return
    }
    if (gen !== mine) return
    refused = undefined
    if (r.skip !== undefined) {
      // A hook vetoed it: another plugin's decision, so it is not asked again every five seconds.
      // It is a failure all the same, said in a pop-up and on the status line, never shown as done.
      triedFor = last.startedAt
      failed = { startedAt: last.startedAt, why: `vetoed: ${r.skip}` }
      $.ui.toast(`Auto-compact was vetoed (${r.skip.slice(0, 80)}). Run /compact yourself: ${fmtClock(due.leftMs)} left on the cache`)
      $.ui.log(`cache-autocompact: compact vetoed (${r.skip})`)
      return
    }
    firedFor = last.startedAt
    if (samples[samples.length - 1] === last) samples = []
    const size = r.tokensBefore && r.tokensAfter ? `${fmtTokens(r.tokensBefore)} → ${fmtTokens(r.tokensAfter)} tokens` : 'done'
    const cost = r.usage
      ? `; the compact read ${fmtTokens(r.usage.cache_read_input_tokens)} from cache and ${fmtTokens(r.usage.input_tokens + r.usage.cache_creation_input_tokens)} at full price`
      : ''
    $.ui.toast(`Auto-compacted ${fmtTokens(due.tokens)}-token chat with ${fmtClock(due.leftMs)} left on the cache`)
    $.ui.log(`cache-autocompact: compacted before the cache lapsed, ${size}${cost}`)
  } catch (err) {
    // the engine refuses while a turn runs; the next tick tries again. The reason goes on screen,
    // and into the transcript once per new reason, so a miss always says why.
    if (gen !== mine) return
    const why = err instanceof Error ? err.message : String(err)
    if (why !== refused) $.ui.log(`cache-autocompact: compact refused: ${why}`)
    refused = why
    // one pop-up per cache: it keeps retrying every 5 seconds, and the status line shows each try
    const last = samples[samples.length - 1]
    if (last && warnedFor !== last.startedAt) {
      warnedFor = last.startedAt
      $.ui.toast(`Auto-compact was refused (${why.slice(0, 80)}). It keeps trying; run /compact yourself to be sure`)
    }
  } finally {
    if (busyGen === mine) busyGen = -1
  }
}

export const register: Register = (on, options) => {
  const cfg: Config = {
    minTokens: positive(options.minTokens, 100_000),
    windowMs: positive(options.windowSeconds, 300) * 1000,
    // as written: the file system resolves these, and only the comparison uses normalized spellings
    skip: splitPaths(options.skipPaths),
  }

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    resetConversation()
    const none = () => undefined
    env = {
      enable1h: await $.env.get('ENABLE_PROMPT_CACHING_1H').catch(none),
      force5m: await $.env.get('FORCE_PROMPT_CACHING_5M').catch(none),
      ttlVar: await $.env.get('CLAUDE_CODE_PROMPT_CACHE_TTL').catch(none),
      disableAll: await $.env.get('DISABLE_PROMPT_CACHING').catch(none),
      disableHaiku: await $.env.get('DISABLE_PROMPT_CACHING_HAIKU').catch(none),
      disableSonnet: await $.env.get('DISABLE_PROMPT_CACHING_SONNET').catch(none),
      disableOpus: await $.env.get('DISABLE_PROMPT_CACHING_OPUS').catch(none),
    }
    const roots: string[] = []
    let resolved = true
    for (const root of cfg.skip) {
      const found = await spellings($, root)
      if (!found) resolved = false
      for (const s of found ?? [root]) roots.push(normalizePath(s))
    }
    // a skip folder that cannot be resolved might be reached through an alias: off until it can be
    skipRoots = resolved ? roots : undefined
    if (!resolved) $.ui.log('cache-autocompact: off, a skip folder could not be resolved', { to: 'debug' })
    ttl = await currentTtlBase($)
    folder = standing(await spellings($, e.cwd))
    $.ui.log(
      folder !== 'on'
        ? `cache-autocompact: off in ${e.cwd} (skip list)`
        : `cache-autocompact: on, compacts chats over ${fmtTokens(cfg.minTokens)} with ${fmtClock(cfg.windowMs)} left on a ${ttl} cache`,
      { to: 'debug' },
    )
    timer?.cancel()
    timer = $.clock.every(5000, () => void tick($, cfg))
    return r
  })

  on('session.end', async ($, e, next) => {
    // /clear and resume replace the conversation and the process goes on; anything else ends it
    resetConversation()
    if (e.reason !== 'clear' && e.reason !== 'resume') {
      timer?.cancel()
      timer = undefined
      show($, undefined)
    }
    return next(e)
  })

  // anything else that compacts the main conversation (/compact, the threshold, another plugin)
  on('session.compact', async ($, e, next) => {
    const mine = gen
    const r = await next(e)
    // a compact that finishes after a /clear belongs to the old conversation: leave the new one's request
    if (!e.agentId && e.trigger !== 'precompute' && r.skip === undefined) {
      // whoever started it, a compaction of this conversation settles a /compact the mod handed off,
      // and only now is that cache shown as compacted
      if (awaiting?.gen === mine) {
        firedFor = awaiting.startedAt
        awaiting = undefined
      }
      if (gen === mine) samples = []
    }
    return r
  })

  on('classic.CwdChanged', async ($, e, next) => {
    cwdRev += 1
    const rev = cwdRev
    // the status line follows the move, checked off to the side so the move never waits on it;
    // a later move makes this check stale and it is dropped
    void folderNow($).then(where => {
      if (cwdRev === rev) folder = where
    })
    return next(e)
  })

  // each main-loop request; subagents and the engine's own forks carry an agentId and keep their own caches
  on('turn.step', async function* ($, e, next) {
    if (e.agentId) return yield* next(e)
    const mine = gen
    const startedAt = await $.clock.now()
    const r = yield* next(e)
    if (!r.usage || gen !== mine) return r
    const cur: Sample = {
      turnId: e.turnId,
      index: e.index,
      model: r.usage.model || e.model,
      startedAt,
      read: r.usage.cache_read_input_tokens,
      write: r.usage.cache_creation_input_tokens,
      fresh: r.usage.input_tokens,
      output: r.usage.output_tokens,
    }
    const base = await currentTtlBase($)
    if (gen !== mine) return r
    const prev = samples[samples.length - 1]
    samples.push(cur)
    refused = undefined
    if (samples.length > KEEP) samples = samples.slice(-KEEP)
    const tracked = nextTtl(track, base, prev, cur)
    track = tracked.track
    ttl = tracked.ttl
    return r
  })
}
