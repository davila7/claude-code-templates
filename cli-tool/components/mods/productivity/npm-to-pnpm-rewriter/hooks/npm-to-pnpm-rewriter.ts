/**
 * npm-to-pnpm-rewriter — Claude Mod (EARLY ACCESS)
 *
 * Rewrites npm / npx invocations to the package manager your project uses
 * (pnpm by default, yarn or bun via options). The "modifying" placement: the
 * hook forwards a copy of the event with a changed `command` to `next`, and
 * tells the model what ran through `context` (the model's own tool_use block
 * keeps the command it wrote, for prompt-cache stability).
 *
 * Needs CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 (Claude Code >= 2.1.259). Typed
 * against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods
 *
 * Options:
 *   manager: "pnpm" | "yarn" | "bun"  (default "pnpm")
 */
import type { Register } from 'claude-code'

type Manager = 'pnpm' | 'yarn' | 'bun'

// [regex on the npm form, replacement per manager]. $1 keeps the command separator.
const REWRITES: Array<[RegExp, Record<Manager, string>]> = [
  [/(^|&&\s*|;\s*|\|\s*)npm\s+ci\b/g, { pnpm: '$1pnpm install --frozen-lockfile', yarn: '$1yarn install --immutable', bun: '$1bun install --frozen-lockfile' }],
  [/(^|&&\s*|;\s*|\|\s*)npm\s+(install|i|add)\b/g, { pnpm: '$1pnpm add', yarn: '$1yarn add', bun: '$1bun add' }],
  [/(^|&&\s*|;\s*|\|\s*)npm\s+(uninstall|remove|rm)\b/g, { pnpm: '$1pnpm remove', yarn: '$1yarn remove', bun: '$1bun remove' }],
  [/(^|&&\s*|;\s*|\|\s*)npm\s+run\b/g, { pnpm: '$1pnpm run', yarn: '$1yarn run', bun: '$1bun run' }],
  [/(^|&&\s*|;\s*|\|\s*)npm\s+(test|start|build)\b/g, { pnpm: '$1pnpm $2', yarn: '$1yarn $2', bun: '$1bun run $2' }],
  [/(^|&&\s*|;\s*|\|\s*)npx\s+/g, { pnpm: '$1pnpm dlx ', yarn: '$1yarn dlx ', bun: '$1bunx ' }],
]

// "<manager> add" with no package means "install everything": keep the bare install form.
function fixBareAdd(command: string, manager: Manager): string {
  return command.replace(new RegExp(`${manager} add(\\s*(&&|;|\\||$))`, 'g'), `${manager} install$1`)
}

export const register: Register = (on, options) => {
  const manager: Manager =
    options.manager === 'yarn' || options.manager === 'bun' ? options.manager : 'pnpm'

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const original = e.command
    if (!/\bnp[mx]\b/.test(original)) return next(e)

    // rewrite only outside single- and double-quoted strings: `echo '&& npm test'` is text, not a call
    const rewritten = original
      .split(/("[^"]*"|'[^']*')/)
      .map((part, i) => {
        if (i % 2 === 1) return part
        let out = part
        for (const [re, byManager] of REWRITES) out = out.replace(re, byManager[manager])
        return fixBareAdd(out, manager)
      })
      .join('')

    if (rewritten === original) return next(e)

    $.ui.log(`[npm-to-pnpm-rewriter] ${original}  ->  ${rewritten}`)
    // Events are frozen: forward a modified copy instead of mutating e.
    const outcome = await next({ ...e, command: rewritten })
    if (outcome.deny !== undefined) return outcome
    return {
      ...outcome,
      context: [
        ...(outcome.context ?? []),
        `npm-to-pnpm-rewriter ran \`${rewritten}\` instead of \`${original}\` (this project uses ${manager}).`,
      ],
    }
  })
}
