export type Verdict = {
  compact: boolean;
  reason: string;
};

/** Parses the model reply and checks its shape. Undefined when the reply is not a verdict. */
export function verdictFrom(reply: string): Verdict | undefined {
  const verdict = parsedOrUndefined(jsonPartOf(reply));

  if (typeof verdict?.compact !== 'boolean') {
    return undefined;
  }

  return { compact: verdict.compact, reason: String(verdict.reason ?? '').slice(0, 200) };
}

// A Claude model may wrap the JSON in a code fence, so only the outer braces are read.
function jsonPartOf(reply: string): string {
  const start = reply.indexOf('{');
  const end = reply.lastIndexOf('}');

  return start >= 0 && end > start ? reply.slice(start, end + 1) : reply;
}

// A reply in prose or cut at the token limit is no JSON.
function parsedOrUndefined(text: string): { compact?: unknown; reason?: unknown } | undefined {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
