// Run with: CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test integrations/vercel-deploys
import { describe, expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'
import { ago, answers, changes, describeFailure, parseDeploys, parseProjects, productionDomain, sortProjects, summarize, summaryText, toState } from '../hooks/vercel-api.ts'
import type { Deploy } from '../hooks/vercel-api.ts'

const NOW = 1_800_000_000_000
const TOKEN = 'vcp_test_token'

const project = (over: Record<string, unknown> = {}) => ({
  id: 'prj_web',
  name: 'web',
  framework: 'astro',
  updatedAt: NOW - 1000,
  link: { type: 'github', org: 'acme', repo: 'web' },
  targets: { production: { alias: ['web-acme.vercel.app', 'www.acme.dev'], readyState: 'READY', url: 'web-abc.vercel.app' } },
  latestDeployments: [
    { id: 'dpl_old', readyState: 'READY', url: 'web-old.vercel.app', createdAt: NOW - 600_000, target: 'production', meta: { githubCommitMessage: 'old\nbody' } },
    { id: 'dpl_new', readyState: 'BUILDING', url: 'web-new.vercel.app', createdAt: NOW - 60_000, target: 'production', meta: { githubCommitMessage: 'fix: header\n\nlong body', githubCommitRef: 'main' } },
  ],
  ...over,
})
const api = project({ id: 'prj_api', name: 'api', link: undefined, targets: undefined, alias: [{ domain: 'api.acme.dev' }], latestDeployments: [{ id: 'dpl_a', readyState: 'ERROR', url: 'api-a.vercel.app', createdAt: NOW - 5_000, target: 'production' }] })
const docs = project({ id: 'prj_docs', name: 'docs', targets: { production: { alias: ['docs.acme.dev'], readyState: 'READY' } }, latestDeployments: [{ id: 'dpl_d', readyState: 'READY', url: 'docs-d.vercel.app', createdAt: NOW - 90_000_000, target: 'production' }] })

describe('parsing', () => {
  test('a project: latest deployment by date, repo, custom production domain', () => {
    const [p] = parseProjects(JSON.stringify({ projects: [project()], pagination: { count: 1, next: null } }))
    expect(p).toEqual(expect.objectContaining({ id: 'prj_web', name: 'web', framework: 'astro', repo: 'acme/web', domain: 'www.acme.dev', production: 'ready' }))
    expect(p!.latest).toEqual(expect.objectContaining({ id: 'dpl_new', state: 'building', url: 'web-new.vercel.app', commit: 'fix: header', branch: 'main' }))
  })

  test('the list may be a bare array, and what is missing is left out', () => {
    const list = parseProjects(JSON.stringify([api, { nope: true }, 'x', null]))
    expect(list.length).toBe(1)
    expect(list[0]).toEqual(expect.objectContaining({ name: 'api', domain: 'api.acme.dev', repo: undefined, production: undefined }))
    expect(list[0]!.latest!.state).toBe('failed')
    expect(parseProjects('{"projects": null}')).toEqual([])
  })

  test('the domain: custom beats vercel.app, vercel.app beats the deployment url', () => {
    expect(productionDomain({ targets: { production: { alias: ['a.vercel.app', 'https://shop.acme.dev/'] } } })).toBe('shop.acme.dev')
    expect(productionDomain({ targets: { production: { alias: ['a.vercel.app'] } } })).toBe('a.vercel.app')
    expect(productionDomain({ targets: { production: { url: 'https://dep-1.vercel.app' } } })).toBe('dep-1.vercel.app')
    expect(productionDomain({})).toBeUndefined()
  })

  test('deployments: uid, state, created, ready', () => {
    const [d] = parseDeploys(JSON.stringify({ deployments: [{ uid: 'dpl_1', state: 'READY', readyState: 'READY', created: 5, ready: 9, url: 'x.vercel.app', target: null, meta: { githubCommitMessage: 'ship it' } }] }))
    expect(d).toEqual(expect.objectContaining({ id: 'dpl_1', state: 'ready', createdAt: 5, readyAt: 9, commit: 'ship it' }))
  })

  test('states', () => {
    expect(['READY', 'BUILDING', 'QUEUED', 'INITIALIZING', 'ERROR', 'CANCELED', 'DELETED', 'BLOCKED', 'NOPE'].map(toState)).toEqual(['ready', 'building', 'building', 'building', 'failed', 'canceled', 'canceled', 'blocked', 'unknown'])
    expect(answers(200)).toBe(true)
    expect(answers(401)).toBe(true)
    expect(answers(503)).toBe(false)
    expect(answers(0)).toBe(false)
    expect(ago(NOW - 90_000, NOW)).toBe('2m')
    expect(ago(NOW - 5_000, NOW)).toBe('5s')
    expect(ago(NOW - 7_200_000, NOW)).toBe('2h')
    expect(ago(undefined, NOW)).toBe('')
    expect(describeFailure(403, '{}')).toContain('refused the token')
    expect(describeFailure(500, '{"error":{"message":"boom"}}')).toBe('Vercel answered 500: boom')
  })
})

describe('ordering, summary, changes', () => {
  const list = parseProjects(JSON.stringify([docs, api, project()]))

  test('building first, then failed, then the rest', () => {
    expect(sortProjects(list).map(p => p.name)).toEqual(['web', 'api', 'docs'])
    expect(summarize(list)).toEqual({ total: 3, live: 1, building: 1, failed: 1 })
    expect(summaryText(summarize(list))).toBe('vercel: 1 ready · 1 building · 1 failed')
  })

  test('a finished deployment is announced once, the first read is silent', () => {
    const building: Deploy = { id: 'dpl_new', readyState: 'BUILDING', state: 'building' }
    const web = parseProjects(JSON.stringify([project()]))
    expect(changes(new Map(), web)).toEqual([])
    expect(changes(new Map([['prj_web', building]]), web)).toEqual([])

    const done = parseProjects(JSON.stringify([project({ latestDeployments: [{ id: 'dpl_new', readyState: 'READY', createdAt: NOW, target: 'production' }] })]))
    expect(changes(new Map([['prj_web', building]]), done)).toEqual([{ project: 'web', to: 'ready', target: 'production', error: undefined }])
    // the same ready deployment on the next read: nothing
    expect(changes(new Map([['prj_web', done[0]!.latest!]]), done)).toEqual([])
    // a new deployment that is already failed
    const failed = parseProjects(JSON.stringify([project({ latestDeployments: [{ id: 'dpl_x', readyState: 'ERROR', createdAt: NOW, errorMessage: 'Build failed' }] })]))
    expect(changes(new Map([['prj_web', building]]), failed)).toEqual([expect.objectContaining({ project: 'web', to: 'failed', error: 'Build failed' })])
  })
})

type Call = { url: string; auth?: string }
type World = { calls: Call[]; toasts: string[]; status: (string | undefined)[]; copied: string[]; listStatus: number; siteStatus: Record<string, number> }
const world = (): World => ({ calls: [], toasts: [], status: [], copied: [], listStatus: 200, siteStatus: {} })

function fakeEngine(on: On, w: World) {
  on('session.start', async ($, e) => ({ cwd: e.cwd }) as never)
  on('session.end', async () => ({ sessionId: 's1' }) as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('clock.every', () => ({ value: undefined }) as never)
  on('clock.sleep', () => new Promise(() => {}) as never)
  on('ui.open', () => ({ value: undefined }) as never)
  on('ui.close', () => ({ value: undefined }) as never)
  on('ui.invalidate', () => ({ value: undefined }) as never)
  on('ui.log', () => ({ value: undefined }))
  on('ui.status', ($, e) => {
    w.status.push((e as { text?: string }).text)
    return { value: undefined }
  })
  on('ui.toast', ($, e) => {
    w.toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.copy', ($, e) => {
    w.copied.push(e.text)
    return { value: { isCopied: true } } as never
  })
  on('http.fetch', async ($, e) => {
    w.calls.push({ url: e.url, auth: e.init?.headers?.authorization })
    const reply = (status: number, text: string) => ({ value: { status, ok: status < 300, headers: {}, text } })
    if (e.url.startsWith('https://api.vercel.com/v10/projects')) {
      return w.listStatus === 200 ? reply(200, JSON.stringify({ projects: [project(), api, docs] })) : reply(w.listStatus, '{"error":{"message":"nope"}}')
    }
    if (e.url.startsWith('https://api.vercel.com/v7/deployments')) {
      return reply(200, JSON.stringify({ deployments: [{ uid: 'dpl_new', readyState: 'BUILDING', created: NOW, target: 'production', meta: { githubCommitMessage: 'fix: header' } }] }))
    }
    const host = e.url.replace('https://', '')
    return reply(w.siteStatus[host] ?? 200, '')
  })
}

const OPTIONS = { vercelToken: TOKEN }
const run = async ($: Engine, args = '') => (await $.command.run({ command: 'vercel', args, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 200 } } as never)) as { text?: string }
const PANE_PROPS = { title: 'vercel', isFocused: true, bodyColumns: 60, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 40 }, view: {} }
const mount = ($: Engine) => $.ui.mount({ plugin: 'vercel-deploys', surface: 'terminal', component: 'Pane', requestId: 'vercel', props: PANE_PROPS })

