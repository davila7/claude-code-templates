import type { Engine } from '../hooks/engine.ts';

declare function setTimeout(callback: () => void, delay: number): unknown;

/** How the engine words a call that a mode such as `claude -p` does not offer. */
export function notInThisMode(call: string): string {
  return `smartcompact: ${call} is not available in this mode: no session is bound in this process`;
}

/** How the engine words a compaction the person cancelled. */
export const COMPACTION_CANCELLED = 'smartcompact: $.session.compact: Compaction canceled.';

/** What a stub engine did. */
export type StubRecord = {
  statuses: (string | undefined)[];
  /** How many retries were set on the clock. */
  timers: number;
  files: Map<string, string>;
};

/**
 * A plain Engine for a test where a call must fail with the engine's own words. The test kit skips a test hook that
 * throws and answers "no implementation" in its place, so `fakeSession` cannot give such an error.
 */
export function stubEngine(overrides: Partial<Engine>): { engine: Engine; record: StubRecord } {
  const record: StubRecord = { statuses: [], timers: 0, files: new Map() };
  const engine: Engine = {
    pluginRoot: () => 'C:/plugin/smartcompact',
    now: async () => 0,
    after: () => {
      record.timers += 1;

      return { cancel: () => undefined };
    },
    status: (text) => void record.statuses.push(text),
    sessionId: async () => 'session-1',
    cwd: async () => 'C:/work',
    usage: async () => ({ startedAt: 0, context: { tokens: 70000, window: 200000 }, rateLimits: [] }),
    messages: async () => [],
    agents: async () => [],
    readPrompt: async () => ({ text: '', cursor: 0 }),
    fillPrompt: async () => ({ isFilled: true, text: '', cursor: 0 }),
    submitPrompt: async (input) => ({ text: input.text }),
    appendNote: async () => ({ deny: 'no notes in the stub' }),
    compact: async () => ({ messages: [] }),
    registerCommand: async (command) => ({ command: command.name }),
    complete: async () => ({ isAnswered: false, reason: 'empty-reply', usage: NO_USAGE }),
    fs: {
      exists: async (path) => record.files.has(path),
      list: async () => [],
      stat: async () => { throw new Error('no files to stat in the stub'); },
      read: async (path) => record.files.get(path) ?? '',
      write: async (path, text) => void record.files.set(path, text),
    },
    store: { get: async () => undefined, set: async () => undefined, delete: async () => undefined },
    env: {
      configDir: async () => undefined,
      logFile: async () => LOG_FILE,
      userProfile: async () => undefined,
      home: async () => undefined,
    },
    ...overrides,
  };

  return { engine, record };
}

/** The lines the plugin wrote to the stub's log, in order. */
export function stubLoggedLines(record: StubRecord): Record<string, unknown>[] {
  const log = record.files.get(LOG_FILE) ?? '';

  return log.split('\n').filter((line) => line !== '').map((line) => JSON.parse(line));
}

/** Lets background log writes finish even when they need more promise rounds. */
export async function settleStub(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

const LOG_FILE = 'C:/log.jsonl';
const NO_USAGE = { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };
