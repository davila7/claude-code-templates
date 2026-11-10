import type { Engine } from './engine.ts';
import { choicesFilePath } from './log-paths.ts';

const FALLBACK_NEXT = 'Continue where you left off. If the next step is clear, do it.';

/**
 * Fills `{choicesFile}`, `{choicesHeading}` and `{next}`. An empty `next` gets the fallback text.
 * A prompt without placeholders is returned unchanged.
 */
export async function fillPlaceholders(engine: Engine, prompt: string, next: string): Promise<string> {
  const withFile = prompt.includes('{choicesFile}')
    ? replaceAllAsTyped(prompt, '{choicesFile}', await choicesFilePath(engine))
    : prompt;
  const withHeading = withFile.includes('{choicesHeading}')
    ? replaceAllAsTyped(withFile, '{choicesHeading}', await choicesHeading(engine))
    : withFile;

  // Filled last, so a tag that quotes a placeholder keeps it as typed.
  return replaceAllAsTyped(withHeading, '{next}', next === '' ? FALLBACK_NEXT : next);
}

// A plain string would expand `$&` or `$$` in the value. A function hands it over as typed.
function replaceAllAsTyped(text: string, placeholder: string, value: string): string {
  return text.replaceAll(placeholder, () => value);
}

// Time of sending, folder and session, so a dashboard can split the file into one block per continue.
async function choicesHeading(engine: Engine): Promise<string> {
  const time = new Date(await engine.now()).toISOString();

  return `## ${time} | ${await engine.cwd()} | ${await engine.sessionId()}`;
}
