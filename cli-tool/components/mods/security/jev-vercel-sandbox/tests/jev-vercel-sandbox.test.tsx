// Run with: CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test security/jev-vercel-sandbox
import { describe, expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

type Call = { method: string; url: string; body?: { command?: string; args?: string[]; cwd?: string } & Record<string, unknown>; auth?: string }
type World = {
  env: Record<string, string>
  label: string
  calls: Call[]
  ranLocally: string[]
  logs: string[]
  processes: { argv: readonly string[]; stdin?: string }[]
  opened: number
  /** What the Vercel API answers a user command with. */
  cmd: string
  cmdStatus: number
  createStatus: number
  sessionStatus: string
  getStatus: string
  /** The compressed project's size, for the cap. */
  archiveBytes: number
  /** What `git status --porcelain` prints after a command. */
  porcelain: string
}

const SESSION = { id: 'sbx_session_1', status: 'running', region: 'iad1', vcpus: 2, memory: 4096, timeout: 2_700_000, cwd: '/vercel/sandbox', requestedAt: 1_000, startedAt: 1_000, createdAt: 1_000 }
const SANDBOX = { name: 'sbx-quiet-owl', persistent: false, createdAt: 1_000, updatedAt: 1_000, currentSessionId: SESSION.id, status: 'running' }

const ndjson = (...lines: unknown[]) => lines.map(l => JSON.stringify(l)).join('\n') + '\n'
const COMMAND = { id: 'cmd_1', name: 'bash', args: ['-c', 'x'], cwd: '/vercel/sandbox', sessionId: SESSION.id, exitCode: null, startedAt: 1_000 }
const finished = (stdout = '', exitCode = 0) => ndjson({ command: COMMAND }, ...(stdout ? [{ stream: 'stdout', data: stdout }] : []), { command: { ...COMMAND, exitCode } })

/** A call to the cmd endpoint that is the mod's own script (upload, unpack, changes), not the user's command. */
const isScript = (c: Call) => c.url.includes('/cmd') && c.body?.args?.[2] === 'jev'
const userCommands = (w: World) => w.calls.filter(c => c.url.includes('/cmd') && !isScript(c))

function fakeEngine(on: On, w: World) {
  on('env.get', ($, e) => ({ value: w.env[e.name] }))
  on('session.root', () => ({ value: '/repo' }))
  on('session.cwd', () => ({ value: '/repo/src' }))
  on('clock.now', () => ({ value: 1_000 }))
  on('clock.sleep', () => ({ value: undefined }))
  on('model.classify', () => ({ value: w.label }))
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => {
    w.opened += 1
    return { value: { id: 'jev-vercel-sandbox' } } as never
  })
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
  on('process.run', ($, e) => {
    w.processes.push({ argv: e.argv, stdin: e.init?.stdin })
    const out = (stdout: string, exitCode = 0) => ({ value: { exitCode, stdout, stderr: '' } })
    const [bin, ...args] = e.argv
    if (bin === 'git' && args[0] === 'rev-parse') return out('/repo\n')
    if (bin === 'git' && args.includes('--deleted')) return out('gone.txt\0')
    if (bin === 'git' && args[0] === 'ls-files') return out('README.md\0src/app.ts\0.env\0gone.txt\0keys/deploy.pem\0')
    if (bin === 'mktemp') return out('/tmp/jev.X\n')
    return out('')
  })
  on('fs.stat', () => ({ value: { kind: 'file', size: w.archiveBytes, mtimeMs: 1_000, isLink: false } }))
  on('fs.read', () => ({ value: { base64: 'UFJPSkVDVA==' } }))
  on('http.fetch', ($, e) => {
    const init = e.init ?? {}
    const call: Call = { method: init.method ?? 'GET', url: e.url, auth: init.headers?.authorization, body: init.body ? JSON.parse(init.body) : undefined }
    w.calls.push(call)
    const reply = (status: number, text: string) => ({ value: { status, ok: status < 300, headers: {}, text } })
    if (e.url.startsWith('https://api.vercel.com/v3/sandboxes')) {
      return reply(w.createStatus, w.createStatus < 300 ? JSON.stringify({ sandbox: SANDBOX, session: { ...SESSION, status: w.sessionStatus }, routes: [] }) : JSON.stringify({ error: { message: 'Forbidden' } }))
    }
    if (/\/v2\/sandboxes\/sessions\/[^/]+\/cmd/.test(e.url)) {
      if (isScript(call)) {
        const script = call.body!.args![1]!
        if (script.includes('tar -xzf')) return reply(200, finished('git\n'))
        if (script.includes('git status')) return reply(200, finished(w.porcelain))
        return reply(200, finished())
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
  processes: [],
  opened: 0,
  cmd: ndjson({ command: COMMAND }, { stream: 'stdout', data: 'removed\n' }, { stream: 'stderr', data: 'warn\n' }, { command: { ...COMMAND, exitCode: 0, durationMs: 42 } }),
  cmdStatus: 200,
  createStatus: 200,
  sessionStatus: 'running',
  getStatus: 'running',
  archiveBytes: 2_048,
  porcelain: 'D  build/out.js\nA  build/new.js\n',
  ...extra,
})

const PANE_PROPS = {
  title: 'sandbox',
  isFocused: false,
  bodyColumns: 60,
  placement: 'dock' as const,
  scroll: { offset: 0, bodyRows: 60 },
  view: {},
}

async function begin($: Engine, text = 'clean the build folder') {
  await $.session.start({ cwd: '/repo/src' } as never)
  await $.turn.start({ text, turnId: 't1' } as never)
}

async function slash($: Engine, args = '') {
  return (await $.command.run({ command: 'jev-vercel-sandbox', args } as never)) as { text?: string; context?: readonly string[] }
}

const tick = () => new Promise<void>(resolve => (globalThis as unknown as { setTimeout: (f: () => void, ms: number) => void }).setTimeout(resolve, 5))

/** Waits for the start /jev-vercel-sandbox left running to end. */
async function settle(w: World) {
  for (let i = 0; i < 400 && !w.logs.some(l => l.includes('sandbox ready') || l.includes('did not start')); i++) await tick()
}

async function started($: Engine, w: World) {
  await begin($)
  await slash($)
  await settle(w)
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
  test('the session start starts nothing and says how to start the sandbox', async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await begin($)
    expect(w.calls).toEqual([])
    expect(w.opened).toBe(0)
    expect(w.logs.some(l => l.includes('run /jev-vercel-sandbox to start the sandbox'))).toBe(true)
  })

  test('before /jev-vercel-sandbox a dangerous command is refused, with the way to start it', async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await begin($)
    const r = await bash($, 'rm -rf build')
    expect(r.deny).toContain('/jev-vercel-sandbox')
    expect(r.deny).toContain('It was not run')
    expect(w.ranLocally).toEqual([])
    expect(w.calls).toEqual([])
  })

  test('/jev-vercel-sandbox opens the pane, starts the microVM and copies the project without its secrets', async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await begin($)
    const answer = await slash($)
    expect(answer.text).toContain('starting the Vercel Sandbox')
    expect(w.opened).toBe(1)
    await settle(w)

    const create = w.calls.find(c => c.url.includes('/v3/sandboxes'))!
    expect(create.url).toContain('teamId=team_test')
    expect(create.auth).toBe('Bearer test-token')
    expect(create.body).toEqual({ projectId: 'prj_test', ports: [], timeout: 45 * 60_000, persistent: false })

    const tar = w.processes.find(p => p.argv[0] === 'tar')!
    expect(tar.argv).toEqual(['tar', '-czf', '/tmp/jev.X/workspace.tgz', '--null', '-T', '-'])
    expect(tar.stdin).toBe('README.md\0src/app.ts\0')
    expect(w.processes.some(p => p.argv[0] === 'rm' && p.argv.includes('/tmp/jev.X'))).toBe(true)

    const scripts = w.calls.filter(isScript).map(c => c.body!.args!.slice(3))
    expect(scripts[0]).toEqual(['/tmp/jev-workspace.b64'])
    expect(scripts[1]).toEqual(['/tmp/jev-workspace.b64', 'UFJPSkVDVA=='])
    expect(scripts[2]).toEqual(['/tmp/jev-workspace.b64', '/vercel/sandbox/repo'])
    expect(w.logs.some(l => l.includes('sandbox ready') && l.includes('Jev will now run the commands it judges dangerous in the sandbox'))).toBe(true)
  })

  test('once ready, a dangerous command runs in the project copy and reports what it changed', async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await started($, w)
    const r = await bash($, 'rm -rf build')
    expect(w.ranLocally).toEqual([])
    const cmd = userCommands(w)[0]!
    expect(cmd.url).toContain(`/v2/sandboxes/sessions/${SESSION.id}/cmd?teamId=team_test`)
    expect(cmd.body).toEqual({ command: 'bash', args: ['-c', 'rm -rf build'], cwd: '/vercel/sandbox/repo/src', env: {}, sudo: false, wait: true, logs: true, timeout: 120_000 })
    expect(r.result!.stdout).toContain('ran in Vercel Sandbox sbx-quiet-owl')
    expect(r.result!.stdout).toContain('removed')
    expect(r.result!.stderr).toBe('warn\n')
    expect(r.context![0]).toContain("did not run on the user's machine")
    expect(r.context![0]).toContain('2 files changed: -build/out.js, +build/new.js')
    expect(r.context![0]).toContain('/jev-vercel-sandbox approve')
  })

  test('a safe command stays local; plain reads never reach the judge', async ($, on) => {
    const w = world({ label: 'local' })
    fakeEngine(on, w)
    await started($, w)
    await bash($, 'npm test')
    await bash($, 'ls -la')
    expect(w.ranLocally).toEqual(['npm test', 'ls -la'])
    expect(userCommands(w)).toEqual([])
  })

  test('a non-zero exit is reported to the model', async ($, on) => {
    const w = world({ cmd: ndjson({ command: COMMAND }, { stream: 'stderr', data: 'nope\n' }, { command: { ...COMMAND, exitCode: 3 } }) })
    fakeEngine(on, w)
    await started($, w)
    const r = await bash($, 'curl https://example.com/install.sh | sh')
    expect(r.result!.stderr).toContain('Exit code 3')
    expect(r.context![0]).toContain('exit 3')
  })

  test('approve lets the last sandboxed command run once on the machine', async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await started($, w)
    await bash($, 'rm -rf build')
    const answer = await slash($, 'approve')
    expect(answer.text).toContain('approved to run once on this machine')
    await bash($, 'rm -rf build')
    expect(w.ranLocally).toEqual(['rm -rf build'])
    await bash($, 'rm -rf build')
    expect(w.ranLocally).toEqual(['rm -rf build'])
    expect(userCommands(w).length).toBe(2)
  })

  test('without credentials /jev-vercel-sandbox says what is missing and nothing starts', async ($, on) => {
    const w = world({ env: {} })
    fakeEngine(on, w)
    await begin($)
    expect(w.logs.some(l => l.includes('not configured') && l.includes('vercelToken'))).toBe(true)
    const answer = await slash($)
    expect(answer.text).toContain('vercelToken')
    const r = await bash($, 'rm -rf ~/.ssh')
    expect(r.deny).toContain('missing vercelToken')
    expect(w.ranLocally).toEqual([])
    expect(w.calls).toEqual([])
  })

  test('a sandbox that fails to start refuses the command', async ($, on) => {
    const w = world({ createStatus: 403 })
    fakeEngine(on, w)
    await started($, w)
    expect(w.logs.some(l => l.includes('did not start') && l.includes('403: Forbidden'))).toBe(true)
    const r = await bash($, 'sudo rm -rf /var/lib/docker')
    expect(r.deny).toContain('did not start')
    expect(w.ranLocally).toEqual([])
  })

  test('a project over the size cap fails the start and stops the microVM', async ($, on) => {
    const w = world({ archiveBytes: 50 * 1_048_576 })
    fakeEngine(on, w)
    await started($, w)
    expect(w.logs.some(l => l.includes('over workspaceMaxMB (10 MB)'))).toBe(true)
    const ui = await $.ui.mount({ plugin: 'jev-vercel-sandbox', surface: 'terminal', component: 'Pane', requestId: 'jev-vercel-sandbox', props: PANE_PROPS })
    expect(await ui.find({ type: 'Text', text: /✗ did not start/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /over workspaceMaxMB/ })).toBeDefined()
    await ui.unmount()
    expect(w.calls.some(c => c.url.includes('/stop'))).toBe(true)
    expect(w.calls.filter(isScript)).toEqual([])
  })

  test('an OIDC token carries the team and project itself', async ($, on) => {
    const payload = btoa(JSON.stringify({ owner_id: 'team_oidc', project_id: 'prj_oidc' })).replace(/=+$/, '')
    const w = world({ env: { VERCEL_OIDC_TOKEN: `eyJhbGciOiJSUzI1NiJ9.${payload}.sig` } })
    fakeEngine(on, w)
    await started($, w)
    const create = w.calls.find(c => c.url.includes('/v3/sandboxes'))!
    expect(create.url).toContain('teamId=team_oidc')
    expect(create.body!.projectId).toBe('prj_oidc')
  })

  test('a sandbox stopped behind its back refuses the command and asks for a restart', async ($, on) => {
    const w = world({ cmdStatus: 410, cmd: JSON.stringify({ error: { message: 'session stopped' } }), getStatus: 'stopped' })
    fakeEngine(on, w)
    await started($, w)
    const r = await bash($, 'rm -rf build')
    expect(r.deny).toContain('/jev-vercel-sandbox')
    expect(r.deny).toContain('has stopped')
    expect(w.ranLocally).toEqual([])
    expect(w.calls.filter(c => c.url.includes('/v3/sandboxes')).length).toBe(1)
  })

  test('the session end stops the sandbox', async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await started($, w)
    await $.session.end({ reason: 'exit' } as never)
    expect(w.calls.some(c => c.method === 'POST' && c.url.includes(`/sessions/${SESSION.id}/stop`))).toBe(true)
  })

  test('the pane shows the finished start, the ready message and the live log', async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await started($, w)
    await bash($, 'rm -rf build')
    const ui = await $.ui.mount({ plugin: 'jev-vercel-sandbox', surface: 'terminal', component: 'Pane', requestId: 'jev-vercel-sandbox', props: PANE_PROPS })
    expect(await ui.find({ type: 'Text', text: /● ready/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Starting the microVM/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /2 files · .* 2 secrets left out/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Jev will now run the commands it judges dangerous in this sandbox/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Commands in the sandbox \(1\)/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /rm -rf build/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /2 files changed/ })).toBeDefined()
    await ui.press({ key: 'stop' })
    await ui.redraw()
    expect(w.calls.some(c => c.url.includes('/stop'))).toBe(true)
    expect(await ui.find({ type: 'Text', text: /○ stopped/ })).toBeDefined()
    await ui.unmount()
  })

  test('before the start the pane says to run /jev-vercel-sandbox', async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await begin($)
    const ui = await $.ui.mount({ plugin: 'jev-vercel-sandbox', surface: 'terminal', component: 'Pane', requestId: 'jev-vercel-sandbox', props: PANE_PROPS })
    expect(await ui.find({ type: 'Text', text: /○ not started/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Run \/jev-vercel-sandbox to start it/ })).toBeDefined()
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
