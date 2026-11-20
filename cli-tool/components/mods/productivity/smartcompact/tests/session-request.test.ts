import { describe, expect, mock, test } from 'claude-code/testing';
import {
  OVERRIDE_PROMPT_FILE,
  clearDraft,
  fakeSession,
  finishedTurn,
  loggedEvents,
  loggedLines,
  runStep,
  taggedTurn,
  withoutTime,
  FAKE_HOME,
} from './fake-engine.ts';

const START = Date.UTC(2026, 9, 4, 10, 0);
const HOME = { USERPROFILE: FAKE_HOME };
const NO_FLOOR = { options: { minTokens: 0 } };
const JUDGE_INSTRUCTIONS = 'Keep the current goal, the next step and open decisions.';
const DOCS_INSTRUCTIONS = 'Keep the current goal, open decisions and what this next step needs: Write the docs.';
const COMPACTED_LINE = 'Context was compacted automatically.';
const PROMPT_BODY = [
  '- If you were waiting for me (a question, a choice or a review), ask it again.',
  '- If the current task or plan has more steps, do the next one.',
  '- If all work is done, stop and say so.',
];
const COMPACTED_DOCS_PROMPT = [COMPACTED_LINE, 'Write the docs.', ...PROMPT_BODY].join('\n');
const UNCOMPACTED_DOCS_PROMPT = ['Write the docs.', ...PROMPT_BODY].join('\n');

describe('a tag at the end of a main answer', () => {
  test('compacts with the tag instructions and continues with its text', NO_FLOOR, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    await $.turn.complete(taggedTurn('Write the docs.'));
    await clock.settle();

    expect(session.claudeModels).toEqual([]);
    expect(session.compacts).toEqual([DOCS_INSTRUCTIONS]);
    expect(session.submitted).toEqual([COMPACTED_DOCS_PROMPT]);
    expect(loggedEvents(session)).toEqual(['compact-requested', 'compact-started', 'compact-typed', 'continue-typed']);
    expect(loggedLines(session)[0]).toMatchObject({ event: 'compact-requested', tokens: 0 });
    expect(loggedLines(session)[0]).not.toHaveProperty('next');
    expect(loggedLines(session)[2]).toMatchObject({ source: 'request', tokens: 0 });
    expect(session.statuses.map(withoutTime)).toEqual(['will compact', 'compacting...', 'compacted', 'continued']);
  });

  test('names all running agents, keeps their reports in the summary and continues', NO_FLOOR, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.agents = ['agent-1', 'agent-2'].map((id) => ({
      id, description: 'review', type: 'general-purpose', status: 'running' as const,
    }));
    const next = 'Use agent-1 to fix bugs and agent-2 to finish the docs when their reports arrive.';

    await $.turn.complete(taggedTurn(next));
    await clock.settle();

    expect(session.claudeModels).toEqual([]);
    expect(session.notes).toEqual([]);
    expect(session.compacts).toEqual([
      `Keep the current goal, open decisions and what this next step needs: ${next} Keep the ids of the subagents still running (agent-1, agent-2) and what to do with each report when it arrives.`,
    ]);
    expect(session.submitted).toEqual([[COMPACTED_LINE, next, ...PROMPT_BODY].join('\n')]);
    expect(loggedEvents(session)).toEqual(['compact-requested', 'compact-started', 'compact-typed', 'continue-typed']);
    expect(loggedLines(session)[0]).toMatchObject({ agents: ['agent-1', 'agent-2'] });
    expect(loggedLines(session)[0]).not.toHaveProperty('next');
  });

  test('an empty tag is an untagged turn and goes to the judge', NO_FLOOR, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    await $.turn.complete(taggedTurn(''));
    await clock.settle();

    expect(session.claudeModels).toEqual(['haiku']);
    expect(loggedEvents(session)).not.toContain('compact-requested');
  });

  test('logs no tag text', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    await $.turn.complete(taggedTurn('x'.repeat(400)));
    await clock.settle();

    expect(loggedLines(session)[0]).not.toHaveProperty('next');
  });

  test('is never judged, also on the first turn after a compaction', NO_FLOOR, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    await $.turn.complete(finishedTurn());
    await clock.settle();
    await $.turn.complete(taggedTurn('Write the docs.', 'turn-2'));
    await clock.settle();

    expect(session.claudeModels).toEqual(['haiku']);
    expect(session.compacts).toEqual([JUDGE_INSTRUCTIONS, DOCS_INSTRUCTIONS]);
  });

  test('does nothing in a subagent turn', NO_FLOOR, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    await $.turn.complete({ ...taggedTurn('Write the docs.'), agentId: 'agent-1' });
    await clock.settle();

    expect(loggedEvents(session)).toEqual([]);
    expect(session.compacts).toEqual([]);
    expect(session.submitted).toEqual([]);
  });
});

