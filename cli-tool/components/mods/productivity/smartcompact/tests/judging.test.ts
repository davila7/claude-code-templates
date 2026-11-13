import { describe, expect, mock, test } from 'claude-code/testing';
import { claudeVerdict, fakeSession, finishedTurn, loggedEvents, loggedLines, seedSubagent, FAKE_HOME } from './fake-engine.ts';

const START = Date.UTC(2026, 9, 4, 10, 0);
const HOME = { USERPROFILE: FAKE_HOME };

describe('token floor', () => {
  test('shows the countdown from the current context as soon as the session starts', async ($, on) => {
    mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on, { 'floor:session-1': { baseline: 0, waitingFor: null, savedAt: START } });

    session.tokens = 25000;
    await $.session.start({ cwd: 'C:/work', surface: 'terminal', isInteractive: true });

    expect(session.statuses).toEqual(['judge in 35k']);
  });

  test('a resumed session above the floor is judged after its next turn', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on, { 'floor:session-1': { baseline: 0, waitingFor: null, savedAt: START } });

    session.tokens = 188000;
    await $.session.start({ cwd: 'C:/work', surface: 'terminal', isInteractive: true });

    expect(session.statuses).toEqual(['judge after next turn']);

    await $.turn.complete(finishedTurn());
    await clock.settle();

    expect(session.claudeModels).toEqual(['haiku']);
  });

  test('skips the judge until the context reaches the floor', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    session.tokens = 20000;
    await $.turn.complete(finishedTurn('turn-1'));
    await clock.settle();

    expect(session.claudeModels).toEqual([]);
    expect(session.statuses.at(-1)).toBe('judge in 40k');
    expect(loggedLines(session)[0]).toMatchObject({ event: 'judge-skipped', reason: 'below floor', baseline: 0 });

    session.tokens = 50000;
    await $.turn.complete(finishedTurn('turn-2'));
    await clock.settle();

    expect(session.statuses.at(-1)).toBe('judge in 10k');

    session.tokens = 60000;
    await $.turn.complete(finishedTurn('turn-3'));
    await clock.settle();

    expect(session.claudeModels).toEqual(['haiku']);
  });

  test('follows the minTokens option', { options: { minTokens: 0 } }, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    await $.turn.complete(finishedTurn());
    await clock.settle();

    expect(session.claudeModels).toEqual(['haiku']);
  });
});

describe('subagents', () => {
  test('skips the judge while a subagent runs', { options: { minTokens: 0 } }, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.agents = [{ id: 'agent-1', description: 'review', type: 'general-purpose', status: 'running' }];

    await $.turn.complete(finishedTurn());
    await clock.settle();

    expect(session.claudeModels).toEqual([]);
    expect(session.statuses.at(-1)).toBe('waiting for subagents');
    expect(loggedLines(session)[0]).toMatchObject({ reason: 'subagents running', agents: ['agent-1'] });
  });

  test('judges when every subagent has finished', { options: { minTokens: 0 } }, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.agents = [{ id: 'agent-1', description: 'review', type: 'general-purpose', status: 'completed' }];

    await $.turn.complete(finishedTurn());
    await clock.settle();

    expect(session.claudeModels).toEqual(['haiku']);
  });
});

describe('subagent race guard', () => {
  for (const finished of [false, true]) {
    test(`a subagent starting during judging ${finished ? 'does not cancel a yes when its files say finished' : 'cancels the yes'}`, { options: { minTokens: 0 } }, async ($, on) => {
      const clock = mock.clock(on, { now: START });
      mock.env(on, HOME);
      const session = fakeSession(on);
      session.id = `judge-race-${finished}`;
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
      expect(session.claudeModels).toEqual(['haiku']);
      session.agents = [{ id: 'worker', description: 'review', type: 'general-purpose', status: 'running' }];
      seedSubagent(session, 'worker', finished, START);
      answer();
      await clock.settle();

      expect(session.compacts).toHaveLength(finished ? 1 : 0);
      if (finished) {
        expect(loggedEvents(session)).toContain('judge-yes');
        expect(loggedEvents(session)).not.toContain('judge-cancelled');
      } else {
        expect(loggedLines(session)).toContainEqual(expect.objectContaining({
          event: 'judge-cancelled', reason: 'subagents running', agents: ['worker'],
        }));
      }
    });
  }
});

