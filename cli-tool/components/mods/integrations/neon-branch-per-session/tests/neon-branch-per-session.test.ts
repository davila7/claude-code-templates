// Run with: CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test integrations/neon-branch-per-session
import { describe, expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'
import { branchName, expiryIso, hoursLeft, uriHost } from '../hooks/neon-api.ts'

const KEY = 'napi_test_key'
const PROJECT = 'proj-test-1'
const URI = 'postgresql://owner:secret@ep-cool-1-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require'

describe('neon-api helpers', () => {
  test('branch name keeps the prefix and the first 8 safe characters of the session id', () => {
    expect(branchName('claude', '3f9a1c2e-7b40-4d11-9e0a-aaaaaaaaaaaa')).toBe('claude/3f9a1c2e')
    expect(branchName('', 'abc')).toBe('abc')
    expect(branchName('my team!', 'x/y z')).toBe('myteam/xyz')
    expect(branchName('claude', '')).toBe('claude/session')
  })

  test('expiry is held to one hour to thirty days, as RFC 3339 without milliseconds', () => {
    const now = Date.UTC(2026, 9, 1, 12, 0, 0)
    expect(expiryIso(now, 24)).toBe('2026-10-02T12:00:00Z')
    expect(expiryIso(now, 0)).toBe('2026-10-01T13:00:00Z')
    expect(expiryIso(now, 100_000)).toBe('2026-10-31T12:00:00Z')
    expect(expiryIso(now, Number.NaN)).toBe('2026-10-02T12:00:00Z')
  })

  test('hours left and the host of a connection string', () => {
    const now = Date.UTC(2026, 9, 1, 12, 0, 0)
    expect(hoursLeft('2026-10-02T12:00:00Z', now)).toBe(24)
    expect(hoursLeft('2026-10-01T11:00:00Z', now)).toBe(0)
    expect(hoursLeft(undefined, now)).toBeUndefined()
    expect(uriHost(URI)).toBe('ep-cool-1-pooler.us-east-2.aws.neon.tech')
    // the credentials never come back out of it
    expect(uriHost(URI)).not.toContain('secret')
  })
})

type Call = { method: string; url: string; auth?: string; body?: Record<string, unknown> }
type World = { calls: Call[]; env: Record<string, string | undefined>; store: Record<string, unknown>; toasts: string[]; exists: boolean; fail: number }

const world = (): World => ({ calls: [], env: {}, store: {}, toasts: [], exists: true, fail: 0 })

function fakeEngine(on: On, w: World) {
  on('session.id', () => ({ value: '3f9a1c2e-7b40-4d11-9e0a-aaaaaaaaaaaa' }))
  on('session.start', async ($, e) => ({ cwd: e.cwd }) as never)
  on('session.end', async () => ({ sessionId: 's1' }) as never)
  on('store.get', ($, e) => ({ value: w.store[e.key] }))
  on('store.set', ($, e) => {
    w.store[e.key] = e.value
    return { value: undefined }
  })
  on('env.set', ($, e) => {
    w.env[e.name] = e.value
    return { value: undefined }
  })
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.status', () => ({ value: undefined }))
  on('ui.log', () => ({ value: undefined }))
  on('ui.toast', ($, e) => {
    w.toasts.push(e.text)
    return { value: undefined }
  })
  on('http.fetch', async ($, e) => {
    const init = e.init ?? {}
    const method = init.method ?? 'GET'
    w.calls.push({ method, url: e.url, auth: init.headers?.authorization, body: init.body ? JSON.parse(init.body) : undefined })
    const reply = (status: number, body: unknown) => ({ value: { status, ok: status < 300, headers: {}, text: JSON.stringify(body) } })
    if (w.fail) return reply(w.fail, { message: 'project not found' })
    const path = e.url.replace('https://console.neon.tech/api/v2', '')
    if (method === 'POST' && path === `/projects/${PROJECT}/branches`) {
      return reply(201, { branch: { id: 'br-new-1', name: 'claude/3f9a1c2e', expires_at: '2026-10-02T12:00:00Z' } })
    }
    if (method === 'GET' && path === `/projects/${PROJECT}/branches/br-new-1`) {
      return w.exists ? reply(200, { branch: { id: 'br-new-1', name: 'claude/3f9a1c2e', expires_at: '2026-10-02T12:00:00Z' } }) : reply(404, { message: 'branch not found' })
    }
    if (method === 'GET' && path.startsWith(`/projects/${PROJECT}/connection_uri`)) return reply(200, { uri: URI })
    if (method === 'PATCH' || method === 'DELETE') return reply(200, {})
    return reply(500, { message: `unexpected ${method} ${path}` })
  })
}

const OPTIONS = { neonApiKey: KEY, projectId: PROJECT }
const start = async ($: Engine) => $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
const run = async ($: Engine, args: string) =>
  (await $.command.run({ command: 'neon', args } as never)) as { text?: string }

describe('the session branch', () => {
  test('start creates the branch with an expiry, hands DATABASE_URL on and never logs the key or the URI', { options: OPTIONS }, async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await start($)

    const create = w.calls.find(c => c.method === 'POST')!
    expect(create.auth).toBe(`Bearer ${KEY}`)
    expect(create.body).toEqual({
      branch: { name: 'claude/3f9a1c2e', expires_at: expect.any(String) },
      endpoints: [{ type: 'read_write' }],
    })
    const uriCall = w.calls.find(c => c.url.includes('/connection_uri'))!
    expect(uriCall.url).toContain('branch_id=br-new-1')
    expect(uriCall.url).toContain('database_name=neondb')
    expect(uriCall.url).toContain('role_name=neondb_owner')
    expect(uriCall.url).toContain('pooled=true')
    expect(w.env.DATABASE_URL).toBe(URI)
    expect(w.env.NEON_BRANCH).toBe('claude/3f9a1c2e')
    expect(w.toasts.join(' ')).toContain('claude/3f9a1c2e')
    expect(w.toasts.join(' ')).not.toContain('secret')
  })

  test('a branch from a parent, unpooled', { options: { ...OPTIONS, parentBranchId: 'br-main-9', pooled: false } }, async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await start($)
    expect((w.calls.find(c => c.method === 'POST')!.body!.branch as Record<string, unknown>).parent_id).toBe('br-main-9')
    expect(w.calls.find(c => c.url.includes('/connection_uri'))!.url).toContain('pooled=false')
  })

  test('without a key or a project nothing is called', { options: { neonApiKey: '', projectId: '' } }, async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await start($)
    expect(w.calls).toEqual([])
    expect(w.env.DATABASE_URL).toBeUndefined()
    expect((await run($, '')).text).toContain('neonApiKey and projectId')
  })

  test('a headless run creates nothing', { options: OPTIONS }, async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await $.session.start({ cwd: '/repo', surface: null, isInteractive: false } as never)
    expect(w.calls).toEqual([])
  })

  test('a Neon error leaves DATABASE_URL alone and says why', { options: OPTIONS }, async ($, on) => {
    const w = world()
    w.fail = 404
    fakeEngine(on, w)
    await start($)
    expect(w.env.DATABASE_URL).toBeUndefined()
    expect(w.toasts.join(' ')).toContain('answered 404')
    expect(w.toasts.join(' ')).not.toContain(KEY)
  })

  test('a resumed session reuses its branch', { options: OPTIONS }, async ($, on) => {
    const w = world()
    w.store['neon-branch-per-session:branches'] = { 'claude/3f9a1c2e': 'br-new-1' }
    fakeEngine(on, w)
    await start($)
    expect(w.calls.some(c => c.method === 'POST')).toBe(false)
    expect(w.toasts.join(' ')).toContain('reusing')
    expect(w.env.DATABASE_URL).toBe(URI)
  })

  test('a stored branch that is gone is made again', { options: OPTIONS }, async ($, on) => {
    const w = world()
    w.store['neon-branch-per-session:branches'] = { 'claude/3f9a1c2e': 'br-new-1' }
    w.exists = false
    fakeEngine(on, w)
    await start($)
    expect(w.calls.some(c => c.method === 'POST')).toBe(true)
  })
})

