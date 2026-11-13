import type { CommandSpec } from 'claude-code';
import { overridePromptPath, shippedPromptPath } from './continue-prompt-file.ts';
import type { Engine } from './engine.ts';

/** The engine runs a registered command by its bare name, so the plugin name goes into the name itself. */
export const PROMPT_COMMAND: CommandSpec = {
  name: 'smartcompact-prompt',
  description: 'Copies the default continue prompt to your own file, once, and shows where it is.',
};

/** Copies the shipped prompt to the override path when no override exists. Returns what the command prints. */
export async function createOverrideIfMissing(engine: Engine): Promise<string> {
  const override = await overridePromptPath(engine);

  // An empty override turns the prompt off on purpose, so a file that exists always stays as it is.
  if (await engine.fs.exists(override)) {
    return `Your continue prompt is ${override}`;
  }

  await engine.fs.write(override, await engine.fs.read(shippedPromptPath(engine)));

  return `Created ${override} from the default. Edit it to change the continue prompt. An empty file turns it off.`;
}
