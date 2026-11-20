import type { Engine } from './engine.ts';
import { judgeInputText } from './judge-input.ts';
import type { JudgeInput } from './judge-input.ts';
import { JUDGE_SYSTEM_PROMPT } from './judge-prompt.ts';
import { verdictFrom } from './judge-verdict.ts';
import type { Verdict } from './judge-verdict.ts';
import type { Settings } from './plugin-settings.ts';

const TIMEOUT_MS = 30000;
const MAX_REPLY_TOKENS = 300;

export type JudgeAnswer = {
  /** Undefined when the reply is no verdict. */
  verdict: Verdict | undefined;
  model: string;
  replyChars: number;
  startsWithBrace: boolean;
  /** Equal to the reply limit when the reply was cut. The engine gives no stop reason. */
  outputTokens: number;
};

/** Asks the Claude model from the settings, on the session's own login. Throws when the model gives no reply. */
export async function askClaudeJudge(engine: Engine, settings: Settings, input: JudgeInput): Promise<JudgeAnswer> {
  const reply = await engine.complete({
    model: settings.claudeModel,
    system: JUDGE_SYSTEM_PROMPT,
    prompt: judgeInputText(input),
    effort: 'low',
    maxTokens: MAX_REPLY_TOKENS,
    timeoutMs: TIMEOUT_MS,
  });

  if (!reply.isAnswered) {
    throw new Error(`model gave no answer: ${reply.reason}`);
  }

  return {
    verdict: verdictFrom(reply.text),
    model: settings.claudeModel,
    replyChars: reply.text.length,
    startsWithBrace: reply.text.trim().startsWith('{'),
    outputTokens: reply.usage.output_tokens,
  };
}
