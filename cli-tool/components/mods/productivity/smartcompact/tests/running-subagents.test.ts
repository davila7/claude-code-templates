import { describe, expect, mock, test } from 'claude-code/testing';
import { fakeSession, finishedTurn, loggedLines, seedSubagent, taggedTurn, FAKE_CONFIG_DIR, FAKE_HOME } from './fake-engine.ts';

const START = Date.UTC(2026, 9, 4, 10, 0);
const HOME = { USERPROFILE: FAKE_HOME };
const NO_FLOOR = { options: { minTokens: 0 } };
const BUSY_AGENT = { id: 'worker', description: 'review', type: 'general-purpose', status: 'running' as const };

describe('subagent files override a busy engine status', () => {
  for (const source of ['tag', 'judge'] as const) {
    for (const status of ['pending', 'running', 'waiting'] as const) {
      test(`a finished ${status} agent does not block the ${source}`, NO_FLOOR, async ($, on) => {
        const clock = mock.clock(on, { now: START });
        mock.env(on, HOME);
        const session = fakeSession(on);
        session.id = `finished-${status}-${source}`;
        session.agents = [{ ...BUSY_AGENT, status }];
        seedSubagent(session, 'worker', true, START);

        await $.turn.complete(source === 'tag' ? taggedTurn('Write the docs.') : finishedTurn());
        await clock.settle();

        expect(session.compacts).toHaveLength(1);
        expect(session.claudeModels).toEqual(source === 'judge' ? ['haiku'] : []);
        expect(session.notes).toEqual([]);
      });
    }

    for (const age of [60 * 60_000, 60 * 60_000 - 1000, 20 * 60_000]) {
      test(`a transcript aged ${age / 1000}s ${age === 3600000 ? 'allows' : 'blocks'} the ${source}`, NO_FLOOR, async ($, on) => {
        const clock = mock.clock(on, { now: START });
        mock.env(on, HOME);
        const session = fakeSession(on);
        session.id = `quiet-${age}-${source}`;
        session.agents = [BUSY_AGENT];
        seedSubagent(session, 'worker', false, START - age);

        await $.turn.complete(source === 'tag' ? taggedTurn('Write the docs.') : finishedTurn());
        await clock.settle();

        expect(session.compacts).toHaveLength(age === 3600000 ? 1 : 0);
        if (age < 3600000) {
          expect(loggedLines(session)).toContainEqual(expect.objectContaining({
            reason: 'subagents running', agents: ['worker'],
          }));
        }
      });
    }
  }

  test('honours CLAUDE_CONFIG_DIR and scans project folders', NO_FLOOR, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, { ...HOME, CLAUDE_CONFIG_DIR: FAKE_CONFIG_DIR });
    const session = fakeSession(on);
    session.id = 'custom-config-session';
    session.agents = [BUSY_AGENT];
    seedSubagent(session, 'worker', false, START);
    session.files.set(`${FAKE_CONFIG_DIR}/projects/unrelated/file`, '');
    session.files.set(`${FAKE_CONFIG_DIR}/projects/any-project/custom-config-session/subagents/agent-worker.meta.json`, '{"finished":true}');

    await $.turn.complete(taggedTurn('Write the docs.'));
    await clock.settle();

    expect(session.compacts).toHaveLength(1);
  });

  test('uses HOME when USERPROFILE is absent', NO_FLOOR, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, { HOME: FAKE_HOME });
    const session = fakeSession(on);
    session.id = 'home-session';
    session.agents = [BUSY_AGENT];
    seedSubagent(session, 'worker', true, START);

    await $.turn.complete(taggedTurn('Write the docs.'));
    await clock.settle();

    expect(session.compacts).toHaveLength(1);
    expect(session.listCalls).toEqual([`${FAKE_HOME}/.claude/projects`]);
  });

  for (const problem of ['broken meta', 'unreadable meta', 'missing meta', 'missing transcript'] as const) {
    test(`${problem} keeps trusting the engine status`, NO_FLOOR, async ($, on) => {
      const clock = mock.clock(on, { now: START });
      mock.env(on, HOME);
      const session = fakeSession(on);
      session.id = `untrusted-${problem}`;
      session.agents = [BUSY_AGENT];
      const transcript = seedSubagent(session, 'worker', false, START);
      const meta = transcript.replace('.jsonl', '.meta.json');

      if (problem === 'broken meta') session.files.set(meta, '{');
      if (problem === 'unreadable meta') session.unreadableFiles.add(meta);
      if (problem === 'missing meta') session.files.delete(meta);
      if (problem === 'missing transcript') session.files.delete(transcript);

      await $.turn.complete(taggedTurn('Write the docs.'));
      await clock.settle();

      expect(session.compacts).toEqual([]);
      expect(loggedLines(session)).toContainEqual(expect.objectContaining({ reason: 'subagents running' }));
    });
  }

  test('a stale transcript is enough when the meta file is missing', NO_FLOOR, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.id = 'stale-without-meta';
    session.agents = [BUSY_AGENT];
    const transcript = seedSubagent(session, 'worker', false, START - 3600000);
    session.files.delete(transcript.replace('.jsonl', '.meta.json'));

    await $.turn.complete(taggedTurn('Write the docs.'));
    await clock.settle();

    expect(session.compacts).toHaveLength(1);
  });

  test('looks again after a folder was missing', NO_FLOOR, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.id = 'late-files-session';
    session.agents = [BUSY_AGENT];

    await $.turn.complete(taggedTurn('Write the docs.'));
    await clock.settle();
    expect(session.compacts).toEqual([]);

    seedSubagent(session, 'worker', true, START);
    await clock.advance(60_001);
    await $.turn.complete(taggedTurn('Write the docs.', 'turn-2'));
    await clock.settle();

    expect(session.compacts).toHaveLength(1);
    expect(session.listCalls).toHaveLength(2);
  });

  test('a missing folder is cached for 60 seconds', NO_FLOOR, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.id = 'cached-miss-session';
    session.agents = [BUSY_AGENT];
    session.files.set(`${FAKE_HOME}/.claude/projects/unrelated/file`, '');

    await $.turn.complete(taggedTurn('Write the docs.'));
    await clock.settle();
    seedSubagent(session, 'worker', true, START);
    await clock.advance(59_999);
    await $.turn.complete(taggedTurn('Write the docs.', 'turn-2'));
    await clock.settle();

    expect(session.listCalls).toEqual([`${FAKE_HOME}/.claude/projects`]);
    expect(session.compacts).toEqual([]);

    await clock.advance(1);
    await $.turn.complete(taggedTurn('Write the docs.', 'turn-3'));
    await clock.settle();

    expect(session.listCalls).toHaveLength(2);
    expect(session.compacts).toHaveLength(1);
  });

  test('a throwing list keeps trusting the engine status', NO_FLOOR, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.id = 'throwing-list-session';
    session.agents = [BUSY_AGENT];

    await $.turn.complete(taggedTurn('Write the docs.'));
    await clock.settle();
    await $.turn.complete(taggedTurn('Write the docs.', 'turn-2'));
    await clock.settle();

    expect(session.listCalls).toEqual([`${FAKE_HOME}/.claude/projects`]);
    expect(session.compacts).toEqual([]);
    expect(loggedLines(session)).toContainEqual(expect.objectContaining({
      event: 'request-ignored', reason: 'subagents running', agents: ['worker'], missing: ['worker'],
    }));
  });

  for (const [id, named, followed] of [
    ['agent-1', 'agent-10', false],
    ['agent-1', 'agent-1', true],
    ['agent-1', 'agent-1.', true],
    ['agent-1', '(agent-1)', true],
    ['worker@team', 'worker@team', true],
    ['worker@team', 'worker@teams', false],
    ['a.b', 'a.b', true],
    ['a.b', 'axb', false],
    ...['a', '1', '_', '-'].flatMap((boundary) => [
      ['agent-1', `${boundary}agent-1`, false] as const,
      ['agent-1', `agent-1${boundary}`, false] as const,
    ]),
  ] as const) {
    test(`a tag naming ${named} ${followed ? 'follows' : 'ignores'} running ${id}`, NO_FLOOR, async ($, on) => {
      const clock = mock.clock(on, { now: START });
      mock.env(on, HOME);
      const session = fakeSession(on);
      session.agents = [{ ...BUSY_AGENT, id }];

      await $.turn.complete(taggedTurn(`Keep the report from ${named}`));
      await clock.settle();

      expect(session.compacts).toHaveLength(followed ? 1 : 0);
      if (followed) {
        expect(session.notes).toEqual([]);
      } else {
        expect(loggedLines(session)).toContainEqual(expect.objectContaining({
          event: 'request-ignored', reason: 'subagents running', agents: [id], missing: [id],
        }));
      }
    });
  }

  test('a teammate id keeps trusting the engine status even with finished files', NO_FLOOR, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.id = 'teammate-session';
    session.agents = [{ ...BUSY_AGENT, id: 'worker@team' }];
    seedSubagent(session, 'worker@team', true, START - 3600000);

    await $.turn.complete(taggedTurn('Write the docs.'));
    await clock.settle();

    expect(session.compacts).toEqual([]);
    expect(loggedLines(session)).toContainEqual(expect.objectContaining({
      reason: 'subagents running', agents: ['worker@team'],
    }));
  });

  test('keeps the folder for one session and looks again for another', NO_FLOOR, async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.id = 'cached-hit-session';
    session.agents = [BUSY_AGENT];
    const transcript = seedSubagent(session, 'worker', false, START);
    const meta = transcript.replace('.jsonl', '.meta.json');

    await $.turn.complete(taggedTurn('Write the docs.'));
    await clock.settle();
    session.files.delete(meta);
    session.files.delete(transcript);
    session.files.set(`${FAKE_HOME}/.claude/projects/other/${session.id}/subagents/agent-worker.meta.json`, '{"finished":true}');
    await $.turn.complete(taggedTurn('Write the docs.', 'turn-2'));
    await clock.settle();
    expect(session.compacts).toEqual([]);

    session.id = 'cached-hit-next-session';
    session.files.set(`${FAKE_HOME}/.claude/projects/other/${session.id}/subagents/agent-worker.meta.json`, '{"finished":true}');
    await $.turn.complete(taggedTurn('Write the docs.', 'turn-3'));
    await clock.settle();

    expect(session.compacts).toHaveLength(1);
  });
});
