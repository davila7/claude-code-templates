/**
 * websearch-to-exa — Function Hook (EXPERIMENTAL)
 *
 * Overrides the built-in WebSearch tool and routes the query to the Exa
 * search API instead. Placement: "instead" (never calls next on success);
 * falls back to the built-in search when no key is configured or Exa fails.
 *
 * The API key comes from the plugin's userConfig (options.exaApiKey).
 * Never hardcode it in this file.
 *
 * Function hooks are an Anthropic proposal under community review:
 * https://github.com/anthropics/claude-code/issues/91870
 * Every API name below is provisional. $.http.fetch is the assumed shape of
 * the "network" primitive, and the WebSearch result shape is a guess.
 */

type Engine = any;
type Next = ((e: any) => Promise<any>) & { event: string; origin: string; signal: AbortSignal };

interface ExaResult { title?: string; url: string; text?: string; highlights?: string[]; publishedDate?: string }

export function register(on: any, options: Record<string, any> = {}) {
  const apiKey: string | undefined = options.exaApiKey;
  const numResults: number = options.numResults ?? 8;
  const searchType: string = options.type ?? "auto"; // "auto" | "neural" | "keyword"

  on("tool.call", { tool: "WebSearch" }, async ($: Engine, e: any, next: Next) => {
    if (!apiKey) {
      $.ui.log("[websearch-to-exa] no exaApiKey configured, using built-in WebSearch");
      return next(e);
    }
    if (!e.query) return next(e);

    try {
      const response = await $.http.fetch({
        url: "https://api.exa.ai/search",
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({
          query: e.query,
          type: searchType,
          numResults,
          includeDomains: e.allowed_domains,
          excludeDomains: e.blocked_domains,
          contents: { highlights: { maxCharacters: 400 } },
        }),
        signal: next.signal, // abort the request if the dispatch is cancelled
      });

      if (response.status !== 200) throw new Error(`Exa responded ${response.status}`);
      const data = await response.json();
      const results: ExaResult[] = data.results ?? [];

      $.ui.log(`[websearch-to-exa] ${results.length} results for "${e.query}"`);
      return {
        source: "exa",
        query: e.query,
        results: results.map((r) => ({
          title: r.title ?? r.url,
          url: r.url,
          snippet: (r.highlights ?? []).join(" … ") || (r.text ?? "").slice(0, 400),
          publishedDate: r.publishedDate,
        })),
      };
    } catch (err: any) {
      $.ui.log(`[websearch-to-exa] Exa failed (${err?.message ?? err}), falling back to built-in WebSearch`);
      return next(e);
    }
  });
}
