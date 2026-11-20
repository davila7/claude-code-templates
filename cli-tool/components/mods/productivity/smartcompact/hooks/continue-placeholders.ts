import type { Engine } from './engine.ts';
import { choicesFilePath } from './log-paths.ts';

const FALLBACK_NEXT = 'Continue where you left off. If the next step is clear, do it.';

/**
 * Fills `{choicesFile}`, `{choicesHeading}` and `{next}`. An empty `next` gets the fallback text.
 * A prompt without placeholders is returned unchanged.
 */
export async function fillPlaceholders(engine: Engine, prompt: string, next: string): Promise<string> {
  const values = {
    choicesFile: prompt.includes('{choicesFile}') ? await choicesFilePath(engine) : '',
    choicesHeading: prompt.includes('{choicesHeading}') ? await choicesHeading(engine) : '',
    next: next === '' ? FALLBACK_NEXT : next,
  };

  // Replacement values can quote placeholders or contain dollar signs and must stay as typed.
  return prompt.replace(/\{(choicesFile|choicesHeading|next)\}/g, (_match, key: keyof typeof values) => values[key]);
}

// Time of sending, folder and session, so a dashboard can split the file into one block per continue.
async function choicesHeading(engine: Engine): Promise<string> {
  const time = new Date(await engine.now()).toISOString();

  return `## ${time} | ${await engine.cwd()} | ${await engine.sessionId()}`;
}
