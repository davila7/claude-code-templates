/** A short message for the log, from anything a promise rejected with. */
export function messageOf(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 200);
}
