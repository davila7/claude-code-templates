import type { Engine } from './engine.ts';

/** Shows how many more tokens the conversation must add before the judge is asked. */
export function showJudgeCountdown(engine: Engine, tokensLeft: number): void {
  if (tokensLeft <= 0) {
    engine.status('judge after next turn');

    return;
  }

  // Rounded up, so the line never says "judge in 0k" while still below the floor.
  engine.status(`judge in ${Math.ceil(tokensLeft / 1000)}k`);
}

/** Shows `label HH:mm` in the plugin's status line, in local time. */
export async function showTimedStatus(engine: Engine, label: string): Promise<void> {
  const now = new Date(await engine.now());
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  engine.status(`${label} ${hours}:${minutes}`);
}
