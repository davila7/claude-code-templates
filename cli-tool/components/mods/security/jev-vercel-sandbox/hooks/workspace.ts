/**
 * jev-vercel-sandbox — copying the project into the sandbox.
 *
 * `$.http.fetch` sends text only, so the SDK's `fs/write` (a gzip tar body) is
 * out of reach. Instead the hooks module packs the project with the local
 * `tar`, reads the archive back as base64, and this file's scripts rebuild it
 * inside the sandbox through the command endpoint: the base64 is appended to a
 * file a few arguments at a time, then decoded and unpacked, and a git
 * baseline is committed. Before each job the project's current state is
 * synced as a patch (`git diff --binary` between two trees the hooks module
 * builds with a throwaway index), and the job runs in its own worktree, so a
 * job always starts from the files as they are and two jobs never share a folder.
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
/** Git inside the sandbox: the baseline, every sync and every job's worktree need it. */
const ENSURE_GIT = [
  'if ! command -v git >/dev/null 2>&1; then',
  '  (sudo -n dnf install -y -q git || sudo -n apt-get install -y -q git) >/dev/null 2>&1 || true',
  'fi',
]
const IDENTITY = '-c user.name=jev-vercel-sandbox -c user.email=jev@sandbox.invalid'
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
  ...ENSURE_GIT,
  'if command -v git >/dev/null 2>&1; then',
  '  git init -q',
  '  git add -A',
  `  git ${IDENTITY} commit -q --allow-empty -m baseline`,
  '  echo git',
  'else',
  '  echo no-git',
  'fi',
].join('\n')

/** Where a sync's patch is assembled inside the sandbox. */
export const SYNC_FILE = '/tmp/jev-sync.b64'
/**
 * bash -c script, `$1` the base64 patch, `$2` the project folder, `$3` the
 * commit message: brings the sandbox's copy to the project's current state.
 */
export const SYNC_SCRIPT = [
  'set -e',
  'base64 -d "$1" > /tmp/jev-sync.patch',
  'rm -f "$1"',
  'cd "$2"',
  'git apply --binary --whitespace=nowarn /tmp/jev-sync.patch',
  'rm -f /tmp/jev-sync.patch',
  'git add -A',
  `git ${IDENTITY} commit -q --allow-empty -m "$3"`,
].join('\n')

/** The processes running now, without this script's own. */
const PROCESSES = `ps -eo pid=,ppid=,comm= 2>/dev/null | awk -v me=$$ '$1!=me && $2!=me && $1!=2 && $2!=2 {print $1" "$3}' | sort`
/**
 * bash -c script, `$1` how the job starts (`current`, `none`, `git`), `$2` the
 * project folder, `$3` the job's folder, `$4` a git URL, `$5` its ref, `$6`
 * the working directory inside the job's folder: makes
 * the job's folder (a worktree of the synced project, a clone, or an empty
 * repository), then marks the time and the processes so the report can tell
 * what the job did.
 */
export const PREPARE_SCRIPT = [
  'set -e',
  'rm -rf "$3"',
  'mkdir -p "$(dirname "$3")"',
  ...ENSURE_GIT,
  'case "$1" in',
  '  current) git -C "$2" worktree add -q --detach "$3" HEAD ;;',
  '  git) if [ -n "$5" ]; then git clone -q -- "$4" "$3" && git -C "$3" checkout -q "$5" --; else git clone -q --depth 1 -- "$4" "$3"; fi ;;',
  `  *) mkdir -p "$3" && git -C "$3" init -q && git -C "$3" ${IDENTITY} commit -q --allow-empty -m empty ;;`,
  'esac',
  'if [ -n "$6" ]; then mkdir -p "$3/$6"; fi',
  'touch "$3.marker"',
  `${PROCESSES} > "$3.ps" || true`,
].join('\n')
/**
 * bash -c script, `$1` the job's folder, `$2` 1 to list what the job did
 * outside it, `$3` 1 to keep a patch of its changes: prints `@@changes` and
 * git's porcelain status, `@@patch <bytes>`, then `@@outside` (files written
 * since the job began, outside the jobs, /tmp and the kernel's folders) and
 * `@@processes` (processes started since then and still running).
 */
