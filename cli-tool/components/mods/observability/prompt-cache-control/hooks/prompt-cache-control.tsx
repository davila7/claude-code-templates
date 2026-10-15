/**
 * prompt-cache-control — Claude Mod
 *
 * A prompt-cache meter for Claude Code. Every main-loop request reports how
 * many prompt tokens the cache served (`cache_read_input_tokens`), wrote
 * (`cache_creation_input_tokens`) and sent uncached (`input_tokens`); this mod
 * keeps those per request and per turn, counts down to the moment the cache
 * lapses, and says what to do about it: keep going, /compact or /clear.
 *
 *   - `turn.step` reads each main-loop request's usage (subagents have their
 *     own prefixes and are left out)
 *   - `$.clock.every(1000)` redraws the countdown, and only while its text
 *     changes: an idle, expired session costs nothing
 *   - a row above the prompt (the AbovePrompt component), an optional status
 *     line entry, and `/cache`, a pane with one row per turn
 *   - idle compaction (Claude Code 2.1.290+): when Claude Code will compact
 *     the conversation by itself before the 1-hour cache lapses, the band
 *     counts down to that moment as well as to the expiry, and
 *     `session.compact` (trigger "idle") says when it happened (see idlePolicy
 *     in ./cache.ts for the conditions)
 *
 * The lifetime is counted from the start of the request that last wrote or read
 * the cache, as Anthropic documents it. Which lifetime Claude Code asked for
 * follows its documented rules (see decideTtl in ./cache.ts): FORCE_PROMPT_CACHING_5M,
 * CLAUDE_CODE_PROMPT_CACHE_TTL, the promptCacheTtl setting, ENABLE_PROMPT_CACHING_1H,
 * then the account (1 hour on a Claude subscription, 5 minutes otherwise). The
 * API names the TTL of a write but the mod API passes on only the token counts,
 * so the mod also watches the gaps between requests (a hit after more than 5
 * minutes proves 1 hour; see observeTtl). `ttl: "5m" | "1h"` pins it.
 *
 * Needs Claude Code >= 2.1.287.
 *
 * Options (pluginConfigs["prompt-cache-control@skills-dir"].options):
 *   ttl: "auto" | "5m" | "1h"   cache lifetime (default auto)
 *   warnSeconds: number         countdown threshold for the warning (default 60)
 *   compactAtTokens: number     prompt size that makes an expired cache suggest /compact (default 100000)
 *   band: boolean               row above the prompt (default true)
 *   status: boolean             entry under the prompt (default false)
 *   toast: boolean              toasts near expiry: at warnSeconds, then 10, 3, 2 and 1 s (default true)
 *   idleCompact: boolean        idle compaction countdown and notice (default true)
 */
import type { EngineInterface, Register } from 'claude-code'
import {
  advise,
  COUNTDOWN_MARKS,
  bar,
  byTurn,
  fit,
  fmtClock,
  fmtTokens,
  hitRatio,
  idleCompactAt,
  idlePolicy,
  isCachingDisabled,
  accountOf,
  decideTtl,
  observeTtl,
  lifeColor,
  lifeRatio,
  nextToastMark,
  positive,
  promptTokens,
  remainingMs,
  rowRatio,
  segments,
} from './cache.ts'
import type { Account, Advice, CacheEnv, IdleCompact, Sample, Ttl } from './cache.ts'

const PANE = 'cache'
const COMMAND = 'cache'
const KEEP = 200
// below this a lapsed cache costs too little to interrupt anyone about
const TOAST_MIN_TOKENS = 20_000

let samples: Sample[] = []
let ttl: Ttl = '5m'
let baseTtl: Ttl = '5m'
let pinned = false
let observed: Ttl | undefined
let setting: unknown
let account: Account = 'other'
let ttlSource = 'default'
let envSource = 'default'
let env: CacheEnv = {}
let timer: { cancel: () => void } | undefined
let lastKey = ''
let toastedFor = 0
let toastLevel = Infinity
let isPaneOpen = false
let idle: IdleCompact = idlePolicy({})
// the last compaction of the main conversation: a cache entry older than it is gone
let compacted: { at: number; trigger: string; before?: number; after?: number } | undefined

type Policy = { warnMs: number; compactAtTokens: number }

