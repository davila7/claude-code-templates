import type { Engine } from './engine.ts';
import { logFilePath } from './log-paths.ts';

export type EventDetails = Record<string, unknown>;

// The fs has no append, so the cap keeps each read and rewrite small.
// The fs has no delete, so old session files stay, each capped.
const MAX_LOG_BYTES = 300_000;
const KEPT_LOG_BYTES = 150_000;

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

  await engine.fs.write(path, newestPartOf(`${existing}${line}\n`));
}

/** The fixed fields come first and the event details follow, as in the wrapper's log. */
async function lineFor(engine: Engine, event: string, details: EventDetails): Promise<EventDetails> {
  return {
    time: new Date(await engine.now()).toISOString(),
    event,
    session: await engine.sessionId(),
    cwd: await engine.cwd(),
    ...details,
    ...(typeof details['message'] === 'string' ? { message: details['message'].slice(0, 200) } : {}),
  };
}

export function newestPartOf(log: string): string {
  if (utf8Bytes(log) <= MAX_LOG_BYTES) {
    return log;
  }

  let start = log.length;
  let bytes = 0;

  while (start > 0) {
    const previous = log.lastIndexOf('\n', start - 2) + 1;
    bytes += utf8Bytes(log.slice(previous, start));

    if (bytes > KEPT_LOG_BYTES) {
      break;
    }

    start = previous;
  }

  return log.slice(start);
}

function utf8Bytes(text: string): number {
  let bytes = 0;

  for (const char of text) {
    const code = char.codePointAt(0)!;
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }

  return bytes;
}
