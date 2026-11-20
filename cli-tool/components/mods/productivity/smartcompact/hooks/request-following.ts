import { instructionsForRequest } from './compact-instructions.ts';
import { NUDGE_TEXT_START } from './compact-nudge.ts';
import type { CompactRequest } from './compact-request.ts';
import type { ContextFloor } from './context-floor.ts';
import { contextTokens } from './context-tokens.ts';
import { submitContinuePrompt } from './continue-prompt-submit.ts';
import type { Engine } from './engine.ts';
import { messageOf } from './error-message.ts';
import { logEvent } from './event-log.ts';
import { saveFloorState } from './floor-store.ts';
import { NOT_IN_THIS_MODE, isUnavailableInThisMode } from './mode-unavailable.ts';
import type { PendingCompaction } from './pending-compaction.ts';
import type { Settings } from './plugin-settings.ts';
import { runningSubagentIds } from './running-subagents.ts';
import { showTimedStatus } from './status-line.ts';
import type { TurnCounter } from './turn-counter.ts';
import type { FinishedTurn } from './turn-judging.ts';

// A plain includes() lets agent-10 pass for agent-1, so the summary could drop the pending report of agent-1.
function namesAgentId(text: string, id: string): boolean {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![A-Za-z0-9_-])${escapedId}(?![A-Za-z0-9_-])`).test(text);
}

/** Tells the model why its tag was ignored, in a row the judge input skips. */
export function subagentsRunningText(agents: string[]): string {
  return `${NUDGE_TEXT_START}compaction skipped, ${agents.length} subagent(s) still running (${agents.join(', ')}). To compact now, tag again and name each running agent id with what to do with its report. Or tag again once they finish.`;
}

/**
 * After a main turn that ended with the compact tag, without the judge: ignores the request if it omits a running agent id
 * or would loop, continues without a compaction below the floor, and else hands it to the pending compaction.
 */
export class RequestFollowing {
  #settings: Settings;
  #turns: TurnCounter;
  #floor: ContextFloor;
  #compaction: PendingCompaction;
  /** The turn count when the last continue prompt below the floor went out. */
  #continuedBelowFloorAt: number | undefined;
  /** The turn count when the last continue prompt after a skipped compaction went out. */
  #continuedAfterSkipAt: number | undefined;

  constructor(settings: Settings, turns: TurnCounter, floor: ContextFloor, compaction: PendingCompaction) {
    this.#settings = settings;
    this.#turns = turns;
    this.#floor = floor;
    this.#compaction = compaction;
  }

  /** Runs in the background after the turn. It never throws: a failure is logged as `request-error`. */
  async followRequest(engine: Engine, turn: FinishedTurn, request: CompactRequest): Promise<void> {
    try {
      await this.#follow(engine, { ...turn, resetsAtEnd: turn.resetsAtEnd ?? this.#turns.resets() }, request);
    } catch (error) {
      // A mode such as `claude -p` lacks calls the request needs. That is no fault.
      if (isUnavailableInThisMode(error)) {
        logEvent(engine, 'request-ignored', { reason: NOT_IN_THIS_MODE });

        return;
      }

      logEvent(engine, 'request-error', { message: messageOf(error) });
      await showTimedStatus(engine, 'error');
    }
  }

  async #follow(engine: Engine, turn: FinishedTurn & { resetsAtEnd: number }, request: CompactRequest): Promise<void> {
    const tokens = await contextTokens(engine);

    if (this.#turns.hasResetSince(turn.resetsAtEnd)) {
      return;
    }

    // Without a size the floor rules cannot pick between a compaction and a continue, so nothing runs.
    if (tokens === undefined) {
      logEvent(engine, 'usage-missing', { hook: 'turn.complete' });
      await showTimedStatus(engine, 'request ignored');

      return;
    }

    const isFirstTurn = await this.#takeFirstTurn(engine, tokens);
    const added = isFirstTurn ? 0 : this.#floor.addedTokens(tokens);

    const agents = await runningSubagentIds(engine);

    logEvent(engine, 'compact-requested', { tokens, added, baseline: this.#floor.baseline(), ...(agents.length > 0 ? { agents } : {}) });

    if (await this.#ignoresMissingAgentIds(engine, request.next, agents)) {
      return;
    }

    // A first turn always counts as 0 added. Counted from its own start, one turn of work could pass the floor.
    const isBelowFloor = added < this.#settings.minTokens;

    if (this.#wouldLoop(turn, isBelowFloor)) {
      logEvent(engine, 'request-ignored', { reason: 'loop guard', tokens, added });
      await showTimedStatus(engine, 'request ignored');

      return;
    }

    if (isBelowFloor) {
      await this.#continueBelowFloor(engine, turn, request);

      return;
    }

    await showTimedStatus(engine, 'will compact');
    await this.#compaction.holdAndTry(engine, {
      source: 'request',
      tokens,
      turnsAtEnd: turn.turnsAtEnd,
      resetsAtEnd: turn.resetsAtEnd,
      instructions: instructionsForRequest(request.next, agents),
      next: request.next,
      continueWhenSkipped: true,
      errorEvent: 'request-error',
      onContinuedAfterSkip: (turnsAtSend) => {
        this.#continuedAfterSkipAt = turnsAtSend;
      },
    });
  }

  // A tagged turn is never skipped, but it sets the baseline as an untagged first turn would. True when it did.
  async #takeFirstTurn(engine: Engine, tokens: number): Promise<boolean> {
    if (this.#floor.takeFirstTurn(tokens) === undefined) {
      return false;
    }

    await saveFloorState(engine, this.#floor);

    return true;
  }

  // A tag must name each running agent so the summary can keep its pending report.
  async #ignoresMissingAgentIds(engine: Engine, next: string, agents: string[]): Promise<boolean> {
    const missing = agents.filter((id) => !namesAgentId(next, id));

    if (missing.length === 0) {
      return false;
    }

    logEvent(engine, 'request-ignored', { reason: 'subagents running', agents, missing });
    await showTimedStatus(engine, 'request ignored');
    const appended = await engine.appendNote(subagentsRunningText(agents));

    if (appended.deny !== undefined) {
      logEvent(engine, 'request-error', { message: appended.deny });
    }

    return true;
  }

  // Stops a session that tags again at once: prompt, tag, prompt. After a skipped compaction the next one is skipped
  // too, so that continue counts at any token count. A continue after a compaction does not count, because the
  // first turn after a compaction always counts as 0 added tokens.
  #wouldLoop(turn: FinishedTurn, isBelowFloor: boolean): boolean {
    if (isRightAfter(turn, this.#continuedAfterSkipAt)) {
      return true;
    }

    return isBelowFloor && isRightAfter(turn, this.#continuedBelowFloorAt);
  }

  // Sends the continue prompt without the compacted line. A sent prompt's turn count feeds the loop guard.
  async #continueBelowFloor(engine: Engine, turn: FinishedTurn, request: CompactRequest): Promise<void> {
    const sent = await submitContinuePrompt(engine, this.#turns, turn.turnsAtEnd, {
      next: request.next,
      kind: 'below-floor',
      resetsAtEnd: turn.resetsAtEnd,
      source: 'request',
    });

    if (sent) {
      this.#continuedBelowFloorAt = turn.turnsAtEnd;
    }
  }
}

// True when the turn is the one the continue prompt sent at `sentAt` started.
function isRightAfter(turn: FinishedTurn, sentAt: number | undefined): boolean {
  return sentAt !== undefined && turn.turnsAtEnd === sentAt + 1;
}