describe('a tag below the floor', () => {
  test('continues without a compaction and without the compacted line', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    await $.turn.complete(taggedTurn('Write the docs.'));
    await clock.settle();

    expect(session.compacts).toEqual([]);
    expect(session.claudeModels).toEqual([]);
    expect(session.submitted).toEqual([UNCOMPACTED_DOCS_PROMPT]);
    expect(loggedEvents(session)).toEqual(['compact-requested', 'continue-typed']);
  });

  test('keeps a first line of the user\'s own', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.files.set(OVERRIDE_PROMPT_FILE, 'Go on.\n{next}');

    await $.turn.complete(taggedTurn('Write the docs.'));
    await clock.settle();

    expect(session.submitted).toEqual(['Go on.\nWrite the docs.']);
  });

  test('leaves out the compacted line of an override saved with Windows line ends', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.files.set(OVERRIDE_PROMPT_FILE, `${COMPACTED_LINE}\r\n{next}\r\n`);

    await $.turn.complete(taggedTurn('Write the docs.'));
    await clock.settle();

    expect(session.submitted).toEqual(['Write the docs.']);
  });

  test('keeps dollar signs in the tag text as typed', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    await $.turn.complete(taggedTurn('Rename $& and $1 and $$ in run.sh.'));
    await clock.settle();

    expect(session.submitted).toEqual([['Rename $& and $1 and $$ in run.sh.', ...PROMPT_BODY].join('\n')]);
  });

  test('is ignored by the loop guard right after a continue prompt sent below the floor', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    await $.turn.complete(taggedTurn('Write the docs.'));
    await clock.settle();
    await $.turn.start({ text: 'continue prompt', turnId: 'turn-2' });
    await $.turn.complete(taggedTurn('Write the docs.', 'turn-2'));
    await clock.settle();

    expect(session.submitted).toEqual([UNCOMPACTED_DOCS_PROMPT]);
    expect(loggedEvents(session)).toEqual([
      'compact-requested',
      'continue-typed',
      'compact-requested',
      'request-ignored',
    ]);
    expect(loggedLines(session).at(-1)).toMatchObject({ reason: 'loop guard' });
    expect(withoutTime(session.statuses.at(-1))).toBe('request ignored');
  });

  test('passes the loop guard when another turn came between', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    await $.turn.complete(taggedTurn('Write the docs.'));
    await clock.settle();
    await $.turn.start({ text: 'continue prompt', turnId: 'turn-2' });
    await $.turn.complete(finishedTurn('turn-2'));
    await clock.settle();
    await $.turn.start({ text: 'Looks good, go on.', turnId: 'turn-3' });
    await $.turn.complete(taggedTurn('Write the docs.', 'turn-3'));
    await clock.settle();

    expect(session.submitted).toEqual([UNCOMPACTED_DOCS_PROMPT, UNCOMPACTED_DOCS_PROMPT]);
    expect(loggedEvents(session)).toEqual([
      'compact-requested',
      'continue-typed',
      'judge-skipped',
      'compact-requested',
      'continue-typed',
    ]);
  });

  test('above the floor right after a continue prompt sent below the floor compacts', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    await $.turn.complete(taggedTurn('Write the docs.'));
    await clock.settle();
    await $.turn.start({ text: 'continue prompt', turnId: 'turn-2' });
    session.tokens = 70000;
    await $.turn.complete(taggedTurn('Write the docs.', 'turn-2'));
    await clock.settle();

    expect(session.compacts).toEqual([DOCS_INSTRUCTIONS]);
    expect(session.submitted).toEqual([UNCOMPACTED_DOCS_PROMPT, COMPACTED_DOCS_PROMPT]);
    expect(loggedEvents(session)).toEqual([
      'compact-requested',
      'continue-typed',
      'compact-requested',
      'compact-started',
      'compact-typed',
      'continue-typed',
    ]);
  });

  test('on the first turn of a new session saves the baseline', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.messages = [];
    session.tokens = 80000;

    await $.session.start({ cwd: 'C:/work', surface: 'terminal', isInteractive: true });
    await $.turn.complete(taggedTurn('Write the docs.'));
    await clock.settle();
    await $.turn.start({ text: 'continue prompt', turnId: 'turn-2' });
    session.tokens = 90000;
    await $.turn.complete(finishedTurn('turn-2'));
    await clock.settle();

    expect(session.store.get('floor:session-1')).toMatchObject({ baseline: 80000, waitingFor: null });
    expect(loggedEvents(session)).toEqual(['compact-requested', 'continue-typed', 'judge-skipped']);
    expect(loggedLines(session).at(-1)).toMatchObject({ reason: 'below floor', added: 10000 });
  });

  test('right after a plugin compaction still gets its continue prompt', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    session.tokens = 70000;
    await $.turn.complete(taggedTurn('Write the docs.'));
    await clock.settle();
    await $.turn.start({ text: 'continue prompt', turnId: 'turn-2' });
    session.tokens = 90000;
    await $.turn.complete(taggedTurn('Ship it.', 'turn-2'));
    await clock.settle();

    expect(session.compacts).toEqual([DOCS_INSTRUCTIONS]);
    expect(session.submitted).toEqual([COMPACTED_DOCS_PROMPT, ['Ship it.', ...PROMPT_BODY].join('\n')]);
    expect(loggedEvents(session)).toEqual([
      'compact-requested',
      'compact-started',
      'compact-typed',
      'continue-typed',
      'compact-requested',
      'continue-typed',
    ]);
  });
});

