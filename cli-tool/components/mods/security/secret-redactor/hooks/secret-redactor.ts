/**
 * secret-redactor — Claude Mod (EARLY ACCESS)
 *
 * Replaces credential-shaped strings in every tool result before the model
 * reads it, and refuses to echo a redacted placeholder back into a Bash
 * command. One `tool.call` hook: it awaits `next(e)` (the "after" placement),
 * deep-replaces every string in what came back and tells the model, through
 * `context`, that a redaction happened so it is not confused by placeholders.
 *
 * This is the shape the engine's author gives for a redactor:
 *   on("tool.call", async ($, e, next) => recursiveStrReplace(await next(e), ...))
 * Seat it as low as possible (an org appends it in managed settings) so no
 * plugin above ever sees the raw value on the way up.
 *
 * Needs CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 (Claude Code >= 2.1.259). Typed
 * against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods
 *
 * Options:
 *   patterns: string  extra regex sources, comma-separated (global flag is added)
 */
import type { Register } from 'claude-code'

/** A list option: a string[] or a comma-separated string (what a manifest's `userConfig` string field holds); empty means unset. */
function strings(value: unknown): string[] | undefined {
  const list = Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string')
    : typeof value === 'string'
      ? value.split(',').map((s) => s.trim()).filter(Boolean)
      : []
  return list.length > 0 ? list : undefined
}

interface Pattern { name: string; re: RegExp }

const DEFAULT_PATTERNS: readonly Pattern[] = [
  { name: 'aws-access-key', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'anthropic-api-key', re: /\bsk-ant-api\d{2}-[A-Za-z0-9_-]{20,}\b/g },
  { name: 'openai-api-key', re: /\bsk-[A-Za-z0-9]{32,}\b/g },
  { name: 'github-token', re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
  { name: 'google-api-key', re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { name: 'stripe-key', re: /\b[sr]k_(live|test)_[0-9A-Za-z]{24,}\b/g },
  { name: 'slack-token', re: /\bxox[abpr]-[0-9A-Za-z-]{10,}\b/g },
  { name: 'jwt', re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  { name: 'private-key-block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
  { name: 'connection-string', re: /\b(postgres(ql)?|mysql|mongodb(\+srv)?|redis):\/\/[^:\s]+:[^@\s]+@/gi },
]

function redactString(input: string, patterns: readonly Pattern[], hits: Set<string>): string {
  let out = input
  for (const { name, re } of patterns) {
    out = out.replace(re, () => {
      hits.add(name)
      return `[REDACTED:${name}]`
    })
  }
  return out
}

/** Walk any JSON-ish value and redact every string inside it. */
function redactDeep<T>(value: T, patterns: readonly Pattern[], hits: Set<string>): T {
  if (typeof value === 'string') return redactString(value, patterns, hits) as T
  if (Array.isArray(value)) return value.map((v) => redactDeep(v, patterns, hits)) as T
  if (value && typeof value === 'object') {
    const copy: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) copy[k] = redactDeep(v, patterns, hits)
    return copy as T
  }
  return value
}

export const register: Register = (on, options) => {
  const extra = strings(options.patterns) ?? []
  const patterns: readonly Pattern[] = [...DEFAULT_PATTERNS, ...extra.map((p) => ({ name: 'custom', re: new RegExp(p, 'g') }))]

  on('tool.call', async ($, e, next) => {
    // 1. Never let a redacted placeholder travel back into a shell command.
    if (e.tool === 'Bash' && e.command.includes('[REDACTED:')) {
      return {
        deny:
          'The command contains a redacted secret placeholder. ' +
          'Read the value from an environment variable instead of pasting it.',
      }
    }

    // 2. Redact the result before it enters the transcript.
    const outcome = await next(e)
    if (outcome.deny !== undefined) return outcome

    const hits = new Set<string>()
    const cleaned = redactDeep(outcome, patterns, hits)
    if (hits.size === 0) return outcome

    const kinds = [...hits].join(', ')
    $.ui.log(`[secret-redactor] redacted ${kinds} from ${e.tool} output`)
    return {
      ...cleaned,
      context: [
        ...(outcome.context ?? []),
        `secret-redactor replaced ${hits.size} kind(s) of secret (${kinds}) with [REDACTED:*] placeholders before you read this result. Never paste a placeholder into a command.`,
      ],
    }
  })
}
