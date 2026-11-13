import { describe, expect, mock, test } from 'claude-code/testing';
import { CompactNudge } from '../hooks/compact-nudge.ts';
import { ContextFloor } from '../hooks/context-floor.ts';
import { SUMMARY, fakeSession, finishedTurn, loggedLines, toolResult, withoutTime, FAKE_HOME } from './fake-engine.ts';
import { notInThisMode, settleStub, stubEngine, stubLoggedLines } from './stub-engine.ts';

const START = Date.UTC(2026, 9, 8, 22, 0);
const HOME = { USERPROFILE: FAKE_HOME };

function nudge(added: string, agents: string[] = []): string {
  const running = agents.length === 0 ? '' : ` ${agents.length} subagent(s) still run (${agents.join(', ')}). You may tag now if the tag names each of them and says what to do with its report, else let them finish first.`;

  return `smartcompact: this conversation grew ${added} tokens since smartcompact started counting. Plan a compaction at the next good moment. Start no new subagents.${running} Then end your answer with <smartcompact>the prompt to start the next piece with</smartcompact>. Do this also when you would wait for the user, and put your question in the tag. Leave the tag out when the user must confirm an action that is hard to undo, such as a push, a delete or a publish.`;
}

function nudgeLines(session: ReturnType<typeof fakeSession>) {
  return loggedLines(session).filter((line) => line['event'] === 'nudge-sent');
}