describe('an ignored tag', () => {
  for (const next of ['Write the docs.', 'Use agent-1 to fix bugs when its report arrives.']) {
    test(`while subagents run, ignores a tag missing ids: ${next}`, NO_FLOOR, async ($, on) => {
      const clock = mock.clock(on, { now: START });
      mock.env(on, HOME);
      const session = fakeSession(on);
      session.agents = ['agent-1', 'agent-2'].map((id) => ({
        id, description: 'review', type: 'general-purpose', status: 'running' as const,
      }));

      await $.turn.complete(taggedTurn(next));
      await clock.settle();

      expect(session.compacts).toEqual([]);
      expect(session.submitted).toEqual([]);
      expect(loggedEvents(session)).toEqual(['compact-requested', 'request-ignored']);
      expect(loggedLines(session)[1]).toMatchObject({
        reason: 'subagents running', agents: ['agent-1', 'agent-2'],
        missing: next.includes('agent-1') ? ['agent-2'] : ['agent-1', 'agent-2'],
      });
      expect(withoutTime(session.statuses.at(-1))).toBe('request ignored');
      expect(session.notes).toEqual([
        'smartcompact: compaction skipped, 2 subagent(s) still running (agent-1, agent-2). To compact now, tag again and name each running agent id with what to do with its report. Or tag again once they finish.',
      ]);
    });
  }

  test('logs a denied note without throwing', NO_FLOOR, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.agents = ['worker', 'reviewer'].map((id) => ({
      id, description: 'work', type: 'general-purpose', status: 'running' as const,
    }));
    session.noteDeny = 'policy says no';

    await $.turn.complete(taggedTurn('Write the docs.'));
    await clock.settle();

    expect(session.compacts).toEqual([]);
    expect(session.notes).toEqual([]);
    expect(loggedLines(session)).toContainEqual(expect.objectContaining({
      event: 'request-error', message: 'policy says no',
    }));
  });
});