describe('judge model', () => {
  test('asks the default Claude model', { options: { minTokens: 0 } }, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    await $.turn.complete(finishedTurn());
    await clock.settle();

    expect(session.claudeModels).toEqual(['haiku']);
    expect(loggedLines(session)[0]).toMatchObject({ event: 'judge-yes', model: 'haiku' });
  });

  test('asks the chosen Claude model', { options: { minTokens: 0, claudeModel: 'sonnet' } }, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    await $.turn.complete(finishedTurn());
    await clock.settle();

    expect(session.claudeModels).toEqual(['sonnet']);
    expect(loggedLines(session)[0]).toMatchObject({ event: 'judge-yes', model: 'sonnet' });
  });

  test('ignores a leftover judge or azureModel setting', {
    options: { minTokens: 0, judge: 'azure', azureModel: 'old' },
  }, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    await $.turn.complete(finishedTurn());
    await clock.settle();

    expect(session.claudeModels).toEqual(['haiku']);
  });
});

describe('judge log lines', () => {
  const SECRET_PROMPT = 'secret prompt text';
  const VERDICTS = [
    { name: 'yes', compact: true, event: 'judge-yes' },
    { name: 'no', compact: false, event: 'judge-no' },
  ];

  for (const { name, compact, event } of VERDICTS) {
    test(`a ${name} logs no prompt, no answer and no reason text`, { options: { minTokens: 0 } }, async ($, on) => {
      const clock = mock.clock(on, { now: START });
      mock.env(on, HOME);
      const session = fakeSession(on);
      session.messages = [{ role: 'user', text: SECRET_PROMPT, toolUses: [] }];
      session.claudeReply = () => claudeVerdict(compact, 'a short reason');

      await $.turn.complete(finishedTurn());
      await clock.settle();

      const line = loggedLines(session).find((logged) => logged['event'] === event);

      expect(line).toMatchObject({ event, reasonChars: 14 });
      expect(line).not.toHaveProperty('reason');
      expect(line).not.toHaveProperty('prompt');
      expect(line).not.toHaveProperty('answer');
    });
  }

  test('the compaction after a yes logs no reason text', { options: { minTokens: 0 } }, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.claudeReply = () => claudeVerdict(true, 'a short reason');

    await $.turn.complete(finishedTurn());
    await clock.settle();

    const logged = JSON.stringify(loggedLines(session));

    expect(logged).not.toContain('a short reason');
  });
});

describe('judge errors', () => {
  test('a model call that throws is logged and nothing compacts', { options: { minTokens: 0 } }, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.claudeReply = () => {
      throw new Error('model offline');
    };

    await $.turn.complete(finishedTurn());
    await clock.settle();

    expect(loggedLines(session)[0]).toMatchObject({ event: 'judge-error' });
    expect(session.statuses.at(-1)).toMatch(/^error \d\d:\d\d$/);
    expect(session.compacts).toEqual([]);
  });

  test('a reply that is no verdict counts as no and shows no error', { options: { minTokens: 0 } }, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.claudeReply = () => ({ isAnswered: true, text: 'I think so', usage: { ...noUsage(), output_tokens: 4 } });

    await $.turn.complete(finishedTurn());
    await clock.settle();

    expect(loggedLines(session)).toMatchObject([{ event: 'judge-unreadable', replyChars: 10, startsWithBrace: false, outputTokens: 4 }]);
    expect(session.compacts).toEqual([]);
    expect(session.statuses.at(-1)).toBe('judge after next turn');
    expect(loggedLines(session)[0]).not.toHaveProperty('raw');
    expect(JSON.stringify(loggedLines(session))).not.toContain('I think so');
  });

  test('an unreadable reply logs only its length and shape', { options: { minTokens: 0 } }, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    const reply = '  {private judge reply ' + 'x'.repeat(500);
    session.claudeReply = () => ({ isAnswered: true, text: reply, usage: noUsage() });

    await $.turn.complete(finishedTurn());
    await clock.settle();

    expect(loggedLines(session)[0]).toMatchObject({
      event: 'judge-unreadable', replyChars: reply.length, startsWithBrace: true,
    });
    expect(loggedLines(session)[0]).not.toHaveProperty('raw');
    expect(JSON.stringify(loggedLines(session))).not.toContain('private judge reply');
    expect(JSON.stringify(loggedLines(session))).not.toContain('x'.repeat(300));
  });

  test('a verdict without a boolean compact field counts as no', { options: { minTokens: 0 } }, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.claudeReply = () => ({ isAnswered: true, text: '{"compact": "yes"}', usage: noUsage() });

    await $.turn.complete(finishedTurn());
    await clock.settle();

    expect(loggedEvents(session)).toEqual(['judge-unreadable']);
    expect(session.compacts).toEqual([]);
  });

  test('a Claude judge without an answer is a judge error', { options: { minTokens: 0 } }, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.claudeReply = () => ({ isAnswered: false, reason: 'empty-reply', usage: noUsage() });

    await $.turn.complete(finishedTurn());
    await clock.settle();

    expect(loggedLines(session)[0]).toMatchObject({
      event: 'judge-error',
      message: 'model gave no answer: empty-reply',
    });
  });
});

