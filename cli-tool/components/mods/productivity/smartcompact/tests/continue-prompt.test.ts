import { describe, expect, mock, test } from 'claude-code/testing';
import { OVERRIDE_PROMPT_FILE, fakeSession, finishedTurn, loggedEvents, FAKE_HOME } from './fake-engine.ts';

const START = Date.UTC(2026, 9, 4, 10, 0);
const HOME = { USERPROFILE: FAKE_HOME };
const JUDGE_EVERY_TURN = { options: { minTokens: 0 } };
const DEFAULT_AFTER_JUDGE = [
  'Context was compacted automatically.',
  'Continue where you left off. If the next step is clear, do it.',
  '- If you were waiting for me (a question, a choice or a review), ask it again.',
  '- If the current task or plan has more steps, do the next one.',
  '- If all work is done, stop and say so.',
].join('\n');

describe('the continue prompt file', () => {
  test('without an override the shipped default goes out, with the fallback for {next}', JUDGE_EVERY_TURN, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    await $.turn.complete(finishedTurn());
    await clock.settle();

    expect(session.submitted).toEqual([DEFAULT_AFTER_JUDGE]);
  });

  test('the override wins over the default', JUDGE_EVERY_TURN, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.files.set(OVERRIDE_PROMPT_FILE, 'Go on.');

    await $.turn.complete(finishedTurn());
    await clock.settle();

    expect(session.submitted).toEqual(['Go on.']);
  });

  test('an empty override turns the prompt off', JUDGE_EVERY_TURN, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.files.set(OVERRIDE_PROMPT_FILE, '');

    await $.turn.complete(finishedTurn());
    await clock.settle();

    expect(session.submitted).toEqual([]);
    expect(loggedEvents(session)).toEqual(['judge-yes', 'compact-started', 'compact-typed']);
  });

  test('an override of blank lines turns it off too', JUDGE_EVERY_TURN, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.files.set(OVERRIDE_PROMPT_FILE, '\r\n  \n');

    await $.turn.complete(finishedTurn());
    await clock.settle();

    expect(session.submitted).toEqual([]);
  });

  test('an override saved with Windows line ends goes out with plain ones', JUDGE_EVERY_TURN, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.files.set(OVERRIDE_PROMPT_FILE, 'Go on.\r\nThen stop.\r\n');

    await $.turn.complete(finishedTurn());
    await clock.settle();

    expect(session.submitted).toEqual(['Go on.\nThen stop.']);
  });

  test('is read at each send, so an edit works without a restart', JUDGE_EVERY_TURN, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.files.set(OVERRIDE_PROMPT_FILE, 'First.');

    await $.turn.complete(finishedTurn());
    await clock.settle();
    session.files.set(OVERRIDE_PROMPT_FILE, 'Second.');
    // The first turn after a compaction is never judged, so the third turn compacts again.
    await $.turn.complete(finishedTurn('turn-2'));
    await clock.settle();
    await $.turn.complete(finishedTurn('turn-3'));
    await clock.settle();

    expect(session.submitted).toEqual(['First.', 'Second.']);
  });
});

describe('the continue prompt placeholders', () => {
  test('are filled with the choices file and the heading', JUDGE_EVERY_TURN, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.files.set(OVERRIDE_PROMPT_FILE, 'File: {choicesFile}\n{choicesHeading}\nAgain: {choicesFile}');

    await $.turn.complete(finishedTurn());
    await clock.settle();

    const file = `${FAKE_HOME}/.claude/smartcompact/choices.md`;
    const heading = '## 2026-10-04T10:00:00.000Z | C:/work | session-1';

    expect(session.submitted).toEqual([`File: ${file}\n${heading}\nAgain: ${file}`]);
  });

  test('follow the SMARTCOMPACT_LOG folder', JUDGE_EVERY_TURN, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, { ...HOME, SMARTCOMPACT_LOG: 'D:\\logs\\mine.jsonl' });
    const session = fakeSession(on);
    session.files.set(OVERRIDE_PROMPT_FILE, 'File: {choicesFile}');

    await $.turn.complete(finishedTurn());
    await clock.settle();

    expect(session.submitted).toEqual(['File: D:\\logs/choices.md']);
  });

  test('keep dollar signs in a filled value as typed', JUDGE_EVERY_TURN, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, { ...HOME, SMARTCOMPACT_LOG: 'D:\\cost$$\\mine.jsonl' });
    const session = fakeSession(on);
    session.files.set(OVERRIDE_PROMPT_FILE, 'File: {choicesFile}');

    await $.turn.complete(finishedTurn());
    await clock.settle();

    expect(session.submitted).toEqual(['File: D:\\cost$$/choices.md']);
  });

  test('leave a prompt without them unchanged', JUDGE_EVERY_TURN, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.files.set(OVERRIDE_PROMPT_FILE, 'Go on {now}.');

    await $.turn.complete(finishedTurn());
    await clock.settle();

    expect(session.submitted).toEqual(['Go on {now}.']);
  });
});
