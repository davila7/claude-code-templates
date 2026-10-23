// Run with: claude plugin test integrations/bluesky-feed
import { describe, expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'
import { ago, compact, facetsOf, graphemes, handleOf, parseTimeline, postUrl, rkeyOf, serviceUrl } from '../hooks/bsky-api.ts'

const HANDLE = 'dan.test'
const PASSWORD = 'abcd-efgh-ijkl-mnop'
const DID = 'did:plc:dan'
const OPTIONS = { handle: `@${HANDLE}`, appPassword: PASSWORD }

const post = (n: number, over: Record<string, unknown> = {}) => ({
  uri: `at://did:plc:a${n}/app.bsky.feed.post/3k${n}`,
  cid: `cid${n}`,
  author: { did: `did:plc:a${n}`, handle: `ana${n}.bsky.social`, displayName: `Ana ${n}` },
  record: { $type: 'app.bsky.feed.post', text: `hello ${n}`, createdAt: new Date(Date.now() - n * 60_000).toISOString() },
  likeCount: 10 + n,
  repostCount: n,
  replyCount: 1,
  indexedAt: new Date().toISOString(),
  viewer: {},
  ...over,
})

const FEED = {
  feed: [
    { post: post(1) },
    { post: post(2, { embed: { $type: 'app.bsky.embed.images#view', images: [{}, {}] } }), reason: { $type: 'app.bsky.feed.defs#reasonRepost', by: { handle: 'bob.bsky.social', displayName: 'Bob' } } },
    { post: post(3, { viewer: { like: `at://${DID}/app.bsky.feed.like/3likeA` } }), reply: { parent: { author: { handle: 'carol.bsky.social' } } } },
    { post: { uri: 'broken' } },
  ],
  cursor: 'c1',
}

describe('the api', () => {
  test('the timeline: reposts, replies, embeds, the viewer like; malformed dropped', () => {
    const { posts, cursor } = parseTimeline(JSON.stringify(FEED))
    expect(posts.map(p => p.handle)).toEqual(['ana1.bsky.social', 'ana2.bsky.social', 'ana3.bsky.social'])
    expect(posts[1]!.repostBy).toBe('Bob')
    expect(posts[1]!.embed).toBe('▣ 2 images')
    expect(posts[2]!.replyTo).toBe('carol.bsky.social')
    expect(posts[2]!.likeUri).toContain('app.bsky.feed.like')
    expect(posts[0]!.likeUri).toBeUndefined()
    expect(cursor).toBe('c1')
  })

  test('facets: links and tags at UTF-8 byte offsets', () => {
    const text = 'café 🦋 https://aitmpl.com/mods, #ClaudeCode!'
    const facets = facetsOf(text)
    const bytes = new TextEncoder().encode(text)
    const slice = (f: (typeof facets)[number]) => new TextDecoder().decode(bytes.slice(f.index.byteStart, f.index.byteEnd))
    expect(facets.map(slice)).toEqual(['https://aitmpl.com/mods', '#ClaudeCode'])
    expect(facets[0]!.features[0]).toEqual({ $type: 'app.bsky.richtext.facet#link', uri: 'https://aitmpl.com/mods' })
    expect(facets[1]!.features[0]).toEqual({ $type: 'app.bsky.richtext.facet#tag', tag: 'ClaudeCode' })
    expect(facetsOf('no links here')).toEqual([])
    expect(facetsOf('top #1 pick')).toEqual([])
  })

  test('small helpers', () => {
    expect(graphemes('🦋ab')).toBe(3)
    expect(compact(999)).toBe('999')
    expect(compact(1234)).toBe('1.2K')
    expect(compact(2_000_000)).toBe('2M')
    expect(ago(new Date(Date.now() - 5 * 60_000).toISOString(), Date.now())).toBe('5m')
    expect(ago('nope', Date.now())).toBe('')
    expect(serviceUrl('')).toBe('https://bsky.social')
    expect(serviceUrl('pds.example.com/')).toBe('https://pds.example.com')
    expect(serviceUrl('http://pds.example.com')).toBe('https://bsky.social')
    expect(serviceUrl('http://127.0.0.1:2583')).toBe('http://127.0.0.1:2583')
    expect(handleOf(' @dan.test ')).toBe('dan.test')
    expect(rkeyOf('at://did:plc:a/app.bsky.feed.post/3k1')).toBe('3k1')
    expect(postUrl({ uri: 'at://did:plc:a/app.bsky.feed.post/3k1', handle: 'ana.bsky.social' })).toBe('https://bsky.app/profile/ana.bsky.social/post/3k1')
  })
})

type Call = { nsid: string; method: string; auth?: string; params: string; body?: Record<string, any> }
type World = { calls: Call[]; toasts: string[]; loginStatus: number; expireOnce: boolean; feed: unknown; created: number }
const world = (): World => ({ calls: [], toasts: [], loginStatus: 200, expireOnce: false, feed: FEED, created: 0 })

function fakeEngine(on: On, w: World) {
  on('session.start', async ($, e) => ({ cwd: e.cwd }) as never)
  on('session.end', async () => ({ sessionId: 's1' }) as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('clock.every', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: undefined }) as never)
  on('ui.close', () => ({ value: undefined }) as never)
  on('ui.invalidate', () => ({ value: undefined }) as never)
  on('ui.log', () => ({ value: undefined }))
  on('ui.toast', ($, e) => {
    w.toasts.push(e.text)
    return { value: undefined }
  })
  on('http.fetch', async ($, e) => {
    const init = e.init ?? {}
    const [path, params = ''] = e.url.split('?')
    const nsid = path!.split('/xrpc/')[1] ?? ''
    const body = init.body ? JSON.parse(init.body) : undefined
    w.calls.push({ nsid, method: init.method ?? 'GET', auth: init.headers?.authorization, params, body })
    const reply = (status: number, data: unknown) => ({ value: { status, ok: status < 300, headers: {}, text: JSON.stringify(data) } })
    if (!e.url.startsWith('https://bsky.social/xrpc/')) return reply(404, {})
    if (nsid === 'com.atproto.server.createSession') {
      if (w.loginStatus !== 200) return reply(w.loginStatus, { error: 'AuthenticationRequired', message: 'Invalid identifier or password' })
      return reply(200, { did: DID, handle: HANDLE, accessJwt: 'access-1', refreshJwt: 'refresh-1' })
    }
    if (nsid === 'com.atproto.server.refreshSession') return reply(200, { did: DID, handle: HANDLE, accessJwt: 'access-2', refreshJwt: 'refresh-2' })
    if (w.expireOnce && init.headers?.authorization === 'Bearer access-1') {
      w.expireOnce = false
      return reply(400, { error: 'ExpiredToken', message: 'Token has expired' })
    }
    if (nsid === 'app.bsky.feed.getTimeline') return reply(200, w.feed)
    if (nsid === 'com.atproto.repo.createRecord') {
      w.created++
      return reply(200, { uri: `at://${DID}/${body.collection}/3new${w.created}`, cid: `newcid${w.created}` })
    }
    if (nsid === 'com.atproto.repo.deleteRecord') return reply(200, {})
    return reply(404, { error: 'MethodNotImplemented' })
  })
}

