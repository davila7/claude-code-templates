// Tidy mod helpers from SPEC 4.10: which files count as documentation and
// which documentation paths are allowed. Plain TypeScript, no imports.

function lowerBasename(path: string): string {
  const norm = path.replace(/\\/g, '/')
  const i = norm.lastIndexOf('/')
  return (i === -1 ? norm : norm.slice(i + 1)).toLowerCase()
}

// Lowercase, forward slashes, and `.`/`..`/empty segments resolved, so
// `docs/../notes.md` is judged as `notes.md`. A `..` that climbs out of the
// project stays in front of the path, where no allowlist entry matches it.
function lowerRel(path: string): string {
  const absolute = path.replace(/\\/g, '/').startsWith('/')
  const kept: string[] = []
  for (const part of path.replace(/\\/g, '/').toLowerCase().split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') {
      if (kept.length > 0 && kept[kept.length - 1] !== '..') kept.pop()
      else if (!absolute) kept.push(part)
      continue
    }
    kept.push(part)
  }
  return (absolute ? '/' : '') + kept.join('/')
}

/**
 * True for documentation files: .md, .markdown, .txt extensions.
 */
export function isDocFile(path: string): boolean {
  const base = lowerBasename(path)
  return base.endsWith('.md') || base.endsWith('.markdown') || base.endsWith('.txt')
}

// One allowlist entry: NAME* (prefix), dir/** (folder) or an exact name.
function entryAllows(entry: string, rel: string): boolean {
  const e = entry.toLowerCase()
  if (e.endsWith('/**')) {
    const dir = e.slice(0, -3)
    return rel.startsWith(dir + '/')
  }
  if (e.endsWith('*')) {
    const prefix = e.slice(0, -1)
    // Without a folder the prefix is a file name prefix, wherever the file sits.
    // With one, the rest of the path after it must be a single file name.
    if (!prefix.includes('/')) return lowerBasename(rel).startsWith(prefix)
    return rel.startsWith(prefix) && !rel.slice(prefix.length).includes('/')
  }
  return rel === e || lowerBasename(rel) === e
}

const BUILTIN_ALLOW = [
  'readme*',
  'changelog*',
  'contributing*',
  'license*',
  'docs/**',
  '.claude/**',
  '.github/**',
  'agents.md',
  'claude.md',
]

/**
 * True when a relative documentation path is in the SPEC 4.10 allowlist:
 * README*, CHANGELOG*, CONTRIBUTING*, LICENSE*, docs/**, .claude/**,
 * .github/**, AGENTS.md, CLAUDE.md, plus any extraAllow entries in the same
 * NAME*, dir/** or exact-name forms.
 */
export function isAllowedDocPath(relPath: string, extraAllow?: string[]): boolean {
  const rel = lowerRel(relPath)
  for (const e of BUILTIN_ALLOW) {
    if (entryAllows(e, rel)) return true
  }
  if (extraAllow !== undefined) {
    for (const e of extraAllow) {
      if (entryAllows(e, rel)) return true
    }
  }
  return false
}
