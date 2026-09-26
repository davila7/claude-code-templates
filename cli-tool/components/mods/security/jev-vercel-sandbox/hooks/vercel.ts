/**
 * jev-vercel-sandbox — the Vercel Sandbox REST client.
 *
 * A mod runs without node_modules, so `@vercel/sandbox` is not available: this
 * speaks its HTTP API directly, through a `fetch` the hooks module hands in
 * (`(url, init) => $.http.fetch(url, init)`), so nothing here touches `$`.
 *
 * The endpoints are Vercel's REST API reference (vercel.com/docs/rest-api/sandboxes),
 * called the way `@vercel/sandbox` 3.5.0 calls them (dist/api-client/api-client.js):
 *
 *   POST /v3/sandboxes?teamId=…                       create → { sandbox, session, routes }
 *   GET  /v2/sandboxes/sessions/{id}?teamId=…         → { session, routes }
 *   POST /v2/sandboxes/sessions/{id}/cmd?teamId=…     { command, args, cwd, env, sudo, wait: true, logs: true, timeout }
 *                                                     → application/x-ndjson: { command } · { stream, data }… · { command: { exitCode } }
 *   POST /v2/sandboxes/sessions/{id}/stop?teamId=…    → { session }
 *
 * Base URL https://api.vercel.com (the SDK uses the equivalent
 * https://vercel.com/api), `Authorization: Bearer <token>`. An error body is
 * `{ error: { message } }`. `persistent` defaults to true on the server, so it
 * is always sent.
 */
import type { HttpInit, HttpResponse } from 'claude-code'

export type Fetch = (url: string, init: HttpInit) => Promise<HttpResponse>

export const DEFAULT_API_URL = 'https://api.vercel.com'

export type Credentials = { token: string; teamId: string; projectId: string }

export type SessionStatus = 'pending' | 'running' | 'stopping' | 'stopped' | 'failed' | 'aborted' | 'snapshotting'

export type SandboxInfo = {
  /** The sandbox's name (the SDK's `sandbox.name`). */
  name: string
  /** The current session: commands and stop go to it. */
  sessionId: string
  status: SessionStatus
  region: string
  vcpus: number
  memory: number
  /** The session's timeout, in ms. */
  timeout: number
  cwd: string
  image?: string
  /** Epoch ms the session started (or was requested, while pending). */
  startedAt: number
}

export type CreateOptions = {
  timeoutMs: number
  image?: string
  vcpus?: number
  persistent: boolean
}

export type RunResult = {
  exitCode: number | null
  stdout: string
  stderr: string
  durationMs?: number
  /** A `{ stream: "error" }` line, or a stream that ended before the command did. */
  error?: string
}

/** base64url → text, without `atob` (the mod runtime's lib is es2023 only). */
function decodeBase64Url(s: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  let bits = 0
  let value = 0
  const bytes: number[] = []
  for (const ch of s.replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')) {
    const i = alphabet.indexOf(ch)
    if (i < 0) throw new Error('not base64url')
    value = (value << 6) | i
    bits += 6
    if (bits >= 8) {
      bits -= 8
      bytes.push((value >> bits) & 0xff)
    }
  }
  // UTF-8 without TextDecoder (not in the es2023 lib either)
  return decodeURIComponent(bytes.map(b => `%${b.toString(16).padStart(2, '0')}`).join(''))
}

/**
 * The claims a Vercel OIDC token carries (`owner_id` is the team,
 * `project_id` the project), as the SDK's `decodeUnverifiedToken` reads them.
 * Null for an access token, which is not a JWT.
 */
export function oidcClaims(token: string): { teamId: string; projectId?: string } | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const payload = JSON.parse(decodeBase64Url(parts[1]!)) as { owner_id?: unknown; project_id?: unknown }
    if (typeof payload.owner_id !== 'string') return null
    return { teamId: payload.owner_id, projectId: typeof payload.project_id === 'string' ? payload.project_id : undefined }
  } catch {
    return null
  }
}

/**
 * Credentials from the options (or the env fallbacks): an access token needs
 * the team and project ids beside it; an OIDC token carries both itself.
 */
export function resolveCredentials(
  token: string,
  teamId: string,
  projectId: string,
): { ok: true; credentials: Credentials; kind: 'access token' | 'oidc token' } | { ok: false; missing: string[] } {
  const t = token.trim()
  const claims = t ? oidcClaims(t) : null
  const team = teamId.trim() || claims?.teamId || ''
  const project = projectId.trim() || claims?.projectId || ''
  const missing = [!t && 'vercelToken', !team && 'vercelTeamId', !project && 'vercelProjectId'].filter((m): m is string => !!m)
  if (missing.length) return { ok: false, missing }
  return { ok: true, credentials: { token: t, teamId: team, projectId: project }, kind: claims ? 'oidc token' : 'access token' }
}

export function apiUrl(base: string, path: string, teamId: string): string {
  return `${base.replace(/\/+$/, '')}${path}?teamId=${encodeURIComponent(teamId)}`
}

export function headers(c: Credentials): Record<string, string> {
  return { authorization: `Bearer ${c.token}`, 'content-type': 'application/json', 'user-agent': 'jev-vercel-sandbox (claude-code mod)' }
}

export function createBody(c: Credentials, o: CreateOptions): string {
  const body: Record<string, unknown> = {
    projectId: c.projectId,
    ports: [],
    timeout: o.timeoutMs,
    persistent: o.persistent,
  }
  if (o.image) body.image = o.image
  if (o.vcpus) body.resources = { vcpus: o.vcpus }
  return JSON.stringify(body)
}

