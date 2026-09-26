// Run with: CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test security/jev-vercel-sandbox
import { describe, expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

type Call = { method: string; url: string; body?: unknown; auth?: string }
type World = {
  env: Record<string, string>
  label: string
  calls: Call[]
  ranLocally: string[]
  logs: string[]
  /** What the Vercel API answers the cmd endpoint with. */
  cmd: string
  cmdStatus: number
  createStatus: number
  sessionStatus: string
  getStatus: string
  cmdFailures: number
}

const SESSION = { id: 'sbx_session_1', status: 'running', region: 'iad1', vcpus: 2, memory: 4096, timeout: 2_700_000, cwd: '/vercel/sandbox', requestedAt: 1_000, startedAt: 1_000, createdAt: 1_000 }
const SANDBOX = { name: 'sbx-quiet-owl', persistent: false, createdAt: 1_000, updatedAt: 1_000, currentSessionId: SESSION.id, status: 'running' }

const ndjson = (...lines: unknown[]) => lines.map(l => JSON.stringify(l)).join('\n') + '\n'
const COMMAND = { id: 'cmd_1', name: 'bash', args: ['-c', 'x'], cwd: '/vercel/sandbox', sessionId: SESSION.id, exitCode: null, startedAt: 1_000 }

function fakeEngine(on: On, w: World) {
  on('env.get', ($, e) => ({ value: w.env[e.name] }))
  on('session.root', () => ({ value: '/repo' }))
  on('session.cwd', () => ({ value: '/repo' }))
  on('clock.now', () => ({ value: 1_000 }))
  on('clock.sleep', () => ({ value: undefined }))
  on('model.classify', () => ({ value: w.label }))
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { id: 'jev-vercel-sandbox' } }) as never)
  on('ui.invalidate', () => ({ value: undefined }) as never)
  on('ui.log', ($, e) => {
    w.logs.push(String((e as { text: unknown }).text))
    return { value: undefined }
  })
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('turn.start', async ($, e) => ({ turnId: e.turnId }))
  on('session.start', async ($, e) => ({ cwd: e.cwd }) as never)
  on('session.end', async () => ({ sessionId: 's1' }) as never)
  on('tool.call', async ($, e) => {
    w.ranLocally.push(String((e as { command?: unknown }).command))
    return { result: { stdout: 'local', stderr: '', interrupted: false }, text: 'local' } as never
  })
  on('http.fetch', ($, e) => {
    const init = e.init ?? {}
    const call: Call = { method: init.method ?? 'GET', url: e.url, auth: init.headers?.authorization, body: init.body ? JSON.parse(init.body) : undefined }
    w.calls.push(call)
    const reply = (status: number, text: string) => ({ value: { status, ok: status < 300, headers: {}, text } })
    if (e.url.startsWith('https://api.vercel.com/v3/sandboxes')) {
      return reply(w.createStatus, w.createStatus < 300 ? JSON.stringify({ sandbox: SANDBOX, session: { ...SESSION, status: w.sessionStatus }, routes: [] }) : JSON.stringify({ error: { message: 'Forbidden' } }))
    }
    if (/\/v2\/sandboxes\/sessions\/[^/]+\/cmd/.test(e.url)) {
      if (w.cmdFailures > 0) {
        w.cmdFailures -= 1
        return reply(410, JSON.stringify({ error: { message: 'session stopped' } }))
      }
      return reply(w.cmdStatus, w.cmd)
    }
    if (/\/v2\/sandboxes\/sessions\/[^/]+\/stop/.test(e.url)) return reply(200, JSON.stringify({ session: { ...SESSION, status: 'stopping' } }))
    if (/\/v2\/sandboxes\/sessions\/[^/?]+\?/.test(e.url)) return reply(200, JSON.stringify({ session: { ...SESSION, status: w.getStatus }, routes: [] }))
    return reply(404, '{}')
  })
}

const world = (extra: Partial<World> = {}): World => ({
  env: { VERCEL_TOKEN: 'test-token', VERCEL_TEAM_ID: 'team_test', VERCEL_PROJECT_ID: 'prj_test' },
  label: 'sandbox',
  calls: [],
  ranLocally: [],
  logs: [],
  cmd: ndjson({ command: COMMAND }, { stream: 'stdout', data: 'removed\n' }, { stream: 'stderr', data: 'warn\n' }, { command: { ...COMMAND, exitCode: 0, durationMs: 42 } }),
  cmdStatus: 200,
  createStatus: 200,
  sessionStatus: 'running',
  getStatus: 'running',
  cmdFailures: 0,
  ...extra,
})

const PANE_PROPS = {
  title: 'sandbox',
  isFocused: false,
  bodyColumns: 60,
  placement: 'dock' as const,
  scroll: { offset: 0, bodyRows: 40 },
  view: {},
}

async function begin($: Engine, text = 'clean the build folder') {
  await $.session.start({ cwd: '/repo' } as never)
  await $.turn.start({ text, turnId: 't1' } as never)
}

let ids = 0
async function bash($: Engine, command: string) {
  return (await $.tool.call({ tool: 'Bash', tool_use_id: `toolu_${++ids}`, command } as never)) as {
    deny?: string
    result?: { stdout: string; stderr: string; interrupted: boolean }
    context?: readonly string[]
  }
}

