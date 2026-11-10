import type { Engine } from './engine.ts';

/** Why a compaction must wait although no turn runs. */
export type ComposerBlocker = 'prompt has text' | 'dialog open';

/** Reads the engine's prompt box and dialog state. Undefined when nothing blocks a compaction. */
export async function composerBlocker(engine: Engine): Promise<ComposerBlocker | undefined> {
  const draft = await engine.readPrompt();

  if (draft.text.trim() !== '') {
    return 'prompt has text';
  }

  return (await isDialogOpen(engine)) ? 'dialog open' : undefined;
}

// `prompt.read` answers an empty draft under a menu or dialog too. An empty append changes no draft, and the engine
// refuses it while a dialog holds the keys. A refusal without a cause may be a dialog too. Only a missing box is free.
async function isDialogOpen(engine: Engine): Promise<boolean> {
  const filled = await engine.fillPrompt({ text: '', mode: 'append' }).catch(() => undefined);

  return filled !== undefined && !filled.isFilled && filled.refusal !== 'no_composer';
}