describe('a missing token count', () => {
  const START_ARGS = { cwd: 'C:/work', surface: 'terminal', isInteractive: true } as const;

  test('leaves the floor waiting and judges nothing', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    session.messages = [];
    session.tokens = undefined;
    await $.session.start(START_ARGS);
    await $.turn.complete(finishedTurn('turn-1'));
    await clock.settle();

    expect(session.claudeModels).toEqual([]);
    expect(session.compacts).toEqual([]);
    expect(session.statuses).toEqual(['judge in 60k']);
    expect(loggedLines(session)).toMatchObject([{ event: 'usage-missing', hook: 'turn.complete' }]);
    expect(session.store.get('floor:session-1')).toBeUndefined();
  });

  test('the next turn with a count is the first turn', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    session.messages = [];
    session.tokens = undefined;
    await $.session.start(START_ARGS);
    await $.turn.complete(finishedTurn('turn-1'));
    await clock.settle();

    session.tokens = 80000;
    await $.turn.complete(finishedTurn('turn-2'));
    await clock.settle();

    expect(loggedLines(session).at(-1)).toMatchObject({
      event: 'judge-skipped',
      reason: 'first turn of session',
      tokens: 80000,
    });
  });

  test('judges nothing with a floor of 0', { options: { minTokens: 0 } }, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    session.tokens = undefined;
    await $.turn.complete(finishedTurn());
    await clock.settle();

    expect(session.claudeModels).toEqual([]);
    expect(session.compacts).toEqual([]);
    expect(loggedEvents(session)).toEqual(['usage-missing']);
  });
});

function noUsage() {
  return { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };
}

