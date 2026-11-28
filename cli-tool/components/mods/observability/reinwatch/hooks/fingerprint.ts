// A short key for "the same tool call". Only this hash is kept in memory, never the input it was made from.

// Top-level fields that differ between two calls doing the same thing, so they stay out of the key: the ones the engine
// adds to every call, the person's consent for a press, and the model's free-text `description` beside a Bash or
// PowerShell command ("Run tests" and "Re-run tests" run the same command). Any other tool's `description` is a real
// argument (an issue's text, say), so it stays in the key.
const CALL_FIELDS: ReadonlySet<string> = new Set(['tool', 'tool_use_id', 'agentId', 'requestMeta', 'consent'])
const SHELL_TOOLS: ReadonlySet<string> = new Set(['Bash', 'PowerShell'])

// The same value with every object's keys in order, so the order the keys arrived in never changes the JSON.
const sorted = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sorted)
  if (value !== null && typeof value === 'object') {
    const fields = value as Record<string, unknown>
    return Object.fromEntries(Object.keys(fields).sort().map((key) => [key, sorted(fields[key])]))
  }
  return value
}

// FNV-1a, 32 bits, over the text's UTF-16 code units; eight hex digits, zero padded.
const fnv1a = (text: string): string => {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export const fingerprint = (tool: string, input: Readonly<Record<string, unknown>>): string => {
  const own = Object.fromEntries(Object.entries(input).filter(([key]) => !CALL_FIELDS.has(key) && !(key === 'description' && SHELL_TOOLS.has(tool))))
  return fnv1a(`${tool}\u0000${JSON.stringify(sorted(own))}`)
}
