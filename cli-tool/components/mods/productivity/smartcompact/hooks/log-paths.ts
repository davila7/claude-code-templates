import type { Engine } from './engine.ts';

const LOG_FILE_NAME = 'log.jsonl';
const CHOICES_FILE_NAME = 'choices.md';

/** The event log file. SMARTCOMPACT_LOG overrides the default under the home folder. */
export async function logFilePath(engine: Engine): Promise<string> {
  const override = await engine.env.logFile();

  return override || `${await smartcompactFolder(engine)}/${LOG_FILE_NAME}`;
}

/** The central file where continued sessions write their choices. It sits next to the log file. */
export async function choicesFilePath(engine: Engine): Promise<string> {
  const log = await logFilePath(engine);

  return `${folderOf(log)}/${CHOICES_FILE_NAME}`;
}

/** The plugin's folder under the home folder. The log, choices.md and the user's continue prompt sit in it by default. */
export async function smartcompactFolder(engine: Engine): Promise<string> {
  const home = (await engine.env.userProfile()) || (await engine.env.home()) || '';

  return `${home}/.claude/smartcompact`;
}

// Both slash styles count, because the override comes in the platform's own spelling.
function folderOf(file: string): string {
  return file.slice(0, Math.max(file.lastIndexOf('/'), file.lastIndexOf('\\')));
}
