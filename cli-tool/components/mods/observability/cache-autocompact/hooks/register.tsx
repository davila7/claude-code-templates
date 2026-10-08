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
import { handoffState, handoffStatus, isHeadlessRefusal, isSkippedPath, nextTtl, normalizePath, shouldCompact, splitPaths, statusLine } from './decide.ts'
import type { Folder, Handoff, TtlTrack } from './decide.ts'

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
// the attempt that holds the lock, 0 for none; each attempt has its own number, so one that ends
// late can never release a newer attempt's lock
let busyAttempt = 0
let attempts = 0
// What is under way in the current conversation: main-loop requests started and not finished, a
// count bumped as each starts and ends, the turns started and not completed (a turn goes on between
// its requests while a tool runs), and compactions started elsewhere. A reset installs a fresh one, and
// each piece of work settles the one it started under, so work left over from before a /clear or
// resume never holds the new conversation.
type Activity = { running: number; rev: number; turns: Set<string>; compacting: number }
const fresh = (): Activity => ({ running: 0, rev: 0, turns: new Set(), compacting: 0 })
let requests = fresh()
// the conversation each open turn started under, so its turn.complete settles that one
const turnHome = new Map<string, Activity>()
let timer: { cancel: () => void } | undefined
// the skip folders as configured, for the file system
let skipList: string[] = []
// the skip folders as configured and as resolved through junctions and links, spelled for comparison;
// undefined when one could not be resolved, which turns auto-compact off until it can be. They are
// resolved again at every folder check, so a folder that turns up later brings the mod back.
let skipRoots: string[] | undefined = []
// the skip folder that could not be resolved, named on the status line and in the transcript
let unresolvedSkip: string | undefined
// the folder as last checked, for the status line only; the compact itself always checks afresh
let folder: Folder = 'unknown'
let shown: string | undefined
// why the engine last refused a compact for the current request; cleared by the next request
let refused: string | undefined
// the request whose refusal has already been put on screen as a pop-up
let warnedFor = 0
// A /compact the mod handed off, open until a compaction of this conversation closes it or the
// conversation is left (/clear, resume, the restart a compaction causes). While open, no second one is
// handed off for any request: command.run may return while the command is still queued, and nothing
// cancels it. Whether it failed is decided by handoffState; `notified` once that failure popped up.
let handoff: (Handoff & { gen: number; startedAt: number; notified: boolean }) | undefined
// why the one try on a request's cache came to nothing (a handed-off /compact that failed, a veto)
let failed: { startedAt: number; why: string } | undefined

