import type { Timer } from 'claude-code';
import type { Engine } from './engine.ts';
import { composerBlocker } from './composer-blocker.ts';
import type { ContextFloor } from './context-floor.ts';
import { messageOf } from './error-message.ts';
import { submitContinuePrompt } from './continue-prompt-submit.ts';
import { logEvent } from './event-log.ts';
import { saveFloorState } from './floor-store.ts';
import { NOT_IN_THIS_MODE, isUnavailableInThisMode } from './mode-unavailable.ts';
import { showTimedStatus } from './status-line.ts';
import type { TurnCounter } from './turn-counter.ts';

// No engine event says that a dialog closed, so a busy session is retried on a clock: two minutes at most.
const RETRY_MS = 3000;
const MAX_RETRIES = 40;
// How the engine's error for a compaction the person cancelled ends.
const COMPACTION_CANCELLED = 'Compaction canceled.';

type WaitReason = 'prompt has text' | 'dialog open' | 'session busy';

/** Who asked for a compaction: the judge after a yes, or the session with its tag. */
export type CompactionSource = 'judge' | 'request';

/** A compaction this plugin will run: after a judge yes, or because the session asked for it with its tag. */
export type CompactionRequest = {
  /** Logged with each row of the compaction, so the log tells the two paths apart. */
  source: CompactionSource;
  tokens: number;
  /** The turn count when the asking turn ended. A higher count when it is held means a new turn took over. */
  turnsAtEnd: number;
  /** What the summarizer is told to keep. */
  instructions: string;
  /** The text for `{next}` in the continue prompt. Empty gets the fallback text. */
  next: string;
  /** True when the session asked. It has stopped and waits, so a skipped compaction still sends the prompt. */
  continueWhenSkipped: boolean;
  /** Logged when a retry from the clock or an edit fails, the same event the asking path logs. */
  errorEvent: 'judge-error' | 'request-error';
  /** Gets the turn count at the send of a continue prompt after a skipped compaction. It feeds the loop guard. */
  onContinuedAfterSkip?: (turnsAtSend: number) => void;
};

/** A request that waits for its compaction. */
type HeldRequest = CompactionRequest & {
  heldAt: number;
  retries: number;
  loggedWait?: WaitReason;
  timer?: Timer;
};

/**
 * Holds a compaction request until the prompt box is empty and no dialog is open, then compacts and continues.
 * A new turn drops the request. The next finished turn is judged or read for a tag again.
 */
export class PendingCompaction {
  #turns: TurnCounter;
  #floor: ContextFloor;
  #held: HeldRequest | undefined;

  constructor(turns: TurnCounter, floor: ContextFloor) {
    this.#turns = turns;
    this.#floor = floor;
  }

  /** Holds the request and tries to compact right away. */
  async holdAndTry(engine: Engine, request: CompactionRequest): Promise<void> {
    if (this.#turns.hasChangedSince(request.turnsAtEnd)) {
      await this.#dropBeforeHold(engine, request);

      return;
    }

    this.#take()?.timer?.cancel();
    this.#held = { ...request, heldAt: await engine.now(), retries: 0 };

    await this.#attempt(engine);
  }

  /** Tries again when an edit left the prompt box empty. */
  retryAfterEdit(engine: Engine, draft: string): void {
    if (this.#held !== undefined && draft.trim() === '') {
      void this.#attemptAndLogError(engine);
    }
  }

  /** Forgets a held request and logs why. Does nothing when no request is held. */
  async drop(engine: Engine, reason: string): Promise<void> {
    const held = this.#take();

    if (held === undefined) {
      return;
    }

    held.timer?.cancel();
    logEvent(engine, 'compact-dropped', { source: held.source, reason, waitedMs: await waitedMs(engine, held) });
    await showTimedStatus(engine, 'dropped');
  }

