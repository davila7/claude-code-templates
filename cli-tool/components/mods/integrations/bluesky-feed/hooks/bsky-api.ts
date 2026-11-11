/**
 * Bluesky's XRPC API, the parts bluesky-feed uses. Pure functions and one
 * small client over an injected fetch, so the tests drive it without a
 * network and the hooks module passes `$.http.fetch`.
 *
 * Shapes checked against the lexicons shipped in @atproto/api 0.28:
 * com.atproto.server.createSession / refreshSession, app.bsky.feed.getTimeline
 * (FeedViewPost, PostView, ViewerState, ReasonRepost), app.bsky.feed.post,
 * app.bsky.feed.like, app.bsky.richtext.facet, com.atproto.repo.createRecord /
 * deleteRecord.
 */

export type Fetch = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ status: number; ok: boolean; text: string }>

export type Session = { did: string; handle: string; accessJwt: string; refreshJwt: string }

export type Post = {
  uri: string
  cid: string
  handle: string
  name: string
  text: string
  createdAt: string
  likeCount: number
  repostCount: number
  replyCount: number
  /** The viewer's like record, when they liked it: what an unlike deletes. */
  likeUri?: string
  /** Who reposted it into the timeline. */
  repostBy?: string
  /** The handle of the post this one answers. */
  replyTo?: string
  /** One line describing images, a video, a link card or a quoted post. */
  embed?: string
}

export const MAX_GRAPHEMES = 300

export class BskyError extends Error {
  readonly status: number
  readonly code: string | undefined

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {})
const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

export const clampInt = (v: unknown, fallback: number, min: number, max: number): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback
  return Math.min(max, Math.max(min, n))
}

/**
 * `https://bsky.social` from whatever the option holds; never a trailing slash.
 * https only, so the app password never travels in cleartext; plain http is
 * kept for a PDS on this machine (localhost, 127.0.0.1), as in development.
 */
export const serviceUrl = (v: unknown): string => {
  const s = str(v).trim().replace(/\/+$/, '')
  if (!s) return 'https://bsky.social'
  if (/^https:\/\//.test(s)) return s
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(s)) return s
  if (/^[a-z]+:\/\//i.test(s)) return 'https://bsky.social'
  return `https://${s}`
}

/** `@dan.bsky.social` and `dan.bsky.social` are the same identifier. */
export const handleOf = (v: unknown): string => str(v).trim().replace(/^@/, '')

export const rkeyOf = (uri: string): string => uri.split('/').pop() ?? ''

export const postUrl = (p: Pick<Post, 'uri' | 'handle'>): string =>
  `https://bsky.app/profile/${p.handle}/post/${rkeyOf(p.uri)}`

export function graphemes(text: string): number {
  const Seg = (Intl as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment: (s: string) => Iterable<unknown> } }).Segmenter
  if (Seg) {
    let n = 0
    for (const _ of new Seg(undefined, { granularity: 'grapheme' }).segment(text)) n++
    return n
  }
  return [...text].length
}

type Facet = { index: { byteStart: number; byteEnd: number }; features: Json[] }

/**
 * Links and hashtags as richtext facets, so they are clickable on bsky.app.
 * Offsets are UTF-8 byte offsets. Mentions are left plain: they need the
 * handle resolved to a DID, one more request per name.
 */
