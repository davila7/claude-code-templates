/**
 * jev-vercel-sandbox — copying the project into the sandbox.
 *
 * `$.http.fetch` sends text only, so the SDK's `fs/write` (a gzip tar body) is
 * out of reach. Instead the hooks module packs the project with the local
 * `tar`, reads the archive back as base64, and this file's scripts rebuild it
 * inside the sandbox through the command endpoint: the base64 is appended to a
 * file a few arguments at a time, then decoded and unpacked, and a git
 * baseline is committed so each later command's changed files can be listed.
 *
 * Pure helpers only: nothing here touches `$`.
 */

/** Where the base64 is assembled inside the sandbox. */
export const UPLOAD_FILE = '/tmp/jev-workspace.b64'

/** One argument's size: well under Linux's 128 KiB per-argument limit. */
export const ARG_BYTES = 100_000
/** Arguments per command call, so one request body stays near 400 KB. */
export const ARGS_PER_CALL = 4
/**
 * `$.fs.read` rejects files over 4 MiB, so a bigger archive is `split` into
 * parts of this size. A multiple of 3, so every part but the last encodes to
 * base64 without padding and the parts' base64 concatenates into one stream.
 */
export const PART_BYTES = 3_000_000

/** Files that hold credentials: never copied, whatever git says about them. */
const SECRET_NAMES = [
  /^\.env$/,
  /^\.env\.(?!example$|sample$|template$|dist$)[^/]+$/,
  /^\.dev\.vars$/,
  /^\.npmrc$/,
  /^\.pypirc$/,
  /^\.netrc$/,
  /^\.git-credentials$/,
  /^\.pgpass$/,
  /\.tfstate(\.backup)?$/,
  /\.(pem|key|p12|pfx|jks|keystore|ppk)$/i,
  /^id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/,
  /^credentials(\.json)?$/,
]
const SECRET_DIRS = ['.git', '.ssh', '.aws', '.gnupg', '.kube', '.docker', '.terraform', 'node_modules', '.vercel', '.claude']

/** True for a path the upload leaves out: a credential file, or one inside a folder that never goes. */
export function isExcluded(path: string): boolean {
  const parts = path.split('/')
  const name = parts[parts.length - 1] ?? ''
  if (parts.slice(0, -1).some(dir => SECRET_DIRS.includes(dir))) return true
  return SECRET_NAMES.some(re => re.test(name))
}

/** `-z` / `-print0` output → paths, `./` dropped. */
export function nulList(text: string): string[] {
  return text
    .split('\0')
    .map(p => p.replace(/^\.\//, ''))
    .filter(Boolean)
}

/** What goes up: listed files, minus the deleted ones git still lists, minus the excluded. */
export function filesToUpload(listed: string[], deleted: string[] = []): { files: string[]; excluded: string[] } {
  const gone = new Set(deleted)
  const files: string[] = []
  const excluded: string[] = []
  for (const p of new Set(listed)) {
    if (gone.has(p)) continue
    if (isExcluded(p)) excluded.push(p)
    else files.push(p)
  }
  return { files: files.sort(), excluded: excluded.sort() }
}

/** The base64 cut into argument lists, one list per command call. */
export function uploadBatches(base64: string, argBytes = ARG_BYTES, perCall = ARGS_PER_CALL): string[][] {
  const args: string[] = []
  for (let i = 0; i < base64.length; i += argBytes) args.push(base64.slice(i, i + argBytes))
  const batches: string[][] = []
  for (let i = 0; i < args.length; i += perCall) batches.push(args.slice(i, i + perCall))
  return batches
}

/** bash -c script, `$1` the file: empties it. */
export const TRUNCATE_SCRIPT = ': > "$1"'
/** bash -c script, `$1` the file, the rest base64 pieces: appends them in order. */
export const APPEND_SCRIPT = 'f="$1"; shift; printf %s "$@" >> "$f"'
/**
 * bash -c script, `$1` the base64 file, `$2` the folder: unpacks the project
 * there and commits a baseline when git exists. Prints `git` or `no-git` last.
 */
export const EXTRACT_SCRIPT = [
  'set -e',
  'mkdir -p "$2"',
  'base64 -d "$1" | tar -xzf - -C "$2"',
  'rm -f "$1"',
  'cd "$2"',
  'if command -v git >/dev/null 2>&1; then',
  '  git init -q',
  '  git add -A',
  '  git -c user.name=jev-vercel-sandbox -c user.email=jev@sandbox.invalid commit -q --allow-empty -m baseline',
  '  echo git',
  'else',
  '  echo no-git',
  'fi',
].join('\n')
/**
 * bash -c script, `$1` the folder: what changed since the last baseline, as
 * `git status --porcelain`, then a new baseline, so each command reports only its own changes.
 */
export const CHANGES_SCRIPT = [
  'cd "$1" || exit 0',
  'git add -A >/dev/null 2>&1',
  'git status --porcelain=v1 --no-renames',
  'git -c user.name=jev-vercel-sandbox -c user.email=jev@sandbox.invalid commit -q --allow-empty -m step >/dev/null 2>&1 || true',
].join('\n')

export type Change = { path: string; kind: 'added' | 'modified' | 'deleted' }

/** `git status --porcelain=v1` after `add -A` → the changed files. */
export function readChanges(text: string): Change[] {
  const out: Change[] = []
  for (const line of text.split('\n')) {
    if (line.length < 4) continue
    const code = line.slice(0, 2)
    let path = line.slice(3)
    if (path.startsWith('"') && path.endsWith('"')) path = path.slice(1, -1)
    const kind = code.includes('D') ? 'deleted' : code.includes('A') || code.includes('?') ? 'added' : 'modified'
    out.push({ path, kind })
  }
  return out
}

/** "3 files: +a.txt, ~b.ts, -c.md" (at most `max` named). */
export function describeChanges(changes: Change[], max = 8): string {
  if (!changes.length) return 'no files changed'
  const mark = { added: '+', modified: '~', deleted: '-' } as const
  const named = changes.slice(0, max).map(c => `${mark[c.kind]}${c.path}`)
  const more = changes.length > max ? `, … ${changes.length - max} more` : ''
  return `${changes.length} file${changes.length === 1 ? '' : 's'} changed: ${named.join(', ')}${more}`
}

/** The folder name the project gets inside the sandbox. */
export function folderName(root: string): string {
  const base = root.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || 'workspace'
  return base.replace(/[^A-Za-z0-9._-]/g, '_') || 'workspace'
}

/** The session's working directory relative to the project root ('' at the root, null outside it). */
export function relativeCwd(root: string, cwd: string): string | null {
  const r = root.replace(/[\\/]+$/, '')
  const c = cwd.replace(/[\\/]+$/, '')
  if (c === r) return ''
  if (c.startsWith(`${r}/`) || c.startsWith(`${r}\\`)) return c.slice(r.length + 1).replace(/\\/g, '/')
  return null
}

export function megabytes(bytes: number): string {
  return `${(bytes / 1_048_576).toFixed(bytes < 10_485_760 ? 1 : 0)} MB`
}
