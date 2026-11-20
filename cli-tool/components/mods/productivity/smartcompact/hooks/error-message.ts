/** Keeps the full message so error classification can read its ending. */
export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
