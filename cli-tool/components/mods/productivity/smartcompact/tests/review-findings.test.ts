import { describe, expect, mock, test } from 'claude-code/testing';
import { buildJudgeInput } from '../hooks/judge-input.ts';
import { messageOf } from '../hooks/error-message.ts';
import { fillPlaceholders } from '../hooks/continue-placeholders.ts';
import { submitContinuePrompt } from '../hooks/continue-prompt-submit.ts';
import { composerBlocker } from '../hooks/composer-blocker.ts';
import { choicesFilePath } from '../hooks/log-paths.ts';
import { ContextFloor } from '../hooks/context-floor.ts';
import { PendingCompaction } from '../hooks/pending-compaction.ts';
import { TurnCounter } from '../hooks/turn-counter.ts';
import { TurnJudging } from '../hooks/turn-judging.ts';
import { runningSubagentIds } from '../hooks/running-subagents.ts';
import { JUDGE_SYSTEM_PROMPT } from '../hooks/judge-prompt.ts';
import { claudeVerdict, clearDraft, fakeSession, finishedTurn, taggedTurn, loggedLines, SUMMARY, OVERRIDE_PROMPT_FILE, FAKE_HOME } from './fake-engine.ts';
import { notInThisMode, settleStub, stubEngine } from './stub-engine.ts';

declare function setTimeout(callback: () => void, delay: number): unknown;

const HOME = { USERPROFILE: FAKE_HOME };
const START = Date.UTC(2026, 9, 10, 10);
const REQUEST = { source: 'request' as const, tokens: 70000, turnsAtEnd: 0, resetsAtEnd: 0, instructions: 'Keep the goal', next: 'Go on', continueWhenSkipped: true, errorEvent: 'request-error' as const };
const TEXT = { next: 'Go on', kind: 'below-floor' as const, source: 'request' as const };

