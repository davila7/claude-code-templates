// Work tree snapshots for the guard mod. Plain TypeScript, no imports: it runs
// inside the hooks environment, and a real-git test loads it under Node with
// a spawn-backed `run`.

export const SNAPSHOT_PREFIX = 'ultramod snapshot: '
// Per worktree: refs under refs/worktree/ are not shared with the other work
// trees of the repository, so an undo only ever offers this tree's snapshots.
export const SNAPSHOT_REF = 'refs/worktree/ultramod/snapshots/'
export const KEEP_SNAPSHOTS = 20
// The snapshot commit is the mod's own record, so it carries a fixed identity:
// commit-tree fails on a machine with no user.name or user.email configured.
const SNAPSHOT_AUTHOR = {
  GIT_AUTHOR_NAME: 'Ultra Mod', GIT_AUTHOR_EMAIL: 'ultramod@localhost',
  GIT_COMMITTER_NAME: 'Ultra Mod', GIT_COMMITTER_EMAIL: 'ultramod@localhost',
}

export type GitResult = { ok: boolean; out: string }

/** Runs argv in cwd with extra environment; never throws. stdout is trimmed, except a -z list, which keeps the spaces of its paths. */
export type GitRun = (argv: string[], cwd: string, env?: Record<string, string>) => Promise<GitResult>

/** Removes a temporary index file; a missing file is fine. */
export type DropFile = (cwd: string, path: string) => Promise<void>

