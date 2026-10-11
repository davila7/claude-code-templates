// Naming rules for hosts, write folders, and commands.

type HostPort = { host: string; port: number | null }

const LABEL = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/
// IPv4 also accepts fewer components, octal digits, and hexadecimal components.
const IPV4 = /^(?:\d+|0x[0-9a-f]*)(?:\.(?:\d+|0x[0-9a-f]*)){0,3}$/i
const LOCAL_NAMESPACES = ['localhost', 'local', 'home.arpa', 'internal']
// Under HOME, `<root>/<name>/...` gives the cache folder `<root>/<name>` of any tool.
const NAMED_CACHE_ROOTS: readonly (readonly string[])[] = [['.cache'], ['Library', 'Caches']]
// Under HOME, `<cache>/...` gives `<cache>`: package caches that hold downloads only.
const PACKAGE_CACHES: readonly (readonly string[])[] = [
  ['.npm', '_cacache'],
  ['.cargo', 'registry'],
  ['.cargo', 'git'],
  ['.gradle', 'caches'],
  ['.m2', 'repository'],
  ['.local', 'share', 'pnpm', 'store'],
  ['Library', 'pnpm', 'store'],
]
const TEMP_ROOTS: readonly (readonly string[])[] = [
  ['', 'var', 'folders'],
  ['', 'private', 'var', 'folders'],
]
const TEMP_MARKERS: ReadonlySet<string> = new Set(['T', 'C'])
const COMMAND_LIMIT = 120
// What the engine refuses in a text: control characters other than tab, newline, and carriage return, a lone
// surrogate, and its own placeholder character.
const UNDRAWABLE = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f\ud800-\udfff\u{10eeee}]/gu
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/
// An assignment whose value holds no quote, substitution, brace, or escape: it ends at the next space.
const PLAIN_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=[^'"`$(){}\\]*$/
// A file name: at most 255 characters, the most a file system takes.
const PROGRAM_NAME = /^[\w.+-]{1,255}$/
// Protected names that hold in any folder: settings or code in them can run outside the sandbox.
export const CLAUDE_PROTECTED: ReadonlySet<string> = new Set(['settings.json', 'settings.local.json', 'skills', 'agents', 'commands', 'hooks', 'workflows', 'scheduled_tasks.json'])
const GIT_PROTECTED: ReadonlySet<string> = new Set(['hooks', 'config'])
const EDITOR_FOLDERS: ReadonlySet<string> = new Set(['.vscode', '.idea'])
const MCP_FILE = '.mcp.json'
// Shell startup files and the git configuration.
const STARTUP_FILES: ReadonlySet<string> = new Set(['.bashrc', '.bash_profile', '.bash_login', '.bash_logout', '.profile', '.zshrc', '.zshenv', '.zprofile', '.zlogin', '.zlogout', '.gitconfig'])
/** Every protected place that a folder can hold, as a path from that folder. */
export const PROTECTED_PLACES: readonly string[] = [
  ...[...CLAUDE_PROTECTED].map(name => `.claude/${name}`),
  ...[...GIT_PROTECTED].map(name => `.git/${name}`),
  ...EDITOR_FOLDERS,
  MCP_FILE,
  ...STARTUP_FILES,
]
const KEY_FILE = /\.(?:pem|key)$/i

/** A host as the sandbox compares it: lowercase, one trailing dot cut. */
export function normalHost(host: string): string {
  const lower = host.toLowerCase()
  return lower.endsWith('.') ? lower.slice(0, -1) : lower
}

/** The host and port of `host:port`, `[v6]:port`, or a bare host. */
export function splitHost(text: string): HostPort {
  const isBracketed = text.startsWith('[')
  const end = isBracketed ? text.indexOf(']') + 1 : text.lastIndexOf(':')
  const hasPort = end > 0 && /^:\d+$/.test(text.slice(end))
  return {
    host: normalHost(hasPort || isBracketed ? text.slice(0, end) : text),
    port: hasPort ? Number(text.slice(end + 1)) : null,
  }
}

/** True for a DNS name of two or more labels that is no IP literal and no local name. */
export function isDnsName(host: string): boolean {
  const labels = host.split('.')
  return (
    host.length <= 253 &&
    labels.length >= 2 &&
    !IPV4.test(host) &&
    !LOCAL_NAMESPACES.some(name => host === name || host.endsWith(`.${name}`)) &&
    labels.every(label => label.length <= 63 && LABEL.test(label))
  )
}

/** Whether a settings host entry covers the host on every given port. A record keeps at most five ports, so an earlier port can be missing. */
export function hostMatches(entry: string, host: string, ports: readonly number[]): boolean {
  const pattern = splitHost(entry.trim())
  const isPortMatch = pattern.port === null || (ports.length > 0 && ports.every(port => port === pattern.port))
  if (!isPortMatch) return false
  if (pattern.host === '*') return true
  if (pattern.host.startsWith('*.')) return host.endsWith(pattern.host.slice(1))
  return pattern.host === host
}

/** True when `path` is `folder` or lies inside it. */
export function isUnder(path: string, folder: string): boolean {
  const base = folder.replace(/\/+$/, '')
  return path === base || path.startsWith(`${base}/`)
}

/** `path` made absolute from `base` when relative, with `.`, `..`, and empty segments resolved, as the sandbox resolves it. */
export function absolutePath(path: string, base: string): string {
  const parts: string[] = []
  for (const part of (path.startsWith('/') ? path : `${base}/${path}`).split('/')) {
    if (part === '..') parts.pop()
    else if (part !== '' && part !== '.') parts.push(part)
  }
  return `/${parts.join('/')}`
}

/**
 * The folders of a PATH value as the shell spells them, each made absolute: an empty or relative entry (an empty PATH
 * too) starts at the working directory. The spelling stays, because the system follows a link before a `..` after it.
 */
export function pathFolders(value: string | undefined, cwd: string): string[] {
  return value === undefined ? [] : value.split(':').map(entry => (entry.startsWith('/') ? entry : `${cwd}/${entry}`))
}

/** A path that a protected name covers in any folder, in any letter case: many file systems ignore case. */
export function isProtectedName(path: string): boolean {
  const parts = path.toLowerCase().split('/')
  const last = parts.at(-1) ?? ''
  const follows = (segment: string, names: ReadonlySet<string>) => parts.some((part, index) => part === segment && names.has(parts[index + 1] ?? ''))
  return follows('.claude', CLAUDE_PROTECTED) || follows('.git', GIT_PROTECTED) || parts.some(part => EDITOR_FOLDERS.has(part)) || last === MCP_FILE || STARTUP_FILES.has(last)
}

/** A key or certificate file, by its name, in any letter case. */
export function isKeyFile(path: string): boolean {
  return KEY_FILE.test(path)
}

/** A denied path whose name alone rules out Allow for its folder: a protected name or a key file. */
export function isGuardedPath(path: string): boolean {
  return isProtectedName(path) || isKeyFile(path)
}

/** `~/...` for a path under HOME, else the path. */
export function displayPath(path: string, home: string | undefined): string {
  return home !== undefined && isUnder(path, home) ? `~${path.slice(home.length)}` : path
}

function startsWithParts(parts: readonly string[], prefix: readonly string[]): boolean {
  return prefix.every((part, index) => parts[index] === part)
}

/** How many leading parts name the macOS per-user temp (T) or cache (C) folder, or null. */
function sharedFolderLength(parts: readonly string[]): number | null {
  const root = TEMP_ROOTS.find(prefix => startsWithParts(parts, prefix) && TEMP_MARKERS.has(parts[prefix.length + 2] ?? ''))
  return root === undefined ? null : root.length + 3
}

/** How many leading parts name the cache or temp folder that holds the path, or null. */
function cacheLength(parts: readonly string[], home: string | undefined): number | null {
  // An empty, `.`, or `..` segment makes the text name another folder (`~/.cache/..` is HOME), so no cache holds it.
  if (parts.slice(1).some(part => part === '' || part === '.' || part === '..')) return null
  const shared = sharedFolderLength(parts)
  if (shared !== null) return parts.length > shared ? shared : null
  const homeParts = home?.split('/')
  if (homeParts === undefined || !startsWithParts(parts, homeParts)) return null
  const rest = parts.slice(homeParts.length)
  // `<root>/<name>/...`: at least one segment after <name>, so a file directly in a root names no cache.
  const named = NAMED_CACHE_ROOTS.find(root => startsWithParts(rest, root) && rest.length > root.length + 1)
  if (named !== undefined) return homeParts.length + named.length + 1
  const store = PACKAGE_CACHES.find(cache => startsWithParts(rest, cache) && rest.length > cache.length)
  return store === undefined ? null : homeParts.length + store.length
}

/** The cache or temp folder that holds a denied path, or null when none does. */
export function cacheFolder(path: string, home: string | undefined): string | null {
  const parts = path.split('/')
  const length = cacheLength(parts, home)
  return length === null ? null : parts.slice(0, length).join('/')
}

/** The folder target of a denied path: its cache or temp folder, else the folder that holds it. */
export function folderTarget(path: string, home: string | undefined): string {
  return cacheFolder(path, home) ?? (path.slice(0, path.lastIndexOf('/')) || '/')
}

/** True for the macOS per-user temp or cache folder, which every app of the person shares. */
export function isSharedFolder(path: string): boolean {
  const parts = path.split('/')
  return sharedFolderLength(parts) === parts.length
}

/** The text cut to at most `limit` characters, with `…` when cut, never between the two halves of one character. */
export function cutText(text: string, limit: number): string {
  if (text.length <= limit) return text
  const end = /[\ud800-\udbff]/.test(text.charAt(limit - 2)) ? limit - 2 : limit - 1
  return `${text.slice(0, end)}…`
}

/** The text with each character that the engine refuses to show replaced by `�`. */
export function plainText(text: string): string {
  return text.replace(UNDRAWABLE, '\ufffd')
}

/** A command as one line of at most 120 characters. */
export function commandLine(command: string): string {
  return cutText(plainText(command.replace(/\s+/g, ' ').trim()), COMMAND_LIMIT)
}

/**
 * The program name of a command, for `seenWith`, or '' when none is sure. A quoted or substituted assignment value
 * can hold spaces, so the word after it may be part of that value, such as a token: no name is taken then.
 */
export function programName(command: string): string {
  const words = command.trim().replace(/^(?:cd\s+\S+\s*&&\s*)+/, '').split(/\s+/)
  const index = words.findIndex(word => !ASSIGNMENT.test(word))
  if (index === -1 || !words.slice(0, index).every(word => PLAIN_ASSIGNMENT.test(word))) return ''
  const [word = ''] = words.slice(index, index + 1)
  const program = word.slice(word.lastIndexOf('/') + 1)
  return PROGRAM_NAME.test(program) ? program : ''
}
