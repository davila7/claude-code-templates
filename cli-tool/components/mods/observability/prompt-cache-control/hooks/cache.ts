/**
 * cache.ts — the pure half of prompt-cache-control: no `$`, no engine.
 *
 * What it models, from Anthropic's prompt-caching documentation:
 *   - the cache lives 5 minutes by default, 1 hour when asked for; a read
 *     refreshes the entry at no extra cost, and the lifetime is measured from
 *     the START of the request that wrote or read it
 *   - a request's prompt is `input_tokens` (uncached remainder) +
 *     `cache_read_input_tokens` + `cache_creation_input_tokens`
 *   - writes cost 1.25x base input for 5m and 2x for 1h; reads about 0.1x
 *     (less on some models), so an expired cache on a large context is the
 *     expensive moment
 *   - a prefix change (model, effort/thinking settings, tool set, system
 *     prompt) makes the next request write instead of read
 *
 * Claude Code's own switches (read from the environment):
 *   ENABLE_PROMPT_CACHING_1H=1   ask for the 1-hour TTL
 *   FORCE_PROMPT_CACHING_5M=1    force the 5-minute TTL, beating the above
 *   DISABLE_PROMPT_CACHING=1     no caching; DISABLE_PROMPT_CACHING_{HAIKU,SONNET,OPUS}
 *                                 turn it off for that model family only
 */

export type Ttl = '5m' | '1h'

export type CacheEnv = {
  enable1h?: string
  force5m?: string
  disableAll?: string
  disableHaiku?: string
  disableSonnet?: string
  disableOpus?: string
}

/** One main-loop request, as the API reported it. */
export type Sample = {
  turnId: string
  index: number
  model: string
  /** ms since the epoch when the request started: the cache's lifetime is counted from here */
  startedAt: number
  read: number
  write: number
  fresh: number
  output: number
}

export type AdviceKind = 'off' | 'cold' | 'uncached' | 'warm' | 'soon' | 'expired' | 'miss'

export type Advice = {
  kind: AdviceKind
  /** one sentence for the band */
  text: string
}

export type Policy = {
  ttl: Ttl
  warnMs: number
  compactAtTokens: number
}

export const isOn = (v: string | undefined) => v === '1' || v?.toLowerCase() === 'true'

export function resolveTtl(option: unknown, env: CacheEnv): Ttl {
  if (option === '5m' || option === '1h') return option
  if (isOn(env.force5m)) return '5m'
  return isOn(env.enable1h) ? '1h' : '5m'
}

export function ttlMs(ttl: Ttl): number {
  return ttl === '1h' ? 3_600_000 : 300_000
}

/** Caching switched off for this model by the environment. */
export function isCachingDisabled(model: string, env: CacheEnv): boolean {
  if (isOn(env.disableAll)) return true
  const name = model.toLowerCase()
  if (name.includes('haiku')) return isOn(env.disableHaiku)
  if (name.includes('sonnet')) return isOn(env.disableSonnet)
  if (name.includes('opus')) return isOn(env.disableOpus)
  return false
}

export const promptTokens = (s: Sample) => s.read + s.write + s.fresh

/** Share of the prompt the cache served, 0 to 1; 0 for an empty prompt. */
export function hitRatio(s: Sample): number {
  const total = promptTokens(s)
  return total === 0 ? 0 : s.read / total
}

/** When the cache entry the sample touched lapses, ms since the epoch. */
export const expiresAt = (s: Sample, ttl: Ttl) => s.startedAt + ttlMs(ttl)

/** Zero for a request that read and wrote nothing: it created or refreshed no entry, so there is nothing to count down. */
export function remainingMs(s: Sample, ttl: Ttl, now: number): number {
  if (s.read + s.write === 0) return 0
  return Math.max(0, expiresAt(s, ttl) - now)
}

/**
 * Why a request that should have read the cache wrote it instead; undefined
 * when it did not miss. A prompt that shrank is a /compact or /clear, not a
 * miss, and the first request of a session has nothing to read.
 */
export function missReason(prev: Sample | undefined, cur: Sample, ttl: Ttl): string | undefined {
  if (!prev) return undefined
  const before = promptTokens(prev)
  if (before === 0 || promptTokens(cur) < before * 0.7) return undefined
  if (cur.read >= before * 0.5 || cur.write === 0) return undefined
  if (cur.model !== prev.model) return `model changed (${prev.model} to ${cur.model})`
  if (cur.startedAt - prev.startedAt > ttlMs(ttl)) return `the ${ttl} cache had lapsed`
  return 'the prompt prefix changed (effort, tools, system prompt or CLAUDE.md)'
}

export function advise(last: Sample | undefined, prev: Sample | undefined, policy: Policy, now: number, disabled: boolean): Advice {
  if (disabled) return { kind: 'off', text: 'prompt caching is off for this model (DISABLE_PROMPT_CACHING*)' }
  if (!last) return { kind: 'cold', text: 'no request yet: the first one writes the cache' }
  if (last.read + last.write === 0) {
    return { kind: 'uncached', text: 'this request was not cached (prompt under the model minimum, or caching off)' }
  }
  const miss = missReason(prev, last, policy.ttl)
  const left = remainingMs(last, policy.ttl, now)
  const size = promptTokens(last)
  if (left <= 0) {
    const big = size >= policy.compactAtTokens
    return {
      kind: 'expired',
      text: big
        ? `expired: the next message rewrites ${fmtTokens(size)} tokens. /compact first, or /clear if the task is done`
        : `expired: only ${fmtTokens(size)} tokens to rebuild, just keep going`,
    }
  }
  if (left <= policy.warnMs) {
    return { kind: 'soon', text: 'expires soon: any message refreshes it for free' }
  }
  if (miss) return { kind: 'miss', text: `cache missed: ${miss}` }
  return { kind: 'warm', text: 'warm: keep going' }
}

export function fmtTokens(n: number): string {
  if (n < 1000) return String(n)
  if (n < 100_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
}

/** m:ss, or h:mm:ss from an hour up. */
export function fmtClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

export function bar(ratio: number, width: number): string {
  const filled = Math.round(Math.min(1, Math.max(0, ratio)) * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

export type TurnRow = {
  turnId: string
  steps: number
  read: number
  write: number
  fresh: number
  output: number
}

/** Samples grouped by turn, oldest first, each turn's requests summed. */
export function byTurn(samples: readonly Sample[]): TurnRow[] {
  const rows: TurnRow[] = []
  for (const s of samples) {
    let row = rows[rows.length - 1]
    if (!row || row.turnId !== s.turnId) {
      row = { turnId: s.turnId, steps: 0, read: 0, write: 0, fresh: 0, output: 0 }
      rows.push(row)
    }
    row.steps += 1
    row.read += s.read
    row.write += s.write
    row.fresh += s.fresh
    row.output += s.output
  }
  return rows
}

export const rowRatio = (r: TurnRow) => {
  const total = r.read + r.write + r.fresh
  return total === 0 ? 0 : r.read / total
}

export function fit(text: string, width: number): string {
  return text.length <= width ? text : `${text.slice(0, Math.max(0, width - 1))}…`
}

export function positive(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fallback
}
