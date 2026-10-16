/** A whole prompt that asks only for status, such as `status?`, `what's the eta`, or `give me a progress update`. */
const STATUS =
  /^(?:(?:what(?:'?s| is) (?:the )?|give me (?:the |a |an )?)?(?:latest |live |current )?(?:status|eta|progress)(?: now| update| so far)?)[?.!]*$/

/** Trimmed, lowercased, single-spaced, with the typographic apostrophe made plain. */
export function normalizePrompt(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ').replace(/’/g, "'")
}

/** Whether a normalized prompt is an exact status question. */
export function isStatusPrompt(normalized: string): boolean {
  return STATUS.test(normalized)
}
