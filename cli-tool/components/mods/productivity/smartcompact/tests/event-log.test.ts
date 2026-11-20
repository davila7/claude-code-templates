import { expect, test } from 'claude-code/testing';
import { logEvent, newestPartOf } from '../hooks/event-log.ts';
import { settleStub, stubEngine, stubLoggedLines } from './stub-engine.ts';

test('newestPartOf measures UTF-8 bytes and keeps whole newest lines', () => {
  const line = '😀'.repeat(100) + '\n';
  const log = line.repeat(6000);
  const kept = newestPartOf(log);
  expect(kept).toBe(line.repeat(Math.floor(150_000 / 401)));
});

test('newestPartOf drops an oversized line without a newline', () => {
  expect(newestPartOf('x'.repeat(300_001))).toBe('');
});

test('newestPartOf leaves a small Unicode log unchanged', () => {
  expect(newestPartOf('é\n😀\n')).toBe('é\n😀\n');
});

test('only logging truncates error messages', async () => {
  const { engine, record } = stubEngine({});
  logEvent(engine, 'judge-error', { message: 'x'.repeat(250) });
  await settleStub();
  expect(stubLoggedLines(record)[0]?.['message']).toBe('x'.repeat(200));
});

test('newestPartOf keeps the cap boundary and trims to 150 KB above it', () => {
  const line = 'x'.repeat(999) + '\n';
  expect(newestPartOf(line.repeat(300))).toBe(line.repeat(300));
  expect(newestPartOf(line.repeat(301))).toBe(line.repeat(150));
});