describe('review findings', () => {
  test('an empty answer does not reuse text before the judged prompt', () => {
    expect(buildJudgeInput([
      { role: 'assistant', text: 'Old work is done', toolUses: [] },
      { role: 'user', text: 'Start new work', toolUses: [] },
    ], '').assistantMessage).toBe('');
  });

  test('a long prompt keeps its instructions at both ends', () => {
    const input = buildJudgeInput([{ role: 'user', text: 'HEAD ' + 'x'.repeat(3000) + ' TAIL', toolUses: [] }], '');
    expect(input.userPrompt.startsWith('HEAD ')).toBe(true);
    expect(input.userPrompt.endsWith(' TAIL')).toBe(true);
    expect(input.userPrompt.length).toBe(2000);
    expect(input.userPrompt).toContain('[...]');
  });

  test('error classification keeps the end of a long message', () => {
    const message = 'x'.repeat(250) + 'Compaction canceled.';
    expect(messageOf(new Error(message))).toBe(message);
  });

  test('YES includes options that need no detailed context', () => {
    expect(JUDGE_SYSTEM_PROMPT).toContain('options that need no detailed context');
  });

  test('a failed dialog check blocks compaction', async () => {
    const { engine } = stubEngine({ fillPrompt: async () => { throw new Error('offline'); } });
    expect(await composerBlocker(engine)).toBe('dialog open');
  });

  test('a bare log name puts choices in the absolute current folder', async () => {
    const { engine } = stubEngine({ cwd: async () => '/work' });
    engine.env.logFile = async () => 'log.jsonl';
    expect(await choicesFilePath(engine)).toBe('/work/choices.md');
  });

  test('placeholder values are never expanded again', async () => {
    const { engine } = stubEngine({ cwd: async () => '/work/{next}' });
    engine.env.logFile = async () => '/logs/{choicesHeading}/log.jsonl';
    expect(await fillPlaceholders(engine, '{choicesFile} | {choicesHeading}', 'Go on')).toBe('/logs/{choicesHeading}/choices.md | ## 1970-01-01T00:00:00.000Z | /work/{next} | session-1');
  });

  test('a turn during placeholder filling drops the continue and shows dropped', async () => {
    const turns = new TurnCounter();
    let submitted = false;
    const { engine, record } = stubEngine({
      cwd: async () => { turns.noteTurnStarted(); return '/work'; },
      submitPrompt: async () => { submitted = true; return { text: '' }; },
    });
    record.files.set('C:/plugin/smartcompact/continue-prompt.md', '{choicesHeading}');
    expect(await submitContinuePrompt(engine, turns, 0, TEXT)).toBe(false);
    expect(submitted).toBe(false);
    expect(record.statuses.at(-1)).toMatch(/^dropped /);
  });

  test('a prompt emptied by shaping is not submitted', async () => {
    const { engine, record } = stubEngine({ submitPrompt: async () => { throw new Error('must not submit'); } });
    record.files.set('C:/plugin/smartcompact/continue-prompt.md', 'Context was compacted automatically.');
    expect(await submitContinuePrompt(engine, new TurnCounter(), 0, TEXT)).toBeUndefined();
  });

  test('a turn during hold timestamp lookup drops the compaction', async () => {
    const turns = new TurnCounter();
    let compacts = 0;
    const { engine } = stubEngine({
      now: async () => { turns.noteTurnStarted(); return 0; },
      compact: async () => { compacts++; return { messages: [] }; },
    });
    await new PendingCompaction(turns, new ContextFloor()).holdAndTry(engine, REQUEST);
    expect(compacts).toBe(0);
  });

  test('a submit error after a skipped compaction never retries compact', async () => {
    const { engine, record } = stubEngine({
      compact: async () => ({ skip: 'hook blocked' }),
      submitPrompt: async () => { throw new Error('submit failed'); },
    });
    record.files.set('C:/plugin/smartcompact/continue-prompt.md', 'Continue');
    let message = '';
    try {
      await new PendingCompaction(new TurnCounter(), new ContextFloor()).holdAndTry(engine, REQUEST);
    } catch (error) {
      message = messageOf(error);
    }
    expect(message).toBe('submit failed');
    expect(record.timers).toBe(0);
  });

  test('an unavailable model clears the judging status', async () => {
    const turns = new TurnCounter();
    const floor = new ContextFloor();
    const { engine, record } = stubEngine({ complete: async () => { throw new Error(notInThisMode('$.model.complete')); } });
    await new TurnJudging({ minTokens: 0, claudeModel: 'haiku' }, turns, floor, new PendingCompaction(turns, floor)).judgeTurn(engine, { answer: 'Done', turnsAtEnd: 0 });
    await settleStub();
    expect(record.statuses.at(-1)).toBeUndefined();
  });

  for (const reset of ['clear', 'compact'] as const) {
    test(`a late judge yes after ${reset} does nothing`, { options: { minTokens: 0 } }, async ($, on) => {
      const clock = mock.clock(on, { now: START });
      mock.env(on, HOME);
      const session = fakeSession(on);
      let resolve!: () => void;
      const gate = new Promise<void>((done) => { resolve = done; });
      session.claudeReply = async () => { await gate; return claudeVerdict(true, 'done'); };
      await $.turn.complete(finishedTurn());
      await clock.settle();
      if (reset === 'clear') {
        await $.session.end({ reason: 'clear', sessionId: session.id, resume: { id: session.id } });
      } else {
        await $.session.compact({ trigger: 'manual', messages: [SUMMARY] });
        session.compacts.length = 0;
      }
      resolve();
      await clock.settle();
      expect(session.compacts).toEqual([]);
      expect(session.submitted).toEqual([]);
    });

    test(`a tag still reading its prompt after ${reset} sends nothing`, async ($, on) => {
      const clock = mock.clock(on, { now: START });
      mock.env(on, HOME);
      const session = fakeSession(on);
      let resolve!: () => void;
      const gate = new Promise<void>((done) => { resolve = done; });
      let readingPrompt = false;
      session.beforeRead = async (path) => {
        if (path.endsWith('continue-prompt.md')) {
          readingPrompt = true;
          await gate;
        }
      };
      await $.turn.complete(taggedTurn('Go on'));
      await clock.settle();
      expect(readingPrompt).toBe(true);
      expect(session.submitted).toEqual([]);
      if (reset === 'clear') {
        await $.session.end({ reason: 'clear', sessionId: session.id, resume: { id: session.id } });
      } else {
        await $.session.compact({ trigger: 'manual', messages: [SUMMARY] });
      }
      resolve();
      await clock.settle();
      expect(session.submitted).toEqual([]);
    });
  }

  test('a subagent start leaves a held compaction intact', { options: { minTokens: 0 } }, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.draft = 'draft';
    await $.turn.complete(finishedTurn());
    await clock.settle();
    await $.turn.start({ text: 'agent work', turnId: 'agent-turn', agentId: 'agent-1' });
    await clearDraft($, 'draft');
    await clock.settle();
    expect(session.compacts.length).toBe(1);
  });

  test('a subagent start does not cancel an in-flight judge yes', { options: { minTokens: 0 } }, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    let resolve!: () => void;
    const gate = new Promise<void>((done) => { resolve = done; });
    session.claudeReply = async () => { await gate; return claudeVerdict(true, 'done'); };
    await $.turn.complete(finishedTurn());
    await clock.settle();
    await $.turn.start({ text: 'agent work', turnId: 'agent-turn', agentId: 'agent-1' });
    resolve();
    await clock.settle();
    expect(session.compacts.length).toBe(1);
  });

  test('a subagent start does not drop a continue being prepared', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    let resolve!: () => void;
    const gate = new Promise<void>((done) => { resolve = done; });
    let readingPrompt = false;
    session.beforeRead = async (path) => {
      if (path.endsWith('continue-prompt.md')) {
        readingPrompt = true;
        await gate;
      }
    };
    await $.turn.complete(taggedTurn('Go on'));
    await clock.settle();
    expect(readingPrompt).toBe(true);
    expect(session.submitted).toEqual([]);
    await $.turn.start({ text: 'agent work', turnId: 'agent-turn', agentId: 'agent-1' });
    resolve();
    await clock.settle();
    expect(session.submitted.length).toBe(1);
  });

  test('a subagent start preserves the continue loop guard', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    await $.turn.complete(taggedTurn('Go on'));
    await clock.settle();
    await $.turn.start({ text: 'continue', turnId: 'turn-2' });
    await $.turn.start({ text: 'agent work', turnId: 'agent-turn', agentId: 'agent-1' });
    await $.turn.complete(taggedTurn('Again', 'turn-2'));
    await clock.settle();
    expect(session.submitted.length).toBe(1);
    expect(loggedLines(session).at(-1)).toMatchObject({ reason: 'loop guard' });
  });

  test('clear registers the prompt command again', async ($, on) => {
    mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    await $.session.end({ reason: 'clear', sessionId: session.id, resume: { id: session.id } });
    expect(session.commands).toEqual(['smartcompact-prompt']);
  });

  test('a skipped manual compact preserves the floor', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.compactSkip = 'hook blocked';
    await $.session.compact({ trigger: 'manual', messages: [SUMMARY] });
    session.tokens = 70000;
    await $.turn.complete(finishedTurn());
    await clock.settle();
    expect(session.claudeModels.length).toBe(1);
  });

  test('a tagged first turn logs zero added even after work', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.messages = [];
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true });
    session.tokens = 10000;
    for await (const _ of $.turn.step({ turnId: 'turn-1', index: 1, model: 'opus', messageCount: 1 })) {}
    session.tokens = 50000;
    session.files.set(OVERRIDE_PROMPT_FILE, '');
    await $.turn.complete(taggedTurn('Go on'));
    await clock.settle();
    expect(loggedLines(session).find((line) => line['event'] === 'compact-requested')).toMatchObject({ added: 0 });
  });
});


test('settleStub yields to a macrotask', async () => {
  let yielded = false;
  setTimeout(() => { yielded = true; }, 0);
  await settleStub();
  expect(yielded).toBe(true);
});

test('a cached folder miss uses its snapshot while the clock awaits', async () => {
  const agent = { id: 'worker', description: 'review', type: 'general-purpose', status: 'running' as const };
  const { engine: first } = stubEngine({ sessionId: async () => 'cache-first', agents: async () => [agent] });
  const { engine: second } = stubEngine({ sessionId: async () => 'cache-second', now: async () => -100000, agents: async () => [agent] });
  let scans = 0;
  first.fs.list = async () => { scans++; return []; };
  await runningSubagentIds(first);
  first.now = async () => { await runningSubagentIds(second); return 0; };
  await runningSubagentIds(first);
  expect(scans).toBe(1);
});
