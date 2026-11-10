import type { ContextFloor } from './context-floor.ts';
import type { Engine } from './engine.ts';
import { loadFloorState } from './floor-store.ts';

/**
 * Sets the floor for a starting session. Saved state for this session id wins, so a resume keeps its count.
 * Without it the session counts as new, also a resume, because its startup context is not work done.
 */
export async function startFloor(engine: Engine, floor: ContextFloor): Promise<void> {
  const saved = await loadFloorState(engine, await engine.sessionId());

  if (saved !== undefined) {
    floor.restore(saved);

    return;
  }

  // Also replaces the floor of the previous session after a /resume to another session in the same process.
  floor.startNewSession();
}
