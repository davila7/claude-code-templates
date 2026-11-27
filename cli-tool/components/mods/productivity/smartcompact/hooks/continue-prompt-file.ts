import type { Engine } from './engine.ts';
import { smartcompactFolder } from './log-paths.ts';

const PROMPT_FILE_NAME = 'continue-prompt.md';

/** The default continue prompt in the plugin folder. */
export function shippedPromptPath(engine: Engine): string {
  return `${engine.pluginRoot()}/${PROMPT_FILE_NAME}`;
}

/** The user's own continue prompt. It stays in the home folder, also when SMARTCOMPACT_LOG moves the log. */
export async function overridePromptPath(engine: Engine): Promise<string> {
  return `${await smartcompactFolder(engine)}/${PROMPT_FILE_NAME}`;
}

/**
 * The continue prompt: the user's override when it exists, else the shipped default.
 * Undefined when the text is empty, which turns the continue prompt off.
 */
export async function readContinuePrompt(engine: Engine): Promise<string | undefined> {
  const override = await overridePromptPath(engine);
  const path = (await engine.fs.exists(override)) ? override : shippedPromptPath(engine);
  // An editor on Windows may save CRLF. The prompt goes out with plain newlines.
  const text = (await engine.fs.read(path)).replaceAll('\r\n', '\n').trim();

  return text === '' ? undefined : text;
}
