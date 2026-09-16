/**
 * webfetch-cache — Claude Mod (EARLY ACCESS)
 *
 * Short-circuits repeated WebFetch calls for the same URL + prompt within a
 * session. On a cache hit the hook answers `{ result }` itself without calling
 * `next` (no network call); on a miss it awaits the real fetch, stores the
 * tool's record and returns what came back.
 *
 * Only the tool's own record (`result`) is cached, never core's `ref`: that
 * number names the messages core produced for one specific call and must not
 * be replayed on another.
 *
 * Needs CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 (Claude Code >= 2.1.259). Typed
 * against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods
 *
 * Options:
 *   ttlSeconds: number  how long an entry stays fresh (default 900)
 *   maxEntries: number  cache size (default 200)
 */
import type { Register, ToolCallResult } from 'claude-code'

type WebFetchRecord = Extract<ToolCallResult<'WebFetch'>, { result: unknown }>['result']

interface Entry { result: WebFetchRecord; storedAt: number }

// Module state lives for the session (a plugin's module is one worker).
const cache = new Map<string, Entry>()

export const register: Register = (on, options) => {
  const ttlMs = (typeof options.ttlSeconds === 'number' ? options.ttlSeconds : 900) * 1000
  const maxEntries = typeof options.maxEntries === 'number' ? options.maxEntries : 200

  on('tool.call', { tool: 'WebFetch' }, async ($, e, next) => {
    if (!e.url) return next(e)
    const key = `${e.url}\n${e.prompt}`
    const now = Date.now()

    const hit = cache.get(key)
    if (hit && now - hit.storedAt < ttlMs) {
      const age = Math.round((now - hit.storedAt) / 1000)
      $.ui.log(`[webfetch-cache] hit for ${e.url} (${age}s old)`)
      // Nothing below this hook runs: no network call.
      return {
        result: hit.result,
        context: [`webfetch-cache served this result from a ${age}s-old cache entry for the same URL and prompt.`],
      }
    }

    const outcome = await next(e)

    // Do not cache a denial or an errored fetch.
    if (outcome.deny === undefined && !outcome.isError) {
      if (cache.size >= maxEntries) {
        const oldest = cache.keys().next().value
        if (oldest !== undefined) cache.delete(oldest)
      }
      cache.set(key, { result: outcome.result, storedAt: now })
    }
    return outcome
  })
}
