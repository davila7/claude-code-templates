import { describe, expect, test } from 'claude-code/testing';
import { fakeSession } from './fake-engine.ts';

const RULE = [
  'When you finish a piece of work and can start the next piece of the same task right away, and that piece no longer needs the details so far, end your answer with:',
  '<smartcompact>the prompt to start the next piece with</smartcompact>',
  'Then stop. The smartcompact plugin runs `/compact` and sends that prompt afterwards.',
  'Leave the tag out when you wait for other sessions or agents, or when all work is done. Leave it out when you wait for the user too, unless smartcompact asked you to compact.',
  'Never write an empty tag.',
  'Only the main session does this, never a subagent.',
].join('\n');
const EMAIL_BLOCK = { name: 'userEmail', text: 'The user is someone@example.com.' };

describe('the smartcompact context block', () => {
  test('follows the blocks from below', async ($, on) => {
    fakeSession(on);

    const context = await $.prompt.context({ blocks: [EMAIL_BLOCK] });

    expect(context.blocks).toEqual([EMAIL_BLOCK, { name: 'smartcompact', text: RULE }]);
  });

  test('replaces a block of the same name, so the name stays unique', async ($, on) => {
    fakeSession(on);

    const context = await $.prompt.context({ blocks: [{ name: 'smartcompact', text: 'old rule' }, EMAIL_BLOCK] });

    expect(context.blocks).toEqual([EMAIL_BLOCK, { name: 'smartcompact', text: RULE }]);
  });
});