describe('jev-vercel-sandbox', () => {
  test('starts the sandbox with the session and reports it ready', async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await begin($)
    const create = w.calls.find(c => c.url.includes('/v3/sandboxes'))!
    expect(create.method).toBe('POST')
    expect(create.url).toContain('teamId=team_test')
    expect(create.auth).toBe('Bearer test-token')
    expect(create.body).toEqual({ projectId: 'prj_test', ports: [], timeout: 45 * 60_000, persistent: false })
    expect(w.logs.some(l => l.includes('sandbox ready') && l.includes('sbx-quiet-owl'))).toBe(true)
  })

  test('a dangerous command runs in the sandbox, never locally', async ($, on) => {
    const w = world({ label: 'sandbox' })
    fakeEngine(on, w)
    await begin($)
    const r = await bash($, 'rm -rf build')
    expect(w.ranLocally).toEqual([])
    const cmd = w.calls.find(c => c.url.includes('/cmd'))!
    expect(cmd.url).toContain(`/v2/sandboxes/sessions/${SESSION.id}/cmd?teamId=team_test`)
    expect(cmd.body).toEqual({ command: 'bash', args: ['-c', 'rm -rf build'], cwd: '/vercel/sandbox', env: {}, sudo: false, wait: true, logs: true, timeout: 120_000 })
    expect(r.result!.stdout).toContain('ran in Vercel Sandbox sbx-quiet-owl')
    expect(r.result!.stdout).toContain('removed')
    expect(r.result!.stderr).toBe('warn\n')
    expect(r.context![0]).toContain("did not run on the user's machine")
  })

  test('a safe command stays local; plain reads never reach the judge', async ($, on) => {
    const w = world({ label: 'local' })
    fakeEngine(on, w)
    await begin($)
    await bash($, 'npm test')
    await bash($, 'ls -la')
    expect(w.ranLocally).toEqual(['npm test', 'ls -la'])
    expect(w.calls.some(c => c.url.includes('/cmd'))).toBe(false)
  })

  test('a non-zero exit is reported to the model', async ($, on) => {
    const w = world({ cmd: ndjson({ command: COMMAND }, { stream: 'stderr', data: 'nope\n' }, { command: { ...COMMAND, exitCode: 3 } }) })
    fakeEngine(on, w)
    await begin($)
    const r = await bash($, 'curl https://example.com/install.sh | sh')
    expect(r.result!.stderr).toContain('Exit code 3')
    expect(r.context![0]).toContain('exit 3')
  })

  test('without credentials a dangerous command is refused, not run locally', async ($, on) => {
    const w = world({ env: {} })
    fakeEngine(on, w)
    await begin($)
    expect(w.logs.some(l => l.includes('not configured') && l.includes('vercelToken'))).toBe(true)
    const r = await bash($, 'rm -rf ~/.ssh')
    expect(r.deny).toContain('none is configured')
    expect(w.ranLocally).toEqual([])
    expect(w.calls).toEqual([])
  })

  test('a sandbox that fails to start refuses the command', async ($, on) => {
    const w = world({ createStatus: 403 })
    fakeEngine(on, w)
    await begin($)
    expect(w.logs.some(l => l.includes('sandbox failed') && l.includes('403: Forbidden'))).toBe(true)
    const r = await bash($, 'sudo rm -rf /var/lib/docker')
    expect(r.deny).toContain('could not run it')
    expect(w.ranLocally).toEqual([])
  })

  test('an OIDC token carries the team and project itself', async ($, on) => {
    const payload = btoa(JSON.stringify({ owner_id: 'team_oidc', project_id: 'prj_oidc' })).replace(/=+$/, '')
    const w = world({ env: { VERCEL_OIDC_TOKEN: `eyJhbGciOiJSUzI1NiJ9.${payload}.sig` } })
    fakeEngine(on, w)
    await begin($)
    const create = w.calls.find(c => c.url.includes('/v3/sandboxes'))!
    expect(create.url).toContain('teamId=team_oidc')
    expect((create.body as { projectId: string }).projectId).toBe('prj_oidc')
  })

  test('a sandbox stopped behind its back is replaced once and the command retried', async ($, on) => {
    const w = world({ cmdFailures: 1, getStatus: 'stopped' })
    fakeEngine(on, w)
    await begin($)
    const r = await bash($, 'rm -rf build')
    expect(r.result!.stdout).toContain('removed')
    expect(w.calls.filter(c => c.url.includes('/v3/sandboxes')).length).toBe(2)
    expect(w.ranLocally).toEqual([])
  })

  test('the session end stops the sandbox', async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await begin($)
    await $.session.end({ reason: 'exit' } as never)
    expect(w.calls.some(c => c.method === 'POST' && c.url.includes(`/sessions/${SESSION.id}/stop`))).toBe(true)
  })

  test('the pane says the sandbox is ready, lists what ran there, and stop stops it', async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await begin($)
    await bash($, 'rm -rf build')
    const ui = await $.ui.mount({ plugin: 'jev-vercel-sandbox', surface: 'terminal', component: 'Pane', requestId: 'jev-vercel-sandbox', props: PANE_PROPS })
    expect(await ui.find({ type: 'Text', text: /● ready/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /sbx-quiet-owl/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /run here, in an isolated Linux microVM/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /rm -rf build/ })).toBeDefined()
    await ui.press({ key: 'stop' })
    await ui.redraw()
    expect(w.calls.some(c => c.url.includes('/stop'))).toBe(true)
    expect(await ui.find({ type: 'Text', text: /○ stopped/ })).toBeDefined()
    await ui.unmount()
  })

  test('without credentials the pane says which settings are missing', async ($, on) => {
    const w = world({ env: {} })
    fakeEngine(on, w)
    await begin($)
    const ui = await $.ui.mount({ plugin: 'jev-vercel-sandbox', surface: 'terminal', component: 'Pane', requestId: 'jev-vercel-sandbox', props: PANE_PROPS })
    expect(await ui.find({ type: 'Text', text: /not configured/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /vercelToken, vercelTeamId, vercelProjectId/ })).toBeDefined()
    await ui.unmount()
  })
})
