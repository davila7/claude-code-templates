/**
 * linear-api.ts — the Linear GraphQL reads the mod makes, and the arithmetic
 * behind its charts. No `$` in here.
 *
 * Reference: https://linear.app/developers (POST https://api.linear.app/graphql).
 * A personal API key goes in `Authorization` as it is; an OAuth token
 * (`lin_oauth_...`) goes as `Bearer <token>`. Fields used, checked against
 * linear/linear's schema.graphql:
 *   issues(filter, first, orderBy)   Issue { identifier title url priority priorityLabel estimate
 *                                    updatedAt startedAt completedAt dueDate
 *                                    state { name type color } cycle { id number name startsAt endsAt }
 *                                    project { name } assignee { name } }
 *   cycle(id)                        Cycle { number name progress startsAt endsAt
 *                                    scopeHistory completedScopeHistory issueCountHistory completedIssueCountHistory }
 * Workflow state `type` is one of triage, backlog, unstarted, started, completed, canceled.
 * The key is only sent to api.linear.app and never logged.
 */

export const ENDPOINT = 'https://api.linear.app/graphql'

export type Fetch = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ status: number; ok: boolean; text: string }>

export type Bucket = 'started' | 'todo' | 'backlog' | 'done'

export type Ticket = {
  id: string
  identifier: string
  title: string
  url: string
  stateName: string
  stateType: string
  bucket: Bucket | 'canceled'
  priority: number
  priorityLabel?: string
  estimate?: number
  updatedAt?: number
  startedAt?: number
  completedAt?: number
  dueDate?: string
  project?: string
  cycle?: { id: string; number: number; name?: string; startsAt: number; endsAt: number }
}

export type Cycle = {
  number: number
  name?: string
  progress: number
  startsAt: number
  endsAt: number
  scope: number[]
  completed: number[]
}

const obj = (v: unknown): Record<string, unknown> | undefined =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined
const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined)
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
const time = (v: unknown): number | undefined => {
  const s = str(v)
  const t = s ? Date.parse(s) : NaN
  return Number.isNaN(t) ? undefined : t
}
const numbers = (v: unknown): number[] => (Array.isArray(v) ? v.filter((n): n is number => typeof n === 'number') : [])

export function bucketOf(type: string): Ticket['bucket'] {
  switch (type) {
    case 'started':
      return 'started'
    case 'unstarted':
      return 'todo'
    case 'completed':
      return 'done'
    case 'canceled':
      return 'canceled'
    default:
      return 'backlog'
  }
}

export const ISSUES_QUERY = `query Tickets($filter: IssueFilter, $first: Int) {
  issues(filter: $filter, first: $first, orderBy: updatedAt) {
    nodes {
      id identifier title url priority priorityLabel estimate
      updatedAt startedAt completedAt dueDate
      state { name type }
      project { name }
      cycle { id number name startsAt endsAt }
    }
  }
}`

export const CYCLE_QUERY = `query Cycle($id: String!) {
  cycle(id: $id) {
    number name progress startsAt endsAt
    scopeHistory completedScopeHistory
  }
}`

export type Scope = { assignee: 'me' | 'anyone'; teamKey: string; project: string }

/** Open tickets plus those closed since `sinceIso`, narrowed by the scope. */
export function buildFilter(scope: Scope, sinceIso: string): Record<string, unknown> {
  const and: Record<string, unknown>[] = []
  if (scope.assignee === 'me') and.push({ assignee: { isMe: { eq: true } } })
  if (scope.teamKey) and.push({ team: { key: { eq: scope.teamKey } } })
  if (scope.project) and.push({ project: { name: { containsIgnoreCase: scope.project } } })
  and.push({
    or: [{ state: { type: { nin: ['completed', 'canceled'] } } }, { completedAt: { gte: sinceIso } }],
  })
  return { and }
}

