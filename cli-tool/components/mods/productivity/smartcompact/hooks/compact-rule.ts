import type { PromptContextBlock } from 'claude-code';

const RULE_BLOCK_NAME = 'smartcompact';

// No "fresh context" (it sounds like /clear) and no summary by the plugin: it only starts /compact.
const RULE_TEXT = [
  'When you finish a piece of work and can start the next piece of the same task right away, and that piece no longer needs the details so far, end your answer with:',
  '<smartcompact>the prompt to start the next piece with</smartcompact>',
  'Then stop. The smartcompact plugin runs `/compact` and sends that prompt afterwards.',
  'Leave the tag out when you wait for other sessions or agents, or when all work is done. Leave it out when you wait for the user too, unless smartcompact asked you to compact.',
  // Sessions copied the tag pattern and wrote an empty tag to mean "no compaction".
  'Never write an empty tag.',
  'Only the main session does this, never a subagent.',
].join('\n');

/** The context blocks with the smartcompact rule last. A block of that name from below is replaced. */
export function withCompactRule(blocks: readonly PromptContextBlock[]): PromptContextBlock[] {
  return [...blocks.filter((block) => block.name !== RULE_BLOCK_NAME), { name: RULE_BLOCK_NAME, text: RULE_TEXT }];
}