describe('/neon', () => {
  test('shows the branch without the credentials', { options: OPTIONS }, async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await start($)
    const text = (await run($, '')).text!
    expect(text).toContain('claude/3f9a1c2e')
    expect(text).toContain('ep-cool-1-pooler')
    expect(text).not.toContain('secret')
  })

  test('keep clears the expiry', { options: OPTIONS }, async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await start($)
    expect((await run($, 'keep')).text).toContain('no longer expire')
    const patch = w.calls.find(c => c.method === 'PATCH')!
    expect(patch.url).toContain('/branches/br-new-1')
    expect(patch.body).toEqual({ branch: { expires_at: null } })
    expect((await run($, '')).text).toContain('kept')
  })

  test('delete removes the branch, forgets it and unsets the variables', { options: OPTIONS }, async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await start($)
    expect((await run($, 'delete')).text).toContain('deleted claude/3f9a1c2e')
    expect(w.calls.some(c => c.method === 'DELETE' && c.url.endsWith('/branches/br-new-1'))).toBe(true)
    expect(w.env.DATABASE_URL).toBeUndefined()
    expect(w.store['neon-branch-per-session:branches']).toEqual({})
  })
})

describe('the end of the session', () => {
  test('onEnd delete removes it on exit but not on /clear', { options: { ...OPTIONS, onEnd: 'delete' } }, async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await start($)
    await $.session.end({ reason: 'clear', sessionId: 's1' } as never)
    expect(w.calls.some(c => c.method === 'DELETE')).toBe(false)
    await $.session.end({ reason: 'prompt_input_exit', sessionId: 's1' } as never)
    expect(w.calls.some(c => c.method === 'DELETE')).toBe(true)
  })

  test('onEnd expire (the default) calls nothing', { options: OPTIONS }, async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await start($)
    const before = w.calls.length
    await $.session.end({ reason: 'prompt_input_exit', sessionId: 's1' } as never)
    expect(w.calls.length).toBe(before)
  })

  test('onEnd keep clears the expiry', { options: { ...OPTIONS, onEnd: 'keep' } }, async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await start($)
    await $.session.end({ reason: 'prompt_input_exit', sessionId: 's1' } as never)
    expect(w.calls.some(c => c.method === 'PATCH')).toBe(true)
  })
})