function resetConversation() {
  gen += 1
  samples = []
  firedFor = 0
  triedFor = 0
  busyAttempt = 0
  track = undefined
  refused = undefined
  warnedFor = 0
  handoff = undefined
  failed = undefined
  requests = fresh()
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

// Every skip folder as written and where it lands, spelled for comparison. One that cannot be resolved
// leaves the roots undefined and is named: an alias the mod cannot follow might lead to the session's
// own folder, so every folder counts as unconfirmed until it can be resolved.
async function resolveSkips($: EngineInterface): Promise<{ roots: string[] | undefined; unresolved: string | undefined }> {
  const roots: string[] = []
  for (const root of skipList) {
    const found = await spellings($, root)
    if (!found) return { roots: undefined, unresolved: root }
    for (const s of found) roots.push(normalizePath(s))
  }
  return { roots, unresolved: undefined }
}

// takes a fresh resolution, and says so in the transcript when a skip folder goes missing or turns up
function applySkips($: EngineInterface, r: { roots: string[] | undefined; unresolved: string | undefined }) {
  if (r.unresolved !== unresolvedSkip) {
    $.ui.log(
      r.unresolved !== undefined
        ? `cache-autocompact: off until it can find the skip folder ${r.unresolved}`
        : 'cache-autocompact: every skip folder found, back on',
    )
  }
  skipRoots = r.roots
  unresolvedSkip = r.unresolved
}

// a folder's standing against the skip list; one that cannot be established is 'unknown', which never compacts
function standing(roots: string[] | undefined, here: string[] | undefined): Folder {
  if (!roots || !here) return 'unknown'
  return isSkippedPath(here, roots) ? 'skip' : 'on'
}

// the folder the session runs in right now, against the skip folders as they resolve right now
async function folderNow($: EngineInterface): Promise<Folder> {
  const r = await resolveSkips($)
  applySkips($, r)
  if (!r.roots) return 'unknown'
  const cwd = await $.session.cwd().catch(() => undefined)
  if (!cwd) return 'unknown'
  return standing(r.roots, await spellings($, cwd))
}

// pops up a handed-off /compact's failure once: rejected, vetoed, past its deadline after it
// returned, or the cache ran out
function noteHandoff($: EngineInterface, now: number) {
  if (!handoff || handoff.gen !== gen || handoff.notified) return
  const st = handoffState(handoff, now)
  if (st.state !== 'failed') return
  handoff.notified = true
  failed = { startedAt: handoff.startedAt, why: st.why }
  const left = handoff.lapse - now
  $.ui.toast(`Auto-compact failed (${st.why.slice(0, 80)}). Run /compact yourself: ${left > 0 ? `${fmtClock(left)} left on the cache` : 'the cache already ran out'}`)
  $.ui.log(`cache-autocompact: /compact failed: ${st.why}`)
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
      handoffOpen: handoff?.gen === gen,
      requestRunning: requests.running > 0 || requests.turns.size > 0,
      compacting: requests.compacting > 0,
      busy,
      skipped: false,
      disabled: last ? isCachingDisabled(last.model, env) : false,
    })
  const mine = gen
  const now = await $.clock.now()
  if (gen !== mine) return
  noteHandoff($, now)
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
      busy: busyAttempt !== 0,
      disabled: last0 ? isCachingDisabled(last0.model, env) : false,
      requestRunning: requests.running > 0 || requests.turns.size > 0,
      compacting: requests.compacting > 0,
      folder,
      refused,
      failed: current(failed?.startedAt) ? failed?.why : undefined,
      handoff: handoff?.gen === mine ? handoffStatus(handoff, now) : undefined,
      unresolved: unresolvedSkip,
    }),
  )
  // cheap check first, so an idle session touches no file system every five seconds
  if (gen !== mine || !judge(now, samples[samples.length - 1], busyAttempt !== 0).go) return
  const attempt = ++attempts
  busyAttempt = attempt
  try {
    const last = samples[samples.length - 1]
    const rev = cwdRev
    const req = requests.rev
    const where = await folderNow($)
    const skipped = where !== 'on'
    const at = await $.clock.now()
    if (gen === mine && cwdRev === rev) folder = where
    // Every await is behind us. Nothing below awaits until compact() is called, so what is checked
    // here is what holds when it is called: the same conversation (which also means this tick
    // still holds the lock), the same request, no folder change since the check, and still
    // inside the window.
    if (gen !== mine || cwdRev !== rev || requests.rev !== req || skipped) return
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
      // The refusal arrived through an await, so everything checked before the call is checked again:
      // a /clear, a resume, a request started or finished (requests.rev counts both, and judge holds
      // while one runs), a folder move (which bumps cwdRev), or the cache leaving the window, abandons
      // the handoff. Nothing below awaits until command.run.
      const at2 = await $.clock.now()
      if (gen !== mine || cwdRev !== rev || requests.rev !== req || samples[samples.length - 1] !== last) return
      const still = judge(at2, last, false)
      if (!still.go) return
      // Notice first: the compact restarts the session, which bumps gen, so anything after the
      // await never runs (seen live: /compact ran and no toast showed). Tried first too, so a
      // /compact that fails is never retried into a second notice. Not marked done: only a
      // compaction that turns up does that (the session.compact hook).
      triedFor = last.startedAt
      refused = undefined
      $.ui.toast(`Auto-compact is running /compact on a ${fmtTokens(still.tokens)}-token chat with ${fmtClock(still.leftMs)} left on the cache`)
      $.ui.log('cache-autocompact: ran /compact before the cache lapsed')
      // Whether it worked is judged by the tick (handoffState), from what command.run does with it.
      const rec: NonNullable<typeof handoff> = { gen: mine, startedAt: last.startedAt, at: at2, lapse: at2 + still.leftMs, command: 'pending', notified: false }
      handoff = rec
      // The lock is released at dispatch: the open handoff keeps any second one out from here, and a
      // command.run that never returns cannot leave the mod busy for good.
      if (busyAttempt === attempt) busyAttempt = 0
      try {
        await $.command.run({ command: 'compact' })
        const back = await $.clock.now().catch(() => rec.at)
        // only this attempt's own record, and only while nothing else settled it
        if (rec.command === 'pending') {
          rec.command = 'returned'
          rec.returnedAt = back
        }
      } catch (e) {
        // a rejection fails it at the next tick, with its reason
        if (rec.command === 'pending') {
          rec.command = 'rejected'
          rec.why = e instanceof Error ? e.message : String(e)
        }
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
    if (busyAttempt === attempt) busyAttempt = 0
  }
}