function current(policy: Policy, now: number) {
  const last = samples[samples.length - 1]
  const prev = samples[samples.length - 2]
  const disabled = last ? isCachingDisabled(last.model, env) : isCachingDisabled('', env)
  if (last && compacted && compacted.at > last.startedAt) {
    // the conversation the last request cached is gone: the next one starts from the summary
    const sizes = compacted.before && compacted.after ? ` (${fmtTokens(compacted.before)} → ${fmtTokens(compacted.after)})` : ''
    const how = compacted.trigger === 'idle' ? 'compacted while idle' : 'compacted'
    const advice: Advice = { kind: 'cold', text: `${how}${sizes}: the next message starts from the summary` }
    return { last, advice, left: 0, idleAt: undefined }
  }
  const advice: Advice = advise(last, prev, { ttl, ...policy }, now, disabled)
  const left = last ? remainingMs(last, ttl, now) : 0
  const idleAt = disabled ? undefined : idleCompactAt(last, ttl, idle, now)
  return { last, advice, left, idleAt }
}

// "⇣ 41:12" until Claude Code compacts on its own, "⇣ now" once that moment has come
const idleClock = (idleAt: number, now: number) => (idleAt > now ? `⇣ ${fmtClock(idleAt - now)}` : '⇣ now')

const COLOR: Record<Advice['kind'], string | undefined> = {
  warm: 'green',
  soon: 'yellow',
  expired: 'red',
  miss: 'red',
  off: undefined,
  cold: undefined,
  uncached: undefined,
}

function shortLine(policy: Policy, now: number): string {
  const { last, advice, left } = current(policy, now)
  if (!last || advice.kind === 'off') return `cache: ${advice.text}`
  const clock = left > 0 ? ` · ${fmtClock(left)}` : ''
  return `cache ${Math.round(hitRatio(last) * 100)}%${clock}`
}

type Settings = { promptCacheTtl?: unknown; idleCompaction?: unknown; autoCompactEnabled?: unknown }

// the settings the mod follows, each from the first settings file that sets it (local over project over user)
async function readSettings($: EngineInterface): Promise<Settings> {
  const home = await $.env.get('HOME').catch(() => undefined)
  const cwd = await $.session.cwd().catch(() => undefined)
  const files = [cwd && `${cwd}/.claude/settings.local.json`, cwd && `${cwd}/.claude/settings.json`, home && `${home}/.claude/settings.json`]
  const out: Settings = {}
  for (const file of files) {
    if (!file) continue
    try {
      const json = JSON.parse(await $.fs.read(file))
      if (out.promptCacheTtl === undefined && (json.promptCacheTtl === '5m' || json.promptCacheTtl === '1h')) out.promptCacheTtl = json.promptCacheTtl
      if (out.idleCompaction === undefined && typeof json.idleCompaction === 'boolean') out.idleCompaction = json.idleCompaction
      if (out.autoCompactEnabled === undefined && typeof json.autoCompactEnabled === 'boolean') out.autoCompactEnabled = json.autoCompactEnabled
    } catch {
      // missing or unreadable: the next file
    }
  }
  return out
}

// Claude Code's global config: the cached idle-compaction rollout flag, and autoCompactEnabled as /config saves it.
// Only those two keys are kept; nothing else in the file is held by the mod.
async function readGlobalConfig($: EngineInterface): Promise<{ flag?: unknown; autoCompact?: unknown }> {
  const dir = await $.env.get('CLAUDE_CONFIG_DIR').catch(() => undefined)
  const home = await $.env.get('HOME').catch(() => undefined)
  const file = dir ? `${dir}/.claude.json` : home ? `${home}/.claude.json` : undefined
  if (!file) return {}
  try {
    const json = JSON.parse(await $.fs.read(file))
    const flag = json?.cachedGrowthBookFeatures?.tengu_sunny_locket
    return { flag: flag && typeof flag === 'object' ? flag : undefined, autoCompact: json?.autoCompactEnabled }
  } catch {
    return {}
  }
}

