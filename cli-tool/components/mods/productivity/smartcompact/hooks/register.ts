import type { EngineInterface, Register, TurnCompleteInput } from 'claude-code';
import { readCompactRequest } from './compact-request.ts';
import { CompactNudge } from './compact-nudge.ts';
import { withCompactRule } from './compact-rule.ts';
import { ContextFloor } from './context-floor.ts';
import { contextTokens } from './context-tokens.ts';
import type { Engine } from './engine.ts';
import { messageOf } from './error-message.ts';
import { logEvent } from './event-log.ts';
import { startFloor } from './floor-start.ts';
import { saveFloorState } from './floor-store.ts';
import { PendingCompaction } from './pending-compaction.ts';
import { settingsFrom } from './plugin-settings.ts';
import { PROMPT_COMMAND, createOverrideIfMissing } from './prompt-command.ts';
import { RequestFollowing } from './request-following.ts';
import { showJudgeCountdown } from './status-line.ts';
import { TurnCounter } from './turn-counter.ts';
import { TurnJudging } from './turn-judging.ts';

/** Wires the engine events to the judging, the nudge, the pending compaction and the turn count. */
export const register: Register = (on, options) => {
  const settings = settingsFrom(options);
  const turns = new TurnCounter();
  const floor = new ContextFloor();
  const compaction = new PendingCompaction(turns, floor);
  const judging = new TurnJudging(settings, turns, floor, compaction);
  const requests = new RequestFollowing(settings, turns, floor, compaction);
  const nudge = new CompactNudge(settings, floor);

  // Without the countdown the line stays empty until the first turn ends.
  on('session.start', async ($, e, next) => {
    const engine = engineOf($);

    await startFloor(engine, floor);
    nudge.startNewSession();

    const tokens = await contextTokens(engine);
    // A new session has no count before its first response, and nothing is added yet.
    const added = tokens === undefined ? 0 : floor.addedTokens(tokens);

    showJudgeCountdown(engine, settings.minTokens - added);
    await registerPromptCommand(engine);

    return next(e);
  });

  // Every main loop turn counts: typed, queued, from a task notification or from this plugin.
  on('turn.start', ($, e, next) => {
    turns.noteTurnStarted();
    void compaction.drop(engineOf($), 'new turn started');

    return next(e);
  });

  // The count before a main step after the first is the first request's input: the context at turn start plus the
  // prompt. The stream passes on unchanged.
  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined && e.index >= 1 && floor.state().waitingFor !== null) {
      const tokens = await contextTokens(engineOf($));

      if (tokens !== undefined) {
        floor.noteTurnStartReading(tokens);
      }
    }

    return yield* next(e);
  });

  // The judge or the tag's request runs after the turn has settled, so the turn never waits on it.
  on('turn.complete', async ($, e, next) => {
    const turnsAtEnd = turns.count();
    const completed = await next(e);

    if (isMainLoopAnswer(e)) {
      const turn = { answer: e.answer, turnsAtEnd };
      const request = readCompactRequest(e.answer);

      void (request === null
        ? judging.judgeTurn(engineOf($), turn)
        : requests.followRequest(engineOf($), turn, request));
    }

    return completed;
  });

  // Awaited, so the nudge row is stored before the engine sends its next request. The nudge itself comes in by
  // door `note` and never fires this hook again.
  on('session.append', { door: 'tool-result' }, async ($, e, next) => {
    const stored = await next(e);

    if (e.agentId === undefined) {
      await nudge.nudgeIfDue(engineOf($));
    }

    return stored;
  });

  on('prompt.edit', async ($, e, next) => {
    const edited = await next(e);

    compaction.retryAfterEdit(engineOf($), edited.text);

    return edited;
  });

  // The engine renders the blocks again after a compaction or /clear, so the session always has the rule.
  on('prompt.context', async (_$, e, next) => {
    const context = await next(e);

    return { ...context, blocks: withCompactRule(context.blocks) };
  });

  on('command.run', { command: PROMPT_COMMAND.name }, async ($) => ({
    text: await createOverrideIfMissing(engineOf($)),
  }));

  // A /compact typed by hand or Claude's own auto-compact already did the work.
  on('session.compact', async ($, e, next) => {
    if (e.agentId === undefined && (e.trigger === 'manual' || e.trigger === 'auto')) {
      const engine = engineOf($);
      // A missing count leaves the tokens field out of the row.
      logEvent(engine, 'compact-other', { trigger: e.trigger, tokens: await contextTokens(engine) });
      await compaction.drop(engine, `${e.trigger} compact`);
    }

    const compacted = await next(e);

    if (e.agentId === undefined) {
      floor.restartAfterCompaction();
      await saveFloorState(engineOf($), floor);
    }

    return compacted;
  });

  // A /clear fires no session.start, so the floor and its countdown start over here.
  on('session.end', async ($, e, next) => {
    await compaction.drop(engineOf($), `session ${e.reason}`);

    if (e.reason === 'clear') {
      floor.startNewSession();
      nudge.startCountOver();
      showJudgeCountdown(engineOf($), settings.minTokens);
    }

    return next(e);
  });
};

// A registered command lasts one session, so each start registers it again. A refusal must not stop the start.
async function registerPromptCommand(engine: Engine): Promise<void> {
  try {
    await engine.registerCommand(PROMPT_COMMAND);
  } catch (error) {
    logEvent(engine, 'command-error', { message: messageOf(error) });
  }
}

// A subagent's turn, an interrupt or an API error is no moment to judge or to follow a tag.
function isMainLoopAnswer(e: TurnCompleteInput): boolean {
  return e.agentId === undefined && e.reason === 'answer';
}

/** Binds every engine call the plugin makes. Each one is spelled `$.noun.event(...)`, as the engine requires. */
function engineOf($: EngineInterface): Engine {
  return {
    pluginRoot: () => $.plugin.root,
    now: () => $.clock.now(),
    after: (ms, fn) => $.clock.after(ms, fn),
    // The engine puts the plugin name in front by itself.
    status: (text) => $.ui.status(text),
    sessionId: () => $.session.id(),
    cwd: () => $.session.cwd(),
    usage: () => $.session.usage(),
    messages: () => $.session.messages(),
    agents: () => $.agent.list(),
    readPrompt: () => $.prompt.read(),
    fillPrompt: (input) => $.prompt.fill(input),
    submitPrompt: (input) => $.prompt.submit(input),
    appendNote: (text) => $.session.append({ message: { type: 'user', content: [{ type: 'text', text }] } }),
    compact: (args) => $.session.compact(args),
    registerCommand: (command) => $.command.register(command),
    complete: (request) => $.model.complete(request),
    fs: {
      exists: (path) => $.fs.exists(path),
      list: (path) => $.fs.list(path),
      stat: (path) => $.fs.stat(path),
      read: (path) => $.fs.read(path),
      write: (path, text) => $.fs.write(path, text),
    },
    store: {
      get: (key) => $.store.get(key),
      set: (key, value) => $.store.set(key, value),
      delete: (key) => $.store.delete(key),
    },
    env: {
      configDir: () => $.env.get('CLAUDE_CONFIG_DIR'),
      logFile: () => $.env.get('SMARTCOMPACT_LOG'),
      userProfile: () => $.env.get('USERPROFILE'),
      home: () => $.env.get('HOME'),
    },
  };
}
