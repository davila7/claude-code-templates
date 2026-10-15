/**
 * neon-branch-per-session — Claude Mod
 *
 * One Neon database branch per Claude Code session. When the session starts
 * the mod creates `<prefix>/<session id>` from the project's default branch
 * (or `parentBranchId`), reads its connection string and sets it as
 * DATABASE_URL, which every command Claude runs afterwards inherits
 * (`$.env.set` reaches the process and what it starts). The branch carries an
 * expiry, so it removes itself even when the session dies without a goodbye.
 *
 *   session.start   create (or reuse, on a resumed session) the branch, set the env
 *   command.run     /neon: show the branch, `keep` it past its expiry, `delete` it
 *   session.end     onEnd: expire (nothing to do), delete, or keep
 *
 * What this is not: a sandbox. Commands still run with the user's own
 * permissions, and a project whose .env holds another database URL can point
 * Claude at it. Loaders such as dotenv do not override a variable already in
 * the environment, which is what makes the branch win in the common case.
 *
 * Needs Claude Code >= 2.1.287 and a Neon
 * API key in the plugin's options. Never hardcode it in this file.
 *
 * Options (pluginConfigs["neon-branch-per-session@skills-dir"].options):
 *   neonApiKey, projectId   required; without both the mod does nothing
 *   parentBranchId: string  branch to fork (default: the project's default branch)
 *   database, role: string  connection string target (default neondb / neondb_owner)
 *   pooled: boolean         pooled connection string (default true)
 *   expireHours: number     self-delete after this long (default 24, max 720)
 *   onEnd: "expire" | "delete" | "keep"   what exiting does (default expire)
 *   namePrefix: string      branch name prefix (default claude)
 *   interactiveOnly: boolean skip claude -p / SDK runs (default true)
 */
import type { Register } from 'claude-code'
import {
  branchName,
  connectionUri,
  createBranch,
  deleteBranch,
  expiryIso,
  getBranch,
  hoursLeft,
  keepBranch,
  uriHost,
} from './neon-api.ts'
import { NeonError } from './neon-api.ts'
import type { Branch } from './neon-api.ts'

const COMMAND = 'neon'
// the first release kept one map under this key; it is only read now, for sessions that began before the split
const LEGACY_KEY = 'neon-branch-per-session:branches'
// one key per session, so two sessions starting together never overwrite each other's entry
const sessionKey = (id: string) => `neon-branch-per-session:session:${id}`

type Held = { branch: Branch; host: string; isKept: boolean; sessionId: string }

let held: Held | undefined

const str = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v.trim() : fallback)

