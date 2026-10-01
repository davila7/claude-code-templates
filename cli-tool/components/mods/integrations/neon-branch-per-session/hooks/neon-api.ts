/**
 * neon-api.ts — the Neon REST calls the mod makes, over a `fetch` it is given.
 *
 * Reference: https://api-docs.neon.tech (base https://console.neon.tech/api/v2,
 * `Authorization: Bearer <key>`). The five calls used:
 *   POST   /projects/{p}/branches                 create; `branch.expires_at` (RFC 3339, at most 30 days out)
 *   GET    /projects/{p}/branches/{b}             does it still exist
 *   PATCH  /projects/{p}/branches/{b}             `{ branch: { expires_at: null } }` clears the expiry
 *   DELETE /projects/{p}/branches/{b}
 *   GET    /projects/{p}/connection_uri           ?branch_id&database_name&role_name&pooled -> { uri }
 *
 * No `$` in here: the module passes `(url, init) => $.http.fetch(url, init)`.
 * The API key is only ever sent in the Authorization header; nothing here
 * returns or logs it, and the connection string is returned, never logged.
 */

export const API = 'https://console.neon.tech/api/v2'

export type Fetch = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ status: number; ok: boolean; text: string }>

export type Branch = { id: string; name: string; expiresAt?: string }

export class NeonError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const MAX_HOURS = 720

/** `<prefix>/<first 8 characters of the session id>`, with anything a branch name should not hold dropped. */
export function branchName(prefix: string, sessionId: string): string {
  const clean = (s: string) => s.replace(/[^A-Za-z0-9._-]/g, '')
  const id = clean(sessionId).slice(0, 8) || 'session'
  const head = clean(prefix)
  return head ? `${head}/${id}` : id
}

/** RFC 3339 expiry `hours` from `now`, held to Neon's 1 hour to 30 days window. */
export function expiryIso(now: number, hours: number): string {
  const h = Number.isFinite(hours) ? Math.min(MAX_HOURS, Math.max(1, hours)) : 24
  return new Date(now + h * 3_600_000).toISOString().replace(/\.\d{3}Z$/, 'Z')
}

export function hoursLeft(expiresAt: string | undefined, now: number): number | undefined {
  if (!expiresAt) return undefined
  const ms = Date.parse(expiresAt) - now
  return Number.isNaN(ms) ? undefined : Math.max(0, Math.round(ms / 3_600_000))
}

/** The host of a connection string, for showing where it points without showing the credentials. */
export function uriHost(uri: string): string {
  const m = /@([^/:?]+)/.exec(uri)
  return m?.[1] ?? 'unknown host'
}

function headers(key: string, withBody: boolean): Record<string, string> {
  const h: Record<string, string> = { authorization: `Bearer ${key}`, accept: 'application/json' }
  if (withBody) h['content-type'] = 'application/json'
  return h
}

async function call(f: Fetch, key: string, method: string, path: string, body?: unknown) {
  const res = await f(`${API}${path}`, {
    method,
    headers: headers(key, body !== undefined),
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    let detail = ''
    try {
      detail = (JSON.parse(res.text) as { message?: string }).message ?? ''
    } catch {
      detail = res.text.slice(0, 120)
    }
    throw new NeonError(`Neon ${method} ${path.split('?')[0].replace(/\/(br|ep)-[^/]+/g, '/$1-…')} answered ${res.status}${detail ? `: ${detail}` : ''}`, res.status)
  }
  return res.text ? (JSON.parse(res.text) as Record<string, unknown>) : {}
}

type BranchBody = { id?: string; name?: string; expires_at?: string }
const toBranch = (b: BranchBody | undefined): Branch => {
  if (!b?.id) throw new Error('Neon answered without a branch id')
  return { id: b.id, name: b.name ?? b.id, expiresAt: b.expires_at }
}

export async function createBranch(
  f: Fetch,
  key: string,
  project: string,
  opts: { name: string; parentId?: string; expiresAt: string },
): Promise<Branch> {
  const res = await call(f, key, 'POST', `/projects/${encodeURIComponent(project)}/branches`, {
    branch: {
      name: opts.name,
      expires_at: opts.expiresAt,
      ...(opts.parentId ? { parent_id: opts.parentId } : {}),
    },
    endpoints: [{ type: 'read_write' }],
  })
  return toBranch(res.branch as BranchBody | undefined)
}

/** undefined when the branch is gone. */
export async function getBranch(f: Fetch, key: string, project: string, id: string): Promise<Branch | undefined> {
  try {
    const res = await call(f, key, 'GET', `/projects/${encodeURIComponent(project)}/branches/${encodeURIComponent(id)}`)
    return toBranch(res.branch as BranchBody | undefined)
  } catch (err) {
    if (err instanceof NeonError && err.status === 404) return undefined
    throw err
  }
}

export async function keepBranch(f: Fetch, key: string, project: string, id: string): Promise<void> {
  await call(f, key, 'PATCH', `/projects/${encodeURIComponent(project)}/branches/${encodeURIComponent(id)}`, {
    branch: { expires_at: null },
  })
}

export async function deleteBranch(f: Fetch, key: string, project: string, id: string): Promise<void> {
  await call(f, key, 'DELETE', `/projects/${encodeURIComponent(project)}/branches/${encodeURIComponent(id)}`)
}

export async function connectionUri(
  f: Fetch,
  key: string,
  project: string,
  opts: { branchId: string; database: string; role: string; pooled: boolean },
): Promise<string> {
  const q = new URLSearchParams({
    branch_id: opts.branchId,
    database_name: opts.database,
    role_name: opts.role,
    pooled: String(opts.pooled),
  })
  const res = await call(f, key, 'GET', `/projects/${encodeURIComponent(project)}/connection_uri?${q}`)
  if (typeof res.uri !== 'string' || !res.uri) throw new Error('Neon answered without a connection URI')
  return res.uri
}
