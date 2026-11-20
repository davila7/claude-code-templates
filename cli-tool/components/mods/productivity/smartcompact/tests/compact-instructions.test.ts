import { describe, expect, test } from 'claude-code/testing';
import { JUDGE_INSTRUCTIONS, instructionsForRequest } from '../hooks/compact-instructions.ts';

describe('the compact instructions', () => {
  test('after a judge yes keep the goal, the next step and open decisions', () => {
    expect(JUDGE_INSTRUCTIONS).toBe('Keep the current goal, the next step and open decisions.');
  });

  test('after a tag name what the next step needs', () => {
    expect(instructionsForRequest('Write the docs.')).toBe(
      'Keep the current goal, open decisions and what this next step needs: Write the docs.',
    );
  });

  test('after a tag keeps running agent ids and plans for their reports', () => {
    expect(instructionsForRequest('Write the docs.', ['agent-1', 'agent-2'])).toBe(
      'Keep the current goal, open decisions and what this next step needs: Write the docs. Keep the ids of the subagents still running (agent-1, agent-2) and what to do with each report when it arrives.',
    );
  });

  test('an empty agent list leaves the instructions unchanged', () => {
    expect(instructionsForRequest('Write the docs.', [])).toBe(instructionsForRequest('Write the docs.'));
  });
});