/** The Bash tool's command, run by bash in the sandbox with no local env forwarded. */
export function commandBody(command: string, timeoutMs: number, cwd?: string): string {
  return JSON.stringify({
    command: 'bash',
    args: ['-c', command],
    cwd: cwd || undefined,
    env: {},
    sudo: false,
    wait: true,
    logs: true,
    timeout: timeoutMs,
  })
}

/** The server's `{ error: { message } }`, else the status and the start of the body. */
export function errorOf(r: HttpResponse): string {
  try {
    const m = (JSON.parse(r.text) as { error?: { message?: unknown } }).error?.message
    if (typeof m === 'string' && m) return `${r.status}: ${m}`
  } catch {}
  return `${r.status}${r.text ? `: ${r.text.slice(0, 200)}` : ''}`
}

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function readSessionObject(session: Record<string, unknown>, sandbox?: Record<string, unknown>): SandboxInfo | null {
  if (typeof session.id !== 'string' || typeof session.status !== 'string') return null
  return {
    name: typeof sandbox?.name === 'string' ? sandbox.name : session.id,
    sessionId: session.id,
    status: session.status as SessionStatus,
    region: typeof session.region === 'string' ? session.region : '',
    vcpus: num(session.vcpus),
    memory: num(session.memory),
    timeout: num(session.timeout),
    cwd: typeof session.cwd === 'string' ? session.cwd : '',
    image: typeof sandbox?.image === 'string' ? sandbox.image : undefined,
    startedAt: num(session.startedAt, num(session.requestedAt, num(session.createdAt))),
  }
}

/** `{ sandbox, session, routes }` (create) or `{ session, routes }` (get). */
export function readSandbox(text: string, previousName?: string): SandboxInfo | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const { session, sandbox } = parsed as { session?: unknown; sandbox?: unknown }
  if (!session || typeof session !== 'object') return null
  const info = readSessionObject(session as Record<string, unknown>, sandbox && typeof sandbox === 'object' ? (sandbox as Record<string, unknown>) : undefined)
  if (info && !sandbox && previousName) info.name = previousName
  return info
}

/**
 * The command endpoint's ndjson, read whole: the first line names the
 * command, log lines follow, and a line with `command.exitCode` ends it.
 */
export function readCommandStream(text: string): RunResult {
  const out: RunResult = { exitCode: null, stdout: '', stderr: '' }
  let finished = false
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    let chunk: Record<string, unknown>
    try {
      chunk = JSON.parse(line) as Record<string, unknown>
    } catch {
      continue
    }
    const command = chunk.command as { exitCode?: unknown; durationMs?: unknown } | undefined
    if (command && typeof command === 'object') {
      if (typeof command.exitCode === 'number') {
        out.exitCode = command.exitCode
        if (typeof command.durationMs === 'number') out.durationMs = command.durationMs
        finished = true
      }
      continue
    }
    if (chunk.stream === 'stdout' && typeof chunk.data === 'string') out.stdout += chunk.data
    else if (chunk.stream === 'stderr' && typeof chunk.data === 'string') out.stderr += chunk.data
    else if (chunk.stream === 'error') {
      const d = chunk.data as { code?: unknown; message?: unknown } | undefined
      out.error = `${typeof d?.code === 'string' ? d.code : 'error'}: ${typeof d?.message === 'string' ? d.message : 'the sandbox reported an error'}`
    }
  }
  if (!finished && !out.error) out.error = 'the stream ended before the command finished'
  return out
}

export type Client = {
  create(o: CreateOptions): Promise<SandboxInfo>
  get(s: SandboxInfo): Promise<SandboxInfo>
  run(s: SandboxInfo, command: string, timeoutMs: number): Promise<RunResult>
  stop(s: SandboxInfo): Promise<void>
}

/** The four calls this mod makes, over the fetch it is handed. Each throws with the API's message on a non-2xx. */
export function client(fetch: Fetch, c: Credentials, base = DEFAULT_API_URL): Client {
  const call = async (path: string, init: HttpInit) => {
    const r = await fetch(apiUrl(base, path, c.teamId), { ...init, headers: headers(c) })
    if (!r.ok) throw new Error(`Vercel Sandbox ${errorOf(r)}`)
    return r
  }
  return {
    async create(o) {
      const r = await call('/v3/sandboxes', { method: 'POST', body: createBody(c, o) })
      const info = readSandbox(r.text)
      if (!info) throw new Error('Vercel Sandbox: unreadable create response')
      return info
    },
    async get(s) {
      const r = await call(`/v2/sandboxes/sessions/${encodeURIComponent(s.sessionId)}`, { method: 'GET' })
      const info = readSandbox(r.text, s.name)
      if (!info) throw new Error('Vercel Sandbox: unreadable session response')
      return { ...info, image: info.image ?? s.image }
    },
    async run(s, command, timeoutMs) {
      const r = await call(`/v2/sandboxes/sessions/${encodeURIComponent(s.sessionId)}/cmd`, {
        method: 'POST',
        body: commandBody(command, timeoutMs, s.cwd),
      })
      return readCommandStream(r.text)
    },
    async stop(s) {
      await call(`/v2/sandboxes/sessions/${encodeURIComponent(s.sessionId)}/stop`, { method: 'POST' })
    },
  }
}
