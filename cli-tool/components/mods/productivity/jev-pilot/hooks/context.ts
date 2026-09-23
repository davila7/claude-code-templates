/**
 * jev-pilot — what the decision model is shown of the conversation, and
 * which prompts are tasks at all.
 *
 * Pure, like the policy modules: the hooks read `$.session.messages()` and
 * hand the list here. Only message text and tool names travel, never a tool's
 * input or output: those hold file contents and command output, which is more
 * than a classifier needs and more than should leave the machine.
 */

/** Prompt origins that are not a task of the person's: nothing to plan or suggest for. */
export const NOT_A_TASK: ReadonlySet<string> = new Set([
  'task-notification',
  'peer',
  'peer-send-message',
  'projects-relay',
  'observer',
  'observer-activity',
])

/** The part of a transcript message this module reads (`SessionMessage`). */
export interface ContextMessage {
  role: 'user' | 'assistant'
  text: string
  toolUses?: readonly { tool: string; isError?: true }[]
  toolResults?: readonly { isError: boolean }[]
}

export interface ContextLimits {
  /** How many messages before the prompt to include; 0 sends none. */
  messages: number
  /** The most characters all of them may take together. */
  chars: number
}

/** A message as one line: who, what they said, and which tools ran. */
function lineOf(message: ContextMessage, cap: number): string | null {
  const text = message.text.replace(/\s+/g, ' ').trim()
  const tools = (message.toolUses ?? []).map((use) => (use.isError ? `${use.tool} (failed)` : use.tool))
  if (!text && tools.length === 0) return null
  const said = text.length > cap ? `${text.slice(0, cap)}…` : text
  const ran = tools.length > 0 ? ` [tools: ${tools.join(', ')}]` : ''
  return `${message.role}: ${said}${ran}`
}

/**
 * The conversation just before `prompt`, newest last, as the text the
 * decision model reads beside it; '' when there is none or `messages` is 0.
 *
 * The prompt itself is dropped when the transcript already holds it, so it is
 * never counted twice. Messages that carry only tool results (no text) are
 * skipped: their outcome already shows on the tool call as "(failed)". The
 * newest messages win the character budget; older ones are dropped, not
 * squeezed. The newest is always sent, cut to the budget if it must be.
 */
export function recentContext(
  messages: readonly ContextMessage[],
  prompt: string,
  limits: ContextLimits,
): string {
  if (limits.messages <= 0 || limits.chars <= 0) return ''
  let list = messages
  const last = list.at(-1)
  if (last && last.role === 'user' && last.text.trim() === prompt.trim()) list = list.slice(0, -1)

  const cap = Math.max(200, Math.floor(limits.chars / limits.messages))
  const lines: string[] = []
  let used = 0
  for (let index = list.length - 1; index >= 0 && lines.length < limits.messages; index--) {
    const line = lineOf(list[index] as ContextMessage, cap)
    if (!line) continue
    if (used + line.length > limits.chars) {
      // A budget smaller than one message still carries the newest one.
      if (lines.length === 0) lines.unshift(`${line.slice(0, Math.max(0, limits.chars - 1))}…`)
      break
    }
    lines.unshift(line)
    used += line.length + 1
  }
  return lines.join('\n')
}

/**
 * Plain facts about a request, sent beside it so the decision model does not
 * have to infer them from prose: how long it is, how many files it names,
 * whether it carries code or an error, whether it is phrased as a question,
 * and what the recent turns did with their tools. Counts and flags only;
 * nothing here quotes the conversation.
 */
export interface Signals {
  prompt_chars: number
  files_mentioned: number
  has_code_or_error: boolean
  is_question: boolean
  /** Tool use over the last `window` messages, by kind. */
  recent_tools: { edits: number; commands: number; reads: number; subagents: number; failed: number }
}

const TOOL_KINDS: Record<string, keyof Omit<Signals['recent_tools'], 'failed'>> = {
  Edit: 'edits',
  MultiEdit: 'edits',
  Write: 'edits',
  NotebookEdit: 'edits',
  Bash: 'commands',
  PowerShell: 'commands',
  Read: 'reads',
  Grep: 'reads',
  Glob: 'reads',
  LS: 'reads',
  WebFetch: 'reads',
  WebSearch: 'reads',
  Agent: 'subagents',
  Task: 'subagents',
}

const PATH = /(?:^|[\s`'"(])((?:[\w.-]+\/)+[\w.-]+|[\w-]+\.(?:tsx?|jsx?|mjs|py|go|rs|java|kt|swift|rb|php|cs|c|cc|cpp|h|hpp|sql|json|ya?ml|toml|md|css|scss|html|sh|lock))(?=$|[\s`'"),:;])/g
const CODE_OR_ERROR = /```|Traceback|Exception|\berror\b|\bfailed\b|stack ?trace|\bat \S+:\d+/i
const QUESTION = /^(what|why|how|when|where|which|who|can|could|does|do|did|is|are|should|would|will)\b/i

export function signalsOf(prompt: string, messages: readonly ContextMessage[], window = 10): Signals {
  const text = prompt.trim()
  const files = new Set<string>()
  for (const match of text.matchAll(PATH)) files.add(match[1] as string)
  const tools = { edits: 0, commands: 0, reads: 0, subagents: 0, failed: 0 }
  for (const message of messages.slice(-window)) {
    for (const use of message.toolUses ?? []) {
      const kind = TOOL_KINDS[use.tool]
      if (kind) tools[kind]++
      if (use.isError) tools.failed++
    }
  }
  return {
    prompt_chars: text.length,
    files_mentioned: files.size,
    has_code_or_error: CODE_OR_ERROR.test(text),
    is_question: text.endsWith('?') || QUESTION.test(text),
    recent_tools: tools,
  }
}
