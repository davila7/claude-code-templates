import type { ContextFloor, FirstTurnReason, FloorState } from './context-floor.ts';
import type { Engine } from './engine.ts';

const INDEX_KEY = 'floor-index';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

type SavedFloor = FloorState & { savedAt: number };

/** Reads the state saved for this session id. Returns undefined when none is saved. */
export async function loadFloorState(engine: Engine, sessionId: string): Promise<FloorState | undefined> {
  let saved = await engine.store.get(`floor:${sessionId}`);

  // Read legacy state only when no new key exists, so old sessions still resume.
  if (saved === undefined) {
    const legacy = await engine.store.get('floors');
    if (typeof legacy === 'object' && legacy !== null) {
      saved = (legacy as Record<string, unknown>)[sessionId];
    }
  }

  if (!isSavedFloor(saved) || (await engine.now()) - saved.savedAt > MAX_AGE_MS) {
    return undefined;
  }

  return { baseline: saved.baseline, waitingFor: saved.waitingFor };
}

/** Saves the floor under the current session id and drops the entries older than 30 days. */
export async function saveFloorState(engine: Engine, floor: ContextFloor): Promise<void> {
  const now = await engine.now();
  const sessionId = await engine.sessionId();
  await engine.store.set(`floor:${sessionId}`, { ...floor.state(), savedAt: now });

  // Index races may leave a small key behind but cannot overwrite another session's floor.
  const value = await engine.store.get(INDEX_KEY);
  const index: Record<string, number> = {};

  if (typeof value === 'object' && value !== null) {
    for (const [id, savedAt] of Object.entries(value)) {
      if (id === sessionId || typeof savedAt !== 'number') {
        continue;
      }
      if (now - savedAt > MAX_AGE_MS) {
        await engine.store.delete(`floor:${id}`);
      } else {
        index[id] = savedAt;
      }
    }
  }

  index[sessionId] = now;
  await engine.store.set(INDEX_KEY, index);
}

function isSavedFloor(entry: unknown): entry is SavedFloor {
  const saved = entry as Partial<SavedFloor> | null;

  return (
    typeof saved === 'object' &&
    saved !== null &&
    typeof saved.baseline === 'number' &&
    typeof saved.savedAt === 'number' &&
    isWaitingFor(saved.waitingFor)
  );
}

function isWaitingFor(value: unknown): value is FirstTurnReason | null {
  return value === null || value === 'first turn of session' || value === 'first turn after compaction';
}