// yyyymmdd-hhmmss from epoch milliseconds in UTC, no Date object: the hooks
// environment guarantees no Node, so the conversion stays plain arithmetic.
export function stamp(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const days = Math.floor(seconds / 86_400)
  const rest = seconds - days * 86_400
  const z = days + 719_468
  const era = Math.floor(z / 146_097)
  const doe = z - era * 146_097
  const yoe = Math.floor((doe - Math.floor(doe / 1_460) + Math.floor(doe / 36_524) - Math.floor(doe / 146_096)) / 365)
  const y = yoe + era * 400
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100))
  const mp = Math.floor((5 * doy + 2) / 153)
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1
  const month = mp < 10 ? mp + 3 : mp - 9
  const year = month <= 2 ? y + 1 : y
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${year}${pad(month)}${pad(day)}-${pad(Math.floor(rest / 3_600))}${pad(Math.floor(rest / 60) % 60)}${pad(rest % 60)}`
}

// Write the work tree, untracked files included, as a commit under
// SNAPSHOT_REF through a temporary index. The real index and work tree are
// never touched. Returns whether the ref was written.
async function saveTree(run: GitRun, cwd: string, message: string, now: number, indexPath: string, fail: (why: string) => void): Promise<boolean> {
  const head = await run(['git', 'rev-parse', '--verify', 'HEAD'], cwd)
  const parent = head.ok && head.out ? head.out : null
  const env = { GIT_INDEX_FILE: indexPath }
  if (!(await run(['git', 'add', '-A'], cwd, env)).ok) { fail('git add -A failed'); return false }
  const tree = await run(['git', 'write-tree'], cwd, env)
  if (!tree.ok || !tree.out) { fail('git write-tree failed'); return false }
  const committed = await run(parent
    ? ['git', 'commit-tree', tree.out, '-p', parent, '-m', message]
    : ['git', 'commit-tree', tree.out, '-m', message], cwd, SNAPSHOT_AUTHOR)
  if (!committed.ok || !committed.out) { fail('git commit-tree failed'); return false }
  // Milliseconds in the name keep quick successive snapshots apart. The empty
  // old value makes update-ref refuse to replace a ref that already exists,
  // and the next suffix is tried.
  const base = `${SNAPSHOT_REF}${stamp(now)}-${String(Math.floor(now) % 1000).padStart(3, '0')}`
  for (let n = 0; n < 10; n++) {
    const ref = n === 0 ? base : `${base}-${n}`
    if ((await run(['git', 'update-ref', ref, committed.out, ''], cwd)).ok) return true
  }
  fail('git update-ref failed')
  return false
}

/**
 * Save a snapshot of the work tree at cwd and keep the newest KEEP_SNAPSHOTS.
 * Outside a work tree it does nothing; a failure is reported through fail and
 * never throws. The temporary index is removed whether or not the snapshot
 * was written.
 */
export async function saveSnapshot(run: GitRun, drop: DropFile, cwd: string, message: string, now: number, fail: (why: string) => void): Promise<void> {
  const inside = await run(['git', 'rev-parse', '--is-inside-work-tree'], cwd)
  if (!inside.ok || inside.out !== 'true') return
  // From the top: git resolves a relative --git-path against the top level,
  // so from a subdirectory the index path would point outside the repository.
  const top = await run(['git', 'rev-parse', '--show-toplevel'], cwd)
  if (!top.ok || !top.out) return fail('no work tree root')
  const root = top.out
  const index = await run(['git', 'rev-parse', '--git-path', 'ultramod-index'], root)
  if (!index.ok || !index.out) return fail('no index path')
  let saved = false
  try {
    saved = await saveTree(run, root, message, now, index.out, fail)
  } finally {
    await drop(root, index.out)
  }
  if (!saved) return
  const listed = await run(['git', 'for-each-ref', '--sort=-committerdate', '--sort=-refname', '--format=%(refname)', SNAPSHOT_REF], root)
  if (listed.ok) {
    for (const old of listed.out.split('\n').map(line => line.trim()).filter(line => line.startsWith(SNAPSHOT_REF)).slice(KEEP_SNAPSHOTS)) {
      await run(['git', 'update-ref', '-d', old], root)
    }
  }
}

const nulList = (out: string): string[] => out.split('\0').filter(Boolean)

/**
 * The work tree paths that stand in the way of writing the snapshot paths
 * back: a file where the snapshot has a directory, or a directory where it has
 * a file. `current` lists the work tree as git sees it; an entry ending in a
 * slash is a whole directory (an ignored one). A directory is named with its
 * trailing slash. Linear in the total path length.
 */
export function findConflicts(current: string[], snapshot: string[]): string[] {
  const files = new Set<string>()
  const dirs = new Set<string>()
  for (const entry of current) {
    const wholeDir = entry.endsWith('/')
    const path = wholeDir ? entry.slice(0, -1) : entry
    if (!wholeDir) files.add(path)
    else dirs.add(path)
    // Every parent is a directory; stop at the first one already known.
    for (let at = path.lastIndexOf('/'); at > 0; at = path.lastIndexOf('/', at - 1)) {
      const parent = path.slice(0, at)
      if (dirs.has(parent)) break
      dirs.add(parent)
    }
  }
  const found = new Set<string>()
  for (const path of snapshot) {
    if (dirs.has(path)) { found.add(`${path}/`); continue }
    for (let at = path.indexOf('/'); at > 0; at = path.indexOf('/', at + 1)) {
      const parent = path.slice(0, at)
      if (files.has(parent)) { found.add(parent); break }
    }
  }
  return [...found]
}

/**
 * Write every file of a snapshot back into the work tree at root through a
 * temporary index. Unlike `git restore --source=<sha> -- .` this only writes:
 * a tracked file that is not in the snapshot (created after it) is left alone.
 * Files that are in the snapshot go back to their saved content.
 *
 * A file that has since become a directory, or a directory that has become a
 * file, cannot be written back without deleting what the person made later.
 * Then nothing is written, the paths in the way go to onConflict, and the
 * result is false.
 */
export async function restoreSnapshot(run: GitRun, drop: DropFile, root: string, sha: string, onConflict: (paths: string[]) => void = () => {}): Promise<boolean> {
  const path = await run(['git', 'rev-parse', '--git-path', 'ultramod-restore-index'], root)
  if (!path.ok || !path.out) return false
  const env = { GIT_INDEX_FILE: path.out }
  try {
    // The work tree as it is now: its non-ignored files through the temporary
    // index, plus the ignored entries (a directory counts as one entry).
    if (!(await run(['git', 'add', '-A'], root, env)).ok) return false
    const now = await run(['git', 'ls-files', '-z'], root, env)
    const ignored = await run(['git', 'ls-files', '-z', '--others', '--ignored', '--exclude-standard', '--directory'], root)
    const saved = await run(['git', 'ls-tree', '-r', '-z', '--name-only', '--full-tree', sha], root)
    if (!now.ok || !ignored.ok || !saved.ok) return false
    const conflicts = findConflicts([...nulList(now.out), ...nulList(ignored.out)], nulList(saved.out))
    if (conflicts.length) {
      onConflict(conflicts)
      return false
    }
    if (!(await run(['git', 'read-tree', sha], root, env)).ok) return false
    return (await run(['git', 'checkout-index', '--all', '--force'], root, env)).ok
  } finally {
    await drop(root, path.out)
  }
}
