import { fillPlaceholders } from './continue-placeholders.ts';
import { readContinuePrompt } from './continue-prompt-file.ts';
import type { Engine } from './engine.ts';
import { logEvent } from './event-log.ts';
import type { CompactionSource } from './pending-compaction.ts';
import { showTimedStatus } from './status-line.ts';
import type { TurnCounter } from './turn-counter.ts';

const COMPACTED_LINE = 'Context was compacted automatically.';

/** What one continue prompt adds to the prompt file, and what its log row says. */
export type ContinueText = {
  /** The tag's text for `{next}`. Empty gets the fallback text. */
  next: string;
  /** Only `after-compaction` follows a compaction. The others keep the compacted line out. */
  kind: 'after-compaction' | 'below-floor' | 'after-skip';
  source: CompactionSource;
};

/**
 * Submits the continue prompt, so the session keeps working. Returns true when the engine took it.
 * A turn that started since `turnsBefore` means someone else took over, so the prompt is dropped.
 */
export async function submitContinuePrompt(
  engine: Engine,
  turns: TurnCounter,
  turnsBefore: number,
  text: ContinueText,
): Promise<boolean> {
  // Read at each send, so an edit to the file works without a restart.
  const prompt = await readContinuePrompt(engine);

  if (prompt === undefined) {
    return false;
  }

  const startedAt = await engine.now();

  if (turns.hasChangedSince(turnsBefore)) {
    logEvent(engine, 'continue-dropped', { reason: 'new turn started', waitedMs: 0 });

    return false;
  }

  const shaped = text.kind === 'after-compaction' ? prompt : withoutCompactedLine(prompt);

  return submitAndReport(engine, await fillPlaceholders(engine, shaped, text.next), text, startedAt);
}

// Without a compaction the shipped first line would be wrong. Any other first line stays.
function withoutCompactedLine(prompt: string): string {
  const [first, ...rest] = prompt.split('\n');

  return first === COMPACTED_LINE ? rest.join('\n') : prompt;
}

// Sent as the person's own words, as the wrapper typed it into the prompt box.
async function submitAndReport(engine: Engine, prompt: string, text: ContinueText, startedAt: number): Promise<boolean> {
  const submitted = await engine.submitPrompt({ text: prompt, asUser: true });
  const waitedMs = (await engine.now()) - startedAt;

  if (submitted.drop !== undefined) {
    logEvent(engine, 'continue-dropped', { reason: submitted.drop, waitedMs });

    return false;
  }

  logEvent(engine, 'continue-typed', { source: text.source, kind: text.kind, waitedMs });
  await showTimedStatus(engine, 'continued');

  return true;
}