  // The new turn's drop ran while the request was still on its way here, so it found nothing to drop.
  async #dropBeforeHold(engine: Engine, request: CompactionRequest): Promise<void> {
    logEvent(engine, 'compact-dropped', { source: request.source, reason: 'new turn started', waitedMs: 0 });
    await showTimedStatus(engine, 'dropped');
  }

  // A retry from the clock or an edit has no caller that catches, so a failure is logged here.
  async #attemptAndLogError(engine: Engine): Promise<void> {
    const held = this.#held;

    if (held === undefined) {
      return;
    }

    try {
      await this.#attempt(engine);
    } catch (error) {
      logEvent(engine, held.errorEvent, { message: messageOf(error) });
      await showTimedStatus(engine, 'error');
    }
  }

  async #attempt(engine: Engine): Promise<void> {
    const held = this.#held;

    if (held === undefined) {
      return;
    }

    const blocker = await composerBlocker(engine);

    // Dropped or replaced while the prompt box was read.
    if (this.#held !== held) {
      return;
    }

    if (blocker !== undefined) {
      await this.#wait(engine, held, blocker);

      return;
    }

    this.#take();
    held.timer?.cancel();
    await this.#compact(engine, held);
  }

  async #compact(engine: Engine, held: HeldRequest): Promise<void> {
    const turnsAtCompact = this.#turns.count();

    engine.status('compacting...');
    // Shows that the compact call began, also when no outcome row follows.
    logEvent(engine, 'compact-started', { source: held.source, tokens: held.tokens, retries: held.retries });

    try {
      const result = await engine.compact({ instructions: held.instructions });

      if (result.skip !== undefined) {
        logEvent(engine, 'compact-failed', { source: held.source, message: result.skip });
        await showTimedStatus(engine, 'compact skipped');

        if (held.continueWhenSkipped) {
          await this.#continueAfterSkip(engine, held, turnsAtCompact);
        }

        return;
      }
    } catch (error) {
      await this.#handleCompactError(engine, held, turnsAtCompact, error);

      return;
    }

    const waited = await waitedMs(engine, held);

    logEvent(engine, 'compact-typed', { source: held.source, tokens: held.tokens, waitedMs: waited });
    // The engine does not run this plugin's own session.compact hook for this call, so the floor restarts here.
    this.#floor.restartAfterCompaction();
    await saveFloorState(engine, this.#floor);
    await showTimedStatus(engine, 'compacted');
    await submitContinuePrompt(engine, this.#turns, turnsAtCompact, {
      next: held.next,
      kind: 'after-compaction',
      source: held.source,
    });
  }

  // Nothing was compacted, so the prompt goes out without the compacted line and the send is reported.
  async #continueAfterSkip(engine: Engine, held: HeldRequest, turnsAtCompact: number): Promise<void> {
    const sent = await submitContinuePrompt(engine, this.#turns, turnsAtCompact, {
      next: held.next,
      kind: 'after-skip',
      source: held.source,
    });

    if (sent) {
      held.onContinuedAfterSkip?.(turnsAtCompact);
    }
  }

  // The engine refuses a compaction while a turn runs. A turn that started is a drop. A mode without compaction or a
  // cancel by the person is a drop too, since a retry cannot work or would undo the cancel. Anything else is a wait.
  async #handleCompactError(engine: Engine, held: HeldRequest, turnsAtCompact: number, error: unknown): Promise<void> {
    const { source } = held;

    if (this.#turns.hasChangedSince(turnsAtCompact)) {
      logEvent(engine, 'compact-dropped', { source, reason: 'new turn started', waitedMs: await waitedMs(engine, held) });

      return;
    }

    const finalReason = finalReasonOf(error);

    if (finalReason !== undefined) {
      logEvent(engine, 'compact-failed', { source, message: messageOf(error) });
      logEvent(engine, 'compact-dropped', { source, reason: finalReason, waitedMs: await waitedMs(engine, held) });
      await showTimedStatus(engine, 'dropped');

      return;
    }

    // Logged once per wait. The retries stay quiet.
    if (held.loggedWait !== 'session busy') {
      logEvent(engine, 'compact-failed', { source, message: messageOf(error) });
    }

    this.#held = held;
    await this.#wait(engine, held, 'session busy');
  }

  /** Shows and logs why the request waits. A full prompt box waits for an edit, the rest is retried on the clock. */
  async #wait(engine: Engine, held: HeldRequest, reason: WaitReason): Promise<void> {
    if (held.loggedWait !== reason) {
      held.loggedWait = reason;
      logEvent(engine, 'compact-waiting', { reason });
    }

    engine.status(reason === 'prompt has text' ? 'waiting for empty prompt' : 'waiting for idle');
    held.timer?.cancel();

    if (reason === 'prompt has text') {
      return;
    }

    if (held.retries >= MAX_RETRIES) {
      await this.drop(engine, 'not idle in time');

      return;
    }

    held.retries += 1;
    held.timer = engine.after(RETRY_MS, () => void this.#attemptAndLogError(engine));
  }

  #take(): HeldRequest | undefined {
    const held = this.#held;
    this.#held = undefined;

    return held;
  }
}

// The drop reason for an error no retry can fix, else undefined.
function finalReasonOf(error: unknown): string | undefined {
  if (isUnavailableInThisMode(error)) {
    return NOT_IN_THIS_MODE;
  }

  return messageOf(error).endsWith(COMPACTION_CANCELLED) ? 'cancelled' : undefined;
}

async function waitedMs(engine: Engine, held: HeldRequest): Promise<number> {
  return (await engine.now()) - held.heldAt;
}
