/**
 * websearch-to-exa — Claude Mod (EARLY ACCESS)
 *
 * Overrides the built-in WebSearch tool and routes the query to the Exa
 * search API through `$.http.fetch`. On success the hook answers `{ result }`
 * in WebSearch's own output shape without calling `next` (the built-in search
 * never runs); with no key configured, or when Exa fails, it falls back to
 * the built-in search.
 *
 * The API key comes from the plugin's options (userConfig "exaApiKey").
 * Never hardcode it in this file.
 *
 * Needs CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 (Claude Code >= 2.1.259). Typed
 * against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods
 *
 * Options:
 *   exaApiKey:  string   Exa API key (required to activate)
 *   numResults: number   results per query (default 8)
 *   type:       string   "auto" | "neural" | "keyword" (default "auto")
 */
import type { Register } from 'claude-code'

interface ExaResult { title?: string; url: string; text?: string; highlights?: string[]; publishedDate?: string }

export const register: Register = (on, options) => {
  const apiKey = typeof options.exaApiKey === 'string' ? options.exaApiKey : ''
  const numResults = typeof options.numResults === 'number' ? options.numResults : 8
  const searchType = typeof options.type === 'string' ? options.type : 'auto'

  on('tool.call', { tool: 'WebSearch' }, async ($, e, next) => {
    if (!apiKey) {
      $.ui.log('[websearch-to-exa] no exaApiKey configured, using built-in WebSearch')
      return next(e)
    }
    if (!e.query) return next(e)

    const startedAt = Date.now()
    try {
      const response = await $.http.fetch('https://api.exa.ai/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({
          query: e.query,
          type: searchType,
          numResults,
          includeDomains: e.allowed_domains,
          excludeDomains: e.blocked_domains,
          contents: { highlights: { maxCharacters: 400 } },
        }),
      })

      if (!response.ok) throw new Error(`Exa responded ${response.status}`)
      const data = JSON.parse(response.text) as { results?: ExaResult[] }
      const results = data.results ?? []

      $.ui.log(`[websearch-to-exa] ${results.length} results for "${e.query}"`)

      // Answer in the WebSearch tool's own output shape: a hits block plus a
      // text block carrying the snippets, so the model reads it like a built-in search.
      const snippets = results
        .map((r, i) => {
          const snippet = (r.highlights ?? []).join(' … ') || (r.text ?? '').slice(0, 400)
          const date = r.publishedDate ? ` (${r.publishedDate.slice(0, 10)})` : ''
          return `${i + 1}. ${r.title ?? r.url}${date}\n   ${r.url}\n   ${snippet}`
        })
        .join('\n')

      return {
        result: {
          query: e.query,
          results: [
            {
              tool_use_id: e.tool_use_id ?? '',
              content: results.map((r) => ({ title: r.title ?? r.url, url: r.url })),
            },
            `Results from Exa (${searchType} search):\n${snippets}`,
          ],
          durationSeconds: (Date.now() - startedAt) / 1000,
          searchCount: 1,
        },
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      $.ui.log(`[websearch-to-exa] Exa failed (${message}), falling back to built-in WebSearch`)
      return next(e)
    }
  })
}
