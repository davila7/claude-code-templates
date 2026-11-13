import type { Engine } from './engine.ts';

/**
 * The context size in tokens. Undefined until the first response after a new session or a compaction.
 * A missing count is no size at all, so it must never stand in as 0.
 */
export async function contextTokens(engine: Engine): Promise<number | undefined> {
  return (await engine.usage()).context.tokens;
}