export const REPORT_SCRIPT = [
  'cd "$1" || exit 0',
  'if git rev-parse --git-dir >/dev/null 2>&1; then',
  '  git add -A >/dev/null 2>&1',
  '  echo "@@changes"',
  '  git status --porcelain=v1 --no-renames',
  '  if [ "$3" = 1 ]; then',
  '    git diff --cached --binary --full-index HEAD > "$1.patch"',
  `    echo "@@patch $(wc -c < "$1.patch" | tr -d ' ')"`,
  '  fi',
  'fi',
  'if [ "$2" = 1 ]; then',
  '  echo "@@outside"',
  '  find / -xdev \\( -path /proc -o -path /sys -o -path /dev -o -path /tmp -o -path /run -o -path /var/tmp -o -path /var/cache -o -path /var/log -o -path "$(dirname "$1")" \\) -prune -o -newer "$1.marker" \\( -type f -o -type l \\) -print 2>/dev/null | head -n 200',
  '  echo "@@processes"',
  `  ${PROCESSES} > "$1.ps2" || true`,
  '  comm -13 "$1.ps" "$1.ps2" 2>/dev/null | head -n 50',
  'fi',
].join('\n')
/** bash -c script, `$1` a job's patch: prints it, refusing one that is not UTF-8 text (it would not survive the trip). */
export const PATCH_SCRIPT = [
  'test -f "$1" || { echo "the job kept no patch" >&2; exit 3; }',
  'if command -v iconv >/dev/null 2>&1 && ! iconv -f UTF-8 -t UTF-8 "$1" >/dev/null 2>&1; then echo "the patch holds text that is not UTF-8; apply it by hand" >&2; exit 3; fi',
  'cat "$1"',
].join('\n')

export type Report = { changes: Change[]; patchBytes: number | null; outside: string[]; processes: string[] }

/** REPORT_SCRIPT's output → its parts. */
export function readReport(text: string): Report {
  const out: Report = { changes: [], patchBytes: null, outside: [], processes: [] }
  let section = ''
  const status: string[] = []
  for (const line of text.split('\n')) {
    const m = /^@@(changes|patch|outside|processes)(?: (\d+))?$/.exec(line.trim())
    if (m) {
      section = m[1]!
      if (section === 'patch') out.patchBytes = Number(m[2] ?? 0)
      continue
    }
    if (!line.trim()) continue
    if (section === 'changes') status.push(line)
    else if (section === 'outside') out.outside.push(line.trim())
    else if (section === 'processes') out.processes.push(line.trim().replace(/^\d+\s+/, ''))
  }
  out.changes = readChanges(status.join('\n'))
  return out
}

/**
 * The paths a patch writes, read from the patch itself (the sandbox's own
 * file list could lie), and whether it makes a symlink, which a later write
 * could follow out of the project.
 */
export function patchTargets(patch: string): { paths: string[]; symlink: boolean } {
  const paths = new Set<string>()
  let symlink = false
  for (const line of patch.split('\n')) {
    const header = /^diff --git a\/(.+) b\/(.+)$/.exec(line)
    if (header) {
      paths.add(header[1]!)
      paths.add(header[2]!)
      continue
    }
    const moved = /^(?:rename|copy) (?:from|to) (.+)$/.exec(line)
    if (moved) paths.add(moved[1]!)
    const file = /^(?:\+\+\+|---) (?:[ab]\/)?(.+)$/.exec(line)
    if (file && file[1] !== '/dev/null') paths.add(file[1]!)
    if (/^(?:new file mode|new mode|old mode|deleted file mode) 120000$/.test(line) || /^index [0-9a-f]+\.\.[0-9a-f]+ 120000$/.test(line)) symlink = true
  }
  return { paths: [...paths].map(p => p.replace(/^"(.*)"$/, '$1')), symlink }
}

/** A URL the sandbox may clone: https only (no file://, ext:: or option-looking strings). */
export function isGitUrl(url: string): boolean {
  return /^https:\/\/[^\s'"`]+$/.test(url)
}

/** A branch, tag or commit to check out: no spaces, never an option. */
export function isGitRef(ref: string): boolean {
  return /^[A-Za-z0-9._/-]+$/.test(ref) && !ref.startsWith('-') && !ref.includes('..')
}

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