const run = async ($: Engine, args = '') => (await $.command.run({ command: 'bsky', args, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 200 } } as never)) as { text?: string }
const PANE_PROPS = { title: 'bluesky', isFocused: true, bodyColumns: 60, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 40 }, view: {} }
const mount = ($: Engine, surface: 'terminal' | 'desktop' | 'mobile' = 'terminal') =>
  $.ui.mount({ plugin: 'bluesky-feed', surface, component: 'Pane', requestId: 'bsky', props: PANE_PROPS })
const start = ($: Engine) => $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true } as never)

describe('the pane', () => {
  test('/bsky logs in with the app password, reads the timeline with the token and draws it', { options: OPTIONS }, async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await start($)
    expect((await run($)).text).toContain('3 posts')

    expect(w.calls[0]!.nsid).toBe('com.atproto.server.createSession')
    expect(w.calls[0]!.body).toEqual({ identifier: HANDLE, password: PASSWORD })
    const read = w.calls[1]!
    expect(read.nsid).toBe('app.bsky.feed.getTimeline')
    expect(read.auth).toBe('Bearer access-1')
    expect(read.params).toContain('limit=30')

    const ui = await mount($)
    expect(await ui.find({ type: 'Text', text: /BLUESKY/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Ana 1/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /reposted\sby\sBob/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /replying\sto\s@carol/ })).toBeDefined()
    expect((await ui.find({ key: 'like:cid1' }))?.text).toContain('11')
    expect(await ui.find({ key: 'compose:0' })).toBeDefined()
    await ui.unmount()
  })

  test('like and unlike write and delete the like record', { options: OPTIONS }, async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await start($)
    await run($)
    const ui = await mount($)

    await ui.press({ key: 'like:cid1' })
    const like = w.calls.find(c => c.nsid === 'com.atproto.repo.createRecord')!
    expect(like.body).toEqual(expect.objectContaining({ repo: DID, collection: 'app.bsky.feed.like' }))
    expect(like.body!.record.subject).toEqual({ uri: 'at://did:plc:a1/app.bsky.feed.post/3k1', cid: 'cid1' })
    await ui.redraw()
    expect((await ui.find({ key: 'like:cid1' }))?.text).toContain('12')

    await ui.press({ key: 'like:cid3' })
    const unlike = w.calls.find(c => c.nsid === 'com.atproto.repo.deleteRecord')!
    expect(unlike.body).toEqual({ repo: DID, collection: 'app.bsky.feed.like', rkey: '3likeA' })
    await ui.redraw()
    expect((await ui.find({ key: 'like:cid3' }))?.text).toContain('12')
    await ui.unmount()
  })

  test('Enter in the field posts with facets, clears the field and reads again', { options: OPTIONS }, async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await start($)
    await run($)
    const ui = await mount($)
    await ui.input({ key: 'compose:0', text: 'shipping a mod https://aitmpl.com #ClaudeCode', kind: 'submit' })
    const created = w.calls.find(c => c.nsid === 'com.atproto.repo.createRecord')!
    expect(created.body!.collection).toBe('app.bsky.feed.post')
    expect(created.body!.record.text).toBe('shipping a mod https://aitmpl.com #ClaudeCode')
    expect(created.body!.record.facets.length).toBe(2)
    expect(w.toasts.some(t => t.includes('posted'))).toBe(true)
    expect(w.calls.filter(c => c.nsid === 'app.bsky.feed.getTimeline').length).toBe(2)
    await ui.redraw()
    expect(await ui.find({ key: 'compose:1' })).toBeDefined()
    await ui.unmount()
  })

  test('an expired token is refreshed once and the call retried', { options: OPTIONS }, async ($, on) => {
    const w = world()
    w.expireOnce = true
    fakeEngine(on, w)
    await start($)
    expect((await run($)).text).toContain('3 posts')
    expect(w.calls.map(c => c.nsid)).toEqual([
      'com.atproto.server.createSession',
      'app.bsky.feed.getTimeline',
      'com.atproto.server.refreshSession',
      'app.bsky.feed.getTimeline',
    ])
    expect(w.calls[3]!.auth).toBe('Bearer access-2')
  })

  test('a refused app password is reported, never echoed', { options: OPTIONS }, async ($, on) => {
    const w = world()
    w.loginStatus = 401
    fakeEngine(on, w)
    await start($)
    const out = await run($)
    expect(out.text).toContain('refused the handle or app password')
    expect(out.text).not.toContain(PASSWORD)
  })

  test('without a handle and app password nothing is called', async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await start($)
    expect((await run($)).text).toContain('appPassword')
    expect(w.calls).toEqual([])
  })

  test('desktop draws the field; mobile reads only', { options: OPTIONS }, async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await start($)
    await run($)
    const desk = await mount($, 'desktop')
    expect(await desk.find({ key: 'compose:0' })).toBeDefined()
    expect(await desk.find({ key: 'like:cid2' })).toBeDefined()
    await desk.unmount()
    const phone = await mount($, 'mobile')
    expect(await phone.find({ key: 'compose:0' })).toBeUndefined()
    expect(await phone.find({ type: 'Text', text: /Ana 2/ })).toBeDefined()
    await phone.unmount()
  })
})