export function facetsOf(text: string): Facet[] {
  const enc = new TextEncoder()
  const bytes = (s: string) => enc.encode(s).length
  const out: Facet[] = []
  for (const m of text.matchAll(/https?:\/\/[^\s<>"]+/g)) {
    const uri = m[0].replace(/[.,;:!?)\]}'"]+$/, '')
    const start = bytes(text.slice(0, m.index))
    out.push({ index: { byteStart: start, byteEnd: start + bytes(uri) }, features: [{ $type: 'app.bsky.richtext.facet#link', uri }] })
  }
  for (const m of text.matchAll(/(^|\s)#([^\s#.,;:!?)\]}'"]+)/g)) {
    // Bluesky does not treat a tag of digits alone (#1) as a hashtag
    if (/^\d+$/.test(m[2]!)) continue
    const at = (m.index ?? 0) + m[1]!.length
    const start = bytes(text.slice(0, at))
    out.push({ index: { byteStart: start, byteEnd: start + bytes(`#${m[2]}`) }, features: [{ $type: 'app.bsky.richtext.facet#tag', tag: m[2] }] })
  }
  return out.sort((a, b) => a.index.byteStart - b.index.byteStart)
}

function describeEmbed(v: unknown): string | undefined {
  const e = obj(v)
  const type = str(e.$type)
  if (type.startsWith('app.bsky.embed.images')) {
    const n = Array.isArray(e.images) ? e.images.length : 1
    return n === 1 ? '▣ image' : `▣ ${n} images`
  }
  if (type.startsWith('app.bsky.embed.video')) return '▶ video'
  if (type.startsWith('app.bsky.embed.external')) {
    const x = obj(e.external)
    return `🔗 ${str(x.title) || str(x.uri)}`
  }
  if (type.startsWith('app.bsky.embed.recordWithMedia')) {
    return [describeEmbed(e.media), describeEmbed(e.record)].filter(Boolean).join(' · ')
  }
  if (type.startsWith('app.bsky.embed.record')) {
    const r = obj(obj(e.record).record ?? e.record)
    const author = str(obj(r.author).handle)
    return author ? `❝ quoting @${author}` : '❝ quote'
  }
  return undefined
}

/** The timeline's FeedViewPosts as Posts; anything malformed is dropped. */
export function parseTimeline(text: string): { posts: Post[]; cursor?: string } {
  const body = obj(JSON.parse(text))
  const feed = Array.isArray(body.feed) ? body.feed : []
  const posts: Post[] = []
  for (const item of feed) {
    const it = obj(item)
    const p = obj(it.post)
    const author = obj(p.author)
    const record = obj(p.record)
    if (!str(p.uri) || !str(p.cid) || !str(author.handle)) continue
    const reason = obj(it.reason)
    const parent = obj(obj(it.reply).parent)
    posts.push({
      uri: str(p.uri),
      cid: str(p.cid),
      handle: str(author.handle),
      name: str(author.displayName).trim(),
      text: str(record.text),
      createdAt: str(record.createdAt) || str(p.indexedAt),
      likeCount: num(p.likeCount),
      repostCount: num(p.repostCount),
      replyCount: num(p.replyCount),
      likeUri: str(obj(p.viewer).like) || undefined,
      repostBy: str(reason.$type).endsWith('#reasonRepost') ? str(obj(reason.by).displayName).trim() || str(obj(reason.by).handle) : undefined,
      replyTo: str(obj(parent.author).handle) || undefined,
      embed: describeEmbed(p.embed),
    })
  }
  const cursor = str(body.cursor) || undefined
  return { posts, cursor }
}

/** `now`, `5m`, `3h`, `2d`, then the date. */
export function ago(iso: string, now: number): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const s = Math.max(0, Math.round((now - t) / 1000))
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86_400) return `${Math.floor(s / 3600)}h`
  if (s < 7 * 86_400) return `${Math.floor(s / 86_400)}d`
  return new Date(t).toISOString().slice(0, 10)
}

/** 1234 -> 1.2K; the pane is narrow. */
export const compact = (n: number): string =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M` : n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K` : String(n)

/**
 * One account's session over XRPC. Logs in on first use with the app
 * password, refreshes an expired access token with the refresh token, and
 * logs in again when the refresh is refused. The password and the tokens stay
 * in memory, are sent only to `service`, and never appear in an error.
 */
export class Client {
  session: Session | undefined
  private pendingLogin: Promise<Session> | undefined
  private readonly fetch: Fetch
  private readonly service: string
  private readonly identifier: string
  private readonly password: string

  constructor(fetch: Fetch, service: string, identifier: string, password: string) {
    this.fetch = fetch
    this.service = service
    this.identifier = identifier
    this.password = password
  }

