import type { SessionMessage } from 'claude-code';
import { describe, expect, test } from 'claude-code/testing';
import { nudgeText } from '../hooks/compact-nudge.ts';
import { buildJudgeInput } from '../hooks/judge-input.ts';

describe('judge input', () => {
  test('takes the last human prompt and the tool calls after it', () => {
    const messages: SessionMessage[] = [
      user('Old prompt.'),
      assistant('', [{ tool: 'Bash', input: { command: 'npm   test' } }]),
      user('Fix the login bug.'),
      assistant('', [
        { tool: 'Edit', input: { file_path: 'src/login.ts' } },
        { tool: 'Read', input: { file_path: 'src/app.ts' } },
      ]),
      user('<task-notification>agent done</task-notification>'),
      { role: 'user', text: '', toolUses: [], toolResults: [] },
    ];

    const input = buildJudgeInput(messages, 'Fixed it.');

    expect(input).toEqual({
      userPrompt: 'Fix the login bug.',
      assistantMessage: 'Fixed it.',
      toolCalls: ['Edit: src/login.ts', 'Read'],
    });
  });

  test('skips the nudge row and keeps the tool calls on both sides of it', () => {
    const messages: SessionMessage[] = [
      user('Fix the login bug.'),
      assistant('', [{ tool: 'Edit', input: { file_path: 'src/login.ts' } }]),
      user(nudgeText(61000)),
      assistant('', [{ tool: 'Read', input: { file_path: 'src/app.ts' } }]),
    ];

    const input = buildJudgeInput(messages, 'Fixed it.');

    expect(input.userPrompt).toBe('Fix the login bug.');
    expect(input.toolCalls).toEqual(['Edit: src/login.ts', 'Read']);
  });

  test('cuts long texts and keeps the last 40 tool calls', () => {
    const calls = Array.from({ length: 45 }, (_, index) => ({ tool: 'Bash', input: { command: `step ${index}` } }));
    const messages = [user('p'.repeat(3000)), assistant('', calls), assistant('a'.repeat(5000), [])];

    const input = buildJudgeInput(messages, '');

    expect(input.userPrompt.length).toBe(2000);
    expect(input.assistantMessage.length).toBe(4000);
    expect(input.toolCalls.length).toBe(40);
    expect(input.toolCalls[0]).toBe('Bash: step 5');
  });
});

function user(text: string): SessionMessage {
  return { role: 'user', text, toolUses: [] };
}

function assistant(text: string, calls: { tool: string; input: Record<string, unknown> }[]): SessionMessage {
  return { role: 'assistant', text, toolUses: calls.map((call, index) => ({ tool_use_id: `use-${index}`, ...call })) };
}
