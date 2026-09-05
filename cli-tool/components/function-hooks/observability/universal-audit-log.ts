/**
 * universal-audit-log — Function Hook (EXPERIMENTAL)
 *
 * One hook on "*" sees every event on $, including every other plugin's own
 * calls, and appends a JSON line per dispatch: who raised it, what it was,
 * how long it took and whether something below denied it.
 * Placement: "after" (wraps next so the outcome is recorded too).
 *
 * Register this plugin FIRST (prepend it in managed settings) so nothing
 * beneath it can bypass the log — design doc §5.
 *
 * Function hooks are an Anthropic proposal under community review:
 * https://github.com/anthropics/claude-code/issues/91870
 * Every API name below is provisional. $.fs.append is the assumed shape of
 * the "files" primitive.
 */

type Engine = any;
type Next = ((e: any) => Promise<any>) & { event: string; origin: string; signal: AbortSignal; is: (type: string, e: any) => boolean };

const MAX_FIELD = 200;

function summarize(e: any): Record<string, unknown> {
  if (!e || typeof e !== "object") return { value: String(e).slice(0, MAX_FIELD) };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(e)) {
    if (typeof v === "string") out[k] = v.length > MAX_FIELD ? v.slice(0, MAX_FIELD) + "…" : v;
    else if (typeof v === "number" || typeof v === "boolean") out[k] = v;
    else if (Array.isArray(v)) out[k] = `[array:${v.length}]`;
    else if (v && typeof v === "object") out[k] = `[object]`;
  }
  return out;
}

export function register(on: any, options: Record<string, any> = {}) {
  const logPath: string = options.path ?? ".claude/logs/function-hooks-audit.jsonl";
  const skip = new Set<string>(options.skipEvents ?? ["ui.log", "ui.render", "ui.resolve"]);

  on("*", async ($: Engine, e: any, next: Next) => {
    if (skip.has(next.event)) return next(e);

    const startedAt = Date.now();
    let outcome = "ok";
    let result: any;
    try {
      result = await next(e);
      if (result && typeof result === "object" && "deny" in result) outcome = `denied: ${result.deny}`;
    } catch (err: any) {
      outcome = `threw: ${err?.message ?? String(err)}`;
      throw err;
    } finally {
      const line = JSON.stringify({
        ts: new Date(startedAt).toISOString(),
        event: next.event,
        origin: next.origin,
        durationMs: Date.now() - startedAt,
        outcome,
        input: summarize(e),
      });
      // The hook is not re-entered for its own $.fs call (design doc §6.4),
      // so appending from inside a "*" hook does not recurse.
      await $.fs.append({ path: logPath, data: line + "\n" });
    }
    return result;
  });
}