  private async xrpc(nsid: string, opts: { method?: 'GET' | 'POST'; token?: string; body?: unknown; params?: Record<string, string> }): Promise<Json> {
    const qs = opts.params ? `?${new URLSearchParams(opts.params).toString()}` : ''
    const headers: Record<string, string> = {}
    if (opts.token) headers.authorization = `Bearer ${opts.token}`
    if (opts.body !== undefined) headers['content-type'] = 'application/json'
    const res = await this.fetch(`${this.service}/xrpc/${nsid}${qs}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    })
    let data: Json = {}
    try {
      data = obj(res.text ? JSON.parse(res.text) : {})
    } catch {
      data = {}
    }
    if (!res.ok) throw new BskyError(str(data.message) || str(data.error) || `HTTP ${res.status}`, res.status, str(data.error) || undefined)
    return data
  }

  private take(d: Json): Session {
    const s = { did: str(d.did), handle: str(d.handle), accessJwt: str(d.accessJwt), refreshJwt: str(d.refreshJwt) }
    if (!s.did || !s.accessJwt) throw new BskyError('Bluesky answered the login without a session', 500)
    this.session = s
    return s
  }

  /** One login at a time: a poll, a press and a post racing share it. */
  login(): Promise<Session> {
    this.pendingLogin ??= this.createSession().finally(() => {
      this.pendingLogin = undefined
    })
    return this.pendingLogin
  }

  private async createSession(): Promise<Session> {
    try {
      return this.take(await this.xrpc('com.atproto.server.createSession', { method: 'POST', body: { identifier: this.identifier, password: this.password } }))
    } catch (err) {
      if (err instanceof BskyError && (err.status === 401 || err.code === 'AuthenticationRequired'))
        throw new BskyError('Bluesky refused the handle or app password', 401, err.code)
      throw err
    }
  }

  private async refresh(): Promise<Session> {
    const s = this.session
    if (!s) return this.login()
    try {
      return this.take(await this.xrpc('com.atproto.server.refreshSession', { method: 'POST', token: s.refreshJwt }))
    } catch (err) {
      // a refused refresh token means log in again; an outage is reported as is
      if (err instanceof BskyError && (err.status === 400 || err.status === 401)) return this.login()
      throw err
    }
  }

  /** A call with the access token, refreshed once if Bluesky says it expired. */
  async call(nsid: string, opts: { method?: 'GET' | 'POST'; body?: unknown; params?: Record<string, string> } = {}): Promise<Json> {
    const s = this.session ?? (await this.login())
    try {
      return await this.xrpc(nsid, { ...opts, token: s.accessJwt })
    } catch (err) {
      const expired = err instanceof BskyError && (err.code === 'ExpiredToken' || err.code === 'InvalidToken' || err.status === 401)
      if (!expired) throw err
      const fresh = await this.refresh()
      return this.xrpc(nsid, { ...opts, token: fresh.accessJwt })
    }
  }

  async timeline(limit: number, cursor?: string): Promise<{ posts: Post[]; cursor?: string }> {
    const params: Record<string, string> = { limit: String(limit) }
    if (cursor) params.cursor = cursor
    return parseTimeline(JSON.stringify(await this.call('app.bsky.feed.getTimeline', { params })))
  }

  async post(text: string, now = new Date()): Promise<{ uri: string; cid: string }> {
    const s = this.session ?? (await this.login())
    const facets = facetsOf(text)
    const record: Json = { $type: 'app.bsky.feed.post', text, createdAt: now.toISOString() }
    if (facets.length > 0) record.facets = facets
    const d = await this.call('com.atproto.repo.createRecord', { method: 'POST', body: { repo: s.did, collection: 'app.bsky.feed.post', record } })
    return { uri: str(d.uri), cid: str(d.cid) }
  }

  async like(p: Pick<Post, 'uri' | 'cid'>, now = new Date()): Promise<string> {
    const s = this.session ?? (await this.login())
    const d = await this.call('com.atproto.repo.createRecord', {
      method: 'POST',
      body: { repo: s.did, collection: 'app.bsky.feed.like', record: { $type: 'app.bsky.feed.like', subject: { uri: p.uri, cid: p.cid }, createdAt: now.toISOString() } },
    })
    return str(d.uri)
  }

  async unlike(likeUri: string): Promise<void> {
    const s = this.session ?? (await this.login())
    await this.call('com.atproto.repo.deleteRecord', { method: 'POST', body: { repo: s.did, collection: 'app.bsky.feed.like', rkey: rkeyOf(likeUri) } })
  }
}
