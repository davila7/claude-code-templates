/**
 * block-destructive-commands — Claude Mod (EARLY ACCESS)
 *
 * Denies Bash commands that match destructive patterns before they run.
 * A `tool.call` hook under a `{ tool: "Bash" }` matcher: on a match it returns
 * `{ deny }` without calling `next`, so nothing beneath (other plugins,
 * PreToolUse shell hooks, the tool itself) runs; otherwise it passes through.
 *
 * Needs CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 (Claude Code >= 2.1.259). Typed
 * against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods
 *
 * Options (plugin.json "userConfig" / hooks module options):
 *   patterns: string  extra regex sources, comma-separated, e.g. "\\bkubectl\\s+delete\\b"
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

interface Rule { pattern: RegExp; reason: string }

const DEFAULT_RULES: readonly Rule[] = [
  // rm with a recursive flag anywhere in its arguments (-r, -rf, -r -f, --recursive, -fR ...)
  // and a root/home/cwd target, optionally quoted or with a trailing slash ("~/", "$HOME/", "/").
  // The target may be quoted in whole or in part ("$HOME"/., '~'/) and end in "/" or "/.".
  { pattern: /\brm\s+(?=(?:\S+\s+)*?(?:-[a-z]*r[a-z]*|--recursive)\b)(?:\S+\s+)*?["']?(?:\/|~|\$HOME|\$\{HOME\}|\.\.?)["']?(?:\/\.?)?["']?(?:\s|$|;|&|\|)/i, reason: 'recursive delete of a root, home or working directory' },
  { pattern: /\brm\s+.*--no-preserve-root\b/i, reason: 'rm with --no-preserve-root' },
  // -f alone or inside a short-option cluster (-fu, -uf); --force-with-lease is the safe form
  { pattern: /\bgit\s+push\b(?!.*--force-with-lease).*(--force\b|\s-[a-zA-Z]*f[a-zA-Z]*\b)/, reason: 'force push' },
  { pattern: /\bgit\s+(reset\s+--hard|clean\s+(?:-[a-zA-Z]*f|.*--force\b))/, reason: 'history or working-tree destruction' },
  { pattern: /\b(DROP|TRUNCATE)\s+(TABLE|DATABASE|SCHEMA)\b/i, reason: 'destructive SQL' },
  { pattern: /\bmkfs(\.|\s)/, reason: 'filesystem format' },
  { pattern: /\bdd\s+.*\bof=["']?\/dev\//, reason: 'raw disk write' },
  { pattern: /\bchmod\s+(-R\s+)?777\b/, reason: 'world-writable permissions' },
]

export const register: Register = (on, options) => {
  // a custom pattern that does not compile is skipped, never a reason to lose the built-in rules
  const custom: Rule[] = []
  for (const p of strings(options.patterns) ?? []) {
    try {
      custom.push({ pattern: new RegExp(p), reason: `custom pattern ${p}` })
    } catch {
      // ignored: the defaults still apply
    }
  }
  const rules = [...DEFAULT_RULES, ...custom]

  on('tool.call', { tool: 'Bash' }, ($, e, next) => {
    for (const { pattern, reason } of rules) {
      if (pattern.test(e.command)) {
        $.ui.log(`[block-destructive-commands] denied Bash call: ${reason}`)
        // The model receives this text as the tool's error result.
        return {
          deny:
            `Blocked by block-destructive-commands (${reason}). ` +
            'If this is intentional, ask the user to run it manually.',
        }
      }
    }

    // Nothing matched: let the rest of the chain (and the real tool) run.
    return next(e)
  })
}
