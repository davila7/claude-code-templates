import type { ContextFloor, FirstTurnReason, FloorState } from './context-floor.ts';
import type { Engine } from './engine.ts';

// One store key holds every session's floor state, keyed by session id.
const STORE_KEY = 'floors';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

type SavedFloor = FloorState & { savedAt: number };

type SavedFloors = Record<string, SavedFloor>;

/** Reads the state saved for this session id. Returns undefined when none is saved. */
export async function loadFloorState(engine: Engine, sessionId: string): Promise<FloorState | undefined> {
  const saved = (await readSavedFloors(engine))[sessionId];

  if (saved === undefined) {
    return undefined;
  }

  return { baseline: saved.baseline, waitingFor: saved.waitingFor };
}

/** Saves the floor under the current session id and drops the entries older than 30 days. */
export async function saveFloorState(engine: Engine, floor: ContextFloor): Promise<void> {
  const now = await engine.now();
  const sessionId = await engine.sessionId();
  const floors = withoutOldEntries(await readSavedFloors(engine), now);

  floors[sessionId] = { ...floor.state(), savedAt: now };

  await engine.store.set(STORE_KEY, floors);
}

async function readSavedFloors(engine: Engine): Promise<SavedFloors> {
  const value = await engine.store.get(STORE_KEY);

  if (typeof value !== 'object' || value === null) {
    return {};
  }

  return Object.fromEntries(Object.entries(value).filter(([, entry]) => isSavedFloor(entry)));
}

function withoutOldEntries(floors: SavedFloors, now: number): SavedFloors {
  return Object.fromEntries(Object.entries(floors).filter(([, saved]) => now - saved.savedAt <= MAX_AGE_MS));
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
