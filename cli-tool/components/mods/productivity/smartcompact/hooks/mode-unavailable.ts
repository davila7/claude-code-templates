import { messageOf } from './error-message.ts';

/** The words of the engine's error for a call the mode does not offer. Also the log reason. */
export const NOT_IN_THIS_MODE = 'not available in this mode';

/** True when the engine refuses a call in this mode, such as `claude -p`. A retry cannot work. */
export function isUnavailableInThisMode(error: unknown): boolean {
  return messageOf(error).includes(NOT_IN_THIS_MODE);
}
