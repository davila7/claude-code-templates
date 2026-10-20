/**
 * vercel-api.ts — the Vercel REST reads the mod makes, and what it takes out of them.
 *
 * Reference: https://vercel.com/docs/rest-api (base https://api.vercel.com,
 * `Authorization: Bearer <token>`, `teamId` for a team's resources):
 *   GET /v10/projects?limit=N    projects[] (a bare array on older shapes) with
 *                                `latestDeployments[]` { id, readyState, url, createdAt,
 *                                target, meta } and `targets.production` { alias[], url }
 *   GET /v7/deployments?projectId&limit   deployments[] { uid, url, readyState, target, created, meta, errorMessage }
 *
 * `readyState` is one of BLOCKED, BUILDING, CANCELED, DELETED, ERROR,
 * INITIALIZING, QUEUED, READY. Nothing here trusts a field to be there: the
 * parsers read what they find and leave the rest out. No `$` in this file, and
 * the token only ever leaves in an Authorization header.
 */

export const API = 'https://api.vercel.com'

export type Fetch = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ status: number; ok: boolean; text: string }>

export type DeployState = 'ready' | 'building' | 'failed' | 'canceled' | 'blocked' | 'unknown'

export type Deploy = {
  id: string
  /** the raw readyState Vercel reported */
  readyState: string
  state: DeployState
  /** hostname, no scheme */
  url?: string
  target?: string
  createdAt?: number
  readyAt?: number
  commit?: string
  branch?: string
  error?: string
}

export type Project = {
  id: string
  name: string
  framework?: string
  repo?: string
  /** the domain the production site is reached at, no scheme */
  domain?: string
  latest?: Deploy
  /** state of the production deployment, when Vercel names one */
  production?: DeployState
  updatedAt?: number
}

const obj = (v: unknown): Record<string, unknown> | undefined =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined
const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined)
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)

export function toState(readyState: string | undefined): DeployState {
  switch (readyState) {
    case 'READY':
      return 'ready'
    case 'BUILDING':
    case 'INITIALIZING':
    case 'QUEUED':
      return 'building'
    case 'ERROR':
      return 'failed'
    case 'CANCELED':
    case 'DELETED':
      return 'canceled'
    case 'BLOCKED':
      return 'blocked'
    default:
      return 'unknown'
  }
}

