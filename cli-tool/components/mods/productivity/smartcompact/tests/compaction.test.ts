import { describe, expect, mock, test } from 'claude-code/testing';
import {
  SUMMARY,
  claudeVerdict,
  clearDraft,
  fakeSession,
  finishedTurn,
  loggedEvents,
  loggedLines,
  withoutTime,
  FAKE_HOME,
} from './fake-engine.ts';

const START = Date.UTC(2026, 9, 4, 10, 0);
const HOME = { USERPROFILE: FAKE_HOME };
const JUDGE_EVERY_TURN = { options: { minTokens: 0 } };
const INSTRUCTIONS = 'Keep the current goal, the next step and open decisions.';
const DEFAULT_CONTINUE_PROMPT = [
  'Context was compacted automatically.',
  'Continue where you left off. If the next step is clear, do it.',
  '- If you were waiting for me (a question, a choice or a review), ask it again.',
  '- If the current task or plan has more steps, do the next one.',
  '- If all work is done, stop and say so.',
].join('\n');

describe('a yes from the judge', () => {
  test('compacts and continues when the session is idle and the prompt is empty', JUDGE_EVERY_TURN, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    await $.turn.complete(finishedTurn());
    await clock.settle();

    expect(session.compacts).toEqual([INSTRUCTIONS]);
    expect(session.submitted).toEqual([DEFAULT_CONTINUE_PROMPT]);
    expect(loggedEvents(session)).toEqual(['judge-yes', 'compact-started', 'compact-typed', 'continue-typed']);
    expect(session.statuses.map(withoutTime)).toEqual(
      ['judging...', 'will compact', 'compacting...', 'compacted', 'continued'],
    );
  });

  test('does not judge the first turn after its own compaction, even with a floor of 0', JUDGE_EVERY_TURN, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    await $.turn.complete(finishedTurn());
    await clock.settle();
    await $.turn.complete(finishedTurn('turn-2'));
    await clock.settle();

    expect(session.compacts).toEqual([INSTRUCTIONS]);
    expect(loggedEvents(session)).toEqual([
      'judge-yes',
      'compact-started',
      'compact-typed',
      'continue-typed',
      'judge-skipped',
    ]);
    expect(loggedLines(session).at(-1)?.reason).toBe('first turn after compaction');
  });

  test('judges again on the turn after that', JUDGE_EVERY_TURN, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    await $.turn.complete(finishedTurn());
    await clock.settle();
    await $.turn.complete(finishedTurn('turn-2'));
    await clock.settle();
    await $.turn.complete(finishedTurn('turn-3'));
    await clock.settle();

    expect(session.compacts).toEqual([INSTRUCTIONS, INSTRUCTIONS]);
  });

  test('counts the floor from the first turn after its compaction', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    session.tokens = 70000;
    await $.turn.complete(finishedTurn());
    await clock.settle();

    session.tokens = 30000;
    await $.turn.complete(finishedTurn('turn-2'));
    await clock.settle();

    session.tokens = 60000;
    await $.turn.complete(finishedTurn('turn-3'));
    await clock.settle();

    expect(session.compacts).toEqual([INSTRUCTIONS]);
    expect(session.statuses.at(-1)).toBe('judge in 30k');

    session.tokens = 90000;
    await $.turn.complete(finishedTurn('turn-4'));
    await clock.settle();

    expect(session.compacts).toEqual([INSTRUCTIONS, INSTRUCTIONS]);
  });

  test('a no compacts nothing', JUDGE_EVERY_TURN, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.claudeReply = () => claudeVerdict(false, 'tests are failing');

    await $.turn.complete(finishedTurn());
    await clock.settle();

    expect(session.compacts).toEqual([]);
    expect(loggedEvents(session)).toEqual(['judge-no']);
  });

  test('waits while the prompt holds text and compacts once it is emptied', JUDGE_EVERY_TURN, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.draft = 'half a thought';

    await $.turn.complete(finishedTurn());
    await clock.settle();

    expect(session.compacts).toEqual([]);
    expect(session.statuses.at(-1)).toBe('waiting for empty prompt');
    expect(loggedLines(session)[1]).toMatchObject({ event: 'compact-waiting', reason: 'prompt has text' });

    await clock.advance(5000);
    await clearDraft($, 'half a thought');
    await clock.settle();

    expect(session.compacts).toEqual([INSTRUCTIONS]);
    expect(loggedLines(session)[3]).toMatchObject({ event: 'compact-typed', waitedMs: 5000 });
  });

  test('waits while a dialog is open and retries on the clock', JUDGE_EVERY_TURN, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.isDialogOpen = true;

    await $.turn.complete(finishedTurn());
    await clock.settle();

    expect(session.compacts).toEqual([]);
    expect(session.statuses.at(-1)).toBe('waiting for idle');
    expect(loggedLines(session)[1]).toMatchObject({ event: 'compact-waiting', reason: 'dialog open' });

    session.isDialogOpen = false;
    await clock.advance(3000);

    expect(session.compacts).toEqual([INSTRUCTIONS]);
  });

  test('gives up after two minutes of a dialog', JUDGE_EVERY_TURN, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.isDialogOpen = true;

    await $.turn.complete(finishedTurn());
    await clock.settle();

    for (let step = 0; step < 41; step++) {
      await clock.advance(3000);
    }

    expect(session.compacts).toEqual([]);
    expect(loggedLines(session).at(-1)).toMatchObject({ event: 'compact-dropped', reason: 'not idle in time' });
    expect(withoutTime(session.statuses.at(-1))).toBe('dropped');
  });

  test('waits and retries when the engine refuses the compaction', JUDGE_EVERY_TURN, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.compactError = 'a turn is running';

    await $.turn.complete(finishedTurn());
    await clock.settle();

    expect(loggedEvents(session)).toEqual(['judge-yes', 'compact-started', 'compact-failed', 'compact-waiting']);
    expect(session.statuses.at(-1)).toBe('waiting for idle');

    session.compactError = undefined;
    await clock.advance(3000);

    expect(session.compacts).toEqual([INSTRUCTIONS]);
  });
});

