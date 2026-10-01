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
 * The lifetime is counted from the start of the request that last wrote or
 * read the cache, as Anthropic documents it, and the TTL comes from the
 * environment variables Claude Code honours (see ./cache.ts). The API's usage
 * block does not say which TTL a write used, so `ttl: "auto"` is the
 * environment's request, not an observation; set `ttl` to override it.
 *
 * Needs CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 (Claude Code >= 2.1.259).
 *
 * Options (pluginConfigs["prompt-cache-control@skills-dir"].options):
 *   ttl: "auto" | "5m" | "1h"   cache lifetime (default auto)
 *   warnSeconds: number         countdown threshold for the warning (default 60)
 *   compactAtTokens: number     prompt size that makes an expired cache suggest /compact (default 100000)
 *   band: boolean               row above the prompt (default true)
 *   status: boolean             entry under the prompt (default false)
 *   toast: boolean              one toast per entry near expiry (default true)
 */
import type { Register } from 'claude-code'
import {
  advise,
  bar,
  byTurn,
  fit,
  fmtClock,
  fmtTokens,
  hitRatio,
  isCachingDisabled,
  isOn,
  positive,
  promptTokens,
  remainingMs,
  resolveTtl,
  rowRatio,
} from './cache.ts'
import type { Advice, CacheEnv, Sample, Ttl } from './cache.ts'

const PANE = 'cache'
const COMMAND = 'cache'
const KEEP = 200
// below this a lapsed cache costs too little to interrupt anyone about
const TOAST_MIN_TOKENS = 20_000

let samples: Sample[] = []
let ttl: Ttl = '5m'
let ttlSource = 'default'
let env: CacheEnv = {}
let timer: { cancel: () => void } | undefined
let lastKey = ''
let toastedFor = 0
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
      disableAll: await $.env.get('DISABLE_PROMPT_CACHING').catch(none),
      disableHaiku: await $.env.get('DISABLE_PROMPT_CACHING_HAIKU').catch(none),
      disableSonnet: await $.env.get('DISABLE_PROMPT_CACHING_SONNET').catch(none),
      disableOpus: await $.env.get('DISABLE_PROMPT_CACHING_OPUS').catch(none),
    }
    ttl = resolveTtl(options.ttl, env)
    ttlSource =
      options.ttl === '5m' || options.ttl === '1h'
        ? 'option'
        : isOn(env.force5m)
          ? 'FORCE_PROMPT_CACHING_5M'
          : isOn(env.enable1h)
            ? 'ENABLE_PROMPT_CACHING_1H'
            : 'default'

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
      if (
        wantToast &&
        last &&
        advice.kind === 'soon' &&
        toastedFor !== last.startedAt &&
        promptTokens(last) >= TOAST_MIN_TOKENS
      ) {
        toastedFor = last.startedAt
        $.ui.toast(`cache expires in ${fmtClock(left)}: send a message to keep ${fmtTokens(promptTokens(last))} tokens warm`)
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
    const columns = e.viewport?.columns ?? 100
    const color = COLOR[advice.kind]

    if (!last) return <Text dimColor>{fit(`cache: ${advice.text}`, columns)}</Text>

    const ratio = hitRatio(last)
    const wide = columns >= 90
    return (
      <Box flexDirection="row" columnGap={1}>
        <Text dimColor>cache</Text>
        <Text color={color}>{bar(ratio, wide ? 10 : 6)}</Text>
        <Text bold>{`${Math.round(ratio * 100)}%`}</Text>
        <Text dimColor>
          {wide
            ? `read ${fmtTokens(last.read)} · wrote ${fmtTokens(last.write)} · new ${fmtTokens(last.fresh)}`
            : `${fmtTokens(promptTokens(last))} tok`}
        </Text>
        <Text color={color}>{left > 0 ? `⏱ ${fmtClock(left)}` : '⏱ 0:00'}</Text>
        <Text dimColor wrap="truncate-end">{`${ttl} · ${advice.text}`}</Text>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const width = Math.max(30, e.props.bodyColumns - 1)
    const now = Date.now()
    const { last, advice, left } = current(policy, now)
    const all = byTurn(samples)
    const rows = all.slice(-Math.max(3, (e.viewport?.rows ?? 24) - 9))
    const color = COLOR[advice.kind]
    const head = (n: string, w: number) => n.padStart(w)

    return (
      <Box flexDirection="column">
        <Text bold>{`${ttl} cache (${ttlSource})${left > 0 ? ` · ⏱ ${fmtClock(left)}` : ''}`}</Text>
        <Text color={color}>{fit(advice.text, width)}</Text>
        {last ? (
          <Text dimColor>{fit(`${last.model} · prompt ${fmtTokens(promptTokens(last))} tokens`, width)}</Text>
        ) : null}

        <Box key="table" flexDirection="column" marginTop={1}>
          <Text bold color="cyan">{`${head('turn', 4)} ${head('steps', 5)} ${head('read', 7)} ${head('wrote', 7)} ${head('new', 7)} ${head('hit', 4)}`}</Text>
          {rows.length === 0 ? <Text dimColor>no requests yet</Text> : null}
          {rows.map((row, i) => {
            const n = all.length - rows.length + i + 1
            const pct = Math.round(rowRatio(row) * 100)
            return (
              <Text key={`t:${row.turnId}`}>
                {`${head(String(n), 4)} ${head(String(row.steps), 5)} ${head(fmtTokens(row.read), 7)} ${head(fmtTokens(row.write), 7)} ${head(fmtTokens(row.fresh), 7)} `}
                <Text color={pct >= 80 ? 'green' : pct >= 40 ? 'yellow' : 'red'}>{head(`${pct}%`, 4)}</Text>
              </Text>
            )
          })}
        </Box>

        <Box key="foot" marginTop={1} flexDirection="column">
          <Button key="close" label="close" onPress={() => {}} />
          <Text dimColor>{fit('read = served by the cache · wrote = new cache entry · new = uncached', width)}</Text>
        </Box>
      </Box>
    )
  })
}
