import type { On } from 'claude-code';
import type { Engine as TestEngine } from 'claude-code/testing';
import { describe, expect, mock, test } from 'claude-code/testing';
import { ContextFloor } from '../hooks/context-floor.ts';
import { SUMMARY, fakeSession, finishedTurn, loggedLines, runStep, FAKE_HOME } from './fake-engine.ts';

const START = Date.UTC(2026, 9, 10, 10, 0);
const HOME = { USERPROFILE: FAKE_HOME };
const START_ARGS = { cwd: 'C:/work', surface: 'terminal', isInteractive: true } as const;

function savedBaseline(session: ReturnType<typeof fakeSession>): unknown {
  return (session.store.get('floor:session-1') as { baseline: number } | undefined)?.baseline;
}

describe('the baseline of a first turn', () => {
  test('after a compaction is the reading at the second step', async ($: TestEngine, on: On) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    session.tokens = 70000;
    await $.turn.complete(finishedTurn('turn-1'));
    await clock.settle();

    expect(session.compacts).toHaveLength(1);

    await runStep($, 0, undefined, 'turn-2');
    session.tokens = 30000;
    await runStep($, 1, undefined, 'turn-2');
    session.tokens = 45000;
    await runStep($, 2, undefined, 'turn-2');
    session.tokens = 120000;
    await $.turn.complete(finishedTurn('turn-2'));
    await clock.settle();

    expect(savedBaseline(session)).toBe(30000);
    expect(loggedLines(session).at(-1)).toMatchObject({
      event: 'judge-skipped',
      reason: 'first turn after compaction',
      tokens: 120000,
      baseline: 30000,
    });
  });

  test('of a one-step turn is the size at its end', async ($: TestEngine, on: On) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    session.messages = [];
    session.tokens = undefined;
    await $.session.start(START_ARGS);
    await runStep($, 0);
    session.tokens = 40000;
    await $.turn.complete(finishedTurn());
    await clock.settle();

    expect(savedBaseline(session)).toBe(40000);
  });

  test('ignores the steps of a subagent', async ($: TestEngine, on: On) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    session.messages = [];
    session.tokens = 30000;
    await $.session.start(START_ARGS);
    await runStep($, 1, 'agent-1');
    session.tokens = 40000;
    await $.turn.complete(finishedTurn());
    await clock.settle();

    expect(savedBaseline(session)).toBe(40000);
  });

  test('ignores a reading while the floor does not wait', () => {
    const touched = new ContextFloor();
    const untouched = new ContextFloor();

    touched.noteTurnStartReading(30000);

    expect(touched.state()).toEqual(untouched.state());
    expect(touched.takeFirstTurn(50000)).toBe(untouched.takeFirstTurn(50000));
    expect(touched.baseline()).toBe(untouched.baseline());
  });

  test('drops a reading taken before a /clear', async ($: TestEngine, on: On) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    session.messages = [];
    session.tokens = 30000;
    await $.session.start(START_ARGS);
    await runStep($, 1);
    await $.session.end({ reason: 'clear', sessionId: 'session-1', resume: { id: 'session-1' } });
    session.tokens = 50000;
    await $.turn.complete(finishedTurn());
    await clock.settle();

    expect(savedBaseline(session)).toBe(50000);
  });

  test('drops a reading taken before a compaction', async ($: TestEngine, on: On) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    session.messages = [];
    session.tokens = 30000;
    await $.session.start(START_ARGS);
    await runStep($, 1);
    await $.session.compact({ trigger: 'manual', messages: [SUMMARY] });
    session.tokens = 50000;
    await $.turn.complete(finishedTurn());
    await clock.settle();

    expect(savedBaseline(session)).toBe(50000);
  });
});
