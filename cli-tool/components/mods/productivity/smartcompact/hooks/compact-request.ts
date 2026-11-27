const OPEN_TAG = '<smartcompact>';
const CLOSE_TAG = '</smartcompact>';

/** A session's own request to compact: the prompt it wants for the next piece of work. */
export type CompactRequest = {
  next: string;
};

/**
 * Reads the compact tag that ends an answer. Whitespace may follow it.
 * With two tags only the last one counts, and only when it ends the answer.
 */
export function readCompactRequest(answer: string): CompactRequest | null {
  const text = answer.trimEnd();

  // A tag earlier in the text, such as one the session quotes, asks nothing.
  if (!text.endsWith(CLOSE_TAG)) {
    return null;
  }

  const body = text.slice(0, -CLOSE_TAG.length);
  const start = body.lastIndexOf(OPEN_TAG);

  if (start === -1) {
    return null;
  }

  const next = body.slice(start + OPEN_TAG.length).trim();

  // A tag without a prompt has nothing to continue with, so the turn is judged like an untagged one.
  if (next === '') {
    return null;
  }

  return { next };
}
