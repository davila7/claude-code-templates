import { describe, expect, mock, test } from 'claude-code/testing';
import {
  OVERRIDE_PROMPT_FILE,
  SHIPPED_CONTINUE_PROMPT,
  fakeSession,
  loggedEvents,
  runCommand,
  FAKE_HOME,
} from './fake-engine.ts';

const START = Date.UTC(2026, 9, 4, 10, 0);
const HOME = { USERPROFILE: FAKE_HOME };
const START_ARGS = { cwd: 'C:/work', surface: 'terminal', isInteractive: true } as const;

describe('/smartcompact-prompt', () => {
  test('is registered when the session starts', async ($, on) => {
    mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    await $.session.start(START_ARGS);

    expect(session.commands).toEqual(['smartcompact-prompt']);
  });

  test('a refused registration is logged and the session still starts', async ($, on) => {
    const clock = mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.isCommandRefused = true;

    const started = await $.session.start(START_ARGS);
    await clock.settle();

    expect(started).toEqual({ cwd: 'C:/work' });
    expect(loggedEvents(session)).toEqual(['command-error']);
  });

  test('copies the default to the override path and prints the path', async ($, on) => {
    mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);

    await $.session.start(START_ARGS);
    const result = await runCommand($, 'smartcompact-prompt');

    expect(result.text).toBe(
      `Created ${OVERRIDE_PROMPT_FILE} from the default. Edit it to change the continue prompt. An empty file turns it off.`,
    );
    expect(session.files.get(OVERRIDE_PROMPT_FILE)).toBe(SHIPPED_CONTINUE_PROMPT);
  });

  test('keeps an override that exists and prints its path', async ($, on) => {
    mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.files.set(OVERRIDE_PROMPT_FILE, 'My own prompt.');

    await $.session.start(START_ARGS);
    const result = await runCommand($, 'smartcompact-prompt');

    expect(result.text).toBe(`Your continue prompt is ${OVERRIDE_PROMPT_FILE}`);
    expect(session.files.get(OVERRIDE_PROMPT_FILE)).toBe('My own prompt.');
  });

  test('keeps an empty override, which turns the prompt off', async ($, on) => {
    mock.clock(on, { now: START });
    mock.env(on, HOME);
    const session = fakeSession(on);
    session.files.set(OVERRIDE_PROMPT_FILE, '');

    await $.session.start(START_ARGS);
    await runCommand($, 'smartcompact-prompt');

    expect(session.files.get(OVERRIDE_PROMPT_FILE)).toBe('');
  });
});
