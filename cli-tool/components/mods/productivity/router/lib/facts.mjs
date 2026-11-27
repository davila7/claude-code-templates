// Facts the policy needs, derived from one Messages request body plus what the router remembers
// about the conversation. Pure: body and memory in, plain object out.

const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'Bash']);
const FAILURE_WINDOW = 40;
const REMINDER = /<system-reminder>[\s\S]*?<\/system-reminder>/g;
const CLIP_MARKER = ' […] ';

export function extractFacts(body, memory, { recentTurns, maxTextChars }) {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  // Claude Code puts hook output and tool additions in `system` messages after the user message, and keeps them in
  // the history: the turn is the last user or assistant message.
  const lastIndex = messages.findLastIndex((m) => m?.role !== 'system');
  const last = messages[lastIndex];
  const lastBlocks = blocks(last?.content);
  // The current user message goes to Jev as the prompt; `turns` holds only the dialogue before it.
  const current = last?.role === 'user' ? lastIndex : -1;
  const turns = [];
  const errors = [];
  const edits = [];
  messages.forEach((message, index) => {
    const content = blocks(message.content);
    if (message.role === 'user') {
      for (const block of content)
        if (block.type === 'tool_result' && block.is_error) errors.push({ index, signature: signatureOf(block) });
    } else if (message.role === 'assistant') {
      for (const block of content) if (block.type === 'tool_use' && EDIT_TOOLS.has(block.name)) edits.push(index);
    }
    const text = textOf(content);
    if (index !== current && text && (message.role === 'user' || message.role === 'assistant'))
      turns.push({ role: message.role, text: clip(text, maxTextChars) });
  });
  return {
    turns: turns.slice(-recentTurns),
    prompt: current === -1 ? '' : clip(textOf(lastBlocks), maxTextChars),
    continuation: last?.role === 'user' && lastBlocks.some((b) => b.type === 'tool_result'),
    failure: repeatedFailure(errors, edits, messages.length - 1),
    // The effort Claude Code sent: a route without its own effort keeps it, and it is part of the cache key.
    effort: body.output_config?.effort ?? null,
    lastRoute: memory.lastRoute,
    lastRequest: memory.lastRequest,
    models: memory.models,
  };
}

// Two errors with the same signature and an edit attempt between them, all inside the recent window.
function repeatedFailure(errors, edits, lastIndex) {
  const recent = errors.filter((e) => lastIndex - e.index <= FAILURE_WINDOW);
  for (let j = recent.length - 1; j > 0; j -= 1) {
    for (let i = j - 1; i >= 0; i -= 1) {
      if (recent[i].signature !== recent[j].signature) continue;
      if (edits.some((k) => k > recent[i].index && k < recent[j].index))
        return { signature: recent[j].signature, index: recent[j].index };
    }
  }
  return null;
}

// At most `max` characters: the head and the tail of a long text, where a request and its question usually are.
export function clip(text, max) {
  if (text.length <= max) return text;
  if (max <= CLIP_MARKER.length) return text.slice(0, max);
  const room = max - CLIP_MARKER.length;
  const head = Math.ceil(room / 2);
  return `${text.slice(0, head)}${CLIP_MARKER}${text.slice(text.length - (room - head))}`;
}

function signatureOf(block) {
  return textOf(blocks(block.content)).toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').slice(0, 120);
}

function blocks(content) {
  if (typeof content === 'string') return [{ type: 'text', text: content }];
  return Array.isArray(content) ? content : [];
}

function textOf(content) {
  return content
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text.replace(REMINDER, ''))
    .join('\n')
    .trim();
}
