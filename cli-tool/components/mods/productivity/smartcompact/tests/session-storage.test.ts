import { expect, test } from 'claude-code/testing';
import { ContextFloor } from '../hooks/context-floor.ts';
import { logEvent } from '../hooks/event-log.ts';
import { loadFloorState, saveFloorState } from '../hooks/floor-store.ts';
import { choicesFilePath, logFilePath } from '../hooks/log-paths.ts';
import { FAKE_HOME } from './fake-engine.ts';
import { settleStub, stubEngine } from './stub-engine.ts';

const NOW = Date.UTC(2026, 9, 10);
const DAY = 24 * 60 * 60 * 1000;
const FOLDER = `${FAKE_HOME}/.claude/smartcompact`;

function storageEngine(id: string, stored: Record<string, unknown> = {}, logFile?: string) {
  const store = new Map(Object.entries(stored));
  const { engine, record } = stubEngine({
    now: async () => NOW,
    sessionId: async () => id,
    store: {
      get: async (key) => store.get(key),
      set: async (key, value) => { store.set(key, JSON.parse(JSON.stringify(value))); },
      delete: async (key) => { store.delete(key); },
    },
    env: {
      configDir: async () => undefined,
      logFile: async () => logFile,
      userProfile: async () => undefined,
      home: async () => FAKE_HOME,
    },
  });

  return { engine, files: record.files, store };
}

test('concurrent sessions keep every log line in their own file', async () => {
  const { engine: first, files } = storageEngine('first');
  const second = { ...first, sessionId: async () => 'second' };

  await Promise.all([
    Promise.resolve().then(() => { logEvent(first, 'first-a'); logEvent(first, 'first-b'); }),
    Promise.resolve().then(() => { logEvent(second, 'second-a'); logEvent(second, 'second-b'); }),
  ]);
  await settleStub();

  for (const id of ['first', 'second']) {
    const lines = (files.get(`${FOLDER}/logs/${id}.jsonl`) ?? '').trim().split('\n');
    expect(lines.map((line) => JSON.parse(line).event)).toEqual([`${id}-a`, `${id}-b`]);
    expect(lines.map((line) => JSON.parse(line).session)).toEqual([id, id]);
  }
});

test('concurrent sessions still share the log override', async () => {
  const path = '/custom/events.jsonl';
  const { engine: first, files } = storageEngine('first', {}, path);
  const second = { ...first, sessionId: async () => 'second' };

  await Promise.all([
    Promise.resolve().then(() => logEvent(first, 'first')),
    Promise.resolve().then(() => logEvent(second, 'second')),
  ]);
  await settleStub();

  const lines = (files.get(path) ?? '').trim().split('\n').map((line) => JSON.parse(line));
  expect(lines.map((line) => line.session).sort()).toEqual(['first', 'second']);
  expect(await choicesFilePath(first)).toBe('/custom/choices.md');
});

test('default paths sanitize session ids and keep choices in the plugin folder', async () => {
  const { engine } = storageEngine('../a/b:c_1-2');

  expect(await logFilePath(engine)).toBe(`${FOLDER}/logs/abc_1-2.jsonl`);
  expect(await choicesFilePath(engine)).toBe(`${FOLDER}/choices.md`);
});

test('a log write near the cap trims before the next write reads it', async () => {
  const { engine, files } = storageEngine('first');
  const path = `${FOLDER}/logs/first.jsonl`;
  const oldLine = JSON.stringify({ event: 'old', padding: 'x'.repeat(971) }) + '\n';
  files.set(path, oldLine.repeat(300));
  const reads: string[] = [];
  const read = engine.fs.read;
  engine.fs.read = async (path) => {
    const text = await read(path);
    reads.push(text);
    return text;
  };

  logEvent(engine, 'first');
  logEvent(engine, 'second');
  await settleStub();

  expect(reads.length).toBe(2);
  expect(reads[0]).toBe(oldLine.repeat(300));
  const trimmed = reads[1]!;
  expect(trimmed.length <= 150_000).toBe(true);
  expect(trimmed.endsWith('\n')).toBe(true);
  expect(JSON.parse(trimmed.trim().split('\n').at(-1)!).event).toBe('first');
  const lines = files.get(path)!.trim().split('\n').map((line) => JSON.parse(line));
  expect(lines.slice(-2).map((line) => line.event)).toEqual(['first', 'second']);
});

test('concurrent saves keep both session floors', async () => {
  const { engine: first, store } = storageEngine('first');
  const second = { ...first, sessionId: async () => 'second' };
  const floor = new ContextFloor();
  floor.restore({ baseline: 123, waitingFor: null });
  const other = new ContextFloor();
  other.restore({ baseline: 456, waitingFor: 'first turn after compaction' });

  await Promise.all([saveFloorState(first, floor), saveFloorState(second, other)]);

  expect(store.get('floor:first')).toEqual({ ...floor.state(), savedAt: NOW });
  expect(store.get('floor:second')).toEqual({ ...other.state(), savedAt: NOW });
  expect(await loadFloorState(first, 'first')).toEqual(floor.state());
  expect(await loadFloorState(second, 'second')).toEqual(other.state());
});

test('saving prunes old index entries and their floor keys', async () => {
  const old = { baseline: 1, waitingFor: null, savedAt: NOW - 31 * DAY };
  const recent = { ...old, savedAt: NOW - 30 * DAY };
  const { engine, store } = storageEngine('current', {
    'floor:old': old,
    'floor:recent': recent,
    'floor-index': { old: old.savedAt, recent: recent.savedAt },
  });

  await saveFloorState(engine, new ContextFloor());

  expect(store.has('floor:old')).toBe(false);
  expect(store.get('floor:recent')).toEqual(recent);
  expect(store.get('floor-index')).toEqual({ recent: recent.savedAt, current: NOW });
});

test('loading ignores expired and invalid floors without using legacy over an existing key', async () => {
  const { engine } = storageEngine('current', {
    'floor:old': { baseline: 1, waitingFor: null, savedAt: NOW - 31 * DAY },
    'floor:invalid': { baseline: 'bad', waitingFor: null, savedAt: NOW },
    floors: { old: { baseline: 2, waitingFor: null, savedAt: NOW } },
  });

  expect(await loadFloorState(engine, 'old')).toBeUndefined();
  expect(await loadFloorState(engine, 'invalid')).toBeUndefined();
});

test('legacy floors load read-only only when the new session key is absent', async () => {
  const saved = { baseline: 123, waitingFor: null, savedAt: NOW };
  const { engine, store } = storageEngine('legacy', {
    floors: { legacy: saved, expired: { ...saved, savedAt: NOW - 31 * DAY }, new: saved },
    'floor:new': { ...saved, baseline: 456 },
  });

  expect(await loadFloorState(engine, 'legacy')).toEqual({ baseline: 123, waitingFor: null });
  expect(await loadFloorState(engine, 'expired')).toBeUndefined();
  expect(await loadFloorState(engine, 'new')).toEqual({ baseline: 456, waitingFor: null });
  expect(store.has('floor:legacy')).toBe(false);
  expect(store.get('floors')).toEqual({ legacy: saved, expired: { ...saved, savedAt: NOW - 31 * DAY }, new: saved });
});

test('saving a session with an expired index entry keeps its refreshed floor', async () => {
  const { engine, store } = storageEngine('current', { 'floor-index': { current: NOW - 31 * DAY } });
  const floor = new ContextFloor();

  await saveFloorState(engine, floor);

  expect(await loadFloorState(engine, 'current')).toEqual(floor.state());
  expect(store.get('floor-index')).toEqual({ current: NOW });
});