describe('a held tag', () => {
  test('still continues when the engine skips the compaction', NO_FLOOR, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.compactSkip = 'a PreCompact hook said no';

    await $.turn.complete(taggedTurn('Write the docs.'));
    await clock.settle();

    expect(session.compacts).toEqual([]);
    expect(session.submitted).toEqual([UNCOMPACTED_DOCS_PROMPT]);
    expect(loggedEvents(session)).toEqual(['compact-requested', 'compact-started', 'compact-failed', 'continue-typed']);
  });

  test('is ignored by the loop guard right after a continue sent for a skipped compaction', NO_FLOOR, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.compactSkip = 'a PreCompact hook said no';

    await $.turn.complete(taggedTurn('Write the docs.'));
    await clock.settle();
    await $.turn.start({ text: 'continue prompt', turnId: 'turn-2' });
    await $.turn.complete(taggedTurn('Write the docs.', 'turn-2'));
    await clock.settle();

    expect(session.submitted).toEqual([UNCOMPACTED_DOCS_PROMPT]);
    expect(loggedEvents(session)).toEqual([
      'compact-requested',
      'compact-started',
      'compact-failed',
      'continue-typed',
      'compact-requested',
      'request-ignored',
    ]);
    expect(loggedLines(session).at(-1)).toMatchObject({ reason: 'loop guard' });
  });

  test('compacts again right after a continue sent for a real compaction', NO_FLOOR, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    await $.turn.complete(taggedTurn('Write the docs.'));
    await clock.settle();
    await $.turn.start({ text: 'continue prompt', turnId: 'turn-2' });
    await $.turn.complete(taggedTurn('Write the docs.', 'turn-2'));
    await clock.settle();

    expect(session.compacts).toEqual([DOCS_INSTRUCTIONS, DOCS_INSTRUCTIONS]);
    expect(session.submitted).toEqual([COMPACTED_DOCS_PROMPT, COMPACTED_DOCS_PROMPT]);
  });

  test('a judge yes sends nothing when the engine skips the compaction', NO_FLOOR, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.compactSkip = 'a PreCompact hook said no';

    await $.turn.complete(finishedTurn());
    await clock.settle();

    expect(session.submitted).toEqual([]);
    expect(loggedEvents(session)).toEqual(['judge-yes', 'compact-started', 'compact-failed']);
  });

  test('sends nothing when a new turn drops it', NO_FLOOR, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.draft = 'half a thought';

    await $.turn.complete(taggedTurn('Write the docs.'));
    await clock.settle();
    await $.turn.start({ text: 'half a thought', turnId: 'turn-2' });
    await clock.settle();

    expect(session.compacts).toEqual([]);
    expect(session.submitted).toEqual([]);
    expect(loggedEvents(session)).toEqual(['compact-requested', 'compact-waiting', 'compact-dropped']);
  });

  test('sends nothing when a new turn starts before it is held', NO_FLOOR, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    await $.turn.complete(taggedTurn('Write the docs.'));
    await $.turn.start({ text: 'One more thing.', turnId: 'turn-2' });
    await clock.settle();

    expect(session.compacts).toEqual([]);
    expect(session.submitted).toEqual([]);
    expect(loggedEvents(session)).toEqual(['compact-requested', 'compact-dropped']);
    expect(loggedLines(session)[1]).toMatchObject({ reason: 'new turn started' });
  });

  test('logs a failure after an edit emptied the prompt box as request-error', NO_FLOOR, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.draft = 'half a thought';
    session.files.set(OVERRIDE_PROMPT_FILE, '{next}');
    session.unreadableFiles.add(OVERRIDE_PROMPT_FILE);

    await $.turn.complete(taggedTurn('Write the docs.'));
    await clock.settle();
    await clearDraft($, 'half a thought');
    await clock.settle();

    expect(session.compacts).toEqual([DOCS_INSTRUCTIONS]);
    expect(loggedEvents(session)).toEqual([
      'compact-requested',
      'compact-waiting',
      'compact-started',
      'compact-typed',
      'request-error',
    ]);
    expect(withoutTime(session.statuses.at(-1))).toBe('error');
  });

  test('logs a judge yes that fails after an edit emptied the prompt box as judge-error', NO_FLOOR, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.draft = 'half a thought';
    session.files.set(OVERRIDE_PROMPT_FILE, '{next}');
    session.unreadableFiles.add(OVERRIDE_PROMPT_FILE);

    await $.turn.complete(finishedTurn());
    await clock.settle();
    await clearDraft($, 'half a thought');
    await clock.settle();

    expect(loggedEvents(session)).toEqual(['judge-yes', 'compact-waiting', 'compact-started', 'compact-typed', 'judge-error']);
  });
});

describe('a tag on the first turn after a compaction', () => {
  test('counts as below the floor, also when the turn grew a floor from its start', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    session.tokens = 70000;
    await $.turn.complete(finishedTurn());
    await clock.settle();
    await $.turn.start({ text: 'continue prompt', turnId: 'turn-2' });
    await runStep($, 0);
    session.tokens = 30000;
    await runStep($, 1);
    session.tokens = 100000;
    await $.turn.complete(taggedTurn('Write the docs.', 'turn-2'));
    await clock.settle();

    expect(session.compacts).toEqual([JUDGE_INSTRUCTIONS]);
    expect(session.submitted.at(-1)).toBe(UNCOMPACTED_DOCS_PROMPT);
  });
});

describe('a tag without a token count', () => {
  test('is ignored and leaves the floor waiting', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.messages = [];
    session.tokens = undefined;

    await $.session.start({ cwd: 'C:/work', surface: 'terminal', isInteractive: true });
    await $.turn.complete(taggedTurn('Write the docs.'));
    await clock.settle();

    expect(session.compacts).toEqual([]);
    expect(session.submitted).toEqual([]);
    expect(loggedLines(session)).toMatchObject([{ event: 'usage-missing', hook: 'turn.complete' }]);
    expect(withoutTime(session.statuses.at(-1))).toBe('request ignored');
    expect(session.store.get('floor:session-1')).toBeUndefined();
  });
});

describe('a failure in the tag path', () => {
  test('is logged as request-error', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.files.set(OVERRIDE_PROMPT_FILE, '{next}');
    session.unreadableFiles.add(OVERRIDE_PROMPT_FILE);

    await $.turn.complete(taggedTurn('Write the docs.'));
    await clock.settle();

    expect(session.submitted).toEqual([]);
    expect(loggedEvents(session)).toEqual(['compact-requested', 'request-error']);
  });
});
