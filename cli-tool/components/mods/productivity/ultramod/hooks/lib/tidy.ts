// Tidy mod helpers from SPEC 4.10: which files count as documentation and
// which documentation paths are allowed. Plain TypeScript, no imports.

function lowerBasename(path: string): string {
  const norm = path.replace(/\\/g, '/')
  const i = norm.lastIndexOf('/')
  return (i === -1 ? norm : norm.slice(i + 1)).toLowerCase()
}

function lowerRel(path: string): string {
  let p = path.replace(/\\/g, '/')
  while (p.startsWith('./')) p = p.slice(2)
  return p.toLowerCase()
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
    return lowerBasename(rel).startsWith(prefix) || rel.startsWith(prefix)
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