describe('compact nudge', () => {
  test('skips an unavailable agent lookup until a new session', async () => {
    let agentChecks = 0;
    const { engine, record } = stubEngine({
      agents: async () => {
        agentChecks += 1;
        throw new Error(notInThisMode('$.agent.list'));
      },
    });
    const floor = new ContextFloor();
    const nudge = new CompactNudge({ minTokens: 60000, claudeModel: 'haiku' }, floor);

    for (let result = 0; result < 3; result++) {
      await nudge.nudgeIfDue(engine);
    }
    floor.restartAfterCompaction();
    floor.takeFirstTurn(1000);
    nudge.startCountOver();
    await nudge.nudgeIfDue(engine);
    await settleStub();

    expect(agentChecks).toBe(1);
    expect(stubLoggedLines(record)).toMatchObject([
      { event: 'nudge-skipped', reason: 'not available in this mode' },
    ]);
    expect(stubLoggedLines(record).filter((line) => line['event'] === 'nudge-error')).toEqual([]);
    expect(record.statuses).toEqual([]);

    nudge.startNewSession();
    await nudge.nudgeIfDue(engine);
    await settleStub();

    expect(agentChecks).toBe(2);
    expect(stubLoggedLines(record)).toHaveLength(2);
  });

  test('still logs other agent lookup errors', async () => {
    const { engine, record } = stubEngine({
      agents: async () => {
        throw new Error('agent lookup failed');
      },
    });
    const nudge = new CompactNudge({ minTokens: 60000, claudeModel: 'haiku' }, new ContextFloor());

    await nudge.nudgeIfDue(engine);
    await nudge.nudgeIfDue(engine);
    await settleStub();

    expect(stubLoggedLines(record)).toMatchObject([
      { event: 'nudge-error', message: 'agent lookup failed' },
      { event: 'nudge-error', message: 'agent lookup failed' },
    ]);
  });

  test('sends no nudge below the floor', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    session.tokens = 59000;
    await $.session.append(toolResult());
    await clock.settle();

    expect(session.notes).toEqual([]);
  });

  test('checks agents only when due and nudges while they run', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.agents = ['worker', 'reviewer'].map((id) => ({
      id, description: 'review', type: 'general-purpose', status: 'running' as const,
    }));

    session.tokens = 59000;
    await $.session.append(toolResult());
    expect(session.agentChecks).toBe(0);

    session.tokens = 61000;
    await $.session.append(toolResult());
    await clock.settle();
    expect(session.agentChecks).toBe(1);
    expect(session.notes).toEqual([nudge('61k', ['worker', 'reviewer'])]);
    expect(nudgeLines(session)).toEqual([expect.objectContaining({ nudge: 1, agents: ['worker', 'reviewer'] })]);
    expect(withoutTime(session.statuses.at(-1))).toBe('nudged');

    await $.session.append(toolResult());
    expect(session.agentChecks).toBe(1);
    expect(session.notes).toHaveLength(1);

    session.agents = [];
    session.tokens = 91000;
    await $.session.append(toolResult());
    await clock.settle();
    expect(session.agentChecks).toBe(2);
    expect(session.notes).toEqual([nudge('61k', ['worker', 'reviewer']), nudge('91k')]);
    expect(nudgeLines(session).map((line) => line['nudge'])).toEqual([1, 2]);
    expect(nudgeLines(session)[1]).not.toHaveProperty('agents');
  });

  test('retries a refused nudge while agents run', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.tokens = 61000;
    session.agents = [{ id: 'worker', description: 'review', type: 'general-purpose', status: 'running' }];
    session.noteDeny = 'policy says no';

    await $.session.append(toolResult());
    await clock.settle();
    expect(session.notes).toEqual([]);
    expect(loggedLines(session)).toContainEqual(expect.objectContaining({ event: 'nudge-error', message: 'policy says no' }));

    session.noteDeny = undefined;
    await $.session.append(toolResult());
    await clock.settle();

    expect(session.notes).toEqual([nudge('61k', ['worker'])]);
    expect(nudgeLines(session)).toEqual([expect.objectContaining({ nudge: 1, agents: ['worker'] })]);
  });

  for (const reset of ['compaction', 'clear', 'session start'] as const) {
    test(`restarts nudges with running agents after ${reset}`, async ($, on) => {
      const clock = mock.clock(on, { now: START });
      mock.env(on, HOME);
      const session = fakeSession(on);
      session.tokens = 61000;
      session.agents = [{ id: 'worker', description: 'review', type: 'general-purpose', status: 'running' }];

      await $.session.append(toolResult());
      if (reset === 'compaction') {
        await $.session.compact({ trigger: 'manual', messages: [SUMMARY] });
      } else if (reset === 'clear') {
        await $.session.end({ reason: 'clear', sessionId: session.id, resume: { id: session.id } });
      } else {
        await $.session.start({ cwd: 'C:/work', surface: 'terminal', isInteractive: true });
      }

      session.tokens = 1000;
      await $.turn.complete(finishedTurn());
      await clock.settle();
      session.tokens = 62000;
      await $.session.append(toolResult());
      await clock.settle();

      expect(session.notes).toEqual([nudge('61k', ['worker']), nudge('61k', ['worker'])]);
      expect(nudgeLines(session).map((line) => line['nudge'])).toEqual([1, 1]);
    });
  }

  test('nudges once the floor is passed', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    session.tokens = 61500;
    await $.session.append(toolResult());
    await clock.settle();

    expect(session.notes).toEqual([nudge('61k')]);
    expect(nudgeLines(session)).toEqual([expect.objectContaining({ tokens: 61500, added: 61500, nudge: 1 })]);
    expect(withoutTime(session.statuses.at(-1))).toBe('nudged');
  });

  test('nudges again only after half a floor more', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    session.tokens = 61000;
    await $.session.append(toolResult());
    session.tokens = 90999;
    await $.session.append(toolResult());
    await clock.settle();

    expect(session.notes).toHaveLength(1);

    session.tokens = 91000;
    await $.session.append(toolResult());
    await clock.settle();

    expect(session.notes).toEqual([nudge('61k'), nudge('91k')]);
    expect(nudgeLines(session).map((line) => line['nudge'])).toEqual([1, 2]);
  });

  test('waits at least 10k between nudges', { options: { minTokens: 0 } }, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    session.tokens = 1000;
    await $.session.append(toolResult());
    session.tokens = 10999;
    await $.session.append(toolResult());
    await clock.settle();

    expect(session.notes).toHaveLength(1);

    session.tokens = 11000;
    await $.session.append(toolResult());
    await clock.settle();

    expect(session.notes).toHaveLength(2);
  });

  test('a subagent tool result never nudges', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    session.tokens = 70000;
    await $.session.append(toolResult('agent-1'));
    await clock.settle();

    expect(session.notes).toEqual([]);
  });

  test('sends no nudge without a token count', { options: { minTokens: 0 } }, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    session.tokens = undefined;
    await $.session.append(toolResult());
    await clock.settle();

    expect(session.notes).toEqual([]);
    expect(loggedLines(session)).toMatchObject([{ event: 'usage-missing', hook: 'session.append' }]);
  });

  test('sends no nudge while the floor waits for its first turn', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    session.messages = [];
    await $.session.start({ cwd: 'C:/work', surface: 'terminal', isInteractive: true });
    session.tokens = 70000;
    await $.session.append(toolResult());
    await clock.settle();

    expect(session.notes).toEqual([]);
  });

  test('starts the count over after a compaction', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    session.tokens = 61000;
    await $.session.append(toolResult());
    await $.session.compact({ trigger: 'manual', messages: [SUMMARY] });
    session.tokens = 70000;
    await $.session.append(toolResult());
    await clock.settle();

    expect(session.notes).toHaveLength(1);

    session.tokens = 20000;
    await $.turn.complete(finishedTurn());
    await clock.settle();
    session.tokens = 81000;
    await $.session.append(toolResult());
    await clock.settle();

    expect(session.notes).toEqual([nudge('61k'), nudge('61k')]);
    expect(nudgeLines(session).map((line) => line['nudge'])).toEqual([1, 1]);
  });

  test('starts the count over after a /clear and its first turn', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    session.tokens = 61000;
    await $.session.append(toolResult());
    await $.session.end({ reason: 'clear', sessionId: 'session-1', resume: { id: 'session-1' } });
    session.tokens = 5000;
    await $.turn.complete(finishedTurn());
    await clock.settle();
    session.tokens = 70000;
    await $.session.append(toolResult());
    await clock.settle();

    expect(nudgeLines(session).map((line) => line['nudge'])).toEqual([1, 1]);
  });

  test('a new baseline restarts the count even when the first turn had no tool result', { options: { minTokens: 0 } }, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    session.tokens = 20000;
    await $.session.append(toolResult());
    await $.session.compact({ trigger: 'manual', messages: [SUMMARY] });
    session.tokens = 1000;
    await $.turn.complete(finishedTurn());
    await clock.settle();
    session.tokens = 25000;
    await $.session.append(toolResult());
    await clock.settle();

    expect(nudgeLines(session).map((line) => line['nudge'])).toEqual([1, 1]);
  });

  test('a session start restarts the count', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    session.tokens = 61000;
    await $.session.append(toolResult());
    await $.session.start({ cwd: 'C:/work', surface: 'terminal', isInteractive: true });
    session.tokens = 30000;
    await $.turn.complete(finishedTurn());
    await clock.settle();
    session.tokens = 91000;
    await $.session.append(toolResult());
    await clock.settle();

    expect(nudgeLines(session).map((line) => line['nudge'])).toEqual([1, 1]);
  });

  test('the nudge is stored before the append call returns', async ($, on) => {
    mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    session.tokens = 61000;
    await $.session.append(toolResult());

    expect(session.notes).toEqual([nudge('61k')]);
  });

  test('two tool results stored at once send one nudge', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    session.tokens = 61000;
    await Promise.all([$.session.append(toolResult(undefined, 'row-1')), $.session.append(toolResult(undefined, 'row-2'))]);
    await clock.settle();

    expect(session.notes).toHaveLength(1);
  });

  test('a refused nudge is logged and the tool result is still stored', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    session.tokens = 61000;
    session.noteDeny = 'policy says no';
    const stored = await $.session.append(toolResult());
    await clock.settle();

    expect(stored.uuid).toBe('row-1');
    expect(session.notes).toEqual([]);
    expect(loggedLines(session)).toContainEqual(expect.objectContaining({ event: 'nudge-error', message: 'policy says no' }));
  });
});
