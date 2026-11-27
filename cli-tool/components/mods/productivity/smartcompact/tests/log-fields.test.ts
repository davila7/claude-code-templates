import { describe, expect, mock, test } from 'claude-code/testing';
import { claudeVerdict, fakeSession, finishedTurn, loggedLines, taggedTurn, FAKE_HOME } from './fake-engine.ts';

const START = Date.UTC(2026, 9, 10, 10, 0);
const HOME = { USERPROFILE: FAKE_HOME };
const START_ARGS = { cwd: 'C:/work', surface: 'terminal', isInteractive: true } as const;
const NO_FLOOR = { options: { minTokens: 0 } };

function lineOf(session: ReturnType<typeof fakeSession>, event: string): Record<string, unknown> | undefined {
  return loggedLines(session).find((line) => line['event'] === event);
}

describe('log fields of a judge yes', () => {
  test('give the floor, the source and the kind of continue', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    session.messages = [];
    session.tokens = 80000;
    await $.session.start(START_ARGS);
    await $.turn.complete(finishedTurn('turn-1'));
    await clock.settle();
    session.tokens = 150000;
    await $.turn.complete(finishedTurn('turn-2'));
    await clock.settle();

    expect(lineOf(session, 'judge-yes')).toMatchObject({ tokens: 150000, added: 70000, baseline: 80000 });
    expect(lineOf(session, 'compact-started')).toMatchObject({ source: 'judge', tokens: 150000, retries: 0 });
    expect(lineOf(session, 'compact-typed')).toMatchObject({ source: 'judge' });
    expect(lineOf(session, 'continue-typed')).toMatchObject({ source: 'judge', kind: 'after-compaction' });
  });

  test('a judge no gives the floor', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.claudeReply = () => claudeVerdict(false, 'tests fail');

    session.tokens = 65000;
    await $.turn.complete(finishedTurn());
    await clock.settle();

    expect(lineOf(session, 'judge-no')).toMatchObject({ tokens: 65000, added: 65000, baseline: 0 });
  });

  test('compact-started counts the retries before it', NO_FLOOR, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.isDialogOpen = true;

    await $.turn.complete(finishedTurn());
    await clock.settle();
    await clock.advance(3000);
    session.isDialogOpen = false;
    await clock.advance(3000);

    expect(lineOf(session, 'compact-started')).toMatchObject({ retries: 2 });
  });

  test('a failed and a dropped compaction give the source', NO_FLOOR, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.compactError = 'a turn is running';

    await $.turn.complete(finishedTurn());
    await clock.settle();
    await $.turn.start({ text: 'next question', turnId: 'turn-2' });
    await clock.settle();

    expect(lineOf(session, 'compact-failed')).toMatchObject({ source: 'judge' });
    expect(lineOf(session, 'compact-dropped')).toMatchObject({ source: 'judge', reason: 'new turn started' });
  });
});

describe('log fields of a tag', () => {
  test('above the floor give the floor and the source', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    session.tokens = 70000;
    await $.turn.complete(taggedTurn('Write the docs.'));
    await clock.settle();

    expect(lineOf(session, 'compact-requested')).toMatchObject({ tokens: 70000, added: 70000, baseline: 0 });
    expect(lineOf(session, 'compact-started')).toMatchObject({ source: 'request', tokens: 70000 });
    expect(lineOf(session, 'continue-typed')).toMatchObject({ source: 'request', kind: 'after-compaction' });
  });

  test('below the floor continue as below-floor', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    session.tokens = 20000;
    await $.turn.complete(taggedTurn('Write the docs.'));
    await clock.settle();

    expect(lineOf(session, 'continue-typed')).toMatchObject({ source: 'request', kind: 'below-floor' });
  });

  test('after a skipped compaction continue as after-skip', NO_FLOOR, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.compactSkip = 'a hook blocked it';

    await $.turn.complete(taggedTurn('Write the docs.'));
    await clock.settle();

    expect(lineOf(session, 'compact-failed')).toMatchObject({ source: 'request' });
    expect(lineOf(session, 'continue-typed')).toMatchObject({ source: 'request', kind: 'after-skip' });
  });
});