export const register: Register = (on, options) => {
  const policy: Policy = {
    warnMs: positive(options.warnSeconds, 60) * 1000,
    compactAtTokens: positive(options.compactAtTokens, 100_000),
  }
  const showBand = options.band !== false
  const showStatus = options.status === true
  const wantToast = options.toast !== false
  const showIdle = options.idleCompact !== false

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    samples = []
    lastKey = ''
    toastedFor = 0
    compacted = undefined
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
    pinned = options.ttl === '5m' || options.ttl === '1h'
    observed = undefined
    const settings = await readSettings($)
    setting = settings.promptCacheTtl
    const global = await readGlobalConfig($)
    idle = idlePolicy({
      minTokensVar: await $.env.get('CLAUDE_CODE_IDLE_COMPACT_MIN_TOKENS').catch(none),
      disableAuto: await $.env.get('DISABLE_AUTO_COMPACT').catch(none),
      disableAll: await $.env.get('DISABLE_COMPACT').catch(none),
      setting: settings.idleCompaction,
      autoCompact: settings.autoCompactEnabled ?? global.autoCompact,
      flag: global.flag,
    })
    account = accountOf((await $.session.usage().catch(() => undefined))?.rateLimits ?? [])
    const choice = decideTtl(options.ttl, env, setting, account)
    baseTtl = choice.ttl
    ttl = baseTtl
    envSource = choice.source
    ttlSource = envSource

    await $.command
      .register({
        name: COMMAND,
        description: 'Prompt-cache usage per turn and the time left before it lapses (stop closes)',
        argumentHint: '[stop]',
        immediate: true,
      })
      .catch(err => $.ui.log(`prompt-cache-control: /${COMMAND} not registered: ${err}`))
    $.ui.log(`prompt-cache-control loaded: ${ttl} cache (${ttlSource}), /${COMMAND} opens the table`, { to: 'debug' })
    $.ui.log(`prompt-cache-control: idle compaction ${idle.on ? 'on' : 'off'}, ${idle.why}${idle.known ? '' : ' (rollout flag not found)'}`, { to: 'debug' })

    timer?.cancel()
    timer = $.clock.every(1000, () => {
      const now = Date.now()
      const { last, advice, left, idleAt } = current(policy, now)
      const key = `${advice.kind}|${advice.text}|${left > 0 ? fmtClock(left) : ''}|${showIdle && idleAt ? idleClock(idleAt, now) : ''}`
      if (key !== lastKey) {
        lastKey = key
        if (showStatus) $.ui.status(shortLine(policy, now))
        $.ui.invalidate('ui.render')
      }
      if (wantToast && last && left > 0 && promptTokens(last) >= TOAST_MIN_TOKENS) {
        if (toastedFor !== last.startedAt) {
          toastedFor = last.startedAt
          toastLevel = Infinity
        }
        // the first toast comes at warnSeconds, then 10, 3, 2 and 1 seconds; a late tick skips to the newest one
        const secs = Math.ceil(left / 1000)
        const mark = nextToastMark(secs, policy.warnMs / 1000, toastLevel)
        if (mark !== undefined) {
          toastLevel = mark
          const tail = secs <= COUNTDOWN_MARKS[0] ? 'send a message now' : `send a message to keep ${fmtTokens(promptTokens(last))} tokens warm`
          $.ui.toast(`cache expires in ${secs >= 60 ? fmtClock(left) : `${secs}s`}: ${tail}`)
        }
      }
    })
    return r
  })

  on('session.end', async ($, e, next) => {
    // /clear starts a new conversation in the same process: its cache is a new one
    if (e.reason === 'clear') {
      samples = []
      lastKey = ''
      toastedFor = 0
      compacted = undefined
      observed = undefined
      ttl = baseTtl
      ttlSource = envSource
      $.ui.invalidate('ui.render')
      return next(e)
    }
    timer?.cancel()
    timer = undefined
    return next(e)
  })

  // a compaction of the main conversation replaces what the cache held; "idle" is Claude Code compacting on its own (2.1.290+)
  on('session.compact', async ($, e, next) => {
    const r = await next(e)
    // a precompute only prepares a summary; the conversation is unchanged until it is used.
    // "idle" is newer than the d.ts (2.1.283), hence the string: re-check when it is regenerated
    const trigger = String(e.trigger)
    if (e.agentId || trigger === 'precompute' || 'skip' in r) return r
    compacted = { at: Date.now(), trigger, before: r.tokensBefore, after: r.tokensAfter }
    lastKey = ''
    if (trigger === 'idle') {
      const sizes = r.tokensBefore && r.tokensAfter ? ` ${fmtTokens(r.tokensBefore)} → ${fmtTokens(r.tokensAfter)} tokens` : ''
      $.ui.log(`prompt-cache-control: compacted while idle${sizes}, before the ${ttl} cache lapsed`)
      if (showIdle && wantToast) $.ui.toast(`compacted while idle${sizes}: your next message starts from the summary`)
    }
    if (showStatus) $.ui.status(shortLine(policy, Date.now()))
    $.ui.invalidate('ui.render')
    return r
  })

  // each main-loop request: what the cache did with it
  on('turn.step', async function* ($, e, next) {
    if (e.agentId) return yield* next(e)
    const startedAt = Date.now()
    const r = yield* next(e)
    if (r.usage) {
      samples.push({
        turnId: e.turnId,
        index: e.index,
        model: r.usage.model || e.model,
        startedAt,
        read: r.usage.cache_read_input_tokens,
        write: r.usage.cache_creation_input_tokens,
        fresh: r.usage.input_tokens,
        output: r.usage.output_tokens,
      })
      if (samples.length > KEEP) samples = samples.slice(-KEEP)
      if (!pinned) {
        // the account can change under a session: a subscription running out of plan usage moves to usage credits
        account = accountOf((await $.session.usage().catch(() => undefined))?.rateLimits ?? [])
        const choice = decideTtl(options.ttl, env, setting, account)
        baseTtl = choice.ttl
        envSource = choice.source
        if (observed === undefined) {
          ttl = baseTtl
          ttlSource = envSource
        }
        const seen = observeTtl(samples[samples.length - 2], samples[samples.length - 1], observed)
        if (seen !== observed) {
          observed = seen
          ttl = seen ?? baseTtl
          ttlSource = `observed from request timing; ${envSource} said ${baseTtl}`
          $.ui.log(`prompt-cache-control: cache lifetime is ${ttl} (${ttlSource})`, { to: 'debug' })
        }
      }
      lastKey = ''
      if (showStatus) $.ui.status(shortLine(policy, Date.now()))
      $.ui.invalidate('ui.render')
    }
    return r
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    if (e.args.trim().toLowerCase() === 'stop') {
      await $.ui.close({ id: PANE }).catch(() => undefined)
      isPaneOpen = false
      return { text: 'cache table closed' }
    }
    isPaneOpen = true
    await $.ui.open({ id: PANE, title: 'cache', focus: true })
    $.ui.invalidate('ui.render')
    const { advice } = current(policy, Date.now())
    return { text: `${ttl} cache (${ttlSource}) · ${advice.text} · /${COMMAND} stop closes` }
  })

  on('ui.close', async ($, e, next) => {
    if (e.id !== PANE) return next(e)
    isPaneOpen = false
    return next(e)
  })

  on('ui.press', async ($, e, next) => {
    if (e.plugin !== $.plugin.name || e.requestId !== PANE) return next(e)
    if (e.element === 'close') await $.ui.close({ id: PANE }).catch(() => undefined)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!showBand || e.props.hasSurvey || isPaneOpen) return next(e)
    const now = Date.now()
    const { last, advice, left, idleAt } = current(policy, now)
    if (!last && advice.kind !== 'off') return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const columns = e.viewport?.columns ?? 100
    const color = COLOR[advice.kind]
    // The band is one instance: whatever the plugins beneath draw (another mod's band) stays, under this line.
    const below = await next(e)
    const stack = (own: ReturnType<typeof Text>) => (
      <Box flexDirection="column">
        {own}
        {below}
      </Box>
    )

    if (!last) return stack(<Text dimColor>{fit(`cache: ${advice.text}`, columns)}</Text>)

    const ratio = hitRatio(last)
    const wide = columns >= 90
    return stack(
      <Box flexDirection="row" columnGap={1}>
        <Text bold color={color}>{advice.kind === 'warm' ? '●' : advice.kind === 'soon' ? '▲' : advice.kind === 'off' || advice.kind === 'cold' || advice.kind === 'uncached' ? '○' : '✖'}</Text>
        <Text bold color="cyan">cache</Text>
        <Text color={color}>{bar(ratio, wide ? 10 : 6)}</Text>
        <Text bold>{`${Math.round(ratio * 100)}%`}</Text>
        {wide ? (
          <>
            <Text color="green">{`read ${fmtTokens(last.read)}`}</Text>
            <Text color="yellow">{`wrote ${fmtTokens(last.write)}`}</Text>
            <Text color="cyan">{`new ${fmtTokens(last.fresh)}`}</Text>
          </>
        ) : (
          <Text dimColor>{`${fmtTokens(promptTokens(last))} tok`}</Text>
        )}
        {advice.kind !== 'uncached' && advice.kind !== 'off' && advice.kind !== 'cold' && (
          <Text bold color={left > 0 ? lifeColor(left, ttl, policy.warnMs) : 'red'}>{left > 0 ? `⏱ ${fmtClock(left)}` : '⏱ 0:00'}</Text>
        )}
        {showIdle && idleAt !== undefined && <Text bold color="magenta">{idleClock(idleAt, now)}</Text>}
        <Text dimColor wrap="truncate-end">{`${ttl} · ${showIdle && idleAt !== undefined ? (idleAt > now ? 'left idle, Claude Code compacts it before the cache lapses' : 'compacting while idle') : advice.text}`}</Text>
      </Box>,
    )
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const width = Math.max(30, e.props.bodyColumns - 1)
    // HTML collapses runs of spaces and trims a text's ends; a no-break space keeps them
    const sp = (t: string) => (e.surface === 'terminal' ? t : t.replace(/ /g, ' '))
    const now = Date.now()
    const { last, advice, left, idleAt } = current(policy, now)
    const all = byTurn(samples)
    const counting = !!last && advice.kind !== 'uncached' && advice.kind !== 'off' && advice.kind !== 'cold'
    // the countdown goes green, then yellow, then red as the cache runs out
    const clockColor = counting ? lifeColor(left, ttl, policy.warnMs) : undefined
    const stateColor = advice.kind === 'expired' || advice.kind === 'miss' ? 'red' : (clockColor ?? COLOR[advice.kind])
    const hitColor = (pct: number) => (pct >= 80 ? 'green' : pct >= 40 ? 'yellow' : 'red')
    // solid bars are filled Boxes, not block characters, so HTML draws no seams between cells
    const solid = (key: string, parts: [number, string | undefined][]) => (
      <Box key={key} flexDirection="row" height={1} flexShrink={0}>
        {parts.map(([w, c], i) => (w > 0 ? <Box key={`${key}:${i}`} width={w} height={1} flexShrink={0} backgroundColor={c} /> : null))}
      </Box>
    )
    const cell = (key: string, w: number, text: string, c?: string, bold = false) => (
      <Box key={key} width={w} flexShrink={0} justifyContent="flex-end">
        <Text color={c} bold={bold} dimColor={!c}>{sp(text)}</Text>
      </Box>
    )

    const barW = Math.min(width, 40)
    const life = lifeRatio(left, ttl)
    const lifeFilled = Math.round(life * barW)
    const [sr, sw, sn] = last ? segments(last.read, last.write, last.fresh, barW) : [0, 0, 0]
    const rows = all.slice(-Math.max(3, (e.viewport?.rows ?? 24) - 16))
    // why the idle-compaction line says what it says
    const idleDetail = (at: number | undefined) => {
      if (!idle.on) return `${idle.why}`
      if (at !== undefined) return `if nobody types, Claude Code compacts at ${Math.round(idle.fraction * 100)}% of the 1h cache, ${idle.why}`
      if (ttl !== '1h') return `needs the 1h cache; this session's is ${ttl}`
      if (last && promptTokens(last) < idle.minTokens) return `waits for ${fmtTokens(idle.minTokens)} tokens; the prompt is ${fmtTokens(promptTokens(last))}`
      return `armed while the cache is warm, ${idle.why}`
    }
    const icon = advice.kind === 'warm' ? '●' : advice.kind === 'soon' ? '▲' : advice.kind === 'expired' || advice.kind === 'miss' ? '✖' : '○'

    return (
      <Box flexDirection="column">
        <Box key="title" flexDirection="row" columnGap={1}>
          <Text bold color="cyan">{sp('⚡ PROMPT CACHE')}</Text>
          <Text dimColor>{sp(`· ${ttl} lifetime (${ttlSource})`)}</Text>
        </Box>

        <Box key="clock" flexDirection="column" marginTop={1}>
          <Text bold color={clockColor}>{sp(counting ? `⏱ ${left > 0 ? fmtClock(left) : '0:00'}` : '⏱ --:--')}</Text>
          {counting ? (
            <Box flexDirection="row" columnGap={1}>
              {solid('life', [[lifeFilled, clockColor], [barW - lifeFilled, 'gray']])}
              <Text dimColor>{sp(`${Math.round(life * 100)}%`)}</Text>
            </Box>
          ) : null}
        </Box>

        <Box key="advice" marginTop={1} flexDirection="column">
          <Text bold color={stateColor}>{sp(`${icon} ${advice.text}`)}</Text>
          {last ? <Text dimColor>{sp(fit(`${last.model} · prompt ${fmtTokens(promptTokens(last))} tokens`, width))}</Text> : null}
        </Box>

        {showIdle ? (
          <Box key="idle" marginTop={1} flexDirection="column">
            <Text bold color={idleAt !== undefined ? 'magenta' : undefined} dimColor={idleAt === undefined}>
              {sp(idleAt !== undefined ? `${idleClock(idleAt, now)} idle compaction` : `⇣ idle compaction ${idle.on ? 'on' : 'off'}`)}
            </Text>
            <Text dimColor>{sp(fit(idleDetail(idleAt), width))}</Text>
          </Box>
        ) : null}

        {last ? (
          <Box key="stack" flexDirection="column" marginTop={1}>
            <Box flexDirection="row" columnGap={1}>
              {solid('stack', [[sr, 'green'], [sw, 'yellow'], [sn, 'cyan']])}
              <Text bold color={hitColor(Math.round(hitRatio(last) * 100))}>{sp(`${Math.round(hitRatio(last) * 100)}% hit`)}</Text>
            </Box>
            <Box flexDirection="row" columnGap={2}>
              <Text color="green">{sp(`■ read ${fmtTokens(last.read)}`)}</Text>
              <Text color="yellow">{sp(`■ wrote ${fmtTokens(last.write)}`)}</Text>
              <Text color="cyan">{sp(`■ new ${fmtTokens(last.fresh)}`)}</Text>
            </Box>
          </Box>
        ) : null}

        <Box key="table" flexDirection="column" marginTop={1}>
          <Box key="head" flexDirection="row" columnGap={1}>
            {cell('h:turn', 4, 'turn', 'cyan', true)}
            {cell('h:steps', 5, 'steps', 'cyan', true)}
            {cell('h:read', 6, 'read', 'green', true)}
            {cell('h:wrote', 6, 'wrote', 'yellow', true)}
            {cell('h:new', 5, 'new', 'cyan', true)}
            {cell('h:hit', 4, 'hit', 'magenta', true)}
          </Box>
          {rows.length === 0 ? <Text dimColor>{sp('no requests yet')}</Text> : null}
          {rows.map((row, i) => {
            const n = all.length - rows.length + i + 1
            const pct = Math.round(rowRatio(row) * 100)
            return (
              <Box key={`t:${row.turnId}`} flexDirection="row" columnGap={1}>
                {cell(`c:turn:${row.turnId}`, 4, String(n))}
                {cell(`c:steps:${row.turnId}`, 5, String(row.steps))}
                {cell(`c:read:${row.turnId}`, 6, fmtTokens(row.read), 'green')}
                {cell(`c:wrote:${row.turnId}`, 6, fmtTokens(row.write), 'yellow')}
                {cell(`c:new:${row.turnId}`, 5, fmtTokens(row.fresh), 'cyan')}
                {cell(`c:hit:${row.turnId}`, 4, `${pct}%`, hitColor(pct), true)}
              </Box>
            )
          })}
        </Box>

        <Box key="foot" marginTop={1} flexDirection="column">
          <Button key="close" label="close" onPress={() => {}} />
          <Box key="legend" marginTop={1} flexDirection="column">
            <Text color="green">{sp('■ read: served by the cache')}</Text>
            <Text color="yellow">{sp('■ wrote: new cache entry')}</Text>
            <Text color="cyan">{sp('■ new: sent uncached')}</Text>
          </Box>
        </Box>
      </Box>
    )
  })
}
