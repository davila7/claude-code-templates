/**
 * tool-timing-badge — Function Hook (EXPERIMENTAL)
 *
 * Measures how long every tool call takes and draws a duration badge next to
 * the engine's own ToolUse rendering, on the terminal and on Desktop alike.
 * Two hooks: "after" on tool.call (timing), "after" on ui.render (drawing).
 *
 * Function hooks are an Anthropic proposal under community review:
 * https://github.com/anthropics/claude-code/issues/91870
 * Every API name below is provisional. The ToolUse component props are
 * declared public API in the design doc (§3.2.2) but not yet published, so
 * the id / tool fields read here are assumptions.
 */

type Engine = any;
type Next = ((e: any) => Promise<any>) & { event: string; origin: string; signal: AbortSignal };

const durations = new Map<string, number>();
let lastByTool = new Map<string, number>();

function badgeColor(ms: number, slowMs: number): string {
  if (ms >= slowMs) return "red";
  if (ms >= slowMs / 4) return "yellow";
  return "green";
}

function format(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

export function register(on: any, options: Record<string, any> = {}) {
  const slowMs: number = options.slowMs ?? 5000;

  // 1. Time every tool call. Runs "during" the call so the badge is exact.
  on("tool.call", async ($: Engine, e: any, next: Next) => {
    const startedAt = Date.now();
    try {
      return await next(e);
    } finally {
      const ms = Date.now() - startedAt;
      if (e.id) durations.set(e.id, ms);
      lastByTool.set(e.tool, ms);
      if (ms >= slowMs) $.ui.log(`[tool-timing-badge] slow ${e.tool}: ${format(ms)}`);
    }
  });

  // 2. Wrap the engine's ToolUse rendering with a badge (design doc listing 2).
  on("ui.render", { component: "ToolUse" }, async ($: Engine, e: any, next: Next) => {
    const { Row, Badge } = $.ui.resolve(e);
    const rendered = await next(e);

    const ms = durations.get(e.props?.id) ?? lastByTool.get(e.props?.tool);
    if (ms === undefined) return rendered;

    return (
      <Row>
        {rendered}
        <Badge text={format(ms)} color={badgeColor(ms, slowMs)} />
      </Row>
    );
  });
}