export const register: Register = (on, options) => {
  const apiKey = str(options.neonApiKey, '')
  const project = str(options.projectId, '')
  const parentId = str(options.parentBranchId, '')
  const database = str(options.database, 'neondb')
  const role = str(options.role, 'neondb_owner')
  const pooled = options.pooled !== false
  const expireHours = typeof options.expireHours === 'number' ? options.expireHours : 24
  const onEnd = options.onEnd === 'delete' || options.onEnd === 'keep' ? options.onEnd : 'expire'
  const prefix = str(options.namePrefix, 'claude')
  const interactiveOnly = options.interactiveOnly !== false
  const isConfigured = apiKey !== '' && project !== ''

  const statusText = () => {
    if (!held) return undefined
    const left = hoursLeft(held.branch.expiresAt, Date.now())
    const life = held.isKept || left === undefined ? 'kept' : `expires in ${left}h`
    return `neon: ${held.branch.name} · ${life}`
  }

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    await $.command
      .register({
        name: COMMAND,
        description: "This session's Neon branch: show it, keep it past its expiry, or delete it",
        argumentHint: '[keep|delete]',
        immediate: true,
      })
      .catch(err => $.ui.log(`neon-branch-per-session: /${COMMAND} not registered: ${err}`))

    if (!isConfigured) {
      $.ui.log('neon-branch-per-session: set neonApiKey and projectId in the plugin options to create a branch per session', {
        to: 'debug',
      })
      return r
    }
    if (interactiveOnly && !e.isInteractive) return r

    const f = (url: string, init?: Parameters<typeof $.http.fetch>[1]) => $.http.fetch(url, init)
    try {
      const sessionId = await $.session.id()
      const name = branchName(prefix, sessionId)
      const legacy = ((await $.store.get(LEGACY_KEY)) ?? {}) as Record<string, string>
      // keyed by the full session id: the 8 characters in the branch name are not unique enough to share a branch on
      // an entry written under the branch name by an earlier version is still honoured
      const known = ((await $.store.get(sessionKey(sessionId))) as string | undefined) ?? legacy[name]
      let branch = known ? await getBranch(f, apiKey, project, known) : undefined
      const isReused = branch !== undefined
      if (!branch) {
        const make = (n: string) =>
          createBranch(f, apiKey, project, { name: n, parentId: parentId || undefined, expiresAt: expiryIso(Date.now(), expireHours) })
        // another session may already hold the 8-character name: retry once with the tail of the full id
        branch = await make(name).catch(err => {
          if (!(err instanceof NeonError) || (err.status !== 409 && err.status !== 422)) throw err
          return make(branchName(prefix, sessionId, 16))
        })
        await $.store.set(sessionKey(sessionId), branch.id)
      }
      // held before the URI is read: a branch that exists can always be kept or deleted with /neon
      held = { branch, host: '', isKept: !branch.expiresAt, sessionId }
      const uri = await connectionUri(f, apiKey, project, { branchId: branch.id, database, role, pooled })
      await $.env.set('DATABASE_URL', uri)
      await $.env.set('NEON_BRANCH', branch.name)
      held = { ...held, host: uriHost(uri) }
      $.ui.status(statusText())
      $.ui.toast(`neon: ${isReused ? 'reusing' : 'created'} branch ${branch.name}; DATABASE_URL points at it`)
      $.ui.log(`neon-branch-per-session: ${isReused ? 'reused' : 'created'} ${branch.name} (${branch.id}) on ${held.host}`, {
        to: 'debug',
      })
    } catch (err) {
      $.ui.toast(`neon: ${held ? `branch ${held.branch.name} exists but DATABASE_URL is not set (` : 'no branch for this session ('}${err instanceof Error ? err.message : String(err)})`)
      $.ui.log(`neon-branch-per-session: ${err instanceof Error ? err.message : String(err)}`)
    }
    return r
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    if (!isConfigured) return { text: 'neon: set neonApiKey and projectId in the plugin options' }
    if (!held) return { text: 'neon: no branch for this session (see the debug log for why)' }
    const f = (url: string, init?: Parameters<typeof $.http.fetch>[1]) => $.http.fetch(url, init)
    const arg = e.args.trim().toLowerCase()

    if (arg === 'keep') {
      try {
        await keepBranch(f, apiKey, project, held.branch.id)
        held = { ...held, isKept: true, branch: { ...held.branch, expiresAt: undefined } }
        $.ui.status(statusText())
        return { text: `neon: ${held.branch.name} will no longer expire; delete it in the Neon console or with /${COMMAND} delete` }
      } catch (err) {
        return { text: `neon: ${err instanceof Error ? err.message : String(err)}` }
      }
    }

    if (arg === 'delete') {
      const gone = held.branch.name
      try {
        await deleteBranch(f, apiKey, project, held.branch.id)
        await $.store.delete(sessionKey(held.sessionId))
        held = undefined
        await $.env.set('DATABASE_URL', undefined)
        await $.env.set('NEON_BRANCH', undefined)
        $.ui.status(undefined)
        return { text: `neon: deleted ${gone}; DATABASE_URL is unset for this session` }
      } catch (err) {
        return { text: `neon: ${err instanceof Error ? err.message : String(err)}` }
      }
    }

    const left = hoursLeft(held.branch.expiresAt, Date.now())
    const life = held.isKept || left === undefined ? 'kept (no expiry)' : `expires in ${left}h`
    return {
      text: `neon: ${held.branch.name} (${held.branch.id}) · ${life} · DATABASE_URL on ${held.host} · /${COMMAND} keep | delete`,
    }
  })

  // `clear` and `resume` end a conversation, not the process that owns the branch
  on('session.end', async ($, e, next) => {
    const r = await next(e)
    if (!held || e.reason === 'clear' || e.reason === 'resume') return r
    const f = (url: string, init?: Parameters<typeof $.http.fetch>[1]) => $.http.fetch(url, init)
    try {
      if (onEnd === 'delete' && !held.isKept) {
        await deleteBranch(f, apiKey, project, held.branch.id)
        await $.store.delete(sessionKey(held.sessionId))
      } else if (onEnd === 'keep' && !held.isKept) {
        await keepBranch(f, apiKey, project, held.branch.id)
      }
    } catch (err) {
      $.ui.log(`neon-branch-per-session: end-of-session ${onEnd} failed: ${err instanceof Error ? err.message : String(err)}`)
    }
    return r
  })
}
