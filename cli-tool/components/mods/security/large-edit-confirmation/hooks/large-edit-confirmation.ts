/**
 * large-edit-confirmation — Claude Mod (EARLY ACCESS)
 *
 * Asks the user, in the engine's own AskUserQuestion dialog, before Claude
 * edits or overwrites a file larger than a configurable number of lines.
 * A `tool.call` hook on Edit / Write: it reads the file through `$.fs.read`,
 * asks through `$.ui.ask`, then either calls `next(e)` or returns `{ deny }`.
 *
 * `$.ui.ask` rejects in a headless (`claude -p`) run, where nobody can answer;
 * the `headless` option decides what happens then (deny by default).
 *
 * Needs CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 (Claude Code >= 2.1.259). Typed
 * against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods
 *
 * Options:
 *   maxLines: number            files above this many lines need confirmation (default 1000)
 *   headless: "deny" | "allow"  what to do when there is nobody to ask (default "deny")
 */
import type { Register } from 'claude-code'

const ALLOW = 'Allow once'
const DENY = 'Deny'

export const register: Register = (on, options) => {
  const threshold = typeof options.maxLines === 'number' ? options.maxLines : 1000
  const headless = options.headless === 'allow' ? 'allow' : 'deny'

  on('tool.call', { tool: ['Edit', 'Write'] }, async ($, e, next) => {
    const filePath = e.file_path
    if (!filePath) return next(e)

    let lineCount = 0
    try {
      const current = await $.fs.read(filePath)
      lineCount = current.split('\n').length
    } catch {
      // New file, unreadable, or $.fs withheld by an admin plugin: nothing to protect.
      return next(e)
    }

    if (lineCount <= threshold) return next(e)

    let answer: string
    try {
      answer = await $.ui.ask(
        `${filePath} has ${lineCount} lines (limit ${threshold}). Allow ${e.tool} to modify it?`,
        [ALLOW, DENY],
      )
    } catch {
      // Dismissed, or a -p run with no one to ask.
      if (headless === 'allow') return next(e)
      return {
        deny: `${e.tool} on ${filePath} (${lineCount} lines) needs the user's confirmation and nobody could answer. Propose a smaller, targeted change.`,
      }
    }

    // Compare with the labels exactly: free text typed under "Other" is not an approval.
    if (answer !== ALLOW) {
      $.ui.log(`[large-edit-confirmation] user declined ${e.tool} on ${filePath}`)
      return {
        deny: `The user declined the ${e.tool} on ${filePath} (${lineCount} lines). Propose a smaller, targeted change.`,
      }
    }

    return next(e)
  })
}
