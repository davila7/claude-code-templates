/** Why a first turn is not judged. The text goes into the log as the skip reason. */
export type FirstTurnReason = 'first turn of session' | 'first turn after compaction';

/** What the floor keeps between restarts. */
export type FloorState = {
  baseline: number;
  waitingFor: FirstTurnReason | null;
};

/**
 * Measures the tokens a conversation added since its first turn, or since the first turn after its last compaction.
 * A resumed session without saved state waits for its first turn, as a new session does.
 */
export class ContextFloor {
  #baseline = 0;
  #waitingFor: FirstTurnReason | null = null;
  /** The context size at the start of the awaited first turn, when a step of it was read. */
  #turnStartReading: number | undefined;

  /**
   * Returns why the turn is skipped when it is the awaited first turn, and sets the baseline from it.
   * Every other turn changes nothing and gets undefined.
   */
  takeFirstTurn(tokens: number): FirstTurnReason | undefined {
    if (this.#waitingFor === null) {
      return undefined;
    }

    const reason = this.#waitingFor;

    // The size at the end holds the work of the turn. A one-step turn has no start reading and adds little.
    this.#baseline = this.#turnStartReading ?? tokens;
    this.#waitingFor = null;
    this.#turnStartReading = undefined;

    return reason;
  }

  /** Keeps the first context size read during the awaited first turn. Does nothing at any other time. */
  noteTurnStartReading(tokens: number): void {
    if (this.#waitingFor !== null && this.#turnStartReading === undefined) {
      this.#turnStartReading = tokens;
    }
  }

  /** A new session already holds its startup context, so the first turn sets the baseline. */
  startNewSession(): void {
    this.#waitingFor = 'first turn of session';
    this.#turnStartReading = undefined;
  }

  /** After any compaction the next turn sets the baseline. */
  restartAfterCompaction(): void {
    this.#waitingFor = 'first turn after compaction';
    this.#turnStartReading = undefined;
  }

  /** Takes over a state saved for the same session. */
  restore(state: FloorState): void {
    this.#baseline = state.baseline;
    this.#waitingFor = state.waitingFor;
    this.#turnStartReading = undefined;
  }

  state(): FloorState {
    return { baseline: this.#baseline, waitingFor: this.#waitingFor };
  }

  baseline(): number {
    return this.#baseline;
  }

  /** Zero while the first turn is awaited. Never below zero: after a compaction the context can drop under the baseline. */
  addedTokens(tokens: number): number {
    if (this.#waitingFor !== null) {
      return 0;
    }

    return Math.max(0, tokens - this.#baseline);
  }
}