export const register: Register = (on, options) => {
  const cfg: Config = {
    minTokens: positive(options.minTokens, 100_000),
    windowMs: positive(options.windowSeconds, 300) * 1000,
    // as written: the file system resolves these, and only the comparison uses normalized spellings
    skip: splitPaths(options.skipPaths),
  }
  skipList = cfg.skip

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
    applySkips($, await resolveSkips($))
    ttl = await currentTtlBase($)
    folder = standing(skipRoots, await spellings($, e.cwd))
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
    // /clear and resume replace the conversation and the process goes on. Any other end clears the
    // status line but leaves the timer: a process that really ends takes it along, and one that goes
    // on (a session the desktop app restarts in place, say) keeps its auto-compact. The next
    // session.start replaces the timer either way.
    resetConversation()
    if (e.reason !== 'clear' && e.reason !== 'resume') show($, undefined)
    return next(e)
  })

  // anything else that compacts the main conversation (/compact, the threshold, another plugin)
  on('session.compact', async ($, e, next) => {
    const mine = gen
    const main = !e.agentId && e.trigger !== 'precompute'
    // while it runs the mod holds: the old request is still recorded and its window may open meanwhile
    const counted = requests
    if (main) counted.compacting += 1
    let r: SessionCompactResult
    try {
      r = await next(e)
    } finally {
      if (main) counted.compacting -= 1
    }
    // a compact that finishes after a /clear belongs to the old conversation: leave the new one alone
    if (!main || gen !== mine) return r
    const h = handoff?.gen === mine ? handoff : undefined
    if (r.skip !== undefined) {
      // a veto while a /compact the mod handed off is open is taken as that /compact's
      if (h && h.command !== 'rejected') {
        h.command = 'rejected'
        h.why = `vetoed: ${r.skip}`
      }
      return r
    }
    if (h) {
      // the handed-off /compact landed: only now is that cache shown as compacted, and a failure
      // notice already given is put right
      firedFor = h.startedAt
      if (h.notified) {
        failed = undefined
        $.ui.toast('Auto-compact: the /compact it ran finished after all, the chat is compacted')
        $.ui.log('cache-autocompact: the /compact reported as failed finished after all')
      }
      handoff = undefined
    } else {
      // someone else's compaction: nothing the mod did, so an older auto-compact is not shown for it
      firedFor = 0
    }
    samples = []
    return r
  })

  // A turn goes on between its requests while a tool runs; a compact then would be refused, or, handed
  // off as /compact, run after the turn against a cache the turn refreshed. Each turn is settled by its
  // turn.complete, which comes for an answer, an interrupt, a refusal and an error alike.
  on('turn.start', async ($, e, next) => {
    const home = requests
    home.turns.add(e.turnId)
    turnHome.set(e.turnId, home)
    try {
      return await next(e)
    } catch (err) {
      // a turn that never started never completes
      home.turns.delete(e.turnId)
      turnHome.delete(e.turnId)
      throw err
    }
  })

  on('turn.complete', async ($, e, next) => {
    turnHome.get(e.turnId)?.turns.delete(e.turnId)
    turnHome.delete(e.turnId)
    return next(e)
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
    // counted before the first await, so a compact checked from here on knows a request is under way;
    // requests.rev moves at the start and at the end, so a check that spans either sees the change
    const mineRequests = requests
    mineRequests.running += 1
    mineRequests.rev += 1
    // settled once: at the end, or when the request is aborted, in case an abandoned stream never
    // reaches its finally
    let settled = false
    const settle = () => {
      if (settled) return
      settled = true
      mineRequests.running -= 1
      mineRequests.rev += 1
    }
    next.signal.addEventListener('abort', settle, { once: true })
    try {
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
    } finally {
      next.signal.removeEventListener('abort', settle)
      settle()
    }
  })
}