/** Hostname of a url or domain: no scheme, no path. */
export function hostOf(value: string | undefined): string | undefined {
  if (!value) return undefined
  return value.replace(/^https?:\/\//, '').replace(/\/.*$/, '') || undefined
}

export function parseDeploy(raw: unknown): Deploy | undefined {
  const d = obj(raw)
  if (!d) return undefined
  const id = str(d.uid) ?? str(d.id)
  if (!id) return undefined
  const readyState = str(d.readyState) ?? str(d.state) ?? 'UNKNOWN'
  const meta = obj(d.meta)
  const commit =
    str(meta?.githubCommitMessage) ?? str(meta?.gitlabCommitMessage) ?? str(meta?.bitbucketCommitMessage)
  return {
    id,
    readyState,
    state: toState(readyState),
    url: hostOf(str(d.url)),
    target: str(d.target),
    createdAt: num(d.createdAt) ?? num(d.created),
    readyAt: num(d.readyAt) ?? num(d.ready),
    commit: commit?.split('\n')[0],
    branch: str(meta?.githubCommitRef) ?? str(meta?.gitlabCommitRef) ?? str(meta?.bitbucketCommitRef),
    error: str(d.errorMessage),
  }
}

/** The production domain: a custom one beats the *.vercel.app alias. */
export function productionDomain(p: Record<string, unknown>): string | undefined {
  const production = obj(obj(p.targets)?.production)
  const aliases: string[] = []
  if (Array.isArray(production?.alias)) {
    for (const a of production.alias) if (typeof a === 'string') aliases.push(a)
  }
  if (Array.isArray(p.alias)) {
    for (const a of p.alias) {
      const domain = str(obj(a)?.domain)
      if (domain) aliases.push(domain)
    }
  }
  const hosts = aliases.map(a => hostOf(a)).filter((h): h is string => h !== undefined)
  return hosts.find(h => !h.endsWith('.vercel.app')) ?? hosts[0] ?? hostOf(str(production?.url))
}

export function parseProject(raw: unknown): Project | undefined {
  const p = obj(raw)
  if (!p) return undefined
  const id = str(p.id)
  const name = str(p.name)
  if (!id || !name) return undefined
  const deploys = (Array.isArray(p.latestDeployments) ? p.latestDeployments : [])
    .map(parseDeploy)
    .filter((d): d is Deploy => d !== undefined)
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
  const link = obj(p.link)
  const org = str(link?.org)
  const repo = str(link?.repo)
  const production = obj(obj(p.targets)?.production)
  return {
    id,
    name,
    framework: str(p.framework),
    repo: org && repo ? `${org}/${repo}` : repo,
    domain: productionDomain(p),
    latest: deploys[0],
    production: production ? toState(str(production.readyState)) : undefined,
    updatedAt: num(p.updatedAt),
  }
}

/** The list endpoint answers a bare array or `{ projects, pagination }`. */
export function parseProjects(text: string): Project[] {
  const body: unknown = JSON.parse(text)
  const list = Array.isArray(body) ? body : obj(body)?.projects
  return (Array.isArray(list) ? list : []).map(parseProject).filter((p): p is Project => p !== undefined)
}

export function parseDeploys(text: string): Deploy[] {
  const list = obj(JSON.parse(text))?.deployments
  return (Array.isArray(list) ? list : []).map(parseDeploy).filter((d): d is Deploy => d !== undefined)
}

const RANK: Record<DeployState, number> = { building: 0, failed: 1, blocked: 2, unknown: 3, ready: 4, canceled: 5 }

/** Building first, then failed, then the rest by recent activity. */
export function sortProjects(projects: readonly Project[]): Project[] {
  const state = (p: Project) => p.latest?.state ?? 'unknown'
  return [...projects].sort((a, b) => {
    const r = RANK[state(a)] - RANK[state(b)]
    if (r !== 0) return r
    return (b.latest?.createdAt ?? b.updatedAt ?? 0) - (a.latest?.createdAt ?? a.updatedAt ?? 0)
  })
}

export type Summary = { total: number; live: number; building: number; failed: number }

export function summarize(projects: readonly Project[]): Summary {
  const s: Summary = { total: projects.length, live: 0, building: 0, failed: 0 }
  for (const p of projects) {
    const state = p.latest?.state
    if (state === 'building') s.building += 1
    else if (state === 'failed') s.failed += 1
    else if (state === 'ready') s.live += 1
  }
  return s
}

export const summaryText = (s: Summary) =>
  `vercel: ${s.live} ready · ${s.building} building · ${s.failed} failed`

export type Change = { project: string; to: 'ready' | 'failed'; target?: string; error?: string }

/**
 * What finished between two reads: a project whose latest deployment was
 * building and is now ready or failed, or whose latest deployment is a new one
 * that already is. The first read (nothing before) announces nothing.
 */
export function changes(before: ReadonlyMap<string, Deploy>, projects: readonly Project[]): Change[] {
  const out: Change[] = []
  if (before.size === 0) return out
  for (const p of projects) {
    const now = p.latest
    if (!now || (now.state !== 'ready' && now.state !== 'failed')) continue
    const was = before.get(p.id)
    const settled = was === undefined ? false : was.id === now.id ? was.state === 'building' : true
    if (settled) out.push({ project: p.name, to: now.state, target: now.target, error: now.error })
  }
  return out
}

/** Hours, minutes or seconds since `at`, in the shortest form. */
export function ago(at: number | undefined, now: number): string {
  if (at === undefined) return ''
  const s = Math.max(0, Math.round((now - at) / 1000))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.round(s / 60)}m`
  if (s < 86_400) return `${Math.round(s / 3600)}h`
  return `${Math.round(s / 86_400)}d`
}

export const GLYPH: Record<DeployState, string> = {
  ready: '●',
  building: '◐',
  failed: '✕',
  canceled: '○',
  blocked: '◌',
  unknown: '·',
}

export const COLOR: Record<DeployState, string | undefined> = {
  ready: 'green',
  building: 'yellow',
  failed: 'red',
  canceled: undefined,
  blocked: 'yellow',
  unknown: undefined,
}

export function fit(text: string, width: number): string {
  return text.length <= width ? text : `${text.slice(0, Math.max(0, width - 1))}…`
}

export function clampInt(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback
  return Math.min(max, Math.max(min, n))
}

function headers(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}`, accept: 'application/json' }
}

const withTeam = (q: URLSearchParams, team: string) => {
  if (team) q.set(team.startsWith('team_') ? 'teamId' : 'slug', team)
  return q
}

export async function listProjects(f: Fetch, token: string, team: string, limit: number): Promise<Project[]> {
  const q = withTeam(new URLSearchParams({ limit: String(limit) }), team)
  const res = await f(`${API}/v10/projects?${q}`, { headers: headers(token) })
  if (!res.ok) throw new Error(describeFailure(res.status, res.text))
  return parseProjects(res.text)
}

export async function listDeploys(f: Fetch, token: string, team: string, projectId: string, limit: number): Promise<Deploy[]> {
  const q = withTeam(new URLSearchParams({ projectId, limit: String(limit) }), team)
  const res = await f(`${API}/v7/deployments?${q}`, { headers: headers(token) })
  if (!res.ok) throw new Error(describeFailure(res.status, res.text))
  return parseDeploys(res.text)
}

export function describeFailure(status: number, text: string): string {
  if (status === 401 || status === 403) return `Vercel refused the token (${status}); check vercelToken and teamId`
  let detail = ''
  try {
    detail = str(obj(obj(JSON.parse(text))?.error)?.message) ?? ''
  } catch {
    detail = ''
  }
  return `Vercel answered ${status}${detail ? `: ${detail}` : ''}`
}

/** A site "answers" when the request completes with a status below 500 that is not a gateway failure. */
export const answers = (status: number) => status > 0 && status < 500
