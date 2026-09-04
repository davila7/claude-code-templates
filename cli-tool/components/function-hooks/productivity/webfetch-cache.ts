/**
 * webfetch-cache — Function Hook (EXPERIMENTAL)
 *
 * Short-circuits repeated WebFetch calls for the same URL + prompt within a
 * session. Placement: "instead" on a cache hit, "after" on a miss (awaits the
 * real fetch, stores the result, returns it).
 *
 * Function hooks are an Anthropic proposal under community review:
 * https://github.com/anthropics/claude-code/issues/91870
 * Every API name below is provisional.
 */

type Engine = any;
type Next = ((e: any) => Promise<any>) & { event: string; origin: string; signal: AbortSignal };

interface Entry { result: any; storedAt: number }

// Module state lives for the session. A persistent store would be added to $
// through an engine.create hook (design doc §4.1) once the "files" primitive
// is documented; a Map keeps this example honest about what is known today.
const cache = new Map<string, Entry>();

function keyFor(e: any): string {
  return `${e.url ?? ""}\n${e.prompt ?? ""}`;
}

export function register(on: any, options: Record<string, any> = {}) {
  const ttlMs: number = (options.ttlSeconds ?? 900) * 1000;
  const maxEntries: number = options.maxEntries ?? 200;

  on("tool.call", { tool: "WebFetch" }, async ($: Engine, e: any, next: Next) => {
    if (!e.url) return next(e);
    const key = keyFor(e);
    const now = Date.now();

    const hit = cache.get(key);
    if (hit && now - hit.storedAt < ttlMs) {
      $.ui.log(`[webfetch-cache] hit for ${e.url} (${Math.round((now - hit.storedAt) / 1000)}s old)`);
      return hit.result; // nothing below this hook runs: no network call
    }

    const result = await next(e);

    // Do not cache a denial or an empty result.
    if (result && !result.deny) {
      if (cache.size >= maxEntries) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
      }
      cache.set(key, { result, storedAt: now });
    }
    return result;
  });
}
