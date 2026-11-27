import type { Engine } from './engine.ts';

const CHOICES_FILE_NAME = 'choices.md';

/** The event log file. SMARTCOMPACT_LOG overrides the default under the home folder. */
export async function logFilePath(engine: Engine): Promise<string> {
  const override = await engine.env.logFile();

  if (override) {
    return override;
  }

  const sessionId = (await engine.sessionId()).replace(/[^A-Za-z0-9_-]/g, '');

  return `${await smartcompactFolder(engine)}/logs/${sessionId}.jsonl`;
}

/** A shared choices file lets continued sessions keep their decisions together. */
export async function choicesFilePath(engine: Engine): Promise<string> {
  const override = await engine.env.logFile();

  if (!override) {
    return `${await smartcompactFolder(engine)}/${CHOICES_FILE_NAME}`;
  }

  const log = override;

  const folder = folderOf(log);
  const absolute = /^(?:[A-Za-z]:[\\/]|[\\/])/.test(log);

  const resolved = absolute ? folder : `${await engine.cwd()}${folder === '.' ? '' : `/${folder}`}`;

  return `${resolved}${resolved.endsWith('/') ? '' : '/'}${CHOICES_FILE_NAME}`;
}

/** Keeping user files under the home folder makes them shared across working folders. */
export async function smartcompactFolder(engine: Engine): Promise<string> {
  const home = (await engine.env.userProfile()) || (await engine.env.home()) || '';

  return `${home}/.claude/smartcompact`;
}

// Both slash styles count, because the override comes in the platform's own spelling.
function folderOf(file: string): string {
  const separator = Math.max(file.lastIndexOf('/'), file.lastIndexOf('\\'));

  return separator < 0 ? '.' : file.slice(0, separator) || '/';
}