export function parseTicket(raw: unknown): Ticket | undefined {
  const n = obj(raw)
  const id = str(n?.id)
  const identifier = str(n?.identifier)
  if (!n || !id || !identifier) return undefined
  const state = obj(n.state)
  const stateType = str(state?.type) ?? 'backlog'
  const cycle = obj(n.cycle)
  const cycleId = str(cycle?.id)
  const startsAt = time(cycle?.startsAt)
  const endsAt = time(cycle?.endsAt)
  return {
    id,
    identifier,
    title: str(n.title) ?? '(no title)',
    url: str(n.url) ?? '',
    stateName: str(state?.name) ?? stateType,
    stateType,
    bucket: bucketOf(stateType),
    priority: num(n.priority) ?? 0,
    priorityLabel: str(n.priorityLabel),
    estimate: num(n.estimate),
    updatedAt: time(n.updatedAt),
    startedAt: time(n.startedAt),
    completedAt: time(n.completedAt),
    dueDate: str(n.dueDate),
    project: str(obj(n.project)?.name),
    cycle:
      cycleId && startsAt !== undefined && endsAt !== undefined
        ? { id: cycleId, number: num(cycle?.number) ?? 0, name: str(cycle?.name), startsAt, endsAt }
        : undefined,
  }
}

/** GraphQL answers 200 with `errors` for a bad query or key; surface the first message. */
export function graphqlData(text: string): Record<string, unknown> {
  const body = obj(JSON.parse(text))
  const errors = body?.errors
  if (Array.isArray(errors) && errors.length > 0) {
    throw new Error(`Linear: ${str(obj(errors[0])?.message) ?? 'the query was refused'}`)
  }
  const data = obj(body?.data)
  if (!data) throw new Error('Linear answered without data')
  return data
}

export function parseTickets(text: string): Ticket[] {
  const nodes = obj(graphqlData(text).issues)?.nodes
  return (Array.isArray(nodes) ? nodes : []).map(parseTicket).filter((t): t is Ticket => t !== undefined && t.bucket !== 'canceled')
}

export function parseCycle(text: string): Cycle | undefined {
  const c = obj(graphqlData(text).cycle)
  const startsAt = time(c?.startsAt)
  const endsAt = time(c?.endsAt)
  if (!c || startsAt === undefined || endsAt === undefined) return undefined
  return {
    number: num(c.number) ?? 0,
    name: str(c.name),
    progress: num(c.progress) ?? 0,
    startsAt,
    endsAt,
    scope: numbers(c.scopeHistory),
    completed: numbers(c.completedScopeHistory),
  }
}

async function post(f: Fetch, key: string, query: string, variables: Record<string, unknown>): Promise<string> {
  const res = await f(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: key.startsWith('lin_oauth_') ? `Bearer ${key}` : key,
    },
    body: JSON.stringify({ query, variables }),
  })
  if (res.status === 401 || res.status === 403) throw new Error(`Linear refused the key (${res.status}); check linearApiKey`)
  if (!res.ok && res.status >= 500) throw new Error(`Linear answered ${res.status}`)
  return res.text
}

export async function listTickets(f: Fetch, key: string, scope: Scope, sinceIso: string): Promise<Ticket[]> {
  return parseTickets(await post(f, key, ISSUES_QUERY, { filter: buildFilter(scope, sinceIso), first: 100 }))
}

export async function getCycle(f: Fetch, key: string, id: string): Promise<Cycle | undefined> {
  return parseCycle(await post(f, key, CYCLE_QUERY, { id }))
}

/** The cycle running at `now` among the tickets', the one most of them sit in. */
export function currentCycleId(tickets: readonly Ticket[], now: number): string | undefined {
  const counts = new Map<string, number>()
  for (const t of tickets) {
    if (t.cycle && t.cycle.startsAt <= now && now <= t.cycle.endsAt) counts.set(t.cycle.id, (counts.get(t.cycle.id) ?? 0) + 1)
  }
  let best: string | undefined
  let n = 0
  for (const [id, c] of counts) if (c > n) [best, n] = [id, c]
  return best
}

const DAY = 86_400_000

/**
 * Local day number of a time: whole days since the epoch in the viewer's timezone.
 * Without `tzOffsetMin` each time uses the offset in force at that moment, so a
 * daylight-saving change inside the window does not shift older days.
 */
export type TzOffset = number | ((ms: number) => number)
const localOffset = (ms: number) => new Date(ms).getTimezoneOffset()
export const dayOf = (ms: number, tz: TzOffset = localOffset) =>
  Math.floor((ms - (typeof tz === 'function' ? tz(ms) : tz) * 60_000) / DAY)