describe('a new turn', () => {
  test('drops a waiting compaction', JUDGE_EVERY_TURN, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.draft = 'next question';

    await $.turn.complete(finishedTurn());
    await clock.settle();
    await $.turn.start({ text: 'next question', turnId: 'turn-2' });
    session.draft = '';
    await clock.advance(3000);

    expect(session.compacts).toEqual([]);
    expect(loggedLines(session).at(-1)).toMatchObject({ event: 'compact-dropped', reason: 'new turn started' });
  });

  test('cancels a yes that arrives after it started', JUDGE_EVERY_TURN, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    let answer: () => void = () => undefined;
    const slowReply = new Promise<void>((resolve) => {
      answer = resolve;
    });
    session.claudeReply = async () => {
      await slowReply;

      return claudeVerdict(true, 'done');
    };

    await $.turn.complete(finishedTurn());
    await clock.settle();
    await $.turn.start({ text: 'queued prompt', turnId: 'turn-2' });
    answer();
    await clock.settle();

    expect(session.compacts).toEqual([]);
    expect(loggedLines(session)[0]).toMatchObject({ event: 'judge-cancelled', reason: 'new turn started' });
  });

  test('cancels a yes when a subagent started meanwhile', JUDGE_EVERY_TURN, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.claudeReply = () => {
      session.agents = [{ id: 'agent-2', description: 'tests', type: 'general-purpose', status: 'running' }];

      return claudeVerdict(true, 'done');
    };

    await $.turn.complete(finishedTurn());
    await clock.settle();

    expect(session.compacts).toEqual([]);
    expect(loggedLines(session)[0]).toMatchObject({ event: 'judge-cancelled', reason: 'subagents running' });
  });
});

describe('the continue prompt', () => {
  test('is not sent after a compaction the plugin did not start', JUDGE_EVERY_TURN, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    await $.session.compact({ trigger: 'manual', messages: [SUMMARY], instructions: 'by hand' });
    await $.session.compact({ trigger: 'auto', messages: [SUMMARY] });
    await clock.settle();

    expect(session.compacts).toEqual(['by hand', undefined]);
    expect(session.submitted).toEqual([]);
  });

  test('is logged as compact-other with the context before it, for the main session only', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    session.tokens = 120000;
    await $.session.compact({ trigger: 'manual', messages: [SUMMARY] });
    session.tokens = 150000;
    await $.session.compact({ trigger: 'auto', messages: [SUMMARY] });
    await $.session.compact({ trigger: 'auto', messages: [SUMMARY], agentId: 'agent-1' });
    await clock.settle();

    expect(loggedLines(session)).toMatchObject([
      { event: 'compact-other', trigger: 'manual', tokens: 120000 },
      { event: 'compact-other', trigger: 'auto', tokens: 150000 },
    ]);
  });

  test('a manual compact drops a waiting compaction', JUDGE_EVERY_TURN, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.draft = 'text';

    await $.turn.complete(finishedTurn());
    await clock.settle();
    await $.session.compact({ trigger: 'manual', messages: [SUMMARY] });
    session.draft = '';
    await clearDraft($, 'text');
    await clock.settle();

    expect(session.compacts).toEqual([undefined]);
    expect(session.submitted).toEqual([]);
    expect(loggedLines(session).at(-1)).toMatchObject({ event: 'compact-dropped', reason: 'manual compact' });
  });
});

describe('saved floor after a compaction', () => {
  test('a compaction saves that the floor waits for its first turn', JUDGE_EVERY_TURN, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    session.tokens = 70000;
    await $.turn.complete(finishedTurn());
    await clock.settle();

    expect(session.store.get('floor:session-1')).toEqual({
      baseline: 0, waitingFor: 'first turn after compaction', savedAt: START,
    });
  });
});
