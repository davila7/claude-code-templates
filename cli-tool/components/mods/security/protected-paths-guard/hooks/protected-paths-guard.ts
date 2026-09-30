/**
 * protected-paths-guard — Claude Mod (EARLY ACCESS)
 *
 * Denies Edit / Write / NotebookEdit calls that target sensitive files
 * (.env, lockfiles, CI workflows, git internals, private keys) unless the path
 * is allowlisted. A `tool.call` hook under an array matcher (any of the named
 * tools); on a match it returns `{ deny }` without calling `next`.
 *
 * Needs CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 (Claude Code >= 2.1.259). Typed
 * against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods
 *
 * Options:
 *   protect: string  extra globs to protect, comma-separated
 *   allow:   string  globs that are always allowed (checked first), comma-separated
 */
import type { Register } from 'claude-code'

// Minimal glob support: "**" = any depth, "*" = any chars except "/". One pass over the glob, so
// the regex a wildcard produces is never rewritten by a later replacement.
function globToRegExp(glob: string): RegExp {
  const source = glob.replace(/\*\*\/|\*\*|\*|[.+^${}()|[\]\\]/g, (m) =>
    m === '**/' ? '(?:.*/)?' : m === '**' ? '.*' : m === '*' ? '[^/]*' : `\\${m}`,
  )
  return new RegExp(`(^|/)${source}$`)
}

const DEFAULT_PROTECTED: readonly string[] = [
  '.env',
  '.env.*',
  '**/.git/**',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'Cargo.lock',
  'poetry.lock',
  '.github/workflows/*.yml',
  '.github/workflows/*.yaml',
  '**/*.pem',
  '**/*.key',
  '**/id_rsa*',
]

/** A list option: a string[] or a comma-separated string (what a manifest's `userConfig` string field holds); empty means unset. */
function strings(value: unknown): string[] | undefined {
  const list = Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string')
    : typeof value === 'string'
      ? value.split(',').map((s) => s.trim()).filter(Boolean)
      : []
  return list.length > 0 ? list : undefined
}

export const register: Register = (on, options) => {
  const protectedGlobs = [...DEFAULT_PROTECTED, ...(strings(options.protect) ?? [])]
  const allowGlobs = strings(options.allow) ?? []
  const protectedRes = protectedGlobs.map(globToRegExp)
  const allowRes = allowGlobs.map(globToRegExp)

  // An array in a matcher matches when any element matches.
  on('tool.call', { tool: ['Edit', 'Write', 'NotebookEdit'] }, ($, e, next) => {
    const rawPath = e.tool === 'NotebookEdit' ? e.notebook_path : e.file_path
    const filePath = rawPath.replace(/\\/g, '/')
    if (!filePath) return next(e)

    if (allowRes.some((re) => re.test(filePath))) return next(e)

    const hit = protectedRes.findIndex((re) => re.test(filePath))
    if (hit !== -1) {
      const rule = protectedGlobs[hit]
      $.ui.log(`[protected-paths-guard] denied ${e.tool} on ${filePath} (rule: ${rule})`)
      return {
        deny:
          `${filePath} is protected by protected-paths-guard (rule "${rule}"). ` +
          'Ask the user to edit it manually or add the path to the plugin\'s "allow" option.',
      }
    }

    return next(e)
  })
}
