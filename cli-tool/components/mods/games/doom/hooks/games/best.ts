// Which score counts as a new best. Minesweeper's best is its fastest clear, so lower wins there;
// everywhere else higher wins. A score of zero or less never counts: a Minesweeper board whose
// first click clears it takes 0 s and would otherwise lock the best forever, and a Pong match you
// lost posts a negative margin.
export function isBetter(score: number, prev: number | undefined, lowerIsBetter = false): boolean {
  if (!Number.isFinite(score) || score <= 0) return false
  if (prev === undefined || prev <= 0) return true
  return lowerIsBetter ? score < prev : score > prev
}