/** Tickets closed on each of the last `days` days, oldest first, today last. */
export function doneByDay(tickets: readonly Ticket[], now: number, days: number, tz?: TzOffset): number[] {
  const today = dayOf(now, tz)
  const out = new Array<number>(days).fill(0)
  for (const t of tickets) {
    if (t.bucket !== 'done' || t.completedAt === undefined) continue
    const ago = today - dayOf(t.completedAt, tz)
    if (ago >= 0 && ago < days) out[days - 1 - ago] += 1
  }
  return out
}

export type Counts = Record<Bucket, number>

export function count(tickets: readonly Ticket[]): Counts {
  const c: Counts = { started: 0, todo: 0, backlog: 0, done: 0 }
  for (const t of tickets) if (t.bucket !== 'canceled') c[t.bucket] += 1
  return c
}

export const summaryText = (c: Counts, days: number) =>
  `linear: ${c.started} in progress · ${c.todo} todo · ${c.done} done (${days}d)`

const BLOCKS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']

/** One row of block characters, scaled to the largest value (a zero stays blank). */
export function spark(values: readonly number[]): string {
  const max = Math.max(0, ...values)
  return values.map(v => (v <= 0 || max === 0 ? ' ' : BLOCKS[Math.min(7, Math.ceil((v / max) * 8) - 1)])).join('')
}

/**
 * A vertical bar chart `height` rows tall, one column per value, top row first;
 * each column is as tall as its value is large next to the biggest one.
 */
export function barChart(values: readonly number[], height: number): string[] {
  const max = Math.max(0, ...values)
  const rows: string[] = []
  for (let r = height - 1; r >= 0; r--) {
    rows.push(
      values
        .map(v => {
          if (max === 0 || v <= 0) return r === 0 ? '▁' : ' '
          const eighths = Math.round((v / max) * height * 8)
          const below = r * 8
          if (eighths >= below + 8) return '█'
          if (eighths <= below) return ' '
          return BLOCKS[eighths - below - 1]
        })
        .join(''),
    )
  }
  return rows
}

/** A horizontal bar of `width` cells split in proportion to `parts`, each as its own run of one glyph. */
export function stacked(parts: readonly { n: number; glyph: string }[], width: number): { glyph: string; cells: number }[] {
  const total = parts.reduce((s, p) => s + p.n, 0)
  if (total === 0) return []
  const out = parts.map(p => ({ glyph: p.glyph, cells: Math.floor((p.n / total) * width), n: p.n }))
  let used = out.reduce((s, p) => s + p.cells, 0)
  // a state with tickets is never invisible; leftover cells go to the largest
  for (const p of out) if (p.n > 0 && p.cells === 0 && used < width) (p.cells = 1), (used += 1)
  const largest = out.reduce((a, b) => (b.n > a.n ? b : a), out[0]!)
  largest.cells += width - used
  return out.filter(p => p.cells > 0).map(({ glyph, cells }) => ({ glyph, cells }))
}

/** Fraction of the cycle that has elapsed at `now`, 0 to 1. */
export function cycleElapsed(c: Pick<Cycle, 'startsAt' | 'endsAt'>, now: number): number {
  const span = c.endsAt - c.startsAt
  return span <= 0 ? 1 : Math.min(1, Math.max(0, (now - c.startsAt) / span))
}

export function fit(text: string, width: number): string {
  return text.length <= width ? text : `${text.slice(0, Math.max(0, width - 1))}…`
}

export function clampInt(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback
  return Math.min(max, Math.max(min, n))
}

export const BUCKET_LABEL: Record<Bucket, string> = {
  started: 'In progress',
  todo: 'Todo',
  backlog: 'Backlog',
  done: 'Done',
}

export const BUCKET_GLYPH: Record<Bucket, string> = { started: '◐', todo: '○', backlog: '·', done: '●' }
export const BUCKET_COLOR: Record<Bucket, string | undefined> = {
  started: 'yellow',
  todo: 'blue',
  backlog: undefined,
  done: 'green',
}

/** Urgent first, then high, medium, low; no priority last (Linear's 0 means none). */
export const priorityRank = (p: number) => (p === 0 ? 5 : p)

export function sortTickets(tickets: readonly Ticket[]): Ticket[] {
  return [...tickets].sort((a, b) => {
    if (a.bucket === 'done' && b.bucket === 'done') return (b.completedAt ?? 0) - (a.completedAt ?? 0)
    const r = priorityRank(a.priority) - priorityRank(b.priority)
    return r !== 0 ? r : (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
  })
}
