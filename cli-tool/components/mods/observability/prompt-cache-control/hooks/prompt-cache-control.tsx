/**
 * prompt-cache-control — Claude Mod (EARLY ACCESS)
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
 * Needs CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 (Claude Code >= 2.1.259).
 *
 * Options (pluginConfigs["prompt-cache-control@skills-dir"].options):
 *   ttl: "auto" | "5m" | "1h"   cache lifetime (default auto)
 *   warnSeconds: number         countdown threshold for the warning (default 60)
 *   compactAtTokens: number     prompt size that makes an expired cache suggest /compact (default 100000)
 *   band: boolean               row above the prompt (default true)
 *   status: boolean             entry under the prompt (default false)
 *   toast: boolean              toasts near expiry: at warnSeconds, then 10, 3, 2 and 1 s (default true)
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
  isBlank,
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
import type { Account, Advice, CacheEnv, Sample, Ttl } from './cache.ts'

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

type Policy = { warnMs: number; compactAtTokens: number }

function current(policy: Policy, now: number) {
  const last = samples[samples.length - 1]
  const prev = samples[samples.length - 2]
  const disabled = last ? isCachingDisabled(last.model, env) : isCachingDisabled('', env)
  const advice: Advice = advise(last, prev, { ttl, ...policy }, now, disabled)
  const left = last ? remainingMs(last, ttl, now) : 0
  return { last, advice, left }
}

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

// the promptCacheTtl setting, from the settings files that can carry it (local over project over user)
async function readSetting($: EngineInterface): Promise<unknown> {
  const home = await $.env.get('HOME').catch(() => undefined)
  const cwd = await $.session.cwd().catch(() => undefined)
  const files = [cwd && `${cwd}/.claude/settings.local.json`, cwd && `${cwd}/.claude/settings.json`, home && `${home}/.claude/settings.json`]
  for (const file of files) {
    if (!file) continue
    try {
      const value = JSON.parse(await $.fs.read(file)).promptCacheTtl
      if (value === '5m' || value === '1h') return value
    } catch {
      // missing or unreadable: the next file
    }
  }
  return undefined
}

export const register: Register = (on, options) => {
  const policy: Policy = {
    warnMs: positive(options.warnSeconds, 60) * 1000,
    compactAtTokens: positive(options.compactAtTokens, 100_000),
  }
  const showBand = options.band !== false
  const showStatus = options.status === true
  const wantToast = options.toast !== false

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    samples = []
    lastKey = ''
    toastedFor = 0
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
    setting = await readSetting($)
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

    timer?.cancel()
    timer = $.clock.every(1000, () => {
      const now = Date.now()
      const { last, advice, left } = current(policy, now)
      const key = `${advice.kind}|${advice.text}|${left > 0 ? fmtClock(left) : ''}`
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
    const { last, advice, left } = current(policy, Date.now())
    if (!last && advice.kind !== 'off') return next(e)
    const { Box, Text } = $.ui.resolve(e)
    // the band is the transcript column, narrower than the viewport while a Pane is docked
    const columns = e.props.bodyColumns ?? e.viewport?.columns ?? 100
    const color = COLOR[advice.kind]
    // the band is shared: what the mods after this one draw goes under this row instead of being replaced
    const rest = await next(e)

    const ratio = last ? hitRatio(last) : 0
    const wide = columns >= 90
    const row = !last ? (
      <Text dimColor>{fit(`cache: ${advice.text}`, columns)}</Text>
    ) : (
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
        {advice.kind !== 'uncached' && advice.kind !== 'off' && (
          <Text bold color={left > 0 ? lifeColor(left, ttl, policy.warnMs) : 'red'}>{left > 0 ? `⏱ ${fmtClock(left)}` : '⏱ 0:00'}</Text>
        )}
        <Text dimColor wrap="truncate-end">{`${ttl} · ${advice.text}`}</Text>
      </Box>
    )
    return isBlank(rest) ? row : (
      <Box flexDirection="column">
        {row}
        {rest}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const width = Math.max(30, e.props.bodyColumns - 1)
    // HTML collapses runs of spaces and trims a text's ends; a no-break space keeps them
    const sp = (t: string) => (e.surface === 'terminal' ? t : t.replace(/ /g, ' '))
    const now = Date.now()
    const { last, advice, left } = current(policy, now)
    const all = byTurn(samples)
    const counting = !!last && advice.kind !== 'uncached' && advice.kind !== 'off'
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
