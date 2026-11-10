import type { SessionMessage, ToolUseSummary } from 'claude-code';
import { NUDGE_TEXT_START } from './compact-nudge.ts';

const MAX_PROMPT_CHARS = 2000;
const MAX_ASSISTANT_CHARS = 4000;
const MAX_TOOL_CALL_CHARS = 150;
const MAX_TOOL_CALLS = 40;
// The nudge row is a user text row the plugin wrote, so it is never the last prompt.
const SYSTEM_TEXT_STARTS = [
  '<task-notification>',
  '<system-reminder>',
  'Another Claude session sent a message',
  NUDGE_TEXT_START,
];

/** What the judge model gets to see about the session. */
export type JudgeInput = {
  userPrompt: string;
  assistantMessage: string;
  toolCalls: string[];
};

/** Builds the judge input from the session messages and the answer of the turn that just ended. */
export function buildJudgeInput(messages: readonly SessionMessage[], answer: string): JudgeInput {
  const promptIndex = messages.findLastIndex(isHumanPrompt);
  const prompt = promptIndex >= 0 ? (messages[promptIndex]?.text ?? '') : '';
  const assistantMessage = answer || lastAssistantText(messages);

  return {
    userPrompt: prompt.slice(0, MAX_PROMPT_CHARS),
    assistantMessage: assistantMessage.slice(-MAX_ASSISTANT_CHARS),
    toolCalls: toolCallsAfter(messages, promptIndex),
  };
}

/** The input as the one user message both judge models get. */
export function judgeInputText(input: JudgeInput): string {
  const toolCalls = input.toolCalls.length > 0 ? input.toolCalls.join('\n') : '(none)';

  return [
    `Last user prompt:\n${input.userPrompt}`,
    `Last assistant message:\n${input.assistantMessage}`,
    `Tool calls since the prompt:\n${toolCalls}`,
  ].join('\n\n');
}

// A message that only carries tool results has no text, so it never counts as a prompt.
function isHumanPrompt(message: SessionMessage): boolean {
  const text = message.text.trimStart();

  return message.role === 'user' && text !== '' && !SYSTEM_TEXT_STARTS.some((start) => text.startsWith(start));
}

function lastAssistantText(messages: readonly SessionMessage[]): string {
  return messages.findLast((message) => message.role === 'assistant' && message.text !== '')?.text ?? '';
}

function toolCallsAfter(messages: readonly SessionMessage[], promptIndex: number): string[] {
  return messages
    .slice(promptIndex + 1)
    .filter((message) => message.role === 'assistant')
    .flatMap((message) => message.toolUses)
    .map(summaryOf)
    .slice(-MAX_TOOL_CALLS);
}

/** Tool name plus the one input field that says most about the call. */
function summaryOf(use: ToolUseSummary): string {
  const detail = detailOf(use);
  const summary = detail ? `${use.tool}: ${detail}` : use.tool;

  return summary.slice(0, MAX_TOOL_CALL_CHARS);
}

function detailOf(use: ToolUseSummary): string {
  const field = detailFieldOf(use.tool);
  const detail = field ? use.input[field] : undefined;

  return typeof detail === 'string' ? detail.replace(/\s+/g, ' ') : '';
}

function detailFieldOf(tool: string): string | undefined {
  switch (tool) {
    case 'Bash':
    case 'PowerShell':
      return 'command';

    case 'Agent':
      return 'description';

    case 'Edit':
    case 'Write':
      return 'file_path';

    default:
      return undefined;
  }
}
