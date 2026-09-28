// Run with: CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test security/jev-vercel-sandbox
import { describe, expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

type Call = { method: string; url: string; body?: { command?: string; args?: string[]; cwd?: string } & Record<string, unknown>; auth?: string }
type World = {
  env: Record<string, string>
  /** What the built-in classifier answers (no Jev key in tests). */
  label: string
  /** What the person picks in the question dialog; null dismisses it. */
  answer: string | null
  asked: string[]
  calls: Call[]
  ranLocally: string[]
  logs: string[]
  submits: string[]
  processes: { argv: readonly string[]; stdin?: string; env?: Record<string, string> }[]
  opened: number
  /** What the Vercel API answers a job's command with. */
  cmd: string
  cmdStatus: number
  createStatus: number
  /** Holds the create request this long, so a failed pack can finish first. */
  createDelayMs: number
  sessionStatus: string
  getStatus: string
  /** The compressed project's size, for the cap. */
  archiveBytes: number
  /** The tree `git write-tree` prints: change it to edit the project. */
  tree: string
  /** What `git status --porcelain` prints after a job. */
  porcelain: string
  patch: string
  /** Makes $.clock.now throw, to fail a hook mid-way. */
  nowThrows: boolean
  /** Set nowThrows once the person has answered. */
  throwAfterAnswer: boolean
  registered: string[]
  classified: number
}

const SESSION = { id: 'sbx_session_1', status: 'running', region: 'iad1', vcpus: 2, memory: 4096, timeout: 2_700_000, cwd: '/vercel/sandbox', requestedAt: 1_000, startedAt: 1_000, createdAt: 1_000 }
const SANDBOX = { name: 'sbx-quiet-owl', persistent: false, createdAt: 1_000, updatedAt: 1_000, currentSessionId: SESSION.id, status: 'running' }
const TREE0 = 'a'.repeat(40)
const TREE1 = 'b'.repeat(40)

const ndjson = (...lines: unknown[]) => lines.map(l => JSON.stringify(l)).join('\n') + '\n'
const COMMAND = { id: 'cmd_1', name: 'bash', args: ['-c', 'x'], cwd: '/vercel/sandbox', sessionId: SESSION.id, exitCode: null, startedAt: 1_000 }
const finished = (stdout = '', exitCode = 0) => ndjson({ command: COMMAND }, ...(stdout ? [{ stream: 'stdout', data: stdout }] : []), { command: { ...COMMAND, exitCode } })

/** A call to the cmd endpoint that is the mod's own script (upload, sync, prepare, report), not a job's command. */
const isScript = (c: Call) => c.url.includes('/cmd') && c.body?.args?.[2] === 'jev'
const scriptsWith = (w: World, needle: string) => w.calls.filter(c => isScript(c) && c.body!.args![1]!.includes(needle)).map(c => c.body!.args!.slice(3))
const jobCommands = (w: World) => w.calls.filter(c => c.url.includes('/cmd') && !isScript(c))

function fakeEngine(on: On, w: World) {
  on('env.get', ($, e) => ({ value: w.env[e.name] }))
  on('session.root', () => ({ value: '/repo' }))
  on('session.cwd', () => ({ value: '/repo/src' }))
  on('clock.now', () => {
    if (w.nowThrows) throw new Error('clock gone')
    return { value: 1_000 }
  })
  on('clock.sleep', () => ({ value: undefined }))
  on('model.classify', () => {
    w.classified += 1
    return { value: w.label }
  })
  on('command.register', () => ({ value: undefined }) as never)
  on('tool.register', ($, e) => {
    w.registered.push((e as { name: string }).name)
    return { value: { tool: `mcp__jev-vercel-sandbox__${(e as { name: string }).name}` } } as never
  })
  on('prompt.submit', async ($, e) => {
    w.submits.push(e.text)
    return { text: e.text } as never
  })
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
    if (e.tool === 'AskUserQuestion') {
      const q = (e as unknown as { questions: { question: string }[] }).questions[0]!.question
      w.asked.push(q)
      if (w.answer === null) return { deny: 'dismissed' }
      if (w.throwAfterAnswer) w.nowThrows = true
      return { result: { questions: [], answers: { [q]: w.answer } } } as never
    }
    w.ranLocally.push(String((e as { command?: unknown }).command))
    return { result: { stdout: 'local', stderr: '', interrupted: false }, text: 'local' } as never
  })
  on('process.run', ($, e) => {
    w.processes.push({ argv: e.argv, stdin: e.init?.stdin, env: e.init?.env })
    const out = (stdout: string, exitCode = 0) => ({ value: { exitCode, stdout, stderr: '' } })
    const [bin, ...args] = e.argv
    if (bin === 'git' && args[0] === 'rev-parse') return out('/repo\n')
    if (bin === 'git' && args.includes('--deleted')) return out('gone.txt\0')
    if (bin === 'git' && args[0] === 'ls-files') {
      const tracked = 'README.md\0src/app.ts\0.env\0gone.txt\0keys/deploy.pem\0'
      // untracked, and no name the credential list knows
      return out(args.includes('--others') ? `${tracked}service-account.json\0secrets.yaml\0.envrc\0` : tracked)
    }
    if (bin === 'git' && args[0] === 'write-tree') return out(`${w.tree}\n`)
    if (bin === 'mktemp') return out('/tmp/jev.X\n')
    return out('')
  })
  on('fs.stat', () => ({ value: { kind: 'file', size: w.archiveBytes, mtimeMs: 1_000, isLink: false } }))
  on('fs.read', () => ({ value: { base64: 'UFJPSkVDVA==' } }))
  on('http.fetch', async ($, e) => {
    const init = e.init ?? {}
    const call: Call = { method: init.method ?? 'GET', url: e.url, auth: init.headers?.authorization, body: init.body ? JSON.parse(init.body) : undefined }
    w.calls.push(call)
    const reply = (status: number, text: string) => ({ value: { status, ok: status < 300, headers: {}, text } })
    if (e.url.startsWith('https://api.vercel.com/v3/sandboxes')) {
      if (w.createDelayMs) await new Promise(r => setTimeout(r, w.createDelayMs))
      return reply(w.createStatus, w.createStatus < 300 ? JSON.stringify({ sandbox: SANDBOX, session: { ...SESSION, status: w.sessionStatus }, routes: [] }) : JSON.stringify({ error: { message: 'Forbidden' } }))
    }
    if (/\/v2\/sandboxes\/sessions\/[^/]+\/cmd/.test(e.url)) {
      if (isScript(call)) {
        const [script, , ...args] = call.body!.args!.slice(1)
        if (script!.includes('tar -xzf')) return reply(200, finished('git\n'))
        if (script!.includes('@@changes')) {
          const [, watch, patch] = args
          return reply(200, finished(`@@changes\n${w.porcelain}${patch === '1' ? '@@patch 120\n' : ''}${watch === '1' ? '@@outside\n/usr/local/bin/helper\n@@processes\n77 miner\n' : ''}`))
        }
        if (script!.includes('kept no patch')) return reply(200, finished(w.patch))
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
  label: 'repo_change',
  answer: 'Run in sandbox',
  asked: [],
  calls: [],
  ranLocally: [],
  logs: [],
  submits: [],
  processes: [],
  opened: 0,
  cmd: ndjson({ command: COMMAND }, { stream: 'stdout', data: 'removed\n' }, { stream: 'stderr', data: 'warn\n' }, { command: { ...COMMAND, exitCode: 0, durationMs: 4200 } }),
  cmdStatus: 200,
  createStatus: 200,
  createDelayMs: 0,
  sessionStatus: 'running',
  getStatus: 'running',
  archiveBytes: 2_048,
  tree: TREE0,
  porcelain: 'D  src/legacy/a.ts\nA  src/new.ts\n',
  patch: 'diff --git a/src/new.ts b/src/new.ts\nnew file mode 100644\n--- /dev/null\n+++ b/src/new.ts\n@@ -0,0 +1 @@\n+x\n',
  nowThrows: false,
  throwAfterAnswer: false,
  registered: [],
  classified: 0,
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

async function begin($: Engine, text = 'drop the legacy folder') {
  await $.session.start({ cwd: '/repo/src' } as never)
  await $.turn.start({ text, turnId: 't1' } as never)
}

async function slash($: Engine, args = '') {
  return (await $.command.run({ command: 'jev-vercel-sandbox', args } as never)) as { text?: string; context?: readonly string[] }
}

const tick = () => new Promise<void>(resolve => (globalThis as unknown as { setTimeout: (f: () => void, ms: number) => void }).setTimeout(resolve, 5))

async function until(done: () => boolean) {
  for (let i = 0; i < 400 && !done(); i++) await tick()
}

/** Waits for the start /jev-vercel-sandbox left running to end. */
const settle = (w: World) => until(() => w.logs.some(l => l.includes('sandbox ready') || l.includes('did not start')))

async function started($: Engine, w: World) {
  await begin($)
  await slash($)
  await settle(w)
}

let ids = 0
type ToolAnswer = { deny?: string; result?: { stdout: string; stderr: string; interrupted: boolean }; context?: readonly string[] }
async function bash($: Engine, command: string) {
  return (await $.tool.call({ tool: 'Bash', tool_use_id: `toolu_${++ids}`, command } as never)) as ToolAnswer
}
async function tool($: Engine, name: string, input: Record<string, unknown>) {
  return (await $.tool.call({ tool: `mcp__jev-vercel-sandbox__${name}`, tool_use_id: `toolu_${++ids}`, ...input } as never)) as { deny?: string; result?: string; context?: readonly string[] }
}

describe('jev-vercel-sandbox', () => {
  test('the session start starts nothing, registers the tools and says how it works', async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await begin($)
    expect(w.calls).toEqual([])
    expect(w.opened).toBe(0)
    expect(w.registered).toEqual(['sandbox_run', 'sandbox_jobs', 'sandbox_result', 'sandbox_apply'])
    expect(w.logs.some(l => l.includes('checks commands for sandbox jobs') && l.includes('asks you'))).toBe(true)
  })

  test('a command that is no sandbox job runs locally without a question; plain reads skip the detector', async ($, on) => {
    const w = world({ label: 'none' })
    fakeEngine(on, w)
    await started($, w)
    await bash($, 'npm run dev')
    await bash($, 'ls -la')
    expect(w.ranLocally).toEqual(['npm run dev', 'ls -la'])
    expect(w.classified).toBe(1)
    expect(w.asked).toEqual([])
    expect(jobCommands(w)).toEqual([])
  })

  test('a detected job asks first; "Run locally" leaves it to the machine', async ($, on) => {
    const w = world({ answer: 'Run locally' })
    fakeEngine(on, w)
    await started($, w)
    await bash($, 'rm -rf src/legacy')
    expect(w.asked[0]).toContain('`rm -rf src/legacy` looks like a bulk change to the project, to preview first')
    expect(w.ranLocally).toEqual(['rm -rf src/legacy'])
    expect(jobCommands(w)).toEqual([])
  })

  test('a dismissed question runs it locally, as if the mod were not there', async ($, on) => {
    const w = world({ answer: null })
    fakeEngine(on, w)
    await started($, w)
    await bash($, 'rm -rf src/legacy')
    expect(w.ranLocally).toEqual(['rm -rf src/legacy'])
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
    // the tree the sync starts from holds the same files, through a throwaway index
    const index = w.processes.find(p => p.argv[1] === 'update-index')!
    expect(index.stdin).toBe('README.md\0src/app.ts\0')
    expect(index.env).toEqual({ GIT_INDEX_FILE: '/tmp/jev.X/index' })
    // only tracked files go by default: untracked ones may hold credentials no name list catches
    expect(w.processes.find(p => p.argv[0] === 'git' && p.argv[1] === 'ls-files' && !p.argv.includes('--deleted'))!.argv).toEqual(['git', 'ls-files', '-z', '--cached'])
    expect(tar.stdin).not.toContain('service-account.json')
    expect(w.processes.some(p => p.argv[0] === 'rm' && p.argv.includes('/tmp/jev.X'))).toBe(true)

    const scripts = w.calls.filter(isScript).map(c => c.body!.args!.slice(3))
    expect(scripts[0]).toEqual(['/tmp/jev-workspace.b64'])
    expect(scripts[1]).toEqual(['/tmp/jev-workspace.b64', 'UFJPSkVDVA=='])
    expect(scripts[2]).toEqual(['/tmp/jev-workspace.b64', '/vercel/sandbox/repo'])
    expect(w.logs.some(l => l.includes('sandbox ready') && l.includes('asks you before sending one'))).toBe(true)
  })

  test('a confirmed job runs in its own worktree, is marked remote, and keeps a patch it does not apply', async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await started($, w)
    const r = await bash($, 'rm -rf src/legacy')
    expect(w.ranLocally).toEqual([])
    // nothing changed since the start: no sync patch goes up
    expect(scriptsWith(w, 'git apply')).toEqual([])
    expect(scriptsWith(w, 'worktree add')[0]).toEqual(['current', '/vercel/sandbox/repo', '/vercel/sandbox/.jev-jobs/j1', '', '', 'src'])
    const cmd = jobCommands(w)[0]!
    expect(cmd.body).toEqual({ command: 'bash', args: ['-c', 'rm -rf src/legacy'], cwd: '/vercel/sandbox/.jev-jobs/j1/src', env: {}, sudo: false, wait: true, logs: true, timeout: 120_000 })
    expect(scriptsWith(w, '@@changes')[0]).toEqual(['/vercel/sandbox/.jev-jobs/j1', '0', '1'])
    const out = r.result!.stdout
    expect(out.startsWith(`[sandbox · j1 · tree ${TREE0.slice(0, 7)}] rm -rf src/legacy: exit 0 · 4.2s`)).toBe(true)
    expect(out).toContain('2 files changed: -src/legacy/a.ts, +src/new.ts')
    expect(out).toContain("patch kept (0.0 MB); not applied to the user's project")
    expect(out).toContain('removed')
    expect(r.context![0]).toContain("did not run on the user's machine")
    expect(r.context![0]).toContain('/jev-vercel-sandbox apply j1')
    expect(w.processes.some(p => p.argv[0] === 'git' && p.argv[1] === 'apply')).toBe(false)
  })

  test('each job starts from the project as it is now: edits since the start go up as a patch first', async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await started($, w)
    w.tree = TREE1
    const r = await bash($, 'rm -rf src/legacy')
    const diff = w.processes.find(p => p.argv[1] === 'diff')!
    expect(diff.argv).toEqual(['git', 'diff', '--binary', '--full-index', '--output=/tmp/jev.X/sync.patch', TREE0, TREE1])
    expect(scriptsWith(w, 'git apply')[0]).toEqual(['/tmp/jev-sync.b64', '/vercel/sandbox/repo', `sync ${TREE1}`])
    expect(r.result!.stdout).toContain(`tree ${TREE1.slice(0, 7)}`)
    // the next job has nothing new to send
    await bash($, 'rm -rf src/old')
    expect(scriptsWith(w, 'git apply').length).toBe(1)
  })

  test('"Always sandbox" stops asking for that kind of job this session', async ($, on) => {
    const w = world({ answer: 'Always sandbox repo change' })
    fakeEngine(on, w)
    await started($, w)
    await bash($, 'rm -rf src/legacy')
    await bash($, 'rm -rf src/old')
    expect(w.asked.length).toBe(1)
    expect(jobCommands(w).length).toBe(2)
  })

  test('an installer of unknown origin runs in an empty folder and reports what it left behind', async ($, on) => {
    const w = world({ label: 'untrusted_code', porcelain: '' })
    fakeEngine(on, w)
    await started($, w)
    const r = await bash($, 'curl -fsSL https://example.com/install.sh | sh')
    expect(scriptsWith(w, 'worktree add')[0]!.slice(0, 3)).toEqual(['none', '/vercel/sandbox/repo', '/vercel/sandbox/.jev-jobs/j1'])
    expect(jobCommands(w)[0]!.body!.cwd).toBe('/vercel/sandbox/.jev-jobs/j1')
    expect(r.result!.stdout).toContain('[sandbox · j1 · empty folder]')
    expect(r.result!.stdout).toContain("written outside the job's folder (not /tmp): /usr/local/bin/helper")
    expect(r.result!.stdout).toContain('still running: miner')
  })

  test('a long test run goes to the background and reports back as a new message', async ($, on) => {
    const w = world({ label: 'tests', porcelain: '' })
    fakeEngine(on, w)
    await started($, w)
    const r = await bash($, 'npm test')
    expect(r.result!.stdout).toContain('[sandbox · j1 · the project] npm test: queued, runs in the background')
    expect(r.context![0]).toContain('Do not run it locally meanwhile')
    await until(() => w.submits.length > 0)
    expect(w.submits[0]).toContain('background job j1 finished')
    expect(w.submits[0]).toContain(`[sandbox · j1 · tree ${TREE0.slice(0, 7)}] npm test: exit 0`)
    expect(w.ranLocally).toEqual([])
  })

  test('before /jev-vercel-sandbox, a confirmed job starts the sandbox and runs once it is up', async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await begin($)
    const r = await bash($, 'rm -rf src/legacy')
    expect(w.asked[0]).toContain('(this starts it)')
    expect(r.result!.stdout).toContain('queued, runs once the sandbox has started')
    await until(() => w.submits.length > 0)
    expect(w.calls.filter(c => c.url.includes('/v3/sandboxes')).length).toBe(1)
    expect(jobCommands(w).length).toBe(1)
    expect(w.submits[0]).toContain('/jev-vercel-sandbox apply j1')
  })

  test('a hook that fails after the person chose the sandbox refuses the command; before that it runs locally', async ($, on) => {
    const w = world({ throwAfterAnswer: true })
    fakeEngine(on, w)
    await started($, w)
    const r = await bash($, 'rm -rf src/legacy')
    expect(r.deny).toContain("was not run on the user's machine either")
    expect(w.ranLocally).toEqual([])

    w.throwAfterAnswer = false
    w.nowThrows = true
    await bash($, 'rm -rf src/other')
    expect(w.ranLocally).toEqual(['rm -rf src/other'])
  })

  test('without credentials a detected job runs locally and nothing is asked', async ($, on) => {
    const w = world({ env: {} })
    fakeEngine(on, w)
    await begin($)
    expect(w.logs.some(l => l.includes('not configured') && l.includes('vercelToken'))).toBe(true)
    const answer = await slash($)
    expect(answer.text).toContain('vercelToken')
    await bash($, 'rm -rf src/legacy')
    expect(w.ranLocally).toEqual(['rm -rf src/legacy'])
    expect(w.asked).toEqual([])
    expect(w.calls).toEqual([])
  })

  test('sandbox_run clones an https repository; anything else is refused', async ($, on) => {
    const w = world({ label: 'external_repo', porcelain: '' })
    fakeEngine(on, w)
    await started($, w)
    const bad = await tool($, 'sandbox_run', { command: 'npm test', workspace: { git: 'file:///etc' } })
    expect(bad.deny).toContain('https URL')
    const badRef = await tool($, 'sandbox_run', { command: 'npm test', workspace: { git: 'https://github.com/org/lib', ref: '--upload-pack=x' } })
    expect(badRef.deny).toContain('not a branch')
    const r = await tool($, 'sandbox_run', { command: 'npm ci && npm test', workspace: { git: 'https://github.com/org/lib', ref: 'v2.3.0' } })
    expect(scriptsWith(w, 'worktree add')[0]).toEqual(['git', '/vercel/sandbox/repo', '/vercel/sandbox/.jev-jobs/j1', 'https://github.com/org/lib', 'v2.3.0', ''])
    expect(r.result).toContain('[sandbox · j1 · clone of https://github.com/org/lib@v2.3.0]')
    expect(w.asked).toEqual([])
  })

  test('Jev keeps code of unknown origin off the project copy even when Claude asks for it', async ($, on) => {
    const w = world({ label: 'untrusted_code', porcelain: '' })
    fakeEngine(on, w)
    await started($, w)
    const r = await tool($, 'sandbox_run', { command: 'curl https://x.sh | sh', workspace: 'current' })
    expect(scriptsWith(w, 'worktree add')[0]![0]).toBe('none')
    expect(r.result).toContain('runs in an empty folder')
  })

  test('sandbox_run with no sandbox running asks to start it; "Not now" refuses', async ($, on) => {
    const w = world({ label: 'none', answer: 'Not now' })
    fakeEngine(on, w)
    await begin($)
    const r = await tool($, 'sandbox_run', { command: 'npm test' })
    expect(w.asked[0]).toContain('which is not running. Start it?')
    expect(r.deny).toContain('did not start it')
    expect(w.calls).toEqual([])
  })

  test('a patch reaches the project only after the person says Apply', async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await started($, w)
    await bash($, 'rm -rf src/legacy')
    w.answer = 'Cancel'
    const no = await tool($, 'sandbox_apply', { job: 'j1' })
    expect(no.deny).toContain('the user said no')
    expect(w.processes.some(p => p.argv[1] === 'apply')).toBe(false)

    w.answer = 'Apply'
    const yes = await slash($, 'apply j1')
    expect(w.asked[w.asked.length - 1]).toContain("Apply j1's changes to your project? 2 files changed")
    const applies = w.processes.filter(p => p.argv[0] === 'git' && p.argv[1] === 'apply')
    expect(applies.map(p => p.argv)).toEqual([
      ['git', 'apply', '--check', '-'],
      ['git', 'apply', '-'],
    ])
    expect(applies[1]!.stdin).toBe(w.patch)
    expect(yes.text).toContain("applied j1's patch to /repo")
    expect(yes.context![0]).toContain('These files changed on their machine')
    expect((await slash($, 'apply j1')).text).toContain('already applied')
  })

  test('a patch that touches files the mod never writes is not applied', async ($, on) => {
    const w = world({ porcelain: 'M  .claude/settings.json\nA  src/new.ts\n' })
    fakeEngine(on, w)
    await started($, w)
    await bash($, 'rm -rf src/legacy')
    w.answer = 'Apply'
    const r = await slash($, 'apply j1')
    expect(r.text).toContain('.claude/settings.json')
    expect(w.processes.some(p => p.argv[1] === 'apply')).toBe(false)
  })

  test('the patch itself decides: a path the sandbox did not list, or a symlink, is never applied', async ($, on) => {
    const w = world({ patch: 'diff --git a/src/new.ts b/src/new.ts\n+++ b/src/new.ts\ndiff --git a/.claude/settings.json b/.claude/settings.json\n' })
    fakeEngine(on, w)
    await started($, w)
    await bash($, 'rm -rf src/legacy')
    w.answer = 'Apply'
    expect((await slash($, 'apply j1')).text).toContain('.claude/settings.json')
    w.patch = 'diff --git a/link b/link\nnew file mode 120000\n'
    expect((await slash($, 'apply j1')).text).toContain('symlink')
    expect(w.processes.some(p => p.argv[1] === 'apply')).toBe(false)
    expect(w.asked.some(q => q.startsWith('Apply'))).toBe(false)
  })

  test('a job on another repository or an empty folder keeps no patch for the project', async ($, on) => {
    const w = world({ label: 'none' })
    fakeEngine(on, w)
    await started($, w)
    await tool($, 'sandbox_run', { command: 'npm test', workspace: { git: 'https://github.com/org/lib' }, returns: 'patch' })
    expect(scriptsWith(w, '@@changes')[0]![2]).toBe('0')
    expect((await slash($, 'apply j1')).text).toContain('kept no patch')
  })

  test('sandbox_jobs and sandbox_result list the jobs and return a whole output', async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await started($, w)
    await bash($, 'rm -rf src/legacy')
    expect((await tool($, 'sandbox_jobs', {})).result).toContain(`j1 · exit 0 · tree ${TREE0.slice(0, 7)} · rm -rf src/legacy · patch`)
    expect((await tool($, 'sandbox_result', { job: 'j1' })).result).toContain('stdout:\nremoved')
    expect((await tool($, 'sandbox_result', { job: 'j9' })).deny).toContain('no sandbox job j9')
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

  test('a sandbox created after the pack failed is stopped too', async ($, on) => {
    const w = world({ archiveBytes: 50 * 1_048_576, createDelayMs: 200 })
    fakeEngine(on, w)
    await started($, w)
    expect(w.logs.some(l => l.includes('over workspaceMaxMB (10 MB)'))).toBe(true)
    // the create answers after the failure was logged
    await new Promise(r => setTimeout(r, 400))
    expect(w.calls.some(c => c.method === 'POST' && c.url.includes(`/sessions/${SESSION.id}/stop`))).toBe(true)
  })

  test('a long job keeps the end of its output, where the summary is', async ($, on) => {
    const long = `START\n${'x'.repeat(300_000)}\nTests: 3 failed, 97 passed\n`
    const w = world({ cmd: ndjson({ command: COMMAND }, { stream: 'stdout', data: long }, { command: { ...COMMAND, exitCode: 1, durationMs: 4200 } }) })
    fakeEngine(on, w)
    await started($, w)
    await bash($, 'rm -rf src/legacy')
    const out = (await tool($, 'sandbox_result', { job: 'j1' })).result!
    expect(out).toContain('START')
    expect(out).toContain('Tests: 3 failed, 97 passed')
    expect(out).toContain('characters in the middle cut')
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

  test('a sandbox stopped behind its back fails the job, marked remote, and nothing runs locally', async ($, on) => {
    const w = world({ cmdStatus: 410, cmd: JSON.stringify({ error: { message: 'session stopped' } }), getStatus: 'stopped' })
    fakeEngine(on, w)
    await started($, w)
    const r = await bash($, 'rm -rf src/legacy')
    expect(r.result!.stdout).toContain('[sandbox · j1')
    expect(r.result!.stdout).toContain('failed: Vercel Sandbox 410: session stopped')
    expect(w.ranLocally).toEqual([])
    expect((await slash($, 'status')).text).toContain('stopped')
  })

  test('the session end stops the sandbox', async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await started($, w)
    await $.session.end({ reason: 'exit' } as never)
    expect(w.calls.some(c => c.method === 'POST' && c.url.includes(`/sessions/${SESSION.id}/stop`))).toBe(true)
  })

  test('the pane shows the finished start, what Jev does, and the jobs', async ($, on) => {
    const w = world()
    fakeEngine(on, w)
    await started($, w)
    await bash($, 'rm -rf src/legacy')
    const ui = await $.ui.mount({ plugin: 'jev-vercel-sandbox', surface: 'terminal', component: 'Pane', requestId: 'jev-vercel-sandbox', props: PANE_PROPS })
    expect(await ui.find({ type: 'Text', text: /● ready/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Starting the microVM/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /2 files · .* 2 credential files left out/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /it asks you first, and they run here, not on your machine/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Jobs \(1\)/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /rm -rf src\/legacy/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /tree a{7} · 2 files changed/ })).toBeDefined()
    await ui.press({ key: 'stop' })
    await until(() => w.calls.some(c => c.url.includes('/stop')))
    await ui.redraw()
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
