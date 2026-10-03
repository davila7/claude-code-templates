/**
 * Working-tree snapshots for session-time-machine.
 *
 * A snapshot is a git commit of the whole working tree (tracked, modified and
 * untracked files, .gitignore honored) built with a throwaway index, so the
 * person's index, branch and stash are never touched. Each one is pinned by a
 * ref under `refs/time-machine/<session-id>/`, which is also how a later run
 * finds them again: no state lives outside git.
 */
import type { Point } from './transcript.ts'

export type Run = (
  argv: readonly string[],
  init?: { cwd?: string; env?: Record<string, string>; timeoutMs?: number },
) => Promise<{ exitCode: number; stdout: string; stderr: string }>

/** Tools that can change files; the others leave the tree as the last snapshot had it. */
export const MUTATING = /^(Edit|Write|MultiEdit|NotebookEdit|Bash|PowerShell)$/

const IDENT = { GIT_AUTHOR_NAME: 'time-machine', GIT_AUTHOR_EMAIL: 'time-machine@localhost', GIT_COMMITTER_NAME: 'time-machine', GIT_COMMITTER_EMAIL: 'time-machine@localhost' }
const safe = (key: string): string => key.replace(/[^A-Za-z0-9_-]/g, '_')

export const refPrefix = (sessionId: string): string => `refs/time-machine/${safe(sessionId)}/`

/** The snapshot key of a point's own moment: before a prompt, after a tool call, after a turn. */
export function ownKey(p: Pick<Point, 'kind' | 'turn' | 'id'>): string | undefined {
  if (p.kind === 'prompt') return `prompt-${p.turn}`
  if (p.kind === 'turn') return `turn-${p.turn}`
  return p.id ? `tool-${safe(p.id)}` : undefined
}

/** The newest snapshot at or before a point: read-only tool calls take the last one that could have changed files. */
export function snapshotFor(points: readonly Point[], n: number, snaps: ReadonlyMap<string, string>): string | undefined {
  for (let i = points.findIndex(p => p.n === n); i >= 0; i--) {
    const key = ownKey(points[i]!)
    const hit = key ? snaps.get(key) : undefined
    if (hit) return hit
  }
  return undefined
}

/** Commits the working tree under `key`; resolves to the commit, or undefined outside a git repo or on any git failure. */
export async function takeSnapshot(run: Run, cwd: string, sessionId: string, key: string): Promise<string | undefined> {
  try {
    const top = await run(['git', 'rev-parse', '--show-toplevel'], { cwd })
    const dir = await run(['git', 'rev-parse', '--absolute-git-dir'], { cwd })
    if (top.exitCode !== 0 || dir.exitCode !== 0) return undefined
    const root = top.stdout.trim()
    const env = { ...IDENT, GIT_INDEX_FILE: `${dir.stdout.trim()}/time-machine-index` }
    const opts = { cwd: root, env, timeoutMs: 120_000 }
    const head = await run(['git', 'rev-parse', '-q', '--verify', 'HEAD'], { cwd: root })
    const parent = head.exitCode === 0 ? head.stdout.trim() : undefined
    if ((await run(parent ? ['git', 'read-tree', parent] : ['git', 'read-tree', '--empty'], opts)).exitCode !== 0) return undefined
    if ((await run(['git', 'add', '-A'], opts)).exitCode !== 0) return undefined
    const tree = await run(['git', 'write-tree'], opts)
    if (tree.exitCode !== 0) return undefined
    const commit = await run(['git', 'commit-tree', tree.stdout.trim(), ...(parent ? ['-p', parent] : []), '-m', `time-machine ${key}`], opts)
    const id = commit.stdout.trim()
    if (commit.exitCode !== 0 || !id) return undefined
    const ref = await run(['git', 'update-ref', `${refPrefix(sessionId)}${safe(key)}`, id], { cwd: root })
    return ref.exitCode === 0 ? id : undefined
  } catch {
    return undefined
  }
}

/** Every snapshot of the session, keyed as `takeSnapshot` named them. */
export async function loadSnapshots(run: Run, cwd: string, sessionId: string): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  try {
    const prefix = refPrefix(sessionId)
    const res = await run(['git', 'for-each-ref', '--format=%(refname) %(objectname)', prefix], { cwd })
    if (res.exitCode !== 0) return out
    for (const line of res.stdout.split('\n')) {
      const [ref, id] = line.trim().split(' ')
      if (ref && id) out.set(ref.slice(prefix.length), id)
    }
  } catch {
    // not a repo: no snapshots
  }
  return out
}

export type Worktree = { path: string; branch: string }

/** A new worktree on its own branch at the snapshot, next to the project's other `.claude/worktrees`; undefined when git refuses. */
export async function restoreWorktree(run: Run, cwd: string, commit: string, tag: string): Promise<Worktree | undefined> {
  try {
    const top = await run(['git', 'rev-parse', '--show-toplevel'], { cwd })
    if (top.exitCode !== 0) return undefined
    const path = `${top.stdout.trim()}/.claude/worktrees/time-machine-${tag}`
    const branch = `time-machine/${tag}`
    const add = await run(['git', 'worktree', 'add', '-b', branch, path, commit], { cwd: top.stdout.trim() })
    return add.exitCode === 0 ? { path, branch } : undefined
  } catch {
    return undefined
  }
}

const appleQuote = (text: string): string => `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`

/** Opens `command` in a new Terminal window (macOS); resolves whether it did. */
export async function openInTerminal(run: Run, command: string): Promise<boolean> {
  try {
    const os = await run(['uname', '-s'])
    if (os.stdout.trim() !== 'Darwin') return false
    const res = await run(['osascript', '-e', `tell application "Terminal" to do script ${appleQuote(command)}`, '-e', 'tell application "Terminal" to activate'])
    return res.exitCode === 0
  } catch {
    return false
  }
}
