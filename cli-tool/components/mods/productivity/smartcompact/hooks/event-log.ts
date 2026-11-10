import type { Engine } from './engine.ts';
import { logFilePath } from './log-paths.ts';

export type EventDetails = Record<string, unknown>;

// `$.fs` has no append and reads at most 4 MiB, so a long log keeps only its newest part.
const MAX_LOG_CHARS = 2_000_000;
const KEPT_LOG_CHARS = 1_000_000;

// One write at a time, so two events of one session never overwrite each other.
let pendingWrite: Promise<void> = Promise.resolve();

/** Adds one JSON line to the log file in the background. It never throws. */
export function logEvent(engine: Engine, event: string, details: EventDetails = {}): void {
  pendingWrite = pendingWrite.then(() => appendLine(engine, event, details)).catch(() => undefined);
}

async function appendLine(engine: Engine, event: string, details: EventDetails): Promise<void> {
  const path = await logFilePath(engine);
  const line = JSON.stringify(await lineFor(engine, event, details));
  const existing = (await engine.fs.exists(path)) ? await engine.fs.read(path) : '';

  await engine.fs.write(path, `${newestPartOf(existing)}${line}\n`);
}

/** The fixed fields come first and the event details follow, as in the wrapper's log. */
async function lineFor(engine: Engine, event: string, details: EventDetails): Promise<EventDetails> {
  return {
    time: new Date(await engine.now()).toISOString(),
    event,
    session: await engine.sessionId(),
    cwd: await engine.cwd(),
    ...details,
  };
}

function newestPartOf(log: string): string {
  if (log.length <= MAX_LOG_CHARS) {
    return log;
  }

  return log.slice(log.indexOf('\n', log.length - KEPT_LOG_CHARS) + 1);
}
