/** Counts main loop turns that started, so a later check can tell whether a new turn began in between. */
export class TurnCounter {
  #started = 0;

  noteTurnStarted(): void {
    this.#started += 1;
  }

  count(): number {
    return this.#started;
  }

  hasChangedSince(count: number): boolean {
    return this.#started !== count;
  }
}