describe('the pane', () => {
  test('/vercel reads the projects with the token, checks the sites and summarizes', { options: OPTIONS }, async ($, on) => {
    const w = world()
    w.siteStatus['www.acme.dev'] = 200
    w.siteStatus['api.acme.dev'] = 502
    fakeEngine(on, w)
    await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
    const out = await run($)
    expect(out.text).toContain('1 ready · 1 building · 1 failed')
    const list = w.calls.find(c => c.url.includes('/v10/projects'))!
    expect(list.auth).toBe(`Bearer ${TOKEN}`)
    expect(list.url).toContain('limit=20')
    // sites are probed without the token
    const probes = w.calls.filter(c => !c.url.startsWith('https://api.vercel.com'))
    expect([...new Set(probes.map(c => c.url))].sort()).toEqual(['https://api.acme.dev', 'https://docs.acme.dev', 'https://www.acme.dev'])
    expect(probes.every(c => c.auth === undefined)).toBe(true)

    const ui = await mount($)
    expect(await ui.find({ key: 'p:0' })).toBeDefined()
    expect((await ui.find({ key: 'p:0' }))?.text).toContain('web')
    expect(await ui.find({ type: 'Text', text: /✓200/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /✕502/ })).toBeDefined()
    await ui.unmount()
  })

  test('a row opens the last deployments and copies the url', { options: OPTIONS }, async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
    await run($)
    const ui = await mount($)
    await ui.press({ key: 'p:0' })
    await ui.redraw()
    expect(await ui.find({ type: 'Text', text: /fix: header/ })).toBeDefined()
    expect(w.calls.some(c => c.url.includes('/v7/deployments') && c.url.includes('projectId=prj_web'))).toBe(true)
    await ui.press({ key: 'copy' })
    expect(w.copied).toEqual(['https://www.acme.dev'])
    await ui.unmount()
  })

  test('a team slug and a team id use their own query parameter', { options: { ...OPTIONS, teamId: 'team_abc', maxProjects: 5 } }, async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
    await run($)
    const url = w.calls.find(c => c.url.includes('/v10/projects'))!.url
    expect(url).toContain('teamId=team_abc')
    expect(url).toContain('limit=5')
  })

  test('a refused token is reported, never echoed', { options: OPTIONS }, async ($, on) => {
    const w = world()
    w.listStatus = 403
    fakeEngine(on, w)
    await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
    const out = await run($)
    expect(out.text).toContain('refused the token')
    expect(out.text).not.toContain(TOKEN)
  })

  test('without a token nothing is called', async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
    expect((await run($)).text).toContain('vercelToken')
    expect(w.calls).toEqual([])
  })

  test('healthCheck off sends no request to the sites', { options: { ...OPTIONS, healthCheck: false } }, async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
    await run($)
    expect(w.calls.every(c => c.url.startsWith('https://api.vercel.com'))).toBe(true)
  })
})