describe('first turn of a session', () => {
  const START_ARGS = { cwd: 'C:/work', surface: 'terminal', isInteractive: true } as const;
  const DAY_MS = 24 * 60 * 60 * 1000;

  test('shows the full floor at start, skips the first turn, then counts from it', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    session.messages = [];
    session.tokens = 80000;
    await $.session.start(START_ARGS);

    expect(session.statuses).toEqual(['judge in 60k']);

    await $.turn.complete(finishedTurn('turn-1'));
    await clock.settle();

    expect(session.claudeModels).toEqual([]);
    expect(loggedLines(session)).toMatchObject([{ event: 'judge-skipped', reason: 'first turn of session' }]);

    session.tokens = 120000;
    await $.turn.complete(finishedTurn('turn-2'));
    await clock.settle();

    expect(session.statuses.at(-1)).toBe('judge in 20k');

    session.tokens = 140000;
    await $.turn.complete(finishedTurn('turn-3'));
    await clock.settle();

    expect(session.claudeModels).toEqual(['haiku']);
  });

  test('a resumed session with saved state keeps its baseline and shows the right countdown', async ($, on) => {
    mock.clock(on, { now: START });
    mock.env(on, HOME);
    const saved = { 'session-1': { baseline: 80000, waitingFor: null, savedAt: START } };
    const session = fakeSession(on, { 'floor:session-1': saved['session-1'] });

    session.tokens = 110000;
    await $.session.start(START_ARGS);

    expect(session.statuses).toEqual(['judge in 30k']);
  });

  test('a saved state that still waits for a first turn shows the full floor', async ($, on) => {
    mock.clock(on, { now: START });
    mock.env(on, HOME);
    const saved = { 'session-1': { baseline: 0, waitingFor: 'first turn of session', savedAt: START } };
    const session = fakeSession(on, { 'floor:session-1': saved['session-1'] });

    session.tokens = 90000;
    await $.session.start(START_ARGS);

    expect(session.statuses).toEqual(['judge in 60k']);
  });

  test('saved state wins over an empty conversation', async ($, on) => {
    mock.clock(on, { now: START });
    mock.env(on, HOME);
    const saved = { 'session-1': { baseline: 80000, waitingFor: null, savedAt: START } };
    const session = fakeSession(on, { 'floor:session-1': saved['session-1'] });

    session.messages = [];
    session.tokens = 100000;
    await $.session.start(START_ARGS);

    expect(session.statuses).toEqual(['judge in 40k']);
  });

  test('a resumed session with messages and no saved state skips its first turn and counts from it', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    session.tokens = 100000;
    await $.session.start(START_ARGS);

    expect(session.statuses).toEqual(['judge in 60k']);

    await $.turn.complete(finishedTurn('turn-1'));
    await clock.settle();

    expect(session.claudeModels).toEqual([]);
    expect(loggedLines(session)).toMatchObject([
      { event: 'judge-skipped', reason: 'first turn of session', baseline: 100000 },
    ]);

    session.tokens = 130000;
    await $.turn.complete(finishedTurn('turn-2'));
    await clock.settle();

    expect(session.statuses.at(-1)).toBe('judge in 30k');
  });

  test('a resume to another session without saved state drops the previous baseline', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    session.messages = [];
    session.tokens = 80000;
    await $.session.start(START_ARGS);
    await $.turn.complete(finishedTurn());
    await clock.settle();

    session.id = 'session-2';
    session.messages = [{ role: 'user', text: 'Add the feature.', toolUses: [] }];
    session.tokens = 100000;
    await $.session.start(START_ARGS);

    expect(session.statuses.at(-1)).toBe('judge in 60k');

    await $.turn.complete(finishedTurn('turn-2'));
    await clock.settle();

    expect(loggedLines(session).at(-1)).toMatchObject({ reason: 'first turn of session', baseline: 100000 });
  });

  test('a /clear ends the session without a start, so its next turn is skipped as a first turn', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const saved = { 'session-1': { baseline: 10000, waitingFor: null, savedAt: START } };
    const session = fakeSession(on, { 'floor:session-1': saved['session-1'] });

    session.tokens = 90000;
    await $.session.start(START_ARGS);
    await $.session.end({ reason: 'clear', sessionId: 'session-1', resume: { id: 'session-1' } });
    await $.turn.complete(finishedTurn());
    await clock.settle();

    expect(session.claudeModels).toEqual([]);
    expect(loggedLines(session)).toMatchObject([{ event: 'judge-skipped', reason: 'first turn of session' }]);
  });

  test('a /clear shows the full floor at once', async ($, on) => {
    mock.clock(on, { now: START });
    mock.env(on, HOME);
    const saved = { 'session-1': { baseline: 10000, waitingFor: null, savedAt: START } };
    const session = fakeSession(on, { 'floor:session-1': saved['session-1'] });

    session.tokens = 35000;
    await $.session.start(START_ARGS);

    expect(session.statuses).toEqual(['judge in 35k']);

    await $.session.end({ reason: 'clear', sessionId: 'session-1', resume: { id: 'session-1' } });

    expect(session.statuses.at(-1)).toBe('judge in 60k');
  });

  test('the first turn after a /clear shows the full floor', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const saved = { 'session-1': { baseline: 10000, waitingFor: null, savedAt: START } };
    const session = fakeSession(on, { 'floor:session-1': saved['session-1'] });

    session.tokens = 35000;
    await $.session.start(START_ARGS);
    await $.session.end({ reason: 'clear', sessionId: 'session-1', resume: { id: 'session-1' } });
    const statusesBefore = session.statuses.length;

    session.tokens = 20000;
    await $.turn.complete(finishedTurn());
    await clock.settle();

    expect(session.statuses.slice(statusesBefore)).toEqual(['judge in 60k']);
  });

  test('the first turn after a compaction shows the full floor', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    session.tokens = 70000;
    await $.turn.complete(finishedTurn('turn-1'));
    await clock.settle();

    expect(session.compacts).toHaveLength(1);

    session.tokens = 30000;
    await $.turn.complete(finishedTurn('turn-2'));
    await clock.settle();

    expect(session.statuses.at(-1)).toBe('judge in 60k');
  });

  test('saves the baseline when the first turn is taken', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    session.messages = [];
    session.tokens = 80000;
    await $.session.start(START_ARGS);
    await $.turn.complete(finishedTurn());
    await clock.settle();

    expect(session.store.get('floor:session-1')).toEqual({
      baseline: 80000, waitingFor: null, savedAt: START,
    });
  });

  test('drops saved entries older than 30 days when it writes', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const stored = {
      'floor-index': { old: START - 31 * DAY_MS, recent: START - 29 * DAY_MS },
      'floor:old': { baseline: 1, waitingFor: null, savedAt: START - 31 * DAY_MS },
      'floor:recent': { baseline: 2, waitingFor: null, savedAt: START - 29 * DAY_MS },
    };
    const session = fakeSession(on, stored);

    session.messages = [];
    session.tokens = 80000;
    await $.session.start(START_ARGS);
    await $.turn.complete(finishedTurn());
    await clock.settle();

    expect(Object.keys(session.store.get('floor-index') as object).sort()).toEqual(['recent', 'session-1']);
    expect(session.store.get('floor:old')).toBeUndefined();
  });
});
