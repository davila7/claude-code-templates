import { describe, expect, test } from 'claude-code/testing';
import { ContextFloor } from '../hooks/context-floor.ts';
import { PendingCompaction } from '../hooks/pending-compaction.ts';
import { RequestFollowing } from '../hooks/request-following.ts';
import { TurnCounter } from '../hooks/turn-counter.ts';
import { TurnJudging } from '../hooks/turn-judging.ts';
import { COMPACTION_CANCELLED, notInThisMode, settleStub, stubEngine, stubLoggedLines } from './stub-engine.ts';

const SETTINGS = { minTokens: 0, claudeModel: 'haiku' };
const REQUEST = {
  source: 'judge' as const,
  tokens: 70000,
  turnsAtEnd: 0,
  instructions: 'Keep the current goal.',
  next: '',
  continueWhenSkipped: true,
  errorEvent: 'judge-error' as const,
};

function events(lines: Record<string, unknown>[]): unknown[] {
  return lines.map((line) => line['event']);
}

describe('a compaction that cannot work', () => {
  test('is dropped once when this mode cannot compact', async () => {
    const turns = new TurnCounter();
    const { engine, record } = stubEngine({
      compact: async () => {
        throw new Error(notInThisMode('$.session.compact'));
      },
    });

    await new PendingCompaction(turns, new ContextFloor()).holdAndTry(engine, REQUEST);
    await settleStub();

    const lines = stubLoggedLines(record);

    expect(events(lines)).toEqual(['compact-started', 'compact-failed', 'compact-dropped']);
    expect(lines.at(-1)).toMatchObject({ reason: 'not available in this mode' });
    expect(record.timers).toBe(0);
    expect(record.statuses.at(-1)).toMatch(/^dropped /);
  });

  test('is dropped when the person cancels it, and nothing is sent', async () => {
    const sent: string[] = [];
    const { engine, record } = stubEngine({
      compact: async () => {
        throw new Error(COMPACTION_CANCELLED);
      },
      submitPrompt: async (input) => {
        sent.push(input.text);

        return { text: input.text };
      },
    });

    await new PendingCompaction(new TurnCounter(), new ContextFloor()).holdAndTry(engine, REQUEST);
    await settleStub();

    expect(events(stubLoggedLines(record))).toEqual(['compact-started', 'compact-failed', 'compact-dropped']);
    expect(stubLoggedLines(record).at(-1)).toMatchObject({ reason: 'cancelled' });
    expect(record.timers).toBe(0);
    expect(sent).toEqual([]);
  });

  test('waits and retries on any other error', async () => {
    const { engine, record } = stubEngine({
      compact: async () => {
        throw new Error('smartcompact: $.session.compact: a turn is in flight');
      },
    });

    await new PendingCompaction(new TurnCounter(), new ContextFloor()).holdAndTry(engine, REQUEST);
    await settleStub();

    expect(events(stubLoggedLines(record))).toEqual(['compact-started', 'compact-failed', 'compact-waiting']);
    expect(record.timers).toBe(1);
  });
});

describe('a judge in a mode without the calls it needs', () => {
  test('skips without a judge-error', async () => {
    const turns = new TurnCounter();
    const floor = new ContextFloor();
    const { engine, record } = stubEngine({
      agents: async () => {
        throw new Error(notInThisMode('$.agent.list'));
      },
    });
    const judging = new TurnJudging(SETTINGS, turns, floor, new PendingCompaction(turns, floor));

    await judging.judgeTurn(engine, { answer: 'Done.', turnsAtEnd: 0 });
    await settleStub();

    expect(stubLoggedLines(record)).toMatchObject([{ event: 'judge-skipped', reason: 'not available in this mode' }]);
    expect(record.statuses.filter((status) => status?.startsWith('error'))).toEqual([]);
  });
});

describe('a tagged turn in a mode without the calls it needs', () => {
  test('is ignored without a request-error', async () => {
    const turns = new TurnCounter();
    const floor = new ContextFloor();
    const { engine, record } = stubEngine({
      agents: async () => {
        throw new Error(notInThisMode('$.agent.list'));
      },
    });
    const following = new RequestFollowing(SETTINGS, turns, floor, new PendingCompaction(turns, floor));

    await following.followRequest(engine, { answer: 'Done.', turnsAtEnd: 0 }, { next: 'Go on.' });
    await settleStub();

    const lines = stubLoggedLines(record);

    expect(events(lines)).not.toContain('request-error');
    expect(lines.at(-1)).toMatchObject({ event: 'request-ignored', reason: 'not available in this mode' });
    expect(record.statuses.filter((status) => status?.startsWith('error'))).toEqual([]);
  });
});
